// src/views/staff/StaffMyPerformance.jsx
import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../api';
import {
  Award,
  TrendingUp,
  CreditCard,
  Package,
  MessageSquare,
  ShoppingCart,
  RotateCcw,
  PhoneCall,
  Calendar
} from 'lucide-react';

export default function StaffMyPerformance() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  useEffect(() => {
    fetchPerformance();
  }, []);

  async function fetchPerformance(customStart, customEnd) {
    if (!user) return;
    setLoading(true);
    try {
      let queryStr = '';
      if (customStart || startDate) queryStr += `?startDate=${customStart || startDate}`;
      if (customEnd || endDate) queryStr += `${queryStr ? '&' : '?'}endDate=${customEnd || endDate}`;
      const res = await api.get(`/performance/staff/${user.id}${queryStr}`);
      setData(res);
    } catch (err) {
      console.error('Failed to load my performance:', err);
    } finally {
      setLoading(false);
    }
  }

  function handleFilterSubmit(e) {
    e.preventDefault();
    fetchPerformance(startDate, endDate);
  }

  const incentiveBreakdown = data?.incentiveBreakdown || {};
  const orders = data?.orders || [];
  const returns = data?.returns || [];

  return (
    <div className="page-body">
      {/* Header */}
      <div className="page-header">
        <div>
          <h2 className="page-title">My Performance & Incentive Audit</h2>
        </div>

        <form onSubmit={handleFilterSubmit} style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
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
          <button type="submit" className="btn btn-primary btn-sm">Filter</button>
        </form>
      </div>

      {/* Manager Observations Box */}
      <div
        style={{
          background: 'linear-gradient(135deg, #f0fdf4, #ecfdf5)',
          border: '1px solid #bbf7d0',
          borderRadius: 'var(--radius-lg)',
          padding: '18px 24px',
          marginBottom: '24px',
          boxShadow: 'var(--shadow-xs)'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
          <MessageSquare size={16} color="#16a34a" />
          <h3 style={{ fontSize: '14px', fontWeight: 700, color: '#166534' }}>
            Brand Manager's Performance Observations
          </h3>
        </div>
        <p style={{ fontSize: '13.5px', color: '#14532d', lineHeight: 1.6 }}>
          {data?.managerRemarks || 'No manager remarks have been recorded for your profile yet.'}
        </p>
      </div>

      {/* Incentive Breakdown Grid */}
      <div className="charts-grid" style={{ marginBottom: '24px' }}>
        {/* Breakdown by Payment Method */}
        <div className="table-card">
          <div className="table-toolbar">
            <h3 style={{ fontSize: '14px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <CreditCard size={16} color="var(--primary-600)" />
              <span>Incentive by Payment Method</span>
            </h3>
          </div>
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Method</th>
                  <th>Orders</th>
                  <th>Gross Sales</th>
                  <th>Gross Incentive</th>
                  <th>Reversed</th>
                  <th>Net Incentive</th>
                </tr>
              </thead>
              <tbody>
                {(incentiveBreakdown.byPaymentMethod || []).map((m, idx) => (
                  <tr key={idx}>
                    <td>
                      <span className={`badge ${m.payment_method === 'Prepaid' ? 'badge-success' : 'badge-neutral'}`}>
                        {m.payment_method}
                      </span>
                    </td>
                    <td>{m.order_count}</td>
                    <td>₹{m.gross_sales.toLocaleString()}</td>
                    <td>₹{m.gross_incentive}</td>
                    <td style={{ color: 'var(--danger-solid)' }}>-₹{m.reversed_incentive}</td>
                    <td><strong style={{ color: '#d97706' }}>₹{m.net_incentive}</strong></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Breakdown by Product */}
        <div className="table-card">
          <div className="table-toolbar">
            <h3 style={{ fontSize: '14px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Package size={16} color="var(--primary-600)" />
              <span>Incentive by Product</span>
            </h3>
          </div>
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Qty Sold</th>
                  <th>Gross Sales</th>
                  <th>Net Incentive</th>
                </tr>
              </thead>
              <tbody>
                {(incentiveBreakdown.byProduct || []).map((p, idx) => (
                  <tr key={idx}>
                    <td>
                      <div><strong>{p.product_name}</strong></div>
                      <div style={{ fontSize: '10.5px', color: 'var(--text-muted)' }}>{p.product_code}</div>
                    </td>
                    <td><strong>{p.quantity_sold}</strong></td>
                    <td>₹{p.gross_sales.toLocaleString()}</td>
                    <td><strong style={{ color: '#d97706' }}>₹{p.net_incentive}</strong></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
