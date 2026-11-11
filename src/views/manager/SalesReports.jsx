// src/views/manager/SalesReports.jsx
import React, { useState, useEffect } from 'react';
import { api } from '../../api';
import { useSessionState } from '../../hooks/useSessionState';
import {
  BarChart3,
  FileSpreadsheet,
  Filter,
  Calendar,
  Search,
  X,
  RotateCcw,
  ShoppingCart,
  TrendingUp,
  CheckCircle2,
  Package,
  PackageCheck,
  Award,
  Users,
  RefreshCw,
  ArrowUpDown,
  AlertCircle,
  ArrowLeft,
  Eye,
  ChevronDown
} from 'lucide-react';
import BulkOrderImportModal from '../../components/BulkOrderImportModal';

const PRESETS = [
  { id: 'all', label: 'All Records' },
  { id: 'this_month', label: 'This Month' },
  { id: 'previous_month', label: 'Previous Month' },
  { id: 'this_week', label: 'This Week' },
  { id: 'today', label: 'Today' },
  { id: 'yesterday', label: 'Yesterday' },
  { id: 'custom', label: 'Custom Date Range' }
];

function ClearConfirmModal({ isOpen, onClose, onConfirm, clearing }) {
  if (!isOpen) return null;
  return (
    <div className="modal-backdrop" onClick={() => !clearing && onClose()}>
      <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '480px' }}>
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#dc2626' }}>
            <AlertCircle size={20} />
            <h3 style={{ margin: 0, fontSize: '18px', fontWeight: 700 }}>Clear All Orders & Returns?</h3>
          </div>
          <button
            type="button"
            className="btn-icon"
            onClick={() => !clearing && onClose()}
            disabled={clearing}
          >
            <X size={18} />
          </button>
        </div>
        <div className="modal-body" style={{ padding: '16px 20px', fontSize: '13.5px', color: '#475569', lineHeight: 1.6 }}>
          <p style={{ margin: '0 0 12px 0' }}>
            This will permanently delete <strong>all orders</strong>, <strong>all returns</strong>, and <strong>import logs</strong> from the database.
          </p>
          <p style={{ margin: '0 0 12px 0', padding: '10px 14px', background: '#fef2f2', border: '1px solid #fee2e2', borderRadius: '6px', color: '#b91c1c' }}>
            <strong>Note:</strong> All 10 staff members and catalog products will remain completely intact. You can immediately import your updated Excel sheet.
          </p>
          <p style={{ margin: 0, fontWeight: 600 }}>
            Are you sure you want to proceed?
          </p>
        </div>
        <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', padding: '12px 20px' }}>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={onClose}
            disabled={clearing}
          >
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-danger"
            onClick={onConfirm}
            disabled={clearing}
            style={{ background: '#dc2626', borderColor: '#b91c1c', color: '#ffffff', fontWeight: 600 }}
          >
            {clearing ? 'Clearing...' : 'Yes, Clear All Orders & Returns'}
          </button>
        </div>
      </div>
    </div>
  );
}

function DynamicSheetTable({ columns = [], rows = [], totals = {}, onSelectStaff, onExportCsv, loading, title = 'Dynamic Sheet View (All Columns by Employee ID)' }) {
  return (
    <div className="table-card" style={{ marginBottom: '24px' }}>
      <div className="table-toolbar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{ width: '28px', height: '28px', borderRadius: '6px', background: '#ecfdf5', color: '#047857', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <FileSpreadsheet size={16} />
          </div>
          <strong style={{ fontSize: '14.5px' }}>{title}</strong>
          <span className="badge badge-success" style={{ fontSize: '11px' }}>
            {rows.length} rows
          </span>
        </div>
        {onExportCsv && (
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={onExportCsv}
            disabled={!rows.length}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12px' }}
          >
            <FileSpreadsheet size={14} />
            <span>Export Sheet (.csv)</span>
          </button>
        )}
      </div>

      <div className="responsive-table-view">
        <div className="table-responsive" style={{ maxHeight: '650px', overflowY: 'auto' }}>
          <table className="data-table" style={{ fontSize: '12.5px' }}>
            <thead style={{ position: 'sticky', top: 0, zIndex: 10 }}>
              <tr>
                {columns.map(col => {
                  const isNumeric = col.type === 'product' || col.type === 'return' || col.type === 'currency';
                  return (
                    <th
                      key={col.key}
                      style={{
                        textAlign: isNumeric ? 'right' : 'left',
                        whiteSpace: 'nowrap',
                        background: '#1e293b',
                        color: '#ffffff',
                        minWidth: col.width || (isNumeric ? '85px' : '100px')
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
                  <td colSpan={columns.length || 10} style={{ textAlign: 'center', padding: '32px' }}>
                    Loading sheet data...
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={columns.length || 10}>
                    <div className="empty-state">
                      <div className="empty-state-icon"><FileSpreadsheet size={24} /></div>
                      <div className="empty-state-title">No sheet records found</div>
                      <div className="empty-state-desc">
                        Import an Excel sheet using "Import Orders (Excel)" or adjust your filters.
                      </div>
                    </div>
                  </td>
                </tr>
              ) : (
                rows.map((r, idx) => (
                  <tr key={`${r.date}_${r.staff_id || r.employee_id}_${idx}`}>
                    {columns.map(col => {
                      if (col.key === 'date') {
                        return <td key={col.key} style={{ fontWeight: 600 }}>{r.date}</td>;
                      }
                      if (col.key === 'employee_id') {
                        return (
                          <td key={col.key}>
                            <span className="badge badge-neutral" style={{ fontWeight: 700, letterSpacing: '0.5px' }}>
                              {r.employee_id || '—'}
                            </span>
                          </td>
                        );
                      }
                      if (col.key === 'staff_name') {
                        return (
                          <td key={col.key}>
                            {onSelectStaff && r.staff_id ? (
                              <button
                                type="button"
                                onClick={() => onSelectStaff(r.staff_id)}
                                style={{
                                  background: 'none',
                                  border: 'none',
                                  padding: 0,
                                  color: 'var(--primary-600)',
                                  fontWeight: 600,
                                  cursor: 'pointer',
                                  textDecoration: 'underline',
                                  textAlign: 'left'
                                }}
                                title={`View ${r.staff_name}'s sales report`}
                              >
                                {r.staff_name}
                              </button>
                            ) : (
                              <strong>{r.staff_name || '—'}</strong>
                            )}
                          </td>
                        );
                      }
                      if (col.type === 'product') {
                        const qty = r.quantities?.[col.key] || 0;
                        return (
                          <td key={col.key} style={{ textAlign: 'right', fontWeight: qty > 0 ? 600 : 400, color: qty > 0 ? '#1e293b' : '#94a3b8' }}>
                            {qty > 0 ? qty : '—'}
                          </td>
                        );
                      }
                      if (col.key === 'incentive') {
                        return (
                          <td key={col.key} style={{ textAlign: 'right', fontWeight: 600, color: r.incentive > 0 ? '#059669' : '#94a3b8' }}>
                            {r.incentive > 0 ? `₹${r.incentive.toLocaleString()}` : '₹0'}
                          </td>
                        );
                      }
                      if (col.type === 'return') {
                        const retQty = r.returns?.[col.key] || 0;
                        return (
                          <td key={col.key} style={{ textAlign: 'right', fontWeight: retQty > 0 ? 700 : 400, color: retQty > 0 ? '#dc2626' : '#94a3b8' }}>
                            {retQty > 0 ? retQty : '—'}
                          </td>
                        );
                      }
                      if (col.key === 'return_deductions') {
                        return (
                          <td key={col.key} style={{ textAlign: 'right', fontWeight: 600, color: r.return_deductions > 0 ? '#dc2626' : '#94a3b8' }}>
                            {r.return_deductions > 0 ? `-₹${r.return_deductions.toLocaleString()}` : '₹0'}
                          </td>
                        );
                      }
                      if (col.key === 'total_net') {
                        return (
                          <td key={col.key} style={{ textAlign: 'right', fontWeight: 700, color: '#15803d' }}>
                            ₹{(r.total_net || 0).toLocaleString()}
                          </td>
                        );
                      }
                      return <td key={col.key}>—</td>;
                    })}
                  </tr>
                ))
              )}
            </tbody>
            {rows.length > 0 && totals && (
              <tfoot>
                <tr style={{ background: '#f1f5f9', fontWeight: 700, position: 'sticky', bottom: 0, zIndex: 5, borderTop: '2px solid #cbd5e1' }}>
                  {columns.map((col, idx) => {
                    if (idx === 0) {
                      return <td key={col.key}>Total ({rows.length} rows)</td>;
                    }
                    if (col.key === 'employee_id' || col.key === 'staff_name') {
                      return <td key={col.key}></td>;
                    }
                    if (col.type === 'product') {
                      const totalVal = totals[col.key] || 0;
                      return (
                        <td key={col.key} style={{ textAlign: 'right', color: '#1e293b' }}>
                          {totalVal}
                        </td>
                      );
                    }
                    if (col.key === 'incentive') {
                      return (
                        <td key={col.key} style={{ textAlign: 'right', color: '#059669' }}>
                          ₹{(totals.incentive || 0).toLocaleString()}
                        </td>
                      );
                    }
                    if (col.type === 'return') {
                      const totalRet = totals[col.key] || 0;
                      return (
                        <td key={col.key} style={{ textAlign: 'right', color: totalRet > 0 ? '#dc2626' : '#64748b' }}>
                          {totalRet}
                        </td>
                      );
                    }
                    if (col.key === 'return_deductions') {
                      return (
                        <td key={col.key} style={{ textAlign: 'right', color: '#dc2626' }}>
                          {totals.return_deductions > 0 ? `-₹${totals.return_deductions.toLocaleString()}` : '₹0'}
                        </td>
                      );
                    }
                    if (col.key === 'total_net') {
                      return (
                        <td key={col.key} style={{ textAlign: 'right', color: '#15803d', fontSize: '13px' }}>
                          ₹{(totals.total_net || 0).toLocaleString()}
                        </td>
                      );
                    }
                    return <td key={col.key}></td>;
                  })}
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>
    </div>
  );
}

export default function SalesReports() {
  // Navigation state: null = Overall Sales Reports; string/number = Individual Staff Sales Report
  const [selectedStaffId, setSelectedStaffId] = useSessionState('filter_reports_selected_staff_id', null);

  // Common filters persisted across views
  const [preset, setPreset] = useSessionState('filter_reports_preset', 'all');
  const [startDate, setStartDate] = useSessionState('filter_reports_start_date', '');
  const [endDate, setEndDate] = useSessionState('filter_reports_end_date', '');
  const [productId, setProductId] = useSessionState('filter_reports_product', 'all');
  const [paymentMethod, setPaymentMethod] = useSessionState('filter_reports_payment', 'all');
  const [reportTab, setReportTab] = useSessionState('filter_reports_tab', 'sheet'); // 'sheet' | 'staff' | 'product' | 'both'
  const [staffViewMode, setStaffViewMode] = useState('sheet'); // 'sheet' | 'line_items'

  // Master lists
  const [staffList, setStaffList] = useState([]);
  const [productList, setProductList] = useState([]);

  // Data states
  const [data, setData] = useState(null); // Overall report data
  const [staffDetailData, setStaffDetailData] = useState(null); // Individual staff data

  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [error, setError] = useState(null);

  // Toggle for filtration panel across views
  const [showFilters, setShowFilters] = useState(false);

  // Bulk Excel Import Modal State
  const [showImportModal, setShowImportModal] = useState(false);

  // Clear Orders & Returns Confirmation State
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [clearing, setClearing] = useState(false);

  async function handleClearAll() {
    setClearing(true);
    try {
      const res = await api.delete('/orders/clear-all');
      setToastMessage(res.message || 'All orders, returns, and import history cleared successfully.');
      setShowClearConfirm(false);
      if (selectedStaffId === null) {
        fetchMainReport();
      } else {
        fetchStaffReport(selectedStaffId);
      }
    } catch (err) {
      setError(err.message || 'Failed to clear orders and returns');
    } finally {
      setClearing(false);
    }
  }

  function handleImportSuccess() {
    setPreset('all');
    if (selectedStaffId === null) {
      fetchMainReport({ preset: 'all', startDate: '', endDate: '' });
    } else {
      fetchStaffReport(selectedStaffId, { preset: 'all', startDate: '', endDate: '' });
    }
    setToastMessage('Orders successfully imported from Excel! Sales reports updated.');
    setTimeout(() => setToastMessage(''), 5000);
  }

  // Export Sheet Matrix as CSV
  function handleExportSheetCsv(customRows = null, filenamePrefix = 'Dynamic_Sales_Sheet') {
    const cols = (selectedStaffId === null ? data?.sheetColumns : staffDetailData?.sheetColumns) || [];
    const rows = customRows || (selectedStaffId === null ? filteredSheetRows : (staffDetailData?.sheetRows || []));
    if (!cols.length || !rows.length) return;

    const headerTitles = cols.map(c => `"${(c.label || '').replace(/"/g, '""')}"`).join(',');
    const rowLines = rows.map(r => {
      return cols.map(c => {
        let val = '';
        if (c.key === 'date') val = r.date || '';
        else if (c.key === 'employee_id') val = r.employee_id || '';
        else if (c.key === 'staff_name') val = r.staff_name || '';
        else if (c.type === 'product') val = r.quantities?.[c.key] || 0;
        else if (c.type === 'return') val = r.returns?.[c.key] || 0;
        else if (c.key === 'incentive') val = r.incentive || 0;
        else if (c.key === 'return_deductions') val = r.return_deductions || 0;
        else if (c.key === 'total_net') val = r.total_net || 0;
        return `"${String(val).replace(/"/g, '""')}"`;
      }).join(',');
    });

    const csvContent = [headerTitles, ...rowLines].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const periodStr = (data?.period?.startDate || startDate || 'all') + '_to_' + (data?.period?.endDate || endDate || '');
    a.download = `${filenamePrefix}_${periodStr}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // Sorting state for main tables
  const [staffSortField, setStaffSortField] = useState('net_sales');
  const [staffSortAsc, setStaffSortAsc] = useState(false);
  const [prodSortField, setProdSortField] = useState('net_sales');
  const [prodSortAsc, setProdSortAsc] = useState(false);

  // Quick keyword search within tables
  const [tableSearch, setTableSearch] = useState('');

  // Initial load: fetch master lists
  useEffect(() => {
    fetchFilterOptions();
  }, []);

  // Fetch report whenever active view or filters change
  useEffect(() => {
    if (selectedStaffId === null) {
      fetchMainReport();
    } else {
      setStaffDetailData(null);
      fetchStaffReport(selectedStaffId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedStaffId, preset, productId, paymentMethod]);

  async function fetchFilterOptions() {
    try {
      const [staffRes, prodRes] = await Promise.all([
        api.get('/staff'),
        api.get('/products')
      ]);
      setStaffList(staffRes.staff || []);
      setProductList(prodRes.products || []);
    } catch (err) {
      console.error('Failed to load filter options:', err);
    }
  }

  async function fetchMainReport(overrideDates = null) {
    setLoading(true);
    setError(null);
    try {
      let params = [];
      const curPreset = overrideDates?.preset || preset;
      params.push(`preset=${curPreset}`);

      const sDate = overrideDates ? overrideDates.startDate : startDate;
      const eDate = overrideDates ? overrideDates.endDate : endDate;
      if (sDate) params.push(`startDate=${sDate}`);
      if (eDate) params.push(`endDate=${eDate}`);

      if (productId !== 'all') params.push(`productId=${productId}`);
      if (paymentMethod !== 'all') params.push(`paymentMethod=${paymentMethod}`);

      const qs = params.length > 0 ? '?' + params.join('&') : '';
      const res = await api.get(`/reports/sales${qs}`);
      setData(res);

      if (res?.period && curPreset !== 'custom') {
        setStartDate(res.period.startDate);
        setEndDate(res.period.endDate);
      }
    } catch (err) {
      console.error('Failed to load sales report:', err);
      setError(err.message || 'Failed to load report data');
    } finally {
      setLoading(false);
    }
  }

  async function fetchStaffReport(targetStaffId, overrideDates = null) {
    setLoading(true);
    setError(null);
    try {
      let params = [];
      const curPreset = overrideDates?.preset || preset;
      params.push(`preset=${curPreset}`);

      const sDate = overrideDates ? overrideDates.startDate : startDate;
      const eDate = overrideDates ? overrideDates.endDate : endDate;
      if (sDate) params.push(`startDate=${sDate}`);
      if (eDate) params.push(`endDate=${eDate}`);

      if (productId !== 'all') params.push(`productId=${productId}`);
      if (paymentMethod !== 'all') params.push(`paymentMethod=${paymentMethod}`);

      const qs = params.length > 0 ? '?' + params.join('&') : '';
      const res = await api.get(`/reports/sales/staff/${targetStaffId}${qs}`);
      setStaffDetailData(res);

      if (res?.period && curPreset !== 'custom') {
        setStartDate(res.period.startDate);
        setEndDate(res.period.endDate);
      }
    } catch (err) {
      console.error('Failed to load individual staff report:', err);
      setError(err.message || 'Failed to load individual staff report');
    } finally {
      setLoading(false);
    }
  }

  function handlePresetSelect(pId) {
    setPreset(pId);
    if (pId !== 'custom') {
      const override = { preset: pId, startDate: '', endDate: '' };
      if (selectedStaffId === null) {
        fetchMainReport(override);
      } else {
        fetchStaffReport(selectedStaffId, override);
      }
    }
  }

  function handleApplyFilters(e) {
    if (e) e.preventDefault();
    const override = { preset, startDate, endDate };
    if (selectedStaffId === null) {
      fetchMainReport(override);
    } else {
      fetchStaffReport(selectedStaffId, override);
    }
  }

  function handleResetFilters() {
    setPreset('this_month');
    setProductId('all');
    setPaymentMethod('all');
    setTableSearch('');
    const override = { preset: 'this_month', startDate: '', endDate: '' };
    if (selectedStaffId === null) {
      fetchMainReport(override);
    } else {
      fetchStaffReport(selectedStaffId, override);
    }
  }

  async function handleExportExcel(targetStaffId = null) {
    setExporting(true);
    try {
      let params = [];
      params.push(`preset=${preset}`);
      if (startDate) params.push(`startDate=${startDate}`);
      if (endDate) params.push(`endDate=${endDate}`);
      if (productId !== 'all') params.push(`productId=${productId}`);
      if (paymentMethod !== 'all') params.push(`paymentMethod=${paymentMethod}`);

      const effectiveStaff = targetStaffId !== null ? targetStaffId : selectedStaffId;
      if (effectiveStaff) {
        params.push(`staffId=${effectiveStaff}`);
      }

      const qs = params.length > 0 ? '?' + params.join('&') : '';
      const token = localStorage.getItem('sales_token');

      const response = await fetch(`/api/reports/sales/export-excel${qs}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        const errJson = await response.json().catch(() => ({}));
        throw new Error(errJson.error || 'Failed to generate Excel report');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;

      let downloadFilename = 'Overall_Sales_Report.xlsx';
      if (effectiveStaff) {
        const staffObj = staffList.find(s => String(s.id) === String(effectiveStaff) || String(s.staff_id) === String(effectiveStaff))
          || (staffDetailData?.staff?.id === effectiveStaff || staffDetailData?.staff?.staff_id === effectiveStaff ? staffDetailData.staff : null);
        if (staffObj && staffObj.name) {
          downloadFilename = `Sales_Report_${staffObj.name.trim().replace(/[^a-zA-Z0-9_-]/g, '_')}.xlsx`;
        }
      }

      const disposition = response.headers.get('content-disposition');
      if (disposition) {
        const match = disposition.match(/filename="?([^";]+)"?/i);
        if (match && match[1]) {
          downloadFilename = match[1];
        }
      }

      a.download = downloadFilename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      setToastMessage(`Excel report (${downloadFilename}) downloaded successfully!`);
      setTimeout(() => setToastMessage(''), 4500);
    } catch (err) {
      alert('Excel export failed: ' + err.message);
    } finally {
      setExporting(false);
    }
  }

  // Sorting for Staff Table on Main Page
  const sortedStaff = [...(data?.staffReport || [])].filter(s => {
    if (!tableSearch.trim()) return true;
    const q = tableSearch.toLowerCase();
    return s.staff_name.toLowerCase().includes(q) || (s.staff_code && s.staff_code.toLowerCase().includes(q));
  }).sort((a, b) => {
    const getVal = (item, field) => {
      if (field === 'total_returns' || field === 'returns' || field === 'returned_quantity') {
        return item.returned_quantity ?? item.total_returns ?? item.returns ?? 0;
      }
      return item[field] ?? 0;
    };
    const valA = getVal(a, staffSortField);
    const valB = getVal(b, staffSortField);
    if (typeof valA === 'string') {
      return staffSortAsc ? valA.localeCompare(valB) : valB.localeCompare(valA);
    }
    return staffSortAsc ? valA - valB : valB - valA;
  });

  // Sorting for Product Table
  const sortedProducts = [...(data?.productReport || [])].filter(p => {
    if (!tableSearch.trim()) return true;
    const q = tableSearch.toLowerCase();
    return p.product_name.toLowerCase().includes(q) || (p.product_code && p.product_code.toLowerCase().includes(q));
  }).sort((a, b) => {
    const valA = a[prodSortField] ?? 0;
    const valB = b[prodSortField] ?? 0;
    if (typeof valA === 'string') {
      return prodSortAsc ? valA.localeCompare(valB) : valB.localeCompare(valA);
    }
    return prodSortAsc ? valA - valB : valB - valA;
  });

  function toggleStaffSort(field) {
    if (staffSortField === field) {
      setStaffSortAsc(!staffSortAsc);
    } else {
      setStaffSortField(field);
      setStaffSortAsc(false);
    }
  }

  function toggleProdSort(field) {
    if (prodSortField === field) {
      setProdSortAsc(!prodSortAsc);
    } else {
      setProdSortField(field);
      setProdSortAsc(false);
    }
  }

  const summary = data?.summary || {
    total_orders: 0,
    gross_sales: 0,
    total_returns: 0,
    net_sales: 0,
    ordered_quantity: 0,
    returned_quantity: 0,
    net_quantity: 0,
    total_incentives: 0
  };

  const hasActiveFilters = preset !== 'this_month' || productId !== 'all' || paymentMethod !== 'all' || tableSearch;
  const activeFilterCount = (preset !== 'this_month' ? 1 : 0) + (productId !== 'all' ? 1 : 0) + (paymentMethod !== 'all' ? 1 : 0);
  const activePeriodLabel = PRESETS.find(p => p.id === preset)?.label || (startDate && endDate ? `${startDate} to ${endDate}` : 'Custom Period');

  const filteredSheetRows = (data?.sheetRows || []).filter(r => {
    if (!tableSearch.trim()) return true;
    const term = tableSearch.toLowerCase();
    return (
      (r.employee_id && r.employee_id.toLowerCase().includes(term)) ||
      (r.staff_name && r.staff_name.toLowerCase().includes(term)) ||
      (r.date && r.date.includes(term))
    );
  });

  const sheetTotals = filteredSheetRows.reduce((acc, r) => {
    for (const col of (data?.sheetColumns || [])) {
      if (col.type === 'product') {
        acc[col.key] = (acc[col.key] || 0) + (r.quantities?.[col.key] || 0);
      } else if (col.type === 'return') {
        acc[col.key] = (acc[col.key] || 0) + (r.returns?.[col.key] || 0);
      } else if (col.key === 'incentive') {
        acc.incentive = (acc.incentive || 0) + (r.incentive || 0);
      } else if (col.key === 'return_deductions') {
        acc.return_deductions = (acc.return_deductions || 0) + (r.return_deductions || 0);
      } else if (col.key === 'total_net') {
        acc.total_net = (acc.total_net || 0) + (r.total_net || 0);
      }
    }
    return acc;
  }, {});

  // =========================================================================
  // VIEW 1: INDIVIDUAL STAFF SALES REPORT (Following IncentiveRecords Pattern)
  // =========================================================================
  if (selectedStaffId !== null) {
    const currentStaffFromList = staffList.find(
      s => String(s.id) === String(selectedStaffId) || String(s.staff_id) === String(selectedStaffId)
    );
    const staff = staffDetailData?.staff || currentStaffFromList;
    const period = staffDetailData?.period;
    const periodLabel = period?.label || PRESETS.find(p => p.id === preset)?.label || (startDate && endDate ? `${startDate} to ${endDate}` : 'Current Period');
    const ordersSummary = staffDetailData?.ordersSummary || { total_orders: 0, total_order_amount: 0, ordered_quantity: 0 };
    const returnsSummary = staffDetailData?.returnsSummary || { total_returns: 0, total_refunded_amount: 0, returned_quantity: 0 };
    const ordersList = staffDetailData?.orders || [];
    const returnsList = staffDetailData?.returns || [];

    const staffSheetRows = staffDetailData?.sheetRows || [];
    const staffSheetColumns = staffDetailData?.sheetColumns || data?.sheetColumns || [];
    const staffSheetTotals = staffSheetRows.reduce((acc, r) => {
      for (const col of staffSheetColumns) {
        if (col.type === 'product') {
          acc[col.key] = (acc[col.key] || 0) + (r.quantities?.[col.key] || 0);
        } else if (col.type === 'return') {
          acc[col.key] = (acc[col.key] || 0) + (r.returns?.[col.key] || 0);
        } else if (col.key === 'incentive') {
          acc.incentive = (acc.incentive || 0) + (r.incentive || 0);
        } else if (col.key === 'return_deductions') {
          acc.return_deductions = (acc.return_deductions || 0) + (r.return_deductions || 0);
        } else if (col.key === 'total_net') {
          acc.total_net = (acc.total_net || 0) + (r.total_net || 0);
        }
      }
      return acc;
    }, {});

    return (
      <div className="page-body">
        {/* Toast Notification */}
        {toastMessage && (
          <div className="toast-container">
            <div className="toast success">
              <CheckCircle2 size={18} color="var(--success-solid)" />
              <span>{toastMessage}</span>
            </div>
          </div>
        )}

        {/* Error Alert */}
        {error && (
          <div style={{ marginBottom: '16px', padding: '12px 16px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', color: '#b91c1c', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <AlertCircle size={18} />
            <span style={{ fontSize: '13px', fontWeight: 500 }}>{error}</span>
            <button type="button" className="btn btn-sm btn-secondary" style={{ marginLeft: 'auto', padding: '4px 10px', fontSize: '12px' }} onClick={() => fetchStaffReport(selectedStaffId)}>
              Retry
            </button>
          </div>
        )}

        {/* Header with Back Action */}
        <div className="page-header" style={{ marginBottom: '16px', flexWrap: 'wrap', gap: '14px' }}>
          <div>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => {
                setSelectedStaffId(null);
                setError(null);
              }}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', marginBottom: '8px', padding: '6px 12px', fontWeight: 600 }}
            >
              <ArrowLeft size={14} />
              <span>Back to Sales Reports</span>
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              <div
                style={{
                  width: '38px',
                  height: '38px',
                  borderRadius: '10px',
                  background: 'linear-gradient(135deg, var(--primary-600), #2563eb)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'white',
                  boxShadow: '0 3px 10px rgba(37, 99, 235, 0.22)'
                }}
              >
                <Users size={20} />
              </div>
              <h2 className="page-title" style={{ margin: 0, fontSize: '22px' }}>
                {staff?.name || 'Staff Member'}
              </h2>
              {staff?.staff_id && (
                <span className="badge badge-neutral" style={{ fontSize: '12px', padding: '4px 8px' }}>
                  {staff.staff_id}
                </span>
              )}
              <span className="badge badge-info" style={{ fontSize: '11.5px', padding: '4px 8px' }}>
                {periodLabel} {period ? `(${period.startDate} to ${period.endDate})` : (startDate && endDate ? `(${startDate} to ${endDate})` : '')}
              </span>
            </div>
          </div>

          {/* Action: Filtration Toggle & Export Individual Staff Excel */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <button
              type="button"
              className={`btn ${showFilters ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setShowFilters(!showFilters)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '9px 15px',
                fontWeight: 600,
                fontSize: '13px'
              }}
            >
              <Filter size={15} />
              <span>Filtration</span>
              {activeFilterCount > 0 && (
                <span
                  style={{
                    background: showFilters ? '#ffffff' : 'var(--primary-600)',
                    color: showFilters ? 'var(--primary-600)' : '#ffffff',
                    borderRadius: '10px',
                    fontSize: '11px',
                    fontWeight: 700,
                    padding: '1px 6px',
                    marginLeft: '2px'
                  }}
                >
                  {activeFilterCount}
                </span>
              )}
              <ChevronDown
                size={14}
                style={{
                  transform: showFilters ? 'rotate(180deg)' : 'none',
                  transition: 'transform 0.2s ease'
                }}
              />
            </button>

            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setShowImportModal(true)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                borderColor: '#10b981',
                color: '#047857',
                background: '#ecfdf5',
                padding: '9px 15px',
                fontWeight: 600,
                fontSize: '13px'
              }}
              title="Upload an Excel sheet to bulk update existing staff orders"
            >
              <FileSpreadsheet size={16} />
              <span>Import Orders (Excel)</span>
            </button>

            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setShowClearConfirm(true)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                borderColor: '#fca5a5',
                color: '#b91c1c',
                background: '#fef2f2',
                padding: '9px 15px',
                fontWeight: 600,
                fontSize: '13px'
              }}
              title="Clear all orders and returns from database to start fresh"
            >
              <RotateCcw size={15} />
              <span>Clear Orders & Returns</span>
            </button>

            <button
              type="button"
              className="btn btn-primary"
              onClick={() => handleExportExcel(selectedStaffId)}
              disabled={exporting || loading}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                background: 'linear-gradient(135deg, #10b981, #059669)',
                borderColor: '#059669',
                padding: '9px 16px',
                fontWeight: 600,
                boxShadow: '0 2px 8px rgba(16, 185, 129, 0.25)'
              }}
            >
              {exporting ? (
                <>
                  <RefreshCw size={16} className="spin" />
                  <span>Exporting...</span>
                </>
              ) : (
                <>
                  <FileSpreadsheet size={16} />
                  <span>Export Excel (.xlsx)</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Compact Applied Filtration Pill Bar (when collapsed) */}
        {!showFilters && (
          <div className="filter-pill-bar">
            <div className="filter-pill-items">
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                <Filter size={13} color="var(--primary-600)" /> Active Filters:
              </span>
              <span className="badge badge-info" style={{ fontSize: '11.5px' }}>
                Period: {activePeriodLabel}
              </span>
              {productId !== 'all' && (
                <span className="badge badge-neutral" style={{ fontSize: '11.5px' }}>
                  Product: {productList.find(p => String(p.id) === String(productId))?.name || productId}
                </span>
              )}
              {paymentMethod !== 'all' && (
                <span className="badge badge-neutral" style={{ fontSize: '11.5px' }}>
                  Payment: {paymentMethod}
                </span>
              )}
            </div>
            <div className="filter-pill-actions">
              <button
                type="button"
                className="btn btn-sm btn-outline"
                onClick={() => setShowFilters(true)}
                style={{ fontSize: '11.5px', padding: '5px 12px', height: 'auto' }}
              >
                Change Filters ▾
              </button>
              {hasActiveFilters && (
                <button
                  type="button"
                  className="btn btn-sm btn-ghost"
                  onClick={handleResetFilters}
                  style={{ fontSize: '11.5px', padding: '5px 10px', color: '#dc2626', height: 'auto' }}
                  title="Reset to default filters"
                >
                  <RotateCcw size={12} style={{ marginRight: '4px' }} /> Reset
                </button>
              )}
            </div>
          </div>
        )}

        {/* Filter Section Card (Preserved & Reactive - visible when showFilters is true) */}
        {showFilters && (
          <div className="filter-card">
            <div className="filter-card-header">
              <div className="filter-title-wrap">
                <div className="filter-icon-box">
                  <Filter size={15} />
                </div>
                <strong className="filter-title">Staff Report Filtration</strong>
                <span className="filter-desc">
                  (Filters apply directly to {staff?.name || 'selected staff'})
                </span>
              </div>
              <button
                type="button"
                className="filter-hide-btn"
                onClick={() => setShowFilters(false)}
              >
                <X size={14} /> Hide
              </button>
            </div>

            <form onSubmit={handleApplyFilters} className="filter-body">
              {/* Row 1: Date Range Presets */}
              <div className="filter-field">
                <span className="filter-field-label">Period Presets</span>
                <div className="filter-presets-group">
                  {PRESETS.map(p => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => handlePresetSelect(p.id)}
                      className={`btn btn-sm ${preset === p.id ? 'btn-primary' : 'btn-secondary'}`}
                      style={{
                        borderRadius: 'var(--radius-sm)'
                      }}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Row 2: Custom Dates + Optional Product & Payment Filters */}
              <div className="filter-row">
                <div className="filter-fields-wrap">
                  {preset === 'custom' && (
                    <>
                      <div className="filter-field">
                        <span className="filter-field-label">From Date</span>
                        <input
                          type="date"
                          className="form-control"
                          value={startDate}
                          onChange={e => setStartDate(e.target.value)}
                          required
                        />
                      </div>
                      <div className="filter-field">
                        <span className="filter-field-label">To Date</span>
                        <input
                          type="date"
                          className="form-control"
                          value={endDate}
                          onChange={e => setEndDate(e.target.value)}
                          required
                        />
                      </div>
                    </>
                  )}

                  {/* Product Filter */}
                  <div className="filter-field">
                    <span className="filter-field-label">Product</span>
                    <select
                      className="form-control"
                      value={productId}
                      onChange={e => setProductId(e.target.value)}
                    >
                      <option value="all">All Products</option>
                      {productList.map(p => (
                        <option key={p.id} value={p.id}>
                          {p.name} ({p.code})
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* Payment Method Filter */}
                  <div className="filter-field">
                    <span className="filter-field-label">Payment</span>
                    <select
                      className="form-control"
                      value={paymentMethod}
                      onChange={e => setPaymentMethod(e.target.value)}
                    >
                      <option value="all">All Methods</option>
                      <option value="Prepaid">Prepaid</option>
                      <option value="COD">COD</option>
                    </select>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="filter-actions-row">
                  <button
                    type="submit"
                    className="btn btn-primary btn-sm"
                    style={{ minHeight: '36px', padding: '0 16px' }}
                  >
                    Apply Filters
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={handleResetFilters}
                    style={{ minHeight: '36px', padding: '0 14px' }}
                    title="Reset all filters"
                  >
                    <X size={13} style={{ marginRight: '4px' }} /> Reset
                  </button>
                </div>
              </div>
            </form>
          </div>
        )}

        {/* Orders & Returns Summary Cards */}
        <div className="staff-summary-cards-grid">
          {/* Orders Summary Card */}
          <div className="table-card" style={{ padding: '16px 20px', borderLeft: '4px solid #2563eb', marginBottom: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
              <div style={{ width: '28px', height: '28px', borderRadius: '6px', background: '#eff6ff', color: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <ShoppingCart size={16} />
              </div>
              <strong style={{ fontSize: '14px', color: '#1e40af' }}>Orders Summary</strong>
            </div>
            <div className="staff-summary-metrics-grid">
              <div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Total Orders</div>
                <div style={{ fontSize: '20px', fontWeight: 700, color: '#1e293b', marginTop: '2px' }}>
                  {loading ? '...' : ordersSummary.total_orders}
                </div>
              </div>
              <div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Total Order Amount</div>
                <div style={{ fontSize: '20px', fontWeight: 700, color: '#b45309', marginTop: '2px' }}>
                  {loading ? '...' : `₹${ordersSummary.total_order_amount?.toLocaleString()}`}
                </div>
              </div>
              <div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Total Products Ordered</div>
                <div style={{ fontSize: '20px', fontWeight: 700, color: '#2563eb', marginTop: '2px' }}>
                  {loading ? '...' : `${ordersSummary.ordered_quantity} units`}
                </div>
              </div>
            </div>
          </div>

          {/* Returns Summary Card */}
          <div className="table-card" style={{ padding: '16px 20px', borderLeft: '4px solid #dc2626', marginBottom: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
              <div style={{ width: '28px', height: '28px', borderRadius: '6px', background: '#fef2f2', color: '#dc2626', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <RotateCcw size={16} />
              </div>
              <strong style={{ fontSize: '14px', color: '#991b1b' }}>Returns Summary</strong>
            </div>
            <div className="staff-summary-metrics-grid">
              <div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Total Returns</div>
                <div style={{ fontSize: '20px', fontWeight: 700, color: '#1e293b', marginTop: '2px' }}>
                  {loading ? '...' : returnsSummary.total_returns}
                </div>
              </div>
              <div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Total Refunded Amount</div>
                <div style={{ fontSize: '20px', fontWeight: 700, color: '#dc2626', marginTop: '2px' }}>
                  {loading ? '...' : `₹${returnsSummary.total_refunded_amount?.toLocaleString()}`}
                </div>
              </div>
              <div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Total Returned Quantity</div>
                <div style={{ fontSize: '20px', fontWeight: 700, color: '#dc2626', marginTop: '2px' }}>
                  {loading ? '...' : `${returnsSummary.returned_quantity} units`}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Detail View Mode Selector */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
          <div style={{ display: 'inline-flex', background: '#f1f5f9', padding: '4px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
            <button
              type="button"
              onClick={() => setStaffViewMode('sheet')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 14px',
                borderRadius: 'var(--radius-sm)',
                border: 'none',
                background: staffViewMode === 'sheet' ? '#ffffff' : 'transparent',
                color: staffViewMode === 'sheet' ? '#047857' : 'var(--text-muted)',
                fontWeight: staffViewMode === 'sheet' ? 700 : 500,
                boxShadow: staffViewMode === 'sheet' ? 'var(--shadow-xs)' : 'none',
                cursor: 'pointer',
                fontSize: '13px'
              }}
            >
              <FileSpreadsheet size={14} />
              <span>Dynamic Sheet View ({staffSheetRows.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setStaffViewMode('line_items')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 14px',
                borderRadius: 'var(--radius-sm)',
                border: 'none',
                background: staffViewMode === 'line_items' ? '#ffffff' : 'transparent',
                color: staffViewMode === 'line_items' ? 'var(--primary-700)' : 'var(--text-muted)',
                fontWeight: staffViewMode === 'line_items' ? 700 : 500,
                boxShadow: staffViewMode === 'line_items' ? 'var(--shadow-xs)' : 'none',
                cursor: 'pointer',
                fontSize: '13px'
              }}
            >
              <ShoppingCart size={14} />
              <span>Line Items ({ordersList.length} Orders, {returnsList.length} Returns)</span>
            </button>
          </div>
        </div>

        {staffViewMode === 'sheet' ? (
          <DynamicSheetTable
            columns={staffSheetColumns}
            rows={staffSheetRows}
            totals={staffSheetTotals}
            onExportCsv={() => handleExportSheetCsv(staffSheetRows, `Sales_Sheet_${staff?.name?.replace(/\s+/g, '_') || 'Staff'}`)}
            loading={loading}
            title={`Dynamic Sheet View - ${staff?.name || 'Staff Member'}`}
          />
        ) : (
          <>
            {/* Section 1: Orders Table */}
            <div className="table-card" style={{ marginBottom: '24px' }}>
          <div className="table-toolbar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ width: '26px', height: '26px', borderRadius: '6px', background: '#eff6ff', color: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <ShoppingCart size={15} />
              </div>
              <strong style={{ fontSize: '14px' }}>Orders Table</strong>
              <span className="badge badge-info" style={{ fontSize: '11px' }}>
                {ordersList.length} orders
              </span>
            </div>
          </div>

          {/* Desktop Table View */}
          <div className="responsive-table-view">
            <div className="table-responsive">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Order ID</th>
                    <th>Order Date</th>
                    <th>Product</th>
                    <th style={{ textAlign: 'center' }}>Quantity</th>
                    <th>Payment Method</th>
                    <th style={{ textAlign: 'right' }}>Unit Price</th>
                    <th style={{ textAlign: 'right' }}>Order Amount</th>
                    <th>Order Status</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan="8" style={{ textAlign: 'center', padding: '28px', color: 'var(--text-muted)' }}>
                        Loading orders...
                      </td>
                    </tr>
                  ) : ordersList.length === 0 ? (
                    <tr>
                      <td colSpan="8">
                        <div className="empty-state" style={{ padding: '24px' }}>
                          <div className="empty-state-icon"><ShoppingCart size={22} /></div>
                          <div className="empty-state-title">No orders found</div>
                          <div className="empty-state-desc">No sales orders placed by this staff member in the selected period.</div>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    ordersList.map(o => (
                      <tr key={o.id}>
                        <td style={{ fontWeight: 600 }}>{o.order_number}</td>
                        <td>{o.order_date}</td>
                        <td>{o.product_name}</td>
                        <td style={{ textAlign: 'center', fontWeight: 600 }}>{o.quantity}</td>
                        <td>
                          <span className={`badge ${o.payment_method === 'Prepaid' ? 'badge-info' : 'badge-neutral'}`} style={{ fontSize: '10.5px' }}>
                            {o.payment_method}
                          </span>
                        </td>
                        <td style={{ textAlign: 'right' }}>₹{o.unit_price?.toLocaleString()}</td>
                        <td style={{ textAlign: 'right', fontWeight: 600, color: '#b45309' }}>
                          ₹{o.order_amount?.toLocaleString()}
                        </td>
                        <td>
                          <span className="badge badge-success" style={{ fontSize: '10.5px' }}>{o.status}</span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
                {ordersList.length > 0 && (
                  <tfoot>
                    <tr style={{ background: '#f8fafc', fontWeight: 700 }}>
                      <td>Total ({ordersList.length} orders)</td>
                      <td colSpan="2"></td>
                      <td style={{ textAlign: 'center' }}>{ordersSummary.ordered_quantity}</td>
                      <td colSpan="2"></td>
                      <td style={{ textAlign: 'right', color: '#b45309' }}>₹{ordersSummary.total_order_amount?.toLocaleString()}</td>
                      <td></td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>

          {/* Mobile Card View */}
          <div className="responsive-card-view">
            {loading ? (
              <div style={{ textAlign: 'center', padding: '28px', color: 'var(--text-muted)' }}>Loading orders...</div>
            ) : ordersList.length === 0 ? (
              <div className="empty-state" style={{ padding: '24px' }}>
                <div className="empty-state-icon"><ShoppingCart size={22} /></div>
                <div className="empty-state-title">No orders found</div>
                <div className="empty-state-desc">No sales orders placed by this staff member in the selected period.</div>
              </div>
            ) : (
              ordersList.map(o => (
                <div key={o.id} className="mobile-data-card">
                  <div className="mobile-card-header">
                    <div className="mobile-card-title-group">
                      <span className="mobile-card-id">{o.order_number}</span>
                      <span className="mobile-card-date">{o.order_date}</span>
                    </div>
                    <span className="badge badge-success" style={{ fontSize: '11px' }}>{o.status}</span>
                  </div>

                  <div className="mobile-card-grid">
                    <div className="mobile-card-item" style={{ gridColumn: 'span 2' }}>
                      <span className="mobile-card-label">Product</span>
                      <span className="mobile-card-val">{o.product_name}</span>
                    </div>
                    <div className="mobile-card-item">
                      <span className="mobile-card-label">Quantity</span>
                      <span className="mobile-card-val">{o.quantity} units</span>
                    </div>
                    <div className="mobile-card-item">
                      <span className="mobile-card-label">Payment</span>
                      <span className={`badge ${o.payment_method === 'Prepaid' ? 'badge-info' : 'badge-neutral'}`} style={{ display: 'inline-block', width: 'fit-content' }}>
                        {o.payment_method}
                      </span>
                    </div>
                    <div className="mobile-card-item">
                      <span className="mobile-card-label">Unit Price</span>
                      <span className="mobile-card-val">₹{o.unit_price?.toLocaleString()}</span>
                    </div>
                    <div className="mobile-card-item">
                      <span className="mobile-card-label">Order Amount</span>
                      <span className="mobile-card-val" style={{ fontWeight: 700, color: '#b45309' }}>
                        ₹{o.order_amount?.toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Section 2: Returns Table */}
        <div className="table-card">
          <div className="table-toolbar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ width: '26px', height: '26px', borderRadius: '6px', background: '#fef2f2', color: '#dc2626', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <RotateCcw size={15} />
              </div>
              <strong style={{ fontSize: '14px' }}>Returns Table</strong>
              <span className="badge badge-neutral" style={{ fontSize: '11px' }}>
                {returnsList.length} returns
              </span>
            </div>
          </div>

          {/* Desktop Table View */}
          <div className="responsive-table-view">
            <div className="table-responsive">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Return ID</th>
                    <th>Return Date</th>
                    <th>Product</th>
                    <th style={{ textAlign: 'center' }}>Returned Quantity</th>
                    <th style={{ textAlign: 'right' }}>Refund Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan="5" style={{ textAlign: 'center', padding: '28px', color: 'var(--text-muted)' }}>
                        Loading returns...
                      </td>
                    </tr>
                  ) : returnsList.length === 0 ? (
                    <tr>
                      <td colSpan="5">
                        <div className="empty-state" style={{ padding: '24px' }}>
                          <div className="empty-state-icon"><RotateCcw size={22} /></div>
                          <div className="empty-state-title">No returns recorded</div>
                          <div className="empty-state-desc">No product returns recorded against this staff member in the selected period.</div>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    returnsList.map(r => (
                      <tr key={r.id}>
                        <td style={{ fontWeight: 600 }}>{r.return_number}</td>
                        <td>{r.return_date}</td>
                        <td>{r.product_name}</td>
                        <td style={{ textAlign: 'center', fontWeight: 600, color: '#dc2626' }}>
                          {r.return_quantity}
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: 600, color: '#dc2626' }}>
                          ₹{r.return_amount?.toLocaleString()}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
                {returnsList.length > 0 && (
                  <tfoot>
                    <tr style={{ background: '#f8fafc', fontWeight: 700 }}>
                      <td>Total ({returnsList.length} returns)</td>
                      <td colSpan="2"></td>
                      <td style={{ textAlign: 'center', color: '#dc2626' }}>{returnsSummary.returned_quantity}</td>
                      <td style={{ textAlign: 'right', color: '#dc2626' }}>₹{returnsSummary.total_refunded_amount?.toLocaleString()}</td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>

          {/* Mobile Card View */}
          <div className="responsive-card-view">
            {loading ? (
              <div style={{ textAlign: 'center', padding: '28px', color: 'var(--text-muted)' }}>Loading returns...</div>
            ) : returnsList.length === 0 ? (
              <div className="empty-state" style={{ padding: '24px' }}>
                <div className="empty-state-icon"><RotateCcw size={22} /></div>
                <div className="empty-state-title">No returns recorded</div>
                <div className="empty-state-desc">No product returns recorded against this staff member in the selected period.</div>
              </div>
            ) : (
              returnsList.map(r => (
                <div key={r.id} className="mobile-data-card">
                  <div className="mobile-card-header">
                    <div className="mobile-card-title-group">
                      <span className="mobile-card-id" style={{ color: '#dc2626' }}>{r.return_number}</span>
                      <span className="mobile-card-date">{r.return_date}</span>
                    </div>
                  </div>

                  <div className="mobile-card-grid">
                    <div className="mobile-card-item" style={{ gridColumn: 'span 2' }}>
                      <span className="mobile-card-label">Product</span>
                      <span className="mobile-card-val">{r.product_name}</span>
                    </div>
                    <div className="mobile-card-item">
                      <span className="mobile-card-label">Returned Quantity</span>
                      <span className="mobile-card-val" style={{ color: '#dc2626', fontWeight: 600 }}>{r.return_quantity} units</span>
                    </div>
                    <div className="mobile-card-item">
                      <span className="mobile-card-label">Refund Amount</span>
                      <span className="mobile-card-val" style={{ color: '#dc2626', fontWeight: 700 }}>₹{r.return_amount?.toLocaleString()}</span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
          </>
        )}
        {/* Bulk Order Import Modal */}
        <BulkOrderImportModal
          isOpen={showImportModal}
          onClose={() => setShowImportModal(false)}
          onImportSuccess={handleImportSuccess}
        />

        {/* Clear Orders & Returns Confirmation Modal */}
        <ClearConfirmModal
          isOpen={showClearConfirm}
          onClose={() => setShowClearConfirm(false)}
          onConfirm={handleClearAll}
          clearing={clearing}
        />
      </div>
    );
  }

  // =========================================================================
  // VIEW 2: MAIN SALES REPORTS PAGE (Overall View with Clickable Staff Rows)
  // =========================================================================
  return (
    <div className="page-body">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="toast-container">
          <div className="toast success">
            <CheckCircle2 size={18} color="var(--success-solid)" />
            <span>{toastMessage}</span>
          </div>
        </div>
      )}

      {/* Error Alert */}
      {error && (
        <div style={{ marginBottom: '16px', padding: '12px 16px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', color: '#b91c1c', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <AlertCircle size={18} />
          <span style={{ fontSize: '13px', fontWeight: 500 }}>{error}</span>
          <button type="button" className="btn btn-sm btn-secondary" style={{ marginLeft: 'auto', padding: '4px 10px', fontSize: '12px' }} onClick={() => fetchMainReport()}>
            Retry
          </button>
        </div>
      )}

      {/* Header */}
      <div className="page-header" style={{ marginBottom: '16px', flexWrap: 'wrap', gap: '14px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div
            style={{
              width: '46px',
              height: '46px',
              borderRadius: '12px',
              background: 'linear-gradient(135deg, var(--primary-600), #2563eb)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'white',
              boxShadow: '0 4px 12px rgba(37, 99, 235, 0.22)',
              flexShrink: 0
            }}
          >
            <BarChart3 size={24} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <h2 className="page-title" style={{ margin: 0, fontSize: '22px' }}>Sales Reports</h2>
              <span className="badge badge-info" style={{ fontSize: '11px', padding: '3px 8px' }}>
                Brand Manager Analytics
              </span>
              {data?.period && (
                <span className="badge badge-neutral" style={{ fontSize: '11px', padding: '3px 8px' }}>
                  {data.period.label} ({data.period.startDate} to {data.period.endDate})
                </span>
              )}
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
              Sales performance, products, returns, and individual staff reports
            </div>
          </div>
        </div>

        {/* Action Button: Export Overall Excel (.xlsx) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <button
            type="button"
            className={`btn ${showFilters ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setShowFilters(!showFilters)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '9px 15px',
              fontWeight: 600,
              fontSize: '13px'
            }}
          >
            <Filter size={15} />
            <span>Filtration</span>
            {activeFilterCount > 0 && (
              <span
                style={{
                  background: showFilters ? '#ffffff' : 'var(--primary-600)',
                  color: showFilters ? 'var(--primary-600)' : '#ffffff',
                  borderRadius: '10px',
                  fontSize: '11px',
                  fontWeight: 700,
                  padding: '1px 6px',
                  marginLeft: '2px'
                }}
              >
                {activeFilterCount}
              </span>
            )}
            <ChevronDown
              size={14}
              style={{
                transform: showFilters ? 'rotate(180deg)' : 'none',
                transition: 'transform 0.2s ease'
              }}
            />
          </button>

          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => setShowImportModal(true)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              borderColor: '#10b981',
              color: '#047857',
              background: '#ecfdf5',
              padding: '9px 15px',
              fontWeight: 600,
              fontSize: '13px'
            }}
            title="Upload an Excel sheet to bulk update existing staff orders"
          >
            <FileSpreadsheet size={16} />
            <span>Import Orders (Excel)</span>
          </button>

          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => setShowClearConfirm(true)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              borderColor: '#fca5a5',
              color: '#b91c1c',
              background: '#fef2f2',
              padding: '9px 15px',
              fontWeight: 600,
              fontSize: '13px'
            }}
            title="Clear all orders and returns from database to start fresh"
          >
            <RotateCcw size={15} />
            <span>Clear Orders & Returns</span>
          </button>

          <button
            type="button"
            className="btn btn-primary"
            onClick={() => handleExportExcel(null)}
            disabled={exporting || loading}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              background: 'linear-gradient(135deg, #10b981, #059669)',
              borderColor: '#059669',
              padding: '9px 16px',
              fontWeight: 600,
              boxShadow: '0 2px 8px rgba(16, 185, 129, 0.25)'
            }}
          >
            {exporting ? (
              <>
                <RefreshCw size={16} className="spin" />
                <span>Exporting Workbook...</span>
              </>
            ) : (
              <>
                <FileSpreadsheet size={16} />
                <span>Export Excel (.xlsx)</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Compact Applied Filtration Pill Bar (when collapsed) */}
      {!showFilters && (
        <div className="filter-pill-bar">
          <div className="filter-pill-items">
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontWeight: 600, color: 'var(--text-secondary)' }}>
              <Filter size={13} color="var(--primary-600)" /> Active Filters:
            </span>
            <span className="badge badge-info" style={{ fontSize: '11.5px' }}>
              Period: {activePeriodLabel}
            </span>
            {productId !== 'all' && (
              <span className="badge badge-neutral" style={{ fontSize: '11.5px' }}>
                Product: {productList.find(p => String(p.id) === String(productId))?.name || productId}
              </span>
            )}
            {paymentMethod !== 'all' && (
              <span className="badge badge-neutral" style={{ fontSize: '11.5px' }}>
                Payment: {paymentMethod}
              </span>
            )}
          </div>
          <div className="filter-pill-actions">
            <button
              type="button"
              className="btn btn-sm btn-outline"
              onClick={() => setShowFilters(true)}
              style={{ fontSize: '11.5px', padding: '5px 12px', height: 'auto' }}
            >
              Change Filters ▾
            </button>
            {hasActiveFilters && (
              <button
                type="button"
                className="btn btn-sm btn-ghost"
                onClick={handleResetFilters}
                style={{ fontSize: '11.5px', padding: '5px 10px', color: '#dc2626', height: 'auto' }}
                title="Reset to default filters"
              >
                <RotateCcw size={12} style={{ marginRight: '4px' }} /> Reset
              </button>
            )}
          </div>
        </div>
      )}

      {/* Dedicated Filtration Section Card (Visible when showFilters is true) */}
      {showFilters && (
        <div className="filter-card">
          <div className="filter-card-header">
            <div className="filter-title-wrap">
              <div className="filter-icon-box">
                <Filter size={15} />
              </div>
              <strong className="filter-title">Filtration</strong>
              <span className="filter-desc">
                (Select period and filters to compute sales figures)
              </span>
            </div>
            <button
              type="button"
              className="filter-hide-btn"
              onClick={() => setShowFilters(false)}
            >
              <X size={14} /> Hide
            </button>
          </div>

          <form onSubmit={handleApplyFilters} className="filter-body">
            {/* Row 1: Date Range Presets */}
            <div className="filter-field">
              <span className="filter-field-label">Period Presets</span>
              <div className="filter-presets-group">
                {PRESETS.map(p => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => handlePresetSelect(p.id)}
                    className={`btn btn-sm ${preset === p.id ? 'btn-primary' : 'btn-secondary'}`}
                    style={{
                      borderRadius: 'var(--radius-sm)'
                    }}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Row 2: Custom Date Inputs & Dropdown Filters */}
            <div className="filter-row">
              <div className="filter-fields-wrap">
                {/* Custom Date Pickers */}
                {preset === 'custom' && (
                  <>
                    <div className="filter-field">
                      <span className="filter-field-label">From Date</span>
                      <input
                        type="date"
                        className="form-control"
                        value={startDate}
                        onChange={e => setStartDate(e.target.value)}
                        required
                      />
                    </div>
                    <div className="filter-field">
                      <span className="filter-field-label">To Date</span>
                      <input
                        type="date"
                        className="form-control"
                        value={endDate}
                        onChange={e => setEndDate(e.target.value)}
                        required
                      />
                    </div>
                  </>
                )}

                {/* Product Filter */}
                <div className="filter-field">
                  <span className="filter-field-label">Product</span>
                  <select
                    className="form-control"
                    value={productId}
                    onChange={e => setProductId(e.target.value)}
                  >
                    <option value="all">All Products</option>
                    {productList.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.code})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Payment Method Filter */}
                <div className="filter-field">
                  <span className="filter-field-label">Payment</span>
                  <select
                    className="form-control"
                    value={paymentMethod}
                    onChange={e => setPaymentMethod(e.target.value)}
                  >
                    <option value="all">All Methods</option>
                    <option value="Prepaid">Prepaid</option>
                    <option value="COD">COD</option>
                  </select>
                </div>
              </div>

              {/* Action Buttons: Apply & Reset */}
              <div className="filter-actions-row">
                <button
                  type="submit"
                  className="btn btn-primary btn-sm"
                  style={{ minHeight: '36px', padding: '0 16px' }}
                >
                  Apply Filters
                </button>
                {hasActiveFilters && (
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={handleResetFilters}
                    style={{ minHeight: '36px', padding: '0 14px' }}
                    title="Reset all filters"
                  >
                    <X size={13} style={{ marginRight: '4px' }} /> Reset
                  </button>
                )}
              </div>
            </div>
          </form>
        </div>
      )}

      {/* 3. Executive Summary Figures */}
      <div style={{ marginBottom: '22px' }}>
        <div style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text-main)', marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '6px' }}>
          <TrendingUp size={16} color="var(--primary-600)" />
          <span>Product Quantity &amp; Incentive Summary</span>
        </div>

        <div className="kpi-grid sales-kpi-grid">
          {/* 1. Total Products Ordered (Quantity) */}
          <div className="kpi-card-premium" style={{ '--card-accent': '#8b5cf6' }}>
            <div className="kpi-header">
              <span className="kpi-title">Products Ordered (Qty)</span>
              <div className="kpi-icon-wrap" style={{ background: '#f5f3ff', color: '#7c3aed' }}>
                <Package size={18} />
              </div>
            </div>
            <div>
              <div className="kpi-value">{loading ? '...' : `${summary.ordered_quantity} units`}</div>
              <div className="kpi-subtext">Total units ordered</div>
            </div>
          </div>

          {/* 2. Total Returned Quantity */}
          <div className="kpi-card-premium" style={{ '--card-accent': '#ec4899' }}>
            <div className="kpi-header">
              <span className="kpi-title">Returned Quantity</span>
              <div className="kpi-icon-wrap" style={{ background: '#fdf2f8', color: '#db2777' }}>
                <RotateCcw size={18} />
              </div>
            </div>
            <div>
              <div className="kpi-value" style={{ color: summary.returned_quantity > 0 ? '#db2777' : 'var(--text-main)' }}>
                {loading ? '...' : `${summary.returned_quantity} units`}
              </div>
              <div className="kpi-subtext">Units returned</div>
            </div>
          </div>

          {/* 3. Net Product Quantity */}
          <div className="kpi-card-premium" style={{ '--card-accent': '#06b6d4' }}>
            <div className="kpi-header">
              <span className="kpi-title">Net Product Quantity</span>
              <div className="kpi-icon-wrap" style={{ background: '#cffafe', color: '#0891b2' }}>
                <PackageCheck size={18} />
              </div>
            </div>
            <div>
              <div className="kpi-value">{loading ? '...' : `${summary.net_quantity} units`}</div>
              <div className="kpi-subtext">Ordered − Returned units</div>
            </div>
          </div>

          {/* 4. Total Incentives */}
          <div className="kpi-card-premium" style={{ '--card-accent': '#10b981' }}>
            <div className="kpi-header">
              <span className="kpi-title">Total Net Incentives</span>
              <div className="kpi-icon-wrap" style={{ background: '#ecfdf5', color: '#059669' }}>
                <Award size={18} />
              </div>
            </div>
            <div>
              <div className="kpi-value" style={{ color: summary.total_incentives >= 0 ? '#059669' : '#dc2626' }}>
                {loading ? '...' : `₹${summary.total_incentives?.toLocaleString()}`}
              </div>
              <div className="kpi-subtext">
                Earned ₹{summary.earned_incentive} | Rev. -₹{summary.reversed_incentive}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Table Mode Selector & Table Search Toolbar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'inline-flex', background: '#f1f5f9', padding: '4px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)', flexWrap: 'wrap', gap: '4px' }}>
          <button
            type="button"
            onClick={() => setReportTab('sheet')}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 14px',
              borderRadius: 'var(--radius-sm)',
              border: 'none',
              background: reportTab === 'sheet' ? '#ffffff' : 'transparent',
              color: reportTab === 'sheet' ? '#047857' : 'var(--text-muted)',
              fontWeight: reportTab === 'sheet' ? 700 : 500,
              boxShadow: reportTab === 'sheet' ? 'var(--shadow-xs)' : 'none',
              cursor: 'pointer',
              fontSize: '13px',
              transition: 'all 0.15s ease'
            }}
          >
            <FileSpreadsheet size={14} />
            <span>Dynamic Sheet View ({data?.sheetRows?.length || 0})</span>
          </button>

          <button
            type="button"
            onClick={() => setReportTab('staff')}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 14px',
              borderRadius: 'var(--radius-sm)',
              border: 'none',
              background: reportTab === 'staff' ? '#ffffff' : 'transparent',
              color: reportTab === 'staff' ? 'var(--primary-700)' : 'var(--text-muted)',
              fontWeight: reportTab === 'staff' ? 700 : 500,
              boxShadow: reportTab === 'staff' ? 'var(--shadow-xs)' : 'none',
              cursor: 'pointer',
              fontSize: '13px',
              transition: 'all 0.15s ease'
            }}
          >
            <Users size={14} />
            <span>Staff-Wise Report ({data?.staffReport?.length || 0})</span>
          </button>

          <button
            type="button"
            onClick={() => setReportTab('product')}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 14px',
              borderRadius: 'var(--radius-sm)',
              border: 'none',
              background: reportTab === 'product' ? '#ffffff' : 'transparent',
              color: reportTab === 'product' ? '#b45309' : 'var(--text-muted)',
              fontWeight: reportTab === 'product' ? 700 : 500,
              boxShadow: reportTab === 'product' ? 'var(--shadow-xs)' : 'none',
              cursor: 'pointer',
              fontSize: '13px',
              transition: 'all 0.15s ease'
            }}
          >
            <Package size={14} />
            <span>Product-Wise Report ({data?.productReport?.length || 0})</span>
          </button>

          <button
            type="button"
            onClick={() => setReportTab('both')}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 14px',
              borderRadius: 'var(--radius-sm)',
              border: 'none',
              background: reportTab === 'both' ? '#ffffff' : 'transparent',
              color: reportTab === 'both' ? 'var(--primary-700)' : 'var(--text-muted)',
              fontWeight: reportTab === 'both' ? 700 : 500,
              boxShadow: reportTab === 'both' ? 'var(--shadow-xs)' : 'none',
              cursor: 'pointer',
              fontSize: '13px',
              transition: 'all 0.15s ease'
            }}
          >
            <span>Combined</span>
          </button>
        </div>

        {/* In-table Search */}
        <div className="search-input-wrap" style={{ maxWidth: '300px', flex: '1 1 240px' }}>
          <Search size={15} />
          <input
            type="text"
            className="search-input"
            placeholder="Search Employee ID, staff, or date..."
            value={tableSearch}
            onChange={e => setTableSearch(e.target.value)}
            style={{ padding: '6px 10px 6px 32px', fontSize: '12.5px' }}
          />
        </div>
      </div>

      {/* Dynamic Sheet View (All Columns by Employee ID) */}
      {reportTab === 'sheet' && (
        <DynamicSheetTable
          columns={data?.sheetColumns || []}
          rows={filteredSheetRows}
          totals={sheetTotals}
          onSelectStaff={(id) => setSelectedStaffId(id)}
          onExportCsv={() => handleExportSheetCsv(filteredSheetRows, 'Dynamic_Sales_Sheet')}
          loading={loading}
          title="Dynamic Sheet View (All Columns by Employee ID)"
        />
      )}

      {/* ========================================================= */}
      {/* 4. Staff-Wise Sales Report Table */}
      {/* Columns: Staff Name | Total Orders | Gross Sales | Total Returns | Net Sales | Product Quantity */}
      {/* Clicking a row navigates to Individual Staff Sales Report */}
      {/* ========================================================= */}
      {(reportTab === 'staff' || reportTab === 'both') && (
        <div className="table-card" style={{ marginBottom: reportTab === 'both' ? '24px' : '0' }}>
          <div className="table-toolbar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ width: '28px', height: '28px', borderRadius: '6px', background: '#ecfdf5', color: '#059669', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Users size={16} />
              </div>
              <strong style={{ fontSize: '14.5px' }}>Staff-Wise Sales Report</strong>
              <span className="badge badge-info" style={{ fontSize: '11px' }}>
                {sortedStaff.length} staff members
              </span>
            </div>
            <span style={{ fontSize: '12px', color: 'var(--primary-600)', fontWeight: 500 }}>
              💡 Click any staff row to view individual staff sales report
            </span>
          </div>

          {/* Desktop Table View */}
          <div className="responsive-table-view">
            <div className="table-responsive">
              <table className="data-table">
                <thead>
                  <tr>
                    <th style={{ cursor: 'pointer' }} onClick={() => toggleStaffSort('staff_name')}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                        Staff Name <ArrowUpDown size={12} />
                      </span>
                    </th>
                    <th style={{ textAlign: 'right', cursor: 'pointer' }} onClick={() => toggleStaffSort('total_orders')}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', justifyContent: 'flex-end' }}>
                        Total Orders <ArrowUpDown size={12} />
                      </span>
                    </th>
                    <th style={{ textAlign: 'right', cursor: 'pointer' }} onClick={() => toggleStaffSort('gross_sales')}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', justifyContent: 'flex-end' }}>
                        Gross Sales <ArrowUpDown size={12} />
                      </span>
                    </th>
                    <th style={{ textAlign: 'right', cursor: 'pointer' }} onClick={() => toggleStaffSort('total_returns')}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', justifyContent: 'flex-end' }}>
                        Total Returns <ArrowUpDown size={12} />
                      </span>
                    </th>
                    <th style={{ textAlign: 'right', cursor: 'pointer' }} onClick={() => toggleStaffSort('net_sales')}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', justifyContent: 'flex-end', color: '#15803d' }}>
                        Net Sales <ArrowUpDown size={12} />
                      </span>
                    </th>
                    <th style={{ textAlign: 'right', cursor: 'pointer' }} onClick={() => toggleStaffSort('product_quantity')}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', justifyContent: 'flex-end' }}>
                        Product Quantity <ArrowUpDown size={12} />
                      </span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan="6" style={{ textAlign: 'center', padding: '32px' }}>Loading staff report data...</td>
                    </tr>
                  ) : sortedStaff.length === 0 ? (
                    <tr>
                      <td colSpan="6">
                        <div className="empty-state">
                          <div className="empty-state-icon"><Users size={24} /></div>
                          <div className="empty-state-title">No staff records match filter</div>
                          <div className="empty-state-desc">Adjust the selected reporting period or clear the search.</div>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    sortedStaff.map((s) => (
                      <tr
                        key={s.staff_id}
                        className="table-row-clickable"
                        onClick={() => setSelectedStaffId(s.staff_id || s.id)}
                        title={`Click to view ${s.staff_name}'s individual sales report`}
                        style={{ cursor: 'pointer' }}
                      >
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <div>
                              <strong style={{ color: 'var(--primary-700)' }}>{s.staff_name}</strong>
                              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                                <span className="badge badge-neutral" style={{ padding: '1px 5px', fontSize: '10px', marginRight: '4px' }}>
                                  {s.staff_code}
                                </span>
                                @{s.username}
                              </div>
                            </div>
                            <Eye size={14} color="var(--primary-500)" style={{ marginLeft: 'auto', opacity: 0.6 }} />
                          </div>
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: 600 }}>
                          {s.total_orders}
                        </td>
                        <td style={{ textAlign: 'right', color: s.gross_sales > 0 ? '#b45309' : 'var(--text-muted)' }}>
                          ₹{s.gross_sales?.toLocaleString()}
                        </td>
                        <td style={{ textAlign: 'right', color: (s.returned_quantity > 0 || s.returns > 0) ? '#dc2626' : 'var(--text-muted)' }}>
                          {s.returned_quantity > 0 ? (
                            <span>
                              <strong style={{ color: '#dc2626' }}>-{s.returned_quantity} units</strong>
                              {s.return_adjustments > 0 && (
                                <span style={{ display: 'block', fontSize: '11px', color: '#b91c1c' }}>
                                  (-₹{Number(s.return_adjustments).toLocaleString()})
                                </span>
                              )}
                            </span>
                          ) : s.returns > 0 ? (
                            <strong style={{ color: '#dc2626' }}>-₹{Number(s.returns).toLocaleString()}</strong>
                          ) : (
                            '0 units'
                          )}
                        </td>
                        <td style={{ textAlign: 'right', color: '#15803d', fontWeight: 700 }}>
                          ₹{s.net_sales?.toLocaleString()}
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          <strong>{s.product_quantity}</strong> units
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
                {sortedStaff.length > 0 && (
                  <tfoot>
                    <tr style={{ background: '#f8fafc', fontWeight: 700 }}>
                      <td>Total ({sortedStaff.length} staff members)</td>
                      <td style={{ textAlign: 'right' }}>{summary.total_orders}</td>
                      <td style={{ textAlign: 'right', color: '#b45309' }}>₹{summary.gross_sales?.toLocaleString()}</td>
                      <td style={{ textAlign: 'right', color: (summary.returned_quantity > 0 || summary.total_returns > 0) ? '#dc2626' : 'var(--text-main)' }}>
                        {summary.returned_quantity > 0 ? (
                          <span>
                            <strong style={{ color: '#dc2626' }}>-{summary.returned_quantity} units</strong>
                            {(summary.returnAdjustments || summary.reversed_incentive) > 0 && (
                              <span style={{ display: 'block', fontSize: '11px', color: '#b91c1c' }}>
                                (-₹{Number(summary.returnAdjustments || summary.reversed_incentive).toLocaleString()})
                              </span>
                            )}
                          </span>
                        ) : summary.total_returns > 0 ? (
                          <strong style={{ color: '#dc2626' }}>-₹{Number(summary.total_returns).toLocaleString()}</strong>
                        ) : (
                          '0 units'
                        )}
                      </td>
                      <td style={{ textAlign: 'right', color: '#15803d' }}>₹{summary.net_sales?.toLocaleString()}</td>
                      <td style={{ textAlign: 'right' }}>{summary.ordered_quantity} units</td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>

          {/* Mobile Card View */}
          <div className="responsive-card-view">
            {loading ? (
              <div style={{ textAlign: 'center', padding: '32px', color: 'var(--text-muted)' }}>Loading staff report data...</div>
            ) : sortedStaff.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-icon"><Users size={24} /></div>
                <div className="empty-state-title">No staff records match filter</div>
                <div className="empty-state-desc">Adjust the selected reporting period or clear the search.</div>
              </div>
            ) : (
              sortedStaff.map((s) => (
                <div
                  key={s.staff_id}
                  className="mobile-data-card"
                  onClick={() => setSelectedStaffId(s.staff_id || s.id)}
                >
                  <div className="mobile-card-header">
                    <div className="mobile-card-title-group">
                      <span className="mobile-card-id">{s.staff_name}</span>
                      <div style={{ display: 'flex', gap: '6px', alignItems: 'center', marginTop: '2px' }}>
                        <span className="badge badge-neutral" style={{ padding: '1px 5px', fontSize: '10.5px' }}>
                          {s.staff_code}
                        </span>
                        <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>@{s.username}</span>
                      </div>
                    </div>
                    <span className="badge badge-success" style={{ fontSize: '12px', fontWeight: 800 }}>
                      ₹{s.net_sales?.toLocaleString()}
                    </span>
                  </div>

                  <div className="mobile-card-grid">
                    <div className="mobile-card-item">
                      <span className="mobile-card-label">Total Orders</span>
                      <span className="mobile-card-val">{s.total_orders}</span>
                    </div>
                    <div className="mobile-card-item">
                      <span className="mobile-card-label">Units Sold</span>
                      <span className="mobile-card-val">{s.product_quantity} units</span>
                    </div>
                    <div className="mobile-card-item">
                      <span className="mobile-card-label">Gross Sales</span>
                      <span className="mobile-card-val" style={{ color: '#b45309', fontWeight: 600 }}>
                        ₹{s.gross_sales?.toLocaleString()}
                      </span>
                    </div>
                    <div className="mobile-card-item">
                      <span className="mobile-card-label">Total Returns</span>
                      <span className="mobile-card-val" style={{ color: (s.returned_quantity > 0 || s.returns > 0) ? '#dc2626' : 'inherit', fontWeight: (s.returned_quantity > 0 || s.returns > 0) ? 600 : 400 }}>
                        {s.returned_quantity > 0 ? `-${s.returned_quantity} units` : (s.returns > 0 ? `-₹${s.returns?.toLocaleString()}` : '0 units')}
                      </span>
                    </div>
                    <div className="mobile-card-item" style={{ gridColumn: 'span 2' }}>
                      <span className="mobile-card-label">Net Sales</span>
                      <span className="mobile-card-val" style={{ color: '#15803d', fontWeight: 800, fontSize: '15px' }}>
                        ₹{s.net_sales?.toLocaleString()}
                      </span>
                    </div>
                  </div>

                  <div className="mobile-card-footer">
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      style={{ width: '100%', justifyContent: 'center' }}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedStaffId(s.staff_id || s.id);
                      }}
                    >
                      View Individual Sales Report &rarr;
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 5. Product-Wise Sales Report Table */}
      {/* Columns: Product Code | Product Name | Orders | Ordered Quantity | Returned Quantity | Net Quantity | Gross Sales | Net Sales */}
      {/* ========================================================= */}
      {(reportTab === 'product' || reportTab === 'both') && (
        <div className="table-card">
          <div className="table-toolbar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ width: '28px', height: '28px', borderRadius: '6px', background: '#fef3c7', color: '#d97706', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Package size={16} />
              </div>
              <strong style={{ fontSize: '14.5px' }}>Product-Wise Sales Report</strong>
              <span className="badge badge-warning" style={{ fontSize: '11px' }}>
                {sortedProducts.length} catalog items
              </span>
            </div>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              Breakdown by product volume, return adjustments, and net revenue
            </span>
          </div>

          {/* Desktop Table View */}
          <div className="responsive-table-view">
            <div className="table-responsive">
              <table className="data-table">
                <thead>
                  <tr>
                    <th style={{ cursor: 'pointer' }} onClick={() => toggleProdSort('product_code')}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                        Product Code <ArrowUpDown size={12} />
                      </span>
                    </th>
                    <th style={{ cursor: 'pointer' }} onClick={() => toggleProdSort('product_name')}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                        Product Name <ArrowUpDown size={12} />
                      </span>
                    </th>
                    <th style={{ textAlign: 'right', cursor: 'pointer' }} onClick={() => toggleProdSort('orders')}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', justifyContent: 'flex-end' }}>
                        Orders <ArrowUpDown size={12} />
                      </span>
                    </th>
                    <th style={{ textAlign: 'right', cursor: 'pointer' }} onClick={() => toggleProdSort('ordered_quantity')}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', justifyContent: 'flex-end' }}>
                        Ordered Qty <ArrowUpDown size={12} />
                      </span>
                    </th>
                    <th style={{ textAlign: 'right', cursor: 'pointer' }} onClick={() => toggleProdSort('returned_quantity')}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', justifyContent: 'flex-end' }}>
                        Returned Qty <ArrowUpDown size={12} />
                      </span>
                    </th>
                    <th style={{ textAlign: 'right', cursor: 'pointer' }} onClick={() => toggleProdSort('net_quantity')}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', justifyContent: 'flex-end' }}>
                        Net Qty <ArrowUpDown size={12} />
                      </span>
                    </th>
                    <th style={{ textAlign: 'right', cursor: 'pointer' }} onClick={() => toggleProdSort('gross_sales')}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', justifyContent: 'flex-end' }}>
                        Gross Sales <ArrowUpDown size={12} />
                      </span>
                    </th>
                    <th style={{ textAlign: 'right', cursor: 'pointer' }} onClick={() => toggleProdSort('net_sales')}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', justifyContent: 'flex-end', color: '#15803d' }}>
                        Net Sales <ArrowUpDown size={12} />
                      </span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan="8" style={{ textAlign: 'center', padding: '32px' }}>Loading product report data...</td>
                    </tr>
                  ) : sortedProducts.length === 0 ? (
                    <tr>
                      <td colSpan="8">
                        <div className="empty-state">
                          <div className="empty-state-icon"><Package size={24} /></div>
                          <div className="empty-state-title">No products match filter</div>
                          <div className="empty-state-desc">Try clearing the search term or adjusting filters.</div>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    sortedProducts.map((p) => (
                      <tr key={p.product_id}>
                        <td>
                          <span className="badge badge-neutral" style={{ fontWeight: 600 }}>{p.product_code}</span>
                        </td>
                        <td>
                          <strong>{p.product_name}</strong>
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: 600 }}>
                          {p.orders}
                        </td>
                        <td style={{ textAlign: 'right' }}>
                          {p.ordered_quantity} units
                        </td>
                        <td style={{ textAlign: 'right', color: p.returned_quantity > 0 ? '#dc2626' : 'var(--text-muted)' }}>
                          {p.returned_quantity > 0 ? `-${p.returned_quantity} units` : '0 units'}
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: 700, color: '#0891b2' }}>
                          {p.net_quantity} units
                        </td>
                        <td style={{ textAlign: 'right', color: p.gross_sales > 0 ? '#b45309' : 'var(--text-muted)' }}>
                          ₹{p.gross_sales?.toLocaleString()}
                        </td>
                        <td style={{ textAlign: 'right', color: '#15803d', fontWeight: 700 }}>
                          ₹{p.net_sales?.toLocaleString()}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
                {sortedProducts.length > 0 && (
                  <tfoot>
                    <tr style={{ background: '#f8fafc', fontWeight: 700 }}>
                      <td colSpan="2">Total ({sortedProducts.length} catalog items)</td>
                      <td style={{ textAlign: 'right' }}>{summary.total_orders}</td>
                      <td style={{ textAlign: 'right' }}>{summary.ordered_quantity} units</td>
                      <td style={{ textAlign: 'right', color: summary.returned_quantity > 0 ? '#dc2626' : 'var(--text-main)' }}>
                        {summary.returned_quantity > 0 ? `-${summary.returned_quantity} units` : '0 units'}
                      </td>
                      <td style={{ textAlign: 'right', color: '#0891b2' }}>{summary.net_quantity} units</td>
                      <td style={{ textAlign: 'right', color: '#b45309' }}>₹{summary.gross_sales?.toLocaleString()}</td>
                      <td style={{ textAlign: 'right', color: '#15803d' }}>₹{summary.net_sales?.toLocaleString()}</td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>

          {/* Mobile Card View */}
          <div className="responsive-card-view">
            {loading ? (
              <div style={{ textAlign: 'center', padding: '32px', color: 'var(--text-muted)' }}>Loading product report data...</div>
            ) : sortedProducts.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-icon"><Package size={24} /></div>
                <div className="empty-state-title">No products match filter</div>
                <div className="empty-state-desc">Try clearing the search term or adjusting filters.</div>
              </div>
            ) : (
              sortedProducts.map((p) => (
                <div key={p.product_id} className="mobile-data-card">
                  <div className="mobile-card-header">
                    <div className="mobile-card-title-group">
                      <span className="mobile-card-id">{p.product_name}</span>
                      <span className="badge badge-neutral" style={{ width: 'fit-content', marginTop: '2px', fontWeight: 600 }}>
                        {p.product_code}
                      </span>
                    </div>
                    <span className="badge badge-success" style={{ fontSize: '12px', fontWeight: 800 }}>
                      ₹{p.net_sales?.toLocaleString()}
                    </span>
                  </div>

                  <div className="mobile-card-grid">
                    <div className="mobile-card-item">
                      <span className="mobile-card-label">Orders</span>
                      <span className="mobile-card-val">{p.orders}</span>
                    </div>
                    <div className="mobile-card-item">
                      <span className="mobile-card-label">Ordered Qty</span>
                      <span className="mobile-card-val">{p.ordered_quantity} units</span>
                    </div>
                    <div className="mobile-card-item">
                      <span className="mobile-card-label">Returned Qty</span>
                      <span className="mobile-card-val" style={{ color: p.returned_quantity > 0 ? '#dc2626' : 'inherit' }}>
                        {p.returned_quantity > 0 ? `-${p.returned_quantity} units` : '0 units'}
                      </span>
                    </div>
                    <div className="mobile-card-item">
                      <span className="mobile-card-label">Net Qty</span>
                      <span className="mobile-card-val" style={{ color: '#0891b2', fontWeight: 700 }}>
                        {p.net_quantity} units
                      </span>
                    </div>
                    <div className="mobile-card-item">
                      <span className="mobile-card-label">Gross Sales</span>
                      <span className="mobile-card-val" style={{ color: '#b45309', fontWeight: 600 }}>
                        ₹{p.gross_sales?.toLocaleString()}
                      </span>
                    </div>
                    <div className="mobile-card-item">
                      <span className="mobile-card-label">Net Sales</span>
                      <span className="mobile-card-val" style={{ color: '#15803d', fontWeight: 800 }}>
                        ₹{p.net_sales?.toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Bulk Order Import Modal */}
      <BulkOrderImportModal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
        onImportSuccess={handleImportSuccess}
      />

      {/* Clear Orders & Returns Confirmation Modal */}
      <ClearConfirmModal
        isOpen={showClearConfirm}
        onClose={() => setShowClearConfirm(false)}
        onConfirm={handleClearAll}
        clearing={clearing}
      />
    </div>
  );
}
