import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { Spin } from 'antd';
import { useAuthStore } from '../../store/authStore';
import PropTypes from 'prop-types';

const ProtectedRoute = ({ allowedRoles }) => {
  const { isAuthenticated, role, currentUser, _hasHydrated, token } = useAuthStore();

  // Get persisted auth from localStorage as fallbacks
  let tokenFromStorage = localStorage.getItem('token');
  let authState = null;

  const persistedRaw = localStorage.getItem('rabbit-auth-storage');
  if (persistedRaw) {
    try {
      const parsed = JSON.parse(persistedRaw);
      authState = parsed?.state || null;
      if (!tokenFromStorage && authState?.token) {
        tokenFromStorage = authState.token;
      }
    } catch (e) {
      console.error('Failed to parse rabbit-auth-storage', e);
    }
  }

  const hasToken = token || tokenFromStorage;
  const isAuth = isAuthenticated || authState?.isAuthenticated;
  const activeRole = role || authState?.role;
  const activeUser = currentUser || authState?.currentUser;

  // Wait for Zustand to rehydrate from localStorage before making any auth decision,
  // unless we already have a valid token in localStorage.
  if (!_hasHydrated && !hasToken) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '100vh',
      }}>
        <Spin size="large" />
      </div>
    );
  }

  if (!isAuth && !hasToken) {
    return <Navigate to="/login" replace />;
  }

  const userRoles = typeof activeRole === 'string'
    ? activeRole.split(',').map(r => r.trim()).filter(Boolean)
    : (Array.isArray(activeRole) ? activeRole : []);

  let hasAccess = !allowedRoles || allowedRoles.some(r => userRoles.includes(r));

  if (hasAccess && activeUser?.permissions) {
    const currentPath = window.location.pathname;
    const permissions = activeUser.permissions;
    for (const key of Object.keys(permissions)) {
      if (permissions[key] === false) {
        if (currentPath === key || currentPath.startsWith(key + '/')) {
          hasAccess = false;
          break;
        }
      }
    }
  }

  if (!hasAccess) {
    return <Navigate to="/forbidden" replace />;
  }

  return <Outlet />;
};

ProtectedRoute.propTypes = {
  allowedRoles: PropTypes.arrayOf(PropTypes.string)
};

export default ProtectedRoute;
