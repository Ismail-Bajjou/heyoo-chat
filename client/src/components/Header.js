import React, { useContext, useState, useRef, useEffect } from 'react';
import { useTheme } from '../context/useTheme';
import { Users, PanelLeftOpen, PanelLeftClose } from 'lucide-react';
import { ChatContext } from '../context/ChatContext';
import { API_BASE } from '../api';
import UserBadge from './UserBadge';
import UserMenu from './UserMenu';
import Friends from './Friends';
import './Header.css';

const Header = ({ onLogout, onToggleSidebar, sidebarOpen }) => {
  const theme = useTheme();
  const { currentUser, setSelectedProfileUser, setShowProfilePage, pendingRequestsCount, setPendingRequestsCount } = useContext(ChatContext);
  const [menuOpen, setMenuOpen] = useState(false);
  const [showFriends, setShowFriends] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    const onScroll = () => setMenuOpen(false);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Fetch pending friend requests count
  useEffect(() => {
    if (!currentUser?.id) return;
    const fetchRequestsCount = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/friends/${currentUser.id}`);
        const data = await res.json();
        setPendingRequestsCount(data.incomingRequests?.length || 0);
      } catch (err) {
        console.error('Error fetching friend requests:', err);
      }
    };
    fetchRequestsCount();
    // Poll every 30 seconds for updates
    const interval = setInterval(fetchRequestsCount, 30000);
    return () => clearInterval(interval);
  }, [currentUser?.id, setPendingRequestsCount]);

  useEffect(() => {
    if (!menuOpen) return;
    // Delay binding to avoid closing on the same click that opens the menu
    let cleanup;
    const bind = () => {
      const handleClick = (e) => {
        if (containerRef.current && !containerRef.current.contains(e.target)) {
          setMenuOpen(false);
        }
      };
      window.addEventListener('click', handleClick);
      cleanup = () => {
        window.removeEventListener('click', handleClick);
      };
    };
    const id = setTimeout(bind, 0);
    return () => {
      clearTimeout(id);
      cleanup && cleanup();
    };
  }, [menuOpen]);

  return (
    <header style={{
      backgroundColor: theme.colors.surface,
      borderBottom: 'none',
      padding: '0.875rem 1.5rem',
      display: 'flex',
      justifyContent: 'space-between',
      alignItems: 'center',
      boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
      backdropFilter: 'blur(8px)',
      position: 'relative',
      zIndex: 9999
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
        <button
          onClick={onToggleSidebar}
          style={{
            backgroundColor: theme.isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.04)',
            border: 'none',
            color: theme.colors.text,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            padding: '0.5rem',
            borderRadius: '0.5rem',
            transition: 'all 0.2s ease',
            ':hover': { transform: 'scale(1.05)' }
          }}
          title={sidebarOpen ? 'Hide sidebar' : 'Show sidebar'}
          onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.05)'}
          onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
        >
          {sidebarOpen ? <PanelLeftClose size={20} /> : <PanelLeftOpen size={20} />}
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <div style={{
            fontSize: '1.75rem',
            background: 'linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
            fontWeight: '700',
            lineHeight: 1,
            filter: 'drop-shadow(0 2px 4px rgba(14, 165, 233, 0.3))'
          }}>💬</div>
          <h1 style={{
            background: 'linear-gradient(135deg, #0ea5e9 0%, #0284c7 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
            margin: 0,
            fontSize: '1.5rem',
            fontWeight: '700',
            letterSpacing: '-0.02em'
          }}>Heyoo</h1>
        </div>
      </div>
      <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', position: 'relative' }} ref={containerRef}>
        <button
          onClick={() => setShowFriends(!showFriends)}
          style={{
            backgroundColor: 'transparent',
            border: 'none',
            color: theme.colors.accent,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            padding: '0.5rem',
            position: 'relative'
          }}
          title="Friends"
        >
          <Users size={22} />
          {pendingRequestsCount > 0 && (
            <span style={{
              position: 'absolute',
              top: '0',
              right: '0',
              backgroundColor: '#ef4444',
              color: '#fff',
              fontSize: '0.625rem',
              fontWeight: '700',
              borderRadius: '9999px',
              minWidth: '1.125rem',
              height: '1.125rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '0 0.25rem',
              boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
              border: `2px solid ${theme.colors.surface}`
            }}>
              {pendingRequestsCount > 9 ? '9+' : pendingRequestsCount}
            </span>
          )}
        </button>
        <UserBadge
          user={currentUser}
          onClick={() => setMenuOpen(prev => !prev)}
        />
        <UserMenu
          open={menuOpen}
          onClose={() => setMenuOpen(false)}
          onOpenProfile={() => {
            setMenuOpen(false);
            if (currentUser && currentUser.id) {
              setSelectedProfileUser(currentUser.id);
              setShowProfilePage(true);
            }
          }}
          onToggleTheme={() => {
            theme.toggleTheme();
            setMenuOpen(false);
          }}
          onLogout={() => {
            setMenuOpen(false);
            onLogout?.();
          }}
        />        
      </div>
      {showFriends && <Friends onClose={() => setShowFriends(false)} />}
    </header>
  );
};

export default Header;
