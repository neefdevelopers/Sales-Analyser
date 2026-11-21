// src/components/Navbar.jsx
import React from 'react';
import { useAuth } from '../context/AuthContext';
import { Shield, Menu } from 'lucide-react';

export default function Navbar({ currentViewTitle, sidebarOpen, onToggleSidebar }) {
  const { user } = useAuth();
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
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0 }}>
        <div className={`badge ${isManager ? 'badge-primary' : 'badge-info'} navbar-portal-badge`}>
          <Shield size={13} />
          <span className="navbar-portal-text">{isManager ? 'Brand Manager' : 'Sales Staff'}</span>
        </div>
      </div>
    </header>
  );
}
