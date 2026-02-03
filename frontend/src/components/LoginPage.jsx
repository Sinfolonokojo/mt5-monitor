import { useState } from 'react';

function LoginPage({ onLogin, loading, error }) {
  const [password, setPassword] = useState('');
  const [localError, setLocalError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLocalError('');

    if (!password.trim()) {
      setLocalError('Please enter a password');
      return;
    }

    const result = await onLogin(password);
    if (!result.success) {
      setLocalError(result.message || 'Login failed');
    }
  };

  const displayError = localError || error;

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <h1 style={styles.title}>MT5 Monitor</h1>

        <form onSubmit={handleSubmit} style={styles.form}>
          <div style={styles.inputGroup}>
            <label htmlFor="password" style={styles.label}>Password</label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={styles.input}
              placeholder="Enter password"
              autoFocus
              disabled={loading}
            />
          </div>

          <button
            type="submit"
            style={{
              ...styles.button,
              opacity: loading ? 0.7 : 1,
              cursor: loading ? 'not-allowed' : 'pointer'
            }}
            disabled={loading}
          >
            {loading ? 'Logging in...' : 'Login'}
          </button>

          {displayError && (
            <p style={styles.error}>{displayError}</p>
          )}
        </form>
      </div>
    </div>
  );
}

const styles = {
  container: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f3f4f6',
    padding: '20px',
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: '8px',
    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
    padding: '40px',
    width: '100%',
    maxWidth: '400px',
  },
  title: {
    fontSize: '24px',
    fontWeight: '600',
    color: '#111827',
    textAlign: 'center',
    marginBottom: '32px',
    fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '24px',
  },
  inputGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
  },
  label: {
    fontSize: '14px',
    fontWeight: '500',
    color: '#374151',
    fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
  },
  input: {
    padding: '12px 16px',
    fontSize: '16px',
    border: '1px solid #d1d5db',
    borderRadius: '6px',
    outline: 'none',
    transition: 'border-color 0.2s, box-shadow 0.2s',
    fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
  },
  button: {
    padding: '12px 24px',
    fontSize: '16px',
    fontWeight: '500',
    color: '#ffffff',
    backgroundColor: '#3b82f6',
    border: 'none',
    borderRadius: '6px',
    cursor: 'pointer',
    transition: 'background-color 0.2s',
    fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
  },
  error: {
    color: '#dc2626',
    fontSize: '14px',
    textAlign: 'center',
    margin: '0',
    fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
  },
};

export default LoginPage;
