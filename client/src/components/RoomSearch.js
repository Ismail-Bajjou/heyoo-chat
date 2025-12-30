import React, { useState, useContext } from 'react';
import { useTheme } from '../context/useTheme';
import { ChatContext } from '../context/ChatContext';
import { Search, Lock, Globe } from 'lucide-react';
import { API_BASE } from '../api';

const RoomSearch = ({ onClose, onRoomJoined }) => {
  const theme = useTheme();
  const { currentUser } = useContext(ChatContext);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [pendingRooms, setPendingRooms] = useState(new Set());

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setLoading(true);
    setError('');
    setSuccessMessage('');
    try {
      const res = await fetch(`${API_BASE}/api/rooms/search?query=${encodeURIComponent(searchQuery)}&userId=${currentUser.id}`);
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Error searching');
      } else {
        setSearchResults(data || []);
      }
    } catch (err) {
      setError('Error searching rooms');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleJoin = async (room) => {
    setError('');
    setSuccessMessage('');
    try {
      const res = await fetch(`${API_BASE}/api/rooms/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ roomId: room._id, userId: currentUser.id })
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Error joining room');
      } else {
        if (data.joined) {
          onRoomJoined(data.room);
          onClose();
        } else if (data.pending) {
          setSuccessMessage(data.message || 'Join request sent! Waiting for admin approval.');
          setPendingRooms(prev => new Set(prev).add(room._id));
        }
      }
    } catch (err) {
      setError('Error joining room');
      console.error(err);
    }
  };

  return (
    <div 
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.5)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 1000
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div style={{
        backgroundColor: theme.colors.background,
        borderRadius: '0.75rem',
        boxShadow: '0 10px 40px rgba(0, 0, 0, 0.3)',
        width: '90%',
        maxWidth: '500px',
        maxHeight: '80vh',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden'
      }}>
        {/* Header */}
        <div style={{
          padding: '1.5rem',
          borderBottom: `1px solid ${theme.colors.border}`,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <h2 style={{ margin: 0, color: theme.colors.text }}>Search Rooms</h2>
          <button
            onClick={onClose}
            style={{
              backgroundColor: 'transparent',
              border: 'none',
              color: theme.colors.textMuted,
              fontSize: '1.5rem',
              cursor: 'pointer'
            }}
          >
            ✕
          </button>
        </div>

        {/* Search */}
        <div style={{ padding: '1.5rem' }}>
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
            <input
              type="text"
              placeholder="Search by name or join code..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              style={{
                flex: 1,
                padding: '0.75rem',
                borderRadius: '0.375rem',
                border: `1px solid ${theme.colors.border}`,
                backgroundColor: theme.colors.surface,
                color: theme.colors.text
              }}
            />
            <button
              onClick={handleSearch}
              disabled={loading}
              style={{
                padding: '0.75rem 1.5rem',
                backgroundColor: theme.colors.accent,
                color: '#fff',
                border: 'none',
                borderRadius: '0.375rem',
                cursor: loading ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem'
              }}
            >
              <Search size={18} />
            </button>
          </div>

          {error && (
            <div style={{
              backgroundColor: '#fee2e2',
              color: '#991b1b',
              padding: '0.75rem 1rem',
              borderRadius: '0.375rem',
              marginBottom: '1rem'
            }}>
              {error}
            </div>
          )}

          {successMessage && (
            <div style={{
              backgroundColor: '#d1fae5',
              color: '#065f46',
              padding: '0.75rem 1rem',
              borderRadius: '0.375rem',
              marginBottom: '1rem'
            }}>
              {successMessage}
            </div>
          )}

          {/* Results */}
          <div style={{
            maxHeight: '400px',
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.75rem'
          }}>
            {searchResults.length === 0 && !loading && searchQuery && (
              <p style={{ color: theme.colors.textMuted, textAlign: 'center' }}>No rooms found</p>
            )}
            {searchResults.map(room => (
              <div
                key={room._id}
                style={{
                  backgroundColor: theme.colors.surface,
                  padding: '1rem',
                  borderRadius: '0.5rem',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  border: `1px solid ${theme.colors.border}`
                }}
              >
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
                    {room.type === 'private' ? <Lock size={16} color={theme.colors.textMuted} /> : <Globe size={16} color={theme.colors.textMuted} />}
                    <p style={{ margin: 0, color: theme.colors.text, fontWeight: '600' }}>
                      #{room.name}
                    </p>
                  </div>
                  {room.description && (
                    <p style={{ margin: '0.25rem 0', color: theme.colors.textMuted, fontSize: '0.875rem' }}>
                      {room.description}
                    </p>
                  )}
                  <p style={{ margin: 0, color: theme.colors.textMuted, fontSize: '0.75rem' }}>
                    Admin: {room.admin?.username || 'Unknown'} • {room.members?.length || 0} members
                  </p>
                </div>
                <button
                  onClick={() => handleJoin(room)}
                  disabled={pendingRooms.has(room._id)}
                  style={{
                    padding: '0.5rem 1rem',
                    backgroundColor: pendingRooms.has(room._id) ? theme.colors.textMuted : theme.colors.accent,
                    color: '#fff',
                    border: 'none',
                    borderRadius: '0.375rem',
                    cursor: pendingRooms.has(room._id) ? 'not-allowed' : 'pointer',
                    fontSize: '0.875rem',
                    opacity: pendingRooms.has(room._id) ? 0.6 : 1
                  }}
                >
                  {pendingRooms.has(room._id) ? 'Pending' : (room.type === 'private' ? 'Request' : 'Join')}
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default RoomSearch;
