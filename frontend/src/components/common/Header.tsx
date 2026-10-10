import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import UserSearchModal from './UserSearchModal';
import { SearchIcon, LogoutIcon } from '../icons/Icons';
import type { User } from '../../types';

interface HeaderProps {
  onUserSelected?: (userId: string) => void;
}

const Header: React.FC<HeaderProps> = ({ onUserSelected }) => {
  const { user, logout } = useAuth();
  const [showSearchModal, setShowSearchModal] = useState(false);

  const handleUserSelected = (selectedUser: User) => {
    setShowSearchModal(false);
    if (onUserSelected) {
      onUserSelected(selectedUser.id);
    }
  };

  return (
    <>
      <header className="header">
        <div className="header-content">
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div className="teamlink-logo">
              <img src="/logo.png" alt="TeamLink Logo" style={{ width: 40, height: 40 }} />
            </div>
            <h1>TeamLink</h1>
          </div>
          <div className="user-info">
            <button 
              className="search-users-btn"
              onClick={() => setShowSearchModal(true)}
            >
              <SearchIcon size={16} />
              Search Users
            </button>
            <span className="user-name">
              {user?.firstName || user?.username}
            </span>
            <button onClick={logout} className="logout-button">
              <LogoutIcon size={16} />
              Logout
            </button>
          </div>
        </div>
      </header>
      {showSearchModal && (
        <UserSearchModal
          onClose={() => setShowSearchModal(false)}
          onUserSelected={handleUserSelected}
        />
      )}
    </>
  );
};

export default Header;
