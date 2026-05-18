import apiClient from './apiClient';
import { mockReports } from '../mocks/mockReports';
import { logger } from '../utils/logger';

const useMock = import.meta.env.VITE_USE_MOCK === 'true';

export const reportService = {
  getReportByDate: async (userId, date) => {
    if (useMock) {
      await new Promise(resolve => setTimeout(resolve, 500));
      const report = mockReports.find(r => r.userId === userId && r.date === date);
      return { data: report || null };
    }
    const response = await apiClient.get(`/reports/daily/me?date=${date}`);
    return { data: response.data.data };
  },

  getReportsByRange: async (userId, startDate, endDate) => {
    if (useMock) {
      await new Promise(resolve => setTimeout(resolve, 800));
      const reports = mockReports.filter(r => 
        r.userId === userId && 
        r.date >= startDate && 
        r.date <= endDate
      );
      return { data: reports };
    }
    const response = await apiClient.get(`/reports/daily/me/range?start=${startDate}&end=${endDate}`);
    return { data: response.data.data };
  },

  getAllReportsByRange: async (startDate, endDate) => {
    if (useMock) {
      await new Promise(resolve => setTimeout(resolve, 800));
      const reports = mockReports.filter(r => 
        r.date >= startDate && 
        r.date <= endDate
      );
      return { data: reports };
    }
    const response = await apiClient.get(`/reports/daily/all/range?start=${startDate}&end=${endDate}`);
    return { data: response.data.data };
  },

  submitDailyReport: async (reportData) => {
    if (useMock) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      const newReport = {
        ...reportData,
        id: 'r' + (mockReports.length + 1),
        submittedAt: new Date().toISOString()
      };
      mockReports.push(newReport);
      logger.info('Mock report submitted:', newReport);
      return { data: newReport };
    }
    const response = await apiClient.post('/reports/daily', reportData);
    const r = response.data.data;
    return { data: {
      ...r,
      id: r.reportId,
      date: r.reportDate
    }};
  },

  getMyReports: async (userId) => {
    if (useMock) {
      await new Promise(resolve => setTimeout(resolve, 800));
      return { data: mockReports.filter(r => r.userId === userId) };
    }
    const response = await apiClient.get('/reports/daily/me');
    const mappedData = response.data.data.map(r => ({
      ...r,
      id: r.reportId,
      date: r.reportDate
    }));
    return { data: mappedData };
  }
};
