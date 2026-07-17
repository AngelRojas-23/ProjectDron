/**
 * Alert store for drone monitoring
 * Tracks alerts for low battery, lost connection, and other events
 */
import { create } from 'zustand';
import type { Socket } from 'socket.io-client';

/**
 * Severity levels for alerts
 */
export type AlertSeverity = 'critical' | 'warning' | 'info';

/**
 * Alert types
 */
export type AlertType =
  | 'battery_low'
  | 'battery_critical'
  | 'connection_lost'
  | 'connection_restored'
  | 'disarmed'
  | 'mode_changed';

/**
 * Alert entry
 */
export interface Alert {
  id: string;
  droneId: string;
  type: AlertType;
  severity: AlertSeverity;
  title: string;
  message: string;
  timestamp: Date;
  acknowledged: boolean;
}

/**
 * Alert thresholds
 */
const BATTERY_WARNING_THRESHOLD = 30;
const BATTERY_CRITICAL_THRESHOLD = 15;
const STALE_THRESHOLD_MS = 15000; // 15 seconds without telemetry = lost connection

/**
 * Alert store state
 */
interface AlertState {
  alerts: Alert[];
  unreadCount: number;

  // Actions
  addAlert: (alert: Omit<Alert, 'id' | 'timestamp' | 'acknowledged'>) => void;
  acknowledgeAlert: (id: string) => void;
  acknowledgeAll: () => void;
  clearAlerts: () => void;
  subscribeToTelemetry: (socket: Socket) => () => void;
}

/**
 * Generate a unique alert ID
 */
let alertIdCounter = 0;
function generateAlertId(): string {
  return `alert-${Date.now()}-${alertIdCounter++}`;
}

/**
 * Create the alert store
 */
export const useAlertStore = create<AlertState>()((set, get) => ({
  alerts: [],
  unreadCount: 0,

  addAlert: (alertData) => {
    const alert: Alert = {
      ...alertData,
      id: generateAlertId(),
      timestamp: new Date(),
      acknowledged: false,
    };

    set((state) => ({
      alerts: [alert, ...state.alerts].slice(0, 100), // Keep last 100 alerts
      unreadCount: state.unreadCount + 1,
    }));
  },

  acknowledgeAlert: (id) => {
    set((state) => ({
      alerts: state.alerts.map((a) =>
        a.id === id ? { ...a, acknowledged: true } : a
      ),
      unreadCount: Math.max(0, state.unreadCount - 1),
    }));
  },

  acknowledgeAll: () => {
    set((state) => ({
      alerts: state.alerts.map((a) => ({ ...a, acknowledged: true })),
      unreadCount: 0,
    }));
  },

  clearAlerts: () => {
    set({ alerts: [], unreadCount: 0 });
  },

  subscribeToTelemetry: (socket) => {
    // Track last telemetry timestamp per drone
    const lastTelemetry: Record<string, number> = {};
    const previousBattery: Record<string, number> = {};
    const previousArmed: Record<string, boolean> = {};
    const previousMode: Record<string, string> = {};

    // Check for stale connections every 10 seconds
    const staleCheckInterval = setInterval(() => {
      const now = Date.now();
      const state = get();

      for (const [droneId, lastTs] of Object.entries(lastTelemetry)) {
        if (now - lastTs > STALE_THRESHOLD_MS) {
          // Check if we already have a connection_lost alert for this drone
          const hasAlert = state.alerts.some(
            (a) =>
              a.droneId === droneId &&
              a.type === 'connection_lost' &&
              !a.acknowledged
          );
          if (!hasAlert) {
            get().addAlert({
              droneId,
              type: 'connection_lost',
              severity: 'critical',
              title: 'Connection Lost',
              message: `Drone ${droneId} has not sent telemetry for ${STALE_THRESHOLD_MS / 1000}s`,
            });
          }
        }
      }
    }, 10000);

    // Listen for telemetry events
    const handleTelemetry = (data: { droneId: string; battery: number; armed: boolean; flightMode: string }) => {
      const { droneId, battery, armed, flightMode } = data;
      const now = Date.now();

      // Update last telemetry timestamp
      lastTelemetry[droneId] = now;

      // Check for connection restored (was lost, now received data)
      const state = get();
      const hasLostAlert = state.alerts.some(
        (a) => a.droneId === droneId && a.type === 'connection_lost' && !a.acknowledged
      );
      if (hasLostAlert) {
        get().addAlert({
          droneId,
          type: 'connection_restored',
          severity: 'info',
          title: 'Connection Restored',
          message: `Drone ${droneId} is now sending telemetry again`,
        });
      }

      // Check battery levels
      if (battery !== null && battery !== undefined) {
        const prevBattery = previousBattery[droneId];

        if (battery <= BATTERY_CRITICAL_THRESHOLD) {
          get().addAlert({
            droneId,
            type: 'battery_critical',
            severity: 'critical',
            title: 'Battery Critical',
            message: `Drone ${droneId} battery at ${battery}% — land immediately!`,
          });
        } else if (battery <= BATTERY_WARNING_THRESHOLD && (!prevBattery || prevBattery > BATTERY_WARNING_THRESHOLD)) {
          get().addAlert({
            droneId,
            type: 'battery_low',
            severity: 'warning',
            title: 'Battery Low',
            message: `Drone ${droneId} battery at ${battery}% — consider returning`,
          });
        }

        previousBattery[droneId] = battery;
      }

      // Check armed status changes
      if (armed !== null && armed !== undefined) {
        const prevArmed = previousArmed[droneId];
        if (prevArmed === true && armed === false) {
          get().addAlert({
            droneId,
            type: 'disarmed',
            severity: 'warning',
            title: 'Disarmed',
            message: `Drone ${droneId} has been disarmed`,
          });
        }
        previousArmed[droneId] = armed;
      }

      // Check flight mode changes
      if (flightMode) {
        const prevMode = previousMode[droneId];
        if (prevMode && prevMode !== flightMode) {
          get().addAlert({
            droneId,
            type: 'mode_changed',
            severity: 'info',
            title: 'Flight Mode Changed',
            message: `Drone ${droneId} changed to ${flightMode}`,
          });
        }
        previousMode[droneId] = flightMode;
      }
    };

    socket.on('telemetry', handleTelemetry);

    // Return cleanup function
    return () => {
      clearInterval(staleCheckInterval);
      socket.off('telemetry', handleTelemetry);
    };
  },
}));
