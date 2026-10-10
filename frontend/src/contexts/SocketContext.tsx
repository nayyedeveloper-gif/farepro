import React, { createContext, useContext, useEffect, useRef, useCallback } from 'react';
import type { ReactNode } from 'react';
import { useAuth } from './AuthContext';
import { appStateService } from '../services/AppStateService';
import { getDeviceMeta } from '../utils/deviceUtils';

type EventHandler = (data: unknown) => void;

interface SocketContextType {
  subscribe: (event: string, handler: EventHandler) => () => void;
  send: (type: string, data: unknown) => void;
  isConnected: boolean;
}

const SocketContext = createContext<SocketContextType | undefined>(undefined);

export const useSocket = () => {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error('useSocket must be used within a SocketProvider');
  }
  return context;
};

const WS_URL = import.meta.env.VITE_WS_URL || `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/ws`;

export const SocketProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const wsRef = useRef<WebSocket | null>(null);
  const handlersRef = useRef<Map<string, Set<EventHandler>>>(new Map());
  const reconnectTimer = useRef<number | null>(null);
  const reconnectAttempts = useRef(0);
  const isFirstConnection = useRef(true);
  const [isConnected, setIsConnected] = React.useState(false);
  const isConnectingRef = useRef(false);

  const subscribe = useCallback((event: string, handler: EventHandler) => {
    if (!handlersRef.current.has(event)) {
      handlersRef.current.set(event, new Set());
    }
    handlersRef.current.get(event)!.add(handler);
    return () => {
      handlersRef.current.get(event)?.delete(handler);
    };
  }, []);

  const send = useCallback((type: string, data: unknown) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type, data }));
    }
  }, []);

  const connect = useCallback(() => {
    const token = localStorage.getItem('token');
    if (!token || !user) return;

    // Prevent multiple simultaneous connection attempts
    if (isConnectingRef.current) return;
    isConnectingRef.current = true;

    if (wsRef.current) {
      wsRef.current.close();
    }

    const { deviceId, deviceName, platform, app } = getDeviceMeta();
    const params = new URLSearchParams({
      token,
      deviceId,
      deviceName,
      platform,
      app,
    });
    const ws = new WebSocket(`${WS_URL}?${params.toString()}`);
    wsRef.current = ws;

    ws.onopen = () => {
      setIsConnected(true);
      isConnectingRef.current = false;
      // Auto reload only on reconnection (not first connection)
      if (!isFirstConnection.current) {
        window.location.reload();
      }
      isFirstConnection.current = false;
      reconnectAttempts.current = 0;
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        console.log('[WS] received:', msg.type, msg.data);
        const eventHandlers = handlersRef.current.get(msg.type);
        if (eventHandlers) {
          eventHandlers.forEach((h) => h(msg.data));
        }
      } catch {
        // ignore malformed messages
      }
    };

    ws.onclose = () => {
      setIsConnected(false);
      isConnectingRef.current = false;
      reconnectAttempts.current += 1;
      const backoffDelay = Math.min(1000 * Math.pow(2, reconnectAttempts.current), 30000);
      reconnectTimer.current = window.setTimeout(() => {
        connect();
      }, backoffDelay);
    };

    ws.onerror = (error) => {
      console.error('[WS] error:', error);
      isConnectingRef.current = false;
    };
  }, [user]);

  useEffect(() => {
    connect();
    return () => {
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      wsRef.current?.close();
    };
  }, [connect]);

  // Handle background/foreground state
  useEffect(() => {
    const unsubscribe = appStateService.subscribe((isForeground) => {
      if (isForeground) {
        // App came to foreground, reconnect socket
        if (!isConnected) {
          connect();
        }
      } else {
        // App went to background, disconnect socket to save resources
        if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
        wsRef.current?.close();
      }
    });

    return () => unsubscribe();
  }, [connect, isConnected]);

  return (
    <SocketContext.Provider value={{ subscribe, send, isConnected }}>
      {children}
    </SocketContext.Provider>
  );
};
