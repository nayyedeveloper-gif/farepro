import React from 'react';
import type { User } from '../../types';
import type { SettingsPageId } from './types';
import SettingsRow from './SettingsRow';
import {
  LockIcon, DatabaseIcon, DevicesIcon,
  LogOutIcon, UserCircleIcon, ChevronRightIcon, MicIcon,
} from '../icons/Icons';

interface SettingsHubProps {
  user: User;
  sessionCount: number;
  onNavigate: (page: SettingsPageId) => void;
  onLogout: () => void;
}

const InfoIcon: React.FC<{ size?: number }> = ({ size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10" />
    <line x1="12" y1="16" x2="12" y2="12" />
    <line x1="12" y1="8" x2="12.01" y2="8" />
  </svg>
);

const SettingsHub: React.FC<SettingsHubProps> = ({ user, sessionCount, onNavigate, onLogout }) => {
  const initial = (user.firstName || user.username || 'U').charAt(0).toUpperCase();
  const displayName = [user.firstName, user.lastName].filter(Boolean).join(' ') || user.username;

  return (
    <div className="tg-set-hub">
      {/* Profile Card */}
      <button type="button" className="tg-set-profile-card" onClick={() => onNavigate('profile')}>
        <div className="tg-set-profile-avatar">
          {user.avatarUrl ? <img src={user.avatarUrl} alt="" /> : <span>{initial}</span>}
        </div>
        <div className="tg-set-profile-info">
          <span className="tg-set-profile-name">{displayName}</span>
          {user.phone && <span className="tg-set-profile-sub">{user.phone}</span>}
          <span className="tg-set-profile-sub">@{user.username}</span>
        </div>
        <ChevronRightIcon size={16} className="tg-set-profile-arrow" />
      </button>

      {/* Account */}
      <div className="tg-set-hub-section-label">Account</div>
      <div className="tg-set-hub-section">
        <SettingsRow
          icon={<UserCircleIcon size={18} />}
          label="My Profile"
          hint="Name, username, avatar"
          onClick={() => onNavigate('profile')}
        />
      </div>

      {/* PTT & Audio */}
      <div className="tg-set-hub-section-label">Push-to-Talk</div>
      <div className="tg-set-hub-section">
        <SettingsRow
          icon={<MicIcon size={18} />}
          label="PTT &amp; Audio"
          hint="Mic sensitivity, speaker, release delay"
          onClick={() => onNavigate('ptt')}
        />
        <div className="tg-set-divider" />
        <SettingsRow
          icon={<LockIcon size={18} />}
          label="Privacy and Security"
          hint="Phone, last seen, read receipts"
          onClick={() => onNavigate('privacy')}
        />
        <div className="tg-set-divider" />
        <SettingsRow
          icon={<DatabaseIcon size={18} />}
          label="Data and Storage"
          hint="Auto-download, cache"
          onClick={() => onNavigate('data')}
        />
      </div>

      {/* Devices */}
      <div className="tg-set-hub-section-label">Sessions</div>
      <div className="tg-set-hub-section">
        <SettingsRow
          icon={<DevicesIcon size={18} />}
          label="Active Devices"
          hint="Manage connected sessions"
          value={sessionCount > 1 ? String(sessionCount) : undefined}
          onClick={() => onNavigate('devices')}
        />
        <div className="tg-set-divider" />
        <SettingsRow
          icon={<InfoIcon size={18} />}
          label="About"
          hint="Version, terms, privacy policy"
          onClick={() => onNavigate('about')}
        />
      </div>

      {/* Logout */}
      <div className="tg-set-hub-section tg-set-hub-danger">
        <SettingsRow
          icon={<LogOutIcon size={18} />}
          label="Log Out"
          onClick={onLogout}
          danger
          showArrow={false}
        />
      </div>
    </div>
  );
};

export default SettingsHub;
