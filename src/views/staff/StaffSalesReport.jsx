// src/views/staff/StaffSalesReport.jsx
import React, { useState, useEffect, useMemo } from 'react';
import { api } from '../../api';
import { useAuth } from '../../context/AuthContext';
import {
  FileSpreadsheet,
  Calendar,
  Search,
  Download,
  RefreshCw,
  X,
  AlertCircle,
  FileText,
  User,
  CheckCircle2
} from 'lucide-react';

export default function StaffSalesReport({ initialMonth }) {
  const { user } = useAuth();
  const [selectedMonth, setSelectedMonth] = useState(initialMonth || '');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    loadReport(selectedMonth);
  }, [user?.id, selectedMonth]);

  async function loadReport(month) {
    setLoading(true);
    setError('');
    try {
      const qs = month ? `?month=${month}` : '';
      const res = await api.get(`/staff/my-report${qs}`);
      setData(res);
      if (res.month && !selectedMonth) {
        setSelectedMonth(res.month);
      }
    } catch (err) {
      console.error('Failed to load staff report:', err);
      setError(err.message || 'Failed to load your sales report.');
    } finally {
      setLoading(false);
    }
  }

  async function handleExportExcel() {
    if (!selectedMonth) return;
    setExporting(true);
    try {
      const token = localStorage.getItem('sales_token');
      const response = await fetch(`/api/staff/my-report/export-excel?month=${selectedMonth}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!response.ok) throw new Error('Export failed');
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `My_Sales_Report_${selectedMonth}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      alert(err.message || 'Failed to download your sales report.');
    } finally {
      setExporting(false);
    }
  }

  const availableMonths = data?.availableMonths || [];
  const cols = data?.columns || [];
  const rows = data?.rows || [];

  // Filter rows by quick search
  const filteredRows = useMemo(() => {
    if (!search.trim()) return rows;
    const q = search.trim().toLowerCase();
    return rows.filter(r => {
      if (r.recordDate && r.recordDate.toLowerCase().includes(q)) return true;
      return Object.values(r.data || {}).some(val =>
        String(val).toLowerCase().includes(q)
      );
    });
  }, [rows, search]);

  // Totals for numeric / currency columns
  const totals = useMemo(() => {
    const t = {};
    cols.forEach(col => {
      if (col.type === 'number' || col.type === 'currency') {
        t[col.label] = 0;
      }
    });

    filteredRows.forEach(r => {
      cols.forEach(col => {
        if (col.type === 'number' || col.type === 'currency') {
          const val = r.data?.[col.label];
          const num = typeof val === 'number' ? val : parseFloat(val);
          if (!isNaN(num)) {
            t[col.label] = (t[col.label] || 0) + num;
          }
        }
      });
    });

    Object.keys(t).forEach(k => {
      t[k] = Math.round(t[k] * 100) / 100;
    });

    return t;
  }, [filteredRows, cols]);

  return (
    <div className="page-body">
      {/* Header */}
      <div className="page-header" style={{ marginBottom: '16px', alignItems: 'flex-start' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <h1 className="page-title" style={{ margin: 0, fontSize: '22px', fontWeight: 800 }}>
              Sales Report
            </h1>
            <span className="badge badge-neutral" style={{ fontSize: '12px', fontWeight: 700 }}>
              Employee ID: {data?.employeeId || user?.staff_id}
            </span>
            <span className="badge badge-info" style={{ fontSize: '11.5px' }}>
              {data?.monthName || (selectedMonth ? selectedMonth : 'No Period')}
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          {/* Month Selector */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <label style={{ fontSize: '12.5px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}>
              <Calendar size={14} color="var(--primary-600)" />
              <span>Month:</span>
            </label>
            <select
              className="form-control"
              value={selectedMonth}
              onChange={e => setSelectedMonth(e.target.value)}
              disabled={availableMonths.length === 0}
              style={{ width: '160px', height: '36px', fontSize: '12.5px', fontWeight: 600 }}
            >
              {availableMonths.length === 0 ? (
                <option value="">No Reports Available</option>
              ) : (
                availableMonths.map(m => (
                  <option key={m.report_month} value={m.report_month}>
                    {m.month_name}
                  </option>
                ))
              )}
            </select>
          </div>

          {/* Download Excel Button */}
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleExportExcel}
            disabled={exporting || loading || rows.length === 0}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '7px', padding: '8px 14px', fontWeight: 600, fontSize: '12.5px' }}
          >
            {exporting ? <RefreshCw size={14} className="spin" /> : <Download size={14} />}
            <span>{exporting ? 'Downloading...' : 'Download My Report (.xlsx)'}</span>
          </button>
        </div>
      </div>

      {error && (
        <div style={{ padding: '12px 16px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', color: '#991b1b', marginBottom: '18px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <AlertCircle size={18} color="#dc2626" />
          <span>{error}</span>
        </div>
      )}

      {/* Search & Metadata Bar */}
      {rows.length > 0 && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '10px' }}>
          <div className="search-input-wrap" style={{ maxWidth: '320px', width: '100%' }}>
            <Search size={14} />
            <input
              type="text"
              className="search-input"
              placeholder="Search in your records..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ fontSize: '12.5px', height: '36px' }}
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: '0 6px' }}
              >
                <X size={13} />
              </button>
            )}
          </div>

          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
            Showing {filteredRows.length} of {rows.length} records
          </span>
        </div>
      )}

      {/* Dynamic Report Table Card */}
      <div className="table-card">
        <div className="responsive-table-view">
          <div className="table-responsive" style={{ maxHeight: '650px', overflowY: 'auto' }}>
            <table className="data-table" style={{ fontSize: '12.5px', width: '100%' }}>
              <thead style={{ position: 'sticky', top: 0, zIndex: 10, background: '#1e293b', color: '#ffffff' }}>
                <tr>
                  {cols.map((col, idx) => {
                    const isNumeric = col.type === 'number' || col.type === 'currency';
                    return (
                      <th
                        key={idx}
                        style={{
                          textAlign: isNumeric ? 'right' : 'left',
                          whiteSpace: 'nowrap',
                          background: '#1e293b',
                          color: '#ffffff',
                          padding: '10px 12px'
                        }}
                      >
                        {col.label}
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={cols.length || 6} style={{ textAlign: 'center', padding: '36px' }}>
                      Loading your sales report...
                    </td>
                  </tr>
                ) : rows.length === 0 ? (
                  <tr>
                    <td colSpan={cols.length || 6}>
                      <div className="empty-state" style={{ padding: '36px' }}>
                        <div className="empty-state-icon"><FileSpreadsheet size={24} /></div>
                        <div className="empty-state-title">No report records found</div>
                        <div className="empty-state-desc">
                          {selectedMonth
                            ? `No records were imported for Employee ID ${user?.staff_id} in ${selectedMonth}.`
                            : 'No monthly report is available yet.'}
                        </div>
                      </div>
                    </td>
                  </tr>
                ) : filteredRows.length === 0 ? (
                  <tr>
                    <td colSpan={cols.length || 6} style={{ textAlign: 'center', padding: '36px', color: 'var(--text-muted)' }}>
                      No records matched your search filter.
                    </td>
                  </tr>
                ) : (
                  filteredRows.map((row) => (
                    <tr key={row.id}>
                      {cols.map((col, idx) => {
                        const val = row.data?.[col.label];

                        if (col.type === 'currency') {
                          const num = typeof val === 'number' ? val : parseFloat(val);
                          return (
                            <td key={idx} style={{ textAlign: 'right', fontWeight: num > 0 ? 600 : 400, color: num > 0 ? '#059669' : '#94a3b8' }}>
                              {!isNaN(num) && num > 0 ? `₹${num.toLocaleString()}` : (val !== undefined && val !== null && val !== '' ? val : '—')}
                            </td>
                          );
                        }

                        if (col.type === 'number') {
                          const num = typeof val === 'number' ? val : parseFloat(val);
                          return (
                            <td key={idx} style={{ textAlign: 'right', fontWeight: num > 0 ? 600 : 400, color: num > 0 ? '#1e293b' : '#94a3b8' }}>
                              {!isNaN(num) && num > 0 ? num : (val || '—')}
                            </td>
                          );
                        }

                        if (col.type === 'date') {
                          return (
                            <td key={idx} style={{ fontWeight: 600, whiteSpace: 'nowrap' }}>
                              {val || '—'}
                            </td>
                          );
                        }

                        return (
                          <td key={idx}>
                            {val !== undefined && val !== null && String(val).trim() !== '' ? String(val) : '—'}
                          </td>
                        );
                      })}
                    </tr>
                  ))
                )}
              </tbody>

              {/* Totals Footer */}
              {filteredRows.length > 0 && cols.length > 0 && (
                <tfoot>
                  <tr style={{ background: '#f8fafc', fontWeight: 700, position: 'sticky', bottom: 0, zIndex: 5, borderTop: '2px solid #cbd5e1' }}>
                    {cols.map((col, idx) => {
                      if (idx === 0) {
                        return <td key={idx}>Total ({filteredRows.length} rows)</td>;
                      }
                      if (col.type === 'currency') {
                        const totalVal = totals[col.label] || 0;
                        return (
                          <td key={idx} style={{ textAlign: 'right', color: '#059669', fontSize: '13px' }}>
                            ₹{totalVal.toLocaleString()}
                          </td>
                        );
                      }
                      if (col.type === 'number') {
                        const totalVal = totals[col.label] || 0;
                        return (
                          <td key={idx} style={{ textAlign: 'right', color: '#1e293b' }}>
                            {totalVal > 0 ? totalVal : '—'}
                          </td>
                        );
                      }
                      return <td key={idx}></td>;
                    })}
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
