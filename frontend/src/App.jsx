import { useEffect, useState, useCallback } from 'react';
import { useAccounts } from './hooks/useAccounts';
import { useVersus } from './hooks/useVersus';
import AccountsTable from './components/AccountsTable';
import VersusTab from './components/versus/VersusTab';
import './App.css';
import './darkMode.css';

function App() {
  const { data, loading, error, fetchAccounts, refresh, refreshSingleAccount, updatePhase, updateVS } = useAccounts();
  const { featureEnabled: versusEnabled, checkFeatureStatus } = useVersus();
  const [editMode, setEditMode] = useState(false);
  const [activeTab, setActiveTab] = useState('cuentas'); // 'cuentas' | 'versus'
  const [darkMode, setDarkMode] = useState(() => {
    // Initialize from localStorage or default to false
    const saved = localStorage.getItem('darkMode');
    return saved ? JSON.parse(saved) : false;
  });

  // Apply dark mode class to body and adjust inline styles
  useEffect(() => {
    if (darkMode) {
      document.body.classList.add('dark-mode');

      // Fix inline styles that don't respond to CSS overrides
      const fixInlineStyles = () => {
        // Fix table headers with dark text
        document.querySelectorAll('th[style*="color"]').forEach(el => {
          if (el.style.color.includes('374151') || el.style.color.includes('111827') || el.style.color.includes('6b7280')) {
            el.style.color = '#f9fafb';
          }
        });

        // Fix table header backgrounds in trade history modal
        document.querySelectorAll('thead tr[style*="backgroundColor"]').forEach(el => {
          if (el.style.backgroundColor.includes('f9fafb')) {
            el.style.backgroundColor = '#1f2937';
            el.style.borderBottom = '2px solid #374151';
          }
        });

        // Fix any dark text in modals
        document.querySelectorAll('[style*="color"]').forEach(el => {
          const color = el.style.color;
          if (color.includes('111827') || color.includes('374151') || color.includes('1f2937')) {
            el.style.color = '#f9fafb';
          } else if (color.includes('6b7280')) {
            el.style.color = '#d1d5db';
          }
        });
      };

      // Run immediately and on DOM changes
      fixInlineStyles();
      const observer = new MutationObserver(fixInlineStyles);
      observer.observe(document.body, { childList: true, subtree: true });

      return () => observer.disconnect();
    } else {
      document.body.classList.remove('dark-mode');
    }
    // Save to localStorage
    localStorage.setItem('darkMode', JSON.stringify(darkMode));
  }, [darkMode]);

  useEffect(() => {
    fetchAccounts();
    checkFeatureStatus();
  }, [fetchAccounts, checkFeatureStatus]);

  // Silent auto-refresh every 10 minutes
  useEffect(() => {
    const timer = setInterval(() => {
      refresh();
    }, 600000); // 10 minutes

    return () => clearInterval(timer);
  }, [refresh]);

  const handlePhaseUpdate = async (accountNumber, phaseValue) => {
    await updatePhase(accountNumber, phaseValue);
  };

  const handleVSUpdate = async (accountNumber, vsValue) => {
    await updateVS(accountNumber, vsValue);
  };

  return (
    <div className="app-container">
      <header className="app-header">
        <button
          onClick={() => setDarkMode(!darkMode)}
          className="dark-mode-toggle"
          title={darkMode ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
        >
          {darkMode ? '☀️' : '🌙'}
        </button>
        <h1>MT5 Trading Accounts Monitor</h1>
        <div className="header-controls">
          {activeTab === 'cuentas' && (
            <>
              <button
                onClick={() => setEditMode(!editMode)}
                className={`edit-mode-button ${editMode ? 'active' : ''}`}
                disabled={loading}
              >
                {editMode ? 'Exit Edit Mode' : 'Edit Mode'}
              </button>
              <button
                onClick={refresh}
                disabled={loading}
                className="refresh-button"
              >
                {loading ? 'Refreshing...' : 'Refresh Data'}
              </button>
            </>
          )}
        </div>
      </header>

      {/* Tab Navigation */}
      {versusEnabled && (
        <nav style={{
          display: 'flex',
          gap: '0',
          borderBottom: '1px solid #e5e7eb',
          backgroundColor: darkMode ? '#1f2937' : '#f9fafb',
          padding: '0 24px',
        }}>
          <button
            onClick={() => setActiveTab('cuentas')}
            style={{
              padding: '12px 24px',
              border: 'none',
              backgroundColor: 'transparent',
              color: activeTab === 'cuentas' ? '#3b82f6' : (darkMode ? '#d1d5db' : '#6b7280'),
              fontWeight: activeTab === 'cuentas' ? '600' : '400',
              fontSize: '14px',
              cursor: 'pointer',
              borderBottom: activeTab === 'cuentas' ? '2px solid #3b82f6' : '2px solid transparent',
              marginBottom: '-1px',
              transition: 'all 0.2s',
            }}
          >
            Cuentas
          </button>
          <button
            onClick={() => setActiveTab('versus')}
            style={{
              padding: '12px 24px',
              border: 'none',
              backgroundColor: 'transparent',
              color: activeTab === 'versus' ? '#3b82f6' : (darkMode ? '#d1d5db' : '#6b7280'),
              fontWeight: activeTab === 'versus' ? '600' : '400',
              fontSize: '14px',
              cursor: 'pointer',
              borderBottom: activeTab === 'versus' ? '2px solid #3b82f6' : '2px solid transparent',
              marginBottom: '-1px',
              transition: 'all 0.2s',
            }}
          >
            Versus
          </button>
        </nav>
      )}

      <main className="app-main">
        {activeTab === 'cuentas' ? (
          <AccountsTable
            data={data}
            loading={loading}
            error={error}
            onRefresh={refresh}
            onRefreshSingleAccount={refreshSingleAccount}
            editMode={editMode}
            onPhaseUpdate={handlePhaseUpdate}
            onVSUpdate={handleVSUpdate}
          />
        ) : (
          <VersusTab accounts={data?.accounts || []} />
        )}
      </main>

      <footer className="app-footer">
        <p>MT5 Accounts Monitoring System - {new Date().getFullYear()}</p>
      </footer>
    </div>
  );
}

export default App;
