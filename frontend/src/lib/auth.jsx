// ============================================
// UNIFIED AUTH CONTEXT
// Handles all user types: clients, teachers, staff
// ============================================

import React, { createContext, useContext, useState, useEffect } from 'react';

const API_URL = import.meta.env.VITE_API_URL || '/api';

// User roles ordered by privilege level
const ROLE_HIERARCHY = ['client', 'teacher', 'front_desk', 'manager', 'owner', 'admin'];

// Role display names
const ROLE_LABELS = {
  client: 'Member',
  teacher: 'Teacher',
  front_desk: 'Front Desk',
  manager: 'Manager',
  owner: 'Owner',
  admin: 'Administrator',
};

const AuthContext = createContext(null);

// ============================================
// API HELPER WITH AUTH
// ============================================

export async function api(endpoint, options = {}) {
  const token = localStorage.getItem('auth_token');
  const res = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
      ...options.headers,
    },
  });

  // Handle 401 - clear token and redirect
  if (res.status === 401) {
    localStorage.removeItem('auth_token');
    if (window.location.pathname !== '/') {
      window.location.href = '/';
    }
    throw new Error('Session expired');
  }

  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

// ============================================
// AUTH PROVIDER
// ============================================

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  // Load user on mount
  useEffect(() => {
    loadUser();
  }, []);

  const loadUser = async () => {
    const token = localStorage.getItem('auth_token');
    if (!token) {
      setLoading(false);
      return;
    }

    try {
      const data = await api('/auth/me');
      setUser(data.user);
    } catch (err) {
      console.error('Auth error:', err);
      localStorage.removeItem('auth_token');
    } finally {
      setLoading(false);
    }
  };

  const login = async (email, password) => {
    const data = await api('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    localStorage.setItem('auth_token', data.token);
    setUser(data.user);
    return data.user;
  };

  const register = async (userData) => {
    const data = await api('/auth/register', {
      method: 'POST',
      body: JSON.stringify(userData),
    });
    localStorage.setItem('auth_token', data.token);
    setUser(data.user);
    return data.user;
  };

  const logout = () => {
    localStorage.removeItem('auth_token');
    // Also clear legacy tokens
    localStorage.removeItem('staff_token');
    localStorage.removeItem('user_token');
    setUser(null);
  };

  // Role checking helpers
  const hasRole = (roles) => {
    if (!user) return false;
    const roleList = Array.isArray(roles) ? roles : [roles];
    return roleList.includes(user.role);
  };

  const hasMinRole = (minRole) => {
    if (!user) return false;
    const userIndex = ROLE_HIERARCHY.indexOf(user.role);
    const minIndex = ROLE_HIERARCHY.indexOf(minRole);
    return userIndex >= minIndex;
  };

  const isStaff = user && ['front_desk', 'teacher', 'manager', 'owner', 'admin'].includes(user.role);
  const isManager = user && ['manager', 'owner', 'admin'].includes(user.role);
  const isOwner = user && ['owner', 'admin'].includes(user.role);
  const isTeacher = user && ['teacher', 'manager', 'owner', 'admin'].includes(user.role);

  const value = {
    user,
    loading,
    login,
    register,
    logout,
    hasRole,
    hasMinRole,
    isStaff,
    isManager,
    isOwner,
    isTeacher,
    isAuthenticated: !!user,
    roleLabel: user ? ROLE_LABELS[user.role] || user.role : null,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

// ============================================
// ROLE CONSTANTS EXPORT
// ============================================

export { ROLE_HIERARCHY, ROLE_LABELS };
