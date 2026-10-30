// src/views/manager/ManagerDashboard.jsx
import React, { useState, useEffect } from 'react';
import { api } from '../../api';
import {
  TrendingUp,
  ShoppingCart,
  RotateCcw,
  Users,
  Package,
  Award,
  PhoneCall,
  HelpCircle,
  Clock,
  UserCheck,
  CheckCircle2,
  AlertTriangle,
  ArrowUpRight
} from 'lucide-react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';
import { Line, Bar } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

export default function ManagerDashboard({ onNavigateToStaffPerformance }) {
  const [filter, setFilter] = useState('this_month');
  const [staffFilter, setStaffFilter] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [staffList, setStaffList] = useState([]);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStaffList();
  }, []);

  useEffect(() => {
    fetchManagerDashboard();
  }, [filter, staffFilter]);

  async function fetchStaffList() {
    try {
      const res = await api.get('/staff');
      setStaffList(res.staff || []);
    } catch (err) {
      console.error('Failed to load staff list:', err);
    }
  }

  async function fetchManagerDashboard(customStart, customEnd) {
    setLoading(true);
    try {
      let queryStr = `?filter=${filter}`;
      if (staffFilter !== 'all') queryStr += `&staffId=${staffFilter}`;
      if (filter === 'custom' && (customStart || startDate) && (customEnd || endDate)) {
        queryStr += `&startDate=${customStart || startDate}&endDate=${customEnd || endDate}`;
      }
      const res = await api.get(`/dashboard/manager${queryStr}`);
      setData(res);
    } catch (err) {
      console.error('Failed to load manager dashboard:', err);
    } finally {
      setLoading(false);
    }
  }

  function handleCustomFilterApply(e) {
    e.preventDefault();
    if (startDate && endDate) {
      fetchManagerDashboard(startDate, endDate);
    }
  }

  const kpis = data?.kpis || {};
  const topStaff = data?.topStaff || [];
  const topProducts = data?.topProducts || [];
  const staffActivity = data?.staffActivity || [];
  const salesTrend = data?.salesTrend || [];

  const trendChartData = {
    labels: salesTrend.map(d => d.date),
    datasets: [
      {
        label: 'Gross Sales (₹)',
        data: salesTrend.map(d => d.gross_sales),
        borderColor: '#4f46e5',
        backgroundColor: 'rgba(79, 70, 229, 0.1)',
        tension: 0.3,
        fill: true
      },
      {
        label: 'Net Sales (₹)',
        data: salesTrend.map(d => d.net_sales),
        borderColor: '#10b981',
        backgroundColor: 'rgba(16, 185, 129, 0.1)',
        tension: 0.3,
        fill: true
      }
    ]
  };

  return (
    <div className="page-body">
      {/* Header and Filters */}
      <div className="page-header">
        <div>
          <h2 className="page-title">Brand Manager Dashboard</h2>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          {/* Staff Filter */}
          <select
            className="form-control"
            style={{ width: 'auto', padding: '6px 12px', fontSize: '12px' }}
            value={staffFilter}
            onChange={e => setStaffFilter(e.target.value)}
          >
            <option value="all">All Sales Staff</option>
            {staffList.map(s => (
              <option key={s.id} value={s.id}>{s.name} ({s.staff_id})</option>
            ))}
          </select>

          {/* Date Filter Buttons */}
          <div style={{ display: 'flex', background: 'white', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', padding: '2px' }}>
            {['today', 'yesterday', 'this_week', 'this_month', 'custom'].map((f) => (
              <button
                key={f}
                style={{
                  padding: '6px 12px',
                  border: 'none',
                  background: filter === f ? 'var(--primary-600)' : 'transparent',
                  color: filter === f ? 'white' : 'var(--text-muted)',
                  borderRadius: 'var(--radius-sm)',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  textTransform: 'capitalize'
                }}
                onClick={() => setFilter(f)}
              >
                {f.replace('_', ' ')}
              </button>
            ))}
          </div>

          {filter === 'custom' && (
            <form onSubmit={handleCustomFilterApply} style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
              <input
                type="date"
                className="form-control"
                style={{ padding: '5px 8px', fontSize: '12px' }}
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
                required
              />
              <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>to</span>
              <input
                type="date"
                className="form-control"
                style={{ padding: '5px 8px', fontSize: '12px' }}
                value={endDate}
                onChange={e => setEndDate(e.target.value)}
                required
              />
              <button type="submit" className="btn btn-primary btn-sm">Apply</button>
            </form>
          )}
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="kpi-grid">
        {/* Gross Sales */}
        <div className="kpi-card">
          <div className="kpi-header">
            <span className="kpi-title">Gross Sales</span>
            <div className="kpi-icon-wrap" style={{ background: '#e0e7ff', color: '#4f46e5' }}>
              <TrendingUp size={18} />
            </div>
          </div>
          <div className="kpi-value">₹{(kpis.grossSales || 0).toLocaleString()}</div>
          <div className="kpi-subtext">Total Orders: <strong>{kpis.totalOrders || 0}</strong></div>
        </div>

        {/* Net Sales */}
        <div className="kpi-card">
          <div className="kpi-header">
            <span className="kpi-title">Net Sales (After Returns)</span>
            <div className="kpi-icon-wrap" style={{ background: '#dcfce7', color: '#16a34a' }}>
              <Award size={18} />
            </div>
          </div>
          <div className="kpi-value" style={{ color: '#16a34a' }}>₹{(kpis.netSales || 0).toLocaleString()}</div>
          <div className="kpi-subtext">Deducted: ₹{(kpis.totalReturnedAmount || 0).toLocaleString()}</div>
        </div>

        {/* Returns */}
        <div className="kpi-card">
          <div className="kpi-header">
            <span className="kpi-title">Total Returns</span>
            <div className="kpi-icon-wrap" style={{ background: '#fee2e2', color: '#dc2626' }}>
              <RotateCcw size={18} />
            </div>
          </div>
          <div className="kpi-value">{kpis.totalReturns || 0} <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>({kpis.totalReturnedQuantity || 0} units)</span></div>
          <div className="kpi-subtext">Refund Value: ₹{(kpis.totalReturnedAmount || 0).toLocaleString()}</div>
        </div>

        {/* Unique Customers */}
        <div className="kpi-card">
          <div className="kpi-header">
            <span className="kpi-title">Unique Customers</span>
            <div className="kpi-icon-wrap" style={{ background: '#e0f2fe', color: '#0284c7' }}>
              <Users size={18} />
            </div>
          </div>
          <div className="kpi-value">{kpis.totalCustomers || 0}</div>
          <div className="kpi-subtext">Verified normalized phone</div>
        </div>

        {/* Products Sold */}
        <div className="kpi-card">
          <div className="kpi-header">
            <span className="kpi-title">Product Qty Sold</span>
            <div className="kpi-icon-wrap" style={{ background: '#f1f5f9', color: '#475569' }}>
              <Package size={18} />
            </div>
          </div>
          <div className="kpi-value">{kpis.netQuantitySold || 0} <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-muted)' }}>net units</span></div>
          <div className="kpi-subtext">Gross: {kpis.grossQuantitySold || 0} units</div>
        </div>

        {/* Call Connection % */}
        <div className="kpi-card">
          <div className="kpi-header">
            <span className="kpi-title">Call Connection %</span>
            <div className="kpi-icon-wrap" style={{ background: '#f3e8ff', color: '#7c3aed' }}>
              <PhoneCall size={18} />
            </div>
          </div>
          <div className="kpi-value">{kpis.connectedCallPercentage || 0}%</div>
          <div className="kpi-subtext">Total Calls Logged: {kpis.totalCalls || 0}</div>
        </div>

        {/* Enquiry Conversion % */}
        <div className="kpi-card">
          <div className="kpi-header">
            <span className="kpi-title">Enquiry Conversion %</span>
            <div className="kpi-icon-wrap" style={{ background: '#fef3c7', color: '#d97706' }}>
              <HelpCircle size={18} />
            </div>
          </div>
          <div className="kpi-value">{kpis.enquiryConversionPercentage || 0}%</div>
          <div className="kpi-subtext">Total Enquiries: {kpis.totalEnquiries || 0}</div>
        </div>

        {/* Total Net Incentives */}
        <div className="kpi-card">
          <div className="kpi-header">
            <span className="kpi-title">Total Staff Incentives</span>
            <div className="kpi-icon-wrap" style={{ background: '#fffbeb', color: '#b45309' }}>
              <Award size={18} />
            </div>
          </div>
          <div className="kpi-value" style={{ color: '#b45309' }}>₹{(kpis.totalIncentives || 0).toLocaleString()}</div>
          <div className="kpi-subtext">Audited net payouts</div>
        </div>
      </div>

      {/* Daily Sales Trend Chart */}
      <div className="chart-card" style={{ marginBottom: '24px' }}>
        <div className="chart-header">
          <h3 className="chart-title">Consolidated Sales & Revenue Trend</h3>
          <span className="badge badge-neutral">Live Database Aggregations</span>
        </div>
        <div className="chart-container">
          {salesTrend.length > 0 ? (
            <Line
              data={trendChartData}
              options={{
                responsive: true,
                maintainAspectRatio: false,
                scales: { y: { beginAtZero: true, title: { display: true, text: 'Amount (₹)' } } }
              }}
            />
          ) : (
            <div className="empty-state">No sales recorded for this period</div>
          )}
        </div>
      </div>

      {/* Top Staff and Top Products Grids */}
      <div className="charts-grid" style={{ marginBottom: '24px' }}>
        {/* Top Performing Staff Leaderboard */}
        <div className="table-card">
          <div className="table-toolbar">
            <h3 style={{ fontSize: '14px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Award size={16} color="var(--primary-600)" />
              <span>Top Performing Staff</span>
            </h3>
            {onNavigateToStaffPerformance && (
              <button
                className="btn btn-secondary btn-sm"
                onClick={onNavigateToStaffPerformance}
              >
                <span>Full Analysis</span>
                <ArrowUpRight size={13} />
              </button>
            )}
          </div>
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Rank</th>
                  <th>Staff Member</th>
                  <th>Orders</th>
                  <th>Net Sales</th>
                  <th>Earned Incentive</th>
                </tr>
              </thead>
              <tbody>
                {topStaff.map((s, idx) => (
                  <tr key={s.id}>
                    <td>
                      <span className={`badge ${idx === 0 ? 'badge-warning' : 'badge-neutral'}`}>
                        #{idx + 1}
                      </span>
                    </td>
                    <td>
                      <div><strong>{s.name}</strong></div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{s.staff_id}</div>
                    </td>
                    <td><strong>{s.orders_count || 0}</strong></td>
                    <td><strong style={{ color: '#16a34a' }}>₹{(s.net_sales || 0).toLocaleString()}</strong></td>
                    <td style={{ color: '#d97706', fontWeight: 700 }}>₹{(s.net_incentive || 0).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Top Selling Products */}
        <div className="table-card">
          <div className="table-toolbar">
            <h3 style={{ fontSize: '14px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Package size={16} color="var(--primary-600)" />
              <span>Top Selling Products</span>
            </h3>
          </div>
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Price</th>
                  <th>Net Qty</th>
                  <th>Gross Sales</th>
                </tr>
              </thead>
              <tbody>
                {topProducts.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <div><strong>{p.name}</strong></div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{p.code}</div>
                    </td>
                    <td>₹{p.price}</td>
                    <td><strong>{p.net_quantity} units</strong></td>
                    <td>₹{p.gross_sales.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Staff Activity & Pending Daily Entries (Today) */}
      <div className="table-card">
        <div className="table-toolbar">
          <h3 style={{ fontSize: '14px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Clock size={16} color="var(--primary-600)" />
            <span>Today's Staff Activity & Pending Entry Status</span>
          </h3>
          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
            Cutoff deadline: 09:30 AM tomorrow
          </span>
        </div>
        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th>Staff ID</th>
                <th>Staff Name</th>
                <th>Calls Logged Today</th>
                <th>Enquiries Logged Today</th>
                <th>Orders Today</th>
                <th>Daily Status</th>
              </tr>
            </thead>
            <tbody>
              {staffActivity.map((s) => (
                <tr key={s.id}>
                  <td><strong>{s.staff_id}</strong></td>
                  <td>{s.name}</td>
                  <td><strong>{s.calls_today}</strong> calls</td>
                  <td><strong>{s.enquiries_today}</strong> enquiries</td>
                  <td><strong>{s.orders_today}</strong> orders</td>
                  <td>
                    {s.is_pending ? (
                      <span className="badge badge-warning">
                        <AlertTriangle size={12} /> Pending Entries
                      </span>
                    ) : (
                      <span className="badge badge-success">
                        <CheckCircle2 size={12} /> Active Today
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
