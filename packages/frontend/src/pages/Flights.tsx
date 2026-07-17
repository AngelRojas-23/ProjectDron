/**
 * Flight History Page
 * Displays flight list, details, and replay functionality
 */
import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/auth';
import { useThemeStore, theme as themeColors, type ThemeColors } from '../store/theme';
import { formatDuration, calculateStats } from '../store/flights';
import { fetchFlights, type FlightDetails, type TelemetryPoint } from '../lib/api';

/**
 * Mini map component for displaying flight path
 * Uses semantic colors for the map visualization (green path, red markers)
 */
function FlightMap({
  telemetry,
  replayIndex,
}: {
  telemetry: TelemetryPoint[];
  replayIndex: number;
}) {
  const mode = useThemeStore((state) => state.mode);
  const t = themeColors[mode];
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || telemetry.length === 0) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Calculate bounds
    let minLat = Infinity,
      maxLat = -Infinity,
      minLon = Infinity,
      maxLon = -Infinity;

    for (const t of telemetry) {
      minLat = Math.min(minLat, t.lat);
      maxLat = Math.max(maxLat, t.lat);
      minLon = Math.min(minLon, t.lon);
      maxLon = Math.max(maxLon, t.lon);
    }

    const latRange = maxLat - minLat || 0.001;
    const lonRange = maxLon - minLon || 0.001;

    // Clear canvas - use light background for map clarity
    ctx.fillStyle = mode === 'dark' ? '#1e293b' : '#f0fdf4';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw grid
    ctx.strokeStyle = mode === 'dark' ? '#334155' : '#dcfce7';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
      const x = (i / 4) * canvas.width;
      const y = (i / 4) * canvas.height;
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, canvas.height);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(canvas.width, y);
      ctx.stroke();
    }

    // Draw path
    if (telemetry.length > 1) {
      ctx.strokeStyle = '#22c55e';
      ctx.lineWidth = 2;
      ctx.beginPath();

      for (let i = 0; i < telemetry.length; i++) {
        const t = telemetry[i];
        const x = ((t.lon - minLon) / lonRange) * canvas.width;
        const y = canvas.height - ((t.lat - minLat) / latRange) * canvas.height;

        if (i === 0) {
          ctx.moveTo(x, y);
        } else {
          ctx.lineTo(x, y);
        }
      }
      ctx.stroke();
    }

    // Draw current position marker
    if (replayIndex >= 0 && replayIndex < telemetry.length) {
      const t = telemetry[replayIndex];
      const x = ((t.lon - minLon) / lonRange) * canvas.width;
      const y = canvas.height - ((t.lat - minLat) / latRange) * canvas.height;

      // Glow effect
      ctx.beginPath();
      ctx.arc(x, y, 12, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(34, 197, 94, 0.3)';
      ctx.fill();

      // Drone marker
      ctx.beginPath();
      ctx.arc(x, y, 6, 0, Math.PI * 2);
      ctx.fillStyle = '#16a34a';
      ctx.fill();
      ctx.strokeStyle = 'white';
      ctx.lineWidth = 2;
      ctx.stroke();
    }

    // Draw start/end markers
    if (telemetry.length > 0) {
      const start = telemetry[0];
      const end = telemetry[telemetry.length - 1];

      // Start (green)
      const startX = ((start.lon - minLon) / lonRange) * canvas.width;
      const startY = canvas.height - ((start.lat - minLat) / latRange) * canvas.height;
      ctx.fillStyle = '#22c55e';
      ctx.beginPath();
      ctx.arc(startX, startY, 4, 0, Math.PI * 2);
      ctx.fill();

      // End (red)
      if (telemetry.length > 1) {
        const endX = ((end.lon - minLon) / lonRange) * canvas.width;
        const endY = canvas.height - ((end.lat - minLat) / latRange) * canvas.height;
        ctx.fillStyle = '#ef4444';
        ctx.beginPath();
        ctx.arc(endX, endY, 4, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }, [telemetry, replayIndex, mode]);

  return (
    <canvas
      ref={canvasRef}
      width={400}
      height={250}
      style={{ borderRadius: '8px', border: `1px solid ${t.border}` }}
    />
  );
}

export default function Flights() {
  const navigate = useNavigate();
  const logout = useAuthStore((state) => state.logout);
  const mode = useThemeStore((state) => state.mode);
  const t = themeColors[mode];

  const [flights, setFlights] = useState<
    Array<{
      id: string;
      droneId: string;
      droneName: string;
      startTime: string;
      endTime: string | null;
      status: 'active' | 'completed';
    }>
  >([]);
  const [selectedFlight, setSelectedFlight] = useState<FlightDetails | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Replay state
  const [isReplaying, setIsReplaying] = useState(false);
  const [replayIndex, setReplayIndex] = useState(0);
  const replayRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch flights on mount
  useEffect(() => {
    async function loadFlights() {
      try {
        const data = await fetchFlights();
        setFlights(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load flights');
      } finally {
        setIsLoading(false);
      }
    }
    loadFlights();
  }, []);

  // Cleanup replay on unmount
  useEffect(() => {
    return () => {
      if (replayRef.current) {
        clearInterval(replayRef.current);
      }
    };
  }, []);

  const handleFlightSelect = async (flightId: string) => {
    try {
      const api = await import('../lib/api');
      const details = await api.fetchFlightDetails(flightId);
      setSelectedFlight(details);
      setReplayIndex(0);
      setIsReplaying(false);
      if (replayRef.current) {
        clearInterval(replayRef.current);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load flight details');
    }
  };

  const handleBackToList = () => {
    setSelectedFlight(null);
    setIsReplaying(false);
    if (replayRef.current) {
      clearInterval(replayRef.current);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  const handleStartReplay = () => {
    if (!selectedFlight || selectedFlight.telemetry.length === 0) return;

    setIsReplaying(true);
    setReplayIndex(0);

    replayRef.current = setInterval(() => {
      setReplayIndex((prev) => {
        const next = prev + 1;
        if (next >= selectedFlight.telemetry.length) {
          if (replayRef.current) {
            clearInterval(replayRef.current);
          }
          setIsReplaying(false);
          return selectedFlight.telemetry.length - 1;
        }
        return next;
      });
    }, 100);
  };

  const handleStopReplay = () => {
    if (replayRef.current) {
      clearInterval(replayRef.current);
    }
    setIsReplaying(false);
    setReplayIndex(0);
  };

  // Render flight details view
  if (selectedFlight) {
    const stats = calculateStats(selectedFlight.telemetry);
    const currentTelemetry = selectedFlight.telemetry[replayIndex];
    const styles = getStyles(t);

    return (
      <div style={styles.container}>
        <header style={styles.header}>
          <div style={styles.headerLeft}>
            <button onClick={handleBackToList} style={styles.backButton}>
              ← Back
            </button>
            <h1 style={styles.title}>Flight Details</h1>
          </div>
          <button onClick={handleLogout} style={styles.logoutButton}>
            Logout
          </button>
        </header>

        <main style={styles.main}>
          <div style={styles.detailHeader}>
            <div>
              <h2 style={styles.droneName}>
                Drone: {selectedFlight.droneId}
              </h2>
              <p style={styles.flightTime}>
                {new Date(selectedFlight.startTime).toLocaleString()} -{' '}
                {selectedFlight.endTime
                  ? new Date(selectedFlight.endTime).toLocaleString()
                  : 'In Progress'}
              </p>
            </div>
            <button
              onClick={isReplaying ? handleStopReplay : handleStartReplay}
              style={styles.replayButton}
            >
              {isReplaying ? '■ Stop Replay' : '▶ Replay'}
            </button>
          </div>

          {/* Stats Grid */}
          <div style={styles.statsGrid}>
            <div style={styles.statCard}>
              <span style={styles.statLabel}>Max Altitude</span>
              <span style={styles.statValue}>{stats.maxAltitude.toFixed(1)}m</span>
            </div>
            <div style={styles.statCard}>
              <span style={styles.statLabel}>Max Speed</span>
              <span style={styles.statValue}>
                {stats.maxSpeed.toFixed(1)} m/s
              </span>
            </div>
            <div style={styles.statCard}>
              <span style={styles.statLabel}>Avg Battery</span>
              <span style={styles.statValue}>{stats.avgBattery}%</span>
            </div>
            <div style={styles.statCard}>
              <span style={styles.statLabel}>Distance</span>
              <span style={styles.statValue}>{stats.totalDistance}m</span>
            </div>
          </div>

          {/* Map and Telemetry Split */}
          <div style={styles.splitSection}>
            <div style={styles.mapSection}>
              <h3 style={styles.sectionTitle}>Flight Path</h3>
              <FlightMap
                telemetry={selectedFlight.telemetry}
                replayIndex={replayIndex}
              />
              {currentTelemetry && (
                <div style={styles.currentTelemetry}>
                  <strong>Position:</strong> {currentTelemetry.lat.toFixed(6)},{' '}
                  {currentTelemetry.lon.toFixed(6)} |{' '}
                  <strong>Alt:</strong> {currentTelemetry.alt.toFixed(1)}m |{' '}
                  <strong>Battery:</strong> {currentTelemetry.battery}%
                </div>
              )}
            </div>

            <div style={styles.telemetrySection}>
              <h3 style={styles.sectionTitle}>Telemetry Data</h3>
              <div style={styles.tableContainer}>
                <table style={styles.table}>
                  <thead>
                    <tr>
                      <th style={styles.th}>Time</th>
                      <th style={styles.th}>Lat</th>
                      <th style={styles.th}>Lon</th>
                      <th style={styles.th}>Alt</th>
                      <th style={styles.th}>Battery</th>
                      <th style={styles.th}>Speed</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedFlight.telemetry.slice(0, 100).map((t, idx) => (
                      <tr
                        key={t.id}
                        style={{
                          ...styles.tr,
                          backgroundColor:
                            idx === replayIndex ? (mode === 'dark' ? '#1e3a2f' : '#dcfce7') : 'transparent',
                        }}
                      >
                        <td style={styles.td}>
                          {new Date(t.ts).toLocaleTimeString()}
                        </td>
                        <td style={styles.td}>{t.lat.toFixed(5)}</td>
                        <td style={styles.td}>{t.lon.toFixed(5)}</td>
                        <td style={styles.td}>{t.alt.toFixed(1)}</td>
                        <td style={styles.td}>{t.battery}%</td>
                        <td style={styles.td}>
                          {t.groundspeed?.toFixed(1) || '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </main>
      </div>
    );
  }

  // Render flight list
  const styles = getStyles(t);

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <div style={styles.headerLeft}>
          <h1 style={styles.title}>Flight History</h1>
        </div>
        <button onClick={handleLogout} style={styles.logoutButton}>
          Logout
        </button>
      </header>

      <main style={styles.main}>
        {isLoading ? (
          <div style={styles.loading}>Loading flights...</div>
        ) : error ? (
          <div style={styles.error}>{error}</div>
        ) : flights.length === 0 ? (
          <div style={styles.empty}>No flights recorded yet</div>
        ) : (
          <div style={styles.tableContainer}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Drone</th>
                  <th style={styles.th}>Start Time</th>
                  <th style={styles.th}>End Time</th>
                  <th style={styles.th}>Duration</th>
                  <th style={styles.th}>Status</th>
                  <th style={styles.th}>Action</th>
                </tr>
              </thead>
              <tbody>
                {flights.map((flight) => (
                  <tr key={flight.id} style={styles.tr}>
                    <td style={styles.td}>{flight.droneName || flight.droneId}</td>
                    <td style={styles.td}>
                      {new Date(flight.startTime).toLocaleString()}
                    </td>
                    <td style={styles.td}>
                      {flight.endTime
                        ? new Date(flight.endTime).toLocaleString()
                        : '-'}
                    </td>
                    <td style={styles.td}>
                      {formatDuration(flight.startTime, flight.endTime)}
                    </td>
                    <td style={styles.td}>
                      <span
                        style={{
                          ...styles.statusBadge,
                          backgroundColor:
                            flight.status === 'active' ? '#dcfce7' : '#f3f4f6',
                          color: flight.status === 'active' ? '#166534' : '#374151',
                        }}
                      >
                        {flight.status}
                      </span>
                    </td>
                    <td style={styles.td}>
                      <button
                        onClick={() => handleFlightSelect(flight.id)}
                        style={styles.viewButton}
                      >
                        View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
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
  backButton: {
    padding: '0.5rem 1rem',
    backgroundColor: t.hover,
    color: t.text,
    border: 'none',
    borderRadius: '4px',
    fontSize: '0.875rem',
    fontWeight: '500',
    cursor: 'pointer',
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
  loading: {
    textAlign: 'center',
    padding: '2rem',
    color: t.textSecondary,
  },
  error: {
    textAlign: 'center',
    padding: '2rem',
    color: '#dc2626',
  },
  empty: {
    textAlign: 'center',
    padding: '2rem',
    color: t.textSecondary,
    fontStyle: 'italic',
  },
  tableContainer: {
    backgroundColor: t.bgCard,
    borderRadius: '8px',
    boxShadow: t.shadow,
    overflow: 'auto',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
  },
  th: {
    padding: '1rem',
    textAlign: 'left',
    fontWeight: '600',
    color: t.textSecondary,
    borderBottom: `2px solid ${t.border}`,
    fontSize: '0.875rem',
  },
  td: {
    padding: '1rem',
    color: t.text,
    borderBottom: `1px solid ${t.border}`,
    fontSize: '0.875rem',
  },
  tr: {
    transition: 'background-color 0.15s',
  },
  statusBadge: {
    display: 'inline-block',
    padding: '0.25rem 0.75rem',
    borderRadius: '9999px',
    fontSize: '0.75rem',
    fontWeight: '500',
    textTransform: 'capitalize',
  },
  viewButton: {
    padding: '0.375rem 0.75rem',
    backgroundColor: '#3b82f6',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    fontSize: '0.75rem',
    fontWeight: '500',
    cursor: 'pointer',
  },
  detailHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '1.5rem',
    padding: '1rem',
    backgroundColor: t.bgCard,
    borderRadius: '8px',
    boxShadow: t.shadow,
  },
  droneName: {
    margin: 0,
    color: t.text,
    fontSize: '1.25rem',
  },
  flightTime: {
    margin: '0.25rem 0 0',
    color: t.textSecondary,
    fontSize: '0.875rem',
  },
  replayButton: {
    padding: '0.5rem 1rem',
    backgroundColor: '#22c55e',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    fontSize: '0.875rem',
    fontWeight: '500',
    cursor: 'pointer',
  },
  statsGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: '1rem',
    marginBottom: '1.5rem',
  },
  statCard: {
    padding: '1rem',
    backgroundColor: t.bgCard,
    borderRadius: '8px',
    boxShadow: t.shadow,
    textAlign: 'center',
  },
  statLabel: {
    display: 'block',
    color: t.textSecondary,
    fontSize: '0.75rem',
    textTransform: 'uppercase',
    marginBottom: '0.25rem',
  },
  statValue: {
    display: 'block',
    color: t.text,
    fontSize: '1.5rem',
    fontWeight: '600',
  },
  splitSection: {
    display: 'flex',
    gap: '1rem',
  },
  mapSection: {
    flex: '0 0 420px',
    padding: '1rem',
    backgroundColor: t.bgCard,
    borderRadius: '8px',
    boxShadow: t.shadow,
  },
  telemetrySection: {
    flex: '1',
    padding: '1rem',
    backgroundColor: t.bgCard,
    borderRadius: '8px',
    boxShadow: t.shadow,
  },
  sectionTitle: {
    margin: '0 0 1rem',
    color: t.text,
    fontSize: '1rem',
  },
  currentTelemetry: {
    marginTop: '0.75rem',
    padding: '0.5rem',
    backgroundColor: t.hover,
    borderRadius: '4px',
    fontSize: '0.75rem',
    color: t.textSecondary,
  },
});