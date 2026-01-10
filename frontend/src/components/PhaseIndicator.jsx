import { getPhaseColor } from '../utils/formatters';

const PhaseIndicator = ({ phase }) => {
  const color = getPhaseColor(phase);

  return (
    <span
      style={{
        backgroundColor: color,
        color: 'white',
        padding: '4px 12px',
        borderRadius: '4px',
        fontWeight: 'bold',
        fontSize: '14px',
        display: 'inline-block',
      }}
    >
      {phase}
    </span>
  );
};

export default PhaseIndicator;
