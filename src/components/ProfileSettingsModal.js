import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { X, Camera, Save, User as UserIcon } from 'lucide-react';

export default function ProfileSettingsModal({ onClose }) {
  const { user, updateProfile } = useAuth();
  const [fullName, setFullName] = useState(user?.user_metadata?.full_name || '');
  const [avatarUrl, setAvatarUrl] = useState(user?.user_metadata?.avatar_url || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const avatarPresets = [
    'https://api.dicebear.com/7.x/avataaars/svg?seed=Felix',
    'https://api.dicebear.com/7.x/avataaars/svg?seed=Aria',
    'https://api.dicebear.com/7.x/avataaars/svg?seed=Leo',
    'https://api.dicebear.com/7.x/avataaars/svg?seed=Luna',
    'https://api.dicebear.com/7.x/avataaars/svg?seed=Jack',
  ];

  const handleSave = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      await updateProfile({
        full_name: fullName,
        avatar_url: avatarUrl,
      });
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="add-position-modal" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 400 }}>
        <div className="modal-header">
          <div className="header-title-group">
            <UserIcon className="header-icon" />
            <div>
              <h3>Profile Settings</h3>
              <p>Update your display name and icon</p>
            </div>
          </div>
          <button className="close-btn" onClick={onClose}><X size={20} /></button>
        </div>

        <form onSubmit={handleSave} className="modal-body">
          {error && <div className="error-message" style={{ marginBottom: 16 }}>{error}</div>}

          <div className="avatar-selection-section" style={{ textAlign: 'center', marginBottom: 24 }}>
            <div className="current-avatar-preview" style={{ marginBottom: 16 }}>
              <img 
                src={avatarUrl || `https://ui-avatars.com/api/?name=${fullName || 'U'}&background=6366f1&color=fff`} 
                alt="Profile" 
                style={{ width: 80, height: 80, borderRadius: '50%', objectFit: 'cover', border: '3px solid var(--border)' }}
              />
            </div>
            
            <div className="avatar-presets" style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
              {avatarPresets.map((url, i) => (
                <button 
                  key={i}
                  type="button"
                  onClick={() => setAvatarUrl(url)}
                  className={`preset-btn ${avatarUrl === url ? 'active' : ''}`}
                  style={{ 
                    padding: 0, 
                    border: '2px solid transparent', 
                    borderRadius: '50%', 
                    overflow: 'hidden',
                    borderColor: avatarUrl === url ? 'var(--primary)' : 'transparent',
                    background: 'none'
                  }}
                >
                  <img src={url} alt="preset" style={{ width: 40, height: 40 }} />
                </button>
              ))}
            </div>
          </div>

          <div className="form-group">
            <label>Display Name</label>
            <input
              type="text"
              className="modal-input"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Your full name"
              required
            />
          </div>

          <div className="form-group">
            <label>Avatar URL (Custom)</label>
            <div style={{ position: 'relative' }}>
              <input
                type="text"
                className="modal-input"
                value={avatarUrl}
                onChange={(e) => setAvatarUrl(e.target.value)}
                placeholder="External image URL"
                style={{ paddingLeft: 36 }}
              />
              <Camera size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', opacity: 0.5 }} />
            </div>
          </div>

          <div className="modal-actions" style={{ marginTop: 24 }}>
            <button type="button" className="btn-secondary" onClick={onClose} disabled={saving}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? 'Saving...' : <><Save size={16} style={{ marginRight: 8 }} /> Save Changes</>}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
