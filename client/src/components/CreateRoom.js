import React, { useState, useContext } from 'react';
import { useTheme } from '../context/useTheme';
import { ChatContext } from '../context/ChatContext';
import { Lock, Globe } from 'lucide-react';
import { API_BASE } from '../api';

const CreateRoom = ({ onClose, onRoomCreated }) => {
  const theme = useTheme();
  const { currentUser } = useContext(ChatContext);
  const [roomName, setRoomName] = useState('');
  const [description, setDescription] = useState('');
  const [roomType, setRoomType] = useState('public');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [createdRoom, setCreatedRoom] = useState(null);

  const handleCreate = async () => {
    if (!roomName.trim()) {
      setError('Room name is required');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API_BASE}/api/rooms`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: roomName.trim(),
          description: description.trim(),
          adminId: currentUser.id,
          type: roomType
        })
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to create room');
      } else {
        setCreatedRoom(data);
      }
    } catch (err) {
      setError('Error creating room');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleFinish = () => {
    if (createdRoom) {
      onRoomCreated(createdRoom);
    }
    onClose();
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
        zIndex: 10000
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
        maxWidth: '450px',
        padding: '1.5rem'
      }}>
        <h2 style={{ margin: '0 0 1rem 0', color: theme.colors.text }}>Create Room</h2>

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

        <div style={{ marginBottom: '1rem' }}>
          <label style={{ display: 'block', marginBottom: '0.5rem', color: theme.colors.text, fontSize: '0.875rem' }}>
            Room Name
          </label>
          <input
            type="text"
            value={roomName}
            onChange={(e) => setRoomName(e.target.value)}
            placeholder="e.g., Gaming Lounge"
            style={{
              width: '100%',
              padding: '0.75rem',
              borderRadius: '0.375rem',
              border: `1px solid ${theme.colors.border}`,
              backgroundColor: theme.colors.surface,
              color: theme.colors.text
            }}
          />
        </div>

        <div style={{ marginBottom: '1rem' }}>
          <label style={{ display: 'block', marginBottom: '0.5rem', color: theme.colors.text, fontSize: '0.875rem' }}>
            Description (optional)
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="What's this room about?"
            rows={3}
            style={{
              width: '100%',
              padding: '0.75rem',
              borderRadius: '0.375rem',
              border: `1px solid ${theme.colors.border}`,
              backgroundColor: theme.colors.surface,
              color: theme.colors.text,
              resize: 'vertical'
            }}
          />
        </div>

        <div style={{ marginBottom: '1.5rem' }}>
          <label style={{ display: 'block', marginBottom: '0.75rem', color: theme.colors.text, fontSize: '0.875rem' }}>
            Room Type
          </label>
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button
              onClick={() => setRoomType('public')}
              style={{
                flex: 1,
                padding: '0.875rem',
                borderRadius: '0.5rem',
                border: `2px solid ${roomType === 'public' ? theme.colors.accent : theme.colors.border}`,
                backgroundColor: roomType === 'public' ? `${theme.colors.accent}22` : theme.colors.surface,
                color: theme.colors.text,
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '0.5rem'
              }}
            >
              <Globe size={24} color={roomType === 'public' ? theme.colors.accent : theme.colors.text} />
              <span style={{ fontWeight: roomType === 'public' ? 600 : 400 }}>Public</span>
              <span style={{ fontSize: '0.75rem', color: theme.colors.textMuted }}>Anyone can join</span>
            </button>
            <button
              onClick={() => setRoomType('private')}
              style={{
                flex: 1,
                padding: '0.875rem',
                borderRadius: '0.5rem',
                border: `2px solid ${roomType === 'private' ? theme.colors.accent : theme.colors.border}`,
                backgroundColor: roomType === 'private' ? `${theme.colors.accent}22` : theme.colors.surface,
                color: theme.colors.text,
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: '0.5rem'
              }}
            >
              <Lock size={24} color={roomType === 'private' ? theme.colors.accent : theme.colors.text} />
              <span style={{ fontWeight: roomType === 'private' ? 600 : 400 }}>Private</span>
              <span style={{ fontSize: '0.75rem', color: theme.colors.textMuted }}>Requires approval</span>
            </button>
          </div>
        </div>

        {createdRoom ? (
          <div style={{
            backgroundColor: theme.colors.surface,
            border: `2px solid ${theme.colors.accent}`,
            borderRadius: '0.5rem',
            padding: '1rem',
            marginBottom: '1rem'
          }}>
            <h3 style={{ margin: '0 0 0.75rem 0', color: theme.colors.text, fontSize: '1rem' }}>Room Created!</h3>
            <div style={{ marginBottom: '0.5rem' }}>
              <span style={{ color: theme.colors.textMuted, fontSize: '0.875rem' }}>Room Name: </span>
              <span style={{ color: theme.colors.text, fontWeight: 600 }}>{createdRoom.name}</span>
            </div>
            <div style={{ marginBottom: '0.75rem' }}>
              <span style={{ color: theme.colors.textMuted, fontSize: '0.875rem' }}>Join Code: </span>
              <span style={{
                color: theme.colors.text,
                fontWeight: 700,
                fontFamily: 'monospace',
                fontSize: '1.1rem',
                backgroundColor: theme.colors.background,
                padding: '0.25rem 0.5rem',
                borderRadius: '0.25rem',
                letterSpacing: '0.1em'
              }}>
                {createdRoom.joinCode}
              </span>
            </div>
            <p style={{ margin: 0, color: theme.colors.textMuted, fontSize: '0.8rem' }}>
              Share this code with others to invite them!
            </p>
          </div>
        ) : null}

        <div style={{ display: 'flex', gap: '0.75rem' }}>
          {createdRoom ? (
            <button
              onClick={handleFinish}
              style={{
                flex: 1,
                padding: '0.75rem',
                backgroundColor: theme.colors.accent,
                color: '#fff',
                border: 'none',
                borderRadius: '0.375rem',
                cursor: 'pointer',
                fontWeight: 600
              }}
            >
              Done
            </button>
          ) : (
            <>
              <button
                onClick={handleCreate}
                disabled={loading}
                style={{
                  flex: 1,
                  padding: '0.75rem',
                  backgroundColor: theme.colors.accent,
                  color: '#fff',
                  border: 'none',
                  borderRadius: '0.375rem',
                  cursor: loading ? 'not-allowed' : 'pointer',
                  fontWeight: 600
                }}
              >
                {loading ? 'Creating...' : 'Create Room'}
              </button>
              <button
                onClick={onClose}
                style={{
                  padding: '0.75rem 1.5rem',
                  backgroundColor: theme.colors.surface,
                  color: theme.colors.text,
                  border: `1px solid ${theme.colors.border}`,
                  borderRadius: '0.375rem',
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default CreateRoom;
