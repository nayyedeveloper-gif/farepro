import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, FlatList, TouchableOpacity, StyleSheet, ActivityIndicator, RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuth } from '../contexts/AuthContext';
import { apiClient } from '../utils/apiClient';
import { messageService } from '../services/messageService';
import Screen from '../components/ui/Screen';
import AppBar from '../components/ui/AppBar';
import SearchField from '../components/ui/SearchField';
import EmptyState from '../components/ui/EmptyState';
import Avatar from '../components/ui/Avatar';
import IconButton from '../components/ui/IconButton';
import { useUi } from '../contexts/UiContext';
import { T } from '../constants/design';
import { L, S } from '../constants/layout';
import type { User } from '../types';

export default function ContactsScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const { showError } = useUi();
  const [contacts, setContacts] = useState<User[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [searching, setSearching] = useState(false);

  const loadContacts = useCallback(async () => {
    try {
      setLoadError(false);
      const res = await apiClient.get('/users/contacts');
      setContacts(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      setLoadError(true);
      showError(err, 'Could not load contacts.');
      setContacts([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [showError]);

  useEffect(() => { loadContacts(); }, [loadContacts]);

  useEffect(() => {
    if (!search.trim()) { setSearchResults([]); return; }
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await apiClient.get('/users/search', { params: { q: search, limit: 20 } });
        setSearchResults(Array.isArray(res.data) ? res.data : []);
      } catch (err) {
        showError(err, 'Search failed. Check your connection.');
        setSearchResults([]);
      } finally {
        setSearching(false);
      }
    }, 400);
    return () => clearTimeout(timer);
  }, [search, showError]);

  const openChat = async (contact: User) => {
    try {
      const conv = await messageService.createConversation({
        participantIds: [contact.id],
        isGroup: false,
      });
      const displayName = contact.firstName || contact.username;
      router.push({ pathname: '/chat', params: { conversationId: conv.id, name: displayName } });
    } catch (err) {
      showError(err, 'Could not open chat.');
    }
  };

  const addContact = async (u: User) => {
    try {
      await apiClient.post('/users/contacts', { contactId: u.id });
      await loadContacts();
      setSearch('');
    } catch (err) {
      showError(err, 'Could not add contact.');
    }
  };

  const displayList = search.trim() ? searchResults : contacts;

  const renderItem = ({ item }: { item: User }) => {
    const name = item.firstName ? `${item.firstName} ${item.lastName || ''}`.trim() : item.username;
    const isContact = contacts.some(c => c.id === item.id);

    return (
      <TouchableOpacity style={styles.item} activeOpacity={0.7} onPress={() => openChat(item)}>
        <Avatar name={name} size={52} online={item.isOnline} />
        <View style={styles.info}>
          <Text style={styles.name} numberOfLines={1}>{name}</Text>
          <Text style={styles.username} numberOfLines={1}>@{item.username}</Text>
        </View>
        {search.trim() && !isContact && item.id !== user?.id ? (
          <IconButton icon="person-add-outline" onPress={() => addContact(item)} accessibilityLabel="Add contact" />
        ) : (
          <IconButton icon="chatbubble-outline" onPress={() => openChat(item)} accessibilityLabel="Message" />
        )}
      </TouchableOpacity>
    );
  };

  return (
    <Screen>
      <AppBar title="Contacts" variant="large" onBack={() => router.back()} />
      <SearchField value={search} onChangeText={setSearch} placeholder="Search users" />
      {searching ? (
        <View style={styles.searching}>
          <ActivityIndicator size="small" color={T.brand} />
        </View>
      ) : null}

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={T.brand} size="large" />
        </View>
      ) : (
        <FlatList
          data={displayList}
          renderItem={renderItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={displayList.length === 0 && styles.listEmpty}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); loadContacts(); }} tintColor={T.brand} />
          }
          ListEmptyComponent={
            <EmptyState
              icon={loadError ? 'cloud-offline-outline' : 'people-outline'}
              title={loadError ? 'Couldn’t load contacts' : search.trim() ? 'No users found' : 'No contacts yet'}
              subtitle={loadError ? 'Pull to refresh or check your connection.' : search.trim() ? 'Try a different name or username.' : 'Search above to find and add people.'}
              actionLabel={loadError ? 'Retry' : undefined}
              onAction={loadError ? () => { setRefreshing(true); loadContacts(); } : undefined}
            />
          }
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  listEmpty: { flexGrow: 1 },
  searching: { alignItems: 'center', marginTop: -S.sm, marginBottom: S.sm },
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
  username: { fontSize: T.fsSm, color: T.textMuted, marginTop: 2 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
});
