import { useState, useEffect } from 'react';
import apiService from '../services/api';

const OpenPositionsModal = ({ account, onClose, onRefresh, onNotification }) => {
  const [positions, setPositions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionLoading, setActionLoading] = useState({});
  const [editingPosition, setEditingPosition] = useState(null);
  const [editValues, setEditValues] = useState({ sl: '', tp: '' });
  const [searchTerm, setSearchTerm] = useState('');

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
    const position = positions.find(p => p.ticket === ticket);
    if (!window.confirm('¿Estás seguro de que quieres cerrar esta posición?')) {
      return;
    }

    try {
      setActionLoading(prev => ({ ...prev, [`close_${ticket}`]: true }));
      setError(null);

      const result = await apiService.closePosition(account.account_number, ticket);

      if (result.success) {
        if (onNotification) {
          onNotification({
            message: `✓ Posición cerrada: ${position.symbol} (Ticket: ${ticket})`,
            type: 'success',
          });
        }

        await fetchPositions();
        if (onRefresh) {
          onRefresh();
        }
      } else {
        setError(result.message || 'Error al cerrar la posición');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setActionLoading(prev => ({ ...prev, [`close_${ticket}`]: false }));
    }
  };

  const handleCloseAllPositions = async () => {
    if (positions.length === 0) return;
    if (!window.confirm(`¿Estás seguro de que quieres cerrar TODAS las ${positions.length} posiciones?`)) {
      return;
    }

    setActionLoading(prev => ({ ...prev, closeAll: true }));
    let closedCount = 0;
    let errors = [];

    for (const position of positions) {
      try {
        const result = await apiService.closePosition(account.account_number, position.ticket);
        if (result.success) {
          closedCount++;
        } else {
          errors.push(`${position.symbol}: ${result.message}`);
        }
      } catch (err) {
        errors.push(`${position.symbol}: ${err.message}`);
      }
    }

    if (onNotification) {
      if (closedCount > 0) {
        onNotification({
          message: `✓ ${closedCount} posiciones cerradas`,
          type: 'success',
        });
      }
      if (errors.length > 0) {
        onNotification({
          message: `⚠ Errores: ${errors.join(', ')}`,
          type: 'error',
        });
      }
    }

    await fetchPositions();
    if (onRefresh) onRefresh();
    setActionLoading(prev => ({ ...prev, closeAll: false }));
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
    const position = positions.find(p => p.ticket === ticket);
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
        if (onNotification) {
          onNotification({
            message: `✓ Posición modificada: ${position.symbol} (SL/TP actualizados)`,
            type: 'success',
          });
        }

        setEditingPosition(null);
        await fetchPositions();
        if (onRefresh) {
          onRefresh();
        }
      } else {
        setError(result.message || 'Error al modificar la posición');
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setActionLoading(prev => ({ ...prev, [`modify_${ticket}`]: false }));
    }
  };

  if (!account) return null;

  // Filter positions by search term
  const filteredPositions = positions.filter(p =>
    p.symbol.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const totalProfit = positions.reduce((sum, p) => sum + (p.profit || 0), 0);

  // Get symbol badge color
  const getSymbolColor = (symbol) => {
    const s = symbol.toUpperCase();
    if (s.includes('XAU') || s.includes('GOLD')) return { bg: 'rgba(234, 179, 8, 0.1)', color: '#eab308' };
    if (s.includes('EUR')) return { bg: 'rgba(59, 130, 246, 0.1)', color: '#3b82f6' };
    if (s.includes('GBP')) return { bg: 'rgba(99, 102, 241, 0.1)', color: '#6366f1' };
    if (s.includes('USD')) return { bg: 'rgba(34, 197, 94, 0.1)', color: '#22c55e' };
    if (s.includes('JPY')) return { bg: 'rgba(239, 68, 68, 0.1)', color: '#ef4444' };
    if (s.includes('US30') || s.includes('NAS') || s.includes('SPX')) return { bg: 'rgba(168, 85, 247, 0.1)', color: '#a855f7' };
    if (s.includes('BTC') || s.includes('ETH')) return { bg: 'rgba(249, 115, 22, 0.1)', color: '#f97316' };
    return { bg: 'rgba(107, 114, 128, 0.1)', color: '#6b7280' };
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 1000,
        padding: '16px',
        backdropFilter: 'blur(4px)',
      }}
      onClick={onClose}
    >
      <div
        className="positions-modal-content"
        style={{
          backgroundColor: 'var(--bg-surface)',
          borderRadius: 'var(--radius-xl)',
          maxWidth: '1200px',
          width: '100%',
          maxHeight: '90vh',
          overflow: 'hidden',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
          border: '1px solid var(--border-color)',
          display: 'flex',
          flexDirection: 'column',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <style>{`
          @media (max-width: 768px) {
            .positions-modal-content {
              border-radius: 0 !important;
              max-height: 100vh !important;
              height: 100vh !important;
            }
          }
        `}</style>

        {/* Header */}
        <div
          style={{
            padding: '20px 24px',
            borderBottom: '1px solid var(--border-color)',
            backgroundColor: 'var(--bg-header)',
          }}
        >
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            gap: '16px',
            flexWrap: 'wrap',
          }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
                <span style={{ fontSize: '20px' }}>📊</span>
                <h2 style={{
                  margin: 0,
                  fontSize: '20px',
                  fontWeight: '700',
                  color: 'var(--text-primary)',
                  letterSpacing: '-0.02em'
                }}>
                  Posiciones Abiertas
                </h2>
              </div>
              <p style={{
                margin: 0,
                fontSize: '14px',
                color: 'var(--text-secondary)',
              }}>
                #{account.account_number} • {account.account_holder || 'Cuenta'}
              </p>
            </div>
            <button
              onClick={onClose}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                width: '36px',
                height: '36px',
                backgroundColor: 'var(--bg-surface-hover)',
                color: 'var(--text-secondary)',
                border: 'none',
                borderRadius: 'var(--radius-lg)',
                fontSize: '20px',
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
            >
              ×
            </button>
          </div>
        </div>

        {/* Stats Bar */}
        {!loading && positions.length > 0 && (
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: '16px',
            padding: '16px 24px',
            borderBottom: '1px solid var(--border-color)',
            backgroundColor: 'var(--bg-dark)',
          }}>
            <StatMini label="Posiciones" value={positions.length} />
            <StatMini
              label="P/L Total"
              value={`${totalProfit >= 0 ? '+' : ''}$${totalProfit.toFixed(2)}`}
              valueColor={totalProfit >= 0 ? 'var(--green)' : 'var(--red)'}
            />
            <StatMini
              label="Ganadoras"
              value={positions.filter(p => p.profit >= 0).length}
              valueColor="var(--green)"
            />
            <StatMini
              label="Perdedoras"
              value={positions.filter(p => p.profit < 0).length}
              valueColor="var(--red)"
            />
          </div>
        )}

        {/* Action Bar */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '16px 24px',
          gap: '16px',
          flexWrap: 'wrap',
        }}>
          {/* Search */}
          <div style={{ position: 'relative', flex: '1', maxWidth: '300px' }}>
            <span style={{
              position: 'absolute',
              left: '12px',
              top: '50%',
              transform: 'translateY(-50%)',
              color: 'var(--text-muted)',
              fontSize: '14px',
            }}>
              🔍
            </span>
            <input
              type="text"
              placeholder="Buscar símbolo..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{
                width: '100%',
                padding: '10px 12px 10px 38px',
                backgroundColor: 'var(--bg-dark)',
                border: '1px solid var(--border-color)',
                borderRadius: 'var(--radius-lg)',
                fontSize: '13px',
                color: 'var(--text-primary)',
                outline: 'none',
              }}
            />
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={fetchPositions}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '10px 16px',
                backgroundColor: 'var(--bg-surface-hover)',
                color: 'var(--text-secondary)',
                border: '1px solid var(--border-color)',
                borderRadius: 'var(--radius-lg)',
                fontSize: '13px',
                fontWeight: '500',
                cursor: 'pointer',
                transition: 'all 0.2s',
              }}
            >
              🔄 Actualizar
            </button>
            {positions.length > 0 && (
              <button
                onClick={handleCloseAllPositions}
                disabled={actionLoading.closeAll}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '10px 16px',
                  backgroundColor: 'rgba(239, 68, 68, 0.1)',
                  color: 'var(--red)',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  borderRadius: 'var(--radius-lg)',
                  fontSize: '13px',
                  fontWeight: '600',
                  cursor: actionLoading.closeAll ? 'not-allowed' : 'pointer',
                  opacity: actionLoading.closeAll ? 0.6 : 1,
                  transition: 'all 0.2s',
                }}
              >
                ⚠️ {actionLoading.closeAll ? 'Cerrando...' : 'Cerrar Todo'}
              </button>
            )}
          </div>
        </div>

        {/* Error Message */}
        {error && (
          <div
            style={{
              margin: '0 24px 16px',
              padding: '12px 16px',
              backgroundColor: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              borderRadius: 'var(--radius-lg)',
              color: 'var(--red)',
              fontSize: '13px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <span>⚠️ {error}</span>
            <button
              onClick={() => setError(null)}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--red)',
                cursor: 'pointer',
                fontSize: '16px',
              }}
            >
              ×
            </button>
          </div>
        )}

        {/* Content */}
        <div style={{ flex: 1, overflow: 'auto', padding: '0 24px 24px' }}>
          {loading ? (
            <div style={{
              textAlign: 'center',
              padding: '60px 20px',
              color: 'var(--text-secondary)'
            }}>
              <div style={{
                width: '40px',
                height: '40px',
                border: '3px solid var(--border-color)',
                borderTopColor: 'var(--primary)',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite',
                margin: '0 auto 16px'
              }} />
              <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
              Cargando posiciones...
            </div>
          ) : filteredPositions.length === 0 ? (
            <div style={{
              textAlign: 'center',
              padding: '60px 20px',
              color: 'var(--text-secondary)',
              backgroundColor: 'var(--bg-dark)',
              borderRadius: 'var(--radius-lg)',
              border: '1px solid var(--border-subtle)',
            }}>
              <span style={{ fontSize: '48px', display: 'block', marginBottom: '16px', opacity: 0.5 }}>
                {searchTerm ? '🔍' : '📭'}
              </span>
              <p style={{ fontSize: '14px', marginBottom: '8px' }}>
                {searchTerm ? `No hay posiciones para "${searchTerm}"` : 'Sin posiciones abiertas'}
              </p>
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm('')}
                  style={{
                    padding: '8px 16px',
                    backgroundColor: 'var(--bg-surface-hover)',
                    color: 'var(--text-primary)',
                    border: 'none',
                    borderRadius: 'var(--radius)',
                    fontSize: '13px',
                    cursor: 'pointer',
                    marginTop: '8px',
                  }}
                >
                  Limpiar búsqueda
                </button>
              )}
            </div>
          ) : (
            <div style={{
              overflowX: 'auto',
              borderRadius: 'var(--radius-lg)',
              border: '1px solid var(--border-color)',
              backgroundColor: 'var(--bg-dark)',
            }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                <thead>
                  <tr style={{ backgroundColor: 'var(--bg-header)' }}>
                    <th style={thStyle}>Símbolo</th>
                    <th style={thStyle}>Tipo</th>
                    <th style={thStyle}>Volumen</th>
                    <th style={thStyle}>Apertura</th>
                    <th style={thStyle}>Actual</th>
                    <th style={thStyle}>S/L</th>
                    <th style={thStyle}>T/P</th>
                    <th style={{ ...thStyle, textAlign: 'right' }}>P/L</th>
                    <th style={{ ...thStyle, textAlign: 'center' }}>Acción</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPositions.map((position) => {
                    const symbolColors = getSymbolColor(position.symbol);
                    return (
                      <tr
                        key={position.ticket}
                        style={{
                          borderBottom: '1px solid var(--border-subtle)',
                          transition: 'background-color 0.2s',
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-surface-hover)'}
                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                      >
                        <td style={tdStyle}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <div style={{
                              width: '32px',
                              height: '32px',
                              borderRadius: '50%',
                              backgroundColor: symbolColors.bg,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontSize: '10px',
                              fontWeight: '700',
                              color: symbolColors.color,
                            }}>
                              {position.symbol.substring(0, 2)}
                            </div>
                            <div>
                              <div style={{ fontWeight: '600', fontFamily: 'var(--font-mono)' }}>
                                {position.symbol}
                              </div>
                              <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                                #{position.ticket}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td style={tdStyle}>
                          <span style={{
                            padding: '4px 10px',
                            borderRadius: '4px',
                            fontSize: '10px',
                            fontWeight: '700',
                            textTransform: 'uppercase',
                            backgroundColor: position.type === 'BUY' ? 'rgba(11, 218, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                            color: position.type === 'BUY' ? 'var(--green)' : 'var(--red)',
                            border: `1px solid ${position.type === 'BUY' ? 'rgba(11, 218, 94, 0.2)' : 'rgba(239, 68, 68, 0.2)'}`,
                          }}>
                            {position.type}
                          </span>
                        </td>
                        <td style={{ ...tdStyle, fontFamily: 'var(--font-mono)' }}>
                          {position.volume}
                        </td>
                        <td style={{ ...tdStyle, fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>
                          {position.open_price?.toFixed(5)}
                        </td>
                        <td style={{ ...tdStyle, fontFamily: 'var(--font-mono)', color: 'var(--text-primary)' }}>
                          {position.current_price?.toFixed(5)}
                        </td>
                        <td style={tdStyle}>
                          {editingPosition === position.ticket ? (
                            <input
                              type="number"
                              step="0.00001"
                              value={editValues.sl}
                              onChange={(e) => setEditValues(prev => ({ ...prev, sl: e.target.value }))}
                              placeholder="SL"
                              style={editInputStyle}
                            />
                          ) : (
                            <span style={{
                              fontFamily: 'var(--font-mono)',
                              color: position.sl ? 'var(--red)' : 'var(--text-muted)'
                            }}>
                              {position.sl ? position.sl.toFixed(5) : '-'}
                            </span>
                          )}
                        </td>
                        <td style={tdStyle}>
                          {editingPosition === position.ticket ? (
                            <input
                              type="number"
                              step="0.00001"
                              value={editValues.tp}
                              onChange={(e) => setEditValues(prev => ({ ...prev, tp: e.target.value }))}
                              placeholder="TP"
                              style={editInputStyle}
                            />
                          ) : (
                            <span style={{
                              fontFamily: 'var(--font-mono)',
                              color: position.tp ? 'var(--green)' : 'var(--text-muted)'
                            }}>
                              {position.tp ? position.tp.toFixed(5) : '-'}
                            </span>
                          )}
                        </td>
                        <td style={{
                          ...tdStyle,
                          textAlign: 'right',
                          fontWeight: '700',
                          fontFamily: 'var(--font-mono)',
                          color: position.profit >= 0 ? 'var(--green)' : 'var(--red)'
                        }}>
                          {position.profit >= 0 ? '+' : ''}${position.profit?.toFixed(2)}
                        </td>
                        <td style={{ ...tdStyle, textAlign: 'center' }}>
                          {editingPosition === position.ticket ? (
                            <div style={{ display: 'flex', gap: '4px', justifyContent: 'center' }}>
                              <button
                                onClick={() => handleSaveModify(position.ticket)}
                                disabled={actionLoading[`modify_${position.ticket}`]}
                                style={actionBtnStyle('var(--green)')}
                              >
                                {actionLoading[`modify_${position.ticket}`] ? '...' : '✓'}
                              </button>
                              <button onClick={handleCancelEdit} style={actionBtnStyle('var(--text-muted)')}>
                                ✕
                              </button>
                            </div>
                          ) : (
                            <div style={{ display: 'flex', gap: '4px', justifyContent: 'center' }}>
                              <button
                                onClick={() => handleStartEdit(position)}
                                style={actionBtnStyle('var(--primary)')}
                                title="Modificar SL/TP"
                              >
                                ✎
                              </button>
                              <button
                                onClick={() => handleClosePosition(position.ticket)}
                                disabled={actionLoading[`close_${position.ticket}`]}
                                style={actionBtnStyle('var(--red)')}
                                title="Cerrar posición"
                              >
                                {actionLoading[`close_${position.ticket}`] ? '...' : '✕'}
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '16px 24px',
            borderTop: '1px solid var(--border-color)',
            backgroundColor: 'var(--bg-header)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
            {filteredPositions.length} de {positions.length} posiciones
          </div>
          <button
            onClick={onClose}
            style={{
              padding: '10px 24px',
              backgroundColor: 'var(--primary)',
              color: 'white',
              border: 'none',
              borderRadius: 'var(--radius-lg)',
              fontSize: '14px',
              fontWeight: '600',
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};

// Mini Stat Component
const StatMini = ({ label, value, valueColor }) => (
  <div style={{ textAlign: 'center' }}>
    <div style={{
      fontSize: '10px',
      color: 'var(--text-muted)',
      textTransform: 'uppercase',
      letterSpacing: '0.05em',
      marginBottom: '4px'
    }}>
      {label}
    </div>
    <div style={{
      fontSize: '16px',
      fontWeight: '700',
      fontFamily: 'var(--font-mono)',
      color: valueColor || 'var(--text-primary)'
    }}>
      {value}
    </div>
  </div>
);

// Styles
const thStyle = {
  padding: '14px 16px',
  textAlign: 'left',
  fontWeight: '600',
  fontSize: '10px',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  color: 'var(--text-muted)',
  borderBottom: '1px solid var(--border-color)',
};

const tdStyle = {
  padding: '14px 16px',
  color: 'var(--text-primary)',
};

const editInputStyle = {
  width: '75px',
  padding: '6px 8px',
  backgroundColor: 'var(--bg-input)',
  border: '1px solid var(--border-color)',
  borderRadius: '4px',
  fontSize: '12px',
  color: 'var(--text-primary)',
  fontFamily: 'var(--font-mono)',
};

const actionBtnStyle = (color) => ({
  width: '30px',
  height: '30px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  backgroundColor: 'transparent',
  color: color,
  border: `1px solid ${color}`,
  borderRadius: '6px',
  fontSize: '13px',
  cursor: 'pointer',
  transition: 'all 0.2s',
});

export default OpenPositionsModal;
