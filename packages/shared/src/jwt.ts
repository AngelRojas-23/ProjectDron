/**
 * JWT helper functions for Authentication
 * Used by both backend and streaming packages
 */

import jwt from 'jsonwebtoken';
import type { JwtPayload, UserRole } from './index.js';

/**
 * JWT secret from environment variable
 * CRITICAL: Must be set in production. Server will not start without it.
 */
let _jwtSecret: string | undefined;

/**
 * Validate that JWT_SECRET is configured
 * Call this at server startup to fail fast if secret is missing
 */
export function validateJwtSecret(): void {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error(
      'JWT_SECRET environment variable is required and must be at least 32 characters. ' +
      'Generate one with: openssl rand -hex 32'
    );
  }
  _jwtSecret = secret;
}

/**
 * Get the validated JWT secret
 * @throws Error if validateJwtSecret() was not called first
 */
function getJwtSecret(): string {
  if (!_jwtSecret) {
    throw new Error('JWT_SECRET not validated. Call validateJwtSecret() at server startup.');
  }
  return _jwtSecret;
}

/**
 * Access token expiration time (15 minutes)
 */
export const ACCESS_TOKEN_EXPIRY = '15m';

/**
 * Refresh token expiration time (7 days)
 */
export const REFRESH_TOKEN_EXPIRY = '7d';

/**
 * Verify an access token and extract its payload
 * @param token - The JWT access token to verify
 * @returns The decoded payload if valid
 * @throws Error if token is invalid or expired
 */
export function verifyAccess(token: string): JwtPayload {
  try {
    const decoded = jwt.verify(token, getJwtSecret()) as JwtPayload;

    // Validate required fields
    if (!decoded.userId || !decoded.role) {
      throw new Error('Invalid token payload: missing required fields');
    }

    return decoded;
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      throw new Error('Access token has expired');
    }
    if (error instanceof jwt.JsonWebTokenError) {
      throw new Error('Invalid access token');
    }
    throw error;
  }
}

/**
 * Verify a refresh token
 * @param token - The JWT refresh token to verify
 * @returns The decoded payload if valid
 * @throws Error if token is invalid or expired
 */
export function verifyRefresh(token: string): JwtPayload {
  try {
    const decoded = jwt.verify(token, getJwtSecret(), {
      // Refresh tokens use different algorithm for additional security
    }) as JwtPayload;

    if (!decoded.userId || !decoded.role) {
      throw new Error('Invalid token payload: missing required fields');
    }

    return decoded;
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      throw new Error('Refresh token has expired');
    }
    if (error instanceof jwt.JsonWebTokenError) {
      throw new Error('Invalid refresh token');
    }
    throw error;
  }
}

/**
 * Generate a new access token
 * @param userId - The user's ID
 * @param role - The user's role
 * @returns The generated access token
 */
export function generateAccessToken(userId: string, role: UserRole): string {
  const payload: JwtPayload = {
    userId,
    role,
  };

  return jwt.sign(payload, getJwtSecret(), {
    expiresIn: ACCESS_TOKEN_EXPIRY,
    algorithm: 'HS256',
  });
}

/**
 * Generate a new refresh token
 * @param userId - The user's ID
 * @param role - The user's role
 * @returns The generated refresh token
 */
export function generateRefreshToken(userId: string, role: UserRole): string {
  const payload: JwtPayload = {
    userId,
    role,
  };

  return jwt.sign(payload, getJwtSecret(), {
    expiresIn: REFRESH_TOKEN_EXPIRY,
    algorithm: 'HS256',
  });
}

/**
 * Generate both access and refresh tokens
 * @param userId - The user's ID
 * @param role - The user's role
 * @returns Object containing both tokens
 */
export function generateTokens(userId: string, role: UserRole): {
  accessToken: string;
  refreshToken: string;
} {
  return {
    accessToken: generateAccessToken(userId, role),
    refreshToken: generateRefreshToken(userId, role),
  };
}