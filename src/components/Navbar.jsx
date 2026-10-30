// src/components/Navbar.jsx
import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../api';
import { Clock, Shield } from 'lucide-react';

export default function Navbar({ currentViewTitle }) {
  const { user } = useAuth();
  const [deadlineInfo, setDeadlineInfo] = useState(null);

  useEffect(() => {
    fetchDeadlineStatus();
    const interval = setInterval(fetchDeadlineStatus, 30000); // Check every 30s
    return () => clearInterval(interval);
  }, []);

  async function fetchDeadlineStatus() {
    try {
      const data = await api.get('/system/deadline-status');
      setDeadlineInfo(data);
    } catch (err) {
      // Ignore
    }
  }

  const isManager = user?.role === 'brand_manager';

  return (
    <header className="navbar">
      <div>
        <h1 style={{ fontSize: '18px', fontWeight: 800 }}>{currentViewTitle}</h1>
        <div style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>
          Logged in as <strong style={{ color: 'var(--text-main)' }}>{user?.name}</strong> ({isManager ? 'Brand Manager' : user?.staff_id})
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        {/* Business Timezone & Clock */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '6px 12px',
            background: 'var(--bg-surface-subtle)',
            borderRadius: 'var(--radius-md)',
            fontSize: '12px',
            fontWeight: 600,
            color: 'var(--text-muted)'
          }}
        >
          <Clock size={14} color="var(--primary-600)" />
          <span>Timezone: <strong>Asia/Kolkata</strong></span>
          {deadlineInfo && (
            <span style={{ color: 'var(--text-main)', borderLeft: '1px solid var(--border-subtle)', paddingLeft: '8px' }}>
              {deadlineInfo.currentTime}
            </span>
          )}
        </div>

        <div className={`badge ${isManager ? 'badge-primary' : 'badge-info'}`} style={{ padding: '6px 12px' }}>
          <Shield size={13} />
          <span>{isManager ? 'Brand Manager Portal' : 'Sales Staff Portal'}</span>
        </div>
      </div>
    </header>
  );
}
