import React, { useEffect, useState, useCallback } from 'react';
import type { Conversation } from '../../types';
import { messageAPI } from '../../services/api';
import { useAuth } from '../../contexts/AuthContext';
import { useSocket } from '../../contexts/SocketContext';
import { ChatsIcon, TrashIcon } from '../icons/Icons';
import MediaTypeLabel from '../common/MediaTypeLabel';
import ListSkeleton from '../common/ListSkeleton';

interface ConversationListProps {
  onSelectConversation: (conversation: Conversation) => void;
  selectedConversationId: string | null;
  refreshTrigger?: number;
  searchQuery?: string;
  filterTab?: 'all' | 'unread';
  onConversationDeleted?: () => void;
}

const ConversationList: React.FC<ConversationListProps> = ({
  onSelectConversation,
  selectedConversationId,
  refreshTrigger,
  searchQuery = '',
  filterTab = 'all',
  onConversationDeleted,
}) => {
  const { user } = useAuth();
  const { subscribe } = useSocket();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; conversation: Conversation } | null>(null);

  const loadConversations = useCallback(async () => {
    try {
      const response = await messageAPI.getConversations();
      setConversations(Array.isArray(response.data) ? response.data : []);
    } catch (error) {
      console.error('Failed to load conversations:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadConversations();
  }, [refreshTrigger, loadConversations]);

  useEffect(() => {
    const unsub = subscribe('message.new', (data) => {
      const msg = data as { id: string; conversationId: string; senderId: string; content?: string; messageType: string; createdAt: string; updatedAt: string };
      setConversations((prev) => {
        const idx = prev.findIndex((c) => c.id === msg.conversationId);
        if (idx === -1) {
          loadConversations();
          return prev;
        }
        const updated = [...prev];
        const conv = { ...updated[idx] };
        if (msg.senderId !== user?.id) {
          conv.unreadCount = (conv.unreadCount || 0) + 1;
        }
        conv.lastMessage = msg as any;
        conv.updatedAt = msg.createdAt || new Date().toISOString();
        updated.splice(idx, 1);
        return [conv, ...updated];
      });
    });
    return unsub;
  }, [subscribe, user?.id, loadConversations]);

  useEffect(() => {
    const unsub = subscribe('conversation.deleted', (data) => {
      const d = data as { conversationId: string; userId?: string; forEveryone?: boolean };
      if (d.forEveryone || d.userId === user?.id) {
        setConversations((prev) => prev.filter((c) => c.id !== d.conversationId));
        if (selectedConversationId === d.conversationId) {
          onConversationDeleted?.();
        }
      }
    });
    return unsub;
  }, [subscribe, user?.id, selectedConversationId, onConversationDeleted]);

  useEffect(() => {
    const close = () => setContextMenu(null);
    window.addEventListener('click', close);
    return () => window.removeEventListener('click', close);
  }, []);

  const getDeleteLabel = (conversation: Conversation) => {
    if (conversation.type === 'group') return 'Leave Group';
    if (conversation.type === 'channel') return 'Leave Channel';
    return 'Delete Chat';
  };

  const handleDeleteConversation = async (conversation: Conversation) => {
    setContextMenu(null);
    try {
      await messageAPI.deleteConversation(conversation.id, false);
      setConversations((prev) => prev.filter((c) => c.id !== conversation.id));
      if (selectedConversationId === conversation.id) {
        onConversationDeleted?.();
      }
    } catch (err) {
      console.error('Failed to delete conversation:', err);
    }
  };

  const getConversationName = (conversation: Conversation) => {
    if (conversation.name) return conversation.name;
    if (conversation.participants?.length) {
      const names = conversation.participants
        .filter((p) => p.id !== user?.id)
        .map((p) => p.firstName || p.username)
        .join(', ');
      return names || 'Unknown';
    }
    return 'Unknown';
  };

  const getConversationAvatar = (conversation: Conversation) => {
    if (conversation.avatarUrl) return conversation.avatarUrl;
    return conversation.participants?.find((p) => p.id !== user?.id)?.avatarUrl;
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays === 0) return date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    if (diffDays === 1) return 'Yesterday';
    if (diffDays < 7) return date.toLocaleDateString([], { weekday: 'short' });
    return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  const renderPreview = (conversation: Conversation) => {
    if (conversation.lastMessage) {
      const msg = conversation.lastMessage;
      const isMe = msg.senderId === user?.id;
      const prefix = isMe ? 'You: ' : '';
      if (msg.messageType === 'audio' || msg.messageType === 'image' || msg.messageType === 'video' || msg.messageType === 'file') {
        return <MediaTypeLabel type={msg.messageType} prefix={prefix} />;
      }
      return `${prefix}${msg.content || ''}`;
    }
    if (conversation.type === 'group') return 'Group';
    if (conversation.type === 'channel') return 'Channel';
    const other = conversation.participants?.find((p) => p.id !== user?.id);
    if (other?.isOnline) return 'online';
    return 'last seen recently';
  };

  const filtered = conversations.filter((c) => {
    if (filterTab === 'unread' && !(c.unreadCount && c.unreadCount > 0)) return false;
    if (!searchQuery.trim()) return true;
    return getConversationName(c).toLowerCase().includes(searchQuery.toLowerCase());
  });

  return (
    <div className="conversation-list">
      {loading ? (
        <ListSkeleton count={8} />
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon-wrap">
            <ChatsIcon size={32} />
          </div>
          <p>{filterTab === 'unread' ? 'No unread chats' : 'No conversations yet'}</p>
          <p className="hint">Tap the compose icon to start chatting</p>
        </div>
      ) : (
        <ul>
          {filtered.map((conversation) => (
            <li
              key={conversation.id}
              className={selectedConversationId === conversation.id ? 'selected' : ''}
              onClick={() => {
                setConversations((prev) =>
                  prev.map((c) => (c.id === conversation.id ? { ...c, unreadCount: 0 } : c))
                );
                onSelectConversation(conversation);
              }}
              onContextMenu={(e) => {
                e.preventDefault();
                setContextMenu({ x: e.clientX, y: e.clientY, conversation });
              }}
            >
              <div className="conversation-avatar">
                {getConversationAvatar(conversation) ? (
                  <img src={getConversationAvatar(conversation)} alt="" />
                ) : (
                  <div className="avatar-placeholder">
                    {getConversationName(conversation).charAt(0)}
                  </div>
                )}
              </div>
              <div className="conversation-info">
                <div className="conversation-row">
                  <div className="conversation-name">{getConversationName(conversation)}</div>
                  <div className="conversation-time">
                    {formatTime(conversation.lastMessage?.createdAt || conversation.updatedAt)}
                  </div>
                </div>
                <div className="conversation-row">
                  <div className="conversation-preview">{renderPreview(conversation)}</div>
                  {(conversation.unreadCount || 0) > 0 && selectedConversationId !== conversation.id && (
                    <div className="unread-badge">
                      {conversation.unreadCount! > 99 ? '99+' : conversation.unreadCount}
                    </div>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      {contextMenu && (
        <div
          className="msg-context-menu conv-context-menu"
          style={{ top: contextMenu.y, left: contextMenu.x }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            className="danger"
            onClick={() => handleDeleteConversation(contextMenu.conversation)}
          >
            <TrashIcon size={15} /> {getDeleteLabel(contextMenu.conversation)}
          </button>
        </div>
      )}
    </div>
  );
};

export default ConversationList;
