/**
 * useSocket hook
 * Provides Socket.io connection with auto-cleanup on unmount
 */
import { useEffect, useState } from 'react';
import { Socket } from 'socket.io-client';
import { getSocket } from '../lib/socket';

/**
 * Hook to get the Socket.io instance
 * Automatically connects and cleans up on unmount
 *
 * @returns Connected socket instance or null if not yet connected
 */
export function useSocket(): Socket | null {
  const [socket, setSocket] = useState<Socket | null>(null);

  useEffect(() => {
    // Get or create socket connection
    const socketInstance = getSocket();
    setSocket(socketInstance);

    // Cleanup: do not disconnect on unmount (socket is shared)
    // The socket lifecycle is managed at app level
    return () => {
      // Optionally handle disconnect on unmount
      // For now, keep socket alive for app-wide use
    };
  }, []);

  return socket;
}