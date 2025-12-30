import React, { useState, useContext, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useTheme } from '../context/useTheme';
import { ChatContext } from '../context/ChatContext';
import { Search, Check, X, UserPlus, UserMinus, Ban, Undo2 } from 'lucide-react';
import { API_BASE } from '../api';
import './Friends.css';

const Friends = ({ onClose }) => {
  const theme = useTheme();
  const chatCtx = useContext(ChatContext);
  const { currentUser, setBlockedUsers, setPendingRequestsCount, friendsList: friendsCache, incomingRequests: incomingCache, outgoingRequests: outgoingCache, setFriendsList } = chatCtx;
  const userId = currentUser?.id || currentUser?._id;
  const [searchCode, setSearchCode] = useState('');
  const [searchResult, setSearchResult] = useState(null);
  const [friends, setFriends] = useState([]);
  const [incomingRequests, setIncomingRequests] = useState([]);
  const [outgoingRequests, setOutgoingRequests] = useState([]);
  const [blocked, setBlocked] = useState([]);
  const [loadingLists, setLoadingLists] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [tab, setTab] = useState('friends'); // 'search', 'friends', 'requests', 'blocked'

  useEffect(() => {
    // Show cached data instantly if available
    if (friendsCache?.length || incomingCache?.length || outgoingCache?.length) {
      setFriends(friendsCache || []);
      setIncomingRequests(incomingCache || []);
      setOutgoingRequests(outgoingCache || []);
      setLoadingLists(false);
    }
    // Always refresh in background to stay up-to-date
    loadFriends(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUser?.id, currentUser?._id]);

  const loadFriends = async (background = false) => {
    try {
      if (!userId) return;
      if (!background) setLoadingLists(true);
      // Fetch both in parallel
      const [friendsRes, blockedRes] = await Promise.all([
        fetch(`${API_BASE}/api/friends/${userId}`),
        fetch(`${API_BASE}/api/friends/blocked/${userId}`)
      ]);
      const data = await friendsRes.json();
      const bData = await blockedRes.json();
      setFriends(data.friends || []);
      setIncomingRequests(data.incomingRequests || []);
      setOutgoingRequests(data.outgoingRequests || []);
      // Update context caches
      setFriendsList(data.friends || []);
      chatCtx.setIncomingRequests(data.incomingRequests || []);
      chatCtx.setOutgoingRequests(data.outgoingRequests || []);
      const blockedList = Array.isArray(bData) ? bData : [];
      setBlocked(blockedList);
      // Update context blockedUsers with IDs
      setBlockedUsers(blockedList.map(b => b._id));
      // Update pending requests count in context
      setPendingRequestsCount(data.incomingRequests?.length || 0);
    } catch (err) {
      console.error('Error loading friends:', err);
    } finally {
      if (!background) setLoadingLists(false);
    }
  };

  const handleSearch = async () => {
    if (!searchCode.trim()) return;
    setLoading(true);
    setError('');
    try {
      const url = `${API_BASE}/api/users/search?code=${searchCode.toUpperCase()}`;
      console.log('[Friends] Searching with URL:', url);
      const res = await fetch(url);
      console.log('[Friends] Search response status:', res.status);
      const data = await res.json();
      console.log('[Friends] Search response data:', data);
      if (!res.ok) {
        setError(data.error === 'user_not_found' ? 'User not found' : 'Error searching');
        setSearchResult(null);
      } else {
        setSearchResult(data.user);
      }
    } catch (err) {
      setError('Error searching');
      console.error('[Friends] Search error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSendRequest = async () => {
    if (!searchResult) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API_BASE}/api/friends/request`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fromUserId: userId, toUserId: searchResult.id || searchResult._id })
      });
      const data = await res.json();
      if (!res.ok) {
        const errMap = {
          'already_friends': 'Already friends',
          'request_already_sent': 'Request already sent',
          'cannot_add_self': 'Cannot add yourself'
        };
        setError(errMap[data.error] || 'Error sending request');
      } else {
        setError('');
        setSearchCode('');
        setSearchResult(null);
        loadFriends();
      }
    } catch (err) {
      setError('Error sending request');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleAcceptRequest = async (requestId) => {
    try {
      const res = await fetch(`${API_BASE}/api/friends/accept`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestId })
      });
      if (res.ok) {
        loadFriends();
      }
    } catch (err) {
      console.error('Error accepting request:', err);
    }
  };

  const handleRejectRequest = async (requestId) => {
    try {
      const res = await fetch(`${API_BASE}/api/friends/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requestId })
      });
      if (res.ok) {
        loadFriends();
      }
    } catch (err) {
      console.error('Error rejecting request:', err);
    }
  };

  const handleRemoveFriend = async (friendId) => {
    if (!window.confirm('Remove this friend?')) return;
    try {
      const res = await fetch(`${API_BASE}/api/friends/${currentUser.id}/${friendId}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        loadFriends();
      }
    } catch (err) {
      console.error('Error removing friend:', err);
    }
  };

  const handleBlockFriend = async (friendId) => {
    if (!window.confirm('Block this user? They will not be able to DM you.')) return;
    try {
      const res = await fetch(`${API_BASE}/api/friends/block`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, targetId: friendId })
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Error blocking user');
        return;
      }
      // Optimistically update lists without full reload
      setFriends(prev => prev.filter(f => f._id !== friendId));
      const blockedFriend = friends.find(f => f._id === friendId);
      if (blockedFriend) {
        setBlocked(prev => [...prev, blockedFriend]);
        setBlockedUsers(prev => [...prev, friendId]); // Update context
      } else {
        setBlocked(prev => [...prev, { _id: friendId }]);
        setBlockedUsers(prev => [...prev, friendId]); // Update context
      }
    } catch (err) {
      console.error('Error blocking user:', err);
      setError('Error blocking user');
    }
  };

  const handleUnblock = async (targetId) => {
    try {
      const res = await fetch(`${API_BASE}/api/friends/unblock`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, targetId })
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Error unblocking user');
        return;
      }
      // Optimistically update blocked list
      setBlocked(prev => prev.filter(b => b._id !== targetId));
      setBlockedUsers(prev => prev.filter(id => id !== targetId)); // Update context
    } catch (err) {
      console.error('Error unblocking user:', err);
      setError('Error unblocking user');
    }
  };

  const isAlreadyFriend = friends.some(f => f._id === searchResult?.id);
  const isPending = outgoingRequests.some(r => r.to._id === searchResult?.id);

  // Close on Escape key
  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === 'Escape') onClose?.();
    };
    document.addEventListener('keydown', onKeyDown);
    // Lock background scroll while modal open
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = prevOverflow || '';
    };
  }, [onClose]);

  return createPortal(
    <div className="friends-modal" onClick={onClose}>
      <div className="friends-container" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="friends-header">
          <h2>Friends</h2>
          <button className="friends-close-btn" onClick={onClose}>✕</button>
        </div>

        {/* Tabs */}
        <div className="friends-tabs">
          {['search', 'friends', 'requests', 'blocked'].map(t => (
            <button
              key={t}
              onClick={() => { setTab(t); setError(''); }}
              className={`friends-tab ${tab === t ? 'active' : ''}`}
            >
              {t === 'requests' && incomingRequests.length > 0 && `(${incomingRequests.length})`} {t}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="friends-content">
          {error && (
            <div className="error-message">
              {error}
            </div>
          )}

          {loadingLists && tab !== 'search' && (
            <div className="friends-loading">Loading friends…</div>
          )}

          {!loadingLists && tab === 'search' && (
            <div>
              <div className="search-form">
                <input
                  type="text"
                  placeholder="Enter ID (e.g., AB12CD)"
                  value={searchCode}
                  onChange={(e) => setSearchCode(e.target.value.toUpperCase())}
                  onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                  className="search-input"
                />
                <button
                  onClick={handleSearch}
                  disabled={loading}
                  className="search-btn"
                >
                  <Search size={18} />
                </button>
              </div>

              {searchResult && (
                <div className="search-result">
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    {searchResult.avatar ? (
                      <img
                        src={searchResult.avatar}
                        alt={searchResult.username}
                        style={{
                          width: '2.5rem',
                          height: '2.5rem',
                          borderRadius: '50%',
                          objectFit: 'cover'
                        }}
                      />
                    ) : (
                      <div style={{
                        width: '2.5rem',
                        height: '2.5rem',
                        borderRadius: '50%',
                        backgroundColor: theme.colors.accent,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#fff',
                        fontSize: '0.875rem',
                        fontWeight: 'bold'
                      }}>
                        {searchResult.username[0].toUpperCase()}
                      </div>
                    )}
                    <div>
                      <p style={{ margin: '0 0 0.25rem 0', color: theme.colors.text, fontWeight: '600' }}>
                        {searchResult.username}
                      </p>
                      <p style={{ margin: 0, color: theme.colors.textMuted, fontSize: '0.875rem' }}>
                        {searchResult.friendsCount} friends
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={handleSendRequest}
                    disabled={loading || isAlreadyFriend || isPending}
                    className="friend-btn friend-btn-accept"
                  >
                    {isAlreadyFriend ? (
                      <>
                        <Check size={16} /> Friends
                      </>
                    ) : isPending ? (
                      'Pending'
                    ) : (
                      <>
                        <UserPlus size={16} /> Add
                      </>
                    )}
                  </button>
                </div>
              )}
            </div>
          )}

          {!loadingLists && tab === 'friends' && (
            <div className="friends-list">
              {friends.length === 0 ? (
                <p style={{ color: theme.colors.textMuted }}>No friends yet</p>
              ) : (
                friends.map(f => (
                  <div
                    key={f._id}
                    className="friend-item"
                  >
                    <div className="friend-info">
                      {f.avatar ? (
                        <img
                          src={f.avatar}
                          alt={f.username}
                          className="friend-avatar"
                        />
                      ) : (
                        <div className="friend-avatar" style={{ backgroundColor: theme.colors.accent, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 'bold' }}>
                          {f.username[0].toUpperCase()}
                        </div>
                      )}
                      <div className="friend-details">
                        <p className="friend-name">{f.username}</p>
                        <p className="friend-code">{f.friendCode || ''}</p>
                      </div>
                    </div>
                    <div className="friend-actions">
                      <button className="friend-btn friend-btn-remove" onClick={() => handleRemoveFriend(f._id)}>
                        <UserMinus size={16} /> Remove
                      </button>
                      <button className="friend-btn friend-btn-reject" onClick={() => handleBlockFriend(f._id)}>
                        <Ban size={16} /> Block
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {!loadingLists && tab === 'requests' && (
            <div className="friends-list">
              <h3 style={{ color: theme.colors.text, marginTop: 0 }}>Incoming Requests</h3>
              {incomingRequests.length === 0 ? (
                <p style={{ color: theme.colors.textMuted, fontSize: '0.875rem' }}>No incoming requests</p>
              ) : (
                incomingRequests.map(req => (
                  <div
                    key={req._id}
                    className="friend-item"
                  >
                    <div className="friend-info">
                      {req.from.avatar ? (
                        <img
                          src={req.from.avatar}
                          alt={req.from.username}
                          className="friend-avatar"
                        />
                      ) : (
                        <div className="friend-avatar" style={{ backgroundColor: theme.colors.accent, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 'bold' }}>
                          {req.from.username[0].toUpperCase()}
                        </div>
                      )}
                      <div className="friend-details">
                        <p className="friend-name">{req.from.username}</p>
                        <p className="friend-code">{req.from.friendCode || ''}</p>
                      </div>
                    </div>
                    <div className="friend-actions">
                      <button className="friend-btn friend-btn-accept" onClick={() => handleAcceptRequest(req._id)}>
                        <Check size={16} /> Accept
                      </button>
                      <button className="friend-btn friend-btn-reject" onClick={() => handleRejectRequest(req._id)}>
                        <X size={16} /> Reject
                      </button>
                    </div>
                  </div>
                ))
              )}

              <h3 style={{ color: theme.colors.text, marginTop: '1.5rem' }}>Sent Requests</h3>
              {outgoingRequests.length === 0 ? (
                <p style={{ color: theme.colors.textMuted, fontSize: '0.875rem' }}>No pending requests</p>
              ) : (
                outgoingRequests.map(req => (
                  <div
                    key={req._id}
                    className="friend-item"
                  >
                    <div className="friend-info">
                      {req.to.avatar ? (
                        <img
                          src={req.to.avatar}
                          alt={req.to.username}
                          className="friend-avatar"
                        />
                      ) : (
                        <div className="friend-avatar" style={{ backgroundColor: theme.colors.accent, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 'bold' }}>
                          {req.to.username[0].toUpperCase()}
                        </div>
                      )}
                      <div className="friend-details">
                        <p className="friend-name">{req.to.username}</p>
                        <p className="friend-code">{req.to.friendCode || ''}</p>
                      </div>
                    </div>
                    <div className="friend-actions">
                      <span className="friend-code" style={{ alignSelf: 'center' }}>Pending…</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {!loadingLists && tab === 'blocked' && (
            <div className="friends-list">
              {blocked.length === 0 ? (
                <p style={{ color: theme.colors.textMuted }}>No blocked users</p>
              ) : (
                blocked.map(b => (
                  <div key={b._id} className="friend-item">
                    <div className="friend-info">
                      {b.avatar ? (
                        <img src={b.avatar} alt={b.username} className="friend-avatar" />
                      ) : (
                        <div className="friend-avatar" style={{ backgroundColor: theme.colors.accent, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 'bold' }}>
                          {b.username[0].toUpperCase()}
                        </div>
                      )}
                      <div className="friend-details">
                        <p className="friend-name">{b.username}</p>
                        <p className="friend-code">{b.friendCode || ''}</p>
                      </div>
                    </div>
                    <div className="friend-actions">
                      <button className="friend-btn friend-btn-accept" onClick={() => handleUnblock(b._id)}>
                        <Undo2 size={16} /> Unblock
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
};

export default Friends;
