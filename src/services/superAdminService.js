import apiClient from './apiClient';

const useMock = import.meta.env.VITE_USE_MOCK === 'true';

const mockTenants = [
  { id: 't1', name: 'Acme Corp', code: 'acme', plan: 'Enterprise', users: 150, projects: 45, status: 'Active', created: '2023-01-10' },
  { id: 't2', name: 'Globex', code: 'globex', plan: 'Pro', users: 45, projects: 12, status: 'Active', created: '2023-05-20' },
  { id: 't3', name: 'Soylent Corp', code: 'soylent', plan: 'Starter', users: 10, projects: 3, status: 'Inactive', created: '2023-11-05' }
];

const mapTenant = (t) => {
  if (!t) return null;
  return {
    id: t.tenantId,
    name: t.tenantName,
    code: t.tenantCode,
    plan: t.plan,
    users: t.userCount || 0,
    projects: t.projectCount || 0,
    status: t.isActive ? 'Active' : 'Inactive',
    isActive: t.isActive,
    created: t.createdAt
  };
};

export const superAdminService = {
  getTenants: async () => {
    if (useMock) {
      await new Promise(resolve => setTimeout(resolve, 800));
      return { data: mockTenants };
    }
    const response = await apiClient.get('/tenants');
    return { data: response.data.data.map(mapTenant) };
  },

  createTenant: async (data) => {
    if (useMock) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      const newTenant = {
        ...data,
        id: `t${mockTenants.length + 1}`,
        users: 0,
        projects: 0,
        status: 'Active',
        created: new Date().toISOString()
      };
      mockTenants.push(newTenant);
      return { data: newTenant };
    }
    const payload = {
      tenantName: data.name,
      tenantCode: data.code,
      plan: data.plan
    };
    const response = await apiClient.post('/tenants', payload);
    return { data: mapTenant(response.data.data) };
  },

  getTenantById: async (id) => {
    if (useMock) {
      await new Promise(resolve => setTimeout(resolve, 600));
      return { data: mockTenants.find(t => t.id === id) };
    }
    const response = await apiClient.get(`/tenants/${id}`);
    return { data: mapTenant(response.data.data) };
  },

  toggleTenantStatus: async (id, currentStatus) => {
    if (useMock) {
      await new Promise(resolve => setTimeout(resolve, 500));
      const tenant = mockTenants.find(t => t.id === id);
      if (tenant) {
        tenant.status = tenant.status === 'Active' ? 'Inactive' : 'Active';
      }
      return { data: { success: true } };
    }
    const isActive = currentStatus !== 'Active';
    const response = await apiClient.put(`/tenants/${id}/status`, { isActive });
    return { data: response.data.data };
  },

  getTenantUsers: async (tenantId) => {
    if (useMock) {
      return { data: [] };
    }
    const response = await apiClient.get(`/users?tenantId=${tenantId}`);
    return { data: response.data.data };
  },

  createTenantUser: async (tenantId, userData) => {
    if (useMock) {
      return { data: { ...userData, id: Date.now() } };
    }
    const payload = {
      ...userData,
      tenantId
    };
    const response = await apiClient.post('/users', payload);
    return { data: response.data.data };
  }
};
