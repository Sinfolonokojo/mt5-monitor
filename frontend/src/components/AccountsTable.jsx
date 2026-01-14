import { formatCurrency, formatDate, calculateVSGroups } from '../utils/formatters';
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

  // Calculate VS groups
  const vsGroups = calculateVSGroups(data.accounts);

  // Calculate accounts by phase
  const fase1Count = data.accounts.filter(account => account.phase === 'F1').length;
  const fase2Count = data.accounts.filter(account => account.phase === 'F2').length;
  const realCount = data.accounts.filter(account => account.phase === 'R').length;

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
          label="Total Fase 1"
          value={fase1Count}
          color="#3b82f6"
        />
        <SummaryCard
          label="Total Fase 2"
          value={fase2Count}
          color="#8b5cf6"
        />
        <SummaryCard
          label="Total Real"
          value={realCount}
          color="#22c55e"
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
                Status
              </th>
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
                Holder
              </th>
              <th
                style={{ padding: '12px 16px', textAlign: 'center', fontWeight: '600' }}
              >
                Firm
              </th>
              <th
                style={{ padding: '12px 16px', textAlign: 'left', fontWeight: '600' }}
              >
                CUENTAS
              </th>
              <th
                style={{ padding: '12px 16px', textAlign: 'right', fontWeight: '600' }}
              >
                P/L
              </th>
              <th
                style={{ padding: '12px 16px', textAlign: 'right', fontWeight: '600' }}
              >
                Max Loss
              </th>
              <th
                style={{ padding: '12px 16px', textAlign: 'center', fontWeight: '600' }}
              >
                Fase
              </th>
              <th
                style={{ padding: '12px 16px', textAlign: 'center', fontWeight: '600' }}
              >
                Open Trade
              </th>
              <th
                style={{ padding: '12px 16px', textAlign: 'center', fontWeight: '600' }}
              >
                VS
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
                vsGroup={vsGroups[account.account_number]}
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
