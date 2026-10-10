import React, { useState, useEffect, useRef } from 'react';
import { Modal, View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { tripCommsService } from '../../services/tripCommsService';
import { T } from '../../constants/design';
import { S } from '../../constants/layout';

let Room: any = null;
let RoomEvent: any = null;
try {
  const lk = require('livekit-client');
  Room = lk.Room;
  RoomEvent = lk.RoomEvent;
} catch {
  // Expo Go
}

interface Props {
  visible: boolean;
  tripId: string;
  title: string;
  role: 'driver' | 'customer';
  subdomain?: string;
  phone?: string;
  onClose: () => void;
}

export default function TripCallModal({ visible, tripId, title, role, subdomain, phone, onClose }: Props) {
  const [status, setStatus] = useState<'idle' | 'connecting' | 'live' | 'error'>('idle');
  const [error, setError] = useState('');
  const roomRef = useRef<any>(null);

  const disconnect = async () => {
    try {
      await roomRef.current?.disconnect();
    } catch { /* ignore */ }
    roomRef.current = null;
    setStatus('idle');
  };

  useEffect(() => {
    if (!visible) {
      void disconnect();
      return;
    }
    if (!Room) {
      setStatus('error');
      setError('Voice call requires the TeamLink dev build (not Expo Go).');
      return;
    }

    let cancelled = false;
    (async () => {
      setStatus('connecting');
      setError('');
      try {
        const res = role === 'driver'
          ? await tripCommsService.getCallToken(tripId)
          : await tripCommsService.customerGetCallToken(subdomain!, tripId, phone!);
        const { token, url } = res.data;
        const room = new Room({ adaptiveStream: true });
        roomRef.current = room;
        room.on(RoomEvent.Disconnected, () => {
          if (!cancelled) setStatus('idle');
        });
        await room.connect(url, token);
        await room.localParticipant.setMicrophoneEnabled(true);
        if (!cancelled) setStatus('live');
      } catch (e: unknown) {
        if (!cancelled) {
          setStatus('error');
          setError('Could not connect call. Check LiveKit config.');
        }
      }
    })();

    return () => {
      cancelled = true;
      void disconnect();
    };
  }, [visible, tripId, role, subdomain, phone]);

  const endCall = async () => {
    await disconnect();
    onClose();
  };

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={endCall}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <Ionicons name="call" size={48} color={T.ptt} />
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.sub}>Free in-app voice (data/WiFi)</Text>
          {status === 'connecting' && <ActivityIndicator color={T.brand} style={{ marginTop: S.lg }} />}
          {status === 'live' && <Text style={styles.live}>Connected — speak now</Text>}
          {status === 'error' && <Text style={styles.err}>{error}</Text>}
          <TouchableOpacity style={styles.endBtn} onPress={endCall}>
            <Ionicons name="call" size={22} color="#fff" style={{ transform: [{ rotate: '135deg' }] }} />
            <Text style={styles.endText}>End call</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', justifyContent: 'center', padding: S.xl },
  card: { backgroundColor: T.surface, borderRadius: T.rXl, padding: S.xxl, alignItems: 'center' },
  title: { fontSize: T.fsXl, fontWeight: '700', color: T.text, marginTop: S.lg },
  sub: { fontSize: T.fsSm, color: T.textMuted, marginTop: S.xs },
  live: { fontSize: T.fsMd, color: T.ptt, marginTop: S.lg, fontWeight: '600' },
  err: { fontSize: T.fsSm, color: T.danger, marginTop: S.lg, textAlign: 'center' },
  endBtn: {
    flexDirection: 'row', alignItems: 'center', gap: S.sm, marginTop: S.xxl,
    backgroundColor: T.danger, paddingHorizontal: S.xl, paddingVertical: S.md, borderRadius: T.rFull,
  },
  endText: { color: '#fff', fontWeight: '700', fontSize: T.fsMd },
});
