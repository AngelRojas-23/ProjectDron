/**
 * Flight history store
 * Manages flight list and selected flight state
 */
import { create } from 'zustand';
import type { FlightListItem, FlightDetails, TelemetryPoint } from '../lib/api';

interface FlightState {
  flights: FlightListItem[];
  selectedFlightId: string | null;
  selectedFlightDetails: FlightDetails | null;
  isLoading: boolean;
  error: string | null;
  // Actions
  fetchFlights: () => Promise<void>;
  selectFlight: (flightId: string | null) => Promise<void>;
  clearSelectedFlight: () => void;
}

/**
 * Format duration between two dates
 */
function formatDuration(startTime: Date | string, endTime: Date | string | null): string {
  const start = new Date(startTime).getTime();
  const end = endTime ? new Date(endTime).getTime() : Date.now();
  const diffMs = end - start;

  const hours = Math.floor(diffMs / (1000 * 60 * 60));
  const minutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((diffMs % (1000 * 60)) / 1000);

  if (hours > 0) {
    return `${hours}h ${minutes}m ${seconds}s`;
  }
  if (minutes > 0) {
    return `${minutes}m ${seconds}s`;
  }
  return `${seconds}s`;
}

/**
 * Calculate key statistics from telemetry
 */
function calculateStats(telemetry: TelemetryPoint[]): {
  maxAltitude: number;
  maxSpeed: number;
  avgBattery: number;
  totalDistance: number;
} {
  if (telemetry.length === 0) {
    return {
      maxAltitude: 0,
      maxSpeed: 0,
      avgBattery: 0,
      totalDistance: 0,
    };
  }

  let maxAltitude = 0;
  let maxSpeed = 0;
  let totalBattery = 0;
  let totalDistance = 0;

  for (let i = 0; i < telemetry.length; i++) {
    const t = telemetry[i];

    // Max altitude
    if (t.alt > maxAltitude) {
      maxAltitude = t.alt;
    }

    // Max speed
    if (t.groundspeed && t.groundspeed > maxSpeed) {
      maxSpeed = t.groundspeed;
    }

    // Average battery
    totalBattery += t.battery;

    // Distance (Haversine formula)
    if (i > 0) {
      const prev = telemetry[i - 1];
      const dist = calculateHaversineDistance(prev.lat, prev.lon, t.lat, t.lon);
      totalDistance += dist;
    }
  }

  return {
    maxAltitude,
    maxSpeed,
    avgBattery: Math.round(totalBattery / telemetry.length),
    totalDistance: Math.round(totalDistance),
  };
}

/**
 * Calculate distance between two GPS coordinates using Haversine formula
 */
function calculateHaversineDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371000; // Earth radius in meters
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRad(deg: number): number {
  return deg * (Math.PI / 180);
}

export const useFlightStore = create<FlightState>((set) => ({
  flights: [],
  selectedFlightId: null,
  selectedFlightDetails: null,
  isLoading: false,
  error: null,

  /**
   * Fetch all flights from the API
   */
  fetchFlights: async () => {
    set({ isLoading: true, error: null });

    try {
      const api = await import('../lib/api');
      const flightList = await api.fetchFlights();

      set({ flights: flightList, isLoading: false });
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : 'Failed to fetch flights',
        isLoading: false,
      });
    }
  },

  /**
   * Select a flight and fetch its details
   */
  selectFlight: async (flightId: string | null) => {
    if (!flightId) {
      set({ selectedFlightId: null, selectedFlightDetails: null });
      return;
    }

    set({ isLoading: true, error: null, selectedFlightId: flightId });

    try {
      const api = await import('../lib/api');
      const details = await api.fetchFlightDetails(flightId);

      set({ selectedFlightDetails: details, isLoading: false });
    } catch (err) {
      set({
        error: err instanceof Error ? err.message : 'Failed to fetch flight details',
        isLoading: false,
      });
    }
  },

  /**
   * Clear selected flight
   */
  clearSelectedFlight: () => {
    set({ selectedFlightId: null, selectedFlightDetails: null });
  },
}));

// Export utility functions
export { formatDuration, calculateStats, calculateHaversineDistance };