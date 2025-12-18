import React from 'react';
import { Navigate } from 'react-router-dom';

const ADMIN_PATH = import.meta.env.VITE_ADMIN_PATH || '/admin-secret';

const PrivateRoute = ({ children }) => {
  const token = localStorage.getItem('admin_token');
  
  if (!token) {
    return <Navigate to={`${ADMIN_PATH}/login`} replace />;
  }

  return children;
};

export default PrivateRoute;
