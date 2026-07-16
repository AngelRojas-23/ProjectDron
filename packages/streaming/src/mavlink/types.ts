/**
 * MAVLink type definitions
 * Defines interfaces for MAVLink JSON messages from mavlink2rest
 */

/**
 * MAVLink message header containing source identification
 */
export interface MavlinkHeader {
  system_id: number;
  component_id: number;
  sequence: number;
}

/**
 * Heartbeat message - periodic status from MAVLink system
 */
export interface Heartbeat {
  type: number;
  autopilot: number;
  base_mode: number;
  custom_mode: number;
  system_status: number;
  mavlink_version: number;
}

/**
 * GPS position in integer format (degE7)
 */
export interface GpsPositionInt {
  time_usec: number;
  fix_type: number;
  lat: number;
  lon: number;
  alt: number;
  relative_alt: number;
  vx: number;
  vy: number;
  vz: number;
  hdg: number;
}

/**
 * Battery status message
 */
export interface BatteryStatus {
  id: number;
  battery_function: number;
  type: number;
  temperature: number;
  voltages: number[];
  current_battery: number;
  current_consumed: number;
  energy_consumed: number;
  battery_remaining: number;
}

/**
 * VFR HUD - Vehicle Forward Reference Heads-Up Display
 * Current flight data displayed to the user
 */
export interface VfrHud {
  airspeed: number;
  groundspeed: number;
  heading: number;
  throttle: number;
  alt: number;
  climb: number;
}

/**
 * Attitude - orientation in 3D space
 */
export interface Attitude {
  time_usec: number;
  roll: number;
  pitch: number;
  yaw: number;
  rollspeed: number;
  pitchspeed: number;
  yawspeed: number;
}

/**
 * System status message
 */
export interface SysStatus {
  onboard_control_sensors_present: number;
  onboard_control_sensors_enabled: number;
  onboard_control_sensors_health: number;
  load: number;
  voltage_battery: number;
  current_battery: number;
  battery_remaining: number;
  drop_rate_comm: number;
  errors_comm: number;
  errors_count1: number;
  errors_count2: number;
  errors_count3: number;
  errors_count4: number;
}

/**
 * Command acknowledgment message
 */
export interface CommandAck {
  command: number;
  result: number;
  result_param2: number;
  progress: number;
  target_system: number;
  target_component: number;
}

/**
 * Union of all supported MAVLink message types
 */
export type MavlinkMessage =
  | { type: 'HEARTBEAT'; data: Heartbeat }
  | { type: 'GPS_POSITION_INT'; data: GpsPositionInt }
  | { type: 'BATTERY_STATUS'; data: BatteryStatus }
  | { type: 'VFR_HUD'; data: VfrHud }
  | { type: 'ATTITUDE'; data: Attitude }
  | { type: 'SYS_STATUS'; data: SysStatus }
  | { type: 'COMMAND_ACK'; data: CommandAck };

/**
 * Wrapper message from mavlink2rest WebSocket
 */
export interface Mavlink2RestWsMessage {
  header: MavlinkHeader;
  message: MavlinkMessage;
}

/**
 * Accumulated telemetry state for a single drone
 * Maintains the latest values for all MAVLink fields
 */
export interface MavAccumulator {
  // Position
  lat: number | null;
  lon: number | null;
  alt: number | null;
  // Navigation
  heading: number | null;
  groundspeed: number | null;
  airspeed: number | null;
  // Power
  battery: number | null;
  voltage: number | null;
  current: number | null;
  // Orientation
  roll: number | null;
  pitch: number | null;
  yaw: number | null;
  // Flight state
  flightMode: string | null;
  armed: boolean | null;
  // Source identifiers
  mavSystemId: number | null;
  mavComponentId: number | null;
  // Timestamps for stale detection
  receivedAt: Record<string, number>;
}

/**
 * Default empty accumulator
 */
export function createAccumulator(): MavAccumulator {
  return {
    lat: null,
    lon: null,
    alt: null,
    heading: null,
    groundspeed: null,
    airspeed: null,
    battery: null,
    voltage: null,
    current: null,
    roll: null,
    pitch: null,
    yaw: null,
    flightMode: null,
    armed: null,
    mavSystemId: null,
    mavComponentId: null,
    receivedAt: {},
  };
}