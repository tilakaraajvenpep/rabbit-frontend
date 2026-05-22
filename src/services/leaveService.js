import apiClient from './apiClient';

export const leaveService = {
  applyLeave: async (data) => {
    const response = await apiClient.post('/leaves', data);
    return response.data;
  },

  getMyLeaves: async () => {
    const response = await apiClient.get('/leaves/me');
    return response.data;
  },

  getPendingLeaves: async () => {
    const response = await apiClient.get('/leaves/pending');
    return response.data;
  },

  getAllLeaves: async () => {
    const response = await apiClient.get('/leaves/all');
    return response.data;
  },

  updateLeaveStatus: async (id, status) => {
    const response = await apiClient.put(`/leaves/${id}/status`, { status });
    return response.data;
  }
};
