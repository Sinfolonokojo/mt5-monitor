import { useState, useEffect } from 'react';
import { formatCurrency, calculateProfitLoss, calculateMaxLoss } from '../utils/formatters';
import apiService from '../services/api';

const AccountDetailsModal = ({ account, onClose, vsGroup, onViewTrades, onOpenTrade, onViewPositions, onRefresh, onNotification }) => {
  const [activeTab, setActiveTab] = useState('positions');
  const [positions, setPositions] = useState([]);
  const [positionsLoading, setPositionsLoading] = useState(false);
  const [positionsError, setPositionsError] = useState(null);
  const [actionLoading, setActionLoading] = useState({});
  const [editingPosition, setEditingPosition] = useState(null);
  const [editValues, setEditValues] = useState({ sl: '', tp: '' });

  if (!account) return null;

  const initialBalance = account.initial_balance || 100000;
  const profitLoss = calculateProfitLoss(account.balance, initialBalance);
  const maxLoss = calculateMaxLoss(account.balance, initialBalance);
  const plColor = profitLoss >= 0 ? 'var(--green)' : 'var(--red)';

  // Calculate profit/loss percentage
  const plPercentage = ((profitLoss / initialBalance) * 100).toFixed(2);

  // Calculate max drawdown percentage
  const maxDrawdownLimit = initialBalance * 0.10; // 10% max drawdown
  const currentDrawdown = Math.max(0, initialBalance - account.balance);
  const drawdownPercentage = ((currentDrawdown / initialBalance) * 100).toFixed(2);
  const drawdownUsedPercent = Math.min((currentDrawdown / maxDrawdownLimit) * 100, 100);
  const drawdownRemaining = Math.max(0, maxDrawdownLimit - currentDrawdown);

  // Fetch positions when tab changes to positions
  useEffect(() => {
    if (activeTab === 'positions' && account) {
      fetchPositions();
    }
  }, [activeTab, account]);

  const fetchPositions = async () => {
    try {
      setPositionsLoading(true);
      setPositionsError(null);
      const data = await apiService.fetchOpenPositions(account.account_number);
      setPositions(data.positions || []);
    } catch (err) {
      setPositionsError(err.message);
    } finally {
      setPositionsLoading(false);
    }
  };

  const handleClosePosition = async (ticket) => {
    const position = positions.find(p => p.ticket === ticket);
    if (!window.confirm('¿Estás seguro de que quieres cerrar esta posición?')) {
      return;
    }

    try {
      setActionLoading(prev => ({ ...prev, [`close_${ticket}`]: true }));
      const result = await apiService.closePosition(account.account_number, ticket);

      if (result.success) {
        if (onNotification) {
          onNotification({
            message: `✓ Posición cerrada: ${position.symbol} (Ticket: ${ticket})`,
            type: 'success',
          });
        }
        await fetchPositions();
        if (onRefresh) onRefresh();
      } else {
        setPositionsError(result.message || 'Error al cerrar la posición');
      }
    } catch (err) {
      setPositionsError(err.message);
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
    setPositionsError(null);
  };

  const handleCancelEdit = () => {
    setEditingPosition(null);
    setEditValues({ sl: '', tp: '' });
  };

  const handleSaveModify = async (ticket) => {
    const position = positions.find(p => p.ticket === ticket);
    try {
      setActionLoading(prev => ({ ...prev, [`modify_${ticket}`]: true }));

      const result = await apiService.modifyPosition(
        account.account_number,
        ticket,
        editValues.sl !== '' ? parseFloat(editValues.sl) : null,
        editValues.tp !== '' ? parseFloat(editValues.tp) : null
      );

      if (result.success) {
        if (onNotification) {
          onNotification({
            message: `✓ Posición modificada: ${position.symbol}`,
            type: 'success',
          });
        }
        setEditingPosition(null);
        await fetchPositions();
        if (onRefresh) onRefresh();
      } else {
        setPositionsError(result.message || 'Error al modificar');
      }
    } catch (err) {
      setPositionsError(err.message);
    } finally {
      setActionLoading(prev => ({ ...prev, [`modify_${ticket}`]: false }));
    }
  };

  const totalProfit = positions.reduce((sum, p) => sum + (p.profit || 0), 0);

  // Get phase color
  const getPhaseColor = (phase) => {
    const p = (phase || '').toUpperCase();
    if (p === 'F1') return 'var(--phase-f1)';
    if (p === 'F2') return 'var(--phase-f2)';
    if (p === 'R') return 'var(--phase-r)';
    if (p === 'Q') return 'var(--phase-q)';
    return 'var(--text-secondary)';
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
        className="account-modal-content"
        style={{
          backgroundColor: 'var(--bg-surface)',
          borderRadius: 'var(--radius-xl)',
          maxWidth: '1100px',
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
            .account-modal-content {
              border-radius: 0 !important;
              max-height: 100vh !important;
              height: 100vh !important;
            }
            .stats-grid {
              grid-template-columns: 1fr 1fr !important;
            }
            .positions-table {
              font-size: 12px !important;
            }
          }
          @media (max-width: 480px) {
            .stats-grid {
              grid-template-columns: 1fr !important;
            }
          }
        `}</style>

        {/* Header */}
        <div
          style={{
            padding: '20px 24px',
            borderBottom: '1px solid var(--border-color)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            gap: '16px',
            flexWrap: 'wrap',
            backgroundColor: 'var(--bg-header)',
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontSize: '20px' }}>💼</span>
              <h2 style={{
                margin: 0,
                fontSize: '22px',
                fontWeight: '700',
                color: 'var(--text-primary)',
                letterSpacing: '-0.02em'
              }}>
                Vista de Cuenta
              </h2>
            </div>
            <p style={{
              margin: 0,
              fontSize: '14px',
              color: 'var(--text-secondary)',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}>
              #{account.account_number} •
              <span style={{ color: getPhaseColor(account.phase), fontWeight: '600' }}>
                {account.phase || 'Sin Fase'}
              </span>
              {vsGroup && (
                <>
                  • <span style={{
                    backgroundColor: 'var(--primary)',
                    color: 'white',
                    padding: '2px 8px',
                    borderRadius: '4px',
                    fontSize: '11px',
                    fontWeight: '600'
                  }}>VS {vsGroup}</span>
                </>
              )}
            </p>
          </div>

          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
            {positions.length > 0 && (
              <button
                onClick={handleCloseAllPositions}
                disabled={actionLoading.closeAll}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '8px 14px',
                  backgroundColor: 'rgba(239, 68, 68, 0.1)',
                  color: 'var(--red)',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  borderRadius: 'var(--radius-lg)',
                  fontSize: '13px',
                  fontWeight: '500',
                  cursor: actionLoading.closeAll ? 'not-allowed' : 'pointer',
                  opacity: actionLoading.closeAll ? 0.6 : 1,
                  transition: 'all 0.2s',
                }}
              >
                ⚠️ {actionLoading.closeAll ? 'Cerrando...' : 'Cerrar Todo'}
              </button>
            )}
            {onOpenTrade && (
              <button
                onClick={() => onOpenTrade(account)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '8px 14px',
                  backgroundColor: 'var(--green)',
                  color: 'white',
                  border: 'none',
                  borderRadius: 'var(--radius-lg)',
                  fontSize: '13px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
              >
                📈 Nueva Operación
              </button>
            )}
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

        {/* Scrollable Content */}
        <div style={{ flex: 1, overflow: 'auto' }}>
          {/* Stats Section */}
          <div
            className="stats-grid"
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gap: '16px',
              padding: '20px 24px',
            }}
          >
            {/* Balance Card */}
            <StatCard
              label="Balance"
              value={formatCurrency(account.balance)}
              change={plPercentage}
              isPositive={profitLoss >= 0}
              icon="💰"
            />

            {/* Equity Card */}
            <StatCard
              label="Equity"
              value={formatCurrency(account.balance + totalProfit)}
              subtext={`${positions.length} posiciones abiertas`}
              icon="📊"
            />

            {/* P/L Card */}
            <StatCard
              label="Ganancia/Pérdida"
              value={`${profitLoss >= 0 ? '+' : ''}${formatCurrency(profitLoss)}`}
              valueColor={plColor}
              change={plPercentage}
              isPositive={profitLoss >= 0}
              icon={profitLoss >= 0 ? '📈' : '📉'}
            />

            {/* Drawdown Meter */}
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '10px',
                padding: '16px',
                backgroundColor: 'var(--bg-dark)',
                borderRadius: 'var(--radius-lg)',
                border: '1px solid var(--border-subtle)',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                <span style={{
                  fontSize: '11px',
                  fontWeight: '600',
                  color: 'var(--text-muted)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em'
                }}>
                  Drawdown
                </span>
                <span style={{
                  fontSize: '14px',
                  fontWeight: '700',
                  color: drawdownPercentage > 8 ? 'var(--red)' : drawdownPercentage > 5 ? 'var(--orange)' : 'var(--text-primary)',
                  fontFamily: 'var(--font-mono)'
                }}>
                  {drawdownPercentage}%
                </span>
              </div>
              <div style={{
                width: '100%',
                height: '8px',
                backgroundColor: 'var(--border-color)',
                borderRadius: '4px',
                overflow: 'hidden',
              }}>
                <div style={{
                  width: `${drawdownUsedPercent}%`,
                  height: '100%',
                  backgroundColor: drawdownPercentage > 8 ? 'var(--red)' : drawdownPercentage > 5 ? 'var(--orange)' : 'var(--primary)',
                  borderRadius: '4px',
                  transition: 'width 0.3s ease',
                }} />
              </div>
              <span style={{
                fontSize: '10px',
                color: 'var(--text-muted)'
              }}>
                Límite: 10% ({formatCurrency(maxDrawdownLimit)})
              </span>
            </div>
          </div>

          {/* Tabs Navigation */}
          <div style={{ padding: '0 24px' }}>
            <div style={{
              display: 'flex',
              borderBottom: '1px solid var(--border-color)',
              gap: '0'
            }}>
              <TabButton
                active={activeTab === 'positions'}
                onClick={() => setActiveTab('positions')}
                icon="📋"
                label="Posiciones Abiertas"
                badge={positions.length || null}
              />
              <TabButton
                active={activeTab === 'info'}
                onClick={() => setActiveTab('info')}
                icon="ℹ️"
                label="Info de Cuenta"
              />
              <TabButton
                active={activeTab === 'history'}
                onClick={() => {
                  setActiveTab('history');
                  if (onViewTrades) onViewTrades();
                }}
                icon="📜"
                label="Historial"
              />
            </div>
          </div>

          {/* Tab Content */}
          <div style={{ padding: '20px 24px' }}>
            {activeTab === 'positions' && (
              <PositionsTab
                positions={positions}
                loading={positionsLoading}
                error={positionsError}
                editingPosition={editingPosition}
                editValues={editValues}
                setEditValues={setEditValues}
                actionLoading={actionLoading}
                onStartEdit={handleStartEdit}
                onCancelEdit={handleCancelEdit}
                onSaveModify={handleSaveModify}
                onClosePosition={handleClosePosition}
                onRefresh={fetchPositions}
              />
            )}

            {activeTab === 'info' && (
              <AccountInfoTab
                account={account}
                vsGroup={vsGroup}
                initialBalance={initialBalance}
                profitLoss={profitLoss}
                maxLoss={maxLoss}
                drawdownRemaining={drawdownRemaining}
                maxDrawdownLimit={maxDrawdownLimit}
              />
            )}

            {activeTab === 'history' && (
              <div style={{
                textAlign: 'center',
                padding: '60px 20px',
                color: 'var(--text-secondary)'
              }}>
                <span style={{ fontSize: '48px', display: 'block', marginBottom: '16px' }}>📜</span>
                <p style={{ fontSize: '14px', marginBottom: '16px' }}>
                  El historial se abrirá en una ventana separada
                </p>
                <button
                  onClick={onViewTrades}
                  style={{
                    padding: '10px 20px',
                    backgroundColor: 'var(--primary)',
                    color: 'white',
                    border: 'none',
                    borderRadius: 'var(--radius-lg)',
                    fontSize: '14px',
                    fontWeight: '600',
                    cursor: 'pointer',
                  }}
                >
                  Ver Historial Completo
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '12px 24px',
            borderTop: '1px solid var(--border-color)',
            backgroundColor: 'var(--bg-header)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontSize: '10px',
            color: 'var(--text-muted)',
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
          }}
        >
          <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
            <span>Titular: {account.account_holder || 'Desconocido'}</span>
            <span>Firma: {account.prop_firm || 'N/A'}</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span style={{
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                backgroundColor: account.status === 'connected' ? 'var(--green)' : 'var(--red)',
              }} />
              {account.status === 'connected' ? 'Conectado' : 'Desconectado'}
            </span>
          </div>
          <div>
            Actualizado: {new Date(account.last_updated || Date.now()).toLocaleTimeString('es-ES')}
          </div>
        </div>
      </div>
    </div>
  );
};

// Stat Card Component
const StatCard = ({ label, value, valueColor, change, isPositive, subtext, icon }) => (
  <div
    style={{
      display: 'flex',
      flexDirection: 'column',
      gap: '8px',
      padding: '16px',
      backgroundColor: 'var(--bg-dark)',
      borderRadius: 'var(--radius-lg)',
      border: '1px solid var(--border-subtle)',
    }}
  >
    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
      {icon && <span style={{ fontSize: '14px' }}>{icon}</span>}
      <span style={{
        fontSize: '11px',
        fontWeight: '600',
        color: 'var(--text-muted)',
        textTransform: 'uppercase',
        letterSpacing: '0.05em'
      }}>
        {label}
      </span>
    </div>
    <span style={{
      fontSize: '22px',
      fontWeight: '700',
      color: valueColor || 'var(--text-primary)',
      fontFamily: 'var(--font-mono)',
      letterSpacing: '-0.02em'
    }}>
      {value}
    </span>
    {change !== undefined && (
      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
        <span style={{ color: isPositive ? 'var(--green)' : 'var(--red)', fontSize: '12px' }}>
          {isPositive ? '▲' : '▼'}
        </span>
        <span style={{
          fontSize: '12px',
          fontWeight: '500',
          color: isPositive ? 'var(--green)' : 'var(--red)'
        }}>
          {isPositive ? '+' : ''}{change}%
        </span>
      </div>
    )}
    {subtext && (
      <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{subtext}</span>
    )}
  </div>
);

// Tab Button Component
const TabButton = ({ active, onClick, icon, label, badge }) => (
  <button
    onClick={onClick}
    style={{
      display: 'flex',
      alignItems: 'center',
      gap: '8px',
      padding: '14px 16px',
      backgroundColor: 'transparent',
      color: active ? 'var(--text-primary)' : 'var(--text-secondary)',
      border: 'none',
      borderBottom: active ? '2px solid var(--primary)' : '2px solid transparent',
      fontSize: '13px',
      fontWeight: active ? '600' : '500',
      cursor: 'pointer',
      transition: 'all 0.2s',
      marginBottom: '-1px',
    }}
  >
    <span>{icon}</span>
    <span>{label}</span>
    {badge !== null && badge > 0 && (
      <span style={{
        backgroundColor: active ? 'var(--primary)' : 'var(--bg-surface-hover)',
        color: active ? 'white' : 'var(--text-secondary)',
        padding: '2px 8px',
        borderRadius: '10px',
        fontSize: '10px',
        fontWeight: '600',
      }}>
        {badge}
      </span>
    )}
  </button>
);

// Positions Tab Component
const PositionsTab = ({
  positions,
  loading,
  error,
  editingPosition,
  editValues,
  setEditValues,
  actionLoading,
  onStartEdit,
  onCancelEdit,
  onSaveModify,
  onClosePosition,
  onRefresh,
}) => {
  const totalProfit = positions.reduce((sum, p) => sum + (p.profit || 0), 0);

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-secondary)' }}>
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
    );
  }

  if (error) {
    return (
      <div style={{
        padding: '16px',
        backgroundColor: 'rgba(239, 68, 68, 0.1)',
        border: '1px solid rgba(239, 68, 68, 0.3)',
        borderRadius: 'var(--radius-lg)',
        color: 'var(--red)',
        fontSize: '14px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}>
        <span>⚠️ {error}</span>
        <button
          onClick={onRefresh}
          style={{
            padding: '6px 12px',
            backgroundColor: 'var(--red)',
            color: 'white',
            border: 'none',
            borderRadius: 'var(--radius)',
            fontSize: '12px',
            cursor: 'pointer',
          }}
        >
          Reintentar
        </button>
      </div>
    );
  }

  if (positions.length === 0) {
    return (
      <div style={{
        textAlign: 'center',
        padding: '60px 20px',
        color: 'var(--text-secondary)',
        backgroundColor: 'var(--bg-dark)',
        borderRadius: 'var(--radius-lg)',
        border: '1px solid var(--border-subtle)',
      }}>
        <span style={{ fontSize: '48px', display: 'block', marginBottom: '16px', opacity: 0.5 }}>📭</span>
        <p style={{ fontSize: '14px', marginBottom: '8px' }}>Sin posiciones abiertas</p>
        <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
          Las posiciones aparecerán aquí cuando se abran operaciones
        </p>
      </div>
    );
  }

  return (
    <div>
      {/* Summary Bar */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '16px',
        padding: '12px 16px',
        backgroundColor: 'var(--bg-dark)',
        borderRadius: 'var(--radius-lg)',
        border: '1px solid var(--border-subtle)',
      }}>
        <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
          {positions.length} posición{positions.length !== 1 ? 'es' : ''} abierta{positions.length !== 1 ? 's' : ''}
        </span>
        <span style={{
          fontSize: '14px',
          fontWeight: '700',
          fontFamily: 'var(--font-mono)',
          color: totalProfit >= 0 ? 'var(--green)' : 'var(--red)'
        }}>
          {totalProfit >= 0 ? '+' : ''}${totalProfit.toFixed(2)}
        </span>
      </div>

      {/* Positions Table */}
      <div style={{
        overflowX: 'auto',
        borderRadius: 'var(--radius-lg)',
        border: '1px solid var(--border-color)',
        backgroundColor: 'var(--bg-dark)',
      }}>
        <table className="positions-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
          <thead>
            <tr style={{ backgroundColor: 'var(--bg-header)' }}>
              <th style={thStyle}>Símbolo</th>
              <th style={thStyle}>Tipo</th>
              <th style={thStyle}>Lotes</th>
              <th style={thStyle}>Apertura</th>
              <th style={thStyle}>Actual</th>
              <th style={thStyle}>S/L</th>
              <th style={thStyle}>T/P</th>
              <th style={{ ...thStyle, textAlign: 'right' }}>P/L</th>
              <th style={{ ...thStyle, textAlign: 'center' }}>Acción</th>
            </tr>
          </thead>
          <tbody>
            {positions.map((position) => (
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
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{
                      width: '8px',
                      height: '8px',
                      borderRadius: '50%',
                      backgroundColor: 'var(--green)',
                    }} />
                    <span style={{ fontWeight: '600', fontFamily: 'var(--font-mono)' }}>
                      {position.symbol}
                    </span>
                  </div>
                </td>
                <td style={tdStyle}>
                  <span style={{
                    padding: '3px 8px',
                    borderRadius: '4px',
                    fontSize: '10px',
                    fontWeight: '700',
                    textTransform: 'uppercase',
                    backgroundColor: position.type === 'BUY' ? 'rgba(11, 218, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                    color: position.type === 'BUY' ? 'var(--green)' : 'var(--red)',
                  }}>
                    {position.type}
                  </span>
                </td>
                <td style={{ ...tdStyle, fontFamily: 'var(--font-mono)' }}>{position.volume}</td>
                <td style={{ ...tdStyle, fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>
                  {position.open_price?.toFixed(5)}
                </td>
                <td style={{ ...tdStyle, fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>
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
                    <span style={{ fontFamily: 'var(--font-mono)', color: position.sl ? 'var(--red)' : 'var(--text-muted)' }}>
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
                    <span style={{ fontFamily: 'var(--font-mono)', color: position.tp ? 'var(--green)' : 'var(--text-muted)' }}>
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
                        onClick={() => onSaveModify(position.ticket)}
                        disabled={actionLoading[`modify_${position.ticket}`]}
                        style={actionBtnStyle('var(--green)')}
                      >
                        {actionLoading[`modify_${position.ticket}`] ? '...' : '✓'}
                      </button>
                      <button onClick={onCancelEdit} style={actionBtnStyle('var(--text-muted)')}>
                        ✕
                      </button>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', gap: '4px', justifyContent: 'center' }}>
                      <button
                        onClick={() => onStartEdit(position)}
                        style={actionBtnStyle('var(--primary)')}
                        title="Modificar"
                      >
                        ✎
                      </button>
                      <button
                        onClick={() => onClosePosition(position.ticket)}
                        disabled={actionLoading[`close_${position.ticket}`]}
                        style={actionBtnStyle('var(--red)')}
                        title="Cerrar"
                      >
                        {actionLoading[`close_${position.ticket}`] ? '...' : '✕'}
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// Account Info Tab Component
const AccountInfoTab = ({ account, vsGroup, initialBalance, profitLoss, maxLoss, drawdownRemaining, maxDrawdownLimit }) => (
  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '24px' }}>
    {/* Account Info */}
    <div style={{
      padding: '20px',
      backgroundColor: 'var(--bg-dark)',
      borderRadius: 'var(--radius-lg)',
      border: '1px solid var(--border-subtle)',
    }}>
      <h3 style={{
        fontSize: '14px',
        fontWeight: '600',
        color: 'var(--text-primary)',
        marginBottom: '16px',
        display: 'flex',
        alignItems: 'center',
        gap: '8px'
      }}>
        📋 Información de Cuenta
      </h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <InfoRow label="Número de Cuenta" value={account.account_number} />
        <InfoRow label="Titular" value={account.account_holder || 'Desconocido'} />
        <InfoRow label="Firma Prop" value={account.prop_firm || 'N/A'} />
        <InfoRow label="Fase" value={account.phase || 'Sin Fase'} />
        <InfoRow
          label="Estado"
          value={account.status === 'connected' ? 'Conectado' : 'Desconectado'}
          valueColor={account.status === 'connected' ? 'var(--green)' : 'var(--red)'}
        />
        <InfoRow label="Días Operando" value={account.days_operating || 0} />
        {vsGroup && <InfoRow label="Grupo VS" value={vsGroup} valueColor="var(--primary)" />}
      </div>
    </div>

    {/* Financial Info */}
    <div style={{
      padding: '20px',
      backgroundColor: 'var(--bg-dark)',
      borderRadius: 'var(--radius-lg)',
      border: '1px solid var(--border-subtle)',
    }}>
      <h3 style={{
        fontSize: '14px',
        fontWeight: '600',
        color: 'var(--text-primary)',
        marginBottom: '16px',
        display: 'flex',
        alignItems: 'center',
        gap: '8px'
      }}>
        💵 Información Financiera
      </h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <InfoRow label="Balance Inicial" value={formatCurrency(initialBalance)} mono />
        <InfoRow label="Balance Actual" value={formatCurrency(account.balance)} mono />
        <InfoRow
          label="Ganancia/Pérdida"
          value={`${profitLoss >= 0 ? '+' : ''}${formatCurrency(profitLoss)}`}
          valueColor={profitLoss >= 0 ? 'var(--green)' : 'var(--red)'}
          mono
          bold
        />
        <InfoRow
          label="Pérdida Máxima"
          value={formatCurrency(maxLoss)}
          valueColor={maxLoss >= 0 ? 'var(--green)' : 'var(--red)'}
          mono
        />
        <InfoRow
          label="Drawdown Restante"
          value={formatCurrency(drawdownRemaining)}
          valueColor={drawdownRemaining < 1000 ? 'var(--red)' : 'var(--green)'}
          mono
        />
        <InfoRow label="Límite Drawdown" value={formatCurrency(maxDrawdownLimit)} mono />
      </div>
    </div>
  </div>
);

// Info Row Component
const InfoRow = ({ label, value, valueColor, mono, bold }) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
    <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{label}</span>
    <span style={{
      fontSize: '13px',
      color: valueColor || 'var(--text-primary)',
      fontFamily: mono ? 'var(--font-mono)' : 'inherit',
      fontWeight: bold ? '700' : '500',
    }}>
      {value}
    </span>
  </div>
);

// Styles
const thStyle = {
  padding: '12px 16px',
  textAlign: 'left',
  fontWeight: '600',
  fontSize: '10px',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  color: 'var(--text-muted)',
  borderBottom: '1px solid var(--border-color)',
};

const tdStyle = {
  padding: '12px 16px',
  color: 'var(--text-primary)',
};

const editInputStyle = {
  width: '70px',
  padding: '4px 6px',
  backgroundColor: 'var(--bg-input)',
  border: '1px solid var(--border-color)',
  borderRadius: '4px',
  fontSize: '12px',
  color: 'var(--text-primary)',
  fontFamily: 'var(--font-mono)',
};

const actionBtnStyle = (color) => ({
  width: '28px',
  height: '28px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  backgroundColor: 'transparent',
  color: color,
  border: `1px solid ${color}`,
  borderRadius: '4px',
  fontSize: '12px',
  cursor: 'pointer',
  transition: 'all 0.2s',
});

export default AccountDetailsModal;
