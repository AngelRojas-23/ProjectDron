/**
 * DroneSelector component
 * Dropdown for selecting an active drone with join functionality
 */
import { useEffect } from 'react';
import { useDroneStore } from '../store/drones';
import { useThemeStore, theme as themeColors, type ThemeColors } from '../store/theme';
import { getSocket } from '../lib/socket';

export function DroneSelector() {
  const { drones, selectedDroneId, selectDrone, subscribeToDrones } = useDroneStore();
  const mode = useThemeStore((state) => state.mode);
  const t = themeColors[mode];

  // Subscribe to drone list on mount
  useEffect(() => {
    const socket = getSocket();
    subscribeToDrones(socket);

    // Cleanup interval on unmount
    return () => {
      const socketRef = socket as unknown as { _droneListInterval?: NodeJS.Timeout };
      if (socketRef._droneListInterval) {
        clearInterval(socketRef._droneListInterval);
      }
    };
  }, [subscribeToDrones]);

  const handleJoin = () => {
    if (!selectedDroneId) return;
    
    const socket = getSocket();
    socket.emit('drone:join', selectedDroneId, (response: { ok: boolean; error?: string }) => {
      if (!response.ok) {
        console.error('Failed to join drone:', response.error);
      }
    });
  };

  const styles = getStyles(t);

  return (
    <div style={styles.container}>
      <h3 style={styles.title}>Select Drone</h3>
      
      {drones.length === 0 ? (
        <p style={styles.noDrones}>No drones available</p>
      ) : (
        <>
          <div style={styles.list}>
            {drones.map((droneId) => (
              <button
                key={droneId}
                onClick={() => selectDrone(droneId)}
                style={{
                  ...styles.droneButton,
                  ...(selectedDroneId === droneId ? styles.droneButtonSelected : {}),
                }}
              >
                {droneId}
              </button>
            ))}
          </div>
          
          <button
            onClick={handleJoin}
            disabled={!selectedDroneId}
            style={{
              ...styles.joinButton,
              ...(selectedDroneId ? {} : styles.joinButtonDisabled),
            }}
          >
            Join
          </button>
        </>
      )}
    </div>
  );
}

// Dynamic styles based on theme
const getStyles = (t: ThemeColors): Record<string, React.CSSProperties> => ({
  container: {
    backgroundColor: t.bgCard,
    padding: '1.5rem',
    borderRadius: '8px',
    boxShadow: t.shadow,
    marginBottom: '1rem',
  },
  title: {
    margin: '0 0 1rem',
    color: t.text,
    fontSize: '1.25rem',
  },
  noDrones: {
    color: t.textSecondary,
    fontStyle: 'italic',
    margin: 0,
  },
  list: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '0.5rem',
    marginBottom: '1rem',
  },
  droneButton: {
    padding: '0.5rem 1rem',
    backgroundColor: t.hover,
    color: t.text,
    border: '2px solid transparent',
    borderRadius: '6px',
    fontSize: '0.875rem',
    fontWeight: '500',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
  },
  droneButtonSelected: {
    backgroundColor: '#3b82f6',
    color: 'white',
    borderColor: '#2563eb',
  },
  joinButton: {
    padding: '0.5rem 1.5rem',
    backgroundColor: '#10b981',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    fontSize: '0.875rem',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
  },
  joinButtonDisabled: {
    backgroundColor: '#9ca3af',
    cursor: 'not-allowed',
  },
});