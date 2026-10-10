import React, { useEffect, useState } from 'react';
import { SearchIcon, TrashIcon } from '../icons/Icons';
import { adminApi } from '../../services/adminApi';

const ShieldIcon: React.FC<{ size?: number }> = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
  </svg>
);

const AlertTriangleIcon: React.FC<{ size?: number }> = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
    <line x1="12" y1="9" x2="12" y2="13" />
    <line x1="12" y1="17" x2="12.01" y2="17" />
  </svg>
);

interface ReportedContent {
  id: string;
  reporterId: string;
  reporterName: string;
  reportedUserId: string;
  reportedUserName: string;
  reportedMessageId: string;
  reason: string;
  status: 'pending' | 'reviewed' | 'resolved' | 'dismissed';
  createdAt: string;
}

const ContentModeration: React.FC = () => {
  const [reports, setReports] = useState<ReportedContent[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'reviewed' | 'resolved' | 'dismissed'>('all');
  const [selectedReport, setSelectedReport] = useState<ReportedContent | null>(null);
  const [showActionModal, setShowActionModal] = useState(false);
  const [actionType, setActionType] = useState<'delete' | 'dismiss' | 'block'>('delete');

  useEffect(() => {
    loadReports();
  }, []);

  const loadReports = async () => {
    try {
      const data = await adminApi.getReports({ page: 1, limit: 50, status: filterStatus });
      setReports(data.reports);
    } catch (error) {
      console.error('Failed to load reports:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredReports = reports.filter(
    (report) =>
      (filterStatus === 'all' || report.status === filterStatus) &&
      (report.reporterName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        report.reportedUserName.toLowerCase().includes(searchQuery.toLowerCase()) ||
        report.reason.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const handleAction = (report: ReportedContent, action: 'delete' | 'dismiss' | 'block') => {
    setSelectedReport(report);
    setActionType(action);
    setShowActionModal(true);
  };

  const confirmAction = async () => {
    if (!selectedReport) return;
    try {
      await adminApi.moderateReport(selectedReport.id, actionType);
      const newStatus = actionType === 'dismiss' ? 'dismissed' : 'resolved';
      setReports(
        reports.map((r) => (r.id === selectedReport.id ? { ...r, status: newStatus } : r))
      );
      setShowActionModal(false);
      setSelectedReport(null);
    } catch (error) {
      console.error('Failed to perform action:', error);
    }
  };

  const getActionText = () => {
    switch (actionType) {
      case 'delete':
        return 'Delete Content';
      case 'dismiss':
        return 'Dismiss Report';
      case 'block':
        return 'Block User';
      default:
        return '';
    }
  };

  const getActionDescription = () => {
    switch (actionType) {
      case 'delete':
        return 'This will permanently delete the reported content.';
      case 'dismiss':
        return 'This will mark the report as dismissed and no action taken.';
      case 'block':
        return 'This will block the user who posted the content.';
      default:
        return '';
    }
  };

  if (loading) {
    return (
      <div className="admin-loading">
        <div className="loading-spinner" />
        <p>Loading reports...</p>
      </div>
    );
  }

  return (
    <div className="admin-content-moderation">
      <div className="admin-header">
        <h1>Content Moderation</h1>
        <p className="admin-subtitle">Review and manage reported content</p>
      </div>

      <div className="admin-toolbar">
        <div className="admin-search">
          <SearchIcon size={18} className="search-icon" />
          <input
            type="text"
            placeholder="Search reports by content, reporter, or reason..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="admin-search-input"
          />
        </div>
        <div className="admin-filters">
          <button
            className={`filter-btn ${filterStatus === 'all' ? 'active' : ''}`}
            onClick={() => setFilterStatus('all')}
          >
            All
          </button>
          <button
            className={`filter-btn ${filterStatus === 'pending' ? 'active' : ''}`}
            onClick={() => setFilterStatus('pending')}
          >
            Pending
          </button>
          <button
            className={`filter-btn ${filterStatus === 'reviewed' ? 'active' : ''}`}
            onClick={() => setFilterStatus('reviewed')}
          >
            Reviewed
          </button>
          <button
            className={`filter-btn ${filterStatus === 'resolved' ? 'active' : ''}`}
            onClick={() => setFilterStatus('resolved')}
          >
            Resolved
          </button>
        </div>
        <div className="admin-stats">
          <span className="admin-stat-badge">Total: {reports.length}</span>
          <span className="admin-stat-badge pending">
            Pending: {reports.filter((r) => r.status === 'pending').length}
          </span>
          <span className="admin-stat-badge resolved">
            Resolved: {reports.filter((r) => r.status === 'resolved').length}
          </span>
        </div>
      </div>

      <div className="admin-table-container">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Reporter</th>
              <th>Reported User</th>
              <th>Reported Message ID</th>
              <th>Reason</th>
              <th>Status</th>
              <th>Date</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredReports.map((report) => (
              <tr key={report.id} className={report.status === 'pending' ? 'pending' : ''}>
                <td>
                  <div className="user-info-small">
                    <div className="user-name-small">{report.reporterName}</div>
                    <div className="user-id-small">ID: {report.reporterId}</div>
                  </div>
                </td>
                <td>
                  <div className="user-info-small">
                    <div className="user-name-small">{report.reportedUserName}</div>
                    <div className="user-id-small">ID: {report.reportedUserId}</div>
                  </div>
                </td>
                <td>{report.reportedMessageId}</td>
                <td>
                  <span className="reason-badge">{report.reason}</span>
                </td>
                <td>
                  <span className={`status-badge ${report.status}`}>
                    {report.status.charAt(0).toUpperCase() + report.status.slice(1)}
                  </span>
                </td>
                <td>{report.createdAt}</td>
                <td>
                  <div className="action-buttons">
                    <button
                      className="action-btn delete"
                      onClick={() => handleAction(report, 'delete')}
                      title="Delete Content"
                    >
                      <TrashIcon size={16} />
                    </button>
                    <button
                      className="action-btn dismiss"
                      onClick={() => handleAction(report, 'dismiss')}
                      title="Dismiss Report"
                    >
                      <AlertTriangleIcon size={16} />
                    </button>
                    <button
                      className="action-btn block"
                      onClick={() => handleAction(report, 'block')}
                      title="Block User"
                    >
                      <ShieldIcon size={16} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filteredReports.length === 0 && (
          <div className="admin-empty-state">
            <div className="empty-state-icon">
              <ShieldIcon size={64} />
            </div>
            <h3>No Reports Found</h3>
            <p className="empty-state-description">
              There are no content reports to review at this time.
            </p>
            <div className="empty-state-info">
              <p><strong>How reports work:</strong></p>
              <ul>
                <li>Users can report inappropriate content or behavior</li>
                <li>Reports appear here for moderation review</li>
                <li>You can delete content, dismiss reports, or block users</li>
              </ul>
            </div>
          </div>
        )}
      </div>

      {showActionModal && selectedReport && (
        <div className="modal-overlay" onClick={() => setShowActionModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{getActionText()}</h3>
              <button className="modal-close" onClick={() => setShowActionModal(false)}>
                ×
              </button>
            </div>
            <div className="modal-body">
              <p>
                Are you sure you want to {actionType} the content reported by{' '}
                <strong>{selectedReport.reporterName}</strong>?
              </p>
              <p className="text-muted">{getActionDescription()}</p>
              <div className="report-details">
                <p><strong>Reported Message ID:</strong> {selectedReport.reportedMessageId}</p>
                <p><strong>Reason:</strong> {selectedReport.reason}</p>
                <p><strong>Reported User:</strong> {selectedReport.reportedUserName}</p>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setShowActionModal(false)}>
                Cancel
              </button>
              <button
                className={`btn-primary ${actionType === 'delete' || actionType === 'block' ? 'danger' : ''}`}
                onClick={confirmAction}
              >
                {getActionText()}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ContentModeration;
