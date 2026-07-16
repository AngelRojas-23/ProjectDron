/**
 * Tests for VideoPlayer component
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { VideoPlayer } from '../components/VideoPlayer';

// Mock hls.js
vi.mock('hls.js', () => ({
  default: vi.fn().mockImplementation(() => ({
    loadSource: vi.fn(),
    attachMedia: vi.fn(),
    on: vi.fn(),
    destroy: vi.fn(),
    startLoad: vi.fn(),
    recoverMediaError: vi.fn(),
  })),
  isSupported: vi.fn().mockReturnValue(true),
  Events: {
    MANIFEST_PARSED: 'hlsManifestParsed',
    ERROR: 'hlsError',
  },
  ErrorTypes: {
    NETWORK_ERROR: 'networkError',
    MEDIA_ERROR: 'mediaError',
  },
}));

// Mock useStreamStore
vi.mock('../store/stream', () => ({
  useStreamStore: vi.fn(() => ({
    streamStatuses: {},
  })),
}));

describe('VideoPlayer', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it('should render video element', () => {
    render(<VideoPlayer droneId="drone-1" />);
    const video = screen.getByRole('video');
    expect(video).toBeInTheDocument();
  });

  it('should show offline placeholder when status is offline', () => {
    vi.mock('../store/stream', () => ({
      useStreamStore: vi.fn(() => ({
        streamStatuses: { 'drone-1': 'offline' },
      })),
    }));

    render(<VideoPlayer droneId="drone-1" />);
    expect(screen.getByText('Stream Offline')).toBeInTheDocument();
  });

  it('should show offline placeholder after 3 manifest failures', async () => {
    // Mock fetch to fail
    global.fetch = vi.fn().mockRejectedValue(new Error('Network error'));

    render(<VideoPlayer droneId="drone-1" />);

    // Advance timers to trigger 3 polling failures
    for (let i = 0; i < 3; i++) {
      vi.advanceTimersByTime(5000);
    }

    expect(screen.getByText('Stream Offline')).toBeInTheDocument();
  });
});