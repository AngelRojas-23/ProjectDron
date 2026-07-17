/**
 * API client for backend REST endpoints
 */

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000';

/**
 * Flight list item
 */
export interface FlightListItem {
  id: string;
  droneId: string;
  droneName: string;
  startTime: string;
  endTime: string | null;
  status: 'active' | 'completed';
}

/**
 * Flight telemetry point
 */
export interface TelemetryPoint {
  id: string;
  lat: number;
  lon: number;
  alt: number;
  battery: number;
  heading: number | null;
  groundspeed: number | null;
  airspeed: number | null;
  voltage: number | null;
  current: number | null;
  flightMode: string | null;
  armed: boolean | null;
  ts: string;
}

/**
 * Flight details with telemetry
 */
export interface FlightDetails {
  id: string;
  droneId: string;
  startTime: string;
  endTime: string | null;
  telemetry: TelemetryPoint[];
}

/**
 * Paginated telemetry response
 */
export interface TelemetryResponse {
  data: TelemetryPoint[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

/**
 * Fetch all flights
 */
export async function fetchFlights(): Promise<FlightListItem[]> {
  const response = await fetch(`${API_URL}/flights`, {
    credentials: 'include',
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch flights: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Fetch flight details
 */
export async function fetchFlightDetails(flightId: string): Promise<FlightDetails> {
  const response = await fetch(`${API_URL}/flights/${flightId}`, {
    credentials: 'include',
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch flight details: ${response.statusText}`);
  }

  return response.json();
}

/**
 * Fetch flight telemetry (paginated)
 */
export async function fetchFlightTelemetry(
  flightId: string,
  page = 1,
  limit = 100
): Promise<TelemetryResponse> {
  const response = await fetch(
    `${API_URL}/flights/${flightId}/telemetry?page=${page}&limit=${limit}`,
    {
      credentials: 'include',
    }
  );

  if (!response.ok) {
    throw new Error(`Failed to fetch telemetry: ${response.statusText}`);
  }

  return response.json();
}