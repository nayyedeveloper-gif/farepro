import React, { createContext, useContext, useState, useEffect } from 'react';
import { storage } from '../utils/storage';
import { authService } from '../services/authService';
import { orgService } from '../services/orgService';
import { isDriverApp } from '../config/appVariant';
import { setOnUnauthorized } from '../utils/apiClient';
import { wsClient } from '../utils/websocket';
import { requestNotificationPermissions, scheduleCallNotification, scheduleMessageNotification } from '../utils/notifications';
import { setupCallNotificationChannels, scheduleIncomingCallNotification, setupNotificationResponseHandler } from '../utils/callService';
import { useRouter } from 'expo-router';
import type { User, AuthResponse } from '../types';

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  login: (phone: string, password: string) => Promise<void>;
  register: (phone: string, password: string, username: string, firstName?: string) => Promise<void>;
  setSession: (token: string, user: User) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadAuthData();
  }, []);

  useEffect(() => {
    setOnUnauthorized(() => {
      setToken(null);
      setUser(null);
      storage.removeItem('user').catch(() => {});
      wsClient.disconnect();
      router.replace(isDriverApp ? '/org-login' : '/login');
    });
    return () => setOnUnauthorized(null);
  }, [router]);

  const loadAuthData = async () => {
    try {
      const storedToken = await storage.getItem('token');
      const storedUser = await storage.getItem('user');

      if (storedToken && storedUser) {
        setToken(storedToken);
        setUser(JSON.parse(storedUser));
        try {
          if (isDriverApp) {
            const ctx = await orgService.getContext();
            if (!ctx.data?.hasOrg) throw new Error('no org');
            if (ctx.data.token) {
              setToken(ctx.data.token);
              await storage.setItem('token', ctx.data.token);
            }
          } else {
            const profile = await authService.getProfile();
            setUser(profile);
            await storage.setItem('user', JSON.stringify(profile));
          }
        } catch {
          await storage.removeItem('token');
          await storage.removeItem('user');
          setToken(null);
          setUser(null);
          setIsLoading(false);
          return;
        }
        wsClient.connect();
        await requestNotificationPermissions();
        await setupCallNotificationChannels();
        setupNotificationListeners();
        setupCallNotificationHandler();
      }
    } catch (error) {
      console.error('Failed to load auth data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const setupNotificationListeners = () => {
    // Incoming call notification
    wsClient.subscribe('call.incoming', (data: any) => {
      const callerName = data.initiator?.firstName || data.initiator?.username || 'Unknown';
      scheduleCallNotification({
        callerName,
        callType: data.callType || 'audio',
        conversationId: data.conversationId,
      });
    });

    // New message notification (only when app is in background/foreground)
    wsClient.subscribe('message.new', (data: any) => {
      const senderName = data.sender?.firstName || data.sender?.username || 'Unknown';
      const message = data.content || 'Sent a message';
      scheduleMessageNotification({
        senderName,
        message,
        conversationId: data.conversationId,
      });
    });
  };

  const setupCallNotificationHandler = () => {
    // Handle notification tap to navigate to call/chat
    const subscription = setupNotificationResponseHandler((data: any) => {
      if (data?.type === 'incoming_call' && data?.conversationId) {
        // Navigate to chat with call info
        router.push(`/chat?conversationId=${data.conversationId}`);
      } else if (data?.type === 'message' && data?.conversationId) {
        // Navigate to chat
        router.push(`/chat?conversationId=${data.conversationId}`);
      }
    });

    return () => subscription.remove();
  };

  const login = async (phone: string, password: string) => {
    try {
      const response: AuthResponse = await authService.login(phone, password);
      setToken(response.token);
      setUser(response.user);

      await storage.setItem('token', response.token);
      await storage.setItem('user', JSON.stringify(response.user));
      wsClient.connect();
      await requestNotificationPermissions();
      await setupCallNotificationChannels();
      setupNotificationListeners();
      setupCallNotificationHandler();
    } catch (error) {
      console.error('Login failed:', error);
      throw error;
    }
  };

  const register = async (phone: string, password: string, username: string, firstName?: string) => {
    try {
      const response: AuthResponse = await authService.register(phone, password, username, firstName);
      setToken(response.token);
      setUser(response.user);

      await storage.setItem('token', response.token);
      await storage.setItem('user', JSON.stringify(response.user));
      wsClient.connect();
      await requestNotificationPermissions();
      await setupCallNotificationChannels();
      setupNotificationListeners();
      setupCallNotificationHandler();
    } catch (error) {
      console.error('Registration failed:', error);
      throw error;
    }
  };

  const setSession = async (sessionToken: string, sessionUser: User) => {
    setToken(sessionToken);
    setUser(sessionUser);
    await storage.setItem('token', sessionToken);
    await storage.setItem('user', JSON.stringify(sessionUser));
    wsClient.connect();
    await requestNotificationPermissions();
    await setupCallNotificationChannels();
    setupNotificationListeners();
    setupCallNotificationHandler();
  };

  const logout = async () => {
    try {
      await authService.logout();
    } catch (error) {
      console.error('Logout failed:', error);
    } finally {
      setToken(null);
      setUser(null);
      await storage.removeItem('token');
      await storage.removeItem('user');
      wsClient.disconnect();
    }
  };

  return (
    <AuthContext.Provider value={{ user, token, isLoading, login, register, setSession, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};
