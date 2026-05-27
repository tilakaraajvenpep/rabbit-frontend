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

  getAccountsPendingRequests: async () => {
    return await apiClient.get('/timer-requests/accounts');
  },

  forwardToPM: async (id, data) => {
    return await apiClient.put(`/timer-requests/${id}/forward`, data);
  },

  forwardToAccounts: async (id, data) => {
    return await apiClient.put(`/timer-requests/${id}/forward-accounts`, data);
  },

  respondToRequest: async (id, data) => {
    return await apiClient.put(`/timer-requests/${id}/respond`, data);
  },

  accountsRespondToRequest: async (id, data) => {
    return await apiClient.put(`/timer-requests/${id}/accounts-respond`, data);
  },

  getHRApprovedRequests: async () => {
    return await apiClient.get('/timer-requests/hr');
  },
};
export default timerRequestService;
