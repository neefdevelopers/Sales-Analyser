// src/views/manager/IncentiveRecords.jsx
import React, { useState, useEffect, useMemo } from 'react';
import { api } from '../../api';
import { useSessionState } from '../../hooks/useSessionState';
import {
  Award,
  Search,
  Calendar,
  ChevronLeft,
  ChevronRight,
  ArrowLeft,
  ShoppingCart,
  TrendingUp,
  RotateCcw,
  CheckCircle2,
  Sparkles,
  Eye,
  AlertTriangle,
  User,
  Package,
  CreditCard,
  Download,
  Filter,
  X,
  ChevronDown,
  Layers,
  FileText,
  Trash2,
  RefreshCw,
  FileSpreadsheet,
  ArrowUpDown,
  AlertCircle
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
            <strong>Note:</strong> All staff members and products will remain intact. You can immediately import an updated Excel sheet.
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

export default function IncentiveRecords() {
  // Navigation state: null = Overall Team View; staffId = Individual Staff Detail Drill-Down
  const [selectedStaffId, setSelectedStaffId] = useSessionState('filter_incentives_selected_staff_id', null);

  // Filter states synchronized with Sales Reports
  const [preset, setPreset] = useSessionState('filter_incentives_preset', 'all');
  const [startDate, setStartDate] = useSessionState('filter_incentives_start_date', '');
  const [endDate, setEndDate] = useSessionState('filter_incentives_end_date', '');
  const [search, setSearch] = useSessionState('filter_incentives_search', '');

  // Tab views
  const [activeTab, setActiveTab] = useSessionState('filter_incentives_main_tab', 'sheet'); // 'sheet' | 'staff'
  const [staffDetailTab, setStaffDetailTab] = useSessionState('filter_incentives_detail_tab', 'sheet'); // 'sheet' | 'orders' | 'returns'

  // Data states
  const [data, setData] = useState(null);
  const [staffDetailData, setStaffDetailData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [toastMessage, setToastMessage] = useState('');

  // Modals
  const [selectedOrderModal, setSelectedOrderModal] = useState(null);
  const [showImportModal, setShowImportModal] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  // Sorting for staff audit table
  const [sortField, setSortField] = useState('net_incentive');
  const [sortAsc, setSortAsc] = useState(false);

  // Fetch report whenever active view or filters change
  useEffect(() => {
    if (selectedStaffId === null) {
      fetchMainReport();
    } else {
      setStaffDetailData(null);
      fetchStaffReport(selectedStaffId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedStaffId, preset]);

  async function fetchMainReport(overrideDates = null) {
    setLoading(true);
    setError(null);
    try {
      const curPreset = overrideDates?.preset || preset;
      const params = [`preset=${curPreset}`];

      const sDate = overrideDates ? overrideDates.startDate : startDate;
      const eDate = overrideDates ? overrideDates.endDate : endDate;
      if (sDate) params.push(`startDate=${sDate}`);
      if (eDate) params.push(`endDate=${eDate}`);

      const qs = params.length > 0 ? '?' + params.join('&') : '';
      const res = await api.get(`/reports/sales${qs}`);
      setData(res);

      if (res?.period && curPreset !== 'custom') {
        setStartDate(res.period.startDate);
        setEndDate(res.period.endDate);
      }
    } catch (err) {
      console.error('Failed to load incentive data:', err);
      setError(err.message || 'Failed to load incentive records.');
    } finally {
      setLoading(false);
    }
  }

  async function fetchStaffReport(targetStaffId, overrideDates = null) {
    setLoading(true);
    setError(null);
    try {
      const curPreset = overrideDates?.preset || preset;
      const params = [`preset=${curPreset}`];

      const sDate = overrideDates ? overrideDates.startDate : startDate;
      const eDate = overrideDates ? overrideDates.endDate : endDate;
      if (sDate) params.push(`startDate=${sDate}`);
      if (eDate) params.push(`endDate=${eDate}`);

      const qs = params.length > 0 ? '?' + params.join('&') : '';
      const res = await api.get(`/reports/sales/staff/${targetStaffId}${qs}`);
      setStaffDetailData(res);

      if (res?.period && curPreset !== 'custom') {
        setStartDate(res.period.startDate);
        setEndDate(res.period.endDate);
      }
    } catch (err) {
      console.error('Failed to load staff incentive report:', err);
      setError(err.message || 'Failed to load staff incentive records.');
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

  function handleCustomDateApply(e) {
    e.preventDefault();
    if (!startDate || !endDate) return;
    const override = { preset: 'custom', startDate, endDate };
    if (selectedStaffId === null) {
      fetchMainReport(override);
    } else {
      fetchStaffReport(selectedStaffId, override);
    }
  }

  function handleImportSuccess() {
    setPreset('all');
    if (selectedStaffId === null) {
      fetchMainReport({ preset: 'all', startDate: '', endDate: '' });
    } else {
      fetchStaffReport(selectedStaffId, { preset: 'all', startDate: '', endDate: '' });
    }
    setToastMessage('Orders successfully imported from Excel! Incentive records updated.');
    setTimeout(() => setToastMessage(''), 5000);
  }

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

  // Export Sheet Matrix as CSV
  function handleExportSheetCsv(customRows = null, filenamePrefix = 'Incentive_Sheet') {
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

  // Export Staff Ranking CSV
  function handleExportStaffCsv() {
    if (!filteredStaffList.length) return;
    const headers = [
      'Rank',
      'Staff Name',
      'Employee ID',
      'Username',
      'Total Orders',
      'Gross Sales (INR)',
      'Earned Incentive (INR)',
      'Return Adjustments (INR)',
      'Net Payable Incentive (INR)'
    ];

    const rows = sortedStaffList.map((s, idx) => [
      idx + 1,
      `"${s.staff_name || s.name || ''}"`,
      `"${s.staff_code || ''}"`,
      `"${s.username || ''}"`,
      s.total_orders || 0,
      s.gross_sales || 0,
      s.earned_incentive || s.gross_incentive || 0,
      s.return_adjustments || s.reversed_incentive || 0,
      s.net_incentive || 0
    ]);

    const csvContent = [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const periodStr = (data?.period?.startDate || startDate || 'all') + '_to_' + (data?.period?.endDate || endDate || '');
    link.download = `Staff_Incentives_Ranking_${periodStr}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  // Filtered rows for main sheet
  const rawSheetRows = data?.sheetRows || [];
  const filteredSheetRows = useMemo(() => {
    if (!search.trim()) return rawSheetRows;
    const term = search.trim().toLowerCase();
    return rawSheetRows.filter(r =>
      (r.staff_name && r.staff_name.toLowerCase().includes(term)) ||
      (r.employee_id && r.employee_id.toLowerCase().includes(term)) ||
      (r.date && r.date.toLowerCase().includes(term))
    );
  }, [rawSheetRows, search]);

  // Dynamic sheet totals
  const sheetTotals = useMemo(() => {
    const t = {
      incentive: 0,
      return_deductions: 0,
      total_net: 0
    };
    (data?.sheetColumns || []).forEach(col => {
      if (col.type === 'product' || col.type === 'return') {
        t[col.key] = 0;
      }
    });

    filteredSheetRows.forEach(r => {
      t.incentive += (r.incentive || 0);
      t.return_deductions += (r.return_deductions || 0);
      t.total_net += (r.total_net || 0);
      (data?.sheetColumns || []).forEach(col => {
        if (col.type === 'product') {
          t[col.key] = (t[col.key] || 0) + (r.quantities?.[col.key] || 0);
        } else if (col.type === 'return') {
          t[col.key] = (t[col.key] || 0) + (r.returns?.[col.key] || 0);
        }
      });
    });

    t.incentive = Math.round(t.incentive * 100) / 100;
    t.return_deductions = Math.round(t.return_deductions * 100) / 100;
    t.total_net = Math.round(t.total_net * 100) / 100;
    return t;
  }, [filteredSheetRows, data?.sheetColumns]);

  // Staff report list
  const staffList = data?.staffReport || [];
  const filteredStaffList = useMemo(() => {
    if (!search.trim()) return staffList;
    const term = search.trim().toLowerCase();
    return staffList.filter(s =>
      (s.staff_name && s.staff_name.toLowerCase().includes(term)) ||
      (s.staff_code && s.staff_code.toLowerCase().includes(term)) ||
      (s.username && s.username.toLowerCase().includes(term))
    );
  }, [staffList, search]);

  const sortedStaffList = useMemo(() => {
    return [...filteredStaffList].sort((a, b) => {
      let valA = a[sortField];
      let valB = b[sortField];
      if (typeof valA === 'string') {
        return sortAsc ? valA.localeCompare(valB) : valB.localeCompare(valA);
      }
      valA = valA || 0;
      valB = valB || 0;
      return sortAsc ? valA - valB : valB - valA;
    });
  }, [filteredStaffList, sortField, sortAsc]);

  function handleSort(field) {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(false);
    }
  }

  // Summary object from API
  const summary = data?.summary || {
    totalOrders: 0,
    grossSales: 0,
    earnedIncentive: 0,
    grossIncentive: 0,
    returnAdjustments: 0,
    reversedIncentive: 0,
    netIncentive: 0
  };

  const periodLabel = useMemo(() => {
    if (!data?.period) return 'Loading...';
    if (preset === 'all') return 'All Imported Records';
    if (preset === 'this_month') return 'This Month';
    if (preset === 'previous_month') return 'Previous Month';
    return `${data.period.startDate} to ${data.period.endDate}`;
  }, [data?.period, preset]);

  // ==========================================
  // RENDER 1: INDIVIDUAL STAFF DETAIL VIEW
  // ==========================================
  if (selectedStaffId !== null) {
    const staff = staffDetailData?.staff;
    const staffSummary = staffDetailData?.summary || {
      totalOrders: 0,
      grossSales: 0,
      earnedIncentive: 0,
      returnAdjustments: 0,
      netIncentive: 0
    };
    const orders = staffDetailData?.orders || [];
    const returns = staffDetailData?.returns || [];
    const staffSheetRows = staffDetailData?.sheetRows || [];
    const staffSheetColumns = staffDetailData?.sheetColumns || [];

    // Filter staff orders & returns by search
    const filteredOrders = orders.filter(o => {
      if (!search.trim()) return true;
      const term = search.trim().toLowerCase();
      return (
        (o.order_number && o.order_number.toLowerCase().includes(term)) ||
        (o.product_name && o.product_name.toLowerCase().includes(term)) ||
        (o.payment_method && o.payment_method.toLowerCase().includes(term))
      );
    });

    const filteredReturns = returns.filter(r => {
      if (!search.trim()) return true;
      const term = search.trim().toLowerCase();
      return (
        (r.return_number && r.return_number.toLowerCase().includes(term)) ||
        (r.order_number && r.order_number.toLowerCase().includes(term)) ||
        (r.product_name && r.product_name.toLowerCase().includes(term)) ||
        (r.payment_method && r.payment_method.toLowerCase().includes(term))
      );
    });

    // Staff sheet totals
    const staffSheetTotals = {
      incentive: 0,
      return_deductions: 0,
      total_net: 0
    };
    staffSheetColumns.forEach(c => {
      if (c.type === 'product' || c.type === 'return') staffSheetTotals[c.key] = 0;
    });
    staffSheetRows.forEach(r => {
      staffSheetTotals.incentive += (r.incentive || 0);
      staffSheetTotals.return_deductions += (r.return_deductions || 0);
      staffSheetTotals.total_net += (r.total_net || 0);
      staffSheetColumns.forEach(c => {
        if (c.type === 'product') staffSheetTotals[c.key] = (staffSheetTotals[c.key] || 0) + (r.quantities?.[c.key] || 0);
        else if (c.type === 'return') staffSheetTotals[c.key] = (staffSheetTotals[c.key] || 0) + (r.returns?.[c.key] || 0);
      });
    });

    return (
      <div className="page-body">
        {/* Navigation & Header */}
        <div className="page-header" style={{ marginBottom: '16px', alignItems: 'flex-start' }}>
          <div>
            <button
              className="btn btn-secondary btn-sm"
              onClick={() => {
                setSelectedStaffId(null);
                setSearch('');
              }}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', marginBottom: '8px', padding: '6px 12px' }}
            >
              <ArrowLeft size={14} />
              <span>Back to All Staff Incentives</span>
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              <h2 className="page-title" style={{ margin: 0, fontSize: '22px' }}>
                {staff?.name || 'Staff Member'}
              </h2>
              <span className="badge badge-neutral" style={{ fontSize: '12px' }}>
                {staff?.staff_code}
              </span>
              <span className="badge badge-info" style={{ fontSize: '11.5px' }}>
                {periodLabel}
              </span>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <button
              type="button"
              className={`btn ${showFilters ? 'btn-primary' : 'btn-secondary'} btn-sm`}
              onClick={() => setShowFilters(!showFilters)}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '7px', padding: '8px 14px', fontWeight: 600, fontSize: '12.5px' }}
            >
              <Filter size={14} />
              <span>Period &amp; Filters</span>
              <ChevronDown size={14} style={{ transform: showFilters ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s ease' }} />
            </button>

            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => handleExportSheetCsv(staffSheetRows, `${staff?.staff_code || 'Staff'}_Incentives`)}
              disabled={staffSheetRows.length === 0}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '8px 12px' }}
            >
              <Download size={14} />
              <span>Export Sheet (.csv)</span>
            </button>
          </div>
        </div>

        {/* Real-time Calculation Flow Strip */}
        <div className="calc-breakdown-bar">
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-muted)', fontWeight: 600 }}>
            <Sparkles size={15} color="var(--primary-600)" />
            <span>Staff Net Incentive Payout:</span>
          </div>
          <div className="calc-step">
            <span style={{ color: 'var(--text-muted)' }}>Gross Incentive:</span>
            <strong style={{ color: '#d97706' }}>₹{Number(staffSummary.earnedIncentive || staffSummary.grossIncentive || 0).toLocaleString()}</strong>
          </div>
          <span className="calc-operator">&minus;</span>
          <div className="calc-step">
            <span style={{ color: 'var(--text-muted)' }}>Return Deductions:</span>
            <strong style={{ color: '#dc2626' }}>₹{Number(staffSummary.returnAdjustments || staffSummary.reversedIncentive || 0).toLocaleString()}</strong>
          </div>
          <span className="calc-operator">=</span>
          <div className="calc-step" style={{ background: '#ecfdf5', padding: '3px 10px', borderRadius: '6px', border: '1px solid #bbf7d0' }}>
            <span style={{ color: '#166534', fontWeight: 600 }}>Net Payable:</span>
            <strong style={{ color: '#16a34a', fontSize: '14px' }}>₹{Number(staffSummary.netIncentive || 0).toLocaleString()}</strong>
          </div>
        </div>

        {/* 4 KPI Cards for Staff */}
        <div className="kpi-grid sales-kpi-grid" style={{ marginBottom: '22px' }}>
          <div className="kpi-card-premium" style={{ '--card-accent': '#3b82f6' }}>
            <div className="kpi-header">
              <span className="kpi-title">Total Orders</span>
              <div className="kpi-icon-wrap" style={{ background: '#eff6ff', color: '#2563eb' }}>
                <ShoppingCart size={19} />
              </div>
            </div>
            <div>
              <div className="kpi-value">{staffSummary.totalOrders || 0}</div>
              <div className="kpi-subtext">Gross Sales: ₹{Number(staffSummary.grossSales || 0).toLocaleString()}</div>
            </div>
          </div>

          <div className="kpi-card-premium" style={{ '--card-accent': '#f59e0b' }}>
            <div className="kpi-header">
              <span className="kpi-title">Earned Incentive</span>
              <div className="kpi-icon-wrap" style={{ background: '#fef3c7', color: '#d97706' }}>
                <TrendingUp size={19} />
              </div>
            </div>
            <div>
              <div className="kpi-value" style={{ color: '#b45309' }}>
                ₹{Number(staffSummary.earnedIncentive || staffSummary.grossIncentive || 0).toLocaleString()}
              </div>
              <div className="kpi-subtext">Gross incentive before returns</div>
            </div>
          </div>

          <div className="kpi-card-premium" style={{ '--card-accent': '#ef4444' }}>
            <div className="kpi-header">
              <span className="kpi-title">Return Deductions</span>
              <div className="kpi-icon-wrap" style={{ background: '#fef2f2', color: '#dc2626' }}>
                <RotateCcw size={19} />
              </div>
            </div>
            <div>
              <div className="kpi-value" style={{ color: '#dc2626' }}>
                {(staffSummary.returnAdjustments || staffSummary.reversedIncentive) > 0
                  ? `-₹${Number(staffSummary.returnAdjustments || staffSummary.reversedIncentive).toLocaleString()}`
                  : '₹0'}
              </div>
              <div className="kpi-subtext">{returns.length} returned order{returns.length === 1 ? '' : 's'}</div>
            </div>
          </div>

          <div className="kpi-card-premium kpi-card-hero">
            <div className="kpi-header">
              <span className="kpi-title" style={{ color: '#166534', fontWeight: 800 }}>Net Incentive</span>
              <div className="kpi-icon-wrap" style={{ background: '#dcfce7', color: '#16a34a' }}>
                <CheckCircle2 size={20} />
              </div>
            </div>
            <div>
              <div className="kpi-value" style={{ color: '#15803d', fontSize: '28px' }}>
                ₹{Number(staffSummary.netIncentive || 0).toLocaleString()}
              </div>
              <div className="kpi-subtext" style={{ color: '#166534' }}>Total net payable to staff</div>
            </div>
          </div>
        </div>

        {/* Filtration Card */}
        {showFilters && (
          <div className="filter-card" style={{ marginBottom: '20px' }}>
            <div className="filter-card-header">
              <div className="filter-title-wrap">
                <div className="filter-icon-box"><Filter size={15} /></div>
                <strong className="filter-title">Date Period Filtration</strong>
              </div>
              <button type="button" className="filter-hide-btn" onClick={() => setShowFilters(false)}>
                <X size={14} /> Hide
              </button>
            </div>
            <div className="filter-body">
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '14px' }}>
                {PRESETS.map(p => (
                  <button
                    key={p.id}
                    type="button"
                    className={`btn btn-sm ${preset === p.id ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => handlePresetSelect(p.id)}
                    style={{ fontSize: '12px', padding: '6px 12px' }}
                  >
                    {p.label}
                  </button>
                ))}
              </div>

              {preset === 'custom' && (
                <form onSubmit={handleCustomDateApply} style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <label style={{ fontSize: '12px', fontWeight: 600 }}>From:</label>
                    <input
                      type="date"
                      className="form-control"
                      value={startDate}
                      onChange={e => setStartDate(e.target.value)}
                      required
                    />
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <label style={{ fontSize: '12px', fontWeight: 600 }}>To:</label>
                    <input
                      type="date"
                      className="form-control"
                      value={endDate}
                      onChange={e => setEndDate(e.target.value)}
                      required
                    />
                  </div>
                  <button type="submit" className="btn btn-primary btn-sm">Apply Dates</button>
                </form>
              )}
            </div>
          </div>
        )}

        {/* Tab Selector inside Staff View */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px', marginBottom: '16px' }}>
          <div style={{ display: 'inline-flex', background: '#f1f5f9', padding: '3px', borderRadius: '8px' }}>
            <button
              type="button"
              className={`btn btn-sm ${staffDetailTab === 'sheet' ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => setStaffDetailTab('sheet')}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12.5px', borderRadius: '6px' }}
            >
              <FileSpreadsheet size={14} />
              <span>Dynamic Sheet View ({staffSheetRows.length} rows)</span>
            </button>
            <button
              type="button"
              className={`btn btn-sm ${staffDetailTab === 'orders' ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => setStaffDetailTab('orders')}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12.5px', borderRadius: '6px' }}
            >
              <ShoppingCart size={14} />
              <span>Orders ({orders.length})</span>
            </button>
            <button
              type="button"
              className={`btn btn-sm ${staffDetailTab === 'returns' ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => setStaffDetailTab('returns')}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12.5px', borderRadius: '6px' }}
            >
              <RotateCcw size={14} />
              <span>Returns ({returns.length})</span>
            </button>
          </div>

          <div className="search-input-wrap" style={{ maxWidth: '280px' }}>
            <Search size={14} />
            <input
              type="text"
              className="search-input"
              placeholder="Search in records..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ fontSize: '12.5px', height: '34px' }}
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: '0 4px' }}
              >
                <X size={13} />
              </button>
            )}
          </div>
        </div>

        {/* TAB 1: DYNAMIC SHEET TABLE FOR STAFF */}
        {staffDetailTab === 'sheet' && (
          <div className="table-card">
            <div className="table-toolbar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{ width: '28px', height: '28px', borderRadius: '6px', background: '#e0f2fe', color: '#0284c7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Layers size={15} />
                </div>
                <strong style={{ fontSize: '14.5px' }}>Dynamic Sheet View &bull; {staff?.name} ({staff?.staff_code})</strong>
              </div>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => handleExportSheetCsv(staffSheetRows, `${staff?.staff_code || 'Staff'}_Incentives`)}
                style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', fontSize: '12px' }}
              >
                <Download size={13} />
                <span>Export CSV</span>
              </button>
            </div>

            <div className="responsive-table-view">
              <div className="table-responsive" style={{ maxHeight: '600px', overflowY: 'auto' }}>
                <table className="data-table" style={{ fontSize: '12.5px', width: '100%' }}>
                  <thead style={{ position: 'sticky', top: 0, zIndex: 5, background: '#1e293b', color: '#ffffff' }}>
                    <tr>
                      {staffSheetColumns.map(col => {
                        const isNumeric = col.type === 'product' || col.type === 'return' || col.type === 'currency';
                        return (
                          <th
                            key={col.key}
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
                        <td colSpan={staffSheetColumns.length || 8} style={{ textAlign: 'center', padding: '32px' }}>
                          Loading staff sheet records...
                        </td>
                      </tr>
                    ) : staffSheetRows.length === 0 ? (
                      <tr>
                        <td colSpan={staffSheetColumns.length || 8} style={{ textAlign: 'center', padding: '32px', color: 'var(--text-muted)' }}>
                          No sheet rows found for {staff?.name} in {periodLabel}.
                        </td>
                      </tr>
                    ) : (
                      staffSheetRows.map((r, idx) => (
                        <tr key={`${r.date}_${idx}`}>
                          {staffSheetColumns.map(col => {
                            if (col.key === 'date') return <td key={col.key} style={{ fontWeight: 600 }}>{r.date}</td>;
                            if (col.key === 'employee_id') return <td key={col.key}><span className="badge badge-neutral">{r.employee_id}</span></td>;
                            if (col.key === 'staff_name') return <td key={col.key}><strong>{r.staff_name}</strong></td>;
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
                                  {r.incentive > 0 ? `₹${Number(r.incentive).toLocaleString()}` : '₹0'}
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
                                  {r.return_deductions > 0 ? `-₹${Number(r.return_deductions).toLocaleString()}` : '₹0'}
                                </td>
                              );
                            }
                            if (col.key === 'total_net') {
                              return (
                                <td key={col.key} style={{ textAlign: 'right', fontWeight: 700, color: '#15803d' }}>
                                  ₹{Number(r.total_net || 0).toLocaleString()}
                                </td>
                              );
                            }
                            return <td key={col.key}>—</td>;
                          })}
                        </tr>
                      ))
                    )}
                  </tbody>
                  {staffSheetRows.length > 0 && (
                    <tfoot>
                      <tr style={{ background: '#f8fafc', fontWeight: 700, position: 'sticky', bottom: 0, zIndex: 4, borderTop: '2px solid #cbd5e1' }}>
                        {staffSheetColumns.map((col, idx) => {
                          if (idx === 0) return <td key={col.key}>Total ({staffSheetRows.length} rows)</td>;
                          if (col.key === 'employee_id' || col.key === 'staff_name') return <td key={col.key}></td>;
                          if (col.type === 'product' || col.type === 'return') {
                            const val = staffSheetTotals[col.key] || 0;
                            return (
                              <td key={col.key} style={{ textAlign: 'right', color: col.type === 'return' && val > 0 ? '#dc2626' : 'inherit' }}>
                                {val > 0 ? val : '—'}
                              </td>
                            );
                          }
                          if (col.key === 'incentive') {
                            return (
                              <td key={col.key} style={{ textAlign: 'right', color: '#059669' }}>
                                ₹{staffSheetTotals.incentive?.toLocaleString()}
                              </td>
                            );
                          }
                          if (col.key === 'return_deductions') {
                            return (
                              <td key={col.key} style={{ textAlign: 'right', color: '#dc2626' }}>
                                {staffSheetTotals.return_deductions > 0 ? `-₹${staffSheetTotals.return_deductions?.toLocaleString()}` : '₹0'}
                              </td>
                            );
                          }
                          if (col.key === 'total_net') {
                            return (
                              <td key={col.key} style={{ textAlign: 'right', color: '#15803d', fontSize: '13.5px' }}>
                                ₹{staffSheetTotals.total_net?.toLocaleString()}
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
        )}

        {/* TAB 2: ORDERS LIST FOR AUDIT */}
        {staffDetailTab === 'orders' && (
          <div className="table-card">
            <div className="table-toolbar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <strong>Orders Placed ({filteredOrders.length})</strong>
            </div>
            <div className="responsive-table-view">
              <div className="table-responsive">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Order #</th>
                      <th>Date</th>
                      <th>Product</th>
                      <th>Payment</th>
                      <th style={{ textAlign: 'right' }}>Qty</th>
                      <th style={{ textAlign: 'right' }}>Order Total</th>
                      <th style={{ textAlign: 'right' }}>Incentive</th>
                      <th style={{ textAlign: 'center', width: '80px' }}>Audit</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredOrders.length === 0 ? (
                      <tr>
                        <td colSpan="8" style={{ textAlign: 'center', padding: '32px', color: 'var(--text-muted)' }}>
                          No orders found matching criteria.
                        </td>
                      </tr>
                    ) : (
                      filteredOrders.map(o => (
                        <tr key={o.id}>
                          <td><strong style={{ fontFamily: 'monospace' }}>{o.order_number}</strong></td>
                          <td>{o.order_date}</td>
                          <td>{o.product_name}</td>
                          <td>
                            <span className={`badge ${o.payment_method === 'Prepaid' ? 'badge-success' : 'badge-neutral'}`}>
                              {o.payment_method}
                            </span>
                          </td>
                          <td style={{ textAlign: 'right' }}>{o.quantity}</td>
                          <td style={{ textAlign: 'right' }}>₹{Number(o.total_amount).toLocaleString()}</td>
                          <td style={{ textAlign: 'right', color: '#059669', fontWeight: 700 }}>
                            ₹{Number(o.order_incentive || o.incentive_amount || 0).toLocaleString()}
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <button
                              type="button"
                              className="btn btn-secondary btn-sm"
                              onClick={() => setSelectedOrderModal(o)}
                              title="Audit Order Details"
                            >
                              <Eye size={13} />
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
        )}

        {/* TAB 3: RETURNS LIST FOR AUDIT */}
        {staffDetailTab === 'returns' && (
          <div className="table-card">
            <div className="table-toolbar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <strong>Returns &amp; Reversed Incentives ({filteredReturns.length})</strong>
            </div>
            <div className="responsive-table-view">
              <div className="table-responsive">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Return #</th>
                      <th>Return Date</th>
                      <th>Product</th>
                      <th>Payment Method</th>
                      <th style={{ textAlign: 'right' }}>Returned Qty</th>
                      <th style={{ textAlign: 'right' }}>Reversed Incentive</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredReturns.length === 0 ? (
                      <tr>
                        <td colSpan="6" style={{ textAlign: 'center', padding: '32px', color: 'var(--text-muted)' }}>
                          No returns recorded in this period.
                        </td>
                      </tr>
                    ) : (
                      filteredReturns.map(r => (
                        <tr key={r.id}>
                          <td><strong style={{ color: '#dc2626', fontFamily: 'monospace' }}>{r.return_number}</strong></td>
                          <td>{r.return_date}</td>
                          <td>{r.product_name}</td>
                          <td>
                            <span className={`badge ${r.payment_method === 'Prepaid' ? 'badge-success' : 'badge-neutral'}`}>
                              {r.payment_method || 'Prepaid'}
                            </span>
                          </td>
                          <td style={{ textAlign: 'right', fontWeight: 600 }}>{r.return_quantity}</td>
                          <td style={{ textAlign: 'right', color: '#dc2626', fontWeight: 700 }}>
                            -₹{Number(r.reversed_incentive).toLocaleString()}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* Order Audit Modal */}
        {selectedOrderModal && (
          <div className="modal-overlay">
            <div className="modal-dialog" style={{ width: 'min(760px, 95vw)', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
              <div className="modal-header">
                <h3 className="modal-title">Order Audit: {selectedOrderModal.order_number}</h3>
                <button className="modal-close" onClick={() => setSelectedOrderModal(null)}>✕</button>
              </div>
              <div className="modal-body" style={{ padding: '20px', overflowY: 'auto', flex: 1 }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '14px', marginBottom: '16px' }}>
                  <div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Order Date</div>
                    <div style={{ fontWeight: 600 }}>{selectedOrderModal.order_date}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Product</div>
                    <div style={{ fontWeight: 600 }}>{selectedOrderModal.product_name} ({selectedOrderModal.product_code})</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Quantity &amp; Amount</div>
                    <div style={{ fontWeight: 600 }}>{selectedOrderModal.quantity} units &bull; ₹{Number(selectedOrderModal.total_amount).toLocaleString()}</div>
                  </div>
                  <div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Payment Method</div>
                    <div style={{ fontWeight: 600 }}>{selectedOrderModal.payment_method}</div>
                  </div>
                </div>

                <div style={{ background: '#ecfdf5', padding: '14px 18px', borderRadius: '8px', border: '1px solid #bbf7d0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <span style={{ fontSize: '12px', color: '#166534', fontWeight: 600 }}>Earned Incentive:</span>
                    <div style={{ fontSize: '20px', fontWeight: 800, color: '#15803d' }}>
                      ₹{Number(selectedOrderModal.order_incentive || selectedOrderModal.incentive_amount || 0).toLocaleString()}
                    </div>
                  </div>
                  <span className="badge badge-success">Verified</span>
                </div>
              </div>
              <div className="modal-footer">
                <button className="btn btn-secondary" onClick={() => setSelectedOrderModal(null)}>Close</button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ==========================================
  // RENDER 2: OVERALL TEAM INCENTIVE VIEW
  // ==========================================
  return (
    <div className="page-body">
      {/* Header */}
      <div className="page-header" style={{ marginBottom: '16px', alignItems: 'flex-start' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div
            style={{
              width: '46px',
              height: '46px',
              borderRadius: '12px',
              background: 'linear-gradient(135deg, #059669, #10b981)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'white',
              boxShadow: '0 4px 12px rgba(16, 185, 129, 0.25)',
              flexShrink: 0
            }}
          >
            <Award size={24} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <h2 className="page-title" style={{ margin: 0, fontSize: '22px' }}>Incentive Records</h2>
              <span className="badge badge-info" style={{ fontSize: '11px', padding: '3px 8px' }}>
                {periodLabel}
              </span>
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
              Live Dynamic Incentives synchronized with Sales Reports
            </div>
          </div>
        </div>

        {/* Action Toolbar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={() => setShowImportModal(true)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '8px 14px', fontWeight: 600 }}
          >
            <FileSpreadsheet size={15} />
            <span>Import Orders (Excel)</span>
          </button>

          <button
            type="button"
            className={`btn ${showFilters ? 'btn-primary' : 'btn-secondary'} btn-sm`}
            onClick={() => setShowFilters(!showFilters)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '7px', padding: '8px 14px', fontWeight: 600, fontSize: '12.5px' }}
          >
            <Filter size={14} />
            <span>Filtration</span>
            <ChevronDown size={14} style={{ transform: showFilters ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s ease' }} />
          </button>

          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => handleExportSheetCsv(filteredSheetRows, 'All_Staff_Incentive_Sheet')}
            disabled={filteredSheetRows.length === 0}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 12px' }}
            title="Export Sheet Matrix as CSV"
          >
            <Download size={14} />
            <span>Export Sheet (.csv)</span>
          </button>

          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => setShowClearConfirm(true)}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 12px', color: '#dc2626', borderColor: '#fca5a5' }}
            title="Clear all orders and returns"
          >
            <Trash2 size={14} />
            <span>Clear Orders &amp; Returns</span>
          </button>
        </div>
      </div>

      {/* Toast Notification */}
      {toastMessage && (
        <div style={{ padding: '10px 16px', background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: '8px', color: '#065f46', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
          <CheckCircle2 size={16} color="#059669" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div style={{ padding: '10px 16px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', color: '#991b1b', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
          <AlertCircle size={16} color="#dc2626" />
          <span>{error}</span>
        </div>
      )}

      {/* Real-time Calculation Flow Strip */}
      <div className="calc-breakdown-bar">
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-muted)', fontWeight: 600 }}>
          <Sparkles size={15} color="var(--primary-600)" />
          <span>Team Incentive Calculation:</span>
        </div>
        <div className="calc-step">
          <span style={{ color: 'var(--text-muted)' }}>Total Incentive:</span>
          <strong style={{ color: '#d97706' }}>₹{Number(summary.earnedIncentive || summary.grossIncentive || 0).toLocaleString()}</strong>
        </div>
        <span className="calc-operator">&minus;</span>
        <div className="calc-step">
          <span style={{ color: 'var(--text-muted)' }}>Return Deductions:</span>
          <strong style={{ color: '#dc2626' }}>₹{Number(summary.returnAdjustments || summary.reversedIncentive || 0).toLocaleString()}</strong>
        </div>
        <span className="calc-operator">=</span>
        <div className="calc-step" style={{ background: '#ecfdf5', padding: '3px 10px', borderRadius: '6px', border: '1px solid #bbf7d0' }}>
          <span style={{ color: '#166534', fontWeight: 600 }}>Net Payable:</span>
          <strong style={{ color: '#16a34a', fontSize: '14px' }}>₹{Number(summary.netIncentive || 0).toLocaleString()}</strong>
        </div>
      </div>

      {/* 4 Summary Cards */}
      <div className="kpi-grid sales-kpi-grid" style={{ marginBottom: '22px' }}>
        <div className="kpi-card-premium" style={{ '--card-accent': '#3b82f6' }}>
          <div className="kpi-header">
            <span className="kpi-title">Total Orders</span>
            <div className="kpi-icon-wrap" style={{ background: '#eff6ff', color: '#2563eb' }}>
              <ShoppingCart size={19} />
            </div>
          </div>
          <div>
            <div className="kpi-value">{summary.totalOrders || 0}</div>
            <div className="kpi-subtext">Across {staffList.length} sales staff members</div>
          </div>
        </div>

        <div className="kpi-card-premium" style={{ '--card-accent': '#f59e0b' }}>
          <div className="kpi-header">
            <span className="kpi-title">Gross Incentive</span>
            <div className="kpi-icon-wrap" style={{ background: '#fef3c7', color: '#d97706' }}>
              <TrendingUp size={19} />
            </div>
          </div>
          <div>
            <div className="kpi-value" style={{ color: '#b45309' }}>
              ₹{Number(summary.earnedIncentive || summary.grossIncentive || 0).toLocaleString()}
            </div>
            <div className="kpi-subtext">Earned from valid sales orders</div>
          </div>
        </div>

        <div className="kpi-card-premium" style={{ '--card-accent': '#ef4444' }}>
          <div className="kpi-header">
            <span className="kpi-title">Return Deductions</span>
            <div className="kpi-icon-wrap" style={{ background: '#fef2f2', color: '#dc2626' }}>
              <RotateCcw size={19} />
            </div>
          </div>
          <div>
            <div className="kpi-value" style={{ color: '#dc2626' }}>
              {(summary.returnAdjustments || summary.reversedIncentive) > 0
                ? `-₹${Number(summary.returnAdjustments || summary.reversedIncentive).toLocaleString()}`
                : '₹0'}
            </div>
            <div className="kpi-subtext">Incentive reversed on returned orders</div>
          </div>
        </div>

        <div className="kpi-card-premium kpi-card-hero">
          <div className="kpi-header">
            <span className="kpi-title" style={{ color: '#166534', fontWeight: 800 }}>Net Team Incentive</span>
            <div className="kpi-icon-wrap" style={{ background: '#dcfce7', color: '#16a34a' }}>
              <CheckCircle2 size={20} />
            </div>
          </div>
          <div>
            <div className="kpi-value" style={{ color: '#15803d', fontSize: '28px' }}>
              ₹{Number(summary.netIncentive || 0).toLocaleString()}
            </div>
            <div className="kpi-subtext" style={{ color: '#166534' }}>Net payable team incentive</div>
          </div>
        </div>
      </div>

      {/* Filtration Card */}
      {showFilters && (
        <div className="filter-card" style={{ marginBottom: '22px' }}>
          <div className="filter-card-header">
            <div className="filter-title-wrap">
              <div className="filter-icon-box"><Filter size={15} /></div>
              <strong className="filter-title">Filtration</strong>
              <span className="filter-desc">(Filter by reporting period presets or custom date range)</span>
            </div>
            <button type="button" className="filter-hide-btn" onClick={() => setShowFilters(false)}>
              <X size={14} /> Hide
            </button>
          </div>

          <div className="filter-body">
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '14px' }}>
              {PRESETS.map(p => (
                <button
                  key={p.id}
                  type="button"
                  className={`btn btn-sm ${preset === p.id ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => handlePresetSelect(p.id)}
                  style={{ fontSize: '12px', padding: '6px 12px' }}
                >
                  {p.label}
                </button>
              ))}
            </div>

            {preset === 'custom' && (
              <form onSubmit={handleCustomDateApply} style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <label style={{ fontSize: '12px', fontWeight: 600 }}>Start Date:</label>
                  <input
                    type="date"
                    className="form-control"
                    value={startDate}
                    onChange={e => setStartDate(e.target.value)}
                    required
                  />
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <label style={{ fontSize: '12px', fontWeight: 600 }}>End Date:</label>
                  <input
                    type="date"
                    className="form-control"
                    value={endDate}
                    onChange={e => setEndDate(e.target.value)}
                    required
                  />
                </div>
                <button type="submit" className="btn btn-primary btn-sm">Apply Custom Range</button>
              </form>
            )}
          </div>
        </div>
      )}

      {/* View Mode Navigation Tabs & Search */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '16px' }}>
        <div style={{ display: 'inline-flex', background: '#f1f5f9', padding: '3px', borderRadius: '8px' }}>
          <button
            type="button"
            className={`btn btn-sm ${activeTab === 'sheet' ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setActiveTab('sheet')}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '13px', borderRadius: '6px' }}
          >
            <FileSpreadsheet size={15} />
            <span>Dynamic Sheet Matrix ({filteredSheetRows.length} rows)</span>
          </button>
          <button
            type="button"
            className={`btn btn-sm ${activeTab === 'staff' ? 'btn-primary' : 'btn-ghost'}`}
            onClick={() => setActiveTab('staff')}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '13px', borderRadius: '6px' }}
          >
            <User size={15} />
            <span>Staff Ranking &amp; Audit ({filteredStaffList.length} staff)</span>
          </button>
        </div>

        <div className="search-input-wrap" style={{ maxWidth: '320px', width: '100%' }}>
          <Search size={14} />
          <input
            type="text"
            className="search-input"
            placeholder="Search by staff name, Employee ID, date..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{ fontSize: '12.5px', height: '36px' }}
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch('')}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', padding: '0 6px' }}
              title="Clear search"
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {/* TAB 1: DYNAMIC SHEET MATRIX VIEW */}
      {activeTab === 'sheet' && (
        <div className="table-card">
          <div className="table-toolbar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ width: '28px', height: '28px', borderRadius: '6px', background: '#ecfdf5', color: '#047857', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <FileSpreadsheet size={16} />
              </div>
              <strong style={{ fontSize: '14.5px' }}>Dynamic Sheet Matrix (Grouped by Date &amp; Employee ID)</strong>
              <span className="badge badge-success" style={{ fontSize: '11px' }}>
                {filteredSheetRows.length} rows
              </span>
            </div>

            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => handleExportSheetCsv(filteredSheetRows, 'All_Staff_Incentive_Sheet')}
              disabled={filteredSheetRows.length === 0}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12px' }}
            >
              <Download size={14} />
              <span>Export Sheet (.csv)</span>
            </button>
          </div>

          <div className="responsive-table-view">
            <div className="table-responsive" style={{ maxHeight: '650px', overflowY: 'auto' }}>
              <table className="data-table" style={{ fontSize: '12.5px', width: '100%' }}>
                <thead style={{ position: 'sticky', top: 0, zIndex: 10, background: '#1e293b', color: '#ffffff' }}>
                  <tr>
                    {(data?.sheetColumns || []).map(col => {
                      const isNumeric = col.type === 'product' || col.type === 'return' || col.type === 'currency';
                      return (
                        <th
                          key={col.key}
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
                      <td colSpan={(data?.sheetColumns?.length) || 10} style={{ textAlign: 'center', padding: '32px' }}>
                        Loading dynamic sheet records...
                      </td>
                    </tr>
                  ) : filteredSheetRows.length === 0 ? (
                    <tr>
                      <td colSpan={(data?.sheetColumns?.length) || 10}>
                        <div className="empty-state">
                          <div className="empty-state-icon"><FileSpreadsheet size={24} /></div>
                          <div className="empty-state-title">No incentive records found</div>
                          <div className="empty-state-desc">
                            Import an Excel sheet using "Import Orders (Excel)" or select "All Records" preset.
                          </div>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredSheetRows.map((r, idx) => (
                      <tr key={`${r.date}_${r.staff_id || r.employee_id}_${idx}`}>
                        {(data?.sheetColumns || []).map(col => {
                          if (col.key === 'date') return <td key={col.key} style={{ fontWeight: 600 }}>{r.date}</td>;
                          if (col.key === 'employee_id') {
                            return (
                              <td key={col.key}>
                                <span className="badge badge-neutral" style={{ fontWeight: 700 }}>
                                  {r.employee_id || '—'}
                                </span>
                              </td>
                            );
                          }
                          if (col.key === 'staff_name') {
                            return (
                              <td key={col.key}>
                                {r.staff_id ? (
                                  <button
                                    type="button"
                                    onClick={() => setSelectedStaffId(r.staff_id)}
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
                                    title={`View ${r.staff_name}'s detailed incentive records`}
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
                                {r.incentive > 0 ? `₹${Number(r.incentive).toLocaleString()}` : '₹0'}
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
                                {r.return_deductions > 0 ? `-₹${Number(r.return_deductions).toLocaleString()}` : '₹0'}
                              </td>
                            );
                          }
                          if (col.key === 'total_net') {
                            return (
                              <td key={col.key} style={{ textAlign: 'right', fontWeight: 700, color: '#15803d' }}>
                                ₹{Number(r.total_net || 0).toLocaleString()}
                              </td>
                            );
                          }
                          return <td key={col.key}>—</td>;
                        })}
                      </tr>
                    ))
                  )}
                </tbody>
                {filteredSheetRows.length > 0 && (
                  <tfoot>
                    <tr style={{ background: '#f1f5f9', fontWeight: 700, position: 'sticky', bottom: 0, zIndex: 5, borderTop: '2px solid #cbd5e1' }}>
                      {(data?.sheetColumns || []).map((col, idx) => {
                        if (idx === 0) return <td key={col.key}>Total ({filteredSheetRows.length} rows)</td>;
                        if (col.key === 'employee_id' || col.key === 'staff_name') return <td key={col.key}></td>;
                        if (col.type === 'product' || col.type === 'return') {
                          const val = sheetTotals[col.key] || 0;
                          return (
                            <td key={col.key} style={{ textAlign: 'right', color: col.type === 'return' && val > 0 ? '#dc2626' : 'inherit' }}>
                              {val > 0 ? val : '—'}
                            </td>
                          );
                        }
                        if (col.key === 'incentive') {
                          return (
                            <td key={col.key} style={{ textAlign: 'right', color: '#059669' }}>
                              ₹{sheetTotals.incentive?.toLocaleString()}
                            </td>
                          );
                        }
                        if (col.key === 'return_deductions') {
                          return (
                            <td key={col.key} style={{ textAlign: 'right', color: '#dc2626' }}>
                              {sheetTotals.return_deductions > 0 ? `-₹${sheetTotals.return_deductions?.toLocaleString()}` : '₹0'}
                            </td>
                          );
                        }
                        if (col.key === 'total_net') {
                          return (
                            <td key={col.key} style={{ textAlign: 'right', color: '#15803d', fontSize: '13.5px' }}>
                              ₹{sheetTotals.total_net?.toLocaleString()}
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
      )}

      {/* TAB 2: STAFF INCENTIVE RANKING & AUDIT TABLE */}
      {activeTab === 'staff' && (
        <div className="table-card">
          <div className="table-toolbar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ width: '28px', height: '28px', borderRadius: '6px', background: '#e0e7ff', color: '#4338ca', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Award size={16} />
              </div>
              <strong style={{ fontSize: '14.5px' }}>Staff Incentive Ranking &amp; Audit</strong>
              <span className="badge badge-info" style={{ fontSize: '11px' }}>
                {filteredStaffList.length} staff
              </span>
            </div>

            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={handleExportStaffCsv}
              disabled={filteredStaffList.length === 0}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12px' }}
            >
              <Download size={13} />
              <span>Export Ranking (.csv)</span>
            </button>
          </div>

          <div className="responsive-table-view">
            <div className="table-responsive">
              <table className="data-table">
                <thead>
                  <tr>
                    <th style={{ width: '60px' }}>Rank</th>
                    <th onClick={() => handleSort('staff_name')} style={{ cursor: 'pointer' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <span>Staff Member</span>
                        <ArrowUpDown size={12} />
                      </div>
                    </th>
                    <th onClick={() => handleSort('total_orders')} style={{ textAlign: 'right', cursor: 'pointer' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '4px' }}>
                        <span>Total Orders</span>
                        <ArrowUpDown size={12} />
                      </div>
                    </th>
                    <th onClick={() => handleSort('gross_sales')} style={{ textAlign: 'right', cursor: 'pointer' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '4px' }}>
                        <span>Gross Sales</span>
                        <ArrowUpDown size={12} />
                      </div>
                    </th>
                    <th onClick={() => handleSort('earned_incentive')} style={{ textAlign: 'right', cursor: 'pointer' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '4px' }}>
                        <span>Earned Incentive</span>
                        <ArrowUpDown size={12} />
                      </div>
                    </th>
                    <th onClick={() => handleSort('return_adjustments')} style={{ textAlign: 'right', cursor: 'pointer' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '4px' }}>
                        <span>Return Deductions</span>
                        <ArrowUpDown size={12} />
                      </div>
                    </th>
                    <th onClick={() => handleSort('net_incentive')} style={{ textAlign: 'right', cursor: 'pointer' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '4px' }}>
                        <span>Net Payable</span>
                        <ArrowUpDown size={12} />
                      </div>
                    </th>
                    <th style={{ textAlign: 'center', width: '90px' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan="8" style={{ textAlign: 'center', padding: '32px' }}>Loading staff rankings...</td>
                    </tr>
                  ) : sortedStaffList.length === 0 ? (
                    <tr>
                      <td colSpan="8">
                        <div className="empty-state">
                          <div className="empty-state-icon"><User size={24} /></div>
                          <div className="empty-state-title">No staff records found</div>
                          <div className="empty-state-desc">No sales staff matched your active filters.</div>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    sortedStaffList.map((s, idx) => {
                      const netVal = s.net_incentive || 0;
                      const earnedVal = s.earned_incentive || s.gross_incentive || 0;
                      const returnVal = s.return_adjustments || s.reversed_incentive || 0;
                      return (
                        <tr
                          key={s.staff_id}
                          className="table-row-clickable"
                          onClick={() => {
                            setSearch('');
                            setSelectedStaffId(s.staff_id);
                          }}
                        >
                          <td style={{ fontWeight: 700, color: idx < 3 ? '#b45309' : 'inherit' }}>
                            #{idx + 1}
                          </td>
                          <td>
                            <div>
                              <strong>{s.staff_name || s.name}</strong>
                              <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                                <span className="badge badge-neutral" style={{ padding: '1px 6px', fontSize: '10.5px', marginRight: '6px' }}>
                                  {s.staff_code}
                                </span>
                                @{s.username}
                              </div>
                            </div>
                          </td>
                          <td style={{ textAlign: 'right', fontWeight: 600 }}>{s.total_orders || 0}</td>
                          <td style={{ textAlign: 'right' }}>₹{Number(s.gross_sales || 0).toLocaleString()}</td>
                          <td style={{ textAlign: 'right', color: earnedVal > 0 ? '#b45309' : 'inherit', fontWeight: 600 }}>
                            ₹{Number(earnedVal).toLocaleString()}
                          </td>
                          <td style={{ textAlign: 'right', color: returnVal > 0 ? '#dc2626' : 'inherit', fontWeight: returnVal > 0 ? 600 : 400 }}>
                            {returnVal > 0 ? `-₹${Number(returnVal).toLocaleString()}` : '₹0'}
                          </td>
                          <td style={{ textAlign: 'right', color: '#16a34a', fontWeight: 800, fontSize: '14px' }}>
                            ₹{Number(netVal).toLocaleString()}
                          </td>
                          <td style={{ textAlign: 'center' }}>
                            <button
                              type="button"
                              className="btn btn-secondary btn-sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSearch('');
                                setSelectedStaffId(s.staff_id);
                              }}
                              style={{ padding: '4px 10px', fontSize: '12px' }}
                            >
                              Details &rarr;
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Order Excel Import Modal */}
      <BulkOrderImportModal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
        onSuccess={handleImportSuccess}
      />

      {/* Clear Confirmation Modal */}
      <ClearConfirmModal
        isOpen={showClearConfirm}
        onClose={() => setShowClearConfirm(false)}
        onConfirm={handleClearAll}
        clearing={clearing}
      />
    </div>
  );
}
