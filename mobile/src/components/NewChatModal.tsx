import React, { useState } from 'react';
import {
  View, Text, TextInput, FlatList, TouchableOpacity,
  StyleSheet, Modal, ActivityIndicator, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { userService } from '../services/userService';
import { messageService } from '../services/messageService';
import type { User } from '../types';

interface Props {
  visible: boolean;
  onClose: () => void;
}

const AVATAR_COLORS = ['#2d9c78','#c2462a','#7c3aed','#d97706','#0891b2','#db2777'];
function getColor(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
}

export default function NewChatModal({ visible, onClose }: Props) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);

  const search = async (q: string) => {
    setQuery(q);
    if (!q.trim()) { setResults([]); return; }
    setLoading(true);
    try {
      const data = await userService.search(q);
      setResults(data);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const startChat = async (targetUser: User) => {
    try {
      const conv = await messageService.createConversation({
        participantIds: [targetUser.id],
        isGroup: false,
      });
      onClose();
      setQuery('');
      setResults([]);
      router.push({ pathname: '/chat', params: { conversationId: conv.id, name: targetUser.firstName || targetUser.username } });
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.error || 'Failed to start chat');
    }
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.title}>New Message</Text>
        </View>

        <View style={styles.searchBar}>
          <Ionicons name="search" size={18} color="rgba(255,255,255,0.3)" style={{ marginRight: 8 }} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search users..."
            placeholderTextColor="rgba(255,255,255,0.3)"
            value={query}
            onChangeText={search}
            autoFocus
          />
          {loading && <ActivityIndicator size="small" color="#2d9c78" />}
        </View>

        <FlatList
          data={results}
          keyExtractor={u => u.id}
          renderItem={({ item }) => {
            const name = item.firstName ? `${item.firstName} ${item.lastName || ''}`.trim() : item.username;
            return (
              <TouchableOpacity style={styles.userItem} onPress={() => startChat(item)}>
                <View style={[styles.avatar, { backgroundColor: getColor(name) }]}>
                  <Text style={styles.avatarText}>{name.charAt(0).toUpperCase()}</Text>
                </View>
                <View>
                  <Text style={styles.userName}>{name}</Text>
                  <Text style={styles.userHandle}>@{item.username}</Text>
                </View>
              </TouchableOpacity>
            );
          }}
          ListEmptyComponent={
            query.length > 0 && !loading ? (
              <Text style={styles.empty}>No users found</Text>
            ) : null
          }
        />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0a0e13' },
  header: {
    backgroundColor: '#0a0e13',
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 48,
    paddingBottom: 12,
    paddingHorizontal: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  closeBtn: { padding: 8 },
  title: { color: '#ffffff', fontSize: 18, fontWeight: '700', marginLeft: 8 },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
    margin: 12,
    borderRadius: 10,
    paddingHorizontal: 14,
    height: 44,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  searchInput: { flex: 1, fontSize: 15, color: '#d4dce4' },
  userItem: { flexDirection: 'row', alignItems: 'center', padding: 14, paddingHorizontal: 16 },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 14,
  },
  avatarText: { color: '#fff', fontSize: 18, fontWeight: '600' },
  userName: { fontSize: 16, fontWeight: '600', color: '#d4dce4' },
  userHandle: { fontSize: 13, color: 'rgba(255,255,255,0.5)', marginTop: 2 },
  empty: { textAlign: 'center', color: 'rgba(255,255,255,0.3)', marginTop: 40, fontSize: 15 },
});
