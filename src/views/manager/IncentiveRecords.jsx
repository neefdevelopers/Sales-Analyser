// src/views/manager/IncentiveRecords.jsx
import React, { useState, useEffect } from 'react';
import { api } from '../../api';
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
  Download
} from 'lucide-react';

const MONTHS = [
  { value: 1, label: 'January' },
  { value: 2, label: 'February' },
  { value: 3, label: 'March' },
  { value: 4, label: 'April' },
  { value: 5, label: 'May' },
  { value: 6, label: 'June' },
  { value: 7, label: 'July' },
  { value: 8, label: 'August' },
  { value: 9, label: 'September' },
  { value: 10, label: 'October' },
  { value: 11, label: 'November' },
  { value: 12, label: 'December' }
];

const YEARS = [2024, 2025, 2026, 2027, 2028];

export default function IncentiveRecords() {
  const [currentYear, setCurrentYear] = useState(2026);
  const [currentMonth, setCurrentMonth] = useState(10);

  // Navigation state: null for monthly staff summary list; number for staff detail view
  const [selectedStaffId, setSelectedStaffId] = useState(null);

  // Data states
  const [summaryData, setSummaryData] = useState(null);
  const [staffDetailData, setStaffDetailData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Complete Order Details Modal
  const [selectedOrderModal, setSelectedOrderModal] = useState(null);

  // Fetch current business time on mount to initialize default month/year
  useEffect(() => {
    async function initTime() {
      try {
        const timeRes = await api.get('/system/time');
        if (timeRes?.currentDate) {
          const parts = timeRes.currentDate.split('-');
          const y = parseInt(parts[0], 10);
          const m = parseInt(parts[1], 10);
          if (y) setCurrentYear(y);
          if (m) setCurrentMonth(m);
        }
      } catch (err) {
        // Fallback to default
      }
    }
    initTime();
  }, []);

  // Fetch data whenever year, month, or selectedStaffId changes
  useEffect(() => {
    if (selectedStaffId === null) {
      fetchMonthlySummary();
    } else {
      fetchStaffDetails(selectedStaffId);
    }
  }, [currentYear, currentMonth, selectedStaffId]);

  async function fetchMonthlySummary() {
    setLoading(true);
    try {
      const res = await api.get(`/incentives/monthly-summary?year=${currentYear}&month=${currentMonth}`);
      setSummaryData(res);
    } catch (err) {
      console.error('Failed to load monthly summary:', err);
    } finally {
      setLoading(false);
    }
  }

  async function fetchStaffDetails(staffId) {
    setLoading(true);
    try {
      const res = await api.get(`/incentives/staff/${staffId}/monthly?year=${currentYear}&month=${currentMonth}`);
      setStaffDetailData(res);
    } catch (err) {
      console.error('Failed to load staff details:', err);
    } finally {
      setLoading(false);
    }
  }

  function handlePrevMonth() {
    if (currentMonth === 1) {
      setCurrentMonth(12);
      setCurrentYear(prev => prev - 1);
    } else {
      setCurrentMonth(prev => prev - 1);
    }
  }

  function handleNextMonth() {
    if (currentMonth === 12) {
      setCurrentMonth(1);
      setCurrentYear(prev => prev + 1);
    } else {
      setCurrentMonth(prev => prev + 1);
    }
  }

  // Filter staff list in summary view
  const staffList = summaryData?.staffSummaries || [];
  const filteredStaff = staffList.filter(s => {
    if (!search.trim()) return true;
    const term = search.trim().toLowerCase();
    return (
      s.name.toLowerCase().includes(term) ||
      s.staff_code.toLowerCase().includes(term) ||
      s.username.toLowerCase().includes(term)
    );
  });

  const totals = summaryData?.totals || {
    total_staff: 0,
    total_orders: 0,
    total_incentive: 0,
    return_adjustments: 0,
    net_incentive: 0
  };

  const currentMonthName = MONTHS.find(m => m.value === currentMonth)?.label || 'Month';

  // Export CSV for current monthly staff list
  function handleExportMonthlyCsv() {
    if (filteredStaff.length === 0) return;

    const headers = [
      'Staff Name',
      'Staff ID',
      'Reporting Period',
      'Total Orders',
      'Total Incentive (INR)',
      'Return Adjustments (INR)',
      'Net Incentive (INR)'
    ];

    const rows = filteredStaff.map(s => [
      `"${s.name}"`,
      `"${s.staff_code}"`,
      `"${currentMonthName} ${currentYear}"`,
      s.total_orders,
      s.total_incentive,
      s.return_adjustments,
      s.net_incentive
    ]);

    const csvContent = [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `monthly-staff-incentives-${currentYear}-${String(currentMonth).padStart(2, '0')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  // ==========================================
  // RENDER 1: STAFF-WISE INCENTIVE DETAILS
  // ==========================================
  if (selectedStaffId !== null) {
    const staff = staffDetailData?.staff;
    const summary = staffDetailData?.summary || {
      totalOrders: 0,
      grossIncentive: 0,
      returnAdjustments: 0,
      netIncentive: 0
    };
    const orders = staffDetailData?.orders || [];

    // Filter orders by search if user types
    const filteredOrders = orders.filter(o => {
      if (!search.trim()) return true;
      const term = search.trim().toLowerCase();
      return (
        o.order_number.toLowerCase().includes(term) ||
        o.product_name.toLowerCase().includes(term) ||
        o.customer_name.toLowerCase().includes(term)
      );
    });

    return (
      <div className="page-body">
        {/* Navigation & Period Header */}
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
              <span>Back to Monthly Staff List</span>
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              <h2 className="page-title" style={{ margin: 0, fontSize: '22px' }}>
                {staff?.name || 'Staff Member'}
              </h2>
              <span className="badge badge-neutral" style={{ fontSize: '12px' }}>
                {staff?.staff_code}
              </span>
              <span className="badge badge-info" style={{ fontSize: '11.5px' }}>
                {currentMonthName} {currentYear}
              </span>
            </div>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '3px', margin: 0 }}>
              Order-wise breakdown and return adjustments for orders created in {currentMonthName} {currentYear}.
            </p>
          </div>

          {/* Month / Year Selector in Detail View */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button className="btn btn-secondary btn-sm" onClick={handlePrevMonth} title="Previous Month">
              <ChevronLeft size={16} />
            </button>
            <select
              className="form-control"
              style={{ width: 'auto', padding: '6px 10px', fontSize: '13px', fontWeight: 600 }}
              value={currentMonth}
              onChange={e => setCurrentMonth(parseInt(e.target.value, 10))}
            >
              {MONTHS.map(m => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
            <select
              className="form-control"
              style={{ width: 'auto', padding: '6px 10px', fontSize: '13px', fontWeight: 600 }}
              value={currentYear}
              onChange={e => setCurrentYear(parseInt(e.target.value, 10))}
            >
              {YEARS.map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
            <button className="btn btn-secondary btn-sm" onClick={handleNextMonth} title="Next Month">
              <ChevronRight size={16} />
            </button>
          </div>
        </div>

        {/* Staff Summary Cards (4) */}
        <div className="kpi-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '22px' }}>
          <div className="kpi-card-premium" style={{ '--card-accent': '#3b82f6' }}>
            <div className="kpi-header">
              <span className="kpi-title">Total Orders</span>
              <div className="kpi-icon-wrap" style={{ background: '#eff6ff', color: '#2563eb' }}>
                <ShoppingCart size={19} />
              </div>
            </div>
            <div>
              <div className="kpi-value">{summary.totalOrders}</div>
              <div className="kpi-subtext">Orders placed in {currentMonthName}</div>
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
                ₹{summary.grossIncentive?.toLocaleString() ?? 0}
              </div>
              <div className="kpi-subtext">Calculated order earnings</div>
            </div>
          </div>

          <div className="kpi-card-premium" style={{ '--card-accent': '#ef4444' }}>
            <div className="kpi-header">
              <span className="kpi-title">Return Adjustments</span>
              <div className="kpi-icon-wrap" style={{ background: '#fef2f2', color: '#dc2626' }}>
                <RotateCcw size={19} />
              </div>
            </div>
            <div>
              <div className="kpi-value" style={{ color: '#dc2626' }}>
                {summary.returnAdjustments > 0 ? `-₹${summary.returnAdjustments.toLocaleString()}` : '₹0'}
              </div>
              <div className="kpi-subtext">Reversals on returned items</div>
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
                ₹{summary.netIncentive?.toLocaleString() ?? 0}
              </div>
              <div className="kpi-subtext" style={{ color: '#166534' }}>Reconciled net payout</div>
            </div>
          </div>
        </div>

        {/* Order-Wise Incentive Table Card */}
        <div className="table-card">
          <div className="table-toolbar">
            <div className="search-input-wrap">
              <Search size={16} />
              <input
                type="text"
                className="search-input"
                placeholder="Search orders by #, customer, product..."
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
              Showing <strong>{filteredOrders.length}</strong> of <strong>{orders.length}</strong> orders for {staff?.name}
            </div>
          </div>

          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Order ID</th>
                  <th>Date</th>
                  <th>Product</th>
                  <th>Payment Method</th>
                  <th>Quantity</th>
                  <th>Order Incentive</th>
                  <th>Return Adjustment</th>
                  <th>Net Incentive</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan="9" style={{ textAlign: 'center', padding: '32px' }}>Loading order incentives...</td>
                  </tr>
                ) : filteredOrders.length === 0 ? (
                  <tr>
                    <td colSpan="9">
                      <div className="empty-state">
                        <div className="empty-state-icon"><ShoppingCart size={24} /></div>
                        <div className="empty-state-title">No orders found</div>
                        <div className="empty-state-desc">This staff member has no eligible orders in {currentMonthName} {currentYear}.</div>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredOrders.map(o => (
                    <tr
                      key={o.id}
                      className="table-row-clickable"
                      onClick={() => setSelectedOrderModal(o)}
                    >
                      <td>
                        <strong style={{ color: 'var(--primary-700)' }}>{o.order_number}</strong>
                      </td>
                      <td>{o.order_date}</td>
                      <td>
                        <div><strong>{o.product_name}</strong></div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                          {o.product_code} (₹{o.unit_price}/unit)
                        </div>
                      </td>
                      <td>
                        <span className={`badge ${o.payment_method === 'Prepaid' ? 'badge-success' : 'badge-neutral'}`}>
                          {o.payment_method}
                        </span>
                      </td>
                      <td>
                        <strong>{o.quantity}</strong>
                        {o.returned_quantity > 0 && (
                          <span style={{ fontSize: '11px', color: 'var(--danger-text)', marginLeft: '4px' }}>
                            (-{o.returned_quantity} ret.)
                          </span>
                        )}
                      </td>
                      <td style={{ color: '#d97706', fontWeight: 700 }}>
                        ₹{o.order_incentive}
                      </td>
                      <td style={{ color: o.return_adjustment > 0 ? '#dc2626' : 'var(--text-muted)', fontWeight: o.return_adjustment > 0 ? 700 : 400 }}>
                        {o.return_adjustment > 0 ? `-₹${o.return_adjustment}` : '₹0'}
                      </td>
                      <td style={{ color: '#16a34a', fontWeight: 800, fontSize: '14px' }}>
                        ₹{o.net_incentive}
                      </td>
                      <td>
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedOrderModal(o);
                          }}
                          title="View Complete Order Details"
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

          {/* Reconciliation Footer Strip */}
          {orders.length > 0 && (
            <div style={{ padding: '14px 20px', background: '#f8fafc', borderTop: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12.5px', color: 'var(--text-muted)' }}>
                <CheckCircle2 size={16} color="#16a34a" />
                <span>Reconciliation Status: <strong>Order-level and staff-level totals match 100%</strong></span>
              </div>
              <div style={{ fontSize: '13px' }}>
                Gross: <strong>₹{summary.grossIncentive?.toLocaleString()}</strong> &minus; Returns: <strong>₹{summary.returnAdjustments?.toLocaleString()}</strong> = Net: <strong style={{ color: '#16a34a' }}>₹{summary.netIncentive?.toLocaleString()}</strong>
              </div>
            </div>
          )}
        </div>

        {/* Complete Order Details Modal */}
        {selectedOrderModal && (
          <div className="modal-overlay">
            <div className="modal-dialog" style={{ maxWidth: '640px' }}>
              <div className="modal-header">
                <h3 className="modal-title">Order Audit: {selectedOrderModal.order_number}</h3>
                <button className="modal-close" onClick={() => setSelectedOrderModal(null)}>✕</button>
              </div>
              <div className="modal-body">
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                  <div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Customer Info</div>
                    <div style={{ fontWeight: 700, fontSize: '15px' }}>{selectedOrderModal.customer_name}</div>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Phone: {selectedOrderModal.customer_phone}</div>
                    {selectedOrderModal.customer_address && (
                      <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                        Address: {selectedOrderModal.customer_address}
                      </div>
                    )}
                  </div>

                  <div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Product Details</div>
                    <div style={{ fontWeight: 700, fontSize: '15px' }}>{selectedOrderModal.product_name}</div>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>SKU: {selectedOrderModal.product_code}</div>
                    <div style={{ fontSize: '12px' }}>
                      Ordered: <strong>{selectedOrderModal.quantity} units</strong> @ ₹{selectedOrderModal.unit_price}
                    </div>
                  </div>
                </div>

                <div className="preview-box" style={{ marginBottom: '16px' }}>
                  <div className="preview-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
                    <div>
                      <div className="preview-item-label">Order Total</div>
                      <div className="preview-item-val" style={{ color: 'var(--primary-700)' }}>
                        ₹{Number(selectedOrderModal.total_amount).toLocaleString()}
                      </div>
                    </div>
                    <div>
                      <div className="preview-item-label">Payment</div>
                      <div style={{ fontWeight: 700 }}>{selectedOrderModal.payment_method}</div>
                    </div>
                    <div>
                      <div className="preview-item-label">Gross Incentive</div>
                      <div className="preview-item-val" style={{ color: '#d97706' }}>
                        ₹{selectedOrderModal.order_incentive}
                      </div>
                      <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                        {selectedOrderModal.incentive_type === 'fixed'
                          ? `Fixed ₹${selectedOrderModal.incentive_rate}`
                          : `${selectedOrderModal.incentive_rate}%`} ({selectedOrderModal.incentive_basis})
                      </div>
                    </div>
                    <div>
                      <div className="preview-item-label">Net Incentive</div>
                      <div className="preview-item-val" style={{ color: '#16a34a' }}>
                        ₹{selectedOrderModal.net_incentive}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Return Details breakdown if returns exist */}
                {selectedOrderModal.returns && selectedOrderModal.returns.length > 0 ? (
                  <div style={{ marginTop: '16px', background: '#fef2f2', border: '1px solid #fee2e2', borderRadius: 'var(--radius-md)', padding: '12px 16px' }}>
                    <div style={{ fontSize: '12.5px', fontWeight: 700, color: '#b91c1c', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <RotateCcw size={14} color="#dc2626" />
                      <span>Associated Return Adjustments ({selectedOrderModal.returns.length}):</span>
                    </div>
                    <table style={{ width: '100%', fontSize: '12px', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ borderBottom: '1px solid #fecaca', textAlign: 'left', color: '#991b1b' }}>
                          <th style={{ padding: '4px 6px' }}>Return #</th>
                          <th style={{ padding: '4px 6px' }}>Return Date</th>
                          <th style={{ padding: '4px 6px' }}>Returned Qty</th>
                          <th style={{ padding: '4px 6px' }}>Reversed Incentive</th>
                          <th style={{ padding: '4px 6px' }}>Reason</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedOrderModal.returns.map(ret => (
                          <tr key={ret.id} style={{ borderBottom: '1px solid #fee2e2' }}>
                            <td style={{ padding: '6px 6px', fontWeight: 600 }}>{ret.return_number}</td>
                            <td style={{ padding: '6px 6px' }}>{ret.return_date}</td>
                            <td style={{ padding: '6px 6px', fontWeight: 600 }}>{ret.return_quantity} units</td>
                            <td style={{ padding: '6px 6px', color: '#dc2626', fontWeight: 700 }}>-₹{ret.reversed_incentive}</td>
                            <td style={{ padding: '6px 6px' }}>{ret.return_reason}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)', background: '#f8fafc', padding: '10px 14px', borderRadius: 'var(--radius-sm)' }}>
                    No returns have been recorded against this order.
                  </div>
                )}

                {selectedOrderModal.remarks && (
                  <div style={{ marginTop: '14px', fontSize: '12px', background: '#f8fafc', padding: '8px 12px', borderRadius: 'var(--radius-sm)' }}>
                    <strong>Remarks:</strong> {selectedOrderModal.remarks}
                  </div>
                )}
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
  // RENDER 2: MONTHLY STAFF INCENTIVE LIST
  // ==========================================
  return (
    <div className="page-body">
      {/* Header with Month/Year Period Picker */}
      <div className="page-header" style={{ marginBottom: '16px', alignItems: 'flex-start' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div
            style={{
              width: '46px',
              height: '46px',
              borderRadius: '12px',
              background: 'linear-gradient(135deg, var(--primary-600), #4f46e5)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'white',
              boxShadow: '0 4px 12px rgba(79, 70, 229, 0.22)',
              flexShrink: 0
            }}
          >
            <Award size={24} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <h2 className="page-title" style={{ margin: 0, fontSize: '22px' }}>Incentive Records</h2>
              <span className="badge badge-info" style={{ fontSize: '11px', padding: '3px 8px' }}>
                Monthly Staff Summary
              </span>
            </div>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '3px', margin: 0 }}>
              Staff-wise incentive earnings and return adjustments for orders placed in {currentMonthName} {currentYear}.
            </p>
          </div>
        </div>

        {/* Month and Year Period Selector */}
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: '#ffffff', padding: '4px 8px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)', boxShadow: 'var(--shadow-xs)' }}>
            <Calendar size={15} color="var(--primary-600)" />
            <button className="btn btn-secondary btn-sm" onClick={handlePrevMonth} style={{ padding: '4px 8px', height: '28px' }} title="Previous Month">
              <ChevronLeft size={14} />
            </button>
            <select
              className="form-control"
              style={{ width: 'auto', padding: '4px 8px', fontSize: '13px', fontWeight: 600, border: 'none', background: 'transparent' }}
              value={currentMonth}
              onChange={e => setCurrentMonth(parseInt(e.target.value, 10))}
            >
              {MONTHS.map(m => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
            <select
              className="form-control"
              style={{ width: 'auto', padding: '4px 8px', fontSize: '13px', fontWeight: 600, border: 'none', background: 'transparent' }}
              value={currentYear}
              onChange={e => setCurrentYear(parseInt(e.target.value, 10))}
            >
              {YEARS.map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
            <button className="btn btn-secondary btn-sm" onClick={handleNextMonth} style={{ padding: '4px 8px', height: '28px' }} title="Next Month">
              <ChevronRight size={14} />
            </button>
          </div>

          <button
            className="btn btn-secondary btn-sm"
            onClick={handleExportMonthlyCsv}
            disabled={filteredStaff.length === 0}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 12px' }}
          >
            <Download size={14} />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Real-time Calculation Flow Strip */}
      <div className="calc-breakdown-bar">
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-muted)', fontWeight: 600 }}>
          <Sparkles size={15} color="var(--primary-600)" />
          <span>{currentMonthName} {currentYear} Team Total:</span>
        </div>
        <div className="calc-step">
          <span style={{ color: 'var(--text-muted)' }}>Total Incentive:</span>
          <strong style={{ color: '#d97706' }}>₹{totals.total_incentive?.toLocaleString() ?? 0}</strong>
        </div>
        <span className="calc-operator">&minus;</span>
        <div className="calc-step">
          <span style={{ color: 'var(--text-muted)' }}>Return Adjustments:</span>
          <strong style={{ color: '#dc2626' }}>₹{totals.return_adjustments?.toLocaleString() ?? 0}</strong>
        </div>
        <span className="calc-operator">=</span>
        <div className="calc-step" style={{ background: '#ecfdf5', padding: '3px 10px', borderRadius: '6px', border: '1px solid #bbf7d0' }}>
          <span style={{ color: '#166534', fontWeight: 600 }}>Net Incentive:</span>
          <strong style={{ color: '#16a34a', fontSize: '14px' }}>₹{totals.net_incentive?.toLocaleString() ?? 0}</strong>
        </div>
      </div>

      {/* 4 Summary Cards */}
      <div className="kpi-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '22px' }}>
        <div className="kpi-card-premium" style={{ '--card-accent': '#3b82f6' }}>
          <div className="kpi-header">
            <span className="kpi-title">Total Orders</span>
            <div className="kpi-icon-wrap" style={{ background: '#eff6ff', color: '#2563eb' }}>
              <ShoppingCart size={19} />
            </div>
          </div>
          <div>
            <div className="kpi-value">{totals.total_orders ?? 0}</div>
            <div className="kpi-subtext">Orders placed across {totals.total_staff} staff</div>
          </div>
        </div>

        <div className="kpi-card-premium" style={{ '--card-accent': '#f59e0b' }}>
          <div className="kpi-header">
            <span className="kpi-title">Total Incentive</span>
            <div className="kpi-icon-wrap" style={{ background: '#fef3c7', color: '#d97706' }}>
              <TrendingUp size={19} />
            </div>
          </div>
          <div>
            <div className="kpi-value" style={{ color: '#b45309' }}>
              ₹{totals.total_incentive?.toLocaleString() ?? 0}
            </div>
            <div className="kpi-subtext">Gross staff incentive earned</div>
          </div>
        </div>

        <div className="kpi-card-premium" style={{ '--card-accent': '#ef4444' }}>
          <div className="kpi-header">
            <span className="kpi-title">Return Adjustments</span>
            <div className="kpi-icon-wrap" style={{ background: '#fef2f2', color: '#dc2626' }}>
              <RotateCcw size={19} />
            </div>
          </div>
          <div>
            <div className="kpi-value" style={{ color: '#dc2626' }}>
              {totals.return_adjustments > 0 ? `-₹${totals.return_adjustments?.toLocaleString()}` : '₹0'}
            </div>
            <div className="kpi-subtext">Returns against {currentMonthName} orders</div>
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
              ₹{totals.net_incentive?.toLocaleString() ?? 0}
            </div>
            <div className="kpi-subtext" style={{ color: '#166534' }}>Net payable team incentive</div>
          </div>
        </div>
      </div>

      {/* Staff Incentive List Table Card */}
      <div className="table-card">
        <div className="table-toolbar">
          <div className="search-input-wrap">
            <Search size={16} />
            <input
              type="text"
              className="search-input"
              placeholder="Search staff by name or Staff ID..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
            Showing <strong>{filteredStaff.length}</strong> active sales staff &bull; Click any staff row to inspect detailed orders
          </div>
        </div>

        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th>Staff</th>
                <th style={{ textAlign: 'right' }}>Total Orders</th>
                <th style={{ textAlign: 'right' }}>Total Incentive</th>
                <th style={{ textAlign: 'right' }}>Return Adjustments</th>
                <th style={{ textAlign: 'right' }}>Net Incentive</th>
                <th style={{ textAlign: 'center', width: '80px' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="6" style={{ textAlign: 'center', padding: '32px' }}>Loading staff incentives...</td>
                </tr>
              ) : filteredStaff.length === 0 ? (
                <tr>
                  <td colSpan="6">
                    <div className="empty-state">
                      <div className="empty-state-icon"><User size={24} /></div>
                      <div className="empty-state-title">No staff found</div>
                      <div className="empty-state-desc">No active staff accounts matched your search.</div>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredStaff.map((s) => (
                  <tr
                    key={s.staff_id}
                    className="table-row-clickable"
                    onClick={() => {
                      setSearch('');
                      setSelectedStaffId(s.staff_id);
                    }}
                  >
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div>
                          <strong>{s.name}</strong>
                          <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                            <span className="badge badge-neutral" style={{ padding: '1px 6px', fontSize: '10.5px', marginRight: '6px' }}>
                              {s.staff_code}
                            </span>
                            @{s.username}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 600 }}>
                      {s.total_orders}
                    </td>
                    <td style={{ textAlign: 'right', color: s.total_incentive > 0 ? '#b45309' : 'var(--text-muted)', fontWeight: 700 }}>
                      ₹{s.total_incentive?.toLocaleString()}
                    </td>
                    <td style={{ textAlign: 'right', color: s.return_adjustments > 0 ? '#dc2626' : 'var(--text-muted)', fontWeight: s.return_adjustments > 0 ? 700 : 400 }}>
                      {s.return_adjustments > 0 ? `-₹${s.return_adjustments?.toLocaleString()}` : '₹0'}
                    </td>
                    <td style={{ textAlign: 'right', color: '#16a34a', fontWeight: 800, fontSize: '14px' }}>
                      ₹{s.net_incentive?.toLocaleString()}
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
                        title="View Staff Orders Breakdown"
                        style={{ padding: '4px 10px', fontSize: '12px' }}
                      >
                        Details &rarr;
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
  );
}
