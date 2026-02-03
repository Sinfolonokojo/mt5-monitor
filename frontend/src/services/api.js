const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080';
const TOKEN_KEY = 'mt5_auth_token';

class ApiService {
  // Auth methods
  getToken() {
    return localStorage.getItem(TOKEN_KEY);
  }

  setToken(token) {
    localStorage.setItem(TOKEN_KEY, token);
  }

  clearToken() {
    localStorage.removeItem(TOKEN_KEY);
  }

  getAuthHeaders() {
    const token = this.getToken();
    return token ? { 'Authorization': `Bearer ${token}` } : {};
  }

  async login(password) {
    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ password })
      });

      const data = await response.json();

      if (response.ok && data.success) {
        this.setToken(data.token);
        return { success: true };
      } else {
        return { success: false, message: data.message || 'Login failed' };
      }
    } catch (error) {
      console.error('Error logging in:', error);
      return { success: false, message: 'Connection error' };
    }
  }

  async logout() {
    try {
      await fetch(`${API_BASE_URL}/api/auth/logout`, {
        method: 'POST',
        headers: this.getAuthHeaders()
      });
    } catch (error) {
      console.error('Error logging out:', error);
    }
    this.clearToken();
  }

  async verifyToken() {
    const token = this.getToken();
    if (!token) return false;

    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/verify`, {
        headers: this.getAuthHeaders()
      });

      if (!response.ok) return false;

      const data = await response.json();
      return data.valid === true;
    } catch (error) {
      console.error('Error verifying token:', error);
      return false;
    }
  }

  async fetchAccounts(forceRefresh = false) {
    try {
      const url = `${API_BASE_URL}/api/accounts${forceRefresh ? '?force_refresh=true' : ''}`;
      const response = await fetch(url, {
        headers: this.getAuthHeaders()
      });

      if (response.status === 401) {
        this.clearToken();
        throw new Error('Unauthorized');
      }

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      console.error('Error fetching accounts:', error);
      throw error;
    }
  }

  async fetchAgentsStatus() {
    try {
      const response = await fetch(`${API_BASE_URL}/api/agents/status`, {
        headers: this.getAuthHeaders()
      });

      if (response.status === 401) {
        this.clearToken();
        throw new Error('Unauthorized');
      }

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error fetching agents status:', error);
      throw error;
    }
  }

  async updatePhase(accountNumber, phaseValue) {
    try {
      const response = await fetch(`${API_BASE_URL}/api/accounts/${accountNumber}/phase`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...this.getAuthHeaders()
        },
        body: JSON.stringify({ phase: phaseValue })
      });

      if (response.status === 401) {
        this.clearToken();
        throw new Error('Unauthorized');
      }

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error updating phase:', error);
      throw error;
    }
  }

  async updateVS(accountNumber, vsValue) {
    try {
      const response = await fetch(`${API_BASE_URL}/api/accounts/${accountNumber}/vs`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...this.getAuthHeaders()
        },
        body: JSON.stringify({ vs_group: vsValue })
      });

      if (response.status === 401) {
        this.clearToken();
        throw new Error('Unauthorized');
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage = errorData.detail || `HTTP error! status: ${response.status}`;
        throw new Error(errorMessage);
      }

      return await response.json();
    } catch (error) {
      console.error('Error updating VS:', error);
      throw error;
    }
  }

  async forceRefresh() {
    try {
      const response = await fetch(`${API_BASE_URL}/api/refresh`, {
        method: 'POST',
        headers: this.getAuthHeaders()
      });

      if (response.status === 401) {
        this.clearToken();
        throw new Error('Unauthorized');
      }

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error forcing refresh:', error);
      throw error;
    }
  }

  async syncToGoogleSheets() {
    try {
      const response = await fetch(`${API_BASE_URL}/api/sync-to-sheets`, {
        method: 'POST',
        headers: this.getAuthHeaders()
      });

      if (response.status === 401) {
        this.clearToken();
        throw new Error('Unauthorized');
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage = errorData.detail || `HTTP error! status: ${response.status}`;
        throw new Error(errorMessage);
      }

      return await response.json();
    } catch (error) {
      console.error('Error syncing to Google Sheets:', error);
      throw error;
    }
  }

  async fetchTradeHistory(accountNumber, forceRefresh = false) {
    try {
      const url = `${API_BASE_URL}/api/accounts/${accountNumber}/trade-history${forceRefresh ? '?force_refresh=true' : ''}`;
      const response = await fetch(url, {
        headers: this.getAuthHeaders()
      });

      if (response.status === 401) {
        this.clearToken();
        throw new Error('Unauthorized');
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage = errorData.detail || `HTTP error! status: ${response.status}`;
        throw new Error(errorMessage);
      }

      return await response.json();
    } catch (error) {
      console.error('Error fetching trade history:', error);
      throw error;
    }
  }

  async syncTradesToGoogleSheets(accountNumber) {
    try {
      const response = await fetch(`${API_BASE_URL}/api/accounts/${accountNumber}/sync-trades-to-sheets`, {
        method: 'POST',
        headers: this.getAuthHeaders()
      });

      if (response.status === 401) {
        this.clearToken();
        throw new Error('Unauthorized');
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage = errorData.detail || `HTTP error! status: ${response.status}`;
        throw new Error(errorMessage);
      }

      return await response.json();
    } catch (error) {
      console.error('Error syncing trades to Google Sheets:', error);
      throw error;
    }
  }

  async fetchSingleAccount(accountNumber) {
    try {
      const response = await fetch(`${API_BASE_URL}/api/accounts/${accountNumber}`, {
        headers: this.getAuthHeaders()
      });

      if (response.status === 401) {
        this.clearToken();
        throw new Error('Unauthorized');
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage = errorData.detail || `HTTP error! status: ${response.status}`;
        throw new Error(errorMessage);
      }

      return await response.json();
    } catch (error) {
      console.error('Error fetching single account:', error);
      throw error;
    }
  }

  // Trading API Methods

  async openPosition(accountNumber, positionData) {
    try {
      const response = await fetch(`${API_BASE_URL}/api/accounts/${accountNumber}/trade/open`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...this.getAuthHeaders()
        },
        body: JSON.stringify(positionData)
      });

      if (response.status === 401) {
        this.clearToken();
        throw new Error('Unauthorized');
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage = errorData.detail || errorData.message || `HTTP error! status: ${response.status}`;
        throw new Error(errorMessage);
      }

      return await response.json();
    } catch (error) {
      console.error('Error opening position:', error);
      throw error;
    }
  }

  async closePosition(accountNumber, ticket, deviation = 20) {
    try {
      const response = await fetch(`${API_BASE_URL}/api/accounts/${accountNumber}/trade/close`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...this.getAuthHeaders()
        },
        body: JSON.stringify({ ticket, deviation })
      });

      if (response.status === 401) {
        this.clearToken();
        throw new Error('Unauthorized');
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage = errorData.detail || errorData.message || `HTTP error! status: ${response.status}`;
        throw new Error(errorMessage);
      }

      return await response.json();
    } catch (error) {
      console.error('Error closing position:', error);
      throw error;
    }
  }

  async modifyPosition(accountNumber, ticket, sl, tp) {
    try {
      const response = await fetch(`${API_BASE_URL}/api/accounts/${accountNumber}/trade/modify`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          ...this.getAuthHeaders()
        },
        body: JSON.stringify({ ticket, sl, tp })
      });

      if (response.status === 401) {
        this.clearToken();
        throw new Error('Unauthorized');
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage = errorData.detail || errorData.message || `HTTP error! status: ${response.status}`;
        throw new Error(errorMessage);
      }

      return await response.json();
    } catch (error) {
      console.error('Error modifying position:', error);
      throw error;
    }
  }

  async fetchOpenPositions(accountNumber) {
    try {
      const response = await fetch(`${API_BASE_URL}/api/accounts/${accountNumber}/positions`, {
        headers: this.getAuthHeaders()
      });

      if (response.status === 401) {
        this.clearToken();
        throw new Error('Unauthorized');
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage = errorData.detail || `HTTP error! status: ${response.status}`;
        throw new Error(errorMessage);
      }

      return await response.json();
    } catch (error) {
      console.error('Error fetching open positions:', error);
      throw error;
    }
  }

  // Versus Trading API Methods

  async fetchVersusFeatureStatus() {
    try {
      const response = await fetch(`${API_BASE_URL}/api/versus/feature-status`, {
        headers: this.getAuthHeaders()
      });

      if (response.status === 401) {
        this.clearToken();
        throw new Error('Unauthorized');
      }

      if (!response.ok) {
        // If 503, feature is disabled
        if (response.status === 503) {
          return { enabled: false };
        }
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error fetching versus feature status:', error);
      return { enabled: false };
    }
  }

  async fetchVersusList() {
    try {
      const response = await fetch(`${API_BASE_URL}/api/versus`, {
        headers: this.getAuthHeaders()
      });

      if (response.status === 401) {
        this.clearToken();
        throw new Error('Unauthorized');
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage = errorData.detail || `HTTP error! status: ${response.status}`;
        throw new Error(errorMessage);
      }

      return await response.json();
    } catch (error) {
      console.error('Error fetching versus list:', error);
      throw error;
    }
  }

  async createVersus(config) {
    try {
      const response = await fetch(`${API_BASE_URL}/api/versus`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...this.getAuthHeaders()
        },
        body: JSON.stringify(config)
      });

      if (response.status === 401) {
        this.clearToken();
        throw new Error('Unauthorized');
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage = errorData.detail || `HTTP error! status: ${response.status}`;
        throw new Error(errorMessage);
      }

      return await response.json();
    } catch (error) {
      console.error('Error creating versus:', error);
      throw error;
    }
  }

  async executeCongelar(versusId) {
    try {
      const response = await fetch(`${API_BASE_URL}/api/versus/${versusId}/congelar`, {
        method: 'POST',
        headers: this.getAuthHeaders()
      });

      if (response.status === 401) {
        this.clearToken();
        throw new Error('Unauthorized');
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage = errorData.detail || `HTTP error! status: ${response.status}`;
        throw new Error(errorMessage);
      }

      return await response.json();
    } catch (error) {
      console.error('Error executing congelar:', error);
      throw error;
    }
  }

  async executeTransferir(versusId) {
    try {
      const response = await fetch(`${API_BASE_URL}/api/versus/${versusId}/transferir`, {
        method: 'POST',
        headers: this.getAuthHeaders()
      });

      if (response.status === 401) {
        this.clearToken();
        throw new Error('Unauthorized');
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage = errorData.detail || `HTTP error! status: ${response.status}`;
        throw new Error(errorMessage);
      }

      return await response.json();
    } catch (error) {
      console.error('Error executing transferir:', error);
      throw error;
    }
  }

  async cancelVersus(versusId) {
    try {
      const response = await fetch(`${API_BASE_URL}/api/versus/${versusId}`, {
        method: 'DELETE',
        headers: this.getAuthHeaders()
      });

      if (response.status === 401) {
        this.clearToken();
        throw new Error('Unauthorized');
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        const errorMessage = errorData.detail || `HTTP error! status: ${response.status}`;
        throw new Error(errorMessage);
      }

      return await response.json();
    } catch (error) {
      console.error('Error canceling versus:', error);
      throw error;
    }
  }
}

export default new ApiService();
