import { useState } from 'react';
import PhaseIndicator from './PhaseIndicator';

const COMMON_PHASES = ['F1', 'F2', 'R', 'Q'];

const EditablePhase = ({ account, editMode, onUpdate }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [selectedPhase, setSelectedPhase] = useState(account.phase);
  const [customPhase, setCustomPhase] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  if (!editMode) {
    return <PhaseIndicator phase={account.phase} />;
  }

  const handleSave = async () => {
    if (!selectedPhase.trim()) {
      setError('Phase value cannot be empty');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await onUpdate(account.account_number, selectedPhase);
      setIsEditing(false);
    } catch (err) {
      setError('Failed to update phase');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    setSelectedPhase(account.phase);
    setCustomPhase('');
    setError(null);
    setIsEditing(false);
  };

  if (isEditing) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <select
          value={selectedPhase}
          onChange={(e) => setSelectedPhase(e.target.value)}
          style={{
            padding: '6px 8px',
            borderRadius: '4px',
            border: '1px solid #d1d5db',
            fontSize: '14px',
          }}
          disabled={loading}
        >
          {COMMON_PHASES.map((phase) => (
            <option key={phase} value={phase}>
              {phase}
            </option>
          ))}
        </select>

        {error && (
          <span style={{ color: '#ef4444', fontSize: '12px' }}>{error}</span>
        )}

        <div style={{ display: 'flex', gap: '4px' }}>
          <button
            onClick={handleSave}
            disabled={loading}
            style={{
              backgroundColor: '#22c55e',
              color: 'white',
              padding: '4px 12px',
              borderRadius: '4px',
              border: 'none',
              cursor: loading ? 'not-allowed' : 'pointer',
              fontSize: '12px',
              fontWeight: '500',
            }}
          >
            {loading ? 'Saving...' : 'Save'}
          </button>
          <button
            onClick={handleCancel}
            disabled={loading}
            style={{
              backgroundColor: '#6b7280',
              color: 'white',
              padding: '4px 12px',
              borderRadius: '4px',
              border: 'none',
              cursor: loading ? 'not-allowed' : 'pointer',
              fontSize: '12px',
              fontWeight: '500',
            }}
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      onClick={() => setIsEditing(true)}
      style={{
        cursor: 'pointer',
        display: 'inline-block',
      }}
      title="Click to edit"
    >
      <PhaseIndicator phase={account.phase} />
    </div>
  );
};

export default EditablePhase;
