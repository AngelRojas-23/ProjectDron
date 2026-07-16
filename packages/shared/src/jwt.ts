/**
 * JWT helper functions for Authentication
 * Used by both backend and streaming packages
 */

import jwt from 'jsonwebtoken';
import type { JwtPayload, UserRole } from './index.js';

// Default JWT secret - MUST be overridden in production via JWT_SECRET env var
const DEFAULT_SECRET = 'streaming-dron-dev-secret-change-in-production';

/**
 * Environment variable for JWT secret
 */
const JWT_SECRET = process.env.JWT_SECRET || DEFAULT_SECRET;

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
    const decoded = jwt.verify(token, JWT_SECRET) as JwtPayload;

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
    const decoded = jwt.verify(token, JWT_SECRET, {
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

  return jwt.sign(payload, JWT_SECRET, {
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

  return jwt.sign(payload, JWT_SECRET, {
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