import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import PropTypes from 'prop-types';

const ProtectedRoute = ({ allowedRoles }) => {
  const { isAuthenticated, role, _hasHydrated } = useAuthStore();

  console.log('Access Check:', { 
    path: window.location.pathname, 
    role, 
    allowedRoles, 
    match: allowedRoles?.includes(role),
    isHydrated: _hasHydrated
  });

  if (!_hasHydrated) {
    return null; 
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && !allowedRoles.includes(role)) {
    return <Navigate to="/forbidden" replace />;
  }

  return <Outlet />;
};

ProtectedRoute.propTypes = {
  allowedRoles: PropTypes.arrayOf(PropTypes.string)
};

export default ProtectedRoute;
