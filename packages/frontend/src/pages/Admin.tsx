/**
 * Admin page for user management
 * Only accessible by operators
 */
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/auth';

/**
 * User type from API
 */
interface AdminUser {
  id: string;
  email: string;
  name: string;
  role: 'operator' | 'viewer';
  createdAt: string;
  updatedAt: string;
}

/**
 * Format date for display
 */
function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('es-CL', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function Admin() {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const accessToken = useAuthStore((state) => state.accessToken);
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Redirect non-operators
  useEffect(() => {
    if (user?.role !== 'operator') {
      navigate('/dashboard');
    }
  }, [user, navigate]);

  // Fetch users
  useEffect(() => {
    if (!accessToken) return;

    const fetchUsers = async () => {
      try {
        setLoading(true);
        const response = await fetch('/admin/users', {
          headers: { Authorization: `Bearer ${accessToken}` },
        });

        if (!response.ok) {
          throw new Error('Failed to fetch users');
        }

        const data = await response.json();
        setUsers(data.users);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    };

    fetchUsers();
  }, [accessToken]);

  // Change user role
  const handleRoleChange = async (userId: string, newRole: 'operator' | 'viewer') => {
    if (!accessToken) return;

    try {
      const response = await fetch(`/admin/users/${userId}/role`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ role: newRole }),
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Failed to update role');
      }

      const data = await response.json();
      setUsers((prev) => prev.map((u) => (u.id === userId ? data.user : u)));
      setMessage({ type: 'success', text: 'Role updated successfully' });
    } catch (err) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Failed to update role' });
    }
  };

  // Delete user
  const handleDelete = async (userId: string, userName: string) => {
    if (!accessToken) return;
    if (!confirm(`Are you sure you want to delete user "${userName}"?`)) return;

    try {
      const response = await fetch(`/admin/users/${userId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${accessToken}` },
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error || 'Failed to delete user');
      }

      setUsers((prev) => prev.filter((u) => u.id !== userId));
      setMessage({ type: 'success', text: 'User deleted successfully' });
    } catch (err) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Failed to delete user' });
    }
  };

  if (loading) {
    return (
      <div style={styles.container}>
        <div style={styles.loading}>Loading users...</div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <header style={styles.header}>
        <div style={styles.headerLeft}>
          <h1 style={styles.title}>Admin Panel</h1>
        </div>
        <button onClick={() => navigate('/dashboard')} style={styles.backButton}>
          ← Dashboard
        </button>
      </header>

      <main style={styles.main}>
        {/* Message */}
        {message && (
          <div
            style={{
              ...styles.message,
              backgroundColor: message.type === 'success' ? '#dcfce7' : '#fee2e2',
              color: message.type === 'success' ? '#166534' : '#991b1b',
            }}
          >
            {message.text}
            <button onClick={() => setMessage(null)} style={styles.messageClose}>×</button>
          </div>
        )}

        {/* Error */}
        {error && (
          <div style={styles.error}>
            {error}
          </div>
        )}

        {/* Users table */}
        <div style={styles.card}>
          <h2 style={styles.sectionTitle}>Users ({users.length})</h2>

          <div style={styles.table}>
            <div style={styles.tableHeader}>
              <span style={styles.colName}>Name</span>
              <span style={styles.colEmail}>Email</span>
              <span style={styles.colRole}>Role</span>
              <span style={styles.colDate}>Created</span>
              <span style={styles.colActions}>Actions</span>
            </div>

            {users.map((u) => (
              <div key={u.id} style={styles.tableRow}>
                <span style={styles.colName}>{u.name}</span>
                <span style={styles.colEmail}>{u.email}</span>
                <span style={styles.colRole}>
                  <span
                    style={{
                      ...styles.roleBadge,
                      backgroundColor: u.role === 'operator' ? '#dbeafe' : '#f3f4f6',
                      color: u.role === 'operator' ? '#1d4ed8' : '#6b7280',
                    }}
                  >
                    {u.role}
                  </span>
                </span>
                <span style={styles.colDate}>{formatDate(u.createdAt)}</span>
                <span style={styles.colActions}>
                  <select
                    value={u.role}
                    onChange={(e) => handleRoleChange(u.id, e.target.value as 'operator' | 'viewer')}
                    style={styles.roleSelect}
                  >
                    <option value="viewer">Viewer</option>
                    <option value="operator">Operator</option>
                  </select>
                  <button
                    onClick={() => handleDelete(u.id, u.name)}
                    style={styles.deleteButton}
                    disabled={u.id === user?.id}
                    title={u.id === user?.id ? 'Cannot delete yourself' : 'Delete user'}
                  >
                    Delete
                  </button>
                </span>
              </div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    minHeight: '100vh',
    backgroundColor: '#f5f5f5',
    fontFamily: 'system-ui, -apple-system, sans-serif',
  },
  loading: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    height: '100vh',
    color: '#6b7280',
    fontSize: '1rem',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '1rem 2rem',
    backgroundColor: 'white',
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
  },
  headerLeft: {
    display: 'flex',
    alignItems: 'center',
    gap: '1rem',
  },
  title: {
    margin: 0,
    color: '#1a1a1a',
    fontSize: '1.5rem',
  },
  backButton: {
    padding: '0.5rem 1rem',
    backgroundColor: '#f3f4f6',
    color: '#374151',
    border: '1px solid #d1d5db',
    borderRadius: '6px',
    fontSize: '0.875rem',
    fontWeight: '500',
    cursor: 'pointer',
  },
  main: {
    padding: '2rem',
    maxWidth: '1000px',
    margin: '0 auto',
  },
  message: {
    padding: '0.75rem 1rem',
    borderRadius: '6px',
    marginBottom: '1rem',
    fontSize: '0.875rem',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  messageClose: {
    background: 'none',
    border: 'none',
    fontSize: '1.25rem',
    cursor: 'pointer',
    color: 'inherit',
    padding: '0 0.25rem',
  },
  error: {
    padding: '0.75rem 1rem',
    backgroundColor: '#fee2e2',
    color: '#991b1b',
    borderRadius: '6px',
    marginBottom: '1rem',
    fontSize: '0.875rem',
  },
  card: {
    backgroundColor: 'white',
    borderRadius: '8px',
    boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
    overflow: 'hidden',
  },
  sectionTitle: {
    margin: 0,
    padding: '1rem 1.5rem',
    color: '#1a1a1a',
    fontSize: '1.1rem',
    borderBottom: '1px solid #e5e7eb',
  },
  table: {
    display: 'flex',
    flexDirection: 'column',
  },
  tableHeader: {
    display: 'flex',
    padding: '0.75rem 1.5rem',
    backgroundColor: '#f9fafb',
    borderBottom: '1px solid #e5e7eb',
    fontSize: '0.8rem',
    fontWeight: '600',
    color: '#6b7280',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  tableRow: {
    display: 'flex',
    padding: '0.75rem 1.5rem',
    borderBottom: '1px solid #f3f4f6',
    alignItems: 'center',
    fontSize: '0.875rem',
  },
  colName: { flex: '1' },
  colEmail: { flex: '1.5', color: '#6b7280' },
  colRole: { flex: '0.5' },
  colDate: { flex: '1', color: '#6b7280', fontSize: '0.8rem' },
  colActions: {
    flex: '1',
    display: 'flex',
    gap: '0.5rem',
    justifyContent: 'flex-end',
  },
  roleBadge: {
    padding: '2px 8px',
    borderRadius: '9999px',
    fontSize: '0.75rem',
    fontWeight: '600',
  },
  roleSelect: {
    padding: '0.25rem 0.5rem',
    borderRadius: '4px',
    border: '1px solid #d1d5db',
    fontSize: '0.8rem',
    cursor: 'pointer',
  },
  deleteButton: {
    padding: '0.25rem 0.75rem',
    backgroundColor: '#fee2e2',
    color: '#dc2626',
    border: '1px solid #fecaca',
    borderRadius: '4px',
    fontSize: '0.8rem',
    cursor: 'pointer',
    fontWeight: '500',
  },
};
