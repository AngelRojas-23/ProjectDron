/**
 * Login page component
 * Displays a form for user authentication
 */
import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/auth';
import { useThemeStore, theme as themeColors, type ThemeColors } from '../store/theme';

/**
 * Backend API URL for authentication
 */
const API_URL = 'http://localhost:3001';

export default function Login() {
  const navigate = useNavigate();
  const login = useAuthStore((state) => state.login);
  const mode = useThemeStore((state) => state.mode);
  const t = themeColors[mode];

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const response = await fetch(`${API_URL}/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
        // Include credentials (cookies) in the request
        credentials: 'include',
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Login failed');
      }

      const data = await response.json();

      // Store auth data in Zustand store (persisted to localStorage)
      login(data.accessToken, data.refreshToken, data.user);

      // Navigate to dashboard on success
      navigate('/dashboard');
    } catch (err) {
      // Show error message on failure
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const styles = getStyles(t);

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <h1 style={styles.title}>Streaming Dron</h1>
        <h2 style={styles.subtitle}>Sign In</h2>

        <form onSubmit={handleSubmit} style={styles.form}>
          <div style={styles.field}>
            <label htmlFor="email" style={styles.label}>Email</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              style={styles.input}
              disabled={loading}
            />
          </div>

          <div style={styles.field}>
            <label htmlFor="password" style={styles.label}>Password</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              style={styles.input}
              disabled={loading}
            />
          </div>

          {error && <div style={styles.error}>{error}</div>}

          <button
            type="submit"
            style={styles.button}
            disabled={loading}
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </form>
      </div>
    </div>
  );
}

// Dynamic styles based on theme
const getStyles = (t: ThemeColors): Record<string, React.CSSProperties> => ({
  container: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: t.bg,
    fontFamily: 'system-ui, -apple-system, sans-serif',
  },
  card: {
    backgroundColor: t.bgCard,
    padding: '2rem',
    borderRadius: '8px',
    boxShadow: t.shadow,
    width: '100%',
    maxWidth: '400px',
  },
  title: {
    margin: 0,
    color: t.text,
    fontSize: '1.5rem',
    textAlign: 'center',
  },
  subtitle: {
    margin: '0.5rem 0 1.5rem',
    color: t.textSecondary,
    fontSize: '1rem',
    fontWeight: 'normal',
    textAlign: 'center',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '1rem',
  },
  field: {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.25rem',
  },
  label: {
    fontSize: '0.875rem',
    fontWeight: '500',
    color: t.text,
  },
  input: {
    padding: '0.625rem',
    border: `1px solid ${t.inputBorder}`,
    borderRadius: '4px',
    fontSize: '1rem',
    outline: 'none',
    backgroundColor: t.inputBg,
    color: t.text,
  },
  button: {
    padding: '0.75rem',
    backgroundColor: '#2563eb',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    fontSize: '1rem',
    fontWeight: '500',
    cursor: 'pointer',
    transition: 'background-color 0.2s',
  },
  error: {
    padding: '0.75rem',
    backgroundColor: '#fee2e2',
    color: '#dc2626',
    borderRadius: '4px',
    fontSize: '0.875rem',
  },
});