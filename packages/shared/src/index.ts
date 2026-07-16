/**
 * Shared type definitions for Streaming-Dron
 * Used by backend, streaming, and frontend packages
 */

/**
 * User role in the system
 * - operator: can control drones
 * - viewer: can only view telemetry
 */
export type UserRole = 'operator' | 'viewer';

/**
 * User entity representing an authenticated user
 */
export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Client entity representing a drone operator company
 */
export interface Client {
  id: string;
  name: string;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Drone entity representing a physical drone
 */
export interface Drone {
  id: string;
  name: string;
  clientId: string;
  status: 'idle' | 'flying' | 'maintenance';
  // PostGIS-aware decimal fields for geographic coordinates
  lat: number;
  lon: number;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Flight entity representing a drone flight session
 */
export interface Flight {
  id: string;
  droneId: string;
  startTime: Date;
  endTime: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Telemetry data from a drone
 */
export interface Telemetry {
  id: string;
  flightId: string;
  droneId: string;
  // Geographic coordinates
  lat: number;
  lon: number;
  // Altitude in meters
  alt: number;
  // Battery percentage (0-100)
  battery: number;
  // Timestamp of the telemetry reading
  ts: Date;
  createdAt: Date;
}

/**
 * Authentication response containing tokens and user data
 */
export interface AuthResponse {
  user: Omit<User, 'createdAt' | 'updatedAt'>;
  accessToken: string;
  refreshToken: string;
}

/**
 * Login credentials payload
 */
export interface LoginCredentials {
  email: string;
  password: string;
}

/**
 * Registration payload
 */
export interface RegisterPayload {
  email: string;
  password: string;
  name: string;
  role?: UserRole;
}

/**
 * JWT payload structure
 */
export interface JwtPayload {
  userId: string;
  role: UserRole;
  iat?: number;
  exp?: number;
}