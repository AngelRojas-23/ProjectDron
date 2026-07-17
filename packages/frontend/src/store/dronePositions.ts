/**
 * Zustand store for drone positions
 * Tracks real-time position data from telemetry broadcasts
 */
import { create } from 'zustand';
import type { Socket } from 'socket.io-client';
import type { Telemetry } from '@sd/shared';

/**
 * Drone position data with timestamp
 */
export interface DronePosition {
  droneId: string;
  lat: number;
  lon: number;
  heading: number | null;
  alt: number;
  groundspeed: number | null;
  battery: number;
  flightMode: string | null;
  armed: boolean | null;
  timestamp: number;
}

/**
 * Drone position store state and actions
 */
interface DronePositionState {
  // State - keyed by droneId
  positions: Record<string, DronePosition>;

  // Actions
  updatePosition: (data: Telemetry) => void;
  subscribeToTelemetry: (socket: Socket) => () => void;
  getActiveDrones: () => DronePosition[];
}

/**
 * Default center coordinates (San Francisco)
 */
const DEFAULT_CENTER = { lat: 37.7749, lon: -122.4194 };

/**
 * Create the drone position store
 * Manages real-time position tracking from telemetry
 */
export const useDronePositionStore = create<DronePositionState>()((set, get) => ({
  // Initial state
  positions: {},

  // Update position for a specific drone from telemetry data
  updatePosition: (data: Telemetry) =>
    set((state) => ({
      positions: {
        ...state.positions,
        [data.droneId]: {
          droneId: data.droneId,
          lat: data.lat,
          lon: data.lon,
          heading: data.heading,
          alt: data.alt,
          groundspeed: data.groundspeed,
          battery: data.battery,
          flightMode: data.flightMode,
          armed: data.armed,
          timestamp: Date.now(),
        },
      },
    })),

  // Subscribe to telemetry events from socket
  subscribeToTelemetry: (socket: Socket) => {
    // Handle incoming telemetry data
    const handleTelemetry = (data: Telemetry) => {
      get().updatePosition(data);
    };

    // Subscribe to telemetry event
    socket.on('telemetry', handleTelemetry);

    // Return cleanup function
    return () => {
      socket.off('telemetry', handleTelemetry);
    };
  },

  // Get drones with positions updated in the last 10 seconds
  getActiveDrones: () => {
    const positions = get().positions;
    const now = Date.now();
    const ACTIVE_THRESHOLD = 10000; // 10 seconds

    return Object.values(positions)
      .filter((pos) => now - pos.timestamp < ACTIVE_THRESHOLD)
      .sort((a, b) => b.timestamp - a.timestamp);
  },
}));

/**
 * Get the default map center (first active drone or default location)
 */
export function getMapCenter(): { lat: number; lon: number } {
  const activeDrones = useDronePositionStore.getState().getActiveDrones();
  if (activeDrones.length > 0) {
    return { lat: activeDrones[0].lat, lon: activeDrones[0].lon };
  }
  return DEFAULT_CENTER;
}

/**
 * Get drone connection status based on last update
 */
export type DroneConnectionStatus = 'connected' | 'reconnecting' | 'disconnected';

export function getDroneConnectionStatus(droneId: string): DroneConnectionStatus {
  const position = useDronePositionStore.getState().positions[droneId];
  if (!position) return 'disconnected';

  const now = Date.now();
  const timeSinceUpdate = now - position.timestamp;

  if (timeSinceUpdate < 5000) return 'connected'; // Last update < 5 seconds
  if (timeSinceUpdate < 30000) return 'reconnecting'; // Last update < 30 seconds
  return 'disconnected'; // No update for 30+ seconds
}