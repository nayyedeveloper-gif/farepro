import React, { useState, useEffect, useRef, useCallback } from 'react';
import { messageAPI, userAPI, fileAPI } from '../../services/api';
import type { Conversation, User } from '../../types';
import {
  XIcon, SearchIcon, GroupIcon, ChannelIcon, LinkIcon,
  ChevronLeftIcon, CheckIcon, CameraIcon,
} from '../icons/Icons';

interface CreateConversationModalProps {
  onClose: () => void;
  onConversationCreated: (conversation: Conversation) => void;
  initialUserId?: string;
  initialType?: 'group' | 'channel';
}

type Screen = 'home' | 'pickmembers' | 'newgroup' | 'newchannel' | 'joinchannel';

const CreateConversationModal: React.FC<CreateConversationModalProps> = ({
  onClose,
  onConversationCreated,
  initialUserId,
  initialType,
}) => {
  const [screen, setScreen] = useState<Screen>(
    initialType === 'group' ? 'pickmembers' : initialType === 'channel' ? 'newchannel' : 'home'
  );
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<User[]>([]);
  const [contacts, setContacts] = useState<User[]>([]);
  const [searching, setSearching] = useState(false);
  const [starting, setStarting] = useState<string | null>(null);
  const [error, setError] = useState('');

  const [groupName, setGroupName] = useState('');
  const [groupDescription, setGroupDescription] = useState('');
  const [groupAvatarUrl, setGroupAvatarUrl] = useState('');
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [selected, setSelected] = useState<User[]>([]);
  const [creatingGroup, setCreatingGroup] = useState(false);

  const [channelName, setChannelName] = useState('');
  const [channelDescription, setChannelDescription] = useState('');
  const [channelAvatarUrl, setChannelAvatarUrl] = useState('');
  const [uploadingChannelAvatar, setUploadingChannelAvatar] = useState(false);
  const [creatingChannel, setCreatingChannel] = useState(false);

  const [joinChannelId, setJoinChannelId] = useState('');
  const [joiningChannel, setJoiningChannel] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const channelFileInputRef = useRef<HTMLInputElement>(null);

  const loadContacts = useCallback(async () => {
    try {
      const res = await userAPI.getContacts();
      setContacts(Array.isArray(res.data) ? res.data : []);
    } catch {
      setContacts([]);
    }
  }, []);

  useEffect(() => {
    loadContacts();
  }, [loadContacts]);

  useEffect(() => {
    inputRef.current?.focus();
  }, [screen]);

  useEffect(() => {
    if (initialUserId) openDirectMessage(initialUserId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openDirectMessage = async (userId: string) => {
    setStarting(userId);
    setError('');
    
    const timeout = setTimeout(() => {
      setError('Request timed out. Please try again.');
      setStarting(null);
    }, 10000); // 10 second timeout

    try {
      const convsRes = await Promise.race([
        messageAPI.getConversations(),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 9000))
      ]) as any;
      
      clearTimeout(timeout);
      
      const convs: Conversation[] = Array.isArray(convsRes.data)
        ? convsRes.data
        : convsRes.data.conversations || [];
      const existing = convs.find(
        (c) => c.type === 'private' && c.participants?.some((p) => p.id === userId)
      );
      if (existing) {
        onConversationCreated(existing);
        return;
      }
      
      const res = await Promise.race([
        messageAPI.createConversation({
          type: 'private',
          participantIds: [userId],
        }),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), 9000))
      ]) as any;
      
      onConversationCreated(res.data.conversation || res.data);
    } catch (err: unknown) {
      clearTimeout(timeout);
      const e = err as { response?: { data?: { error?: string } }; message?: string };
      console.error('Failed to open direct message:', err);
      setError(e.response?.data?.error || e.message || 'Could not open chat');
      setStarting(null);
    }
  };

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }
    const t = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await userAPI.search(query.trim());
        setResults(res.data || []);
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [query]);

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: 'group' | 'channel') => {
    const file = e.target.files?.[0];
    if (!file) return;
    const setUploading = type === 'group' ? setUploadingAvatar : setUploadingChannelAvatar;
    const setUrl = type === 'group' ? setGroupAvatarUrl : setChannelAvatarUrl;
    setUploading(true);
    setError('');
    try {
      const res = await fileAPI.uploadFile(file);
      setUrl(res.data.url);
    } catch {
      setError('Failed to upload photo');
    } finally {
      setUploading(false);
    }
  };

  const handleCreateGroup = async () => {
    if (!groupName.trim() || selected.length === 0) return;
    setCreatingGroup(true);
    setError('');
    try {
      const res = await messageAPI.createConversation({
        type: 'group',
        name: groupName.trim(),
        description: groupDescription.trim(),
        avatarUrl: groupAvatarUrl,
        participantIds: selected.map((u) => u.id),
      });
      onConversationCreated(res.data.conversation || res.data);
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } } };
      setError(e.response?.data?.error || 'Failed to create group');
      setCreatingGroup(false);
    }
  };

  const handleCreateChannel = async () => {
    if (!channelName.trim()) return;
    setCreatingChannel(true);
    setError('');
    try {
      const res = await messageAPI.createConversation({
        type: 'channel',
        name: channelName.trim(),
        description: channelDescription.trim(),
        avatarUrl: channelAvatarUrl,
        participantIds: selected.map((u) => u.id),
      });
      onConversationCreated(res.data.conversation || res.data);
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } } };
      setError(e.response?.data?.error || 'Failed to create channel');
      setCreatingChannel(false);
    }
  };

  const handleJoinChannel = async () => {
    if (!joinChannelId.trim()) return;
    setJoiningChannel(true);
    setError('');
    try {
      await messageAPI.joinChannel(joinChannelId.trim());
      const convsRes = await messageAPI.getConversations();
      const convs: Conversation[] = Array.isArray(convsRes.data)
        ? convsRes.data
        : convsRes.data.conversations || [];
      const joined = convs.find((c) => c.id === joinChannelId.trim());
      if (joined) onConversationCreated(joined);
      else {
        setError('Channel not found after joining');
        setJoiningChannel(false);
      }
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } } };
      setError(e.response?.data?.error || 'Failed to join channel');
      setJoiningChannel(false);
    }
  };

  const toggleSelect = (u: User) => {
    setSelected((prev) =>
      prev.find((p) => p.id === u.id) ? prev.filter((p) => p.id !== u.id) : [...prev, u]
    );
  };

  const displayList = query.trim() ? results : contacts;

  const titles: Record<Screen, string> = {
    home: 'New Message',
    pickmembers: 'Add Members',
    newgroup: 'New Group',
    newchannel: 'New Channel',
    joinchannel: 'Join Channel',
  };

  const goBack = () => {
    setError('');
    setQuery('');
    if (screen === 'pickmembers' || screen === 'newchannel' || screen === 'joinchannel') setScreen('home');
    else if (screen === 'newgroup') setScreen('pickmembers');
  };

  const UserRow: React.FC<{ u: User; onClick: () => void; busy?: boolean; checked?: boolean }> = ({
    u, onClick, busy, checked,
  }) => {
    const name = [u.firstName, u.lastName].filter(Boolean).join(' ') || u.username;
    const initial = name.charAt(0).toUpperCase();
    return (
      <button className="ncm-user-row" onClick={onClick} disabled={!!busy}>
        <div className="ncm-avatar">
          {u.avatarUrl ? <img src={u.avatarUrl} alt="" /> : <span>{initial}</span>}
          {u.isOnline && <span className="ncm-online-dot" />}
        </div>
        <div className="ncm-user-info">
          <span className="ncm-user-name">{name}</span>
          <span className="ncm-user-sub">@{u.username}{u.phone ? ` · ${u.phone}` : ''}</span>
        </div>
        {checked !== undefined && (
          <span className={`ncm-check ${checked ? 'ncm-check--on' : ''}`}>
            {checked && <CheckIcon size={12} />}
          </span>
        )}
        {busy && <span className="ncm-spinner" />}
      </button>
    );
  };

  const renderSearch = (placeholder: string) => (
    <div className="ncm-search-sticky">
      <div className="ncm-search-wrap">
        <SearchIcon size={16} className="ncm-search-icon" />
        <input
          ref={inputRef}
          id="ncm-search-input"
          name="search"
          className="ncm-search-input"
          placeholder={placeholder}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        {query && (
          <button type="button" className="ncm-search-clear" onClick={() => setQuery('')}>
            <XIcon size={14} />
          </button>
        )}
      </div>
    </div>
  );

  return (
    <div className="modal-overlay ncm-overlay" onClick={onClose}>
      <div className="ncm-sheet" onClick={(e) => e.stopPropagation()}>
        <div className="ncm-header">
          {screen !== 'home' ? (
            <button type="button" className="ncm-back" onClick={goBack} aria-label="Back">
              <ChevronLeftIcon size={20} />
            </button>
          ) : (
            <button type="button" className="ncm-close" onClick={onClose} aria-label="Close">
              <XIcon size={18} />
            </button>
          )}
          <h3 className="ncm-title">{titles[screen]}</h3>
          <div className="ncm-header-actions">
            {screen === 'pickmembers' && (
              <button
                type="button"
                className="ncm-done"
                disabled={selected.length === 0}
                onClick={() => { setQuery(''); setScreen('newgroup'); }}
              >
                Next
              </button>
            )}
            {screen === 'newgroup' && (
              <button
                type="button"
                className="ncm-done"
                disabled={!groupName.trim() || selected.length === 0 || creatingGroup}
                onClick={handleCreateGroup}
              >
                {creatingGroup ? '…' : 'Create'}
              </button>
            )}
            {screen === 'newchannel' && (
              <button
                type="button"
                className="ncm-done"
                disabled={!channelName.trim() || creatingChannel}
                onClick={handleCreateChannel}
              >
                {creatingChannel ? '…' : 'Create'}
              </button>
            )}
            {screen === 'joinchannel' && (
              <button
                type="button"
                className="ncm-done"
                disabled={!joinChannelId.trim() || joiningChannel}
                onClick={handleJoinChannel}
              >
                {joiningChannel ? '…' : 'Join'}
              </button>
            )}
            {screen === 'home' && <span style={{ width: 36 }} />}
          </div>
        </div>

        <div className="ncm-body">
          {screen === 'home' && (
            <>
              {renderSearch('Search by name or username…')}
              <div className="ncm-menu-section">
                <button type="button" className="ncm-action-row" onClick={() => { setQuery(''); setScreen('pickmembers'); }}>
                  <span className="ncm-action-icon-wrap"><GroupIcon size={20} /></span>
                  <span className="ncm-action-label">New Group</span>
                </button>
                <button type="button" className="ncm-action-row" onClick={() => { setQuery(''); setScreen('newchannel'); }}>
                  <span className="ncm-action-icon-wrap channel"><ChannelIcon size={20} /></span>
                  <span className="ncm-action-label">New Channel</span>
                </button>
                <button type="button" className="ncm-action-row" onClick={() => { setQuery(''); setScreen('joinchannel'); }}>
                  <span className="ncm-action-icon-wrap join"><LinkIcon size={20} /></span>
                  <span className="ncm-action-label">Join Channel</span>
                </button>
              </div>
              {!query.trim() && contacts.length > 0 && (
                <div className="ncm-section-label">Contacts</div>
              )}
              <div className="ncm-list">
                {searching && <p className="ncm-hint">Searching…</p>}
                {!searching && query.trim() && displayList.length === 0 && (
                  <p className="ncm-hint">No users found</p>
                )}
                {displayList.map((u) => (
                  <UserRow key={u.id} u={u} onClick={() => openDirectMessage(u.id)} busy={starting === u.id} />
                ))}
              </div>
            </>
          )}

          {screen === 'pickmembers' && (
            <>
              {renderSearch('Who would you like to add?')}
              {selected.length > 0 && (
                <div className="ncm-selected-bar">
                  {selected.map((u) => (
                    <span key={u.id} className="ncm-chip" onClick={() => toggleSelect(u)}>
                      {u.firstName || u.username}
                      <XIcon size={12} className="ncm-chip-remove" />
                    </span>
                  ))}
                </div>
              )}
              <div className="ncm-list">
                {displayList.map((u) => (
                  <UserRow
                    key={u.id}
                    u={u}
                    onClick={() => toggleSelect(u)}
                    checked={!!selected.find((p) => p.id === u.id)}
                  />
                ))}
              </div>
            </>
          )}

          {screen === 'newgroup' && (
            <div className="ncm-group-form">
              <button type="button" className="ncm-avatar-btn settings-avatar-btn" onClick={() => fileInputRef.current?.click()}>
                <div className="ncm-avatar-preview">
                  {groupAvatarUrl ? (
                    <img src={groupAvatarUrl} alt="" />
                  ) : (
                    <span className="avatar-placeholder">{groupName.charAt(0).toUpperCase() || 'G'}</span>
                  )}
                  <span className="settings-avatar-overlay"><CameraIcon size={22} /></span>
                </div>
              </button>
              <input ref={fileInputRef} type="file" accept="image/*" hidden onChange={(e) => handleAvatarUpload(e, 'group')} />
              <p className="ncm-hint" style={{ padding: 0, margin: 0 }}>
                {uploadingAvatar ? 'Uploading…' : 'Tap to set group photo'}
              </p>
              <div className="ncm-fields-card">
                <div className="ncm-field">
                  <input
                    id="ncm-group-name-input"
                    name="groupName"
                    className="ncm-group-name-input"
                    placeholder="Group name"
                    value={groupName}
                    onChange={(e) => setGroupName(e.target.value)}
                    autoFocus
                  />
                </div>
                <div className="ncm-field">
                  <textarea
                    id="ncm-group-desc-input"
                    name="groupDescription"
                    className="ncm-group-desc-input"
                    placeholder="Description (optional)"
                    value={groupDescription}
                    onChange={(e) => setGroupDescription(e.target.value)}
                    rows={2}
                  />
                </div>
              </div>
              <p className="ncm-hint">{selected.length} member{selected.length !== 1 ? 's' : ''} selected</p>
            </div>
          )}

          {screen === 'newchannel' && (
            <div className="ncm-group-form">
              <button type="button" className="ncm-avatar-btn" onClick={() => channelFileInputRef.current?.click()}>
                <div className="ncm-avatar-preview">
                  {channelAvatarUrl ? (
                    <img src={channelAvatarUrl} alt="" />
                  ) : (
                    <span className="avatar-placeholder">{channelName.charAt(0).toUpperCase() || 'C'}</span>
                  )}
                  <span className="settings-avatar-overlay"><CameraIcon size={22} /></span>
                </div>
              </button>
              <input ref={channelFileInputRef} type="file" accept="image/*" hidden onChange={(e) => handleAvatarUpload(e, 'channel')} />
              <p className="ncm-hint" style={{ padding: 0, margin: 0 }}>
                {uploadingChannelAvatar ? 'Uploading…' : 'Tap photo to set channel icon'}
              </p>
              <div className="ncm-fields-card">
                <div className="ncm-field">
                  <input
                    id="ncm-channel-name-input"
                    name="channelName"
                    className="ncm-group-name-input"
                    placeholder="Channel name"
                    value={channelName}
                    onChange={(e) => setChannelName(e.target.value)}
                    autoFocus
                  />
                </div>
                <div className="ncm-field">
                  <textarea
                    id="ncm-channel-desc-input"
                    name="channelDescription"
                    className="ncm-group-desc-input"
                    placeholder="Description (optional)"
                    value={channelDescription}
                    onChange={(e) => setChannelDescription(e.target.value)}
                    rows={2}
                  />
                </div>
              </div>
            </div>
          )}

          {screen === 'joinchannel' && (
            <div className="ncm-group-form">
              <div className="ncm-fields-card">
                <div className="ncm-field">
                  <input
                    ref={inputRef}
                    id="ncm-join-channel-input"
                    name="joinChannelId"
                    className="ncm-group-name-input"
                    placeholder="Channel ID or invite link"
                    value={joinChannelId}
                    onChange={(e) => setJoinChannelId(e.target.value)}
                    autoFocus
                  />
                </div>
              </div>
              <p className="ncm-hint">Paste the channel ID or invite link shared with you</p>
            </div>
          )}
        </div>

        {error && <p className="ncm-error">{error}</p>}
      </div>
    </div>
  );
};

export default CreateConversationModal;
