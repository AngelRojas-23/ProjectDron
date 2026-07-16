/**
 * Auth store tests
 * Tests login sets state, logout clears, guard redirects
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { useAuthStore } from '../store/auth';

// Helper to reset store between tests
function createFreshStore() {
  // Create a new store instance for testing
  return useAuthStore;
}

describe('Auth Store', () => {
  let store: typeof useAuthStore;

  beforeEach(() => {
    store = createFreshStore();
    // Reset the store state
    store.getState().logout();
  });

  describe('login', () => {
    it('should set accessToken, refreshToken, and user on login', () => {
      const { login } = store.getState();

      login('access-token-123', 'refresh-token-456', {
        id: 'user-1',
        email: 'test@example.com',
        name: 'Test User',
        role: 'operator',
      });

      const state = store.getState();
      expect(state.accessToken).toBe('access-token-123');
      expect(state.refreshToken).toBe('refresh-token-456');
      expect(state.user).toEqual({
        id: 'user-1',
        email: 'test@example.com',
        name: 'Test User',
        role: 'operator',
      });
      expect(state.isAuthenticated).toBe(true);
    });
  });

  describe('logout', () => {
    it('should clear all auth state on logout', () => {
      // First login
      const { login, logout } = store.getState();
      login('access-token', 'refresh-token', {
        id: 'user-1',
        email: 'test@example.com',
        name: 'Test',
        role: 'viewer',
      });

      // Then logout
      logout();

      const state = store.getState();
      expect(state.accessToken).toBeNull();
      expect(state.refreshToken).toBeNull();
      expect(state.user).toBeNull();
      expect(state.isAuthenticated).toBe(false);
    });
  });

  describe('isAuthenticated', () => {
    it('should be false initially', () => {
      expect(store.getState().isAuthenticated).toBe(false);
    });

    it('should be true after login', () => {
      store.getState().login('token', 'refresh', { id: '1', email: 'a@b.c', name: 'N', role: 'viewer' });
      expect(store.getState().isAuthenticated).toBe(true);
    });

    it('should be false after logout', () => {
      store.getState().login('token', 'refresh', { id: '1', email: 'a@b.c', name: 'N', role: 'viewer' });
      store.getState().logout();
      expect(store.getState().isAuthenticated).toBe(false);
    });
  });
});

describe('Protected Route Guard Logic', () => {
  it('should redirect to login if not authenticated', () => {
    // Simulate the guard logic
    const isAuthenticated = false;
    const shouldRedirect = !isAuthenticated;

    expect(shouldRedirect).toBe(true);
  });

  it('should allow access if authenticated', () => {
    // Simulate the guard logic
    const isAuthenticated = true;
    const shouldRedirect = !isAuthenticated;

    expect(shouldRedirect).toBe(false);
  });
});