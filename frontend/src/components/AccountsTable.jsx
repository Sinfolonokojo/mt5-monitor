import { formatCurrency, formatDate } from '../utils/formatters';
import TableRow from './TableRow';
import LoadingSpinner from './LoadingSpinner';
import ErrorMessage from './ErrorMessage';

const AccountsTable = ({ data, loading, error, onRefresh, editMode, onPhaseUpdate }) => {
  if (loading) {
    return <LoadingSpinner />;
  }

  if (error) {
    return <ErrorMessage message={error} onRetry={onRefresh} />;
  }

  if (!data || !data.accounts || data.accounts.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '40px', color: '#6b7280' }}>
        No accounts found
      </div>
    );
  }

  return (
    <div>
      {/* Summary Cards */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '16px',
          marginBottom: '24px',
        }}
      >
        <SummaryCard
          label="Total Accounts"
          value={data.total_accounts}
          color="#3b82f6"
        />
        <SummaryCard
          label="Connected"
          value={data.connected_accounts}
          color="#22c55e"
        />
        <SummaryCard
          label="Disconnected"
          value={data.disconnected_accounts}
          color="#ef4444"
        />
        <SummaryCard
          label="Total Balance"
          value={formatCurrency(data.total_balance)}
          color={data.total_balance >= 0 ? '#22c55e' : '#ef4444'}
        />
      </div>

      {/* Main Table */}
      <div
        style={{
          overflowX: 'auto',
          borderRadius: '8px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
        }}
      >
        <table
          style={{
            width: '100%',
            backgroundColor: 'white',
            borderCollapse: 'collapse',
          }}
        >
          <thead
            style={{ backgroundColor: '#f9fafb', borderBottom: '2px solid #e5e7eb' }}
          >
            <tr>
              <th
                style={{ padding: '12px 16px', textAlign: 'center', fontWeight: '600' }}
              >
                #
              </th>
              <th
                style={{ padding: '12px 16px', textAlign: 'center', fontWeight: '600' }}
              >
                Días op
              </th>
              <th
                style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '600' }}
              >
                CUENTAS
              </th>
              <th
                style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '600' }}
              >
                Estado
              </th>
              <th
                style={{ padding: '12px 16px', textAlign: 'right', fontWeight: '600' }}
              >
                Balance
              </th>
              <th
                style={{ padding: '12px 16px', textAlign: 'center', fontWeight: '600' }}
              >
                F1/VS
              </th>
            </tr>
          </thead>
          <tbody>
            {data.accounts.map((account) => (
              <TableRow
                key={account.account_number}
                account={account}
                editMode={editMode}
                onPhaseUpdate={onPhaseUpdate}
              />
            ))}
          </tbody>
        </table>
      </div>

      {/* Last Updated */}
      <div
        style={{
          marginTop: '16px',
          textAlign: 'center',
          color: '#6b7280',
          fontSize: '14px',
        }}
      >
        Last updated: {formatDate(data.last_refresh)}
      </div>
    </div>
  );
};

const SummaryCard = ({ label, value, color }) => {
  return (
    <div
      style={{
        backgroundColor: 'white',
        padding: '16px',
        borderRadius: '8px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
        borderLeft: `4px solid ${color}`,
      }}
    >
      <div style={{ fontSize: '14px', color: '#6b7280', marginBottom: '4px' }}>
        {label}
      </div>
      <div style={{ fontSize: '24px', fontWeight: 'bold', color: color }}>
        {value}
      </div>
    </div>
  );
};

export default AccountsTable;
