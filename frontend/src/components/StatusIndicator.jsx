import { getStatusColor } from '../utils/formatters';

const StatusIndicator = ({ status }) => {
  const isDarkMode = document.body.classList.contains('dark-mode');
  const baseColor = getStatusColor(status);

  // Use much brighter colors in dark mode for visibility
  let color = baseColor;
  if (isDarkMode) {
    if (baseColor === '#22c55e') {
      color = '#10b981'; // Bright emerald green
    } else if (baseColor === '#ef4444') {
      color = '#f87171'; // Bright red
    }
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
      <div
        style={{
          width: '10px',
          height: '10px',
          borderRadius: '50%',
          backgroundColor: color,
          boxShadow: isDarkMode ? `0 0 10px ${color}` : 'none',
        }}
      />
      <span style={{ textTransform: 'capitalize' }}>{status}</span>
    </div>
  );
};

export default StatusIndicator;
