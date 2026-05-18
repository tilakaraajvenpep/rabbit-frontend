import axios from 'axios';
import { useAuthStore } from '../store/authStore';
import { logger } from '../utils/logger';

const apiClient = axios.create({
  baseURL: `${import.meta.env.VITE_API_URL}/api`,
  headers: {
    'Content-Type': 'application/json',
  },
});

/* -----------------------
   REQUEST INTERCEPTOR
------------------------ */
apiClient.interceptors.request.use(
  (config) => {
    const { token, tenantCode } = useAuthStore.getState();

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    if (tenantCode) {
      config.headers['X-Tenant-Code'] = tenantCode;
    }

    return config;
  },
  (error) => Promise.reject(error)
);

/* -----------------------
   RESPONSE INTERCEPTOR
------------------------ */
apiClient.interceptors.response.use(
  (response) => response,

  async (error) => {
    const originalRequest = error.config;

    // Always safe guard
    const status = error?.response?.status;

    /* -----------------------
       TOKEN EXPIRED (401)
    ------------------------ */
    if (status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        const { refreshToken, refreshTokens } = useAuthStore.getState();

        if (!refreshToken) {
          throw new Error('No refresh token available');
        }

        // IMPORTANT: use apiClient instead of raw axios
        const response = await apiClient.post('/auth/refresh', {
          refreshToken,
        });

        const { token, newRefreshToken } = response.data;

        refreshTokens(token, newRefreshToken);

        originalRequest.headers.Authorization = `Bearer ${token}`;

        return apiClient(originalRequest);
      } catch (refreshError) {
        logger.error('Session expired. Redirecting to login.');

        useAuthStore.getState().logout();

        window.location.href = '/login';

        return Promise.reject(refreshError);
      }
    }

    /* -----------------------
       FORBIDDEN (403)
    ------------------------ */
    if (status === 403) {
      window.location.href = '/forbidden';
    }

    /* -----------------------
       TENANT NOT FOUND (404)
    ------------------------ */
    if (
      status === 404 &&
      error.response?.data?.type === 'TenantNotFound'
    ) {
      window.location.href = '/tenant-not-found';
    }

    /* -----------------------
       GENERIC ERROR
    ------------------------ */
    logger?.error?.(error?.response?.data || error.message);

    return Promise.reject(error);
  }
);

export default apiClient;