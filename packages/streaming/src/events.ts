/**
 * Socket.io Event Handlers
 * Handles drone join, control commands, and telemetry
 */

import type { Server, Socket } from 'socket.io';
import type { RoomManager } from './rooms.js';
import type { Telemetry } from '@sd/shared/index.js';
import { sendCommand, type CommandType } from './mavlink/commands.js';
import { type MavlinkBridge } from './mavlink/bridge.js';
export type { Telemetry } from '@sd/shared/index.js';

/**
 * Control command types (now includes arm/disarm)
 */
type ControlCommand = 'arm' | 'disarm' | 'takeoff' | 'RTL' | 'land' | 'return';

/**
 * Global reference to the MAVLink bridge (set by server.ts)
 */
let bridge: MavlinkBridge | null = null;

/**
 * Global reference to Socket.io server for broadcasting
 */
let ioServer: Server | null = null;

/**
 * Simple in-memory rate limiter for WebSocket events
 * Tracks event counts per socket ID and rejects if limits exceeded
 */
class SocketRateLimiter {
  private counters: Map<string, { count: number; resetAt: number }> = new Map();
  private readonly maxEvents: number;
  private readonly windowMs: number;

  constructor(maxEvents: number = 30, windowMs: number = 60000) {
    this.maxEvents = maxEvents;
    this.windowMs = windowMs;
  }

  /**
   * Check if a socket is allowed to perform an action
   * @param socketId - The socket ID
   * @returns true if allowed, false if rate limited
   */
  check(socketId: string): boolean {
    const now = Date.now();
    const entry = this.counters.get(socketId);

    if (!entry || now > entry.resetAt) {
      // First event or window expired — reset counter
      this.counters.set(socketId, { count: 1, resetAt: now + this.windowMs });
      return true;
    }

    if (entry.count >= this.maxEvents) {
      return false; // Rate limited
    }

    entry.count++;
    return true;
  }

  /**
   * Remove a socket from tracking (on disconnect)
   */
  remove(socketId: string): void {
    this.counters.delete(socketId);
  }
}

// 30 events per minute per socket (drone:join, drone:control, drones:list)
const rateLimiter = new SocketRateLimiter(30, 60000);

/**
 * Set the MAVLink bridge reference for command handling
 */
export function setMavlinkBridge(b: MavlinkBridge): void {
  bridge = b;
}

/**
 * Get the Socket.io server instance
 */
function getIo(): Server | null {
  return ioServer;
}

/**
 * Register all event handlers with the Socket.io server
 * @param io - The Socket.io server instance
 * @param roomManager - The room manager instance
 */
export function registerEventHandlers(io: Server, roomManager: RoomManager): void {
  // Store reference for command broadcasting
  ioServer = io;

  // Handle new connections
  io.on('connection', (socket: Socket) => {
    console.log(`Socket connected: ${socket.id}, User: ${socket.data.user?.userId}`);

    // Handle drones:list event (no auth required - read-only list)
    socket.on('drones:list', (callback: (response: { drones: string[] }) => void) => {
      if (!rateLimiter.check(socket.id)) {
        return callback({ drones: [] });
      }
      handleDronesList(roomManager, callback);
    });

    // Handle drone:join event
    socket.on('drone:join', (droneId: string, callback: (response: { ok: boolean; error?: string }) => void) => {
      if (!rateLimiter.check(socket.id)) {
        return callback({ ok: false, error: 'Rate limit exceeded' });
      }
      handleDroneJoin(socket, roomManager, droneId, callback);
    });

    // Handle drone:control event
    socket.on('drone:control', (command: ControlCommand, callback: (response: { ok: boolean; error?: string }) => void) => {
      if (!rateLimiter.check(socket.id)) {
        return callback({ ok: false, error: 'Rate limit exceeded' });
      }
      handleDroneControl(socket, roomManager, command, callback);
    });

    // Handle disconnection
    socket.on('disconnect', () => {
      console.log(`Socket disconnected: ${socket.id}`);
      rateLimiter.remove(socket.id);
      roomManager.leaveRoom(socket);
    });
  });
}

/**
 * Handle drones:list event
 * Returns list of active drone IDs - no auth required
 * @param roomManager - The room manager
 * @param callback - Response callback
 */
function handleDronesList(
  roomManager: RoomManager,
  callback: (response: { drones: string[] }) => void
): void {
  const drones = roomManager.getAllDrones();
  callback({ drones });
}

/**
 * Handle drone:join event
 * Adds socket to the drone's room
 * @param socket - The socket joining
 * @param roomManager - The room manager
 * @param droneId - The drone ID to join
 * @param callback - Response callback
 */
function handleDroneJoin(
  socket: Socket,
  roomManager: RoomManager,
  droneId: string,
  callback: (response: { ok: boolean; error?: string }) => void
): void {
  // Get user from socket data (set by JWT middleware)
  const user = socket.data.user;

  if (!user) {
    callback({ ok: false, error: 'Not authenticated' });
    return;
  }

  // Validate droneId
  if (!droneId || typeof droneId !== 'string' || droneId.length > 100) {
    callback({ ok: false, error: 'Invalid drone ID' });
    return;
  }

  // Leave any current room before joining new one
  roomManager.leaveRoom(socket);

  // Join the new room
  const success = roomManager.joinRoom(socket, droneId);

  if (success) {
    console.log(`User ${user.userId} joined drone ${droneId}`);
    callback({ ok: true });
  } else {
    callback({ ok: false, error: 'Failed to join room' });
  }
}

/**
 * Handle drone:control event
 * Processes control commands, rejects non-operators
 * Sends commands via MAVLink bridge if connected, otherwise returns error
 * @param socket - The socket sending command
 * @param roomManager - The room manager
 * @param command - The control command
 * @param callback - Response callback
 */
async function handleDroneControl(
  socket: Socket,
  _roomManager: RoomManager,
  command: ControlCommand,
  callback: (response: { ok: boolean; error?: string }) => void
): Promise<void> {
  // Get user from socket data
  const user = socket.data.user;

  if (!user) {
    callback({ ok: false, error: 'Not authenticated' });
    return;
  }

  // Only operators can send control commands
  if (user.role !== 'operator') {
    console.log(`User ${user.userId} (role: ${user.role}) attempted control command: ${command}`);
    callback({ ok: false, error: 'Only operators can control drones' });
    return;
  }

  // Validate command
  const validCommands: ControlCommand[] = ['arm', 'disarm', 'takeoff', 'RTL', 'land', 'return'];
  if (!validCommands.includes(command)) {
    callback({ ok: false, error: 'Invalid command' });
    return;
  }

  // Map 'return' command to RTL
  const mavCommand: CommandType = command === 'return' ? 'RTL' : command as CommandType;

  // Check if bridge is connected - if not, reject command
  if (!bridge || !bridge.isConnected()) {
    console.log(`[Command] MAVLink bridge not connected, cannot send command: ${command}`);
    callback({ ok: false, error: 'MAVLink bridge not connected' });
    return;
  }

    // Send command via MAVLink
    console.log(`[Command] Operator ${user.userId} sending command: ${mavCommand}`);

    try {
      const result = await sendCommand(mavCommand);

      // Broadcast result to all clients
      const io = getIo();
      if (io) {
        io.emit('control:ack', mavCommand, result.success, result.message);
      }

      callback({ ok: result.success, error: result.success ? undefined : result.message });
    } catch (error) {
      console.error(`[Command] Failed to send command: ${error}`);
      callback({ ok: false, error: 'Failed to send command' });
    }
  }

/**
 * Broadcast telemetry to all sockets in a drone room
 * @param io - The Socket.io server
 * @param droneId - The drone ID
 * @param telemetry - The telemetry data
 */
export function broadcastTelemetry(io: Server, droneId: string, telemetry: Telemetry): void {
  const roomKey = `drone:${droneId}`;
  io.to(roomKey).emit('telemetry', telemetry);
}

export default registerEventHandlers;