import React, { useEffect, useState } from 'react';
import { SearchIcon } from '../icons/Icons';
import { adminApi } from '../../services/adminApi';

const MoreVerticalIcon: React.FC<{ size?: number }> = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="12" cy="12" r="1" />
    <circle cx="12" cy="5" r="1" />
    <circle cx="12" cy="19" r="1" />
  </svg>
);

const PhoneCallIcon: React.FC<{ size?: number }> = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
  </svg>
);

const VideoCallIcon: React.FC<{ size?: number }> = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <polygon points="23 7 16 12 23 17 23 7" />
    <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
  </svg>
);

const CheckIcon: React.FC<{ size?: number }> = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

const XIcon: React.FC<{ size?: number }> = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

const RecordingIcon: React.FC<{ size?: number }> = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="12" cy="12" r="10" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

interface Call {
  id: string;
  conversationId: string;
  initiatorId: string;
  initiatorName: string;
  callType: 'audio' | 'video';
  status: string;
  duration: number;
  startedAt: string;
  endedAt: string;
  callResult: string;
}

const CallManagement: React.FC = () => {
  const [calls, setCalls] = useState<Call[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'audio' | 'video'>('all');
  const [filterStatus, setFilterStatus] = useState<'all' | 'completed' | 'missed' | 'ongoing'>('all');

  useEffect(() => {
    loadCalls();
  }, []);

  const loadCalls = async () => {
    try {
      const data = await adminApi.getCalls({ page: 1, limit: 50, type: filterType, status: filterStatus });
      setCalls(data.calls);
    } catch (error) {
      console.error('Failed to load calls:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredCalls = calls.filter(
    (call) =>
      (filterType === 'all' || call.callType === filterType) &&
      (filterStatus === 'all' || call.status === filterStatus) &&
      call.initiatorName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getCallTypeIcon = (type: string) => {
    return type === 'video' ? <VideoCallIcon size={20} /> : <PhoneCallIcon size={20} />;
  };

  const formatDuration = (seconds: number) => {
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return remainingSeconds > 0 ? `${minutes}m ${remainingSeconds}s` : `${minutes}m`;
  };

  if (loading) {
    return (
      <div className="admin-loading">
        <div className="loading-spinner" />
        <p>Loading calls...</p>
      </div>
    );
  }

  return (
    <div className="admin-call-management">
      <div className="admin-header">
        <h1>Call Management</h1>
        <p className="admin-subtitle">Monitor and manage call history and quality</p>
      </div>

      <div className="admin-stats-grid">
        <div className="admin-stat-card">
          <div className="admin-stat-icon" style={{ background: 'rgba(36, 161, 222, 0.1)' }}>
            <PhoneCallIcon size={24} />
          </div>
          <div className="admin-stat-content">
            <div className="admin-stat-label">Total Calls</div>
            <div className="admin-stat-value">{calls.length}</div>
          </div>
        </div>
        <div className="admin-stat-card">
          <div className="admin-stat-icon" style={{ background: 'rgba(77, 205, 94, 0.1)' }}>
            <CheckIcon size={24} />
          </div>
          <div className="admin-stat-content">
            <div className="admin-stat-label">Completed</div>
            <div className="admin-stat-value">{calls.filter((c) => c.status === 'completed').length}</div>
          </div>
        </div>
        <div className="admin-stat-card">
          <div className="admin-stat-icon" style={{ background: 'rgba(239, 68, 68, 0.1)' }}>
            <XIcon size={24} />
          </div>
          <div className="admin-stat-content">
            <div className="admin-stat-label">Missed</div>
            <div className="admin-stat-value">{calls.filter((c) => c.status === 'missed').length}</div>
          </div>
        </div>
        <div className="admin-stat-card">
          <div className="admin-stat-icon" style={{ background: 'rgba(255, 159, 67, 0.1)' }}>
            <RecordingIcon size={24} />
          </div>
          <div className="admin-stat-content">
            <div className="admin-stat-label">Ongoing</div>
            <div className="admin-stat-value">{calls.filter((c) => c.status === 'ongoing').length}</div>
          </div>
        </div>
      </div>

      <div className="admin-toolbar">
        <div className="admin-search">
          <SearchIcon size={18} className="search-icon" />
          <input
            type="text"
            placeholder="Search calls by participant name..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="admin-search-input"
          />
        </div>
        <div className="admin-filters">
          <button
            className={`filter-btn ${filterType === 'all' ? 'active' : ''}`}
            onClick={() => setFilterType('all')}
          >
            All Types
          </button>
          <button
            className={`filter-btn ${filterType === 'audio' ? 'active' : ''}`}
            onClick={() => setFilterType('audio')}
          >
            Audio
          </button>
          <button
            className={`filter-btn ${filterType === 'video' ? 'active' : ''}`}
            onClick={() => setFilterType('video')}
          >
            Video
          </button>
        </div>
        <div className="admin-filters">
          <button
            className={`filter-btn ${filterStatus === 'all' ? 'active' : ''}`}
            onClick={() => setFilterStatus('all')}
          >
            All Status
          </button>
          <button
            className={`filter-btn ${filterStatus === 'completed' ? 'active' : ''}`}
            onClick={() => setFilterStatus('completed')}
          >
            Completed
          </button>
          <button
            className={`filter-btn ${filterStatus === 'missed' ? 'active' : ''}`}
            onClick={() => setFilterStatus('missed')}
          >
            Missed
          </button>
          <button
            className={`filter-btn ${filterStatus === 'ongoing' ? 'active' : ''}`}
            onClick={() => setFilterStatus('ongoing')}
          >
            Ongoing
          </button>
        </div>
      </div>

      <div className="admin-table-container">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Initiator</th>
              <th>Type</th>
              <th>Status</th>
              <th>Duration</th>
              <th>Start Time</th>
              <th>End Time</th>
              <th>Result</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredCalls.map((call) => (
              <tr key={call.id} className={call.status === 'ongoing' ? 'ongoing' : ''}>
                <td>
                  <div className="call-participants">
                    <div className="participant-info">
                      <div className="participant-name">{call.initiatorName}</div>
                      <div className="participant-id">ID: {call.initiatorId}</div>
                    </div>
                  </div>
                </td>
                <td>
                  <span className={`type-badge ${call.callType}`}>
                    {getCallTypeIcon(call.callType)} {call.callType.charAt(0).toUpperCase() + call.callType.slice(1)}
                  </span>
                </td>
                <td>
                  <span className={`status-badge ${call.status}`}>
                    {call.status.charAt(0).toUpperCase() + call.status.slice(1)}
                  </span>
                </td>
                <td>{formatDuration(call.duration)}</td>
                <td>{call.startedAt}</td>
                <td>{call.endedAt || '-'}</td>
                <td>
                  <span className="result-badge">
                    {call.callResult.charAt(0).toUpperCase() + call.callResult.slice(1)}
                  </span>
                </td>
                <td>
                  <div className="action-buttons">
                    <button className="action-btn" title="View details">
                      <MoreVerticalIcon size={16} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filteredCalls.length === 0 && (
          <div className="admin-empty-state">
            <div className="empty-state-icon">
              <PhoneCallIcon size={64} />
            </div>
            <h3>No Calls Found</h3>
            <p className="empty-state-description">
              There are no call records to display at this time.
            </p>
            <div className="empty-state-info">
              <p><strong>Call Management:</strong></p>
              <ul>
                <li>Users can make audio and video calls</li>
                <li>Call history appears here for monitoring</li>
                <li>You can review call quality and duration</li>
              </ul>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CallManagement;
