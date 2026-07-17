/**
 * Zustand store for drone selection state
 * Manages available drones list and selected drone ID
 */
import { create } from 'zustand';
import type { Socket } from 'socket.io-client';

/**
 * Drone store state and actions
 */
interface DroneState {
  // State
  drones: string[];
  selectedDroneId: string | null;

  // Actions
  setDrones: (drones: string[]) => void;
  selectDrone: (droneId: string) => void;
  subscribeToDrones: (socket: Socket) => void;
}

/**
 * Create the drone store
 * Manages drone list and selection for the dashboard
 */
export const useDroneStore = create<DroneState>()((set, get) => ({
  // Initial state
  drones: [],
  selectedDroneId: null,

  // Set the list of available drones
  setDrones: (drones: string[]) => set({ drones }),

  // Select a specific drone
  selectDrone: (droneId: string) => set({ selectedDroneId: droneId }),

  // Subscribe to drone list updates via socket
  subscribeToDrones: (socket: Socket) => {
    // Request drone list
    socket.emit('drones:list', (response: { drones: string[] }) => {
      const { drones } = response;
      const currentSelected = get().selectedDroneId;

      // Update drone list
      set({ drones });

      // Auto-select first drone if none selected
      if (!currentSelected && drones.length > 0) {
        set({ selectedDroneId: drones[0] });
      }

      // Clear selection if selected drone is no longer available
      if (currentSelected && !drones.includes(currentSelected)) {
        set({ selectedDroneId: drones.length > 0 ? drones[0] : null });
      }
    });

    // Poll for drone list every 5 seconds
    const intervalId = setInterval(() => {
      if (socket.connected) {
        socket.emit('drones:list', (response: { drones: string[] }) => {
          const { drones } = response;
          const currentSelected = get().selectedDroneId;

          set({ drones });

          // Auto-select first drone if none selected
          if (!currentSelected && drones.length > 0) {
            set({ selectedDroneId: drones[0] });
          }

          // Clear selection if selected drone is no longer available
          if (currentSelected && !drones.includes(currentSelected)) {
            set({ selectedDroneId: drones.length > 0 ? drones[0] : null });
          }
        });
      }
    }, 5000);

    // Store interval ID on socket for cleanup
    (socket as unknown as { _droneListInterval?: NodeJS.Timeout })._droneListInterval = intervalId;
  },
}));