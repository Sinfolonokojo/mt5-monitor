import {
  formatCurrency,
  calculateProfitLoss,
  calculateMaxLoss,
  getRowBackgroundColor
} from '../utils/formatters';
import EditablePhase from './EditablePhase';
import EditableVS from './EditableVS';

const TableRow = ({ account, editMode, onPhaseUpdate, onVSUpdate, vsGroup, onRowClick }) => {
  const initialBalance = account.initial_balance || 100000;
  const profitLoss = calculateProfitLoss(account.balance, initialBalance);
  const maxLoss = calculateMaxLoss(account.balance, initialBalance);
  const rowBgColor = getRowBackgroundColor(account.balance, initialBalance);

  // Check for dark mode
  const isDarkMode = document.body.classList.contains('dark-mode');
  const greenColor = isDarkMode ? '#4ade80' : '#22c55e';
  const redColor = isDarkMode ? '#f87171' : '#ef4444';
  const darkGreenBorder = isDarkMode ? '#22c55e' : '#16a34a';

  const plColor = profitLoss >= 0 ? greenColor : redColor;
  const maxLossColor = maxLoss >= 0 ? greenColor : redColor;

  const handleRowClick = (e) => {
    // Don't trigger if clicking on editable elements
    if (e.target.tagName === 'SELECT' || e.target.tagName === 'INPUT' || e.target.closest('.editable-element')) {
      return;
    }
    onRowClick && onRowClick(account);
  };

  return (
    <tr
      onClick={handleRowClick}
      style={{
        borderBottom: '1px solid #e5e7eb',
        backgroundColor: rowBgColor,
        cursor: 'pointer',
        transition: 'background-color 0.2s',
      }}
      onMouseEnter={(e) => {
        if (!editMode) {
          e.currentTarget.style.backgroundColor = '#f9fafb';
        }
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.backgroundColor = rowBgColor;
      }}
    >
      {/* Connection Status Indicator */}
      <td style={{ padding: '12px 16px', textAlign: 'center' }}>
        <div
          style={{
            width: '12px',
            height: '12px',
            borderRadius: '50%',
            backgroundColor: account.status === 'connected' ? greenColor : redColor,
            margin: '0 auto',
            boxShadow: isDarkMode ? `0 0 6px ${account.status === 'connected' ? greenColor : redColor}` : 'none'
          }}
        />
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

      {/* Account Number */}
      <td style={{ padding: '12px 16px' }}>
        <div style={{ fontWeight: '500' }}>
          {account.account_number}
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
            backgroundColor: account.has_open_position ? greenColor : '#e5e7eb',
            margin: '0 auto',
            border: account.has_open_position ? `2px solid ${darkGreenBorder}` : '2px solid #9ca3af',
            boxShadow: isDarkMode && account.has_open_position ? `0 0 6px ${greenColor}` : 'none'
          }}
          title={account.has_open_position ? 'Has open position' : 'No open position'}
        />
      </td>

      {/* VS Column */}
      <td style={{ padding: '12px 16px', textAlign: 'center' }}>
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

export default TableRow;
