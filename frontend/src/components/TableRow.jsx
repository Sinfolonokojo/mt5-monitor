import { formatCurrency } from '../utils/formatters';
import StatusIndicator from './StatusIndicator';
import EditablePhase from './EditablePhase';

const TableRow = ({ account, editMode, onPhaseUpdate }) => {
  const balanceColor = account.balance >= 0 ? '#22c55e' : '#ef4444';

  return (
    <tr style={{ borderBottom: '1px solid #e5e7eb' }}>
      <td style={{ padding: '12px 16px', textAlign: 'center' }}>
        {account.row_number}
      </td>
      <td style={{ padding: '12px 16px', textAlign: 'center' }}>
        {account.days_operating}
      </td>
      <td style={{ padding: '12px 16px' }}>
        <div>
          <div style={{ fontWeight: '500' }}>{account.account_name}</div>
          <div style={{ fontSize: '12px', color: '#6b7280' }}>
            #{account.account_number}
          </div>
        </div>
      </td>
      <td style={{ padding: '12px 16px' }}>
        <StatusIndicator status={account.status} />
      </td>
      <td
        style={{
          padding: '12px 16px',
          fontWeight: 'bold',
          color: balanceColor,
          textAlign: 'right',
        }}
      >
        {formatCurrency(account.balance)}
      </td>
      <td style={{ padding: '12px 16px', textAlign: 'center' }}>
        <EditablePhase
          account={account}
          editMode={editMode}
          onUpdate={onPhaseUpdate}
        />
      </td>
    </tr>
  );
};

export default TableRow;
