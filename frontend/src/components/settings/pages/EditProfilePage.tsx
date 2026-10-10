import React, { useRef, useState } from 'react';
import type { User } from '../../../types';
import { userAPI, fileAPI } from '../../../services/api';
import SettingsPageShell from '../SettingsPageShell';
import SettingsGroup from '../SettingsGroup';
import { CameraIcon, CheckIcon, XIcon } from '../../icons/Icons';

interface EditProfilePageProps {
  user: User;
  onBack: () => void;
  onUpdate: (user: User) => void;
}

const EditProfilePage: React.FC<EditProfilePageProps> = ({ user, onBack, onUpdate }) => {
  const [firstName, setFirstName] = useState(user.firstName || '');
  const [lastName, setLastName] = useState(user.lastName || '');
  const [username, setUsername] = useState(user.username || '');
  const [bio, setBio] = useState(user.bio || '');
  const [phone, setPhone] = useState(user.phone || '');
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [usernameError, setUsernameError] = useState('');
  const [checkingUsername, setCheckingUsername] = useState(false);
  const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const initial = (user.firstName || user.username || 'U').charAt(0).toUpperCase();

  const validateUsername = (value: string): string => {
    if (!value) return 'Username is required';
    if (value.length < 3) return 'Username must be at least 3 characters';
    if (value.length > 32) return 'Username must be less than 32 characters';
    if (!/^[a-zA-Z0-9_]+$/.test(value)) return 'Username can only contain letters, numbers, and underscores';
    if (!/^[a-zA-Z]/.test(value)) return 'Username must start with a letter';
    return '';
  };

  const checkUsernameAvailability = async (value: string) => {
    const error = validateUsername(value);
    if (error) {
      setUsernameError(error);
      setUsernameAvailable(null);
      return;
    }
    
    if (value === user.username) {
      setUsernameError('');
      setUsernameAvailable(true);
      return;
    }

    setCheckingUsername(true);
    setUsernameError('');
    try {
      const res = await userAPI.checkUsername(value);
      setUsernameAvailable(res.data.available);
      if (!res.data.available) {
        setUsernameError('Username is already taken');
      }
    } catch {
      setUsernameError('Failed to check username availability');
      setUsernameAvailable(null);
    } finally {
      setCheckingUsername(false);
    }
  };

  const handleUsernameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setUsername(value);
    setUsernameAvailable(null);
    
    if (value) {
      const error = validateUsername(value);
      if (error) {
        setUsernameError(error);
      } else {
        setUsernameError('');
      }
    } else {
      setUsernameError('');
    }
  };

  const handleUsernameBlur = () => {
    if (username) {
      checkUsernameAvailability(username);
    }
  };

  const handleSave = async () => {
    const usernameValidationError = validateUsername(username);
    if (usernameValidationError) {
      setUsernameError(usernameValidationError);
      return;
    }

    if (usernameAvailable === false) {
      setUsernameError('Username is already taken');
      return;
    }

    setLoading(true);
    try {
      const res = await userAPI.updateProfile({ firstName, lastName, username, bio, phone });
      onUpdate(res.data);
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  const handleAvatarChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoading(true);
    try {
      const upload = await fileAPI.uploadFile(file);
      const res = await userAPI.updateAvatar({ avatarUrl: upload.data.url });
      onUpdate({ ...user, avatarUrl: res.data.avatarUrl });
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  return (
    <SettingsPageShell
      title="Edit Profile"
      onBack={onBack}
      rightAction={
        <button type="button" className="tg-set-done" onClick={handleSave} disabled={loading}>
          {saved ? 'Saved' : 'Done'}
        </button>
      }
    >
      <div className="tg-set-avatar-center">
        <button type="button" className="settings-avatar-btn" onClick={() => fileRef.current?.click()}>
          {user.avatarUrl
            ? <img src={user.avatarUrl} alt="" className="settings-avatar-img" />
            : <span className="settings-avatar-placeholder">{initial}</span>}
          <span className="settings-avatar-overlay"><CameraIcon size={22} /></span>
        </button>
        <input ref={fileRef} type="file" accept="image/*" hidden onChange={handleAvatarChange} />
      </div>

      <SettingsGroup footer="Enter your name and add a profile photo.">
        <div className="tg-set-field">
          <input value={firstName} onChange={(e) => setFirstName(e.target.value)} placeholder="First Name" />
        </div>
        <div className="tg-set-divider" />
        <div className="tg-set-field">
          <input value={lastName} onChange={(e) => setLastName(e.target.value)} placeholder="Last Name" />
        </div>
      </SettingsGroup>

      <SettingsGroup footer="You can change your username anytime.">
        <div className="tg-set-field">
          <div className="username-input-wrapper">
            <span className="username-prefix">@</span>
            <input
              id="username-input"
              name="username"
              value={username}
              onChange={handleUsernameChange}
              onBlur={handleUsernameBlur}
              placeholder="Username"
              className={`username-input ${usernameError ? 'error' : ''} ${usernameAvailable === true ? 'success' : ''}`}
            />
            {checkingUsername && (
              <div className="username-spinner">
                <div className="spinner-ring"></div>
              </div>
            )}
            {usernameAvailable === true && <CheckIcon size={16} className="username-status success" />}
            {usernameAvailable === false && <XIcon size={16} className="username-status error" />}
          </div>
          {usernameError && <span className="username-error">{usernameError}</span>}
        </div>
      </SettingsGroup>

      <SettingsGroup footer="Any details such as age, occupation or city.">
        <div className="tg-set-field">
          <textarea value={bio} onChange={(e) => setBio(e.target.value)} placeholder="Bio" rows={3} />
        </div>
      </SettingsGroup>

      <SettingsGroup>
        <div className="tg-set-field">
          <span className="tg-set-field-label">Phone</span>
          <input value={phone} onChange={(e) => setPhone(e.target.value)} className="tg-set-field-inline" />
        </div>
      </SettingsGroup>
    </SettingsPageShell>
  );
};

export default EditProfilePage;
