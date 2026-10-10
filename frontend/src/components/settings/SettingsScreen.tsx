import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useNotifications } from '../../contexts/NotificationContext';
import type { SettingsPageId } from './types';
import SettingsHub from './SettingsHub';
import EditProfilePage from './pages/EditProfilePage';
import PTTAudioPage from './pages/PTTAudioPage';
import PrivacySecurityPage from './pages/PrivacySecurityPage';
import DataStoragePage from './pages/DataStoragePage';
import DevicesPage from './pages/DevicesPage';
import AboutPage from './pages/AboutPage';
import { XIcon } from '../icons/Icons';
import './settings-pages.css';

interface SettingsScreenProps {
  onClose: () => void;
}

const SettingsScreen: React.FC<SettingsScreenProps> = ({ onClose }) => {
  const { user, updateUser, logout } = useAuth();
  const { sessionCount } = useNotifications();
  const [page, setPage] = useState<SettingsPageId>('hub');

  if (!user) return null;

  const handleLogout = () => {
    logout();
    onClose();
  };

  const goBack = () => setPage('hub');

  const renderPage = () => {
    switch (page) {
      case 'profile':
        return <EditProfilePage user={user} onBack={goBack} onUpdate={updateUser} />;
      case 'ptt':
        return <PTTAudioPage onBack={goBack} />;
      case 'privacy':
        return <PrivacySecurityPage onBack={goBack} />;
      case 'data':
        return <DataStoragePage onBack={goBack} />;
      case 'devices':
        return <DevicesPage onBack={goBack} />;
      case 'about':
        return <AboutPage onBack={goBack} />;
      default:
        return null;
    }
  };

  const isSubPage = page !== 'hub';

  return (
    <div className="settings-overlay" onClick={onClose}>
      <div className="tg-set-window" onClick={(e) => e.stopPropagation()}>
        <aside className={`tg-set-sidebar${isSubPage ? ' sub-open' : ''}`}>
          <header className="tg-set-sidebar-header">
            <h2 className="tg-set-sidebar-title">Settings</h2>
            <button type="button" className="settings-close-btn" onClick={onClose} aria-label="Close">
              <XIcon size={18} />
            </button>
          </header>
          <div className="tg-set-sidebar-body">
            <SettingsHub
              user={user}
              sessionCount={sessionCount}
              onNavigate={setPage}
              onLogout={handleLogout}
            />
          </div>
        </aside>

        <main className={`tg-set-main${isSubPage ? ' visible' : ''}`}>
          {isSubPage ? renderPage() : (
            <div className="tg-set-main-placeholder">
              <p>Select a setting from the list</p>
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

export default SettingsScreen;
