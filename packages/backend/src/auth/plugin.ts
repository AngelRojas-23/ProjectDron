/**
 * Fastify Authentication Plugin
 * Verifies JWT from httpOnly cookie and decorates request with user
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import fp from 'fastify-plugin';
import { verifyAccess } from '@sd/shared/jwt.js';
import { prisma } from '../db/prisma.js';
import type { User, UserRole } from '@sd/shared/index.js';

/**
 * User object attached to the request
 */
declare module 'fastify' {
  interface FastifyRequest {
    user: {
      id: string;
      email: string;
      name: string;
      role: UserRole;
    } | null;
  }
}

/**
 * Authentication plugin options
 */
interface AuthPluginOptions {
  /** Whether to require authentication (default: true) */
  requireAuth?: boolean;
}

/**
 * Fastify plugin that verifies JWT from cookie
 * Decorates request with user object
 */
async function authPlugin(
  fastify: FastifyInstance,
  options: AuthPluginOptions
): Promise<void> {
  const requireAuth = options.requireAuth ?? true;

  // Decorate request with user property
  fastify.decorateRequest('user', null);

  // Add preHandler hook to verify JWT
  fastify.addHook('preHandler', async (request: FastifyRequest, reply: FastifyReply) => {
    // Skip if authentication is not required
    if (!requireAuth) {
      return;
    }

    // Get token from cookie or Authorization header
    let token = request.cookies.accessToken;

    // Also check Authorization header as fallback
    if (!token) {
      const authHeader = request.headers.authorization;
      if (authHeader?.startsWith('Bearer ')) {
        token = authHeader.substring(7);
      }
    }

    // No token provided
    if (!token) {
      return reply.status(401).send({
        error: 'Unauthorized',
        message: 'No access token provided',
      });
    }

    // Verify token
    let payload;
    try {
      payload = verifyAccess(token);
    } catch (error) {
      return reply.status(401).send({
        error: 'Unauthorized',
        message: 'Invalid or expired access token',
      });
    }

    // Fetch user from database
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
      },
    });

    if (!user) {
      return reply.status(401).send({
        error: 'Unauthorized',
        message: 'User not found',
      });
    }

    // Attach user to request
    request.user = user as User;
  });
}

// Wrap with fastify-plugin to work with Fastify
const authPluginExport = fp(authPlugin, {
  name: 'auth-plugin',
});

export default authPluginExport;
export { authPlugin, type AuthPluginOptions };