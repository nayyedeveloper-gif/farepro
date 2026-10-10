import React, { useEffect, useState, useCallback } from 'react';
import { callAPI } from '../../services/api';
import type { CallHistoryItem } from '../../types';
import { PhoneIcon, VideoIcon, PhoneIncomingIcon, PhoneOutgoingIcon, PhoneMissedIcon } from '../icons/Icons';
import ListSkeleton from '../common/ListSkeleton';
import DialPad from './DialPad';
import { useCall } from '../../contexts/CallContext';
import { useSocket } from '../../contexts/SocketContext';
import { useAuth } from '../../contexts/AuthContext';

interface CallsPanelProps {
  onSelectUser?: (userId: string, conversationId: string) => void;
}

const CallsPanel: React.FC<CallsPanelProps> = ({ onSelectUser }) => {
  const [tab, setTab] = useState<'recent' | 'missed'>('recent');
  const [history, setHistory] = useState<CallHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDialPad, setShowDialPad] = useState(false);
  const { initiateCall } = useCall();
  const { subscribe } = useSocket();
  const { user } = useAuth();

  const loadHistory = useCallback(async () => {
    setLoading(true);
    try {
      const res = await callAPI.getHistory(tab === 'missed' ? 'missed' : undefined);
      setHistory(Array.isArray(res.data) ? res.data : []);
    } catch {
      setHistory([]);
    } finally {
      setLoading(false);
    }
  }, [tab]);

  useEffect(() => {
    loadHistory();
  }, [loadHistory]);

  useEffect(() => {
    const unsubEnded = subscribe('call.ended', () => loadHistory());
    const unsubMissed = subscribe('call.missed', () => loadHistory());
    const unsubRejected = subscribe('call.rejected', () => loadHistory());
    return () => { unsubEnded(); unsubMissed(); unsubRejected(); };
  }, [subscribe, loadHistory]);

  const formatTime = (dateStr: string) => {
    const d = new Date(dateStr);
    const now = new Date();
    if (d.toDateString() === now.toDateString()) {
      return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    }
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
  };

  const getName = (item: CallHistoryItem) => {
    const parts = [item.otherFirstName, item.otherLastName].filter(Boolean);
    return parts.length ? parts.join(' ') : item.otherUsername || item.otherPhone || 'Unknown';
  };

  const getCallDirection = (item: CallHistoryItem): 'outgoing' | 'incoming' | 'missed' => {
    const isOutgoing = item.initiatedBy === user?.id;
    if (!isOutgoing && (item.callResult === 'missed' || item.callResult === 'rejected')) return 'missed';
    return isOutgoing ? 'outgoing' : 'incoming';
  };

  const getDuration = (item: CallHistoryItem) => {
    if (!item.endedAt) return '';
    const secs = Math.floor((new Date(item.endedAt).getTime() - new Date(item.startedAt).getTime()) / 1000);
    if (secs < 5) return '';
    if (secs < 60) return `${secs}s`;
    return `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`;
  };

  const getStatusLabel = (item: CallHistoryItem, dir: 'outgoing' | 'incoming' | 'missed') => {
    if (dir === 'missed') return 'Missed';
    if (dir === 'outgoing') {
      if (item.callResult === 'cancelled') return 'Cancelled';
      return 'Outgoing';
    }
    if (item.callResult === 'rejected') return 'Declined';
    return 'Incoming';
  };

  const formatDateHeader = (dateStr: string) => {
    const d = new Date(dateStr);
    const now = new Date();
    if (d.toDateString() === now.toDateString()) return 'Today';
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
    return d.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' });
  };

  const handleCallBack = async (item: CallHistoryItem, callType: 'audio' | 'video') => {
    try {
      await initiateCall(item.conversationId, callType);
    } catch (err) {
      console.error('Call back failed:', err);
    }
  };

  // Group by date
  const grouped: { date: string; items: CallHistoryItem[] }[] = [];
  history.forEach((item) => {
    const dateKey = new Date(item.startedAt).toDateString();
    const existing = grouped.find((g) => g.date === dateKey);
    if (existing) {
      existing.items.push(item);
    } else {
      grouped.push({ date: dateKey, items: [item] });
    }
  });

  return (
    <div className="calls-panel">
      <div className="calls-toolbar">
        <div className="calls-tabs" role="tablist" aria-label="Call history">
          <button
            role="tab"
            aria-selected={tab === 'recent'}
            className={`calls-tab ${tab === 'recent' ? 'active' : ''}`}
            onClick={() => setTab('recent')}
          >
            Recent
          </button>
          <button
            role="tab"
            aria-selected={tab === 'missed'}
            className={`calls-tab ${tab === 'missed' ? 'active' : ''}`}
            onClick={() => setTab('missed')}
          >
            Missed
          </button>
        </div>
        <button
          className={`dialpad-toggle ${showDialPad ? 'open' : ''}`}
          onClick={() => setShowDialPad(!showDialPad)}
          aria-expanded={showDialPad}
        >
          <PhoneIcon size={16} />
          Dial
        </button>
      </div>

      {showDialPad && (
        <DialPad onClose={() => setShowDialPad(false)} onCallStarted={loadHistory} />
      )}

      {loading ? (
        <ListSkeleton count={5} />
      ) : history.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon-wrap">
            <PhoneIcon size={32} />
          </div>
          <p>No {tab} calls</p>
          <p className="hint">{tab === 'missed' ? 'No missed calls' : 'Use the dial pad to make a call'}</p>
        </div>
      ) : (
        <div className="calls-list">
          {grouped.map((group) => (
            <div key={group.date}>
              <div className="calls-date-header">{formatDateHeader(group.items[0].startedAt)}</div>
              {group.items.map((item) => {
                const dir = getCallDirection(item);
                const duration = getDuration(item);
                const name = getName(item);
                const isMissed = dir === 'missed';

                const DirIcon = dir === 'outgoing'
                  ? PhoneOutgoingIcon
                  : isMissed
                    ? PhoneMissedIcon
                    : PhoneIncomingIcon;

                return (
                  <div
                    key={item.id}
                    className={`call-history-item ${isMissed ? 'missed' : ''}`}
                    onClick={() => onSelectUser?.(item.otherUserId, item.conversationId)}
                  >
                    {/* Avatar */}
                    <div className="call-avatar">
                      {item.otherAvatarUrl
                        ? <img src={item.otherAvatarUrl} alt="" />
                        : <span>{name.charAt(0).toUpperCase()}</span>
                      }
                    </div>

                    <div className="call-info">
                      <span className={`call-name ${isMissed ? 'missed' : ''}`}>{name}</span>
                      <span className="call-meta">
                        <DirIcon size={14} className={`call-dir-icon ${dir}`} />
                        <span className="call-status-text">
                          {getStatusLabel(item, dir)} {item.callType === 'video' ? 'video call' : 'call'}
                          {duration ? ` · ${duration}` : ''}
                        </span>
                      </span>
                    </div>

                    <span className="call-time">{formatTime(item.startedAt)}</span>
                    <button
                      className="call-back-btn"
                      onClick={(e) => { e.stopPropagation(); handleCallBack(item, item.callType as 'audio' | 'video'); }}
                      title={`${item.callType === 'video' ? 'Video' : 'Voice'} call ${name}`}
                      aria-label={`${item.callType === 'video' ? 'Video' : 'Voice'} call ${name}`}
                    >
                      {item.callType === 'video' ? <VideoIcon size={18} /> : <PhoneIcon size={18} />}
                    </button>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default CallsPanel;
