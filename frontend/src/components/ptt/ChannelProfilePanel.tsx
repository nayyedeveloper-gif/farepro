import React, { useState, useEffect, useCallback, useRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { usePTT } from '../../contexts/PTTContext';
import type { PTTChannel, PTTMember } from '../../contexts/PTTContext';
import { useAuth } from '../../contexts/AuthContext';
import api from '../../services/api';
import {
  RadioIcon,
  AviationIcon,
  RetailIcon,
  TransportIcon,
  ConstructionIcon,
  ManufacturingIcon,
  HospitalityIcon,
  EmergencyIcon,
  LogoutIcon,
  UsersIcon,
  SettingsIcon,
  PlusIcon,
  MicIcon,
} from '../icons/Icons';

// ─── Industry icon helper ───
const INDUSTRY_ICONS: Record<string, React.FC<{ size?: number; className?: string }>> = {
  aviation: AviationIcon, retail: RetailIcon, transportation: TransportIcon,
  construction: ConstructionIcon, manufacturing: ManufacturingIcon,
  hospitality: HospitalityIcon, emergency: EmergencyIcon, general: RadioIcon,
};
function getIndustryIcon(name: string) {
  const l = name.toLowerCase();
  if (l.includes('aviation') || l.includes('flight') || l.includes('gate')) return INDUSTRY_ICONS.aviation;
  if (l.includes('retail') || l.includes('store') || l.includes('shop')) return INDUSTRY_ICONS.retail;
  if (l.includes('transport') || l.includes('fleet') || l.includes('logistic')) return INDUSTRY_ICONS.transportation;
  if (l.includes('construct') || l.includes('site') || l.includes('build')) return INDUSTRY_ICONS.construction;
  if (l.includes('manufact') || l.includes('factory') || l.includes('plant')) return INDUSTRY_ICONS.manufacturing;
  if (l.includes('hotel') || l.includes('guest') || l.includes('hospitality')) return INDUSTRY_ICONS.hospitality;
  if (l.includes('emergen') || l.includes('rescue') || l.includes('dispatch')) return INDUSTRY_ICONS.emergency;
  return INDUSTRY_ICONS.general;
}

interface ChannelMemberWithRole extends PTTMember {
  role: 'admin' | 'member';
  joinedAt?: string;
}

interface Props {
  channel: PTTChannel;
  onClose: () => void;
  onChannelUpdated: (ch: PTTChannel) => void;
  onChannelDeleted: () => void;
}

type Tab = 'about' | 'members' | 'invite';

export default function ChannelProfilePanel({ channel, onClose, onChannelUpdated, onChannelDeleted }: Props) {
  const { user } = useAuth();
  const { leaveChannel } = usePTT();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ─── State ───
  const [tab, setTab] = useState<Tab>('about');
  const [members, setMembers] = useState<ChannelMemberWithRole[]>([]);
  const [myRole, setMyRole] = useState<'admin' | 'member'>('member');

  // Edit state — mirrors live channel data
  const [isEditing, setIsEditing] = useState(false);
  const [editName, setEditName] = useState(channel.name);
  const [editDesc, setEditDesc] = useState(channel.description || '');
  const [editPrivate, setEditPrivate] = useState(channel.isPrivate || false);
  const [editAvatarUrl, setEditAvatarUrl] = useState(channel.avatarUrl || '');
  const [avatarPreview, setAvatarPreview] = useState(channel.avatarUrl || '');
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  // Invite state
  const [inviteToken, setInviteToken] = useState<string | null>(null);
  const [inviteLoading, setInviteLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const inviteUrl = inviteToken ? `${window.location.origin}/join/${inviteToken}` : null;

  // Keep edit fields in sync when channel prop changes
  useEffect(() => {
    setEditName(channel.name);
    setEditDesc(channel.description || '');
    setEditPrivate(channel.isPrivate || false);
    setEditAvatarUrl(channel.avatarUrl || '');
    setAvatarPreview(channel.avatarUrl || '');
  }, [channel]);

  // ─── Load members ───
  const loadMembers = useCallback(async () => {
    try {
      const res = await api.get(`/channels/${channel.id}/members/roles`);
      const data: ChannelMemberWithRole[] = Array.isArray(res.data)
        ? res.data.map((m: any) => ({
            id: m.userId || m.user?.id,
            username: m.user?.username || '',
            firstName: m.user?.firstName || '',
            lastName: m.user?.lastName || '',
            isOnline: m.user?.isOnline || false,
            status: m.user?.status || 'available',
            role: m.role,
            joinedAt: m.joinedAt,
          }))
        : [];
      setMembers(data);
      const me = data.find(m => m.id === user?.id);
      if (me) setMyRole(me.role);
    } catch {
      setMembers([]);
    }
  }, [channel.id, user?.id]);

  useEffect(() => { loadMembers(); }, [loadMembers]);

  // ─── Photo upload ───
  const handlePhotoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Client-side validation
    if (!file.type.startsWith('image/')) {
      setSaveError('Please select an image file');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setSaveError('Image must be under 5MB');
      return;
    }

    // Show local preview immediately
    const localUrl = URL.createObjectURL(file);
    setAvatarPreview(localUrl);
    setSaveError('');
    setUploadingPhoto(true);

    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await api.post('/files/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setEditAvatarUrl(res.data.url);
      setAvatarPreview(res.data.url);
    } catch {
      setSaveError('Failed to upload photo. Try again.');
      setAvatarPreview(channel.avatarUrl || '');
    } finally {
      setUploadingPhoto(false);
      // Reset input so same file can be re-selected
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleRemovePhoto = () => {
    setEditAvatarUrl('');
    setAvatarPreview('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // ─── Save changes ───
  const handleSave = async () => {
    if (!editName.trim()) { setSaveError('Channel name is required'); return; }
    setSaving(true);
    setSaveError('');
    try {
      const res = await api.patch(`/channels/${channel.id}`, {
        name: editName.trim(),
        description: editDesc.trim(),
        avatarUrl: editAvatarUrl,
        isPrivate: editPrivate,
      });
      const updated: PTTChannel = {
        ...channel,
        name: res.data.name,
        description: res.data.description,
        avatarUrl: res.data.avatarUrl || '',
        isPrivate: res.data.isPrivate,
      };
      onChannelUpdated(updated);
      setIsEditing(false);
    } catch {
      setSaveError('Failed to save. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleCancelEdit = () => {
    setEditName(channel.name);
    setEditDesc(channel.description || '');
    setEditPrivate(channel.isPrivate || false);
    setEditAvatarUrl(channel.avatarUrl || '');
    setAvatarPreview(channel.avatarUrl || '');
    setSaveError('');
    setIsEditing(false);
  };

  // ─── Delete channel ───
  const handleDelete = async () => {
    if (!window.confirm(`Delete "${channel.name}"? This cannot be undone.`)) return;
    try {
      await api.delete(`/channels/${channel.id}`);
      onChannelDeleted();
    } catch {
      setSaveError('Failed to delete channel.');
    }
  };

  // ─── Member management ───
  const handleKick = async (memberId: string, name: string) => {
    if (!window.confirm(`Remove ${name} from this channel?`)) return;
    try {
      await api.delete(`/channels/${channel.id}/members/${memberId}`);
      setMembers(prev => prev.filter(m => m.id !== memberId));
    } catch { /* silent */ }
  };

  const handleToggleRole = async (memberId: string, currentRole: string) => {
    const newRole = currentRole === 'admin' ? 'member' : 'admin';
    try {
      await api.put(`/channels/${channel.id}/members/${memberId}/role`, { userId: memberId, role: newRole });
      setMembers(prev => prev.map(m => m.id === memberId ? { ...m, role: newRole as 'admin' | 'member' } : m));
    } catch { /* silent */ }
  };

  // ─── Invite ───
  const handleGetInvite = async () => {
    setInviteLoading(true);
    try {
      const res = await api.get(`/channels/${channel.id}/invite`);
      setInviteToken(res.data.token);
    } catch { /* silent */ } finally {
      setInviteLoading(false);
    }
  };

  const handleCopy = () => {
    if (!inviteUrl) return;
    navigator.clipboard.writeText(inviteUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const Icon = getIndustryIcon(channel.name);
  const displayAvatar = isEditing ? avatarPreview : (channel.avatarUrl || '');

  return (
    <div className="cpp-overlay" onClick={onClose}>
      <div className="cpp-panel" onClick={e => e.stopPropagation()}>

        {/* ═══ Header ═══ */}
        <div className="cpp-header">
          <button className="cpp-close" onClick={onClose} title="Close">✕</button>

          <div className="cpp-channel-hero">
            {/* ─── Avatar with upload overlay ─── */}
            <div className="cpp-avatar-wrap">
              {displayAvatar ? (
                <img src={displayAvatar} alt={channel.name} className="cpp-channel-photo" />
              ) : (
                <div className="cpp-channel-avatar-icon">
                  <Icon size={32} />
                </div>
              )}
              {isEditing && (
                <label className="cpp-avatar-upload-btn" title="Change photo">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="cpp-file-input"
                    onChange={handlePhotoSelect}
                  />
                  {uploadingPhoto ? (
                    <span className="cpp-upload-spinner" />
                  ) : (
                    <MicIcon size={16} />
                  )}
                </label>
              )}
              {isEditing && displayAvatar && !uploadingPhoto && (
                <button className="cpp-avatar-remove-btn" onClick={handleRemovePhoto} title="Remove photo">✕</button>
              )}
            </div>

            {/* ─── Name (editable) ─── */}
            {isEditing ? (
              <div className="cpp-name-edit-wrap">
                <input
                  className="cpp-edit-name-input"
                  value={editName}
                  onChange={e => { setEditName(e.target.value); setSaveError(''); }}
                  placeholder="Channel name"
                  maxLength={80}
                />
                <span className="cpp-char-count">{editName.length}/80</span>
              </div>
            ) : (
              <h2 className="cpp-channel-name">{channel.name}</h2>
            )}

            <div className="cpp-header-badges">
              <span className={`cpp-role-badge ${myRole}`}>{myRole}</span>
              {channel.isPrivate && <span className="cpp-private-badge">Private</span>}
            </div>
          </div>

          {/* ─── Stats ─── */}
          <div className="cpp-channel-stats">
            <div className="cpp-stat">
              <span className="cpp-stat-val">{channel.memberCount}</span>
              <span className="cpp-stat-lbl">Members</span>
            </div>
            <div className="cpp-stat-divider" />
            <div className="cpp-stat">
              <span className="cpp-stat-val">{members.filter(m => m.isOnline).length}</span>
              <span className="cpp-stat-lbl">Online</span>
            </div>
            <div className="cpp-stat-divider" />
            <div className="cpp-stat">
              <span className="cpp-stat-val">{members.filter(m => m.role === 'admin').length}</span>
              <span className="cpp-stat-lbl">Admins</span>
            </div>
          </div>
        </div>

        {/* ═══ Tabs ═══ */}
        <div className="cpp-tabs">
          <button className={tab === 'about' ? 'active' : ''} onClick={() => setTab('about')}>
            <SettingsIcon size={14} /> About
          </button>
          <button className={tab === 'members' ? 'active' : ''} onClick={() => setTab('members')}>
            <UsersIcon size={14} /> Members ({members.length})
          </button>
          <button className={tab === 'invite' ? 'active' : ''} onClick={() => setTab('invite')}>
            <PlusIcon size={14} /> Invite
          </button>
        </div>

        {/* ═══ Tab: About ═══ */}
        {tab === 'about' && (
          <div className="cpp-body">
            {isEditing ? (
              /* ─── Edit form ─── */
              <div className="cpp-edit-form">

                {saveError && <div className="cpp-error-msg">{saveError}</div>}

                <div className="cpp-field">
                  <label className="cpp-label">Description</label>
                  <textarea
                    className="cpp-edit-desc"
                    value={editDesc}
                    onChange={e => setEditDesc(e.target.value)}
                    placeholder="Describe this channel's purpose, team, or topic…"
                    rows={4}
                    maxLength={500}
                  />
                  <span className="cpp-field-hint">{editDesc.length}/500</span>
                </div>

                <div className="cpp-field">
                  <label className="cpp-label">Channel Photo</label>
                  <div className="cpp-photo-field">
                    <div className="cpp-photo-thumb">
                      {avatarPreview
                        ? <img src={avatarPreview} alt="" />
                        : <Icon size={20} />
                      }
                      {uploadingPhoto && <div className="cpp-photo-uploading">Uploading…</div>}
                    </div>
                    <div className="cpp-photo-actions">
                      <label className="cpp-btn-upload">
                        <input
                          type="file"
                          accept="image/jpeg,image/png,image/webp,image/gif"
                          className="cpp-file-input"
                          onChange={handlePhotoSelect}
                        />
                        {uploadingPhoto ? 'Uploading…' : 'Choose Photo'}
                      </label>
                      {avatarPreview && (
                        <button className="cpp-btn-ghost cpp-btn-sm" onClick={handleRemovePhoto}>
                          Remove
                        </button>
                      )}
                    </div>
                    <span className="cpp-field-hint">JPG, PNG, WebP · max 5MB</span>
                  </div>
                </div>

                <div className="cpp-field">
                  <label className="cpp-toggle-row">
                    <div>
                      <span className="cpp-toggle-title">Private Channel</span>
                      <span className="cpp-toggle-desc">Only invited members can join</span>
                    </div>
                    <label className="cpp-switch">
                      <input
                        type="checkbox"
                        checked={editPrivate}
                        onChange={e => setEditPrivate(e.target.checked)}
                      />
                      <span className="cpp-switch-track" />
                    </label>
                  </label>
                </div>

                <div className="cpp-edit-actions">
                  <button className="cpp-btn-ghost" onClick={handleCancelEdit} disabled={saving}>
                    Cancel
                  </button>
                  <button
                    className="cpp-btn-primary"
                    onClick={handleSave}
                    disabled={saving || uploadingPhoto || !editName.trim()}
                  >
                    {saving ? 'Saving…' : 'Save Changes'}
                  </button>
                </div>
              </div>
            ) : (
              /* ─── View mode ─── */
              <>
                <div className="cpp-info-section">
                  <h4 className="cpp-section-title">Description</h4>
                  {channel.description ? (
                    <p className="cpp-desc-text">{channel.description}</p>
                  ) : (
                    <p className="cpp-desc-text cpp-muted">
                      {myRole === 'admin' ? 'No description — click Edit to add one.' : 'No description set.'}
                    </p>
                  )}
                </div>

                <div className="cpp-info-section">
                  <h4 className="cpp-section-title">Channel Info</h4>
                  <div className="cpp-info-row">
                    <span className="cpp-info-lbl">Type</span>
                    <span className="cpp-info-val">Push-to-Talk</span>
                  </div>
                  <div className="cpp-info-row">
                    <span className="cpp-info-lbl">Visibility</span>
                    <span className="cpp-info-val">{channel.isPrivate ? '🔒 Private' : '🌐 Public'}</span>
                  </div>
                  <div className="cpp-info-row">
                    <span className="cpp-info-lbl">Your Role</span>
                    <span className={`cpp-role-tag ${myRole}`}>{myRole}</span>
                  </div>
                  <div className="cpp-info-row">
                    <span className="cpp-info-lbl">Members</span>
                    <span className="cpp-info-val">{channel.memberCount}</span>
                  </div>
                </div>

                <div className="cpp-actions">
                  {myRole === 'admin' && (
                    <button className="cpp-action-btn" onClick={() => setIsEditing(true)}>
                      <SettingsIcon size={16} /> Edit Channel Info
                    </button>
                  )}
                  <button className="cpp-action-btn leave" onClick={() => { leaveChannel(channel.id); onClose(); }}>
                    <LogoutIcon size={16} /> Leave Channel
                  </button>
                  {myRole === 'admin' && (
                    <button className="cpp-action-btn danger" onClick={handleDelete}>
                      <EmergencyIcon size={16} /> Delete Channel
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        )}

        {/* ═══ Tab: Members ═══ */}
        {tab === 'members' && (
          <div className="cpp-body cpp-members-body">
            {members.length === 0 ? (
              <div className="cpp-members-empty">
                <UsersIcon size={40} />
                <p>No members found</p>
              </div>
            ) : (
              <div className="cpp-members-list">
                {members.map(m => {
                  const isMe = m.id === user?.id;
                  const displayName = m.firstName || m.username || 'Unknown';
                  return (
                    <div key={m.id} className="cpp-member-row">
                      <div className="cpp-member-avatar">
                        {displayName.charAt(0).toUpperCase()}
                        <span className={`cpp-member-dot ${m.isOnline ? 'online' : 'offline'}`} />
                      </div>
                      <div className="cpp-member-info">
                        <span className="cpp-member-name">
                          {isMe ? `${displayName} (You)` : displayName}
                        </span>
                        <span className="cpp-member-username">@{m.username || '—'}</span>
                      </div>
                      <span className={`cpp-role-tag ${m.role}`}>{m.role}</span>
                      {myRole === 'admin' && !isMe && (
                        <div className="cpp-member-actions">
                          <button
                            className="cpp-member-btn"
                            onClick={() => handleToggleRole(m.id, m.role)}
                            title={m.role === 'admin' ? 'Demote to member' : 'Promote to admin'}
                          >
                            {m.role === 'admin' ? '↓' : '↑'}
                          </button>
                          <button
                            className="cpp-member-btn danger"
                            onClick={() => handleKick(m.id, displayName)}
                            title="Remove from channel"
                          >
                            ✕
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ═══ Tab: Invite ═══ */}
        {tab === 'invite' && (
          <div className="cpp-body cpp-invite-body">
            {myRole === 'admin' ? (
              <>
                <p className="cpp-invite-hint">
                  Generate an invite link. Anyone with this link can join <strong>{channel.name}</strong>.
                </p>
                {!inviteToken ? (
                  <button className="cpp-btn-primary" onClick={handleGetInvite} disabled={inviteLoading}>
                    {inviteLoading ? 'Generating…' : 'Generate Invite Link & QR'}
                  </button>
                ) : (
                  <>
                    <div className="cpp-qr-wrap">
                      <QRCodeSVG
                        value={inviteUrl!}
                        size={180}
                        fgColor="#1a1a1a"
                        bgColor="#ffffff"
                        level="M"
                        includeMargin
                      />
                    </div>
                    <p className="cpp-invite-label">Scan QR code or share the link below</p>
                    <div className="cpp-invite-link-row">
                      <span className="cpp-invite-link-text">{inviteUrl}</span>
                      <button className="cpp-btn-copy" onClick={handleCopy}>
                        {copied ? '✓ Copied!' : 'Copy'}
                      </button>
                    </div>
                    <button className="cpp-btn-ghost cpp-regen" onClick={() => setInviteToken(null)}>
                      Generate New Link
                    </button>
                  </>
                )}
              </>
            ) : (
              <div className="cpp-invite-readonly">
                <UsersIcon size={40} className="cpp-invite-icon" />
                <p>Ask a channel admin to share an invite link.</p>
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
}
