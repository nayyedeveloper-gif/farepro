import React, { useState } from 'react';
import { userAPI } from '../../services/api';
import { PlusIcon, XIcon } from '../icons/Icons';
import type { User } from '../../types';

interface UserSearchModalProps {
  onClose: () => void;
  onUserSelected: (user: User) => void;
}

const UserSearchModal: React.FC<UserSearchModalProps> = ({
  onClose,
  onUserSelected,
}) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleAddContact = async (e: React.MouseEvent, userId: string) => {
    e.stopPropagation();
    try {
      await userAPI.addContact(userId);
      setError('');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to add contact');
    }
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;

    setLoading(true);
    setError('');
    try {
      const response = await userAPI.search(query);
      setResults(response.data || []);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Search failed');
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Search Users</h2>
          <button className="close-btn" onClick={onClose} aria-label="Close">
            <XIcon size={18} />
          </button>
        </div>
        <form onSubmit={handleSearch}>
          <div className="form-group">
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by username or phone"
              autoFocus
            />
          </div>
          <button type="submit" disabled={loading} className="submit-btn">
            {loading ? 'Searching...' : 'Search'}
          </button>
        </form>
        {error && <div className="error-message">{error}</div>}
        {results.length > 0 && (
          <div className="search-results">
            {results.map((user) => (
              <div
                key={user.id}
                className="user-result-item"
                onClick={() => onUserSelected(user)}
              >
                <div className="user-avatar">
                  {user.avatarUrl ? (
                    <img src={user.avatarUrl} alt="" />
                  ) : (
                    <div className="avatar-placeholder">
                      {(user.firstName || user.username).charAt(0)}
                    </div>
                  )}
                </div>
                <div className="user-info">
                  <div className="user-name">
                    {user.firstName || user.username}
                  </div>
                  <div className="user-email">{user.phone}</div>
                </div>
                <button
                  className="add-contact-btn"
                  onClick={(e) => handleAddContact(e, user.id)}
                  title="Add contact"
                >
                  <PlusIcon size={16} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default UserSearchModal;
