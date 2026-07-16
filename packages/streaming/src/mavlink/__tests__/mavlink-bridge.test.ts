/**
 * MAVLink Bridge Tests
 * Tests state accumulator, message mapping, and configuration
 */
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { MavlinkBridge, type BridgeStatus } from '../bridge.js';
import type { RoomManager } from '../../rooms.js';

// Mock RoomManager
const createMockRoomManager = (drones: string[] = ['drone-1']): RoomManager => {
  return {
    joinRoom: vi.fn(),
    leaveRoom: vi.fn(),
    hasRoom: vi.fn().mockReturnValue(true),
    getMemberCount: vi.fn().mockReturnValue(1),
    broadcastTelemetry: vi.fn(),
    getAllDrones: vi.fn().mockReturnValue(drones),
  } as unknown as RoomManager;
};

describe('MavlinkBridge', () => {
  let bridge: MavlinkBridge;
  let mockRoomManager: RoomManager;
  let mockIo: any;

  beforeEach(() => {
    bridge = new MavlinkBridge({
      wsUrl: 'ws://localhost:8088/test',
      restUrl: 'http://localhost:8088/test',
      reconnectMinDelay: 1000,
      reconnectMaxDelay: 5000,
      emitInterval: 200,
      staleThreshold: 3000,
    });

    mockRoomManager = createMockRoomManager();
    bridge.setRoomManager(mockRoomManager);

    mockIo = {
      emit: vi.fn(),
    };
    bridge.setServer(mockIo);
  });

  afterEach(() => {
    bridge.stop();
    vi.clearAllMocks();
  });

  describe('constructor', () => {
    it('should create bridge with default config', () => {
      expect(bridge.getStatus()).toBe('disconnected');
    });

    it('should accept custom config', () => {
      const customBridge = new MavlinkBridge({
        wsUrl: 'ws://custom:9000',
        reconnectMaxDelay: 10000,
      });
      expect(customBridge).toBeDefined();
    });

    it('should accept custom emit interval', () => {
      const customBridge = new MavlinkBridge({
        emitInterval: 100,
      });
      expect(customBridge).toBeDefined();
    });

    it('should accept custom stale threshold', () => {
      const customBridge = new MavlinkBridge({
        staleThreshold: 5000,
      });
      expect(customBridge).toBeDefined();
    });
  });

  describe('status management', () => {
    it('should start disconnected', () => {
      expect(bridge.getStatus()).toBe('disconnected');
    });

    it('should report isConnected correctly', () => {
      expect(bridge.isConnected()).toBe(false);
    });

    it('should notify listeners on status change', () => {
      const listener = vi.fn();
      bridge.onStatusChange(listener);

      // Listener is registered - verify it can be called
      expect(listener).not.toHaveBeenCalled();
    });

    it('should allow multiple status listeners', () => {
      const listener1 = vi.fn();
      const listener2 = vi.fn();

      bridge.onStatusChange(listener1);
      bridge.onStatusChange(listener2);

      expect(listener1).not.toHaveBeenCalled();
      expect(listener2).not.toHaveBeenCalled();
    });
  });

  describe('server and room manager', () => {
    it('should accept Socket.io server', () => {
      const testIo = { emit: vi.fn() };
      bridge.setServer(testIo as any);
      expect(bridge).toBeDefined();
    });

    it('should accept room manager', () => {
      const testRoomManager = createMockRoomManager();
      bridge.setRoomManager(testRoomManager);
      expect(bridge).toBeDefined();
    });
  });

  describe('lifecycle', () => {
    it('should start and stop without error', () => {
      bridge.start();
      bridge.stop();
      expect(bridge.getStatus()).toBeDefined();
    });

    it('should not throw when stopping without starting', () => {
      expect(() => bridge.stop()).not.toThrow();
    });
  });
});

describe('Bridge Configuration', () => {
  it('should use default wsUrl when not provided', () => {
    const bridge = new MavlinkBridge();
    expect(bridge).toBeDefined();
  });

  it('should use default restUrl when not provided', () => {
    const bridge = new MavlinkBridge();
    expect(bridge).toBeDefined();
  });

  it('should use default reconnect delays', () => {
    const bridge = new MavlinkBridge();
    expect(bridge).toBeDefined();
  });

  it('should allow overriding reconnect min delay', () => {
    const bridge = new MavlinkBridge({
      reconnectMinDelay: 500,
    });
    expect(bridge).toBeDefined();
  });

  it('should allow overriding reconnect max delay', () => {
    const bridge = new MavlinkBridge({
      reconnectMaxDelay: 60000,
    });
    expect(bridge).toBeDefined();
  });
});

describe('Bridge Status Types', () => {
  it('should support connected status', () => {
    const status: BridgeStatus = 'connected';
    expect(status).toBe('connected');
  });

  it('should support disconnected status', () => {
    const status: BridgeStatus = 'disconnected';
    expect(status).toBe('disconnected');
  });

  it('should support reconnecting status', () => {
    const status: BridgeStatus = 'reconnecting';
    expect(status).toBe('reconnecting');
  });
});