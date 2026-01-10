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
}

export default new ApiService();
