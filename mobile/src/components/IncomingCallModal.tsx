import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, Vibration } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useCall } from '../contexts/CallContext';

export default function IncomingCallModal() {
  const { isIncomingCall, activeCall, callerInfo, acceptCall, rejectCall } = useCall();

  React.useEffect(() => {
    if (isIncomingCall) {
      Vibration.vibrate([0, 500, 500, 500, 500, 500], true);
    } else {
      Vibration.cancel();
    }
    return () => Vibration.cancel();
  }, [isIncomingCall]);

  if (!isIncomingCall || !activeCall) return null;

  const callerName = callerInfo?.firstName || callerInfo?.username || 'Unknown';
  const isVideo = activeCall.callType === 'video';

  return (
    <Modal transparent animationType="slide" visible={isIncomingCall}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <View style={styles.avatarWrap}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>{callerName.charAt(0).toUpperCase()}</Text>
            </View>
          </View>
          <Text style={styles.callerName}>{callerName}</Text>
          <Text style={styles.callType}>
            Incoming {isVideo ? 'video' : 'voice'} call...
          </Text>

          <View style={styles.actions}>
            <TouchableOpacity
              style={[styles.btn, styles.rejectBtn]}
              onPress={() => rejectCall(activeCall.id)}
            >
              <Ionicons name="call" size={28} color="#fff" style={{ transform: [{ rotate: '135deg' }] }} />
              <Text style={styles.btnLabel}>Decline</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.btn, styles.acceptBtn]}
              onPress={() => acceptCall(activeCall.id)}
            >
              <Ionicons name={isVideo ? 'videocam' : 'call'} size={28} color="#fff" />
              <Text style={styles.btnLabel}>Accept</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'flex-end',
  },
  card: {
    backgroundColor: '#1c1c1e',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 32,
    alignItems: 'center',
    paddingBottom: 48,
  },
  avatarWrap: { marginBottom: 16 },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#2d9c78',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: { color: '#fff', fontSize: 32, fontWeight: '700' },
  callerName: { color: '#fff', fontSize: 24, fontWeight: '700', marginBottom: 6 },
  callType: { color: '#aaa', fontSize: 15, marginBottom: 40 },
  actions: { flexDirection: 'row', gap: 48 },
  btn: { alignItems: 'center', gap: 8 },
  rejectBtn: {},
  acceptBtn: {},
  btnLabel: { color: '#fff', fontSize: 13 },
});
