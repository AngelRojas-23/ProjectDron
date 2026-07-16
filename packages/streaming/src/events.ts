/**
 * Socket.io Event Handlers
 * Handles drone join, control commands, and telemetry
 */

import type { Server, Socket } from 'socket.io';
import type { RoomManager } from './rooms.js';
import type { Telemetry } from '@sd/shared/index.js';
export type { Telemetry } from '@sd/shared/index.js';

/**
 * Control command types
 */
type ControlCommand = 'takeoff' | 'land' | 'return';

/**
 * Register all event handlers with the Socket.io server
 * @param io - The Socket.io server instance
 * @param roomManager - The room manager instance
 */
export function registerEventHandlers(io: Server, roomManager: RoomManager): void {
  // Handle new connections
  io.on('connection', (socket: Socket) => {
    console.log(`Socket connected: ${socket.id}, User: ${socket.data.user?.userId}`);

    // Handle drone:join event
    socket.on('drone:join', (droneId: string, callback: (response: { ok: boolean; error?: string }) => void) => {
      handleDroneJoin(socket, roomManager, droneId, callback);
    });

    // Handle drone:control event
    socket.on('drone:control', (command: ControlCommand, callback: (response: { ok: boolean; error?: string }) => void) => {
      handleDroneControl(socket, roomManager, command, callback);
    });

    // Handle disconnection
    socket.on('disconnect', () => {
      console.log(`Socket disconnected: ${socket.id}`);
      roomManager.leaveRoom(socket);
    });
  });
}

/**
 * Handle drone:join event
 * Adds socket to the drone's room
 * @param socket - The socket joining
 * @param roomManager - The room manager
 * @param droneId - The drone ID to join
 * @param callback - Response callback
 */
function handleDroneJoin(
  socket: Socket,
  roomManager: RoomManager,
  droneId: string,
  callback: (response: { ok: boolean; error?: string }) => void
): void {
  // Get user from socket data (set by JWT middleware)
  const user = socket.data.user;

  if (!user) {
    callback({ ok: false, error: 'Not authenticated' });
    return;
  }

  // Validate droneId
  if (!droneId || typeof droneId !== 'string') {
    callback({ ok: false, error: 'Invalid drone ID' });
    return;
  }

  // Leave any current room before joining new one
  roomManager.leaveRoom(socket);

  // Join the new room
  const success = roomManager.joinRoom(socket, droneId);

  if (success) {
    console.log(`User ${user.userId} joined drone ${droneId}`);
    callback({ ok: true });
  } else {
    callback({ ok: false, error: 'Failed to join room' });
  }
}

/**
 * Handle drone:control event
 * Processes control commands, rejects non-operators
 * @param socket - The socket sending command
 * @param roomManager - The room manager
 * @param command - The control command
 * @param callback - Response callback
 */
function handleDroneControl(
  socket: Socket,
  _roomManager: RoomManager,
  command: ControlCommand,
  callback: (response: { ok: boolean; error?: string }) => void
): void {
  // Get user from socket data
  const user = socket.data.user;

  if (!user) {
    callback({ ok: false, error: 'Not authenticated' });
    return;
  }

  // Only operators can send control commands
  if (user.role !== 'operator') {
    console.log(`User ${user.userId} (role: ${user.role}) attempted control command: ${command}`);
    callback({ ok: false, error: 'Only operators can control drones' });
    return;
  }

  // Validate command
  const validCommands: ControlCommand[] = ['takeoff', 'land', 'return'];
  if (!validCommands.includes(command)) {
    callback({ ok: false, error: 'Invalid command' });
    return;
  }

  // Process command (in real app, this would send to drone)
  console.log(`Operator ${user.userId} sent control command: ${command}`);

  // Acknowledge success
  callback({ ok: true });
}

/**
 * Broadcast telemetry to all sockets in a drone room
 * @param io - The Socket.io server
 * @param droneId - The drone ID
 * @param telemetry - The telemetry data
 */
export function broadcastTelemetry(io: Server, droneId: string, telemetry: Telemetry): void {
  const roomKey = `drone:${droneId}`;
  io.to(roomKey).emit('telemetry', telemetry);
}

export default registerEventHandlers;