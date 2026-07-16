/**
 * Zustand store for stream status management
 * Tracks online/offline/error status for each drone's video stream
 */
import { create } from 'zustand';
import type { StreamStatus } from '@sd/shared';

interface StreamState {
  // State: stream status per drone, keyed by droneId
  streamStatuses: Record<string, StreamStatus>;
  lastUpdate: Record<string, Date>;

  // Actions
  setStatus: (droneId: string, status: StreamStatus) => void;
  reset: () => void;
}

/**
 * Create the stream store
 * Manages video stream status for all drones
 */
export const useStreamStore = create<StreamState>()((set) => ({
  // Initial state: all streams are offline
  streamStatuses: {},
  lastUpdate: {},

  // Set status for a specific drone
  setStatus: (droneId, status) =>
    set((state) => ({
      streamStatuses: {
        ...state.streamStatuses,
        [droneId]: status,
      },
      lastUpdate: {
        ...state.lastUpdate,
        [droneId]: new Date(),
      },
    })),

  // Reset all stream statuses
  reset: () =>
    set(() => ({
      streamStatuses: {},
      lastUpdate: {},
    })),
}));