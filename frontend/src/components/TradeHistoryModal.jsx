import { useState, useEffect } from 'react';
import apiService from '../services/api';

const TradeHistoryModal = ({ account, onClose }) => {
  const [tradeHistory, setTradeHistory] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    if (account) {
      fetchTradeHistory();
    }
  }, [account]);

  const fetchTradeHistory = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await apiService.fetchTradeHistory(account.account_number);
      setTradeHistory(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSyncToSheets = async () => {
    try {
      setSyncing(true);
      setSyncMessage('');
      const result = await apiService.syncTradesToGoogleSheets(account.account_number);
      setSyncMessage({ type: 'success', text: `✓ ${result.trades_synced} trades sincronizados` });
      setTimeout(() => setSyncMessage(''), 5000);
    } catch (err) {
      setSyncMessage({ type: 'error', text: `Error: ${err.message}` });
      setTimeout(() => setSyncMessage(''), 5000);
    } finally {
      setSyncing(false);
    }
  };

  if (!account) return null;

  // Filter trades by search term
  const filteredTrades = tradeHistory?.trades?.filter(t =>
    t.symbol.toLowerCase().includes(searchTerm.toLowerCase())
  ) || [];

  // Calculate stats from filtered trades
  const stats = {
    total: filteredTrades.length,
    profit: filteredTrades.reduce((sum, t) => sum + (t.profit || 0), 0),
    commission: filteredTrades.reduce((sum, t) => sum + Math.abs(t.commission || 0), 0),
    winners: filteredTrades.filter(t => t.profit >= 0).length,
    losers: filteredTrades.filter(t => t.profit < 0).length,
  };

  const winRate = stats.total > 0 ? ((stats.winners / stats.total) * 100).toFixed(1) : 0;

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
        className="history-modal-content"
        style={{
          backgroundColor: 'var(--bg-surface)',
          borderRadius: 'var(--radius-xl)',
          maxWidth: '1300px',
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
            .history-modal-content {
              border-radius: 0 !important;
              max-height: 100vh !important;
              height: 100vh !important;
            }
            .stats-row {
              grid-template-columns: repeat(2, 1fr) !important;
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
                <span style={{ fontSize: '20px' }}>📜</span>
                <h2 style={{
                  margin: 0,
                  fontSize: '20px',
                  fontWeight: '700',
                  color: 'var(--text-primary)',
                  letterSpacing: '-0.02em'
                }}>
                  Historial de Operaciones
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
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <button
                onClick={handleSyncToSheets}
                disabled={syncing || loading}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '10px 16px',
                  backgroundColor: syncing ? 'var(--bg-surface-hover)' : 'var(--green)',
                  color: 'white',
                  border: 'none',
                  borderRadius: 'var(--radius-lg)',
                  fontSize: '13px',
                  fontWeight: '600',
                  cursor: syncing ? 'not-allowed' : 'pointer',
                  opacity: syncing ? 0.7 : 1,
                  transition: 'all 0.2s',
                }}
              >
                📊 {syncing ? 'Sincronizando...' : 'Sync to Sheets'}
              </button>
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
        </div>

        {/* Sync Message */}
        {syncMessage && (
          <div
            style={{
              padding: '12px 24px',
              backgroundColor: syncMessage.type === 'error' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(11, 218, 94, 0.1)',
              color: syncMessage.type === 'error' ? 'var(--red)' : 'var(--green)',
              fontSize: '13px',
              fontWeight: '500',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <span>{syncMessage.text}</span>
            <button
              onClick={() => setSyncMessage('')}
              style={{
                background: 'none',
                border: 'none',
                color: 'inherit',
                cursor: 'pointer',
                fontSize: '16px',
              }}
            >
              ×
            </button>
          </div>
        )}

        {/* Stats Bar */}
        {!loading && tradeHistory && (
          <div
            className="stats-row"
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(5, 1fr)',
              gap: '16px',
              padding: '16px 24px',
              borderBottom: '1px solid var(--border-color)',
              backgroundColor: 'var(--bg-dark)',
            }}
          >
            <StatCard label="Total Trades" value={stats.total} />
            <StatCard
              label="Profit Neto"
              value={`${stats.profit >= 0 ? '+' : ''}$${stats.profit.toFixed(2)}`}
              valueColor={stats.profit >= 0 ? 'var(--green)' : 'var(--red)'}
            />
            <StatCard
              label="Comisión Total"
              value={`$${stats.commission.toFixed(2)}`}
              valueColor="var(--orange)"
            />
            <StatCard
              label="Win Rate"
              value={`${winRate}%`}
              valueColor={parseFloat(winRate) >= 50 ? 'var(--green)' : 'var(--red)'}
            />
            <StatCard
              label="W / L"
              value={`${stats.winners} / ${stats.losers}`}
            />
          </div>
        )}

        {/* Search Bar */}
        {!loading && tradeHistory && tradeHistory.total_trades > 0 && (
          <div style={{
            padding: '16px 24px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '16px',
          }}>
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
                placeholder="Buscar por símbolo..."
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
            <button
              onClick={fetchTradeHistory}
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
          </div>
        )}

        {/* Content */}
        <div style={{ flex: 1, overflow: 'auto', padding: '0 24px 24px' }}>
          {loading && (
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
              Cargando historial...
            </div>
          )}

          {error && (
            <div
              style={{
                padding: '16px',
                backgroundColor: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                borderRadius: 'var(--radius-lg)',
                color: 'var(--red)',
                fontSize: '14px',
              }}
            >
              ⚠️ Error: {error}
            </div>
          )}

          {!loading && !error && tradeHistory && (
            <>
              {filteredTrades.length === 0 ? (
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
                    {searchTerm
                      ? `No se encontraron trades para "${searchTerm}"`
                      : 'No hay operaciones en el historial'}
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
                        <th style={thStyle}>Lotes</th>
                        <th style={thStyle}>Entrada</th>
                        <th style={thStyle}>Salida</th>
                        <th style={{ ...thStyle, textAlign: 'right' }}>Pips</th>
                        <th style={{ ...thStyle, textAlign: 'right' }}>Comisión</th>
                        <th style={{ ...thStyle, textAlign: 'right' }}>Profit</th>
                        <th style={thStyle}>Fecha Entrada</th>
                        <th style={thStyle}>Fecha Salida</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredTrades.map((trade, index) => (
                        <tr
                          key={trade.position_id || index}
                          style={{
                            borderBottom: '1px solid var(--border-subtle)',
                            transition: 'background-color 0.2s',
                          }}
                          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-surface-hover)'}
                          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                        >
                          <td style={tdStyle}>
                            <span style={{ fontWeight: '600', fontFamily: 'var(--font-mono)' }}>
                              {trade.symbol}
                            </span>
                          </td>
                          <td style={tdStyle}>
                            <span style={{
                              padding: '4px 10px',
                              borderRadius: '4px',
                              fontSize: '10px',
                              fontWeight: '700',
                              textTransform: 'uppercase',
                              backgroundColor: trade.side === 'BUY' ? 'rgba(11, 218, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                              color: trade.side === 'BUY' ? 'var(--green)' : 'var(--red)',
                              border: `1px solid ${trade.side === 'BUY' ? 'rgba(11, 218, 94, 0.2)' : 'rgba(239, 68, 68, 0.2)'}`,
                            }}>
                              {trade.side}
                            </span>
                          </td>
                          <td style={{ ...tdStyle, fontFamily: 'var(--font-mono)' }}>
                            {trade.lot?.toFixed(2)}
                          </td>
                          <td style={{ ...tdStyle, fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>
                            {trade.entry_price?.toFixed(5)}
                          </td>
                          <td style={{ ...tdStyle, fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>
                            {trade.exit_price?.toFixed(5)}
                          </td>
                          <td style={{
                            ...tdStyle,
                            textAlign: 'right',
                            fontFamily: 'var(--font-mono)',
                            fontWeight: '500',
                            color: trade.pips >= 0 ? 'var(--green)' : 'var(--red)'
                          }}>
                            {trade.pips > 0 ? '+' : ''}{trade.pips?.toFixed(1)}
                          </td>
                          <td style={{
                            ...tdStyle,
                            textAlign: 'right',
                            fontFamily: 'var(--font-mono)',
                            color: 'var(--orange)'
                          }}>
                            ${Math.abs(trade.commission || 0).toFixed(2)}
                          </td>
                          <td style={{
                            ...tdStyle,
                            textAlign: 'right',
                            fontFamily: 'var(--font-mono)',
                            fontWeight: '700',
                            color: trade.profit >= 0 ? 'var(--green)' : 'var(--red)'
                          }}>
                            {trade.profit >= 0 ? '+' : ''}${trade.profit?.toFixed(2)}
                          </td>
                          <td style={{ ...tdStyle, fontSize: '11px', color: 'var(--text-muted)' }}>
                            {trade.entry_time ? new Date(trade.entry_time).toLocaleString('es-ES', {
                              day: '2-digit',
                              month: '2-digit',
                              hour: '2-digit',
                              minute: '2-digit'
                            }) : '-'}
                          </td>
                          <td style={{ ...tdStyle, fontSize: '11px', color: 'var(--text-muted)' }}>
                            {trade.exit_time ? new Date(trade.exit_time).toLocaleString('es-ES', {
                              day: '2-digit',
                              month: '2-digit',
                              hour: '2-digit',
                              minute: '2-digit'
                            }) : '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
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
            Mostrando {filteredTrades.length} de {tradeHistory?.total_trades || 0} operaciones
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

// Stat Card Component
const StatCard = ({ label, value, valueColor }) => (
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
      fontSize: '18px',
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
  padding: '14px 12px',
  textAlign: 'left',
  fontWeight: '600',
  fontSize: '10px',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  color: 'var(--text-muted)',
  borderBottom: '1px solid var(--border-color)',
  whiteSpace: 'nowrap',
};

const tdStyle = {
  padding: '12px',
  color: 'var(--text-primary)',
  whiteSpace: 'nowrap',
};

export default TradeHistoryModal;
