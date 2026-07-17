/**
 * TelemetryOverlay component
 * Renders an FPV-style OSD (On-Screen Display) overlay on top of the video feed
 * Shows altitude, speed, heading, battery, GPS coordinates, and drone status
 */
import { useState, useEffect } from 'react';
import type { Telemetry } from '@sd/shared';
import { useSocket } from '../hooks/useSocket';

interface TelemetryOverlayProps {
  droneId: string;
}

/**
 * Formats a number to a fixed width string with leading zeros
 */
function padNumber(value: number, digits: number): string {
  return String(Math.round(value)).padStart(digits, '0');
}

/**
 * Formats coordinates to DMS-like display
 */
function formatCoord(value: number, type: 'lat' | 'lon'): string {
  const dir = type === 'lat'
    ? value >= 0 ? 'N' : 'S'
    : value >= 0 ? 'E' : 'W';
  const abs = Math.abs(value);
  const deg = Math.floor(abs);
  const min = (abs - deg) * 60;
  return `${dir} ${padNumber(deg, 2)}°${min.toFixed(2)}'`;
}

/**
 * TelemetryOverlay component
 * Absolutely positioned over the video, semi-transparent background
 */
export function TelemetryOverlay({ droneId }: TelemetryOverlayProps) {
  const [telemetry, setTelemetry] = useState<Telemetry | null>(null);
  const socket = useSocket();

  useEffect(() => {
    if (!socket) return;

    const handleTelemetry = (data: Telemetry) => {
      if (data.droneId === droneId) {
        setTelemetry(data);
      }
    };

    socket.on('telemetry', handleTelemetry);

    return () => {
      socket.off('telemetry', handleTelemetry);
    };
  }, [socket, droneId]);

  if (!telemetry) {
    return (
      <div style={styles.overlay}>
        <div style={styles.waiting}>Waiting for telemetry...</div>
      </div>
    );
  }

  const {
    alt,
    groundspeed,
    airspeed,
    heading,
    battery,
    voltage,
    lat,
    lon,
    flightMode,
    armed,
  } = telemetry;

  return (
    <div style={styles.overlay}>
      {/* Top-left: Altitude */}
      <div style={{ ...styles.corner, top: '8px', left: '8px' }}>
        <div style={styles.label}>ALT</div>
        <div style={styles.value}>
          {alt !== null && alt !== undefined ? `${alt.toFixed(1)}m` : '--m'}
        </div>
      </div>

      {/* Top-right: Ground Speed */}
      <div style={{ ...styles.corner, top: '8px', right: '8px' }}>
        <div style={styles.label}>SPD</div>
        <div style={styles.value}>
          {groundspeed !== null && groundspeed !== undefined
            ? `${groundspeed.toFixed(1)}m/s`
            : '--m/s'}
        </div>
      </div>

      {/* Center: Heading compass */}
      <div style={styles.compassContainer}>
        <div style={styles.compassLabel}>HDG</div>
        <div style={styles.compassValue}>
          {heading !== null ? `${Math.round(heading)}°` : '---°'}
        </div>
        <div style={styles.compassBar}>
          {[-60, -45, -30, -15, 0, 15, 30, 45, 60].map((offset) => {
            const tickHeading = heading !== null ? heading + offset : offset;
            const isCenter = offset === 0;
            return (
              <div
                key={offset}
                style={{
                  ...styles.compassTick,
                  left: `${50 + offset}%`,
                  height: isCenter ? '16px' : '8px',
                  borderLeft: isCenter
                    ? '2px solid #ff4444'
                    : '1px solid rgba(255,255,255,0.6)',
                }}
              >
                {offset % 15 === 0 && (
                  <span style={styles.compassTickLabel}>
                    {((Math.round(tickHeading / 5) * 5) % 360).toString().padStart(3, '0')}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Bottom-left: GPS + Flight Mode */}
      <div style={{ ...styles.corner, bottom: '8px', left: '8px' }}>
        <div style={styles.row}>
          <span style={styles.label}>GPS</span>
          <span style={styles.valueSmall}>
            {lat !== undefined && lon !== undefined
              ? `${formatCoord(lat, 'lat')} ${formatCoord(lon, 'lon')}`
              : '--'}
          </span>
        </div>
        <div style={styles.row}>
          <span style={styles.label}>MODE</span>
          <span style={styles.valueSmall}>{flightMode ?? '--'}</span>
        </div>
      </div>

      {/* Bottom-right: Battery + Armed status */}
      <div style={{ ...styles.corner, bottom: '8px', right: '8px' }}>
        <div style={styles.row}>
          <span style={styles.label}>BAT</span>
          <span
            style={{
              ...styles.valueSmall,
              color:
                battery !== null && battery !== undefined
                  ? battery > 50
                    ? '#4ade80'
                    : battery > 20
                      ? '#fbbf24'
                      : '#ff4444'
                  : '#aaa',
            }}
          >
            {battery !== null && battery !== undefined ? `${battery}%` : '--%'}
          </span>
        </div>
        {voltage !== null && voltage !== undefined && (
          <div style={styles.row}>
            <span style={styles.label}>V</span>
            <span style={styles.valueSmall}>{voltage.toFixed(1)}V</span>
          </div>
        )}
        <div style={styles.row}>
          <span style={styles.label}>ARM</span>
          <span
            style={{
              ...styles.valueSmall,
              color: armed === true ? '#ff4444' : '#aaa',
              fontWeight: armed === true ? '700' : '400',
            }}
          >
            {armed === true ? 'ARMED' : armed === false ? 'SAFE' : '--'}
          </span>
        </div>
        <div style={styles.row}>
          <span style={styles.label}>AIR</span>
          <span style={styles.valueSmall}>
            {airspeed !== null && airspeed !== undefined
              ? `${airspeed.toFixed(1)}m/s`
              : '--m/s'}
          </span>
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    pointerEvents: 'none',
    fontFamily: "'Courier New', 'Consolas', monospace",
    color: '#fff',
    textShadow: '1px 1px 2px rgba(0,0,0,0.8), 0 0 4px rgba(0,0,0,0.5)',
    zIndex: 10,
  },
  waiting: {
    position: 'absolute',
    bottom: '8px',
    right: '8px',
    fontSize: '11px',
    opacity: 0.5,
  },
  corner: {
    position: 'absolute',
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
    padding: '4px 6px',
    backgroundColor: 'rgba(0,0,0,0.35)',
    borderRadius: '4px',
  },
  label: {
    fontSize: '10px',
    fontWeight: '700',
    color: '#4ade80',
    letterSpacing: '1px',
    marginRight: '4px',
  },
  value: {
    fontSize: '18px',
    fontWeight: '700',
    lineHeight: 1.1,
  },
  valueSmall: {
    fontSize: '12px',
    fontWeight: '600',
    lineHeight: 1.3,
  },
  row: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
  },
  // Compass
  compassContainer: {
    position: 'absolute',
    bottom: '40px',
    left: '50%',
    transform: 'translateX(-50%)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '2px',
  },
  compassLabel: {
    fontSize: '9px',
    fontWeight: '700',
    color: '#4ade80',
    letterSpacing: '1px',
  },
  compassValue: {
    fontSize: '14px',
    fontWeight: '700',
  },
  compassBar: {
    position: 'relative',
    width: '200px',
    height: '20px',
    overflow: 'hidden',
  },
  compassTick: {
    position: 'absolute',
    top: 0,
    width: 0,
  },
  compassTickLabel: {
    position: 'absolute',
    top: '18px',
    left: '50%',
    transform: 'translateX(-50%)',
    fontSize: '8px',
    whiteSpace: 'nowrap',
    color: 'rgba(255,255,255,0.7)',
  },
};
