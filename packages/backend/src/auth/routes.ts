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
            password: { type: 'string', minLength: 6 },
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

      // Check if user already exists
      const existingUser = await prisma.user.findUnique({
        where: { email },
      });

      if (existingUser) {
        return reply.status(409).send({
          error: 'Conflict',
          message: 'User with this email already exists',
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

      // Generate new tokens (rotation)
      const tokens = generateTokens(user.id, user.role);

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
};

export default authRoutes;