import React, { useState, useEffect, useLayoutEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  Modal,
  TextInput,
  Alert,
  Image,
  Switch,
  ActivityIndicator,
  ScrollView,
  Share,
  RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useNavigation } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { usePTT } from '../contexts/PTTContext';
import { useUi } from '../contexts/UiContext';
import { useAuth } from '../contexts/AuthContext';
import { pttService } from '../services/pttService';
import { API_URL } from '../config/api';
import ChannelFleetScreen from './ChannelFleetScreen';
import { useLocationSharing } from '../hooks/useLocationSharing';
import Screen from '../components/ui/Screen';
import Banner from '../components/ui/Banner';
import AppBar from '../components/ui/AppBar';
import EmptyState from '../components/ui/EmptyState';
import PTTTalkView from '../components/ptt/PTTTalkView';
import { T } from '../constants/design';
import { L, S } from '../constants/layout';

const C = {
  bg: T.bg,
  card: T.surface,
  accent: T.ptt,
  brand: T.brand,
  text: T.text,
  textDim: T.textMuted,
  border: T.border,
  green: T.pttBright,
  red: T.danger,
  transmitBg: T.pttDim,
};

function getAvatarUrl(url: string): string | null {
  if (!url) return null;
  if (url.startsWith('http')) return url;
  return `${API_URL.replace('/api', '')}${url}`;
}

export default function PTTMainScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const {
    channels,
    currentChannel,
    members,
    transmit,
    isLoading,
    error,
    selectChannel,
    refreshChannels,
    refreshMembers,
    startTransmit,
    stopTransmit,
    leaveChannel,
    updateChannel,
    deleteChannel,
    sendEmergency,
    clearError,
  } = usePTT();

  const [showProfile, setShowProfile] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [editName, setEditName] = useState('');
  const [editDesc, setEditDesc] = useState('');
  const [editPrivate, setEditPrivate] = useState(false);
  const [editAvatar, setEditAvatar] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [inviteToken, setInviteToken] = useState<string | null>(null);
  const [showInvite, setShowInvite] = useState(false);
  const [profileTab, setProfileTab] = useState<'about' | 'members' | 'invite'>('about');
  const [sharingLocation, setSharingLocation] = useState(false);
  const [showFleet, setShowFleet] = useState(false);
  const [showChannelPicker, setShowChannelPicker] = useState(false);
  const navigation = useNavigation();
  const myStatus = members.find((m) => m.id === user?.id)?.status || 'available';

  useLocationSharing(currentChannel?.id ?? null, sharingLocation, myStatus);

  const isCurrentUserAdmin = members.find((m) => m.id === user?.id)?.role === 'admin';

  useEffect(() => {
    if (!currentChannel && channels.length > 0 && !isLoading) {
      // PTTContext auto-selects; open picker only when user has no channels
    }
  }, [currentChannel, channels, isLoading]);

  useLayoutEffect(() => {
    const parent = navigation.getParent();
    if (!parent) return;
    parent.setOptions({
      tabBarStyle: currentChannel
        ? { display: 'none' }
        : {
            backgroundColor: T.tabBg,
            borderTopColor: T.borderStrong,
            borderTopWidth: StyleSheet.hairlineWidth,
            paddingTop: S.sm,
          },
    });
    return () => {
      parent.setOptions({ tabBarStyle: undefined });
    };
  }, [navigation, currentChannel]);

  const handleTransmitStart = () => {
    if (!transmit.isTransmitting) startTransmit();
  };

  const handleTransmitEnd = () => {
    if (transmit.isTransmitting) stopTransmit();
  };

  const handlePickAvatar = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]) {
      setUploading(true);
      try {
        const url = await pttService.uploadFile(result.assets[0].uri, result.assets[0].mimeType || 'image/jpeg');
        setEditAvatar(url);
      } catch (err: any) {
        Alert.alert('Upload Failed', err.message || 'Could not upload image');
      } finally {
        setUploading(false);
      }
    }
  };

  const openEdit = () => {
    if (currentChannel) {
      setEditName(currentChannel.name);
      setEditDesc(currentChannel.description || '');
      setEditPrivate(currentChannel.isPrivate || false);
      setEditAvatar(currentChannel.avatarUrl || null);
      setShowEdit(true);
    }
  };

  const handleSave = async () => {
    if (!currentChannel) return;
    if (!editName.trim()) {
      Alert.alert('Error', 'Channel name is required');
      return;
    }
    setSaving(true);
    try {
      await updateChannel(currentChannel.id, {
        name: editName.trim(),
        description: editDesc.trim(),
        isPrivate: editPrivate,
        avatarUrl: editAvatar || '',
      });
      setShowEdit(false);
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to update channel');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = () => {
    if (!currentChannel) return;
    Alert.alert(
      'Delete Channel',
      `Are you sure you want to delete "${currentChannel.name}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await deleteChannel(currentChannel.id);
              setShowProfile(false);
              setShowEdit(false);
            } catch (err: any) {
              Alert.alert('Error', err.message || 'Failed to delete channel');
            }
          },
        },
      ]
    );
  };

  const handleLeave = () => {
    if (!currentChannel) return;
    Alert.alert(
      'Leave Channel',
      `Leave "${currentChannel.name}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Leave',
          style: 'destructive',
          onPress: async () => {
            try {
              await leaveChannel(currentChannel.id);
              setShowProfile(false);
            } catch (err: any) {
              Alert.alert('Error', err.message || 'Failed to leave channel');
            }
          },
        },
      ]
    );
  };

  const handleGetInvite = async () => {
    if (!currentChannel) return;
    try {
      const token = await pttService.getInviteToken(currentChannel.id);
      setInviteToken(token);
      setShowInvite(true);
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to get invite link');
    }
  };

  const handleShareInvite = async () => {
    if (!inviteToken) return;
    const baseUrl = API_URL.replace('/api', '');
    const inviteUrl = `${baseUrl}/join/${inviteToken}`;
    try {
      await Share.share({ message: `Join my PTT channel: ${inviteUrl}` });
    } catch {
      // ignore
    }
  };

  const handleEmergency = () => {
    if (!currentChannel) return;
    Alert.alert(
      'Emergency Alert',
      'Send an emergency alert to all channel members?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Send',
          style: 'destructive',
          onPress: async () => {
            try {
              await sendEmergency(currentChannel.id);
              Alert.alert('Sent', 'Emergency alert sent');
            } catch (err: any) {
              Alert.alert('Error', err.message || 'Failed to send alert');
            }
          },
        },
      ]
    );
  };

  // Loading — black splash while channels load
  if (isLoading && !currentChannel) {
    return (
      <Screen tabScreen showGlobalBanner>
        <View style={styles.loadingRoot}>
          <ActivityIndicator color={T.brand} size="large" />
        </View>
      </Screen>
    );
  }

  // No channel — waiting for auto-select or empty account
  if (!currentChannel) {
    if (channels.length > 0) {
      return (
        <Screen tabScreen showGlobalBanner>
          <View style={styles.loadingRoot}>
            <ActivityIndicator color={T.brand} size="large" />
          </View>
        </Screen>
      );
    }
    return (
      <Screen tabScreen showGlobalBanner>
        <View style={styles.loadingRoot}>
          <Ionicons name="radio-outline" size={64} color={T.textMuted} />
          <Text style={styles.noChannelTitle}>No channel selected</Text>
          <TouchableOpacity style={styles.pickChannelBtn} onPress={() => setShowChannelPicker(true)}>
            <Text style={styles.pickChannelText}>Choose a channel</Text>
          </TouchableOpacity>
        </View>
        <ChannelPickerModal
          visible={showChannelPicker}
          onClose={() => setShowChannelPicker(false)}
          onSelected={() => setShowChannelPicker(false)}
        />
      </Screen>
    );
  }

  const activeSpeaker = transmit.activeSpeakerName;
  const isMeTransmitting = transmit.isTransmitting;
  const channelAvatar = currentChannel.avatarUrl ? getAvatarUrl(currentChannel.avatarUrl) : null;

  return (
    <Screen tabScreen showGlobalBanner>
      <PTTTalkView
        channel={currentChannel}
        avatarUrl={channelAvatar}
        activeSpeaker={activeSpeaker}
        isTransmitting={isMeTransmitting}
        isBusy={!!activeSpeaker && !isMeTransmitting}
        isOnline
        onBack={() => setShowChannelPicker(true)}
        onTransmitStart={handleTransmitStart}
        onTransmitEnd={handleTransmitEnd}
        onRefresh={refreshMembers}
        onOpenProfile={() => { setProfileTab('about'); setShowProfile(true); }}
        onOpenMembers={() => { setProfileTab('members'); setShowProfile(true); }}
        onOpenFleet={() => setShowFleet(true)}
        onEmergency={handleEmergency}
        error={error}
        onClearError={clearError}
      />
      {/* Profile Modal */}
      <Modal visible={showProfile} animationType="slide" onRequestClose={() => setShowProfile(false)}>
        <Screen showGlobalBanner={false}>
          <View style={styles.header}>
            <TouchableOpacity onPress={() => setShowProfile(false)} style={styles.backBtn}>
              <Ionicons name="close" size={26} color={C.text} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Channel Info</Text>
            {isCurrentUserAdmin ? (
              <TouchableOpacity onPress={openEdit} style={styles.editBtn}>
                <Ionicons name="create-outline" size={22} color={C.accent} />
              </TouchableOpacity>
            ) : (
              <View style={{ width: 40 }} />
            )}
          </View>

          {/* Tabs */}
          <View style={styles.tabBar}>
            {(['about', 'members', 'invite'] as const).map((tab) => (
              <TouchableOpacity
                key={tab}
                style={[styles.tab, profileTab === tab && styles.tabActive]}
                onPress={() => setProfileTab(tab)}
              >
                <Text style={[styles.tabText, profileTab === tab && styles.tabTextActive]}>
                  {tab.charAt(0).toUpperCase() + tab.slice(1)}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <ScrollView style={styles.profileBody}>
            {profileTab === 'about' && (
              <View style={styles.aboutSection}>
                <View style={styles.aboutAvatar}>
                  {currentChannel.avatarUrl ? (
                    <Image source={{ uri: getAvatarUrl(currentChannel.avatarUrl)! }} style={styles.aboutAvatarImg} />
                  ) : (
                    <Ionicons name="radio-outline" size={40} color={C.textDim} />
                  )}
                </View>
                <Text style={styles.aboutName}>{currentChannel.name}</Text>
                {currentChannel.description ? (
                  <Text style={styles.aboutDesc}>{currentChannel.description}</Text>
                ) : (
                  <Text style={styles.aboutDescDim}>No description</Text>
                )}
                <View style={styles.aboutRow}>
                  <Ionicons name="people-outline" size={16} color={C.textDim} />
                  <Text style={styles.aboutRowText}>{currentChannel.memberCount} members</Text>
                </View>
                <View style={styles.aboutRow}>
                  <Ionicons name={currentChannel.isPrivate ? 'lock-closed' : 'globe-outline'} size={16} color={C.textDim} />
                  <Text style={styles.aboutRowText}>{currentChannel.isPrivate ? 'Private' : 'Public'}</Text>
                </View>
                <View style={[styles.aboutRow, { justifyContent: 'space-between', marginTop: 12 }]}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <Ionicons name="location-outline" size={16} color={C.textDim} />
                    <Text style={styles.aboutRowText}>Share location</Text>
                  </View>
                  <Switch
                    value={sharingLocation}
                    onValueChange={setSharingLocation}
                    trackColor={{ false: C.border, true: C.accent }}
                  />
                </View>
                <TouchableOpacity style={styles.fleetBtn} onPress={() => { setShowProfile(false); setShowFleet(true); }}>
                  <Ionicons name="map" size={18} color={C.accent} />
                  <Text style={styles.fleetBtnText}>View fleet map</Text>
                </TouchableOpacity>
                {!isCurrentUserAdmin && (
                  <TouchableOpacity style={styles.leaveBtn} onPress={handleLeave}>
                    <Ionicons name="exit-outline" size={20} color={C.red} />
                    <Text style={styles.leaveText}>Leave Channel</Text>
                  </TouchableOpacity>
                )}
                {isCurrentUserAdmin && (
                  <TouchableOpacity style={styles.deleteBtn} onPress={handleDelete}>
                    <Ionicons name="trash-outline" size={20} color={C.red} />
                    <Text style={styles.deleteText}>Delete Channel</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}

            {profileTab === 'members' && (
              <View>
                {members.map((item) => (
                  <View key={item.id} style={styles.memberItem}>
                    <View style={[styles.memberDot, { backgroundColor: item.isOnline ? C.green : C.textDim }]} />
                    <View style={styles.memberInfo}>
                      <Text style={styles.memberName}>
                        {item.firstName || item.username}
                        {item.id === user?.id && ' (You)'}
                      </Text>
                      <Text style={styles.memberStatus}>{item.status || (item.isOnline ? 'Online' : 'Offline')}</Text>
                    </View>
                    {item.role === 'admin' && (
                      <View style={styles.adminBadge}>
                        <Text style={styles.adminText}>ADMIN</Text>
                      </View>
                    )}
                  </View>
                ))}
              </View>
            )}

            {profileTab === 'invite' && (
              <View style={styles.inviteSection}>
                <Ionicons name="qr-code-outline" size={64} color={C.textDim} />
                <Text style={styles.inviteTitle}>Invite Members</Text>
                <Text style={styles.inviteSub}>Share an invite link to let others join</Text>
                <TouchableOpacity style={styles.inviteBtn} onPress={handleGetInvite}>
                  <Ionicons name="link-outline" size={20} color="#fff" />
                  <Text style={styles.inviteBtnText}>Generate Invite Link</Text>
                </TouchableOpacity>
                {inviteToken && (
                  <View style={styles.inviteResult}>
                    <Text style={styles.inviteToken} numberOfLines={2}>
                      {API_URL.replace('/api', '')}/join/{inviteToken}
                    </Text>
                    <TouchableOpacity style={styles.shareBtn} onPress={handleShareInvite}>
                      <Ionicons name="share-outline" size={20} color={C.accent} />
                      <Text style={styles.shareText}>Share</Text>
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            )}
          </ScrollView>
        </Screen>
      </Modal>

      {/* Edit Modal */}
      <Modal visible={showEdit} animationType="slide" onRequestClose={() => setShowEdit(false)}>
        <Screen showGlobalBanner={false}>
          <View style={styles.header}>
            <TouchableOpacity onPress={() => setShowEdit(false)} style={styles.backBtn}>
              <Ionicons name="close" size={26} color={C.text} />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Edit Channel</Text>
            <TouchableOpacity onPress={handleSave} disabled={saving || uploading} style={styles.saveHeaderBtn}>
              {saving ? <ActivityIndicator color={C.accent} size="small" /> : <Text style={styles.saveHeaderText}>Save</Text>}
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.editBody}>
            {/* Avatar */}
            <View style={styles.editAvatarSection}>
              <TouchableOpacity onPress={handlePickAvatar} disabled={uploading} style={styles.editAvatarWrap}>
                {editAvatar ? (
                  <Image source={{ uri: getAvatarUrl(editAvatar)! }} style={styles.editAvatarImg} />
                ) : (
                  <View style={styles.editAvatarPlaceholder}>
                    <Ionicons name="camera" size={28} color={C.textDim} />
                  </View>
                )}
                {uploading && (
                  <View style={styles.uploadOverlay}>
                    <ActivityIndicator color="#fff" size="small" />
                  </View>
                )}
              </TouchableOpacity>
              <TouchableOpacity onPress={handlePickAvatar} disabled={uploading}>
                <Text style={styles.changePhotoText}>Change Photo</Text>
              </TouchableOpacity>
              {editAvatar && (
                <TouchableOpacity onPress={() => setEditAvatar(null)}>
                  <Text style={styles.removePhotoText}>Remove</Text>
                </TouchableOpacity>
              )}
            </View>

            {/* Name */}
            <Text style={styles.fieldLabel}>Channel Name</Text>
            <TextInput
              style={styles.editInput}
              value={editName}
              onChangeText={setEditName}
              maxLength={80}
              placeholder="Channel name"
              placeholderTextColor={C.textDim}
            />

            {/* Description */}
            <Text style={styles.fieldLabel}>Description</Text>
            <TextInput
              style={[styles.editInput, styles.editTextArea]}
              value={editDesc}
              onChangeText={setEditDesc}
              multiline
              maxLength={500}
              placeholder="Description (optional)"
              placeholderTextColor={C.textDim}
            />

            {/* Privacy */}
            <View style={styles.toggleRow}>
              <View>
                <Text style={styles.toggleTitle}>Private Channel</Text>
                <Text style={styles.toggleDesc}>Only invited members can join</Text>
              </View>
              <Switch
                value={editPrivate}
                onValueChange={setEditPrivate}
                trackColor={{ false: '#444', true: C.accent }}
                thumbColor="#fff"
              />
            </View>
          </ScrollView>
        </Screen>
      </Modal>

      <ChannelPickerModal
        visible={showChannelPicker}
        onClose={() => setShowChannelPicker(false)}
        onSelected={() => setShowChannelPicker(false)}
      />

      <Modal visible={showFleet} animationType="slide" onRequestClose={() => setShowFleet(false)}>
        <Screen showGlobalBanner={false}>
          <ChannelFleetScreen
            channelId={currentChannel.id}
            channelName={currentChannel.name}
            onClose={() => setShowFleet(false)}
          />
        </Screen>
      </Modal>
    </Screen>
  );
}

// Channel picker modal (Zello-style: talk screen is always main)
function ChannelPickerModal({
  visible,
  onClose,
  onSelected,
}: {
  visible: boolean;
  onClose: () => void;
  onSelected: () => void;
}) {
  const { channels, refreshChannels, selectChannel, createChannel, error, clearError } = usePTT();
  const { showError } = useUi();
  const [refreshing, setRefreshing] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [creating, setCreating] = useState(false);

  const onRefresh = async () => {
    setRefreshing(true);
    await refreshChannels();
    setRefreshing(false);
  };

  const handleCreate = async () => {
    if (!newName.trim()) {
      Alert.alert('Error', 'Channel name is required');
      return;
    }
    setCreating(true);
    try {
      await createChannel(newName.trim(), newDesc.trim());
      setNewName('');
      setNewDesc('');
      setShowCreate(false);
      onSelected();
    } catch (err: unknown) {
      showError(err, 'Failed to create channel');
    } finally {
      setCreating(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <Screen showGlobalBanner={false}>
        <AppBar
          title="Channels"
          onBack={onClose}
          actions={[{ icon: 'add', onPress: () => setShowCreate(true), accessibilityLabel: 'New channel' }]}
        />

        {error ? <Banner type="error" message={error} onDismiss={clearError} /> : null}

        <FlatList
          data={channels}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={C.brand} />}
          ListEmptyComponent={
            <EmptyState
              icon="radio-outline"
              title="No channels yet"
              subtitle="Create a channel to start talking."
              actionLabel="New Channel"
              onAction={() => setShowCreate(true)}
            />
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              style={styles.channelItem}
              onPress={() => { selectChannel(item); onSelected(); }}
              activeOpacity={0.7}
            >
            <View style={styles.channelAvatar}>
              {item.avatarUrl ? (
                <Image source={{ uri: getAvatarUrl(item.avatarUrl)! }} style={styles.avatarImg} />
              ) : (
                <Ionicons name="radio-outline" size={24} color={C.textDim} />
              )}
            </View>
            <View style={styles.channelInfo}>
              <View style={styles.channelHeader}>
                <Text style={styles.channelName} numberOfLines={1}>{item.name}</Text>
                {item.isPrivate && <Ionicons name="lock-closed" size={12} color={C.textDim} />}
              </View>
              <Text style={styles.channelSub}>
                {item.memberCount} {item.memberCount === 1 ? 'member' : 'members'}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={C.textDim} />
          </TouchableOpacity>
        )}
      />

      <Modal visible={showCreate} animationType="slide" transparent onRequestClose={() => setShowCreate(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>New Channel</Text>
            <TextInput
              style={styles.input}
              placeholder="Channel name"
              placeholderTextColor={C.textDim}
              value={newName}
              onChangeText={setNewName}
              maxLength={80}
            />
            <TextInput
              style={[styles.input, styles.textArea]}
              placeholder="Description (optional)"
              placeholderTextColor={C.textDim}
              value={newDesc}
              onChangeText={setNewDesc}
              multiline
              maxLength={500}
            />
            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setShowCreate(false)}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveBtn} onPress={handleCreate} disabled={creating}>
                <Text style={styles.saveText}>{creating ? 'Creating...' : 'Create'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
      </Screen>
    </Modal>
  );
}

const styles = StyleSheet.create({
  loadingRoot: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0a0a0a',
    gap: S.lg,
  },
  noChannelTitle: { fontSize: T.fsLg, color: T.textMuted, fontWeight: '600' },
  pickChannelBtn: {
    backgroundColor: T.brand,
    paddingHorizontal: S.xl,
    paddingVertical: S.md,
    borderRadius: T.rMd,
    marginTop: S.sm,
  },
  pickChannelText: { color: '#fff', fontWeight: '700', fontSize: T.fsMd },
  container: { flex: 1, backgroundColor: C.bg },
  pttHero: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  pttHeroTitle: { fontSize: 28, fontWeight: '800', color: C.text },
  pttHeroSub: { fontSize: 14, color: C.textDim, marginTop: 4, marginBottom: 16 },
  createChannelBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 8,
    backgroundColor: C.brand,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 10,
  },
  createChannelText: { color: '#fff', fontWeight: '600', fontSize: 14 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  headerTitle: { fontSize: 20, fontWeight: '700', color: C.text, flex: 1, textAlign: 'center' },
  backBtn: { padding: 4, width: 40 },
  editBtn: { padding: 4, width: 40, alignItems: 'flex-end' },
  saveHeaderBtn: { padding: 4, width: 50, alignItems: 'flex-end' },
  saveHeaderText: { color: C.accent, fontSize: 16, fontWeight: '700' },
  headerInfo: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerAvatarImg: { width: 40, height: 40, borderRadius: 10 },
  headerName: { fontSize: 16, fontWeight: '600', color: C.text },
  headerSub: { fontSize: 12, color: C.textDim, marginTop: 1 },
  emergencyBtn: { padding: 4 },
  speakerBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: C.transmitBg,
    paddingVertical: 8,
    gap: 8,
  },
  speakerDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: C.green,
  },
  speakerText: { color: C.green, fontSize: 14, fontWeight: '600' },
  list: { paddingBottom: S.xxxl },
  sectionTitle: { fontSize: 14, fontWeight: '600', color: C.textDim, marginBottom: 8, paddingHorizontal: 4 },
  memberItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.card,
    borderRadius: 10,
    padding: 12,
    marginBottom: 6,
    borderWidth: 1,
    borderColor: C.border,
  },
  memberDot: { width: 10, height: 10, borderRadius: 5, marginRight: 12 },
  memberInfo: { flex: 1 },
  memberName: { fontSize: 15, fontWeight: '500', color: C.text },
  memberStatus: { fontSize: 12, color: C.textDim, marginTop: 2 },
  adminBadge: {
    backgroundColor: 'rgba(242,101,34,0.2)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  adminText: { color: C.accent, fontSize: 10, fontWeight: '700' },
  pttSection: {
    padding: 24,
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: C.border,
  },
  pttButton: {
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: C.brand,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 4,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  pttButtonActive: {
    backgroundColor: C.accent,
    borderColor: C.green,
    transform: [{ scale: 1.05 }],
  },
  pttButtonDisabled: {
    backgroundColor: '#333',
  },
  pttLabel: { color: '#fff', fontSize: 11, fontWeight: '700', letterSpacing: 1 },
  // Channel list
  createBtn: { padding: 4 },
  channelItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: L.screenPadding,
    paddingVertical: S.md,
    minHeight: L.listItemMinHeight,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: C.border,
    gap: S.md,
  },
  channelAvatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: T.surfaceRaised,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: C.border,
  },
  avatarImg: { width: 52, height: 52, borderRadius: 26 },
  channelInfo: { flex: 1 },
  channelHeader: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  channelName: { fontSize: 16, fontWeight: '600', color: C.text },
  channelSub: { fontSize: 13, color: C.textDim, marginTop: 2 },
  empty: { alignItems: 'center', justifyContent: 'center', paddingVertical: 80 },
  emptyText: { fontSize: 16, color: C.textDim, marginTop: 12 },
  emptySub: { fontSize: 13, color: C.textDim, marginTop: 4 },
  errorBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(231,76,60,0.15)',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  errorText: { color: C.red, fontSize: 13, flex: 1 },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
    padding: 20,
  },
  modalCard: { backgroundColor: C.card, borderRadius: 16, padding: 20, width: '100%', maxWidth: 400 },
  modalTitle: { fontSize: 20, fontWeight: '700', color: C.text, marginBottom: 16 },
  input: {
    backgroundColor: C.bg,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: C.text,
    fontSize: 15,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: C.border,
  },
  textArea: { minHeight: 80, textAlignVertical: 'top' },
  modalActions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12 },
  cancelBtn: { paddingVertical: 10, paddingHorizontal: 20 },
  cancelText: { color: C.textDim, fontSize: 15, fontWeight: '600' },
  saveBtn: { backgroundColor: C.brand, paddingVertical: 10, paddingHorizontal: 24, borderRadius: 10 },
  saveText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  fleetBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 16,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: C.border,
    alignSelf: 'stretch',
    justifyContent: 'center',
  },
  fleetBtnText: { color: C.accent, fontSize: 14, fontWeight: '600' },
  // Profile
  tabBar: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  tab: { flex: 1, paddingVertical: 14, alignItems: 'center' },
  tabActive: { borderBottomWidth: 2, borderBottomColor: C.brand },
  tabText: { color: C.textDim, fontSize: 14, fontWeight: '600' },
  tabTextActive: { color: C.brand },
  profileBody: { flex: 1, padding: 16 },
  aboutSection: { alignItems: 'center', paddingBottom: 40 },
  aboutAvatar: {
    width: 80,
    height: 80,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  aboutAvatarImg: { width: 80, height: 80, borderRadius: 20 },
  aboutName: { fontSize: 22, fontWeight: '700', color: C.text, marginBottom: 4 },
  aboutDesc: { fontSize: 14, color: C.textDim, textAlign: 'center', marginBottom: 16 },
  aboutDescDim: { fontSize: 14, color: C.textDim, fontStyle: 'italic', marginBottom: 16 },
  aboutRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6 },
  aboutRowText: { fontSize: 14, color: C.textDim },
  leaveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 14,
    marginTop: 20,
  },
  leaveText: { color: C.red, fontSize: 15, fontWeight: '600' },
  deleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 14,
    marginTop: 8,
  },
  deleteText: { color: C.red, fontSize: 15, fontWeight: '600' },
  // Invite
  inviteSection: { alignItems: 'center', paddingTop: 40, paddingBottom: 40 },
  inviteTitle: { fontSize: 20, fontWeight: '700', color: C.text, marginTop: 16 },
  inviteSub: { fontSize: 14, color: C.textDim, marginTop: 4, textAlign: 'center' },
  inviteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: C.accent,
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 12,
    marginTop: 24,
  },
  inviteBtnText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  inviteResult: {
    marginTop: 20,
    backgroundColor: C.card,
    borderRadius: 12,
    padding: 16,
    width: '100%',
    alignItems: 'center',
    gap: 12,
  },
  inviteToken: { color: C.text, fontSize: 13, textAlign: 'center' },
  shareBtn: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  shareText: { color: C.accent, fontSize: 15, fontWeight: '600' },
  // Edit
  editBody: { flex: 1, padding: 16 },
  editAvatarSection: { alignItems: 'center', marginBottom: 24 },
  editAvatarWrap: {
    width: 80,
    height: 80,
    borderRadius: 20,
    marginBottom: 8,
  },
  editAvatarImg: { width: 80, height: 80, borderRadius: 20 },
  editAvatarPlaceholder: {
    width: 80,
    height: 80,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  uploadOverlay: {
    position: 'absolute',
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  changePhotoText: { color: C.accent, fontSize: 14, fontWeight: '600' },
  removePhotoText: { color: C.red, fontSize: 14, marginTop: 8 },
  fieldLabel: { fontSize: 13, fontWeight: '600', color: C.textDim, marginBottom: 6 },
  editInput: {
    backgroundColor: C.bg,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: C.text,
    fontSize: 15,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: C.border,
  },
  editTextArea: { minHeight: 80, textAlignVertical: 'top' },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
  },
  toggleTitle: { fontSize: 15, fontWeight: '600', color: C.text },
  toggleDesc: { fontSize: 12, color: C.textDim, marginTop: 2 },
});
