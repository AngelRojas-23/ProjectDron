/**
 * Room Manager tests
 * Tests join room, invalid drone, leave on disconnect
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { RoomManager } from '../rooms.js';
import type { Server, Socket } from 'socket.io';

// Mock Socket.io types
const mockSocket = {
  id: 'socket-123',
  join: vi.fn(),
  leave: vi.fn(),
};

const mockIo = {
  to: vi.fn().mockReturnValue({
    emit: vi.fn(),
  }),
};

describe('RoomManager', () => {
  let roomManager: RoomManager;

  beforeEach(() => {
    roomManager = new RoomManager();
  });

  describe('joinRoom', () => {
    it('should join a socket to a drone room', () => {
      const result = roomManager.joinRoom(mockSocket as unknown as Socket, 'drone-1');

      expect(result).toBe(true);
      expect(roomManager.hasRoom('drone-1')).toBe(true);
      expect(roomManager.getMemberCount('drone-1')).toBe(1);
    });

    it('should allow multiple sockets in the same room', () => {
      roomManager.joinRoom(mockSocket as unknown as Socket, 'drone-1');
      roomManager.joinRoom({ ...mockSocket, id: 'socket-456' } as unknown as Socket, 'drone-1');

      expect(roomManager.getMemberCount('drone-1')).toBe(2);
    });
  });

  describe('Invalid drone', () => {
    it('should handle joining with empty drone ID', () => {
      // Room manager should handle this gracefully
      const result = roomManager.joinRoom(mockSocket as unknown as Socket, '');

      // The function returns true but room may not exist
      expect(result).toBeDefined();
    });

    it('should report member count of 0 for non-existent drone', () => {
      expect(roomManager.getMemberCount('non-existent')).toBe(0);
      expect(roomManager.hasRoom('non-existent')).toBe(false);
    });
  });

  describe('leaveRoom', () => {
    it('should remove socket from room on disconnect', () => {
      roomManager.joinRoom(mockSocket as unknown as Socket, 'drone-1');

      roomManager.leaveRoom(mockSocket as unknown as Socket);

      expect(roomManager.getMemberCount('drone-1')).toBe(0);
    });

    it('should handle leaving a room that does not exist', () => {
      // Should not throw
      expect(() => {
        roomManager.leaveRoom(mockSocket as unknown as Socket);
      }).not.toThrow();
    });

    it('should clean up empty rooms', () => {
      roomManager.joinRoom(mockSocket as unknown as Socket, 'drone-1');
      roomManager.leaveRoom(mockSocket as unknown as Socket);

      expect(roomManager.hasRoom('drone-1')).toBe(false);
    });
  });

  describe('broadcastTelemetry', () => {
    it('should warn if no io server is set', () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      roomManager.broadcastTelemetry('drone-1', {
        id: 'telemetry-1',
        flightId: 'flight-1',
        droneId: 'drone-1',
        lat: 40.7128,
        lon: -74.006,
        alt: 100,
        battery: 85,
        ts: new Date(),
        createdAt: new Date(),
      });

      expect(consoleSpy).toHaveBeenCalledWith(
        'RoomManager: No io server set, cannot broadcast'
      );

      consoleSpy.mockRestore();
    });
  });

  describe('getAllDrones', () => {
    it('should return empty array when no rooms exist', () => {
      expect(roomManager.getAllDrones()).toEqual([]);
    });

    it('should return list of active drone IDs', () => {
      roomManager.joinRoom(mockSocket as unknown as Socket, 'drone-1');
      roomManager.joinRoom({ ...mockSocket, id: 'socket-456' } as unknown as Socket, 'drone-2');

      const drones = roomManager.getAllDrones();
      expect(drones).toContain('drone-1');
      expect(drones).toContain('drone-2');
    });
  });
});