import { useState } from 'react';

function LoginPage({ onLogin, loading, error }) {
  const [password, setPassword] = useState('');
  const [localError, setLocalError] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLocalError('');

    if (!password.trim()) {
      setLocalError('Por favor ingresa una contraseña');
      return;
    }

    const result = await onLogin(password);
    if (!result.success) {
      setLocalError(result.message || 'Error al iniciar sesión');
    }
  };

  const displayError = localError || error;

  return (
    <div style={styles.container}>
      {/* Background Grid Pattern */}
      <div style={styles.gridPattern} />

      {/* Login Card */}
      <div style={styles.card}>
        {/* Top Accent Line */}
        <div style={styles.accentLine} />

        <div style={styles.cardContent}>
          {/* Header */}
          <div style={styles.header}>
            <div style={styles.iconContainer}>
              <span style={styles.icon}>📊</span>
            </div>
            <h2 style={styles.title}>Acceso de Trader</h2>
            <p style={styles.subtitle}>Inicio de sesión seguro</p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} style={styles.form}>
            {/* Password Field */}
            <div style={styles.inputGroup}>
              <label htmlFor="password" style={styles.label}>
                Clave de Seguridad / Contraseña
              </label>
              <div style={styles.inputWrapper}>
                <span style={styles.inputIcon}>🔑</span>
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  style={styles.input}
                  placeholder="Ingresa tu contraseña"
                  autoFocus
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={styles.togglePassword}
                >
                  {showPassword ? '👁️' : '👁️‍🗨️'}
                </button>
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              style={{
                ...styles.button,
                opacity: loading ? 0.7 : 1,
                cursor: loading ? 'not-allowed' : 'pointer'
              }}
              disabled={loading}
            >
              <span style={styles.buttonIcon}>🔓</span>
              {loading ? 'Conectando...' : 'Conectar Terminal'}
            </button>

            {/* Error Message */}
            {displayError && (
              <div style={styles.error}>
                <span>⚠️</span> {displayError}
              </div>
            )}
          </form>

          {/* Secure Connection Indicator */}
          <div style={styles.secureIndicator}>
            <div style={styles.pulseDot}>
              <span style={styles.pulseOuter} />
              <span style={styles.pulseInner} />
            </div>
            <span style={styles.secureText}>Conexión Segura</span>
          </div>
        </div>

        {/* Footer Stats */}
        <div style={styles.cardFooter}>
          <div style={styles.footerStat}>
            <span>🖥️</span>
            <span>API: <span style={styles.statusOnline}>En línea</span></span>
          </div>
          <div style={styles.footerDivider} />
          <div style={styles.footerStat}>
            <span>🔒</span>
            <span>Auth: <span style={styles.statusOnline}>Listo</span></span>
          </div>
        </div>
      </div>

      {/* Copyright */}
      <p style={styles.copyright}>
        Sistemas de Trading Propietario - {new Date().getFullYear()}<br />
        Protegido con cifrado de extremo a extremo
      </p>
    </div>
  );
}

const styles = {
  container: {
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0d1117',
    padding: '20px',
    position: 'relative',
    overflow: 'hidden',
  },
  gridPattern: {
    position: 'absolute',
    inset: 0,
    backgroundImage: `
      linear-gradient(to right, #30363d 1px, transparent 1px),
      linear-gradient(to bottom, #30363d 1px, transparent 1px)
    `,
    backgroundSize: '40px 40px',
    opacity: 0.15,
    maskImage: 'radial-gradient(circle at center, black 40%, transparent 100%)',
    WebkitMaskImage: 'radial-gradient(circle at center, black 40%, transparent 100%)',
    pointerEvents: 'none',
  },
  card: {
    position: 'relative',
    width: '100%',
    maxWidth: '440px',
    backgroundColor: '#161b22',
    borderRadius: '12px',
    border: '1px solid #30363d',
    boxShadow: '0 20px 40px rgba(0, 0, 0, 0.4)',
    overflow: 'hidden',
  },
  accentLine: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '3px',
    background: 'linear-gradient(90deg, #5757ff, #58a6ff, #5757ff)',
    opacity: 0.8,
  },
  cardContent: {
    padding: '40px 32px',
  },
  header: {
    textAlign: 'center',
    marginBottom: '32px',
  },
  iconContainer: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '48px',
    height: '48px',
    borderRadius: '12px',
    backgroundColor: 'rgba(87, 87, 255, 0.1)',
    marginBottom: '16px',
  },
  icon: {
    fontSize: '24px',
  },
  title: {
    color: '#ffffff',
    fontSize: '24px',
    fontWeight: '700',
    margin: '0 0 8px 0',
    letterSpacing: '-0.02em',
  },
  subtitle: {
    color: '#8b949e',
    fontSize: '14px',
    margin: 0,
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
    fontSize: '11px',
    fontWeight: '500',
    color: '#8b949e',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  inputWrapper: {
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
  },
  inputIcon: {
    position: 'absolute',
    left: '14px',
    fontSize: '16px',
    pointerEvents: 'none',
    opacity: 0.6,
  },
  input: {
    width: '100%',
    padding: '14px 44px',
    fontSize: '14px',
    backgroundColor: '#0d1117',
    border: '1px solid #30363d',
    borderRadius: '8px',
    color: '#ffffff',
    fontFamily: "'JetBrains Mono', monospace",
    letterSpacing: '0.05em',
    outline: 'none',
    transition: 'border-color 0.2s, box-shadow 0.2s',
  },
  togglePassword: {
    position: 'absolute',
    right: '14px',
    background: 'none',
    border: 'none',
    fontSize: '16px',
    cursor: 'pointer',
    opacity: 0.6,
    transition: 'opacity 0.2s',
  },
  button: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    width: '100%',
    padding: '14px 24px',
    fontSize: '14px',
    fontWeight: '600',
    color: '#ffffff',
    backgroundColor: '#5757ff',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
    transition: 'background-color 0.2s, transform 0.1s',
    boxShadow: '0 0 20px rgba(87, 87, 255, 0.3)',
  },
  buttonIcon: {
    fontSize: '16px',
    opacity: 0.8,
  },
  error: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '12px 16px',
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    border: '1px solid rgba(239, 68, 68, 0.2)',
    borderRadius: '8px',
    color: '#f87171',
    fontSize: '13px',
  },
  secureIndicator: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    marginTop: '32px',
    padding: '8px 16px',
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    borderRadius: '9999px',
    border: '1px solid rgba(48, 54, 61, 0.5)',
    width: 'fit-content',
    margin: '32px auto 0',
  },
  pulseDot: {
    position: 'relative',
    width: '8px',
    height: '8px',
  },
  pulseOuter: {
    position: 'absolute',
    inset: 0,
    borderRadius: '50%',
    backgroundColor: '#10b981',
    animation: 'ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite',
    opacity: 0.75,
  },
  pulseInner: {
    position: 'absolute',
    inset: 0,
    borderRadius: '50%',
    backgroundColor: '#10b981',
    boxShadow: '0 0 8px rgba(16, 185, 129, 0.8)',
  },
  secureText: {
    fontSize: '11px',
    fontWeight: '500',
    color: '#10b981',
    textTransform: 'uppercase',
    letterSpacing: '0.05em',
  },
  cardFooter: {
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    gap: '16px',
    padding: '12px 24px',
    backgroundColor: 'rgba(13, 17, 23, 0.5)',
    borderTop: '1px solid #30363d',
  },
  footerStat: {
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    fontSize: '10px',
    color: '#8b949e',
    fontFamily: "'JetBrains Mono', monospace",
    textTransform: 'uppercase',
    letterSpacing: '0.02em',
  },
  footerDivider: {
    width: '1px',
    height: '12px',
    backgroundColor: '#30363d',
  },
  statusOnline: {
    color: '#10b981',
  },
  copyright: {
    marginTop: '32px',
    textAlign: 'center',
    fontSize: '11px',
    color: '#484f58',
    lineHeight: 1.6,
  },
};

// Add keyframes for ping animation
const styleSheet = document.createElement('style');
styleSheet.textContent = `
  @keyframes ping {
    75%, 100% {
      transform: scale(2);
      opacity: 0;
    }
  }
`;
document.head.appendChild(styleSheet);

export default LoginPage;
