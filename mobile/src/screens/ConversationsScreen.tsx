import React, { useEffect, useState, useCallback } from 'react';
import { FlatList, TouchableOpacity, StyleSheet, View, Text, RefreshControl } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '../contexts/AuthContext';
import { messageService } from '../services/messageService';
import NewChatModal from '../components/NewChatModal';
import Screen from '../components/ui/Screen';
import AppBar from '../components/ui/AppBar';
import SearchField from '../components/ui/SearchField';
import EmptyState from '../components/ui/EmptyState';
import Avatar from '../components/ui/Avatar';
import { useUi } from '../contexts/UiContext';
import { T } from '../constants/design';
import { L, S } from '../constants/layout';
import type { Conversation } from '../types';

export default function ConversationsScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { showError } = useUi();
  const insets = useSafeAreaInsets();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState('');
  const [showNewChat, setShowNewChat] = useState(false);
  const [loadError, setLoadError] = useState(false);

  const loadConversations = useCallback(async () => {
    try {
      setLoadError(false);
      const data = await messageService.getConversations();
      setConversations(data);
    } catch (err) {
      setLoadError(true);
      showError(err, 'Could not load conversations.');
    }
  }, [showError]);

  useEffect(() => { loadConversations(); }, [loadConversations]);

  const onRefresh = async () => {
    setRefreshing(true);
    await loadConversations();
    setRefreshing(false);
  };

  const getDisplayName = (c: Conversation) => {
    if (c.type !== 'direct') return c.name || 'Group';
    const other = (c.participants || []).find(p => p.id !== user?.id);
    return other?.firstName || other?.username || 'Unknown';
  };

  const filtered = conversations.filter(c =>
    getDisplayName(c).toLowerCase().includes(search.toLowerCase()),
  );

  const getLastMsgPreview = (c: Conversation) => {
    const m = c.lastMessage;
    if (!m) return 'No messages yet';
    if (m.messageType === 'audio') return 'Voice message';
    if (m.messageType === 'image') return 'Photo';
    if (m.messageType === 'video') return 'Video';
    if (m.messageType === 'file') return m.content || 'File';
    return m.content || '';
  };

  const fabBottom = L.tabBarHeight + Math.max(insets.bottom, S.md) + S.lg;

  const renderConversation = ({ item }: { item: Conversation }) => {
    const displayName = getDisplayName(item);
    const preview = getLastMsgPreview(item);
    const time = item.lastMessage
      ? new Date(item.lastMessage.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      : '';

    return (
      <TouchableOpacity
        style={styles.item}
        activeOpacity={0.7}
        onPress={() => router.push({ pathname: '/chat', params: { conversationId: item.id, name: displayName } })}
      >
        <Avatar name={displayName} size={52} />
        <View style={styles.info}>
          <View style={styles.row}>
            <Text style={styles.name} numberOfLines={1}>{displayName}</Text>
            {time ? <Text style={styles.time}>{time}</Text> : null}
          </View>
          <View style={styles.row}>
            <Text style={styles.preview} numberOfLines={1}>{preview}</Text>
            {item.unreadCount > 0 && (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{item.unreadCount > 99 ? '99+' : item.unreadCount}</Text>
              </View>
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <Screen tabScreen>
      <AppBar
        variant="large"
        title="Chats"
        subtitle={conversations.length ? `${conversations.length} conversations` : undefined}
        actions={[
          { icon: 'create-outline', onPress: () => setShowNewChat(true), accessibilityLabel: 'New chat' },
        ]}
      />
      <SearchField value={search} onChangeText={setSearch} placeholder="Search chats" />

      <FlatList
        data={filtered}
        renderItem={renderConversation}
        keyExtractor={(item) => item.id}
        contentContainerStyle={filtered.length === 0 && styles.listEmpty}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={T.brand} colors={[T.brand]} />
        }
        ListEmptyComponent={
          <EmptyState
            icon={loadError ? 'cloud-offline-outline' : 'chatbubbles-outline'}
            title={loadError ? 'Couldn’t load chats' : 'No conversations yet'}
            subtitle={loadError ? 'Pull to refresh or check your connection.' : 'Start messaging your team.'}
            actionLabel={loadError ? 'Retry' : 'Start a chat'}
            onAction={() => (loadError ? onRefresh() : setShowNewChat(true))}
          />
        }
      />

      <TouchableOpacity style={[styles.fab, { bottom: fabBottom }]} onPress={() => setShowNewChat(true)}>
        <Ionicons name="create" size={24} color="#fff" />
      </TouchableOpacity>

      <NewChatModal visible={showNewChat} onClose={() => { setShowNewChat(false); loadConversations(); }} />
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
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: S.sm },
  name: { fontSize: T.fsMd, fontWeight: '600', color: T.text, flex: 1 },
  time: { fontSize: T.fsXs, color: T.textMuted },
  preview: { fontSize: T.fsSm, color: T.textMuted, flex: 1, marginTop: 2 },
  badge: {
    backgroundColor: T.brand,
    borderRadius: 10,
    minWidth: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 6,
    marginTop: 2,
  },
  badgeText: { color: '#fff', fontSize: T.fsXs, fontWeight: '700' },
  fab: {
    position: 'absolute',
    right: L.screenPadding,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: T.brand,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
    shadowColor: T.brand,
    shadowOpacity: 0.35,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
});
