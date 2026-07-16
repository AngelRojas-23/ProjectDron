/**
 * MAVLink Bridge
 * WebSocket client that connects to mavlink2rest and accumulates telemetry
 */

import WebSocket from 'ws';
import type { Server } from 'socket.io';
import type { RoomManager } from '../rooms.js';
import type { Telemetry } from '@sd/shared/index.js';
import {
  createAccumulator,
  type MavAccumulator,
  type Mavlink2RestWsMessage,
  type MavlinkMessage,
} from './types.js';

/**
 * Connection status for MAVLink bridge
 */
export type BridgeStatus = 'connected' | 'disconnected' | 'reconnecting';

/**
 * Configuration for MAVLink bridge
 */
export interface BridgeConfig {
  wsUrl: string;
  restUrl: string;
  reconnectMinDelay: number;
  reconnectMaxDelay: number;
  emitInterval: number;
  staleThreshold: number;
}

/**
 * Default configuration
 */
const DEFAULT_CONFIG: BridgeConfig = {
  wsUrl: process.env.MAVLINK_WS_URL || 'ws://localhost:8088/v1/ws/mavlink',
  restUrl: process.env.MAVLINK_REST_URL || 'http://localhost:8088/v1/mavlink',
  reconnectMinDelay: 1000,
  reconnectMaxDelay: 30000,
  emitInterval: 200, // 5Hz
  staleThreshold: 3000, // 3 seconds
};

/**
 * Maps system_id to droneId for telemetry broadcast
 * In a real system, this would come from a database mapping
 */
const SYSTEM_ID_TO_DRONE: Record<number, string> = {
  1: 'drone-1',
  2: 'drone-2',
  3: 'drone-3',
  4: 'drone-4',
  5: 'drone-5',
};

/**
 * MAVLink Bridge class
 * Manages WebSocket connection, state accumulation, and telemetry emission
 */
export class MavlinkBridge {
  private ws: WebSocket | null = null;
  private config: BridgeConfig;
  private accumulators: Map<number, MavAccumulator> = new Map();
  private emitInterval: NodeJS.Timeout | null = null;
  private reconnectTimeout: NodeJS.Timeout | null = null;
  private reconnectAttempt = 0;
  private status: BridgeStatus = 'disconnected';
  private statusListeners: Array<(status: BridgeStatus, message?: string) => void> = [];
  private io: Server | null = null;
  private roomManager: RoomManager | null = null;
  private simulationActive = false;
  private simulationInterval: NodeJS.Timeout | null = null;

  constructor(config: Partial<BridgeConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Set the Socket.io server instance for broadcasting
   */
  setServer(io: Server): void {
    this.io = io;
  }

  /**
   * Set the room manager for telemetry broadcast
   */
  setRoomManager(roomManager: RoomManager): void {
    this.roomManager = roomManager;
  }

  /**
   * Register a status change listener
   */
  onStatusChange(listener: (status: BridgeStatus, message?: string) => void): void {
    this.statusListeners.push(listener);
  }

  /**
   * Get current bridge status
   */
  getStatus(): BridgeStatus {
    return this.status;
  }

  /**
   * Check if using real MAVLink data (vs simulator)
   */
  isConnected(): boolean {
    return this.status === 'connected';
  }

  /**
   * Start the bridge - connect to WebSocket and start emit loop
   */
  start(): void {
    console.log('[MAVLink] Starting bridge...');
    this.connect();
    this.startEmitLoop();
  }

  /**
   * Stop the bridge - disconnect and cleanup
   */
  stop(): void {
    console.log('[MAVLink] Stopping bridge...');
    this.stopEmitLoop();
    this.cancelReconnect();
    this.disconnect();
    this.stopSimulation();
  }

  /**
   * Connect to mavlink2rest WebSocket
   */
  private connect(): void {
    // Close existing connection if any
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }

    try {
      // Connect with message filter for only needed messages
      const url = `${this.config.wsUrl}?filter=HEARTBEAT,GPS_POSITION_INT,BATTERY_STATUS,VFR_HUD,ATTITUDE,SYS_STATUS,COMMAND_ACK`;
      console.log(`[MAVLink] Connecting to ${url}`);

      this.ws = new WebSocket(url);

      this.ws.on('open', () => {
        console.log('[MAVLink] WebSocket connected');
        this.reconnectAttempt = 0;
        this.setStatus('connected');
      });

      this.ws.on('message', (data: Buffer) => {
        try {
          const message: Mavlink2RestWsMessage = JSON.parse(data.toString());
          this.handleMessage(message);
        } catch (err) {
          console.error('[MAVLink] Failed to parse message:', err);
        }
      });

      this.ws.on('close', () => {
        console.log('[MAVLink] WebSocket closed');
        this.setStatus('disconnected');
        this.scheduleReconnect();
      });

      this.ws.on('error', (err) => {
        console.error('[MAVLink] WebSocket error:', err.message);
        this.setStatus('disconnected');
      });
    } catch (err) {
      console.error('[MAVLink] Failed to connect:', err);
      this.setStatus('disconnected');
      this.scheduleReconnect();
    }
  }

  /**
   * Disconnect from WebSocket
   */
  private disconnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  /**
   * Schedule reconnection with exponential backoff
   */
  private scheduleReconnect(): void {
    this.cancelReconnect();

    // Calculate delay with exponential backoff
    const delay = Math.min(
      this.config.reconnectMinDelay * Math.pow(2, this.reconnectAttempt),
      this.config.reconnectMaxDelay
    );

    this.reconnectAttempt++;
    console.log(`[MAVLink] Scheduling reconnect in ${delay}ms (attempt ${this.reconnectAttempt})`);

    this.setStatus('reconnecting');

    this.reconnectTimeout = setTimeout(() => {
      console.log('[MAVLink] Attempting reconnection...');
      this.connect();
    }, delay);
  }

  /**
   * Cancel pending reconnection
   */
  private cancelReconnect(): void {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
  }

  /**
   * Update bridge status and notify listeners
   */
  private setStatus(status: BridgeStatus, message?: string): void {
    const previousStatus = this.status;
    this.status = status;

    // Notify listeners
    for (const listener of this.statusListeners) {
      listener(status, message);
    }

    // Broadcast to all connected clients
    if (this.io) {
      this.io.emit('mavlink:status', status, message);
    }

    // Manage simulation fallback
    if (status === 'connected' && previousStatus !== 'connected') {
      this.stopSimulation();
    } else if (status !== 'connected' && previousStatus === 'connected') {
      this.startSimulation();
    } else if (status === 'disconnected' && !this.simulationActive) {
      // Start simulation when disconnected (including initial state)
      this.startSimulation();
    }
  }

  /**
   * Handle incoming MAVLink message
   */
  private handleMessage(wsMessage: Mavlink2RestWsMessage): void {
    const { header, message } = wsMessage;
    const systemId = header.system_id;

    // Get or create accumulator for this system
    let accumulator = this.accumulators.get(systemId);
    if (!accumulator) {
      accumulator = createAccumulator();
      this.accumulators.set(systemId, accumulator);
    }

    // Update accumulator based on message type
    this.updateAccumulator(accumulator, message, header);
  }

  /**
   * Update accumulator with message data
   */
  private updateAccumulator(
    acc: MavAccumulator,
    message: MavlinkMessage,
    header: { system_id: number; component_id: number }
  ): void {
    const now = Date.now();
    acc.mavSystemId = header.system_id;
    acc.mavComponentId = header.component_id;
    acc.receivedAt['source'] = now;

    switch (message.type) {
      case 'HEARTBEAT':
        // base_mode & 128 indicates armed state
        acc.armed = (message.data.base_mode & 128) !== 0;
        acc.receivedAt['heartbeat'] = now;

        // Map autopilot and custom_mode to flight mode
        const autopilot = message.data.autopilot;
        if (autopilot === 3) {
          // ArduPilot
          const mode = message.data.custom_mode;
          if (mode === 4) acc.flightMode = 'STABILIZE';
          else if (mode === 11) acc.flightMode = 'AUTO';
          else if (mode === 15) acc.flightMode = 'RTL';
          else if (mode === 9) acc.flightMode = 'LAND';
          else acc.flightMode = `MODE_${mode}`;
        } else {
          acc.flightMode = `AUTOPILOT_${autopilot}`;
        }
        break;

      case 'GPS_POSITION_INT':
        // Convert from degE7 to degrees
        acc.lat = message.data.lat / 1e7;
        acc.lon = message.data.lon / 1e7;
        // alt is in mm, convert to meters
        acc.alt = message.data.relative_alt / 1000;
        // heading is in cdeg (centidegrees), convert to degrees
        acc.heading = message.data.hdg / 100;
        acc.receivedAt['gps'] = now;
        break;

      case 'BATTERY_STATUS':
        // battery_remaining is percentage
        acc.battery = message.data.battery_remaining;
        // voltage is in mV, convert to V
        acc.voltage = message.data.voltages[0] !== undefined ? message.data.voltages[0] / 1000 : null;
        // current is in cA (centiamps), convert to A
        acc.current = message.data.current_battery !== 65535 ? message.data.current_battery / 100 : null;
        acc.receivedAt['battery'] = now;
        break;

      case 'VFR_HUD':
        // Already in correct units
        acc.groundspeed = message.data.groundspeed;
        acc.airspeed = message.data.airspeed;
        acc.alt = message.data.alt;
        acc.heading = message.data.heading;
        acc.receivedAt['vfr'] = now;
        break;

      case 'ATTITUDE':
        // Convert from radians to degrees
        acc.roll = (message.data.roll * 180) / Math.PI;
        acc.pitch = (message.data.pitch * 180) / Math.PI;
        acc.yaw = (message.data.yaw * 180) / Math.PI;
        acc.receivedAt['attitude'] = now;
        break;

      case 'SYS_STATUS':
        // Map sensor flags to flight mode (simplified)
        const sensors = message.data.onboard_control_sensors_present;
        if (sensors & 0x1000) {
          acc.flightMode = 'AUTO';
        } else {
          acc.flightMode = 'MANUAL';
        }
        // Battery info from sys_status as backup
        if (acc.battery === null) {
          acc.battery = message.data.battery_remaining;
        }
        if (acc.voltage === null && message.data.voltage_battery > 0) {
          acc.voltage = message.data.voltage_battery / 1000;
        }
        if (acc.current === null && message.data.current_battery > 0) {
          acc.current = message.data.current_battery / 100;
        }
        acc.receivedAt['sys_status'] = now;
        break;

      case 'COMMAND_ACK':
        // Handle command acknowledgment - handled by commands.ts
        // Import dynamically to avoid circular dependencies
        import('./commands.js').then((commands) => {
          commands.handleCommandAck(message.data.command, message.data.result);
        });
        break;
    }
  }

  /**
   * Start the emit loop - broadcasts telemetry at 5Hz
   */
  private startEmitLoop(): void {
    if (this.emitInterval) {
      return;
    }

    this.emitInterval = setInterval(() => {
      this.emitTelemetry();
    }, this.config.emitInterval);
  }

  /**
   * Stop the emit loop
   */
  private stopEmitLoop(): void {
    if (this.emitInterval) {
      clearInterval(this.emitInterval);
      this.emitInterval = null;
    }
  }

  /**
   * Emit accumulated telemetry for all drones
   */
  private emitTelemetry(): void {
    if (!this.roomManager) {
      return;
    }

    const now = Date.now();

    for (const [systemId, acc] of this.accumulators) {
      const droneId = SYSTEM_ID_TO_DRONE[systemId];
      if (!droneId) {
        continue;
      }

      // Build telemetry frame
      const telemetry: Telemetry = {
        id: `telemetry-${now}-${systemId}`,
        flightId: `flight-${droneId}`,
        droneId,
        lat: acc.lat ?? 0,
        lon: acc.lon ?? 0,
        alt: acc.alt ?? 0,
        heading: acc.heading,
        groundspeed: acc.groundspeed,
        airspeed: acc.airspeed,
        battery: acc.battery ?? 0,
        voltage: acc.voltage,
        current: acc.current,
        flightMode: acc.flightMode,
        armed: acc.armed,
        mavSystemId: acc.mavSystemId,
        mavComponentId: acc.mavComponentId,
        connectionSource: 'mavlink',
        ts: new Date(now),
        createdAt: new Date(now),
      };

      // Broadcast to room
      this.roomManager.broadcastTelemetry(droneId, telemetry);
    }
  }

  /**
   * Start simulated telemetry fallback
   */
  startSimulation(): void {
    if (this.simulationActive || !this.roomManager) {
      return;
    }

    console.log('[MAVLink] Starting telemetry simulation fallback');
    this.simulationActive = true;

    this.simulationInterval = setInterval(() => {
      const drones = this.roomManager?.getAllDrones() || [];
      // Always emit for testing - if no drones registered, emit for default drone
      const droneIds = drones.length > 0 ? drones : ['drone-1'];
      const now = Date.now();

      for (const droneId of droneIds) {
        const telemetry: Telemetry = {
          id: `telemetry-${now}`,
          flightId: `flight-${droneId}`,
          droneId,
          lat: 33.9425 + (Math.random() - 0.5) * 0.01,
          lon: -118.4081 + (Math.random() - 0.5) * 0.01,
          alt: 50 + Math.random() * 50,
          heading: Math.random() * 360,
          groundspeed: 10 + Math.random() * 20,
          airspeed: 12 + Math.random() * 20,
          battery: 70 + Math.floor(Math.random() * 30),
          voltage: 22.2 + Math.random() * 2,
          current: 5 + Math.random() * 10,
          flightMode: 'STABILIZE',
          armed: true,
          mavSystemId: null,
          mavComponentId: null,
          connectionSource: 'simulator',
          ts: new Date(now),
          createdAt: new Date(now),
        };

        this.roomManager?.broadcastTelemetry(droneId, telemetry);
      }
    }, 500); // Faster interval for testing
  }

  /**
   * Stop simulated telemetry fallback
   */
  stopSimulation(): void {
    if (!this.simulationActive) {
      return;
    }

    console.log('[MAVLink] Stopping telemetry simulation fallback');
    this.simulationActive = false;

    if (this.simulationInterval) {
      clearInterval(this.simulationInterval);
      this.simulationInterval = null;
    }
  }
}

/**
 * Create and initialize the MAVLink bridge
 */
export function createMavlinkBridge(config?: Partial<BridgeConfig>): MavlinkBridge {
  return new MavlinkBridge(config);
}