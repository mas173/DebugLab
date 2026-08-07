import React, { createContext, useState, useEffect, useContext } from 'react';
import axios from 'axios';

const AuthContext = createContext(null);

axios.defaults.baseURL = import.meta.env.VITE_API_URL || 'http://localhost:5000';
axios.defaults.withCredentials = true;

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
    }

    // Response interceptor to handle expired or invalid tokens automatically
    const interceptor = axios.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response && error.response.status === 401) {
          setUser(null);
          localStorage.removeItem('token');
          delete axios.defaults.headers.common['Authorization'];
        }
        return Promise.reject(error);
      }
    );

    async function checkAuth() {
      try {
        const res = await axios.get('/api/auth/me');
        if (res.data && res.data.user) {
          setUser(res.data.user);
        }
      } catch (err) {
        setUser(null);
        if (err.response && (err.response.status === 401 || err.response.status === 403)) {
          localStorage.removeItem('token');
          delete axios.defaults.headers.common['Authorization'];
        }
      } finally {
        setLoading(false);
      }
    }
    checkAuth();

    return () => {
      axios.interceptors.response.eject(interceptor);
    };
  }, []);

  const login = async (username, password) => {
    try {
      const res = await axios.post('/api/auth/login', { username, password });
      if (res.data && res.data.user) {
        setUser(res.data.user);
        if (res.data.token) {
          axios.defaults.headers.common['Authorization'] = `Bearer ${res.data.token}`;
          localStorage.setItem('token', res.data.token);
        }
        return { success: true, user: res.data.user };
      }
      return { success: false, error: 'Login failed' };
    } catch (err) {
      const errorMessage = err.response?.data?.error || 'Invalid credentials';
      return { success: false, error: errorMessage };
    }
  };

  const logout = async () => {
    try {
      await axios.post('/api/auth/logout');
    } catch (err) {
      console.error('Logout error', err);
    } finally {
      setUser(null);
      delete axios.defaults.headers.common['Authorization'];
      localStorage.removeItem('token');
    }
  };

  const value = {
    user,
    loading,
    login,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
