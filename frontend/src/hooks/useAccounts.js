import { useState, useCallback } from 'react';
import apiService from '../services/api';

export const useAccounts = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchAccounts = useCallback(async (forceRefresh = false) => {
    setLoading(true);
    setError(null);

    try {
      const result = await apiService.fetchAccounts(forceRefresh);
      setData(result);
    } catch (err) {
      setError(err.message || 'Failed to fetch accounts');
    } finally {
      setLoading(false);
    }
  }, []);

  const refresh = useCallback(async () => {
    await apiService.forceRefresh();
    await fetchAccounts(true);
  }, [fetchAccounts]);

  const updatePhase = useCallback(async (accountNumber, phaseValue) => {
    try {
      await apiService.updatePhase(accountNumber, phaseValue);
      // Refresh data after updating phase
      await fetchAccounts(true);
    } catch (err) {
      throw err;
    }
  }, [fetchAccounts]);

  return {
    data,
    loading,
    error,
    fetchAccounts,
    refresh,
    updatePhase
  };
};
