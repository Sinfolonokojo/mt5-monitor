import { useState, useEffect, useCallback } from 'react';
import apiService from '../../services/api';
import Notification from '../Notification';

const VersusDetailModal = ({ versus, accounts = [], onCongelar, onTransferir, onCancel, onDelete, loading, onClose }) => {
  const [showConfirm, setShowConfirm] = useState(null);
  const [positionsA, setPositionsA] = useState([]);
  const [positionsB, setPositionsB] = useState([]);
  const [positionsLoading, setPositionsLoading] = useState(false);
  const [positionsError, setPositionsError] = useState(null);
  const [actionLoading, setActionLoading] = useState({});
  const [editingPosition, setEditingPosition] = useState(null);
  const [editValues, setEditValues] = useState({ sl: '', tp: '' });
  const [notification, setNotification] = useState(null);

  if (!versus) return null;

  const getAccountInfo = (accountNumber) => {
    const acc = accounts.find(a => a.account_number === accountNumber);
    if (!acc) return null;
    return { holder: acc.account_holder, firm: acc.prop_firm, balance: acc.balance, phase: acc.phase };
  };

  const accountInfoA = getAccountInfo(versus.account_a);
  const accountInfoB = getAccountInfo(versus.account_b);

  const statusConfig = {
    pending: { bg: 'rgba(251, 191, 36, 0.15)', text: '#fbbf24', label: 'Pendiente' },
    congelado: { bg: 'rgba(59, 130, 246, 0.15)', text: '#3b82f6', label: 'Congelado' },
    transferido: { bg: 'rgba(16, 185, 129, 0.15)', text: '#10b981', label: 'Transferido' },
    completed: { bg: 'rgba(107, 114, 128, 0.15)', text: '#6b7280', label: 'Completado' },
    error: { bg: 'rgba(239, 68, 68, 0.15)', text: '#ef4444', label: 'Error' }
  };

  const status = statusConfig[versus.status] || statusConfig.pending;
  const oppositeSide = versus.side === 'BUY' ? 'SELL' : 'BUY';

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleString('es-ES', {
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Fetch positions for both accounts
  const fetchPositions = useCallback(async () => {
    setPositionsLoading(true);
    setPositionsError(null);
    try {
      const [resA, resB] = await Promise.all([
        apiService.fetchOpenPositions(versus.account_a),
        apiService.fetchOpenPositions(versus.account_b),
      ]);
      setPositionsA(resA.positions || []);
      setPositionsB(resB.positions || []);
    } catch (err) {
      setPositionsError(err.message);
    } finally {
      setPositionsLoading(false);
    }
  }, [versus.account_a, versus.account_b]);

  useEffect(() => {
    fetchPositions();
  }, [fetchPositions]);

  const handleClosePosition = async (accountNumber, ticket) => {
    if (!window.confirm(`¿Cerrar posición #${ticket}?`)) return;
    const key = `close_${ticket}`;
    try {
      setActionLoading(prev => ({ ...prev, [key]: true }));
      const result = await apiService.closePosition(accountNumber, ticket);
      if (result.success) {
        setNotification({ message: `Posición #${ticket} cerrada correctamente`, type: 'success' });
        await fetchPositions();
      } else {
        setNotification({ message: result.message || 'Error al cerrar posición', type: 'error' });
      }
    } catch (err) {
      setNotification({ message: err.message, type: 'error' });
    } finally {
      setActionLoading(prev => ({ ...prev, [key]: false }));
    }
  };

  const handleStartEdit = (position) => {
    setEditingPosition(position.ticket);
    setEditValues({ sl: position.sl || '', tp: position.tp || '' });
    setPositionsError(null);
  };

  const handleCancelEdit = () => {
    setEditingPosition(null);
    setEditValues({ sl: '', tp: '' });
  };

  const handleSaveModify = async (accountNumber, ticket) => {
    const key = `modify_${ticket}`;
    try {
      setActionLoading(prev => ({ ...prev, [key]: true }));
      const result = await apiService.modifyPosition(
        accountNumber,
        ticket,
        editValues.sl !== '' ? parseFloat(editValues.sl) : null,
        editValues.tp !== '' ? parseFloat(editValues.tp) : null
      );
      if (result.success) {
        setEditingPosition(null);
        setNotification({ message: `Posición #${ticket} modificada correctamente`, type: 'success' });
        await fetchPositions();
      } else {
        setNotification({ message: result.message || 'Error al modificar posición', type: 'error' });
      }
    } catch (err) {
      setNotification({ message: err.message, type: 'error' });
    } finally {
      setActionLoading(prev => ({ ...prev, [key]: false }));
    }
  };

  const handleAction = async (action) => {
    setShowConfirm(null);
    try {
      if (action === 'congelar') await onCongelar(versus.id);
      else if (action === 'transferir') await onTransferir(versus.id);
      else if (action === 'cancel') await onCancel(versus.id);
      else if (action === 'delete') await onDelete(versus.id);
    } catch (error) {
      // Error handled by parent
    }
  };

  const confirmMessages = {
    congelar: 'Esto abrirá 2 posiciones opuestas en la Cuenta A (BUY y SELL)',
    transferir: 'Esto cerrará la posición opuesta en la Cuenta A y abrirá 2 posiciones en la Cuenta B',
    cancel: 'Esto cancelará este Versus. Las posiciones abiertas NO se cerrarán automáticamente.',
    delete: 'Esto eliminará permanentemente este Versus del historial.',
  };

  const allPositions = [
    ...positionsA.map(p => ({ ...p, _account: versus.account_a, _label: 'A' })),
    ...positionsB.map(p => ({ ...p, _account: versus.account_b, _label: 'B' })),
  ];

  const totalProfit = allPositions.reduce((sum, p) => sum + (p.profit || 0), 0);

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
      {notification && (
        <Notification
          message={notification.message}
          type={notification.type}
          duration={3000}
          onClose={() => setNotification(null)}
        />
      )}
      <div
        className="versus-modal-content"
        style={{
          backgroundColor: 'var(--bg-surface)',
          borderRadius: '16px',
          maxWidth: '900px',
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
            .versus-modal-content {
              border-radius: 0 !important;
              max-height: 100vh !important;
              height: 100vh !important;
            }
            .versus-comparison-grid {
              grid-template-columns: 1fr !important;
              gap: 0 !important;
            }
            .versus-center-panel {
              border-left: none !important;
              border-right: none !important;
              border-top: 1px solid var(--border-color) !important;
              border-bottom: 1px solid var(--border-color) !important;
            }
            .versus-positions-table {
              font-size: 11px !important;
            }
          }
          @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.4; }
          }
        `}</style>

        {/* Header */}
        <div style={{
          padding: '20px 24px',
          borderBottom: '1px solid var(--border-color)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          backgroundColor: 'var(--bg-header)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '36px',
              height: '36px',
              borderRadius: '10px',
              backgroundColor: 'rgba(19, 91, 236, 0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '12px',
              fontWeight: '700',
              color: 'var(--primary)',
            }}>
              VS
            </div>
            <div>
              <h2 style={{
                margin: 0,
                fontSize: '18px',
                fontWeight: '700',
                color: 'var(--text-primary)',
                letterSpacing: '-0.02em',
              }}>
                Versus #{versus.id} — {versus.symbol}
              </h2>
            </div>
            <span style={{
              padding: '4px 10px',
              borderRadius: '9999px',
              fontSize: '11px',
              fontWeight: '600',
              backgroundColor: status.bg,
              color: status.text,
              textTransform: 'uppercase',
            }}>
              {status.label}
            </span>
          </div>
          <button
            onClick={onClose}
            style={{
              width: '36px',
              height: '36px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: 'var(--bg-surface-hover)',
              color: 'var(--text-secondary)',
              border: 'none',
              borderRadius: '10px',
              fontSize: '20px',
              cursor: 'pointer',
            }}
          >
            ×
          </button>
        </div>

        {/* Scrollable Content */}
        <div style={{ flex: 1, overflow: 'auto' }}>
          {/* 3-column comparison */}
          <div
            className="versus-comparison-grid"
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr auto 1fr',
              gap: '0',
              padding: '0',
            }}
          >
            <AccountPanel
              label="Cuenta A"
              accountNumber={versus.account_a}
              accountInfo={accountInfoA}
              side={versus.side}
              sideColor={versus.side === 'BUY' ? 'var(--green)' : 'var(--red)'}
              tickets={versus.tickets_a}
            />

            <div
              className="versus-center-panel"
              style={{
                padding: '24px 20px',
                borderLeft: '1px solid var(--border-color)',
                borderRight: '1px solid var(--border-color)',
                display: 'flex',
                flexDirection: 'column',
                gap: '16px',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: 'var(--bg-header)',
                minWidth: '160px',
              }}
            >
              <InfoItem label="Símbolo" value={versus.symbol} mono />
              <InfoItem label="Lado A" value={versus.side} valueColor={versus.side === 'BUY' ? 'var(--green)' : 'var(--red)'} />
              <InfoItem label="Lado B" value={oppositeSide} valueColor={oppositeSide === 'BUY' ? 'var(--green)' : 'var(--red)'} />
              <InfoItem label="Lotes" value={`${versus.lots}L`} mono />
              {versus.tp_a != null && <InfoItem label="TP (A)" value={versus.tp_a} mono />}
              {versus.sl_a != null && <InfoItem label="SL (A)" value={versus.sl_a} mono />}
              {versus.tp_b != null && <InfoItem label="TP (B)" value={versus.tp_b} mono />}
              {versus.sl_b != null && <InfoItem label="SL (B)" value={versus.sl_b} mono />}
            </div>

            <AccountPanel
              label="Cuenta B"
              accountNumber={versus.account_b}
              accountInfo={accountInfoB}
              side={oppositeSide}
              sideColor={oppositeSide === 'BUY' ? 'var(--green)' : 'var(--red)'}
              tickets={versus.tickets_b}
            />
          </div>

          {/* Open Positions Section */}
          <div style={{ padding: '20px 24px' }}>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '12px',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{
                  fontSize: '12px',
                  fontWeight: '600',
                  color: 'var(--text-muted)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                }}>
                  Posiciones Abiertas
                </span>
                {allPositions.length > 0 && (
                  <span style={{
                    padding: '2px 8px',
                    borderRadius: '10px',
                    fontSize: '10px',
                    fontWeight: '600',
                    backgroundColor: 'var(--primary)',
                    color: 'white',
                  }}>
                    {allPositions.length}
                  </span>
                )}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                {allPositions.length > 0 && (
                  <span style={{
                    fontSize: '13px',
                    fontWeight: '700',
                    fontFamily: 'var(--font-mono)',
                    color: totalProfit >= 0 ? 'var(--green)' : 'var(--red)',
                  }}>
                    {totalProfit >= 0 ? '+' : ''}${totalProfit.toFixed(2)}
                  </span>
                )}
                <button
                  onClick={fetchPositions}
                  disabled={positionsLoading}
                  style={{
                    padding: '4px 10px',
                    backgroundColor: 'var(--bg-dark)',
                    color: 'var(--text-secondary)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '6px',
                    fontSize: '11px',
                    cursor: positionsLoading ? 'not-allowed' : 'pointer',
                    opacity: positionsLoading ? 0.6 : 1,
                  }}
                >
                  {positionsLoading ? '...' : 'Actualizar'}
                </button>
              </div>
            </div>

            {positionsError && (
              <div style={{
                padding: '10px 14px',
                backgroundColor: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.2)',
                borderRadius: '8px',
                color: 'var(--red)',
                fontSize: '12px',
                marginBottom: '12px',
              }}>
                {positionsError}
              </div>
            )}

            {positionsLoading && allPositions.length === 0 ? (
              <div style={{
                textAlign: 'center',
                padding: '32px',
                color: 'var(--text-muted)',
                fontSize: '13px',
              }}>
                <div style={{
                  width: '24px',
                  height: '24px',
                  border: '2px solid var(--border-color)',
                  borderTopColor: 'var(--primary)',
                  borderRadius: '50%',
                  animation: 'spin 1s linear infinite',
                  margin: '0 auto 10px',
                }} />
                Cargando posiciones...
              </div>
            ) : allPositions.length === 0 ? (
              <div style={{
                textAlign: 'center',
                padding: '32px',
                color: 'var(--text-muted)',
                fontSize: '13px',
                backgroundColor: 'var(--bg-dark)',
                borderRadius: '8px',
                border: '1px solid var(--border-color)',
              }}>
                Sin posiciones abiertas
              </div>
            ) : (
              <div style={{
                borderRadius: '8px',
                border: '1px solid var(--border-color)',
                overflow: 'hidden',
                backgroundColor: 'var(--bg-dark)',
              }}>
                <div style={{ overflowX: 'auto' }}>
                  <table className="versus-positions-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                    <thead>
                      <tr style={{ backgroundColor: 'var(--bg-header)' }}>
                        <th style={thStyle}>Cuenta</th>
                        <th style={thStyle}>Símbolo</th>
                        <th style={thStyle}>Tipo</th>
                        <th style={thStyle}>Lotes</th>
                        <th style={thStyle}>Apertura</th>
                        <th style={thStyle}>S/L</th>
                        <th style={thStyle}>T/P</th>
                        <th style={{ ...thStyle, textAlign: 'right' }}>P/L</th>
                        <th style={{ ...thStyle, textAlign: 'center' }}>Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {allPositions.map((pos) => (
                        <tr
                          key={`${pos._label}-${pos.ticket}`}
                          style={{ borderBottom: '1px solid var(--border-color)' }}
                        >
                          <td style={tdStyle}>
                            <span style={{
                              padding: '2px 6px',
                              borderRadius: '4px',
                              fontSize: '10px',
                              fontWeight: '600',
                              backgroundColor: pos._label === 'A' ? 'rgba(139, 92, 246, 0.15)' : 'rgba(236, 72, 153, 0.15)',
                              color: pos._label === 'A' ? '#a78bfa' : '#f472b6',
                            }}>
                              {pos._label}
                            </span>
                            <span style={{
                              marginLeft: '6px',
                              fontSize: '11px',
                              fontFamily: 'var(--font-mono)',
                              color: 'var(--text-secondary)',
                            }}>
                              #{pos._account}
                            </span>
                          </td>
                          <td style={tdStyle}>
                            <span style={{ fontWeight: '600', fontFamily: 'var(--font-mono)' }}>
                              {pos.symbol}
                            </span>
                          </td>
                          <td style={tdStyle}>
                            <span style={{
                              padding: '2px 8px',
                              borderRadius: '4px',
                              fontSize: '10px',
                              fontWeight: '700',
                              textTransform: 'uppercase',
                              backgroundColor: pos.type === 'BUY' ? 'rgba(11, 218, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                              color: pos.type === 'BUY' ? 'var(--green)' : 'var(--red)',
                            }}>
                              {pos.type}
                            </span>
                          </td>
                          <td style={{ ...tdStyle, fontFamily: 'var(--font-mono)' }}>
                            {pos.volume}
                          </td>
                          <td style={{ ...tdStyle, fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>
                            {pos.open_price?.toFixed(5)}
                          </td>
                          {/* SL */}
                          <td style={tdStyle}>
                            {editingPosition === pos.ticket ? (
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
                                color: pos.sl ? 'var(--red)' : 'var(--text-muted)',
                              }}>
                                {pos.sl ? pos.sl.toFixed(5) : '-'}
                              </span>
                            )}
                          </td>
                          {/* TP */}
                          <td style={tdStyle}>
                            {editingPosition === pos.ticket ? (
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
                                color: pos.tp ? 'var(--green)' : 'var(--text-muted)',
                              }}>
                                {pos.tp ? pos.tp.toFixed(5) : '-'}
                              </span>
                            )}
                          </td>
                          {/* P/L */}
                          <td style={{
                            ...tdStyle,
                            textAlign: 'right',
                            fontWeight: '700',
                            fontFamily: 'var(--font-mono)',
                            color: (pos.profit || 0) >= 0 ? 'var(--green)' : 'var(--red)',
                          }}>
                            {(pos.profit || 0) >= 0 ? '+' : ''}${(pos.profit || 0).toFixed(2)}
                          </td>
                          {/* Actions */}
                          <td style={{ ...tdStyle, textAlign: 'center' }}>
                            {editingPosition === pos.ticket ? (
                              <div style={{ display: 'flex', gap: '4px', justifyContent: 'center' }}>
                                <button
                                  onClick={() => handleSaveModify(pos._account, pos.ticket)}
                                  disabled={actionLoading[`modify_${pos.ticket}`]}
                                  style={actionBtnStyle('var(--green)')}
                                  title="Guardar"
                                >
                                  {actionLoading[`modify_${pos.ticket}`] ? '...' : '✓'}
                                </button>
                                <button
                                  onClick={handleCancelEdit}
                                  style={actionBtnStyle('var(--text-muted)')}
                                  title="Cancelar"
                                >
                                  ✕
                                </button>
                              </div>
                            ) : (
                              <div style={{ display: 'flex', gap: '4px', justifyContent: 'center' }}>
                                <button
                                  onClick={() => handleStartEdit(pos)}
                                  style={actionBtnStyle('var(--primary)')}
                                  title="Modificar SL/TP"
                                >
                                  ✎
                                </button>
                                <button
                                  onClick={() => handleClosePosition(pos._account, pos.ticket)}
                                  disabled={actionLoading[`close_${pos.ticket}`]}
                                  style={actionBtnStyle('var(--red)')}
                                  title="Cerrar posición"
                                >
                                  {actionLoading[`close_${pos.ticket}`] ? '...' : '✕'}
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
            )}
          </div>

          {/* Info Bar */}
          <div style={{
            padding: '14px 24px',
            backgroundColor: 'var(--bg-header)',
            borderTop: '1px solid var(--border-color)',
            display: 'flex',
            flexWrap: 'wrap',
            gap: '16px',
            fontSize: '12px',
            color: 'var(--text-muted)',
          }}>
            <span>Creado: {formatDate(versus.created_at)}</span>
            {versus.scheduled_congelar && versus.status === 'pending' && (
              <span style={{ color: 'var(--primary)' }}>
                Congelar: {formatDate(versus.scheduled_congelar)}
              </span>
            )}
            {versus.scheduled_transferir && (versus.status === 'pending' || versus.status === 'congelado') && (
              <span style={{ color: '#10b981' }}>
                Transferir: {formatDate(versus.scheduled_transferir)}
              </span>
            )}
          </div>

          {/* Error Section */}
          {versus.error_message && (
            <div style={{
              margin: '0 24px 20px',
              padding: '14px 16px',
              backgroundColor: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.2)',
              borderRadius: '8px',
            }}>
              <div style={{ fontSize: '11px', color: 'var(--red)', fontWeight: '600', marginBottom: '4px', textTransform: 'uppercase' }}>
                Error
              </div>
              <div style={{ fontSize: '13px', color: 'var(--red)', opacity: 0.9, lineHeight: '1.5' }}>
                {versus.error_message}
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div style={{
          padding: '16px 24px',
          borderTop: '1px solid var(--border-color)',
          backgroundColor: 'var(--bg-header)',
        }}>
          {showConfirm ? (
            <div style={{
              padding: '16px',
              backgroundColor: 'rgba(251, 191, 36, 0.1)',
              borderRadius: '8px',
              border: '1px solid rgba(251, 191, 36, 0.3)',
            }}>
              <div style={{
                fontSize: '14px',
                fontWeight: '600',
                color: '#fbbf24',
                marginBottom: '6px',
              }}>
                Confirmar {showConfirm === 'congelar' ? 'Congelar' : showConfirm === 'transferir' ? 'Transferir' : showConfirm === 'delete' ? 'Eliminar' : 'Cancelar'}
              </div>
              <div style={{
                fontSize: '13px',
                color: 'var(--text-secondary)',
                marginBottom: '12px',
                lineHeight: '1.5',
              }}>
                {confirmMessages[showConfirm]}
              </div>
              <div style={{ display: 'flex', gap: '12px' }}>
                <button
                  onClick={() => setShowConfirm(null)}
                  disabled={loading}
                  className="btn btn-secondary"
                  style={{ flex: 1 }}
                >
                  Volver
                </button>
                <button
                  onClick={() => handleAction(showConfirm)}
                  disabled={loading}
                  className={`btn ${showConfirm === 'cancel' || showConfirm === 'delete' ? 'btn-danger' : 'btn-primary'}`}
                  style={{ flex: 1 }}
                >
                  {loading ? 'Procesando...' : 'Confirmar'}
                </button>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
              {versus.status === 'pending' && (
                <>
                  <button
                    onClick={() => setShowConfirm('congelar')}
                    disabled={loading}
                    className="btn btn-primary"
                    style={{ flex: 1, minWidth: '120px' }}
                  >
                    Congelar
                  </button>
                  <button
                    onClick={() => setShowConfirm('cancel')}
                    disabled={loading}
                    className="btn btn-danger-outline"
                    style={{ flex: 1, minWidth: '120px' }}
                  >
                    Cancelar
                  </button>
                </>
              )}

              {versus.status === 'congelado' && (
                <>
                  <button
                    onClick={() => setShowConfirm('transferir')}
                    disabled={loading}
                    className="btn btn-success"
                    style={{ flex: 1, minWidth: '120px' }}
                  >
                    Transferir
                  </button>
                  <button
                    onClick={() => setShowConfirm('cancel')}
                    disabled={loading}
                    className="btn btn-danger-outline"
                    style={{ flex: 1, minWidth: '120px' }}
                  >
                    Cancelar
                  </button>
                </>
              )}

              {versus.status === 'error' && (
                <button
                  onClick={() => setShowConfirm('cancel')}
                  disabled={loading}
                  className="btn btn-danger-outline"
                  style={{ flex: 1 }}
                >
                  Cancelar
                </button>
              )}

              {(versus.status === 'transferido' || versus.status === 'completed') && (
                <button
                  onClick={() => setShowConfirm('delete')}
                  disabled={loading}
                  className="btn btn-danger-outline"
                  style={{ flex: 1 }}
                >
                  Eliminar
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const AccountPanel = ({ label, accountNumber, accountInfo, side, sideColor, tickets }) => (
  <div style={{
    padding: '24px 20px',
    display: 'flex',
    flexDirection: 'column',
    gap: '14px',
  }}>
    <div style={{
      fontSize: '11px',
      fontWeight: '600',
      color: 'var(--text-muted)',
      textTransform: 'uppercase',
      letterSpacing: '0.05em',
    }}>
      {label}
    </div>

    <div style={{
      padding: '4px 10px',
      borderRadius: '6px',
      fontSize: '16px',
      fontWeight: '700',
      color: 'var(--text-primary)',
      fontFamily: 'var(--font-mono)',
      backgroundColor: 'var(--bg-dark)',
      border: '1px solid var(--border-color)',
      width: 'fit-content',
    }}>
      #{accountNumber}
    </div>

    {accountInfo?.firm && (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Firma</span>
        <span style={{ fontSize: '13px', color: 'var(--text-secondary)', fontWeight: '500' }}>
          {accountInfo.firm}
        </span>
      </div>
    )}

    {accountInfo?.holder && (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Titular</span>
        <span style={{ fontSize: '13px', color: 'var(--text-secondary)', fontWeight: '500' }}>
          {accountInfo.holder}
        </span>
      </div>
    )}

    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
      <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Lado</span>
      <span style={{ fontSize: '13px', fontWeight: '700', color: sideColor }}>
        {side}
      </span>
    </div>

    {tickets?.length > 0 && (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Tickets</span>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
          {tickets.map(t => (
            <span key={t} style={{
              padding: '2px 8px',
              borderRadius: '4px',
              fontSize: '11px',
              fontFamily: 'var(--font-mono)',
              backgroundColor: 'var(--bg-dark)',
              color: 'var(--text-secondary)',
              border: '1px solid var(--border-color)',
            }}>
              {t}
            </span>
          ))}
        </div>
      </div>
    )}
  </div>
);

const InfoItem = ({ label, value, mono, valueColor }) => (
  <div style={{ textAlign: 'center', width: '100%' }}>
    <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginBottom: '2px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
      {label}
    </div>
    <div style={{
      fontSize: '14px',
      fontWeight: '600',
      color: valueColor || 'var(--text-primary)',
      fontFamily: mono ? 'var(--font-mono)' : 'inherit',
    }}>
      {value}
    </div>
  </div>
);

const thStyle = {
  padding: '10px 14px',
  textAlign: 'left',
  fontWeight: '600',
  fontSize: '10px',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  color: 'var(--text-muted)',
  borderBottom: '1px solid var(--border-color)',
};

const tdStyle = {
  padding: '10px 14px',
  color: 'var(--text-primary)',
  fontSize: '13px',
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

export default VersusDetailModal;
