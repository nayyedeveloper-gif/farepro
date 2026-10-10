import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { ReactNode } from 'react';
import { useSocket } from './SocketContext';
import { notificationAPI } from '../services/api';
import { soundService } from '../services/SoundService';
import { useAuth } from './AuthContext';
import { registerServiceWorker, subscribeToPush, isPushSupported } from '../services/pushService';
import type { AppNotification } from '../types';

interface NotificationContextType {
  notifications: AppNotification[];
  unreadCount: number;
  sessionCount: number;
  requestPushPermission: () => Promise<boolean>;
  markAllRead: () => Promise<void>;
  refreshNotifications: () => Promise<void>;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const useNotifications = () => {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error('useNotifications must be used within NotificationProvider');
  return ctx;
};

const showBrowserNotification = (title: string, body: string, onClick?: () => void) => {
  if (typeof window === 'undefined' || !('Notification' in window)) return;
  if (Notification.permission !== 'granted') return;
  try {
    const n = new Notification(title, { body, icon: '/favicon.svg', tag: title });
    if (onClick) {
      n.onclick = () => {
        onClick();
        window.focus();
        n.close();
      };
    }
  } catch {
    // ignore
  }
};

const notificationClickPath = (type: string): string | undefined => {
  if (type === 'trip.assigned') return '/app';
  if (type === 'geofence.alert') return '/dispatch';
  return undefined;
};

export const NotificationProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { user, token, loading: authLoading } = useAuth();
  const { subscribe } = useSocket();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [sessionCount, setSessionCount] = useState(1);

  const refreshNotifications = useCallback(async () => {
    try {
      const res = await notificationAPI.getAll();
      setNotifications(res.data.notifications || []);
      setUnreadCount(res.data.unreadCount || 0);
    } catch {
      // ignore
    }
  }, []);

  const markAllRead = useCallback(async () => {
    await notificationAPI.markAllRead();
    setUnreadCount(0);
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
  }, []);

  const requestPushPermission = useCallback(async () => {
    if (!isPushSupported()) return false;
    if (Notification.permission === 'denied') return false;
    let granted = Notification.permission === 'granted';
    if (!granted) {
      const result = await Notification.requestPermission();
      granted = result === 'granted';
    }
    if (granted) {
      await registerServiceWorker();
      await subscribeToPush();
    }
    return granted;
  }, []);

  useEffect(() => {
    if (authLoading || !user || !token) return;

    refreshNotifications();
    if (isPushSupported() && Notification.permission === 'granted') {
      registerServiceWorker().then(() => subscribeToPush());
    }
  }, [authLoading, user, token, refreshNotifications]);

  useEffect(() => {
    const unsubNotif = subscribe('notification.new', (data) => {
      const n = data as AppNotification;
      setNotifications((prev) => [n, ...prev].slice(0, 50));
      setUnreadCount((c) => c + 1);
      soundService.playNotification();
      const path = notificationClickPath(n.type);
      showBrowserNotification(n.title, n.body || '', path ? () => { window.location.href = path; } : undefined);
    });

    const unsubSession = subscribe('session.update', (data) => {
      const d = data as { sessionCount: number };
      setSessionCount(d.sessionCount || 1);
    });

    const unsubCall = subscribe('call.incoming', (data) => {
      const d = data as { initiator?: { firstName?: string; username?: string }; call?: { callType?: string } };
      const name = d.initiator?.firstName || d.initiator?.username || 'Someone';
      const type = d.call?.callType === 'video' ? 'video' : 'voice';
      soundService.startRingtone();
      showBrowserNotification('Incoming call', `${name} is calling you (${type})`);
    });

    const unsubCallEnded = subscribe('call.ended', () => soundService.stopRingtone());
    const unsubCallRejected = subscribe('call.rejected', () => soundService.stopRingtone());
    const unsubCallAccepted = subscribe('call.accepted', () => soundService.stopRingtone());

    const unsubMissed = subscribe('call.missed', (data) => {
      const d = data as { result?: string };
      soundService.stopRingtone();
      showBrowserNotification('Missed call', 'You have a missed call');
      void d;
      refreshNotifications();
    });

    return () => {
      unsubNotif();
      unsubSession();
      unsubCall();
      unsubMissed();
      unsubCallEnded();
      unsubCallRejected();
      unsubCallAccepted();
    };
  }, [subscribe, refreshNotifications]);

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unreadCount,
        sessionCount,
        requestPushPermission,
        markAllRead,
        refreshNotifications,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
};
