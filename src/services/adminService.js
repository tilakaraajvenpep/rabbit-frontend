import apiClient from './apiClient';
import { mockUsers } from '../mocks/mockUsers';

import { useAuthStore } from '../store/authStore';

const useMock = import.meta.env.VITE_USE_MOCK === 'true';

export const adminService = {
  getUsers: async () => {
    const authState = useAuthStore.getState();
    const isPM = authState.role === 'ProjectManager';
    const pmId = authState.user?.id || authState.user?.userId;

    if (useMock) {
      await new Promise(resolve => setTimeout(resolve, 800));
      const { tenantCode } = useAuthStore.getState();
      const filtered = mockUsers.filter(u => u.tenantCode === tenantCode);
      let mapped = filtered.map(u => ({
        ...u,
        id: u.id,
        name: u.name || u.fullName,
        fullName: u.fullName || u.name
      }));
      if (isPM && pmId) {
        const associatedTLs = mapped.filter(u => u.role === 'TeamLead' && String(u.projectManagerId) === String(pmId));
        const associatedTLIds = new Set(associatedTLs.map(tl => String(tl.id)));
        mapped = mapped.filter(u => 
          String(u.id) === String(pmId) ||
          (u.role === 'TeamLead' && String(u.projectManagerId) === String(pmId)) ||
          (u.role === 'Employee' && (
            String(u.projectManagerId) === String(pmId) ||
            (u.teamLeadId && associatedTLIds.has(String(u.teamLeadId)))
          ))
        );
      }
      return { data: mapped };
    }
    const response = await apiClient.get('/users');
    let mapped = response.data.data.map(u => ({
      ...u,
      id: u.id || u.userId,
      name: u.name || u.fullName,
      fullName: u.fullName || u.name
    }));
    if (isPM && pmId) {
      const associatedTLs = mapped.filter(u => u.role === 'TeamLead' && String(u.projectManagerId) === String(pmId));
      const associatedTLIds = new Set(associatedTLs.map(tl => String(tl.id)));
      mapped = mapped.filter(u => 
        String(u.id) === String(pmId) ||
        (u.role === 'TeamLead' && String(u.projectManagerId) === String(pmId)) ||
        (u.role === 'Employee' && (
          String(u.projectManagerId) === String(pmId) ||
          (u.teamLeadId && associatedTLIds.has(String(u.teamLeadId)))
        ))
      );
    }
    return { data: mapped };
  },

  inviteUser: async (data) => {
    const authState = useAuthStore.getState();
    const isPM = authState.role === 'ProjectManager';
    const pmId = authState.user?.id || authState.user?.userId;
    const finalPMId = isPM ? pmId : data.projectManagerId;

    if (useMock) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      const { tenantCode } = useAuthStore.getState();
      const newUser = {
        id: `u${mockUsers.length + 1}`,
        name: data.fullName || data.email.split('@')[0],
        fullName: data.fullName,
        email: data.email,
        role: data.role,
        costPerHour: data.costPerHour || 0,
        teamLeadId: data.teamLeadId,
        projectManagerId: finalPMId,
        tenantCode: tenantCode,
        status: 'Active',
        avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${data.email}`
      };
      mockUsers.push(newUser);
      return { data: newUser };
    }
    // Matching backend POST /users
    const payload = {
      fullName: data.fullName || data.email.split('@')[0],
      email: data.email,
      password: data.password || 'Rabbit@123', // Default password for new invites
      role: data.role,
      costPerHour: data.costPerHour,
      teamLeadId: data.teamLeadId,
      projectManagerId: finalPMId
    };
    return apiClient.post('/users', payload);
  },

  updateUserRole: async (id, role) => {
    if (useMock) {
      await new Promise(resolve => setTimeout(resolve, 500));
      const user = mockUsers.find(u => u.id === id);
      if (user) user.role = role;
      return { data: { success: true } };
    }
    return apiClient.put(`/users/${id}/role`, { role });
  },

  updateCostPerHour: async (id, costPerHour) => {
    if (useMock) {
      await new Promise(resolve => setTimeout(resolve, 500));
      const user = mockUsers.find(u => u.id === id || u.userId === id);
      if (user) user.costPerHour = String(costPerHour);
      return { data: { success: true } };
    }
    return apiClient.put(`/users/${id}/cost-per-hour`, { costPerHour });
  },

  updateUserTeamLead: async (id, teamLeadId) => {
    if (useMock) {
      await new Promise(resolve => setTimeout(resolve, 500));
      const user = mockUsers.find(u => u.id === id);
      if (user) user.teamLeadId = teamLeadId;
      return { data: { success: true } };
    }
    return apiClient.put(`/users/${id}/team-lead`, { teamLeadId });
  },

  updateUserProjectManager: async (id, projectManagerId) => {
    if (useMock) {
      await new Promise(resolve => setTimeout(resolve, 500));
      const user = mockUsers.find(u => u.id === id);
      if (user) user.projectManagerId = projectManagerId;
      return { data: { success: true } };
    }
    return apiClient.put(`/users/${id}/project-manager`, { projectManagerId });
  },

  toggleUserStatus: async (id) => {
    if (useMock) {
      await new Promise(resolve => setTimeout(resolve, 500));
      const user = mockUsers.find(u => u.id === id);
      if (user) {
        user.status = user.status === 'Inactive' ? 'Active' : 'Inactive';
      }
      return { data: { success: true } };
    }
    return apiClient.put(`/users/${id}/status`);
  },

  deleteUser: async (id) => {
    if (useMock) {
      await new Promise(resolve => setTimeout(resolve, 500));
      const idx = mockUsers.findIndex(u => u.id === id);
      if (idx !== -1) mockUsers.splice(idx, 1);
      return { data: { success: true } };
    }
    return apiClient.delete(`/users/${id}`);
  },

  getSubscription: async () => {
    if (useMock) {
      await new Promise(resolve => setTimeout(resolve, 600));
      return { data: {
        planName: 'Pro Plan',
        renewalDate: '2025-01-15',
        maxUsers: 50,
        activeUsers: 24,
        maxProjects: 20,
        activeProjects: 8,
        storageQuota: 100,
        storageUsed: 42,
        tenantName: 'Demo Workspace',
        tenantCode: 'demo',
        isActive: true,
        createdAt: new Date().toISOString(),
      }};
    }
    const response = await apiClient.get('/tenants/my');
    const d = response.data.data;
    return { data: {
      planName: d.plan || 'Free',
      renewalDate: d.subscriptionExpiry,
      maxUsers: d.maxUsers,
      activeUsers: d.activeUsers,
      maxProjects: d.maxProjects,
      activeProjects: d.activeProjects,
      storageQuota: Number(d.storageQuotaGb) || 1,
      storageUsed: 0,
      tenantName: d.tenantName,
      tenantCode: d.tenantCode,
      isActive: d.isActive,
      createdAt: d.createdAt,
    }};
  },

  setAllocatedHours: async (userId, hours) => {
    if (useMock) {
      await new Promise(resolve => setTimeout(resolve, 400));
      return { data: { id: userId, allocatedHours: hours } };
    }
    const response = await apiClient.put(`/users/${userId}/allocated-hours`, { allocatedHours: hours });
    return { data: response.data.data };
  },

  updateDateOfJoining: async (userId, dateOfJoining) => {
    if (useMock) {
      await new Promise(resolve => setTimeout(resolve, 500));
      const user = mockUsers.find(u => u.id === userId || u.userId === userId);
      if (user) user.dateOfJoining = dateOfJoining;
      return { data: { success: true } };
    }
    const response = await apiClient.put(`/users/${userId}/date-of-joining`, { dateOfJoining });
    return { data: response.data.data };
  },

  getStandardCost: async () => {
    if (useMock) {
      return { data: { standardCost: 500 } };
    }
    const response = await apiClient.get('/tenants/my');
    return { data: { standardCost: Number(response.data.data.standardCost) || 500 } };
  },

  updateStandardCost: async (standardCost) => {
    if (useMock) {
      return { data: { success: true } };
    }
    const response = await apiClient.put('/tenants/standard-cost', { standardCost });
    return { data: response.data.data };
  },

  getMyProfile: async () => {
    if (useMock) {
      await new Promise(resolve => setTimeout(resolve, 300));
      const { role } = useAuthStore.getState();
      const user = mockUsers.find(u => u.role === role) || mockUsers[0];
      return { data: {
        userId: user.id,
        fullName: user.name || user.fullName,
        email: user.email,
        role: user.role,
        isActive: true,
        allocatedHours: '8.50',
        tenantId: 1,
        teamLeadId: user.teamLeadId || 'u5'
      } };
    }
    const response = await apiClient.get('/users/me');
    return { data: response.data.data };
  }
};
