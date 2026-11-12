// src/views/manager/ManagerDashboard.jsx
import React, { useState, useEffect } from 'react';
import { api } from '../../api';
import {
  LayoutDashboard,
  Users,
  FileSpreadsheet,
  Calendar,
  Clock,
  ArrowRight,
  TrendingUp,
  UploadCloud,
  CheckCircle2,
  AlertCircle,
  FileText
} from 'lucide-react';

export default function ManagerDashboard({ onNavigate }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    loadDashboard();
  }, []);

  async function loadDashboard() {
    setLoading(true);
    setError('');
    try {
      const res = await api.get('/manager/dashboard');
      setData(res);
    } catch (err) {
      console.error('Failed to load dashboard:', err);
      setError(err.message || 'Failed to load dashboard data.');
    } finally {
      setLoading(false);
    }
  }

  const availableMonths = data?.availableMonths || [];
  const latest = data?.latestImport;

  return (
    <div className="page-body">
      {/* Header */}
      <div className="page-header" style={{ marginBottom: '20px' }}>
        <div>
          <h1 className="page-title" style={{ fontSize: '24px', fontWeight: 800 }}>
            Brand Manager Dashboard
          </h1>
          <p className="page-subtitle" style={{ color: 'var(--text-muted)', fontSize: '13px', marginTop: '4px' }}>
            Employee Sales Report Management &bull; Monthly Excel Overview
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => onNavigate && onNavigate('employee-management')}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '9px 16px', fontWeight: 600 }}
          >
            <Users size={16} />
            <span>Manage Employees</span>
          </button>

          <button
            type="button"
            className="btn btn-primary"
            onClick={() => onNavigate && onNavigate('import-excel')}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '9px 16px', fontWeight: 600 }}
          >
            <UploadCloud size={16} />
            <span>Import Monthly Excel</span>
          </button>

          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => onNavigate && onNavigate('employee-reports')}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '9px 16px', fontWeight: 600 }}
          >
            <FileText size={16} />
            <span>View Employee Reports</span>
          </button>
        </div>
      </div>

      {error && (
        <div style={{ padding: '12px 16px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', color: '#991b1b', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <AlertCircle size={18} color="#dc2626" />
          <span>{error}</span>
        </div>
      )}

      {/* 4 Simple Summary KPI Cards */}
      <div className="kpi-grid sales-kpi-grid" style={{ marginBottom: '24px' }}>
        {/* 1. Total Employees */}
        <div className="kpi-card-premium" style={{ '--card-accent': '#3b82f6' }}>
          <div className="kpi-header">
            <span className="kpi-title">Total Employees</span>
            <div className="kpi-icon-wrap" style={{ background: '#eff6ff', color: '#2563eb' }}>
              <Users size={18} />
            </div>
          </div>
          <div>
            <div className="kpi-value">{loading ? '...' : data?.totalEmployees || 0}</div>
            <div className="kpi-subtext">Identified across all imported reports</div>
          </div>
        </div>

        {/* 2. Total Sales Records */}
        <div className="kpi-card-premium" style={{ '--card-accent': '#10b981' }}>
          <div className="kpi-header">
            <span className="kpi-title">Total Sales Records</span>
            <div className="kpi-icon-wrap" style={{ background: '#ecfdf5', color: '#059669' }}>
              <FileSpreadsheet size={18} />
            </div>
          </div>
          <div>
            <div className="kpi-value">{loading ? '...' : data?.totalSalesRecords?.toLocaleString() || 0}</div>
            <div className="kpi-subtext">Imported row-level entries</div>
          </div>
        </div>

        {/* 3. Current Imported Month */}
        <div className="kpi-card-premium" style={{ '--card-accent': '#8b5cf6' }}>
          <div className="kpi-header">
            <span className="kpi-title">Current Imported Month</span>
            <div className="kpi-icon-wrap" style={{ background: '#f5f3ff', color: '#7c3aed' }}>
              <Calendar size={18} />
            </div>
          </div>
          <div>
            <div className="kpi-value" style={{ fontSize: '20px', color: '#6d28d9' }}>
              {loading ? '...' : data?.currentMonth || 'None'}
            </div>
            <div className="kpi-subtext">Most recent active reporting period</div>
          </div>
        </div>

        {/* 4. Total Sales Amount */}
        <div className="kpi-card-premium" style={{ '--card-accent': '#f59e0b' }}>
          <div className="kpi-header">
            <span className="kpi-title">Total Sales Amount</span>
            <div className="kpi-icon-wrap" style={{ background: '#fef3c7', color: '#d97706' }}>
              <TrendingUp size={18} />
            </div>
          </div>
          <div>
            <div className="kpi-value" style={{ fontSize: '20px', color: '#b45309' }}>
              {loading ? '...' : data?.totalSalesAmount ? `₹${data.totalSalesAmount.toLocaleString()}` : 'N/A (Quantity-Based)'}
            </div>
            <div className="kpi-subtext">From available Excel sales columns</div>
          </div>
        </div>
      </div>

      {/* Latest Excel Import Details Card */}
      {latest && (
        <div className="table-card" style={{ marginBottom: '24px', padding: '20px', borderLeft: '4px solid #10b981' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: '#ecfdf5', color: '#047857', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <CheckCircle2 size={20} />
              </div>
              <div>
                <strong style={{ fontSize: '15px' }}>Latest Import: {latest.monthName}</strong>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                  File: <code style={{ color: '#0f172a' }}>{latest.filename}</code> &bull; Imported on {new Date(latest.importedAt).toLocaleDateString()}
                </div>
              </div>
            </div>

            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => onNavigate && onNavigate('employee-reports', { month: latest.reportMonth })}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12.5px' }}
            >
              <span>Open {latest.monthName} Reports</span>
              <ArrowRight size={14} />
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '14px', background: '#f8fafc', padding: '14px 18px', borderRadius: '8px' }}>
            <div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Employees Detected</div>
              <strong style={{ fontSize: '16px' }}>{latest.totalEmployees} employees</strong>
            </div>
            <div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Sales Records</div>
              <strong style={{ fontSize: '16px' }}>{latest.totalRecords} records</strong>
            </div>
            <div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Reporting Month</div>
              <strong style={{ fontSize: '16px' }}>{latest.reportMonth}</strong>
            </div>
            <div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Import Status</div>
              <span className="badge badge-success" style={{ marginTop: '2px', textTransform: 'capitalize' }}>
                {latest.status || 'Completed'}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Available Imported Months Table */}
      <div className="table-card">
        <div className="table-toolbar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Clock size={16} color="var(--primary-600)" />
            <strong style={{ fontSize: '14.5px' }}>Imported Monthly Reports</strong>
            <span className="badge badge-neutral" style={{ fontSize: '11px' }}>
              {availableMonths.length} months
            </span>
          </div>

          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => onNavigate && onNavigate('import-history')}
            style={{ fontSize: '12px' }}
          >
            View Full Import History &rarr;
          </button>
        </div>

        <div className="responsive-table-view">
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Reporting Month</th>
                  <th>Source Excel File</th>
                  <th style={{ textAlign: 'right' }}>Employees</th>
                  <th style={{ textAlign: 'right' }}>Total Records</th>
                  <th>Import Date</th>
                  <th style={{ textAlign: 'center', width: '130px' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan="6" style={{ textAlign: 'center', padding: '32px' }}>Loading imported reports...</td>
                  </tr>
                ) : availableMonths.length === 0 ? (
                  <tr>
                    <td colSpan="6">
                      <div className="empty-state" style={{ padding: '32px' }}>
                        <div className="empty-state-icon"><FileSpreadsheet size={24} /></div>
                        <div className="empty-state-title">No monthly sales reports yet</div>
                        <div className="empty-state-desc">Upload your first monthly Excel file to generate employee reports.</div>
                        <button
                          type="button"
                          className="btn btn-primary btn-sm"
                          onClick={() => onNavigate && onNavigate('import-excel')}
                          style={{ marginTop: '12px' }}
                        >
                          Upload Excel File
                        </button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  availableMonths.map((m) => (
                    <tr key={m.id}>
                      <td>
                        <strong style={{ color: 'var(--primary-700)', fontSize: '13.5px' }}>
                          {m.month_name}
                        </strong>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{m.report_month}</div>
                      </td>
                      <td>
                        <code style={{ fontSize: '12px' }}>{m.filename}</code>
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 600 }}>
                        {m.total_employees}
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 600 }}>
                        {m.total_records?.toLocaleString()}
                      </td>
                      <td>
                        {new Date(m.created_at).toLocaleDateString()}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={() => onNavigate && onNavigate('employee-reports', { month: m.report_month })}
                          style={{ fontSize: '12px', padding: '4px 10px' }}
                        >
                          View Reports &rarr;
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
