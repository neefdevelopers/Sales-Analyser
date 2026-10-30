// src/views/staff/StaffMyRecords.jsx
import React, { useState, useEffect } from 'react';
import { api } from '../../api';
import {
  ShoppingCart,
  RotateCcw,
  Award,
  Calendar,
  Search,
  Filter,
  CheckCircle,
  FileText
} from 'lucide-react';

export default function StaffMyRecords() {
  const [activeTab, setActiveTab] = useState('orders'); // 'orders' | 'returns'
  const [summary, setSummary] = useState(null);
  const [orders, setOrders] = useState([]);
  const [returns, setReturns] = useState([]);
  const [loading, setLoading] = useState(true);

  // Date filters
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [search, setSearch] = useState('');

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

        {/* Date Filter Bar */}
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Calendar size={15} color="var(--text-muted)" />
            <input
              type="date"
              className="form-control"
              style={{ width: 'auto', padding: '6px 10px', fontSize: '12.5px' }}
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
            />
            <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>to</span>
            <input
              type="date"
              className="form-control"
              style={{ width: 'auto', padding: '6px 10px', fontSize: '12.5px' }}
              value={endDate}
              onChange={e => setEndDate(e.target.value)}
            />
          </div>

          {(startDate || endDate) && (
            <button
              className="btn btn-secondary btn-sm"
              onClick={handleResetFilters}
            >
              Reset
            </button>
          )}
        </div>
      </div>

      {/* 3 Summary Cards */}
      <div className="kpi-grid" style={{ gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px', marginBottom: '24px' }}>
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

      {/* Tab Navigation: Order History & Return History */}
      <div className="table-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-subtle)', padding: '0 16px' }}>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '14px 18px',
                border: 'none',
                background: 'transparent',
                fontWeight: activeTab === 'orders' ? 700 : 500,
                color: activeTab === 'orders' ? 'var(--primary-600)' : 'var(--text-muted)',
                borderBottom: activeTab === 'orders' ? '2px solid var(--primary-600)' : '2px solid transparent',
                cursor: 'pointer',
                fontSize: '14px'
              }}
              onClick={() => setActiveTab('orders')}
            >
              <ShoppingCart size={16} />
              <span>Order History ({orders.length})</span>
            </button>

            <button
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '14px 18px',
                border: 'none',
                background: 'transparent',
                fontWeight: activeTab === 'returns' ? 700 : 500,
                color: activeTab === 'returns' ? 'var(--primary-600)' : 'var(--text-muted)',
                borderBottom: activeTab === 'returns' ? '2px solid var(--primary-600)' : '2px solid transparent',
                cursor: 'pointer',
                fontSize: '14px'
              }}
              onClick={() => setActiveTab('returns')}
            >
              <RotateCcw size={16} />
              <span>Return History ({returns.length})</span>
            </button>
          </div>

          <div className="search-input-wrap" style={{ maxWidth: '280px', margin: '8px 0' }}>
            <Search size={15} />
            <input
              type="text"
              className="search-input"
              placeholder={`Search ${activeTab === 'orders' ? 'orders' : 'returns'}...`}
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{ padding: '6px 10px 6px 32px', fontSize: '13px' }}
            />
          </div>
        </div>

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
