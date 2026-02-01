import { useState } from 'react';

const CreateVersusModal = ({ accounts, onClose, onCreate }) => {
  const initialFormData = {
    account_a: '',
    account_b: '',
    symbol: 'EURUSD',
    side: 'BUY',
    lots: 0.01,
    tp_pips_a: 50,
    sl_pips_a: 50,
    tp_pips_b: 50,
    sl_pips_b: 50,
    scheduled_congelar: ''
  };

  const [formData, setFormData] = useState(initialFormData);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
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
      setError('El simbolo es requerido');
      return false;
    }
    if (formData.lots <= 0 || formData.lots > 100) {
      setError('Los lotes deben estar entre 0.01 y 100');
      return false;
    }
    if (formData.tp_pips_a <= 0) {
      setError('Take Profit Cuenta A debe ser mayor que 0');
      return false;
    }
    if (formData.sl_pips_a <= 0) {
      setError('Stop Loss Cuenta A debe ser mayor que 0');
      return false;
    }
    if (formData.tp_pips_b <= 0) {
      setError('Take Profit Cuenta B debe ser mayor que 0');
      return false;
    }
    if (formData.sl_pips_b <= 0) {
      setError('Stop Loss Cuenta B debe ser mayor que 0');
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
      const config = {
        account_a: parseInt(formData.account_a),
        account_b: parseInt(formData.account_b),
        symbol: formData.symbol.trim().toUpperCase(),
        side: formData.side,
        lots: parseFloat(formData.lots),
        tp_pips_a: parseFloat(formData.tp_pips_a),
        sl_pips_a: parseFloat(formData.sl_pips_a),
        tp_pips_b: parseFloat(formData.tp_pips_b),
        sl_pips_b: parseFloat(formData.sl_pips_b)
      };

      if (formData.scheduled_congelar) {
        config.scheduled_congelar = new Date(formData.scheduled_congelar).toISOString();
      }

      await onCreate(config);
      onClose();
    } catch (err) {
      setError(err.message || 'Error al crear el Versus');
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
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
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
          backgroundColor: 'white',
          borderRadius: '12px',
          maxWidth: '500px',
          width: '100%',
          maxHeight: '90vh',
          overflow: 'auto',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
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
          }}
        >
          <h2 style={{ margin: 0, fontSize: '24px', fontWeight: '700', color: '#111827' }}>
            Crear Versus
          </h2>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '28px',
              cursor: 'pointer',
              color: '#6b7280',
              lineHeight: '1',
              padding: '0',
            }}
          >
            x
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ padding: '24px' }}>
          {/* Error Message */}
          {error && (
            <div
              style={{
                padding: '12px',
                backgroundColor: '#fee2e2',
                border: '1px solid #fecaca',
                borderRadius: '6px',
                color: '#dc2626',
                fontSize: '14px',
                marginBottom: '20px',
              }}
            >
              {error}
            </div>
          )}

          {/* Account A */}
          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: '#374151', marginBottom: '8px' }}>
              Cuenta A *
            </label>
            <select
              name="account_a"
              value={formData.account_a}
              onChange={handleInputChange}
              required
              style={{
                width: '100%',
                padding: '10px 12px',
                border: '1px solid #d1d5db',
                borderRadius: '6px',
                fontSize: '14px',
                boxSizing: 'border-box',
                backgroundColor: 'white',
                color: '#374151',
              }}
            >
              <option value="">Seleccionar cuenta...</option>
              {accounts.map(acc => (
                <option key={acc.account_number} value={acc.account_number}>
                  {acc.account_holder} - {acc.prop_firm || 'N/A'} (#{acc.account_number})
                </option>
              ))}
            </select>
          </div>

          {/* Account B */}
          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: '#374151', marginBottom: '8px' }}>
              Cuenta B *
            </label>
            <select
              name="account_b"
              value={formData.account_b}
              onChange={handleInputChange}
              required
              style={{
                width: '100%',
                padding: '10px 12px',
                border: '1px solid #d1d5db',
                borderRadius: '6px',
                fontSize: '14px',
                boxSizing: 'border-box',
                backgroundColor: 'white',
                color: '#374151',
              }}
            >
              <option value="">Seleccionar cuenta...</option>
              {accounts.map(acc => (
                <option key={acc.account_number} value={acc.account_number}>
                  {acc.account_holder} - {acc.prop_firm || 'N/A'} (#{acc.account_number})
                </option>
              ))}
            </select>
          </div>

          {/* Symbol */}
          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: '#374151', marginBottom: '8px' }}>
              Simbolo *
            </label>
            <input
              type="text"
              name="symbol"
              value={formData.symbol}
              onChange={handleInputChange}
              placeholder="EURUSD"
              required
              style={{
                width: '100%',
                padding: '10px 12px',
                border: '1px solid #d1d5db',
                borderRadius: '6px',
                fontSize: '14px',
                boxSizing: 'border-box',
              }}
            />
          </div>

          {/* Side (Direction for Account A) */}
          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: '#374151', marginBottom: '8px' }}>
              Lado (Direccion de Cuenta A) *
            </label>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                type="button"
                onClick={() => setFormData(prev => ({ ...prev, side: 'BUY' }))}
                style={{
                  flex: 1,
                  padding: '10px',
                  backgroundColor: formData.side === 'BUY' ? '#22c55e' : '#f3f4f6',
                  color: formData.side === 'BUY' ? 'white' : '#374151',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
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
                  backgroundColor: formData.side === 'SELL' ? '#ef4444' : '#f3f4f6',
                  color: formData.side === 'SELL' ? 'white' : '#374151',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '14px',
                  fontWeight: '600',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
              >
                SELL
              </button>
            </div>
          </div>

          {/* Lots */}
          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: '#374151', marginBottom: '8px' }}>
              Lotes *
            </label>
            <input
              type="number"
              name="lots"
              value={formData.lots}
              onChange={handleInputChange}
              step="0.01"
              min="0.01"
              max="100"
              required
              style={{
                width: '100%',
                padding: '10px 12px',
                border: '1px solid #d1d5db',
                borderRadius: '6px',
                fontSize: '14px',
                boxSizing: 'border-box',
              }}
            />
          </div>

          {/* Account A TP/SL */}
          <div style={{ marginBottom: '8px' }}>
            <label style={{ fontSize: '12px', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Cuenta A - TP/SL (aplicado en Congelar)
            </label>
          </div>
          <div style={{ display: 'flex', gap: '16px', marginBottom: '20px' }}>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: '#374151', marginBottom: '8px' }}>
                Take Profit (pips) *
              </label>
              <input
                type="number"
                name="tp_pips_a"
                value={formData.tp_pips_a}
                onChange={handleInputChange}
                step="1"
                min="1"
                required
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  fontSize: '14px',
                  boxSizing: 'border-box',
                }}
              />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: '#374151', marginBottom: '8px' }}>
                Stop Loss (pips) *
              </label>
              <input
                type="number"
                name="sl_pips_a"
                value={formData.sl_pips_a}
                onChange={handleInputChange}
                step="1"
                min="1"
                required
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  fontSize: '14px',
                  boxSizing: 'border-box',
                }}
              />
            </div>
          </div>

          {/* Account B TP/SL */}
          <div style={{ marginBottom: '8px' }}>
            <label style={{ fontSize: '12px', fontWeight: '600', color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Cuenta B - TP/SL (usado en Transferir)
            </label>
          </div>
          <div style={{ display: 'flex', gap: '16px', marginBottom: '20px' }}>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: '#374151', marginBottom: '8px' }}>
                Take Profit (pips) *
              </label>
              <input
                type="number"
                name="tp_pips_b"
                value={formData.tp_pips_b}
                onChange={handleInputChange}
                step="1"
                min="1"
                required
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  fontSize: '14px',
                  boxSizing: 'border-box',
                }}
              />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: '#374151', marginBottom: '8px' }}>
                Stop Loss (pips) *
              </label>
              <input
                type="number"
                name="sl_pips_b"
                value={formData.sl_pips_b}
                onChange={handleInputChange}
                step="1"
                min="1"
                required
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  border: '1px solid #d1d5db',
                  borderRadius: '6px',
                  fontSize: '14px',
                  boxSizing: 'border-box',
                }}
              />
            </div>
          </div>

          {/* Scheduled Congelar (optional) */}
          <div style={{ marginBottom: '24px' }}>
            <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: '#374151', marginBottom: '8px' }}>
              Programar Congelar (opcional)
            </label>
            <input
              type="datetime-local"
              name="scheduled_congelar"
              value={formData.scheduled_congelar}
              onChange={handleInputChange}
              style={{
                width: '100%',
                padding: '10px 12px',
                border: '1px solid #d1d5db',
                borderRadius: '6px',
                fontSize: '14px',
                boxSizing: 'border-box',
              }}
            />
            <p style={{ fontSize: '12px', color: '#6b7280', marginTop: '4px' }}>
              Dejar vacio para ejecutar Congelar manualmente
            </p>
          </div>

          {/* Actions */}
          <div style={{ display: 'flex', gap: '12px' }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                flex: 1,
                padding: '12px',
                backgroundColor: '#f3f4f6',
                color: '#374151',
                border: 'none',
                borderRadius: '6px',
                fontSize: '14px',
                fontWeight: '600',
                cursor: 'pointer',
              }}
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              style={{
                flex: 1,
                padding: '12px',
                backgroundColor: '#3b82f6',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                fontSize: '14px',
                fontWeight: '600',
                cursor: loading ? 'not-allowed' : 'pointer',
                opacity: loading ? 0.6 : 1,
              }}
            >
              {loading ? 'Creando...' : 'Crear Versus'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateVersusModal;
