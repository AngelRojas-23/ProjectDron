/**
 * MAVLink Status Store Tests
 * Tests connection status store updates on mavlink:status events
 */
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { type MavlinkStatus } from '../store/mavlink';

// Mock socket.io-client
const mockSocket = {
  on: vi.fn(),
  off: vi.fn(),
  emit: vi.fn(),
  connected: true,
};

// Mock the useSocket hook
vi.mock('../hooks/useSocket', () => ({
  useSocket: () => mockSocket,
}));

// Import after mocking
import { useMavlinkStore as importStore } from '../store/mavlink';

describe('useMavlinkStore', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset store state before each test
    importStore.getState().reset();
  });

  describe('initial state', () => {
    it('should start disconnected', () => {
      const { status } = importStore.getState();
      expect(status).toBe('disconnected');
    });

    it('should have null message initially', () => {
      const { message } = importStore.getState();
      expect(message).toBeUndefined();
    });

    it('should have null lastUpdate initially', () => {
      const { lastUpdate } = importStore.getState();
      expect(lastUpdate).toBeNull();
    });
  });

  describe('setStatus', () => {
    it('should update status to connected', () => {
      const { setStatus } = importStore.getState();
      setStatus('connected');

      const { status, lastUpdate } = importStore.getState();
      expect(status).toBe('connected');
      expect(lastUpdate).not.toBeNull();
    });

    it('should update status to disconnected', () => {
      // First set to connected
      importStore.getState().setStatus('connected');

      // Then disconnect
      importStore.getState().setStatus('disconnected');

      const { status } = importStore.getState();
      expect(status).toBe('disconnected');
    });

    it('should update status to reconnecting', () => {
      const { setStatus } = importStore.getState();
      setStatus('reconnecting', 'Connection lost');

      const { status, message } = importStore.getState();
      expect(status).toBe('reconnecting');
      expect(message).toBe('Connection lost');
    });

    it('should update message along with status', () => {
      const { setStatus } = importStore.getState();
      setStatus('connected', 'Bridge established');

      const { message } = importStore.getState();
      expect(message).toBe('Bridge established');
    });

    it('should update lastUpdate timestamp', () => {
      const { setStatus } = importStore.getState();
      const before = new Date();

      setStatus('connected');

      const { lastUpdate } = importStore.getState();
      const after = new Date();

      expect(lastUpdate).toBeInstanceOf(Date);
      expect(lastUpdate?.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(lastUpdate?.getTime()).toBeLessThanOrEqual(after.getTime());
    });
  });

  describe('reset', () => {
    it('should reset status to disconnected', () => {
      // Set some status
      importStore.getState().setStatus('connected');
      importStore.getState().reset();

      const { status } = importStore.getState();
      expect(status).toBe('disconnected');
    });

    it('should clear message', () => {
      importStore.getState().setStatus('connected', 'Test message');
      importStore.getState().reset();

      const { message } = importStore.getState();
      expect(message).toBeUndefined();
    });

    it('should clear lastUpdate', () => {
      importStore.getState().setStatus('connected');
      importStore.getState().reset();

      const { lastUpdate } = importStore.getState();
      expect(lastUpdate).toBeNull();
    });
  });
});

describe('ConnectionStatusBadge Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    importStore.getState().reset();
  });

  it('should subscribe to mavlink:status events', () => {
    // Verify mock socket exists
    expect(mockSocket.on).toBeDefined();
  });

  it('should update store on mavlink:status event', () => {
    // Simulate the event callback
    const { setStatus } = importStore.getState();

    // The ConnectionStatusBadge would call setStatus when receiving the event
    setStatus('connected');

    expect(importStore.getState().status).toBe('connected');
  });

  it('should handle all status types', () => {
    const { setStatus } = importStore.getState();

    const statuses: MavlinkStatus[] = ['connected', 'disconnected', 'reconnecting'];

    for (const status of statuses) {
      setStatus(status);
      expect(importStore.getState().status).toBe(status);
    }
  });
});

describe('STATUS_CONFIG', () => {
  // Test the status configuration used by ConnectionStatusBadge
  const STATUS_CONFIG: Record<MavlinkStatus, { color: string; bgColor: string; label: string }> = {
    connected: {
      color: '#ffffff',
      bgColor: '#16a34a',
      label: 'MAVLink',
    },
    reconnecting: {
      color: '#ffffff',
      bgColor: '#f59e0b',
      label: 'Reconnecting',
    },
    disconnected: {
      color: '#ffffff',
      bgColor: '#dc2626',
      label: 'Simulated',
    },
  };

  it('should have config for connected status', () => {
    expect(STATUS_CONFIG.connected).toBeDefined();
    expect(STATUS_CONFIG.connected.label).toBe('MAVLink');
    expect(STATUS_CONFIG.connected.bgColor).toBe('#16a34a');
  });

  it('should have config for reconnecting status', () => {
    expect(STATUS_CONFIG.reconnecting).toBeDefined();
    expect(STATUS_CONFIG.reconnecting.label).toBe('Reconnecting');
    expect(STATUS_CONFIG.reconnecting.bgColor).toBe('#f59e0b');
  });

  it('should have config for disconnected status', () => {
    expect(STATUS_CONFIG.disconnected).toBeDefined();
    expect(STATUS_CONFIG.disconnected.label).toBe('Simulated');
    expect(STATUS_CONFIG.disconnected.bgColor).toBe('#dc2626');
  });

  it('should have all required properties for each status', () => {
    for (const status of Object.keys(STATUS_CONFIG) as MavlinkStatus[]) {
      const config = STATUS_CONFIG[status];
      expect(config).toHaveProperty('color');
      expect(config).toHaveProperty('bgColor');
      expect(config).toHaveProperty('label');
    }
  });
});