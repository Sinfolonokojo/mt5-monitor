import { useState } from 'react';
import apiService from '../services/api';

const TradeModal = ({ account, onClose, onSuccess }) => {
  const initialFormData = {
    symbol: 'EURUSD',
    order_type: 'BUY',
    lot: 0.01,
    sl: '',
    tp: '',
    comment: 'MT5Monitor'
  };

  const [formData, setFormData] = useState(initialFormData);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showConfirm, setShowConfirm] = useState(false);

  if (!account) return null;

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
    setError(null);
  };

  const validateForm = () => {
    if (!formData.symbol || formData.symbol.trim() === '') {
      setError('El símbolo es requerido');
      return false;
    }

    if (formData.lot < 0.01 || formData.lot > 100) {
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

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!validateForm()) return;
    setShowConfirm(true);
  };

  const handleConfirmTrade = async () => {
    setLoading(true);
    setError(null);

    try {
      const positionData = {
        symbol: formData.symbol.trim().toUpperCase(),
        lot: parseFloat(formData.lot),
        order_type: formData.order_type,
        comment: formData.comment || 'MT5Monitor'
      };

      // Add SL/TP only if provided
      if (formData.sl !== '') {
        positionData.sl = parseFloat(formData.sl);
      }
      if (formData.tp !== '') {
        positionData.tp = parseFloat(formData.tp);
      }

      const result = await apiService.openPosition(account.account_number, positionData);

      if (result.success) {
        // Reset form for next trade
        setFormData(initialFormData);
        setShowConfirm(false);
        setError(null);

        // Call success callback (shows notification and refreshes account)
        if (onSuccess) {
          onSuccess({
            symbol: positionData.symbol,
            orderType: positionData.order_type,
            lot: positionData.lot,
          });
        }

        // Keep modal open for rapid trading
        // User can manually close with X button or Cancel
      } else {
        setError(result.message || 'Error al abrir la posición');
        setShowConfirm(false);
      }
    } catch (err) {
      setError(err.message || 'Error al abrir la posición');
      setShowConfirm(false);
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
            Abrir Operación
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
            ×
          </button>
        </div>

        {/* Account Info */}
        <div
          style={{
            padding: '16px 24px',
            backgroundColor: '#f9fafb',
            borderBottom: '1px solid #e5e7eb',
          }}
        >
          <div style={{ fontSize: '14px', color: '#6b7280' }}>Cuenta</div>
          <div style={{ fontSize: '18px', fontWeight: '600', color: '#111827', marginTop: '4px' }}>
            {account.account_name} (#{account.account_number})
          </div>
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

          {/* Symbol */}
          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: '#374151', marginBottom: '8px' }}>
              Símbolo *
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

          {/* Order Type */}
          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: '#374151', marginBottom: '8px' }}>
              Tipo de Orden *
            </label>
            <div style={{ display: 'flex', gap: '12px' }}>
              <button
                type="button"
                onClick={() => setFormData(prev => ({ ...prev, order_type: 'BUY' }))}
                style={{
                  flex: 1,
                  padding: '10px',
                  backgroundColor: formData.order_type === 'BUY' ? '#22c55e' : '#f3f4f6',
                  color: formData.order_type === 'BUY' ? 'white' : '#374151',
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
                onClick={() => setFormData(prev => ({ ...prev, order_type: 'SELL' }))}
                style={{
                  flex: 1,
                  padding: '10px',
                  backgroundColor: formData.order_type === 'SELL' ? '#ef4444' : '#f3f4f6',
                  color: formData.order_type === 'SELL' ? 'white' : '#374151',
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

          {/* Lot Size */}
          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: '#374151', marginBottom: '8px' }}>
              Tamaño del Lote *
            </label>
            <input
              type="number"
              name="lot"
              value={formData.lot}
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

          {/* Stop Loss */}
          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: '#374151', marginBottom: '8px' }}>
              Stop Loss (opcional)
            </label>
            <input
              type="number"
              name="sl"
              value={formData.sl}
              onChange={handleInputChange}
              step="0.00001"
              min="0"
              placeholder="Dejar vacío para sin SL"
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

          {/* Take Profit */}
          <div style={{ marginBottom: '20px' }}>
            <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: '#374151', marginBottom: '8px' }}>
              Take Profit (opcional)
            </label>
            <input
              type="number"
              name="tp"
              value={formData.tp}
              onChange={handleInputChange}
              step="0.00001"
              min="0"
              placeholder="Dejar vacío para sin TP"
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

          {/* Comment */}
          <div style={{ marginBottom: '24px' }}>
            <label style={{ display: 'block', fontSize: '14px', fontWeight: '500', color: '#374151', marginBottom: '8px' }}>
              Comentario
            </label>
            <input
              type="text"
              name="comment"
              value={formData.comment}
              onChange={handleInputChange}
              placeholder="MT5Monitor"
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

          {/* Actions */}
          {!showConfirm ? (
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
                {loading ? 'Abriendo...' : 'Abrir Posición'}
              </button>
            </div>
          ) : (
            <div>
              <div
                style={{
                  padding: '16px',
                  backgroundColor: '#fef3c7',
                  border: '1px solid #fde68a',
                  borderRadius: '6px',
                  marginBottom: '16px',
                }}
              >
                <div style={{ fontSize: '14px', fontWeight: '600', color: '#92400e', marginBottom: '8px' }}>
                  Confirmar Operación
                </div>
                <div style={{ fontSize: '13px', color: '#78350f' }}>
                  Estás a punto de abrir una posición <strong>{formData.order_type}</strong> en{' '}
                  <strong>{formData.symbol}</strong> con <strong>{formData.lot}</strong> lotes.
                </div>
              </div>
              <div style={{ display: 'flex', gap: '12px' }}>
                <button
                  type="button"
                  onClick={() => setShowConfirm(false)}
                  disabled={loading}
                  style={{
                    flex: 1,
                    padding: '12px',
                    backgroundColor: '#f3f4f6',
                    color: '#374151',
                    border: 'none',
                    borderRadius: '6px',
                    fontSize: '14px',
                    fontWeight: '600',
                    cursor: loading ? 'not-allowed' : 'pointer',
                  }}
                >
                  Volver
                </button>
                <button
                  type="button"
                  onClick={handleConfirmTrade}
                  disabled={loading}
                  style={{
                    flex: 1,
                    padding: '12px',
                    backgroundColor: '#dc2626',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    fontSize: '14px',
                    fontWeight: '600',
                    cursor: loading ? 'not-allowed' : 'pointer',
                    opacity: loading ? 0.6 : 1,
                  }}
                >
                  {loading ? 'Confirmando...' : 'Confirmar Operación'}
                </button>
              </div>
            </div>
          )}
        </form>
      </div>
    </div>
  );
};

export default TradeModal;
