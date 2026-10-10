import React, { createContext, useContext, useState, useEffect } from 'react';
import type { User, AuthResponse } from '../types';
import { authAPI } from '../services/api';
import { clearOrgContext, saveOrgContext, syncOrgContext } from '../utils/orgStorage';

interface AuthContextType {
  user: User | null;
  token: string | null;
  orgRole: string | null;
  login: (phone: string, password: string) => Promise<{ role?: string }>;
  setAuth: (token: string, user: User) => void;
  register: (data: any) => Promise<void>;
  logout: () => void;
  updateUser: (user: User) => void;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

function applyLoginOrgData(data: AuthResponse & { organization?: any; role?: string }) {
  if (data.organization && data.role) {
    saveOrgContext(data.organization, data.role, data.token);
    return data.role;
  }
  return undefined;
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [orgRole, setOrgRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const init = async () => {
      const storedToken = localStorage.getItem('token');
      const storedUser = localStorage.getItem('user');

      if (storedToken && storedUser) {
        setToken(storedToken);
        setUser(JSON.parse(storedUser));
        const ctx = await syncOrgContext();
        if (ctx.hasOrg && ctx.role) {
          setOrgRole(ctx.role);
        } else {
          setOrgRole(localStorage.getItem('orgRole'));
        }
      }
      setLoading(false);
    };
    init();
  }, []);

  useEffect(() => {
    const handleAuthError = (event: Event) => {
      const customEvent = event as CustomEvent;
      if (customEvent.detail === 401 || customEvent.detail === 'suspended') {
        if (customEvent.detail === 'suspended') {
          sessionStorage.setItem('authNotice', 'This account has been suspended. Contact FarePro support.');
        }
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        clearOrgContext();
        setToken(null);
        setUser(null);
        setOrgRole(null);
      }
    };

    window.addEventListener('auth-error', handleAuthError);
    return () => window.removeEventListener('auth-error', handleAuthError);
  }, []);

  const setAuth = (authToken: string, authUser: User) => {
    localStorage.setItem('token', authToken);
    localStorage.setItem('user', JSON.stringify(authUser));
    setToken(authToken);
    setUser(authUser);
  };

  const login = async (phone: string, password: string) => {
    const response = await authAPI.login({ phone, password });
    const data = response.data as AuthResponse & { organization?: any; role?: string };
    setAuth(data.token, data.user);
    const role = applyLoginOrgData(data);
    setOrgRole(role || null);
    return { role };
  };

  const register = async (data: any) => {
    const response = await authAPI.register(data);
    const authData: AuthResponse = response.data;
    localStorage.setItem('token', authData.token);
    localStorage.setItem('user', JSON.stringify(authData.user));
    setToken(authData.token);
    setUser(authData.user);
    setOrgRole(null);
  };

  const updateUser = (updatedUser: User) => {
    localStorage.setItem('user', JSON.stringify(updatedUser));
    setUser(updatedUser);
  };

  const logout = async () => {
    try {
      await authAPI.logout();
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      clearOrgContext();
      setToken(null);
      setUser(null);
      setOrgRole(null);
    }
  };

  return (
    <AuthContext.Provider value={{ user, token, orgRole, login, setAuth, register, logout, updateUser, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
