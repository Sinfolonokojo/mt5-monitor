import {
  formatCurrency,
  calculateProfitLoss,
  calculateMaxLoss,
  getRowBackgroundColor
} from '../utils/formatters';
import EditablePhase from './EditablePhase';

const TableRow = ({ account, editMode, onPhaseUpdate, vsGroup }) => {
  const initialBalance = account.initial_balance || 100000;
  const profitLoss = calculateProfitLoss(account.balance, initialBalance);
  const maxLoss = calculateMaxLoss(account.balance, initialBalance);
  const rowBgColor = getRowBackgroundColor(account.balance, initialBalance);

  const plColor = profitLoss >= 0 ? '#22c55e' : '#ef4444';
  const maxLossColor = maxLoss >= 0 ? '#22c55e' : '#ef4444';

  return (
    <tr style={{ borderBottom: '1px solid #e5e7eb', backgroundColor: rowBgColor }}>
      {/* Connection Status Indicator */}
      <td style={{ padding: '12px 16px', textAlign: 'center' }}>
        <div
          style={{
            width: '12px',
            height: '12px',
            borderRadius: '50%',
            backgroundColor: account.status === 'connected' ? '#22c55e' : '#ef4444',
            margin: '0 auto'
          }}
        />
      </td>

      {/* Row Number */}
      <td style={{ padding: '12px 16px', textAlign: 'center' }}>
        {account.row_number}
      </td>

      {/* Days Operating */}
      <td style={{ padding: '12px 16px', textAlign: 'center' }}>
        {account.days_operating}
      </td>

      {/* Account Holder */}
      <td style={{ padding: '12px 16px', textAlign: 'left' }}>
        {account.account_holder || 'Unknown'}
      </td>

      {/* Prop Firm */}
      <td style={{ padding: '12px 16px', textAlign: 'center', fontWeight: '600' }}>
        {account.prop_firm || 'N/A'}
      </td>

      {/* Account Name/Number */}
      <td style={{ padding: '12px 16px' }}>
        <div>
          <div style={{ fontWeight: '500' }}>{account.account_name}</div>
          <div style={{ fontSize: '12px', color: '#6b7280' }}>
            #{account.account_number}
          </div>
        </div>
      </td>

      {/* Profit/Loss */}
      <td
        style={{
          padding: '12px 16px',
          fontWeight: 'bold',
          color: plColor,
          textAlign: 'right',
        }}
      >
        {profitLoss >= 0 ? '+' : ''}{formatCurrency(profitLoss)}
      </td>

      {/* Max Loss Buffer */}
      <td
        style={{
          padding: '12px 16px',
          fontWeight: '600',
          color: maxLossColor,
          textAlign: 'right',
        }}
      >
        {formatCurrency(maxLoss)}
      </td>

      {/* Phase Column */}
      <td style={{ padding: '12px 16px', textAlign: 'center' }}>
        <EditablePhase
          account={account}
          editMode={editMode}
          onUpdate={onPhaseUpdate}
        />
      </td>

      {/* Open Trade Column */}
      <td style={{ padding: '12px 16px', textAlign: 'center' }}>
        <div
          style={{
            width: '16px',
            height: '16px',
            borderRadius: '50%',
            backgroundColor: account.has_open_position ? '#22c55e' : '#e5e7eb',
            margin: '0 auto',
            border: account.has_open_position ? '2px solid #16a34a' : '2px solid #9ca3af'
          }}
          title={account.has_open_position ? 'Has open position' : 'No open position'}
        />
      </td>

      {/* VS Column */}
      <td style={{ padding: '12px 16px', textAlign: 'center' }}>
        <div
          style={{
            fontWeight: '600',
            color: vsGroup ? '#3b82f6' : '#9ca3af',
            fontSize: '14px'
          }}
        >
          {vsGroup || '-'}
        </div>
      </td>
    </tr>
  );
};

export default TableRow;
