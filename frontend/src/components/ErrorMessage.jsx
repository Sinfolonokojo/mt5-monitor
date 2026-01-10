const ErrorMessage = ({ message, onRetry }) => {
  return (
    <div
      style={{
        backgroundColor: '#fee2e2',
        border: '1px solid #ef4444',
        borderRadius: '8px',
        padding: '16px',
        margin: '20px 0',
        textAlign: 'center',
      }}
    >
      <p style={{ color: '#b91c1c', marginBottom: '12px', fontWeight: '500' }}>
        Error: {message}
      </p>
      {onRetry && (
        <button
          onClick={onRetry}
          style={{
            backgroundColor: '#ef4444',
            color: 'white',
            padding: '8px 16px',
            borderRadius: '4px',
            border: 'none',
            cursor: 'pointer',
            fontWeight: '500',
          }}
        >
          Retry
        </button>
      )}
    </div>
  );
};

export default ErrorMessage;
