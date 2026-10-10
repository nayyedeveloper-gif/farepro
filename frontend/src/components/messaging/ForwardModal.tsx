import React, { useState, useEffect } from 'react';
import { messageAPI } from '../../services/api';
import { XIcon } from '../icons/Icons';
import MediaTypeLabel from '../common/MediaTypeLabel';
import type { Conversation, Message } from '../../types';

interface ForwardModalProps {
  message: Message;
  onClose: () => void;
}

const ForwardModal: React.FC<ForwardModalProps> = ({ message, onClose }) => {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const [selectedConversationId, setSelectedConversationId] = useState<string | null>(null);

  useEffect(() => {
    const loadConversations = async () => {
      setLoading(true);
      try {
        const res = await messageAPI.getConversations();
        const convs = Array.isArray(res.data) ? res.data : res.data.conversations || [];
        setConversations(convs);
      } catch (error) {
        console.error('Failed to load conversations:', error);
      } finally {
        setLoading(false);
      }
    };
    loadConversations();
  }, []);

  const handleForward = async () => {
    if (!selectedConversationId) return;
    setSending(true);
    try {
      await messageAPI.sendMessage(selectedConversationId, {
        content: message.content || '',
        messageType: message.messageType,
        fileUrl: message.fileUrl,
        forwardedFrom: message.senderId,
      });
      onClose();
    } catch (error) {
      console.error('Failed to forward message:', error);
    } finally {
      setSending(false);
    }
  };

  const getConversationName = (conv: Conversation) => {
    if (conv.name) return conv.name;
    if (conv.participants?.length) {
      return conv.participants
        .map((p) => p.firstName || p.username)
        .join(', ') || 'Conversation';
    }
    return 'Conversation';
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content forward-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Forward Message</h2>
          <button className="modal-close" onClick={onClose}>
            <XIcon size={20} />
          </button>
        </div>
        <div className="modal-body">
          <div className="forward-message-preview">
            <p className="forward-preview-text">
              {message.messageType === 'image' || message.messageType === 'video' || message.messageType === 'audio' || message.messageType === 'file' ? (
                <MediaTypeLabel type={message.messageType === 'file' ? 'file' : message.messageType} />
              ) : (
                message.content?.substring(0, 100) || 'Message'
              )}
            </p>
          </div>
          <div className="forward-conversations">
            {loading ? (
              <p className="loading">Loading conversations...</p>
            ) : conversations.length === 0 ? (
              <p className="empty-state">No conversations</p>
            ) : (
              conversations.map((conv) => (
                <div
                  key={conv.id}
                  className={`forward-conversation-item ${selectedConversationId === conv.id ? 'selected' : ''}`}
                  onClick={() => setSelectedConversationId(conv.id)}
                >
                  <div className="forward-conversation-avatar">
                    {conv.avatarUrl ? (
                      <img src={conv.avatarUrl} alt="" />
                    ) : (
                      <span>{getConversationName(conv).charAt(0).toUpperCase()}</span>
                    )}
                  </div>
                  <div className="forward-conversation-info">
                    <span className="forward-conversation-name">{getConversationName(conv)}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
        <div className="modal-footer">
          <button
            className="modal-btn secondary"
            onClick={onClose}
            disabled={sending}
          >
            Cancel
          </button>
          <button
            className="modal-btn primary"
            onClick={handleForward}
            disabled={!selectedConversationId || sending}
          >
            {sending ? 'Sending...' : 'Forward'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ForwardModal;
