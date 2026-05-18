import axios from 'axios';
import { useAuthStore } from '../store/authStore';
import { logger } from '../utils/logger';

const apiClient = axios.create({
  baseURL: `${import.meta.env.VITE_API_URL}/api`,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Request interceptor
apiClient.interceptors.request.use(
  (config) => {
    const { token, tenantCode } = useAuthStore.getState();

    // Attach JWT token
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    // Attach tenant code
    if (tenantCode) {
      config.headers['X-Tenant-Code'] = tenantCode;
    }

    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor
apiClient.interceptors.response.use(
  (response) => response,

  async (error) => {
    const originalRequest = error.config;

    // Handle token expiration
    if (
      error.response?.status === 401 &&
      !originalRequest._retry
    ) {
      originalRequest._retry = true;

      try {
        const { refreshToken, refreshTokens } =
          useAuthStore.getState();

        if (!refreshToken) {
          throw new Error('No refresh token available');
        }

        // Refresh token request
        const response = await axios.post(
          `${import.meta.env.VITE_API_URL}/api/auth/refresh`,
          {
            refreshToken
          }
        );

        const { token, newRefreshToken } = response.data;

        // Update tokens in store
        refreshTokens(token, newRefreshToken);

        // Retry original request
        originalRequest.headers.Authorization = `Bearer ${token}`;

        return apiClient(originalRequest);

      } catch (refreshError) {
        logger.error('Session expired. Please login again.');

        useAuthStore.getState().logout();

        window.location.href = '/login';

        return Promise.reject(refreshError);
      }
    }

    // Forbidden
    if (error.response?.status === 403) {
      window.location.href = '/forbidden';
    }

    // Tenant not found
    if (
      error.response?.status === 404 &&
      error.response.data?.type === 'TenantNotFound'
    ) {
      window.location.href = '/tenant-not-found';
    }

    return Promise.reject(error);
  }
);

export default apiClient;