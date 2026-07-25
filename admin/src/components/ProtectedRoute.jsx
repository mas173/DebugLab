import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

export default function ProtectedRoute({ children, allowedRole = 'admin' }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex h-screen w-screen flex-col items-center justify-center bg-black text-white">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-slate-800 border-t-cyan-400"></div>
        <p className="mt-4 text-sm font-medium tracking-wide text-cyan-400">Initialising Admin Console...</p>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRole && user.role !== allowedRole) {
    return <Navigate to="/unauthorized" replace />;
  }

  return children;
}
