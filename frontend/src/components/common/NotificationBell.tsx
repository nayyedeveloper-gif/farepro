import React, { useState } from 'react';
import { useNotifications } from '../../contexts/NotificationContext';

const NotificationBell: React.FC = () => {
  const { notifications, unreadCount, markAllRead } = useNotifications();
  const [open, setOpen] = useState(false);

  const formatTime = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  };

  return (
    <div className="notification-bell-wrap">
      <button
        className="sidebar-icon-btn notification-bell"
        onClick={() => {
          setOpen(!open);
          if (!open && unreadCount > 0) markAllRead();
        }}
        title="Notifications"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" />
        </svg>
        {unreadCount > 0 && <span className="notification-badge">{unreadCount}</span>}
      </button>
      {open && (
        <div className="notification-dropdown">
          <div className="notification-dropdown-header">
            <h4>Notifications</h4>
          </div>
          {notifications.length === 0 ? (
            <p className="notification-empty">No notifications</p>
          ) : (
            <ul className="notification-list">
              {notifications.slice(0, 15).map((n) => (
                <li key={n.id} className={n.isRead ? '' : 'unread'}>
                  <div className="notification-title">{n.title}</div>
                  {n.body && <div className="notification-body">{n.body}</div>}
                  <div className="notification-time">{formatTime(n.createdAt)}</div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
};

export default NotificationBell;
