import { useState, useEffect } from 'react';
import apiService from '../services/api';

const OpenPositionsModal = ({ account, onClose, onRefresh }) => {
  const [positions, setPositions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionLoading, setActionLoading] = useState({});
  const [editingPosition, setEditingPosition] = useState(null);
  const [editValues, setEditValues] = useState({ sl: '', tp: '' });

  useEffect(() => {
    if (account) {
      fetchPositions();
    }
  }, [account]);

  const fetchPositions = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await apiService.fetchOpenPositions(account.account_number);
      setPositions(data.positions || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleClosePosition = async (ticket) => {
    if (!window.confirm('Are you sure you want to close this position?')) {
      return;
    }

    try {
      setActionLoading(prev => ({ ...prev, [`close_${ticket}`]: true }));
      setError(null);

      const result = await apiService.closePosition(account.account_number, ticket);

      if (result.success) {
        await fetchPositions();
        if (onRefresh) {
          onRefresh();
        }
      } else {
        setError(result.message || 'Failed to close position');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setActionLoading(prev => ({ ...prev, [`close_${ticket}`]: false }));
    }
  };

  const handleStartEdit = (position) => {
    setEditingPosition(position.ticket);
    setEditValues({
      sl: position.sl || '',
      tp: position.tp || ''
    });
    setError(null);
  };

  const handleCancelEdit = () => {
    setEditingPosition(null);
    setEditValues({ sl: '', tp: '' });
    setError(null);
  };

  const handleSaveModify = async (ticket) => {
    try {
      setActionLoading(prev => ({ ...prev, [`modify_${ticket}`]: true }));
      setError(null);

      const result = await apiService.modifyPosition(
        account.account_number,
        ticket,
        editValues.sl !== '' ? parseFloat(editValues.sl) : null,
        editValues.tp !== '' ? parseFloat(editValues.tp) : null
      );

      if (result.success) {
        setEditingPosition(null);
        await fetchPositions();
        if (onRefresh) {
          onRefresh();
        }
      } else {
        setError(result.message || 'Failed to modify position');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setActionLoading(prev => ({ ...prev, [`modify_${ticket}`]: false }));
    }
  };

  if (!account) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 1000,
        padding: '20px',
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: 'white',
          borderRadius: '12px',
          maxWidth: '1200px',
          width: '100%',
          maxHeight: '90vh',
          overflow: 'hidden',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
          display: 'flex',
          flexDirection: 'column',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: '24px',
            borderBottom: '1px solid #e5e7eb',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '16px',
          }}
        >
          <div>
            <h2 style={{ margin: 0, fontSize: '24px', fontWeight: '700', color: '#111827' }}>
              Open Positions
            </h2>
            <p style={{ margin: '4px 0 0 0', fontSize: '16px', color: '#6b7280', fontWeight: '500' }}>
              {account.account_number} ({account.account_holder})
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '28px',
              cursor: 'pointer',
              color: '#6b7280',
              padding: '0',
              width: '32px',
              height: '32px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: '6px',
              transition: 'background-color 0.2s',
            }}
            onMouseEnter={(e) => e.target.style.backgroundColor = '#f3f4f6'}
            onMouseLeave={(e) => e.target.style.backgroundColor = 'transparent'}
          >
            ×
          </button>
        </div>

        {/* Error Message */}
        {error && (
          <div
            style={{
              margin: '16px 24px 0',
              padding: '12px',
              backgroundColor: '#fee2e2',
              border: '1px solid #fecaca',
              borderRadius: '6px',
              color: '#dc2626',
              fontSize: '14px',
            }}
          >
            {error}
          </div>
        )}

        {/* Content */}
        <div style={{ flex: 1, overflow: 'auto', padding: '24px' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#6b7280' }}>
              Loading positions...
            </div>
          ) : positions.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#6b7280' }}>
              No open positions
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid #e5e7eb' }}>
                    <th style={{ padding: '12px 8px', textAlign: 'left', fontWeight: '600', color: '#374151' }}>Ticket</th>
                    <th style={{ padding: '12px 8px', textAlign: 'left', fontWeight: '600', color: '#374151' }}>Symbol</th>
                    <th style={{ padding: '12px 8px', textAlign: 'left', fontWeight: '600', color: '#374151' }}>Type</th>
                    <th style={{ padding: '12px 8px', textAlign: 'right', fontWeight: '600', color: '#374151' }}>Volume</th>
                    <th style={{ padding: '12px 8px', textAlign: 'right', fontWeight: '600', color: '#374151' }}>Open Price</th>
                    <th style={{ padding: '12px 8px', textAlign: 'right', fontWeight: '600', color: '#374151' }}>Current</th>
                    <th style={{ padding: '12px 8px', textAlign: 'right', fontWeight: '600', color: '#374151' }}>SL</th>
                    <th style={{ padding: '12px 8px', textAlign: 'right', fontWeight: '600', color: '#374151' }}>TP</th>
                    <th style={{ padding: '12px 8px', textAlign: 'right', fontWeight: '600', color: '#374151' }}>Profit</th>
                    <th style={{ padding: '12px 8px', textAlign: 'center', fontWeight: '600', color: '#374151' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {positions.map((position) => (
                    <tr key={position.ticket} style={{ borderBottom: '1px solid #e5e7eb' }}>
                      <td style={{ padding: '12px 8px', color: '#6b7280' }}>{position.ticket}</td>
                      <td style={{ padding: '12px 8px', fontWeight: '500', color: '#111827' }}>{position.symbol}</td>
                      <td style={{ padding: '12px 8px' }}>
                        <span
                          style={{
                            padding: '4px 8px',
                            borderRadius: '4px',
                            fontSize: '12px',
                            fontWeight: '600',
                            backgroundColor: position.type === 'BUY' ? '#dbeafe' : '#fee2e2',
                            color: position.type === 'BUY' ? '#1e40af' : '#991b1b',
                          }}
                        >
                          {position.type}
                        </span>
                      </td>
                      <td style={{ padding: '12px 8px', textAlign: 'right', color: '#374151' }}>{position.volume}</td>
                      <td style={{ padding: '12px 8px', textAlign: 'right', color: '#374151' }}>{position.open_price.toFixed(5)}</td>
                      <td style={{ padding: '12px 8px', textAlign: 'right', color: '#374151' }}>{position.current_price.toFixed(5)}</td>
                      <td style={{ padding: '12px 8px', textAlign: 'right' }}>
                        {editingPosition === position.ticket ? (
                          <input
                            type="number"
                            step="0.00001"
                            value={editValues.sl}
                            onChange={(e) => setEditValues(prev => ({ ...prev, sl: e.target.value }))}
                            placeholder="SL"
                            style={{
                              width: '80px',
                              padding: '4px 6px',
                              border: '1px solid #d1d5db',
                              borderRadius: '4px',
                              fontSize: '13px',
                            }}
                          />
                        ) : (
                          <span style={{ color: '#6b7280' }}>{position.sl ? position.sl.toFixed(5) : '-'}</span>
                        )}
                      </td>
                      <td style={{ padding: '12px 8px', textAlign: 'right' }}>
                        {editingPosition === position.ticket ? (
                          <input
                            type="number"
                            step="0.00001"
                            value={editValues.tp}
                            onChange={(e) => setEditValues(prev => ({ ...prev, tp: e.target.value }))}
                            placeholder="TP"
                            style={{
                              width: '80px',
                              padding: '4px 6px',
                              border: '1px solid #d1d5db',
                              borderRadius: '4px',
                              fontSize: '13px',
                            }}
                          />
                        ) : (
                          <span style={{ color: '#6b7280' }}>{position.tp ? position.tp.toFixed(5) : '-'}</span>
                        )}
                      </td>
                      <td
                        style={{
                          padding: '12px 8px',
                          textAlign: 'right',
                          fontWeight: '600',
                          color: position.profit >= 0 ? '#22c55e' : '#ef4444',
                        }}
                      >
                        ${position.profit.toFixed(2)}
                      </td>
                      <td style={{ padding: '12px 8px', textAlign: 'center' }}>
                        {editingPosition === position.ticket ? (
                          <div style={{ display: 'flex', gap: '4px', justifyContent: 'center' }}>
                            <button
                              onClick={() => handleSaveModify(position.ticket)}
                              disabled={actionLoading[`modify_${position.ticket}`]}
                              style={{
                                padding: '6px 12px',
                                backgroundColor: '#22c55e',
                                color: 'white',
                                border: 'none',
                                borderRadius: '4px',
                                fontSize: '12px',
                                fontWeight: '500',
                                cursor: actionLoading[`modify_${position.ticket}`] ? 'not-allowed' : 'pointer',
                                opacity: actionLoading[`modify_${position.ticket}`] ? 0.6 : 1,
                              }}
                            >
                              {actionLoading[`modify_${position.ticket}`] ? 'Saving...' : 'Save'}
                            </button>
                            <button
                              onClick={handleCancelEdit}
                              style={{
                                padding: '6px 12px',
                                backgroundColor: '#6b7280',
                                color: 'white',
                                border: 'none',
                                borderRadius: '4px',
                                fontSize: '12px',
                                fontWeight: '500',
                                cursor: 'pointer',
                              }}
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <div style={{ display: 'flex', gap: '4px', justifyContent: 'center' }}>
                            <button
                              onClick={() => handleStartEdit(position)}
                              style={{
                                padding: '6px 12px',
                                backgroundColor: '#3b82f6',
                                color: 'white',
                                border: 'none',
                                borderRadius: '4px',
                                fontSize: '12px',
                                fontWeight: '500',
                                cursor: 'pointer',
                              }}
                            >
                              Modify
                            </button>
                            <button
                              onClick={() => handleClosePosition(position.ticket)}
                              disabled={actionLoading[`close_${position.ticket}`]}
                              style={{
                                padding: '6px 12px',
                                backgroundColor: '#ef4444',
                                color: 'white',
                                border: 'none',
                                borderRadius: '4px',
                                fontSize: '12px',
                                fontWeight: '500',
                                cursor: actionLoading[`close_${position.ticket}`] ? 'not-allowed' : 'pointer',
                                opacity: actionLoading[`close_${position.ticket}`] ? 0.6 : 1,
                              }}
                            >
                              {actionLoading[`close_${position.ticket}`] ? 'Closing...' : 'Close'}
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Footer Summary */}
        {!loading && positions.length > 0 && (
          <div
            style={{
              padding: '16px 24px',
              borderTop: '1px solid #e5e7eb',
              backgroundColor: '#f9fafb',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <div style={{ fontSize: '14px', color: '#6b7280' }}>
              Total Positions: <strong style={{ color: '#111827' }}>{positions.length}</strong>
            </div>
            <div style={{ fontSize: '14px', color: '#6b7280' }}>
              Total Profit:{' '}
              <strong
                style={{
                  color: positions.reduce((sum, p) => sum + p.profit, 0) >= 0 ? '#22c55e' : '#ef4444',
                }}
              >
                ${positions.reduce((sum, p) => sum + p.profit, 0).toFixed(2)}
              </strong>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default OpenPositionsModal;
