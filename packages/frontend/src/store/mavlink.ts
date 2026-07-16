/**
 * Zustand store for MAVLink connection status
 * Manages bridge connection state for UI display
 */
import { create } from 'zustand';

export type MavlinkStatus = 'connected' | 'disconnected' | 'reconnecting';

/**
 * Mavlink store state and actions
 */
interface MavlinkState {
  // State
  status: MavlinkStatus;
  message: string | undefined;
  lastUpdate: Date | null;

  // Actions
  setStatus: (status: MavlinkStatus, message?: string) => void;
  reset: () => void;
}

/**
 * Create the MAVLink connection status store
 */
export const useMavlinkStore = create<MavlinkState>()((set) => ({
  // Initial state
  status: 'disconnected',
  message: undefined,
  lastUpdate: null,

  // Set status action - updates status and timestamp
  setStatus: (status, message) =>
    set({
      status,
      message,
      lastUpdate: new Date(),
    }),

  // Reset action - clear status
  reset: () =>
    set({
      status: 'disconnected',
      message: undefined,
      lastUpdate: null,
    }),
}));