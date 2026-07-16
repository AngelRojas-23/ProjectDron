/**
 * MAVLink Commands
 * Sends commands to drones via mavlink2rest REST API and correlates ACKs
 */

/**
 * Configuration for command execution
 */
export interface CommandConfig {
  restUrl: string;
  timeout: number;
  targetSystem: number;
  targetComponent: number;
}

/**
 * Default command configuration
 */
const DEFAULT_COMMAND_CONFIG: CommandConfig = {
  restUrl: process.env.MAVLINK_REST_URL || 'http://localhost:8088/v1/mavlink',
  timeout: 5000, // 5 seconds
  targetSystem: 1,
  targetComponent: 1,
};

/**
 * Command types
 */
export type CommandType = 'arm' | 'disarm' | 'takeoff' | 'RTL' | 'land';

/**
 * MAV_CMD enum values
 */
const MAV_CMD = {
  COMPONENT_ARM_DISARM: 400,
  NAV_TAKEOFF: 22,
  NAV_RETURN_TO_LAUNCH: 20,
  NAV_LAND: 21,
} as const;

/**
 * Command result
 */
export interface CommandResult {
  success: boolean;
  message: string;
}

/**
 * Pending command entry
 */
interface PendingCommand {
  id: string;
  command: CommandType;
  mavCommand: number;
  resolve: (result: CommandResult) => void;
  reject: (error: Error) => void;
  timeout: NodeJS.Timeout;
}

/**
 * Map of correlation ID to pending command
 */
const pendingCommands = new Map<string, PendingCommand>();

/**
 * Counter for generating unique command IDs
 */
let commandIdCounter = 1;

/**
 * Generate unique correlation ID
 */
function generateCorrelationId(): string {
  return `cmd-${Date.now()}-${commandIdCounter++}`;
}

/**
 * Build command payload for mavlink2rest REST API
 */
function buildCommandPayload(
  command: number,
  params: number[],
  targetSystem: number,
  targetComponent: number,
  correlationId: string
): object {
  return {
    header: {
      system_id: 255, // GCS system ID
      component_id: 1, // GCS component ID
      sequence: 0,
    },
    message: {
      type: 'COMMAND_LONG',
      command,
      target_system: targetSystem,
      target_component: targetComponent,
      confirmation: 0,
      param1: params[0],
      param2: params[1],
      param3: params[2],
      param4: params[3],
      param5: params[4],
      param6: params[5],
      param7: params[6],
    },
    correlation_id: correlationId,
  };
}

/**
 * Send a command to the drone via REST API
 */
export async function sendCommand(
  commandType: CommandType,
  config: Partial<CommandConfig> = {}
): Promise<CommandResult> {
  const cfg = { ...DEFAULT_COMMAND_CONFIG, ...config };
  const correlationId = generateCorrelationId();

  // Build command payload based on command type
  let mavCommand: number;
  let params: number[];

  switch (commandType) {
    case 'arm':
      mavCommand = MAV_CMD.COMPONENT_ARM_DISARM;
      params = [1, 0, 0, 0, 0, 0, 0]; // arm=1
      break;

    case 'disarm':
      mavCommand = MAV_CMD.COMPONENT_ARM_DISARM;
      params = [0, 0, 0, 0, 0, 0, 0]; // disarm=0
      break;

    case 'takeoff':
      mavCommand = MAV_CMD.NAV_TAKEOFF;
      params = [0, 0, 0, 0, 0, 0, 10]; // min takeoff alt 10m
      break;

    case 'RTL':
      mavCommand = MAV_CMD.NAV_RETURN_TO_LAUNCH;
      params = [0, 0, 0, 0, 0, 0, 0];
      break;

    case 'land':
      mavCommand = MAV_CMD.NAV_LAND;
      params = [0, 0, 0, 0, 0, 0, 0];
      break;

    default:
      return { success: false, message: `Unknown command type: ${commandType}` };
  }

  const payload = buildCommandPayload(
    mavCommand,
    params,
    cfg.targetSystem,
    cfg.targetComponent,
    correlationId
  );

  return new Promise<CommandResult>((resolve, reject) => {
    // Set timeout
    const timeout = setTimeout(() => {
      // Remove from pending
      pendingCommands.delete(correlationId);
      console.log(`[MAVLink] Command ${correlationId} (${commandType}) timed out`);
      resolve({ success: false, message: 'Command timeout - no ACK received' });
    }, cfg.timeout);

    // Store pending command
    pendingCommands.set(correlationId, {
      id: correlationId,
      command: commandType,
      mavCommand,
      resolve,
      reject,
      timeout,
    });

    // Send REST request
    fetch(`${cfg.restUrl}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    })
      .then((response) => {
        if (!response.ok) {
          clearTimeout(timeout);
          pendingCommands.delete(correlationId);
          resolve({
            success: false,
            message: `HTTP error: ${response.status} ${response.statusText}`,
          });
        }
      })
      .catch((error) => {
        clearTimeout(timeout);
        pendingCommands.delete(correlationId);
        console.error(`[MAVLink] Command ${correlationId} failed:`, error);
        resolve({
          success: false,
          message: `Network error: ${error.message}`,
        });
      });
  });
}

/**
 * Handle incoming COMMAND_ACK from MAVLink bridge
 * Called by bridge.ts when processing messages
 */
export function handleCommandAck(mavCommand: number, result: number): void {
  console.log(`[MAVLink] Received COMMAND_ACK: command=${mavCommand}, result=${result}`);

  // Find pending command matching the command type
  let matchedPending: PendingCommand | undefined;

  for (const [_id, pending] of pendingCommands) {
    if (pending.mavCommand === mavCommand) {
      matchedPending = pending;
      break;
    }
  }

  if (!matchedPending) {
    console.log(`[MAVLink] No pending command for ACK: ${mavCommand}`);
    return;
  }

  // Clear timeout
  clearTimeout(matchedPending.timeout);

  // Remove from pending
  pendingCommands.delete(matchedPending.id);

  // Parse result
  const resultStr = getResultString(result);
  const success = result === 0 || result === 1; // ACCEPTED or in progress

  console.log(`[MAVLink] Command ${matchedPending.command} result: ${resultStr}`);

  // Resolve promise
  matchedPending.resolve({
    success,
    message: resultStr,
  });
}

/**
 * Get human-readable result string
 */
function getResultString(result: number): string {
  const results: Record<number, string> = {
    0: 'ACCEPTED',
    1: 'TEMPORARILY_REJECTED',
    2: 'DENIED',
    3: 'UNSUPPORTED',
    4: 'FAILED',
    5: 'IN_PROGRESS',
    6: 'CANCELLED',
  };
  return results[result] || `UNKNOWN(${result})`;
}

/**
 * Command builders - return ready-to-use command functions
 */
export function createArmCommand(config?: Partial<CommandConfig>): () => Promise<CommandResult> {
  return () => sendCommand('arm', config);
}

export function createDisarmCommand(config?: Partial<CommandConfig>): () => Promise<CommandResult> {
  return () => sendCommand('disarm', config);
}

export function createTakeoffCommand(
  altitude: number,
  config?: Partial<CommandConfig>
): () => Promise<CommandResult> {
  return async () => {
    const cfg = { ...DEFAULT_COMMAND_CONFIG, ...config };
    const correlationId = generateCorrelationId();

    const payload = buildCommandPayload(
      MAV_CMD.NAV_TAKEOFF,
      [0, 0, 0, 0, 0, 0, altitude],
      cfg.targetSystem,
      cfg.targetComponent,
      correlationId
    );

    return new Promise<CommandResult>((resolve) => {
      const timeout = setTimeout(() => {
        pendingCommands.delete(correlationId);
        resolve({ success: false, message: 'Takeoff command timeout' });
      }, cfg.timeout);

      pendingCommands.set(correlationId, {
        id: correlationId,
        command: 'takeoff',
        mavCommand: MAV_CMD.NAV_TAKEOFF,
        resolve,
        reject: () => {},
        timeout,
      });

      fetch(`${cfg.restUrl}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }).catch((error) => {
        clearTimeout(timeout);
        pendingCommands.delete(correlationId);
        resolve({ success: false, message: `Network error: ${error.message}` });
      });
    });
  };
}

export function createRtlCommand(config?: Partial<CommandConfig>): () => Promise<CommandResult> {
  return () => sendCommand('RTL', config);
}

export function createLandCommand(config?: Partial<CommandConfig>): () => Promise<CommandResult> {
  return () => sendCommand('land', config);
}