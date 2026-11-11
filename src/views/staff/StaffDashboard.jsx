// src/views/staff/StaffDashboard.jsx
import React, { useState, useEffect } from 'react';
import { api } from '../../api';
import { useAuth } from '../../context/AuthContext';
import {
  LayoutDashboard,
  User,
  Calendar,
  FileSpreadsheet,
  ArrowRight,
  Clock,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';

export default function StaffDashboard({ onNavigate }) {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadDashboard();
  }, [user?.id]);

  async function loadDashboard() {
    setLoading(true);
    setError('');
    try {
      const res = await api.get('/staff/dashboard');
      setData(res);
    } catch (err) {
      console.error('Staff dashboard error:', err);
      setError(err.message || 'Failed to load dashboard data.');
    } finally {
      setLoading(false);
    }
  }

  const profile = data?.profile || {
    name: user?.name || 'Sales Staff',
    employeeId: user?.staff_id || '—'
  };
  const availableMonths = data?.availableMonths || [];
  const latest = data?.latestMonth;

  return (
    <div className="page-body">
      {/* Welcome Banner Header */}
      <div className="page-header" style={{ marginBottom: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'linear-gradient(135deg, var(--primary-600), #4f46e5)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', boxShadow: '0 4px 12px rgba(79, 70, 229, 0.25)', flexShrink: 0 }}>
            <User size={24} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <h1 className="page-title" style={{ margin: 0, fontSize: '22px', fontWeight: 800 }}>
                Welcome, {profile.name}
              </h1>
              <span className="badge badge-neutral" style={{ fontSize: '12px', fontWeight: 700 }}>
                Employee ID: {profile.employeeId}
              </span>
            </div>
            <p className="page-subtitle" style={{ color: 'var(--text-muted)', fontSize: '13px', marginTop: '2px' }}>
              Sales Staff Portal &bull; Monthly Sales Reports
            </p>
          </div>
        </div>

        <button
          type="button"
          className="btn btn-primary"
          onClick={() => onNavigate && onNavigate('my-sales-report')}
          style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '9px 16px', fontWeight: 600 }}
        >
          <FileSpreadsheet size={16} />
          <span>View My Sales Report</span>
        </button>
      </div>

      {error && (
        <div style={{ padding: '12px 16px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', color: '#991b1b', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <AlertCircle size={18} color="#dc2626" />
          <span>{error}</span>
        </div>
      )}

      {/* 2 Summary KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        <div className="kpi-card-premium" style={{ '--card-accent': '#3b82f6' }}>
          <div className="kpi-header">
            <span className="kpi-title">Current Reporting Period</span>
            <div className="kpi-icon-wrap" style={{ background: '#eff6ff', color: '#2563eb' }}>
              <Calendar size={18} />
            </div>
          </div>
          <div>
            <div className="kpi-value" style={{ fontSize: '22px', color: '#1e40af' }}>
              {loading ? '...' : latest?.monthName || 'No reports yet'}
            </div>
            <div className="kpi-subtext">Latest imported monthly report</div>
          </div>
        </div>

        <div className="kpi-card-premium" style={{ '--card-accent': '#10b981' }}>
          <div className="kpi-header">
            <span className="kpi-title">My Records in Period</span>
            <div className="kpi-icon-wrap" style={{ background: '#ecfdf5', color: '#059669' }}>
              <CheckCircle2 size={18} />
            </div>
          </div>
          <div>
            <div className="kpi-value" style={{ fontSize: '22px', color: '#047857' }}>
              {loading ? '...' : latest ? `${latest.recordCount} rows` : '0'}
            </div>
            <div className="kpi-subtext">Sales report entries recorded under ID: {profile.employeeId}</div>
          </div>
        </div>
      </div>

      {/* Available Reporting Months Table */}
      <div className="table-card">
        <div className="table-toolbar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Clock size={16} color="var(--primary-600)" />
            <strong style={{ fontSize: '14.5px' }}>My Available Monthly Reports</strong>
            <span className="badge badge-info" style={{ fontSize: '11px' }}>
              {availableMonths.length} {availableMonths.length === 1 ? 'month' : 'months'}
            </span>
          </div>
        </div>

        <div className="responsive-table-view">
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Reporting Month</th>
                  <th style={{ textAlign: 'right' }}>My Records Count</th>
                  <th>Imported Date</th>
                  <th style={{ textAlign: 'center', width: '140px' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan="4" style={{ textAlign: 'center', padding: '36px' }}>Loading your reports...</td>
                  </tr>
                ) : availableMonths.length === 0 ? (
                  <tr>
                    <td colSpan="4">
                      <div className="empty-state" style={{ padding: '36px' }}>
                        <div className="empty-state-icon"><FileSpreadsheet size={24} /></div>
                        <div className="empty-state-title">No sales reports assigned yet</div>
                        <div className="empty-state-desc">
                          Once the Brand Manager uploads a monthly report with your Employee ID ({profile.employeeId}), your sales data will appear here.
                        </div>
                      </div>
                    </td>
                  </tr>
                ) : (
                  availableMonths.map((m) => (
                    <tr key={m.report_month}>
                      <td>
                        <strong style={{ color: 'var(--primary-700)', fontSize: '13.5px' }}>
                          {m.month_name}
                        </strong>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{m.report_month}</div>
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 600 }}>
                        {m.record_count} entries
                      </td>
                      <td>
                        {new Date(m.imported_at).toLocaleDateString()}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={() => onNavigate && onNavigate('my-sales-report', { month: m.report_month })}
                          style={{ fontSize: '12px', padding: '4px 10px' }}
                        >
                          View Report &rarr;
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
