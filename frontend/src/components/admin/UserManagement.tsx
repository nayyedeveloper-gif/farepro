import React, { useEffect, useState } from 'react';
import { SearchIcon } from '../icons/Icons';
import { adminApi } from '../../services/adminApi';

const BanIcon: React.FC<{ size?: number }> = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="12" cy="12" r="10" />
    <line x1="4.93" y1="4.93" x2="19.07" y2="19.07" />
  </svg>
);

const MoreVerticalIcon: React.FC<{ size?: number }> = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="12" cy="12" r="1" />
    <circle cx="12" cy="5" r="1" />
    <circle cx="12" cy="19" r="1" />
  </svg>
);

const MessageIcon: React.FC<{ size?: number }> = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
  </svg>
);

interface User {
  id: string;
  firstName: string;
  username: string;
  email: string;
  phone: string;
  avatarUrl?: string;
  isOnline: boolean;
  isBanned: boolean;
  createdAt: string;
  lastSeen: string;
}

interface UserConversation {
  id: string;
  name: string;
  type: 'direct' | 'group' | 'channel';
  lastMessage: string;
  lastMessageTime: string;
  messageCount: number;
}

const UserManagement: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [showBanModal, setShowBanModal] = useState(false);
  const [showConversationsModal, setShowConversationsModal] = useState(false);
  const [userConversations, setUserConversations] = useState<UserConversation[]>([]);
  const [loadingConversations, setLoadingConversations] = useState(false);

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    try {
      const data = await adminApi.getUsers({ page: 1, limit: 50 });
      setUsers(data.users);
    } catch (error) {
      console.error('Failed to load users:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredUsers = users.filter(
    (user) =>
      (user.firstName || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (user.username || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (user.email || '').toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleBanUser = (user: User) => {
    setSelectedUser(user);
    setShowBanModal(true);
  };

  const confirmBan = async () => {
    if (!selectedUser) return;
    try {
      await adminApi.banUser(selectedUser.id, selectedUser.isBanned ? 'unban' : 'ban');
      setUsers(
        users.map((u) => (u.id === selectedUser.id ? { ...u, isBanned: !u.isBanned } : u))
      );
      setShowBanModal(false);
      setSelectedUser(null);
    } catch (error) {
      console.error('Failed to ban user:', error);
    }
  };

  const handleViewConversations = async (user: User) => {
    setSelectedUser(user);
    setShowConversationsModal(true);
    setLoadingConversations(true);
    try {
      const conversations = await adminApi.getUserConversations(user.id);
      setUserConversations(conversations);
    } catch (error) {
      console.error('Failed to load conversations:', error);
    } finally {
      setLoadingConversations(false);
    }
  };

  if (loading) {
    return (
      <div className="admin-loading">
        <div className="loading-spinner" />
        <p>Loading users...</p>
      </div>
    );
  }

  return (
    <div className="admin-user-management">
      <div className="admin-header">
        <h1>User Management</h1>
        <p className="admin-subtitle">Manage and monitor user accounts</p>
      </div>

      <div className="admin-toolbar">
        <div className="admin-search">
          <SearchIcon size={18} className="search-icon" />
          <input
            type="text"
            placeholder="Search users by name, username, or email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="admin-search-input"
          />
        </div>
        <div className="admin-stats">
          <span className="admin-stat-badge">Total: {users.length}</span>
          <span className="admin-stat-badge online">Online: {users.filter((u) => u.isOnline).length}</span>
          <span className="admin-stat-badge banned">Banned: {users.filter((u) => u.isBanned).length}</span>
        </div>
      </div>

      <div className="admin-table-container">
        <table className="admin-table">
          <thead>
            <tr>
              <th>User</th>
              <th>Contact</th>
              <th>Status</th>
              <th>Joined</th>
              <th>Last Seen</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredUsers.map((user) => (
              <tr key={user.id} className={user.isBanned ? 'banned' : ''}>
                <td>
                  <div className="user-cell">
                    <div className="user-avatar-small">
                      {user.avatarUrl ? (
                        <img src={user.avatarUrl} alt="" />
                      ) : (
                        <span>{(user.firstName || user.username).charAt(0).toUpperCase()}</span>
                      )}
                    </div>
                    <div className="user-info">
                      <div className="user-name">{user.firstName || user.username}</div>
                      <div className="user-username">@{user.username}</div>
                    </div>
                  </div>
                </td>
                <td>
                  <div className="contact-info">
                    <div>{user.email}</div>
                    <div className="text-muted">{user.phone}</div>
                  </div>
                </td>
                <td>
                  <div className="status-badges">
                    {user.isOnline && <span className="status-badge online">Online</span>}
                    {user.isBanned && <span className="status-badge banned">Banned</span>}
                    {!user.isOnline && !user.isBanned && <span className="status-badge offline">Offline</span>}
                  </div>
                </td>
                <td>{user.createdAt}</td>
                <td>{user.lastSeen}</td>
                <td>
                  <div className="action-buttons">
                    <button
                      className="action-btn"
                      onClick={() => handleViewConversations(user)}
                      title="View Conversations"
                    >
                      <MessageIcon size={16} />
                    </button>
                    <button
                      className="action-btn"
                      onClick={() => handleBanUser(user)}
                      title={user.isBanned ? 'Unban user' : 'Ban user'}
                    >
                      <BanIcon size={16} />
                    </button>
                    <button className="action-btn" title="More options">
                      <MoreVerticalIcon size={16} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showBanModal && selectedUser && (
        <div className="modal-overlay" onClick={() => setShowBanModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{selectedUser.isBanned ? 'Unban User' : 'Ban User'}</h3>
              <button className="modal-close" onClick={() => setShowBanModal(false)}>
                ×
              </button>
            </div>
            <div className="modal-body">
              <p>
                Are you sure you want to {selectedUser.isBanned ? 'unban' : 'ban'}{' '}
                <strong>{selectedUser.firstName || selectedUser.username}</strong>?
              </p>
              {selectedUser.isBanned && (
                <p className="text-muted">This user will be able to access the platform again.</p>
              )}
              {!selectedUser.isBanned && (
                <p className="text-muted">This user will not be able to access the platform.</p>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setShowBanModal(false)}>
                Cancel
              </button>
              <button className="btn-primary" onClick={confirmBan}>
                {selectedUser.isBanned ? 'Unban' : 'Ban'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showConversationsModal && selectedUser && (
        <div className="modal-overlay" onClick={() => setShowConversationsModal(false)}>
          <div className="modal-content conversations-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>User Conversations</h3>
              <button className="modal-close" onClick={() => setShowConversationsModal(false)}>
                ×
              </button>
            </div>
            <div className="modal-body">
              <div className="conversations-user-info">
                <div className="user-avatar-small">
                  {selectedUser.avatarUrl ? (
                    <img src={selectedUser.avatarUrl} alt="" />
                  ) : (
                    <span>{(selectedUser.firstName || selectedUser.username).charAt(0).toUpperCase()}</span>
                  )}
                </div>
                <div>
                  <div className="user-name">{selectedUser.firstName || selectedUser.username}</div>
                  <div className="user-username">@{selectedUser.username}</div>
                </div>
              </div>
              {loadingConversations ? (
                <div className="conversations-loading">
                  <div className="loading-spinner" />
                  <p>Loading conversations...</p>
                </div>
              ) : userConversations.length === 0 ? (
                <div className="conversations-empty">
                  <p>No conversations found for this user.</p>
                </div>
              ) : (
                <div className="conversations-list">
                  {userConversations.map((conv) => (
                    <div key={conv.id} className="conversation-item">
                      <div className="conversation-info">
                        <div className="conversation-name">{conv.name}</div>
                        <div className={`conversation-type type-badge ${conv.type}`}>
                          {conv.type.charAt(0).toUpperCase() + conv.type.slice(1)}
                        </div>
                      </div>
                      <div className="conversation-details">
                        <div className="conversation-last-message">{conv.lastMessage}</div>
                        <div className="conversation-meta">
                          <span className="conversation-time">{conv.lastMessageTime}</span>
                          <span className="conversation-count">{conv.messageCount} messages</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setShowConversationsModal(false)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default UserManagement;
