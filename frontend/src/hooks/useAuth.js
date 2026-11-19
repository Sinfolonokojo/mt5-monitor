import { useState, useEffect, useCallback } from 'react';
import apiService from '../services/api';

export function useAuth({ skipSessionCheck = false } = {}) {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(!skipSessionCheck);
  const [checkingSession, setCheckingSession] = useState(!skipSessionCheck);
  const [error, setError] = useState(null);

  const checkAuth = useCallback(async () => {
    setCheckingSession(true);
    setLoading(true);
    try {
      const isValid = await apiService.verifyToken();
      setIsAuthenticated(isValid);
      setError(null);
    } catch (err) {
      setIsAuthenticated(false);
      setError(err.message);
    } finally {
      setCheckingSession(false);
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!skipSessionCheck) checkAuth();
  }, [checkAuth, skipSessionCheck]);

  const login = useCallback(async (password) => {
    setLoading(true);
    setError(null);
    try {
      const result = await apiService.login(password);
      if (result.success) {
        setIsAuthenticated(true);
        return { success: true };
      } else {
        setError(result.message);
        return { success: false, message: result.message };
      }
    } catch (err) {
      setError(err.message);
      return { success: false, message: err.message };
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    setLoading(true);
    try {
      await apiService.logout();
    } finally {
      setIsAuthenticated(false);
      setLoading(false);
    }
  }, []);

  return {
    isAuthenticated,
    checkingSession,
    loading,
    error,
    login,
    logout,
    checkAuth
  };
}
