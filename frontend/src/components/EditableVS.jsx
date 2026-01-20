import { useState } from 'react';

const EditableVS = ({ account, editMode, onUpdate, vsGroup }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [vsValue, setVsValue] = useState(account.vs_group || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Display value: use merged vsGroup (manual override or auto-calculated)
  const displayValue = vsGroup;
  const isManualOverride = account.vs_group ? true : false;

  if (!editMode) {
    return (
      <div
        style={{
          fontWeight: '600',
          color: displayValue ? (isManualOverride ? '#ef4444' : '#3b82f6') : '#9ca3af',
          fontSize: '14px'
        }}
        title={isManualOverride ? 'Manual override (red)' : 'Auto-calculated (blue)'}
      >
        {displayValue || '-'}
      </div>
    );
  }

  const handleSave = async () => {
    setLoading(true);
    setError(null);

    try {
      await onUpdate(account.account_number, vsValue);
      setIsEditing(false);
    } catch (err) {
      // Extract error message from backend
      const errorMessage = err.message || 'Failed to update VS';
      setError(errorMessage);
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    setVsValue(account.vs_group || ''); // Reset to manual override if exists
    setError(null);
    setIsEditing(false);
  };

  const handleClearOverride = async () => {
    setLoading(true);
    setError(null);

    try {
      await onUpdate(account.account_number, ''); // Empty string removes override
      setIsEditing(false);
    } catch (err) {
      setError('Failed to clear VS override');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  if (isEditing) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', minWidth: '150px' }}>
        <div style={{ fontSize: '11px', color: '#6b7280' }}>
          Current: <span style={{ fontWeight: 'bold', color: isManualOverride ? '#ef4444' : '#3b82f6' }}>
            {displayValue || 'none'}
          </span> {isManualOverride && '(manual)'}
        </div>

        <input
          type="text"
          value={vsValue}
          onChange={(e) => setVsValue(e.target.value)}
          placeholder="Enter VS override"
          style={{
            padding: '6px 8px',
            borderRadius: '4px',
            border: '1px solid #d1d5db',
            fontSize: '14px',
            width: '100%'
          }}
          disabled={loading}
        />

        {error && (
          <span style={{ color: '#ef4444', fontSize: '11px', whiteSpace: 'normal' }}>{error}</span>
        )}

        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
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
          {isManualOverride && (
            <button
              onClick={handleClearOverride}
              disabled={loading}
              style={{
                backgroundColor: '#f59e0b',
                color: 'white',
                padding: '4px 12px',
                borderRadius: '4px',
                border: 'none',
                cursor: loading ? 'not-allowed' : 'pointer',
                fontSize: '12px',
                fontWeight: '500',
              }}
            >
              Clear
            </button>
          )}
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
      title={isManualOverride ? 'Manual override (red) - Click to edit' : 'Auto-calculated (blue) - Click to edit'}
    >
      <div
        style={{
          fontWeight: '600',
          color: displayValue ? (isManualOverride ? '#ef4444' : '#3b82f6') : '#9ca3af',
          fontSize: '14px'
        }}
      >
        {displayValue || '-'}
      </div>
    </div>
  );
};

export default EditableVS;
