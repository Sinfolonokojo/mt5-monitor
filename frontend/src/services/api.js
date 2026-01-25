const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8080';

class ApiService {
  async fetchAccounts(forceRefresh = false) {
    try {
      const url = `${API_BASE_URL}/api/accounts${forceRefresh ? '?force_refresh=true' : ''}`;
      const response = await fetch(url);

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
      const response = await fetch(`${API_BASE_URL}/api/agents/status`);

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
        },
        body: JSON.stringify({ phase: phaseValue })
      });

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
        },
        body: JSON.stringify({ vs_group: vsValue })
      });

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
        method: 'POST'
      });

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
        method: 'POST'
      });

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
      const response = await fetch(url);

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
        method: 'POST'
      });

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
      const response = await fetch(`${API_BASE_URL}/api/accounts/${accountNumber}`);

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
        },
        body: JSON.stringify(positionData)
      });

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
        },
        body: JSON.stringify({ ticket, deviation })
      });

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
        },
        body: JSON.stringify({ ticket, sl, tp })
      });

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
      const response = await fetch(`${API_BASE_URL}/api/accounts/${accountNumber}/positions`);

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
}

export default new ApiService();
