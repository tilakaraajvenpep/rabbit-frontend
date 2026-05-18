import apiClient from './apiClient';

export const authService = {
  login: async (email, password, tenantCode) => {
    try {
      const response = await apiClient.post('/auth/login', {
        email,
        password,
        tenantCode,
      });

      return response.data;
    } catch (error) {
      console.error('Login failed:', error?.response?.data || error.message);
      throw error;
    }
  },

  logout: async () => {
    try {
      const response = await apiClient.post('/auth/logout');
      return response.data;
    } catch (error) {
      console.error('Logout failed:', error?.response?.data || error.message);
      throw error;
    }
  },

  me: async () => {
    try {
      const response = await apiClient.get('/auth/me');
      return response.data;
    } catch (error) {
      console.error('Fetch user failed:', error?.response?.data || error.message);
      throw error;
    }
  },
};