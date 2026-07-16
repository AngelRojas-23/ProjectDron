/**
 * Health check routes
 * Provides basic endpoint to verify server is running
 */

import type { FastifyInstance } from 'fastify';
import type { FastifyPluginAsync } from 'fastify';

/**
 * Health check route plugin
 * GET /health - Returns 200 OK when server is healthy
 */
const healthRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  /**
   * Health check endpoint
   * Returns server status and timestamp
   */
  fastify.get('/health', async (_request, _reply) => {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    };
  });
};

export default healthRoutes;