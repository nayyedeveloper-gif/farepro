import React, { useState } from 'react';
import AdminSidebar from './AdminSidebar';
import Dashboard from './Dashboard';
import UserManagement from './UserManagement';
import GroupManagement from './GroupManagement';
import ContentModeration from './ContentModeration';
import FileManagement from './FileManagement';
import CallManagement from './CallManagement';
import SystemSettings from './SystemSettings';
import AdsManagement from './AdsManagement';

const AdminPanel: React.FC = () => {
  const [activeTab, setActiveTab] = useState('dashboard');

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return <Dashboard />;
      case 'users':
        return <UserManagement />;
      case 'groups':
        return <GroupManagement />;
      case 'moderation':
        return <ContentModeration />;
      case 'files':
        return <FileManagement />;
      case 'calls':
        return <CallManagement />;
      case 'settings':
        return <SystemSettings />;
      case 'ads':
        return <AdsManagement />;
      default:
        return <Dashboard />;
    }
  };

  return (
    <div className="admin-panel">
      <AdminSidebar activeTab={activeTab} onTabChange={setActiveTab} />
      <div className="admin-content">
        {renderContent()}
      </div>
    </div>
  );
};

export default AdminPanel;
