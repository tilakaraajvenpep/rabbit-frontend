import apiClient from './apiClient';
import { mockUsers } from '../mocks/mockUsers';

import { useAuthStore } from '../store/authStore';

const useMock = import.meta.env.VITE_USE_MOCK === 'true';

export const adminService = {
  getUsers: async () => {
    if (useMock) {
      await new Promise(resolve => setTimeout(resolve, 800));
      const { tenantCode } = useAuthStore.getState();
      return { data: mockUsers.filter(u => u.tenantCode === tenantCode) };
    }
    const response = await apiClient.get('/users');
    return { data: response.data.data };
  },

  inviteUser: async (data) => {
    if (useMock) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      const { tenantCode } = useAuthStore.getState();
      const newUser = {
        id: `u${mockUsers.length + 1}`,
        name: data.email.split('@')[0],
        email: data.email,
        role: data.role,
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
      role: data.role
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
        storageUsed: 42
      }};
    }
    return apiClient.get('/admin/subscription');
  }
};
