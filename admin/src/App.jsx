import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext.jsx';
import { SocketProvider } from './context/SocketContext.jsx';
import ProtectedRoute from './components/ProtectedRoute.jsx';
import Login from './pages/Login.jsx';
import Dashboard from './pages/Dashboard.jsx';
import { Toaster } from 'react-hot-toast';

function App() {
  return (
    <AuthProvider>
      <SocketProvider>
        <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route
            path="/"
            element={
              <ProtectedRoute allowedRole="admin">
                <Dashboard />
              </ProtectedRoute>
            }
          />
          <Route
            path="/unauthorized"
            element={
              <div className="flex h-screen w-screen flex-col items-center justify-center bg-black text-white">
                <h1 className="text-2xl font-bold text-red-500 mb-2">Unauthorized Access</h1>
                <p className="text-sm text-slate-400">You do not have permission to access the admin panel.</p>
                <a href="/login" className="mt-4 text-cyan-400 hover:underline">Back to Login</a>
              </div>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: '#0a0a0a',
            color: '#e2e8f0',
            border: '1px solid #1e293b',
          },
        }}
      />
      </SocketProvider>
    </AuthProvider>
  );
}

export default App;