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
    // No need to call forceRefresh() - fetchAccounts(true) already forces fresh data
    await fetchAccounts(true);
  }, [fetchAccounts]);

  // New function: Refresh single account (optimized)
  const refreshSingleAccount = useCallback(async (accountNumber) => {
    try {
      const updatedAccount = await apiService.fetchSingleAccount(accountNumber);

      // Update just this account in the state
      setData(prevData => {
        if (!prevData?.accounts) return prevData;

        const updatedAccounts = prevData.accounts.map(acc =>
          acc.account_number === accountNumber ? updatedAccount : acc
        );

        return {
          ...prevData,
          accounts: updatedAccounts,
          last_refresh: new Date().toISOString()
        };
      });

      return updatedAccount;
    } catch (error) {
      console.error(`Error refreshing account ${accountNumber}:`, error);
      // Fallback to full refresh
      await refresh();
      throw error;
    }
  }, [refresh]);

  const updatePhase = useCallback(async (accountNumber, phaseValue) => {
    try {
      await apiService.updatePhase(accountNumber, phaseValue);
      // Refresh data after updating phase
      await fetchAccounts(true);
    } catch (err) {
      throw err;
    }
  }, [fetchAccounts]);

  const updateVS = useCallback(async (accountNumber, vsValue) => {
    try {
      await apiService.updateVS(accountNumber, vsValue);
      // Refresh data after updating VS
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
    refreshSingleAccount,
    updatePhase,
    updateVS
  };
};
