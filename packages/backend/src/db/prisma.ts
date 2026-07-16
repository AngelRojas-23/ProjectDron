/**
 * Prisma Client singleton for database access
 * Used by backend and streaming packages
 */

import { PrismaClient } from '@prisma/client';

/**
 * Global type for PrismaClient to avoid TS errors with globalThis
 */
type GlobalPrismaClient = typeof globalThis & {
  prisma: PrismaClient | undefined;
};

/**
 * Get or create the PrismaClient singleton
 * In development, we reuse the instance to avoid connection exhaustion
 */
function getPrismaClient(): PrismaClient {
  const global = globalThis as GlobalPrismaClient;

  if (!global.prisma) {
    global.prisma = new PrismaClient({
      // Log queries in development
      log: process.env.NODE_ENV === 'development'
        ? ['query', 'error', 'warn']
        : ['error'],
    });
  }

  return global.prisma;
}

/**
 * The singleton PrismaClient instance
 */
export const prisma = getPrismaClient();

/**
 * Connect to the database
 * Call this when the server starts
 */
export async function connectDatabase(): Promise<void> {
  await prisma.$connect();
  console.log('📦 Database connected successfully');
}

/**
 * Disconnect from the database
 * Call this when the server stops
 */
export async function disconnectDatabase(): Promise<void> {
  await prisma.$disconnect();
  console.log('📦 Database disconnected');
}

/**
 * Graceful shutdown handler
 * Use this in your server's cleanup logic
 */
export function setupGracefulShutdown(): void {
  process.on('beforeExit', async () => {
    await disconnectDatabase();
  });
}