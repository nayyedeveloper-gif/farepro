import React, { useEffect, useState, useMemo } from 'react';
import { userAPI } from '../../services/api';
import type { User } from '../../types';
import { XIcon, PlusIcon, ContactsIcon, SearchIcon } from '../icons/Icons';
import ListSkeleton from '../common/ListSkeleton';

interface ContactsPanelProps {
  onClose: () => void;
  onSelectUser: (user: User) => void;
  embedded?: boolean;
  onAddContact?: () => void;
}

const ContactsPanel: React.FC<ContactsPanelProps> = ({ onClose, onSelectUser, embedded, onAddContact }) => {
  const [contacts, setContacts] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [filterQuery, setFilterQuery] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [searching, setSearching] = useState(false);
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    loadContacts();
  }, []);

  const loadContacts = async () => {
    try {
      const res = await userAPI.getContacts();
      setContacts(Array.isArray(res.data) ? res.data : []);
    } catch {
      setContacts([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setSearching(true);
    try {
      const res = await userAPI.search(searchQuery);
      setSearchResults(Array.isArray(res.data) ? res.data : []);
    } catch {
      setSearchResults([]);
    } finally {
      setSearching(false);
    }
  };

  const handleAddContact = async (userId: string) => {
    setAdding(true);
    try {
      await userAPI.addContact(userId);
      await loadContacts();
      setShowAddModal(false);
      setSearchQuery('');
      setSearchResults([]);
    } catch {
      alert('Failed to add contact');
    } finally {
      setAdding(false);
    }
  };

  const filteredContacts = useMemo(() => {
    if (!filterQuery.trim()) return contacts;
    const q = filterQuery.toLowerCase();
    return contacts.filter((u) =>
      (u.firstName || '').toLowerCase().includes(q) ||
      (u.username || '').toLowerCase().includes(q) ||
      (u.phone || '').includes(q)
    );
  }, [contacts, filterQuery]);

  const groupedContacts = useMemo(() => {
    const sorted = [...filteredContacts].sort((a, b) => {
      const nameA = (a.firstName || a.username || '').toLowerCase();
      const nameB = (b.firstName || b.username || '').toLowerCase();
      return nameA.localeCompare(nameB);
    });
    const groups: { letter: string; users: User[] }[] = [];
    sorted.forEach((u) => {
      const letter = (u.firstName || u.username || '#').charAt(0).toUpperCase();
      const existing = groups.find((g) => g.letter === letter);
      if (existing) existing.users.push(u);
      else groups.push({ letter, users: [u] });
    });
    return groups;
  }, [filteredContacts]);

  const openAddModal = () => {
    if (onAddContact) onAddContact();
    else setShowAddModal(true);
  };

  const content = (
    <>
      {!embedded && (
        <div className="profile-header">
          <h2>Contacts</h2>
          <div className="profile-header-actions">
            <button className="profile-header-btn" onClick={openAddModal} title="Add Contact">
              <PlusIcon size={18} />
            </button>
            <button className="profile-close" onClick={onClose}>
              <XIcon size={18} />
            </button>
          </div>
        </div>
      )}

      {embedded && (
        <div className="contacts-embedded-header">
          <div className="contacts-search-box">
            <SearchIcon size={16} className="search-icon" />
            <input
              type="text"
              placeholder="Search"
              value={filterQuery}
              onChange={(e) => setFilterQuery(e.target.value)}
              className="search-input"
            />
          </div>
        </div>
      )}

      {loading ? (
        <ListSkeleton count={6} />
      ) : contacts.length === 0 ? (
        <div className="contacts-empty">
          <div className="empty-icon">
            <ContactsIcon size={48} />
          </div>
          <h3>No contacts yet</h3>
          <p>Add people to start messaging</p>
          <button className="btn-primary" onClick={openAddModal}>
            Add Contact
          </button>
        </div>
      ) : filteredContacts.length === 0 ? (
        <div className="contacts-empty">
          <p>No contacts match your search</p>
        </div>
      ) : (
        <div className="contacts-container">
          {groupedContacts.map((group) => (
            <div key={group.letter} className="contacts-group">
              <div className="contacts-group-header">{group.letter}</div>
              {group.users.map((u) => (
                <div
                  key={u.id}
                  className="contact-item"
                  onClick={() => onSelectUser(u)}
                >
                  <div className="contact-avatar">
                    {u.avatarUrl ? (
                      <img src={u.avatarUrl} alt="" />
                    ) : (
                      <div className="avatar-placeholder">
                        {(u.firstName || u.username).charAt(0)}
                      </div>
                    )}
                    {u.isOnline && <div className="online-indicator"></div>}
                  </div>
                  <div className="contact-info">
                    <div className="contact-name">
                      {u.firstName || u.username}
                    </div>
                    <div className="contact-status">
                      {u.isOnline ? 'online' : 'last seen recently'}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>
      )}

      {showAddModal && (
        <div className="modal-overlay" onClick={() => setShowAddModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Add Contact</h3>
              <button className="modal-close" onClick={() => setShowAddModal(false)}>
                <XIcon size={18} />
              </button>
            </div>
            <div className="modal-body">
              <div className="form-group">
                <input
                  type="text"
                  placeholder="Search by username or phone"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                />
                <button className="btn-primary" onClick={handleSearch} disabled={searching}>
                  {searching ? 'Searching...' : 'Search'}
                </button>
              </div>
              {searchResults.length > 0 && (
                <ul className="search-results">
                  {searchResults.map((u) => (
                    <li key={u.id}>
                      <div className="search-result-item">
                        <div className="conversation-avatar">
                          {u.avatarUrl ? (
                            <img src={u.avatarUrl} alt="" />
                          ) : (
                            <div className="avatar-placeholder">
                              {(u.firstName || u.username).charAt(0)}
                            </div>
                          )}
                        </div>
                        <div className="conversation-info">
                          <div className="conversation-name">
                            {u.firstName || u.username}
                          </div>
                          <div className="conversation-preview">
                            {u.phone || u.email || ''}
                          </div>
                        </div>
                        <button
                          className="btn-small"
                          onClick={() => handleAddContact(u.id)}
                          disabled={adding}
                        >
                          {adding ? 'Adding...' : 'Add'}
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
              {searchQuery && searchResults.length === 0 && !searching && (
                <p className="no-results">No users found</p>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );

  if (embedded) {
    return <div className="contacts-embedded">{content}</div>;
  }

  return (
    <div className="profile-overlay" onClick={onClose}>
      <div className="profile-panel contacts-panel" onClick={(e) => e.stopPropagation()}>
        {content}
      </div>
    </div>
  );
};

export default ContactsPanel;
