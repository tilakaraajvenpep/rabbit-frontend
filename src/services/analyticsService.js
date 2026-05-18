import apiClient from './apiClient';
import { mockProjects } from '../mocks/mockProjects';
import { mockAlerts } from '../mocks/mockAlerts';
import { logger } from '../utils/logger';

const useMock = import.meta.env.VITE_USE_MOCK === 'true';

export const analyticsService = {
  getDashboardSummary: async () => {
    if (useMock) {
      await new Promise(resolve => setTimeout(resolve, 800));
      return { data: {
        totalProjects: mockProjects.length,
        activeProjects: mockProjects.filter(p => p.status === 'InProgress').length,
        atRiskProjects: 2,
        unreadAlerts: mockAlerts.filter(a => !a.acknowledged).length,
        projectHealth: [
          { status: 'On Track', count: 3, color: 'green' },
          { status: 'At Risk', count: 1, color: 'amber' },
          { status: 'Delayed', count: 1, color: 'red' }
        ]
      }};
    }
    return apiClient.get('/analytics/dashboard');
  },

  getProjectAnalytics: async (id) => {
    if (useMock) {
      await new Promise(resolve => setTimeout(resolve, 600));
      return { data: {
        employeeWork: [
          { name: 'John Doe', planned: 40, actual: 42 },
          { name: 'Jane Smith', planned: 40, actual: 38 },
          { name: 'Mike Ross', planned: 40, actual: 45 },
          { name: 'Harvey Specter', planned: 20, actual: 22 }
        ],
        timeline: [
          { date: '2024-04-01', planned: 100, actual: 90 },
          { date: '2024-04-08', planned: 200, actual: 180 },
          { date: '2024-04-15', planned: 350, actual: 340 },
          { date: '2024-04-22', planned: 500, actual: 520 }
        ],
        ticketStatus: [
          { name: 'To Do', value: 3 },
          { name: 'In Progress', value: 4 },
          { name: 'In Review', value: 1 },
          { name: 'Done', value: 2 }
        ],
        burnRate: [
          { date: '2024-04-01', cost: 50000 },
          { date: '2024-04-08', cost: 120000 },
          { date: '2024-04-15', cost: 280000 },
          { date: '2024-04-22', cost: 450000 }
        ]
      }};
    }
    return apiClient.get(`/analytics/projects/${id}`);
  },

  getAlerts: async () => {
    if (useMock) {
      await new Promise(resolve => setTimeout(resolve, 500));
      return { data: mockAlerts };
    }
    const response = await apiClient.get('/analytics/alerts');
    const mappedData = response.data.data.map(a => ({
      ...a,
      id: a.alertId,
      acknowledged: a.isAcknowledged,
      timestamp: a.createdAt
    }));
    return { data: mappedData };
  },

  acknowledgeAlert: async (id, comment) => {
    if (useMock) {
      await new Promise(resolve => setTimeout(resolve, 800));
      const alert = mockAlerts.find(a => a.id === id);
      if (alert) {
        alert.acknowledged = true;
        alert.ackComment = comment;
      }
      return { data: { success: true } };
    }
    return apiClient.put(`/analytics/alerts/${id}/acknowledge`, { comment });
  },

  createAlert: async (alertData) => {
    if (useMock) {
      await new Promise(resolve => setTimeout(resolve, 800));
      const newAlert = {
        id: 'a' + (mockAlerts.length + 1),
        ...alertData,
        timestamp: new Date().toISOString(),
        acknowledged: false
      };
      mockAlerts.unshift(newAlert);
      logger.info('Mock alert created:', newAlert);
      return { data: newAlert };
    }
    const response = await apiClient.post('/analytics/alerts', alertData);
    const a = response.data.data;
    return { data: {
      ...a,
      id: a.alertId,
      acknowledged: a.isAcknowledged,
      timestamp: a.createdAt
    }};
  }
};
