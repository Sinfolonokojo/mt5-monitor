import { formatCurrency, calculateProfitLoss, calculateMaxLoss } from '../utils/formatters';

const AccountDetailsModal = ({ account, onClose, vsGroup }) => {
  if (!account) return null;

  const initialBalance = account.initial_balance || 100000;
  const profitLoss = calculateProfitLoss(account.balance, initialBalance);
  const maxLoss = calculateMaxLoss(account.balance, initialBalance);
  const plColor = profitLoss >= 0 ? '#22c55e' : '#ef4444';
  const maxLossColor = maxLoss >= 0 ? '#22c55e' : '#ef4444';

  // Calculate profit/loss percentage
  const plPercentage = ((profitLoss / initialBalance) * 100).toFixed(2);

  // Calculate max drawdown percentage
  const maxDrawdownLimit = initialBalance * 0.10; // 10% max drawdown
  const currentDrawdown = initialBalance - account.balance;
  const drawdownPercentage = ((currentDrawdown / initialBalance) * 100).toFixed(2);
  const drawdownRemaining = maxDrawdownLimit - currentDrawdown;

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
          maxWidth: '600px',
          width: '100%',
          maxHeight: '90vh',
          overflow: 'auto',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
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
          }}
        >
          <h2 style={{ margin: 0, fontSize: '24px', fontWeight: '700', color: '#111827' }}>
            Detalles de la Cuenta
          </h2>
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

        {/* Content */}
        <div style={{ padding: '24px' }}>
          {/* Account Info Section */}
          <div style={{ marginBottom: '24px' }}>
            <h3 style={{ fontSize: '18px', fontWeight: '600', color: '#374151', marginBottom: '16px' }}>
              Información de la Cuenta
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <InfoItem label="Número de Cuenta" value={account.account_number} />
              <InfoItem label="Titular" value={account.account_holder || 'Desconocido'} />
              <InfoItem label="Firma Prop" value={account.prop_firm || 'N/A'} />
              <InfoItem label="Fase" value={account.phase} />
              <InfoItem
                label="Estado"
                value={account.status === 'connected' ? 'Conectado' : 'Desconectado'}
                valueColor={account.status === 'connected' ? '#22c55e' : '#ef4444'}
              />
              <InfoItem label="Días Operando" value={account.days_operating} />
              <InfoItem
                label="Posición Abierta"
                value={account.has_open_position ? 'Sí' : 'No'}
                valueColor={account.has_open_position ? '#22c55e' : '#6b7280'}
              />
              {vsGroup && <InfoItem label="Grupo VS" value={vsGroup} />}
            </div>
          </div>

          {/* Financial Info Section */}
          <div style={{ marginBottom: '24px' }}>
            <h3 style={{ fontSize: '18px', fontWeight: '600', color: '#374151', marginBottom: '16px' }}>
              Información Financiera
            </h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <InfoItem label="Balance Inicial" value={formatCurrency(initialBalance)} />
              <InfoItem label="Balance Actual" value={formatCurrency(account.balance)} />
              <InfoItem
                label="Ganancia/Pérdida"
                value={`${profitLoss >= 0 ? '+' : ''}${formatCurrency(profitLoss)} (${plPercentage}%)`}
                valueColor={plColor}
                bold
              />
              <InfoItem
                label="Pérdida Máxima"
                value={formatCurrency(maxLoss)}
                valueColor={maxLossColor}
                bold
              />
            </div>
          </div>

          {/* Risk Metrics Section */}
          <div style={{ marginBottom: '24px' }}>
            <h3 style={{ fontSize: '18px', fontWeight: '600', color: '#374151', marginBottom: '16px' }}>
              Métricas de Riesgo
            </h3>
            <div style={{ marginBottom: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ fontSize: '14px', color: '#6b7280' }}>Drawdown Actual</span>
                <span style={{ fontSize: '14px', fontWeight: '600', color: drawdownPercentage > 8 ? '#ef4444' : '#6b7280' }}>
                  {drawdownPercentage}%
                </span>
              </div>
              <div style={{
                width: '100%',
                height: '12px',
                backgroundColor: '#e5e7eb',
                borderRadius: '6px',
                overflow: 'hidden',
              }}>
                <div style={{
                  width: `${Math.min(parseFloat(drawdownPercentage), 10) * 10}%`,
                  height: '100%',
                  backgroundColor: drawdownPercentage > 8 ? '#ef4444' : drawdownPercentage > 5 ? '#f59e0b' : '#22c55e',
                  transition: 'width 0.3s ease',
                }} />
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <InfoItem
                label="Drawdown Restante"
                value={formatCurrency(Math.max(0, drawdownRemaining))}
                valueColor={drawdownRemaining < 1000 ? '#ef4444' : '#22c55e'}
              />
              <InfoItem
                label="Límite de Drawdown"
                value={formatCurrency(maxDrawdownLimit)}
              />
            </div>
          </div>

          {/* Last Updated */}
          <div style={{
            padding: '12px',
            backgroundColor: '#f9fafb',
            borderRadius: '8px',
            fontSize: '14px',
            color: '#6b7280',
            textAlign: 'center',
          }}>
            Última actualización: {new Date(account.last_updated || Date.now()).toLocaleString('es-ES')}
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '16px 24px',
            borderTop: '1px solid #e5e7eb',
            display: 'flex',
            justifyContent: 'flex-end',
          }}
        >
          <button
            onClick={onClose}
            style={{
              padding: '10px 24px',
              backgroundColor: '#3b82f6',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              fontSize: '14px',
              fontWeight: '600',
              cursor: 'pointer',
              transition: 'background-color 0.2s',
            }}
            onMouseEnter={(e) => e.target.style.backgroundColor = '#2563eb'}
            onMouseLeave={(e) => e.target.style.backgroundColor = '#3b82f6'}
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
};

const InfoItem = ({ label, value, valueColor, bold }) => {
  return (
    <div>
      <div style={{ fontSize: '12px', color: '#9ca3af', marginBottom: '4px', fontWeight: '500' }}>
        {label}
      </div>
      <div style={{
        fontSize: '14px',
        color: valueColor || '#111827',
        fontWeight: bold ? '700' : '500',
      }}>
        {value}
      </div>
    </div>
  );
};

export default AccountDetailsModal;
