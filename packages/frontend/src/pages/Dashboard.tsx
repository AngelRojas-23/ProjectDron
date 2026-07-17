/**
 * Dashboard page component
 * Protected route that displays drone list, telemetry, and control buttons
 */
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/auth';
import { useDroneStore } from '../store/drones';
import { useDronePositionStore } from '../store/dronePositions';
import { useThemeStore, theme as themeColors, type ThemeColors } from '../store/theme';
import { getSocket } from '../lib/socket';
import { api } from '../lib/api';
import { ConnectionStatusBadge } from '../components/ConnectionStatusBadge';
import { AlertPanel } from '../components/AlertPanel';
import { ThemeToggle } from '../components/ThemeToggle';
import { TelemetryPanel } from '../components/TelemetryPanel';
import { CommandButtons } from '../components/CommandButtons';
import { VideoPlayer } from '../components/VideoPlayer';
import { DroneSelector } from '../components/DroneSelector';
import { DroneMap } from '../components/DroneMap';

/**
 * Navigation link styles
 */
const getNavLinkStyle = (t: ThemeColors): React.CSSProperties => ({
  padding: '0.5rem 1rem',
  backgroundColor: 'transparent',
  color: t.text,
  border: 'none',
  borderRadius: '4px',
  fontSize: '0.875rem',
  fontWeight: '500',
  cursor: 'pointer',
  textDecoration: 'none',
});

export default function Dashboard() {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);
  const isOperator = user?.role === 'operator';
  const selectedDroneId = useDroneStore((state) => state.selectedDroneId);
  const selectDrone = useDroneStore((state) => state.selectDrone);
  const subscribeToTelemetry = useDronePositionStore((state) => state.subscribeToTelemetry);
  const mode = useThemeStore((state) => state.mode);
  const t = themeColors[mode];

  // Subscribe to telemetry on mount
  useEffect(() => {
    const socket = getSocket();
    const cleanup = subscribeToTelemetry(socket);
    return cleanup;
  }, [subscribeToTelemetry]);

  const handleDroneSelect = (droneId: string) => {
    selectDrone(droneId);
  };

  const handleLogout = async () => {
    try {
      // Call logout endpoint to clear cookies
      await api.post('/auth/logout');
    } catch {
      // Ignore errors - cookies might not exist
    }
    // Clear auth state
    logout();
    // Redirect to login
    navigate('/');
  };

  const styles = getStyles(t);

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <div style={styles.headerLeft}>
          <h1 style={styles.title}>Dashboard</h1>
          <ConnectionStatusBadge />
          <AlertPanel />
          <ThemeToggle />
          <a href="/flights" style={getNavLinkStyle(t)}>
            Flight History
          </a>
          {isOperator && (
            <a href="/admin" style={getNavLinkStyle(t)}>
              Admin
            </a>
          )}
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

// Dynamic styles based on theme
const getStyles = (t: ThemeColors): Record<string, React.CSSProperties> => ({
  container: {
    minHeight: '100vh',
    backgroundColor: t.bg,
    fontFamily: 'system-ui, -apple-system, sans-serif',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '1rem 2rem',
    backgroundColor: t.bgHeader,
    boxShadow: t.shadow,
  },
  headerLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '1rem',
  },
  title: {
    margin: 0,
    color: t.text,
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
    color: t.text,
  },
  role: {
    color: t.textSecondary,
    fontSize: '0.875rem',
  },
  sectionTitle: {
    margin: '0 0 1rem',
    color: t.text,
    fontSize: '1.25rem',
  },
  placeholderContainer: {
    backgroundColor: t.bgCard,
    padding: '2rem',
    borderRadius: '8px',
    boxShadow: t.shadow,
    marginBottom: '1rem',
    textAlign: 'center',
  },
  placeholder: {
    color: t.textSecondary,
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
    backgroundColor: t.bgCard,
    padding: '1.5rem',
    borderRadius: '8px',
    boxShadow: t.shadow,
  },
  telemetrySection: {
    flex: '0 0 40%',
  },
  controlSection: {
    marginBottom: '1rem',
  },
});

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