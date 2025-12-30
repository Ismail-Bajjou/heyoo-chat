import React, { useContext, useState, useEffect } from 'react';
import { Plus, Trash2, Edit3, Check, X, Search as SearchIcon } from 'lucide-react';
import { API_BASE } from '../api';
import { useTheme } from '../context/useTheme';
import { ChatContext } from '../context/ChatContext';
import UserBadge from './UserBadge';
import CreateRoom from './CreateRoom';
import RoomSearch from './RoomSearch';
import './Sidebar.css';

const Sidebar = ({ socket }) => {
  const theme = useTheme();
  const { rooms, setRooms, setCurrentRoom, currentRoom, onlineUsers, currentUser, currentDM, setCurrentDM, dmConversations, setDmConversations, roomUnread, setRoomUnread, dmUnread, setDmUnread, setMessages } = useContext(ChatContext);
  const safeOnline = Array.isArray(onlineUsers) ? onlineUsers : [];
  const [showCreateRoom, setShowCreateRoom] = useState(false);
  const [showRoomSearch, setShowRoomSearch] = useState(false);
  const [editingRoom, setEditingRoom] = useState(null);
  const [editRoomName, setEditRoomName] = useState('');
  const [friends, setFriends] = useState([]);
  const [menuOpenId, setMenuOpenId] = useState(null);
  const [roomPendingCounts, setRoomPendingCounts] = useState({});

  // Load friends list
  useEffect(() => {
    if (!currentUser?.id) return;
    
    fetch(`${API_BASE}/api/friends/${currentUser.id}`)
      .then(res => res.json())
      .then(data => {
        setFriends(data.friends || []);
      })
      .catch(err => {
        console.error('Error loading friends:', err);
      });
  }, [currentUser]);

  // Load DM conversations
  useEffect(() => {
    if (!currentUser?.id) return;
    
    fetch(`${API_BASE}/api/dm/conversations/${currentUser.id}`)
      .then(res => res.json())
      .then(data => {
        setDmConversations(data || []);
      })
      .catch(err => {
        console.error('Error loading DM conversations:', err);
      });
  }, [currentUser, setDmConversations]);

  // Load pending request counts for all admin rooms
  useEffect(() => {
    if (!currentUser?.id || !Array.isArray(rooms) || rooms.length === 0) return;

    const loadPendingCounts = async () => {
      const counts = {};
      for (const room of rooms) {
        const isAdmin = room.admin?._id === currentUser?.id || room.admin === currentUser?.id;
        if (isAdmin && room._id) {
          try {
            const res = await fetch(`${API_BASE}/api/rooms/${room._id}/pending?userId=${currentUser.id}`);
            if (res.ok) {
              const pending = await res.json();
              counts[room._id] = Array.isArray(pending) ? pending.length : 0;
            }
          } catch (err) {
            console.error('Error loading pending count:', err);
          }
        }
      }
      setRoomPendingCounts(counts);
    };

    loadPendingCounts();
    // Refresh every 5 seconds
    const interval = setInterval(loadPendingCounts, 5000);
    return () => clearInterval(interval);
  }, [currentUser, rooms]);

  // Filter online users to only show friends
  const friendIds = friends.map(f => f._id);
  const onlineFriends = safeOnline.filter(u => u.userId !== currentUser?.id && friendIds.includes(u.userId));

  const onlineUserIds = new Set(safeOnline.map(u => u.userId));

  const handleRoomSelect = (room) => {
    const roomName = typeof room === 'string' ? room : room.name;
    console.log('[Sidebar] selecting room:', roomName, 'resetting unread');
    setCurrentRoom(roomName);
    setCurrentDM(null);
    setRoomUnread(prev => ({ ...prev, [roomName]: 0 }));
  };

  const handleDMSelect = (partner) => {
    console.log('[Sidebar] selecting DM:', partner.userId, 'resetting unread');
    setCurrentDM(partner);
    setCurrentRoom(null);
    // Reset DM unread count for this partner
    if (partner?.userId) {
      setDmUnread(prev => ({ ...prev, [partner.userId]: 0 }));
    }
    setMenuOpenId(null);
  };

  const handleDeleteConversation = async (conversation, scope = 'self') => {
    if (!currentUser?.id || !conversation?.userId) return;
    try {
      const res = await fetch(`${API_BASE}/api/dm/conversation/${currentUser.id}/${conversation.userId}?scope=${scope}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        setDmConversations(prev => prev.filter(c => c.userId !== conversation.userId));
        if (currentDM?.userId === conversation.userId) {
          setCurrentDM(null);
          setMessages([]);
        }
      }
    } catch (err) {
      console.error('Error deleting conversation:', err);
    } finally {
      setMenuOpenId(null);
    }
  };

  const handleRoomCreated = (room) => {
    setRooms(prev => [...prev, room]);
    handleRoomSelect(room);
  };

  const handleRoomJoined = (room) => {
    setRooms(prev => [...prev, room]);
    handleRoomSelect(room);
  };

  const handleDeleteRoom = async (room) => {
    const roomName = room.name || room;
    if (!window.confirm(`Delete room ${roomName}?`)) return;
    try {
      const res = await fetch(`${API_BASE}/api/rooms/${encodeURIComponent(roomName)}?userId=${currentUser.id}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        setRooms(prev => prev.filter(r => (r.name || r) !== roomName));
        if (currentRoom === roomName) {
          const remaining = rooms.filter(r => (r.name || r) !== roomName);
          if (remaining.length > 0) {
            handleRoomSelect(remaining[0]);
          } else {
            setCurrentRoom(null);
          }
        }
      } else {
        const data = await res.json();
        alert(data.error || 'Failed to delete room');
      }
    } catch (err) {
      console.error('Error deleting room:', err);
    }
  };

  const handleStartEdit = (room) => {
    const roomName = room.name || room;
    setEditingRoom(roomName);
    setEditRoomName(roomName);
  };

  const handleSaveEdit = async () => {
    if (!editRoomName.trim() || editRoomName === editingRoom) {
      setEditingRoom(null);
      return;
    }
    try {
      const res = await fetch(`${API_BASE}/api/rooms/${encodeURIComponent(editingRoom)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: editRoomName.trim(), userId: currentUser.id })
      });
      const data = await res.json();
      if (res.ok && data.name) {
        setRooms(prev => prev.map(r => {
          const rName = r.name || r;
          return rName === editingRoom ? { ...r, name: data.name } : r;
        }));
        if (currentRoom === editingRoom) {
          setCurrentRoom(data.name);
        }
        setEditingRoom(null);
      } else {
        alert(data.error || 'Failed to rename room');
      }
    } catch (err) {
      console.error('Error renaming room:', err);
      setEditingRoom(null);
    }
  };

  const handleCancelEdit = () => {
    setEditingRoom(null);
    setEditRoomName('');
  };

  return (
    <aside style={{
      width: '280px',
      backgroundColor: theme.colors.surface,
      padding: '1rem',
      overflowY: 'auto'
    }}>
      {/* Rooms Section */}
      <div style={{ marginBottom: '2rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
          <h3 style={{ 
            color: theme.colors.text,
            fontSize: '0.875rem',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            margin: 0
          }}>
            Rooms
          </h3>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button
              onClick={() => setShowRoomSearch(true)}
              style={{
                backgroundColor: 'transparent',
                border: 'none',
                color: theme.colors.accent,
                cursor: 'pointer',
                padding: '0.25rem',
                display: 'flex',
                alignItems: 'center'
              }}
              title="Search rooms"
            >
              <SearchIcon size={18} />
            </button>
            <button
              onClick={() => setShowCreateRoom(true)}
              style={{
                backgroundColor: 'transparent',
                border: 'none',
                color: theme.colors.accent,
                cursor: 'pointer',
                padding: '0.25rem',
                display: 'flex',
                alignItems: 'center'
              }}
              title="Create room"
            >
              <Plus size={18} />
            </button>
          </div>
        </div>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {rooms.map((room) => {
            const roomName = room.name || room;
            const isAdmin = room.admin?._id === currentUser?.id || room.admin === currentUser?.id;
            return (
              <div
                key={room._id || roomName}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: '0.5rem',
                  borderRadius: '0.5rem',
                  backgroundColor: roomName === currentRoom ? theme.colors.accent : 'transparent',
                }}
              >
                {editingRoom === roomName ? (
                  <>
                    <input
                      type="text"
                      value={editRoomName}
                      onChange={(e) => setEditRoomName(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleSaveEdit()}
                      style={{
                        flex: 1,
                        padding: '0.375rem',
                        borderRadius: '0.375rem',
                        border: `1px solid ${theme.colors.border}`,
                        backgroundColor: theme.colors.background,
                        color: theme.colors.text,
                        fontSize: '0.875rem'
                      }}
                      autoFocus
                    />
                    <button
                      onClick={handleSaveEdit}
                      style={{
                        backgroundColor: 'transparent',
                        border: 'none',
                        color: '#10b981',
                        cursor: 'pointer',
                        padding: '0.25rem',
                        display: 'flex'
                      }}
                    >
                      <Check size={16} />
                    </button>
                    <button
                      onClick={handleCancelEdit}
                      style={{
                        backgroundColor: 'transparent',
                        border: 'none',
                        color: '#ef4444',
                        cursor: 'pointer',
                        padding: '0.25rem',
                        display: 'flex'
                      }}
                    >
                      <X size={16} />
                    </button>
                  </>
                ) : (
                  <>
                    <button
                      onClick={() => handleRoomSelect(room)}
                      style={{
                        flex: 1,
                        padding: '0.25rem 0.5rem',
                        textAlign: 'left',
                        backgroundColor: 'transparent',
                        color: roomName === currentRoom ? '#ffffff' : theme.colors.text,
                        border: 'none',
                        cursor: 'pointer',
                        fontSize: '0.9375rem'
                      }}
                    >
                      {roomName}
                      {roomUnread?.[roomName] > 0 && (
                        <span className="unread-badge" style={{
                          marginLeft: '0.5rem',
                          backgroundColor: '#ef4444',
                          color: '#fff',
                          borderRadius: '9999px',
                          padding: '0 6px',
                          fontSize: '0.75rem'
                        }}>{roomUnread[roomName] > 9 ? '+9' : roomUnread[roomName]}</span>
                      )}
                      {isAdmin && roomPendingCounts[room._id] > 0 && (
                        <span style={{
                          marginLeft: '0.5rem',
                          backgroundColor: '#f59e0b',
                          color: '#fff',
                          borderRadius: '9999px',
                          padding: '0 6px',
                          fontSize: '0.75rem'
                        }}>
                          {roomPendingCounts[room._id]} pending
                        </span>
                      )}
                    </button>
                    {isAdmin && (
                      <>
                        <button
                          onClick={() => handleStartEdit(room)}
                          style={{
                            backgroundColor: 'transparent',
                            border: 'none',
                            color: roomName === currentRoom ? '#ffffff' : theme.colors.textMuted,
                            cursor: 'pointer',
                            padding: '0.25rem',
                            display: 'flex',
                            opacity: 0.7
                          }}
                          title="Rename room"
                        >
                          <Edit3 size={14} />
                        </button>
                        <button
                          onClick={() => handleDeleteRoom(room)}
                          style={{
                            backgroundColor: 'transparent',
                            border: 'none',
                            color: roomName === currentRoom ? '#ffffff' : '#ef4444',
                            cursor: 'pointer',
                            padding: '0.25rem',
                            display: 'flex',
                            opacity: 0.7
                          }}
                          title="Delete room"
                        >
                          <Trash2 size={14} />
                        </button>
                      </>
                    )}
                  </>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Direct Messages Section */}
      <div style={{ marginTop: '0.75rem', paddingTop: '1rem', borderTop: `1px solid ${theme.isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}` }}>
        <h3 style={{ 
          color: theme.colors.text, 
          marginBottom: '1rem',
          fontSize: '0.875rem',
          textTransform: 'uppercase',
          letterSpacing: '0.05em'
        }}>
          Direct Messages
        </h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {dmConversations.map((conversation) => (
            <button
              key={conversation.userId}
              onClick={() => handleDMSelect(conversation)}
              className="room-button"
              style={{
                backgroundColor: currentDM?.userId === conversation.userId ? theme.colors.accent : theme.colors.surface,
                color: currentDM?.userId === conversation.userId ? '#ffffff' : theme.colors.text,
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                position: 'relative'
              }}
            >
              <div style={{
                position: 'relative',
                width: '36px',
                height: '36px',
                borderRadius: '50%',
                backgroundColor: '#6b7280',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'white',
                fontSize: '0.9rem',
                fontWeight: '600',
                flexShrink: 0,
                overflow: 'visible'
              }}>
                {conversation.avatar ? (
                  <img src={conversation.avatar} alt="" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
                ) : (
                  conversation.username?.[0]?.toUpperCase() || '?'
                )}
                {onlineUserIds.has(conversation.userId) && (
                  <span style={{
                    position: 'absolute',
                    bottom: '-2px',
                    right: '-2px',
                    width: '10px',
                    height: '10px',
                    borderRadius: '50%',
                    backgroundColor: '#10b981',
                    border: `2px solid ${theme.colors.surface}`,
                    boxShadow: '0 0 8px rgba(16,185,129,0.7)'
                  }} />
                )}
              </div>
              <div style={{ flex: 1, minWidth: 0, textAlign: 'left', color: currentDM?.userId === conversation.userId ? '#ffffff' : theme.colors.text }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: '700', lineHeight: 1 }}>
                  <span style={{ color: currentDM?.userId === conversation.userId ? '#ffffff' : theme.colors.text }}>{conversation.username}</span>
                </div>
                <div style={{ height: '4px' }} />
                <div style={{ fontSize: '0.78rem', opacity: 0.9, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', wordBreak: 'break-all', minWidth: 0, color: currentDM?.userId === conversation.userId ? '#f8fafc' : theme.colors.text }}>
                  {conversation.lastMessage?.startsWith('data:audio/') 
                    ? '🎤 Audio message' 
                    : conversation.lastMessage || 'No messages yet'}
                </div>
              </div>
              <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                {dmUnread?.[conversation.userId] > 0 && (
                  <span className="unread-badge" style={{
                    backgroundColor: '#ef4444',
                    color: '#fff',
                    borderRadius: '9999px',
                    padding: '0 6px',
                    fontSize: '0.75rem'
                  }}>{dmUnread[conversation.userId] > 9 ? '+9' : dmUnread[conversation.userId]}</span>
                )}
                <button
                  onClick={(e) => { e.stopPropagation(); setMenuOpenId(menuOpenId === conversation.userId ? null : conversation.userId); }}
                  style={{
                    background: 'transparent',
                    border: 'none',
                    color: currentDM?.userId === conversation.userId ? '#ffffff' : theme.colors.text,
                    opacity: 0.8,
                    cursor: 'pointer',
                    padding: '4px'
                  }}
                  title="Conversation options"
                >
                  ⋯
                </button>
              </div>
              {menuOpenId === conversation.userId && (
                <div
                  style={{
                    position: 'absolute',
                    top: '0.5rem',
                    right: '0.5rem',
                    backgroundColor: theme.colors.surface,
                    border: `1px solid ${theme.colors.border}`,
                    borderRadius: '0.5rem',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                    padding: '0.25rem',
                    zIndex: 10,
                    minWidth: '150px'
                  }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    style={{
                      width: '100%',
                      background: 'transparent',
                      border: 'none',
                      textAlign: 'left',
                      padding: '0.5rem',
                      color: theme.colors.text,
                      cursor: 'pointer'
                    }}
                    onClick={() => handleDeleteConversation(conversation, 'self')}
                  >
                    Delete for me
                  </button>
                  <button
                    style={{
                      width: '100%',
                      background: 'transparent',
                      border: 'none',
                      textAlign: 'left',
                      padding: '0.5rem',
                      color: '#ef4444',
                      cursor: 'pointer'
                    }}
                    onClick={() => handleDeleteConversation(conversation, 'both')}
                  >
                    Delete for both
                  </button>
                </div>
              )}
            </button>
          ))}
          {dmConversations.length === 0 && (
            <p style={{ color: theme.colors.textMuted, fontSize: '0.875rem' }}>
              No conversations yet
            </p>
          )}
        </div>
      </div>

      {/* Online Users Section */}
      {onlineFriends.length > 0 && (
        <div style={{ marginTop: '0.75rem', paddingTop: '1rem', borderTop: `1px solid ${theme.isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}` }}>
          <h3 style={{ 
            color: theme.colors.text, 
            marginBottom: '1rem',
            fontSize: '0.875rem',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            fontWeight: '700'
          }}>
            Online Friends ({onlineFriends.length})
          </h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {onlineFriends.map((user) => {
            const isActive = currentDM?.userId === user.userId;
            return (
              <button
                key={user.userId || user.socketId}
                onClick={() => handleDMSelect({ userId: user.userId, username: user.username, avatar: user.avatar })}
                style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '0.75rem',
                  padding: '0.625rem 0.875rem',
                  borderRadius: '0.75rem',
                  backgroundColor: isActive ? theme.colors.accent : (theme.isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)'),
                  border: 'none',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  color: isActive ? '#ffffff' : theme.colors.text,
                  textAlign: 'left',
                  boxShadow: isActive ? '0 2px 8px rgba(102, 126, 234, 0.25)' : 'none'
                }}
                onMouseEnter={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.backgroundColor = theme.isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.04)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.backgroundColor = theme.isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)';
                  }
                }}
              >
                <div style={{
                  position: 'relative',
                  width: '36px',
                  height: '36px',
                  borderRadius: '50%',
                  backgroundColor: '#6b7280',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#fff',
                  fontWeight: 600,
                  fontSize: '0.95rem',
                  overflow: 'visible',
                  flexShrink: 0
                }}>
                  {user.avatar ? (
                    <img src={user.avatar} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    user.username?.[0]?.toUpperCase() || '?'
                  )}
                  <span style={{
                    position: 'absolute',
                    bottom: '-4px',
                    right: '-4px',
                    width: '10px',
                    height: '10px',
                    borderRadius: '50%',
                    backgroundColor: '#10b981',
                    border: `2px solid ${theme.colors.surface}`,
                    boxShadow: '0 0 8px rgba(16,185,129,0.7)'
                  }} />
                </div>
                <span style={{ fontWeight: 600, fontSize: '0.9375rem', color: isActive ? '#ffffff' : theme.colors.text }}>
                  {user.username || 'User'}
                </span>
              </button>
            );
          })}
        </div>
      </div>
      )}
      
      {showCreateRoom && <CreateRoom onClose={() => setShowCreateRoom(false)} onRoomCreated={handleRoomCreated} />}
      {showRoomSearch && <RoomSearch onClose={() => setShowRoomSearch(false)} onRoomJoined={handleRoomJoined} />}
    </aside>
  );
};

export default Sidebar;
