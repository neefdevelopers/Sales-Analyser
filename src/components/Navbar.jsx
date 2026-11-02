// src/components/Navbar.jsx
import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../api';
import { Clock, Shield, Menu } from 'lucide-react';

export default function Navbar({ currentViewTitle, sidebarOpen, onToggleSidebar }) {
  const { user } = useAuth();
  const [timeInfo, setTimeInfo] = useState(null);

  useEffect(() => {
    fetchServerTime();
    const interval = setInterval(fetchServerTime, 30000); // Check every 30s
    return () => clearInterval(interval);
  }, []);

  async function fetchServerTime() {
    try {
      const data = await api.get('/system/time');
      setTimeInfo(data);
    } catch (err) {
      // Ignore
    }
  }

  const isManager = user?.role === 'brand_manager';

  return (
    <header className="navbar">
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
        {/* Mobile / Tablet Hamburger Toggle */}
        <button
          type="button"
          className="mobile-menu-btn"
          onClick={onToggleSidebar}
          aria-label={sidebarOpen ? 'Close Navigation Menu' : 'Open Navigation Menu'}
        >
          <Menu size={20} />
        </button>

        <div style={{ minWidth: 0 }}>
          <h1 className="navbar-title">{currentViewTitle}</h1>
          <div className="navbar-user-meta">
            Logged in as <strong style={{ color: 'var(--text-main)' }}>{user?.name}</strong> ({isManager ? 'Brand Manager' : user?.staff_id})
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0 }}>
        {/* Business Timezone & Clock */}
        <div className="navbar-clock">
          <Clock size={14} color="var(--primary-600)" />
          <span className="navbar-tz-text">Timezone: <strong>Asia/Kolkata</strong></span>
          {timeInfo && (
            <span className="navbar-clock-time">
              {timeInfo.currentTime}
            </span>
          )}
        </div>

        <div className={`badge ${isManager ? 'badge-primary' : 'badge-info'} navbar-portal-badge`}>
          <Shield size={13} />
          <span className="navbar-portal-text">{isManager ? 'Brand Manager' : 'Sales Staff'}</span>
        </div>
      </div>
    </header>
  );
}
