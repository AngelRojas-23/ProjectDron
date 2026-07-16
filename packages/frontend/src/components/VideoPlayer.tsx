/**
 * VideoPlayer component for displaying drone video streams
 * Uses hls.js for HLS playback with Safari native fallback
 */
import { useEffect, useRef, useState } from 'react';
import Hls from 'hls.js';
import { useStreamStore } from '../store/stream';

interface VideoPlayerProps {
  droneId: string;
}

/**
 * VideoPlayer component
 * Displays HLS video stream for a specific drone
 * Auto-plays muted with offline/error placeholders
 */
export function VideoPlayer({ droneId }: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const [isSupported, setIsSupported] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [manifestFailures, setManifestFailures] = useState(0);

  const streamStatus = useStreamStore((state) => state.streamStatuses[droneId]);

  // Derive stream URL from droneId
  const streamUrl = `/hls/drone/${droneId}/index.m3u8`;

  // Initialize hls.js
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    // Check hls.js support
    if (!Hls.isSupported()) {
      // Check for native HLS support (Safari)
      if (video.canPlayType('application/vnd.apple.mpegurl')) {
        setIsSupported(true);
        return;
      }
      setIsSupported(false);
      return;
    }

    // Destroy previous instance
    if (hlsRef.current) {
      hlsRef.current.destroy();
    }

    // Create new hls.js instance
    const hls = new Hls({
      enableWorker: true,
      lowLatencyMode: true,
    });

    hlsRef.current = hls;

    // Load stream
    hls.loadSource(streamUrl);
    hls.attachMedia(video);

    // Handle events
    hls.on(Hls.Events.MANIFEST_PARSED, () => {
      setError(null);
      video.play().catch(() => {
        // Autoplay blocked - muted will still work
      });
    });

    hls.on(Hls.Events.ERROR, (_, data) => {
      if (data.fatal) {
        switch (data.type) {
          case Hls.ErrorTypes.NETWORK_ERROR:
            setError('Network error - trying to recover');
            hls.startLoad();
            break;
          case Hls.ErrorTypes.MEDIA_ERROR:
            setError('Media error - trying to recover');
            hls.recoverMediaError();
            break;
          default:
            setError('Fatal error - stream unavailable');
            hls.destroy();
            break;
        }
      }
    });

    // Cleanup
    return () => {
      hls.destroy();
      hlsRef.current = null;
    };
  }, [streamUrl]);

  // Native HLS for Safari
  useEffect(() => {
    const video = videoRef.current;
    if (!video || !Hls.isSupported()) return;

    // If browser supports native HLS, use it
    if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = streamUrl;
      video.play().catch(() => {});
    }
  }, [streamUrl]);

  // Poll manifest for status
  useEffect(() => {
    let mounted = true;

    const checkStatus = async () => {
      try {
        const response = await fetch(streamUrl, { method: 'HEAD' });
        if (response.ok) {
          if (mounted) {
            setManifestFailures(0);
          }
        } else {
          if (mounted) {
            setManifestFailures((prev) => prev + 1);
          }
        }
      } catch {
        if (mounted) {
          setManifestFailures((prev) => prev + 1);
        }
      }
    };

    // Initial check
    checkStatus();

    // Poll every 5 seconds
    const interval = setInterval(checkStatus, 5000);

    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [streamUrl]);

  // Show offline after 3 consecutive manifest failures
  const showOffline = manifestFailures >= 3 || streamStatus === 'offline';

  if (!isSupported) {
    return (
      <div style={styles.container}>
        <div style={styles.placeholder}>
          <p>HLS is not supported in this browser</p>
        </div>
      </div>
    );
  }

  if (showOffline) {
    return (
      <div style={styles.container}>
        <div style={styles.placeholder}>
          <p style={styles.offlineText}>Stream Offline</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={styles.container}>
        <div style={styles.placeholder}>
          <p style={styles.errorText}>{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <video
        ref={videoRef}
        style={styles.video}
        muted
        playsInline
        autoPlay
      />
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    width: '100%',
    aspectRatio: '16/9',
    backgroundColor: '#000',
    borderRadius: '8px',
    overflow: 'hidden',
  },
  video: {
    width: '100%',
    height: '100%',
    objectFit: 'contain',
  },
  placeholder: {
    width: '100%',
    height: '100%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1a1a1a',
    color: '#6b7280',
  },
  offlineText: {
    fontSize: '1.25rem',
    fontWeight: '500',
  },
  errorText: {
    fontSize: '0.875rem',
    color: '#f87171',
  },
};