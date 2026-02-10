const VersusCard = ({ versus, accounts = [], onClick }) => {
  const getAccountInfo = (accountNumber) => {
    const acc = accounts.find(a => a.account_number === accountNumber);
    if (!acc) return null;
    return { holder: acc.account_holder, firm: acc.prop_firm };
  };

  const accountInfoA = getAccountInfo(versus.account_a);
  const accountInfoB = getAccountInfo(versus.account_b);

  const statusConfig = {
    pending: { bg: 'rgba(251, 191, 36, 0.15)', text: '#fbbf24', label: 'Pendiente', dot: true },
    congelado: { bg: 'rgba(59, 130, 246, 0.15)', text: '#3b82f6', label: 'Congelado', dot: true },
    transferido: { bg: 'rgba(16, 185, 129, 0.15)', text: '#10b981', label: 'Transferido', dot: false },
    completed: { bg: 'rgba(107, 114, 128, 0.15)', text: '#6b7280', label: 'Completado', dot: false },
    error: { bg: 'rgba(239, 68, 68, 0.15)', text: '#ef4444', label: 'Error', dot: false }
  };

  const status = statusConfig[versus.status] || statusConfig.pending;
  const isInactive = versus.status === 'completed' || versus.status === 'transferido';

  return (
    <div
      className="versus-card-glow"
      onClick={() => onClick && onClick(versus)}
      style={{
        backgroundColor: 'var(--bg-surface)',
        borderRadius: '12px',
        border: '1px solid var(--border-color)',
        overflow: 'hidden',
        cursor: 'pointer',
        opacity: isInactive ? 0.7 : 1,
        transition: 'all 0.2s ease',
      }}
    >
      {/* Header */}
      <div style={{
        padding: '14px 18px',
        borderBottom: '1px solid var(--border-color)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{
            padding: '4px 10px',
            borderRadius: '6px',
            fontSize: '12px',
            fontWeight: '700',
            color: 'var(--primary)',
            backgroundColor: 'rgba(19, 91, 236, 0.1)',
            fontFamily: 'var(--font-mono)',
          }}>
            VS-{versus.id}
          </span>
          <span style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '4px 10px',
            borderRadius: '9999px',
            fontSize: '11px',
            fontWeight: '600',
            backgroundColor: status.bg,
            color: status.text,
            textTransform: 'uppercase',
            letterSpacing: '0.02em',
          }}>
            {status.dot && (
              <span style={{
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                backgroundColor: status.text,
                animation: 'pulse 2s ease-in-out infinite',
              }} />
            )}
            {status.label}
          </span>
        </div>
      </div>

      {/* Body - 3 column grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr auto 1fr',
        alignItems: 'center',
        padding: '20px 18px',
        gap: '0',
      }}>
        {/* Account A */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {accountInfoA?.firm && (
            <span style={{
              display: 'inline-block',
              width: 'fit-content',
              padding: '2px 8px',
              borderRadius: '4px',
              fontSize: '10px',
              fontWeight: '600',
              backgroundColor: 'rgba(139, 92, 246, 0.15)',
              color: '#a78bfa',
              textTransform: 'uppercase',
              letterSpacing: '0.03em',
            }}>
              {accountInfoA.firm}
            </span>
          )}
          <span style={{
            fontSize: '13px',
            color: 'var(--text-secondary)',
            fontWeight: '500',
          }}>
            {accountInfoA?.holder || 'Cuenta A'}
          </span>
          <span style={{
            display: 'inline-block',
            width: 'fit-content',
            padding: '4px 10px',
            borderRadius: '6px',
            fontSize: '14px',
            fontWeight: '600',
            color: 'var(--text-primary)',
            fontFamily: 'var(--font-mono)',
            backgroundColor: 'var(--bg-dark)',
            border: '1px solid var(--border-color)',
          }}>
            #{versus.account_a}
          </span>
        </div>

        {/* VS Divider */}
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          padding: '0 16px',
          gap: '0',
        }}>
          <div style={{
            width: '1px',
            height: '20px',
            backgroundColor: 'var(--border-color)',
          }} />
          <div style={{
            width: '36px',
            height: '36px',
            borderRadius: '50%',
            backgroundColor: 'var(--bg-header)',
            border: '2px solid var(--border-color)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '11px',
            fontWeight: '700',
            color: 'var(--primary)',
          }}>
            VS
          </div>
          <div style={{
            width: '1px',
            height: '20px',
            backgroundColor: 'var(--border-color)',
          }} />
        </div>

        {/* Account B */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', alignItems: 'flex-end' }}>
          {accountInfoB?.firm && (
            <span style={{
              display: 'inline-block',
              width: 'fit-content',
              padding: '2px 8px',
              borderRadius: '4px',
              fontSize: '10px',
              fontWeight: '600',
              backgroundColor: 'rgba(236, 72, 153, 0.15)',
              color: '#f472b6',
              textTransform: 'uppercase',
              letterSpacing: '0.03em',
            }}>
              {accountInfoB.firm}
            </span>
          )}
          <span style={{
            fontSize: '13px',
            color: 'var(--text-secondary)',
            fontWeight: '500',
          }}>
            {accountInfoB?.holder || 'Cuenta B'}
          </span>
          <span style={{
            display: 'inline-block',
            width: 'fit-content',
            padding: '4px 10px',
            borderRadius: '6px',
            fontSize: '14px',
            fontWeight: '600',
            color: 'var(--text-primary)',
            fontFamily: 'var(--font-mono)',
            backgroundColor: 'var(--bg-dark)',
            border: '1px solid var(--border-color)',
          }}>
            #{versus.account_b}
          </span>
        </div>
      </div>

      {/* Footer */}
      <div style={{
        padding: '12px 18px',
        backgroundColor: 'var(--bg-header)',
        borderTop: '1px solid var(--border-color)',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{
            padding: '4px 10px',
            borderRadius: '4px',
            fontSize: '12px',
            fontWeight: '600',
            color: 'var(--text-primary)',
            backgroundColor: 'var(--bg-dark)',
            fontFamily: 'var(--font-mono)',
            border: '1px solid var(--border-color)',
          }}>
            {versus.symbol}
          </span>
          <span style={{
            fontSize: '12px',
            fontWeight: '600',
            fontFamily: 'var(--font-mono)',
            color: versus.side === 'BUY' ? 'var(--green)' : 'var(--red)',
          }}>
            {versus.side} {versus.lots}L
          </span>
        </div>
        <span style={{
          fontSize: '16px',
          color: 'var(--text-muted)',
          transition: 'transform 0.2s',
        }}>
          ›
        </span>
      </div>

      {/* Error indicator */}
      {versus.error_message && (
        <div style={{
          padding: '8px 18px',
          backgroundColor: 'rgba(239, 68, 68, 0.1)',
          borderTop: '1px solid rgba(239, 68, 68, 0.2)',
          fontSize: '12px',
          color: 'var(--red)',
          fontWeight: '500',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}>
          Error: {versus.error_message}
        </div>
      )}
    </div>
  );
};

export default VersusCard;
