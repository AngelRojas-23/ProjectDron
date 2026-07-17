/**
 * Zustand store for authentication state
 * Uses cookie-based auth (tokens stored in httpOnly cookies)
 * Only stores user info in memory
 */
import { create } from 'zustand';

// User type from shared (without timestamps)
interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: 'operator' | 'viewer';
}

/**
 * Auth store state and actions
 * No persist - tokens are in httpOnly cookies
 */
interface AuthState {
  // State
  user: AuthUser | null;
  isAuthenticated: boolean;

  // Actions
  login: (user: AuthUser) => void;
  logout: () => void;
}

/**
 * Create the auth store without persist
 * User info is set after successful cookie-based login
 */
export const useAuthStore = create<AuthState>()((set) => ({
  // Initial state
  user: null,
  isAuthenticated: false,

  // Login action - sets user only (tokens are in httpOnly cookies)
  login: (user) => set({
    user,
    isAuthenticated: true,
  }),

  // Logout action - clears all auth state
  logout: () => set({
    user: null,
    isAuthenticated: false,
  }),
}));