// src/views/staff/StaffMyRecords.jsx
import React, { useState, useEffect } from 'react';
import { api } from '../../api';
import { useSessionState } from '../../hooks/useSessionState';
import {
  ShoppingCart,
  RotateCcw,
  Award,
  Calendar,
  Search,
  Filter,
  CheckCircle,
  FileText,
  X,
  ChevronDown
} from 'lucide-react';

export default function StaffMyRecords() {
  const [activeTab, setActiveTab] = useSessionState('filter_myrecords_tab', 'orders'); // 'orders' | 'returns'
  const [summary, setSummary] = useState(null);
  const [orders, setOrders] = useState([]);
  const [returns, setReturns] = useState([]);
  const [loading, setLoading] = useState(true);

  // Date filters (persisted per session)
  const [startDate, setStartDate] = useSessionState('filter_myrecords_start_date', '');
  const [endDate, setEndDate] = useSessionState('filter_myrecords_end_date', '');
  const [search, setSearch] = useSessionState('filter_myrecords_search', '');

  // Toggle filtration panel
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    fetchData();
  }, [startDate, endDate]);

  async function fetchData() {
    setLoading(true);
    try {
      let queryParams = [];
      if (startDate) queryParams.push(`startDate=${startDate}`);
      if (endDate) queryParams.push(`endDate=${endDate}`);
      const qs = queryParams.length > 0 ? '?' + queryParams.join('&') : '';

      const [summaryRes, ordersRes, returnsRes] = await Promise.all([
        api.get(`/orders/my-summary${qs}`),
        api.get(`/orders${qs}`),
        api.get(`/returns${qs}`)
      ]);

      setSummary(summaryRes.summary || {});
      setOrders(ordersRes.orders || []);
      setReturns(returnsRes.returns || []);
    } catch (err) {
      console.error('Failed to load my records:', err);
    } finally {
      setLoading(false);
    }
  }

  function handleResetFilters() {
    setStartDate('');
    setEndDate('');
    setSearch('');
  }

  const hasActiveFilters = Boolean(startDate || endDate || search.trim());

  // Filtered orders & returns by search term
  const filteredOrders = orders.filter(o => {
    if (!search.trim()) return true;
    const term = search.toLowerCase();
    return (
      o.order_number?.toLowerCase().includes(term) ||
      o.customer_name?.toLowerCase().includes(term) ||
      o.product_name?.toLowerCase().includes(term)
    );
  });

  const filteredReturns = returns.filter(r => {
    if (!search.trim()) return true;
    const term = search.toLowerCase();
    return (
      r.return_number?.toLowerCase().includes(term) ||
      r.order_number?.toLowerCase().includes(term) ||
      r.customer_name?.toLowerCase().includes(term) ||
      r.product_name?.toLowerCase().includes(term)
    );
  });

  return (
    <div className="page-body">
      {/* Header */}
      <div className="page-header">
        <div>
          <h2 className="page-title">My Records</h2>
        </div>

        <button
          type="button"
          className={`btn ${showFilters ? 'btn-primary' : 'btn-secondary'} btn-sm`}
          onClick={() => setShowFilters(!showFilters)}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '7px',
            padding: '8px 14px',
            fontWeight: 600,
            fontSize: '12.5px'
          }}
        >
          <Filter size={14} />
          <span>Filtration</span>
          {hasActiveFilters && (
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
              {(Boolean(startDate || endDate) ? 1 : 0) + (search.trim() ? 1 : 0)}
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
      </div>

      {/* 3 Summary Cards */}
      <div className="kpi-grid three-col-kpi-grid" style={{ marginBottom: '24px' }}>
        {/* Card 1: Total Orders */}
        <div className="kpi-card-premium" style={{ '--card-accent': '#3b82f6' }}>
          <div className="kpi-header">
            <span className="kpi-title">My Total Orders</span>
            <div className="kpi-icon-wrap" style={{ background: '#eff6ff', color: '#2563eb' }}>
              <ShoppingCart size={20} />
            </div>
          </div>
          <div>
            <div className="kpi-value">{summary?.totalOrders ?? 0}</div>
            <div className="kpi-subtext">
              Total Gross Sales: <strong>₹{summary?.grossSales?.toLocaleString() ?? 0}</strong> ({summary?.totalQuantity ?? 0} units)
            </div>
          </div>
        </div>

        {/* Card 2: Returned Orders */}
        <div className="kpi-card-premium" style={{ '--card-accent': '#ef4444' }}>
          <div className="kpi-header">
            <span className="kpi-title">My Returned Orders</span>
            <div className="kpi-icon-wrap" style={{ background: '#fef2f2', color: '#dc2626' }}>
              <RotateCcw size={20} />
            </div>
          </div>
          <div>
            <div className="kpi-value" style={{ color: summary?.returnedOrders > 0 ? '#dc2626' : 'var(--text-main)' }}>
              {summary?.returnedOrders ?? 0}
            </div>
            <div className="kpi-subtext">
              Returned Units: <strong>{summary?.returnedQuantity ?? 0} units</strong>
            </div>
          </div>
        </div>

        {/* Card 3: Total Incentives (Hero) */}
        <div className="kpi-card-premium kpi-card-hero">
          <div className="kpi-header">
            <span className="kpi-title" style={{ color: '#166534', fontWeight: 800 }}>My Total Incentives</span>
            <div className="kpi-icon-wrap" style={{ background: '#dcfce7', color: '#16a34a' }}>
              <Award size={20} />
            </div>
          </div>
          <div>
            <div className="kpi-value" style={{ color: '#15803d', fontSize: '28px' }}>
              ₹{summary?.netIncentive?.toLocaleString() ?? 0}
            </div>
            <div className="kpi-subtext" style={{ color: '#166534' }}>
              Earned: ₹{summary?.grossIncentive ?? 0} | Reversed: -₹{summary?.reversedIncentive ?? 0}
            </div>
          </div>
        </div>
      </div>

      {/* Compact Applied Filtration Pill Bar (when collapsed) */}
      {!showFilters && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '10px',
            background: '#f8fafc',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-md)',
            padding: '8px 14px',
            marginBottom: '18px',
            fontSize: '12.5px'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontWeight: 600, color: 'var(--text-secondary)' }}>
              <Filter size={13} color="var(--primary-600)" /> Active Filters:
            </span>
            <span className="badge badge-info" style={{ fontSize: '11.5px' }}>
              Mode: {activeTab === 'orders' ? 'Orders History' : 'Returns History'}
            </span>
            {(startDate || endDate) && (
              <span className="badge badge-neutral" style={{ fontSize: '11.5px' }}>
                Dates: {startDate || '...'} to {endDate || '...'}
              </span>
            )}
            {search.trim() && (
              <span className="badge badge-neutral" style={{ fontSize: '11.5px' }}>
                Search: "{search.trim()}"
              </span>
            )}
            {!hasActiveFilters && (
              <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>
                Showing all lifetime records
              </span>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              type="button"
              className="btn btn-sm btn-outline"
              onClick={() => setShowFilters(true)}
              style={{ fontSize: '11.5px', padding: '3px 10px', height: 'auto' }}
            >
              Change Filters ▾
            </button>
            {hasActiveFilters && (
              <button
                type="button"
                className="btn btn-sm btn-ghost"
                onClick={handleResetFilters}
                style={{ fontSize: '11.5px', padding: '3px 8px', color: '#dc2626', height: 'auto' }}
                title="Reset all filters"
              >
                <X size={12} style={{ marginRight: '4px' }} /> Reset
              </button>
            )}
          </div>
        </div>
      )}

      {/* Dedicated Filtration Section Card (when expanded) */}
      {showFilters && (
        <div className="table-card" style={{ marginBottom: '18px', padding: '16px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ width: '26px', height: '26px', borderRadius: '6px', background: 'var(--primary-50)', color: 'var(--primary-600)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Filter size={15} />
              </div>
              <strong style={{ fontSize: '13.5px', color: 'var(--text-main)', letterSpacing: '0.2px' }}>Filtration</strong>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                (Filter your records by history type, search query, or date range)
              </span>
            </div>
            <button
              type="button"
              className="btn btn-sm btn-ghost"
              onClick={() => setShowFilters(false)}
              style={{ fontSize: '12px', display: 'inline-flex', alignItems: 'center', gap: '4px', color: 'var(--text-muted)' }}
            >
              <X size={14} /> Hide
            </button>
          </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '14px' }}>
          {/* History Type Toggle */}
          <div style={{ display: 'inline-flex', background: '#f1f5f9', padding: '4px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
            <button
              type="button"
              onClick={() => setActiveTab('orders')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 14px',
                borderRadius: 'var(--radius-sm)',
                border: 'none',
                background: activeTab === 'orders' ? '#ffffff' : 'transparent',
                color: activeTab === 'orders' ? 'var(--primary-700)' : 'var(--text-muted)',
                fontWeight: activeTab === 'orders' ? 700 : 500,
                boxShadow: activeTab === 'orders' ? 'var(--shadow-xs)' : 'none',
                cursor: 'pointer',
                fontSize: '13px',
                transition: 'all 0.15s ease'
              }}
            >
              <ShoppingCart size={14} />
              <span>Order History ({orders.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('returns')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 14px',
                borderRadius: 'var(--radius-sm)',
                border: 'none',
                background: activeTab === 'returns' ? '#ffffff' : 'transparent',
                color: activeTab === 'returns' ? '#dc2626' : 'var(--text-muted)',
                fontWeight: activeTab === 'returns' ? 700 : 500,
                boxShadow: activeTab === 'returns' ? 'var(--shadow-xs)' : 'none',
                cursor: 'pointer',
                fontSize: '13px',
                transition: 'all 0.15s ease'
              }}
            >
              <RotateCcw size={14} />
              <span>Return History ({returns.length})</span>
            </button>
          </div>

          {/* Search, Dates, and Reset */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <div className="search-input-wrap" style={{ minWidth: '220px', maxWidth: '300px' }}>
              <Search size={15} />
              <input
                type="text"
                className="search-input"
                placeholder={`Search ${activeTab === 'orders' ? 'orders' : 'returns'}...`}
                value={search}
                onChange={e => setSearch(e.target.value)}
                style={{ padding: '6px 10px 6px 32px', fontSize: '12.5px' }}
              />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)' }}>From:</span>
              <input
                type="date"
                className="form-control"
                style={{ width: 'auto', padding: '5px 8px', fontSize: '12px' }}
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
              />
              <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)' }}>To:</span>
              <input
                type="date"
                className="form-control"
                style={{ width: 'auto', padding: '5px 8px', fontSize: '12px' }}
                value={endDate}
                onChange={e => setEndDate(e.target.value)}
              />
            </div>

            {hasActiveFilters && (
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={handleResetFilters}
                style={{ padding: '5px 10px', fontSize: '12px' }}
                title="Reset filters"
              >
                <X size={13} style={{ marginRight: '4px' }} /> Reset
              </button>
            )}
          </div>
        </div>
      </div>
      )}

      {/* Table Card */}
      <div className="table-card">

        {/* Tab 1: Order History */}
        {activeTab === 'orders' && (
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Order #</th>
                  <th>Order Date</th>
                  <th>Customer</th>
                  <th>Product</th>
                  <th>Quantity</th>
                  <th>Total (₹)</th>
                  <th>Payment</th>
                  <th>Incentive Earned</th>
                  <th>Status</th>
                  <th>Return Status</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan="10" style={{ textAlign: 'center', padding: '32px' }}>Loading order records...</td>
                  </tr>
                ) : filteredOrders.length === 0 ? (
                  <tr>
                    <td colSpan="10">
                      <div className="empty-state">
                        <div className="empty-state-icon"><ShoppingCart size={24} /></div>
                        <div className="empty-state-title">No orders found</div>
                        <div className="empty-state-desc">You have no order history matching the selected period.</div>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredOrders.map(o => (
                    <tr key={o.id}>
                      <td><strong style={{ color: 'var(--primary-700)' }}>{o.order_number}</strong></td>
                      <td>{o.order_date}</td>
                      <td>
                        <div><strong>{o.customer_name}</strong></div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{o.customer_phone}</div>
                      </td>
                      <td>
                        <div>{o.product_name}</div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>₹{o.unit_price} / unit</div>
                      </td>
                      <td><strong>{o.quantity}</strong></td>
                      <td><strong>₹{Number(o.total_amount).toLocaleString()}</strong></td>
                      <td>
                        <span className={`badge ${o.payment_method === 'Prepaid' ? 'badge-success' : 'badge-neutral'}`}>
                          {o.payment_method}
                        </span>
                      </td>
                      <td>
                        <div style={{ color: 'var(--warning-text)', fontWeight: 700 }}>
                          ₹{o.net_incentive ?? o.incentive_amount}
                        </div>
                        {o.reversed_incentive > 0 && (
                          <div style={{ fontSize: '10.5px', color: 'var(--danger-solid)' }}>
                            -₹{o.reversed_incentive} rev.
                          </div>
                        )}
                      </td>
                      <td>
                        <span className={`badge ${
                          o.status === 'Delivered' ? 'badge-success' :
                          o.status === 'Confirmed' ? 'badge-info' :
                          o.status === 'Pending' ? 'badge-warning' : 'badge-danger'
                        }`}>
                          {o.status}
                        </span>
                      </td>
                      <td>
                        {o.returned_quantity > 0 ? (
                          <span className="badge badge-danger">
                            {o.returned_quantity} returned
                          </span>
                        ) : (
                          <span style={{ fontSize: '12px', color: 'var(--text-subtle)' }}>None</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Tab 2: Return History */}
        {activeTab === 'returns' && (
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Return ID</th>
                  <th>Return Date</th>
                  <th>Product</th>
                  <th>Payment Method</th>
                  <th style={{ textAlign: 'right' }}>Returned Quantity</th>
                  <th style={{ textAlign: 'right' }}>Incentive Reversed</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan="6" style={{ textAlign: 'center', padding: '32px' }}>Loading return records...</td>
                  </tr>
                ) : filteredReturns.length === 0 ? (
                  <tr>
                    <td colSpan="6">
                      <div className="empty-state">
                        <div className="empty-state-icon"><RotateCcw size={24} /></div>
                        <div className="empty-state-title">No returns found</div>
                        <div className="empty-state-desc">You have no return history matching the selected period.</div>
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredReturns.map(r => (
                    <tr key={r.id}>
                      <td><strong style={{ color: '#dc2626', fontFamily: 'monospace', fontSize: '13px' }}>{r.return_number}</strong></td>
                      <td>{r.return_date}</td>
                      <td>
                        <div><strong>{r.product_name}</strong></div>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{r.product_code || ''}</div>
                      </td>
                      <td>
                        <span className={`badge ${r.payment_method === 'Prepaid' ? 'badge-success' : 'badge-neutral'}`}>
                          {r.payment_method || 'Prepaid'}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 600 }}>{r.return_quantity} units</td>
                      <td style={{ textAlign: 'right', color: '#dc2626', fontWeight: 700, fontSize: '14px' }}>
                        -₹{Number(r.reversed_incentive).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
