import React from 'react';
import type { User } from '../../types';
import {
  XIcon, PhoneIcon, VideoIcon, ChatsIcon, UserIcon,
} from '../icons/Icons';

interface UserProfileViewProps {
  user: User;
  onClose: () => void;
  onMessage?: () => void;
  onVoiceCall?: () => void;
  onVideoCall?: () => void;
}

const UserProfileView: React.FC<UserProfileViewProps> = ({
  user,
  onClose,
  onMessage,
  onVoiceCall,
  onVideoCall,
}) => {
  const displayName = [user.firstName, user.lastName].filter(Boolean).join(' ') || user.username;
  const initial = displayName.charAt(0).toUpperCase();
  const status = user.isOnline ? 'online' : 'last seen recently';

  return (
    <div className="user-profile-overlay" onClick={onClose}>
      <div className="user-profile-panel" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="user-profile-close" onClick={onClose} aria-label="Close">
          <XIcon size={20} />
        </button>

        <div className="user-profile-hero">
          <div className="user-profile-avatar">
            {user.avatarUrl ? (
              <img src={user.avatarUrl} alt="" />
            ) : (
              <span>{initial}</span>
            )}
          </div>
          <h2 className="user-profile-name">{displayName}</h2>
          <p className={`user-profile-status ${user.isOnline ? 'online' : ''}`}>{status}</p>
        </div>

        <div className="user-profile-actions">
          <button type="button" className="user-profile-action" onClick={onMessage}>
            <ChatsIcon size={22} />
            <span>Message</span>
          </button>
          <button type="button" className="user-profile-action" onClick={onVoiceCall}>
            <PhoneIcon size={22} />
            <span>Call</span>
          </button>
          <button type="button" className="user-profile-action" onClick={onVideoCall}>
            <VideoIcon size={22} />
            <span>Video</span>
          </button>
        </div>

        <div className="user-profile-info">
          {user.phone && (
            <div className="user-profile-info-row">
              <PhoneIcon size={18} className="user-profile-info-icon" />
              <div>
                <span className="user-profile-info-label">Phone</span>
                <span className="user-profile-info-value">{user.phone}</span>
              </div>
            </div>
          )}
          <div className="user-profile-info-row">
            <UserIcon size={18} className="user-profile-info-icon" />
            <div>
              <span className="user-profile-info-label">Username</span>
              <span className="user-profile-info-value">@{user.username}</span>
            </div>
          </div>
          {user.bio && (
            <div className="user-profile-info-row">
              <div className="user-profile-info-icon" />
              <div>
                <span className="user-profile-info-label">Bio</span>
                <span className="user-profile-info-value">{user.bio}</span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default UserProfileView;
