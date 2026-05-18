import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { resolveTenant } from '../utils/tenantResolver';

export const useAuthStore = create(
  persist(
    (set, get) => ({
      currentUser: null,
      token: null,
      refreshToken: null,
      role: null,
      tenantCode: resolveTenant(),
      isAuthenticated: false,

      login: (userData, token, refreshToken) => set({
        currentUser: userData,
        token: token,
        refreshToken: refreshToken,
        role: userData.role,
        tenantCode: userData.tenantCode || get().tenantCode,
        isAuthenticated: true
      }),

      logout: () => set({
        currentUser: null,
        token: null,
        refreshToken: null,
        role: null,
        tenantCode: resolveTenant(),
        isAuthenticated: false
      }),

      setUser: (userData) => set({ currentUser: userData, role: userData.role }),

      refreshTokens: (newToken, newRefreshToken) => set({
        token: newToken,
        refreshToken: newRefreshToken
      }),

      _hasHydrated: false,
      setHasHydrated: (state) => set({ _hasHydrated: state })
    }),
    {
      name: 'rabbit-auth-storage',
      onRehydrateStorage: () => (state) => {
        state.setHasHydrated(true);
      },
      partialize: (state) => ({ 
        token: state.token, 
        tenantCode: state.tenantCode,
        isAuthenticated: state.isAuthenticated,
        role: state.role,
        currentUser: state.currentUser
      })
    }
  )
);
