import React, { useState, useEffect, useContext } from 'react';
import { io } from 'socket.io-client';
import { API_BASE } from './api';
import { ThemeProvider } from './context/ThemeContext';
import { ChatProvider, ChatContext } from './context/ChatContext';
import { useTheme } from './context/useTheme';
import Header from './components/Header';
import Sidebar from './components/Sidebar';
import ChatWindow from './components/ChatWindow';
import LoginPage from './pages/LoginPage';
import UserProfile from './components/UserProfile';
import './styles/index.css';

const AppContent = () => {
  const theme = useTheme();
  const { currentUser, setCurrentUser, setRooms, setOnlineUsers, setMessages, currentRoom, setSelectedProfileUser, setShowProfilePage, currentDM, setTypingRoom, setTypingDM, setDmUnread, setRoomUnread, setLoadingMessages } = useContext(ChatContext);
  const [socket, setSocket] = useState(null);
  const [isLoggedIn, setIsLoggedIn] = useState(!!currentUser);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(() => {
    if (typeof window !== 'undefined') {
      const ua = navigator.userAgent || '';
      const isMobileUA = /Mobi|Android|iPhone|iPad|iPod/i.test(ua);
      const isNarrow = window.innerWidth < 768;
      return !(isMobileUA || isNarrow);
    }
    return true;
  });
  const joinedRoomRef = React.useRef({ userId: null, room: null });
  const currentDMRef = React.useRef(currentDM);
  const currentRoomRef = React.useRef(currentRoom);
  
  // Keep the refs updated
  useEffect(() => {
    currentDMRef.current = currentDM;
    currentRoomRef.current = currentRoom;
  }, [currentDM, currentRoom]);

  // Auto-close sidebar on mobile after navigation for clarity
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const ua = navigator.userAgent || '';
      const isMobileUA = /Mobi|Android|iPhone|iPad|iPod/i.test(ua);
      const isNarrow = window.innerWidth < 768;
      if (isMobileUA || isNarrow) {
        setSidebarOpen(false);
      }
    }
  }, [currentRoom, currentDM]);

  // Initialize socket connection once and load rooms
  useEffect(() => {
    const newSocket = io(API_BASE);
    setSocket(newSocket);

    setLoading(false);

    return () => newSocket.close();
    // Intentionally run once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load rooms when user is available
  useEffect(() => {
    if (!currentUser?.id) {
      setRooms([]);
      return;
    }

    fetch(`${API_BASE}/api/rooms?userId=${currentUser.id}`)
      .then(res => res.json())
      .then(data => {
        if (!Array.isArray(data)) {
          console.error('[App] ERROR: Rooms response is not an array!');
          setRooms([]);
          return;
        }
        setRooms(data);
      })
      .catch(err => {
        console.error('[App] Error fetching rooms:', err);
        setRooms([]);
      });
  }, [currentUser?.id, setRooms]);

  // When socket and stored user are available, re-associate user
  useEffect(() => {
    if (!socket || !currentUser || !currentUser.id) return;

    socket.emit('user_join', { userId: currentUser.id }, (res) => {
      if (res && res.userId) {
        setCurrentUser(prev => ({ ...(prev || {}), id: res.userId }));
        setIsLoggedIn(true);
      }
    });

  }, [socket, currentUser, setCurrentUser]);

  // Join current room and load its messages whenever room/user/socket is ready
  useEffect(() => {
    if (!socket || !currentUser || !currentUser.id || !currentRoom) return;

    // If user switched, leave the old room
    if (joinedRoomRef.current.userId !== currentUser.id) {
      if (joinedRoomRef.current.room) {
        socket.emit('leave_room', { room: joinedRoomRef.current.room });
      }
    }

    // If room switched for same user, leave old room
    if (joinedRoomRef.current.room !== currentRoom && joinedRoomRef.current.userId === currentUser.id) {
      if (joinedRoomRef.current.room) {
        socket.emit('leave_room', { room: joinedRoomRef.current.room });
      }
    }

    // Only join if this room/user combo hasn't been joined yet
    if (joinedRoomRef.current.userId === currentUser.id && joinedRoomRef.current.room === currentRoom) {
      return;
    }
    joinedRoomRef.current = { userId: currentUser.id, room: currentRoom };
    socket.emit('join_room', { room: currentRoom });
    setLoadingMessages(true);
    setMessages([]); // Clear messages when switching rooms

    fetch(`${API_BASE}/api/messages/${currentRoom}?userId=${currentUser.id}`)
      .then((r) => {
        if (!r.ok) {
          console.error('[App] Failed to load messages:', r.status, r.statusText);
          return [];
        }
        return r.json();
      })
      .then((data) => {
        if (Array.isArray(data)) {
          setMessages(data);
        } else {
          console.error('[App] Messages response is not an array:', data);
          setMessages([]);
        }
      })
      .catch((err) => {
        console.log('[App] Error loading messages:', err);
        setMessages([]);
      })
      .finally(() => setLoadingMessages(false));

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socket, currentUser?.id, currentRoom]);

  // Load DM messages when switching to a DM
  useEffect(() => {
    if (!currentUser || !currentDM) {
      return;
    }

    // Clear room ref so that switching back to a room will reload messages
    joinedRoomRef.current = { userId: null, room: null };

    const partnerId = currentDM.userId || currentDM._id || currentDM.id;
    if (!partnerId) {
      console.error('[App] No partner id for DM fetch', currentDM);
      return;
    }

    setLoadingMessages(true);
    setMessages([]); // Clear messages when switching to DM
    
    fetch(`${API_BASE}/api/dm/messages/${currentUser.id}/${partnerId}`)
      .then(r => r.json())
      .then(data => {
        if (Array.isArray(data)) {
          setMessages(data);
        } else {
          console.error('[App] DM messages response is not an array:', data);
          setMessages([]);
        }
      })
      .catch(err => {
        console.log('[App] Error loading DM messages:', err);
        setMessages([]);
      })
      .finally(() => setLoadingMessages(false));
    
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.id, currentDM]);

  // Socket listeners for messages and online users - attach once
  useEffect(() => {
    if (!socket) return;

    // Ensure we re-register the user and re-join the active room on reconnection
    const handleConnect = () => {
      try {
        if (currentUser?.id) {
          socket.emit('user_join', { userId: currentUser.id });
        }
        if (currentRoomRef.current) {
          socket.emit('join_room', { room: currentRoomRef.current }, (ack) => {
            if (!ack?.ok) {
              // Retry join shortly if no ack
              setTimeout(() => {
                try { socket.emit('join_room', { room: currentRoomRef.current }); } catch {}
              }, 300);
            }
          });
        }
        // Extra safeguard: re-emit join shortly after connect to avoid race
        setTimeout(() => {
          try {
            if (currentRoomRef.current) {
              socket.emit('join_room', { room: currentRoomRef.current });
            }
          } catch {}
        }, 500);
      } catch {}
    };

    const handleConnectError = (err) => {
      console.error('[Socket] connect_error:', err?.message || err);
    };

    const handleDisconnect = (reason) => {
      console.warn('[Socket] disconnected:', reason);
    };

    socket.on('connect', handleConnect);
    socket.on('joined_room', ({ room }) => {
      try {
        console.log('[client] joined_room', room);
      } catch {}
    });
    socket.on('connect_error', handleConnectError);
    socket.on('disconnect', handleDisconnect);

    const handleUsersOnline = (users) => {
      const arr = Array.isArray(users) ? users : [];
      const uniq = Object.values(arr.reduce((acc, u) => {
        const key = u.userId || u.socketId || Math.random().toString(36);
        acc[key] = u;
        return acc;
      }, {}));
      setOnlineUsers(uniq);
    };

    const handleReceiveMessage = (data) => {
      console.log('[client] receive_message', data?.room, 'current:', currentRoomRef.current, 'isDM:', !!currentDMRef.current);
      const roomName = data?.room;
      const isActiveRoom = roomName && roomName === currentRoomRef.current && !currentDMRef.current;

      if (isActiveRoom) {
        console.log('[client] appending message to active room');
        // If message includes a tempId, try to replace the optimistic message
        if (data && data.tempId) {
          setMessages(prev => {
            const hasOptimistic = prev.some(m => m.tempId === data.tempId);
            if (hasOptimistic) {
              return prev.map(m => (m.tempId === data.tempId) ? data : m);
            } else {
              return [...prev, data];
            }
          });
        } else {
          setMessages(prev => [...prev, data]);
        }
      } else if (roomName) {
        console.log('[client] incrementing unread for', roomName);
        // Not viewing this room: increment unread badge and do not append to current messages
        setRoomUnread(prev => ({ ...prev, [roomName]: (prev?.[roomName] || 0) + 1 }));
      }
    };

    const handleReceiveDM = (data) => {
      console.log('[client] receive_dm from', data.message?.sender);
      const incomingMessage = data.message;
      if (!incomingMessage) return;

      // Use ref to get the current value
      const senderId = incomingMessage.sender?._id || incomingMessage.sender;
      const currentDMValue = currentDMRef.current;
      const activePartnerId = currentDMValue?.userId || currentDMValue?._id || currentDMValue?.id;

      // Only add if we're viewing this specific DM conversation
      if (activePartnerId && senderId && activePartnerId === senderId) {
        console.log('[client] appending DM to active conversation');
        setMessages(prev => {
          const exists = prev.some(m => (incomingMessage._id && m._id === incomingMessage._id) || (incomingMessage.tempId && m.tempId === incomingMessage.tempId));
          if (exists) return prev;
          return [...prev, incomingMessage];
        });
      } else if (senderId) {
        console.log('[client] incrementing unread for DM', senderId);
        // Increment unread count for this DM partner
        setDmUnread(prev => ({ ...prev, [senderId]: (prev?.[senderId] || 0) + 1 }));
      }
    };

    socket.on('users_online', handleUsersOnline);
    socket.on('receive_message', handleReceiveMessage);
    socket.on('receive_dm', handleReceiveDM);
    socket.on('typing', (payload) => {
      const { room, username, isTyping } = payload || {};
      // Only track typing for currently viewed room
      if (room === currentRoomRef.current) {
        setTypingRoom((prev) => {
          const set = new Set(prev || []);
          if (isTyping) set.add(username);
          else set.delete(username);
          return Array.from(set);
        });
      }
    });
    socket.on('typing_dm', (payload) => {
      const { fromUserId, username, isTyping } = payload || {};
      setTypingDM(prev => ({ ...prev, [fromUserId]: { username, isTyping } }));
    });

    return () => {
      socket.off('connect', handleConnect);
      socket.off('connect_error', handleConnectError);
      socket.off('disconnect', handleDisconnect);
      socket.off('joined_room');
      socket.off('users_online', handleUsersOnline);
      socket.off('receive_message', handleReceiveMessage);
      socket.off('receive_dm', handleReceiveDM);
      socket.off('typing');
      socket.off('typing_dm');
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [socket]);

  // Fallback: fetch online users once after socket is connected
  useEffect(() => {
    if (!socket) return;
    fetch(`${API_BASE}/api/users/online`)
      .then(res => res.json())
      .then(data => {
        const arr = Array.isArray(data) ? data : [];
        const uniq = Object.values(arr.reduce((acc, u) => {
          const key = u.userId || u.socketId || Math.random().toString(36);
          acc[key] = u;
          return acc;
        }, {}));
        setOnlineUsers(uniq);
      })
      .catch(() => {});
  }, [socket, setOnlineUsers]);

  const handleLogin = async ({ email, password }) => {
    try {
      const res = await fetch(`${API_BASE}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();
      if (!res.ok || !data.user) {
        return { error: data?.error || 'Login failed' };
      }
      setCurrentUser({
        id: data.user.id,
        username: data.user.username,
        email: data.user.email,
        avatar: data.user.avatar || null
      });
      setIsLoggedIn(true);
      setSelectedProfileUser(null);
      setShowProfilePage(false);
      return { ok: true };
    } catch (err) {
      console.error('Login error', err);
      return { error: 'Login failed' };
    }
  };

  const handleRegister = async ({ email, password, username }) => {
    try {
      const res = await fetch(`${API_BASE}/api/auth/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, username })
      });
      const data = await res.json();
      if (!res.ok || !data.user) {
        return { error: data?.error || 'Register failed' };
      }
      setCurrentUser({
        id: data.user.id,
        username: data.user.username,
        email: data.user.email,
        avatar: data.user.avatar || null
      });
      setIsLoggedIn(true);
      setSelectedProfileUser(null);
      setShowProfilePage(false);
      return { ok: true };
    } catch (err) {
      console.error('Register error', err);
      return { error: 'Register failed' };
    }
  };

  const handleLogout = () => {
    try {
      if (socket && currentRoom) {
        socket.emit('leave_room', { room: currentRoom });
      }
    } catch {}

    // Reset room tracking
    joinedRoomRef.current = { userId: null, room: null };

    // Disconnect current socket and create a fresh one for the login screen
    try { socket && socket.close(); } catch {}
    const newSocket = io(API_BASE);
    setSocket(newSocket);

    // Clear session state
    setCurrentUser(null);
    setIsLoggedIn(false);
    setMessages([]);
    setOnlineUsers([]);
    setSelectedProfileUser(null);
    setShowProfilePage(false);
  };

  if (loading) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        backgroundColor: theme.colors.background,
        color: theme.colors.text
      }}>
        <h2>Loading...</h2>
      </div>
    );
  }

  if (!isLoggedIn) {
    return <LoginPage onLogin={handleLogin} onRegister={handleRegister} />;
  }

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: '100vh',
      backgroundColor: theme.colors.background,
      color: theme.colors.text
    }}>
      <Header 
        onLogout={handleLogout} 
        onToggleSidebar={() => setSidebarOpen(prev => !prev)}
        sidebarOpen={sidebarOpen}
      />
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {sidebarOpen && <Sidebar socket={socket} />}
        <ChatWindow 
          key={currentDM ? `dm-${currentDM.userId}` : `room-${currentRoom}`} 
          socket={socket} 
        />
      </div>
      <UserProfile pageMode={false} />
      <UserProfile pageMode={true} />
    </div>
  );
};

function App() {
  return (
    <ThemeProvider>
      <ChatProvider>
        <AppContent />
      </ChatProvider>
    </ThemeProvider>
  );
}

export default App;
