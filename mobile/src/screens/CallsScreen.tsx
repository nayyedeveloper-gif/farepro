import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, FlatList, StyleSheet, ActivityIndicator, RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { apiClient } from '../utils/apiClient';
import { useAuth } from '../contexts/AuthContext';
import Screen from '../components/ui/Screen';
import AppBar from '../components/ui/AppBar';
import EmptyState from '../components/ui/EmptyState';
import Avatar from '../components/ui/Avatar';
import IconButton from '../components/ui/IconButton';
import { useUi } from '../contexts/UiContext';
import { T } from '../constants/design';
import { L, S } from '../constants/layout';

interface CallRecord {
  id: string;
  callType: 'audio' | 'video';
  status: 'answered' | 'missed' | 'rejected' | 'cancelled' | 'ringing' | 'active' | 'ended';
  callResult: string;
  initiatedBy: string;
  startedAt: string;
  endedAt?: string;
  otherUserId: string;
  otherUsername: string;
  otherFirstName: string;
  otherLastName: string;
  otherAvatarUrl: string;
}

export default function CallsScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { showError } = useUi();
  const [calls, setCalls] = useState<CallRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState(false);

  const loadCalls = useCallback(async () => {
    try {
      setLoadError(false);
      const res = await apiClient.get('/calls/history');
      setCalls(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      setLoadError(true);
      showError(err, 'Could not load call history.');
      setCalls([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [showError]);

  useEffect(() => { loadCalls(); }, [loadCalls]);

  const getCallName = (call: CallRecord) => call.otherFirstName || call.otherUsername || 'Unknown';
  const isOutgoing = (call: CallRecord) => call.initiatedBy === user?.id;

  const getStatusColor = (call: CallRecord) => {
    if (call.status === 'missed' || call.status === 'rejected') return T.danger;
    if (isOutgoing(call)) return T.ptt;
    return T.pttBright;
  };

  const getStatusIcon = (call: CallRecord): keyof typeof Ionicons.glyphMap => {
    if (call.status === 'missed') return 'call-outline';
    return isOutgoing(call) ? 'arrow-up-outline' : 'arrow-down-outline';
  };

  const fmtDuration = (s?: number) => {
    if (!s) return '';
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return m > 0 ? `${m}m ${sec}s` : `${sec}s`;
  };

  const renderItem = ({ item }: { item: CallRecord }) => {
    const name = getCallName(item);
    const statusColor = getStatusColor(item);
    const time = new Date(item.startedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const date = new Date(item.startedAt).toLocaleDateString([], { month: 'short', day: 'numeric' });
    const duration = item.endedAt
      ? fmtDuration(Math.round((new Date(item.endedAt).getTime() - new Date(item.startedAt).getTime()) / 1000))
      : '';

    return (
      <View style={styles.item}>
        <Avatar name={name} size={52} />
        <View style={styles.info}>
          <Text style={styles.name}>{name}</Text>
          <View style={styles.statusRow}>
            <Ionicons name={getStatusIcon(item)} size={14} color={statusColor} />
            <Text style={[styles.statusText, { color: statusColor }]}>
              {isOutgoing(item) ? 'Outgoing' : item.status === 'missed' ? 'Missed' : 'Incoming'}
              {duration ? ` · ${duration}` : ''}
            </Text>
          </View>
        </View>
        <View style={styles.meta}>
          <Text style={styles.time}>{date}</Text>
          <Text style={styles.time}>{time}</Text>
        </View>
        <IconButton
          icon={item.callType === 'video' ? 'videocam-outline' : 'call-outline'}
          onPress={() => {}}
          accessibilityLabel="Call back"
        />
      </View>
    );
  };

  return (
    <Screen>
      <AppBar title="Calls" variant="large" onBack={() => router.back()} />
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={T.brand} size="large" />
        </View>
      ) : (
        <FlatList
          data={calls}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={calls.length === 0 && styles.listEmpty}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadCalls(); }} tintColor={T.brand} />
          }
          ListEmptyComponent={
            <EmptyState
              icon={loadError ? 'cloud-offline-outline' : 'call-outline'}
              title={loadError ? 'Couldn’t load calls' : 'No call history'}
              subtitle={loadError ? 'Pull to refresh or check your connection.' : 'Your voice and video calls will appear here.'}
              actionLabel={loadError ? 'Retry' : undefined}
              onAction={loadError ? () => { setRefreshing(true); loadCalls(); } : undefined}
            />
          }
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  listEmpty: { flexGrow: 1 },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: L.screenPadding,
    paddingVertical: S.md,
    minHeight: L.listItemMinHeight,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: T.border,
    gap: S.md,
  },
  info: { flex: 1 },
  name: { fontSize: T.fsMd, fontWeight: '600', color: T.text },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: S.xs, marginTop: 2 },
  statusText: { fontSize: T.fsSm },
  meta: { alignItems: 'flex-end', marginRight: S.xs },
  time: { fontSize: T.fsXs, color: T.textMuted },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
});
