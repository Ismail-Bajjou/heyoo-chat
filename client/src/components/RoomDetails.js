import React, { useState, useEffect, useContext } from 'react';
import { useTheme } from '../context/useTheme';
import { ChatContext } from '../context/ChatContext';
import { Lock, Globe, Copy, Check, X } from 'lucide-react';
import { API_BASE } from '../api';

const RoomDetails = ({ room, onClose }) => {
  const theme = useTheme();
  const { currentUser, setSelectedProfileUser } = useContext(ChatContext);
  const userId = currentUser?.id || currentUser?._id;
  const [roomData, setRoomData] = useState(room);
  const [members, setMembers] = useState([]);
  const [pendingMembers, setPendingMembers] = useState([]);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(false);
  const [copiedMemberId, setCopiedMemberId] = useState(null);

  const isAdmin = roomData?.admin?._id === currentUser?.id || roomData?.admin === currentUser?.id;

  useEffect(() => {
    loadRoomDetails();
    // Poll for pending requests every 3 seconds
    const interval = setInterval(() => {
      if (isAdmin && roomData._id) {
        loadPendingRequests();
      }
    }, 3000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomData._id, isAdmin]);

  // Load friends list
  // No friend lookup needed; showing codes/usernames directly

  const loadRoomDetails = async () => {
    try {
      // Fetch full room data with populated members
      const res = await fetch(`${API_BASE}/api/rooms?userId=${userId}`);
      const data = await res.json();
      const fullRoom = data.find(r => r.name === roomData.name);
      if (fullRoom) {
        setRoomData(fullRoom);
        setMembers(fullRoom.members || []);
      }

      // Load pending requests
      await loadPendingRequests();
    } catch (err) {
      console.error('Error loading room details:', err);
    }
  };

  const loadPendingRequests = async () => {
    try {
      if (roomData._id && userId) {
        const pendingRes = await fetch(`${API_BASE}/api/rooms/${roomData._id}/pending?userId=${userId}`);
        if (pendingRes.ok) {
          const pendingData = await pendingRes.json();
          setPendingMembers(Array.isArray(pendingData) ? pendingData : []);
        }
      }
    } catch (err) {
      console.error('Error loading pending requests:', err);
    }
  };

  const handleCopyCode = () => {
    if (roomData.joinCode) {
      navigator.clipboard.writeText(roomData.joinCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleCopyMemberInfo = async (member) => {
    const value = member?.friendCode || member?.username || member?._id || member?.id || member?.userId;
    if (!value) return;
    try {
      await navigator.clipboard.writeText(String(value));
      setCopiedMemberId(member._id || member.id || member.userId);
      setTimeout(() => setCopiedMemberId(null), 1200);
    } catch (err) {
      console.error('Copy failed:', err);
    }
  };

  const handleApprove = async (memberId) => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/rooms/${roomData._id}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, memberId, action: 'approve' })
      });
      if (res.ok) {
        await loadRoomDetails();
      }
    } catch (err) {
      console.error('Error approving member:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleReject = async (memberId) => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/rooms/${roomData._id}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, memberId, action: 'reject' })
      });
      if (res.ok) {
        await loadRoomDetails();
      }
    } catch (err) {
      console.error('Error rejecting member:', err);
    } finally {
      setLoading(false);
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
        maxWidth: '550px',
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
          <div>
            <h2 style={{ margin: '0 0 0.25rem 0', color: theme.colors.text }}>#{roomData.name}</h2>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              {roomData.type === 'private' ? <Lock size={14} color={theme.colors.textMuted} /> : <Globe size={14} color={theme.colors.textMuted} />}
              <span style={{ fontSize: '0.875rem', color: theme.colors.textMuted }}>
                {roomData.type === 'private' ? 'Private' : 'Public'} Room
              </span>
            </div>
          </div>
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

        {/* Content */}
        <div style={{
          flex: 1,
          overflowY: 'auto',
          padding: '1.5rem'
        }}>
          {/* About */}
          {roomData.description && (
            <div style={{ marginBottom: '1.5rem' }}>
              <h3 style={{ margin: '0 0 0.5rem 0', color: theme.colors.text, fontSize: '0.9rem' }}>About</h3>
              <p style={{ margin: 0, color: theme.colors.textMuted, fontSize: '0.875rem' }}>
                {roomData.description}
              </p>
            </div>
          )}

          {/* Join Code */}
          <div style={{ marginBottom: '1.5rem' }}>
            <h3 style={{ margin: '0 0 0.5rem 0', color: theme.colors.text, fontSize: '0.9rem' }}>Join Code</h3>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              backgroundColor: theme.colors.surface,
              padding: '0.75rem',
              borderRadius: '0.5rem',
              border: `1px solid ${theme.colors.border}`
            }}>
              <span style={{
                flex: 1,
                fontFamily: 'monospace',
                fontSize: '1.1rem',
                fontWeight: 700,
                letterSpacing: '0.1em',
                color: theme.colors.text
              }}>
                {roomData.joinCode || 'N/A'}
              </span>
              <button
                onClick={handleCopyCode}
                style={{
                  backgroundColor: copied ? '#10b981' : theme.colors.accent,
                  color: '#fff',
                  border: 'none',
                  borderRadius: '0.375rem',
                  padding: '0.5rem 0.75rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.25rem',
                  fontSize: '0.875rem'
                }}
              >
                {copied ? <Check size={16} /> : <Copy size={16} />}
                {copied ? 'Copied' : 'Copy'}
              </button>
            </div>
          </div>

          {/* Members */}
          <div style={{ marginBottom: '1.5rem' }}>
            <h3 style={{ margin: '0 0 0.75rem 0', color: theme.colors.text, fontSize: '0.9rem' }}>
              Members ({members.length})
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {members.map((member) => (
                <div
                  key={member._id}
                  style={{
                    backgroundColor: theme.colors.surface,
                    padding: '0.75rem',
                    borderRadius: '0.5rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.75rem',
                    border: `1px solid ${theme.colors.border}`
                  }}
                >
                  <div
                    style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: '50%',
                      backgroundColor: '#6b7280',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#fff',
                      fontSize: '0.875rem',
                      fontWeight: 600,
                      overflow: 'hidden',
                      cursor: 'pointer'
                    }}
                    onClick={() => setSelectedProfileUser(member._id)}
                  >
                    {member.avatar ? (
                      <img src={member.avatar} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    ) : (
                      member.username?.[0]?.toUpperCase() || '?'
                    )}
                  </div>
                  <div
                    style={{ flex: 1, cursor: 'pointer' }}
                    onClick={() => setSelectedProfileUser(member._id)}
                  >
                    <p style={{ margin: 0, color: theme.colors.text, fontWeight: 500 }}>
                      {member.username}
                      {member._id === roomData.admin?._id && (
                        <span style={{
                          marginLeft: '0.5rem',
                          fontSize: '0.75rem',
                          backgroundColor: theme.colors.accent,
                          color: '#fff',
                          padding: '0.125rem 0.5rem',
                          borderRadius: '0.25rem'
                        }}>
                          Admin
                        </span>
                      )}
                    </p>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <div style={{
                      backgroundColor: theme.colors.surface,
                      border: `1px solid ${theme.colors.border}`,
                      color: theme.colors.text,
                      borderRadius: '0.375rem',
                      padding: '0.35rem 0.6rem',
                      fontSize: '0.8125rem',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '0.35rem',
                      whiteSpace: 'nowrap'
                    }}>
                      <span style={{ color: theme.colors.textMuted }}>User ID:</span>
                      <span style={{ fontFamily: 'monospace', letterSpacing: '0.05em' }}>
                        {member.friendCode || member.username || member._id || member.id || member.userId || '—'}
                      </span>
                    </div>
                    <button
                      onClick={() => handleCopyMemberInfo(member)}
                      style={{
                        backgroundColor: theme.colors.accent,
                        color: '#fff',
                        border: 'none',
                        borderRadius: '0.375rem',
                        padding: '0.5rem 0.75rem',
                        cursor: 'pointer',
                        fontSize: '0.875rem',
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: 0
                      }}
                    >
                      {copiedMemberId === member._id ? <Check size={14} /> : <Copy size={14} />}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Pending Requests (Admin only) */}
          {isAdmin && pendingMembers.length > 0 && (
            <div>
              <h3 style={{ margin: '0 0 0.75rem 0', color: theme.colors.text, fontSize: '0.9rem' }}>
                Pending Requests ({pendingMembers.length})
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {pendingMembers.map((member) => (
                  <div
                    key={member._id}
                    style={{
                      backgroundColor: theme.colors.surface,
                      padding: '0.75rem',
                      borderRadius: '0.5rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.75rem',
                      border: `1px solid ${theme.colors.border}`
                    }}
                  >
                    <div style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: '50%',
                      backgroundColor: '#6b7280',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: '#fff',
                      fontSize: '0.875rem',
                      fontWeight: 600,
                      overflow: 'hidden'
                    }}>
                      {member.avatar ? (
                        <img src={member.avatar} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      ) : (
                        member.username?.[0]?.toUpperCase() || '?'
                      )}
                    </div>
                    <div style={{ flex: 1 }}>
                      <p style={{ margin: 0, color: theme.colors.text, fontWeight: 500 }}>
                        {member.username}
                      </p>
                    </div>
                    <button
                      onClick={() => handleApprove(member._id)}
                      disabled={loading}
                      style={{
                        backgroundColor: '#10b981',
                        color: '#fff',
                        border: 'none',
                        borderRadius: '0.375rem',
                        padding: '0.5rem 0.75rem',
                        cursor: loading ? 'not-allowed' : 'pointer',
                        fontSize: '0.875rem'
                      }}
                    >
                      <Check size={16} />
                    </button>
                    <button
                      onClick={() => handleReject(member._id)}
                      disabled={loading}
                      style={{
                        backgroundColor: '#ef4444',
                        color: '#fff',
                        border: 'none',
                        borderRadius: '0.375rem',
                        padding: '0.5rem 0.75rem',
                        cursor: loading ? 'not-allowed' : 'pointer',
                        fontSize: '0.875rem'
                      }}
                    >
                      <X size={16} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default RoomDetails;
