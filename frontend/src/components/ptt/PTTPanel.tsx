import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { usePTT } from '../../contexts/PTTContext';
import type { UserStatus } from '../../contexts/PTTContext';
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
  SettingsIcon,
  PlusIcon,
  MicIcon,
  SpeakerIcon,
  LogoutIcon,
  UsersIcon,
} from '../icons/Icons';
import DriverWorkspace from './DriverWorkspace';
import SettingsScreen from '../settings/SettingsScreen';
import ChannelMessageThread from './ChannelMessageThread';
import ChannelMap from './ChannelMap';
import PTTHistoryPanel from './PTTHistoryPanel';
import ChannelProfilePanel from './ChannelProfilePanel';
import './PTTPanel.css';
import './ChannelProfilePanel.css';

import { BrandMark } from '../brand/BrandMark';

const INDUSTRY_ICONS: Record<string, React.FC<{ size?: number; className?: string }>> = {
  aviation: AviationIcon,
  retail: RetailIcon,
  transportation: TransportIcon,
  construction: ConstructionIcon,
  manufacturing: ManufacturingIcon,
  hospitality: HospitalityIcon,
  emergency: EmergencyIcon,
  general: RadioIcon,
};

function getIndustryIcon(name: string): React.FC<{ size?: number; className?: string }> {
  const lower = name.toLowerCase();
  if (lower.includes('aviation') || lower.includes('flight') || lower.includes('gate')) return INDUSTRY_ICONS.aviation;
  if (lower.includes('retail') || lower.includes('store') || lower.includes('shop')) return INDUSTRY_ICONS.retail;
  if (lower.includes('transport') || lower.includes('fleet') || lower.includes('logistic')) return INDUSTRY_ICONS.transportation;
  if (lower.includes('construct') || lower.includes('site') || lower.includes('build')) return INDUSTRY_ICONS.construction;
  if (lower.includes('manufact') || lower.includes('factory') || lower.includes('plant')) return INDUSTRY_ICONS.manufacturing;
  if (lower.includes('hotel') || lower.includes('guest') || lower.includes('hospitality')) return INDUSTRY_ICONS.hospitality;
  if (lower.includes('emergen') || lower.includes('rescue') || lower.includes('dispatch')) return INDUSTRY_ICONS.emergency;
  return INDUSTRY_ICONS.general;
}

// ─── Status helpers ───
const STATUS_LABELS: Record<UserStatus, string> = {
  available: 'Available',
  busy: 'Busy',
  dnd: 'Do Not Disturb',
};
const STATUS_COLORS: Record<UserStatus, string> = {
  available: '#22c55e',
  busy: '#f59e0b',
  dnd: '#ef4444',
};

// ─── Network quality bars ───
function NetworkBars({ quality }: { quality: number }) {
  return (
    <div className="ptt-net-bars" title={`Signal: ${quality}/4`}>
      {[1, 2, 3, 4].map(i => (
        <span key={i} className={`ptt-net-bar ${i <= quality ? 'active' : ''}`} style={{ height: 4 + i * 3 }} />
      ))}
    </div>
  );
}

export default function PTTPanel({ embedded = false }: { embedded?: boolean }) {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const {
    channels, myChannels, currentChannel, members,
    activeSpeakerId, activeSpeakerName,
    isTransmitting, isFloorDenied, pttError,
    myStatus, emergencyAlert, broadcastAlert, scanMode, networkQuality,
    loadChannels, loadMyChannels, createChannel,
    joinChannel, leaveChannel, selectChannel,
    startTransmit, stopTransmit,
    setMyStatus, sendEmergency, dismissEmergency, dismissBroadcast, toggleScanMode,
  } = usePTT();
  const { user, orgRole } = useAuth();

  const [showCreate, setShowCreate] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showBrowse, setShowBrowse] = useState(false);
  const [showStatusPicker, setShowStatusPicker] = useState(false);
  const [showChannelProfile, setShowChannelProfile] = useState(false);
  const [newName, setNewName] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [viewMode, setViewMode] = useState<'messages' | 'history' | 'map'>('messages');
  const [sidebarTab, setSidebarTab] = useState<'channels' | 'work'>('channels');
  const openedChannelRef = useRef<string | null>(null);

  useEffect(() => {
    loadChannels();
    loadMyChannels();
  }, [loadChannels, loadMyChannels]);

  useEffect(() => {
    const wanted = searchParams.get('channel');
    if (!wanted || openedChannelRef.current === wanted) return;
    openedChannelRef.current = wanted;

    let cancelled = false;
    (async () => {
      try {
        const existing = myChannels.find(ch => ch.id === wanted) || channels.find(ch => ch.id === wanted);
        if (existing) {
          if (!cancelled) await selectChannel(existing);
        } else {
          try {
            await joinChannel(wanted);
          } catch {
            // may already be a member
          }
          const res = await api.get(`/channels/${wanted}`);
          if (!cancelled && res.data) await selectChannel(res.data);
          await loadMyChannels();
        }
      } catch {
        // ignore
      } finally {
        if (!cancelled) setSearchParams({}, { replace: true });
      }
    })();

    return () => { cancelled = true; };
  }, [searchParams, myChannels, channels, selectChannel, joinChannel, loadMyChannels, setSearchParams]);

  // ─── Spacebar PTT shortcut ───
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.code !== 'Space') return;
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
    if (e.repeat) return;
    e.preventDefault();
    startTransmit();
  }, [startTransmit]);

  const handleKeyUp = useCallback((e: KeyboardEvent) => {
    if (e.code !== 'Space') return;
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
    e.preventDefault();
    stopTransmit();
  }, [stopTransmit]);

  useEffect(() => {
    if (embedded) return;
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [embedded, handleKeyDown, handleKeyUp]);

  const handleChannelSelect = useCallback((ch: typeof myChannels[number]) => {
    selectChannel(ch);
    if (embedded) navigate('/app');
  }, [selectChannel, embedded, navigate]);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    await createChannel(newName.trim(), newDesc.trim());
    setNewName('');
    setNewDesc('');
    setShowCreate(false);
  };

  const handlePTTDown = (e: React.PointerEvent) => {
    e.preventDefault();
    startTransmit();
  };

  const handlePTTUp = (e: React.PointerEvent) => {
    e.preventDefault();
    stopTransmit();
  };

  const onlineMembers = (members || []).filter(m => m.isOnline);
  const offlineMembers = (members || []).filter(m => !m.isOnline);
  const userInitial = (user?.firstName || user?.username || 'U').charAt(0).toUpperCase();
  const browseChannels = (channels || []).filter(ch =>
    !(myChannels || []).some(mc => mc.id === ch.id)
    && !ch.isPrivate
    && !ch.description?.startsWith('driver-ptt:')
  );
  const directChannels = (myChannels || []).filter(ch =>
    ch.isPrivate || ch.description?.startsWith('driver-ptt:') || ch.name.startsWith('Driver ·')
  );
  const groupChannels = (myChannels || []).filter(ch => !directChannels.some(d => d.id === ch.id));

  return (
    <div className={`ptt-app${embedded ? ' ptt-embedded' : ''}`}>

      {/* ─── Emergency Alert Overlay ─── */}
      {emergencyAlert && (
        <div className="ptt-emergency-overlay" onClick={dismissEmergency}>
          <div className="ptt-emergency-modal" onClick={e => e.stopPropagation()}>
            <div className="ptt-emergency-icon-wrap">
              <EmergencyIcon size={48} />
            </div>
            <h2 className="ptt-emergency-title">EMERGENCY ALERT</h2>
            <p className="ptt-emergency-from">{emergencyAlert.userName}</p>
            <p className="ptt-emergency-msg">{emergencyAlert.message}</p>
            <button className="ptt-emergency-dismiss" onClick={dismissEmergency}>
              Acknowledge
            </button>
          </div>
        </div>
      )}

      {broadcastAlert && (
        <div className="ptt-broadcast-banner">
          <div className="ptt-broadcast-content">
            <strong>{broadcastAlert.senderName}</strong>
            <span>{broadcastAlert.message}</span>
          </div>
          <button className="ptt-broadcast-dismiss" onClick={dismissBroadcast}>✕</button>
        </div>
      )}

      {/* ─── Left Pane: Channel Sidebar ─── */}
      <div className="ptt-sidebar">
        {/* Brand Header */}
        <div className="ptt-sidebar-header">
          <div className="ptt-brand">
            <BrandMark size={30} withName />
          </div>
          <div className="ptt-sidebar-header-actions">
            <NetworkBars quality={networkQuality} />
            <button
              className={`ptt-icon-btn ptt-icon-btn-ghost ${scanMode ? 'active-scan' : ''}`}
              onClick={toggleScanMode}
              title={scanMode ? 'Scan Mode ON' : 'Scan Mode'}
            >
              <SpeakerIcon size={16} />
            </button>
            <button className="ptt-icon-btn ptt-icon-btn-ghost" onClick={() => setShowCreate(true)} title="New Channel">
              <PlusIcon size={16} />
            </button>
          </div>
        </div>

        <div className="ptt-sidebar-tabs" role="tablist">
          {([
            { id: 'channels' as const, label: 'Channels', Icon: RadioIcon },
            { id: 'work' as const, label: 'Rides', Icon: TransportIcon },
          ]).map(({ id, label, Icon }) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={sidebarTab === id}
              className={sidebarTab === id ? 'active' : ''}
              onClick={() => setSidebarTab(id)}
            >
              <span className="ptt-tab-icon"><Icon size={18} /></span>
              <span className="ptt-tab-label">{label}</span>
            </button>
          ))}
        </div>

        <div className="ptt-sidebar-body">
        {sidebarTab === 'channels' && (
          <>
            {showCreate && (
              <div className="ptt-create-form">
                <input
                  type="text"
                  placeholder="Channel name (e.g. Gate A1, Dispatch)"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                  autoFocus
                />
                <input
                  type="text"
                  placeholder="Description (optional)"
                  value={newDesc}
                  onChange={(e) => setNewDesc(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                />
                <div className="ptt-create-actions">
                  <button className="ptt-btn-ghost" onClick={() => setShowCreate(false)}>Cancel</button>
                  <button className="ptt-btn-primary" onClick={handleCreate} disabled={!newName.trim()}>
                    Create
                  </button>
                </div>
              </div>
            )}
            <div className="ptt-channel-list">
              {myChannels.length === 0 && (
                <div className="ptt-empty">
                  <RadioIcon size={36} className="ptt-empty-icon" />
                  <p>No channels joined</p>
                  <button className="ptt-btn-primary" onClick={() => setShowCreate(true)}>
                    Create your first channel
                  </button>
                </div>
              )}
              {directChannels.length > 0 && (
                <div className="ptt-channel-group-label">Direct PTT</div>
              )}
              {directChannels.map((ch) => {
                const isActive = currentChannel?.id === ch.id;
                const isSpeaking = !!activeSpeakerId && isActive;
                return (
                  <div
                    key={ch.id}
                    className={`ptt-channel-item ptt-channel-direct ${isActive ? 'active' : ''} ${isSpeaking ? 'speaking' : ''}`}
                    onClick={() => handleChannelSelect(ch)}
                  >
                    <div className="ptt-channel-icon-box">
                      <MicIcon size={20} />
                    </div>
                    <div className="ptt-channel-info">
                      <span className="ptt-channel-name">{ch.name.replace(/^Driver ·\s*/, '')}</span>
                      <span className="ptt-channel-sub">
                        1:1 radio
                        {isSpeaking && ' · LIVE'}
                      </span>
                    </div>
                    {isSpeaking && <span className="ptt-live-pulse" />}
                  </div>
                );
              })}
              {groupChannels.length > 0 && directChannels.length > 0 && (
                <div className="ptt-channel-group-label">Channels</div>
              )}
              {groupChannels.map((ch) => {
                const Icon = getIndustryIcon(ch.name);
                const isActive = currentChannel?.id === ch.id;
                const isSpeaking = !!activeSpeakerId && isActive;
                return (
                  <div
                    key={ch.id}
                    className={`ptt-channel-item ${isActive ? 'active' : ''} ${isSpeaking ? 'speaking' : ''}`}
                    onClick={() => handleChannelSelect(ch)}
                  >
                    <div className="ptt-channel-icon-box">
                      {ch.avatarUrl
                        ? <img src={ch.avatarUrl} alt={ch.name} className="ptt-channel-avatar-img" />
                        : <Icon size={20} />}
                    </div>
                    <div className="ptt-channel-info">
                      <span className="ptt-channel-name">{ch.name}</span>
                      <span className="ptt-channel-sub">
                        {ch.memberCount} {ch.memberCount === 1 ? 'member' : 'members'}
                        {isSpeaking && ' · LIVE'}
                      </span>
                    </div>
                    {isSpeaking && <span className="ptt-live-pulse" />}
                  </div>
                );
              })}
            </div>
            {browseChannels.length > 0 && (
              <div className="ptt-browse-section">
                <button className="ptt-browse-toggle" onClick={() => setShowBrowse(!showBrowse)}>
                  <span>Discover Channels</span>
                  <span className="ptt-browse-count">{browseChannels.length}</span>
                </button>
                {showBrowse && (
                  <div className="ptt-browse-list">
                    {browseChannels.map((ch) => {
                      const Icon = getIndustryIcon(ch.name);
                      return (
                        <div key={ch.id} className="ptt-browse-item">
                          <div className="ptt-channel-icon-box">
                            {ch.avatarUrl
                              ? <img src={ch.avatarUrl} alt={ch.name} className="ptt-channel-avatar-img" />
                              : <Icon size={18} />}
                          </div>
                          <div className="ptt-channel-info">
                            <span className="ptt-channel-name">{ch.name}</span>
                            <span className="ptt-channel-sub">{ch.memberCount} members</span>
                          </div>
                          <button className="ptt-btn-join" onClick={() => joinChannel(ch.id)}>Join</button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {/* ─── Contacts / Recents removed (kilo taxi: Channels + Jobs only) ─── */}

        {sidebarTab === 'work' && <DriverWorkspace />}
        </div>

        <div className="ptt-user-bar">
          <div className="ptt-user-bar-main">
            <div className="ptt-user-avatar" onClick={() => setShowSettings(true)}>
              {user?.avatarUrl ? <img src={user.avatarUrl} alt="" /> : <span>{userInitial}</span>}
            </div>
            <div className="ptt-user-info" onClick={() => setShowStatusPicker(p => !p)}>
              <span className="ptt-user-name">{user?.firstName || user?.username || 'User'}</span>
              <span className="ptt-user-status">
                <span className="ptt-status-dot" style={{ background: STATUS_COLORS[myStatus] }} />
                {STATUS_LABELS[myStatus]}
              </span>
            </div>
          </div>
          {showStatusPicker && (
            <div className="ptt-status-picker">
              {(['available', 'busy', 'dnd'] as UserStatus[]).map(s => (
                <button
                  key={s}
                  type="button"
                  className={`ptt-status-opt ${myStatus === s ? 'selected' : ''}`}
                  onClick={() => { setMyStatus(s); setShowStatusPicker(false); }}
                >
                  <span className="ptt-status-dot" style={{ background: STATUS_COLORS[s] }} />
                  {STATUS_LABELS[s]}
                </button>
              ))}
              {(orgRole === 'owner' || orgRole === 'admin') && (
                <button type="button" className="ptt-status-opt" onClick={() => { navigate('/portal'); setShowStatusPicker(false); }}>
                  Owner Portal
                </button>
              )}
              {(orgRole === 'owner' || orgRole === 'admin' || orgRole === 'dispatcher') && (
                <button type="button" className="ptt-status-opt" onClick={() => { navigate('/dispatch'); setShowStatusPicker(false); }}>
                  Dispatch Console
                </button>
              )}
            </div>
          )}
          <div className="ptt-user-bar-actions">
            <button type="button" className="ptt-user-action-btn" onClick={() => setShowSettings(true)} title="Profile">
              <UsersIcon size={16} />
            </button>
            <button type="button" className="ptt-user-action-btn" onClick={() => setShowStatusPicker(p => !p)} title="Status">
              <NetworkBars quality={networkQuality} />
            </button>
            <button type="button" className="ptt-user-action-btn" onClick={() => setShowSettings(true)} title="Settings">
              <SettingsIcon size={16} />
            </button>
          </div>
        </div>
      </div>

      {!embedded && (
      <div className="ptt-main">
        {!currentChannel ? (
          <div className="ptt-no-channel">
            <RadioIcon size={56} className="ptt-no-channel-icon" />
            <h2>Select a Channel</h2>
            <p>Choose a channel from the left to start communicating</p>
            <p className="ptt-shortcut-hint">Hold <kbd>Space</kbd> to transmit</p>
          </div>
        ) : (
          <>
            {/* Channel Header */}
            <div className="ptt-detail-header">
              <div className="ptt-detail-title-row">
                {(() => {
                  const Icon = getIndustryIcon(currentChannel.name);
                  return (
                    <div className="ptt-detail-icon">
                      {currentChannel.avatarUrl
                        ? <img src={currentChannel.avatarUrl} alt={currentChannel.name} className="ptt-detail-avatar-img" />
                        : <Icon size={22} />}
                    </div>
                  );
                })()}
                <div className="ptt-detail-title-info" style={{ cursor: 'pointer' }} onClick={() => setShowChannelProfile(true)}>
                  <h2>{currentChannel.name}</h2>
                  <span>{currentChannel.memberCount} {currentChannel.memberCount === 1 ? 'member' : 'members'} · tap for info</span>
                </div>
                <button
                  className="ptt-icon-btn danger"
                  onClick={() => sendEmergency()}
                  title="Send Emergency Alert"
                >
                  <EmergencyIcon size={18} />
                </button>
                <button
                  className="ptt-icon-btn"
                  onClick={() => leaveChannel(currentChannel.id)}
                  title="Leave channel"
                >
                  <LogoutIcon size={18} />
                </button>
              </div>
              {currentChannel.description && (
                <p className="ptt-detail-desc">{currentChannel.description}</p>
              )}
            </div>

            {/* Speaker Bar */}
            <div className="ptt-speaker-bar">
              {isTransmitting ? (
                <div className="ptt-speaker-pill transmitting">
                  <div className="ptt-speaker-dot me" />
                  <span className="ptt-speaker-label">You are transmitting</span>
                  <div className="ptt-wave-bars"><span /><span /><span /><span /><span /></div>
                </div>
              ) : activeSpeakerName ? (
                <div className="ptt-speaker-pill">
                  <div className="ptt-speaker-dot" />
                  <span className="ptt-speaker-label">{activeSpeakerName} is speaking</span>
                  <div className="ptt-wave-bars"><span /><span /><span /><span /><span /></div>
                </div>
              ) : (
                <div className="ptt-speaker-pill idle">
                  <SpeakerIcon size={16} />
                  <span className="ptt-speaker-label">Channel quiet · hold <kbd>Space</kbd> to talk</span>
                </div>
              )}
            </div>

            {/* Members Strip */}
            <div className="ptt-member-strip">
              {onlineMembers.map((m) => {
                const isSpeaking = activeSpeakerId === m.id;
                const isMe = m.id === user?.id;
                return (
                  <div key={m.id} className={`ptt-strip-member ${isSpeaking ? 'speaking' : ''}`} title={m.firstName || m.username || 'Unknown'}>
                    <div className={`ptt-strip-avatar ${isSpeaking ? 'speaking' : ''}`}>
                      {(m.firstName || m.username || '?').charAt(0).toUpperCase()}
                      <span
                        className="ptt-strip-online"
                        style={{ background: STATUS_COLORS[m.status || 'available'] }}
                      />
                    </div>
                    <span className="ptt-strip-name">{isMe ? 'You' : (m.firstName || m.username || '?')}</span>
                  </div>
                );
              })}
              {offlineMembers.length > 0 && (
                <div className="ptt-strip-offline-count" title={`${offlineMembers.length} offline`}>
                  +{offlineMembers.length}
                </div>
              )}
            </div>

            {/* View Toggle */}
            <div className="ptt-view-toggle">
              <button className={`ptt-view-tab ${viewMode === 'messages' ? 'active' : ''}`} onClick={() => setViewMode('messages')}>
                Messages
              </button>
              <button className={`ptt-view-tab ${viewMode === 'history' ? 'active' : ''}`} onClick={() => setViewMode('history')}>
                Voice History
              </button>
              <button className={`ptt-view-tab ${viewMode === 'map' ? 'active' : ''}`} onClick={() => setViewMode('map')}>
                Live Map
              </button>
            </div>

            {viewMode === 'messages' ? (
              <ChannelMessageThread channelId={currentChannel.id} />
            ) : viewMode === 'history' ? (
              <PTTHistoryPanel channelId={currentChannel.id} />
            ) : (
              <ChannelMap channelId={currentChannel.id} />
            )}

            {/* PTT Controls */}
            <div className="ptt-controls">
              {pttError && <div className="ptt-error-bar">{pttError}</div>}
              {isFloorDenied && <div className="ptt-denied-bar">Channel busy — try again</div>}
              <button
                className={`ptt-talk-btn ${isTransmitting ? 'transmitting' : ''} ${isFloorDenied ? 'denied' : ''} ${activeSpeakerId && !isTransmitting ? 'listening' : ''}`}
                onPointerDown={handlePTTDown}
                onPointerUp={handlePTTUp}
                disabled={isFloorDenied}
              >
                {isTransmitting ? (
                  <><MicIcon size={20} /><span>RELEASE</span></>
                ) : activeSpeakerId ? (
                  <><SpeakerIcon size={20} /><span>LISTENING</span></>
                ) : (
                  <><MicIcon size={20} /><span>PUSH TO TALK</span></>
                )}
              </button>
            </div>
          </>
        )}
      </div>
      )}

      {showSettings && <SettingsScreen onClose={() => setShowSettings(false)} />}

      {showChannelProfile && currentChannel && (
        <ChannelProfilePanel
          channel={currentChannel}
          onClose={() => setShowChannelProfile(false)}
          onChannelUpdated={(updated) => {
            selectChannel(updated);
            loadMyChannels();
          }}
          onChannelDeleted={() => {
            setShowChannelProfile(false);
            loadMyChannels();
            loadChannels();
          }}
        />
      )}
    </div>
  );
}
