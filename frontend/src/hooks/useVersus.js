import { useState, useCallback } from 'react';
import apiService from '../services/api';

export const useVersus = () => {
  const [versusList, setVersusList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [featureEnabled, setFeatureEnabled] = useState(false);

  const checkFeatureStatus = useCallback(async () => {
    try {
      const result = await apiService.fetchVersusFeatureStatus();
      setFeatureEnabled(result.enabled);
      return result.enabled;
    } catch (err) {
      setFeatureEnabled(false);
      return false;
    }
  }, []);

  const fetchVersusList = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const result = await apiService.fetchVersusList();
      setVersusList(result.versus_list || []);
    } catch (err) {
      setError(err.message || 'Error al cargar la lista de Versus');
    } finally {
      setLoading(false);
    }
  }, []);

  const createVersus = useCallback(async (config) => {
    setLoading(true);
    setError(null);

    try {
      const result = await apiService.createVersus(config);
      await fetchVersusList(); // Refresh list
      return result;
    } catch (err) {
      setError(err.message || 'Error al crear el Versus');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [fetchVersusList]);

  const executeCongelar = useCallback(async (versusId) => {
    setLoading(true);
    setError(null);

    try {
      const result = await apiService.executeCongelar(versusId);
      await fetchVersusList(); // Refresh list
      return result;
    } catch (err) {
      setError(err.message || 'Error al ejecutar Congelar');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [fetchVersusList]);

  const executeTransferir = useCallback(async (versusId) => {
    setLoading(true);
    setError(null);

    try {
      const result = await apiService.executeTransferir(versusId);
      await fetchVersusList(); // Refresh list
      return result;
    } catch (err) {
      setError(err.message || 'Error al ejecutar Transferir');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [fetchVersusList]);

  const cancelVersus = useCallback(async (versusId) => {
    setLoading(true);
    setError(null);

    try {
      const result = await apiService.cancelVersus(versusId);
      await fetchVersusList(); // Refresh list
      return result;
    } catch (err) {
      setError(err.message || 'Error al cancelar el Versus');
      throw err;
    } finally {
      setLoading(false);
    }
  }, [fetchVersusList]);

  return {
    versusList,
    loading,
    error,
    featureEnabled,
    checkFeatureStatus,
    fetchVersusList,
    createVersus,
    executeCongelar,
    executeTransferir,
    cancelVersus
  };
};
