/**
 * Dashboard page component
 * Protected route that displays drone list, telemetry, and control buttons
 */
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/auth';
import { ConnectionStatusBadge } from '../components/ConnectionStatusBadge';
import { TelemetryPanel } from '../components/TelemetryPanel';
import { CommandButtons } from '../components/CommandButtons';

export default function Dashboard() {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);
  const isOperator = user?.role === 'operator';

  const handleLogout = () => {
    // Clear auth state
    logout();
    // Redirect to login
    navigate('/');
  };

  // For demo, use drone-1 as the selected drone
  const selectedDroneId = 'drone-1';

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <div style={styles.headerLeft}>
          <h1 style={styles.title}>Dashboard</h1>
          <ConnectionStatusBadge />
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

        <div style={styles.droneSection}>
          <h2 style={styles.sectionTitle}>Drones</h2>
          <p style={styles.placeholder}>
            No drones available. Connect a drone to see it here.
          </p>
        </div>

        {/* Telemetry Panel - always show for demo */}
        <div style={styles.telemetrySection}>
          <TelemetryPanel droneId={selectedDroneId} />
        </div>

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
  droneSection: {
    backgroundColor: 'white',
    padding: '1.5rem',
    borderRadius: '8px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
    marginBottom: '1rem',
  },
  sectionTitle: {
    margin: '0 0 1rem',
    color: '#1a1a1a',
    fontSize: '1.25rem',
  },
  placeholder: {
    color: '#6b7280',
    fontStyle: 'italic',
  },
  telemetrySection: {
    marginBottom: '1rem',
  },
  controlSection: {
    marginBottom: '1rem',
  },
};