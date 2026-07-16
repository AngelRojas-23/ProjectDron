/**
 * Socket.io event contracts for Streaming-Dron
 * Defines the communication interface between server and client
 */

import type { Telemetry, Drone } from './index.js';

/**
 * Events emitted from server to connected clients
 */
export interface ServerToClient {
  /**
   * Emitted when drone telemetry is updated
   * Sent to all clients in the drone's room
   */
  telemetry: (data: Telemetry) => void;

  /**
   * Emitted when an error occurs
   */
  error: (message: string) => void;

  /**
   * Emitted when a drone joins a room successfully
   */
  'drone:joined': (drone: Drone) => void;

  /**
   * Emitted when a drone leaves a room
   */
  'drone:left': (droneId: string) => void;

  /**
   * Emitted when control command is acknowledged
   */
  'control:ack': (command: string, success: boolean, message?: string) => void;
}

/**
 * Events received from clients by the server
 */
export interface ClientToServer {
  /**
   * Join a specific drone's room to receive telemetry
   * @param droneId - The ID of the drone to join
   * @param callback - Acknowledgment callback
   */
  'drone:join': (droneId: string, callback: (success: boolean, error?: string) => void) => void;

  /**
   * Leave a drone's room
   * @param droneId - The ID of the drone to leave
   */
  'drone:leave': (droneId: string) => void;

  /**
   * Send a control command to a drone
   * Only operators can use this
   * @param command - The command to send
   */
  'drone:control': (command: 'takeoff' | 'land' | 'return') => void;

  /**
   * Request current drone state
   * @param droneId - The ID of the drone
   */
  'drone:state': (droneId: string, callback: (state: Drone | null) => void) => void;
}

/**
 * Type helper to extract event names from a contract
 */
export type ServerEventName = keyof ServerToClient;
export type ClientEventName = keyof ClientToServer;

/**
 * Server event handler type
 */
export type ServerEventHandler<E extends ServerEventName> = ServerToClient[E];

/**
 * Client event handler type
 */
export type ClientEventHandler<E extends ClientEventName> = ClientToServer[E];