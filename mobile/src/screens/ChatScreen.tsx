import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  FlatList, KeyboardAvoidingView, Platform, StatusBar, Alert,
  ScrollView, Image, ActivityIndicator,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons, MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons';
import {
  useAudioRecorder,
  useAudioPlayer,
  useAudioPlayerStatus,
  useAudioRecorderState,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  RecordingPresets,
} from 'expo-audio';
import * as ImagePicker from 'expo-image-picker';
import * as DocumentPicker from 'expo-document-picker';
import { useAuth } from '../contexts/AuthContext';
import { useCall } from '../contexts/CallContext';
import { messageService } from '../services/messageService';
import { apiClient } from '../utils/apiClient';
import { wsClient } from '../utils/websocket';
import { resolveFileUrl } from '../utils/resolveFileUrl';
import type { Message } from '../types';

// ── Dark theme palette (matches web version) ─────────────────────────
const C = {
  bg: '#0a0e13',
  surface: '#111821',
  surfaceAlt: '#1a2330',
  bubbleOwn: '#1a3a2a',
  bubbleOther: '#111821',
  bubbleOwnText: '#fff',
  bubbleOtherText: '#d4dce4',
  accent: '#2d9c78',
  accentGreen: '#34b88a',
  header: '#0a0e13',
  input: '#111821',
  border: 'rgba(255,255,255,0.08)',
  timeOwn: 'rgba(255,255,255,0.5)',
  timeOther: 'rgba(255,255,255,0.45)',
  placeholder: 'rgba(255,255,255,0.3)',
  icon: 'rgba(255,255,255,0.5)',
  cancel: '#e74c3c',
  waveBar: 'rgba(255,255,255,0.35)',
  waveBarActive: '#2d9c78',
};

const AVATAR_COLORS = ['#2b5278','#4fae4e','#c2462a','#7c3aed','#d97706','#0891b2'];
function getAvatarColor(n: string) {
  let h = 0;
  for (let i = 0; i < n.length; i++) h = n.charCodeAt(i) + ((h << 5) - h);
  return AVATAR_COLORS[Math.abs(h) % AVATAR_COLORS.length];
}
function fmtTime(s: number) {
  return `${String(Math.floor(s / 60)).padStart(2,'0')}:${String(s % 60).padStart(2,'0')}`;
}

// Fake waveform bars for audio messages
const WAVE_BARS = Array.from({ length: 30 }, (_, i) =>
  Math.max(0.15, Math.abs(Math.sin(i * 0.7 + 1.2)) * 0.85 + Math.random() * 0.1)
);

const EMOJIS = ['😀','😂','😍','🥰','😎','😭','😡','👍','👎','❤️','🔥','💯','🎉','🙏','😊','😢','😴','🤔','😅','🤣','😇','🥳','😱','🤩','💪','🫶','👏','🙌','😘','🤗','🫡','🫠','🥹','😤'];

// ── Top-level waveform (no hooks, safe inside renderItem) ─────────────
function WaveformBars({ isOwn, playing }: { isOwn: boolean; playing?: boolean }) {
  return (
    <View style={s.waveContainer}>
      {WAVE_BARS.map((h, i) => (
        <View
          key={i}
          style={[
            s.waveBar,
            {
              height: Math.round(h * 28),
              backgroundColor: playing
                ? (isOwn ? '#fff' : C.waveBarActive)
                : (isOwn ? 'rgba(255,255,255,0.4)' : C.waveBar),
            },
          ]}
        />
      ))}
    </View>
  );
}

// ── Top-level AudioBubble — hooks called at component top level ───────
function AudioBubble({ item, isOwn }: { item: Message; isOwn: boolean }) {
  const audioUri = resolveFileUrl(item.fileUrl);
  const player = useAudioPlayer(audioUri ? { uri: audioUri } : null);
  const status = useAudioPlayerStatus(player);
  const time = new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  return (
    <View style={s.audioBubble}>
      <TouchableOpacity
        onPress={() => status.playing ? player.pause() : player.play()}
        style={[s.audioPlayBtn, { backgroundColor: isOwn ? 'rgba(255,255,255,0.2)' : C.accent }]}
      >
        <Ionicons name={status.playing ? 'pause' : 'play'} size={18} color="#fff" />
      </TouchableOpacity>
      <View style={s.audioBody}>
        <WaveformBars isOwn={isOwn} playing={status.playing} />
        <View style={s.audioMeta}>
          <Text style={[s.audioDuration, { color: isOwn ? C.timeOwn : C.timeOther }]}>
            {item.duration ? fmtTime(item.duration) : '0:00'}
          </Text>
          <Text style={[s.msgTime, { color: isOwn ? C.timeOwn : C.timeOther }]}>{time}</Text>
          {isOwn && (
            <Ionicons
              name={item.isRead ? 'checkmark-done' : 'checkmark'}
              size={13}
              color={item.isRead ? '#2d9c78' : 'rgba(255,255,255,0.4)'}
              style={{ marginLeft: 2 }}
            />
          )}
        </View>
      </View>
    </View>
  );
}

export default function ChatScreen() {
  const router = useRouter();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  const { conversationId, name } = useLocalSearchParams<{ conversationId: string; name: string }>();
  // Sanitize conversationId to remove whitespace/newlines
  const sanitizedConversationId = conversationId?.trim().replace(/\s+/g, '') || '';
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const [sending, setSending] = useState(false);
  const [typingUser, setTypingUser] = useState<string | null>(null);
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [showEmoji, setShowEmoji] = useState(false);
  const [showAttach, setShowAttach] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [recordedUri, setRecordedUri] = useState<string | null>(null);
  const [recordingDuration, setRecordingDuration] = useState(0);

  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recorderState = useAudioRecorderState(recorder);
  const previewPlayer = useAudioPlayer(recordedUri ? { uri: recordedUri } : null);
  const previewStatus = useAudioPlayerStatus(previewPlayer);

  const recordTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flatListRef = useRef<FlatList>(null);
  const avatarColor = getAvatarColor(name || '');
  const { initiateCall } = useCall();

  const isRecording = recorderState.isRecording;
  const isPlayingPreview = previewStatus.playing;

  const loadMessages = async () => {
    if (!sanitizedConversationId) return;
    console.log('[ChatScreen] Loading messages for conversationId:', sanitizedConversationId, 'length:', sanitizedConversationId.length);
    try {
      const data = await messageService.getMessages(sanitizedConversationId);
      console.log('[ChatScreen] Messages loaded:', data?.length || 0);
      setMessages(Array.isArray(data) ? [...data].reverse() : []);
    } catch (error: any) {
      console.error('[ChatScreen] Failed to load messages:', error?.message || error);
      if (error?.response) {
        console.error('[ChatScreen] Error response:', error.response.data);
        console.error('[ChatScreen] Error status:', error.response.status);
      }
      if (error?.config?.url) {
        console.error('[ChatScreen] Request URL:', error.config.url);
      }
      setMessages([]);
      return;
    }
    // Mark as read in background — don't let it clear messages on error
    try {
      await messageService.markAsRead(sanitizedConversationId);
    } catch (err: any) {
      console.warn('[ChatScreen] markAsRead failed:', err?.message || err);
    }
  };

  useEffect(() => {
    loadMessages();
    const unsubMsg = wsClient.subscribe('message.new', (data: Message) => {
      if (data.conversationId === sanitizedConversationId) {
        setMessages(prev => {
          // Prevent duplicate messages by ID
          if (prev.some(msg => msg.id === data.id)) return prev;
          return [...prev, data];
        });
      }
    });
    const unsubTypingStart = wsClient.subscribe('typing.start', (data: any) => {
      if (data.conversationId === sanitizedConversationId && data.userId !== user?.id) {
        setTypingUser(data.userName);
      }
    });
    const unsubTypingStop = wsClient.subscribe('typing.stop', (data: any) => {
      if (data.conversationId === sanitizedConversationId) setTypingUser(null);
    });
    return () => { unsubMsg(); unsubTypingStart(); unsubTypingStop(); };
  }, [sanitizedConversationId]);

  const emitTyping = (text: string) => {
    if (text.trim()) {
      wsClient.send('typing.start', { conversationId: sanitizedConversationId, userName: user?.firstName || user?.username || 'User' });
      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
      typingTimerRef.current = setTimeout(() => {
        wsClient.send('typing.stop', { conversationId: sanitizedConversationId });
      }, 2500);
    } else {
      wsClient.send('typing.stop', { conversationId: sanitizedConversationId });
    }
  };

  const handleTextChange = (text: string) => {
    setInputText(text);
    emitTyping(text);
  };

  const sendTextMessage = async () => {
    const text = inputText.trim();
    if (!text || sending) return;
    setSending(true);
    setInputText('');
    wsClient.send('typing.stop', { conversationId: sanitizedConversationId });
    try {
      const msg = await messageService.sendMessage(sanitizedConversationId, {
        content: text,
        messageType: 'text',
        replyToId: replyTo?.id,
      });
      setMessages(prev => prev.some(m => m.id === msg.id) ? prev : [...prev, msg]);
      setReplyTo(null);
    } catch (err) {
      setInputText(text);
      Alert.alert('Error', 'Failed to send message');
    } finally {
      setSending(false);
    }
  };

  // ─── File Upload ──────────────────────────────────────────────────
  const uploadFile = async (uri: string, filename: string, mimeType: string): Promise<string> => {
    const formData = new FormData();
    formData.append('file', { uri, name: filename, type: mimeType } as any);
    const res = await apiClient.post('/files/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res.data.url;
  };

  const sendImageMessage = async () => {
    setShowAttach(false);
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images', 'videos'],
      quality: 0.8,
    });
    if (result.canceled) return;
    const asset = result.assets[0];
    setUploading(true);
    try {
      const ext = asset.uri.split('.').pop() || 'jpg';
      const mime = asset.type === 'video' ? `video/${ext}` : `image/${ext}`;
      const fileUrl = await uploadFile(asset.uri, `upload_${Date.now()}.${ext}`, mime);
      const msgType = asset.type === 'video' ? 'video' : 'image';
      const msg = await messageService.sendMessage(sanitizedConversationId, {
        content: asset.type === 'video' ? 'Video' : 'Photo',
        messageType: msgType,
        fileUrl,
      });
      setMessages(prev => prev.some(m => m.id === msg.id) ? prev : [...prev, msg]);
    } catch (err) {
      Alert.alert('Error', 'Failed to upload file');
    } finally {
      setUploading(false);
    }
  };

  const sendDocumentMessage = async () => {
    setShowAttach(false);
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: '*/*', copyToCacheDirectory: true });
      if (result.canceled) return;
      const file = result.assets[0];
      setUploading(true);
      const fileUrl = await uploadFile(file.uri, file.name, file.mimeType || 'application/octet-stream');
      const msg = await messageService.sendMessage(sanitizedConversationId, {
        content: file.name,
        messageType: 'file',
        fileUrl,
      });
      setMessages(prev => prev.some(m => m.id === msg.id) ? prev : [...prev, msg]);
    } catch (err) {
      Alert.alert('Error', 'Failed to upload document');
    } finally {
      setUploading(false);
    }
  };

  // ─── Voice Recording (expo-audio SDK 56) ─────────────────────────
  const startRecording = async () => {
    try {
      const { granted } = await requestRecordingPermissionsAsync();
      if (!granted) {
        Alert.alert('Permission required', 'Please grant microphone permission.');
        return;
      }
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();
      recorder.record();
      setRecordingDuration(0);
      recordTimerRef.current = setInterval(() => setRecordingDuration(d => d + 1), 1000);
    } catch (err) {
      Alert.alert('Error', 'Could not start recording. Check microphone permissions.');
    }
  };

  const stopRecording = async () => {
    if (recordTimerRef.current) clearInterval(recordTimerRef.current);
    await recorder.stop();
    const uri = recorder.uri;
    setRecordedUri(uri ?? null);
  };

  const cancelRecording = async () => {
    if (recordTimerRef.current) clearInterval(recordTimerRef.current);
    if (recorderState.isRecording) await recorder.stop();
    setRecordingDuration(0);
    setRecordedUri(null);
  };

  const playPreview = () => {
    if (!recordedUri) return;
    if (previewStatus.playing) {
      previewPlayer.pause();
    } else {
      previewPlayer.play();
    }
  };

  const sendVoiceMessage = async () => {
    if (!recordedUri) return;
    setUploading(true);
    try {
      const fileUrl = await uploadFile(recordedUri, `voice_${Date.now()}.m4a`, 'audio/m4a');
      const msg = await messageService.sendMessage(sanitizedConversationId, {
        content: 'Voice message',
        messageType: 'audio',
        fileUrl,
        duration: recordingDuration,
      });
      setMessages(prev => prev.some(m => m.id === msg.id) ? prev : [...prev, msg]);
      setRecordedUri(null);
      setRecordingDuration(0);
    } catch (err) {
      Alert.alert('Error', 'Failed to send voice message');
    } finally {
      setUploading(false);
    }
  };

  const startCall = async (callType: 'audio' | 'video') => {
    try {
      await initiateCall(sanitizedConversationId, callType);
    } catch (error: any) {
      if (!error?.response?.data?.status) Alert.alert('Error', 'Failed to start call');
    }
  };

  // ─── Render message bubble ─────────────────────────────────────────
  const renderMessage = useCallback(({ item, index }: { item: Message; index: number }) => {
    const isOwn = item.senderId === user?.id;
    const time = new Date(item.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const prevMsg = messages[index - 1];
    const showAvatar = !isOwn && (!prevMsg || prevMsg.senderId !== item.senderId);

    // ── Call bubble ──
    if (item.messageType === 'text' && (
      item.content?.toLowerCase().includes('video call') ||
      item.content?.toLowerCase().includes('audio call') ||
      item.content?.toLowerCase().includes('cancelled call') ||
      item.content?.toLowerCase().includes('voice call') ||
      item.content?.toLowerCase().includes('missed call')
    )) {
      const isCancelled = item.content.toLowerCase().includes('cancel') || item.content.toLowerCase().includes('miss');
      const isVideo = item.content.toLowerCase().includes('video');
      return (
        <View style={[s.msgRow, isOwn ? s.msgRowOwn : s.msgRowOther]}>
          {!isOwn && <View style={[s.msgAvatar, { backgroundColor: 'transparent' }]} />}
          <View style={[s.bubble, isOwn ? s.bubbleOwn : s.bubbleOther, s.callBubble]}>
            <View style={s.callBubbleInner}>
              <View style={[s.callIcon, { backgroundColor: isCancelled ? 'rgba(239,83,80,0.2)' : 'rgba(82,136,193,0.2)' }]}>
                <Ionicons
                  name={isCancelled ? 'call' : (isVideo ? 'videocam' : 'call')}
                  size={16}
                  color={isCancelled ? C.cancel : C.accent}
                />
              </View>
              <View>
                <Text style={s.callLabel}>{item.content}</Text>
                <Text style={[s.msgTime, { color: isOwn ? C.timeOwn : C.timeOther }]}>{time}</Text>
              </View>
            </View>
          </View>
        </View>
      );
    }

    // ── Image bubble ──
    const imageUrl = resolveFileUrl(item.fileUrl);
    if (item.messageType === 'image' && imageUrl) {
      return (
        <TouchableOpacity
          activeOpacity={0.9}
          onLongPress={() => setReplyTo(item)}
          style={[s.msgRow, isOwn ? s.msgRowOwn : s.msgRowOther]}
        >
          {!isOwn && <View style={[s.msgAvatar, { backgroundColor: showAvatar ? avatarColor : 'transparent' }]}>
            {showAvatar && <Text style={s.msgAvatarText}>{(name || '?').charAt(0).toUpperCase()}</Text>}
          </View>}
          <View style={[s.bubble, isOwn ? s.bubbleOwn : s.bubbleOther, { padding: 3 }]}>
            <Image source={{ uri: imageUrl }} style={s.msgImage} resizeMode="cover" />
            <View style={s.timeOverlay}>
              <Text style={s.timeOverlayText}>{time}</Text>
              {isOwn && <Ionicons name={item.isRead ? 'checkmark-done' : 'checkmark'} size={12} color="rgba(255,255,255,0.8)" style={{ marginLeft: 2 }} />}
            </View>
          </View>
        </TouchableOpacity>
      );
    }

    // ── Audio bubble ──
    const audioUrl = resolveFileUrl(item.fileUrl);
    if (item.messageType === 'audio' && audioUrl) {
      return (
        <TouchableOpacity
          activeOpacity={0.9}
          onLongPress={() => setReplyTo(item)}
          style={[s.msgRow, isOwn ? s.msgRowOwn : s.msgRowOther]}
        >
          {!isOwn && <View style={[s.msgAvatar, { backgroundColor: showAvatar ? avatarColor : 'transparent' }]}>
            {showAvatar && <Text style={s.msgAvatarText}>{(name || '?').charAt(0).toUpperCase()}</Text>}
          </View>}
          <View style={[s.bubble, isOwn ? s.bubbleOwn : s.bubbleOther]}>
            <AudioBubble item={item} isOwn={isOwn} />
          </View>
        </TouchableOpacity>
      );
    }

    // ── File / Video bubble ──
    if ((item.messageType === 'file' || item.messageType === 'video') && item.fileUrl) {
      return (
        <TouchableOpacity
          activeOpacity={0.9}
          onLongPress={() => setReplyTo(item)}
          style={[s.msgRow, isOwn ? s.msgRowOwn : s.msgRowOther]}
        >
          {!isOwn && <View style={[s.msgAvatar, { backgroundColor: showAvatar ? avatarColor : 'transparent' }]}>
            {showAvatar && <Text style={s.msgAvatarText}>{(name || '?').charAt(0).toUpperCase()}</Text>}
          </View>}
          <View style={[s.bubble, isOwn ? s.bubbleOwn : s.bubbleOther]}>
            <View style={s.fileBubble}>
              <View style={[s.fileIconBox, { backgroundColor: isOwn ? 'rgba(255,255,255,0.15)' : C.surfaceAlt }]}>
                <Ionicons name={item.messageType === 'video' ? 'videocam' : 'document-attach'} size={22} color={C.accent} />
              </View>
              <View style={{ flex: 1, marginLeft: 10 }}>
                <Text style={s.fileName} numberOfLines={1}>{item.content}</Text>
                <Text style={[s.msgTime, { color: isOwn ? C.timeOwn : C.timeOther, marginTop: 2 }]}>{time}</Text>
              </View>
              {isOwn && <Ionicons name={item.isRead ? 'checkmark-done' : 'checkmark'} size={13} color={item.isRead ? C.accent : 'rgba(255,255,255,0.4)'} />}
            </View>
          </View>
        </TouchableOpacity>
      );
    }

    // ── Text bubble (default) ──
    return (
      <TouchableOpacity
        activeOpacity={0.85}
        onLongPress={() => setReplyTo(item)}
        style={[s.msgRow, isOwn ? s.msgRowOwn : s.msgRowOther]}
      >
        {!isOwn && (
          <View style={[s.msgAvatar, { backgroundColor: showAvatar ? avatarColor : 'transparent' }]}>
            {showAvatar && <Text style={s.msgAvatarText}>{(name || '?').charAt(0).toUpperCase()}</Text>}
          </View>
        )}
        <View style={[s.bubble, isOwn ? s.bubbleOwn : s.bubbleOther]}>
          {item.replyToId && (
            <View style={[s.replyInBubble, { borderLeftColor: isOwn ? 'rgba(255,255,255,0.5)' : C.accent }]}>
              <Text style={s.replyInText} numberOfLines={1}>Reply</Text>
            </View>
          )}
          <Text style={s.bubbleText}>{item.content}</Text>
          <View style={s.timeRow}>
            <Text style={[s.msgTime, { color: isOwn ? C.timeOwn : C.timeOther }]}>{time}</Text>
            {isOwn && (
              <Ionicons
                name={item.isRead ? 'checkmark-done' : 'checkmark'}
                size={13}
                color={item.isRead ? C.accent : 'rgba(255,255,255,0.4)'}
                style={{ marginLeft: 2 }}
              />
            )}
          </View>
        </View>
      </TouchableOpacity>
    );
  }, [messages, user, name, avatarColor]);

  return (
    <KeyboardAvoidingView style={s.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <StatusBar barStyle="light-content" backgroundColor={C.header} />

      {/* Header */}
      <View style={[s.header, { paddingTop: insets.top + 8 }]}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <View style={[s.headerAvatar, { backgroundColor: avatarColor }]}>
          <Text style={s.headerAvatarText}>{(name || '?').charAt(0).toUpperCase()}</Text>
        </View>
        <View style={s.headerInfo}>
          <Text style={s.headerName} numberOfLines={1}>{name}</Text>
          <Text style={s.headerStatus}>
            {typingUser ? `${typingUser} is typing...` : 'last seen recently'}
          </Text>
        </View>
        <TouchableOpacity style={s.headerBtn} onPress={() => startCall('audio')}>
          <Ionicons name="call-outline" size={22} color="#8a9fba" />
        </TouchableOpacity>
        <TouchableOpacity style={s.headerBtn} onPress={() => startCall('video')}>
          <Ionicons name="videocam-outline" size={22} color="#8a9fba" />
        </TouchableOpacity>
        <TouchableOpacity style={s.headerBtn}>
          <MaterialIcons name="more-vert" size={22} color="#8a9fba" />
        </TouchableOpacity>
      </View>

      {/* Messages */}
      <FlatList
        ref={flatListRef}
        data={messages || []}
        renderItem={renderMessage}
        keyExtractor={(item) => item.id}
        style={s.list}
        contentContainerStyle={s.listContent}
        onContentSizeChange={() => flatListRef.current?.scrollToEnd({ animated: true })}
        onLayout={() => flatListRef.current?.scrollToEnd({ animated: false })}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={s.emptyList}>
            <Text style={s.emptyListText}>No messages yet. Say hi! 👋</Text>
          </View>
        }
      />

      {/* Reply preview */}
      {replyTo && (
        <View style={s.replyBar}>
          <View style={s.replyBarAccent} />
          <View style={s.replyContent}>
            <Text style={s.replyLabel}>Reply</Text>
            <Text style={s.replyText} numberOfLines={1}>{replyTo.content}</Text>
          </View>
          <TouchableOpacity onPress={() => setReplyTo(null)} style={s.replyClose}>
            <Ionicons name="close" size={18} color={C.icon} />
          </TouchableOpacity>
        </View>
      )}

      {/* Emoji picker */}
      {showEmoji && (
        <View style={s.emojiPanel}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <View style={s.emojiGrid}>
              {EMOJIS.map((e, i) => (
                <TouchableOpacity key={i} onPress={() => setInputText(t => t + e)} style={s.emojiBtn}>
                  <Text style={s.emojiText}>{e}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
        </View>
      )}

      {/* Voice recording UI */}
      {(isRecording || recordedUri) && (
        <View style={s.voiceBar}>
          {isRecording ? (
            <>
              <TouchableOpacity onPress={cancelRecording} style={s.voiceAction}>
                <Ionicons name="trash-outline" size={22} color={C.cancel} />
              </TouchableOpacity>
              <View style={s.recDot} />
              <Text style={s.recTime}>{fmtTime(recordingDuration)}</Text>
              <Text style={s.recHint}>Slide to cancel</Text>
              <TouchableOpacity onPress={stopRecording} style={[s.sendCircle, { backgroundColor: C.cancel }]}>
                <Ionicons name="stop" size={20} color="#fff" />
              </TouchableOpacity>
            </>
          ) : (
            <>
              <TouchableOpacity onPress={cancelRecording} style={s.voiceAction}>
                <Ionicons name="trash-outline" size={22} color={C.cancel} />
              </TouchableOpacity>
              <TouchableOpacity onPress={playPreview} style={[s.voiceAction, { marginLeft: 4 }]}>
                <Ionicons name={isPlayingPreview ? 'pause-circle' : 'play-circle'} size={32} color={C.accent} />
              </TouchableOpacity>
              <WaveformBars isOwn={false} playing={isPlayingPreview} />
              <Text style={s.recTime}>{fmtTime(recordingDuration)}</Text>
              <TouchableOpacity onPress={sendVoiceMessage} style={s.sendCircle} disabled={uploading}>
                {uploading ? <ActivityIndicator color="#fff" size="small" /> : <Ionicons name="send" size={18} color="#fff" />}
              </TouchableOpacity>
            </>
          )}
        </View>
      )}

      {/* Input bar */}
      {!isRecording && !recordedUri && (
        <View style={s.inputBar}>
          <TouchableOpacity style={s.inputAction} onPress={() => { setShowEmoji(false); setShowAttach(v => !v); }}>
            <Ionicons name="attach" size={24} color={C.icon} />
          </TouchableOpacity>
          <View style={s.inputWrap}>
            <TouchableOpacity style={s.emojiToggle} onPress={() => { setShowAttach(false); setShowEmoji(v => !v); }}>
              <Ionicons name={showEmoji ? 'happy' : 'happy-outline'} size={22} color={showEmoji ? C.accent : C.icon} />
            </TouchableOpacity>
            <TextInput
              style={s.input}
              value={inputText}
              onChangeText={handleTextChange}
              placeholder="Message"
              placeholderTextColor={C.placeholder}
              multiline
              maxLength={4096}
              onFocus={() => { setShowEmoji(false); setShowAttach(false); }}
            />
          </View>
          {uploading && <ActivityIndicator color={C.accent} size="small" style={{ marginHorizontal: 8 }} />}
          {!uploading && inputText.trim() ? (
            <TouchableOpacity style={s.sendCircle} onPress={sendTextMessage} disabled={sending}>
              <Ionicons name="send" size={18} color="#fff" />
            </TouchableOpacity>
          ) : !uploading ? (
            <TouchableOpacity style={s.sendCircle} onPress={startRecording}>
              <MaterialCommunityIcons name="microphone" size={20} color="#fff" />
            </TouchableOpacity>
          ) : null}
        </View>
      )}

      {/* Attach menu */}
      {showAttach && (
        <View style={s.attachMenu}>
          <TouchableOpacity style={s.attachItem} onPress={sendImageMessage}>
            <View style={[s.attachIcon, { backgroundColor: '#c2185b' }]}>
              <Ionicons name="image" size={26} color="#fff" />
            </View>
            <Text style={s.attachLabel}>Gallery</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.attachItem} onPress={() => { /* camera */ setShowAttach(false); }}>
            <View style={[s.attachIcon, { backgroundColor: '#e53935' }]}>
              <Ionicons name="camera" size={26} color="#fff" />
            </View>
            <Text style={s.attachLabel}>Camera</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.attachItem} onPress={sendDocumentMessage}>
            <View style={[s.attachIcon, { backgroundColor: '#1565c0' }]}>
              <Ionicons name="document-attach" size={26} color="#fff" />
            </View>
            <Text style={s.attachLabel}>File</Text>
          </TouchableOpacity>
          <TouchableOpacity style={s.attachItem} onPress={() => startCall('audio')}>
            <View style={[s.attachIcon, { backgroundColor: '#2e7d32' }]}>
              <Ionicons name="call" size={26} color="#fff" />
            </View>
            <Text style={s.attachLabel}>Call</Text>
          </TouchableOpacity>
        </View>
      )}
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  header: {
    backgroundColor: C.header,
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 48,
    paddingBottom: 10,
    paddingHorizontal: 4,
    elevation: 4,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: C.border,
  },
  backBtn: { padding: 10 },
  headerAvatar: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center', marginRight: 8 },
  headerAvatarText: { color: '#fff', fontSize: 15, fontWeight: '700' },
  headerInfo: { flex: 1 },
  headerName: { color: '#fff', fontSize: 16, fontWeight: '700' },
  headerStatus: { color: C.icon, fontSize: 12, marginTop: 1 },
  headerBtn: { padding: 8 },

  list: { flex: 1 },
  listContent: { paddingHorizontal: 8, paddingVertical: 12, paddingBottom: 4 },
  emptyList: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 60 },
  emptyListText: { color: C.placeholder, fontSize: 14 },

  msgRow: { flexDirection: 'row', marginBottom: 3, alignItems: 'flex-end' },
  msgRowOwn: { justifyContent: 'flex-end' },
  msgRowOther: { justifyContent: 'flex-start' },
  msgAvatar: { width: 28, height: 28, borderRadius: 14, justifyContent: 'center', alignItems: 'center', marginRight: 4 },
  msgAvatarText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  bubble: { maxWidth: '78%', paddingHorizontal: 10, paddingTop: 7, paddingBottom: 5, borderRadius: 16, elevation: 1 },
  bubbleOwn: { backgroundColor: C.bubbleOwn, borderBottomRightRadius: 4 },
  bubbleOther: { backgroundColor: C.bubbleOther, borderBottomLeftRadius: 4 },
  bubbleText: { fontSize: 15, lineHeight: 21, color: '#fff' },
  timeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', marginTop: 3 },
  msgTime: { fontSize: 11 },

  // Call bubble
  callBubble: { paddingVertical: 8 },
  callBubbleInner: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  callIcon: { width: 32, height: 32, borderRadius: 16, justifyContent: 'center', alignItems: 'center' },
  callLabel: { color: '#fff', fontSize: 13, fontWeight: '500' },

  // Image bubble
  msgImage: { width: 200, height: 150, borderRadius: 12 },
  timeOverlay: { position: 'absolute', bottom: 6, right: 8, flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.4)', borderRadius: 8, paddingHorizontal: 5, paddingVertical: 2 },
  timeOverlayText: { fontSize: 11, color: '#fff' },

  // Audio bubble
  audioBubble: { flexDirection: 'row', alignItems: 'center', minWidth: 180, paddingVertical: 2 },
  audioPlayBtn: { width: 36, height: 36, borderRadius: 18, justifyContent: 'center', alignItems: 'center' },
  audioBody: { flex: 1, marginLeft: 10 },
  audioDuration: { fontSize: 11, marginRight: 6 },
  audioMeta: { flexDirection: 'row', alignItems: 'center', marginTop: 4 },
  waveContainer: { flexDirection: 'row', alignItems: 'center', height: 28, gap: 2 },
  waveBar: { width: 2, borderRadius: 1 },

  // File bubble
  fileBubble: { flexDirection: 'row', alignItems: 'center', minWidth: 160, paddingVertical: 4 },
  fileIconBox: { width: 40, height: 40, borderRadius: 20, justifyContent: 'center', alignItems: 'center' },
  fileName: { color: '#fff', fontSize: 13, fontWeight: '500' },

  // Reply in bubble
  replyInBubble: { borderLeftWidth: 2, paddingLeft: 8, marginBottom: 5 },
  replyInText: { color: 'rgba(255,255,255,0.6)', fontSize: 12 },

  // Reply bar
  replyBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.surface,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: C.border,
  },
  replyBarAccent: { width: 3, height: '100%', backgroundColor: C.accent, marginRight: 10, borderRadius: 2 },
  replyContent: { flex: 1 },
  replyLabel: { fontSize: 12, color: C.accent, fontWeight: '700' },
  replyText: { fontSize: 13, color: C.icon },
  replyClose: { padding: 4 },

  // Emoji
  emojiPanel: {
    backgroundColor: C.surface,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: C.border,
    paddingVertical: 8,
    height: 60,
  },
  emojiGrid: { flexDirection: 'row', flexWrap: 'nowrap', paddingHorizontal: 8, alignItems: 'center' },
  emojiBtn: { padding: 5 },
  emojiText: { fontSize: 26 },

  // Input bar
  inputBar: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    backgroundColor: C.surface,
    paddingHorizontal: 6,
    paddingVertical: 6,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: C.border,
  },
  inputAction: { padding: 7 },
  inputWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.input,
    borderRadius: 22,
    marginHorizontal: 4,
    paddingLeft: 4,
    paddingRight: 8,
  },
  emojiToggle: { padding: 6 },
  input: {
    flex: 1,
    paddingHorizontal: 8,
    paddingVertical: 9,
    fontSize: 15,
    maxHeight: 120,
    color: '#fff',
  },
  sendCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: C.accent,
    justifyContent: 'center',
    alignItems: 'center',
    marginLeft: 4,
  },

  // Voice bar
  voiceBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: C.surface,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: C.border,
    gap: 6,
    minHeight: 56,
  },
  voiceAction: { padding: 6 },
  recDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: C.cancel },
  recTime: { fontSize: 14, fontWeight: '600', color: '#fff', minWidth: 40, textAlign: 'center' },
  recHint: { flex: 1, color: C.placeholder, fontSize: 13 },

  // Attach menu
  attachMenu: {
    flexDirection: 'row',
    backgroundColor: C.surface,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: C.border,
    gap: 20,
    flexWrap: 'wrap',
  },
  attachItem: { alignItems: 'center', gap: 6 },
  attachIcon: { width: 54, height: 54, borderRadius: 27, justifyContent: 'center', alignItems: 'center' },
  attachLabel: { fontSize: 12, color: C.icon },
});
