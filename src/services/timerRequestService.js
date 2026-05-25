import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:4000/api';

export const timerRequestService = {
  createRequest: async (data) => {
    const token = localStorage.getItem('token');
    return await axios.post(`${API_URL}/timer-requests`, data, {
      headers: { Authorization: `Bearer ${token}` }
    });
  },

  getEmployeeRequests: async () => {
    const token = localStorage.getItem('token');
    return await axios.get(`${API_URL}/timer-requests/employee`, {
      headers: { Authorization: `Bearer ${token}` }
    });
  },

  getTLPendingRequests: async () => {
    const token = localStorage.getItem('token');
    return await axios.get(`${API_URL}/timer-requests/tl`, {
      headers: { Authorization: `Bearer ${token}` }
    });
  },

  getPMPendingRequests: async () => {
    const token = localStorage.getItem('token');
    return await axios.get(`${API_URL}/timer-requests/pm`, {
      headers: { Authorization: `Bearer ${token}` }
    });
  },

  forwardToPM: async (id, data) => {
    const token = localStorage.getItem('token');
    return await axios.put(`${API_URL}/timer-requests/${id}/forward`, data, {
      headers: { Authorization: `Bearer ${token}` }
    });
  },

  respondToRequest: async (id, data) => {
    const token = localStorage.getItem('token');
    return await axios.put(`${API_URL}/timer-requests/${id}/respond`, data, {
      headers: { Authorization: `Bearer ${token}` }
    });
  }
};
