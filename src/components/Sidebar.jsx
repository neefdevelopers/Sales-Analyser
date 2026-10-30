// src/components/Sidebar.jsx
import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  LayoutDashboard,
  ShoppingCart,
  RotateCcw,
  Award,
  Package,
  Users,
  BarChart3,
  LogOut,
  ChevronDown,
  UserCheck
} from 'lucide-react';

export default function Sidebar({ currentView, setCurrentView }) {
  const { user, logout, switchDemo, demoAccounts } = useAuth();
  const [showDemoMenu, setShowDemoMenu] = useState(false);

  const isManager = user?.role === 'brand_manager';

  // Role 1: Sales Staff Navigation (1. Orders, 2. Returns, 3. My Records)
  const staffNavItems = [
    { id: 'orders', label: 'Orders', icon: ShoppingCart },
    { id: 'returns', label: 'Returns', icon: RotateCcw },
    { id: 'my-records', label: 'My Records', icon: Award }
  ];

  // Role 2: Brand Manager Navigation (1. Products, 2. Staff, 3. Orders, 4. Returns, 5. Incentive Records)
  const managerNavItems = [
    { id: 'products', label: 'Product Management', icon: Package },
    { id: 'staff', label: 'Staff Management', icon: Users },
    { id: 'orders', label: 'Orders', icon: ShoppingCart },
    { id: 'returns', label: 'Returns', icon: RotateCcw },
    { id: 'incentives', label: 'Incentive Records', icon: Award }
  ];

  const navItems = isManager ? managerNavItems : staffNavItems;

  return (
    <aside className="sidebar">
      {/* Brand Header */}
      <div className="sidebar-brand">
        <div className="brand-icon">
          <Award size={20} />
        </div>
        <div>
          <div className="brand-name">SalesPulse</div>
          <span className="brand-tag">{isManager ? 'Brand Manager' : 'Sales Staff'}</span>
        </div>
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
              className={`nav-item ${isActive ? 'active' : ''}`}
              onClick={() => setCurrentView(item.id)}
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
        <div style={{ position: 'relative', marginBottom: '12px' }}>
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
            <ChevronDown size={14} />
          </button>

          {showDemoMenu && (
            <div
              style={{
                position: 'absolute',
                bottom: '100%',
                left: 0,
                right: 0,
                background: 'white',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-md)',
                boxShadow: 'var(--shadow-lg)',
                padding: '6px',
                marginBottom: '6px',
                zIndex: 50
              }}
            >
              <div style={{ fontSize: '11px', fontWeight: 700, padding: '4px 8px', color: 'var(--text-muted)' }}>
                SELECT EVALUATION ROLE:
              </div>
              {demoAccounts.map((acc) => (
                <button
                  key={acc.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    width: '100%',
                    padding: '6px 8px',
                    border: 'none',
                    background: acc.id === user?.id ? 'var(--primary-50)' : 'transparent',
                    color: acc.id === user?.id ? 'var(--primary-700)' : 'var(--text-main)',
                    borderRadius: 'var(--radius-sm)',
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    textAlign: 'left'
                  }}
                  onClick={() => {
                    switchDemo(acc.username);
                    setShowDemoMenu(false);
                  }}
                >
                  <span>{acc.name}</span>
                  <span
                    style={{
                      fontSize: '10px',
                      padding: '2px 6px',
                      borderRadius: '4px',
                      background: acc.role === 'brand_manager' ? '#e0e7ff' : '#f1f5f9'
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
            <div className="user-name">{user?.name}</div>
            <div className="user-role-badge">
              {isManager ? 'Manager' : user?.staff_id || 'Staff'}
            </div>
          </div>
          <button
            title="Log Out"
            onClick={logout}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--text-muted)',
              padding: '4px',
              borderRadius: 'var(--radius-sm)',
              display: 'flex',
              alignItems: 'center'
            }}
          >
            <LogOut size={16} />
          </button>
        </div>
      </div>
    </aside>
  );
}
