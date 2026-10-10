import React from 'react';
import { useNotifications } from '../../../contexts/NotificationContext';
import { subscribeToPush, unsubscribeFromPush, isPushSupported } from '../../../services/pushService';
import SettingsPageShell from '../SettingsPageShell';
import SoundSettings from '../SoundSettings';
import { BellIcon, CheckIcon, XIcon, PlusIcon } from '../../icons/Icons';

interface NotificationsPageProps {
  onBack: () => void;
}

const NotificationsPage: React.FC<NotificationsPageProps> = ({ onBack }) => {
  const { requestPushPermission } = useNotifications();
  const pushPermission = isPushSupported() ? Notification.permission : 'unsupported';

  const pushStatus = pushPermission === 'granted'
    ? 'Enabled'
    : pushPermission === 'denied'
      ? 'Blocked'
      : pushPermission === 'unsupported'
        ? 'Not supported'
        : 'Disabled';

  const handlePushToggle = async () => {
    if (pushPermission === 'granted') {
      await unsubscribeFromPush();
    } else {
      await requestPushPermission();
    }
  };

  return (
    <SettingsPageShell title="Notifications and Sounds" onBack={onBack}>
      <div className="notifications-page">
        {/* Push Notifications Section */}
        <div className="notifications-section">
          <div className="notifications-section-header">
            <BellIcon size={20} className="section-icon" />
            <h3 className="section-title">Push Notifications</h3>
          </div>
          
          <div className="notification-card">
            <div className="notification-card-content">
              <div className="notification-info">
                <h4 className="notification-label">Browser Notifications</h4>
                <p className="notification-description">
                  Calls, job assignments, and geofence zone alerts when the app is in the background.
                </p>
                <p className="notification-status">
                  Status: <span className={`status-badge status-${pushPermission}`}>{pushStatus}</span>
                </p>
              </div>
              {pushPermission !== 'denied' && pushPermission !== 'unsupported' && (
                <button
                  type="button"
                  className={`notification-toggle-btn ${pushPermission === 'granted' ? 'enabled' : 'disabled'}`}
                  onClick={handlePushToggle}
                >
                  {pushPermission === 'granted' ? (
                    <>
                      <CheckIcon size={16} />
                      Enabled
                    </>
                  ) : (
                    <>
                      <XIcon size={16} />
                      Disabled
                    </>
                  )}
                </button>
              )}
            </div>
            
            {pushPermission === 'granted' && (
              <div className="notification-actions">
                <button
                  type="button"
                  className="notification-action-btn"
                  onClick={() => subscribeToPush()}
                >
                  <PlusIcon size={16} />
                  Re-subscribe on this device
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Sound Settings Section */}
        <div className="notifications-section">
          <div className="notifications-section-header">
            <BellIcon size={20} className="section-icon" />
            <h3 className="section-title">Sound Settings</h3>
          </div>
          <div className="sound-settings-embed">
            <SoundSettings />
          </div>
        </div>
      </div>
    </SettingsPageShell>
  );
};

export default NotificationsPage;
