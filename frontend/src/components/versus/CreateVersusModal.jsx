import { useState, useRef, useEffect } from 'react';

const SearchableAccountSelect = ({ accounts, value, onChange, name, placeholder = 'Buscar cuenta...' }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const containerRef = useRef(null);
  const inputRef = useRef(null);

  const selectedAccount = accounts.find(a => a.account_number === parseInt(value));

  const filtered = accounts.filter(acc => {
    if (!acc.account_number) return false;
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      String(acc.account_number).includes(q) ||
      (acc.account_holder || '').toLowerCase().includes(q) ||
      (acc.prop_firm || '').toLowerCase().includes(q)
    );
  });

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
        setSearch('');
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (isOpen && inputRef.current) inputRef.current.focus();
  }, [isOpen]);

  const handleSelect = (acc) => {
    onChange({ target: { name, value: String(acc.account_number) } });
    setIsOpen(false);
    setSearch('');
  };

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      <div
        onClick={() => setIsOpen(!isOpen)}
        style={{
          ...selectStyle,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          cursor: 'pointer',
          minHeight: '40px',
        }}
      >
        <span style={{ color: selectedAccount ? 'var(--text-primary)' : 'var(--text-muted)', fontSize: '13px' }}>
          {selectedAccount
            ? `${selectedAccount.account_holder} - ${selectedAccount.prop_firm} #${selectedAccount.account_number}`
            : 'Elegir cuenta...'}
        </span>
        <span style={{ color: 'var(--text-muted)', fontSize: '10px', transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }}>
          ▼
        </span>
      </div>

      {isOpen && (
        <div style={{
          position: 'absolute',
          top: '100%',
          left: 0,
          right: 0,
          zIndex: 50,
          backgroundColor: 'var(--bg-surface)',
          border: '1px solid var(--border-color)',
          borderRadius: '8px',
          marginTop: '4px',
          boxShadow: '0 10px 25px rgba(0,0,0,0.4)',
          overflow: 'hidden',
        }}>
          <div style={{ padding: '8px', borderBottom: '1px solid var(--border-color)' }}>
            <input
              ref={inputRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={placeholder}
              style={{
                width: '100%',
                padding: '8px 10px',
                backgroundColor: 'var(--bg-dark)',
                border: '1px solid var(--border-color)',
                borderRadius: '6px',
                fontSize: '13px',
                color: 'var(--text-primary)',
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>
          <div style={{ maxHeight: '200px', overflowY: 'auto' }}>
            {filtered.length === 0 ? (
              <div style={{ padding: '12px 16px', color: 'var(--text-muted)', fontSize: '12px', textAlign: 'center' }}>
                Sin resultados
              </div>
            ) : (
              filtered.map(acc => (
                <div
                  key={acc.account_number}
                  onClick={() => handleSelect(acc)}
                  style={{
                    padding: '8px 16px',
                    cursor: 'pointer',
                    fontSize: '13px',
                    color: parseInt(value) === acc.account_number ? 'var(--primary)' : 'var(--text-primary)',
                    backgroundColor: parseInt(value) === acc.account_number ? 'rgba(19, 91, 236, 0.1)' : 'transparent',
                    transition: 'background-color 0.1s',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = parseInt(value) === acc.account_number ? 'rgba(19, 91, 236, 0.15)' : 'var(--bg-surface-hover)'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = parseInt(value) === acc.account_number ? 'rgba(19, 91, 236, 0.1)' : 'transparent'}
                >
                  <span>{acc.account_holder} - <strong>{acc.prop_firm}</strong></span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-muted)' }}>
                    #{acc.account_number}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

const CreateVersusModal = ({ accounts, onClose, onCreate }) => {
  const initialFormData = {
    account_a: '',
    account_b: '',
    symbol: 'EURUSD',
    side: 'BUY',
    lots: 0.01,
    tp_usd_a: 5,
    sl_usd_a: 5,
    tp_usd_b: 5,
    sl_usd_b: 5,
    scheduled_congelar: '',
    scheduled_transferir: ''
  };

  const [formData, setFormData] = useState(initialFormData);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    const numericFields = ['lots', 'tp_usd_a', 'sl_usd_a', 'tp_usd_b', 'sl_usd_b'];
    setFormData(prev => ({
      ...prev,
      [name]: numericFields.includes(name) ? value.replace(',', '.') : value
    }));
    setError(null);
  };

  const validateForm = () => {
    if (!formData.account_a) {
      setError('Cuenta A es requerida');
      return false;
    }
    if (!formData.account_b) {
      setError('Cuenta B es requerida');
      return false;
    }
    if (formData.account_a === formData.account_b) {
      setError('Cuenta A y Cuenta B deben ser diferentes');
      return false;
    }
    if (!formData.symbol || formData.symbol.trim() === '') {
      setError('Símbolo es requerido');
      return false;
    }
    const lots = parseFloat(formData.lots);
    if (isNaN(lots) || lots <= 0 || lots > 100) {
      setError('Los lotes deben estar entre 0.01 y 100');
      return false;
    }
    if (isNaN(parseFloat(formData.tp_usd_a)) || parseFloat(formData.tp_usd_a) <= 0) {
      setError('Take Profit Cuenta A debe ser mayor a 0');
      return false;
    }
    if (isNaN(parseFloat(formData.sl_usd_a)) || parseFloat(formData.sl_usd_a) <= 0) {
      setError('Stop Loss Cuenta A debe ser mayor a 0');
      return false;
    }
    if (isNaN(parseFloat(formData.tp_usd_b)) || parseFloat(formData.tp_usd_b) <= 0) {
      setError('Take Profit Cuenta B debe ser mayor a 0');
      return false;
    }
    if (isNaN(parseFloat(formData.sl_usd_b)) || parseFloat(formData.sl_usd_b) <= 0) {
      setError('Stop Loss Cuenta B debe ser mayor a 0');
      return false;
    }
    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) return;

    setLoading(true);
    setError(null);

    try {
      const acctA = accounts.find(a => a.account_number === parseInt(formData.account_a));
      const acctB = accounts.find(a => a.account_number === parseInt(formData.account_b));

      const config = {
        account_a: parseInt(formData.account_a),
        account_b: parseInt(formData.account_b),
        symbol: formData.symbol.trim().toUpperCase(),
        side: formData.side,
        lots: parseFloat(formData.lots),
        tp_usd_a: parseFloat(formData.tp_usd_a),
        sl_usd_a: parseFloat(formData.sl_usd_a),
        tp_usd_b: parseFloat(formData.tp_usd_b),
        sl_usd_b: parseFloat(formData.sl_usd_b),
        holder_a: acctA?.account_holder || '',
        prop_firm_a: acctA?.prop_firm || '',
        holder_b: acctB?.account_holder || '',
        prop_firm_b: acctB?.prop_firm || '',
      };

      if (formData.scheduled_congelar) {
        config.scheduled_congelar = new Date(formData.scheduled_congelar).toISOString();
      }
      if (formData.scheduled_transferir) {
        config.scheduled_transferir = new Date(formData.scheduled_transferir).toISOString();
      }

      await onCreate(config);
      onClose();
    } catch (err) {
      setError(err.message || 'Error al crear Versus');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        backdropFilter: 'blur(4px)',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 1000,
        padding: '16px',
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: 'var(--bg-surface)',
          borderRadius: '12px',
          maxWidth: '700px',
          width: '100%',
          maxHeight: '90vh',
          overflow: 'auto',
          border: '1px solid var(--border-color)',
          boxShadow: '0 25px 50px rgba(0, 0, 0, 0.5)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{
          padding: '20px 24px',
          borderBottom: '1px solid var(--border-color)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          backgroundColor: 'var(--bg-header)',
        }}>
          <div>
            <h2 style={{
              margin: 0,
              fontSize: '18px',
              fontWeight: '600',
              color: 'var(--text-primary)',
            }}>
              Crear Versus
            </h2>
            <p style={{
              margin: '4px 0 0',
              fontSize: '13px',
              color: 'var(--text-muted)',
            }}>
              Configurar trading con cobertura
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '24px',
              cursor: 'pointer',
              color: 'var(--text-muted)',
              lineHeight: '1',
              padding: '4px',
              borderRadius: '4px',
              transition: 'color 0.15s',
            }}
            onMouseEnter={(e) => e.target.style.color = 'var(--text-primary)'}
            onMouseLeave={(e) => e.target.style.color = 'var(--text-muted)'}
          >
            ×
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ padding: '24px' }}>
          {/* Error Message */}
          {error && (
            <div style={{
              padding: '12px 16px',
              backgroundColor: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              borderRadius: '8px',
              color: 'var(--red)',
              fontSize: '13px',
              marginBottom: '20px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}>
              <span>⚠</span> {error}
            </div>
          )}

          {/* Accounts Row */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr auto 1fr',
            gap: '20px',
            marginBottom: '24px',
            alignItems: 'start',
          }}>
            {/* Account A Column */}
            <div style={{
              padding: '20px',
              backgroundColor: 'var(--bg-header)',
              borderRadius: '8px',
              border: '1px solid var(--border-color)',
            }}>
              <div style={sectionTitleStyle}>
                <span style={{ color: 'var(--green)' }}>A</span> Cuenta A
              </div>
              <div style={{ marginBottom: '16px' }}>
                <label style={labelStyle}>Seleccionar Cuenta *</label>
                <SearchableAccountSelect
                  accounts={accounts}
                  value={formData.account_a}
                  onChange={handleInputChange}
                  name="account_a"
                />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={labelStyle}>TP (USD)</label>
                  <input
                    type="text"
                    inputMode="decimal"
                    name="tp_usd_a"
                    value={formData.tp_usd_a}
                    onChange={handleInputChange}
                    placeholder="5"
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label style={labelStyle}>SL (USD)</label>
                  <input
                    type="text"
                    inputMode="decimal"
                    name="sl_usd_a"
                    value={formData.sl_usd_a}
                    onChange={handleInputChange}
                    placeholder="5"
                    style={inputStyle}
                  />
                </div>
              </div>
            </div>

            {/* VS Divider */}
            <div style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              paddingTop: '60px',
            }}>
              <div style={{
                width: '40px',
                height: '40px',
                borderRadius: '50%',
                backgroundColor: 'var(--primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '12px',
                fontWeight: '700',
                color: 'white',
              }}>
                VS
              </div>
            </div>

            {/* Account B Column */}
            <div style={{
              padding: '20px',
              backgroundColor: 'var(--bg-header)',
              borderRadius: '8px',
              border: '1px solid var(--border-color)',
            }}>
              <div style={sectionTitleStyle}>
                <span style={{ color: 'var(--red)' }}>B</span> Cuenta B
              </div>
              <div style={{ marginBottom: '16px' }}>
                <label style={labelStyle}>Seleccionar Cuenta *</label>
                <SearchableAccountSelect
                  accounts={accounts}
                  value={formData.account_b}
                  onChange={handleInputChange}
                  name="account_b"
                />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                <div>
                  <label style={labelStyle}>TP (USD)</label>
                  <input
                    type="text"
                    inputMode="decimal"
                    name="tp_usd_b"
                    value={formData.tp_usd_b}
                    onChange={handleInputChange}
                    placeholder="5"
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label style={labelStyle}>SL (USD)</label>
                  <input
                    type="text"
                    inputMode="decimal"
                    name="sl_usd_b"
                    value={formData.sl_usd_b}
                    onChange={handleInputChange}
                    placeholder="5"
                    style={inputStyle}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Trade Settings */}
          <div style={{
            padding: '20px',
            backgroundColor: 'var(--bg-header)',
            borderRadius: '8px',
            border: '1px solid var(--border-color)',
            marginBottom: '24px',
          }}>
            <div style={{ ...sectionTitleStyle, marginBottom: '16px' }}>
              Configuración de Trade
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px' }}>
              {/* Symbol */}
              <div>
                <label style={labelStyle}>Símbolo *</label>
                <input
                  type="text"
                  name="symbol"
                  value={formData.symbol}
                  onChange={handleInputChange}
                  placeholder="EURUSD"
                  required
                  style={inputStyle}
                />
              </div>

              {/* Lots */}
              <div>
                <label style={labelStyle}>Lots *</label>
                <input
                  type="text"
                  inputMode="decimal"
                  name="lots"
                  value={formData.lots}
                  onChange={handleInputChange}
                  placeholder="0.01"
                  style={inputStyle}
                />
              </div>

              {/* Side */}
              <div>
                <label style={labelStyle}>Dirección (Cuenta A) *</label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, side: 'BUY' }))}
                    style={{
                      flex: 1,
                      padding: '10px',
                      backgroundColor: formData.side === 'BUY' ? 'var(--green)' : 'var(--bg-surface)',
                      color: formData.side === 'BUY' ? 'white' : 'var(--text-secondary)',
                      border: `1px solid ${formData.side === 'BUY' ? 'var(--green)' : 'var(--border-color)'}`,
                      borderRadius: '6px',
                      fontSize: '13px',
                      fontWeight: '600',
                      cursor: 'pointer',
                      transition: 'all 0.15s',
                    }}
                  >
                    BUY
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, side: 'SELL' }))}
                    style={{
                      flex: 1,
                      padding: '10px',
                      backgroundColor: formData.side === 'SELL' ? 'var(--red)' : 'var(--bg-surface)',
                      color: formData.side === 'SELL' ? 'white' : 'var(--text-secondary)',
                      border: `1px solid ${formData.side === 'SELL' ? 'var(--red)' : 'var(--border-color)'}`,
                      borderRadius: '6px',
                      fontSize: '13px',
                      fontWeight: '600',
                      cursor: 'pointer',
                      transition: 'all 0.15s',
                    }}
                  >
                    SELL
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Scheduled Actions */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '16px',
            marginBottom: '24px',
          }}>
            <div>
              <label style={labelStyle}>Programar Congelación (opcional)</label>
              <input
                type="datetime-local"
                name="scheduled_congelar"
                value={formData.scheduled_congelar}
                onChange={handleInputChange}
                style={inputStyle}
              />
              <p style={{
                fontSize: '12px',
                color: 'var(--text-muted)',
                marginTop: '6px',
              }}>
                Dejar vacío para ejecutar manualmente
              </p>
            </div>
            <div>
              <label style={labelStyle}>Programar Transferir (opcional)</label>
              <input
                type="datetime-local"
                name="scheduled_transferir"
                value={formData.scheduled_transferir}
                onChange={handleInputChange}
                style={inputStyle}
              />
              <p style={{
                fontSize: '12px',
                color: 'var(--text-muted)',
                marginTop: '6px',
              }}>
                Se ejecuta después de congelar
              </p>
            </div>
          </div>

          {/* Actions */}
          <div style={{
            display: 'flex',
            gap: '12px',
            paddingTop: '16px',
            borderTop: '1px solid var(--border-color)',
          }}>
            <button
              type="button"
              onClick={onClose}
              className="btn btn-secondary"
              style={{ flex: 1 }}
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="btn btn-primary"
              style={{ flex: 1, opacity: loading ? 0.7 : 1 }}
            >
              {loading ? 'Creando...' : 'Crear Versus'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

const sectionTitleStyle = {
  fontSize: '13px',
  fontWeight: '600',
  color: 'var(--text-primary)',
  marginBottom: '12px',
  display: 'flex',
  alignItems: 'center',
  gap: '6px',
};

const labelStyle = {
  display: 'block',
  fontSize: '11px',
  fontWeight: '500',
  color: 'var(--text-muted)',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  marginBottom: '6px',
};

const inputStyle = {
  width: '100%',
  padding: '10px 12px',
  backgroundColor: 'var(--bg-input)',
  border: '1px solid var(--border-color)',
  borderRadius: '6px',
  fontSize: '14px',
  color: 'var(--text-primary)',
  fontFamily: 'var(--font-mono)',
  boxSizing: 'border-box',
  outline: 'none',
};

const selectStyle = {
  ...inputStyle,
  cursor: 'pointer',
};

export default CreateVersusModal;
