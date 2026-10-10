import React, { createContext, useContext, useCallback } from 'react';
import type { ReactNode } from 'react';
import { soundService } from '../services/SoundService';
import type { RingtoneId, NotificationSoundId } from '../services/SoundService';

interface SoundContextType {
  playNotification: () => void;
  playMessageSent: () => void;
  startRingtone: () => void;
  stopRingtone: () => void;
  previewRingtone: (id: RingtoneId, volume?: number) => void;
  previewNotificationSound: (id: NotificationSoundId, volume?: number) => void;
  getSettings: () => ReturnType<typeof soundService.getSettings>;
  updateSettings: (partial: Parameters<typeof soundService.updateSettings>[0]) => void;
}

const SoundContext = createContext<SoundContextType | undefined>(undefined);

export const useSound = () => {
  const ctx = useContext(SoundContext);
  if (!ctx) throw new Error('useSound must be used within SoundProvider');
  return ctx;
};

export const SoundProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const playNotification = useCallback(() => soundService.playNotification(), []);
  const playMessageSent = useCallback(() => soundService.playMessageSent(), []);
  const startRingtone = useCallback(() => soundService.startRingtone(), []);
  const stopRingtone = useCallback(() => soundService.stopRingtone(), []);
  const previewRingtone = useCallback((id: RingtoneId, volume?: number) => soundService.previewRingtone(id, volume), []);
  const previewNotificationSound = useCallback(
    (id: NotificationSoundId, volume?: number) => soundService.previewNotificationSound(id, volume),
    [],
  );
  const getSettings = useCallback(() => soundService.getSettings(), []);
  const updateSettings = useCallback(
    (partial: Parameters<typeof soundService.updateSettings>[0]) => soundService.updateSettings(partial),
    [],
  );

  return (
    <SoundContext.Provider
      value={{
        playNotification,
        playMessageSent,
        startRingtone,
        stopRingtone,
        previewRingtone,
        previewNotificationSound,
        getSettings,
        updateSettings,
      }}
    >
      {children}
    </SoundContext.Provider>
  );
};
