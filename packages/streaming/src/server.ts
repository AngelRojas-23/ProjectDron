/**
 * Socket.io Streaming Server
 * Handles real-time drone telemetry and control
 */

import { Server } from 'socket.io';
import { createServer } from 'http';
import { verifyAccess } from '@sd/shared/jwt.js';
import { registerEventHandlers } from './events.js';
import { RoomManager } from './rooms.js';

// Server configuration
const HOST = process.env.HOST || '0.0.0.0';
const STREAMING_PORT = parseInt(process.env.STREAMING_PORT || '3001', 10);

/**
 * JWT verification middleware for Socket.io handshake
 */
function verifyToken(token: string): { userId: string; role: string } | null {
  try {
    return verifyAccess(token);
  } catch {
    return null;
  }
}

/**
 * Create and configure the Socket.io server
 */
function createStreamingServer(): { io: Server; roomManager: RoomManager; httpServer: ReturnType<typeof createServer> } {
  // Create HTTP server
  const httpServer = createServer();

  // Create Socket.io server
  const io = new Server(httpServer, {
    cors: {
      origin: process.env.FRONTEND_ORIGIN || 'http://localhost:5173',
      credentials: true,
    },
  });

  // Create room manager
  const roomManager = new RoomManager();

  // JWT handshake middleware
  io.use((socket, next) => {
    // Get token from query or handshake auth
    const token =
      (socket.handshake.auth.token as string) ||
      (socket.handshake.query.token as string);

    if (!token) {
      console.log('Socket.io: No token provided');
      return next(new Error('Authentication required'));
    }

    // Verify token
    const payload = verifyToken(token);
    if (!payload) {
      console.log('Socket.io: Invalid token');
      return next(new Error('Invalid or expired token'));
    }

    // Attach user data to socket
    socket.data.user = payload;
    console.log(`Socket.io: User ${payload.userId} (${payload.role}) connected`);
    next();
  });

  // Register event handlers
  registerEventHandlers(io, roomManager);

  // Set io instance on room manager for broadcasting
  roomManager.setServer(io);

  return { io, roomManager, httpServer };
}

/**
 * Simulate telemetry data for demonstration
 * Emits random telemetry for each drone room every 2 seconds
 */
function startTelemetrySimulation(roomManager: RoomManager): void {
  setInterval(() => {
    // Get all drone rooms
    const drones = roomManager.getAllDrones();

    for (const droneId of drones) {
      // Generate simulated telemetry
      const telemetry = {
        id: `telemetry-${Date.now()}`,
        flightId: `flight-${droneId}`,
        droneId,
        lat: 33.9425 + (Math.random() - 0.5) * 0.01,
        lon: -118.4081 + (Math.random() - 0.5) * 0.01,
        alt: 50 + Math.random() * 50,
        battery: 70 + Math.floor(Math.random() * 30),
        ts: new Date(),
        createdAt: new Date(),
      };

      // Broadcast to room
      roomManager.broadcastTelemetry(droneId, telemetry);
    }
  }, 2000);
}

/**
 * Start the streaming server
 */
async function start() {
  const { io, roomManager, httpServer } = createStreamingServer();

  // Start HTTP server (Socket.io attaches to it)
  httpServer.listen(STREAMING_PORT, HOST, () => {
    console.log(`📡 Streaming server running on port ${STREAMING_PORT}`);
  });

  // Start simulated telemetry
  startTelemetrySimulation(roomManager);

  // Graceful shutdown
  const shutdown = () => {
    console.log('Shutting down streaming server...');
    io.close();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

// Start the server
start();