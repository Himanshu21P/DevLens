import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { Loader2 } from 'lucide-react';

/**
 * Guard that restricts access to authenticated users only.
 * Redirects unauthenticated users to the login screen.
 */
export const ProtectedRoute = () => {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-dark-950 flex flex-col items-center justify-center gap-4">
        <Loader2 className="animate-spin text-brand-500" size={36} />
        <span className="text-sm font-mono text-slate-400">Loading DevLens...</span>
      </div>
    );
  }

  return user ? <Outlet /> : <Navigate to="/login" replace />;
};

/**
 * Guard that prevents authenticated users from accessing login/register pages.
 * Redirects authenticated users to the dashboard.
 */
export const PublicRoute = () => {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen bg-dark-950 flex flex-col items-center justify-center gap-4">
        <Loader2 className="animate-spin text-brand-500" size={36} />
        <span className="text-sm font-mono text-slate-400">Verifying session...</span>
      </div>
    );
  }

  return !user ? <Outlet /> : <Navigate to="/dashboard" replace />;
};
