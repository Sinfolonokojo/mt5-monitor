import { useState, useMemo } from 'react';
import { formatCurrency, formatDate, calculateVSGroups, exportToExcel } from '../utils/formatters';
import TableRow from './TableRow';
import LoadingSpinner from './LoadingSpinner';
import ErrorMessage from './ErrorMessage';
import AccountDetailsModal from './AccountDetailsModal';

const AccountsTable = ({ data, loading, error, onRefresh, editMode, onPhaseUpdate, onVSUpdate }) => {
  const [sortMode, setSortMode] = useState('VS'); // 'VS', 'PL_DESC', 'PL_ASC'
  const [selectedAccount, setSelectedAccount] = useState(null);
  const [openTradeFilter, setOpenTradeFilter] = useState('all'); // 'all', 'with_open', 'without_open'

  // Calculate automatic VS groups (with null safety)
  const autoVSGroups = useMemo(() => {
    if (!data?.accounts) return {};
    return calculateVSGroups(data.accounts);
  }, [data?.accounts]);

  // Merge automatic VS groups with manual overrides from backend
  // Manual overrides (vs_group from backend) take precedence
  const mergedVSGroups = useMemo(() => {
    if (!data?.accounts) return {};
    const groups = {};
    data.accounts.forEach(account => {
      if (account.vs_group) {
        // Manual override exists, use it
        groups[account.account_number] = account.vs_group;
      } else if (autoVSGroups[account.account_number]) {
        // No manual override, use auto-calculated
        groups[account.account_number] = autoVSGroups[account.account_number];
      }
    });
    return groups;
  }, [data?.accounts, autoVSGroups]);

  // Sort and filter accounts based on current sort mode and filters
  const sortedAccounts = useMemo(() => {
    if (!data?.accounts || !Array.isArray(data.accounts)) return [];

    // Deduplicate accounts by account_number first
    const uniqueAccounts = [];
    const seenAccountNumbers = new Set();

    for (const account of data.accounts) {
      if (!seenAccountNumbers.has(account.account_number)) {
        uniqueAccounts.push(account);
        seenAccountNumbers.add(account.account_number);
      }
    }

    // Filter by open trade status
    let filteredAccounts = uniqueAccounts;
    if (openTradeFilter === 'with_open') {
      filteredAccounts = uniqueAccounts.filter(account => account.has_open_position);
    } else if (openTradeFilter === 'without_open') {
      filteredAccounts = uniqueAccounts.filter(account => !account.has_open_position);
    }

    // Sort the filtered accounts
    return filteredAccounts.sort((a, b) => {
      const aPL = a.balance - (a.initial_balance || 100000);
      const bPL = b.balance - (b.initial_balance || 100000);

      if (sortMode === 'PL_DESC') {
        // Sort by P/L descending (highest profit first)
        return bPL - aPL;
      } else if (sortMode === 'PL_ASC') {
        // Sort by P/L ascending (lowest profit/highest loss first)
        return aPL - bPL;
      } else {
        // VS mode - sort by VS grouping (use merged VS groups)
        const aGroup = mergedVSGroups[a.account_number];
        const bGroup = mergedVSGroups[b.account_number];

        // If both accounts have VS groups, sort by group value
        if (aGroup && bGroup) {
          if (aGroup !== bGroup) {
            // Try to parse as numbers for numeric sorting
            const aNum = parseInt(aGroup);
            const bNum = parseInt(bGroup);
            if (!isNaN(aNum) && !isNaN(bNum)) {
              return aNum - bNum;
            }
            // Otherwise sort alphabetically
            return aGroup.toString().localeCompare(bGroup.toString());
          }
          // Within the same group, sort by profit/loss (descending)
          return bPL - aPL;
        }

        // Accounts with VS groups come first
        if (aGroup && !bGroup) return -1;
        if (!aGroup && bGroup) return 1;

        // For accounts without VS groups, sort by profit/loss (descending)
        return bPL - aPL;
      }
    });
  }, [data?.accounts, sortMode, mergedVSGroups, openTradeFilter]);

  // Early returns after all hooks
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

  // Handle column header clicks
  const handlePLHeaderClick = () => {
    if (sortMode === 'PL_DESC') {
      setSortMode('PL_ASC');
    } else {
      setSortMode('PL_DESC');
    }
  };

  const handleVSHeaderClick = () => {
    setSortMode('VS');
  };

  const handleOpenTradeHeaderClick = () => {
    // Cycle through: all -> with_open -> without_open -> all
    if (openTradeFilter === 'all') {
      setOpenTradeFilter('with_open');
    } else if (openTradeFilter === 'with_open') {
      setOpenTradeFilter('without_open');
    } else {
      setOpenTradeFilter('all');
    }
  };

  const handleExportToExcel = () => {
    exportToExcel(sortedAccounts);
  };

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

      {/* Export Button */}
      <div style={{ marginBottom: '16px', display: 'flex', justifyContent: 'flex-end' }}>
        <button
          onClick={handleExportToExcel}
          style={{
            padding: '10px 20px',
            backgroundColor: '#22c55e',
            color: 'white',
            border: 'none',
            borderRadius: '6px',
            fontSize: '14px',
            fontWeight: '600',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
            transition: 'background-color 0.2s'
          }}
          onMouseEnter={(e) => e.target.style.backgroundColor = '#16a34a'}
          onMouseLeave={(e) => e.target.style.backgroundColor = '#22c55e'}
        >
          <span>📊</span>
          Export to Excel
        </button>
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
                onClick={handlePLHeaderClick}
                style={{
                  padding: '12px 16px',
                  textAlign: 'right',
                  fontWeight: '600',
                  cursor: 'pointer',
                  userSelect: 'none',
                  backgroundColor: sortMode.startsWith('PL_') ? '#e5e7eb' : 'transparent',
                  transition: 'background-color 0.2s'
                }}
              >
                P/L {sortMode === 'PL_DESC' ? '↓' : sortMode === 'PL_ASC' ? '↑' : ''}
              </th>
              <th
                style={{ padding: '12px 16px', textAlign: 'right', fontWeight: '600' }}
              >
                Pérdida Máx
              </th>
              <th
                style={{ padding: '12px 16px', textAlign: 'center', fontWeight: '600' }}
              >
                Fase
              </th>
              <th
                onClick={handleOpenTradeHeaderClick}
                style={{
                  padding: '12px 16px',
                  textAlign: 'center',
                  fontWeight: '600',
                  cursor: 'pointer',
                  userSelect: 'none',
                  backgroundColor: openTradeFilter !== 'all' ? '#e5e7eb' : 'transparent',
                  transition: 'background-color 0.2s'
                }}
              >
                Open Trade {openTradeFilter === 'with_open' ? '✓' : openTradeFilter === 'without_open' ? '✗' : ''}
              </th>
              <th
                onClick={handleVSHeaderClick}
                style={{
                  padding: '12px 16px',
                  textAlign: 'center',
                  fontWeight: '600',
                  cursor: 'pointer',
                  userSelect: 'none',
                  backgroundColor: sortMode === 'VS' ? '#e5e7eb' : 'transparent',
                  transition: 'background-color 0.2s'
                }}
              >
                VS {sortMode === 'VS' ? '✓' : ''}
              </th>
            </tr>
          </thead>
          <tbody>
            {sortedAccounts.map((account) => (
              <TableRow
                key={account.account_number}
                account={account}
                editMode={editMode}
                onPhaseUpdate={onPhaseUpdate}
                onVSUpdate={onVSUpdate}
                vsGroup={mergedVSGroups[account.account_number]}
                onRowClick={(account) => setSelectedAccount(account)}
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

      {/* Account Details Modal */}
      {selectedAccount && (
        <AccountDetailsModal
          account={selectedAccount}
          vsGroup={mergedVSGroups[selectedAccount.account_number]}
          onClose={() => setSelectedAccount(null)}
        />
      )}
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
