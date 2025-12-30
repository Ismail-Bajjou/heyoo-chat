import React, { createContext, useState, useEffect } from 'react';
import { API_BASE } from '../api';

export const ChatContext = createContext();

export const ChatProvider = ({ children }) => {
  const [currentUser, setCurrentUser] = useState(() => {
    try {
      const raw = localStorage.getItem('chat_currentUser');
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  });
  const [currentRoom, setCurrentRoom] = useState(() => {
    try {
      const raw = localStorage.getItem('chat_currentRoom');
      return raw || null;
    } catch (e) {
      return null;
    }
  });
  const [rooms, setRooms] = useState([]);
  const [onlineUsers, setOnlineUsers] = useState([]);
  const [messages, setMessages] = useState([]);
  const [selectedProfileUser, setSelectedProfileUser] = useState(null);
  const [showProfilePage, setShowProfilePage] = useState(false);
  const [currentDM, setCurrentDM] = useState(null); // { userId, username, avatar }
  const [dmConversations, setDmConversations] = useState([]); // List of DM conversations
  const [roomUnread, setRoomUnread] = useState({}); // { [roomName]: count }
  const [dmUnread, setDmUnread] = useState({}); // { [partnerUserId]: count }
  const [typingRoom, setTypingRoom] = useState([]); // usernames typing in current room
  const [typingDM, setTypingDM] = useState({}); // { [partnerUserId]: { username, isTyping } }
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [blockedUsers, setBlockedUsers] = useState([]); // Array of blocked user IDs
  const [pendingRequestsCount, setPendingRequestsCount] = useState(0); // Count of incoming friend requests
  const [friendsList, setFriendsList] = useState([]); // Cached friends
  const [incomingRequests, setIncomingRequests] = useState([]);
  const [outgoingRequests, setOutgoingRequests] = useState([]);
  const [friendsLoadedAt, setFriendsLoadedAt] = useState(null);

  // Clear room/DM selection when user switches or logs out to avoid leaking prior selections
  useEffect(() => {
    const userId = currentUser?.id || currentUser?._id;
    // On logout or initial load with no user, clear state and storage
    if (!userId) {
      setCurrentRoom(null);
      setCurrentDM(null);
      setMessages([]);
      try { localStorage.removeItem('chat_currentRoom'); } catch (e) {}
      return;
    }

    // When user changes, reset selections and persisted room
    setCurrentRoom(null);
    setCurrentDM(null);
    setMessages([]);
    try { localStorage.removeItem('chat_currentRoom'); } catch (e) {}
  }, [currentUser?.id, currentUser?._id]);

  useEffect(() => {
    console.log('[ChatContext] roomUnread updated:', roomUnread);
  }, [roomUnread]);

  useEffect(() => {
    console.log('[ChatContext] dmUnread updated:', dmUnread);
  }, [dmUnread]);

  useEffect(() => {
    try {
      if (currentUser) localStorage.setItem('chat_currentUser', JSON.stringify(currentUser));
      else localStorage.removeItem('chat_currentUser');
    } catch (e) {}
  }, [currentUser]);

  useEffect(() => {
    try {
      if (currentRoom) localStorage.setItem('chat_currentRoom', currentRoom);
      else localStorage.removeItem('chat_currentRoom');
    } catch (e) {}
  }, [currentRoom, currentUser?.id]);

  // Prefetch friends + blocked when user changes
  useEffect(() => {
    const userId = currentUser?.id || currentUser?._id;
    if (!userId) return;

    const refreshFriends = async () => {
      try {
        const [friendsRes, blockedRes] = await Promise.all([
          fetch(`${API_BASE}/api/friends/${userId}`),
          fetch(`${API_BASE}/api/friends/blocked/${userId}`)
        ]);
        const data = await friendsRes.json();
        const bData = await blockedRes.json();
        setFriendsList(data.friends || []);
        setIncomingRequests(data.incomingRequests || []);
        setOutgoingRequests(data.outgoingRequests || []);
        setPendingRequestsCount((data.incomingRequests || []).length);
        const blockedList = Array.isArray(bData) ? bData : [];
        setBlockedUsers(blockedList.map(b => b._id));
        setFriendsLoadedAt(Date.now());
      } catch (err) {
        // fail silently
      }
    };
    refreshFriends();
  }, [currentUser?.id, currentUser?._id]);

  return (
    <ChatContext.Provider value={{
      currentUser,
      setCurrentUser,
      currentRoom,
      setCurrentRoom,
      rooms,
      setRooms,
      onlineUsers,
      setOnlineUsers,
      messages,
      setMessages,
      selectedProfileUser,
      setSelectedProfileUser,
      showProfilePage,
      setShowProfilePage,
      currentDM,
      setCurrentDM,
      dmConversations,
      setDmConversations,
      roomUnread,
      setRoomUnread,
      dmUnread,
      setDmUnread,
      typingRoom,
      setTypingRoom,
      typingDM,
      setTypingDM,
      loadingMessages,
      setLoadingMessages,
      blockedUsers,
      setBlockedUsers,
      pendingRequestsCount,
      setPendingRequestsCount,
      friendsList,
      setFriendsList,
      incomingRequests,
      setIncomingRequests,
      outgoingRequests,
      setOutgoingRequests,
      friendsLoadedAt,
      setFriendsLoadedAt
    }}>
      {children}
    </ChatContext.Provider>
  );
};
