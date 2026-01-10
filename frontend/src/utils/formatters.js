export const formatCurrency = (value) => {
  const absValue = Math.abs(value);
  const formatted = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(absValue);

  return value < 0 ? `-${formatted}` : formatted;
};

export const formatDate = (dateString) => {
  const date = new Date(dateString);
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
};

export const getPhaseColor = (phase) => {
  const phaseUpper = String(phase).toUpperCase();

  if (phaseUpper === 'WIN') return '#22c55e'; // green
  if (phaseUpper === 'VS') return '#eab308'; // yellow
  if (phaseUpper === 'F1') return '#3b82f6'; // blue

  // For numbered phases (1, 2, 3, etc.)
  return '#8b5cf6'; // purple
};

export const getStatusColor = (status) => {
  return status === 'connected' ? '#22c55e' : '#ef4444';
};
