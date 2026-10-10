import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Modal, View, Text, StyleSheet, FlatList, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { tripCommsService, type TripMessage } from '../../services/tripCommsService';
import { wsClient } from '../../utils/websocket';
import { T } from '../../constants/design';
import { S } from '../../constants/layout';

interface Props {
  visible: boolean;
  tripId: string;
  title: string;
  role: 'driver' | 'customer';
  subdomain?: string;
  phone?: string;
  onClose: () => void;
}

export default function TripChatModal({ visible, tripId, title, role, subdomain, phone, onClose }: Props) {
  const [messages, setMessages] = useState<TripMessage[]>([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const listRef = useRef<FlatList>(null);

  const load = useCallback(async () => {
    if (!tripId) return;
    try {
      const res = role === 'driver'
        ? await tripCommsService.getMessages(tripId)
        : await tripCommsService.customerGetMessages(subdomain!, tripId, phone!);
      setMessages(res.data || []);
    } catch {
      setMessages([]);
    }
  }, [tripId, role, subdomain, phone]);

  useEffect(() => {
    if (!visible) return;
    load();
    const poll = setInterval(load, 4000);
    const unsub = role === 'driver'
      ? wsClient.subscribe('trip.message', (data: unknown) => {
          const p = data as { tripId?: string; message?: TripMessage };
          if (p?.tripId === tripId && p.message) {
            setMessages(prev => prev.some(m => m.id === p.message!.id) ? prev : [...prev, p.message!]);
          }
        })
      : () => {};
    return () => { clearInterval(poll); unsub(); };
  }, [visible, load, tripId, role]);

  const send = async () => {
    const body = text.trim();
    if (!body || sending) return;
    setSending(true);
    try {
      const res = role === 'driver'
        ? await tripCommsService.sendMessage(tripId, body)
        : await tripCommsService.customerSendMessage(subdomain!, tripId, phone!, body);
      setMessages(prev => [...prev, res.data]);
      setText('');
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    } catch {
      // ignore
    } finally {
      setSending(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.wrap} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} hitSlop={12}><Ionicons name="close" size={24} color={T.text} /></TouchableOpacity>
          <View style={styles.headerMid}>
            <Text style={styles.headerTitle}>{title}</Text>
            <Text style={styles.headerSub}>In-app chat · data only</Text>
          </View>
          <Ionicons name="chatbubbles" size={22} color={T.brand} />
        </View>
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={m => m.id}
          contentContainerStyle={styles.list}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
          renderItem={({ item }) => {
            const mine = item.senderRole === role;
            return (
              <View style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleTheirs]}>
                <Text style={[styles.bubbleText, mine && styles.bubbleTextMine]}>{item.body}</Text>
              </View>
            );
          }}
          ListEmptyComponent={<Text style={styles.empty}>စာပို့ရန် စတင်ပါ — SMS မဟုတ်ပါ</Text>}
        />
        <View style={styles.inputRow}>
          <TextInput
            style={styles.input}
            placeholder="Message…"
            placeholderTextColor={T.textFaint}
            value={text}
            onChangeText={setText}
            multiline
          />
          <TouchableOpacity style={styles.sendBtn} onPress={send} disabled={sending}>
            <Ionicons name="send" size={20} color="#fff" />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: T.bg },
  header: {
    flexDirection: 'row', alignItems: 'center', padding: S.lg, gap: S.md,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: T.border,
  },
  headerMid: { flex: 1 },
  headerTitle: { fontSize: T.fsMd, fontWeight: '700', color: T.text },
  headerSub: { fontSize: T.fsXs, color: T.textMuted, marginTop: 2 },
  list: { padding: S.lg, flexGrow: 1 },
  empty: { textAlign: 'center', color: T.textMuted, marginTop: 40 },
  bubble: { maxWidth: '80%', padding: S.md, borderRadius: T.rLg, marginBottom: S.sm },
  bubbleMine: { alignSelf: 'flex-end', backgroundColor: T.brand },
  bubbleTheirs: { alignSelf: 'flex-start', backgroundColor: T.surface },
  bubbleText: { fontSize: T.fsMd, color: T.text },
  bubbleTextMine: { color: '#fff' },
  inputRow: {
    flexDirection: 'row', alignItems: 'flex-end', padding: S.md, gap: S.sm,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: T.border,
  },
  input: {
    flex: 1, minHeight: 44, maxHeight: 100, borderRadius: T.rMd,
    backgroundColor: T.surface, paddingHorizontal: S.md, paddingVertical: S.sm,
    color: T.text, fontSize: T.fsMd,
  },
  sendBtn: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: T.brand,
    alignItems: 'center', justifyContent: 'center',
  },
});
