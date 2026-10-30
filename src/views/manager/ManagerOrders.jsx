// src/views/manager/ManagerOrders.jsx
import React, { useState, useEffect } from 'react';
import { api } from '../../api';
import { ShoppingCart, Search, Filter, Eye, Calendar, Package, CreditCard, RotateCcw } from 'lucide-react';

export default function ManagerOrders() {
  const [orders, setOrders] = useState([]);
  const [staffList, setStaffList] = useState([]);
  const [productList, setProductList] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState('');
  const [staffId, setStaffId] = useState('all');
  const [productId, setProductId] = useState('all');
  const [paymentMethod, setPaymentMethod] = useState('all');
  const [status, setStatus] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const [selectedOrder, setSelectedOrder] = useState(null);

  useEffect(() => {
    fetchMetadata();
  }, []);

  useEffect(() => {
    fetchOrders();
  }, [staffId, productId, paymentMethod, status, startDate, endDate]);

  async function fetchMetadata() {
    try {
      const [staffRes, prodRes] = await Promise.all([
        api.get('/staff'),
        api.get('/products?all=true')
      ]);
      setStaffList(staffRes.staff || []);
      setProductList(prodRes.products || []);
    } catch (err) {
      console.error('Failed to load filter metadata:', err);
    }
  }

  async function fetchOrders() {
    setLoading(true);
    try {
      let params = [];
      if (status !== 'all') params.push(`status=${status}`);
      if (staffId !== 'all') params.push(`staffId=${staffId}`);
      if (productId !== 'all') params.push(`productId=${productId}`);
      if (paymentMethod !== 'all') params.push(`paymentMethod=${paymentMethod}`);
      if (startDate) params.push(`startDate=${startDate}`);
      if (endDate) params.push(`endDate=${endDate}`);
      if (search && search.trim()) params.push(`search=${encodeURIComponent(search.trim())}`);

      const queryStr = params.length > 0 ? '?' + params.join('&') : '';
      const res = await api.get(`/orders${queryStr}`);
      setOrders(res.orders || []);
    } catch (err) {
      console.error('Failed to load orders:', err);
    } finally {
      setLoading(false);
    }
  }

  function handleResetFilters() {
    setSearch('');
    setStaffId('all');
    setProductId('all');
    setPaymentMethod('all');
    setStatus('all');
    setStartDate('');
    setEndDate('');
  }

  return (
    <div className="page-body">
      <div className="page-header">
        <div>
          <h2 className="page-title">All Staff Orders</h2>
          <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '2px' }}>
            Monitor, search, and audit all orders created by sales staff.
          </p>
        </div>

        {(staffId !== 'all' || productId !== 'all' || paymentMethod !== 'all' || status !== 'all' || startDate || endDate || search) && (
          <button className="btn btn-secondary btn-sm" onClick={handleResetFilters}>
            Reset Filters
          </button>
        )}
      </div>

      <div className="table-card">
        {/* Filter Toolbar */}
        <div className="table-toolbar" style={{ flexWrap: 'wrap', gap: '10px' }}>
          <div className="search-input-wrap" style={{ minWidth: '240px', flex: 1 }}>
            <Search size={16} />
            <input
              type="text"
              className="search-input"
              placeholder="Search by order #, customer, phone, product..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && fetchOrders()}
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

            {/* Status */}
            <select
              className="form-control"
              style={{ width: 'auto', padding: '6px 10px', fontSize: '12.5px' }}
              value={status}
              onChange={e => setStatus(e.target.value)}
            >
              <option value="all">All Statuses</option>
              <option value="Confirmed">Confirmed</option>
              <option value="Delivered">Delivered</option>
              <option value="Pending">Pending</option>
              <option value="Cancelled">Cancelled</option>
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

        {/* Orders Table */}
        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th>Order #</th>
                <th>Staff</th>
                <th>Date</th>
                <th>Customer</th>
                <th>Product</th>
                <th>Qty</th>
                <th>Total (₹)</th>
                <th>Method</th>
                <th>Calculated Incentive</th>
                <th>Status</th>
                <th>Returns</th>
                <th>Details</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="12" style={{ textAlign: 'center', padding: '32px' }}>Loading orders...</td>
                </tr>
              ) : orders.length === 0 ? (
                <tr>
                  <td colSpan="12">
                    <div className="empty-state">
                      <div className="empty-state-icon"><ShoppingCart size={24} /></div>
                      <div className="empty-state-title">No orders found</div>
                      <div className="empty-state-desc">No orders matched the specified filters.</div>
                    </div>
                  </td>
                </tr>
              ) : (
                orders.map((o) => (
                  <tr key={o.id}>
                    <td><strong style={{ color: 'var(--primary-700)' }}>{o.order_number}</strong></td>
                    <td>
                      <div><strong>{o.staff_name}</strong></div>
                      <div style={{ fontSize: '10.5px', color: 'var(--text-muted)' }}>{o.staff_code}</div>
                    </td>
                    <td>{o.order_date}</td>
                    <td>
                      <div>{o.customer_name}</div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                        {o.customer_phone}
                      </div>
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
                        <span className="badge badge-danger">{o.returned_quantity} returned</span>
                      ) : (
                        <span style={{ fontSize: '11px', color: 'var(--text-subtle)' }}>None</span>
                      )}
                    </td>
                    <td>
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => setSelectedOrder(o)}
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
      </div>

      {/* Details Modal */}
      {selectedOrder && (
        <div className="modal-overlay">
          <div className="modal-dialog">
            <div className="modal-header">
              <h3 className="modal-title">Order Audit: {selectedOrder.order_number}</h3>
              <button className="modal-close" onClick={() => setSelectedOrder(null)}>✕</button>
            </div>
            <div className="modal-body">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                <div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Sales Staff</div>
                  <div style={{ fontWeight: 700 }}>{selectedOrder.staff_name} ({selectedOrder.staff_code})</div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
                    Customer: <strong>{selectedOrder.customer_name}</strong> ({selectedOrder.customer_phone})
                  </div>
                  {selectedOrder.customer_address && (
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                      Address: {selectedOrder.customer_address}
                    </div>
                  )}
                </div>

                <div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Product</div>
                  <div style={{ fontWeight: 700 }}>{selectedOrder.product_name} ({selectedOrder.product_code})</div>
                  <div style={{ fontSize: '12px' }}>Qty: <strong>{selectedOrder.quantity}</strong> @ ₹{selectedOrder.unit_price}</div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Order Date: {selectedOrder.order_date}</div>
                </div>
              </div>

              <div className="preview-box">
                <div className="preview-grid">
                  <div>
                    <div className="preview-item-label">Total Amount</div>
                    <div className="preview-item-val" style={{ color: 'var(--primary-600)' }}>
                      ₹{Number(selectedOrder.total_amount).toLocaleString()}
                    </div>
                  </div>
                  <div>
                    <div className="preview-item-label">Payment Method</div>
                    <div style={{ fontWeight: 700 }}>{selectedOrder.payment_method}</div>
                  </div>
                  <div>
                    <div className="preview-item-label">Calculated Incentive</div>
                    <div className="preview-item-val" style={{ color: '#d97706' }}>
                      ₹{selectedOrder.incentive_amount}
                    </div>
                    <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                      Rule: {selectedOrder.incentive_type === 'fixed' ? `Fixed ₹${selectedOrder.incentive_rate}` : `${selectedOrder.incentive_rate}%`} ({selectedOrder.incentive_basis})
                    </div>
                  </div>
                  <div>
                    <div className="preview-item-label">Remaining Returnable</div>
                    <div className="preview-item-val">{selectedOrder.returnable_quantity} units</div>
                  </div>
                </div>
              </div>

              {selectedOrder.returned_quantity > 0 && (
                <div style={{ marginTop: '14px', padding: '10px 14px', background: '#fef2f2', border: '1px solid #fee2e2', borderRadius: 'var(--radius-md)' }}>
                  <div style={{ fontSize: '12px', fontWeight: 700, color: '#b91c1c' }}>Return Adjustments:</div>
                  <div style={{ fontSize: '12.5px', color: '#991b1b', marginTop: '4px' }}>
                    Returned Quantity: <strong>{selectedOrder.returned_quantity} units</strong> (Refund: ₹{selectedOrder.returned_amount})
                    {' | '}Reversed Incentive: <strong>-₹{selectedOrder.reversed_incentive}</strong>
                    {' | '}Net Staff Incentive: <strong>₹{selectedOrder.net_incentive}</strong>
                  </div>
                </div>
              )}

              {selectedOrder.remarks && (
                <div style={{ marginTop: '12px' }}>
                  <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)' }}>Staff Remarks:</div>
                  <div style={{ fontSize: '13px', background: '#f8fafc', padding: '8px 12px', borderRadius: 'var(--radius-sm)', marginTop: '4px' }}>
                    {selectedOrder.remarks}
                  </div>
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setSelectedOrder(null)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
