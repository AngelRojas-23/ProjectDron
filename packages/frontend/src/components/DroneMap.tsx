/**
 * DroneMap component
 * Real-time map showing drone positions with custom markers
 */
import { useEffect, useRef, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { useDronePositionStore, getDroneConnectionStatus, type DronePosition, type DroneConnectionStatus } from '../store/dronePositions';

/**
 * Props for DroneMap component
 */
interface DroneMapProps {
  /** Currently selected drone ID */
  selectedDroneId?: string | null;
  /** Callback when a drone is selected on the map */
  onDroneSelect?: (droneId: string) => void;
}

/**
 * Default center coordinates (San Francisco)
 */
const DEFAULT_CENTER: [number, number] = [37.7749, -122.4194];

/**
 * MapBoundsUpdater component - auto-fits bounds to show all active drones
 */
function MapBoundsUpdater({ activeDrones }: { activeDrones: DronePosition[] }) {
  const map = useMap();

  useEffect(() => {
    if (activeDrones.length === 0) return;

    const bounds = L.latLngBounds(
      activeDrones.map((drone) => [drone.lat, drone.lon] as [number, number])
    );

    if (bounds.isValid()) {
      map.fitBounds(bounds, { padding: [50, 50] });
    }
  }, [map, activeDrones]);

  return null;
}

/**
 * Create a custom drone marker icon based on connection status
 */
function createDroneIcon(status: DroneConnectionStatus, heading: number | null): L.DivIcon {
  const colors = {
    connected: '#22c55e', // green
    reconnecting: '#eab308', // yellow
    disconnected: '#ef4444', // red
  };

  const color = colors[status];
  const arrowTransform = heading !== null ? `rotate(${heading}deg)` : '';

  return L.divIcon({
    className: 'drone-marker',
    html: `
      <div style="
        position: relative;
        width: 24px;
        height: 24px;
      ">
        <div style="
          width: 24px;
          height: 24px;
          background-color: ${color};
          border-radius: 50%;
          border: 2px solid white;
          box-shadow: 0 2px 4px rgba(0,0,0,0.3);
        "></div>
        <div style="
          position: absolute;
          top: 50%;
          left: 50%;
          width: 0;
          height: 0;
          border-left: 6px solid transparent;
          border-right: 6px solid transparent;
          border-bottom: 12px solid ${color};
          transform-origin: center -4px;
          transform: translate(-50%, -100%) ${arrowTransform};
          filter: drop-shadow(0 1px 2px rgba(0,0,0,0.3));
        "></div>
      </div>
    `,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
    popupAnchor: [0, -12],
  });
}

/**
 * DroneMap component
 * Displays real-time drone positions on an OpenStreetMap
 */
export function DroneMap({ selectedDroneId, onDroneSelect }: DroneMapProps) {
  const activeDrones = useDronePositionStore((state) => state.getActiveDrones());
  const mapRef = useRef<L.Map | null>(null);

  // Get the center position (first active drone or default)
  const center = useMemo<[number, number]>(() => {
    if (activeDrones.length > 0) {
      return [activeDrones[0].lat, activeDrones[0].lon] as [number, number];
    }
    return DEFAULT_CENTER;
  }, [activeDrones]);

  // Handle marker click
  const handleMarkerClick = (droneId: string) => {
    if (onDroneSelect) {
      onDroneSelect(droneId);
    }
  };

  return (
    <div style={styles.container}>
      <MapContainer
        center={center}
        zoom={15}
        style={styles.map}
        ref={mapRef}
        zoomControl={true}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        <MapBoundsUpdater activeDrones={activeDrones} />

        {activeDrones.map((drone) => {
          const status = getDroneConnectionStatus(drone.droneId);
          const isSelected = selectedDroneId === drone.droneId;

          return (
            <Marker
              key={drone.droneId}
              position={[drone.lat, drone.lon] as [number, number]}
              icon={createDroneIcon(status, drone.heading)}
              eventHandlers={{
                click: () => handleMarkerClick(drone.droneId),
              }}
            >
              <Popup>
                <div style={styles.popup}>
                  <h4 style={styles.popupTitle}>{drone.droneId}</h4>
                  <div style={styles.popupRow}>
                    <span style={styles.popupLabel}>Altitude:</span>
                    <span>{drone.alt.toFixed(1)} m</span>
                  </div>
                  <div style={styles.popupRow}>
                    <span style={styles.popupLabel}>Speed:</span>
                    <span>{drone.groundspeed?.toFixed(1) ?? '--'} m/s</span>
                  </div>
                  <div style={styles.popupRow}>
                    <span style={styles.popupLabel}>Battery:</span>
                    <span>{drone.battery}%</span>
                  </div>
                  <div style={styles.popupRow}>
                    <span style={styles.popupLabel}>Flight Mode:</span>
                    <span>{drone.flightMode ?? '--'}</span>
                  </div>
                  <div style={styles.popupRow}>
                    <span style={styles.popupLabel}>Armed:</span>
                    <span>{drone.armed ? 'Yes' : 'No'}</span>
                  </div>
                  {isSelected && (
                    <div style={styles.popupSelected}>Selected</div>
                  )}
                </div>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>
    </div>
  );
}

/**
 * Inline styles matching the design language
 */
const styles: Record<string, React.CSSProperties> = {
  container: {
    width: '100%',
    height: '400px',
    borderRadius: '8px',
    overflow: 'hidden',
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
    marginBottom: '1rem',
  },
  map: {
    width: '100%',
    height: '100%',
  },
  popup: {
    minWidth: '150px',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    fontSize: '14px',
  },
  popupTitle: {
    margin: '0 0 8px',
    color: '#1a1a1a',
    fontSize: '16px',
    fontWeight: '600',
  },
  popupRow: {
    display: 'flex',
    justifyContent: 'space-between',
    marginBottom: '4px',
  },
  popupLabel: {
    color: '#6b7280',
    fontWeight: '500',
  },
  popupSelected: {
    marginTop: '8px',
    padding: '4px 8px',
    backgroundColor: '#3b82f6',
    color: 'white',
    borderRadius: '4px',
    textAlign: 'center',
    fontSize: '12px',
    fontWeight: '600',
  },
};

// Inject responsive styles for map
if (typeof document !== 'undefined') {
  const styleId = 'drone-map-responsive-styles';
  if (!document.getElementById(styleId)) {
    const style = document.createElement('style');
    style.id = styleId;
    style.textContent = `
      @media (max-width: 768px) {
        .leaflet-container {
          height: 300px !important;
        }
      }
      .drone-marker {
        background: transparent;
        border: none;
      }
    `;
    document.head.appendChild(style);
  }
}