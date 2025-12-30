import React, { useRef } from 'react';
import { Moon, Sun, LogOut, User as UserIcon } from 'lucide-react';
import { useTheme } from '../context/useTheme';
import './UserMenu.css';

const UserMenu = ({ open, onClose, onOpenProfile, onToggleTheme, onLogout }) => {
  const theme = useTheme();
  const ref = useRef(null);

  return (
    <div
      className={`user-menu ${open ? 'show' : ''} ${theme.isDark ? 'dark' : 'light'}`}
      ref={ref}
      style={{
        backgroundColor: theme.colors.surface,
        border: `1px solid ${theme.colors.border}`
      }}
    >
      <button className="item" onClick={onOpenProfile} style={{ color: theme.isDark ? '#e5e7eb' : theme.colors.text }}>
        <UserIcon size={18} />
        <span>Profile</span>
      </button>
      <button className="item" onClick={onToggleTheme} style={{ color: theme.isDark ? '#e5e7eb' : theme.colors.text }}>
        {theme.isDark ? <Sun size={18} /> : <Moon size={18} />}
        <span>{theme.isDark ? 'Light Mode' : 'Dark Mode'}</span>
      </button>
      <div className="divider" style={{ backgroundColor: theme.colors.border }} />
      <button className="item" onClick={onLogout} style={{ color: theme.isDark ? '#e5e7eb' : theme.colors.text }}>
        <LogOut size={18} />
        <span>Logout</span>
      </button>
    </div>
  );
};

export default UserMenu;
