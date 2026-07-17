/**
 * JWT helper function tests
 * Tests verifyAccess with valid, expired, and invalid tokens
 */
import { describe, it, expect, beforeAll } from 'vitest';
import jwt from 'jsonwebtoken';

const TEST_SECRET = 'streaming-dron-test-secret-32-chars!!';

describe('JWT Helper', () => {
  beforeAll(() => {
    // Set test secret - the jwt module is re-evaluated in each test file run
    process.env.JWT_SECRET = TEST_SECRET;
  });

  it('should verify a valid access token', async () => {
    // Import dynamically to pick up the env set in beforeAll
    const { validateJwtSecret, verifyAccess, generateAccessToken } = await import('../jwt.js');
    validateJwtSecret();

    const token = generateAccessToken('user-123', 'operator');
    const payload = verifyAccess(token);

    expect(payload.userId).toBe('user-123');
    expect(payload.role).toBe('operator');
  });

  it('should throw error for an expired token', async () => {
    const { validateJwtSecret, verifyAccess } = await import('../jwt.js');
    validateJwtSecret();

    // Create a token that's already expired using the same secret
    const expiredToken = jwt.sign(
      { userId: 'user-123', role: 'operator' },
      TEST_SECRET,
      { expiresIn: '-1s' } // expired 1 second ago
    );

    expect(() => verifyAccess(expiredToken)).toThrow('Access token has expired');
  });

  it('should throw error for an invalid token', async () => {
    const { validateJwtSecret, verifyAccess } = await import('../jwt.js');
    validateJwtSecret();

    const invalidToken = 'not-a-valid-jwt-token.at.all';

    expect(() => verifyAccess(invalidToken)).toThrow('Invalid access token');
  });

  it('should throw error for token with wrong secret', async () => {
    const { validateJwtSecret, verifyAccess } = await import('../jwt.js');
    validateJwtSecret();

    const token = jwt.sign(
      { userId: 'user-123', role: 'operator' },
      'wrong-secret'
    );

    expect(() => verifyAccess(token)).toThrow('Invalid access token');
  });
});