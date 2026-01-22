import { useEffect, useState, useCallback } from 'react';
import { useAccounts } from './hooks/useAccounts';
import AccountsTable from './components/AccountsTable';
import './App.css';
import './darkMode.css';

function App() {
  const { data, loading, error, fetchAccounts, refresh, updatePhase, updateVS } = useAccounts();
  const [editMode, setEditMode] = useState(false);
  const [darkMode, setDarkMode] = useState(() => {
    // Initialize from localStorage or default to false
    const saved = localStorage.getItem('darkMode');
    return saved ? JSON.parse(saved) : false;
  });

  // Apply dark mode class to body
  useEffect(() => {
    if (darkMode) {
      document.body.classList.add('dark-mode');
    } else {
      document.body.classList.remove('dark-mode');
    }
    // Save to localStorage
    localStorage.setItem('darkMode', JSON.stringify(darkMode));
  }, [darkMode]);

  useEffect(() => {
    fetchAccounts();
  }, [fetchAccounts]);

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
        </div>
      </header>

      <main className="app-main">
        <AccountsTable
          data={data}
          loading={loading}
          error={error}
          onRefresh={refresh}
          editMode={editMode}
          onPhaseUpdate={handlePhaseUpdate}
          onVSUpdate={handleVSUpdate}
        />
      </main>

      <footer className="app-footer">
        <p>MT5 Accounts Monitoring System - {new Date().getFullYear()}</p>
      </footer>
    </div>
  );
}

export default App;
