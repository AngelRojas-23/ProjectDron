/**
 * Dashboard page component
 * Protected route that displays drone list, telemetry, and control buttons
 */
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/auth';
import { useDroneStore } from '../store/drones';
import { useDronePositionStore } from '../store/dronePositions';
import { getSocket } from '../lib/socket';
import { ConnectionStatusBadge } from '../components/ConnectionStatusBadge';
import { AlertPanel } from '../components/AlertPanel';
import { TelemetryPanel } from '../components/TelemetryPanel';
import { CommandButtons } from '../components/CommandButtons';
import { VideoPlayer } from '../components/VideoPlayer';
import { DroneSelector } from '../components/DroneSelector';
import { DroneMap } from '../components/DroneMap';

export default function Dashboard() {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);
  const isOperator = user?.role === 'operator';
  const selectedDroneId = useDroneStore((state) => state.selectedDroneId);
  const selectDrone = useDroneStore((state) => state.selectDrone);
  const subscribeToTelemetry = useDronePositionStore((state) => state.subscribeToTelemetry);

  // Subscribe to telemetry on mount
  useEffect(() => {
    const socket = getSocket();
    const cleanup = subscribeToTelemetry(socket);
    return cleanup;
  }, [subscribeToTelemetry]);

  const handleDroneSelect = (droneId: string) => {
    selectDrone(droneId);
  };

  const handleLogout = () => {
    // Clear auth state
    logout();
    // Redirect to login
    navigate('/');
  };

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <div style={styles.headerLeft}>
          <h1 style={styles.title}>Dashboard</h1>
          <ConnectionStatusBadge />
          <AlertPanel />
        </div>
        <button onClick={handleLogout} style={styles.logoutButton}>
          Logout
        </button>
      </header>

      <main style={styles.main}>
        <div style={styles.userInfo}>
          <p>Welcome, <strong>{user?.name || 'User'}</strong></p>
          <p style={styles.role}>Role: {user?.role || 'viewer'}</p>
        </div>

        {/* Drone Selector */}
        <DroneSelector />

        {/* Drone Map */}
        <DroneMap selectedDroneId={selectedDroneId} onDroneSelect={handleDroneSelect} />

        {/* Video and Telemetry Split - only shown when a drone is selected */}
        {selectedDroneId ? (
          <div style={styles.splitSection}>
            <div className="dashboard-video-section" style={styles.videoSection}>
              <h2 style={styles.sectionTitle}>Live Video</h2>
              <VideoPlayer droneId={selectedDroneId} />
            </div>
            <div className="dashboard-telemetry-section" style={styles.telemetrySection}>
              <TelemetryPanel droneId={selectedDroneId} />
            </div>
          </div>
        ) : (
          <div style={styles.placeholderContainer}>
            <p style={styles.placeholder}>
              Select a drone to view video and telemetry
            </p>
          </div>
        )}

        {/* Command Buttons - only for operators */}
        {isOperator && (
          <div style={styles.controlSection}>
            <CommandButtons />
          </div>
        )}
      </main>
    </div>
  );
}

// Simple inline styles
const styles: Record<string, React.CSSProperties> = {
  container: {
    minHeight: '100vh',
    backgroundColor: '#f5f5f5',
    fontFamily: 'system-ui, -apple-system, sans-serif',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '1rem 2rem',
    backgroundColor: 'white',
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
  },
  headerLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '1rem',
  },
  title: {
    margin: 0,
    color: '#1a1a1a',
    fontSize: '1.5rem',
  },
  logoutButton: {
    padding: '0.5rem 1rem',
    backgroundColor: '#dc2626',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    fontSize: '0.875rem',
    fontWeight: '500',
    cursor: 'pointer',
  },
  main: {
    padding: '2rem',
    maxWidth: '1200px',
    margin: '0 auto',
  },
  userInfo: {
    marginBottom: '2rem',
    color: '#374151',
  },
  role: {
    color: '#6b7280',
    fontSize: '0.875rem',
  },
  sectionTitle: {
    margin: '0 0 1rem',
    color: '#1a1a1a',
    fontSize: '1.25rem',
  },
  placeholderContainer: {
    backgroundColor: 'white',
    padding: '2rem',
    borderRadius: '8px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
    marginBottom: '1rem',
    textAlign: 'center',
  },
  placeholder: {
    color: '#6b7280',
    fontStyle: 'italic',
    fontSize: '1rem',
  },
  splitSection: {
    display: 'flex',
    gap: '1rem',
    marginBottom: '1rem',
  },
  videoSection: {
    flex: '0 0 60%',
    backgroundColor: 'white',
    padding: '1.5rem',
    borderRadius: '8px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
  },
  telemetrySection: {
    flex: '0 0 40%',
  },
  controlSection: {
    marginBottom: '1rem',
  },
};

// Inject responsive styles for mobile
if (typeof document !== 'undefined') {
  const styleId = 'dashboard-responsive-styles';
  if (!document.getElementById(styleId)) {
    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = `
      @media (max-width: 768px) {
        .dashboard-video-section,
        .dashboard-telemetry-section {
          flex: 0 0 100% !important;
        }
      }
    `;
    document.head.appendChild(style);
  }
}