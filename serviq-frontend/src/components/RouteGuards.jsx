import React from 'react';
import { Navigate, useLocation, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { House } from 'lucide-react';

export function LoadingScreen() {
  return (
    <div className="auth-loading-screen">
      <div className="auth-loading-card">
        <div className="brand-mark animate-pulse">
          <House size={20} strokeWidth={2.5} />
        </div>
        <div className="loading-dots">
          <span />
          <span />
          <span />
        </div>
      </div>
    </div>
  );
}

export function RequireAuth({ children }) {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return <LoadingScreen />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ returnTo: location.pathname }} replace />;
  }

  return children ? children : <Outlet />;
}

export function RequireRole({ allowedRole, children }) {
  const { user, isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return <LoadingScreen />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ returnTo: location.pathname }} replace />;
  }

  // Cross-role protection:
  // If a Customer visits /worker/*, send them directly to /customer
  // If a Worker visits /customer/*, send them directly to /worker
  const userRole = (user?.role || '').toLowerCase();
  const targetRole = (allowedRole || '').toLowerCase();

  if (userRole !== targetRole) {
    const destination = userRole === 'worker' ? '/worker' : '/customer';
    return <Navigate to={destination} replace />;
  }

  return children ? children : <Outlet />;
}
