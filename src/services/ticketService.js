import apiClient from './apiClient';
import { mockTickets } from '../mocks/mockTickets';
import { logger } from '../utils/logger';

const useMock = import.meta.env.VITE_USE_MOCK === 'true';

export const ticketService = {
  getTickets: async (projectId) => {
    if (useMock) {
      await new Promise(resolve => setTimeout(resolve, 600));
      return { data: projectId ? mockTickets.filter(t => t.projectId === projectId) : mockTickets };
    }
    const url = projectId ? `/projects/${projectId}/tickets` : '/tickets';
    const response = await apiClient.get(url);
    const mappedData = response.data.data.map(t => ({
      ...t,
      id: t.ticketId,
      code: t.ticketCode,
      assignedTo: t.assignedToUserId
    }));
    return { data: mappedData };
  },

  createTicket: async (projectId, ticketData) => {
    if (useMock) {
      await new Promise(resolve => setTimeout(resolve, 800));
      const newTicket = {
        ...ticketData,
        id: 't' + (mockTickets.length + 1),
        code: 'TIC-' + (100 + mockTickets.length + 1),
        projectId,
        consumedHours: 0,
        status: 'ToDo'
      };
      mockTickets.push(newTicket);
      logger.info('Mock ticket created:', newTicket);
      return { data: newTicket };
    }
    const response = await apiClient.post(`/projects/${projectId}/tickets`, ticketData);
    const t = response.data.data;
    return { data: {
      ...t,
      id: t.ticketId,
      code: t.ticketCode,
      assignedTo: t.assignedToUserId
    }};
  },

  updateTicketStatus: async (ticketId, status) => {
    if (useMock) {
      await new Promise(resolve => setTimeout(resolve, 300));
      const ticket = mockTickets.find(t => t.id === ticketId);
      if (ticket) ticket.status = status;
      return { data: { success: true } };
    }
    return apiClient.put(`/tickets/${ticketId}/status`, { status });
  },

  updateTicketProgress: async (ticketId, progressData) => {
    if (useMock) {
      await new Promise(resolve => setTimeout(resolve, 500));
      const ticket = mockTickets.find(t => t.id === ticketId);
      if (ticket) {
        ticket.progressState = progressData.progressState;
        ticket.statusNotes = progressData.statusNotes;
      }
      return { data: { success: true } };
    }
    return apiClient.put(`/tickets/${ticketId}/progress`, progressData);
  },

  assignTicket: async (ticketId, userId) => {
    if (useMock) {
      await new Promise(resolve => setTimeout(resolve, 400));
      const ticket = mockTickets.find(t => t.id === ticketId);
      if (ticket) ticket.assignedTo = userId;
      return { data: { success: true } };
    }
    return apiClient.put(`/tickets/${ticketId}/assign`, { userId });
  },

  getTicketById: async (ticketId) => {
    if (useMock) {
      await new Promise(resolve => setTimeout(resolve, 400));
      const ticket = mockTickets.find(t => t.id === ticketId);
      return { data: ticket };
    }
    return apiClient.get(`/tickets/${ticketId}`);
  },

  deleteTicket: async (ticketId) => {
    if (useMock) {
      await new Promise(resolve => setTimeout(resolve, 400));
      const idx = mockTickets.findIndex(t => t.id === ticketId);
      if (idx !== -1) mockTickets.splice(idx, 1);
      return { data: { success: true } };
    }
    return apiClient.delete(`/tickets/${ticketId}`);
  }
};
