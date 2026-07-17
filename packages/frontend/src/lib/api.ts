/**
 * API client for backend REST endpoints
 * Uses cookie-based auth with automatic token refresh
 */

import { useAuthStore } from '../store/auth';

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
 * Attempt to refresh the access token
 * Returns true if refresh successful
 */
async function tryRefreshToken(): Promise<boolean> {
  try {
    const response = await fetch(`${API_URL}/auth/refresh`, {
      method: 'POST',
      credentials: 'include',
    });

    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Handle authentication failure - logout and redirect
 */
function handleAuthFailure(): void {
  const logout = useAuthStore.getState().logout;
  logout();
  window.location.href = '/';
}

/**
 * Make an authenticated request with auto-refresh
 */
async function authenticatedFetch(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  const response = await fetch(url, {
    ...options,
    credentials: 'include',
    headers: {
      ...options.headers,
    },
  });

  // If unauthorized, try to refresh the token
  if (response.status === 401) {
    const refreshed = await tryRefreshToken();

    if (refreshed) {
      // Retry the original request
      return fetch(url, {
        ...options,
        credentials: 'include',
        headers: {
          ...options.headers,
        },
      });
    } else {
      // Refresh failed - logout and redirect
      handleAuthFailure();
      throw new Error('Authentication failed');
    }
  }

  return response;
}

/**
 * API client with auto-refresh functionality
 */
export const api = {
  /**
   * GET request
   */
  async get<T>(url: string): Promise<T> {
    const response = await authenticatedFetch(`${API_URL}${url}`);

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Request failed' }));
      throw new Error(error.message || `Failed to fetch: ${response.statusText}`);
    }

    return response.json();
  },

  /**
   * POST request
   */
  async post<T>(url: string, body?: unknown): Promise<T> {
    const response = await authenticatedFetch(`${API_URL}${url}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Request failed' }));
      throw new Error(error.message || `Failed to post: ${response.statusText}`);
    }

    return response.json();
  },

  /**
   * PUT request
   */
  async put<T>(url: string, body?: unknown): Promise<T> {
    const response = await authenticatedFetch(`${API_URL}${url}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Request failed' }));
      throw new Error(error.message || `Failed to put: ${response.statusText}`);
    }

    return response.json();
  },

  /**
   * DELETE request
   */
  async delete<T>(url: string): Promise<T> {
    const response = await authenticatedFetch(`${API_URL}${url}`, {
      method: 'DELETE',
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: 'Request failed' }));
      throw new Error(error.message || `Failed to delete: ${response.statusText}`);
    }

    return response.json();
  },
};

/**
 * Fetch all flights
 */
export async function fetchFlights(): Promise<FlightListItem[]> {
  return api.get<FlightListItem[]>('/flights');
}

/**
 * Fetch flight details
 */
export async function fetchFlightDetails(flightId: string): Promise<FlightDetails> {
  return api.get<FlightDetails>(`/flights/${flightId}`);
}

/**
 * Fetch flight telemetry (paginated)
 */
export async function fetchFlightTelemetry(
  flightId: string,
  page = 1,
  limit = 100
): Promise<TelemetryResponse> {
  return api.get<TelemetryResponse>(
    `/flights/${flightId}/telemetry?page=${page}&limit=${limit}`
  );
}