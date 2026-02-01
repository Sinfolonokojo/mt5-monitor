import { useState, useEffect } from 'react';
import { useVersus } from '../../hooks/useVersus';
import VersusCard from './VersusCard';
import CreateVersusModal from './CreateVersusModal';
import Notification from '../Notification';

const VersusTab = ({ accounts }) => {
  const {
    versusList,
    loading,
    error,
    fetchVersusList,
    createVersus,
    executeCongelar,
    executeTransferir,
    cancelVersus
  } = useVersus();

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [notification, setNotification] = useState(null);

  useEffect(() => {
    fetchVersusList();
  }, [fetchVersusList]);

  const handleCreate = async (config) => {
    try {
      await createVersus(config);
      setNotification({ message: 'Versus creado exitosamente', type: 'success' });
    } catch (err) {
      setNotification({ message: err.message || 'Error al crear Versus', type: 'error' });
      throw err;
    }
  };

  const handleCongelar = async (versusId) => {
    try {
      await executeCongelar(versusId);
      setNotification({ message: 'Congelar ejecutado exitosamente', type: 'success' });
    } catch (err) {
      setNotification({ message: err.message || 'Error al ejecutar Congelar', type: 'error' });
      throw err;
    }
  };

  const handleTransferir = async (versusId) => {
    try {
      await executeTransferir(versusId);
      setNotification({ message: 'Transferir ejecutado exitosamente', type: 'success' });
    } catch (err) {
      setNotification({ message: err.message || 'Error al ejecutar Transferir', type: 'error' });
      throw err;
    }
  };

  const handleCancel = async (versusId) => {
    try {
      await cancelVersus(versusId);
      setNotification({ message: 'Versus cancelado exitosamente', type: 'success' });
    } catch (err) {
      setNotification({ message: err.message || 'Error al cancelar Versus', type: 'error' });
      throw err;
    }
  };

  // Sort versus list: pending and congelado first, then by creation date (newest first)
  const sortedVersusList = [...versusList].sort((a, b) => {
    const statusOrder = { pending: 0, congelado: 1, error: 2, transferido: 3, completed: 4 };
    const orderA = statusOrder[a.status] ?? 5;
    const orderB = statusOrder[b.status] ?? 5;

    if (orderA !== orderB) return orderA - orderB;
    return new Date(b.created_at) - new Date(a.created_at);
  });

  return (
    <div style={{ padding: '24px' }}>
      {/* Notification */}
      {notification && (
        <Notification
          message={notification.message}
          type={notification.type}
          onClose={() => setNotification(null)}
        />
      )}

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '24px', fontWeight: '700', color: '#111827' }}>
            Versus Trading
          </h2>
          <p style={{ margin: '8px 0 0', fontSize: '14px', color: '#6b7280' }}>
            Estrategia de cobertura: Cuenta A y B toman posiciones opuestas con TP/SL espejados
          </p>
        </div>

        <button
          onClick={() => setShowCreateModal(true)}
          disabled={loading}
          style={{
            padding: '12px 24px',
            backgroundColor: '#3b82f6',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            fontSize: '14px',
            fontWeight: '600',
            cursor: loading ? 'not-allowed' : 'pointer',
            opacity: loading ? 0.6 : 1,
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <span style={{ fontSize: '18px' }}>+</span>
          Agregar Versus
        </button>
      </div>

      {/* Error Message */}
      {error && (
        <div
          style={{
            padding: '16px',
            backgroundColor: '#fee2e2',
            border: '1px solid #fecaca',
            borderRadius: '8px',
            color: '#dc2626',
            fontSize: '14px',
            marginBottom: '24px',
          }}
        >
          {error}
        </div>
      )}

      {/* Loading State */}
      {loading && versusList.length === 0 && (
        <div style={{ textAlign: 'center', padding: '48px', color: '#6b7280' }}>
          <div style={{ fontSize: '16px' }}>Cargando...</div>
        </div>
      )}

      {/* Empty State */}
      {!loading && versusList.length === 0 && (
        <div
          style={{
            textAlign: 'center',
            padding: '48px',
            backgroundColor: '#f9fafb',
            borderRadius: '12px',
            border: '2px dashed #e5e7eb',
          }}
        >
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>&#8703;</div>
          <div style={{ fontSize: '18px', fontWeight: '600', color: '#374151', marginBottom: '8px' }}>
            No hay Versus configurados
          </div>
          <div style={{ fontSize: '14px', color: '#6b7280', marginBottom: '24px' }}>
            Crea un nuevo Versus para comenzar con la estrategia de cobertura
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            style={{
              padding: '12px 24px',
              backgroundColor: '#3b82f6',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: '600',
              cursor: 'pointer',
            }}
          >
            Crear Primer Versus
          </button>
        </div>
      )}

      {/* Versus List */}
      {sortedVersusList.length > 0 && (
        <div>
          {sortedVersusList.map(versus => (
            <VersusCard
              key={versus.id}
              versus={versus}
              onCongelar={handleCongelar}
              onTransferir={handleTransferir}
              onCancel={handleCancel}
              loading={loading}
            />
          ))}
        </div>
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <CreateVersusModal
          accounts={accounts || []}
          onClose={() => setShowCreateModal(false)}
          onCreate={handleCreate}
        />
      )}
    </div>
  );
};

export default VersusTab;
