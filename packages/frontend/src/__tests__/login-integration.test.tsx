/**
 * Integration tests for the full auth flow
 * Tests login page rendering, form submission, and navigation
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { useAuthStore } from '../store/auth';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock useNavigate
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

// Mock theme store to avoid dependency
const mockThemeState = { mode: 'light' as const };
vi.mock('../store/theme', () => ({
  useThemeStore: (selector?: (state: { mode: 'light' | 'dark' }) => string) => {
    if (selector) return selector(mockThemeState);
    return mockThemeState;
  },
  theme: {
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
  },
}));

// Import after mocks
import Login from '../pages/Login';

describe('Login Page - Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset auth store
    useAuthStore.getState().logout();
  });

  it('should render the login form', () => {
    render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>
    );

    expect(screen.getByText('Streaming Dron')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /sign in/i })).toBeInTheDocument();
    expect(screen.getByLabelText('Email')).toBeInTheDocument();
    expect(screen.getByLabelText('Password')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
  });

  it('should show error on failed login', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: false,
      json: async () => ({ message: 'Invalid email or password' }),
    });

    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>
    );

    await user.type(screen.getByLabelText('Email'), 'test@example.com');
    await user.type(screen.getByLabelText('Password'), 'wrong');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => {
      expect(screen.getByText('Invalid email or password')).toBeInTheDocument();
    });
  });

  it('should navigate to dashboard on successful login', async () => {
    const mockUser = {
      id: 'user-123',
      email: 'test@example.com',
      name: 'Test User',
      role: 'operator',
    };

    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        accessToken: 'test-access-token',
        refreshToken: 'test-refresh-token',
        user: mockUser,
      }),
    });

    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>
    );

    await user.type(screen.getByLabelText('Email'), 'test@example.com');
    await user.type(screen.getByLabelText('Password'), 'Password123');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => {
      // Check auth store was updated
      const state = useAuthStore.getState();
      expect(state.isAuthenticated).toBe(true);
      expect(state.user?.email).toBe('test@example.com');
      expect(state.user?.role).toBe('operator');
      // Check navigation was called
      expect(mockNavigate).toHaveBeenCalledWith('/dashboard');
    });
  });

  it('should disable form inputs while loading', async () => {
    // Create a promise that never resolves to keep loading state
    mockFetch.mockReturnValueOnce(new Promise(() => {}));

    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>
    );

    await user.type(screen.getByLabelText('Email'), 'test@example.com');
    await user.type(screen.getByLabelText('Password'), 'Password123');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /signing in/i })).toBeDisabled();
      expect(screen.getByLabelText('Email')).toBeDisabled();
      expect(screen.getByLabelText('Password')).toBeDisabled();
    });
  });

  it('should show network error when fetch fails', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'));

    const user = userEvent.setup();

    render(
      <MemoryRouter>
        <Login />
      </MemoryRouter>
    );

    await user.type(screen.getByLabelText('Email'), 'test@example.com');
    await user.type(screen.getByLabelText('Password'), 'Password123');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => {
      expect(screen.getByText('Network error')).toBeInTheDocument();
    });
  });
});
