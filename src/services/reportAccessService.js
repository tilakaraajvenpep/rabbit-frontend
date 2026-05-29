import apiClient from './apiClient';

export const reportAccessService = {
  createRequest: async ({ targetDate, reason }) => {
    const res = await apiClient.post('/report-access', { targetDate, reason });
    return res.data;
  },

  getMyRequests: async () => {
    const res = await apiClient.get('/report-access/my');
    return res.data;
  },

  checkAccess: async (date) => {
    const res = await apiClient.get('/report-access/check', { params: { date } });
    return res.data; // { hasAccess: bool, date }
  },

  getPendingRequests: async () => {
    const res = await apiClient.get('/report-access/pending');
    return res.data;
  },

  respond: async (id, approved, comments = '') => {
    const res = await apiClient.patch(`/report-access/${id}/respond`, { approved, comments });
    return res.data;
  },

  forwardToPM: async (id, comments = '') => {
    const res = await apiClient.patch(`/report-access/${id}/forward-pm`, { comments });
    return res.data;
  },

  forwardToHR: async (id, comments = '') => {
    const res = await apiClient.patch(`/report-access/${id}/forward-hr`, { comments });
    return res.data;
  },

  getHistoryRequests: async () => {
    const res = await apiClient.get('/report-access/history');
    return res.data;
  }
};
