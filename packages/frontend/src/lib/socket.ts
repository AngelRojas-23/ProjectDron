/**
 * Socket.io client factory
 * Creates a connected socket instance with auth cookie
 */
import { io, Socket } from 'socket.io-client';

// Default streaming server URL
const STREAMING_URL = 'http://localhost:3001';

/**
 * Create and connect a socket.io client
 * Uses the auth cookie automatically sent by the browser
 *
 * @returns Connected socket instance
 */
export function createSocket(): Socket {
  return io(STREAMING_URL, {
    // Transport configuration
    transports: ['websocket', 'polling'],

    // Credentials (cookies) are sent automatically with same-origin requests
    withCredentials: true,

    // Reconnection options
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 1000,
  });
}

/**
 * Get the socket instance (singleton pattern)
 * For simplicity, we create a new socket each time - the caller manages lifecycle
 */
let currentSocket: Socket | null = null;

/**
 * Get or create the current socket connection
 */
export function getSocket(): Socket {
  if (!currentSocket || !currentSocket.connected) {
    currentSocket = createSocket();
  }
  return currentSocket;
}

/**
 * Disconnect the current socket
 */
export function disconnectSocket(): void {
  if (currentSocket) {
    currentSocket.disconnect();
    currentSocket = null;
  }
}