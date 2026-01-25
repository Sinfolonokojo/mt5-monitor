const StatusIndicator = ({ status }) => {
  const isDarkMode = document.body.classList.contains('dark-mode');
  // Dark mode: white/black, Light mode: green/red
  const color = isDarkMode
    ? (status === 'connected' ? '#ffffff' : '#000000')
    : (status === 'connected' ? '#22c55e' : '#ef4444');

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
      <div
        style={{
          width: '10px',
          height: '10px',
          borderRadius: '50%',
          backgroundColor: color,
          boxShadow: isDarkMode
            ? `0 0 10px ${color}`
            : (status === 'connected' ? '0 2px 4px rgba(34, 197, 94, 0.4)' : '0 2px 4px rgba(239, 68, 68, 0.4)'),
        }}
      />
      <span style={{ textTransform: 'capitalize' }}>{status}</span>
    </div>
  );
};

export default StatusIndicator;
