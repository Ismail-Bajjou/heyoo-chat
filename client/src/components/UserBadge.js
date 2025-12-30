import React from 'react';
import { useTheme } from '../context/useTheme';
import './UserBadge.css';

const UserBadge = ({ user, onClick }) => {
  const theme = useTheme();
  const initial = (user?.username?.[0] || '?').toUpperCase();

  return (
    <div
      className="user-badge"
      style={{
        backgroundColor: theme.colors.secondary,
        color: theme.colors.text,
        border: `1px solid ${theme.colors.border}`
      }}
      onClick={onClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === 'Enter') onClick?.(); }}
      aria-label={`Open profile of ${user?.username || 'Guest'}`}
    >
      <div className="avatar" style={{ backgroundColor: theme.colors.background }}>
        {user?.avatar ? (
          <img src={user.avatar} alt="avatar" />
        ) : (
          <span className="initials">{initial}</span>
        )}
      </div>
      <span className="name" style={{ color: theme.colors.text }}>{user?.username || 'Guest'}</span>
    </div>
  );
};

export default UserBadge;
