import React, { useEffect, useState } from 'react';
import { SearchIcon, TrashIcon } from '../icons/Icons';
import { adminApi } from '../../services/adminApi';

const DownloadIcon: React.FC<{ size?: number }> = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="7 10 12 15 17 10" />
    <line x1="12" y1="15" x2="12" y2="3" />
  </svg>
);

const MoreVerticalIcon: React.FC<{ size?: number }> = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="12" cy="12" r="1" />
    <circle cx="12" cy="5" r="1" />
    <circle cx="12" cy="19" r="1" />
  </svg>
);

const ImageIcon: React.FC<{ size?: number }> = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
    <circle cx="8.5" cy="8.5" r="1.5" />
    <polyline points="21 15 16 10 5 21" />
  </svg>
);

const VideoIcon: React.FC<{ size?: number }> = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <polygon points="23 7 16 12 23 17 23 7" />
    <rect x="1" y="5" width="15" height="14" rx="2" ry="2" />
  </svg>
);

const AudioIcon: React.FC<{ size?: number }> = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M9 18V5l12-2v13" />
    <circle cx="6" cy="18" r="3" />
    <circle cx="18" cy="16" r="3" />
  </svg>
);

const DocumentIcon: React.FC<{ size?: number }> = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
    <line x1="16" y1="13" x2="8" y2="13" />
    <line x1="16" y1="17" x2="8" y2="17" />
    <polyline points="10 9 9 9 8 9" />
  </svg>
);

const FolderIcon: React.FC<{ size?: number }> = ({ size = 20 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
  </svg>
);

interface File {
  id: string;
  fileName: string;
  fileType: string;
  fileSize: string;
  uploaderId: string;
  uploaderName: string;
  createdAt: string;
  downloadCount: number;
  fileUrl: string;
}

const FileManagement: React.FC = () => {
  const [files, setFiles] = useState<File[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'image' | 'video' | 'audio' | 'document'>('all');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  useEffect(() => {
    loadFiles();
  }, []);

  const loadFiles = async () => {
    try {
      const data = await adminApi.getFiles({ page: 1, limit: 50, type: filterType });
      setFiles(data.files);
    } catch (error) {
      console.error('Failed to load files:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredFiles = files.filter(
    (file) =>
      (filterType === 'all' || file.fileType === filterType) &&
      file.fileName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleDeleteFile = (file: File) => {
    setSelectedFile(file);
    setShowDeleteModal(true);
  };

  const confirmDelete = async () => {
    if (!selectedFile) return;
    try {
      await adminApi.deleteFile(selectedFile.id);
      setFiles(files.filter((f) => f.id !== selectedFile.id));
      setShowDeleteModal(false);
      setSelectedFile(null);
    } catch (error) {
      console.error('Failed to delete file:', error);
    }
  };

  const getTotalStorage = () => {
    // Mock calculation
    return '2.5 GB';
  };

  const getFileTypeIcon = (type: string) => {
    switch (type) {
      case 'image':
        return <ImageIcon size={20} />;
      case 'video':
        return <VideoIcon size={20} />;
      case 'audio':
        return <AudioIcon size={20} />;
      case 'document':
        return <DocumentIcon size={20} />;
      default:
        return <FolderIcon size={20} />;
    }
  };

  if (loading) {
    return (
      <div className="admin-loading">
        <div className="loading-spinner" />
        <p>Loading files...</p>
      </div>
    );
  }

  return (
    <div className="admin-file-management">
      <div className="admin-header">
        <h1>File Management</h1>
        <p className="admin-subtitle">Manage uploaded files and storage usage</p>
      </div>

      <div className="admin-stats-grid">
        <div className="admin-stat-card">
          <div className="admin-stat-icon" style={{ background: 'rgba(36, 161, 222, 0.1)' }}>
            📁
          </div>
          <div className="admin-stat-content">
            <div className="admin-stat-label">Total Files</div>
            <div className="admin-stat-value">{files.length}</div>
          </div>
        </div>
        <div className="admin-stat-card">
          <div className="admin-stat-icon" style={{ background: 'rgba(236, 72, 153, 0.1)' }}>
            💾
          </div>
          <div className="admin-stat-content">
            <div className="admin-stat-label">Storage Used</div>
            <div className="admin-stat-value">{getTotalStorage()}</div>
          </div>
        </div>
        <div className="admin-stat-card">
          <div className="admin-stat-icon" style={{ background: 'rgba(77, 205, 94, 0.1)' }}>
            ⬇️
          </div>
          <div className="admin-stat-content">
            <div className="admin-stat-label">Total Downloads</div>
            <div className="admin-stat-value">
              {files.reduce((sum, f) => sum + f.downloadCount, 0)}
            </div>
          </div>
        </div>
      </div>

      <div className="admin-toolbar">
        <div className="admin-search">
          <SearchIcon size={18} className="search-icon" />
          <input
            type="text"
            placeholder="Search files by name..."
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
            className={`filter-btn ${filterType === 'image' ? 'active' : ''}`}
            onClick={() => setFilterType('image')}
          >
            Images
          </button>
          <button
            className={`filter-btn ${filterType === 'video' ? 'active' : ''}`}
            onClick={() => setFilterType('video')}
          >
            Videos
          </button>
          <button
            className={`filter-btn ${filterType === 'audio' ? 'active' : ''}`}
            onClick={() => setFilterType('audio')}
          >
            Audio
          </button>
          <button
            className={`filter-btn ${filterType === 'document' ? 'active' : ''}`}
            onClick={() => setFilterType('document')}
          >
            Documents
          </button>
        </div>
      </div>

      <div className="admin-table-container">
        <table className="admin-table">
          <thead>
            <tr>
              <th>File</th>
              <th>Type</th>
              <th>Size</th>
              <th>Uploader</th>
              <th>Upload Date</th>
              <th>Downloads</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredFiles.map((file) => (
              <tr key={file.id}>
                <td>
                  <div className="file-cell">
                    <div className="file-icon">{getFileTypeIcon(file.fileType)}</div>
                    <div className="file-info">
                      <div className="file-name">{file.fileName}</div>
                      <div className="file-id">ID: {file.id}</div>
                    </div>
                  </div>
                </td>
                <td>
                  <span className={`type-badge ${file.fileType}`}>
                    {file.fileType.charAt(0).toUpperCase() + file.fileType.slice(1)}
                  </span>
                </td>
                <td>{file.fileSize}</td>
                <td>
                  <div className="user-info-small">
                    <div className="user-name-small">{file.uploaderName}</div>
                    <div className="user-id-small">ID: {file.uploaderId}</div>
                  </div>
                </td>
                <td>{file.createdAt}</td>
                <td>{file.downloadCount}</td>
                <td>
                  <div className="action-buttons">
                    <button className="action-btn" title="Download">
                      <DownloadIcon size={16} />
                    </button>
                    <button
                      className="action-btn delete"
                      onClick={() => handleDeleteFile(file)}
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
        {filteredFiles.length === 0 && (
          <div className="admin-empty-state">
            <div className="empty-state-icon">
              <FolderIcon size={64} />
            </div>
            <h3>No Files Found</h3>
            <p className="empty-state-description">
              There are no files uploaded to the platform at this time.
            </p>
            <div className="empty-state-info">
              <p><strong>File Management:</strong></p>
              <ul>
                <li>Users can upload images, videos, audio, and documents</li>
                <li>Files appear here for administrative review</li>
                <li>You can delete inappropriate or unauthorized files</li>
              </ul>
            </div>
          </div>
        )}
      </div>

      {showDeleteModal && selectedFile && (
        <div className="modal-overlay" onClick={() => setShowDeleteModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Delete File</h3>
              <button className="modal-close" onClick={() => setShowDeleteModal(false)}>
                ×
              </button>
            </div>
            <div className="modal-body">
              <p>
                Are you sure you want to delete <strong>{selectedFile.fileName}</strong>?
              </p>
              <p className="text-muted">
                This action cannot be undone. The file will be permanently deleted from the server.
              </p>
              <p className="text-warning">
                This file has been downloaded {selectedFile.downloadCount} times.
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

export default FileManagement;
