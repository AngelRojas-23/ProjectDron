/**
 * Admin routes for user management
 * Only accessible by users with 'operator' role
 */
import type { FastifyInstance } from 'fastify';
import type { FastifyPluginAsync } from 'fastify';
import { prisma } from '../db/prisma.js';
import { verifyAccess } from '@sd/shared/jwt.js';
import type { JwtPayload } from '@sd/shared/index.js';

// Extend Fastify request to include user
declare module 'fastify' {
  interface FastifyRequest {
    authUser?: JwtPayload;
  }
}

/**
 * JWT auth middleware for admin routes
 */
async function requireOperator(request: any, reply: any) {
  const authHeader = request.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return reply.status(401).send({ error: 'Unauthorized', message: 'Missing token' });
  }

  try {
    const token = authHeader.slice(7);
    const payload = verifyAccess(token);
    if (payload.role !== 'operator') {
      return reply.status(403).send({ error: 'Forbidden', message: 'Admin access required' });
    }
    request.authUser = payload;
  } catch {
    return reply.status(401).send({ error: 'Unauthorized', message: 'Invalid token' });
  }
}

/**
 * Admin route plugin
 */
const adminRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  // All admin routes require operator role
  fastify.addHook('onRequest', requireOperator);

  /**
   * GET /admin/users
   * List all users (without passwords)
   */
  fastify.get('/users', async (_request, reply) => {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        createdAt: true,
        updatedAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return reply.status(200).send({ users });
  });

  /**
   * PUT /admin/users/:id/role
   * Change a user's role
   */
  fastify.put<{ Params: { id: string }; Body: { role: 'operator' | 'viewer' } }>(
    '/users/:id/role',
    async (request, reply) => {
      const { id } = request.params;
      const { role } = request.body;

      if (!role || !['operator', 'viewer'].includes(role)) {
        return reply.status(400).send({ error: 'Invalid role' });
      }

      const user = await prisma.user.findUnique({ where: { id } });
      if (!user) {
        return reply.status(404).send({ error: 'User not found' });
      }

      const updated = await prisma.user.update({
        where: { id },
        data: { role },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      return reply.status(200).send({ user: updated });
    }
  );

  /**
   * DELETE /admin/users/:id
   * Delete a user (cannot delete yourself)
   */
  fastify.delete<{ Params: { id: string } }>(
    '/users/:id',
    async (request, reply) => {
      const { id } = request.params;

      // Cannot delete yourself
      if (request.authUser?.userId === id) {
        return reply.status(400).send({ error: 'Cannot delete your own account' });
      }

      const user = await prisma.user.findUnique({ where: { id } });
      if (!user) {
        return reply.status(404).send({ error: 'User not found' });
      }

      await prisma.user.delete({ where: { id } });

      return reply.status(200).send({ message: 'User deleted' });
    }
  );
};

export default adminRoutes;
