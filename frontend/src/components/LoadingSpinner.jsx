const LoadingSpinner = () => {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        padding: '60px 40px',
        minHeight: '300px',
      }}
    >
      {/* Spinner Container */}
      <div style={{ position: 'relative', marginBottom: '24px' }}>
        {/* Outer ring */}
        <div
          style={{
            border: '4px solid #e5e7eb',
            borderTop: '4px solid #3b82f6',
            borderRadius: '50%',
            width: '60px',
            height: '60px',
            animation: 'spin 1s linear infinite',
          }}
        />
        {/* Inner pulsing circle */}
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: '30px',
            height: '30px',
            borderRadius: '50%',
            backgroundColor: '#3b82f6',
            opacity: 0.3,
            animation: 'pulse 1.5s ease-in-out infinite',
          }}
        />
      </div>

      {/* Loading Text */}
      <div
        style={{
          fontSize: '16px',
          fontWeight: '600',
          color: '#1f2937',
          marginBottom: '8px',
          animation: 'fadeInOut 2s ease-in-out infinite',
        }}
      >
        Cargando Datos de Cuentas
      </div>

      {/* Subtitle */}
      <div
        style={{
          fontSize: '14px',
          color: '#6b7280',
        }}
      >
        Por favor espera mientras obtenemos la información más reciente...
      </div>

      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }

        @keyframes pulse {
          0%, 100% {
            transform: translate(-50%, -50%) scale(0.8);
            opacity: 0.3;
          }
          50% {
            transform: translate(-50%, -50%) scale(1.2);
            opacity: 0.1;
          }
        }

        @keyframes fadeInOut {
          0%, 100% { opacity: 0.6; }
          50% { opacity: 1; }
        }
      `}</style>
    </div>
  );
};

export default LoadingSpinner;
