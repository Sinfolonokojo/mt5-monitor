import {
  formatCurrency,
  calculateProfitLoss,
  calculateMaxLoss,
  getRowBackgroundColor
} from '../utils/formatters';
import EditablePhase from './EditablePhase';
import EditableVS from './EditableVS';

const MobileAccountCard = ({ account, editMode, onPhaseUpdate, onVSUpdate, vsGroup, onCardClick }) => {
  const initialBalance = account.initial_balance || 100000;
  const profitLoss = calculateProfitLoss(account.balance, initialBalance);
  const maxLoss = calculateMaxLoss(account.balance, initialBalance);
  const rowBgColor = getRowBackgroundColor(account.balance, initialBalance);

  // Check for dark mode
  const isDarkMode = document.body.classList.contains('dark-mode');
  const greenColor = '#22c55e';
  const redColor = '#ef4444';

  const plColor = profitLoss >= 0 ? greenColor : redColor;
  const maxLossColor = maxLoss >= 0 ? greenColor : redColor;

  const handleCardClick = (e) => {
    // Don't trigger if clicking on editable elements
    if (e.target.tagName === 'SELECT' || e.target.tagName === 'INPUT' || e.target.closest('.editable-element')) {
      return;
    }
    onCardClick && onCardClick(account);
  };

  return (
    <div
      onClick={handleCardClick}
      style={{
        backgroundColor: 'white',
        borderRadius: '12px',
        padding: '16px',
        marginBottom: '12px',
        boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
        border: `3px solid ${rowBgColor}`,
        cursor: 'pointer',
        transition: 'all 0.2s',
        position: 'relative',
      }}
      onTouchStart={(e) => {
        e.currentTarget.style.transform = 'scale(0.98)';
      }}
      onTouchEnd={(e) => {
        e.currentTarget.style.transform = 'scale(1)';
      }}
    >
      {/* Header Row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: '18px', fontWeight: '700', color: '#111827', marginBottom: '4px' }}>
            {account.account_number}
          </div>
          <div style={{ fontSize: '14px', color: '#6b7280' }}>
            {account.account_holder || 'Unknown'}
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {/* Connection Status */}
          <div
            style={{
              width: '12px',
              height: '12px',
              borderRadius: '50%',
              backgroundColor: account.status === 'connected' ? greenColor : redColor,
              boxShadow: isDarkMode ? `0 0 8px ${account.status === 'connected' ? greenColor : redColor}` : 'none'
            }}
            title={account.status === 'connected' ? 'Conectado' : 'Desconectado'}
          />
          {/* Open Position Indicator */}
          {account.has_open_position && (
            <div
              style={{
                padding: '4px 8px',
                backgroundColor: '#dcfce7',
                color: '#166534',
                borderRadius: '6px',
                fontSize: '12px',
                fontWeight: '600',
              }}
            >
              📊 Abierto
            </div>
          )}
        </div>
      </div>

      {/* Prop Firm & Days */}
      <div style={{ display: 'flex', gap: '12px', marginBottom: '12px' }}>
        <div
          style={{
            padding: '6px 12px',
            backgroundColor: '#f3f4f6',
            borderRadius: '6px',
            fontSize: '13px',
            fontWeight: '600',
            color: '#374151',
          }}
        >
          {account.prop_firm || 'N/A'}
        </div>
        <div
          style={{
            padding: '6px 12px',
            backgroundColor: '#f3f4f6',
            borderRadius: '6px',
            fontSize: '13px',
            color: '#6b7280',
          }}
        >
          {account.days_operating} días
        </div>
      </div>

      {/* P/L Section */}
      <div style={{ marginBottom: '12px' }}>
        <div style={{ fontSize: '12px', color: '#9ca3af', marginBottom: '4px' }}>
          Ganancia/Pérdida
        </div>
        <div style={{ fontSize: '24px', fontWeight: '700', color: plColor }}>
          {profitLoss >= 0 ? '+' : ''}{formatCurrency(profitLoss)}
        </div>
      </div>

      {/* Max Loss */}
      <div style={{ marginBottom: '12px' }}>
        <div style={{ fontSize: '12px', color: '#9ca3af', marginBottom: '4px' }}>
          Pérdida Máxima
        </div>
        <div style={{ fontSize: '16px', fontWeight: '600', color: maxLossColor }}>
          {formatCurrency(maxLoss)}
        </div>
      </div>

      {/* Phase & VS Group */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', paddingTop: '12px', borderTop: '1px solid #e5e7eb' }}>
        <div>
          <div style={{ fontSize: '12px', color: '#9ca3af', marginBottom: '6px' }}>
            Fase
          </div>
          <EditablePhase
            account={account}
            editMode={editMode}
            onUpdate={onPhaseUpdate}
          />
        </div>
        <div>
          <div style={{ fontSize: '12px', color: '#9ca3af', marginBottom: '6px' }}>
            VS Grupo
          </div>
          <EditableVS
            account={account}
            editMode={editMode}
            onUpdate={onVSUpdate}
            vsGroup={vsGroup}
          />
        </div>
      </div>

      {/* Tap indicator */}
      <div style={{
        position: 'absolute',
        bottom: '8px',
        right: '12px',
        fontSize: '11px',
        color: '#9ca3af',
        fontWeight: '500',
      }}>
        Toca para detalles →
      </div>
    </div>
  );
};

export default MobileAccountCard;
