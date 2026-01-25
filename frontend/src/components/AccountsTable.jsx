import { useState, useMemo, useEffect } from 'react';
import { formatCurrency, formatDate, calculateVSGroups, exportToExcel } from '../utils/formatters';
import TableRow from './TableRow';
import MobileAccountCard from './MobileAccountCard';
import LoadingSpinner from './LoadingSpinner';
import ErrorMessage from './ErrorMessage';
import AccountDetailsModal from './AccountDetailsModal';
import TradeHistoryModal from './TradeHistoryModal';
import TradeModal from './TradeModal';
import OpenPositionsModal from './OpenPositionsModal';
import apiService from '../services/api';

const AccountsTable = ({ data, loading, error, onRefresh, onRefreshSingleAccount, editMode, onPhaseUpdate, onVSUpdate }) => {
  const [sortMode, setSortMode] = useState('VS'); // 'VS', 'PL_DESC', 'PL_ASC', 'HOLDER_ASC', 'HOLDER_DESC'
  const [selectedAccount, setSelectedAccount] = useState(null);
  const [tradeHistoryAccount, setTradeHistoryAccount] = useState(null);
  const [tradeModalAccount, setTradeModalAccount] = useState(null);
  const [positionsModalAccount, setPositionsModalAccount] = useState(null);
  const [openTradeFilter, setOpenTradeFilter] = useState('all'); // 'all', 'with_open', 'without_open'
  const [isMobile, setIsMobile] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Detect screen size for responsive layout
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);

    return () => window.removeEventListener('resize', checkMobile);
  }, []);

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

    // Filter by search query (prop firm or account holder name)
    let filteredAccounts = uniqueAccounts;
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      filteredAccounts = filteredAccounts.filter(account => {
        const propFirm = (account.prop_firm || '').toLowerCase();
        const holder = (account.account_holder || '').toLowerCase();
        const accountNumber = (account.account_number || '').toString().toLowerCase();
        return propFirm.includes(query) || holder.includes(query) || accountNumber.includes(query);
      });
    }

    // Filter by open trade status
    if (openTradeFilter === 'with_open') {
      filteredAccounts = filteredAccounts.filter(account => account.has_open_position);
    } else if (openTradeFilter === 'without_open') {
      filteredAccounts = filteredAccounts.filter(account => !account.has_open_position);
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
      } else if (sortMode === 'HOLDER_ASC') {
        // Sort by account holder alphabetically A-Z
        const aHolder = (a.account_holder || '').toLowerCase();
        const bHolder = (b.account_holder || '').toLowerCase();
        return aHolder.localeCompare(bHolder);
      } else if (sortMode === 'HOLDER_DESC') {
        // Sort by account holder alphabetically Z-A
        const aHolder = (a.account_holder || '').toLowerCase();
        const bHolder = (b.account_holder || '').toLowerCase();
        return bHolder.localeCompare(aHolder);
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
  }, [data?.accounts, sortMode, mergedVSGroups, openTradeFilter, searchQuery]);

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
    // Toggle VS filter on/off
    if (sortMode === 'VS') {
      setSortMode('PL_DESC'); // Disable VS filter, default to P/L descending
    } else {
      setSortMode('VS'); // Enable VS filter
    }
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

  const handleHolderHeaderClick = () => {
    // Cycle through: HOLDER_ASC -> HOLDER_DESC -> PL_DESC (remove filter)
    if (sortMode === 'HOLDER_ASC') {
      setSortMode('HOLDER_DESC');
    } else if (sortMode === 'HOLDER_DESC') {
      setSortMode('PL_DESC'); // Back to default
    } else {
      setSortMode('HOLDER_ASC');
    }
  };

  const handleExportToExcel = () => {
    exportToExcel(sortedAccounts);
  };

  const handleSyncToGoogleSheets = async () => {
    setIsSyncing(true);
    setSyncMessage(null);

    try {
      const result = await apiService.syncToGoogleSheets();

      if (result.success) {
        setSyncMessage({
          type: 'success',
          text: `✓ ${result.message}`,
          url: result.spreadsheet_url
        });

        // Clear message after 5 seconds
        setTimeout(() => setSyncMessage(null), 5000);
      }
    } catch (err) {
      setSyncMessage({
        type: 'error',
        text: `✗ Error: ${err.message}`
      });

      // Clear error after 5 seconds
      setTimeout(() => setSyncMessage(null), 5000);
    } finally {
      setIsSyncing(false);
    }
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

      {/* Search Bar */}
      <div style={{ marginBottom: '20px' }}>
        <div style={{ position: 'relative', maxWidth: '100%' }}>
          <span
            style={{
              position: 'absolute',
              left: '16px',
              top: '50%',
              transform: 'translateY(-50%)',
              fontSize: '18px',
              pointerEvents: 'none',
              zIndex: 1,
            }}
          >
            🔍
          </span>
          <input
            type="text"
            placeholder="Buscar por firma, titular o número de cuenta..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: '100%',
              padding: '12px 45px 12px 45px',
              fontSize: '15px',
              fontWeight: '400',
              color: '#111827',
              border: '2px solid #d1d5db',
              borderRadius: '10px',
              outline: 'none',
              transition: 'border-color 0.2s',
              backgroundColor: 'white',
              boxSizing: 'border-box',
              WebkitAppearance: 'none',
              appearance: 'none',
              colorScheme: 'light',
            }}
            onFocus={(e) => e.target.style.borderColor = '#3b82f6'}
            onBlur={(e) => e.target.style.borderColor = '#d1d5db'}
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              style={{
                position: 'absolute',
                right: '12px',
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: '#6b7280',
                fontSize: '20px',
                padding: '4px 8px',
                borderRadius: '4px',
                transition: 'background-color 0.2s',
                zIndex: 1,
              }}
              onMouseEnter={(e) => e.target.style.backgroundColor = '#f3f4f6'}
              onMouseLeave={(e) => e.target.style.backgroundColor = 'transparent'}
              title="Limpiar búsqueda"
            >
              ✕
            </button>
          )}
        </div>
        {searchQuery && (
          <div style={{
            marginTop: '8px',
            fontSize: '14px',
            color: '#6b7280',
          }}>
            {sortedAccounts.length} cuenta{sortedAccounts.length !== 1 ? 's' : ''} encontrada{sortedAccounts.length !== 1 ? 's' : ''}
          </div>
        )}
      </div>

      {/* Export & Sync Buttons */}
      <div style={{ marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        {/* Sync Message */}
        {syncMessage && (
          <div style={{
            padding: '10px 16px',
            backgroundColor: syncMessage.type === 'success' ? '#dcfce7' : '#fee2e2',
            color: syncMessage.type === 'success' ? '#166534' : '#991b1b',
            borderRadius: '6px',
            fontSize: '14px',
            fontWeight: '500',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}>
            {syncMessage.text}
            {syncMessage.url && (
              <a
                href={syncMessage.url}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  color: '#166534',
                  textDecoration: 'underline',
                  fontWeight: '600'
                }}
              >
                Ver Hoja →
              </a>
            )}
          </div>
        )}

        <div style={{ marginLeft: 'auto', display: 'flex', gap: '12px' }}>
          <button
            onClick={handleSyncToGoogleSheets}
            disabled={isSyncing}
            style={{
              padding: '10px 20px',
              backgroundColor: isSyncing ? '#9ca3af' : '#3b82f6',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              fontSize: '14px',
              fontWeight: '600',
              cursor: isSyncing ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
              transition: 'background-color 0.2s'
            }}
            onMouseEnter={(e) => !isSyncing && (e.target.style.backgroundColor = '#2563eb')}
            onMouseLeave={(e) => !isSyncing && (e.target.style.backgroundColor = '#3b82f6')}
          >
            <span>{isSyncing ? '⏳' : '📤'}</span>
            {isSyncing ? 'Sincronizando...' : 'Sync to Google Sheets'}
          </button>

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
      </div>

      {/* Mobile Cards View */}
      {isMobile ? (
        <div style={{ padding: '0 4px' }}>
          {/* Mobile Filter/Sort Controls */}
          <div style={{ marginBottom: '16px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <select
              value={sortMode}
              onChange={(e) => setSortMode(e.target.value)}
              style={{
                flex: 1,
                minWidth: '140px',
                padding: '10px 12px',
                borderRadius: '8px',
                border: '1px solid #d1d5db',
                fontSize: '14px',
                fontWeight: '500',
                backgroundColor: 'white',
              }}
            >
              <option value="VS">Ordenar: VS Grupos</option>
              <option value="PL_DESC">Ordenar: Mayor P/L</option>
              <option value="PL_ASC">Ordenar: Menor P/L</option>
              <option value="HOLDER_ASC">Ordenar: Titular A-Z</option>
              <option value="HOLDER_DESC">Ordenar: Titular Z-A</option>
            </select>
            <select
              value={openTradeFilter}
              onChange={(e) => setOpenTradeFilter(e.target.value)}
              style={{
                flex: 1,
                minWidth: '140px',
                padding: '10px 12px',
                borderRadius: '8px',
                border: '1px solid #d1d5db',
                fontSize: '14px',
                fontWeight: '500',
                backgroundColor: 'white',
              }}
            >
              <option value="all">Todas las cuentas</option>
              <option value="with_open">Con posición abierta</option>
              <option value="without_open">Sin posición abierta</option>
            </select>
          </div>

          {/* Cards List */}
          {sortedAccounts.map((account) => (
            <MobileAccountCard
              key={account.account_number}
              account={account}
              editMode={editMode}
              onPhaseUpdate={onPhaseUpdate}
              onVSUpdate={onVSUpdate}
              vsGroup={mergedVSGroups[account.account_number]}
              onCardClick={(account) => setSelectedAccount(account)}
            />
          ))}
        </div>
      ) : (
        /* Desktop Table View */
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
                  onClick={handleHolderHeaderClick}
                  style={{
                    padding: '12px 16px',
                    textAlign: 'left',
                    fontWeight: '600',
                    cursor: 'pointer',
                    userSelect: 'none',
                    backgroundColor: sortMode.startsWith('HOLDER_') ? '#e5e7eb' : 'transparent',
                    transition: 'background-color 0.2s'
                  }}
                >
                  Holder {sortMode === 'HOLDER_ASC' ? '↓' : sortMode === 'HOLDER_DESC' ? '↑' : ''}
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
                  Trade Abierto {openTradeFilter === 'with_open' ? '✓' : openTradeFilter === 'without_open' ? '✗' : ''}
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
      )}

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
          onViewTrades={() => {
            setTradeHistoryAccount(selectedAccount);
            setSelectedAccount(null);
          }}
          onOpenTrade={(account) => {
            setTradeModalAccount(account);
            setSelectedAccount(null);
          }}
          onViewPositions={(account) => {
            setPositionsModalAccount(account);
            setSelectedAccount(null);
          }}
        />
      )}

      {/* Trade History Modal */}
      {tradeHistoryAccount && (
        <TradeHistoryModal
          account={tradeHistoryAccount}
          onClose={() => setTradeHistoryAccount(null)}
        />
      )}

      {/* Trade Modal */}
      {tradeModalAccount && (
        <TradeModal
          account={tradeModalAccount}
          onClose={() => setTradeModalAccount(null)}
          onSuccess={async () => {
            try {
              // Fast: Only refresh the account that traded
              await onRefreshSingleAccount(tradeModalAccount.account_number);
            } catch (error) {
              // Fallback to full refresh on error
              console.error('Single account refresh failed, falling back to full refresh');
            }
            setTradeModalAccount(null);
          }}
        />
      )}

      {/* Open Positions Modal */}
      {positionsModalAccount && (
        <OpenPositionsModal
          account={positionsModalAccount}
          onClose={() => setPositionsModalAccount(null)}
          onRefresh={() => onRefreshSingleAccount(positionsModalAccount.account_number)}
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
