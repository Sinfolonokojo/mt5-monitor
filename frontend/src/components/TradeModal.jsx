import { useState, useEffect } from 'react';
import apiService from '../services/api';

const TradeModal = ({ account, onClose, onSuccess }) => {
  const initialFormData = {
    symbol: 'XAUUSD',
    order_type: null, // null until user selects BUY or SELL
    lot: 0.01,
    sl: '',
    tp: '',
    comment: 'MT5Monitor'
  };

  const [formData, setFormData] = useState(initialFormData);
  const [orderMode, setOrderMode] = useState('market'); // 'market' or 'limit'
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  if (!account) return null;

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    setError(null);
  };

  const adjustLot = (delta) => {
    const newLot = Math.max(0.01, Math.min(100, parseFloat(formData.lot || 0) + delta));
    setFormData(prev => ({ ...prev, lot: newLot.toFixed(2) }));
  };

  const validateForm = () => {
    if (!formData.symbol || formData.symbol.trim() === '') {
      setError('El símbolo es requerido');
      return false;
    }

    if (!formData.order_type) {
      setError('Selecciona BUY o SELL');
      return false;
    }

    const lot = parseFloat(formData.lot);
    if (isNaN(lot) || lot < 0.01 || lot > 100) {
      setError('El tamaño del lote debe estar entre 0.01 y 100');
      return false;
    }

    if (formData.sl !== '' && parseFloat(formData.sl) <= 0) {
      setError('El Stop Loss debe ser mayor que 0');
      return false;
    }

    if (formData.tp !== '' && parseFloat(formData.tp) <= 0) {
      setError('El Take Profit debe ser mayor que 0');
      return false;
    }

    return true;
  };

  const handleExecuteTrade = async (orderType) => {
    const updatedFormData = { ...formData, order_type: orderType };
    setFormData(updatedFormData);

    // Validate
    if (!formData.symbol || formData.symbol.trim() === '') {
      setError('El símbolo es requerido');
      return;
    }

    const lot = parseFloat(formData.lot);
    if (isNaN(lot) || lot < 0.01 || lot > 100) {
      setError('El tamaño del lote debe estar entre 0.01 y 100');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const positionData = {
        symbol: formData.symbol.trim().toUpperCase(),
        lot: lot,
        order_type: orderType,
        comment: formData.comment || 'MT5Monitor'
      };

      if (formData.sl !== '') {
        positionData.sl = parseFloat(formData.sl);
      }
      if (formData.tp !== '') {
        positionData.tp = parseFloat(formData.tp);
      }

      const result = await apiService.openPosition(account.account_number, positionData);

      if (result.success) {
        setFormData({ ...initialFormData, symbol: formData.symbol }); // Keep symbol for rapid trading
        setError(null);

        if (onSuccess) {
          onSuccess({
            symbol: positionData.symbol,
            orderType: positionData.order_type,
            lot: positionData.lot,
          });
        }
      } else {
        setError(result.message || 'Error al abrir la posición');
      }
    } catch (err) {
      setError(err.message || 'Error al abrir la posición');
    } finally {
      setLoading(false);
    }
  };

  // Calculate estimated risk (simplified)
  const calculateRisk = () => {
    const lot = parseFloat(formData.lot) || 0;
    const sl = parseFloat(formData.sl);
    if (!sl || isNaN(sl)) return null;

    // Rough estimate: assumes ~$10 per pip per lot for forex
    const estimatedLoss = lot * 100 * 10; // Very rough estimate
    const accountBalance = account.balance || 100000;
    const riskPercent = ((estimatedLoss / accountBalance) * 100).toFixed(2);

    return {
      loss: estimatedLoss.toFixed(2),
      percent: riskPercent
    };
  };

  const risk = calculateRisk();

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.85)',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 1000,
        padding: '16px',
        backdropFilter: 'blur(4px)',
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: 'var(--bg-dark)',
          borderRadius: 'var(--radius-xl)',
          maxWidth: '480px',
          width: '100%',
          overflow: 'hidden',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.6)',
          border: '1px solid var(--border-color)',
          display: 'flex',
          flexDirection: 'column',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid var(--border-color)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: 'var(--bg-dark)',
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <h2 style={{
              margin: 0,
              fontSize: '13px',
              fontWeight: '700',
              color: 'var(--text-primary)',
              textTransform: 'uppercase',
              letterSpacing: '0.1em'
            }}>
              Ejecutar Operación
            </h2>
            {/* Order Type Toggle */}
            <div style={{
              display: 'flex',
              backgroundColor: 'var(--bg-surface)',
              padding: '4px',
              borderRadius: 'var(--radius)',
              border: '1px solid var(--border-color)',
            }}>
              <button
                onClick={() => setOrderMode('market')}
                style={{
                  padding: '6px 14px',
                  fontSize: '10px',
                  fontWeight: '700',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  backgroundColor: orderMode === 'market' ? 'var(--border-color)' : 'transparent',
                  color: orderMode === 'market' ? 'var(--text-primary)' : 'var(--text-muted)',
                  border: 'none',
                  borderRadius: 'var(--radius-sm)',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
              >
                Market
              </button>
              <button
                onClick={() => setOrderMode('limit')}
                style={{
                  padding: '6px 14px',
                  fontSize: '10px',
                  fontWeight: '700',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                  backgroundColor: orderMode === 'limit' ? 'var(--border-color)' : 'transparent',
                  color: orderMode === 'limit' ? 'var(--text-primary)' : 'var(--text-muted)',
                  border: 'none',
                  borderRadius: 'var(--radius-sm)',
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
              >
                Limit
              </button>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '32px',
              height: '32px',
              backgroundColor: 'transparent',
              color: 'var(--text-muted)',
              border: 'none',
              borderRadius: 'var(--radius)',
              fontSize: '18px',
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
          >
            ×
          </button>
        </div>

        {/* Form Content */}
        <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Error Message */}
          {error && (
            <div
              style={{
                padding: '12px',
                backgroundColor: 'rgba(239, 68, 68, 0.1)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                borderRadius: 'var(--radius)',
                color: 'var(--red)',
                fontSize: '13px',
              }}
            >
              ⚠️ {error}
            </div>
          )}

          {/* Symbol Input */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={labelStyle}>Símbolo</label>
            <div style={{ position: 'relative' }}>
              <span style={{
                position: 'absolute',
                left: '12px',
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--text-muted)',
                fontSize: '14px',
              }}>
                🔍
              </span>
              <input
                type="text"
                name="symbol"
                value={formData.symbol}
                onChange={handleInputChange}
                placeholder="EURUSD"
                style={{
                  ...inputStyle,
                  paddingLeft: '38px',
                  textTransform: 'uppercase',
                }}
              />
            </div>
          </div>

          {/* Lots and Entry Price Row */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            {/* Lots */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={labelStyle}>Lotes</label>
              <div style={{ display: 'flex' }}>
                <button
                  onClick={() => adjustLot(-0.01)}
                  style={lotBtnStyle}
                >
                  −
                </button>
                <input
                  type="number"
                  name="lot"
                  value={formData.lot}
                  onChange={handleInputChange}
                  step="0.01"
                  min="0.01"
                  max="100"
                  style={{
                    ...inputStyle,
                    borderRadius: 0,
                    borderLeft: 'none',
                    borderRight: 'none',
                    textAlign: 'center',
                    flex: 1,
                  }}
                />
                <button
                  onClick={() => adjustLot(0.01)}
                  style={{ ...lotBtnStyle, borderRadius: '0 var(--radius) var(--radius) 0' }}
                >
                  +
                </button>
              </div>
            </div>

            {/* Entry Price (disabled for market orders) */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', opacity: orderMode === 'market' ? 0.5 : 1 }}>
              <label style={labelStyle}>Precio Entrada</label>
              <input
                type="number"
                disabled={orderMode === 'market'}
                placeholder={orderMode === 'market' ? 'Market' : 'Precio'}
                style={{
                  ...inputStyle,
                  cursor: orderMode === 'market' ? 'not-allowed' : 'text',
                  backgroundColor: orderMode === 'market' ? 'var(--bg-dark)' : 'var(--bg-surface)',
                }}
              />
            </div>
          </div>

          {/* TP / SL Row */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            {/* Take Profit */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ ...labelStyle, color: 'var(--green)' }}>Take Profit (pips)</label>
              <input
                type="number"
                name="tp"
                value={formData.tp}
                onChange={handleInputChange}
                step="1"
                min="0"
                placeholder="Ej: 50"
                style={inputStyle}
              />
            </div>

            {/* Stop Loss */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ ...labelStyle, color: 'var(--red)' }}>Stop Loss (pips)</label>
              <input
                type="number"
                name="sl"
                value={formData.sl}
                onChange={handleInputChange}
                step="1"
                min="0"
                placeholder="Ej: 30"
                style={inputStyle}
              />
            </div>
          </div>

          {/* Risk Calculator (only shows if SL is set) */}
          {formData.sl && (
            <div style={{
              padding: '16px',
              backgroundColor: 'var(--bg-surface)',
              borderRadius: 'var(--radius-lg)',
              border: '1px solid var(--border-color)',
            }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                marginBottom: '12px',
              }}>
                <span style={{ fontSize: '14px' }}>📊</span>
                <span style={{
                  fontSize: '10px',
                  fontWeight: '700',
                  color: 'var(--text-muted)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em'
                }}>
                  Calculadora de Riesgo
                </span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <span style={{ fontSize: '10px', color: 'var(--text-muted)', display: 'block' }}>
                    Pérdida Proyectada
                  </span>
                  <span style={{
                    fontSize: '18px',
                    fontWeight: '700',
                    fontFamily: 'var(--font-mono)',
                    color: 'var(--red)'
                  }}>
                    -${risk?.loss || '0.00'}
                  </span>
                </div>
                <div>
                  <span style={{ fontSize: '10px', color: 'var(--text-muted)', display: 'block' }}>
                    Riesgo de Cuenta
                  </span>
                  <span style={{
                    fontSize: '18px',
                    fontWeight: '700',
                    fontFamily: 'var(--font-mono)',
                    color: 'var(--text-primary)'
                  }}>
                    {risk?.percent || '0.00'}%
                  </span>
                </div>
              </div>

              {risk && (
                <div style={{
                  marginTop: '12px',
                  height: '6px',
                  backgroundColor: 'var(--bg-dark)',
                  borderRadius: '3px',
                  overflow: 'hidden',
                }}>
                  <div style={{
                    width: `${Math.min(parseFloat(risk.percent) * 10, 100)}%`,
                    height: '100%',
                    backgroundColor: parseFloat(risk.percent) > 5 ? 'var(--red)' : 'var(--orange)',
                    borderRadius: '3px',
                    transition: 'width 0.3s ease',
                  }} />
                </div>
              )}
            </div>
          )}

          {/* Account Info */}
          <div style={{
            padding: '12px',
            backgroundColor: 'var(--bg-surface)',
            borderRadius: 'var(--radius)',
            border: '1px solid var(--border-subtle)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              Cuenta
            </span>
            <span style={{ fontSize: '13px', color: 'var(--text-primary)', fontWeight: '500' }}>
              #{account.account_number}
            </span>
          </div>
        </div>

        {/* Action Buttons - Buy/Sell */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: '16px',
          padding: '20px',
          backgroundColor: 'var(--bg-surface)',
          borderTop: '1px solid var(--border-color)',
        }}>
          {/* Buy Button */}
          <button
            onClick={() => handleExecuteTrade('BUY')}
            disabled={loading}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '4px',
              padding: '16px',
              backgroundColor: '#238636',
              color: 'white',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 'var(--radius-lg)',
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.7 : 1,
              transition: 'all 0.2s',
              boxShadow: '0 4px 12px rgba(35, 134, 54, 0.3)',
            }}
          >
            <span style={{
              fontSize: '10px',
              fontWeight: '700',
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
              opacity: 0.8
            }}>
              Buy / Long
            </span>
            <span style={{
              fontSize: '18px',
              fontWeight: '700',
              fontFamily: 'var(--font-mono)'
            }}>
              {loading ? '...' : 'COMPRAR'}
            </span>
          </button>

          {/* Sell Button */}
          <button
            onClick={() => handleExecuteTrade('SELL')}
            disabled={loading}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '4px',
              padding: '16px',
              backgroundColor: '#da3633',
              color: 'white',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 'var(--radius-lg)',
              cursor: loading ? 'not-allowed' : 'pointer',
              opacity: loading ? 0.7 : 1,
              transition: 'all 0.2s',
              boxShadow: '0 4px 12px rgba(218, 54, 51, 0.3)',
            }}
          >
            <span style={{
              fontSize: '10px',
              fontWeight: '700',
              textTransform: 'uppercase',
              letterSpacing: '0.1em',
              opacity: 0.8
            }}>
              Sell / Short
            </span>
            <span style={{
              fontSize: '18px',
              fontWeight: '700',
              fontFamily: 'var(--font-mono)'
            }}>
              {loading ? '...' : 'VENDER'}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
};

// Styles
const labelStyle = {
  fontSize: '10px',
  fontWeight: '700',
  color: 'var(--text-muted)',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
};

const inputStyle = {
  width: '100%',
  padding: '10px 12px',
  backgroundColor: 'var(--bg-surface)',
  border: '1px solid var(--border-color)',
  borderRadius: 'var(--radius)',
  fontSize: '13px',
  color: 'var(--text-primary)',
  fontFamily: 'var(--font-mono)',
  boxSizing: 'border-box',
  outline: 'none',
  transition: 'border-color 0.2s',
};

const lotBtnStyle = {
  padding: '10px 14px',
  backgroundColor: 'var(--bg-surface)',
  border: '1px solid var(--border-color)',
  borderRadius: 'var(--radius) 0 0 var(--radius)',
  color: 'var(--text-muted)',
  fontSize: '16px',
  cursor: 'pointer',
  transition: 'all 0.2s',
};

export default TradeModal;
