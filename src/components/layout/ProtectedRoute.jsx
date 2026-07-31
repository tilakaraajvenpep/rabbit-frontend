import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { Spin } from 'antd';
import { useAuthStore } from '../../store/authStore';
import PropTypes from 'prop-types';

const ProtectedRoute = ({ allowedRoles }) => {
  const { isAuthenticated, role, currentUser, _hasHydrated } = useAuthStore();

  // Wait for Zustand to rehydrate from localStorage before making any auth decision.
  // Returning null here caused a blank page flash — instead we show a centered spinner.
  if (!_hasHydrated) {
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

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  const userRoles = typeof role === 'string'
    ? role.split(',').map(r => r.trim()).filter(Boolean)
    : (Array.isArray(role) ? role : []);

  let hasAccess = !allowedRoles || allowedRoles.some(r => userRoles.includes(r));

  if (hasAccess && currentUser?.permissions) {
    const currentPath = window.location.pathname;
    const permissions = currentUser.permissions;
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
