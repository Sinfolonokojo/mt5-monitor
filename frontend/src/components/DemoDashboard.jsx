import { useState } from 'react';
import './DemoDashboard.css';

// Fictional fixtures only. This view never imports the live API or auth services.
const accounts = [
  { id: 'DEMO-001', name: 'Demo Atlas', phase: 'F1', balance: 100000, profit: 1250, positions: 2 },
  { id: 'DEMO-002', name: 'Demo Boreal', phase: 'F1', balance: 50000, profit: -320, positions: 1 },
  { id: 'DEMO-003', name: 'Demo Aurora', phase: 'F2', balance: 100000, profit: 2480, positions: 3 },
  { id: 'DEMO-004', name: 'Demo Horizonte', phase: 'F2', balance: 25000, profit: 180, positions: 1 },
  { id: 'DEMO-005', name: 'Demo Órbita', phase: 'R', balance: 200000, profit: 3640, positions: 4 },
  { id: 'DEMO-006', name: 'Demo Pacífico', phase: 'R', balance: 50000, profit: 0, positions: 0 },
];
const phaseNames = { F1: 'Fase 1', F2: 'Fase 2', R: 'Fondeada' };
const money = value => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'USD' }).format(value);
const normalize = value => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

export default function DemoDashboard({ onExit }) {
  const [search, setSearch] = useState('');
  const [phase, setPhase] = useState('');
  const [expanded, setExpanded] = useState(null);
  const visible = accounts.filter(account =>
    (!phase || account.phase === phase) &&
    normalize(`${account.id} ${account.name}`).includes(normalize(search.trim()))
  );

  return (
    <div className="demo-dashboard">
      <header className="demo-header">
        <div className="demo-brand">Prop <span>Trade</span> Pro <span className="demo-badge">DEMO</span></div>
        <button type="button" className="demo-button" onClick={onExit}>Volver al acceso</button>
      </header>
      <main className="demo-main">
        <aside className="demo-notice" aria-label="Modo demostración">
          <strong>Datos ficticios · Sin operaciones reales</strong>
          <span>Vista de ejemplo disponible sin conexión al servidor. Los valores no se actualizan en tiempo real.</span>
        </aside>
        <div className="demo-heading">
          <p className="demo-eyebrow">VISTA PREVIA / MT5 MONITOR</p>
          <h1>Panel de demostración</h1>
          <p>Explora las cuentas de ejemplo y sus detalles mientras se restablece la conexión.</p>
        </div>
        <section className="demo-stats" aria-label="Resumen de cuentas de ejemplo">
          {[
            ['Total cuentas', accounts.length],
            ['Fase 1', accounts.filter(a => a.phase === 'F1').length],
            ['Fase 2', accounts.filter(a => a.phase === 'F2').length],
            ['Fondeadas', accounts.filter(a => a.phase === 'R').length],
          ].map(([label, count]) => (
            <div className="demo-stat" key={label}><span>{label}</span><strong>{count}</strong><small>Cuentas de ejemplo</small></div>
          ))}
        </section>
        <section className="demo-accounts" aria-labelledby="demo-accounts-title">
          <div className="demo-section-header">
            <h2 id="demo-accounts-title">Cuentas de ejemplo</h2>
            <span aria-live="polite">{visible.length} de {accounts.length} cuentas</span>
          </div>
          <div className="demo-filters">
            <label>Buscar cuenta<input type="search" value={search} onChange={event => setSearch(event.target.value)} placeholder="Nombre o número de cuenta" /></label>
            <label>Fase<select value={phase} onChange={event => setPhase(event.target.value)}>
              <option value="">Todas las fases</option><option value="F1">Fase 1</option><option value="F2">Fase 2</option><option value="R">Fondeada</option>
            </select></label>
          </div>
          <div className="demo-account-list">
            {visible.map(account => (
              <article className="demo-account" key={account.id}>
                <div className="demo-account-title"><div><h3>{account.name}</h3><span>{account.id}</span></div><span className={`demo-phase demo-phase-${account.phase}`}>{phaseNames[account.phase]}</span></div>
                <dl className="demo-metrics">
                  <div><dt>Balance</dt><dd>{money(account.balance)}</dd></div>
                  <div><dt>Equidad</dt><dd>{money(account.balance + account.profit)}</dd></div>
                  <div><dt>P/L flotante</dt><dd className={account.profit >= 0 ? 'demo-positive' : 'demo-negative'}>{money(account.profit)}</dd></div>
                </dl>
                <button type="button" className="demo-detail-button" aria-label={`${expanded === account.id ? 'Ocultar' : 'Ver'} detalles de ${account.name}`} aria-expanded={expanded === account.id} aria-controls={`details-${account.id}`} onClick={() => setExpanded(expanded === account.id ? null : account.id)}>
                  {expanded === account.id ? 'Ocultar detalles' : 'Ver detalles'} <span aria-hidden="true">{expanded === account.id ? '−' : '+'}</span>
                </button>
                {expanded === account.id && <div className="demo-details" id={`details-${account.id}`}>
                  <p>Servidor: Demo-MT5</p><p>Divisa: USD</p><p>Posiciones de ejemplo: {account.positions}</p>
                  <p>Cuenta ficticia. Las operaciones y la edición están disponibles únicamente en el panel conectado.</p>
                </div>}
              </article>
            ))}
          </div>
          {visible.length === 0 && <p className="demo-empty" role="status">No hay cuentas que coincidan con los filtros.</p>}
        </section>
        <footer className="demo-footer">Modo demostración · Datos locales de ejemplo · MT5 Monitor</footer>
      </main>
    </div>
  );
}
