import React, { createContext, useContext, useState, useRef, useCallback, useEffect } from 'react';
import { callService } from '../services/callService';
import { wsClient } from '../utils/websocket';
import { useAuth } from './AuthContext';
import type { Call, User } from '../types';

// LiveKit imports - only available in development builds
let AudioSession: any = null;
let Room: any = null;
let RoomEvent: any = null;
let VideoPresets: any = null;

try {
  const livekit = require('@livekit/react-native');
  AudioSession = livekit.AudioSession;
} catch (e) {
  console.log('[CallContext] LiveKit AudioSession not available (Expo Go)');
}

try {
  const livekitClient = require('livekit-client');
  Room = livekitClient.Room;
  RoomEvent = livekitClient.RoomEvent;
  VideoPresets = livekitClient.VideoPresets;
} catch (e) {
  console.log('[CallContext] livekit-client not available (Expo Go)');
}

const isLiveKitAvailable = !!Room;

interface CallContextType {
  activeCall: Call | null;
  callerInfo: User | null;
  isIncomingCall: boolean;
  isCallActive: boolean;
  isMuted: boolean;
  isVideoOff: boolean;
  isSpeakerOn: boolean;
  callError: string | null;
  initiateCall: (conversationId: string, callType: 'audio' | 'video') => Promise<void>;
  acceptCall: (callId: string) => Promise<void>;
  rejectCall: (callId: string) => Promise<void>;
  endCall: (callId: string) => Promise<void>;
  toggleMute: () => void;
  toggleVideo: () => void;
  toggleSpeaker: () => void;
  clearCallError: () => void;
  localVideoTrack: any;
  remoteVideoTracks: any[];
  room: any;
}

const CallContext = createContext<CallContextType | undefined>(undefined);

export const useCall = () => {
  const ctx = useContext(CallContext);
  if (!ctx) throw new Error('useCall must be used within CallProvider');
  return ctx;
};

export const CallProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const [activeCall, setActiveCall] = useState<Call | null>(null);
  const [callerInfo, setCallerInfo] = useState<User | null>(null);
  const [isIncomingCall, setIsIncomingCall] = useState(false);
  const [isCallActive, setIsCallActive] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [isSpeakerOn, setIsSpeakerOn] = useState(true);
  const [callError, setCallError] = useState<string | null>(null);
  const [room, setRoom] = useState<any>(null);
  const [localVideoTrack, setLocalVideoTrack] = useState<any>(null);
  const [remoteVideoTracks, setRemoteVideoTracks] = useState<any[]>([]);
  const activeCallIdRef = useRef<string | null>(null);
  const localAudioTrackRef = useRef<any>(null);

  useEffect(() => {
    activeCallIdRef.current = activeCall?.id ?? null;
  }, [activeCall?.id]);

  const clearCallError = useCallback(() => setCallError(null), []);

  const resetCallState = useCallback(() => {
    // Cleanup room connection
    if (room) {
      room.disconnect();
    }
    // Cleanup tracks
    if (localVideoTrack) {
      localVideoTrack.stop();
    }
    if (localAudioTrackRef.current) {
      localAudioTrackRef.current.stop();
    }
    setRoom(null);
    setLocalVideoTrack(null);
    setRemoteVideoTracks([]);
    localAudioTrackRef.current = null;

    setActiveCall(null);
    setCallerInfo(null);
    setIsIncomingCall(false);
    setIsCallActive(false);
    setIsMuted(false);
    setIsVideoOff(false);
    setIsSpeakerOn(true);
  }, [room, localVideoTrack]);

  const connectToLiveKit = useCallback(async (roomName: string, identity: string, token: string, url: string, videoEnabled: boolean) => {
    if (!isLiveKitAvailable || !Room) {
      console.log('[CallContext] LiveKit not available, using mock connection');
      return null;
    }

    // Start audio session for call
    if (AudioSession) {
      await AudioSession.startAudioSession();
    }

    const newRoom = new Room({
      adaptiveStream: true,
      dynacast: true,
      videoCaptureDefaults: VideoPresets ? {
        resolution: VideoPresets.h540.resolution,
      } : undefined,
    });

    // Connect to room
    await newRoom.connect(url, token);
    setRoom(newRoom);

    // Enable local video if video call
    if (videoEnabled) {
      await newRoom.localParticipant.enableCameraAndMicrophone();
      const videoTrack = newRoom.localParticipant.videoTrackPublications.values().next().value;
      if (videoTrack) {
        setLocalVideoTrack(videoTrack.track);
      }
    } else {
      // Audio only - just enable microphone
      await newRoom.localParticipant.setMicrophoneEnabled(true);
    }

    const audioTrack = newRoom.localParticipant.audioTrackPublications.values().next().value;
    if (audioTrack) {
      localAudioTrackRef.current = audioTrack.track;
    }

    // Listen for remote tracks
    if (RoomEvent) {
      newRoom.on(RoomEvent.TrackSubscribed, (track: any) => {
        if (track.kind === 'video') {
          setRemoteVideoTracks(prev => [...prev, track]);
        }
      });

      newRoom.on(RoomEvent.TrackUnsubscribed, (track: any) => {
        if (track.kind === 'video') {
          setRemoteVideoTracks(prev => prev.filter(t => t !== track));
        }
      });
    }

    return newRoom;
  }, [isSpeakerOn]);

  const initiateCall = useCallback(async (conversationId: string, callType: 'audio' | 'video') => {
    setCallError(null);
    try {
      const { call, roomName, livekitUrl, participants } = await callService.initiateCall(conversationId, callType);
      const other = participants?.find((p: User) => p.id !== user?.id);

      // Get LiveKit token
      const { token } = await callService.getCallToken(roomName, user?.id || 'anonymous');

      // Connect to LiveKit
      await connectToLiveKit(roomName, user?.id || 'anonymous', token, livekitUrl, callType === 'video');

      setActiveCall(call);
      setCallerInfo(other ?? null);
      setIsIncomingCall(false);
      setIsCallActive(true);
      setIsVideoOff(callType === 'audio');
    } catch (err: any) {
      if (err.response?.data?.status === 'busy') {
        setCallError('User is busy');
      } else {
        setCallError(err.response?.data?.error || 'Failed to start call');
      }
      throw err;
    }
  }, [user?.id, connectToLiveKit]);

  const acceptCall = useCallback(async (callId: string) => {
    try {
      const { call, roomName, livekitUrl } = await callService.joinCall(callId);

      // Get LiveKit token
      const { token } = await callService.getCallToken(roomName, user?.id || 'anonymous');

      // Connect to LiveKit
      await connectToLiveKit(roomName, user?.id || 'anonymous', token, livekitUrl, call.callType === 'video');

      setActiveCall(call);
      setIsIncomingCall(false);
      setIsCallActive(true);
      setIsVideoOff(call.callType === 'audio');
    } catch (err: any) {
      setCallError(err.response?.data?.error || 'Failed to accept call');
    }
  }, [user?.id, connectToLiveKit]);

  const rejectCall = useCallback(async (callId: string) => {
    try {
      await callService.endCall(callId, 'rejected');
    } finally {
      resetCallState();
    }
  }, [resetCallState]);

  const endCall = useCallback(async (callId: string) => {
    try {
      await callService.endCall(callId, 'ended');
    } finally {
      resetCallState();
    }
  }, [resetCallState]);

  const toggleMute = useCallback(() => {
    if (room?.localParticipant) {
      room.localParticipant.setMicrophoneEnabled(isMuted);
      setIsMuted(v => !v);
    }
  }, [room, isMuted]);

  const toggleVideo = useCallback(async () => {
    if (!room?.localParticipant) return;

    if (isVideoOff) {
      // Enable video
      await room.localParticipant.setCameraEnabled(true);
      const videoTrack = room.localParticipant.videoTrackPublications.values().next().value;
      if (videoTrack) {
        setLocalVideoTrack(videoTrack.track);
      }
    } else {
      // Disable video
      await room.localParticipant.setCameraEnabled(false);
      if (localVideoTrack) {
        localVideoTrack.stop();
        setLocalVideoTrack(null);
      }
    }
    setIsVideoOff(v => !v);
  }, [room, isVideoOff, localVideoTrack]);

  const toggleSpeaker = useCallback(async () => {
    const newState = !isSpeakerOn;
    setIsSpeakerOn(newState);
    // Audio output routing is handled by AudioSession internally
    // based on device state and preferredOutputList
  }, [isSpeakerOn]);

  useEffect(() => {
    const unsubIncoming = wsClient.subscribe('call.incoming', (data: any) => {
      if (data.call?.initiatedBy === user?.id) return;
      setActiveCall(data.call);
      setCallerInfo(data.initiator ?? null);
      setIsIncomingCall(true);
    });

    const unsubEnded = wsClient.subscribe('call.ended', (data: any) => {
      if (activeCallIdRef.current === data.callId) resetCallState();
    });

    const unsubMissed = wsClient.subscribe('call.missed', (data: any) => {
      if (activeCallIdRef.current === data.callId) resetCallState();
    });

    const unsubRejected = wsClient.subscribe('call.rejected', (data: any) => {
      if (activeCallIdRef.current === data.callId) resetCallState();
    });

    const unsubBusy = wsClient.subscribe('call.busy', (data: any) => {
      setCallError(`${data.userName || 'User'} is busy`);
    });

    return () => {
      unsubIncoming();
      unsubEnded();
      unsubMissed();
      unsubRejected();
      unsubBusy();
    };
  }, [user?.id, resetCallState]);

  return (
    <CallContext.Provider value={{
      activeCall, callerInfo, isIncomingCall, isCallActive,
      isMuted, isVideoOff, isSpeakerOn, callError,
      localVideoTrack, remoteVideoTracks, room,
      initiateCall, acceptCall, rejectCall, endCall,
      toggleMute, toggleVideo, toggleSpeaker, clearCallError,
    }}>
      {children}
    </CallContext.Provider>
  );
};
