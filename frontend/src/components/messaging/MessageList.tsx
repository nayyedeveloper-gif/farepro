import React, { useEffect, useState, useRef, useCallback } from 'react';
import type { Message } from '../../types';
import type { CallHistoryItem } from '../../types';
import { messageAPI, callAPI } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { useSocket } from '../../contexts/SocketContext';
import {
  FileIcon, DoubleCheckIcon,
  ReplyIcon, ForwardIcon, EditIcon, DeleteIcon, CopyIcon,
  VideoIcon, PhoneMissedIcon, PhoneIncomingIcon, PhoneOutgoingIcon,
  EyeIcon, BookmarkIcon, XIcon,
} from '../icons/Icons';
import VoiceMessagePlayer from './VoiceMessagePlayer';
import MediaTypeLabel from '../common/MediaTypeLabel';
import ImageViewerModal from '../common/ImageViewerModal';

interface MessageListProps {
  conversationId: string | null;
  refreshTrigger?: number;
  onReply?: (msg: Message) => void;
  onForward?: (msg: Message) => void;
}

type ContextMenu = {
  msgId: string;
  x: number;
  y: number;
};

const MessageList: React.FC<MessageListProps> = ({ conversationId, refreshTrigger, onReply, onForward }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [callEvents, setCallEvents] = useState<CallHistoryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [contextMenu, setContextMenu] = useState<ContextMenu | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [viewerImageUrl, setViewerImageUrl] = useState<string | null>(null);
  const [infoMessageId, setInfoMessageId] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const editInputRef = useRef<HTMLInputElement>(null);
  const { user } = useAuth();
  const { subscribe } = useSocket();

  const loadMessages = useCallback(async () => {
    if (!conversationId) return;
    setLoading(true);
    try {
      const msgRes = await messageAPI.getMessages(conversationId);
      setMessages(Array.isArray(msgRes.data) ? msgRes.data : []);
    } catch (error) {
      console.error('Failed to load messages:', error);
    } finally {
      setLoading(false);
    }
    // Load call events independently - failure must NOT affect messages
    callAPI.getConversationCalls(conversationId)
      .then((r) => setCallEvents(Array.isArray(r.data) ? r.data : []))
      .catch(() => { /* non-critical */ });
  }, [conversationId]);

  useEffect(() => {
    if (conversationId) loadMessages();
  }, [conversationId, refreshTrigger, loadMessages]);

  useEffect(() => {
    const unsub = subscribe('message.new', (data) => {
      const msg = data as Message;
      if (msg.conversationId === conversationId) {
        setMessages((prev) => {
          if (prev.some((m) => m.id === msg.id)) return prev;
          return [...prev, msg];
        });
      }
    });
    const unsubEdit = subscribe('message.edited', (data) => {
      const msg = data as Message;
      if (msg.conversationId === conversationId) {
        setMessages((prev) => prev.map((m) => m.id === msg.id ? { ...m, content: msg.content, isEdited: true } : m));
      }
    });
    const unsubDel = subscribe('message.deleted', (data) => {
      const d = data as { messageId: string };
      setMessages((prev) => prev.map((m) => m.id === d.messageId ? { ...m, isDeleted: true } : m));
    });
    const unsubPin = subscribe('message.pinned', (data) => {
      const d = data as { messageId: string; isPinned: boolean };
      setMessages((prev) => prev.map((m) => m.id === d.messageId ? { ...m, isPinned: d.isPinned } : m));
    });
    const unsubCall = subscribe('call.ended', (data) => {
      const d = data as { call?: { conversationId?: string } };
      const evtConvId = d?.call?.conversationId;
      if (conversationId && (!evtConvId || evtConvId === conversationId)) {
        callAPI.getConversationCalls(conversationId).then((r) => setCallEvents(Array.isArray(r.data) ? r.data : []));
      }
    });
    const unsubCallMissed = subscribe('call.missed', (data) => {
      const d = data as { call?: { conversationId?: string } };
      const evtConvId = d?.call?.conversationId;
      if (conversationId && (!evtConvId || evtConvId === conversationId)) {
        callAPI.getConversationCalls(conversationId).then((r) => setCallEvents(Array.isArray(r.data) ? r.data : []));
      }
    });
    return () => { unsub(); unsubEdit(); unsubDel(); unsubPin(); unsubCall(); unsubCallMissed(); };
  }, [conversationId, subscribe]);

  useEffect(() => { scrollToBottom(); }, [messages, callEvents]);

  useEffect(() => {
    if (editingId && editInputRef.current) editInputRef.current.focus();
  }, [editingId]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  };

  const formatCallDuration = (start: string, end?: string) => {
    if (!end) return '';
    const secs = Math.floor((new Date(end).getTime() - new Date(start).getTime()) / 1000);
    if (secs < 60) return `${secs}s`;
    return `${Math.floor(secs / 60)}m ${secs % 60}s`;
  };

  const handleContextMenu = (e: React.MouseEvent, msgId: string) => {
    e.preventDefault();
    e.stopPropagation();
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setContextMenu({ msgId, x: e.clientX, y: e.clientY });
    void rect;
  };

  const closeContextMenu = () => setContextMenu(null);

  const handleCopy = (msg: Message) => {
    if (msg.content) navigator.clipboard.writeText(msg.content);
    closeContextMenu();
  };

  const startEdit = (msg: Message) => {
    setEditingId(msg.id);
    setEditContent(msg.content || '');
    closeContextMenu();
  };

  const submitEdit = async (msgId: string) => {
    if (!editContent.trim()) return;
    try {
      await messageAPI.updateMessage(msgId, { content: editContent.trim() });
      setMessages((prev) => prev.map((m) => m.id === msgId ? { ...m, content: editContent.trim(), isEdited: true } : m));
    } catch { /* ignore */ }
    setEditingId(null);
  };

  const handleDelete = async (msgId: string) => {
    try {
      await messageAPI.deleteMessage(msgId);
      setMessages((prev) => prev.map((m) => m.id === msgId ? { ...m, isDeleted: true } : m));
    } catch { /* ignore */ }
    setDeleteConfirmId(null);
    closeContextMenu();
  };

  const handleShowInfo = (msg: Message) => {
    setInfoMessageId(msg.id);
    closeContextMenu();
  };

  const handlePinMessage = async (msg: Message) => {
    try {
      if (msg.isPinned) {
        await messageAPI.unpinMessage(msg.id);
        setMessages((prev) => prev.map((m) => m.id === msg.id ? { ...m, isPinned: false } : m));
      } else {
        await messageAPI.pinMessage(msg.id);
        setMessages((prev) => prev.map((m) => m.id === msg.id ? { ...m, isPinned: true } : m));
      }
    } catch { /* ignore */ }
    closeContextMenu();
  };

  const handleDownload = (msg: Message) => {
    if (!msg.fileUrl) return;
    const link = document.createElement('a');
    link.href = msg.fileUrl;
    link.download = msg.content || 'download';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    closeContextMenu();
  };

  const handleLongPress = (msg: Message) => {
    handleDownload(msg);
  };

  const [longPressTimer, setLongPressTimer] = useState<number | null>(null);

  const handleTouchStart = (msg: Message) => {
    const timer = window.setTimeout(() => handleLongPress(msg), 500);
    setLongPressTimer(timer);
  };

  const handleTouchEnd = () => {
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      setLongPressTimer(null);
    }
  };

  const handleTouchMove = () => {
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      setLongPressTimer(null);
    }
  };

  const renderCallEvent = (call: CallHistoryItem) => {
    const isOutgoing = call.initiatedBy === user?.id;
    const isMissed = !isOutgoing && (call.callResult === 'missed' || call.callResult === 'rejected');
    const duration = formatCallDuration(call.startedAt, call.endedAt);

    let Icon: React.FC<{ size?: number; className?: string }> = isOutgoing ? PhoneOutgoingIcon : PhoneIncomingIcon;
    let label = '';
    if (isMissed) {
      Icon = PhoneMissedIcon;
      label = 'Missed call';
    } else if (isOutgoing) {
      label = call.callResult === 'cancelled' ? 'Cancelled call' : 'Outgoing call';
    } else {
      label = call.callResult === 'rejected' ? 'Declined call' : 'Incoming call';
    }
    if (call.callType === 'video') label = label.replace('call', 'video call');

    return (
      <div key={`call-${call.id}`} className={`chat-call-event ${isOutgoing ? 'outgoing' : 'incoming'} ${isMissed ? 'missed' : ''}`}>
        <div className="chat-call-icon">
          {call.callType === 'video' ? <VideoIcon size={18} /> : <Icon size={18} />}
        </div>
        <div className="chat-call-body">
          <span className="chat-call-label">{label}</span>
          {duration && <span className="chat-call-duration">· {duration}</span>}
        </div>
        <span className="chat-call-time">{formatTime(call.startedAt)}</span>
      </div>
    );
  };

  const linkify = (text: string) => {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    return text.split(urlRegex).map((part, index) => {
      if (part.match(urlRegex)) {
        return (
          <a
            key={index}
            href={part}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
          >
            {part}
          </a>
        );
      }
      return part;
    });
  };

  const renderMessageStatus = (message: Message, isOwnMessage: boolean) => {
    if (!isOwnMessage) return null;
    
    const status = message.status || 'sent';
    
    if (status === 'seen') {
      return <DoubleCheckIcon size={14} className="message-check seen" />;
    }
    if (status === 'delivered') {
      return <DoubleCheckIcon size={14} className="message-check delivered" />;
    }
    return <DoubleCheckIcon size={14} className="message-check sent" />;
  };

  const renderMessageContent = (message: Message) => {
    if (message.messageType === 'image' && message.fileUrl) {
      return (
        <div className="message-image">
          <img
            src={message.fileUrl}
            alt={message.content}
            onClick={() => setViewerImageUrl(message.fileUrl || null)}
            onContextMenu={(e) => handleContextMenu(e, message.id)}
            onTouchStart={() => handleTouchStart(message)}
            onTouchEnd={handleTouchEnd}
            onTouchMove={handleTouchMove}
          />
        </div>
      );
    }

    if (message.messageType === 'video' && message.fileUrl) {
      return (
        <div className="message-video">
          <video src={message.fileUrl} controls />
        </div>
      );
    }

    if (message.messageType === 'audio' && message.fileUrl) {
      return (
        <div className="message-audio">
          <VoiceMessagePlayer audioUrl={message.fileUrl} />
        </div>
      );
    }

    if (message.messageType === 'file' && message.fileUrl) {
      return (
        <div
          className="message-file"
          onContextMenu={(e) => handleContextMenu(e, message.id)}
          onTouchStart={() => handleTouchStart(message)}
          onTouchEnd={handleTouchEnd}
          onTouchMove={handleTouchMove}
        >
          <FileIcon size={24} />
          <a href={message.fileUrl} target="_blank" rel="noopener noreferrer">
            {message.content}
          </a>
        </div>
      );
    }

    return <div className="message-text">{linkify(message.content || '')}</div>;
  };

  const renderReplyPreview = (message: Message) => {
    if (!message.replyToMessage) return null;
    const replyMsg = message.replyToMessage;
    return (
      <div className="message-reply-preview">
        <ReplyIcon size={12} />
        <div className="reply-preview-content">
          <span className="reply-preview-sender">
            {replyMsg.sender?.firstName || replyMsg.sender?.username || 'User'}
          </span>
          <span className="reply-preview-text">
            {replyMsg.messageType === 'image' || replyMsg.messageType === 'video' || replyMsg.messageType === 'audio' || replyMsg.messageType === 'file' ? (
              <MediaTypeLabel type={replyMsg.messageType === 'file' ? 'file' : replyMsg.messageType} />
            ) : (
              replyMsg.content?.substring(0, 30) || 'Message'
            )}
          </span>
        </div>
      </div>
    );
  };

  if (!conversationId) {
    return (
      <div className="message-list empty">
        <p>Select a conversation to start messaging</p>
      </div>
    );
  }

  // Merge messages and call events into a single sorted timeline
  type TimelineItem =
    | { kind: 'message'; ts: number; data: Message }
    | { kind: 'call'; ts: number; data: CallHistoryItem };

  const pinnedMessages = messages.filter((m) => m.isPinned);
  const regularMessages = messages.filter((m) => !m.isPinned);

  // Deduplicate call events by ID
  const uniqueCallEvents = Array.from(
    new Map(callEvents.map((c) => [c.id, c])).values()
  );

  const timeline: TimelineItem[] = [
    ...regularMessages.map((m) => ({ kind: 'message' as const, ts: new Date(m.createdAt).getTime(), data: m })),
    ...uniqueCallEvents.map((c) => ({ kind: 'call' as const, ts: new Date(c.startedAt).getTime(), data: c })),
  ].sort((a, b) => a.ts - b.ts);

  const activeCtxMsg = contextMenu ? messages.find((m) => m.id === contextMenu.msgId) : null;
  const isOwnCtx = activeCtxMsg?.senderId === user?.id;

  return (
    <div className="message-list" onClick={closeContextMenu}>
      {loading ? (
        <div className="loading">Loading messages...</div>
      ) : timeline.length === 0 ? (
        <div className="empty-state">
          <p>No messages yet</p>
          <p className="hint">Send a message to start the conversation</p>
        </div>
      ) : (
        <div className="messages">
          {pinnedMessages.length > 0 && (
            <div className="pinned-messages-section">
              <div className="pinned-messages-header">
                <BookmarkIcon size={16} />
                <span>Pinned Messages</span>
              </div>
              {pinnedMessages.map((message) => {
                const isOwnMessage = message.senderId === user?.id;
                return (
                  <div
                    key={message.id}
                    className={`message ${isOwnMessage ? 'own' : 'other'} ${message.isDeleted ? 'deleted' : ''} pinned`}
                  >
                    <div className="message-row">
                      <div
                        className="message-bubble"
                        onContextMenu={(e) => !message.isDeleted && handleContextMenu(e, message.id)}
                      >
                        {message.isDeleted ? (
                          <div className="message-content deleted">
                            <em>{isOwnMessage ? 'You deleted this message' : 'This message was deleted'}</em>
                          </div>
                        ) : (
                          <>
                            {renderReplyPreview(message)}
                            <div className="message-content">
                              {renderMessageContent(message)}
                            </div>
                            <div className="message-meta">
                              {message.forwardedFrom && <span className="forwarded">forwarded</span>}
                              {message.isEdited && <span className="edited">edited</span>}
                              <span className="message-time">{formatTime(message.createdAt)}</span>
                              {renderMessageStatus(message, isOwnMessage)}
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
          {timeline.map((item) => {
            if (item.kind === 'call') {
              return renderCallEvent(item.data);
            }
            const message = item.data;
            const isOwnMessage = message.senderId === user?.id;
            const isEditing = editingId === message.id;

            return (
              <div
                key={message.id}
                className={`message ${isOwnMessage ? 'own' : 'other'} ${message.isDeleted ? 'deleted' : ''}`}
              >
                <div className="message-row">
                  <div
                    className="message-bubble"
                    onContextMenu={(e) => !message.isDeleted && handleContextMenu(e, message.id)}
                  >
                    {message.isDeleted ? (
                      <div className="message-content deleted">
                        <em>{isOwnMessage ? 'You deleted this message' : 'This message was deleted'}</em>
                      </div>
                    ) : isEditing ? (
                      <div className="message-edit-inline">
                        <input
                          ref={editInputRef}
                          value={editContent}
                          onChange={(e) => setEditContent(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') submitEdit(message.id);
                            if (e.key === 'Escape') setEditingId(null);
                          }}
                          className="message-edit-input"
                        />
                        <div className="message-edit-actions">
                          <button onClick={() => submitEdit(message.id)} className="msg-edit-save">Save</button>
                          <button onClick={() => setEditingId(null)} className="msg-edit-cancel">Cancel</button>
                        </div>
                      </div>
                    ) : (
                      <>
                        {renderReplyPreview(message)}
                        <div className="message-content">
                          {renderMessageContent(message)}
                        </div>
                        <div className="message-meta">
                          {message.forwardedFrom && <span className="forwarded">forwarded</span>}
                          {message.isEdited && <span className="edited">edited</span>}
                          <span className="message-time">{formatTime(message.createdAt)}</span>
                          {renderMessageStatus(message, isOwnMessage)}
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
          <div ref={messagesEndRef} />
        </div>
      )}

      {/* Context Menu */}
      {contextMenu && activeCtxMsg && !activeCtxMsg.isDeleted && (
        <div
          className="msg-context-menu"
          style={{ top: contextMenu.y, left: contextMenu.x }}
          onClick={(e) => e.stopPropagation()}
        >
          <button onClick={() => { onReply?.(activeCtxMsg); closeContextMenu(); }}>
            <ReplyIcon size={15} /> Reply
          </button>
          <button onClick={() => { onForward?.(activeCtxMsg); closeContextMenu(); }}>
            <ForwardIcon size={15} /> Forward
          </button>
          <button onClick={() => handleShowInfo(activeCtxMsg)}>
            <EyeIcon size={15} /> Info
          </button>
          <button onClick={() => handlePinMessage(activeCtxMsg)}>
            <BookmarkIcon size={15} /> {activeCtxMsg.isPinned ? 'Unpin' : 'Pin'}
          </button>
          {(activeCtxMsg.messageType === 'image' || activeCtxMsg.messageType === 'video' || activeCtxMsg.messageType === 'audio' || activeCtxMsg.messageType === 'file') && (
            <button onClick={() => handleDownload(activeCtxMsg)}>
              <FileIcon size={15} /> Download
            </button>
          )}
          {activeCtxMsg.messageType === 'text' && (
            <button onClick={() => handleCopy(activeCtxMsg)}>
              <CopyIcon size={15} /> Copy
            </button>
          )}
          {isOwnCtx && activeCtxMsg.messageType === 'text' && (
            <button onClick={() => startEdit(activeCtxMsg)}>
              <EditIcon size={15} /> Edit
            </button>
          )}
          {isOwnCtx && (
            <button
              className="danger"
              onClick={() => { setDeleteConfirmId(activeCtxMsg.id); closeContextMenu(); }}
            >
              <DeleteIcon size={15} /> Delete
            </button>
          )}
        </div>
      )}

      {/* Delete Confirm Dialog */}
      {deleteConfirmId && (
        <div className="msg-delete-overlay" onClick={() => setDeleteConfirmId(null)}>
          <div className="msg-delete-dialog" onClick={(e) => e.stopPropagation()}>
            <p>Delete this message?</p>
            <div className="msg-delete-actions">
              <button onClick={() => setDeleteConfirmId(null)}>Cancel</button>
              <button className="danger" onClick={() => handleDelete(deleteConfirmId)}>Delete</button>
            </div>
          </div>
        </div>
      )}

      {/* Image Viewer Modal */}
      {viewerImageUrl && (
        <ImageViewerModal imageUrl={viewerImageUrl} onClose={() => setViewerImageUrl(null)} />
      )}

      {/* Message Info Modal */}
      {infoMessageId && (
        <div className="msg-info-overlay" onClick={() => setInfoMessageId(null)}>
          <div className="msg-info-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="msg-info-header">
              <h3>Message Info</h3>
              <button onClick={() => setInfoMessageId(null)} className="msg-info-close">
                <XIcon size={20} />
              </button>
            </div>
            <div className="msg-info-content">
              {(() => {
                const msg = messages.find((m) => m.id === infoMessageId);
                if (!msg) return null;
                return (
                  <>
                    <div className="msg-info-row">
                      <span className="msg-info-label">Sent</span>
                      <span className="msg-info-value">{formatTime(msg.createdAt)}</span>
                    </div>
                    <div className="msg-info-row">
                      <span className="msg-info-label">Status</span>
                      <span className={`msg-info-value status-${msg.status || 'sent'}`}>
                        {msg.status === 'seen' ? 'Seen' : msg.status === 'delivered' ? 'Delivered' : 'Sent'}
                      </span>
                    </div>
                    {msg.isEdited && (
                      <div className="msg-info-row">
                        <span className="msg-info-label">Edited</span>
                        <span className="msg-info-value">{formatTime(msg.updatedAt)}</span>
                      </div>
                    )}
                    {msg.isPinned && (
                      <div className="msg-info-row">
                        <span className="msg-info-label">Pinned</span>
                        <span className="msg-info-value">Yes</span>
                      </div>
                    )}
                    <div className="msg-info-row">
                      <span className="msg-info-label">From</span>
                      <span className="msg-info-value">
                        {msg.sender?.firstName || msg.sender?.username || 'Unknown'}
                      </span>
                    </div>
                  </>
                );
              })()}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MessageList;
