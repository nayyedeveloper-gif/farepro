import React, { useState, useEffect } from 'react';
import type { Conversation, Message } from '../../types';
import { messageAPI } from '../../services/api';
import {
  ImageIcon,
  VideoIcon,
  FileIcon,
  LinkIcon,
  UserIcon,
  XIcon,
  UserPlusIcon,
  EditIcon,
} from '../icons/Icons';

interface GroupInfoProps {
  conversation: Conversation;
  onClose: () => void;
  onEditConversation: () => void;
  onAddMembers: () => void;
}

type TabType = 'media' | 'voice' | 'file' | 'link' | 'participants';

const GroupInfo: React.FC<GroupInfoProps> = ({
  conversation,
  onClose,
  onEditConversation,
  onAddMembers,
}) => {
  const [activeTab, setActiveTab] = useState<TabType>('participants');
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (conversation.id) {
      loadMessages();
    }
  }, [conversation.id]);

  const loadMessages = async () => {
    setLoading(true);
    try {
      const res = await messageAPI.getMessages(conversation.id, 100);
      setMessages(res.data || []);
    } catch (error) {
      console.error('Failed to load messages:', error);
    } finally {
      setLoading(false);
    }
  };

  const mediaMessages = messages.filter(
    (m) => m.messageType === 'image' || m.messageType === 'video'
  );
  const voiceMessages = messages.filter((m) => m.messageType === 'audio');
  const fileMessages = messages.filter((m) => m.messageType === 'file');
  const linkMessages = messages.filter((m) => m.content && m.content.includes('http'));

  const renderMedia = () => (
    <div className="group-info-media">
      {mediaMessages.length === 0 ? (
        <div className="empty-state">
          <ImageIcon size={48} />
          <p>No media yet</p>
        </div>
      ) : (
        <div className="media-grid">
          {mediaMessages.map((msg) => (
            <div key={msg.id} className="media-item">
              {msg.messageType === 'image' ? (
                <img src={msg.fileUrl} alt={msg.content || 'Image'} />
              ) : (
                <video src={msg.fileUrl} />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const renderVoice = () => (
    <div className="group-info-voice">
      {voiceMessages.length === 0 ? (
        <div className="empty-state">
          <VideoIcon size={48} />
          <p>No voice messages yet</p>
        </div>
      ) : (
        <div className="voice-list">
          {voiceMessages.map((msg) => (
            <div key={msg.id} className="voice-item">
              <div className="voice-info">
                <span className="voice-sender">
                  {msg.sender?.firstName || msg.sender?.username || 'Unknown'}
                </span>
                <span className="voice-date">
                  {new Date(msg.createdAt).toLocaleDateString()}
                </span>
              </div>
              <audio controls src={msg.fileUrl} />
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const renderFiles = () => (
    <div className="group-info-files">
      {fileMessages.length === 0 ? (
        <div className="empty-state">
          <FileIcon size={48} />
          <p>No files yet</p>
        </div>
      ) : (
        <div className="file-list">
          {fileMessages.map((msg) => (
            <div key={msg.id} className="file-item">
              <FileIcon size={24} />
              <div className="file-info">
                <span className="file-name">{msg.content || 'File'}</span>
                <span className="file-date">
                  {new Date(msg.createdAt).toLocaleDateString()}
                </span>
              </div>
              <a href={msg.fileUrl} target="_blank" rel="noopener noreferrer" className="file-download">
                Download
              </a>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const renderLinks = () => (
    <div className="group-info-links">
      {linkMessages.length === 0 ? (
        <div className="empty-state">
          <LinkIcon size={48} />
          <p>No links yet</p>
        </div>
      ) : (
        <div className="link-list">
          {linkMessages.map((msg) => {
            const urlMatch = msg.content?.match(/(https?:\/\/[^\s]+)/);
            const url = urlMatch ? urlMatch[0] : '';
            return (
              <div key={msg.id} className="link-item">
                <LinkIcon size={20} />
                <a href={url} target="_blank" rel="noopener noreferrer" className="link-url">
                  {url}
                </a>
                <span className="link-date">
                  {new Date(msg.createdAt).toLocaleDateString()}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );

  const renderParticipants = () => (
    <div className="group-info-participants">
      {conversation.participants && conversation.participants.length > 0 ? (
        <div className="participants-list">
          {conversation.participants.map((participant) => (
            <div key={participant.id} className="participant-item">
              <div className="participant-avatar">
                {participant.avatarUrl ? (
                  <img src={participant.avatarUrl} alt={participant.username} />
                ) : (
                  <div className="avatar-placeholder">
                    {(participant.firstName || participant.username || 'U').charAt(0).toUpperCase()}
                  </div>
                )}
                {participant.isOnline && <div className="online-indicator" />}
              </div>
              <div className="participant-info">
                <span className="participant-name">
                  {participant.firstName || participant.username || 'Unknown'}
                </span>
                <span className="participant-status">
                  {participant.isOnline ? 'Online' : 'Offline'}
                </span>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="empty-state">
          <UserIcon size={48} />
          <p>No participants yet</p>
        </div>
      )}
    </div>
  );

  return (
    <div className="group-info-overlay" onClick={onClose}>
      <div className="group-info-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="group-info-header">
          <div className="group-info-avatar">
            {conversation.avatarUrl ? (
              <img src={conversation.avatarUrl} alt={conversation.name} />
            ) : (
              <div className="avatar-placeholder">
                {(conversation.name || 'G').charAt(0).toUpperCase()}
              </div>
            )}
          </div>
          <div className="group-info-title">
            <h2>{conversation.name || 'Group'}</h2>
            <span className="group-info-members">
              {conversation.participants?.length || 0} members
            </span>
          </div>
          <button onClick={onClose} className="group-info-close">
            <XIcon size={20} />
          </button>
        </div>

        <div className="group-info-actions">
          <button onClick={onEditConversation} className="group-info-action">
            <EditIcon size={18} />
            <span>Edit Group</span>
          </button>
          <button onClick={onAddMembers} className="group-info-action">
            <UserPlusIcon size={18} />
            <span>Add Members</span>
          </button>
        </div>

        <div className="group-info-tabs">
          <button
            className={`group-info-tab ${activeTab === 'participants' ? 'active' : ''}`}
            onClick={() => setActiveTab('participants')}
          >
            <UserIcon size={18} />
            <span>Participants</span>
            <span className="tab-count">{conversation.participants?.length || 0}</span>
          </button>
          <button
            className={`group-info-tab ${activeTab === 'media' ? 'active' : ''}`}
            onClick={() => setActiveTab('media')}
          >
            <ImageIcon size={18} />
            <span>Media</span>
            <span className="tab-count">{mediaMessages.length}</span>
          </button>
          <button
            className={`group-info-tab ${activeTab === 'voice' ? 'active' : ''}`}
            onClick={() => setActiveTab('voice')}
          >
            <VideoIcon size={18} />
            <span>Voice</span>
            <span className="tab-count">{voiceMessages.length}</span>
          </button>
          <button
            className={`group-info-tab ${activeTab === 'file' ? 'active' : ''}`}
            onClick={() => setActiveTab('file')}
          >
            <FileIcon size={18} />
            <span>Files</span>
            <span className="tab-count">{fileMessages.length}</span>
          </button>
          <button
            className={`group-info-tab ${activeTab === 'link' ? 'active' : ''}`}
            onClick={() => setActiveTab('link')}
          >
            <LinkIcon size={18} />
            <span>Links</span>
            <span className="tab-count">{linkMessages.length}</span>
          </button>
        </div>

        <div className="group-info-content">
          {loading ? (
            <div className="loading">Loading...</div>
          ) : (
            <>
              {activeTab === 'participants' && renderParticipants()}
              {activeTab === 'media' && renderMedia()}
              {activeTab === 'voice' && renderVoice()}
              {activeTab === 'file' && renderFiles()}
              {activeTab === 'link' && renderLinks()}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default GroupInfo;
