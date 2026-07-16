/**
 * Zustand store for authentication state
 * Uses persist middleware to keep auth across page reloads
 */
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

// User type from shared (without timestamps)
interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: 'operator' | 'viewer';
}

/**
 * Auth store state and actions
 */
interface AuthState {
  // State
  accessToken: string | null;
  refreshToken: string | null;
  user: AuthUser | null;
  isAuthenticated: boolean;

  // Actions
  login: (accessToken: string, refreshToken: string, user: AuthUser) => void;
  logout: () => void;
}

/**
 * Create the auth store with persist middleware
 * Tokens and user are stored in localStorage
 */
export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      // Initial state
      accessToken: null,
      refreshToken: null,
      user: null,
      isAuthenticated: false,

      // Login action - sets tokens and user
      login: (accessToken, refreshToken, user) => set({
        accessToken,
        refreshToken,
        user,
        isAuthenticated: true,
      }),

      // Logout action - clears all auth state
      logout: () => set({
        accessToken: null,
        refreshToken: null,
        user: null,
        isAuthenticated: false,
      }),
    }),
    {
      name: 'auth-storage', // unique name for localStorage key
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        user: state.user,
      }),
    }
  )
);