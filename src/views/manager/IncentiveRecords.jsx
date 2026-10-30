// src/views/manager/IncentiveRecords.jsx
import React, { useState, useEffect } from 'react';
import { api } from '../../api';
import {
  Award,
  Search,
  Filter,
  Download,
  Calendar,
  Users,
  Package,
  CreditCard,
  RotateCcw,
  ShoppingCart,
  TrendingUp,
  CheckCircle2,
  Sparkles
} from 'lucide-react';

export default function IncentiveRecords() {
  const [records, setRecords] = useState([]);
  const [summary, setSummary] = useState(null);
  const [staffList, setStaffList] = useState([]);
  const [productList, setProductList] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState('');
  const [staffId, setStaffId] = useState('all');
  const [productId, setProductId] = useState('all');
  const [paymentMethod, setPaymentMethod] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  useEffect(() => {
    fetchFilterOptions();
  }, []);

  useEffect(() => {
    fetchIncentives();
  }, [staffId, productId, paymentMethod, startDate, endDate]);

  async function fetchFilterOptions() {
    try {
      const [staffRes, prodRes] = await Promise.all([
        api.get('/staff'),
        api.get('/products?all=true')
      ]);
      setStaffList(staffRes.staff || []);
      setProductList(prodRes.products || []);
    } catch (err) {
      console.error('Failed to load filter options:', err);
    }
  }

  async function fetchIncentives() {
    setLoading(true);
    try {
      let params = [];
      if (staffId !== 'all') params.push(`staffId=${staffId}`);
      if (productId !== 'all') params.push(`productId=${productId}`);
      if (paymentMethod !== 'all') params.push(`paymentMethod=${paymentMethod}`);
      if (startDate) params.push(`startDate=${startDate}`);
      if (endDate) params.push(`endDate=${endDate}`);
      if (search && search.trim()) params.push(`search=${encodeURIComponent(search.trim())}`);

      const qs = params.length > 0 ? '?' + params.join('&') : '';
      const res = await api.get(`/incentives${qs}`);

      setRecords(res.records || []);
      setSummary(res.summary || {});
    } catch (err) {
      console.error('Failed to load incentive records:', err);
    } finally {
      setLoading(false);
    }
  }

  function handleResetFilters() {
    setSearch('');
    setStaffId('all');
    setProductId('all');
    setPaymentMethod('all');
    setStartDate('');
    setEndDate('');
  }

  function handleExportCsv() {
    if (records.length === 0) return;

    const headers = [
      'Staff Name',
      'Staff ID',
      'Order Number',
      'Order Date',
      'Product Name',
      'Product SKU',
      'Payment Method',
      'Order Quantity',
      'Net Quantity',
      'Total Amount',
      'Applied Rule',
      'Earned Incentive',
      'Return Adjustment',
      'Final Incentive'
    ];

    const rows = records.map(r => [
      `"${r.staff_name}"`,
      `"${r.staff_code}"`,
      `"${r.order_number}"`,
      r.order_date,
      `"${r.product_name}"`,
      `"${r.product_code}"`,
      r.payment_method,
      r.order_quantity,
      r.net_quantity,
      r.total_amount,
      `"${r.applied_rule}"`,
      r.earned_incentive,
      r.return_adjustment,
      r.final_incentive
    ]);

    const csvContent = [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `incentive-records-${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  return (
    <div className="page-body">
      {/* Premium Header Session */}
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
                Prepaid & COD Engine
              </span>
            </div>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '3px', margin: 0 }}>
              Audit product-specific staff incentive calculations and return reversals.
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          {(staffId !== 'all' || productId !== 'all' || paymentMethod !== 'all' || startDate || endDate || search) && (
            <button
              className="btn btn-secondary btn-sm"
              onClick={handleResetFilters}
              style={{ padding: '7px 12px', fontSize: '12.5px' }}
            >
              Reset Filters
            </button>
          )}

          <button
            className="btn btn-primary btn-sm"
            onClick={handleExportCsv}
            disabled={records.length === 0}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 14px',
              fontSize: '13px',
              boxShadow: '0 2px 6px rgba(14, 165, 233, 0.22)'
            }}
          >
            <Download size={15} />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Real-time Calculation Flow Strip */}
      <div className="calc-breakdown-bar">
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-muted)', fontWeight: 600 }}>
          <Sparkles size={15} color="var(--primary-600)" />
          <span>Formula Audit:</span>
        </div>
        <div className="calc-step">
          <span style={{ color: 'var(--text-muted)' }}>Gross Earned:</span>
          <strong style={{ color: '#d97706' }}>₹{summary?.totalEarnedIncentive?.toLocaleString() ?? 0}</strong>
        </div>
        <span className="calc-operator">−</span>
        <div className="calc-step">
          <span style={{ color: 'var(--text-muted)' }}>Return Reversals:</span>
          <strong style={{ color: '#dc2626' }}>₹{summary?.totalReturnAdjustment?.toLocaleString() ?? 0}</strong>
        </div>
        <span className="calc-operator">=</span>
        <div className="calc-step" style={{ background: '#ecfdf5', padding: '3px 10px', borderRadius: '6px', border: '1px solid #bbf7d0' }}>
          <span style={{ color: '#166534', fontWeight: 600 }}>Final Net Incentive:</span>
          <strong style={{ color: '#16a34a', fontSize: '14px' }}>₹{summary?.totalFinalIncentive?.toLocaleString() ?? 0}</strong>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="kpi-grid" style={{ gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '22px' }}>
        {/* Card 1: Orders with Incentive */}
        <div className="kpi-card-premium" style={{ '--card-accent': '#3b82f6' }}>
          <div className="kpi-header">
            <span className="kpi-title">Orders with Incentive</span>
            <div className="kpi-icon-wrap" style={{ background: '#eff6ff', color: '#2563eb' }}>
              <ShoppingCart size={19} />
            </div>
          </div>
          <div>
            <div className="kpi-value">{summary?.totalOrders ?? 0}</div>
            <div className="kpi-subtext">
              <span>Orders with snapshotted rules</span>
            </div>
          </div>
        </div>

        {/* Card 2: Gross Earned Incentive */}
        <div className="kpi-card-premium" style={{ '--card-accent': '#f59e0b' }}>
          <div className="kpi-header">
            <span className="kpi-title">Gross Earned Incentive</span>
            <div className="kpi-icon-wrap" style={{ background: '#fef3c7', color: '#d97706' }}>
              <TrendingUp size={19} />
            </div>
          </div>
          <div>
            <div className="kpi-value" style={{ color: '#b45309' }}>
              ₹{summary?.totalEarnedIncentive?.toLocaleString() ?? 0}
            </div>
            <div className="kpi-subtext">
              <span>Calculated at order creation</span>
            </div>
          </div>
        </div>

        {/* Card 3: Return Adjustments */}
        <div className="kpi-card-premium" style={{ '--card-accent': '#ef4444' }}>
          <div className="kpi-header">
            <span className="kpi-title">Return Adjustments</span>
            <div className="kpi-icon-wrap" style={{ background: '#fef2f2', color: '#dc2626' }}>
              <RotateCcw size={19} />
            </div>
          </div>
          <div>
            <div className="kpi-value" style={{ color: '#dc2626' }}>
              {summary?.totalReturnAdjustment > 0 ? `-₹${summary?.totalReturnAdjustment?.toLocaleString()}` : '₹0'}
            </div>
            <div className="kpi-subtext">
              <span>Proportional returns reversed</span>
            </div>
          </div>
        </div>

        {/* Card 4: Total Final Incentive (Hero) */}
        <div className="kpi-card-premium kpi-card-hero">
          <div className="kpi-header">
            <span className="kpi-title" style={{ color: '#166534', fontWeight: 800 }}>Total Final Incentive</span>
            <div className="kpi-icon-wrap" style={{ background: '#dcfce7', color: '#16a34a' }}>
              <CheckCircle2 size={20} />
            </div>
          </div>
          <div>
            <div className="kpi-value" style={{ color: '#15803d', fontSize: '28px' }}>
              ₹{summary?.totalFinalIncentive?.toLocaleString() ?? 0}
            </div>
            <div className="kpi-subtext" style={{ color: '#166534' }}>
              <span>Net payable staff earnings</span>
            </div>
          </div>
        </div>
      </div>

      {/* Filters Toolbar */}
      <div className="table-card">
        <div className="table-toolbar" style={{ flexWrap: 'wrap', gap: '10px' }}>
          <div className="search-input-wrap" style={{ minWidth: '220px', flex: 1 }}>
            <Search size={16} />
            <input
              type="text"
              className="search-input"
              placeholder="Search by order #, staff, product..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && fetchIncentives()}
            />
          </div>

          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
            {/* Staff Filter */}
            <select
              className="form-control"
              style={{ width: 'auto', padding: '6px 10px', fontSize: '12.5px' }}
              value={staffId}
              onChange={e => setStaffId(e.target.value)}
            >
              <option value="all">All Sales Staff</option>
              {staffList.map(s => (
                <option key={s.id} value={s.id}>{s.name} ({s.staff_id})</option>
              ))}
            </select>

            {/* Product Filter */}
            <select
              className="form-control"
              style={{ width: 'auto', padding: '6px 10px', fontSize: '12.5px' }}
              value={productId}
              onChange={e => setProductId(e.target.value)}
            >
              <option value="all">All Products</option>
              {productList.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>

            {/* Payment Method */}
            <select
              className="form-control"
              style={{ width: 'auto', padding: '6px 10px', fontSize: '12.5px' }}
              value={paymentMethod}
              onChange={e => setPaymentMethod(e.target.value)}
            >
              <option value="all">All Payments</option>
              <option value="Prepaid">Prepaid</option>
              <option value="COD">COD</option>
            </select>

            {/* Date Range */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <input
                type="date"
                className="form-control"
                style={{ width: 'auto', padding: '5px 8px', fontSize: '12px' }}
                value={startDate}
                onChange={e => setStartDate(e.target.value)}
                title="Start Date"
              />
              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>-</span>
              <input
                type="date"
                className="form-control"
                style={{ width: 'auto', padding: '5px 8px', fontSize: '12px' }}
                value={endDate}
                onChange={e => setEndDate(e.target.value)}
                title="End Date"
              />
            </div>
          </div>
        </div>

        {/* Incentive Records Table */}
        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th>Staff Name</th>
                <th>Order ID</th>
                <th>Order Date</th>
                <th>Product</th>
                <th>Payment</th>
                <th>Order Qty</th>
                <th>Applied Incentive Rule</th>
                <th>Earned Incentive</th>
                <th>Return Adjustment</th>
                <th>Final Incentive</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="10" style={{ textAlign: 'center', padding: '32px' }}>Loading incentive records...</td>
                </tr>
              ) : records.length === 0 ? (
                <tr>
                  <td colSpan="10">
                    <div className="empty-state">
                      <div className="empty-state-icon"><Award size={24} /></div>
                      <div className="empty-state-title">No incentive records found</div>
                      <div className="empty-state-desc">No records matched the selected staff, product, or date filters.</div>
                    </div>
                  </td>
                </tr>
              ) : (
                records.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <div><strong>{r.staff_name}</strong></div>
                      <div style={{ fontSize: '10.5px', color: 'var(--text-muted)' }}>{r.staff_code}</div>
                    </td>
                    <td>
                      <strong style={{ color: 'var(--primary-700)' }}>{r.order_number}</strong>
                    </td>
                    <td>{r.order_date}</td>
                    <td>
                      <div>{r.product_name}</div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                        {r.product_code} (₹{r.unit_price}/unit)
                      </div>
                    </td>
                    <td>
                      <span className={`badge ${r.payment_method === 'Prepaid' ? 'badge-success' : 'badge-neutral'}`}>
                        {r.payment_method}
                      </span>
                    </td>
                    <td>
                      <strong>{r.order_quantity}</strong>
                      {r.returned_quantity > 0 && (
                        <span style={{ fontSize: '11px', color: 'var(--danger-text)', marginLeft: '4px' }}>
                          (-{r.returned_quantity} ret.)
                        </span>
                      )}
                    </td>
                    <td>
                      <span className="badge badge-info">{r.applied_rule}</span>
                    </td>
                    <td style={{ color: 'var(--warning-text)', fontWeight: 700 }}>
                      ₹{r.earned_incentive}
                    </td>
                    <td style={{ color: r.return_adjustment > 0 ? 'var(--danger-solid)' : 'var(--text-muted)', fontWeight: r.return_adjustment > 0 ? 700 : 400 }}>
                      {r.return_adjustment > 0 ? `-₹${r.return_adjustment}` : '₹0'}
                    </td>
                    <td style={{ color: '#16a34a', fontWeight: 800, fontSize: '14px' }}>
                      ₹{r.final_incentive}
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
