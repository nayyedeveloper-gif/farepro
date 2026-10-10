import React, { useEffect, useState } from 'react';
import { SearchIcon, TrashIcon, EditIcon } from '../icons/Icons';
import { adminApi } from '../../services/adminApi';

const PlusIconSVG: React.FC<{ size?: number }> = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <line x1="12" y1="5" x2="12" y2="19" />
    <line x1="5" y1="12" x2="19" y2="12" />
  </svg>
);

interface Ad {
  id: string;
  title: string;
  description: string;
  type: 'image' | 'video' | 'html';
  contentUrl: string;
  targetUrl: string;
  duration: number;
  isActive: boolean;
  startDate: string;
  endDate: string;
  impressions: number;
  clicks: number;
  createdAt: string;
  updatedAt: string;
}

const AdsManagement: React.FC = () => {
  const [ads, setAds] = useState<Ad[]>([]);
  const [analytics, setAnalytics] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedAd, setSelectedAd] = useState<Ad | null>(null);
  const [showAnalytics, setShowAnalytics] = useState(false);

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    type: 'image' as 'image' | 'video' | 'html',
    contentUrl: '',
    targetUrl: '',
    duration: 5,
    isActive: true,
    startDate: '',
    endDate: '',
  });

  useEffect(() => {
    loadAds();
    loadAnalytics();
  }, []);

  const loadAds = async () => {
    try {
      const data = await adminApi.getAds({ page: 1, limit: 50 });
      setAds(data.ads);
    } catch (error) {
      console.error('Failed to load ads:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadAnalytics = async () => {
    try {
      const data = await adminApi.getAdAnalytics();
      setAnalytics(data.analytics);
    } catch (error) {
      console.error('Failed to load analytics:', error);
    }
  };

  const handleCreateAd = () => {
    setFormData({
      title: '',
      description: '',
      type: 'image',
      contentUrl: '',
      targetUrl: '',
      duration: 5,
      isActive: true,
      startDate: '',
      endDate: '',
    });
    setShowCreateModal(true);
  };

  const handleEditAd = (ad: Ad) => {
    setSelectedAd(ad);
    setFormData({
      title: ad.title,
      description: ad.description,
      type: ad.type,
      contentUrl: ad.contentUrl,
      targetUrl: ad.targetUrl,
      duration: ad.duration,
      isActive: ad.isActive,
      startDate: ad.startDate,
      endDate: ad.endDate,
    });
    setShowEditModal(true);
  };

  const handleDeleteAd = (ad: Ad) => {
    if (confirm(`Are you sure you want to delete "${ad.title}"?`)) {
      adminApi.deleteAd(ad.id).then(() => {
        setAds(ads.filter((a) => a.id !== ad.id));
      });
    }
  };

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await adminApi.createAd(formData);
      setShowCreateModal(false);
      loadAds();
    } catch (error) {
      console.error('Failed to create ad:', error);
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAd) return;
    try {
      await adminApi.updateAd(selectedAd.id, formData);
      setShowEditModal(false);
      loadAds();
    } catch (error) {
      console.error('Failed to update ad:', error);
    }
  };

  const filteredAds = ads.filter(
    (ad) =>
      ad.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      ad.description.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const totalImpressions = analytics.reduce((sum, a) => sum + a.impressions, 0);
  const totalClicks = analytics.reduce((sum, a) => sum + a.clicks, 0);
  const avgCTR = analytics.length > 0 ? (totalClicks / totalImpressions) * 100 : 0;

  if (loading) {
    return (
      <div className="admin-loading">
        <div className="loading-spinner" />
        <p>Loading ads...</p>
      </div>
    );
  }

  return (
    <div className="admin-ads-management">
      <div className="admin-header">
        <h1>Ads Management</h1>
        <p className="admin-subtitle">Manage post-call advertisements</p>
      </div>

      <div className="admin-toolbar">
        <div className="admin-search">
          <SearchIcon size={18} className="search-icon" />
          <input
            type="text"
            placeholder="Search ads by title or description..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="admin-actions">
          <button className="btn-primary" onClick={handleCreateAd}>
            <PlusIconSVG size={16} />
            Create Ad
          </button>
          <button className="btn-secondary" onClick={() => setShowAnalytics(!showAnalytics)}>
            {showAnalytics ? 'Hide' : 'Show'} Analytics
          </button>
        </div>
      </div>

      {showAnalytics && (
        <div className="admin-analytics-cards">
          <div className="admin-stat-card">
            <div className="admin-stat-icon" style={{ background: 'var(--tg-blue)' }}>
              <span>👁️</span>
            </div>
            <div className="admin-stat-content">
              <div className="admin-stat-label">Total Impressions</div>
              <div className="admin-stat-value">{totalImpressions.toLocaleString()}</div>
            </div>
          </div>
          <div className="admin-stat-card">
            <div className="admin-stat-icon" style={{ background: 'var(--tg-green)' }}>
              <span>👆</span>
            </div>
            <div className="admin-stat-content">
              <div className="admin-stat-label">Total Clicks</div>
              <div className="admin-stat-value">{totalClicks.toLocaleString()}</div>
            </div>
          </div>
          <div className="admin-stat-card">
            <div className="admin-stat-icon" style={{ background: 'var(--tg-purple)' }}>
              <span>📊</span>
            </div>
            <div className="admin-stat-content">
              <div className="admin-stat-label">Avg CTR</div>
              <div className="admin-stat-value">{avgCTR.toFixed(2)}%</div>
            </div>
          </div>
          <div className="admin-stat-card">
            <div className="admin-stat-icon" style={{ background: 'var(--tg-orange)' }}>
              <span>📢</span>
            </div>
            <div className="admin-stat-content">
              <div className="admin-stat-label">Active Ads</div>
              <div className="admin-stat-value">{ads.filter((a) => a.isActive).length}</div>
            </div>
          </div>
        </div>
      )}

      <div className="admin-table-container">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Ad</th>
              <th>Type</th>
              <th>Duration</th>
              <th>Status</th>
              <th>Impressions</th>
              <th>Clicks</th>
              <th>CTR</th>
              <th>Created</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredAds.map((ad) => {
              const ctr = ad.impressions > 0 ? (ad.clicks / ad.impressions) * 100 : 0;
              return (
                <tr key={ad.id}>
                  <td>
                    <div className="ad-info">
                      <div className="ad-title">{ad.title}</div>
                      <div className="ad-description">{ad.description}</div>
                    </div>
                  </td>
                  <td>
                    <span className={`type-badge ${ad.type}`}>
                      {ad.type.charAt(0).toUpperCase() + ad.type.slice(1)}
                    </span>
                  </td>
                  <td>{ad.duration}s</td>
                  <td>
                    <span className={`status-badge ${ad.isActive ? 'active' : 'inactive'}`}>
                      {ad.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td>{ad.impressions.toLocaleString()}</td>
                  <td>{ad.clicks.toLocaleString()}</td>
                  <td>{ctr.toFixed(2)}%</td>
                  <td>{ad.createdAt}</td>
                  <td>
                    <div className="action-buttons">
                      <button
                        className="action-btn"
                        onClick={() => handleEditAd(ad)}
                        title="Edit"
                      >
                        <EditIcon size={16} />
                      </button>
                      <button
                        className="action-btn delete"
                        onClick={() => handleDeleteAd(ad)}
                        title="Delete"
                      >
                        <TrashIcon size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Create Ad Modal */}
      {showCreateModal && (
        <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Create New Ad</h3>
              <button className="modal-close" onClick={() => setShowCreateModal(false)}>
                ×
              </button>
            </div>
            <form onSubmit={handleCreateSubmit} className="modal-body">
              <div className="form-group">
                <label>Title *</label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label>Description</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={3}
                />
              </div>
              <div className="form-group">
                <label>Type *</label>
                <select
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value as any })}
                >
                  <option value="image">Image</option>
                  <option value="video">Video</option>
                  <option value="html">HTML</option>
                </select>
              </div>
              <div className="form-group">
                <label>Content URL *</label>
                <input
                  type="url"
                  value={formData.contentUrl}
                  onChange={(e) => setFormData({ ...formData, contentUrl: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label>Target URL</label>
                <input
                  type="url"
                  value={formData.targetUrl}
                  onChange={(e) => setFormData({ ...formData, targetUrl: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label>Duration (seconds)</label>
                <input
                  type="number"
                  value={formData.duration}
                  onChange={(e) => setFormData({ ...formData, duration: parseInt(e.target.value) })}
                  min={1}
                  max={30}
                />
              </div>
              <div className="form-group">
                <label>Start Date</label>
                <input
                  type="date"
                  value={formData.startDate}
                  onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label>End Date</label>
                <input
                  type="date"
                  value={formData.endDate}
                  onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                />
              </div>
              <div className="form-group checkbox">
                <label>
                  <input
                    type="checkbox"
                    checked={formData.isActive}
                    onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                  />
                  Active
                </label>
              </div>
            </form>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setShowCreateModal(false)}>
                Cancel
              </button>
              <button className="btn-primary" onClick={handleCreateSubmit}>
                Create Ad
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Ad Modal */}
      {showEditModal && selectedAd && (
        <div className="modal-overlay" onClick={() => setShowEditModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Edit Ad</h3>
              <button className="modal-close" onClick={() => setShowEditModal(false)}>
                ×
              </button>
            </div>
            <form onSubmit={handleEditSubmit} className="modal-body">
              <div className="form-group">
                <label>Title *</label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label>Description</label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={3}
                />
              </div>
              <div className="form-group">
                <label>Type *</label>
                <select
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value as any })}
                >
                  <option value="image">Image</option>
                  <option value="video">Video</option>
                  <option value="html">HTML</option>
                </select>
              </div>
              <div className="form-group">
                <label>Content URL *</label>
                <input
                  type="url"
                  value={formData.contentUrl}
                  onChange={(e) => setFormData({ ...formData, contentUrl: e.target.value })}
                  required
                />
              </div>
              <div className="form-group">
                <label>Target URL</label>
                <input
                  type="url"
                  value={formData.targetUrl}
                  onChange={(e) => setFormData({ ...formData, targetUrl: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label>Duration (seconds)</label>
                <input
                  type="number"
                  value={formData.duration}
                  onChange={(e) => setFormData({ ...formData, duration: parseInt(e.target.value) })}
                  min={1}
                  max={30}
                />
              </div>
              <div className="form-group">
                <label>Start Date</label>
                <input
                  type="date"
                  value={formData.startDate}
                  onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label>End Date</label>
                <input
                  type="date"
                  value={formData.endDate}
                  onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
                />
              </div>
              <div className="form-group checkbox">
                <label>
                  <input
                    type="checkbox"
                    checked={formData.isActive}
                    onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                  />
                  Active
                </label>
              </div>
            </form>
            <div className="modal-footer">
              <button className="btn-secondary" onClick={() => setShowEditModal(false)}>
                Cancel
              </button>
              <button className="btn-primary" onClick={handleEditSubmit}>
                Update Ad
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdsManagement;
