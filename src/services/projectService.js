import apiClient from './apiClient';
import { mockProjects } from '../mocks/mockProjects';
import { logger } from '../utils/logger';

const useMock = import.meta.env.VITE_USE_MOCK === 'true';

const mapProject = (p) => ({
  ...p,
  id: p.projectId,
  name: p.projectName,
  code: p.projectCode,
  consumedHours: p.consumedHours || 0
});

export const projectService = {
  getProjects: async () => {
    if (useMock) {
      await new Promise(resolve => setTimeout(resolve, 800));
      return { data: mockProjects };
    }
    const response = await apiClient.get('/projects');
    return { data: response.data.data.map(mapProject) };
  },

  getProjectById: async (id) => {
    if (useMock) {
      await new Promise(resolve => setTimeout(resolve, 500));
      const project = mockProjects.find(p => p.id === id);
      return { data: project };
    }
    const response = await apiClient.get(`/projects/${id}`);
    return { data: mapProject(response.data.data) };
  },

  createProject: async (projectData) => {
    if (useMock) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      const newProject = {
        ...projectData,
        id: 'p' + (mockProjects.length + 1),
        code: 'PRJ-' + (mockProjects.length + 1).toString().padStart(3, '0'),
        status: projectData.status || 'PendingReview',
        createdAt: new Date().toISOString(),
        consumedHours: 0
      };
      mockProjects.push(newProject);
      return { data: newProject };
    }
    const mappedPayload = {
      projectName: projectData.name,
      client: projectData.client,
      description: projectData.description,
      startDate: projectData.expectedStart,
      budgetTable: projectData.budgetTable,
      milestones: projectData.milestones,
      status: projectData.status
    };
    const response = await apiClient.post('/projects', mappedPayload);
    return { data: mapProject(response.data.data) };
  },

  updateProject: async (projectId, projectData) => {
    if (useMock) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      const idx = mockProjects.findIndex(p => p.id === projectId);
      if (idx !== -1) {
        mockProjects[idx] = {
          ...mockProjects[idx],
          ...projectData,
          updatedAt: new Date().toISOString()
        };
        return { data: mockProjects[idx] };
      }
      throw new Error('Project not found');
    }
    const mappedPayload = {
      projectName: projectData.name,
      client: projectData.client,
      description: projectData.description,
      startDate: projectData.expectedStart,
      budgetTable: projectData.budgetTable,
      milestones: projectData.milestones,
      status: projectData.status
    };
    const response = await apiClient.put(`/projects/${projectId}`, mappedPayload);
    return { data: mapProject(response.data.data) };
  },

  deleteProject: async (projectId) => {
    if (useMock) {
      await new Promise(resolve => setTimeout(resolve, 600));
      const idx = mockProjects.findIndex(p => p.id === projectId);
      if (idx !== -1) mockProjects.splice(idx, 1);
      return { data: { success: true } };
    }
    return apiClient.delete(`/projects/${projectId}`);
  },

  uploadDocument: async (projectId, file) => {
    if (useMock) {
      await new Promise(resolve => setTimeout(resolve, 1500));
      return { data: { success: true, fileName: file.name, version: 'v1.0' } };
    }
    const formData = new FormData();
    formData.append('file', file);
    const response = await apiClient.post(`/projects/${projectId}/documents`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    });
    return { data: response.data.data };
  },

  submitForReview: async (projectId) => {
    if (useMock) {
      await new Promise(resolve => setTimeout(resolve, 800));
      const idx = mockProjects.findIndex(p => String(p.id) === String(projectId));
      if (idx !== -1) {
        mockProjects[idx].status = 'PendingReview';
      }
      return { data: { success: true } };
    }
    const response = await apiClient.put(`/projects/${projectId}/status`, { status: 'PendingReview' });
    return { data: response.data.data };
  },

  getPendingProjects: async () => {
    if (useMock) {
      await new Promise(resolve => setTimeout(resolve, 800));
      return { data: mockProjects.filter(p => p.status === 'PendingReview') };
    }
    const response = await apiClient.get('/projects?status=PendingReview');
    return { data: response.data.data.map(mapProject) };
  },

  getCostAnalysis: async (projectId) => {
    if (useMock) {
      await new Promise(resolve => setTimeout(resolve, 500));
      return { data: {
        totalBudget: 1000000,
        contingencyBuffer: 10,
        estimatedHours: 1200,
        completionDate: '2024-12-31',
        phases: [
          { name: 'Discovery', hours: 100, cost: 50000 },
          { name: 'Design', hours: 200, cost: 150000 }
        ]
      }};
    }
    const response = await apiClient.get(`/projects/${projectId}/cost-analysis`);
    const d = response.data.data;
    if (!d) return { data: null };
    return { data: {
      totalBudget: d.totalBudget,
      estimatedHours: d.totalEstimatedHours,
      completionDate: d.estimatedCompletionDate,
      phases: d.phases.map(p => ({
        name: p.phaseName,
        hours: p.estimatedHours,
        cost: p.budgetAllocation
      }))
    }};
  },

  submitCostAnalysis: async (projectId, data) => {
    if (useMock) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      return { data: { success: true } };
    }
    const mappedPayload = {
      totalBudget: Number(data.totalBudget),
      totalEstimatedHours: Number(data.estimatedHours),
      estimatedCompletionDate: data.completionDate ? (data.completionDate.toISOString ? data.completionDate.toISOString() : data.completionDate) : undefined,
      phases: data.phases.map(p => ({
        phaseName: p.name,
        budgetAllocation: Number(p.cost),
        estimatedHours: Number(p.hours)
      }))
    };
    const response = await apiClient.post(`/projects/${projectId}/cost-analysis`, mappedPayload);
    return { data: response.data.data };
  },

  approveDocument: async (projectId, dataOrTLId) => {
    if (useMock) {
      await new Promise(resolve => setTimeout(resolve, 800));
      const idx = mockProjects.findIndex(p => String(p.id) === String(projectId));
      if (idx !== -1) {
        const payload = typeof dataOrTLId === 'object' ? dataOrTLId : { assignedTeamLeadId: Number(dataOrTLId) };
        mockProjects[idx] = {
          ...mockProjects[idx],
          status: payload.status || 'Approved',
          budgetTable: payload.budgetTable || mockProjects[idx].budgetTable,
          milestones: payload.milestones || mockProjects[idx].milestones,
          totalHours: payload.totalHours || mockProjects[idx].totalHours,
          bufferHours: payload.bufferHours || mockProjects[idx].bufferHours,
          assignedProjectManagerId: payload.assignedProjectManagerId || mockProjects[idx].assignedProjectManagerId,
          assignedTeamLeadId: payload.assignedTeamLeadId || mockProjects[idx].assignedTeamLeadId
        };
      }
      return { data: { success: true } };
    }
    const payload = typeof dataOrTLId === 'object' ? dataOrTLId : { assignedTeamLeadId: Number(dataOrTLId) };
    const response = await apiClient.put(`/projects/${projectId}/status`, { 
      status: payload.status || 'Approved',
      ...payload
    });
    return { data: response.data.data };
  },

  returnDocument: async (projectId, comments) => {
    if (useMock) {
      await new Promise(resolve => setTimeout(resolve, 800));
      const idx = mockProjects.findIndex(p => String(p.id) === String(projectId));
      if (idx !== -1) {
        mockProjects[idx] = {
          ...mockProjects[idx],
          status: 'ReturnedForRevision',
          comments: comments
        };
      }
      return { data: { success: true } };
    }
    const response = await apiClient.put(`/projects/${projectId}/status`, { status: 'ReturnedForRevision', note: comments, comments: comments });
    return { data: response.data.data };
  },

  getProjectOverview: async (id) => {
    if (useMock) {
      await new Promise(resolve => setTimeout(resolve, 600));
      const project = mockProjects.find(p => p.id === id);
      return { data: { ...project, latestStatusNote: 'Project is moving steadily.' } };
    }
    const response = await apiClient.get(`/projects/${id}`);
    return { data: mapProject(response.data.data) };
  },

  updateProjectStatus: async (id, data) => {
    if (useMock) {
      await new Promise(resolve => setTimeout(resolve, 800));
      const idx = mockProjects.findIndex(p => String(p.id) === String(id));
      if (idx !== -1) {
        mockProjects[idx] = {
          ...mockProjects[idx],
          ...data,
          status: data.status || mockProjects[idx].status,
          comments: data.note || data.comments || mockProjects[idx].comments
        };
      }
      return { data: { success: true } };
    }
    const response = await apiClient.put(`/projects/${id}/status`, data);
    return { data: response.data.data };
  },

  getAuditLog: async (id) => {
    if (useMock) {
      await new Promise(resolve => setTimeout(resolve, 500));
      return { data: [
        { id: 1, action: 'Project Created', user: 'Sales Manager', timestamp: '2024-04-10T10:00:00Z' }
      ]};
    }
    const response = await apiClient.get('/analytics/audit-logs');
    // Filter by project if needed, but for now just return all for the tenant
    return { data: response.data.data.map(log => ({
      ...log,
      id: log.auditLogId,
      timestamp: log.createdAt
    })) };
  },

  getDocuments: async (projectId) => {
    if (useMock) {
      await new Promise(resolve => setTimeout(resolve, 500));
      return { data: [{ id: 1, documentId: 1, fileName: 'Scope.pdf', status: 'Pending', version: 1 }] };
    }
    const response = await apiClient.get(`/projects/${projectId}/documents`);
    const docs = response.data.data.map(d => ({
      ...d,
      id: d.documentId || d.id,
      documentId: d.documentId || d.id,
      fileName: d.fileName || d.name
    }));
    return { data: docs };
  },

  downloadDocument: async (projectId, docId, fileName) => {
    if (useMock) {
      notification.info({ message: 'Mock Download', description: `Downloading ${fileName}...` });
      return;
    }
    const response = await apiClient.get(`/projects/${projectId}/documents/${docId}/download`, {
      responseType: 'blob'
    });
    
    // Create link and trigger download
    const url = window.URL.createObjectURL(new Blob([response.data]));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', fileName);
    document.body.appendChild(link);
    link.click();
    link.remove();
  }
};
