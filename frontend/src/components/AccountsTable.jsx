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
import Notification from './Notification';
import apiService from '../services/api';

const AccountsTable = ({ data, loading, error, onRefresh, onRefreshSingleAccount, editMode, onPhaseUpdate, onVSUpdate }) => {
  const [sortMode, setSortMode] = useState('VS');
  const [selectedAccount, setSelectedAccount] = useState(null);
  const [tradeHistoryAccount, setTradeHistoryAccount] = useState(null);
  const [tradeModalAccount, setTradeModalAccount] = useState(null);
  const [positionsModalAccount, setPositionsModalAccount] = useState(null);
  const [openTradeFilter, setOpenTradeFilter] = useState('all');
  const [isMobile, setIsMobile] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [notification, setNotification] = useState(null);
  const [phaseFilter, setPhaseFilter] = useState('all');

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const autoVSGroups = useMemo(() => {
    if (!data?.accounts) return {};
    return calculateVSGroups(data.accounts);
  }, [data?.accounts]);

  const mergedVSGroups = useMemo(() => {
    if (!data?.accounts) return {};
    const groups = {};
    data.accounts.forEach(account => {
      if (account.vs_group) {
        groups[account.account_number] = account.vs_group;
      } else if (autoVSGroups[account.account_number]) {
        groups[account.account_number] = autoVSGroups[account.account_number];
      }
    });
    return groups;
  }, [data?.accounts, autoVSGroups]);

  const sortedAccounts = useMemo(() => {
    if (!data?.accounts || !Array.isArray(data.accounts)) return [];

    const uniqueAccounts = [];
    const seenAccountNumbers = new Set();
    for (const account of data.accounts) {
      if (!seenAccountNumbers.has(account.account_number)) {
        uniqueAccounts.push(account);
        seenAccountNumbers.add(account.account_number);
      }
    }

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

    if (openTradeFilter === 'with_open') {
      filteredAccounts = filteredAccounts.filter(account => account.has_open_position);
    } else if (openTradeFilter === 'without_open') {
      filteredAccounts = filteredAccounts.filter(account => !account.has_open_position);
    }

    if (phaseFilter !== 'all') {
      filteredAccounts = filteredAccounts.filter(account =>
        (account.phase || '').toUpperCase() === phaseFilter.toUpperCase()
      );
    }

    return filteredAccounts.sort((a, b) => {
      const aPL = a.balance - (a.initial_balance || 100000);
      const bPL = b.balance - (b.initial_balance || 100000);

      if (sortMode === 'PL_DESC') return bPL - aPL;
      if (sortMode === 'PL_ASC') return aPL - bPL;
      if (sortMode === 'HOLDER_ASC') {
        return (a.account_holder || '').toLowerCase().localeCompare((b.account_holder || '').toLowerCase());
      }
      if (sortMode === 'HOLDER_DESC') {
        return (b.account_holder || '').toLowerCase().localeCompare((a.account_holder || '').toLowerCase());
      }

      // VS mode
      const aGroup = mergedVSGroups[a.account_number];
      const bGroup = mergedVSGroups[b.account_number];
      if (aGroup && bGroup) {
        if (aGroup !== bGroup) {
          const aNum = parseInt(aGroup);
          const bNum = parseInt(bGroup);
          if (!isNaN(aNum) && !isNaN(bNum)) return aNum - bNum;
          return aGroup.toString().localeCompare(bGroup.toString());
        }
        return bPL - aPL;
      }
      if (aGroup && !bGroup) return -1;
      if (!aGroup && bGroup) return 1;
      return bPL - aPL;
    });
  }, [data?.accounts, sortMode, mergedVSGroups, openTradeFilter, searchQuery, phaseFilter]);

  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorMessage message={error} onRetry={onRefresh} />;
  if (!data || !data.accounts || data.accounts.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-muted)' }}>
        <div style={{ fontSize: '48px', marginBottom: '16px' }}>📭</div>
        <p>No se encontraron cuentas</p>
      </div>
    );
  }

  const handleExportToExcel = () => exportToExcel(sortedAccounts);

  const handleSyncToGoogleSheets = async () => {
    setIsSyncing(true);
    setSyncMessage(null);
    try {
      const result = await apiService.syncToGoogleSheets();
      if (result.success) {
        setSyncMessage({ type: 'success', text: `✓ ${result.message}`, url: result.spreadsheet_url });
        setTimeout(() => setSyncMessage(null), 5000);
      }
    } catch (err) {
      setSyncMessage({ type: 'error', text: `✗ Error: ${err.message}` });
      setTimeout(() => setSyncMessage(null), 5000);
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <div>
      {/* Search Bar */}
      <div style={{ marginBottom: '20px' }}>
        <div style={{ position: 'relative', maxWidth: '400px' }}>
          <span style={{
            position: 'absolute',
            left: '14px',
            top: '50%',
            transform: 'translateY(-50%)',
            fontSize: '16px',
            color: 'var(--text-muted)',
            pointerEvents: 'none',
          }}>
            🔍
          </span>
          <input
            type="text"
            placeholder="Buscar cuentas..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: '100%',
              padding: '10px 40px 10px 42px',
              fontSize: '14px',
              backgroundColor: 'var(--bg-surface)',
              border: '1px solid var(--border-color)',
              borderRadius: '8px',
              color: 'var(--text-primary)',
              outline: 'none',
              fontFamily: 'var(--font-mono)',
            }}
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
                color: 'var(--text-muted)',
                fontSize: '16px',
              }}
            >
              ✕
            </button>
          )}
        </div>
        {searchQuery && (
          <div style={{ marginTop: '8px', fontSize: '13px', color: 'var(--text-muted)' }}>
            {sortedAccounts.length} cuenta{sortedAccounts.length !== 1 ? 's' : ''} encontrada{sortedAccounts.length !== 1 ? 's' : ''}
          </div>
        )}
      </div>

      {/* Export & Sync Buttons */}
      <div style={{ marginBottom: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        {syncMessage && (
          <div style={{
            padding: '10px 16px',
            backgroundColor: syncMessage.type === 'success' ? 'var(--green-muted)' : 'var(--red-muted)',
            color: syncMessage.type === 'success' ? 'var(--green)' : 'var(--red)',
            borderRadius: '8px',
            fontSize: '13px',
            fontWeight: '500',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}>
            {syncMessage.text}
            {syncMessage.url && (
              <a href={syncMessage.url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--green)', textDecoration: 'underline' }}>
                View Sheet →
              </a>
            )}
          </div>
        )}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: '12px' }}>
          <button onClick={handleSyncToGoogleSheets} disabled={isSyncing} className="btn btn-primary btn-sm">
            {isSyncing ? '⏳ Sincronizando...' : '📤 Sincronizar'}
          </button>
          <button onClick={handleExportToExcel} className="btn btn-success btn-sm">
            📊 Exportar Excel
          </button>
        </div>
      </div>

      {/* Table */}
      {isMobile ? (
        <div>
          {/* Phase Filter Pills */}
          <div className="mobile-filter-pills">
            {[
              { key: 'all', label: 'Todas' },
              { key: 'F1', label: 'Fase 1' },
              { key: 'F2', label: 'Fase 2' },
              { key: 'R', label: 'Fondeadas' },
              { key: 'Q', label: 'Quemadas' },
            ].map(f => (
              <button
                key={f.key}
                className={`mobile-filter-pill ${phaseFilter === f.key ? (f.key === 'all' ? 'active' : `active-${f.key.toLowerCase()}`) : ''}`}
                onClick={() => setPhaseFilter(f.key)}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Sort & Filter selects */}
          <div style={{ marginBottom: '12px', display: 'flex', gap: '8px' }}>
            <select value={sortMode} onChange={(e) => setSortMode(e.target.value)} className="select" style={{ flex: 1, fontSize: '13px', padding: '8px 12px' }}>
              <option value="VS">VS Grupos</option>
              <option value="PL_DESC">Mayor P/L</option>
              <option value="PL_ASC">Menor P/L</option>
              <option value="HOLDER_ASC">Titular A-Z</option>
              <option value="HOLDER_DESC">Titular Z-A</option>
            </select>
            <select value={openTradeFilter} onChange={(e) => setOpenTradeFilter(e.target.value)} className="select" style={{ flex: 1, fontSize: '13px', padding: '8px 12px' }}>
              <option value="all">Todas</option>
              <option value="with_open">Con posición</option>
              <option value="without_open">Sin posición</option>
            </select>
          </div>

          {/* Account count */}
          <div style={{ marginBottom: '10px', fontSize: '12px', color: 'var(--text-muted)' }}>
            {sortedAccounts.length} cuenta{sortedAccounts.length !== 1 ? 's' : ''}
          </div>

          {/* Cards */}
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
        <div style={{ borderRadius: '12px', border: '1px solid var(--border-color)', overflow: 'hidden', backgroundColor: 'var(--bg-surface)' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ backgroundColor: 'var(--bg-header)', borderBottom: '1px solid var(--border-color)' }}>
                  <th style={thStyle}>Estado</th>
                  <th style={thStyle}>Días</th>
                  <th style={{ ...thStyle, cursor: 'pointer', backgroundColor: sortMode.startsWith('HOLDER_') ? 'var(--bg-surface-hover)' : 'transparent' }}
                      onClick={() => setSortMode(sortMode === 'HOLDER_ASC' ? 'HOLDER_DESC' : sortMode === 'HOLDER_DESC' ? 'PL_DESC' : 'HOLDER_ASC')}>
                    Titular {sortMode === 'HOLDER_ASC' ? '↓' : sortMode === 'HOLDER_DESC' ? '↑' : ''}
                  </th>
                  <th style={thStyle}>Firma</th>
                  <th style={thStyle}>Cuenta</th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>Balance</th>
                  <th style={{ ...thStyle, textAlign: 'right', cursor: 'pointer', backgroundColor: sortMode.startsWith('PL_') ? 'var(--bg-surface-hover)' : 'transparent' }}
                      onClick={() => setSortMode(sortMode === 'PL_DESC' ? 'PL_ASC' : 'PL_DESC')}>
                    P/L {sortMode === 'PL_DESC' ? '↓' : sortMode === 'PL_ASC' ? '↑' : ''}
                  </th>
                  <th style={{ ...thStyle, textAlign: 'right' }}>Pérd. Máx</th>
                  <th style={{ ...thStyle, textAlign: 'center' }}>Fase</th>
                  <th style={{ ...thStyle, textAlign: 'center', cursor: 'pointer', backgroundColor: openTradeFilter !== 'all' ? 'var(--bg-surface-hover)' : 'transparent' }}
                      onClick={() => setOpenTradeFilter(openTradeFilter === 'all' ? 'with_open' : openTradeFilter === 'with_open' ? 'without_open' : 'all')}>
                    Abierta {openTradeFilter === 'with_open' ? '✓' : openTradeFilter === 'without_open' ? '✗' : ''}
                  </th>
                  <th style={{ ...thStyle, textAlign: 'center', cursor: 'pointer', backgroundColor: sortMode === 'VS' ? 'var(--bg-surface-hover)' : 'transparent' }}
                      onClick={() => setSortMode(sortMode === 'VS' ? 'PL_DESC' : 'VS')}>
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
          {/* Pagination placeholder */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px 16px',
            backgroundColor: 'var(--bg-header)',
            borderTop: '1px solid var(--border-color)',
          }}>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              Mostrando {sortedAccounts.length} de {data.total_accounts} cuentas
            </p>
          </div>
        </div>
      )}

      {/* Last Updated */}
      <div style={{ marginTop: '16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
        Última actualización: {formatDate(data.last_refresh)}
      </div>

      {/* Modals */}
      {selectedAccount && (
        <AccountDetailsModal
          account={selectedAccount}
          vsGroup={mergedVSGroups[selectedAccount.account_number]}
          onClose={() => setSelectedAccount(null)}
          onViewTrades={() => { setTradeHistoryAccount(selectedAccount); setSelectedAccount(null); }}
          onOpenTrade={(account) => { setTradeModalAccount(account); setSelectedAccount(null); }}
          onViewPositions={(account) => { setPositionsModalAccount(account); setSelectedAccount(null); }}
          onRefresh={() => onRefreshSingleAccount(selectedAccount.account_number)}
          onNotification={(notif) => setNotification(notif)}
        />
      )}
      {tradeHistoryAccount && <TradeHistoryModal account={tradeHistoryAccount} onClose={() => setTradeHistoryAccount(null)} />}
      {tradeModalAccount && (
        <TradeModal
          account={tradeModalAccount}
          onClose={() => setTradeModalAccount(null)}
          onSuccess={async (tradeInfo) => {
            try {
              setNotification({ message: `✓ Trade opened: ${tradeInfo.orderType} ${tradeInfo.lot} lots ${tradeInfo.symbol}`, type: 'success' });
              await onRefreshSingleAccount(tradeModalAccount.account_number);
            } catch (error) {
              console.error('Refresh failed');
            }
          }}
        />
      )}
      {notification && <Notification message={notification.message} type={notification.type} duration={3000} onClose={() => setNotification(null)} />}
      {positionsModalAccount && (
        <OpenPositionsModal
          account={positionsModalAccount}
          onClose={() => setPositionsModalAccount(null)}
          onRefresh={() => onRefreshSingleAccount(positionsModalAccount.account_number)}
          onNotification={(notif) => setNotification(notif)}
        />
      )}
    </div>
  );
};

const thStyle = {
  padding: '12px 16px',
  textAlign: 'left',
  fontWeight: '500',
  fontSize: '11px',
  color: 'var(--text-muted)',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
};

export default AccountsTable;
