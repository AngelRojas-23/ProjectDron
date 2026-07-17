/**
 * DroneSelector component
 * Dropdown for selecting an active drone with join functionality
 */
import { useEffect } from 'react';
import { useDroneStore } from '../store/drones';
import { getSocket } from '../lib/socket';

export function DroneSelector() {
  const { drones, selectedDroneId, selectDrone, subscribeToDrones } = useDroneStore();

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

// Inline styles
const styles: Record<string, React.CSSProperties> = {
  container: {
    backgroundColor: 'white',
    padding: '1.5rem',
    borderRadius: '8px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
    marginBottom: '1rem',
  },
  title: {
    margin: '0 0 1rem',
    color: '#1a1a1a',
    fontSize: '1.25rem',
  },
  noDrones: {
    color: '#6b7280',
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
    backgroundColor: '#f3f4f6',
    color: '#374151',
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
};