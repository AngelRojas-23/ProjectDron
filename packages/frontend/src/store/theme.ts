/**
 * Theme store for dark mode
 * Uses persist middleware to keep theme preference across page reloads
 * Checks prefers-color-scheme on init as default
 */
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

/**
 * Theme mode type
 */
export type ThemeMode = 'light' | 'dark';

/**
 * Theme colors interface
 */
export interface ThemeColors {
  bg: string;
  bgCard: string;
  bgHeader: string;
  text: string;
  textSecondary: string;
  border: string;
  inputBg: string;
  inputBorder: string;
  hover: string;
  shadow: string;
}

/**
 * Theme colors for both modes
 */
export const theme: Record<ThemeMode, ThemeColors> = {
  light: {
    bg: '#f5f5f5',
    bgCard: '#ffffff',
    bgHeader: '#ffffff',
    text: '#1a1a1a',
    textSecondary: '#6b7280',
    border: '#e5e7eb',
    inputBg: '#ffffff',
    inputBorder: '#d1d5db',
    hover: '#f3f4f6',
    shadow: '0 1px 3px rgba(0,0,0,0.1)',
  },
  dark: {
    bg: '#0f172a',
    bgCard: '#1e293b',
    bgHeader: '#1e293b',
    text: '#f1f5f9',
    textSecondary: '#94a3b8',
    border: '#334155',
    inputBg: '#1e293b',
    inputBorder: '#475569',
    hover: '#334155',
    shadow: '0 1px 3px rgba(0,0,0,0.3)',
  },
};

/**
 * Theme store state and actions
 */
interface ThemeState {
  // State
  mode: ThemeMode;

  // Actions
  toggle: () => void;
  setMode: (mode: ThemeMode) => void;
}

/**
 * Get initial theme mode
 * Checks localStorage first, then prefers-color-scheme
 */
function getInitialMode(): ThemeMode {
  // Check if window is defined (client-side)
  if (typeof window === 'undefined') {
    return 'light';
  }

  // Check prefers-color-scheme as fallback
  if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
    return 'dark';
  }

  return 'light';
}

/**
 * Create the theme store with persist middleware
 */
export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      // Initial state - will be overwritten by persist, but used as fallback
      mode: getInitialMode(),

      // Toggle action - switches between light and dark
      toggle: () => set((state) => ({
        mode: state.mode === 'light' ? 'dark' : 'light',
      })),

      // SetMode action - explicitly sets a mode
      setMode: (mode: ThemeMode) => set({ mode }),
    }),
    {
      name: 'theme-storage', // unique name for localStorage key
      storage: createJSONStorage(() => localStorage),
    }
  )
);