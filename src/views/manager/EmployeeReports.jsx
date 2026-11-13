// src/views/manager/EmployeeReports.jsx
import React, { useState, useEffect, useMemo } from 'react';
import { api } from '../../api';
import DynamicMobileCardTable from '../../components/DynamicMobileCardTable';
import {
  FileText,
  Calendar,
  Users,
  Search,
  Download,
  ArrowLeft,
  RefreshCw,
  X,
  FileSpreadsheet,
  AlertCircle,
  Eye,
  CheckCircle2,
  ArrowLeftRight
} from 'lucide-react';

export default function EmployeeReports({ initialMonth, onNavigate }) {
  const [months, setMonths] = useState([]);
  const [selectedMonth, setSelectedMonth] = useState(initialMonth || '');
  const [monthData, setMonthData] = useState(null);
  const [loadingMonths, setLoadingMonths] = useState(true);
  const [loadingEmployees, setLoadingEmployees] = useState(false);
  const [search, setSearch] = useState('');

  // Selected Employee Detail View: null = directory view; string = employeeId
  const [selectedEmployeeId, setSelectedEmployeeId] = useState(null);
  const [employeeDetail, setEmployeeDetail] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [detailSearch, setDetailSearch] = useState('');
  const [exporting, setExporting] = useState(false);

  // Load available months on mount
  useEffect(() => {
    loadMonths();
  }, []);

  async function loadMonths() {
    setLoadingMonths(true);
    try {
      const res = await api.get('/manager/reports/months');
      const list = res.months || [];
      setMonths(list);
      if (list.length > 0) {
        const target = initialMonth && list.some(m => m.report_month === initialMonth)
          ? initialMonth
          : list[0].report_month;
        setSelectedMonth(target);
      }
    } catch (err) {
      console.error('Failed to load months:', err);
    } finally {
      setLoadingMonths(false);
    }
  }

  // Load employee list whenever selectedMonth changes
  useEffect(() => {
    if (selectedMonth) {
      setSelectedEmployeeId(null);
      setEmployeeDetail(null);
      loadMonthData(selectedMonth);
    }
  }, [selectedMonth]);

  async function loadMonthData(month) {
    setLoadingEmployees(true);
    try {
      const res = await api.get(`/manager/reports/month/${month}`);
      setMonthData(res);
    } catch (err) {
      console.error('Failed to load month data:', err);
    } finally {
      setLoadingEmployees(false);
    }
  }

  // Load employee detail when selectedEmployeeId changes
  useEffect(() => {
    if (selectedEmployeeId && selectedMonth) {
      loadEmployeeDetail(selectedMonth, selectedEmployeeId);
    }
  }, [selectedEmployeeId, selectedMonth]);

  async function loadEmployeeDetail(month, empId) {
    setLoadingDetail(true);
    setDetailSearch('');
    try {
      const res = await api.get(`/manager/reports/month/${month}/employee/${empId}`);
      setEmployeeDetail(res);
    } catch (err) {
      console.error('Failed to load employee detail:', err);
    } finally {
      setLoadingDetail(false);
    }
  }

  async function handleExportExcel(empId) {
    if (!selectedMonth || !empId) return;
    setExporting(true);
    try {
      const token = localStorage.getItem('sales_token');
      const response = await fetch(`/api/manager/reports/month/${selectedMonth}/employee/${empId}/export-excel`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (!response.ok) throw new Error('Export failed');
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${empId}_${selectedMonth}_Sales_Report.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      alert(err.message || 'Failed to download Excel report.');
    } finally {
      setExporting(false);
    }
  }

  // Filtered employees in month directory
  const employeeList = monthData?.employees || [];
  const filteredEmployees = useMemo(() => {
    if (!search.trim()) return employeeList;
    const q = search.trim().toLowerCase();
    return employeeList.filter(e =>
      (e.employee_name && e.employee_name.toLowerCase().includes(q)) ||
      (e.employee_id && e.employee_id.toLowerCase().includes(q)) ||
      (e.username && e.username.toLowerCase().includes(q))
    );
  }, [employeeList, search]);

  // Filtered rows in individual employee detail view
  const detailRows = employeeDetail?.rows || [];
  const filteredDetailRows = useMemo(() => {
    if (!detailSearch.trim()) return detailRows;
    const q = detailSearch.trim().toLowerCase();
    return detailRows.filter(r => {
      if (r.recordDate && r.recordDate.toLowerCase().includes(q)) return true;
      return Object.values(r.data || {}).some(val =>
        String(val).toLowerCase().includes(q)
      );
    });
  }, [detailRows, detailSearch]);

  // Calculate totals for numeric columns in detail view
  const detailTotals = useMemo(() => {
    const t = {};
    const cols = employeeDetail?.columns || [];
    cols.forEach(col => {
      if (col.type === 'number' || col.type === 'currency') {
        t[col.label] = 0;
      }
    });

    filteredDetailRows.forEach(r => {
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
  }, [filteredDetailRows, employeeDetail?.columns]);

  // ==========================================
  // RENDER 1: INDIVIDUAL EMPLOYEE REPORT VIEW
  // ==========================================
  if (selectedEmployeeId !== null) {
    const cols = employeeDetail?.columns || [];

    return (
      <div className="page-body">
        {/* Navigation & Header */}
        <div className="page-header" style={{ marginBottom: '16px', alignItems: 'flex-start' }}>
          <div>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => {
                setSelectedEmployeeId(null);
                setEmployeeDetail(null);
              }}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}
            >
              <ArrowLeft size={14} />
              <span>Back to Employees List</span>
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              <h1 className="page-title" style={{ margin: 0, fontSize: '22px' }}>
                {employeeDetail?.employeeName || 'Employee Report'}
              </h1>
              <span className="badge badge-neutral" style={{ fontSize: '12px', fontWeight: 700 }}>
                {employeeDetail?.employeeId}
              </span>
              <span className="badge badge-info" style={{ fontSize: '11.5px' }}>
                {employeeDetail?.monthName || selectedMonth}
              </span>
              <span className="badge badge-success" style={{ fontSize: '11px' }}>
                {detailRows.length} records
              </span>
            </div>
          </div>

          <button
            type="button"
            className="btn btn-primary"
            onClick={() => handleExportExcel(selectedEmployeeId)}
            disabled={exporting || loadingDetail || detailRows.length === 0}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '9px 16px', fontWeight: 600 }}
          >
            {exporting ? <RefreshCw size={15} className="spin" /> : <Download size={15} />}
            <span>{exporting ? 'Generating Excel...' : 'Download Excel (.xlsx)'}</span>
          </button>
        </div>

        {/* Quick Mobile KPI Summary Strip */}
        {detailRows.length > 0 && (
          <div className="mobile-kpi-summary">
            <div className="mobile-kpi-chip">
              <span className="chip-label">Total Records</span>
              <strong className="chip-val">{filteredDetailRows.length} rows</strong>
            </div>
            {cols.filter(c => c.type === 'currency').slice(0, 2).map((col, idx) => (
              <div key={idx} className="mobile-kpi-chip" style={{ borderLeft: '3px solid #10b981' }}>
                <span className="chip-label">{col.label}</span>
                <strong className="chip-val" style={{ color: '#047857' }}>
                  ₹{(detailTotals[col.label] || 0).toLocaleString()}
                </strong>
              </div>
            ))}
            {cols.filter(c => c.type === 'number').slice(0, 1).map((col, idx) => (
              <div key={idx} className="mobile-kpi-chip" style={{ borderLeft: '3px solid #3b82f6' }}>
                <span className="chip-label">{col.label}</span>
                <strong className="chip-val" style={{ color: '#1d4ed8' }}>
                  {(detailTotals[col.label] || 0).toLocaleString()}
                </strong>
              </div>
            ))}
          </div>
        )}

        {/* Search Bar */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '10px' }}>
          <div className="search-input-wrap" style={{ maxWidth: '340px', width: '100%' }}>
            <Search size={14} />
            <input
              type="text"
              className="search-input"
              placeholder="Search in records..."
              value={detailSearch}
              onChange={e => setDetailSearch(e.target.value)}
              style={{ fontSize: '13px', height: '38px' }}
            />
            {detailSearch && (
              <button
                type="button"
                onClick={() => setDetailSearch('')}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: '0 6px' }}
              >
                <X size={13} />
              </button>
            )}
          </div>

          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
            Showing {filteredDetailRows.length} of {detailRows.length} entries
          </span>
        </div>

        {/* Dynamic Table Card */}
        <div className="table-card" style={{ overflow: 'hidden' }}>
          {/* Desktop View: Full Responsive Table */}
          <div className="desktop-table-container">
            <div className="table-responsive" style={{ maxHeight: '650px', overflowY: 'auto' }}>
              <table className="data-table" style={{ fontSize: '12.5px', width: '100%', minWidth: `${Math.max(680, cols.length * 85)}px` }}>
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
                  {loadingDetail ? (
                    <tr>
                      <td colSpan={cols.length || 6} style={{ textAlign: 'center', padding: '36px' }}>
                        Loading employee sales report...
                      </td>
                    </tr>
                  ) : filteredDetailRows.length === 0 ? (
                    <tr>
                      <td colSpan={cols.length || 6} style={{ textAlign: 'center', padding: '36px', color: 'var(--text-muted)' }}>
                        No records match your search filter.
                      </td>
                    </tr>
                  ) : (
                    filteredDetailRows.map((row) => (
                      <tr key={row.id}>
                        {cols.map((col, idx) => {
                          const val = row.data?.[col.label];
                          const isNumeric = col.type === 'number' || col.type === 'currency';

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

                {/* Sticky Totals Footer */}
                {filteredDetailRows.length > 0 && cols.length > 0 && (
                  <tfoot>
                    <tr style={{ background: '#f8fafc', fontWeight: 700, position: 'sticky', bottom: 0, zIndex: 5, borderTop: '2px solid #cbd5e1' }}>
                      {cols.map((col, idx) => {
                        if (idx === 0) {
                          return <td key={idx}>Total ({filteredDetailRows.length} rows)</td>;
                        }
                        if (col.type === 'currency') {
                          const totalVal = detailTotals[col.label] || 0;
                          return (
                            <td key={idx} style={{ textAlign: 'right', color: '#059669', fontSize: '13px' }}>
                              ₹{totalVal.toLocaleString()}
                            </td>
                          );
                        }
                        if (col.type === 'number') {
                          const totalVal = detailTotals[col.label] || 0;
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

          {/* Mobile View: Clean Vertically Stacked Cards (Zero Horizontal Scroll) */}
          {!loadingDetail && detailRows.length > 0 && (
            <DynamicMobileCardTable
              rows={filteredDetailRows}
              cols={cols}
              getRowTitle={(row, idx) => {
                const productKey = Object.keys(row.data || {}).find(k => /product|item|description|name|particulars/i.test(k));
                if (productKey && row.data[productKey]) {
                  return row.data[productKey];
                }
                return row.recordDate ? `Entry #${idx + 1} (${row.recordDate})` : `Record #${idx + 1}`;
              }}
              getRowSubtitle={(row) => {
                return row.recordDate ? `Date: ${row.recordDate}` : null;
              }}
              getRowBadge={(row) => {
                const currencyCol = cols.find(c => c.type === 'currency');
                if (currencyCol) {
                  const val = row.data?.[currencyCol.label];
                  const num = typeof val === 'number' ? val : parseFloat(val);
                  if (!isNaN(num) && num > 0) {
                    return (
                      <span className="badge badge-success" style={{ fontWeight: 700, fontSize: '12px' }}>
                        ₹{num.toLocaleString()}
                      </span>
                    );
                  }
                }
                return null;
              }}
              initialFieldsCount={5}
              emptyMessage={filteredDetailRows.length === 0 ? "No records matched your search filter." : "No report records found."}
            />
          )}
        </div>
      </div>
    );
  }

  // ==========================================
  // RENDER 2: MONTH DIRECTORY / ALL EMPLOYEES
  // ==========================================
  return (
    <div className="page-body">
      {/* Header */}
      <div className="page-header" style={{ marginBottom: '20px' }}>
        <div>
          <h1 className="page-title" style={{ fontSize: '24px', fontWeight: 800 }}>
            Employee Sales Reports
          </h1>
        </div>

        {/* Month Selector Dropdown */}
        <div className="mobile-control-row">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <label style={{ fontSize: '13px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap' }}>
              <Calendar size={15} color="var(--primary-600)" />
              <span>Select Month:</span>
            </label>
            <select
              className="form-control"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              disabled={months.length === 0}
              style={{ minWidth: '180px', height: '38px', fontWeight: 600, fontSize: '13px' }}
            >
              {months.length === 0 ? (
                <option value="">No Reports Available</option>
              ) : (
                months.map((m) => (
                  <option key={m.report_month} value={m.report_month}>
                    {m.month_name}
                  </option>
                ))
              )}
            </select>
          </div>
        </div>
      </div>

      {months.length === 0 && !loadingMonths && (
        <div className="table-card" style={{ padding: '48px 24px', textAlign: 'center' }}>
          <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: '#f1f5f9', color: '#64748b', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: '14px' }}>
            <FileSpreadsheet size={28} />
          </div>
          <h3 style={{ fontSize: '17px', fontWeight: 700, margin: '0 0 6px 0' }}>No Monthly Sales Reports Found</h3>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: '0 0 16px 0' }}>
            Upload an Excel workbook (.xlsx) to automatically generate employee reports.
          </p>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={() => onNavigate && onNavigate('import-excel')}
          >
            Go to Import Excel
          </button>
        </div>
      )}

      {selectedMonth && (
        <>
          {/* Month Summary Bar */}
          <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '14px 20px', marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ width: '32px', height: '32px', borderRadius: '6px', background: '#ecfdf5', color: '#047857', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <CheckCircle2 size={18} />
              </div>
              <div>
                <strong style={{ fontSize: '14.5px' }}>{monthData?.monthName || selectedMonth}</strong>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)', marginLeft: '8px' }}>
                  Source: <code>{monthData?.filename}</code>
                </span>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '16px', fontSize: '13px' }}>
              <span>Employees: <strong>{monthData?.totalEmployees || 0}</strong></span>
              <span>Total Records: <strong>{monthData?.totalRecords?.toLocaleString() || 0}</strong></span>
            </div>
          </div>

          {/* Search Bar */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '10px' }}>
            <div className="search-input-wrap" style={{ maxWidth: '340px', width: '100%' }}>
              <Search size={14} />
              <input
                type="text"
                className="search-input"
                placeholder="Search employee by name or ID..."
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
              {filteredEmployees.length} {filteredEmployees.length === 1 ? 'employee' : 'employees'} found
            </span>
          </div>

          {/* Employees Table Card */}
          <div className="table-card" style={{ overflow: 'hidden' }}>
            {/* Desktop View: Full Responsive Table */}
            <div className="desktop-table-container">
              <div className="table-responsive">
                <table className="data-table" style={{ minWidth: '540px' }}>
                  <thead>
                    <tr>
                      <th style={{ width: '130px' }}>Employee ID</th>
                      <th>Staff Name</th>
                      <th>Username</th>
                      <th style={{ textAlign: 'right' }}>Records in Month</th>
                      <th style={{ textAlign: 'center', width: '120px' }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loadingEmployees ? (
                      <tr>
                        <td colSpan="5" style={{ textAlign: 'center', padding: '36px' }}>Loading employees...</td>
                      </tr>
                    ) : filteredEmployees.length === 0 ? (
                      <tr>
                        <td colSpan="5">
                          <div className="empty-state" style={{ padding: '32px' }}>
                            <div className="empty-state-icon"><Users size={24} /></div>
                            <div className="empty-state-title">No employees found</div>
                            <div className="empty-state-desc">No employee matched your search query in this month.</div>
                          </div>
                        </td>
                      </tr>
                    ) : (
                      filteredEmployees.map((emp) => (
                        <tr
                          key={emp.employee_id}
                          className="table-row-clickable"
                          onClick={() => setSelectedEmployeeId(emp.employee_id)}
                          style={{ cursor: 'pointer' }}
                        >
                          <td>
                            <span className="badge badge-neutral" style={{ fontWeight: 700, fontSize: '12px' }}>
                              {emp.employee_id}
                            </span>
                          </td>
                          <td>
                            <strong style={{ color: 'var(--primary-700)' }}>{emp.employee_name}</strong>
                          </td>
                          <td>
                            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                              @{emp.username || emp.employee_id.toLowerCase()}
                            </span>
                          </td>
                          <td style={{ textAlign: 'right', fontWeight: 600 }}>
                            {emp.record_count} rows
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <button
                              type="button"
                              className="btn btn-secondary btn-sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedEmployeeId(emp.employee_id);
                              }}
                              style={{ fontSize: '12px', padding: '4px 10px' }}
                            >
                              <Eye size={13} style={{ marginRight: '4px' }} />
                              View Report
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Mobile View: Vertically Stacked Cards */}
            <div className="mobile-card-container">
              {loadingEmployees ? (
                <div style={{ padding: '32px 16px', textAlign: 'center', color: '#64748b' }}>
                  Loading employees...
                </div>
              ) : filteredEmployees.length === 0 ? (
                <div style={{ padding: '32px 16px', textAlign: 'center', color: '#64748b' }}>
                  No employees matched your search query.
                </div>
              ) : (
                filteredEmployees.map((emp) => (
                  <div
                    key={emp.employee_id}
                    className="mobile-data-card clickable"
                    onClick={() => setSelectedEmployeeId(emp.employee_id)}
                  >
                    <div className="mobile-card-header">
                      <div className="mobile-card-title-group">
                        <div className="mobile-card-title">{emp.employee_name}</div>
                        <div className="mobile-card-subtitle">@{emp.username || emp.employee_id.toLowerCase()}</div>
                      </div>
                      <span className="badge badge-neutral" style={{ fontWeight: 700, fontSize: '12px' }}>
                        {emp.employee_id}
                      </span>
                    </div>

                    <div className="mobile-card-fields">
                      <div className="mobile-card-field-row">
                        <span className="mobile-card-field-label">Records in Month</span>
                        <span className="mobile-card-field-val number" style={{ fontWeight: 600 }}>
                          {emp.record_count} rows
                        </span>
                      </div>
                    </div>

                    <div className="mobile-card-actions">
                      <button
                        type="button"
                        className="btn btn-secondary btn-sm"
                        style={{ width: '100%', justifyContent: 'center', padding: '8px 14px', fontSize: '13px' }}
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedEmployeeId(emp.employee_id);
                        }}
                      >
                        <Eye size={14} style={{ marginRight: '6px' }} />
                        View Report &rarr;
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
