import React, { useEffect, useState } from 'react';
import { adminApi } from '../../services/adminApi';

const SaveIcon: React.FC<{ size?: number }> = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
    <polyline points="17 21 17 13 7 13 7 21" />
    <polyline points="7 3 7 8 15 8" />
  </svg>
);

const RefreshIcon: React.FC<{ size?: number }> = ({ size = 16 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <polyline points="23 4 23 10 17 10" />
    <polyline points="1 20 1 14 7 14" />
    <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
  </svg>
);

interface SystemSettings {
  appName: string;
  appVersion: string;
  maxFileSize: number;
  allowedFileTypes: string[];
  maxGroupMembers: number;
  enableRegistration: boolean;
  enableFileUpload: boolean;
  enableCalls: boolean;
  maintenanceMode: boolean;
  storageLimit: number;
  rateLimitPerMinute: number;
}

const SystemSettings: React.FC = () => {
  const [settings, setSettings] = useState<SystemSettings>({
    appName: 'TeamLink PTT',
    appVersion: '1.0.0',
    maxFileSize: 100,
    allowedFileTypes: ['image', 'video', 'audio', 'document'],
    maxGroupMembers: 200,
    enableRegistration: true,
    enableFileUpload: true,
    enableCalls: true,
    maintenanceMode: false,
    storageLimit: 10,
    rateLimitPerMinute: 60,
  });
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    setLoading(true);
    try {
      const data = await adminApi.getSystemSettings();
      setSettings(data);
    } catch (error) {
      console.error('Failed to load settings:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await adminApi.updateSystemSettings(settings);
      setMessage({ type: 'success', text: 'Settings saved successfully' });
      setTimeout(() => setMessage(null), 3000);
    } catch (error) {
      console.error('Failed to save settings:', error);
      setMessage({ type: 'error', text: 'Failed to save settings' });
      setTimeout(() => setMessage(null), 3000);
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    if (!confirm('Are you sure you want to reset all settings to default?')) {
      return;
    }
    setLoading(true);
    try {
      // TODO: Call API to reset settings
      await new Promise((resolve) => setTimeout(resolve, 500));
      setSettings({
        appName: 'TeamLink PTT',
        appVersion: '1.0.0',
        maxFileSize: 100,
        allowedFileTypes: ['image', 'video', 'audio', 'document'],
        maxGroupMembers: 200,
        enableRegistration: true,
        enableFileUpload: true,
        enableCalls: true,
        maintenanceMode: false,
        storageLimit: 10,
        rateLimitPerMinute: 60,
      });
      setMessage({ type: 'success', text: 'Settings reset to default' });
      setTimeout(() => setMessage(null), 3000);
    } catch (error) {
      console.error('Failed to reset settings:', error);
      setMessage({ type: 'error', text: 'Failed to reset settings' });
      setTimeout(() => setMessage(null), 3000);
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = (key: keyof SystemSettings) => {
    setSettings((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const handleInputChange = (key: keyof SystemSettings, value: any) => {
    setSettings((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const handleFileTypeToggle = (type: string) => {
    setSettings((prev) => ({
      ...prev,
      allowedFileTypes: prev.allowedFileTypes.includes(type)
        ? prev.allowedFileTypes.filter((t) => t !== type)
        : [...prev.allowedFileTypes, type],
    }));
  };

  if (loading) {
    return (
      <div className="admin-loading">
        <div className="loading-spinner" />
        <p>Loading settings...</p>
      </div>
    );
  }

  return (
    <div className="admin-system-settings">
      <div className="admin-header">
        <h1>System Settings</h1>
        <p className="admin-subtitle">Configure system-wide settings and preferences</p>
      </div>

      {message && (
        <div className={`admin-message ${message.type}`}>
          {message.text}
        </div>
      )}

      <div className="settings-container">
        {/* General Settings */}
        <div className="settings-section">
          <h2>General Settings</h2>
          <div className="settings-grid">
            <div className="setting-item">
              <label>Application Name</label>
              <input
                type="text"
                value={settings.appName}
                onChange={(e) => handleInputChange('appName', e.target.value)}
                className="setting-input"
              />
            </div>
            <div className="setting-item">
              <label>Application Version</label>
              <input
                type="text"
                value={settings.appVersion}
                onChange={(e) => handleInputChange('appVersion', e.target.value)}
                className="setting-input"
              />
            </div>
          </div>
        </div>

        {/* File Settings */}
        <div className="settings-section">
          <h2>File Settings</h2>
          <div className="settings-grid">
            <div className="setting-item">
              <label>Max File Size (MB)</label>
              <input
                type="number"
                value={settings.maxFileSize}
                onChange={(e) => handleInputChange('maxFileSize', parseInt(e.target.value))}
                className="setting-input"
              />
            </div>
            <div className="setting-item">
              <label>Storage Limit (GB)</label>
              <input
                type="number"
                value={settings.storageLimit}
                onChange={(e) => handleInputChange('storageLimit', parseInt(e.target.value))}
                className="setting-input"
              />
            </div>
          </div>
          <div className="setting-item">
            <label>Allowed File Types</label>
            <div className="checkbox-group">
              {['image', 'video', 'audio', 'document'].map((type) => (
                <label key={type} className="checkbox-label">
                  <input
                    type="checkbox"
                    checked={settings.allowedFileTypes.includes(type)}
                    onChange={() => handleFileTypeToggle(type)}
                  />
                  <span>{type.charAt(0).toUpperCase() + type.slice(1)}</span>
                </label>
              ))}
            </div>
          </div>
        </div>

        {/* Group Settings */}
        <div className="settings-section">
          <h2>Group Settings</h2>
          <div className="settings-grid">
            <div className="setting-item">
              <label>Max Group Members</label>
              <input
                type="number"
                value={settings.maxGroupMembers}
                onChange={(e) => handleInputChange('maxGroupMembers', parseInt(e.target.value))}
                className="setting-input"
              />
            </div>
          </div>
        </div>

        {/* Feature Toggles */}
        <div className="settings-section">
          <h2>Feature Toggles</h2>
          <div className="toggles-grid">
            <div className="toggle-item">
              <label>Enable Registration</label>
              <div className="toggle-switch">
                <input
                  type="checkbox"
                  checked={settings.enableRegistration}
                  onChange={() => handleToggle('enableRegistration')}
                />
                <span className="toggle-slider" />
              </div>
            </div>
            <div className="toggle-item">
              <label>Enable File Upload</label>
              <div className="toggle-switch">
                <input
                  type="checkbox"
                  checked={settings.enableFileUpload}
                  onChange={() => handleToggle('enableFileUpload')}
                />
                <span className="toggle-slider" />
              </div>
            </div>
            <div className="toggle-item">
              <label>Enable Calls</label>
              <div className="toggle-switch">
                <input
                  type="checkbox"
                  checked={settings.enableCalls}
                  onChange={() => handleToggle('enableCalls')}
                />
                <span className="toggle-slider" />
              </div>
            </div>
            <div className="toggle-item">
              <label>Maintenance Mode</label>
              <div className="toggle-switch">
                <input
                  type="checkbox"
                  checked={settings.maintenanceMode}
                  onChange={() => handleToggle('maintenanceMode')}
                />
                <span className="toggle-slider" />
              </div>
            </div>
          </div>
        </div>

        {/* Rate Limiting */}
        <div className="settings-section">
          <h2>Rate Limiting</h2>
          <div className="settings-grid">
            <div className="setting-item">
              <label>Requests Per Minute</label>
              <input
                type="number"
                value={settings.rateLimitPerMinute}
                onChange={(e) => handleInputChange('rateLimitPerMinute', parseInt(e.target.value))}
                className="setting-input"
              />
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="settings-actions">
          <button className="btn-secondary" onClick={handleReset} disabled={loading}>
            <RefreshIcon size={16} />
            Reset to Default
          </button>
          <button className="btn-primary" onClick={handleSave} disabled={saving}>
            <SaveIcon size={16} />
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default SystemSettings;
