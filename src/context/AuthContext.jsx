// src/context/AuthContext.jsx
import React, { createContext, useContext, useState, useEffect } from 'react';
import { api } from '../api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('sales_token') || null);
  const [loading, setLoading] = useState(true);
  const [demoAccounts, setDemoAccounts] = useState([]);

  useEffect(() => {
    loadUser();
    loadDemoAccounts();
  }, [token]);

  async function loadUser() {
    if (!token) {
      setUser(null);
      setLoading(false);
      return;
    }
    try {
      const data = await api.get('/auth/me');
      setUser(data.user);
    } catch (err) {
      console.warn('Failed to load user with current token:', err.message);
      logout();
    } finally {
      setLoading(false);
    }
  }

  async function loadDemoAccounts() {
    try {
      const data = await api.get('/auth/demo-accounts');
      setDemoAccounts(data.accounts || []);
    } catch (err) {
      // Ignore if server isn't up yet
    }
  }

  async function login(username, password) {
    const data = await api.post('/auth/login', { username, password });
    localStorage.setItem('sales_token', data.token);
    setToken(data.token);
    setUser(data.user);
    return data.user;
  }

  async function switchDemo(username) {
    const data = await api.post('/auth/demo-switch', { username });
    localStorage.setItem('sales_token', data.token);
    setToken(data.token);
    setUser(data.user);
    return data.user;
  }

  function logout() {
    localStorage.removeItem('sales_token');
    setToken(null);
    setUser(null);
  }

  const value = {
    user,
    token,
    loading,
    demoAccounts,
    login,
    logout,
    switchDemo,
    refreshUser: loadUser
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
