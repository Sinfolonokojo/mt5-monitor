import { getStatusColor } from '../utils/formatters';

const StatusIndicator = ({ status }) => {
  const color = getStatusColor(status);
  const isDarkMode = document.body.classList.contains('dark-mode');

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
      <div
        style={{
          width: '10px',
          height: '10px',
          borderRadius: '50%',
          backgroundColor: color,
          boxShadow: isDarkMode ? `0 0 8px ${color}` : 'none',
        }}
      />
      <span style={{ textTransform: 'capitalize' }}>{status}</span>
    </div>
  );
};

export default StatusIndicator;
