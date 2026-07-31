import axios from 'axios';
import { useAuthStore } from '../store/authStore';
import { logger } from '../utils/logger';

// Vercel can override VITE_API_URL to "" via its dashboard env vars.
// The fallback ensures we always point at the Render backend in production.
const BACKEND_URL =
  import.meta.env.VITE_API_URL && import.meta.env.VITE_API_URL.trim() !== ''
    ? import.meta.env.VITE_API_URL.trim()
    : 'https://g3r2qowipf.execute-api.ap-south-1.amazonaws.com/production';

const apiClient = axios.create({
  baseURL: `${BACKEND_URL}/api`,
  headers: {
    'Content-Type': 'application/json',
  },
});


/* -----------------------
   REQUEST INTERCEPTOR
------------------------ */
apiClient.interceptors.request.use(
  (config) => {
    let { token, tenantCode } = useAuthStore.getState();

    // Direct fallbacks if store values are empty/null
    if (!token) {
      token = localStorage.getItem('token');
    }
    if (!tenantCode) {
      tenantCode = localStorage.getItem('tenantCode');
    }

    // Fallbacks by parsing persisted Zustand stores
    if (!token || !tenantCode) {
      const storeKeys = ['rabbit-auth-storage', 'auth-storage'];
      for (const key of storeKeys) {
        const persistedRaw = localStorage.getItem(key);
        if (persistedRaw) {
          try {
            const parsed = JSON.parse(persistedRaw);
            const state = parsed?.state;
            if (state) {
              if (!token && state.token) {
                token = state.token;
              }
              if (!tenantCode && state.tenantCode) {
                tenantCode = state.tenantCode;
              }
            }
          } catch (e) {
            console.error(`Failed to parse persisted store key: ${key}`, e);
          }
        }
      }
    }

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
    const isAuthEndpoint =
      originalRequest.url?.includes('/auth/login') ||
      originalRequest.url?.includes('/auth/refresh');

    if (status === 401 && !originalRequest._retry && !isAuthEndpoint) {
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