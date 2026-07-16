/**
 * Tests for stream store - manages video stream status per drone
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { useStreamStore } from '../store/stream';

describe('useStreamStore', () => {
  beforeEach(() => {
    // Reset store before each test
    useStreamStore.getState().reset();
  });

  it('should have initial state with empty stream statuses', () => {
    const state = useStreamStore.getState();
    expect(state.streamStatuses).toEqual({});
    expect(state.lastUpdate).toEqual({});
  });

  it('should set stream status for a drone', () => {
    const { setStatus } = useStreamStore.getState();

    setStatus('drone-1', 'online');

    const state = useStreamStore.getState();
    expect(state.streamStatuses['drone-1']).toBe('online');
    expect(state.lastUpdate['drone-1']).toBeInstanceOf(Date);
  });

  it('should update status for multiple drones', () => {
    const { setStatus } = useStreamStore.getState();

    setStatus('drone-1', 'online');
    setStatus('drone-2', 'error');

    const state = useStreamStore.getState();
    expect(state.streamStatuses['drone-1']).toBe('online');
    expect(state.streamStatuses['drone-2']).toBe('error');
  });

  it('should overwrite status for same drone', () => {
    const { setStatus } = useStreamStore.getState();

    setStatus('drone-1', 'online');
    setStatus('drone-1', 'offline');

    const state = useStreamStore.getState();
    expect(state.streamStatuses['drone-1']).toBe('offline');
  });

  it('should reset all stream statuses', () => {
    const { setStatus, reset } = useStreamStore.getState();

    setStatus('drone-1', 'online');
    setStatus('drone-2', 'error');
    reset();

    const state = useStreamStore.getState();
    expect(state.streamStatuses).toEqual({});
    expect(state.lastUpdate).toEqual({});
  });

  it('should handle all stream status types', () => {
    const { setStatus } = useStreamStore.getState();

    setStatus('drone-1', 'online');
    expect(useStreamStore.getState().streamStatuses['drone-1']).toBe('online');

    setStatus('drone-1', 'offline');
    expect(useStreamStore.getState().streamStatuses['drone-1']).toBe('offline');

    setStatus('drone-1', 'error');
    expect(useStreamStore.getState().streamStatuses['drone-1']).toBe('error');
  });
});