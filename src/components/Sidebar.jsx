// src/components/Sidebar.jsx
import React from 'react';
import { useAuth } from '../context/AuthContext';
import {
  LayoutDashboard,
  UploadCloud,
  FileSpreadsheet,
  History,
  Users,
  Award,
  LogOut,
  X
} from 'lucide-react';

export default function Sidebar({ currentView, setCurrentView, isOpen, onClose }) {
  const { user, logout } = useAuth();

  const isManager = user?.role === 'brand_manager';

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

        {/* Sidebar Footer with Authenticated User Profile & Logout */}
        <div className="sidebar-footer">
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
