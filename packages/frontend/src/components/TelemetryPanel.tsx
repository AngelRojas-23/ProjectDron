/**
 * Telemetry Panel Component
 * Displays real-time flight telemetry data from MAVLink
 */
import { useState, useEffect } from 'react';
import type { Telemetry } from '@sd/shared/index.js';
import { useSocket } from '../hooks/useSocket';

/**
 * Telemetry Panel Props
 */
interface TelemetryPanelProps {
  droneId: string;
}

/**
 * Compass component to display heading
 */
function Compass({ heading }: { heading: number | null }) {
  const rotation = heading ?? 0;

  return (
    <div style={styles.compassContainer}>
      {/* Compass rose */}
      <div
        style={{
          ...styles.compassRose,
          transform: `rotate(-${rotation}deg)`,
        }}
      >
        <div style={styles.compassNorth}>N</div>
        <div style={styles.compassEast}>E</div>
        <div style={styles.compassSouth}>S</div>
        <div style={styles.compassWest}>W</div>
      </div>
      {/* Heading indicator */}
      <div style={styles.compassHeading}>
        {heading !== null ? `${Math.round(heading)}°` : '--'}
      </div>
    </div>
  );
}

/**
 * Telemetry Panel component
 * Shows heading, speeds, altitude, battery, voltage, flight mode, and armed status
 */
export function TelemetryPanel({ droneId }: TelemetryPanelProps) {
  const [telemetry, setTelemetry] = useState<Telemetry | null>(null);
  const socket = useSocket();

  useEffect(() => {
    if (!socket) return;

    // Listen for telemetry updates for this drone
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

  return (
    <div style={styles.panel}>
      <h3 style={styles.panelTitle}>Flight Telemetry</h3>

      <div style={styles.grid}>
        {/* Compass / Heading */}
        <div style={styles.card}>
          <div style={styles.cardLabel}>Heading</div>
          <Compass heading={telemetry?.heading ?? null} />
        </div>

        {/* Ground Speed */}
        <div style={styles.card}>
          <div style={styles.cardLabel}>Ground Speed</div>
          <div style={styles.cardValue}>
            {telemetry?.groundspeed !== null && telemetry?.groundspeed !== undefined
              ? `${telemetry.groundspeed.toFixed(1)} m/s`
              : '-- m/s'}
          </div>
        </div>

        {/* Air Speed */}
        <div style={styles.card}>
          <div style={styles.cardLabel}>Air Speed</div>
          <div style={styles.cardValue}>
            {telemetry?.airspeed !== null && telemetry?.airspeed !== undefined
              ? `${telemetry.airspeed.toFixed(1)} m/s`
              : '-- m/s'}
          </div>
        </div>

        {/* Altitude */}
        <div style={styles.card}>
          <div style={styles.cardLabel}>Altitude</div>
          <div style={styles.cardValue}>
            {telemetry?.alt !== undefined && telemetry?.alt !== null
              ? `${telemetry.alt.toFixed(1)} m`
              : '-- m'}
          </div>
        </div>

        {/* Battery */}
        <div style={styles.card}>
          <div style={styles.cardLabel}>Battery</div>
          <div style={styles.cardValue}>
            {telemetry?.battery !== undefined && telemetry?.battery !== null
              ? `${telemetry.battery}%`
              : '--%'}
          </div>
          {/* Battery bar */}
          <div style={styles.batteryBar}>
            <div
              style={{
                ...styles.batteryFill,
                width: `${telemetry?.battery ?? 0}%`,
                backgroundColor:
                  (telemetry?.battery ?? 0) > 50
                    ? '#16a34a'
                    : (telemetry?.battery ?? 0) > 20
                      ? '#f59e0b'
                      : '#dc2626',
              }}
            />
          </div>
        </div>

        {/* Voltage */}
        <div style={styles.card}>
          <div style={styles.cardLabel}>Voltage</div>
          <div style={styles.cardValue}>
            {telemetry?.voltage !== null && telemetry?.voltage !== undefined
              ? `${telemetry.voltage.toFixed(1)} V`
              : '-- V'}
          </div>
        </div>

        {/* Flight Mode */}
        <div style={styles.card}>
          <div style={styles.cardLabel}>Flight Mode</div>
          <div style={styles.cardValue}>{telemetry?.flightMode ?? '--'}</div>
        </div>

        {/* Armed Status */}
        <div style={styles.card}>
          <div style={styles.cardLabel}>Armed</div>
          <div
            style={{
              ...styles.cardValue,
              color: telemetry?.armed ? '#dc2626' : '#6b7280',
              fontWeight: '600',
            }}
          >
            {telemetry?.armed === true ? 'ARMED' : telemetry?.armed === false ? 'DISARMED' : '--'}
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Inline styles for the component
 */
const styles: Record<string, React.CSSProperties> = {
  panel: {
    backgroundColor: 'white',
    borderRadius: '8px',
    padding: '1rem',
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
  },
  panelTitle: {
    margin: '0 0 1rem',
    fontSize: '1rem',
    fontWeight: '600',
    color: '#1a1a1a',
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
    gap: '0.75rem',
  },
  card: {
    backgroundColor: '#f9fafb',
    borderRadius: '6px',
    padding: '0.75rem',
    textAlign: 'center',
  },
  cardLabel: {
    fontSize: '0.75rem',
    color: '#6b7280',
    marginBottom: '0.25rem',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  cardValue: {
    fontSize: '1rem',
    fontWeight: '600',
    color: '#1a1a1a',
  },
  // Compass styles
  compassContainer: {
    position: 'relative',
    width: '60px',
    height: '60px',
    margin: '0 auto',
  },
  compassRose: {
    width: '100%',
    height: '100%',
    borderRadius: '50%',
    border: '2px solid #d1d5db',
    position: 'relative',
    transition: 'transform 0.3s ease-out',
  },
  compassNorth: {
    position: 'absolute',
    top: '2px',
    left: '50%',
    transform: 'translateX(-50%)',
    fontSize: '0.6rem',
    fontWeight: '700',
    color: '#dc2626',
  },
  compassEast: {
    position: 'absolute',
    right: '2px',
    top: '50%',
    transform: 'translateY(-50%)',
    fontSize: '0.6rem',
    fontWeight: '700',
    color: '#6b7280',
  },
  compassSouth: {
    position: 'absolute',
    bottom: '2px',
    left: '50%',
    transform: 'translateX(-50%)',
    fontSize: '0.6rem',
    fontWeight: '700',
    color: '#6b7280',
  },
  compassWest: {
    position: 'absolute',
    left: '2px',
    top: '50%',
    transform: 'translateY(-50%)',
    fontSize: '0.6rem',
    fontWeight: '700',
    color: '#6b7280',
  },
  compassHeading: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    fontSize: '0.7rem',
    fontWeight: '700',
    color: '#1a1a1a',
  },
  // Battery bar
  batteryBar: {
    width: '100%',
    height: '4px',
    backgroundColor: '#e5e7eb',
    borderRadius: '2px',
    marginTop: '0.25rem',
    overflow: 'hidden',
  },
  batteryFill: {
    height: '100%',
    borderRadius: '2px',
    transition: 'width 0.3s ease, background-color 0.3s ease',
  },
};