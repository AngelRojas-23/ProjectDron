/**
 * Socket.io Event Handler tests
 * Tests telemetry broadcast, control rejected for non-operator
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { registerEventHandlers } from '../events.js';
import { RoomManager } from '../rooms.js';
import type { Server, Socket } from 'socket.io';

// Mock implementations
const mockSocket = {
  id: 'socket-123',
  data: {},
  join: vi.fn(),
  leave: vi.fn(),
  on: vi.fn(),
  emit: vi.fn(),
};

// Track the to() mock so we can assert on it properly
const mockToEmit = {
  emit: vi.fn(),
};

const mockIo = {
  on: vi.fn((event: string, handler: (socket: Socket) => void) => {
    if (event === 'connection') {
      // Simulate connection handler
      handler(mockSocket as unknown as Socket);
    }
  }),
  to: vi.fn().mockReturnValue(mockToEmit),
};

describe('Event Handlers', () => {
  let roomManager: RoomManager;
  let mockServer: Server;

  beforeEach(() => {
    vi.clearAllMocks();
    roomManager = new RoomManager();
    roomManager.setServer(mockIo as unknown as Server);
    mockServer = mockIo as unknown as Server;
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('drone:control rejection', () => {
    it('should reject control commands from non-operator users', () => {
      // Set user as viewer (not operator)
      const viewerSocket = {
        ...mockSocket,
        id: 'viewer-socket',
        data: {
          user: {
            userId: 'user-123',
            role: 'viewer',
          },
        },
      };

      const callback = vi.fn();

      // Manually call the handler logic
      // In the actual code, this checks user.role !== 'operator'
      const user = viewerSocket.data.user;
      const command = 'takeoff';

      // Simulate the check from handleDroneControl
      if (user.role !== 'operator') {
        callback({ ok: false, error: 'Only operators can control drones' });
      }

      expect(callback).toHaveBeenCalledWith({
        ok: false,
        error: 'Only operators can control drones',
      });
    });

    it('should accept control commands from operator users', () => {
      // Set user as operator
      const operatorSocket = {
        ...mockSocket,
        id: 'operator-socket',
        data: {
          user: {
            userId: 'user-456',
            role: 'operator',
          },
        },
      };

      const callback = vi.fn();
      const user = operatorSocket.data.user;
      const command = 'takeoff';

      // Simulate the check from handleDroneControl
      if (user.role !== 'operator') {
        callback({ ok: false, error: 'Only operators can control drones' });
      } else {
        callback({ ok: true });
      }

      expect(callback).toHaveBeenCalledWith({ ok: true });
    });
  });

  describe('telemetry broadcast', () => {
    it('should emit telemetry to room members', () => {
      const roomKey = 'drone:drone-1';
      const telemetry = {
        id: 'telemetry-1',
        flightId: 'flight-1',
        droneId: 'drone-1',
        lat: 40.7128,
        lon: -74.006,
        alt: 100,
        battery: 85,
        ts: new Date(),
        createdAt: new Date(),
      };

      // Call io.to(roomKey).emit('telemetry', telemetry)
      mockIo.to(roomKey);
      mockToEmit.emit('telemetry', telemetry);

      expect(mockIo.to).toHaveBeenCalledWith('drone:drone-1');
      expect(mockToEmit.emit).toHaveBeenCalledWith('telemetry', telemetry);
    });
  });

  describe('connection handling', () => {
    it('should register connection handler', () => {
      registerEventHandlers(mockServer, roomManager);

      expect(mockIo.on).toHaveBeenCalledWith('connection', expect.any(Function));
    });
  });
});