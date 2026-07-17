/**
 * Fastify HTTP API Server
 * Provides REST endpoints for authentication and health checks
 */

import Fastify from 'fastify';
import cors from '@fastify/cors';
import cookie from '@fastify/cookie';
import rateLimit from '@fastify/rate-limit';
import { connectDatabase, disconnectDatabase } from './db/prisma.js';
import healthRoutes from './routes/health.js';
import authRoutes from './auth/routes.js';
import { validateJwtSecret } from '@sd/shared/jwt.js';

// Server configuration
const HOST = process.env.HOST || '0.0.0.0';
const PORT = parseInt(process.env.PORT || '3000', 10);

// Frontend origin for CORS
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || 'http://localhost:5173';

/**
 * Build and configure the Fastify instance
 */
async function buildServer() {
  const fastify = Fastify({
    logger: {
      level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
    },
  });

  // Register CORS plugin
  await fastify.register(cors, {
    origin: FRONTEND_ORIGIN,
    credentials: true,
  });

  // Register cookie plugin for httpOnly session management
  await fastify.register(cookie);

  // Rate limiting: max 20 requests per minute per IP (prevents brute force)
  await fastify.register(rateLimit, {
    max: 20,
    timeWindow: '1 minute',
  });

  // Register health check routes
  await fastify.register(healthRoutes);

  // Register authentication routes
  await fastify.register(authRoutes, { prefix: '/auth' });

  // Home route
  fastify.get('/', async () => {
    return {
      service: 'Streaming-Dron Backend API',
      version: '0.1.0',
      status: 'running',
    };
  });

  return fastify;
}

/**
 * Start the server
 */
async function start() {
  const server = buildServer();

  try {
    // Validate JWT secret before starting
    validateJwtSecret();

    // Connect to database
    await connectDatabase();

    // Start Fastify
    await (await server).listen({ host: HOST, port: PORT });
    console.log(`🚀 Server running at http://${HOST}:${PORT}`);
    console.log(`📡 CORS enabled for: ${FRONTEND_ORIGIN}`);
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }

  // Graceful shutdown
  const shutdown = async () => {
    console.log('Shutting down server...');
    await (await server).close();
    await disconnectDatabase();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

// Start the server if this is the main module
start();