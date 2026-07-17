/**
 * Socket.io Streaming Server
 * Handles real-time drone telemetry and control
 */

import { Server } from 'socket.io';
import { createServer } from 'http';
import { verifyAccess, validateJwtSecret } from '@sd/shared/jwt.js';
import { registerEventHandlers, setMavlinkBridge } from './events.js';
import { RoomManager } from './rooms.js';
import { createMavlinkBridge } from './mavlink/bridge.js';
import { TelemetryRecorder } from './telemetryRecorder.js';

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

  // Add security headers to all HTTP responses
  httpServer.on('request', (_req: import('http').IncomingMessage, res: import('http').ServerResponse) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  });

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
 * Start the streaming server
 */
async function start() {
  // Validate JWT secret before starting
  validateJwtSecret();

  const { io, roomManager, httpServer } = createStreamingServer();

  // Start HTTP server (Socket.io attaches to it)
  httpServer.listen(STREAMING_PORT, HOST, () => {
    console.log(`📡 Streaming server running on port ${STREAMING_PORT}`);
  });

  // Initialize MAVLink bridge with fallback to simulation
  const bridge = createMavlinkBridge();
  bridge.setServer(io);
  bridge.setRoomManager(roomManager);

  // Pass bridge reference to events for command handling
  setMavlinkBridge(bridge);

  // Start the MAVLink bridge (will use simulation if not connected)
  bridge.start();

  // Initialize and start the telemetry recorder
  const telemetryRecorder = new TelemetryRecorder();
  telemetryRecorder.start();

  // Intercept telemetry broadcast to also record to database
  const originalBroadcast = roomManager.broadcastTelemetry.bind(roomManager);
  roomManager.broadcastTelemetry = function (droneId: string, telemetry: Parameters<typeof originalBroadcast>[1]) {
    // Broadcast as usual
    originalBroadcast(droneId, telemetry);
    // Also record to database
    telemetryRecorder.record(telemetry).catch((err) => {
      console.error('Failed to record telemetry:', err);
    });
  };

  // Graceful shutdown
  const shutdown = async () => {
    console.log('Shutting down streaming server...');
    await telemetryRecorder.stop();
    bridge.stop();
    io.close();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

// Start the server
start();