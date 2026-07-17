/**
 * Command Buttons Component
 * Provides drone control buttons (Arm, Disarm, Takeoff, RTL, Land)
 * Only enabled when connected to MAVLink
 */
import { useState } from 'react';
import { useSocket } from '../hooks/useSocket';
import { useMavlinkStore } from '../store/mavlink';

/**
 * Command type for drone control
 */
type CommandType = 'arm' | 'disarm' | 'takeoff' | 'RTL' | 'land';

/**
 * Button configuration
 */
const BUTTON_CONFIG: Record<CommandType, { label: string; variant: 'primary' | 'danger' | 'warning' | 'default' }> = {
  arm: { label: 'Arm', variant: 'danger' },
  disarm: { label: 'Disarm', variant: 'warning' },
  takeoff: { label: 'Takeoff', variant: 'primary' },
  RTL: { label: 'RTL', variant: 'default' },
  land: { label: 'Land', variant: 'default' },
};

/**
 * Command Buttons component
 * Shows control buttons that emit drone:control events
 */
export function CommandButtons() {
  const socket = useSocket();
  const status = useMavlinkStore((state) => state.status);
  const [loadingCommand, setLoadingCommand] = useState<CommandType | null>(null);
  const [feedback, setFeedback] = useState<{ command: string; success: boolean; message: string } | null>(null);

  // Check if connected to MAVLink (not in simulation mode)
  const isConnected = status === 'connected';

  // Send command to server
  const sendCommand = async (command: CommandType) => {
    if (!socket || !isConnected) return;

    setLoadingCommand(command);
    setFeedback(null);

    // Emit command event to server
    socket.emit('drone:control', command);

    // Listen for acknowledgment
    const handleAck = (cmd: string, success: boolean, message?: string) => {
      if (cmd === command) {
        setFeedback({
          command: cmd,
          success,
          message: message || (success ? 'Success' : 'Failed'),
        });
        setLoadingCommand(null);
      }
    };

    socket.once('control:ack', handleAck);

    // Timeout after 5 seconds
    setTimeout(() => {
      if (loadingCommand === command) {
        setFeedback({
          command,
          success: false,
          message: 'Command timeout',
        });
        setLoadingCommand(null);
      }
      socket.off('control:ack', handleAck);
    }, 5000);
  };

  // Button click handlers
  const handleArm = () => sendCommand('arm');
  const handleDisarm = () => sendCommand('disarm');
  const handleTakeoff = () => sendCommand('takeoff');
  const handleRtl = () => sendCommand('RTL');
  const handleLand = () => sendCommand('land');

  // Get button style based on variant
  const getButtonStyle = (variant: string, disabled: boolean): React.CSSProperties => {
    const baseStyle: React.CSSProperties = {
      padding: '0.5rem 1rem',
      borderRadius: '6px',
      fontSize: '0.875rem',
      fontWeight: '600',
      cursor: disabled ? 'not-allowed' : 'pointer',
      border: 'none',
      transition: 'all 0.2s ease',
      opacity: disabled ? 0.5 : 1,
    };

    const variantStyles: Record<string, React.CSSProperties> = {
      primary: { backgroundColor: '#2563eb', color: 'white' },
      danger: { backgroundColor: '#dc2626', color: 'white' },
      warning: { backgroundColor: '#f59e0b', color: 'white' },
      default: { backgroundColor: '#4b5563', color: 'white' },
    };

    return { ...baseStyle, ...variantStyles[variant] };
  };

  // List of commands to display
  const commands: CommandType[] = ['arm', 'disarm', 'takeoff', 'RTL', 'land'];

  return (
    <div style={styles.container}>
      <h3 style={styles.title}>Drone Control</h3>

      {/* Connection warning */}
      {!isConnected && (
        <div style={styles.warning}>
          Connect to MAVLink to enable controls
        </div>
      )}

      {/* Command buttons */}
      <div style={styles.buttonGrid}>
        {commands.map((cmd) => {
          const config = BUTTON_CONFIG[cmd];
          const isLoading = loadingCommand === cmd;

          return (
            <button
              key={cmd}
              onClick={() => {
                switch (cmd) {
                  case 'arm':
                    handleArm();
                    break;
                  case 'disarm':
                    handleDisarm();
                    break;
                  case 'takeoff':
                    handleTakeoff();
                    break;
                  case 'RTL':
                    handleRtl();
                    break;
                  case 'land':
                    handleLand();
                    break;
                }
              }}
              disabled={!isConnected || isLoading}
              style={getButtonStyle(config.variant, !isConnected || isLoading)}
            >
              {isLoading ? '...' : config.label}
            </button>
          );
        })}
      </div>

      {/* Feedback message */}
      {feedback && (
        <div
          style={{
            ...styles.feedback,
            backgroundColor: feedback.success ? '#dcfce7' : '#fee2e2',
            color: feedback.success ? '#166534' : '#991b1b',
          }}
        >
          {feedback.message}
        </div>
      )}
    </div>
  );
}

/**
 * Inline styles for the component
 */
const styles: Record<string, React.CSSProperties> = {
  container: {
    backgroundColor: 'white',
    borderRadius: '8px',
    padding: '1rem',
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
  },
  title: {
    margin: '0 0 1rem',
    fontSize: '1rem',
    fontWeight: '600',
    color: '#1a1a1a',
  },
  warning: {
    padding: '0.5rem',
    backgroundColor: '#fef3c7',
    color: '#92400e',
    borderRadius: '4px',
    fontSize: '0.875rem',
    marginBottom: '0.75rem',
    textAlign: 'center',
  },
  buttonGrid: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '0.5rem',
  },
  feedback: {
    marginTop: '0.75rem',
    padding: '0.5rem',
    borderRadius: '4px',
    fontSize: '0.875rem',
    textAlign: 'center',
  },
};