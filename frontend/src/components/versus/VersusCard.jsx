import { useState } from 'react';

const VersusCard = ({ versus, onCongelar, onTransferir, onCancel, loading }) => {
  const [showConfirm, setShowConfirm] = useState(null); // 'congelar' | 'transferir' | 'cancel'

  const statusColors = {
    pending: { bg: '#fef3c7', text: '#92400e', label: 'Pendiente' },
    congelado: { bg: '#dbeafe', text: '#1e40af', label: 'Congelado' },
    transferido: { bg: '#d1fae5', text: '#065f46', label: 'Transferido' },
    completed: { bg: '#f3f4f6', text: '#374151', label: 'Completado' },
    error: { bg: '#fee2e2', text: '#dc2626', label: 'Error' }
  };

  const status = statusColors[versus.status] || statusColors.pending;

  const handleAction = async (action) => {
    setShowConfirm(null);
    try {
      if (action === 'congelar') {
        await onCongelar(versus.id);
      } else if (action === 'transferir') {
        await onTransferir(versus.id);
      } else if (action === 'cancel') {
        await onCancel(versus.id);
      }
    } catch (error) {
      // Error is handled by parent
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return '-';
    return new Date(dateString).toLocaleString('es-ES', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  return (
    <div
      style={{
        backgroundColor: 'white',
        borderRadius: '12px',
        boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
        padding: '20px',
        marginBottom: '16px',
        border: '1px solid #e5e7eb',
      }}
    >
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontSize: '18px', fontWeight: '600', color: '#111827' }}>
              Versus #{versus.id}
            </span>
            <span
              style={{
                padding: '4px 12px',
                borderRadius: '9999px',
                fontSize: '12px',
                fontWeight: '500',
                backgroundColor: status.bg,
                color: status.text,
              }}
            >
              {status.label}
            </span>
          </div>
          <div style={{ fontSize: '14px', color: '#6b7280', marginTop: '4px' }}>
            Creado: {formatDate(versus.created_at)}
          </div>
        </div>

        <div
          style={{
            padding: '8px 16px',
            borderRadius: '8px',
            backgroundColor: versus.side === 'BUY' ? '#dcfce7' : '#fee2e2',
            color: versus.side === 'BUY' ? '#166534' : '#dc2626',
            fontWeight: '600',
            fontSize: '14px',
          }}
        >
          {versus.side} {versus.lots} lots
        </div>
      </div>

      {/* Details Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '16px', marginBottom: '16px' }}>
        <div>
          <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>Cuenta A</div>
          <div style={{ fontSize: '14px', fontWeight: '500', color: '#111827' }}>#{versus.account_a}</div>
        </div>
        <div>
          <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>Cuenta B</div>
          <div style={{ fontSize: '14px', fontWeight: '500', color: '#111827' }}>#{versus.account_b}</div>
        </div>
        <div>
          <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>Simbolo</div>
          <div style={{ fontSize: '14px', fontWeight: '500', color: '#111827' }}>{versus.symbol}</div>
        </div>
        <div>
          <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>TP / SL (pips)</div>
          <div style={{ fontSize: '14px', fontWeight: '500', color: '#111827' }}>
            <span style={{ color: '#22c55e' }}>{versus.tp_pips}</span> / <span style={{ color: '#ef4444' }}>{versus.sl_pips}</span>
          </div>
        </div>
      </div>

      {/* Tickets Info */}
      {(versus.tickets_a?.length > 0 || versus.tickets_b?.length > 0) && (
        <div style={{ padding: '12px', backgroundColor: '#f9fafb', borderRadius: '8px', marginBottom: '16px' }}>
          <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '8px' }}>Tickets</div>
          <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
            {versus.tickets_a?.length > 0 && (
              <div>
                <span style={{ fontSize: '12px', color: '#6b7280' }}>Cuenta A: </span>
                <span style={{ fontSize: '14px', fontWeight: '500' }}>{versus.tickets_a.join(', ')}</span>
              </div>
            )}
            {versus.tickets_b?.length > 0 && (
              <div>
                <span style={{ fontSize: '12px', color: '#6b7280' }}>Cuenta B: </span>
                <span style={{ fontSize: '14px', fontWeight: '500' }}>{versus.tickets_b.join(', ')}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Scheduled Info */}
      {versus.scheduled_congelar && versus.status === 'pending' && (
        <div style={{ padding: '12px', backgroundColor: '#eff6ff', borderRadius: '8px', marginBottom: '16px' }}>
          <div style={{ fontSize: '12px', color: '#1e40af' }}>
            Congelar programado para: {formatDate(versus.scheduled_congelar)}
          </div>
        </div>
      )}

      {/* Error Message */}
      {versus.error_message && (
        <div style={{ padding: '12px', backgroundColor: '#fee2e2', borderRadius: '8px', marginBottom: '16px' }}>
          <div style={{ fontSize: '12px', color: '#dc2626', fontWeight: '500' }}>Error:</div>
          <div style={{ fontSize: '13px', color: '#b91c1c' }}>{versus.error_message}</div>
        </div>
      )}

      {/* Actions */}
      {showConfirm ? (
        <div style={{ padding: '16px', backgroundColor: '#fef3c7', borderRadius: '8px', border: '1px solid #fde68a' }}>
          <div style={{ fontSize: '14px', fontWeight: '600', color: '#92400e', marginBottom: '8px' }}>
            Confirmar {showConfirm === 'congelar' ? 'Congelar' : showConfirm === 'transferir' ? 'Transferir' : 'Cancelar'}
          </div>
          <div style={{ fontSize: '13px', color: '#78350f', marginBottom: '12px' }}>
            {showConfirm === 'congelar' && 'Se abriran 2 posiciones opuestas en Cuenta A (BUY y SELL)'}
            {showConfirm === 'transferir' && 'Se cerrara la posicion opuesta en Cuenta A y se abriran 2 posiciones en Cuenta B'}
            {showConfirm === 'cancel' && 'Se cancelara este Versus. Las posiciones abiertas NO se cerraran automaticamente.'}
          </div>
          <div style={{ display: 'flex', gap: '12px' }}>
            <button
              onClick={() => setShowConfirm(null)}
              disabled={loading}
              style={{
                flex: 1,
                padding: '10px',
                backgroundColor: '#f3f4f6',
                color: '#374151',
                border: 'none',
                borderRadius: '6px',
                fontSize: '14px',
                fontWeight: '500',
                cursor: 'pointer',
              }}
            >
              Volver
            </button>
            <button
              onClick={() => handleAction(showConfirm)}
              disabled={loading}
              style={{
                flex: 1,
                padding: '10px',
                backgroundColor: showConfirm === 'cancel' ? '#dc2626' : '#3b82f6',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                fontSize: '14px',
                fontWeight: '500',
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.6 : 1,
              }}
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
                style={{
                  padding: '10px 20px',
                  backgroundColor: '#3b82f6',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '14px',
                  fontWeight: '500',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  opacity: loading ? 0.6 : 1,
                }}
              >
                Congelar
              </button>
              <button
                onClick={() => setShowConfirm('cancel')}
                disabled={loading}
                style={{
                  padding: '10px 20px',
                  backgroundColor: '#f3f4f6',
                  color: '#dc2626',
                  border: '1px solid #fecaca',
                  borderRadius: '6px',
                  fontSize: '14px',
                  fontWeight: '500',
                  cursor: loading ? 'not-allowed' : 'pointer',
                }}
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
                style={{
                  padding: '10px 20px',
                  backgroundColor: '#22c55e',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '14px',
                  fontWeight: '500',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  opacity: loading ? 0.6 : 1,
                }}
              >
                Transferir
              </button>
              <button
                onClick={() => setShowConfirm('cancel')}
                disabled={loading}
                style={{
                  padding: '10px 20px',
                  backgroundColor: '#f3f4f6',
                  color: '#dc2626',
                  border: '1px solid #fecaca',
                  borderRadius: '6px',
                  fontSize: '14px',
                  fontWeight: '500',
                  cursor: loading ? 'not-allowed' : 'pointer',
                }}
              >
                Cancelar
              </button>
            </>
          )}

          {versus.status === 'error' && (
            <button
              onClick={() => setShowConfirm('cancel')}
              disabled={loading}
              style={{
                padding: '10px 20px',
                backgroundColor: '#f3f4f6',
                color: '#dc2626',
                border: '1px solid #fecaca',
                borderRadius: '6px',
                fontSize: '14px',
                fontWeight: '500',
                cursor: loading ? 'not-allowed' : 'pointer',
              }}
            >
              Eliminar
            </button>
          )}

          {(versus.status === 'transferido' || versus.status === 'completed') && (
            <div style={{ fontSize: '14px', color: '#6b7280', fontStyle: 'italic' }}>
              No hay acciones disponibles
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default VersusCard;
