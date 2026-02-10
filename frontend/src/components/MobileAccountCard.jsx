import {
  formatCurrency,
  calculateProfitLoss,
  calculateProfitPercentage,
} from '../utils/formatters';
import EditablePhase from './EditablePhase';
import EditableVS from './EditableVS';

const MobileAccountCard = ({ account, editMode, onPhaseUpdate, onVSUpdate, vsGroup, onCardClick }) => {
  const initialBalance = account.initial_balance || 100000;
  const profitLoss = calculateProfitLoss(account.balance, initialBalance);
  const profitPercent = calculateProfitPercentage(account.balance, initialBalance);
  const isProfit = profitLoss >= 0;

  // Drawdown calculation
  const currentDrawdown = initialBalance - account.balance;
  const maxAllowedDrawdown = initialBalance * 0.10;
  const drawdownPercent = Math.max(0, Math.min(100, (currentDrawdown / maxAllowedDrawdown) * 100));
  const drawdownColor = drawdownPercent > 80 ? 'red' : drawdownPercent > 50 ? 'orange' : 'green';

  // Phase badge class
  const phase = (account.phase || '').toUpperCase();
  const phaseBadgeClass = phase === 'F1' ? 'phase-badge-f1'
    : phase === 'F2' ? 'phase-badge-f2'
    : phase === 'R' ? 'phase-badge-r'
    : phase === 'Q' ? 'phase-badge-q'
    : '';

  const isConnected = account.status === 'connected';

  const handleCardClick = (e) => {
    if (editMode) return;
    if (e.target.tagName === 'SELECT' || e.target.tagName === 'INPUT' || e.target.closest('.editable-element')) {
      return;
    }
    onCardClick && onCardClick(account);
  };

  return (
    <div className="mobile-account-card" onClick={handleCardClick}>
      {/* Header: Account # + Phase Badge + Connection Status */}
      <div className="mobile-card-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span className="mobile-card-account-num">{account.account_number}</span>
          {editMode ? (
            <div className="editable-element" onClick={(e) => e.stopPropagation()}>
              <EditablePhase account={account} editMode={editMode} onUpdate={onPhaseUpdate} />
            </div>
          ) : (
            phase && <span className={`phase-badge ${phaseBadgeClass}`}>{phase}</span>
          )}
        </div>
        <div className="mobile-card-header-right">
          <div className="mobile-connection-status">
            <span className={`glowing-dot ${isConnected ? 'online' : 'offline'}`} />
            <span>{isConnected ? 'Live' : 'Disc'}</span>
          </div>
        </div>
      </div>

      {/* Holder name */}
      <div style={{
        fontSize: '14px',
        fontWeight: '600',
        color: 'var(--text-primary)',
        marginBottom: '4px',
      }}>
        {account.account_holder || 'Unknown'}
      </div>

      {/* Prop Firm */}
      <div style={{
        fontSize: '12px',
        color: 'var(--text-muted)',
        marginBottom: '14px',
      }}>
        {account.prop_firm || 'N/A'} · {account.days_operating || 0} días
      </div>

      {/* Balance */}
      <div style={{
        fontSize: '13px',
        color: 'var(--text-secondary)',
        marginBottom: '8px',
        fontFamily: 'var(--font-mono)',
      }}>
        Balance: <span style={{ color: 'var(--text-primary)', fontWeight: '500' }}>{formatCurrency(account.balance)}</span>
      </div>

      {/* P/L Amount + Percentage Badge */}
      <div className="mobile-card-pl">
        <div className="mobile-card-pl-amount" style={{ color: isProfit ? 'var(--green)' : 'var(--red)' }}>
          {isProfit ? '+' : ''}{formatCurrency(profitLoss)}
          <span className={`mobile-card-pl-badge ${isProfit ? 'positive' : 'negative'}`}>
            {isProfit ? '+' : ''}{profitPercent.toFixed(2)}%
          </span>
        </div>
      </div>

      {/* Drawdown Progress Bar */}
      <div className="drawdown-section">
        <div className="drawdown-label">
          <span className="drawdown-label-text">Drawdown</span>
          <span className="drawdown-label-value" style={{
            color: drawdownPercent > 80 ? 'var(--red)' : drawdownPercent > 50 ? 'var(--orange)' : 'var(--text-secondary)'
          }}>
            {drawdownPercent.toFixed(1)}%
          </span>
        </div>
        <div className="drawdown-bar">
          <div
            className={`drawdown-bar-fill ${drawdownColor}`}
            style={{ width: `${drawdownPercent}%` }}
          />
        </div>
      </div>

      {/* Footer: Positions + VS Group + Chevron */}
      <div className="mobile-card-footer">
        <div className="mobile-card-footer-left">
          <span className="mobile-card-footer-item">
            {account.has_open_position ? '📊' : '—'}
            {account.has_open_position ? ' Pos. abierta' : ' Sin posición'}
          </span>
          {editMode ? (
            <div className="editable-element" onClick={(e) => e.stopPropagation()}>
              <EditableVS account={account} editMode={editMode} onUpdate={onVSUpdate} vsGroup={vsGroup} />
            </div>
          ) : (
            vsGroup && (
              <span className="mobile-card-footer-item" style={{ color: 'var(--primary)' }}>
                VS {vsGroup}
              </span>
            )
          )}
        </div>
        <span className="mobile-card-chevron">›</span>
      </div>
    </div>
  );
};

export default MobileAccountCard;
