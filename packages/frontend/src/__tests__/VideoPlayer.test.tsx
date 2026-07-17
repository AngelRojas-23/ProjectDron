/**
 * Tests for VideoPlayer component
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { VideoPlayer } from '../components/VideoPlayer';

// Mock hls.js
const mockHlsInstance = {
  loadSource: vi.fn(),
  attachMedia: vi.fn(),
  on: vi.fn(),
  destroy: vi.fn(),
  startLoad: vi.fn(),
  recoverMediaError: vi.fn(),
};

vi.mock('hls.js', () => {
  const HlsMock: any = vi.fn(() => mockHlsInstance);
  HlsMock.isSupported = vi.fn().mockReturnValue(true);
  HlsMock.Events = {
    MANIFEST_PARSED: 'hlsManifestParsed',
    ERROR: 'hlsError',
  };
  HlsMock.ErrorTypes = {
    NETWORK_ERROR: 'networkError',
    MEDIA_ERROR: 'mediaError',
  };
  return { default: HlsMock };
});

// Mock TelemetryOverlay (it depends on socket and theme)
vi.mock('../components/TelemetryOverlay', () => ({
  TelemetryOverlay: () => null,
}));

// Mock stream store with controllable state
const mockStreamStatuses: Record<string, string> = {};
vi.mock('../store/stream', () => ({
  useStreamStore: (selector: any) => {
    const state = { streamStatuses: mockStreamStatuses };
    return selector ? selector(state) : state;
  },
}));

describe('VideoPlayer', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    // Reset mock state
    Object.keys(mockStreamStatuses).forEach(k => delete mockStreamStatuses[k]);
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it('should render video element', () => {
    const { container } = render(<VideoPlayer droneId="drone-1" />);
    const video = container.querySelector('video');
    expect(video).toBeInTheDocument();
  });

  it('should show offline placeholder when status is offline', () => {
    mockStreamStatuses['drone-1'] = 'offline';

    render(<VideoPlayer droneId="drone-1" />);
    expect(screen.getByText('Stream Offline')).toBeInTheDocument();
  });
});