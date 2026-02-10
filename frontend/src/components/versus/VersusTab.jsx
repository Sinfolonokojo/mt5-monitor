import { useState, useEffect } from 'react';
import { useVersus } from '../../hooks/useVersus';
import VersusCard from './VersusCard';
import VersusDetailModal from './VersusDetailModal';
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
    cancelVersus,
    deleteVersus
  } = useVersus();

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedVersus, setSelectedVersus] = useState(null);
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

  const handleDelete = async (versusId) => {
    try {
      await deleteVersus(versusId);
      setNotification({ message: 'Versus eliminado exitosamente', type: 'success' });
      setSelectedVersus(null);
    } catch (err) {
      setNotification({ message: err.message || 'Error al eliminar Versus', type: 'error' });
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

  // Calculate stats
  const activeCount = versusList.filter(v => v.status === 'pending' || v.status === 'congelado').length;
  const completedCount = versusList.filter(v => v.status === 'transferido' || v.status === 'completed').length;

  // Keep selectedVersus in sync with versusList updates
  const currentSelectedVersus = selectedVersus
    ? versusList.find(v => v.id === selectedVersus.id) || null
    : null;

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

      {/* Stats Header */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: '16px',
        marginBottom: '24px',
      }}>
        <div style={statCardStyle}>
          <div style={statLabelStyle}>Coberturas Activas</div>
          <div style={statValueStyle}>{activeCount}</div>
        </div>
        <div style={statCardStyle}>
          <div style={statLabelStyle}>Completados</div>
          <div style={statValueStyle}>{completedCount}</div>
        </div>
        <div style={statCardStyle}>
          <div style={statLabelStyle}>Total Versus</div>
          <div style={statValueStyle}>{versusList.length}</div>
        </div>
        <div style={{ ...statCardStyle, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <button
            onClick={() => setShowCreateModal(true)}
            disabled={loading}
            className="btn btn-primary"
            style={{ width: '100%' }}
          >
            <span style={{ fontSize: '16px', marginRight: '8px' }}>+</span>
            Crear Versus
          </button>
        </div>
      </div>

      {/* Error Message */}
      {error && (
        <div style={{
          padding: '16px',
          backgroundColor: 'rgba(239, 68, 68, 0.1)',
          border: '1px solid rgba(239, 68, 68, 0.3)',
          borderRadius: '8px',
          color: 'var(--red)',
          fontSize: '14px',
          marginBottom: '24px',
        }}>
          {error}
        </div>
      )}

      {/* Loading State */}
      {loading && versusList.length === 0 && (
        <div style={{
          textAlign: 'center',
          padding: '48px',
          color: 'var(--text-muted)',
        }}>
          <div style={{
            width: '32px',
            height: '32px',
            border: '3px solid var(--border-color)',
            borderTopColor: 'var(--primary)',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            margin: '0 auto 16px',
          }} />
          <div style={{ fontSize: '14px' }}>Cargando...</div>
        </div>
      )}

      {/* Empty State */}
      {!loading && versusList.length === 0 && (
        <div style={{
          textAlign: 'center',
          padding: '60px 24px',
          backgroundColor: 'var(--bg-surface)',
          borderRadius: '12px',
          border: '2px dashed var(--border-color)',
        }}>
          <div style={{ fontSize: '48px', marginBottom: '16px', opacity: 0.5 }}>⚡</div>
          <div style={{
            fontSize: '18px',
            fontWeight: '600',
            color: 'var(--text-primary)',
            marginBottom: '8px',
          }}>
            No hay Versus Configurados
          </div>
          <div style={{
            fontSize: '14px',
            color: 'var(--text-muted)',
            marginBottom: '24px',
            maxWidth: '400px',
            margin: '0 auto 24px',
          }}>
            Crea un nuevo Versus para iniciar la estrategia de cobertura. La Cuenta A y B tomarán posiciones opuestas con TP/SL espejo.
          </div>
          <button
            onClick={() => setShowCreateModal(true)}
            className="btn btn-primary"
          >
            Crear Primer Versus
          </button>
        </div>
      )}

      {/* Versus Grid */}
      {sortedVersusList.length > 0 && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(380px, 1fr))',
          gap: '20px',
        }}>
          {sortedVersusList.map(versus => (
            <VersusCard
              key={versus.id}
              versus={versus}
              accounts={accounts || []}
              onClick={(v) => setSelectedVersus(v)}
            />
          ))}
        </div>
      )}

      {/* Detail Modal */}
      {currentSelectedVersus && (
        <VersusDetailModal
          versus={currentSelectedVersus}
          accounts={accounts || []}
          onCongelar={handleCongelar}
          onTransferir={handleTransferir}
          onCancel={handleCancel}
          onDelete={handleDelete}
          loading={loading}
          onClose={() => setSelectedVersus(null)}
        />
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

const statCardStyle = {
  backgroundColor: 'var(--bg-surface)',
  borderRadius: '12px',
  border: '1px solid var(--border-color)',
  padding: '20px',
};

const statLabelStyle = {
  fontSize: '12px',
  fontWeight: '500',
  color: 'var(--text-muted)',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  marginBottom: '8px',
};

const statValueStyle = {
  fontSize: '28px',
  fontWeight: '700',
  color: 'var(--text-primary)',
  fontFamily: 'var(--font-mono)',
};

export default VersusTab;
