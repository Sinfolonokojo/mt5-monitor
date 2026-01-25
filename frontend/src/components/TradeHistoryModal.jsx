import { useState, useEffect } from 'react';
import apiService from '../services/api';

const TradeHistoryModal = ({ account, onClose }) => {
  const [tradeHistory, setTradeHistory] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [syncing, setSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState('');

  useEffect(() => {
    if (account) {
      fetchTradeHistory();
    }
  }, [account]);

  const fetchTradeHistory = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await apiService.fetchTradeHistory(account.account_number);
      setTradeHistory(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSyncToSheets = async () => {
    try {
      setSyncing(true);
      setSyncMessage('');
      const result = await apiService.syncTradesToGoogleSheets(account.account_number);
      setSyncMessage(`Successfully synced ${result.trades_synced} trades to Google Sheets!`);
      setTimeout(() => setSyncMessage(''), 5000);
    } catch (err) {
      setSyncMessage(`Error: ${err.message}`);
      setTimeout(() => setSyncMessage(''), 5000);
    } finally {
      setSyncing(false);
    }
  };

  if (!account) return null;

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 1000,
        padding: '20px',
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: 'white',
          borderRadius: '12px',
          maxWidth: '1200px',
          width: '100%',
          maxHeight: '90vh',
          overflow: 'hidden',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
          display: 'flex',
          flexDirection: 'column',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: '24px',
            borderBottom: '1px solid #e5e7eb',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '16px',
          }}
        >
          <div>
            <h2 style={{ margin: 0, fontSize: '24px', fontWeight: '700', color: '#111827' }}>
              Ver Historial
            </h2>
            <p style={{ margin: '4px 0 0 0', fontSize: '16px', color: '#6b7280', fontWeight: '500' }}>
              {account.account_number} ({account.account_holder})
            </p>
          </div>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <button
              onClick={handleSyncToSheets}
              disabled={syncing || loading}
              style={{
                padding: '8px 16px',
                backgroundColor: syncing ? '#9ca3af' : '#10b981',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                fontSize: '14px',
                fontWeight: '500',
                cursor: syncing ? 'not-allowed' : 'pointer',
                transition: 'background-color 0.2s',
              }}
              onMouseEnter={(e) => {
                if (!syncing && !loading) e.target.style.backgroundColor = '#059669';
              }}
              onMouseLeave={(e) => {
                if (!syncing && !loading) e.target.style.backgroundColor = '#10b981';
              }}
            >
              {syncing ? 'Syncing...' : 'Sync to Sheets'}
            </button>
            <button
              onClick={onClose}
              style={{
                background: 'none',
                border: 'none',
                fontSize: '28px',
                cursor: 'pointer',
                color: '#6b7280',
                padding: '0',
                width: '32px',
                height: '32px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: '6px',
                transition: 'background-color 0.2s',
              }}
              onMouseEnter={(e) => e.target.style.backgroundColor = '#f3f4f6'}
              onMouseLeave={(e) => e.target.style.backgroundColor = 'transparent'}
            >
              ×
            </button>
          </div>
        </div>

        {/* Sync Message */}
        {syncMessage && (
          <div
            style={{
              padding: '12px 24px',
              backgroundColor: syncMessage.includes('Error') ? '#fee2e2' : '#d1fae5',
              color: syncMessage.includes('Error') ? '#dc2626' : '#059669',
              fontSize: '14px',
              fontWeight: '500',
            }}
          >
            {syncMessage}
          </div>
        )}

        {/* Content */}
        <div style={{ flex: 1, overflow: 'auto', padding: '24px' }}>
          {loading && (
            <div style={{ textAlign: 'center', padding: '40px' }}>
              <div style={{ fontSize: '16px', color: '#6b7280' }}>Loading trade history...</div>
            </div>
          )}

          {error && (
            <div
              style={{
                padding: '16px',
                backgroundColor: '#fee2e2',
                color: '#dc2626',
                borderRadius: '8px',
                fontSize: '14px',
              }}
            >
              Error: {error}
            </div>
          )}

          {!loading && !error && tradeHistory && (
            <>
              {/* Summary Stats */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                  gap: '16px',
                  marginBottom: '24px',
                }}
              >
                <div
                  style={{
                    padding: '16px',
                    backgroundColor: '#f9fafb',
                    borderRadius: '8px',
                    border: '1px solid #e5e7eb',
                  }}
                >
                  <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>Total Trades</div>
                  <div style={{ fontSize: '24px', fontWeight: '700', color: '#111827' }}>
                    {tradeHistory.total_trades}
                  </div>
                </div>
                <div
                  style={{
                    padding: '16px',
                    backgroundColor: '#f9fafb',
                    borderRadius: '8px',
                    border: '1px solid #e5e7eb',
                  }}
                >
                  <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>Total Profit</div>
                  <div
                    style={{
                      fontSize: '24px',
                      fontWeight: '700',
                      color: tradeHistory.total_profit >= 0 ? '#22c55e' : '#ef4444',
                    }}
                  >
                    ${tradeHistory.total_profit.toFixed(2)}
                  </div>
                </div>
                <div
                  style={{
                    padding: '16px',
                    backgroundColor: '#f9fafb',
                    borderRadius: '8px',
                    border: '1px solid #e5e7eb',
                  }}
                >
                  <div style={{ fontSize: '12px', color: '#6b7280', marginBottom: '4px' }}>Total Commission</div>
                  <div style={{ fontSize: '24px', fontWeight: '700', color: '#dc2626' }}>
                    ${Math.abs(tradeHistory.total_commission).toFixed(2)}
                  </div>
                </div>
              </div>

              {/* Trades Table */}
              {tradeHistory.total_trades === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px', color: '#6b7280' }}>
                  No trades found for the selected period.
                </div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
                    <thead>
                      <tr style={{ backgroundColor: '#f9fafb', borderBottom: '2px solid #e5e7eb' }}>
                        <th style={{ padding: '12px 8px', textAlign: 'left', fontWeight: '600', color: '#374151' }}>
                          Symbol
                        </th>
                        <th style={{ padding: '12px 8px', textAlign: 'left', fontWeight: '600', color: '#374151' }}>
                          Side
                        </th>
                        <th style={{ padding: '12px 8px', textAlign: 'right', fontWeight: '600', color: '#374151' }}>
                          Lot
                        </th>
                        <th style={{ padding: '12px 8px', textAlign: 'right', fontWeight: '600', color: '#374151' }}>
                          Entry
                        </th>
                        <th style={{ padding: '12px 8px', textAlign: 'right', fontWeight: '600', color: '#374151' }}>
                          Exit
                        </th>
                        <th style={{ padding: '12px 8px', textAlign: 'right', fontWeight: '600', color: '#374151' }}>
                          Pips
                        </th>
                        <th style={{ padding: '12px 8px', textAlign: 'right', fontWeight: '600', color: '#374151' }}>
                          Commission
                        </th>
                        <th style={{ padding: '12px 8px', textAlign: 'right', fontWeight: '600', color: '#374151' }}>
                          Profit
                        </th>
                        <th style={{ padding: '12px 8px', textAlign: 'left', fontWeight: '600', color: '#374151' }}>
                          Entry Time
                        </th>
                        <th style={{ padding: '12px 8px', textAlign: 'left', fontWeight: '600', color: '#374151' }}>
                          Exit Time
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {tradeHistory.trades.map((trade, index) => (
                        <tr
                          key={trade.position_id}
                          style={{
                            borderBottom: '1px solid #e5e7eb',
                            backgroundColor: index % 2 === 0 ? 'white' : '#f9fafb',
                          }}
                        >
                          <td style={{ padding: '12px 8px', fontWeight: '500' }}>{trade.symbol}</td>
                          <td style={{ padding: '12px 8px' }}>
                            <span
                              style={{
                                padding: '4px 8px',
                                borderRadius: '4px',
                                fontSize: '12px',
                                fontWeight: '600',
                                backgroundColor: trade.side === 'BUY' ? '#dbeafe' : '#fee2e2',
                                color: trade.side === 'BUY' ? '#1e40af' : '#991b1b',
                              }}
                            >
                              {trade.side}
                            </span>
                          </td>
                          <td style={{ padding: '12px 8px', textAlign: 'right' }}>{trade.lot.toFixed(2)}</td>
                          <td style={{ padding: '12px 8px', textAlign: 'right' }}>
                            {trade.entry_price.toFixed(5)}
                          </td>
                          <td style={{ padding: '12px 8px', textAlign: 'right' }}>
                            {trade.exit_price.toFixed(5)}
                          </td>
                          <td
                            style={{
                              padding: '12px 8px',
                              textAlign: 'right',
                              color: trade.pips >= 0 ? '#22c55e' : '#ef4444',
                              fontWeight: '500',
                            }}
                          >
                            {trade.pips > 0 ? '+' : ''}
                            {trade.pips.toFixed(1)}
                          </td>
                          <td style={{ padding: '12px 8px', textAlign: 'right', color: '#dc2626' }}>
                            ${Math.abs(trade.commission).toFixed(2)}
                          </td>
                          <td
                            style={{
                              padding: '12px 8px',
                              textAlign: 'right',
                              color: trade.profit >= 0 ? '#22c55e' : '#ef4444',
                              fontWeight: '600',
                            }}
                          >
                            ${trade.profit.toFixed(2)}
                          </td>
                          <td style={{ padding: '12px 8px', fontSize: '12px', color: '#6b7280' }}>
                            {new Date(trade.entry_time).toLocaleString()}
                          </td>
                          <td style={{ padding: '12px 8px', fontSize: '12px', color: '#6b7280' }}>
                            {new Date(trade.exit_time).toLocaleString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default TradeHistoryModal;
