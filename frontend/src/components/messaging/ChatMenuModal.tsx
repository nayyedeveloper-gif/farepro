import React, { useState } from 'react';
import type { Conversation } from '../../types';
import { useAuth } from '../../contexts/AuthContext';
import { messageAPI } from '../../services/api';
import { XIcon, TrashIcon } from '../icons/Icons';

interface ChatMenuModalProps {
  conversation: Conversation;
  onClose: () => void;
  onDeleted: () => void;
}

const ChatMenuModal: React.FC<ChatMenuModalProps> = ({ conversation, onClose, onDeleted }) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [confirmAction, setConfirmAction] = useState<'leave' | 'deleteAll' | null>(null);

  const isOwner = conversation.createdBy === user?.id;
  const isGroup = conversation.type === 'group';
  const isChannel = conversation.type === 'channel';
  const isPrivate = conversation.type === 'private';

  const leaveLabel = isGroup ? 'Leave Group' : isChannel ? 'Leave Channel' : 'Delete Chat';
  const deleteForEveryoneLabel = isGroup ? 'Delete Group for Everyone' : 'Delete Channel for Everyone';

  const handleLeave = async () => {
    setLoading(true);
    try {
      await messageAPI.deleteConversation(conversation.id, false);
      onDeleted();
      onClose();
    } catch (err) {
      console.error('Failed to leave conversation:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteForEveryone = async () => {
    setLoading(true);
    try {
      await messageAPI.deleteConversation(conversation.id, true);
      onDeleted();
      onClose();
    } catch (err) {
      console.error('Failed to delete conversation:', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="chat-menu-overlay" onClick={onClose}>
      <div className="chat-menu-panel" onClick={(e) => e.stopPropagation()}>
        <div className="chat-menu-header">
          <h3>Chat Options</h3>
          <button type="button" className="chat-menu-close" onClick={onClose} aria-label="Close">
            <XIcon size={18} />
          </button>
        </div>

        <div className="chat-menu-actions">
          {!confirmAction ? (
            <>
              <button
                type="button"
                className="chat-menu-item danger"
                onClick={() => setConfirmAction('leave')}
                disabled={loading}
              >
                <TrashIcon size={18} />
                <span>{leaveLabel}</span>
              </button>
              {(isGroup || isChannel) && isOwner && (
                <button
                  type="button"
                  className="chat-menu-item danger"
                  onClick={() => setConfirmAction('deleteAll')}
                  disabled={loading}
                >
                  <TrashIcon size={18} />
                  <span>{deleteForEveryoneLabel}</span>
                </button>
              )}
            </>
          ) : (
            <div className="chat-menu-confirm">
              <p>
                {confirmAction === 'deleteAll'
                  ? `Delete this ${isGroup ? 'group' : 'channel'} for all members? This cannot be undone.`
                  : isPrivate
                    ? 'Delete this chat from your list?'
                    : `Leave this ${isGroup ? 'group' : 'channel'}?`}
              </p>
              <div className="chat-menu-confirm-actions">
                <button type="button" className="chat-menu-cancel" onClick={() => setConfirmAction(null)} disabled={loading}>
                  Cancel
                </button>
                <button
                  type="button"
                  className="chat-menu-confirm-btn danger"
                  onClick={confirmAction === 'deleteAll' ? handleDeleteForEveryone : handleLeave}
                  disabled={loading}
                >
                  {confirmAction === 'deleteAll' ? deleteForEveryoneLabel : leaveLabel}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ChatMenuModal;
