import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import {
  useAudioRecorder,
  createAudioPlayer,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
} from 'expo-audio';
import { cacheDirectory, writeAsStringAsync, EncodingType } from 'expo-file-system/legacy';
import { PTT_RECORDING_OPTIONS, readRecordingAsBase64, resolveRecordingUri } from '../utils/pttRecording';
import { pttService } from '../services/pttService';
import { wsClient } from '../utils/websocket';
import { useAuth } from './AuthContext';
import type { PTTChannel, PTTMember, PTTTransmitState } from '../types/ptt';
import { storage } from '../utils/storage';
import type { ApiError } from '../utils/apiClient';

const LAST_CHANNEL_KEY = 'ptt_last_channel_id';

interface PTTContextType {
  channels: PTTChannel[];
  currentChannel: PTTChannel | null;
  members: PTTMember[];
  transmit: PTTTransmitState;
  isLoading: boolean;
  error: string | null;
  selectChannel: (channel: PTTChannel | null) => void;
  refreshChannels: () => Promise<void>;
  refreshMembers: () => Promise<void>;
  startTransmit: () => Promise<void>;
  stopTransmit: () => Promise<void>;
  joinChannel: (id: string) => Promise<void>;
  leaveChannel: (id: string) => Promise<void>;
  createChannel: (name: string, description: string) => Promise<void>;
  updateChannel: (id: string, data: { name?: string; description?: string; avatarUrl?: string; isPrivate?: boolean }) => Promise<void>;
  deleteChannel: (id: string) => Promise<void>;
  updateStatus: (status: string) => Promise<void>;
  sendEmergency: (channelId: string) => Promise<void>;
  clearError: () => void;
}

const PTTContext = createContext<PTTContextType | undefined>(undefined);

export const PTTProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, isLoading: authLoading } = useAuth();
  const [channels, setChannels] = useState<PTTChannel[]>([]);
  const [currentChannel, setCurrentChannel] = useState<PTTChannel | null>(null);
  const [members, setMembers] = useState<PTTMember[]>([]);
  const [transmit, setTransmit] = useState<PTTTransmitState>({
    isTransmitting: false,
    activeSpeakerId: null,
    activeSpeakerName: null,
    channelId: null,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const wsUnsubs = useRef<(() => void)[]>([]);
  const currentChannelRef = useRef<PTTChannel | null>(null);
  const isTransmittingRef = useRef(false);
  const audioChunksRef = useRef<{ channelId: string; chunks: string[] } | null>(null);
  const activePlayersRef = useRef<any[]>([]);

  // Audio recorder hook (must be called at top level)
  const recorder = useAudioRecorder(PTT_RECORDING_OPTIONS);

  useEffect(() => {
    currentChannelRef.current = currentChannel;
  }, [currentChannel]);

  useEffect(() => {
    isTransmittingRef.current = transmit.isTransmitting;
  }, [transmit.isTransmitting]);

  const refreshChannels = useCallback(async () => {
    if (!user) return;
    try {
      setIsLoading(true);
      setError(null);
      const myChannels = await pttService.getMyChannels();
      setChannels(myChannels);
    } catch (err: unknown) {
      const e = err as ApiError;
      setError(e.friendlyMessage || e.message || 'Failed to load channels');
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  const refreshMembers = useCallback(async () => {
    if (!currentChannel) return;
    try {
      const data = await pttService.getMembersWithRoles(currentChannel.id);
      setMembers(data);
    } catch (err: any) {
      try {
        const basic = await pttService.getMembers(currentChannel.id);
        setMembers(basic);
      } catch (e2) {
        setMembers([]);
      }
    }
  }, [currentChannel]);

  // Load channels only after auth is ready
  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setChannels([]);
      setCurrentChannel(null);
      setError(null);
      return;
    }
    refreshChannels();
  }, [user, authLoading, refreshChannels]);

  // Load members when channel changes
  useEffect(() => {
    if (currentChannel) {
      refreshMembers();
    } else {
      setMembers([]);
    }
  }, [currentChannel, refreshMembers]);

  // WebSocket subscriptions for PTT events
  useEffect(() => {
    const unsubs: (() => void)[] = [];

    unsubs.push(
      wsClient.subscribe('ptt.start', (data: any) => {
        if (currentChannelRef.current?.id !== data.channelId) return;
        console.log('[PTT] start received from:', data.userName);
        setTransmit({
          isTransmitting: false,
          activeSpeakerId: data.userId,
          activeSpeakerName: data.userName || 'Someone',
          channelId: data.channelId,
        });
        audioChunksRef.current = { channelId: data.channelId, chunks: [] };
      })
    );

    unsubs.push(
      wsClient.subscribe('ptt.stop', (data: any) => {
        if (currentChannelRef.current?.id !== data.channelId) return;
        console.log('[PTT] stop received, chunks:', audioChunksRef.current?.chunks?.length || 0);
        // Play accumulated PCM chunks if any
        if (audioChunksRef.current && audioChunksRef.current.chunks.length > 0) {
          playPcmChunks(audioChunksRef.current.chunks);
          audioChunksRef.current = null;
        }
        setTransmit({ isTransmitting: false, activeSpeakerId: null, activeSpeakerName: null, channelId: null });
      })
    );

    unsubs.push(
      wsClient.subscribe('ptt.audio', async (data: any) => {
        if (currentChannelRef.current?.id !== data.channelId) return;
        if (!data.audio) return;
        console.log('[PTT] Received audio:', { format: data.format, audioLen: data.audio?.length });
        if (data.format === 'file') {
          await playFileBase64(data.audio);
        } else {
          // PCM Int16 at 16kHz — accumulate and play on stop
          if (audioChunksRef.current) {
            audioChunksRef.current.chunks.push(data.audio);
          }
        }
      })
    );

    unsubs.push(
      wsClient.subscribe('ptt.denied', (data: any) => {
        if (currentChannelRef.current?.id !== data.channelId) return;
        setTransmit((prev) => ({ ...prev, isTransmitting: false }));
        isTransmittingRef.current = false;
        setError(data.reason || 'Channel is busy');
        setTimeout(() => setError(null), 3000);
      })
    );

    unsubs.push(
      wsClient.subscribe('ptt.channel_updated', (data: any) => {
        setChannels((prev) => prev.map((ch) => (ch.id === data.channelId ? { ...ch, name: data.name ?? ch.name, description: data.description ?? ch.description, isPrivate: data.isPrivate ?? ch.isPrivate } : ch)));
        setCurrentChannel((prev) => (prev && prev.id === data.channelId ? { ...prev, name: data.name ?? prev.name, description: data.description ?? prev.description, isPrivate: data.isPrivate ?? prev.isPrivate } : prev));
      })
    );

    unsubs.push(
      wsClient.subscribe('ptt.channel_deleted', (data: any) => {
        setChannels((prev) => prev.filter((ch) => ch.id !== data.channelId));
        setCurrentChannel((prev) => (prev?.id === data.channelId ? null : prev));
      })
    );

    unsubs.push(
      wsClient.subscribe('ptt.member_joined', (data: any) => {
        if (data.channelId === currentChannelRef.current?.id) {
          refreshMembers();
        }
      })
    );

    unsubs.push(
      wsClient.subscribe('ptt.member_left', (data: any) => {
        if (data.channelId === currentChannelRef.current?.id) {
          refreshMembers();
        }
      })
    );

    unsubs.push(
      wsClient.subscribe('ptt.status', (data: any) => {
        setMembers((prev) => prev.map((m) => (m.id === data.userId ? { ...m, status: data.status } : m)));
      })
    );

    unsubs.push(
      wsClient.subscribe('ptt.emergency', (data: any) => {
        setError(`EMERGENCY: ${data.userName || 'Unknown'} - ${data.message || 'EMERGENCY'}`);
      })
    );

    unsubs.push(
      wsClient.subscribe('ptt.kicked', (data: any) => {
        if (currentChannelRef.current?.id === data.channelId) {
          setCurrentChannel(null);
          currentChannelRef.current = null;
          setMembers([]);
          setError('You were removed from this channel');
        }
        setChannels((prev) => prev.filter((c) => c.id !== data.channelId));
      })
    );

    unsubs.push(
      wsClient.subscribe('presence.update', (data: any) => {
        if (data.userId && data.isOnline !== undefined) {
          setMembers((prev) => prev.map((m) =>
            m.id === data.userId ? { ...m, isOnline: data.isOnline } : m
          ));
        }
      })
    );

    wsUnsubs.current = unsubs;
    return () => {
      unsubs.forEach((u) => u());
    };
  }, [refreshMembers]);

  const selectChannel = useCallback((channel: PTTChannel | null) => {
    setCurrentChannel(channel);
    currentChannelRef.current = channel;
    setTransmit({ isTransmitting: false, activeSpeakerId: null, activeSpeakerName: null, channelId: null });
    if (channel?.id) {
      storage.setItem(LAST_CHANNEL_KEY, channel.id).catch(() => {});
    }
  }, []);

  // Auto-open last or first channel so PTT tab lands on talk screen
  useEffect(() => {
    if (currentChannel || channels.length === 0 || isLoading) return;
    let cancelled = false;
    (async () => {
      const lastId = await storage.getItem(LAST_CHANNEL_KEY);
      const pick = channels.find((c) => c.id === lastId) ?? channels[0];
      if (!cancelled && pick) selectChannel(pick);
    })();
    return () => { cancelled = true; };
  }, [channels, currentChannel, isLoading, selectChannel]);

  const startTransmit = async () => {
    if (!currentChannel || isTransmittingRef.current) return;
    setError(null);
    try {
      const { granted } = await requestRecordingPermissionsAsync();
      if (!granted) {
        setError('Microphone permission denied');
        return;
      }
      await setAudioModeAsync({
        allowsRecording: true,
        playsInSilentMode: true,
        shouldPlayInBackground: false,
      });
      await recorder.prepareToRecordAsync(PTT_RECORDING_OPTIONS);
      recorder.record();

      wsClient.send('ptt.start', {
        channelId: currentChannel.id,
        userName: user?.firstName || user?.username || 'Unknown',
      });

      isTransmittingRef.current = true;
      setTransmit({
        isTransmitting: true,
        activeSpeakerId: null,
        activeSpeakerName: null,
        channelId: currentChannel.id,
      });
    } catch (err: any) {
      setError('Failed to start recording: ' + (err.message || ''));
    }
  };

  const stopTransmit = async () => {
    if (!currentChannel || !isTransmittingRef.current) return;
    isTransmittingRef.current = false;
    const channelId = currentChannel.id;
    try {
      await recorder.stop();
      const uri = await resolveRecordingUri(() => recorder.uri);
      if (uri) {
        const base64 = await readRecordingAsBase64(uri);
        if (base64.length > 0) {
          wsClient.send('ptt.audio', {
            channelId,
            audio: base64,
            format: 'file',
          });
        }
      }
    } catch (err: unknown) {
      const e = err as ApiError;
      console.error('[PTT] stopTransmit error:', err);
      setError(e.friendlyMessage || (err instanceof Error ? err.message : 'Failed to send voice'));
    }
    wsClient.send('ptt.stop', { channelId });
    setTransmit({ isTransmitting: false, activeSpeakerId: null, activeSpeakerName: null, channelId: null });
    try {
      await setAudioModeAsync({
        allowsRecording: false,
        playsInSilentMode: true,
        shouldPlayInBackground: false,
      });
    } catch {
      // ignore
    }
  };

  const joinChannel = async (id: string) => {
    try {
      await pttService.joinChannel(id);
      await refreshChannels();
    } catch (err: any) {
      setError(err.message || 'Failed to join channel');
    }
  };

  const leaveChannel = async (id: string) => {
    try {
      await pttService.leaveChannel(id);
      if (currentChannel?.id === id) {
        setCurrentChannel(null);
      }
      await refreshChannels();
    } catch (err: any) {
      setError(err.message || 'Failed to leave channel');
    }
  };

  const createChannel = async (name: string, description: string) => {
    try {
      const created = await pttService.createChannel(name, description);
      await refreshChannels();
      if (created?.id) selectChannel(created);
    } catch (err: unknown) {
      const e = err as ApiError;
      const msg = e.friendlyMessage || e.message || 'Failed to create channel';
      setError(msg);
      throw new Error(msg);
    }
  };

  const updateChannel = async (id: string, data: { name?: string; description?: string; avatarUrl?: string; isPrivate?: boolean }) => {
    try {
      const updated = await pttService.updateChannel(id, data);
      setChannels((prev) => prev.map((ch) => (ch.id === id ? updated : ch)));
      setCurrentChannel((prev) => (prev?.id === id ? updated : prev));
    } catch (err: any) {
      setError(err.message || 'Failed to update channel');
    }
  };

  const deleteChannel = async (id: string) => {
    try {
      await pttService.deleteChannel(id);
      setChannels((prev) => prev.filter((ch) => ch.id !== id));
      if (currentChannel?.id === id) {
        setCurrentChannel(null);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to delete channel');
    }
  };

  const updateStatus = async (status: string) => {
    try {
      await pttService.updateStatus(status);
    } catch (err: any) {
      // silent fail
    }
  };

  const sendEmergency = async (channelId: string) => {
    try {
      await pttService.sendEmergency(channelId);
    } catch (err: any) {
      setError(err.message || 'Failed to send emergency alert');
    }
  };

  const clearError = () => setError(null);

  // Play file-based base64 audio (from mobile sender)
  const playFileBase64 = async (base64: string) => {
    try {
      // Ensure audio mode is set for playback
      await setAudioModeAsync({
        allowsRecording: false,
        playsInSilentMode: true,
        shouldPlayInBackground: false,
      });
      const tmpPath = `${cacheDirectory}ptt_play_${Date.now()}.m4a`;
      await writeAsStringAsync(tmpPath, base64, { encoding: EncodingType.Base64 });
      const player = createAudioPlayer({ uri: tmpPath });
      activePlayersRef.current.push(player);
      player.play();
      setTimeout(() => {
        try { player.release(); } catch {}
        activePlayersRef.current = activePlayersRef.current.filter((p) => p !== player);
      }, 30000);
    } catch (err) {
      console.error('[PTT] playFileBase64 error:', err);
    }
  };

  // Play accumulated PCM Int16 16kHz chunks (from web sender) — convert to WAV
  const playPcmChunks = async (chunks: string[]) => {
    try {
      // Ensure audio mode is set for playback
      await setAudioModeAsync({
        allowsRecording: false,
        playsInSilentMode: true,
        shouldPlayInBackground: false,
      });
      const sampleRate = 16000;
      // Decode all base64 chunks to binary and concatenate
      const allBytes: Uint8Array[] = chunks.map(c => base64ToUint8Array(c));
      const totalLen = allBytes.reduce((acc, b) => acc + b.length, 0);
      const header = makeWavHeader(sampleRate, 1, 16, totalLen);
      const headerBytes = new Uint8Array(header);
      const wavBytes = new Uint8Array(headerBytes.length + totalLen);
      wavBytes.set(headerBytes, 0);
      let offset = headerBytes.length;
      for (const b of allBytes) {
        wavBytes.set(b, offset);
        offset += b.length;
      }
      const wavBase64 = uint8ArrayToBase64(wavBytes);
      const tmpPath = `${cacheDirectory}ptt_pcm_${Date.now()}.wav`;
      await writeAsStringAsync(tmpPath, wavBase64, { encoding: EncodingType.Base64 });
      const player = createAudioPlayer({ uri: tmpPath });
      activePlayersRef.current.push(player);
      player.play();
      setTimeout(() => {
        try { player.release(); } catch {}
        activePlayersRef.current = activePlayersRef.current.filter((p) => p !== player);
      }, 30000);
    } catch (err) {
      console.error('[PTT] playPcmChunks error:', err);
    }
  };

  return (
    <PTTContext.Provider
      value={{
        channels,
        currentChannel,
        members,
        transmit,
        isLoading,
        error,
        selectChannel,
        refreshChannels,
        refreshMembers,
        startTransmit,
        stopTransmit,
        joinChannel,
        leaveChannel,
        createChannel,
        updateChannel,
        deleteChannel,
        updateStatus,
        sendEmergency,
        clearError,
      }}
    >
      {children}
    </PTTContext.Provider>
  );
};

export const usePTT = () => {
  const ctx = useContext(PTTContext);
  if (!ctx) throw new Error('usePTT must be used within PTTProvider');
  return ctx;
};

function makeWavHeader(sampleRate: number, numChannels: number, bitsPerSample: number, dataLen: number): ArrayBuffer {
  const bytesPerSample = bitsPerSample / 8;
  const blockAlign = numChannels * bytesPerSample;
  const byteRate = sampleRate * blockAlign;
  const totalDataLen = dataLen;
  const totalFileLen = 44 + totalDataLen;
  const buffer = new ArrayBuffer(44);
  const view = new DataView(buffer);
  let offset = 0;
  const writeString = (s: string) => {
    for (let i = 0; i < s.length; i++) view.setUint8(offset++, s.charCodeAt(i));
  };
  const writeUint32 = (v: number) => { view.setUint32(offset, v, true); offset += 4; };
  const writeUint16 = (v: number) => { view.setUint16(offset, v, true); offset += 2; };
  writeString('RIFF');
  writeUint32(totalFileLen);
  writeString('WAVE');
  writeString('fmt ');
  writeUint32(16);
  writeUint16(1);
  writeUint16(numChannels);
  writeUint32(sampleRate);
  writeUint32(byteRate);
  writeUint16(blockAlign);
  writeUint16(bitsPerSample);
  writeString('data');
  writeUint32(totalDataLen);
  return buffer;
}

function uint8ArrayToBase64(bytes: Uint8Array): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let result = '';
  for (let i = 0; i < bytes.length; i += 3) {
    const b1 = bytes[i];
    const b2 = i + 1 < bytes.length ? bytes[i + 1] : 0;
    const b3 = i + 2 < bytes.length ? bytes[i + 2] : 0;
    result += chars[b1 >> 2];
    result += chars[((b1 & 0x03) << 4) | (b2 >> 4)];
    result += i + 1 < bytes.length ? chars[((b2 & 0x0f) << 2) | (b3 >> 6)] : '=';
    result += i + 2 < bytes.length ? chars[b3 & 0x3f] : '=';
  }
  return result;
}

function base64ToUint8Array(base64: string): Uint8Array {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  const lookup = new Map<string, number>();
  for (let i = 0; i < chars.length; i++) lookup.set(chars[i], i);
  const cleanBase64 = base64.replace(/=+$/, '');
  const len = Math.floor(cleanBase64.length * 3 / 4);
  const bytes = new Uint8Array(len);
  let byteIdx = 0;
  for (let i = 0; i < cleanBase64.length; i += 4) {
    const c0 = lookup.get(cleanBase64[i]) || 0;
    const c1 = lookup.get(cleanBase64[i + 1]) || 0;
    const c2 = cleanBase64[i + 2] ? (lookup.get(cleanBase64[i + 2]) || 0) : 0;
    const c3 = cleanBase64[i + 3] ? (lookup.get(cleanBase64[i + 3]) || 0) : 0;
    bytes[byteIdx++] = (c0 << 2) | (c1 >> 4);
    if (byteIdx < len) bytes[byteIdx++] = ((c1 & 0x0f) << 4) | (c2 >> 2);
    if (byteIdx < len) bytes[byteIdx++] = ((c2 & 0x03) << 6) | c3;
  }
  return bytes;
}
