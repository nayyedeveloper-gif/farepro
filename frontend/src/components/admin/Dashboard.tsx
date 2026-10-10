import React, { useEffect, useState } from 'react';
import { UserIcon, PhoneIcon, FileIcon } from '../icons/Icons';
import { adminApi } from '../../services/adminApi';

const MessageIcon: React.FC<{ size?: number }> = ({ size = 24 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
  </svg>
);

const ActivityIcon: React.FC<{ size?: number }> = ({ size = 24 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
  </svg>
);

const StorageIcon: React.FC<{ size?: number }> = ({ size = 24 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
    <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
    <line x1="12" y1="22.08" x2="12" y2="12" />
  </svg>
);

interface DashboardStats {
  totalUsers: number;
  activeUsers: number;
  totalMessages: number;
  totalCalls: number;
  totalFiles: number;
  storageUsed: string;
}

interface RecentActivity {
  id: string;
  type: 'user' | 'message' | 'call' | 'group';
  description: string;
  timestamp: string;
}

const Dashboard: React.FC = () => {
  const [stats, setStats] = useState<DashboardStats>({
    totalUsers: 0,
    activeUsers: 0,
    totalMessages: 0,
    totalCalls: 0,
    totalFiles: 0,
    storageUsed: '0 MB',
  });
  const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      const data = await adminApi.getDashboardStats();
      setStats(data);
      // TODO: Add recent activity API endpoint
      setRecentActivity([
        {
          id: '1',
          type: 'user',
          description: 'New user registered: john_doe',
          timestamp: '2 minutes ago',
        },
        {
          id: '2',
          type: 'message',
          description: 'High message volume detected in #general',
          timestamp: '15 minutes ago',
        },
        {
          id: '3',
          type: 'call',
          description: 'Video call completed: 45 minutes',
          timestamp: '1 hour ago',
        },
        {
          id: '4',
          type: 'group',
          description: 'New group created: Project Team',
          timestamp: '2 hours ago',
        },
      ]);
    } catch (error) {
      console.error('Failed to load dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const StatCard: React.FC<{ icon: React.ReactNode; label: string; value: string | number; color: string }> = ({
    icon,
    label,
    value,
    color,
  }) => (
    <div className="admin-stat-card">
      <div className="admin-stat-icon" style={{ background: color }}>
        {icon}
      </div>
      <div className="admin-stat-content">
        <div className="admin-stat-label">{label}</div>
        <div className="admin-stat-value">{value}</div>
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="admin-loading">
        <div className="loading-spinner" />
        <p>Loading dashboard...</p>
      </div>
    );
  }

  return (
    <div className="admin-dashboard">
      <div className="admin-header">
        <h1>Dashboard</h1>
        <p className="admin-subtitle">Overview of system activity and statistics</p>
      </div>

      <div className="admin-stats-grid">
        <StatCard
          icon={<UserIcon size={24} />}
          label="Total Users"
          value={stats.totalUsers}
          color="rgba(36, 161, 222, 0.1)"
        />
        <StatCard
          icon={<ActivityIcon size={24} />}
          label="Active Users"
          value={stats.activeUsers}
          color="rgba(77, 205, 94, 0.1)"
        />
        <StatCard
          icon={<MessageIcon size={24} />}
          label="Total Messages"
          value={stats.totalMessages.toLocaleString()}
          color="rgba(255, 159, 67, 0.1)"
        />
        <StatCard
          icon={<PhoneIcon size={24} />}
          label="Total Calls"
          value={stats.totalCalls.toLocaleString()}
          color="rgba(239, 68, 68, 0.1)"
        />
        <StatCard
          icon={<FileIcon size={24} />}
          label="Total Files"
          value={stats.totalFiles.toLocaleString()}
          color="rgba(139, 92, 246, 0.1)"
        />
        <StatCard
          icon={<StorageIcon size={24} />}
          label="Storage Used"
          value={stats.storageUsed}
          color="rgba(236, 72, 153, 0.1)"
        />
      </div>

      <div className="admin-section">
        <h2>Recent Activity</h2>
        <div className="admin-activity-list">
          {recentActivity.map((activity) => (
            <div key={activity.id} className="admin-activity-item">
              <div className="activity-type-badge">{activity.type}</div>
              <div className="activity-description">{activity.description}</div>
              <div className="activity-timestamp">{activity.timestamp}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
