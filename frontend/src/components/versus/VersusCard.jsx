import { useState } from 'react';

const VersusCard = ({ versus, accounts = [], onCongelar, onTransferir, onCancel, onDelete, loading }) => {
  const [showConfirm, setShowConfirm] = useState(null);

  const getAccountInfo = (accountNumber) => {
    const acc = accounts.find(a => a.account_number === accountNumber);
    if (!acc) return null;
    return { holder: acc.account_holder, firm: acc.prop_firm };
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

  const handleAction = async (action) => {
    setShowConfirm(null);
    try {
      if (action === 'congelar') {
        await onCongelar(versus.id);
      } else if (action === 'transferir') {
        await onTransferir(versus.id);
      } else if (action === 'cancel') {
        await onCancel(versus.id);
      } else if (action === 'delete') {
        await onDelete(versus.id);
      }
    } catch (error) {
      // Error is handled by parent
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleString('es-ES', {
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div style={{
      backgroundColor: 'var(--bg-surface)',
      borderRadius: '12px',
      border: '1px solid var(--border-color)',
      overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        padding: '16px 20px',
        borderBottom: '1px solid var(--border-color)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <span style={{
            fontSize: '16px',
            fontWeight: '600',
            color: 'var(--text-primary)',
            fontFamily: 'var(--font-mono)',
          }}>
            VS-{versus.id}
          </span>
          <span style={{
            padding: '4px 10px',
            borderRadius: '9999px',
            fontSize: '11px',
            fontWeight: '600',
            backgroundColor: status.bg,
            color: status.text,
            textTransform: 'uppercase',
            letterSpacing: '0.02em',
          }}>
            {status.label}
          </span>
        </div>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '6px 12px',
          borderRadius: '6px',
          backgroundColor: versus.side === 'BUY' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)',
          color: versus.side === 'BUY' ? 'var(--green)' : 'var(--red)',
          fontSize: '13px',
          fontWeight: '600',
          fontFamily: 'var(--font-mono)',
        }}>
          {versus.side} {versus.lots}L
        </div>
      </div>

      {/* Account Comparison */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr auto 1fr',
        alignItems: 'center',
        padding: '20px',
      }}>
        {/* Account A */}
        <div style={{ textAlign: 'center' }}>
          <div style={{
            fontSize: '11px',
            fontWeight: '500',
            color: 'var(--text-muted)',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            marginBottom: '8px',
          }}>
            Cuenta A
          </div>
          {accountInfoA && (
            <div style={{
              fontSize: '11px',
              color: 'var(--text-secondary)',
              marginBottom: '4px',
              lineHeight: '1.4',
            }}>
              {accountInfoA.holder} - {accountInfoA.firm}
            </div>
          )}
          <div style={{
            fontSize: '18px',
            fontWeight: '600',
            color: 'var(--text-primary)',
            fontFamily: 'var(--font-mono)',
            marginBottom: '4px',
          }}>
            #{versus.account_a}
          </div>
          <div style={{
            fontSize: '12px',
            color: versus.side === 'BUY' ? 'var(--green)' : 'var(--red)',
            fontWeight: '500',
          }}>
            {versus.side}
          </div>
          {versus.tickets_a?.length > 0 && (
            <div style={{
              marginTop: '8px',
              fontSize: '11px',
              color: 'var(--text-muted)',
              fontFamily: 'var(--font-mono)',
            }}>
              Tickets: {versus.tickets_a.join(', ')}
            </div>
          )}
        </div>

        {/* VS Divider */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          padding: '0 24px',
        }}>
          <div style={{
            width: '40px',
            height: '40px',
            borderRadius: '50%',
            backgroundColor: 'var(--bg-header)',
            border: '2px solid var(--border-color)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '12px',
            fontWeight: '700',
            color: 'var(--primary)',
          }}>
            VS
          </div>
          <div style={{
            marginTop: '8px',
            padding: '4px 8px',
            backgroundColor: 'var(--bg-header)',
            borderRadius: '4px',
            fontSize: '11px',
            fontWeight: '500',
            color: 'var(--text-secondary)',
            fontFamily: 'var(--font-mono)',
          }}>
            {versus.symbol}
          </div>
        </div>

        {/* Account B */}
        <div style={{ textAlign: 'center' }}>
          <div style={{
            fontSize: '11px',
            fontWeight: '500',
            color: 'var(--text-muted)',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            marginBottom: '8px',
          }}>
            Cuenta B
          </div>
          {accountInfoB && (
            <div style={{
              fontSize: '11px',
              color: 'var(--text-secondary)',
              marginBottom: '4px',
              lineHeight: '1.4',
            }}>
              {accountInfoB.holder} - {accountInfoB.firm}
            </div>
          )}
          <div style={{
            fontSize: '18px',
            fontWeight: '600',
            color: 'var(--text-primary)',
            fontFamily: 'var(--font-mono)',
            marginBottom: '4px',
          }}>
            #{versus.account_b}
          </div>
          <div style={{
            fontSize: '12px',
            color: versus.side === 'BUY' ? 'var(--red)' : 'var(--green)',
            fontWeight: '500',
          }}>
            {versus.side === 'BUY' ? 'SELL' : 'BUY'}
          </div>
          {versus.tickets_b?.length > 0 && (
            <div style={{
              marginTop: '8px',
              fontSize: '11px',
              color: 'var(--text-muted)',
              fontFamily: 'var(--font-mono)',
            }}>
              Tickets: {versus.tickets_b.join(', ')}
            </div>
          )}
        </div>
      </div>

      {/* Info Bar */}
      <div style={{
        padding: '12px 20px',
        backgroundColor: 'var(--bg-header)',
        borderTop: '1px solid var(--border-color)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
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

      {/* Error Message */}
      {versus.error_message && (
        <div style={{
          padding: '12px 20px',
          backgroundColor: 'rgba(239, 68, 68, 0.1)',
          borderTop: '1px solid rgba(239, 68, 68, 0.2)',
        }}>
          <div style={{ fontSize: '11px', color: 'var(--red)', fontWeight: '600', marginBottom: '4px' }}>
            Error
          </div>
          <div style={{ fontSize: '13px', color: 'var(--red)', opacity: 0.9 }}>
            {versus.error_message}
          </div>
        </div>
      )}

      {/* Actions */}
      <div style={{
        padding: '16px 20px',
        borderTop: '1px solid var(--border-color)',
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
              marginBottom: '8px',
            }}>
              Confirmar {showConfirm === 'congelar' ? 'Congelar' : showConfirm === 'transferir' ? 'Transferir' : showConfirm === 'delete' ? 'Eliminar' : 'Cancelar'}
            </div>
            <div style={{
              fontSize: '13px',
              color: 'var(--text-secondary)',
              marginBottom: '12px',
              lineHeight: '1.5',
            }}>
              {showConfirm === 'congelar' && 'Esto abrirá 2 posiciones opuestas en la Cuenta A (BUY y SELL)'}
              {showConfirm === 'transferir' && 'Esto cerrará la posición opuesta en la Cuenta A y abrirá 2 posiciones en la Cuenta B'}
              {showConfirm === 'cancel' && 'Esto cancelará este Versus. Las posiciones abiertas NO se cerrarán automáticamente.'}
              {showConfirm === 'delete' && 'Esto eliminará permanentemente este Versus del historial.'}
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
                className={`btn ${showConfirm === 'cancel' ? 'btn-danger' : 'btn-primary'}`}
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
                Eliminar
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
  );
};

export default VersusCard;
