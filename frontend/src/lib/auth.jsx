import React, { createContext, useContext, useState, useEffect } from 'react';

const API_URL = import.meta.env.VITE_API_URL || '/api';
const ROLE_HIERARCHY = ['client', 'teacher', 'front_desk', 'manager', 'owner', 'admin'];
const ROLE_LABELS = { client: 'Member', teacher: 'Teacher', front_desk: 'Front Desk', manager: 'Manager', owner: 'Owner', admin: 'Administrator' };
const AuthContext = createContext(null);

export async function api(endpoint, options = {}) {
  const token = localStorage.getItem('auth_token');
  const res = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(token && { Authorization: `Bearer ${token}` }), ...options.headers },
  });
  if (res.status === 401) {
    localStorage.removeItem('auth_token');
    if (window.location.pathname !== '/') window.location.href = '/';
    throw new Error('Session expired');
  }
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('auth_token');
    if (!token) { setLoading(false); return; }
    api('/auth/me').then(d => setUser(d.user)).catch(() => localStorage.removeItem('auth_token')).finally(() => setLoading(false));
  }, []);

  const login = async (email, password) => {
    const data = await api('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });
    localStorage.setItem('auth_token', data.token);
    setUser(data.user);
    return data.user;
  };

  const register = async (userData) => {
    const data = await api('/auth/register', { method: 'POST', body: JSON.stringify(userData) });
    localStorage.setItem('auth_token', data.token);
    setUser(data.user);
    return data.user;
  };

  const logout = () => {
    ['auth_token', 'staff_token', 'user_token'].forEach(k => localStorage.removeItem(k));
    setUser(null);
  };

  const hasRole = (roles) => user && (Array.isArray(roles) ? roles : [roles]).includes(user.role);
  const isStaff = user && ['front_desk', 'teacher', 'manager', 'owner', 'admin'].includes(user.role);
  const isManager = user && ['manager', 'owner', 'admin'].includes(user.role);
  const isOwner = user && ['owner', 'admin'].includes(user.role);

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, hasRole, isStaff, isManager, isOwner, isAuthenticated: !!user, roleLabel: user ? ROLE_LABELS[user.role] || user.role : null }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

export { ROLE_HIERARCHY, ROLE_LABELS };
