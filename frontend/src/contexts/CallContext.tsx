import React, { createContext, useContext, useState, useRef, useCallback, useEffect } from 'react';
import type { ReactNode } from 'react';
import { Room, RoomEvent, Track, ConnectionState } from 'livekit-client';
import { callAPI } from '../services/api';
import { useAuth } from './AuthContext';
import { useSocket } from './SocketContext';
import type { Call, User } from '../types';
import {
  buildCaptureOptions,
  buildPublishOptions,
  describeScreenShareError,
  isScreenShareSupported,
  readSharedSurface,
} from '../services/screenShare';
import type { ScreenShareRequest, ShareSurface } from '../services/screenShare';

interface CallContextType {
  activeCall: Call | null;
  callerInfo: User | null;
  isIncomingCall: boolean;
  isCallActive: boolean;
  room: Room | null;
  isMuted: boolean;
  isVideoOff: boolean;
  isScreenSharing: boolean;
  isRemoteScreenSharing: boolean;
  isRemoteCameraOn: boolean;
  screenShareSupported: boolean;
  sharedSurface: ShareSurface | null;
  screenShareError: string | null;
  clearScreenShareError: () => void;
  connectionState: ConnectionState;
  showPostCallAd: boolean;
  initiateCall: (conversationId: string, callType: 'audio' | 'video') => Promise<void>;
  dialCall: (phone: string, callType: 'audio' | 'video') => Promise<void>;
  callError: string | null;
  busyInfo: { name: string; user: User | null; isSelf: boolean } | null;
  clearCallError: () => void;
  acceptCall: (callId: string) => Promise<void>;
  rejectCall: (callId: string) => Promise<void>;
  endCall: (callId: string, reason?: string) => Promise<void>;
  closePostCallAd: () => void;
  toggleMute: () => void;
  toggleVideo: () => void;
  startScreenShare: (req: ScreenShareRequest) => Promise<void>;
  stopScreenShare: () => Promise<void>;
  attachLocalVideo: (el: HTMLVideoElement | null) => void;
  attachLocalScreen: (el: HTMLVideoElement | null) => void;
  attachRemoteVideo: (el: HTMLVideoElement | null) => void;
  attachRemoteScreenShare: (el: HTMLVideoElement | null) => void;
}

const CallContext = createContext<CallContextType | undefined>(undefined);

export const useCall = () => {
  const context = useContext(CallContext);
  if (!context) {
    throw new Error('useCall must be used within a CallProvider');
  }
  return context;
};

const defaultLiveKitUrl = () => {
  if (import.meta.env.VITE_LIVEKIT_URL) return import.meta.env.VITE_LIVEKIT_URL as string;
  if (typeof window !== 'undefined' && window.location.protocol === 'https:') {
    // LiveKit JS appends /rtc — nginx proxies /rtc → livekit:7880
    return `wss://${window.location.host}`;
  }
  return 'ws://localhost:7880';
};

const LIVEKIT_URL = defaultLiveKitUrl();

/** Browser cannot reach server-local ws://localhost — rewrite to public host. */
const normalizeLiveKitUrl = (url: string) => {
  let u = (url || LIVEKIT_URL).replace(/^http/i, 'ws');
  if (/localhost|127\.0\.0\.1|0\.0\.0\.0/.test(u) && typeof window !== 'undefined') {
    const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    u = `${proto}//${window.location.host}`;
  }
  return u;
};

export const CallProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const { user, token, loading: authLoading } = useAuth();
  const { subscribe } = useSocket();
  const [activeCall, setActiveCall] = useState<Call | null>(null);
  const [callerInfo, setCallerInfo] = useState<User | null>(null);
  const [isIncomingCall, setIsIncomingCall] = useState(false);
  const [isCallActive, setIsCallActive] = useState(false);
  const [room, setRoom] = useState<Room | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [isRemoteScreenSharing, setIsRemoteScreenSharing] = useState(false);
  const [isRemoteCameraOn, setIsRemoteCameraOn] = useState(false);
  const [sharedSurface, setSharedSurface] = useState<ShareSurface | null>(null);
  const [screenShareError, setScreenShareError] = useState<string | null>(null);
  const screenShareSupported = isScreenShareSupported();
  const [connectionState, setConnectionState] = useState<ConnectionState>(ConnectionState.Disconnected);
  const [callError, setCallError] = useState<string | null>(null);
  const [busyInfo, setBusyInfo] = useState<{ name: string; user: User | null; isSelf: boolean } | null>(null);
  const [showPostCallAd, setShowPostCallAd] = useState(false);
  const busyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const activeCallIdRef = useRef<string | null>(null);

  // Update ref when activeCall changes
  useEffect(() => {
    activeCallIdRef.current = activeCall?.id || null;
  }, [activeCall?.id]);

  // Restore active call on page load (authenticated only)
  useEffect(() => {
    if (authLoading || !user || !token) return;

    const restoreActiveCall = async () => {
      try {
        const res = await callAPI.getSessions();
        const { isInCall, activeCall, participants, initiator } = res.data;
        if (isInCall && activeCall) {
          console.log('[CallContext] Restoring active call', activeCall);
          const other = participants?.find((p: User) => p.id !== user?.id);
          setActiveCall(activeCall);
          setCallerInfo(other || initiator || null);
          setIsIncomingCall(false);
          setIsCallActive(true);
          // Reconnect to LiveKit room using default URL
          await connectToRoom(activeCall.livekitRoomName, activeCall.callType, undefined);
        }
      } catch {
        /* no active session or auth expired */
      }
    };

    restoreActiveCall();
  }, [authLoading, user, token]);

  const clearCallError = useCallback(() => {
    setCallError(null);
    setBusyInfo(null);
    if (busyTimerRef.current) clearTimeout(busyTimerRef.current);
  }, []);

  const setBusy = useCallback((name: string, busyUser: User | null, isSelf = false) => {
    setCallError(`${name} is busy`);
    setBusyInfo({ name, user: busyUser, isSelf });
    if (busyTimerRef.current) clearTimeout(busyTimerRef.current);
    busyTimerRef.current = setTimeout(() => {
      setCallError(null);
      setBusyInfo(null);
    }, 5000);
  }, []);

  const roomRef = useRef<Room | null>(null);
  const localVideoEl = useRef<HTMLVideoElement | null>(null);
  const remoteVideoEl = useRef<HTMLVideoElement | null>(null);
  const remoteScreenEl = useRef<HTMLVideoElement | null>(null);
  const localScreenEl = useRef<HTMLVideoElement | null>(null);

  const attachLocalVideo = useCallback((el: HTMLVideoElement | null) => {
    localVideoEl.current = el;
    if (el && roomRef.current) {
      const pub = roomRef.current.localParticipant.getTrackPublication(Track.Source.Camera);
      if (pub?.track) {
        pub.track.attach(el);
      }
    }
  }, []);

  const attachRemoteVideo = useCallback((el: HTMLVideoElement | null) => {
    remoteVideoEl.current = el;
    if (el && roomRef.current) {
      roomRef.current.remoteParticipants.forEach((participant) => {
        participant.videoTrackPublications.forEach((pub) => {
          if (pub.track && pub.source !== Track.Source.ScreenShare) pub.track.attach(el);
        });
      });
    }
  }, []);

  const attachLocalScreen = useCallback((el: HTMLVideoElement | null) => {
    localScreenEl.current = el;
    if (el && roomRef.current) {
      const pub = roomRef.current.localParticipant.getTrackPublication(Track.Source.ScreenShare);
      if (pub?.track) pub.track.attach(el);
    }
  }, []);

  const attachRemoteScreenShare = useCallback((el: HTMLVideoElement | null) => {
    remoteScreenEl.current = el;
    if (el && roomRef.current) {
      roomRef.current.remoteParticipants.forEach((participant) => {
        participant.videoTrackPublications.forEach((pub) => {
          if (pub.track && pub.source === Track.Source.ScreenShare) pub.track.attach(el);
        });
      });
    }
  }, []);

  const disconnectRoom = useCallback(async () => {
    if (roomRef.current) {
      await roomRef.current.disconnect();
      roomRef.current = null;
      setRoom(null);
    }
    setConnectionState(ConnectionState.Disconnected);
    setIsScreenSharing(false);
    setSharedSurface(null);
    setIsRemoteScreenSharing(false);
    setIsRemoteCameraOn(false);
    setIsMuted(false);
    setIsVideoOff(false);
  }, []);

  const connectToRoom = useCallback(async (roomName: string, callType: string, livekitUrl?: string) => {
    // Prevent duplicate connections
    if (roomRef.current) {
      console.warn('[CallContext] Room already exists, disconnecting first');
      await disconnectRoom();
    }

    const tokenRes = await callAPI.getToken({ roomName, identity: user?.id });
    const { token, url } = tokenRes.data;
    const serverUrl = normalizeLiveKitUrl(livekitUrl || LIVEKIT_URL || url);

    const newRoom = new Room({ adaptiveStream: true, dynacast: true });
    roomRef.current = newRoom;
    setRoom(newRoom);

    newRoom.on(RoomEvent.ConnectionStateChanged, (state) => {
      setConnectionState(state);
      // Log state changes for debugging
      console.log('[CallContext] Connection state changed:', state);
    });

    newRoom.on(RoomEvent.TrackSubscribed, (track, publication) => {
      if (track.kind === Track.Kind.Video) {
        if (publication.source === Track.Source.ScreenShare) {
          setIsRemoteScreenSharing(true);
          if (remoteScreenEl.current) {
            track.attach(remoteScreenEl.current);
          }
        } else {
          setIsRemoteCameraOn(!publication.isMuted);
          if (remoteVideoEl.current) track.attach(remoteVideoEl.current);
        }
      }
      if (track.kind === Track.Kind.Audio) {
        const el = track.attach();
        if (el instanceof HTMLAudioElement) {
          el.play().catch(() => {});
        }
      }
    });

    newRoom.on(RoomEvent.TrackUnsubscribed, (track, publication) => {
      track.detach();
      if (publication.source === Track.Source.ScreenShare) {
        setIsRemoteScreenSharing(false);
      } else if (publication.source === Track.Source.Camera) {
        setIsRemoteCameraOn(false);
      }
    });

    newRoom.on(RoomEvent.TrackMuted, (publication, participant) => {
      if (participant.isLocal) return;
      if (publication.source === Track.Source.Camera) setIsRemoteCameraOn(false);
    });

    newRoom.on(RoomEvent.TrackUnmuted, (publication, participant) => {
      if (participant.isLocal) return;
      if (publication.source === Track.Source.Camera) setIsRemoteCameraOn(true);
    });

    newRoom.on(RoomEvent.LocalTrackPublished, (pub) => {
      if (!pub.track || pub.track.kind !== Track.Kind.Video) return;
      if (pub.source === Track.Source.ScreenShare) {
        if (localScreenEl.current) pub.track.attach(localScreenEl.current);
      } else if (localVideoEl.current) {
        pub.track.attach(localVideoEl.current);
      }
    });

    // Fires for our own Stop button and for the browser's "Stop sharing" bar.
    newRoom.on(RoomEvent.LocalTrackUnpublished, (pub) => {
      if (pub.source === Track.Source.ScreenShare) {
        setIsScreenSharing(false);
        setSharedSurface(null);
      }
    });

    await newRoom.connect(serverUrl, token);
    await newRoom.localParticipant.setMicrophoneEnabled(true);
    if (callType === 'video') {
      await newRoom.localParticipant.setCameraEnabled(true);
      setIsVideoOff(false);
    } else {
      await newRoom.localParticipant.setCameraEnabled(false);
      setIsVideoOff(true);
    }
  }, [user?.id]);

  const initiateCall = async (conversationId: string, callType: 'audio' | 'video') => {
    setCallError(null);
    try {
      const response = await callAPI.initiate({ conversationId, callType });
      const { call, roomName, livekitUrl, participants } = response.data;
      const other = participants?.find((p: User) => p.id !== user?.id);
      setActiveCall(call);
      setCallerInfo(other || response.data.initiator || null);
      setIsIncomingCall(false);
      setIsCallActive(true);
      await connectToRoom(roomName, callType, livekitUrl);
    } catch (err: unknown) {
      const e = err as { response?: { data?: { status?: string; busyUser?: User } } };
      if (e.response?.data?.status === 'busy') {
        const bu = e.response.data.busyUser as User | undefined;
        if (bu) {
          const name = bu.firstName || bu.username || 'User';
          setBusy(name, bu, false);
        } else {
          // Self-busy: caller is already in a call
          setBusy('You', null, true);
        }
        return; // Busy is handled by modal — don't propagate
      }
      throw err;
    }
  };

  const dialCall = async (phone: string, callType: 'audio' | 'video') => {
    setCallError(null);
    const response = await callAPI.dial({ phone, callType });
    const { call, roomName, livekitUrl, participants } = response.data;
    const other = participants?.find((p: User) => p.id !== user?.id);
    setActiveCall(call);
    setCallerInfo(other || response.data.initiator || null);
    setIsIncomingCall(false);
    setIsCallActive(true);
    await connectToRoom(roomName, callType, livekitUrl);
  };

  const acceptCall = async (callId: string) => {
    const response = await callAPI.join(callId);
    const { call, roomName, livekitUrl } = response.data;
    setActiveCall(call);
    setIsIncomingCall(false);
    setIsCallActive(true);
    await connectToRoom(roomName, call.callType, livekitUrl);
  };

  const rejectCall = async (callId: string) => {
    await callAPI.end(callId, 'rejected');
    await disconnectRoom();
    setActiveCall(null);
    setCallerInfo(null);
    setIsIncomingCall(false);
    setIsCallActive(false);
  };

  const endCall = async (callId: string, reason = 'ended') => {
    try {
      await callAPI.end(callId, reason);
    } finally {
      await disconnectRoom();
      setActiveCall(null);
      setCallerInfo(null);
      setIsIncomingCall(false);
      setIsCallActive(false);
      // Show post-call ad after call ends
      setShowPostCallAd(true);
    }
  };

  const closePostCallAd = () => {
    setShowPostCallAd(false);
  };

  const toggleMute = () => {
    if (!roomRef.current) return;
    const next = !isMuted;
    roomRef.current.localParticipant.setMicrophoneEnabled(!next);
    setIsMuted(next);
  };

  const toggleVideo = () => {
    if (!roomRef.current) return;
    const next = !isVideoOff;
    roomRef.current.localParticipant.setCameraEnabled(!next);
    setIsVideoOff(next);
  };

  const startScreenShare = async (req: ScreenShareRequest) => {
    const room = roomRef.current;
    if (!room) return;
    setScreenShareError(null);
    if (!screenShareSupported) {
      setScreenShareError('Screen sharing needs a desktop browser (Chrome, Edge, Firefox or Safari).');
      return;
    }
    try {
      const existing = room.localParticipant.getTrackPublication(Track.Source.ScreenShare);
      if (existing) await room.localParticipant.setScreenShareEnabled(false);
      const pub = await room.localParticipant.setScreenShareEnabled(
        true,
        buildCaptureOptions(req),
        buildPublishOptions(req),
      );
      if (!pub?.track) return;
      setIsScreenSharing(true);
      setSharedSurface(readSharedSurface(pub.track.mediaStreamTrack) || req.surface);
      if (localScreenEl.current) pub.track.attach(localScreenEl.current);
    } catch (err) {
      setIsScreenSharing(false);
      setSharedSurface(null);
      setScreenShareError(describeScreenShareError(err));
    }
  };

  const stopScreenShare = async () => {
    const room = roomRef.current;
    if (!room) return;
    try {
      await room.localParticipant.setScreenShareEnabled(false);
    } finally {
      setIsScreenSharing(false);
      setSharedSurface(null);
    }
  };

  const clearScreenShareError = useCallback(() => setScreenShareError(null), []);

  useEffect(() => {
    const unsubIncoming = subscribe('call.incoming', (data: unknown) => {
      const payload = data as { call: Call; initiator: User };
      if (payload.call.initiatedBy === user?.id) return;
      setActiveCall(payload.call);
      setCallerInfo(payload.initiator);
      setIsIncomingCall(true);
    });

    const unsubEnded = subscribe('call.ended', (data: unknown) => {
      const payload = data as { callId: string };
      console.log('[CallContext] call.ended received', payload);
      // Only disconnect if it's the current call
      if (activeCallIdRef.current === payload.callId) {
        disconnectRoom();
        setActiveCall(null);
        setCallerInfo(null);
        setIsIncomingCall(false);
        setIsCallActive(false);
      }
    });

    const unsubAccepted = subscribe('call.accepted', () => {});

    const unsubBusy = subscribe('call.busy', (data) => {
      const d = data as { userName?: string; userId?: string };
      setBusy(d.userName || 'User', null, false);
    });

    // Auto-close busy modal when call ends
    const unsubCallEndedForBusy = subscribe('call.ended', (data: unknown) => {
      const payload = data as { callId: string };
      console.log('[CallContext] call.ended received (busy check)', payload);
      // If we have a busy modal open, close it when any call ends
      if (busyInfo) {
        clearCallError();
      }
    });

    const unsubMissed = subscribe('call.missed', (data: unknown) => {
      const payload = data as { callId: string };
      console.log('[CallContext] call.missed received', payload);
      // Only disconnect if it's the current call
      if (activeCallIdRef.current === payload.callId) {
        disconnectRoom();
        setActiveCall(null);
        setIsCallActive(false);
        setIsIncomingCall(false);
      }
    });

    const unsubRejected = subscribe('call.rejected', (data: unknown) => {
      const payload = data as { callId: string };
      console.log('[CallContext] call.rejected received', payload);
      // Only disconnect if it's the current call
      if (activeCallIdRef.current === payload.callId) {
        disconnectRoom();
        setActiveCall(null);
        setIsCallActive(false);
        setIsIncomingCall(false);
      }
    });

    const unsubCallStatus = subscribe('call.status', (data: unknown) => {
      const payload = data as { callId: string; userId: string; status: string; action?: string };
      console.log('[CallContext] call.status received', payload);
      // Handle participant left event for group calls
      if (payload.action === 'participant_left') {
        console.log('[CallContext] Participant left', payload.userId);
        // In a real implementation, you would update the participant list
        // For now, we just log it
      }
    });

    return () => {
      unsubIncoming();
      unsubEnded();
      unsubAccepted();
      unsubBusy();
      unsubCallEndedForBusy();
      unsubMissed();
      unsubRejected();
      unsubCallStatus();
    };
  }, [subscribe, user?.id, disconnectRoom, clearCallError]);

  return (
    <CallContext.Provider
      value={{
        activeCall,
        callerInfo,
        isIncomingCall,
        isCallActive,
        room,
        isMuted,
        isVideoOff,
        isScreenSharing,
        isRemoteScreenSharing,
        isRemoteCameraOn,
        screenShareSupported,
        sharedSurface,
        screenShareError,
        clearScreenShareError,
        connectionState,
        showPostCallAd,
        initiateCall,
        dialCall,
        acceptCall,
        rejectCall,
        endCall,
        closePostCallAd,
        toggleMute,
        toggleVideo,
        startScreenShare,
        stopScreenShare,
        attachLocalVideo,
        attachLocalScreen,
        attachRemoteVideo,
        attachRemoteScreenShare,
        callError,
        busyInfo,
        clearCallError,
      }}
    >
      {children}
    </CallContext.Provider>
  );
};
