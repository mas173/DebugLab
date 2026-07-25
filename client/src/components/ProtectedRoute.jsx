import React from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';

export default function ProtectedRoute({ children, allowedRole = 'participant' }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex h-screen w-screen flex-col items-center justify-center bg-slate-950 text-slate-200">
        <div className="h-10 w-10 animate-spin rounded-full border-4 border-slate-700 border-t-purple-500"></div>
        <p className="mt-4 text-sm font-medium tracking-wide text-slate-400">Loading your workspace...</p>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRole && user.role !== allowedRole) {
    // If participant tries to access admin or vice-versa, redirect accordingly
    return <Navigate to="/unauthorized" replace />;
  }

  return children;
}
