import React, { createContext, useContext, useState, useRef, useCallback, useEffect } from 'react';
import type { ReactNode } from 'react';
import { useSocket } from './SocketContext';
import { useAuth } from './AuthContext';
import api, { fileAPI } from '../services/api';
import { estimateDurationMs, int16ChunksToWav } from '../utils/pttAudio';

export interface PTTChannel {
  id: string;
  name: string;
  description: string;
  avatarUrl: string;
  isPrivate: boolean;
  createdBy: string;
  memberCount: number;
}

export type UserStatus = 'available' | 'busy' | 'dnd';

export interface PTTMember {
  id: string;
  username: string;
  firstName: string;
  lastName: string;
  isOnline: boolean;
  status: UserStatus;
}

export interface EmergencyAlert {
  alertId: string;
  channelId: string;
  userId: string;
  userName: string;
  message: string;
  createdAt: string;
}

export interface BroadcastAlert {
  message: string;
  senderName: string;
  senderId: string;
  channelId?: string;
}

interface PTTContextType {
  channels: PTTChannel[];
  myChannels: PTTChannel[];
  currentChannel: PTTChannel | null;
  members: PTTMember[];
  activeSpeakerId: string | null;
  activeSpeakerName: string | null;
  isTransmitting: boolean;
  isFloorDenied: boolean;
  pttError: string | null;
  myStatus: UserStatus;
  emergencyAlert: EmergencyAlert | null;
  broadcastAlert: BroadcastAlert | null;
  scanMode: boolean;
  networkQuality: number;
  loadChannels: () => Promise<void>;
  loadMyChannels: () => Promise<void>;
  createChannel: (name: string, description: string) => Promise<void>;
  joinChannel: (channelId: string) => Promise<void>;
  leaveChannel: (channelId: string) => Promise<void>;
  selectChannel: (channel: PTTChannel) => Promise<void>;
  startTransmit: () => void;
  stopTransmit: () => void;
  playAudioChunk: (base64Audio: string) => void;
  setMyStatus: (status: UserStatus) => Promise<void>;
  sendEmergency: () => Promise<void>;
  dismissEmergency: () => void;
  dismissBroadcast: () => void;
  toggleScanMode: () => void;
}

const PTTContext = createContext<PTTContextType | undefined>(undefined);

export const usePTT = () => {
  const ctx = useContext(PTTContext);
  if (!ctx) throw new Error('usePTT must be used within PTTProvider');
  return ctx;
};

const SAMPLE_RATE = 16000;

export const PTTProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { subscribe, send } = useSocket();
  const { user } = useAuth();
  const [channels, setChannels] = useState<PTTChannel[]>([]);
  const [myChannels, setMyChannels] = useState<PTTChannel[]>([]);
  const [currentChannel, setCurrentChannel] = useState<PTTChannel | null>(null);
  const [members, setMembers] = useState<PTTMember[]>([]);
  const [activeSpeakerId, setActiveSpeakerId] = useState<string | null>(null);
  const [activeSpeakerName, setActiveSpeakerName] = useState<string | null>(null);
  const [isTransmitting, setIsTransmitting] = useState(false);
  const [isFloorDenied, setIsFloorDenied] = useState(false);
  const [pttError, setPttError] = useState<string | null>(null);
  const [myStatus, setMyStatusState] = useState<UserStatus>(
    () => (localStorage.getItem('ptt_myStatus') as UserStatus) || 'available'
  );
  const [emergencyAlert, setEmergencyAlert] = useState<EmergencyAlert | null>(null);
  const [broadcastAlert, setBroadcastAlert] = useState<BroadcastAlert | null>(null);
  const [scanMode, setScanMode] = useState(false);
  const [networkQuality, setNetworkQuality] = useState(4);
  const pingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pingTimestampRef = useRef<number>(0);

  const audioContextRef = useRef<AudioContext | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const workletNodeRef = useRef<AudioWorkletNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);
  const currentChannelRef = useRef<PTTChannel | null>(null);
  const isTransmittingRef = useRef(false);
  const workletReadyRef = useRef(false);
  const nextPlayTimeRef = useRef(0);
  const recordingChunksRef = useRef<ArrayBuffer[]>([]);

  useEffect(() => {
    currentChannelRef.current = currentChannel;
  }, [currentChannel]);

  useEffect(() => {
    isTransmittingRef.current = isTransmitting;
  }, [isTransmitting]);

  const loadChannels = useCallback(async () => {
    try {
      const res = await api.get('/channels');
      setChannels(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error('[PTT] Failed to load channels:', err);
      setChannels([]);
    }
  }, []);

  const loadMyChannels = useCallback(async () => {
    try {
      const res = await api.get('/channels/mine');
      setMyChannels(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error('[PTT] Failed to load my channels:', err);
      setMyChannels([]);
    }
  }, []);

  const createChannel = useCallback(async (name: string, description: string) => {
    try {
      setPttError(null);
      await api.post('/channels', { name, description });
      await loadChannels();
      await loadMyChannels();
    } catch (err) {
      setPttError('Failed to create channel');
      throw err;
    }
  }, [loadChannels, loadMyChannels]);

  const joinChannel = useCallback(async (channelId: string) => {
    try {
      setPttError(null);
      await api.post(`/channels/${channelId}/join`);
      await loadMyChannels();
    } catch (err) {
      setPttError('Failed to join channel');
    }
  }, [loadMyChannels]);

  const leaveChannel = useCallback(async (channelId: string) => {
    try {
      await api.post(`/channels/${channelId}/leave`);
      if (currentChannelRef.current?.id === channelId) {
        setCurrentChannel(null);
        setMembers([]);
      }
      await loadMyChannels();
    } catch (err) {
      setPttError('Failed to leave channel');
    }
  }, [loadMyChannels]);

  const selectChannel = useCallback(async (channel: PTTChannel) => {
    setCurrentChannel(channel);
    currentChannelRef.current = channel;
    setPttError(null);
    try {
      const res = await api.get(`/channels/${channel.id}/members`);
      setMembers(Array.isArray(res.data) ? res.data : []);
    } catch (err: any) {
      console.error('[PTT] Failed to load members:', err);
      setMembers([]);
      if (err?.response?.status === 404) {
        setMyChannels(prev => prev.filter(c => c.id !== channel.id));
        setChannels(prev => prev.filter(c => c.id !== channel.id));
        setCurrentChannel(null);
        currentChannelRef.current = null;
        setPttError('Channel no longer exists');
      }
    }
  }, []);

  const setMyStatus = useCallback(async (status: UserStatus) => {
    try {
      await api.post('/ptt/status', { status });
      setMyStatusState(status);
      localStorage.setItem('ptt_myStatus', status);
    } catch (err) {
      console.error('[PTT] Failed to update status:', err);
    }
  }, []);

  const sendEmergency = useCallback(async () => {
    if (!currentChannelRef.current) return;
    try {
      await api.post(`/channels/${currentChannelRef.current.id}/emergency`, { message: 'EMERGENCY' });
    } catch (err) {
      console.error('[PTT] Failed to send emergency:', err);
    }
  }, []);

  const dismissEmergency = useCallback(() => {
    setEmergencyAlert(null);
  }, []);

  const dismissBroadcast = useCallback(() => {
    setBroadcastAlert(null);
  }, []);

  const toggleScanMode = useCallback(() => {
    setScanMode(prev => !prev);
  }, []);

  const initAudioContext = useCallback(async () => {
    if (!audioContextRef.current) {
      audioContextRef.current = new AudioContext({ sampleRate: SAMPLE_RATE });
    }
    if (!workletReadyRef.current) {
      await audioContextRef.current.audioWorklet.addModule('/ptt-capture-processor.js');
      workletReadyRef.current = true;
    }
    if (audioContextRef.current.state === 'suspended') {
      await audioContextRef.current.resume();
    }
    return audioContextRef.current;
  }, []);

  const startTransmit = useCallback(async () => {
    if (!currentChannelRef.current || isTransmittingRef.current) return;
    setPttError(null);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          channelCount: 1,
          sampleRate: SAMPLE_RATE,
        },
      });
      mediaStreamRef.current = stream;

      const ctx = await initAudioContext();
      const source = ctx.createMediaStreamSource(stream);
      sourceRef.current = source;

      const workletNode = new AudioWorkletNode(ctx, 'ptt-capture-processor', {
        numberOfInputs: 1,
        numberOfOutputs: 0,
        channelCount: 1,
      });
      workletNodeRef.current = workletNode;

      workletNode.port.onmessage = (e) => {
        if (!isTransmittingRef.current) return;
        const int16Buffer = e.data as ArrayBuffer;
        recordingChunksRef.current.push(int16Buffer.slice(0));
        const base64 = int16ToBase64(int16Buffer);
        send('ptt.audio', {
          channelId: currentChannelRef.current?.id,
          audio: base64,
        });
      };

      source.connect(workletNode);
      // Don't connect worklet to destination — we only capture, not monitor

      send('ptt.start', {
        channelId: currentChannelRef.current.id,
        userName: user?.firstName || user?.username || 'Unknown',
      });

      recordingChunksRef.current = [];
      setIsTransmitting(true);
      setIsFloorDenied(false);
    } catch (err) {
      console.error('[PTT] Failed to start transmit:', err);
      setPttError('Microphone access denied');
    }
  }, [send, user, initAudioContext]);

  const saveRecording = useCallback(async (channelId: string, chunks: ArrayBuffer[]) => {
    const durationMs = estimateDurationMs(chunks, SAMPLE_RATE);
    if (durationMs < 500 || chunks.length === 0) return;

    try {
      const wav = int16ChunksToWav(chunks, SAMPLE_RATE);
      const file = new File([wav], `ptt-${Date.now()}.wav`, { type: 'audio/wav' });
      const upload = await fileAPI.uploadFile(file);
      await api.post(`/channels/${channelId}/ptt-history`, {
        fileUrl: upload.data.url,
        durationMs,
      });
    } catch (err) {
      console.error('[PTT] Failed to save recording:', err);
    }
  }, []);

  const stopTransmit = useCallback(() => {
    if (!isTransmittingRef.current) return;

    const channelId = currentChannelRef.current?.id;
    const chunks = recordingChunksRef.current.slice();
    recordingChunksRef.current = [];

    send('ptt.stop', {
      channelId,
    });

    setIsTransmitting(false);
    isTransmittingRef.current = false;

    if (workletNodeRef.current) {
      workletNodeRef.current.disconnect();
      workletNodeRef.current = null;
    }
    if (sourceRef.current) {
      sourceRef.current.disconnect();
      sourceRef.current = null;
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(t => t.stop());
      mediaStreamRef.current = null;
    }

    if (channelId && chunks.length > 0) {
      void saveRecording(channelId, chunks);
    }
  }, [send, saveRecording]);

  const playAudioChunk = useCallback(async (base64Audio: string) => {
    const ctx = await initAudioContext();
    const float32Array = base64ToFloat32(base64Audio);
    const audioBuffer = ctx.createBuffer(1, float32Array.length, SAMPLE_RATE);
    audioBuffer.getChannelData(0).set(float32Array);

    const src = ctx.createBufferSource();
    src.buffer = audioBuffer;
    src.connect(ctx.destination);

    const now = ctx.currentTime;
    const startTime = Math.max(now, nextPlayTimeRef.current);
    src.start(startTime);
    nextPlayTimeRef.current = startTime + audioBuffer.duration;
  }, [initAudioContext]);

  const playFileAudio = useCallback(async (base64Audio: string) => {
    try {
      const blob = base64ToBlob(base64Audio, 'audio/m4a');
      const url = URL.createObjectURL(blob);
      const audio = new Audio(url);
      audio.play().catch((e) => console.error('[PTT] playFileAudio play error:', e));
      audio.onended = () => URL.revokeObjectURL(url);
    } catch (err) {
      console.error('[PTT] playFileAudio error:', err);
    }
  }, []);

  // Network quality ping/pong
  useEffect(() => {
    pingIntervalRef.current = setInterval(() => {
      pingTimestampRef.current = Date.now();
      send('ping', {});
    }, 5000);
    return () => {
      if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);
    };
  }, [send]);

  // WebSocket event listeners
  useEffect(() => {
    const unsubStart = subscribe('ptt.start', (data: any) => {
      if (scanMode && data.channelId) {
        const ch = myChannels.find(c => c.id === data.channelId);
        if (ch) { setCurrentChannel(ch); currentChannelRef.current = ch; }
      }
      if (currentChannelRef.current?.id !== data.channelId) return;
      setActiveSpeakerId(data.userId);
      setActiveSpeakerName(data.userName || 'Someone');
    });

    const unsubStop = subscribe('ptt.stop', (data: any) => {
      if (currentChannelRef.current?.id !== data.channelId) return;
      setActiveSpeakerId(null);
      setActiveSpeakerName(null);
    });

    const unsubAudio = subscribe('ptt.audio', (data: any) => {
      if (currentChannelRef.current?.id !== data.channelId) return;
      if (data.audio) {
        console.log('[PTT Web] Received audio:', { format: data.format, audioLen: data.audio?.length });
        if (data.format === 'file') {
          playFileAudio(data.audio);
        } else {
          playAudioChunk(data.audio);
        }
      }
    });

    const unsubDenied = subscribe('ptt.denied', (data: any) => {
      if (currentChannelRef.current?.id !== data.channelId) return;
      setIsFloorDenied(true);
      setPttError(data.reason || 'Channel is busy');
      setIsTransmitting(false);
      isTransmittingRef.current = false;
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach(t => t.stop());
        mediaStreamRef.current = null;
      }
      setTimeout(() => setIsFloorDenied(false), 2000);
    });

    const unsubMemberJoined = subscribe('ptt.member_joined', (data: any) => {
      if (currentChannelRef.current?.id === data.channelId) {
        setMembers(prev => {
          if (prev.some(m => m.id === data.userId)) return prev;
          return [...prev, { id: data.userId, username: '', firstName: data.userName || '', lastName: '', isOnline: true, status: 'available' }];
        });
      }
    });

    const unsubMemberLeft = subscribe('ptt.member_left', (data: any) => {
      if (currentChannelRef.current?.id === data.channelId) {
        setMembers(prev => prev.filter(m => m.id !== data.userId));
      }
    });

    const unsubEmergency = subscribe('ptt.emergency', (data: any) => {
      setEmergencyAlert({
        alertId: data.alertId,
        channelId: data.channelId,
        userId: data.userId,
        userName: data.userName || 'Unknown',
        message: data.message || 'EMERGENCY',
        createdAt: data.createdAt,
      });
      // Auto-navigate to emergency channel
      const ch = myChannels.find(c => c.id === data.channelId);
      if (ch && currentChannelRef.current?.id !== data.channelId) {
        setCurrentChannel(ch);
        currentChannelRef.current = ch;
      }
    });

    const unsubBroadcast = subscribe('org.broadcast', (data: any) => {
      setBroadcastAlert({
        message: data.message || '',
        senderName: data.senderName || 'Dispatch',
        senderId: data.senderId || '',
        channelId: data.channelId,
      });
    });

    const unsubStatus = subscribe('ptt.status', (data: any) => {
      setMembers(prev => prev.map(m =>
        m.id === data.userId ? { ...m, status: data.status as UserStatus } : m
      ));
    });

    const unsubKicked = subscribe('ptt.kicked', (data: any) => {
      if (currentChannelRef.current?.id === data.channelId) {
        setCurrentChannel(null);
        currentChannelRef.current = null;
        setMembers([]);
        setPttError('You were removed from this channel');
      }
      setMyChannels(prev => prev.filter(c => c.id !== data.channelId));
    });

    const unsubPresence = subscribe('presence.update', (data: any) => {
      if (data.userId && data.isOnline !== undefined) {
        setMembers(prev => prev.map(m =>
          m.id === data.userId ? { ...m, isOnline: data.isOnline } : m
        ));
      }
    });

    const unsubPong = subscribe('pong', (_data: any) => {
      const latency = Date.now() - pingTimestampRef.current;
      if (latency < 80) setNetworkQuality(4);
      else if (latency < 200) setNetworkQuality(3);
      else if (latency < 400) setNetworkQuality(2);
      else setNetworkQuality(1);
    });

    const unsubChannelUpdated = subscribe('ptt.channel_updated', (data: any) => {
      const patch = (ch: PTTChannel) =>
        ch.id === data.channelId
          ? { ...ch, name: data.name, description: data.description }
          : ch;
      setChannels(prev => prev.map(patch));
      setMyChannels(prev => prev.map(patch));
      setCurrentChannel(prev => (prev && prev.id === data.channelId) ? patch(prev) : prev);
    });

    const unsubChannelDeleted = subscribe('ptt.channel_deleted', (data: any) => {
      setChannels(prev => prev.filter(c => c.id !== data.channelId));
      setMyChannels(prev => prev.filter(c => c.id !== data.channelId));
      if (currentChannelRef.current?.id === data.channelId) {
        setCurrentChannel(null);
        currentChannelRef.current = null;
        setMembers([]);
      }
    });

    const unsubDirectOpen = subscribe('ptt.direct_open', (data: any) => {
      void (async () => {
        await loadMyChannels();
        if (!data?.channelId) return;
        try {
          const res = await api.get(`/channels/${data.channelId}`);
          if (res.data) {
            setCurrentChannel(res.data);
            currentChannelRef.current = res.data;
          }
        } catch {
          // channel will appear after refresh
        }
      })();
    });

    return () => {
      unsubStart(); unsubStop(); unsubAudio(); unsubDenied();
      unsubMemberJoined(); unsubMemberLeft(); unsubEmergency(); unsubBroadcast();
      unsubStatus(); unsubKicked(); unsubPong(); unsubPresence();
      unsubChannelUpdated(); unsubChannelDeleted(); unsubDirectOpen();
    };
  }, [subscribe, playAudioChunk, playFileAudio, scanMode, myChannels, loadMyChannels]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (isTransmittingRef.current) {
        stopTransmit();
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
      }
    };
  }, [stopTransmit]);

  return (
    <PTTContext.Provider value={{
      channels, myChannels, currentChannel, members,
      activeSpeakerId, activeSpeakerName,
      isTransmitting, isFloorDenied, pttError,
      myStatus, emergencyAlert, broadcastAlert, scanMode, networkQuality,
      loadChannels, loadMyChannels, createChannel,
      joinChannel, leaveChannel, selectChannel,
      startTransmit, stopTransmit, playAudioChunk,
      setMyStatus, sendEmergency, dismissEmergency, dismissBroadcast, toggleScanMode,
    }}>
      {children}
    </PTTContext.Provider>
  );
};

// Helper: Int16 ArrayBuffer to base64 — chunked for performance
function int16ToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  const CHUNK = 0x8000;
  let binary = '';
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK) as unknown as number[]);
  }
  return btoa(binary);
}

// Helper: base64 to Float32Array
function base64ToFloat32(base64: string): Float32Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  const int16Array = new Int16Array(bytes.buffer);
  const float32Array = new Float32Array(int16Array.length);
  for (let i = 0; i < int16Array.length; i++) {
    float32Array[i] = int16Array[i] / 0x8000;
  }
  return float32Array;
}

// Helper: base64 to Blob (for file-format audio playback)
function base64ToBlob(base64: string, mimeType: string): Blob {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Blob([bytes], { type: mimeType });
}
