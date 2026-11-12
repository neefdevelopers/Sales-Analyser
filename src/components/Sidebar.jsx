// src/components/Sidebar.jsx
import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  LayoutDashboard,
  UploadCloud,
  FileSpreadsheet,
  History,
  Users,
  Award,
  LogOut,
  ChevronDown,
  UserCheck,
  X
} from 'lucide-react';

export default function Sidebar({ currentView, setCurrentView, isOpen, onClose }) {
  const { user, logout, switchDemo, demoAccounts } = useAuth();
  const [showDemoMenu, setShowDemoMenu] = useState(false);
  const demoMenuRef = useRef(null);

  const isManager = user?.role === 'brand_manager';

  // Close demo menu if user clicks outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (demoMenuRef.current && !demoMenuRef.current.contains(event.target)) {
        setShowDemoMenu(false);
      }
    }
    if (showDemoMenu) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showDemoMenu]);

  // Role 1: Sales Staff Navigation (only Sales Report)
  const staffNavItems = [
    { id: 'my-sales-report', label: 'Sales Report', icon: FileSpreadsheet }
  ];

  // Role 2: Brand Manager Navigation
  const managerNavItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'employee-management', label: 'Employee Management', icon: Users },
    { id: 'import-excel', label: 'Import Excel', icon: UploadCloud },
    { id: 'employee-reports', label: 'Employee Reports', icon: FileSpreadsheet },
    { id: 'import-history', label: 'Import History', icon: History }
  ];

  const navItems = isManager ? managerNavItems : staffNavItems;

  return (
    <>
      {isOpen && (
        <div className="sidebar-backdrop" onClick={onClose} aria-hidden="true" />
      )}
      <aside className={`sidebar ${isOpen ? 'open' : ''}`}>
        {/* Brand Header */}
        <div className="sidebar-brand">
          <div className="brand-icon">
            <Award size={20} />
          </div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div className="brand-name">SalesPulse</div>
            <span className="brand-tag">{isManager ? 'Brand Manager' : 'Sales Staff'}</span>
          </div>
          <button
            type="button"
            className="sidebar-close-btn"
            onClick={onClose}
            aria-label="Close navigation sidebar"
          >
            <X size={18} />
          </button>
        </div>

        {/* Navigation List */}
        <nav className="sidebar-nav">
          <div className="nav-section-title">Main Menu</div>
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = currentView === item.id;
            return (
              <button
                key={item.id}
                type="button"
                className={`nav-item ${isActive ? 'active' : ''}`}
                onClick={() => {
                  setCurrentView(item.id);
                  if (onClose) onClose();
                }}
              >
                <Icon size={18} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Sidebar Footer with Demo Switcher & User Profile */}
        <div className="sidebar-footer">
          {/* Quick Role Switcher for Test Evaluators */}
          <div ref={demoMenuRef} style={{ position: 'relative', marginBottom: '12px' }}>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              style={{ width: '100%', justifyContent: 'space-between' }}
              onClick={() => setShowDemoMenu(!showDemoMenu)}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <UserCheck size={14} />
                <span>Switch User Role</span>
              </span>
              <ChevronDown size={14} style={{ transform: showDemoMenu ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s ease' }} />
            </button>

            {showDemoMenu && (
              <div
                style={{
                  position: 'absolute',
                  bottom: 'calc(100% + 6px)',
                  left: 0,
                  right: 0,
                  background: 'white',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-md)',
                  boxShadow: 'var(--shadow-xl)',
                  padding: '6px',
                  maxHeight: '260px',
                  overflowY: 'auto',
                  zIndex: 60
                }}
              >
                <div style={{ fontSize: '10.5px', fontWeight: 700, padding: '4px 8px', color: 'var(--text-subtle)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Select Evaluation Role
                </div>
                {demoAccounts.map((acc) => (
                  <button
                    key={acc.id}
                    type="button"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      width: '100%',
                      padding: '7px 8px',
                      border: 'none',
                      background: acc.id === user?.id ? 'var(--primary-50)' : 'transparent',
                      color: acc.id === user?.id ? 'var(--primary-700)' : 'var(--text-main)',
                      borderRadius: 'var(--radius-sm)',
                      fontSize: '12px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      textAlign: 'left',
                      marginBottom: '2px',
                      transition: 'background 0.15s ease'
                    }}
                    onClick={() => {
                      switchDemo(acc.username);
                      setShowDemoMenu(false);
                      if (onClose) onClose();
                    }}
                  >
                    <span>{acc.name}</span>
                    <span
                      style={{
                        fontSize: '10px',
                        padding: '2px 6px',
                        borderRadius: '4px',
                        fontWeight: 700,
                        background: acc.role === 'brand_manager' ? '#e0e7ff' : '#f1f5f9',
                        color: acc.role === 'brand_manager' ? '#4338ca' : '#475569'
                      }}
                    >
                      {acc.role === 'brand_manager' ? 'Manager' : acc.staff_id}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Current User Card & Logout */}
          <div className="user-card">
            <div className="user-avatar">
              {user?.name ? user.name.charAt(0).toUpperCase() : 'U'}
            </div>
            <div className="user-info">
              <div className="user-name" title={user?.name}>{user?.name}</div>
              <div className="user-role-badge">
                {isManager ? 'Manager' : user?.staff_id || 'Staff'}
              </div>
            </div>
            <button
              type="button"
              className="user-logout-btn"
              title="Log Out"
              onClick={logout}
              aria-label="Log Out"
            >
              <LogOut size={16} />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
