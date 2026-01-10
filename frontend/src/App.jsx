import { useEffect, useState } from 'react';
import { useAccounts } from './hooks/useAccounts';
import AccountsTable from './components/AccountsTable';
import './App.css';

function App() {
  const { data, loading, error, fetchAccounts, refresh, updatePhase } = useAccounts();
  const [editMode, setEditMode] = useState(false);

  useEffect(() => {
    fetchAccounts();
  }, [fetchAccounts]);

  const handlePhaseUpdate = async (accountNumber, phaseValue) => {
    await updatePhase(accountNumber, phaseValue);
  };

  return (
    <div className="app-container">
      <header className="app-header">
        <h1>MT5 Trading Accounts Monitor</h1>
        <div className="header-controls">
          <button
            onClick={() => setEditMode(!editMode)}
            className={`edit-mode-button ${editMode ? 'active' : ''}`}
            disabled={loading}
          >
            {editMode ? 'Exit Edit Mode' : 'Edit Phases'}
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
        />
      </main>

      <footer className="app-footer">
        <p>MT5 Accounts Monitoring System - {new Date().getFullYear()}</p>
      </footer>
    </div>
  );
}

export default App;
