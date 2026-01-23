const StatusIndicator = ({ status }) => {
  // White for connected, black for disconnected
  const color = status === 'connected' ? '#ffffff' : '#000000';
  const isDarkMode = document.body.classList.contains('dark-mode');

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
      <div
        style={{
          width: '10px',
          height: '10px',
          borderRadius: '50%',
          backgroundColor: color,
          boxShadow: isDarkMode ? `0 0 10px ${color}` : 'none',
          border: '1px solid #6b7280',
        }}
      />
      <span style={{ textTransform: 'capitalize' }}>{status}</span>
    </div>
  );
};

export default StatusIndicator;
