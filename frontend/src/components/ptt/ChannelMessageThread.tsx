import React, { useState, useEffect, useRef, useCallback } from 'react';
import api, { fileAPI } from '../../services/api';
import { useSocket } from '../../contexts/SocketContext';
import { useAuth } from '../../contexts/AuthContext';
import { AttachIcon, SendIcon, ImageIcon, FileIcon, ReplyIcon, ForwardIcon, DownloadIcon, XIcon, DeleteIcon } from '../icons/Icons';

export interface Reaction {
  id: string;
  messageId: string;
  userId: string;
  emoji: string;
  createdAt: string;
  user?: {
    id: string;
    username: string;
    firstName: string;
    lastName: string;
  };
}

export interface ChannelMessage {
  id: string;
  channelId: string;
  senderId: string;
  content: string;
  type: string;
  fileUrl: string;
  fileName: string;
  fileSize: number;
  replyToId?: string;
  forwardedFromId?: string;
  isDeleted?: boolean;
  createdAt: string;
  sender?: {
    id: string;
    username: string;
    firstName: string;
    lastName: string;
    avatarUrl: string;
  };
  replyToMessage?: ChannelMessage;
  forwardedUser?: {
    id: string;
    username: string;
    firstName: string;
    lastName: string;
  };
  reactions?: Reaction[];
}

interface ChannelMessageThreadProps {
  channelId: string;
}

const FILE_BASE = '';

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function ChannelMessageThread({ channelId }: ChannelMessageThreadProps) {
  const { subscribe } = useSocket();
  const { user } = useAuth();
  const [messages, setMessages] = useState<ChannelMessage[]>([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [replyTo, setReplyTo] = useState<ChannelMessage | null>(null);
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<{ msg: ChannelMessage; x: number; y: number } | null>(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState<string | null>(null);
  const [emergencyFlash, setEmergencyFlash] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);

  const loadMessages = useCallback(async () => {
    try {
      const res = await api.get(`/channels/${channelId}/messages?limit=50`);
      setMessages(res.data);
    } catch (err) {
      console.error('[ChannelMsg] Failed to load messages:', err);
    }
  }, [channelId]);

  useEffect(() => {
    loadMessages();
  }, [loadMessages]);

  useEffect(() => {
    const unsub = subscribe('channel.message', (data: unknown) => {
      const msg = data as ChannelMessage;
      if (msg.channelId !== channelId) return;
      setMessages(prev => {
        if (prev.some(m => m.id === msg.id)) return prev;
        return [...prev, msg];
      });
    });
    return () => unsub();
  }, [subscribe, channelId]);

  useEffect(() => {
    const unsub1 = subscribe('channel.reaction', (data: unknown) => {
      const payload = data as { messageId: string; channelId: string; reactions: Reaction[] };
      if (payload.channelId !== channelId) return;
      setMessages(prev => prev.map(m =>
        m.id === payload.messageId ? { ...m, reactions: payload.reactions } : m
      ));
    });
    const unsub2 = subscribe('channel.message_deleted', (data: unknown) => {
      const payload = data as { messageId: string; channelId: string };
      if (payload.channelId !== channelId) return;
      setMessages(prev => prev.map(m =>
        m.id === payload.messageId ? { ...m, isDeleted: true, content: '', fileUrl: '', fileName: '' } : m
      ));
    });
    const unsub3 = subscribe('channel.emergency', (data: unknown) => {
      const msg = data as ChannelMessage;
      if (msg.channelId !== channelId) return;
      setEmergencyFlash(true);
      setTimeout(() => setEmergencyFlash(false), 5000);
    });
    return () => { unsub1(); unsub2(); unsub3(); };
  }, [subscribe, channelId]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || sending) return;
    const text = input.trim();
    setInput('');
    setSending(true);
    const replyId = replyTo?.id;
    setReplyTo(null);
    try {
      const res = await api.post(`/channels/${channelId}/messages`, {
        content: text,
        type: 'text',
        replyToId: replyId || undefined,
      });
      const newMsg = res.data as ChannelMessage;
      setMessages(prev => {
        if (prev.some(m => m.id === newMsg.id)) return prev;
        return [...prev, newMsg];
      });
    } catch (err) {
      console.error('[ChannelMsg] Failed to send:', err);
      setInput(text);
      if (replyId) setReplyTo(messages.find(m => m.id === replyId) || null);
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>, isImage: boolean) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';

    setUploading(true);
    try {
      const res = await fileAPI.uploadFile(file);
      const { url, name, size } = res.data;
      const msgRes = await api.post(`/channels/${channelId}/messages`, {
        type: isImage ? 'image' : 'file',
        fileUrl: url,
        fileName: name,
        fileSize: size,
        replyToId: replyTo?.id || undefined,
      });
      const newMsg = msgRes.data as ChannelMessage;
      setMessages(prev => {
        if (prev.some(m => m.id === newMsg.id)) return prev;
        return [...prev, newMsg];
      });
      setReplyTo(null);
    } catch (err) {
      console.error('[ChannelMsg] Failed to upload:', err);
    } finally {
      setUploading(false);
    }
  };

  const handleDownload = (msg: ChannelMessage) => {
    const link = document.createElement('a');
    link.href = FILE_BASE + msg.fileUrl;
    link.download = msg.fileName || 'download';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleForward = async (msg: ChannelMessage) => {
    setContextMenu(null);
    try {
      const res = await api.post(`/channels/${channelId}/messages`, {
        type: msg.type,
        content: msg.content,
        fileUrl: msg.fileUrl,
        fileName: msg.fileName,
        fileSize: msg.fileSize,
        forwardedFromId: msg.senderId,
      });
      const newMsg = res.data as ChannelMessage;
      setMessages(prev => {
        if (prev.some(m => m.id === newMsg.id)) return prev;
        return [...prev, newMsg];
      });
    } catch (err) {
      console.error('[ChannelMsg] Failed to forward:', err);
    }
  };

  const handleToggleReaction = async (msg: ChannelMessage, emoji: string) => {
    setShowEmojiPicker(null);
    try {
      const res = await api.post(`/channels/${channelId}/messages/${msg.id}/reactions`, { emoji });
      setMessages(prev => prev.map(m =>
        m.id === msg.id ? { ...m, reactions: res.data.reactions } : m
      ));
    } catch (err) {
      console.error('[ChannelMsg] Failed to toggle reaction:', err);
    }
  };

  const handleDelete = async (msg: ChannelMessage) => {
    setContextMenu(null);
    try {
      await api.delete(`/channels/${channelId}/messages/${msg.id}`);
      setMessages(prev => prev.map(m =>
        m.id === msg.id ? { ...m, isDeleted: true, content: '', fileUrl: '', fileName: '' } : m
      ));
    } catch (err) {
      console.error('[ChannelMsg] Failed to delete:', err);
    }
  };

  const handleEmergency = async () => {
    try {
      const res = await api.post(`/channels/${channelId}/emergency`, { content: 'EMERGENCY ALERT' });
      const newMsg = res.data as ChannelMessage;
      setMessages(prev => {
        if (prev.some(m => m.id === newMsg.id)) return prev;
        return [...prev, newMsg];
      });
      setEmergencyFlash(true);
      setTimeout(() => setEmergencyFlash(false), 5000);
    } catch (err) {
      console.error('[ChannelMsg] Failed to send emergency:', err);
    }
  };

  const handleContextMenu = (e: React.MouseEvent, msg: ChannelMessage) => {
    e.preventDefault();
    setContextMenu({ msg, x: e.clientX, y: e.clientY });
  };

  useEffect(() => {
    const close = () => setContextMenu(null);
    if (contextMenu) {
      document.addEventListener('click', close);
      return () => document.removeEventListener('click', close);
    }
  }, [contextMenu]);

  const getSenderName = (msg: ChannelMessage) => {
    if (msg.sender?.firstName) return msg.sender.firstName;
    if (msg.sender?.username) return msg.sender.username;
    return 'Unknown';
  };

  const getAvatarChar = (msg: ChannelMessage) => {
    const name = getSenderName(msg);
    return name.charAt(0).toUpperCase();
  };

  const renderMessageContent = (msg: ChannelMessage) => {
    if (msg.type === 'emergency') {
      return (
        <div className="ptt-msg-emergency">
          <span className="ptt-msg-emergency-icon">🚨</span>
          <span className="ptt-msg-emergency-text">{msg.content}</span>
        </div>
      );
    }
    if (msg.type === 'text') return <div className="ptt-msg-text">{msg.content}</div>;
    if (msg.type === 'image' && msg.fileUrl) {
      return (
        <div className="ptt-msg-image" onClick={() => setLightboxUrl(FILE_BASE + msg.fileUrl)}>
          <img src={FILE_BASE + msg.fileUrl} alt={msg.fileName} />
        </div>
      );
    }
    if (msg.type === 'file' && msg.fileUrl) {
      return (
        <div className="ptt-msg-file" onClick={() => handleDownload(msg)}>
          <FileIcon size={20} />
          <div className="ptt-msg-file-info">
            <span className="ptt-msg-file-name">{msg.fileName}</span>
            <span className="ptt-msg-file-size">{formatFileSize(msg.fileSize)}</span>
          </div>
          <DownloadIcon size={16} className="ptt-msg-file-dl" />
        </div>
      );
    }
    return null;
  };

  const getReplyPreviewText = (msg: ChannelMessage) => {
    if (msg.isDeleted) return 'Message deleted';
    if (msg.type === 'text') return msg.content.slice(0, 60);
    if (msg.type === 'image') return '📷 Photo';
    if (msg.type === 'file') return `📎 ${msg.fileName}`;
    if (msg.type === 'emergency') return '🚨 Emergency';
    return '';
  };

  const REACTIONS = ['👍', '❤️', '😂', '😮', '🎉', '👎', '🔥', '✅', '❌', '🙏', '👏', '💪', '🤔', '👀', '💯', '⭐', '🚀', '⚠️', '📞', '📍'];

  const renderReactions = (msg: ChannelMessage) => {
    if (!msg.reactions || msg.reactions.length === 0) return null;
    const grouped: Record<string, Reaction[]> = {};
    for (const r of msg.reactions) {
      if (!grouped[r.emoji]) grouped[r.emoji] = [];
      grouped[r.emoji].push(r);
    }
    return (
      <div className="ptt-msg-reactions">
        {Object.entries(grouped).map(([emoji, list]) => {
          const mine = list.some(r => r.userId === user?.id);
          return (
            <button
              key={emoji}
              className={`ptt-msg-reaction ${mine ? 'mine' : ''}`}
              onClick={() => handleToggleReaction(msg, emoji)}
            >
              <span className="ptt-reaction-emoji">{emoji}</span>
              <span className="ptt-reaction-count">{list.length}</span>
            </button>
          );
        })}
      </div>
    );
  };

  return (
    <div className="ptt-msg-thread">
      {emergencyFlash && (
        <div className="ptt-emergency-banner">
          <span>🚨 EMERGENCY ALERT</span>
        </div>
      )}
      <div className="ptt-msg-list" ref={scrollRef}>
        {messages.length === 0 && (
          <div className="ptt-msg-empty">
            <span>No messages yet</span>
          </div>
        )}
        {messages.map((msg) => {
          const isMe = msg.senderId === user?.id;
          return (
            <div
              key={msg.id}
              className={`ptt-msg ${isMe ? 'me' : ''}`}
              onContextMenu={(e) => handleContextMenu(e, msg)}
            >
              <div className="ptt-msg-avatar">
                {msg.sender?.avatarUrl ? (
                  <img src={msg.sender.avatarUrl} alt="" />
                ) : (
                  <span>{getAvatarChar(msg)}</span>
                )}
              </div>
              <div className="ptt-msg-body">
                <div className="ptt-msg-header">
                  <span className="ptt-msg-sender">{getSenderName(msg)}</span>
                  <span className="ptt-msg-time">{formatTime(msg.createdAt)}</span>
                </div>

                {msg.forwardedUser && (
                  <div className="ptt-msg-forwarded">
                    <ForwardIcon size={12} />
                    <span>Forwarded from {msg.forwardedUser.firstName || msg.forwardedUser.username}</span>
                  </div>
                )}

                {msg.replyToMessage && (
                  <div className="ptt-msg-reply-preview">
                    <span className="ptt-msg-reply-name">
                      {msg.replyToMessage.sender?.firstName || msg.replyToMessage.sender?.username || 'Unknown'}
                    </span>
                    <span className="ptt-msg-reply-text">{getReplyPreviewText(msg.replyToMessage)}</span>
                  </div>
                )}

                {msg.isDeleted ? (
                  <div className="ptt-msg-deleted">Message deleted</div>
                ) : (
                  <>
                    {renderMessageContent(msg)}
                    {renderReactions(msg)}
                  </>
                )}

                {!msg.isDeleted && (
                  <div className="ptt-msg-actions">
                    <button onClick={() => setShowEmojiPicker(showEmojiPicker === msg.id ? null : msg.id)} title="React">
                      <span style={{ fontSize: 14 }}>😀</span>
                    </button>
                    <button onClick={() => setReplyTo(msg)} title="Reply">
                      <ReplyIcon size={14} />
                    </button>
                    <button onClick={() => handleForward(msg)} title="Forward">
                      <ForwardIcon size={14} />
                    </button>
                    {msg.type === 'image' && msg.fileUrl && (
                      <button onClick={() => handleDownload(msg)} title="Download">
                        <DownloadIcon size={14} />
                      </button>
                    )}
                    {isMe && (
                      <button onClick={() => handleDelete(msg)} title="Delete" className="ptt-msg-action-delete">
                        <DeleteIcon size={14} />
                      </button>
                    )}
                  </div>
                )}

                {showEmojiPicker === msg.id && (
                  <div className="ptt-emoji-picker" onClick={(e) => e.stopPropagation()}>
                    {REACTIONS.map(emoji => (
                      <button key={emoji} onClick={() => handleToggleReaction(msg, emoji)}>
                        {emoji}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}
        {uploading && (
          <div className="ptt-msg-uploading">
            <div className="ptt-upload-spinner" />
            <span>Uploading...</span>
          </div>
        )}
      </div>

      {replyTo && (
        <div className="ptt-reply-bar">
          <div className="ptt-reply-bar-info">
            <ReplyIcon size={14} />
            <div className="ptt-reply-bar-text">
              <span className="ptt-reply-bar-name">{getSenderName(replyTo)}</span>
              <span className="ptt-reply-bar-preview">{getReplyPreviewText(replyTo)}</span>
            </div>
          </div>
          <button onClick={() => setReplyTo(null)} className="ptt-reply-bar-close">
            <XIcon size={16} />
          </button>
        </div>
      )}

      <div className="ptt-msg-input-bar">
        <button
          className="ptt-msg-attach-btn"
          onClick={() => imageInputRef.current?.click()}
          disabled={uploading}
          title="Send image"
        >
          <ImageIcon size={20} />
        </button>
        <button
          className="ptt-msg-attach-btn"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          title="Send file"
        >
          <AttachIcon size={20} />
        </button>
        <input
          ref={imageInputRef}
          type="file"
          accept="image/*"
          style={{ display: 'none' }}
          onChange={(e) => handleFileSelect(e, true)}
        />
        <input
          ref={fileInputRef}
          type="file"
          style={{ display: 'none' }}
          onChange={(e) => handleFileSelect(e, false)}
        />
        <input
          className="ptt-msg-input"
          type="text"
          placeholder={replyTo ? 'Reply...' : 'Type a message...'}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={sending}
        />
        <button
          className="ptt-msg-sos-btn"
          onClick={handleEmergency}
          title="Emergency Alert"
        >
          SOS
        </button>
        <button
          className="ptt-msg-send-btn"
          onClick={handleSend}
          disabled={!input.trim() || sending}
        >
          <SendIcon size={20} />
        </button>
      </div>

      {contextMenu && (
        <div
          className="ptt-msg-context-menu"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onClick={(e) => e.stopPropagation()}
        >
          <button onClick={() => { setReplyTo(contextMenu.msg); setContextMenu(null); }}>
            <ReplyIcon size={16} /> Reply
          </button>
          <button onClick={() => handleForward(contextMenu.msg)}>
            <ForwardIcon size={16} /> Forward
          </button>
          {contextMenu.msg.type === 'image' && contextMenu.msg.fileUrl && (
            <button onClick={() => { handleDownload(contextMenu.msg); setContextMenu(null); }}>
              <DownloadIcon size={16} /> Download
            </button>
          )}
          {contextMenu.msg.type === 'file' && contextMenu.msg.fileUrl && (
            <button onClick={() => { handleDownload(contextMenu.msg); setContextMenu(null); }}>
              <DownloadIcon size={16} /> Download
            </button>
          )}
          {contextMenu.msg.senderId === user?.id && !contextMenu.msg.isDeleted && (
            <button onClick={() => handleDelete(contextMenu.msg)} className="ptt-ctx-delete">
              <DeleteIcon size={16} /> Delete
            </button>
          )}
        </div>
      )}

      {lightboxUrl && (
        <div className="ptt-lightbox" onClick={() => setLightboxUrl(null)}>
          <button className="ptt-lightbox-close" onClick={() => setLightboxUrl(null)}>
            <XIcon size={28} />
          </button>
          <img src={lightboxUrl} alt="" onClick={(e) => e.stopPropagation()} />
          <a
            className="ptt-lightbox-download"
            href={lightboxUrl}
            download
            onClick={(e) => e.stopPropagation()}
          >
            <DownloadIcon size={20} /> Download
          </a>
        </div>
      )}
    </div>
  );
}
