import { getStatusColor } from '../utils/formatters';

const StatusIndicator = ({ status }) => {
  // Check if dark mode is enabled
  const isDarkMode = document.body.classList.contains('dark-mode');

  // Get base color
  const baseColor = getStatusColor(status);

  // Use brighter colors in dark mode
  let color = baseColor;
  if (isDarkMode) {
    if (baseColor === '#22c55e') {
      color = '#4ade80'; // Brighter green for dark mode
    } else if (baseColor === '#ef4444') {
      color = '#f87171'; // Brighter red for dark mode
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
          boxShadow: isDarkMode ? `0 0 6px ${color}` : 'none',
        }}
      />
      <span style={{ textTransform: 'capitalize' }}>{status}</span>
    </div>
  );
};

export default StatusIndicator;
