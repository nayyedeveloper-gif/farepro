import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import NetInfo from '@react-native-community/netinfo';
import { getNetworkErrorMessage } from '../utils/networkError';

export type BannerType = 'error' | 'warning' | 'success' | 'info';

export interface BannerState {
  id: number;
  type: BannerType;
  message: string;
}

interface UiContextValue {
  banner: BannerState | null;
  showBanner: (message: string, type?: BannerType, durationMs?: number) => void;
  showError: (err: unknown, fallback?: string) => void;
  hideBanner: () => void;
  isOffline: boolean;
}

const UiContext = createContext<UiContextValue | undefined>(undefined);

const OFFLINE_MSG = 'You’re offline. Some features may not work.';

export function UiProvider({ children }: { children: React.ReactNode }) {
  const [banner, setBanner] = useState<BannerState | null>(null);
  const [isOffline, setIsOffline] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const idRef = useRef(0);
  const offlineBannerRef = useRef(false);

  const hideBanner = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setBanner(null);
    offlineBannerRef.current = false;
  }, []);

  const showBanner = useCallback((message: string, type: BannerType = 'info', durationMs = 5000) => {
    if (timerRef.current) clearTimeout(timerRef.current);
    idRef.current += 1;
    setBanner({ id: idRef.current, type, message });
    if (durationMs > 0) {
      timerRef.current = setTimeout(() => setBanner(null), durationMs);
    }
  }, []);

  const showError = useCallback((err: unknown, fallback?: string) => {
    const msg = getNetworkErrorMessage(err);
    showBanner(msg || fallback || 'Something went wrong. Please try again.', 'error', 6000);
  }, [showBanner]);

  useEffect(() => {
    let mounted = true;

    NetInfo.fetch()
      .then((state) => {
        if (mounted) setIsOffline(!state.isConnected);
      })
      .catch(() => {
        // NetInfo unavailable (e.g. some dev builds)
      });

    const unsubscribe = NetInfo.addEventListener((s) => {
      const offline = !s.isConnected;
      setIsOffline(offline);

      if (offline) {
        offlineBannerRef.current = true;
        showBanner(OFFLINE_MSG, 'warning', 0);
      } else if (offlineBannerRef.current) {
        offlineBannerRef.current = false;
        setBanner((current) => (current?.message === OFFLINE_MSG ? null : current));
      }
    });

    return () => {
      mounted = false;
      unsubscribe();
    };
  }, [showBanner]);

  return (
    <UiContext.Provider value={{ banner, showBanner, showError, hideBanner, isOffline }}>
      {children}
    </UiContext.Provider>
  );
}

export function useUi() {
  const ctx = useContext(UiContext);
  if (!ctx) throw new Error('useUi must be used within UiProvider');
  return ctx;
}
