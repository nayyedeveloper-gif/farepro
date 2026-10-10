import React, { useEffect, useState } from 'react';
import { GroupIcon, SearchIcon, TrashIcon, EditIcon } from '../icons/Icons';
import { adminApi } from '../../services/adminApi';

const MoreVerticalIcon: React.FC<{ size?: number }> = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="12" cy="12" r="1" />
    <circle cx="12" cy="5" r="1" />
    <circle cx="12" cy="19" r="1" />
  </svg>
);

interface Group {
  id: string;
  name: string;
  type: 'group' | 'channel';
  avatarUrl?: string;
  memberCount: number;
  adminCount: number;
  createdAt: string;
  lastActivity: string;
  isPrivate: boolean;
}

const GroupManagement: React.FC = () => {
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'group' | 'channel'>('all');
  const [selectedGroup, setSelectedGroup] = useState<Group | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  useEffect(() => {
    loadGroups();
  }, []);

  const loadGroups = async () => {
    try {
      const data = await adminApi.getGroups({ page: 1, limit: 50, type: filterType });
      setGroups(data.groups);
    } catch (error) {
      console.error('Failed to load groups:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredGroups = groups.filter(
    (group) =>
      (filterType === 'all' || group.type === filterType) &&
      group.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleDeleteGroup = (group: Group) => {
    setSelectedGroup(group);
    setShowDeleteModal(true);
  };

  const confirmDelete = async () => {
    if (!selectedGroup) return;
    try {
      await adminApi.deleteGroup(selectedGroup.id);
      setGroups(groups.filter((g) => g.id !== selectedGroup.id));
      setShowDeleteModal(false);
      setSelectedGroup(null);
    } catch (error) {
      console.error('Failed to delete group:', error);
    }
  };

  if (loading) {
    return (
      <div className="admin-loading">
        <div className="loading-spinner" />
        <p>Loading groups...</p>
      </div>
    );
  }

  return (
    <div className="admin-group-management">
      <div className="admin-header">
        <h1>Group & Channel Management</h1>
        <p className="admin-subtitle">Manage groups and channels on the platform</p>
      </div>

      <div className="admin-toolbar">
        <div className="admin-search">
          <SearchIcon size={18} className="search-icon" />
          <input
            type="text"
            placeholder="Search groups and channels..."
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
            All
          </button>
          <button
            className={`filter-btn ${filterType === 'group' ? 'active' : ''}`}
            onClick={() => setFilterType('group')}
          >
            Groups
          </button>
          <button
            className={`filter-btn ${filterType === 'channel' ? 'active' : ''}`}
            onClick={() => setFilterType('channel')}
          >
            Channels
          </button>
        </div>
        <div className="admin-stats">
          <span className="admin-stat-badge">Total: {groups.length}</span>
          <span className="admin-stat-badge group">
            Groups: {groups.filter((g) => g.type === 'group').length}
          </span>
          <span className="admin-stat-badge channel">
            Channels: {groups.filter((g) => g.type === 'channel').length}
          </span>
        </div>
      </div>

      <div className="admin-table-container">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Group/Channel</th>
              <th>Type</th>
              <th>Members</th>
              <th>Admins</th>
              <th>Privacy</th>
              <th>Created</th>
              <th>Last Activity</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredGroups.map((group) => (
              <tr key={group.id}>
                <td>
                  <div className="group-cell">
                    <div className="group-avatar-small">
                      {group.avatarUrl ? (
                        <img src={group.avatarUrl} alt="" />
                      ) : (
                        <GroupIcon size={20} />
                      )}
                    </div>
                    <div className="group-info">
                      <div className="group-name">{group.name}</div>
                      <div className="group-id">ID: {group.id}</div>
                    </div>
                  </div>
                </td>
                <td>
                  <span className={`type-badge ${group.type}`}>
                    {group.type === 'group' ? 'Group' : 'Channel'}
                  </span>
                </td>
                <td>{group.memberCount}</td>
                <td>{group.adminCount}</td>
                <td>
                  <span className={`privacy-badge ${group.isPrivate ? 'private' : 'public'}`}>
                    {group.isPrivate ? 'Private' : 'Public'}
                  </span>
                </td>
                <td>{group.createdAt}</td>
                <td>{group.lastActivity}</td>
                <td>
                  <div className="action-buttons">
                    <button className="action-btn" title="Edit">
                      <EditIcon size={16} />
                    </button>
                    <button
                      className="action-btn delete"
                      onClick={() => handleDeleteGroup(group)}
                      title="Delete"
                    >
                      <TrashIcon size={16} />
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

      {showDeleteModal && selectedGroup && (
        <div className="modal-overlay" onClick={() => setShowDeleteModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Delete {selectedGroup.type === 'group' ? 'Group' : 'Channel'}</h3>
              <button className="modal-close" onClick={() => setShowDeleteModal(false)}>
                ×
              </button>
            </div>
            <div className="modal-body">
              <p>
                Are you sure you want to delete <strong>{selectedGroup.name}</strong>?
              </p>
              <p className="text-muted">
                This action cannot be undone. All messages and data will be permanently deleted.
              </p>
              <p className="text-warning">
                {selectedGroup.memberCount} members will be affected.
              </p>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setShowDeleteModal(false)}>
                Cancel
              </button>
              <button className="btn-primary danger" onClick={confirmDelete}>
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default GroupManagement;
