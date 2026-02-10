import {
  formatCurrency,
  calculateProfitLoss,
  calculateMaxLoss,
} from '../utils/formatters';
import EditablePhase from './EditablePhase';
import EditableVS from './EditableVS';

const TableRow = ({ account, editMode, onPhaseUpdate, onVSUpdate, vsGroup, onRowClick }) => {
  const initialBalance = account.initial_balance || 100000;
  const profitLoss = calculateProfitLoss(account.balance, initialBalance);
  const maxLoss = calculateMaxLoss(account.balance, initialBalance);

  // Calculate drawdown percentage for color
  const drawdownPercent = Math.abs(maxLoss) / initialBalance * 100;

  const plColor = profitLoss >= 0 ? 'var(--green)' : 'var(--red)';
  const maxLossColor = maxLoss >= 0 ? 'var(--green)' :
    drawdownPercent > 8 ? 'var(--red)' :
    drawdownPercent > 5 ? 'var(--orange)' :
    'var(--yellow)';

  const handleRowClick = (e) => {
    if (e.target.tagName === 'SELECT' || e.target.tagName === 'INPUT' || e.target.closest('.editable-element')) {
      return;
    }
    onRowClick && onRowClick(account);
  };

  return (
    <tr
      onClick={handleRowClick}
      style={{
        borderBottom: '1px solid var(--border-color)',
        backgroundColor: 'transparent',
        cursor: 'pointer',
        transition: 'background-color 0.15s',
      }}
      onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-surface-hover)'}
      onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
    >
      {/* Connection Status Indicator */}
      <td style={tdStyle}>
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <div
            style={{
              width: '10px',
              height: '10px',
              borderRadius: '50%',
              backgroundColor: account.status === 'connected' ? 'var(--green)' : 'var(--red)',
              boxShadow: account.status === 'connected'
                ? '0 0 8px rgba(11, 218, 94, 0.5)'
                : '0 0 8px rgba(239, 68, 68, 0.5)',
            }}
          />
        </div>
      </td>

      {/* Days Operating */}
      <td style={{ ...tdStyle, textAlign: 'center', fontFamily: 'var(--font-mono)', fontSize: '13px' }}>
        {account.days_operating}
      </td>

      {/* Account Holder */}
      <td style={{ ...tdStyle, color: 'var(--text-primary)', fontWeight: '500' }}>
        {account.account_holder || 'Unknown'}
      </td>

      {/* Prop Firm */}
      <td style={{ ...tdStyle, textAlign: 'center' }}>
        <span style={{
          padding: '4px 8px',
          borderRadius: '4px',
          backgroundColor: 'var(--bg-surface-hover)',
          fontSize: '12px',
          fontWeight: '500',
          color: 'var(--text-secondary)',
        }}>
          {account.prop_firm || 'N/A'}
        </span>
      </td>

      {/* Account Number */}
      <td style={tdStyle}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ color: 'var(--text-muted)', fontSize: '14px' }}>💻</span>
          <span style={{ fontFamily: 'var(--font-mono)', fontWeight: '500', color: 'var(--text-primary)', fontSize: '13px' }}>
            {account.account_number}
          </span>
        </div>
      </td>

      {/* Balance */}
      <td style={{ ...tdStyle, textAlign: 'right' }}>
        <span style={{
          fontFamily: 'var(--font-mono)',
          fontWeight: '500',
          color: 'var(--text-primary)',
          fontSize: '13px',
        }}>
          {formatCurrency(account.balance)}
        </span>
      </td>

      {/* Profit/Loss */}
      <td style={{ ...tdStyle, textAlign: 'right' }}>
        <span style={{
          fontFamily: 'var(--font-mono)',
          fontWeight: '600',
          color: plColor,
          fontSize: '13px',
        }}>
          {profitLoss >= 0 ? '+' : ''}{formatCurrency(profitLoss)}
        </span>
      </td>

      {/* Max Loss Buffer with Progress Bar */}
      <td style={{ ...tdStyle, textAlign: 'right' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', justifyContent: 'flex-end' }}>
          <div style={{ width: '60px', height: '6px', backgroundColor: '#374151', borderRadius: '9999px', overflow: 'hidden' }}>
            <div style={{
              height: '100%',
              width: `${Math.min(drawdownPercent * 10, 100)}%`,
              backgroundColor: maxLossColor,
              borderRadius: '9999px',
              transition: 'width 0.3s ease',
            }} />
          </div>
          <span style={{
            fontFamily: 'var(--font-mono)',
            fontWeight: '500',
            color: 'var(--text-muted)',
            fontSize: '12px',
            minWidth: '36px',
            textAlign: 'right',
          }}>
            {drawdownPercent.toFixed(1)}%
          </span>
        </div>
      </td>

      {/* Phase Column */}
      <td style={{ ...tdStyle, textAlign: 'center' }}>
        <EditablePhase
          account={account}
          editMode={editMode}
          onUpdate={onPhaseUpdate}
        />
      </td>

      {/* Open Trade Column */}
      <td style={{ ...tdStyle, textAlign: 'center' }}>
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <div
            style={{
              width: '10px',
              height: '10px',
              borderRadius: '50%',
              backgroundColor: account.has_open_position ? 'var(--green)' : 'var(--border-color)',
              boxShadow: account.has_open_position ? '0 0 8px rgba(11, 218, 94, 0.5)' : 'none',
            }}
            title={account.has_open_position ? 'Has open position' : 'No open position'}
          />
        </div>
      </td>

      {/* VS Column */}
      <td style={{ ...tdStyle, textAlign: 'center' }}>
        <EditableVS
          account={account}
          editMode={editMode}
          onUpdate={onVSUpdate}
          vsGroup={vsGroup}
        />
      </td>
    </tr>
  );
};

const tdStyle = {
  padding: '12px 16px',
  color: 'var(--text-secondary)',
  fontSize: '14px',
};

export default TableRow;
