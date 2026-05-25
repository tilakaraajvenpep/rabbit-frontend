import apiClient from './apiClient';

export const timerRequestService = {
  createRequest: async (data) => {
    return await apiClient.post('/timer-requests', data);
  },

  getEmployeeRequests: async () => {
    return await apiClient.get('/timer-requests/employee');
  },

  getTLPendingRequests: async () => {
    return await apiClient.get('/timer-requests/tl');
  },

  getPMPendingRequests: async () => {
    return await apiClient.get('/timer-requests/pm');
  },

  forwardToPM: async (id, data) => {
    return await apiClient.put(`/timer-requests/${id}/forward`, data);
  },

  respondToRequest: async (id, data) => {
    return await apiClient.put(`/timer-requests/${id}/respond`, data);
  }
};
export default timerRequestService;
