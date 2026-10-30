// src/views/staff/StaffDashboard.jsx
import React, { useState, useEffect } from 'react';
import { api } from '../../api';
import {
  ShoppingCart,
  RotateCcw,
  HelpCircle,
  PhoneCall,
  Users,
  Package,
  Award,
  Calendar,
  Filter,
  CheckCircle2,
  TrendingUp,
  Clock
} from 'lucide-react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';
import { Line, Bar, Doughnut } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

export default function StaffDashboard() {
  const [filter, setFilter] = useState('this_month');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);

  useEffect(() => {
    fetchDashboardData();
  }, [filter]);

  async function fetchDashboardData(customStart, customEnd) {
    setLoading(true);
    try {
      let queryStr = `?filter=${filter}`;
      if (filter === 'custom' && (customStart || startDate) && (customEnd || endDate)) {
        queryStr += `&startDate=${customStart || startDate}&endDate=${customEnd || endDate}`;
      }
      const res = await api.get(`/dashboard/staff${queryStr}`);
      setData(res);
    } catch (err) {
      console.error('Failed to load staff dashboard:', err);
    } finally {
      setLoading(false);
    }
  }

  function handleCustomFilterApply(e) {
    e.preventDefault();
    if (startDate && endDate) {
      fetchDashboardData(startDate, endDate);
    }
  }

  const kpis = data?.kpis || {};
  const charts = data?.charts || {};

  // 1. Daily Orders & Sales Chart Data
  const dailyOrdersLabels = (charts.dailyOrders || []).map(d => d.date);
  const dailyOrdersChartData = {
    labels: dailyOrdersLabels,
    datasets: [
      {
        label: 'Gross Sales (₹)',
        data: (charts.dailyOrders || []).map(d => d.gross_sales),
        borderColor: '#4f46e5',
        backgroundColor: 'rgba(79, 70, 229, 0.1)',
        tension: 0.3,
        fill: true,
        yAxisID: 'y'
      },
      {
        label: 'Net Sales (₹)',
        data: (charts.dailyOrders || []).map(d => d.net_sales),
        borderColor: '#10b981',
        backgroundColor: 'rgba(16, 185, 129, 0.1)',
        tension: 0.3,
        fill: true,
        yAxisID: 'y'
      },
      {
        type: 'bar',
        label: 'Orders Count',
        data: (charts.dailyOrders || []).map(d => d.order_count),
        backgroundColor: '#cbd5e1',
        borderRadius: 4,
        yAxisID: 'y1'
      }
    ]
  };

  // 2. Orders by Product
  const productLabels = (charts.ordersByProduct || []).map(p => p.product_name);
  const productChartData = {
    labels: productLabels,
    datasets: [
      {
        label: 'Quantity Sold',
        data: (charts.ordersByProduct || []).map(p => p.total_quantity),
        backgroundColor: ['#6366f1', '#3b82f6', '#10b981', '#f59e0b', '#ec4899', '#8b5cf6'],
        borderWidth: 1
      }
    ]
  };

  // 3. Activity Over Time (Calls vs Enquiries)
  const activityLabels = (charts.activityOverTime || []).map(a => a.date);
  const activityChartData = {
    labels: activityLabels,
    datasets: [
      {
        label: 'Calls Logged',
        data: (charts.activityOverTime || []).map(a => a.calls),
        borderColor: '#0284c7',
        backgroundColor: '#0284c7',
        tension: 0.3
      },
      {
        label: 'Enquiries Created',
        data: (charts.activityOverTime || []).map(a => a.enquiries),
        borderColor: '#8b5cf6',
        backgroundColor: '#8b5cf6',
        tension: 0.3
      }
    ]
  };

  // 4. Order Status Distribution
  const statusLabels = (charts.orderStatusDist || []).map(s => s.status);
  const statusChartData = {
    labels: statusLabels,
    datasets: [
      {
        data: (charts.orderStatusDist || []).map(s => s.count),
        backgroundColor: ['#10b981', '#6366f1', '#f59e0b', '#ef4444'],
        borderWidth: 1
      }
    ]
  };

  return (
    <div className="page-body">
      {/* Header and Filter Controls */}
      <div className="page-header">
        <div>
          <h2 className="page-title">Personal Sales Dashboard</h2>
          <p className="page-subtitle">Track your individual orders, returns, incentive earnings, and daily activity</p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
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
        {/* Total Orders */}
        <div className="kpi-card">
          <div className="kpi-header">
            <span className="kpi-title">Total Orders</span>
            <div className="kpi-icon-wrap" style={{ background: '#e0e7ff', color: '#4f46e5' }}>
              <ShoppingCart size={18} />
            </div>
          </div>
          <div className="kpi-value">{kpis.totalOrders || 0}</div>
          <div className="kpi-subtext">
            <span>Gross Sales: <strong>₹{(kpis.grossSales || 0).toLocaleString()}</strong></span>
          </div>
        </div>

        {/* Net Sales */}
        <div className="kpi-card">
          <div className="kpi-header">
            <span className="kpi-title">Net Sales (After Returns)</span>
            <div className="kpi-icon-wrap" style={{ background: '#dcfce7', color: '#16a34a' }}>
              <TrendingUp size={18} />
            </div>
          </div>
          <div className="kpi-value" style={{ color: '#16a34a' }}>₹{(kpis.netSales || 0).toLocaleString()}</div>
          <div className="kpi-subtext">
            <span>Deducted Returns: ₹{(kpis.reversedIncentive || 0).toLocaleString()}</span>
          </div>
        </div>

        {/* Earned Incentive */}
        <div className="kpi-card">
          <div className="kpi-header">
            <span className="kpi-title">Earned Net Incentive</span>
            <div className="kpi-icon-wrap" style={{ background: '#fef3c7', color: '#d97706' }}>
              <Award size={18} />
            </div>
          </div>
          <div className="kpi-value" style={{ color: '#d97706' }}>₹{(kpis.netIncentive || 0).toLocaleString()}</div>
          <div className="kpi-subtext">
            <span>Gross: ₹{(kpis.grossIncentive || 0).toLocaleString()} | Rev: ₹{(kpis.reversedIncentive || 0).toLocaleString()}</span>
          </div>
        </div>

        {/* Returns */}
        <div className="kpi-card">
          <div className="kpi-header">
            <span className="kpi-title">Returns</span>
            <div className="kpi-icon-wrap" style={{ background: '#fee2e2', color: '#dc2626' }}>
              <RotateCcw size={18} />
            </div>
          </div>
          <div className="kpi-value">{kpis.totalReturnedOrders || 0} orders</div>
          <div className="kpi-subtext">
            <span>Returned Qty: <strong>{kpis.totalReturnedQuantity || 0} units</strong></span>
          </div>
        </div>

        {/* Total Products Sold */}
        <div className="kpi-card">
          <div className="kpi-header">
            <span className="kpi-title">Products Sold</span>
            <div className="kpi-icon-wrap" style={{ background: '#f1f5f9', color: '#475569' }}>
              <Package size={18} />
            </div>
          </div>
          <div className="kpi-value">{kpis.netQuantitySold || 0} <span style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text-muted)' }}>net units</span></div>
          <div className="kpi-subtext">
            <span>Gross Qty: {kpis.grossQuantitySold || 0} units</span>
          </div>
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
          <div className="kpi-subtext">
            <span>Distinct phone numbers</span>
          </div>
        </div>

        {/* Calls & Enquiries */}
        <div className="kpi-card">
          <div className="kpi-header">
            <span className="kpi-title">Calls & Enquiries</span>
            <div className="kpi-icon-wrap" style={{ background: '#f3e8ff', color: '#7c3aed' }}>
              <PhoneCall size={18} />
            </div>
          </div>
          <div className="kpi-value">{kpis.totalCalls || 0} <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-muted)' }}>calls / {kpis.totalEnquiries || 0} enq</span></div>
          <div className="kpi-subtext">
            <span>Activity logged in period</span>
          </div>
        </div>

        {/* Today's Activity Summary */}
        <div className="kpi-card" style={{ background: 'linear-gradient(135deg, #ffffff, #f8fafc)' }}>
          <div className="kpi-header">
            <span className="kpi-title">Today's Activity</span>
            <div className="kpi-icon-wrap" style={{ background: '#ecfdf5', color: '#059669' }}>
              <CheckCircle2 size={18} />
            </div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px', marginTop: '2px' }}>
            <div style={{ fontSize: '12px' }}>Calls: <strong>{kpis.todaySummary?.calls || 0}</strong></div>
            <div style={{ fontSize: '12px' }}>Enq: <strong>{kpis.todaySummary?.enquiries || 0}</strong></div>
            <div style={{ fontSize: '12px' }}>Orders: <strong>{kpis.todaySummary?.orders || 0}</strong></div>
            <div style={{ fontSize: '12px' }}>Sales: <strong>₹{(kpis.todaySummary?.sales || 0).toLocaleString()}</strong></div>
          </div>
        </div>
      </div>

      {/* Charts Section */}
      <div className="charts-grid">
        {/* Daily Orders & Sales Trend */}
        <div className="chart-card">
          <div className="chart-header">
            <h3 className="chart-title">Daily Orders & Sales Trend</h3>
            <span className="badge badge-neutral">Database Records</span>
          </div>
          <div className="chart-container">
            {charts.dailyOrders && charts.dailyOrders.length > 0 ? (
              <Line
                data={dailyOrdersChartData}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  interaction: { mode: 'index', intersect: false },
                  scales: {
                    y: {
                      type: 'linear',
                      display: true,
                      position: 'left',
                      title: { display: true, text: 'Sales (₹)' }
                    },
                    y1: {
                      type: 'linear',
                      display: true,
                      position: 'right',
                      grid: { drawOnChartArea: false },
                      title: { display: true, text: 'Orders' }
                    }
                  }
                }}
              />
            ) : (
              <div className="empty-state" style={{ height: '100%' }}>No order data for selected period</div>
            )}
          </div>
        </div>

        {/* Orders by Product */}
        <div className="chart-card">
          <div className="chart-header">
            <h3 className="chart-title">Orders by Product (Quantity)</h3>
            <span className="badge badge-neutral">Top Selling</span>
          </div>
          <div className="chart-container">
            {charts.ordersByProduct && charts.ordersByProduct.length > 0 ? (
              <Bar
                data={productChartData}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: { legend: { display: false } },
                  scales: { y: { beginAtZero: true, title: { display: true, text: 'Units' } } }
                }}
              />
            ) : (
              <div className="empty-state" style={{ height: '100%' }}>No product breakdown available</div>
            )}
          </div>
        </div>

        {/* Calls & Enquiries Over Time */}
        <div className="chart-card">
          <div className="chart-header">
            <h3 className="chart-title">Daily Calls & Enquiries</h3>
            <span className="badge badge-neutral">Activity Volume</span>
          </div>
          <div className="chart-container">
            {charts.activityOverTime && charts.activityOverTime.length > 0 ? (
              <Line
                data={activityChartData}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } }
                }}
              />
            ) : (
              <div className="empty-state" style={{ height: '100%' }}>No call/enquiry activity recorded in this period</div>
            )}
          </div>
        </div>

        {/* Order Status Distribution */}
        <div className="chart-card">
          <div className="chart-header">
            <h3 className="chart-title">Order Status Distribution</h3>
            <span className="badge badge-neutral">Fulfillment</span>
          </div>
          <div className="chart-container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {charts.orderStatusDist && charts.orderStatusDist.length > 0 ? (
              <div style={{ width: '220px', height: '220px' }}>
                <Doughnut
                  data={statusChartData}
                  options={{
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { position: 'bottom' } }
                  }}
                />
              </div>
            ) : (
              <div className="empty-state">No order statuses to display</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
