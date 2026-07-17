/**
 * AlertPanel component
 * Displays real-time alerts for drone monitoring
 * Shows unread count badge and expandable alert list
 */
import { useState, useEffect } from 'react';
import { useAlertStore, type Alert, type AlertSeverity } from '../store/alerts';
import { useThemeStore, theme as themeColors, type ThemeColors } from '../store/theme';
import { getSocket } from '../lib/socket';

/**
 * Severity colors
 */
const SEVERITY_STYLES: Record<AlertSeverity, { bg: string; color: string; icon: string }> = {
  critical: { bg: '#fef2f2', color: '#dc2626', icon: '🔴' },
  warning: { bg: '#fffbeb', color: '#f59e0b', icon: '🟡' },
  info: { bg: '#f0f9ff', color: '#3b82f6', icon: '🔵' },
};

/**
 * Format timestamp to relative time
 */
function timeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  return `${Math.floor(minutes / 60)}h ago`;
}

/**
 * AlertPanel component
 */
export function AlertPanel() {
  const { alerts, unreadCount, acknowledgeAlert, acknowledgeAll, subscribeToTelemetry } = useAlertStore();
  const mode = useThemeStore((state) => state.mode);
  const t = themeColors[mode];
  const [isOpen, setIsOpen] = useState(false);

  // Subscribe to telemetry for alert detection
  useEffect(() => {
    const socket = getSocket();
    const cleanup = subscribeToTelemetry(socket);
    return cleanup;
  }, [subscribeToTelemetry]);

  const recentAlerts = alerts.slice(0, 20);
  const styles = getStyles(t);

  return (
    <div style={styles.container}>
      {/* Alert bell button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={styles.bellButton}
        title="Alerts"
      >
        <span style={styles.bellIcon}>🔔</span>
        {unreadCount > 0 && (
          <span style={styles.badge}>
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Alert panel dropdown */}
      {isOpen && (
        <div style={styles.panel}>
          <div style={styles.panelHeader}>
            <h3 style={styles.panelTitle}>Alerts</h3>
            {unreadCount > 0 && (
              <button onClick={acknowledgeAll} style={styles.ackAllButton}>
                Acknowledge all
              </button>
            )}
          </div>

          <div style={styles.alertList}>
            {recentAlerts.length === 0 ? (
              <div style={styles.emptyState}>No alerts</div>
            ) : (
              recentAlerts.map((alert) => (
                <AlertItem
                  key={alert.id}
                  alert={alert}
                  onAcknowledge={acknowledgeAlert}
                />
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Individual alert item
 */
function AlertItem({
  alert,
  onAcknowledge,
}: {
  alert: Alert;
  onAcknowledge: (id: string) => void;
}) {
  const mode = useThemeStore((state) => state.mode);
  const t = themeColors[mode];
  const severityStyle = SEVERITY_STYLES[alert.severity];
  const styles = getStyles(t);

  return (
    <div
      style={{
        ...styles.alertItem,
        backgroundColor: alert.acknowledged ? t.hover : severityStyle.bg,
        borderLeft: `3px solid ${severityStyle.color}`,
      }}
    >
      <div style={styles.alertContent}>
        <div style={styles.alertHeader}>
          <span style={styles.alertIcon}>{severityStyle.icon}</span>
          <span style={{ ...styles.alertTitle, color: severityStyle.color }}>
            {alert.title}
          </span>
          <span style={styles.alertTime}>{timeAgo(alert.timestamp)}</span>
        </div>
        <div style={styles.alertMessage}>{alert.message}</div>
        <div style={styles.alertMeta}>
          <span style={styles.alertDrone}>{alert.droneId}</span>
        </div>
      </div>
      {!alert.acknowledged && (
        <button
          onClick={() => onAcknowledge(alert.id)}
          style={styles.ackButton}
          title="Acknowledge"
        >
          ✓
        </button>
      )}
    </div>
  );
}

// Dynamic styles based on theme
const getStyles = (t: ThemeColors): Record<string, React.CSSProperties> => ({
  container: {
    position: 'relative',
  },
  bellButton: {
    position: 'relative',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    padding: '0.5rem',
    fontSize: '1.25rem',
    lineHeight: 1,
  },
  bellIcon: {
    fontSize: '1.25rem',
  },
  badge: {
    position: 'absolute',
    top: '2px',
    right: '2px',
    backgroundColor: '#dc2626',
    color: 'white',
    fontSize: '0.65rem',
    fontWeight: '700',
    padding: '1px 4px',
    borderRadius: '9999px',
    minWidth: '16px',
    textAlign: 'center',
  },
  panel: {
    position: 'absolute',
    top: '100%',
    right: 0,
    width: '360px',
    maxHeight: '480px',
    backgroundColor: t.bgCard,
    borderRadius: '8px',
    boxShadow: t.shadow,
    zIndex: 1000,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
  },
  panelHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '0.75rem 1rem',
    borderBottom: `1px solid ${t.border}`,
  },
  panelTitle: {
    margin: 0,
    fontSize: '1rem',
    fontWeight: '600',
    color: t.text,
  },
  ackAllButton: {
    background: 'none',
    border: 'none',
    color: '#3b82f6',
    fontSize: '0.8rem',
    cursor: 'pointer',
    fontWeight: '500',
  },
  alertList: {
    overflowY: 'auto',
    flex: 1,
  },
  emptyState: {
    padding: '2rem',
    textAlign: 'center',
    color: t.textSecondary,
    fontSize: '0.875rem',
  },
  alertItem: {
    display: 'flex',
    alignItems: 'flex-start',
    padding: '0.75rem 1rem',
    borderBottom: `1px solid ${t.border}`,
    transition: 'background-color 0.2s',
  },
  alertContent: {
    flex: 1,
    minWidth: 0,
  },
  alertHeader: {
    display: 'flex',
    alignItems: 'center',
    gap: '0.375rem',
    marginBottom: '0.25rem',
  },
  alertIcon: {
    fontSize: '0.75rem',
  },
  alertTitle: {
    fontSize: '0.8rem',
    fontWeight: '600',
  },
  alertTime: {
    fontSize: '0.7rem',
    color: t.textSecondary,
    marginLeft: 'auto',
  },
  alertMessage: {
    fontSize: '0.8rem',
    color: t.textSecondary,
    marginBottom: '0.25rem',
    lineHeight: 1.3,
  },
  alertMeta: {
    display: 'flex',
    gap: '0.5rem',
  },
  alertDrone: {
    fontSize: '0.7rem',
    color: t.textSecondary,
    backgroundColor: t.hover,
    padding: '1px 6px',
    borderRadius: '4px',
  },
  ackButton: {
    background: 'none',
    border: `1px solid ${t.border}`,
    borderRadius: '50%',
    width: '24px',
    height: '24px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    fontSize: '0.75rem',
    color: t.textSecondary,
    flexShrink: 0,
    marginLeft: '0.5rem',
  },
});
