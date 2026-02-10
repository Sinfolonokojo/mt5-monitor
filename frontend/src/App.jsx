import { useEffect, useState } from 'react';
import { useAccounts } from './hooks/useAccounts';
import { useVersus } from './hooks/useVersus';
import { useAuth } from './hooks/useAuth';
import AccountsTable from './components/AccountsTable';
import VersusTab from './components/versus/VersusTab';
import LoginPage from './components/LoginPage';
import './App.css';
import './darkMode.css';

function App() {
  const { isAuthenticated, loading: authLoading, error: authError, login, logout } = useAuth();
  const { data, loading, error, fetchAccounts, refresh, refreshSingleAccount, updatePhase, updateVS } = useAccounts();
  const { featureEnabled: versusEnabled, checkFeatureStatus } = useVersus();
  const [editMode, setEditMode] = useState(false);
  const [activeTab, setActiveTab] = useState('cuentas');
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  useEffect(() => {
    if (isAuthenticated) {
      fetchAccounts();
      checkFeatureStatus();
    }
  }, [fetchAccounts, checkFeatureStatus, isAuthenticated]);

  // Silent auto-refresh every 10 minutes
  useEffect(() => {
    if (!isAuthenticated) return;

    const timer = setInterval(() => {
      refresh();
    }, 600000);

    return () => clearInterval(timer);
  }, [refresh, isAuthenticated]);

  const handleTabChange = (tab) => {
    setActiveTab(tab);
  };

  const handlePhaseUpdate = async (accountNumber, phaseValue) => {
    await updatePhase(accountNumber, phaseValue);
  };

  const handleVSUpdate = async (accountNumber, vsValue) => {
    await updateVS(accountNumber, vsValue);
  };

  // Show loading screen while checking auth
  if (authLoading) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'var(--bg-dark)'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: '40px',
            height: '40px',
            border: '3px solid var(--border-color)',
            borderTopColor: 'var(--primary)',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            margin: '0 auto 16px'
          }} />
          <p style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>Cargando...</p>
        </div>
        <style>{`
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

  // Show login page if not authenticated
  if (!isAuthenticated) {
    return <LoginPage onLogin={login} loading={authLoading} error={authError} />;
  }

  // Calculate stats
  const totalAccounts = data?.total_accounts || 0;
  const accounts = data?.accounts || [];
  const fase1Count = accounts.filter(a => a.phase === 'F1').length;
  const fase2Count = accounts.filter(a => a.phase === 'F2').length;
  const realCount = accounts.filter(a => a.phase === 'R').length;

  return (
    <div className={`app-container ${sidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
      {/* Mobile Header */}
      <div className="mobile-header">
        <div className="mobile-header-logo">
          Prop <span>Trade</span> Pro
        </div>
        <div className="mobile-header-actions">
          {activeTab === 'cuentas' && (
            <>
              <button
                onClick={() => setEditMode(!editMode)}
                className={`btn btn-sm ${editMode ? 'btn-primary' : 'btn-secondary'}`}
                disabled={loading}
              >
                {editMode ? '✓' : '✏️'}
              </button>
              <button
                onClick={refresh}
                disabled={loading}
                className="btn btn-sm btn-secondary"
              >
                {loading ? '⏳' : '🔄'}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Sidebar (desktop only) */}
      <aside className={`app-sidebar ${sidebarCollapsed ? 'collapsed' : ''}`}>
        <div>
          {/* Toggle Button & Logo */}
          <div className="sidebar-header">
            <button
              className="sidebar-toggle"
              onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
              title={sidebarCollapsed ? 'Expandir menú' : 'Colapsar menú'}
            >
              {sidebarCollapsed ? '☰' : '✕'}
            </button>
            {!sidebarCollapsed && (
              <div className="sidebar-logo">
                <h1>Prop <span>Trade</span> Pro</h1>
                <div className="version">v2.4.1</div>
              </div>
            )}
          </div>

          {/* Navigation */}
          <nav className="sidebar-nav">
            <button
              className={`nav-item ${activeTab === 'cuentas' ? 'active' : ''}`}
              onClick={() => handleTabChange('cuentas')}
              title="Dashboard"
            >
              <span className="icon">📊</span>
              {!sidebarCollapsed && <span>Panel Principal</span>}
            </button>
            <button
              className={`nav-item ${activeTab === 'versus' ? 'active' : ''}`}
              onClick={() => handleTabChange('versus')}
              title="Versus Trading"
            >
              <span className="icon">⚡</span>
              {!sidebarCollapsed && <span>Versus Trading</span>}
            </button>
          </nav>
        </div>

        {/* User Section */}
        <div className="sidebar-user-container">
          <button
            className="sidebar-user"
            onClick={() => setShowUserMenu(!showUserMenu)}
            title={sidebarCollapsed ? 'Administrador' : ''}
          >
            <div className="sidebar-user-avatar">👤</div>
            {!sidebarCollapsed && (
              <>
                <div className="sidebar-user-info">
                  <div className="sidebar-user-name">Administrador</div>
                  <div className="sidebar-user-role">Cuenta Pro</div>
                </div>
                <span className={`sidebar-user-chevron ${showUserMenu ? 'open' : ''}`}>
                  ▲
                </span>
              </>
            )}
          </button>
          {showUserMenu && (
            <div className="sidebar-user-menu">
              <button className="sidebar-user-menu-item logout" onClick={logout}>
                <span>🚪</span>
                {!sidebarCollapsed && <span>Cerrar Sesión</span>}
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* Main Content */}
      <div className="app-main-wrapper">
        {/* Desktop Top Stats Bar */}
        <div className="top-stats-bar">
          <div className="stat-card">
            <div className="stat-card-header">
              <span className="stat-card-label">Total Cuentas</span>
              <span className="stat-card-icon">📋</span>
            </div>
            <div className="stat-card-value">
              <span className="stat-card-number">{totalAccounts}</span>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-card-header">
              <span className="stat-card-label">Fase 1</span>
              <span className="stat-card-icon">🔵</span>
            </div>
            <div className="stat-card-value">
              <span className="stat-card-number">{fase1Count}</span>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-card-header">
              <span className="stat-card-label">Fase 2</span>
              <span className="stat-card-icon">🟣</span>
            </div>
            <div className="stat-card-value">
              <span className="stat-card-number">{fase2Count}</span>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-card-header">
              <span className="stat-card-label">Fondeadas</span>
              <span className="stat-card-icon">🟢</span>
            </div>
            <div className="stat-card-value">
              <span className="stat-card-number">{realCount}</span>
            </div>
          </div>
        </div>

        {/* Mobile Stat Cards */}
        <div className="mobile-stat-cards">
          <div className="stat-card">
            <div className="stat-card-header">
              <span className="stat-card-label">Total</span>
              <span className="stat-card-icon">📋</span>
            </div>
            <div className="stat-card-value">
              <span className="stat-card-number">{totalAccounts}</span>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-card-header">
              <span className="stat-card-label">Fase 1</span>
              <span className="stat-card-icon">🔵</span>
            </div>
            <div className="stat-card-value">
              <span className="stat-card-number">{fase1Count}</span>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-card-header">
              <span className="stat-card-label">Fase 2</span>
              <span className="stat-card-icon">🟣</span>
            </div>
            <div className="stat-card-value">
              <span className="stat-card-number">{fase2Count}</span>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-card-header">
              <span className="stat-card-label">Fondeadas</span>
              <span className="stat-card-icon">🟢</span>
            </div>
            <div className="stat-card-value">
              <span className="stat-card-number">{realCount}</span>
            </div>
          </div>
        </div>

        {/* Desktop Header with controls */}
        <div className="desktop-header-controls" style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '16px 24px',
          borderBottom: '1px solid var(--border-color)',
          backgroundColor: 'var(--bg-surface)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <h2 style={{
              color: 'var(--text-primary)',
              fontSize: '18px',
              fontWeight: '600',
              margin: 0
            }}>
              {activeTab === 'cuentas' ? 'Cuentas Activas' : 'Versus Trading'}
            </h2>
            {activeTab === 'cuentas' && (
              <span style={{
                fontSize: '12px',
                backgroundColor: 'rgba(19, 91, 236, 0.2)',
                color: 'var(--primary)',
                padding: '2px 8px',
                borderRadius: '9999px',
                fontFamily: 'var(--font-mono)'
              }}>
                {totalAccounts}
              </span>
            )}
          </div>

          <div className="header-controls">
            {activeTab === 'cuentas' && (
              <>
                <button
                  onClick={() => setEditMode(!editMode)}
                  className={`btn ${editMode ? 'btn-primary' : 'btn-secondary'}`}
                  disabled={loading}
                >
                  {editMode ? '✓ Salir Edición' : '✏️ Modo Edición'}
                </button>
                <button
                  onClick={refresh}
                  disabled={loading}
                  className="btn btn-secondary"
                >
                  {loading ? '⏳ Actualizando...' : '🔄 Actualizar'}
                </button>
              </>
            )}
          </div>
        </div>

        {/* Main Content Area */}
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

        {/* Footer */}
        <footer className="app-footer">
          <p>Sistema de Monitoreo de Cuentas MT5 - {new Date().getFullYear()}</p>
        </footer>
      </div>

      {/* Mobile Bottom Navigation */}
      <nav className="mobile-bottom-nav">
        <button
          className={`mobile-nav-item ${activeTab === 'cuentas' ? 'active' : ''}`}
          onClick={() => handleTabChange('cuentas')}
        >
          <span className="nav-icon">📊</span>
          <span>Dashboard</span>
        </button>
        <button
          className={`mobile-nav-item ${activeTab === 'versus' ? 'active' : ''}`}
          onClick={() => handleTabChange('versus')}
        >
          <span className="nav-icon">⚡</span>
          <span>Versus</span>
        </button>
      </nav>
    </div>
  );
}

export default App;
