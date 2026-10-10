import React, { useState, useEffect, useRef } from 'react';
import { messageAPI, userAPI } from '../../services/api';
import type { User } from '../../types';
import { XIcon, SearchIcon } from '../icons/Icons';

interface AddMembersModalProps {
  conversationId: string;
  onClose: () => void;
  onMembersAdded: () => void;
}

const AddMembersModal: React.FC<AddMembersModalProps> = ({
  conversationId,
  onClose,
  onMembersAdded,
}) => {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<User[]>([]);
  const [searching, setSearching] = useState(false);
  const [selected, setSelected] = useState<User[]>([]);
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState('');

  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!query.trim()) { setResults([]); return; }
    const t = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await userAPI.search(query.trim());
        setResults(res.data || []);
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [query]);

  const handleAddMembers = async () => {
    if (selected.length === 0) return;
    setAdding(true);
    setError('');
    try {
      await messageAPI.addMembers(conversationId, selected.map(u => u.id));
      onMembersAdded();
      onClose();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } } };
      setError(e.response?.data?.error || 'Failed to add members');
      setAdding(false);
    }
  };

  const toggleSelect = (u: User) => {
    setSelected(prev =>
      prev.find(p => p.id === u.id) ? prev.filter(p => p.id !== u.id) : [...prev, u]
    );
  };

  const UserRow: React.FC<{ u: User; onClick: () => void; checked?: boolean }> = ({ u, onClick, checked }) => {
    const name = [u.firstName, u.lastName].filter(Boolean).join(' ') || u.username;
    const initial = name.charAt(0).toUpperCase();
    return (
      <button className="ncm-user-row" onClick={onClick}>
        <div className="ncm-avatar">
          {u.avatarUrl ? <img src={u.avatarUrl} alt="" /> : <span>{initial}</span>}
          {u.isOnline && <span className="ncm-online-dot" />}
        </div>
        <div className="ncm-user-info">
          <span className="ncm-user-name">{name}</span>
          <span className="ncm-user-sub">@{u.username}{u.phone ? ` · ${u.phone}` : ''}</span>
        </div>
        {checked !== undefined && (
          <span className={`ncm-check ${checked ? 'ncm-check--on' : ''}`} />
        )}
      </button>
    );
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="ncm-sheet" onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="ncm-header">
          <button className="ncm-close" onClick={onClose}><XIcon size={18} /></button>
          <h3 className="ncm-title">Add Members</h3>
          <button
            className="ncm-done"
            disabled={selected.length === 0 || adding}
            onClick={handleAddMembers}
          >
            {adding ? '…' : 'Add'}
          </button>
        </div>

        {/* Search for users */}
        <div className="ncm-search-wrap">
          <SearchIcon size={15} className="ncm-search-icon" />
          <input
            ref={inputRef}
            className="ncm-search-input"
            placeholder="Search users…"
            value={query}
            onChange={e => setQuery(e.target.value)}
            autoFocus
          />
          {query && (
            <button className="ncm-search-clear" onClick={() => setQuery('')}>
              <XIcon size={14} />
            </button>
          )}
        </div>

        {/* Selected chips */}
        {selected.length > 0 && (
          <div className="ncm-chips">
            {selected.map(u => (
              <span key={u.id} className="ncm-chip" onClick={() => toggleSelect(u)}>
                {u.firstName || u.username}
                <XIcon size={12} className="ncm-chip-remove" />
              </span>
            ))}
          </div>
        )}

        {/* Results */}
        <div className="ncm-list">
          {searching && <p className="ncm-hint">Searching…</p>}
          {!searching && query && results.length === 0 && (
            <p className="ncm-hint">No users found for "{query}"</p>
          )}
          {results.map(u => (
            <UserRow
              key={u.id}
              u={u}
              onClick={() => toggleSelect(u)}
              checked={!!selected.find(p => p.id === u.id)}
            />
          ))}
        </div>

        {error && <p className="ncm-error">{error}</p>}
      </div>
    </div>
  );
};

export default AddMembersModal;
