import apiClient from './apiClient';

export const authService = {
  login: async (email, password, tenantCode) => {
    const response = await apiClient.post('/auth/login', {
      email,
      password,
      tenantCode
    });
    return response.data;
  },
  
  logout: async () => {
    const response = await apiClient.post('/auth/logout');
    return response.data;
  },
  
  me: async () => {
    const response = await apiClient.get('/auth/me');
    return response.data;
  }
};
