import apiClient from './apiClient';

export const ticketTemplateService = {
  getTemplates: async () => {
    const response = await apiClient.get('/ticket-templates');
    return response.data;
  },

  createTemplate: async (templateData) => {
    const response = await apiClient.post('/ticket-templates', templateData);
    return response.data;
  },

  deleteTemplate: async (templateId) => {
    const response = await apiClient.delete(`/ticket-templates/${templateId}`);
    return response.data;
  }
};
