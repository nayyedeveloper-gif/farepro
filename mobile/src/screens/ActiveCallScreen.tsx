import React, { useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, StatusBar, Dimensions } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { useCall } from '../contexts/CallContext';

// VideoView - only available in development builds
let VideoView: any = null;
try {
  const livekit = require('@livekit/react-native');
  VideoView = livekit.VideoView;
} catch (e) {
  console.log('[ActiveCallScreen] VideoView not available (Expo Go)');
}

const { width, height } = Dimensions.get('window');

export default function ActiveCallScreen() {
  const {
    activeCall, callerInfo, isCallActive,
    isMuted, isVideoOff, isSpeakerOn,
    toggleMute, toggleVideo, toggleSpeaker, endCall,
    localVideoTrack, remoteVideoTracks,
  } = useCall();
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (!isCallActive) return;
    const t = setInterval(() => setElapsed(s => s + 1), 1000);
    return () => clearInterval(t);
  }, [isCallActive]);

  if (!isCallActive || !activeCall) return null;

  const callerName = callerInfo?.firstName || callerInfo?.username || 'Unknown';
  const mins = String(Math.floor(elapsed / 60)).padStart(2, '0');
  const secs = String(elapsed % 60).padStart(2, '0');

  const hasRemoteVideo = remoteVideoTracks.length > 0 && remoteVideoTracks.some(t => t.isEnabled);

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#1a1a2e" />

      {/* Remote Video (Full Screen) - only in development build */}
      {VideoView && hasRemoteVideo ? (
        <View style={styles.remoteVideoContainer}>
          <VideoView
            style={styles.remoteVideo}
            videoTrack={remoteVideoTracks[0]}
            objectFit="cover"
          />
        </View>
      ) : null}

      {/* Local Video (Picture in Picture) - only in development build */}
      {VideoView && activeCall.callType === 'video' && !isVideoOff && localVideoTrack ? (
        <View style={styles.localVideoContainer}>
          <VideoView
            style={styles.localVideo}
            videoTrack={localVideoTrack}
            objectFit="cover"
            mirror={true}
          />
        </View>
      ) : null}

      {/* Status Bar Overlay */}
      <View style={styles.overlay}>
        <Text style={styles.status}>
          {activeCall.callType === 'video' ? 'Video Call' : 'Voice Call'}
        </Text>
      </View>

      {/* Center Content (Avatar/Name - shown when no video) */}
      {!hasRemoteVideo && (
        <View style={styles.center}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{callerName.charAt(0).toUpperCase()}</Text>
          </View>
          <Text style={styles.name}>{callerName}</Text>
          <Text style={styles.timer}>{mins}:{secs}</Text>
        </View>
      )}

      <View style={styles.controls}>
        <TouchableOpacity style={styles.ctrlBtn} onPress={toggleMute}>
          <View style={[styles.ctrlIcon, isMuted && styles.ctrlIconActive]}>
            <Ionicons name={isMuted ? 'mic-off' : 'mic'} size={26} color="#fff" />
          </View>
          <Text style={styles.ctrlLabel}>{isMuted ? 'Unmute' : 'Mute'}</Text>
        </TouchableOpacity>

        {activeCall.callType === 'video' && (
          <TouchableOpacity style={styles.ctrlBtn} onPress={toggleVideo}>
            <View style={[styles.ctrlIcon, isVideoOff && styles.ctrlIconActive]}>
              <Ionicons name={isVideoOff ? 'videocam-off' : 'videocam'} size={26} color="#fff" />
            </View>
            <Text style={styles.ctrlLabel}>{isVideoOff ? 'Start Video' : 'Stop Video'}</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity style={styles.ctrlBtn} onPress={toggleSpeaker}>
          <View style={[styles.ctrlIcon, isSpeakerOn && styles.ctrlIconActive]}>
            <MaterialCommunityIcons name={isSpeakerOn ? 'volume-high' : 'volume-off'} size={26} color="#fff" />
          </View>
          <Text style={styles.ctrlLabel}>{isSpeakerOn ? 'Speaker' : 'Earpiece'}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.ctrlBtn}
          onPress={() => endCall(activeCall.id)}
        >
          <View style={styles.endBtn}>
            <Ionicons name="call" size={28} color="#fff" style={{ transform: [{ rotate: '135deg' }] }} />
          </View>
          <Text style={[styles.ctrlLabel, { color: '#ff453a' }]}>End</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFill,
    backgroundColor: '#1a1a2e',
    zIndex: 999,
  },
  remoteVideoContainer: {
    ...StyleSheet.absoluteFill,
    backgroundColor: '#000',
  },
  remoteVideo: {
    width: width,
    height: height,
  },
  localVideoContainer: {
    position: 'absolute',
    top: 100,
    right: 16,
    width: 120,
    height: 160,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#333',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.3)',
    zIndex: 100,
  },
  localVideo: {
    width: 120,
    height: 160,
  },
  overlay: {
    position: 'absolute',
    top: 60,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  status: { color: 'rgba(255,255,255,0.9)', fontSize: 14, fontWeight: '600' },
  center: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 24,
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#2d9c78',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  avatarText: { color: '#fff', fontSize: 40, fontWeight: '700' },
  name: { color: '#fff', fontSize: 28, fontWeight: '700', marginBottom: 8 },
  timer: { color: 'rgba(255,255,255,0.7)', fontSize: 18 },
  controls: {
    position: 'absolute',
    bottom: 60,
    left: 24,
    right: 24,
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
  },
  ctrlBtn: { alignItems: 'center', gap: 8 },
  ctrlIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  ctrlIconActive: { backgroundColor: 'rgba(255,255,255,0.35)' },
  ctrlLabel: { color: 'rgba(255,255,255,0.7)', fontSize: 12 },
  endBtn: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: '#e74c3c',
    justifyContent: 'center',
    alignItems: 'center',
  },
});
