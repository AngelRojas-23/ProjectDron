/**
 * Connection Status Badge Component
 * Displays MAVLink connection status with color-coded indicator
 */
import { useMavlinkStore, type MavlinkStatus } from '../store/mavlink';
import { useEffect } from 'react';
import { useSocket } from '../hooks/useSocket';

/**
 * Status configuration for different states
 */
const STATUS_CONFIG: Record<MavlinkStatus, { color: string; bgColor: string; label: string }> = {
  connected: {
    color: '#ffffff',
    bgColor: '#16a34a', // green-600
    label: 'MAVLink',
  },
  reconnecting: {
    color: '#ffffff',
    bgColor: '#f59e0b', // amber-500
    label: 'Reconnecting',
  },
  disconnected: {
    color: '#ffffff',
    bgColor: '#dc2626', // red-600
    label: 'Simulated',
  },
};

/**
 * Connection Status Badge component
 * Shows connection state with colored badge
 */
export function ConnectionStatusBadge() {
  const { status, message, setStatus } = useMavlinkStore();
  const config = STATUS_CONFIG[status];

  // Subscribe to mavlink:status events from server
  const socket = useSocket();

  useEffect(() => {
    if (!socket) return;

    // Listen for MAVLink status updates
    socket.on('mavlink:status', (newStatus: MavlinkStatus, msg?: string) => {
      setStatus(newStatus, msg);
    });

    // Cleanup listener on unmount
    return () => {
      socket.off('mavlink:status');
    };
  }, [socket, setStatus]);

  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '0.5rem',
        padding: '0.375rem 0.75rem',
        borderRadius: '9999px',
        backgroundColor: config.bgColor,
        color: config.color,
        fontSize: '0.75rem',
        fontWeight: '600',
        textTransform: 'uppercase',
        letterSpacing: '0.05em',
      }}
    >
      {/* Status indicator dot */}
      <span
        style={{
          width: '0.5rem',
          height: '0.5rem',
          borderRadius: '50%',
          backgroundColor: 'currentColor',
          animation: status === 'reconnecting' ? 'pulse 1.5s infinite' : 'none',
        }}
      />
      {/* Status label */}
      <span>{config.label}</span>
      {/* Optional message */}
      {message && (
        <span style={{ fontWeight: '400', opacity: 0.9, marginLeft: '0.25rem' }}>
          - {message}
        </span>
      )}
    </div>
  );
}