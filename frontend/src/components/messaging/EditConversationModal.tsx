import React, { useState, useRef } from 'react';
import { messageAPI, fileAPI } from '../../services/api';
import { XIcon } from '../icons/Icons';

interface EditConversationModalProps {
  conversationId: string;
  currentName: string;
  currentDescription: string;
  currentAvatarUrl?: string;
  onClose: () => void;
  onConversationUpdated: () => void;
}

const EditConversationModal: React.FC<EditConversationModalProps> = ({
  conversationId,
  currentName,
  currentDescription,
  currentAvatarUrl,
  onClose,
  onConversationUpdated,
}) => {
  const [name, setName] = useState(currentName);
  const [description, setDescription] = useState(currentDescription);
  const [avatarUrl, setAvatarUrl] = useState(currentAvatarUrl || '');
  const [uploading, setUploading] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [error, setError] = useState('');

  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setError('');
    try {
      const res = await fileAPI.uploadFile(file);
      setAvatarUrl(res.data.url);
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } } };
      setError(e.response?.data?.error || 'Failed to upload avatar');
    } finally {
      setUploading(false);
    }
  };

  const handleUpdate = async () => {
    if (!name.trim()) return;
    setUpdating(true);
    setError('');
    try {
      await messageAPI.updateConversation(conversationId, {
        name: name.trim(),
        description: description.trim(),
        avatarUrl: avatarUrl,
      });
      onConversationUpdated();
      onClose();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } } };
      setError(e.response?.data?.error || 'Failed to update conversation');
      setUpdating(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="ncm-sheet" onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="ncm-header">
          <button className="ncm-close" onClick={onClose}><XIcon size={18} /></button>
          <h3 className="ncm-title">Edit Info</h3>
          <button
            className="ncm-done"
            disabled={!name.trim() || updating}
            onClick={handleUpdate}
          >
            {updating ? '…' : 'Save'}
          </button>
        </div>

        {/* Avatar */}
        <div className="ncm-avatar-upload">
          <div className="ncm-avatar-preview">
            {avatarUrl ? (
              <img src={avatarUrl} alt="Avatar" />
            ) : (
              <span className="avatar-placeholder">{name.charAt(0).toUpperCase()}</span>
            )}
          </div>
          <button
            className="ncm-avatar-btn"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
          >
            {uploading ? 'Uploading...' : 'Change Photo'}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={handleAvatarUpload}
          />
        </div>

        {/* Name */}
        <div className="ncm-group-name-wrap">
          <input
            ref={inputRef}
            className="ncm-group-name-input"
            placeholder="Name…"
            value={name}
            onChange={e => setName(e.target.value)}
            autoFocus
          />
        </div>

        {/* Description */}
        <div className="ncm-group-name-wrap">
          <textarea
            className="ncm-group-desc-input"
            placeholder="Description (optional)…"
            value={description}
            onChange={e => setDescription(e.target.value)}
            rows={3}
          />
        </div>

        {error && <p className="ncm-error">{error}</p>}
      </div>
    </div>
  );
};

export default EditConversationModal;
