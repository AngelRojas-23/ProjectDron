/**
 * Authentication routes
 * Handles user registration and login with JWT token generation
 */

import type { FastifyInstance } from 'fastify';
import type { FastifyPluginAsync } from 'fastify';
import bcrypt from 'bcryptjs';
import { prisma } from '../db/prisma.js';
import { generateTokens, verifyRefresh } from '@sd/shared/jwt.js';
import type { RegisterPayload, LoginCredentials, AuthResponse, UserRole } from '@sd/shared/index.js';

const BCRYPT_ROUNDS = 10;

/**
 * Save a refresh token to the database for revocation support
 */
async function saveRefreshToken(userId: string, token: string): Promise<void> {
  // Refresh token expires in 7 days
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  await prisma.refreshToken.create({
    data: {
      token,
      userId,
      expiresAt,
    },
  });
}

/**
 * Check if a refresh token has been revoked
 */
async function isTokenRevoked(token: string): Promise<boolean> {
  const stored = await prisma.refreshToken.findUnique({
    where: { token },
    select: { revoked: true },
  });
  return stored?.revoked ?? true; // If not found, treat as revoked
}

/**
 * Revoke all refresh tokens for a user (used on logout or password change)
 */
async function revokeAllUserTokens(userId: string): Promise<void> {
  await prisma.refreshToken.updateMany({
    where: { userId, revoked: false },
    data: { revoked: true },
  });
}

/**
 * Validate password strength
 * Returns null if valid, or an error message if too weak
 */
function validatePassword(password: string): string | null {
  if (password.length < 8) {
    return 'Password must be at least 8 characters long';
  }
  if (!/[A-Z]/.test(password)) {
    return 'Password must contain at least one uppercase letter';
  }
  if (!/[a-z]/.test(password)) {
    return 'Password must contain at least one lowercase letter';
  }
  if (!/[0-9]/.test(password)) {
    return 'Password must contain at least one number';
  }
  return null;
}

/**
 * Authentication route plugin
 */
const authRoutes: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  /**
   * POST /auth/register
   * Register a new user
   * Returns 201 on success, 409 on duplicate email, 400 on invalid payload
   */
  fastify.post<{ Body: RegisterPayload }>(
    '/register',
    {
      schema: {
        body: {
          type: 'object',
          required: ['email', 'password', 'name'],
          properties: {
            email: { type: 'string', format: 'email' },
            password: { type: 'string', minLength: 8 },
            name: { type: 'string', minLength: 1 },
            role: { type: 'string', enum: ['operator', 'viewer'] },
          },
        },
      },
    },
    async (request, reply) => {
      const { email, password, name, role = 'viewer' } = request.body;

      // Validate payload
      if (!email || !password || !name) {
        return reply.status(400).send({
          error: 'Invalid payload',
          message: 'email, password, and name are required',
        });
      }

      // Validate password strength
      const passwordError = validatePassword(password);
      if (passwordError) {
        return reply.status(400).send({
          error: 'Weak password',
          message: passwordError,
        });
      }

      // Check if user already exists — use generic message to prevent email enumeration
      const existingUser = await prisma.user.findUnique({
        where: { email },
      });

      if (existingUser) {
        // Return generic error instead of revealing the email exists
        return reply.status(400).send({
          error: 'Registration failed',
          message: 'Could not register user. Please check your information and try again.',
        });
      }

      // Hash password
      const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

      // Create user
      const user = await prisma.user.create({
        data: {
          email,
          name,
          password: passwordHash,
          role: role as UserRole,
        },
      });

      // Generate tokens
      const tokens = generateTokens(user.id, user.role);

      // Save refresh token to database (for revocation support)
      await saveRefreshToken(user.id, tokens.refreshToken);

      // Return response (access token in httpOnly cookie)
      const response: AuthResponse = {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        },
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
      };

      // Set access token as httpOnly cookie
      reply.setCookie('accessToken', tokens.accessToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 15 * 60, // 15 minutes in seconds
        path: '/',
      });

      return reply.status(201).send(response);
    }
  );

  /**
   * POST /auth/login
   * Authenticate user and return tokens
   * Returns 200 with tokens, 401 on wrong password
   */
  fastify.post<{ Body: LoginCredentials }>(
    '/login',
    {
      schema: {
        body: {
          type: 'object',
          required: ['email', 'password'],
          properties: {
            email: { type: 'string', format: 'email' },
            password: { type: 'string' },
          },
        },
      },
    },
    async (request, reply) => {
      const { email, password } = request.body;

      // Find user
      const user = await prisma.user.findUnique({
        where: { email },
      });

      if (!user) {
        return reply.status(401).send({
          error: 'Unauthorized',
          message: 'Invalid email or password',
        });
      }

      // Verify password
      const validPassword = await bcrypt.compare(password, user.password);

      if (!validPassword) {
        return reply.status(401).send({
          error: 'Unauthorized',
          message: 'Invalid email or password',
        });
      }

      // Generate tokens
      const tokens = generateTokens(user.id, user.role);

      // Save refresh token to database (for revocation support)
      await saveRefreshToken(user.id, tokens.refreshToken);

      // Return response
      const response: AuthResponse = {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        },
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
      };

      // Set access token as httpOnly cookie
      reply.setCookie('accessToken', tokens.accessToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 15 * 60, // 15 minutes in seconds
        path: '/',
      });

      return reply.status(200).send(response);
    }
  );

  /**
   * POST /auth/refresh
   * Refresh access token using refresh token
   * Returns 200 with new tokens, 401 on invalid/expired refresh token
   */
  fastify.post<{ Body: { refreshToken: string } }>(
    '/refresh',
    {
      schema: {
        body: {
          type: 'object',
          required: ['refreshToken'],
          properties: {
            refreshToken: { type: 'string' },
          },
        },
      },
    },
    async (request, reply) => {
      const { refreshToken } = request.body;

      // Verify refresh token
      let payload;
      try {
        payload = verifyRefresh(refreshToken);
      } catch {
        return reply.status(401).send({
          error: 'Unauthorized',
          message: 'Invalid or expired refresh token',
        });
      }

      // Check if token has been revoked
      const revoked = await isTokenRevoked(refreshToken);
      if (revoked) {
        return reply.status(401).send({
          error: 'Unauthorized',
          message: 'Refresh token has been revoked',
        });
      }

      // Find user by ID
      const user = await prisma.user.findUnique({
        where: { id: payload.userId },
      });

      if (!user) {
        return reply.status(401).send({
          error: 'Unauthorized',
          message: 'User not found',
        });
      }

      // Revoke old refresh token (rotation)
      await prisma.refreshToken.update({
        where: { token: refreshToken },
        data: { revoked: true },
      });

      // Generate new tokens (rotation)
      const tokens = generateTokens(user.id, user.role);

      // Save new refresh token
      await saveRefreshToken(user.id, tokens.refreshToken);

      // Return response
      const response: AuthResponse = {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        },
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
      };

      // Set new access token as httpOnly cookie
      reply.setCookie('accessToken', tokens.accessToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 15 * 60, // 15 minutes in seconds
        path: '/',
      });

      return reply.status(200).send(response);
    }
  );

  /**
   * POST /auth/logout
   * Revoke all refresh tokens for the authenticated user
   * Requires a valid access token in the Authorization header
   */
  fastify.post('/logout', async (request, reply) => {
    // Get token from Authorization header
    const authHeader = request.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return reply.status(401).send({
        error: 'Unauthorized',
        message: 'Missing or invalid authorization header',
      });
    }

    try {
      const token = authHeader.slice(7);
      const { verifyAccess } = await import('@sd/shared/jwt.js');
      const payload = verifyAccess(token);

      // Revoke all tokens for this user
      await revokeAllUserTokens(payload.userId);

      // Clear the access token cookie
      reply.clearCookie('accessToken', { path: '/' });

      return reply.status(200).send({ message: 'Logged out successfully' });
    } catch {
      return reply.status(401).send({
        error: 'Unauthorized',
        message: 'Invalid or expired token',
      });
    }
  });
};

export default authRoutes;