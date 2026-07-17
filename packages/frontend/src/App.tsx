/**
 * Main App component with routing
 * Handles protected routes and navigation
 * Uses lazy loading for non-critical pages
 */
import { lazy, Suspense, useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store/auth';
import { useThemeStore, theme } from './store/theme';
import Login from './pages/Login';

/**
 * Lazy-loaded pages (only load when navigated to)
 * Dashboard is ~752KB with Leaflet, Flights and Admin are separate chunks
 */
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Flights = lazy(() => import('./pages/Flights'));
const Admin = lazy(() => import('./pages/Admin'));

/**
 * Loading fallback shown while a lazy page loads
 */
function PageLoader() {
  return (
    <div style={{
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      height: '100vh',
      color: '#6b7280',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      fontSize: '0.9rem',
    }}>
      Loading...
    </div>
  );
}

/**
 * Protected route wrapper
 * Redirects to /login if user is not authenticated
 */
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);

  if (!isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}

export default function App() {
  const mode = useThemeStore((state) => state.mode);

  // Update body background and text color when theme changes
  useEffect(() => {
    const t = theme[mode];
    document.body.style.backgroundColor = t.bg;
    document.body.style.color = t.text;
  }, [mode]);

  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        {/* Public route - login page (eager loaded) */}
        <Route path="/" element={<Login />} />

        {/* Protected route - dashboard */}
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          }
        />

        {/* Protected route - flight history */}
        <Route
          path="/flights"
          element={
            <ProtectedRoute>
              <Flights />
            </ProtectedRoute>
          }
        />

        {/* Protected route - admin panel (operator only) */}
        <Route
          path="/admin"
          element={
            <ProtectedRoute>
              <Admin />
            </ProtectedRoute>
          }
        />

        {/* Catch-all redirect to login */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}