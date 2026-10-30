// src/views/manager/StaffPerformanceAnalysis.jsx
import React, { useState, useEffect } from 'react';
import { api } from '../../api';
import {
  BarChart3,
  Search,
  Download,
  Filter,
  Eye,
  CheckCircle,
  AlertTriangle,
  ArrowUpDown,
  CreditCard,
  Package,
  MessageSquare,
  Save,
  Clock,
  PhoneCall,
  HelpCircle,
  ShoppingCart,
  RotateCcw,
  ClipboardCheck
} from 'lucide-react';

export default function StaffPerformanceAnalysis({ initialStaffId }) {
  const [performance, setPerformance] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [sortBy, setSortBy] = useState('net_sales');
  const [sortDir, setSortDir] = useState('desc');

  // Drilldown modal state
  const [selectedStaffDetail, setSelectedStaffDetail] = useState(null);
  const [drilldownLoading, setDrilldownLoading] = useState(false);
  const [managerRemarkInput, setManagerRemarkInput] = useState('');
  const [savingRemark, setSavingRemark] = useState(false);
  const [activeTab, setActiveTab] = useState('orders');
  const [notification, setNotification] = useState('');

  useEffect(() => {
    fetchPerformance();
  }, [sortBy, sortDir]);

  useEffect(() => {
    if (initialStaffId) {
      openStaffDrilldown(initialStaffId);
    }
  }, [initialStaffId]);

  async function fetchPerformance(customStart, customEnd) {
    setLoading(true);
    try {
      let queryStr = `?sortBy=${sortBy}&sortDir=${sortDir}`;
      if (customStart || startDate) queryStr += `&startDate=${customStart || startDate}`;
      if (customEnd || endDate) queryStr += `&endDate=${customEnd || endDate}`;
      if (search) queryStr += `&search=${encodeURIComponent(search)}`;

      const res = await api.get(`/performance${queryStr}`);
      setPerformance(res.performance || []);
    } catch (err) {
      console.error('Failed to load performance analysis:', err);
    } finally {
      setLoading(false);
    }
  }

  function handleSort(column) {
    if (sortBy === column) {
      setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(column);
      setSortDir('desc');
    }
  }

  function handleFilterSubmit(e) {
    e.preventDefault();
    fetchPerformance(startDate, endDate);
  }

  async function openStaffDrilldown(staffId) {
    setDrilldownLoading(true);
    try {
      let queryStr = '';
      if (startDate) queryStr += `?startDate=${startDate}`;
      if (endDate) queryStr += `${queryStr ? '&' : '?'}endDate=${endDate}`;

      const res = await api.get(`/performance/staff/${staffId}${queryStr}`);
      setSelectedStaffDetail(res);
      setManagerRemarkInput(res.managerRemarks || '');
      setActiveTab('orders');
    } catch (err) {
      alert('Failed to load staff performance details: ' + err.message);
    } finally {
      setDrilldownLoading(false);
    }
  }

  async function handleSaveManagerRemarks() {
    if (!selectedStaffDetail) return;
    setSavingRemark(true);
    try {
      await api.post(`/performance/staff/${selectedStaffDetail.staff.id}/remarks`, {
        remarks: managerRemarkInput
      });
      setNotification(`Performance observations saved for ${selectedStaffDetail.staff.name}.`);
      setTimeout(() => setNotification(''), 4000);
      fetchPerformance();
    } catch (err) {
      alert('Failed to save remarks: ' + err.message);
    } finally {
      setSavingRemark(false);
    }
  }

  function handleExportCsv() {
    let url = '/api/performance/export';
    const params = [];
    if (startDate) params.push(`startDate=${startDate}`);
    if (endDate) params.push(`endDate=${endDate}`);
    const token = localStorage.getItem('sales_token');
    if (token) params.push(`token=${token}`);
    if (params.length > 0) url += `?${params.join('&')}`;
    window.open(url, '_blank');
  }

  return (
    <div className="page-body">
      {/* Toast Notification */}
      {notification && (
        <div className="toast-container">
          <div className="toast success">
            <CheckCircle size={18} color="var(--success-solid)" />
            <span>{notification}</span>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="page-header">
        <div>
          <h2 className="page-title">Staff Sales Performance Analysis</h2>
          <p className="page-subtitle">Detailed metric breakdown per sales staff member, incentive audit, and manager remarks</p>
        </div>

        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <form onSubmit={handleFilterSubmit} style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
            <input
              type="date"
              className="form-control"
              style={{ padding: '6px 10px', fontSize: '12px' }}
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
            />
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>to</span>
            <input
              type="date"
              className="form-control"
              style={{ padding: '6px 10px', fontSize: '12px' }}
              value={endDate}
              onChange={e => setEndDate(e.target.value)}
            />
            <button type="submit" className="btn btn-secondary btn-sm">Filter</button>
          </form>

          <button className="btn btn-primary btn-sm" onClick={handleExportCsv}>
            <Download size={14} />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Table Card */}
      <div className="table-card">
        <div className="table-toolbar">
          <div className="search-input-wrap">
            <Search size={16} />
            <input
              type="text"
              className="search-input"
              placeholder="Search staff by name or staff ID..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && fetchPerformance()}
            />
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
            Click table column headers to sort ascending / descending
          </div>
        </div>

        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th className="sortable" onClick={() => handleSort('staff_code')}>Staff ID / Name</th>
                <th className="sortable" onClick={() => handleSort('total_orders')}>Orders</th>
                <th className="sortable" onClick={() => handleSort('gross_sales')}>Gross Sales</th>
                <th className="sortable" onClick={() => handleSort('returned_amount')}>Returns</th>
                <th className="sortable" onClick={() => handleSort('net_sales')}>Net Sales</th>
                <th className="sortable" onClick={() => handleSort('total_customers')}>Customers</th>
                <th className="sortable" onClick={() => handleSort('net_quantity')}>Net Qty</th>
                <th className="sortable" onClick={() => handleSort('total_enquiries')}>Enquiries</th>
                <th className="sortable" onClick={() => handleSort('enquiry_conversion_rate')}>Enq Conv %</th>
                <th className="sortable" onClick={() => handleSort('total_calls')}>Calls (Conn %)</th>
                <th className="sortable" onClick={() => handleSort('net_incentive')}>Net Incentive</th>
                <th>Daily Activity</th>
                <th>Remarks</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="14" style={{ textAlign: 'center', padding: '32px' }}>Loading performance data...</td>
                </tr>
              ) : performance.length === 0 ? (
                <tr>
                  <td colSpan="14">
                    <div className="empty-state">
                      <div className="empty-state-icon"><BarChart3 size={24} /></div>
                      <div className="empty-state-title">No staff records match filter</div>
                    </div>
                  </td>
                </tr>
              ) : (
                performance.map((s) => (
                  <tr key={s.staff_id}>
                    <td>
                      <div><strong>{s.name}</strong></div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                        {s.staff_code}
                      </div>
                    </td>
                    <td><strong>{s.total_orders}</strong></td>
                    <td>₹{s.gross_sales.toLocaleString()}</td>
                    <td>
                      {s.total_returns > 0 ? (
                        <div style={{ color: 'var(--danger-solid)' }}>
                          -₹{s.returned_amount.toLocaleString()} ({s.returned_quantity}u)
                        </div>
                      ) : (
                        <span style={{ color: 'var(--text-subtle)' }}>₹0</span>
                      )}
                    </td>
                    <td>
                      <strong style={{ color: '#16a34a' }}>₹{s.net_sales.toLocaleString()}</strong>
                    </td>
                    <td>{s.total_customers}</td>
                    <td><strong>{s.net_quantity}</strong> <span style={{ fontSize: '10.5px', color: 'var(--text-muted)' }}>({s.gross_quantity}g)</span></td>
                    <td>{s.total_enquiries}</td>
                    <td>
                      <span className={`badge ${s.enquiry_conversion_rate > 30 ? 'badge-success' : 'badge-neutral'}`}>
                        {s.enquiry_conversion_rate}%
                      </span>
                    </td>
                    <td>
                      <div>{s.total_calls} calls</div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{s.call_connection_rate}% conn</div>
                    </td>
                    <td>
                      <strong style={{ color: '#d97706' }}>₹{s.net_incentive.toLocaleString()}</strong>
                    </td>
                    <td>
                      <span className={`badge ${s.daily_activity?.today_logged ? 'badge-success' : 'badge-warning'}`}>
                        {s.daily_activity?.summary}
                      </span>
                    </td>
                    <td style={{ fontSize: '12px', color: 'var(--text-muted)', maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {s.manager_remarks || '—'}
                    </td>
                    <td>
                      <button
                        className="btn btn-primary btn-sm"
                        onClick={() => openStaffDrilldown(s.staff_id)}
                        title="View Detailed Records & Observation Remarks"
                      >
                        <Eye size={13} />
                        <span>Details</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Staff Detailed Performance Drilldown Modal */}
      {selectedStaffDetail && (
        <div className="modal-overlay">
          <div className="modal-dialog large">
            <div className="modal-header">
              <div>
                <h3 className="modal-title">{selectedStaffDetail.staff.name} — Detailed Performance Profile</h3>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                  Staff ID: <strong>{selectedStaffDetail.staff.staff_id}</strong> | Filter: {selectedStaffDetail.dateRange?.startDate} to {selectedStaffDetail.dateRange?.endDate}
                </div>
              </div>
              <button className="modal-close" onClick={() => setSelectedStaffDetail(null)}>✕</button>
            </div>

            <div className="modal-body">
              {/* Manager Remarks Section (Editable and persisted separately) */}
              <div style={{ background: '#f8fafc', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', padding: '16px', marginBottom: '20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                  <label className="form-label" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <MessageSquare size={15} color="var(--primary-600)" />
                    <span>Brand Manager's Performance Observations (Saved Separately)</span>
                  </label>
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    onClick={handleSaveManagerRemarks}
                    disabled={savingRemark}
                  >
                    <Save size={13} />
                    <span>{savingRemark ? 'Saving...' : 'Save Observations'}</span>
                  </button>
                </div>
                <textarea
                  className="form-control"
                  rows="3"
                  placeholder="Enter manager coaching notes, performance review observations, and goals for this staff member..."
                  value={managerRemarkInput}
                  onChange={e => setManagerRemarkInput(e.target.value)}
                />
              </div>

              {/* Incentive Breakdown Summary Cards */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
                {/* By Payment Method */}
                <div style={{ background: 'white', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', padding: '12px' }}>
                  <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <CreditCard size={14} color="var(--primary-600)" />
                    <span>INCENTIVE BY PAYMENT METHOD</span>
                  </div>
                  <table style={{ width: '100%', fontSize: '12px', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-muted)' }}>
                        <th style={{ textAlign: 'left', paddingBottom: '4px' }}>Method</th>
                        <th style={{ textAlign: 'center', paddingBottom: '4px' }}>Orders</th>
                        <th style={{ textAlign: 'right', paddingBottom: '4px' }}>Gross Sales</th>
                        <th style={{ textAlign: 'right', paddingBottom: '4px' }}>Net Incentive</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(selectedStaffDetail.incentiveBreakdown?.byPaymentMethod || []).map((m, idx) => (
                        <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '6px 0', fontWeight: 600 }}>{m.payment_method}</td>
                          <td style={{ textAlign: 'center' }}>{m.order_count}</td>
                          <td style={{ textAlign: 'right' }}>₹{m.gross_sales.toLocaleString()}</td>
                          <td style={{ textAlign: 'right', color: '#d97706', fontWeight: 700 }}>₹{m.net_incentive}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* By Product */}
                <div style={{ background: 'white', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', padding: '12px' }}>
                  <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Package size={14} color="var(--primary-600)" />
                    <span>INCENTIVE BY PRODUCT</span>
                  </div>
                  <table style={{ width: '100%', fontSize: '12px', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-muted)' }}>
                        <th style={{ textAlign: 'left', paddingBottom: '4px' }}>Product</th>
                        <th style={{ textAlign: 'center', paddingBottom: '4px' }}>Qty</th>
                        <th style={{ textAlign: 'right', paddingBottom: '4px' }}>Gross Sales</th>
                        <th style={{ textAlign: 'right', paddingBottom: '4px' }}>Net Incentive</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(selectedStaffDetail.incentiveBreakdown?.byProduct || []).map((p, idx) => (
                        <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '6px 0', fontWeight: 600 }}>{p.product_name}</td>
                          <td style={{ textAlign: 'center' }}>{p.quantity_sold}</td>
                          <td style={{ textAlign: 'right' }}>₹{p.gross_sales.toLocaleString()}</td>
                          <td style={{ textAlign: 'right', color: '#d97706', fontWeight: 700 }}>₹{p.net_incentive}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Sub-Tabs for Orders, Returns, Daily Activities */}
              <div style={{ display: 'flex', gap: '4px', borderBottom: '1px solid var(--border-subtle)', marginBottom: '16px' }}>
                {[
                  { id: 'orders', label: `Orders (${(selectedStaffDetail.orders || []).length})`, icon: ShoppingCart },
                  { id: 'returns', label: `Returns (${(selectedStaffDetail.returns || []).length})`, icon: RotateCcw },
                  { id: 'daily-activities', label: `Daily Activities (${(selectedStaffDetail.dailyActivities || []).length})`, icon: ClipboardCheck }
                ].map((t) => {
                  const Icon = t.icon;
                  const isActive = activeTab === t.id;
                  return (
                    <button
                      key={t.id}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        padding: '8px 14px',
                        border: 'none',
                        background: 'none',
                        borderBottom: isActive ? '2px solid var(--primary-600)' : '2px solid transparent',
                        color: isActive ? 'var(--primary-600)' : 'var(--text-muted)',
                        fontWeight: isActive ? 700 : 500,
                        fontSize: '13px',
                        cursor: 'pointer'
                      }}
                      onClick={() => setActiveTab(t.id)}
                    >
                      <Icon size={14} />
                      <span>{t.label}</span>
                    </button>
                  );
                })}
              </div>

              {/* Tab 1: Orders */}
              {activeTab === 'orders' && (
                <div className="table-responsive">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Order #</th>
                        <th>Date</th>
                        <th>Customer</th>
                        <th>Product</th>
                        <th>Qty</th>
                        <th>Amount</th>
                        <th>Method</th>
                        <th>Incentive Rule</th>
                        <th>Status</th>
                        <th>Staff Remarks</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(selectedStaffDetail.orders || []).map(o => (
                        <tr key={o.id}>
                          <td><strong>{o.order_number}</strong></td>
                          <td>{o.order_date}</td>
                          <td>{o.customer_name} ({o.customer_phone})</td>
                          <td>{o.product_name}</td>
                          <td><strong>{o.quantity}</strong></td>
                          <td>₹{o.total_amount.toLocaleString()}</td>
                          <td><span className="badge badge-neutral">{o.payment_method}</span></td>
                          <td>
                            <div style={{ color: '#d97706', fontWeight: 700 }}>₹{o.incentive_amount}</div>
                            <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{o.incentive_type} ({o.incentive_basis})</div>
                          </td>
                          <td><span className="badge badge-info">{o.status}</span></td>
                          <td style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>{o.remarks || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Tab 2: Returns */}
              {activeTab === 'returns' && (
                <div className="table-responsive">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Return #</th>
                        <th>Date</th>
                        <th>Orig Order #</th>
                        <th>Customer</th>
                        <th>Product</th>
                        <th>Qty</th>
                        <th>Refund Value</th>
                        <th>Reversed Inc</th>
                        <th>Reason</th>
                        <th>Return Remarks</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(selectedStaffDetail.returns || []).map(r => (
                        <tr key={r.id}>
                          <td><strong style={{ color: 'var(--danger-text)' }}>{r.return_number}</strong></td>
                          <td>{r.return_date}</td>
                          <td>{r.order_number}</td>
                          <td>{r.customer_name}</td>
                          <td>{r.product_name}</td>
                          <td><span className="badge badge-danger">{r.return_quantity}</span></td>
                          <td>₹{r.return_amount.toLocaleString()}</td>
                          <td style={{ color: 'var(--danger-solid)', fontWeight: 700 }}>-₹{r.reversed_incentive}</td>
                          <td><span className="badge badge-warning">{r.return_reason}</span></td>
                          <td style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>{r.remarks || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Tab 3: Daily Activity Logs */}
              {activeTab === 'daily-activities' && (
                <div className="table-responsive">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Total Calls</th>
                        <th>Connected Calls</th>
                        <th>Connection Rate</th>
                        <th>Total Enquiries</th>
                        <th>Staff Remarks</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(selectedStaffDetail.dailyActivities || []).map(act => {
                        const rate = act.total_calls > 0 ? Math.round((act.connected_calls / act.total_calls) * 1000) / 10 : 0;
                        return (
                          <tr key={act.id}>
                            <td><strong>{act.activity_date}</strong></td>
                            <td style={{ fontWeight: 700, color: 'var(--primary-700)' }}>{act.total_calls}</td>
                            <td>{act.connected_calls}</td>
                            <td>
                              <span className={`badge ${rate >= 60 ? 'badge-success' : 'badge-neutral'}`}>
                                {rate}%
                              </span>
                            </td>
                            <td style={{ fontWeight: 700, color: '#8b5cf6' }}>{act.total_enquiries}</td>
                            <td style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>{act.remarks || '—'}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setSelectedStaffDetail(null)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
