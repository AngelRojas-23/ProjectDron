/**
 * Room Manager for drone rooms
 * Manages socket rooms per drone and broadcasts telemetry
 */

import type { Server, Socket } from 'socket.io';
import type { Telemetry } from '@sd/shared/index.js';

/**
 * RoomManager class
 * Manages one room per droneId, handles join/leave/broadcast
 */
export class RoomManager {
  private io: Server | null = null;

  /**
   * Map of droneId -> Set of socket IDs in that room
   */
  private rooms: Map<string, Set<string>> = new Map();

  /**
   * Map of socketId -> droneId (reverse lookup for leave)
   */
  private socketToDrone: Map<string, string> = new Map();

  /**
   * Map of droneId -> interval ID (for simulated telemetry)
   */
  private telemetryIntervals: Map<string, NodeJS.Timeout> = new Map();

  /**
   * Set the Socket.io server instance (required for broadcasting)
   */
  setServer(io: Server): void {
    this.io = io;
  }

  /**
   * Join a socket to a drone room
   * @param socket - The socket joining
   * @param droneId - The drone ID to join
   * @returns true if successful
   */
  joinRoom(socket: Socket, droneId: string): boolean {
    const roomKey = `drone:${droneId}`;

    // Create room if doesn't exist
    if (!this.rooms.has(droneId)) {
      this.rooms.set(droneId, new Set());
    }

    const room = this.rooms.get(droneId)!;

    // Add socket to room
    room.add(socket.id);
    this.socketToDrone.set(socket.id, droneId);

    // Join Socket.io room
    socket.join(roomKey);

    console.log(`RoomManager: Socket ${socket.id} joined room ${roomKey} (${room.size} members)`);

    return true;
  }

  /**
   * Leave the current drone room
   * @param socket - The socket leaving
   */
  leaveRoom(socket: Socket): void {
    const droneId = this.socketToDrone.get(socket.id);
    if (!droneId) {
      return;
    }

    const roomKey = `drone:${droneId}`;
    const room = this.rooms.get(droneId);

    if (room) {
      room.delete(socket.id);
      this.socketToDrone.delete(socket.id);

      // Leave Socket.io room
      socket.leave(roomKey);

      console.log(`RoomManager: Socket ${socket.id} left room ${roomKey} (${room.size} members)`);

      // Clean up empty room
      if (room.size === 0) {
        this.rooms.delete(droneId);
        this.stopTelemetry(droneId);
      }
    }
  }

  /**
   * Broadcast telemetry to all members in a drone room
   * @param droneId - The drone ID
   * @param telemetry - The telemetry data
   */
  broadcastTelemetry(droneId: string, telemetry: Telemetry): void {
    if (!this.io) {
      console.warn('RoomManager: No io server set, cannot broadcast');
      return;
    }

    const roomKey = `drone:${droneId}`;
    this.io.to(roomKey).emit('telemetry', telemetry);
  }

  /**
   * Get list of all active drone IDs
   * @returns Array of drone IDs with active rooms
   */
  getAllDrones(): string[] {
    return Array.from(this.rooms.keys());
  }

  /**
   * Get number of members in a drone room
   * @param droneId - The drone ID
   * @returns Number of sockets in the room
   */
  getMemberCount(droneId: string): number {
    return this.rooms.get(droneId)?.size || 0;
  }

  /**
   * Check if a drone room exists
   * @param droneId - The drone ID
   * @returns true if room exists
   */
  hasRoom(droneId: string): boolean {
    return this.rooms.has(droneId);
  }

  /**
   * Stop telemetry simulation for a drone
   * @param droneId - The drone ID
   */
  private stopTelemetry(droneId: string): void {
    const interval = this.telemetryIntervals.get(droneId);
    if (interval) {
      clearInterval(interval);
      this.telemetryIntervals.delete(droneId);
    }
  }
}

export default RoomManager;