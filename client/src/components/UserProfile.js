import React, { useEffect, useState, useContext } from 'react';
import { Copy, Check } from 'lucide-react';
import { ChatContext } from '../context/ChatContext';
import { useTheme } from '../context/useTheme';
import { API_BASE } from '../api';
import './UserProfile.css';

const UserProfile = ({ pageMode }) => {
  const { selectedProfileUser, setSelectedProfileUser, currentUser, setCurrentUser, showProfilePage, setShowProfilePage } = useContext(ChatContext);
  const theme = useTheme();
  const [profile, setProfile] = useState(null);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ fullName: '', email: '' });
  const [copiedId, setCopiedId] = useState(false);

  const loadProfile = () => {
    if (!selectedProfileUser) return;
    fetch(`${API_BASE}/api/users/${selectedProfileUser}`)
      .then(r => r.json())
      .then(data => {
        setProfile(data);
        setForm({ fullName: data.fullName || '', email: data.email || '' });
        if (currentUser && currentUser.id === data._id) {
          setCurrentUser(prev => ({ ...(prev || {}), avatar: data.avatar, username: data.username, email: data.email }));
        }
      })
      .catch(err => console.log('Error loading profile', err));
  };

  useEffect(() => {
    loadProfile();
    // Ensure editing is off when viewing someone else's profile
    if (!(currentUser && selectedProfileUser && currentUser.id === selectedProfileUser)) {
      setEditing(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedProfileUser, showProfilePage]);

  // In modal mode hide when the page variant is open to avoid double render
  const visible = pageMode ? (showProfilePage && selectedProfileUser) : (selectedProfileUser && !showProfilePage);
  if (!visible) return null;

  const isOwnProfile = !!(currentUser && selectedProfileUser && currentUser.id === selectedProfileUser);

  const handleClose = () => {
    setSelectedProfileUser(null);
    if (pageMode) setShowProfilePage(false);
    setProfile(null);
    setEditing(false);
  };

  const handleFile = (file) => {
    if (!file) return;
    if (!isOwnProfile) return; // only owner can change avatar
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result;
      // Optimistically show the uploaded image immediately
      setProfile(prev => ({ ...(prev || {}), avatar: dataUrl }));
      if (currentUser && currentUser.id === selectedProfileUser) {
        setCurrentUser(prev => ({ ...(prev || {}), avatar: dataUrl }));
      }
      // update avatar via PUT
      fetch(`${API_BASE}/api/users/${selectedProfileUser}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ avatar: dataUrl })
      })
      .then(r => r.json())
      .then(() => {
        loadProfile();
      })
      .catch(err => console.log('Error uploading avatar', err));
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveAvatar = () => {
    if (!isOwnProfile) return; // only owner can remove avatar
    // Optimistically clear avatar
    setProfile(prev => ({ ...(prev || {}), avatar: null }));
    if (currentUser && currentUser.id === selectedProfileUser) {
      setCurrentUser(prev => ({ ...(prev || {}), avatar: null }));
    }

    fetch(`${API_BASE}/api/users/${selectedProfileUser}/avatar`, { method: 'DELETE' })
      .then(r => r.json())
      .then(() => {
        loadProfile();
      })
      .catch(err => console.log('Error removing avatar', err));
  };

  const handleSave = () => {
    if (!isOwnProfile) return; // only owner can save profile
    fetch(`${API_BASE}/api/users/${selectedProfileUser}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fullName: form.fullName, email: form.email })
    })
    .then(r => r.json())
    .then(() => {
      loadProfile();
      setEditing(false);
    })
    .catch(err => console.log('Error saving profile', err));
  };

  const handleCopyId = () => {
    const id = profile?.friendCode || profile?._id || '';
    if (id) {
      navigator.clipboard.writeText(id);
      setCopiedId(true);
      setTimeout(() => setCopiedId(false), 1500);
    }
  };

  const containerStyle = pageMode
    ? {
        position: 'static',
        inset: 'auto',
        minHeight: '100vh',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'flex-start',
        padding: '2rem',
        backgroundColor: theme.colors.background
      }
    : { backgroundColor: theme.isDark ? 'rgba(0,0,0,0.6)' : 'rgba(0,0,0,0.4)' };

  return (
    <div className="profile-overlay" style={containerStyle}>
      <div className="profile-card" style={{ background: theme.colors.surface, color: theme.colors.text, width: pageMode ? '520px' : '420px' }}>
        <div className="profile-header">
          <h3>{profile?.username}</h3>
          <button onClick={handleClose}>Close</button>
        </div>

        <div style={{ display: 'flex', gap: '1rem', alignItems: 'flex-start', flexWrap: editing ? 'wrap' : 'nowrap' }}>
          <div>
            {profile?.avatar ? (
              <img src={profile.avatar} alt="avatar" style={{ width: 80, height: 80, borderRadius: 8, objectFit: 'cover' }} />
            ) : (
              <div style={{ width: 80, height: 80, borderRadius: 8, background: '#eee', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>No avatar</div>
            )}
            {editing && (
              <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
                <input type="file" accept="image/*" onChange={e => handleFile(e.target.files[0])} />
                {profile?.avatar && <button onClick={handleRemoveAvatar}>Remove</button>}
              </div>
            )}
          </div>
        {!editing ? (
          <div className="profile-body">
            <p><strong>Full name:</strong> {profile?.fullName || '—'}</p>
            <p><strong>Email:</strong> {profile?.email || '—'}</p>
            {isOwnProfile && (
              <p style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <strong>ID:</strong>
                <span style={{ fontFamily: 'monospace', backgroundColor: theme.colors.background, padding: '0.25rem 0.5rem', borderRadius: '0.25rem' }}>
                  {profile?.friendCode || profile?._id || 'N/A'}
                </span>
                <button
                  onClick={handleCopyId}
                  style={{
                    backgroundColor: theme.colors.accent,
                    color: '#fff',
                    border: 'none',
                    borderRadius: '0.25rem',
                    padding: '0.35rem 0.5rem',
                    cursor: 'pointer',
                    fontSize: '0.75rem',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 0,
                    position: 'relative',
                    top: '-8px'
                  }}
                  title="Copy ID"
                >
                  {copiedId ? <Check size={12} /> : <Copy size={12} />}
                </button>
              </p>
            )}
            <div style={{ marginTop: '1rem', display: 'flex', gap: '0.5rem' }}>
              {isOwnProfile && <button onClick={() => setEditing(true)}>Edit</button>}
              {!pageMode && isOwnProfile && (
                <button onClick={() => { setShowProfilePage(true); }}>Open as page</button>
              )}
            </div>
          </div>
        ) : (
          <div className="profile-body" style={{ flex: 1, width: '100%' }}>
            <label>
              Full name
              <input value={form.fullName} onChange={e => setForm(prev => ({ ...prev, fullName: e.target.value }))} disabled={!isOwnProfile} />
            </label>
            <label>
              Email
              <input value={form.email} onChange={e => setForm(prev => ({ ...prev, email: e.target.value }))} disabled={!isOwnProfile} />
            </label>
            <div style={{ marginTop: '1rem', display: 'flex', gap: '0.5rem' }}>
              {isOwnProfile && <button onClick={handleSave}>Save</button>}
              <button onClick={() => setEditing(false)}>Cancel</button>
            </div>
          </div>
        )}
        </div>
      </div>
    </div>
  );
};

export default UserProfile;
