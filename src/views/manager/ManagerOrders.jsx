// src/views/manager/ManagerOrders.jsx
import React, { useState, useEffect } from 'react';
import { api } from '../../api';
import { ShoppingCart, Search, Filter, Eye } from 'lucide-react';

export default function ManagerOrders() {
  const [orders, setOrders] = useState([]);
  const [staffList, setStaffList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [staffId, setStaffId] = useState('all');
  const [status, setStatus] = useState('all');
  const [selectedOrder, setSelectedOrder] = useState(null);

  useEffect(() => {
    fetchStaffList();
  }, []);

  useEffect(() => {
    fetchOrders();
  }, [staffId, status]);

  async function fetchStaffList() {
    try {
      const res = await api.get('/staff');
      setStaffList(res.staff || []);
    } catch (err) {
      console.error(err);
    }
  }

  async function fetchOrders() {
    setLoading(true);
    try {
      let queryStr = `?status=${status}`;
      if (staffId !== 'all') queryStr += `&staffId=${staffId}`;
      if (search) queryStr += `&search=${encodeURIComponent(search)}`;
      const res = await api.get(`/orders${queryStr}`);
      setOrders(res.orders || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="page-body">
      <div className="page-header">
        <div>
          <h2 className="page-title">All Orders (Brand Manager)</h2>
          <p className="page-subtitle">Inspect orders placed by all authorized sales staff across products and payment methods</p>
        </div>
      </div>

      <div className="table-card">
        <div className="table-toolbar">
          <div className="search-input-wrap">
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

          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <select
              className="form-control"
              style={{ width: 'auto', padding: '6px 12px', fontSize: '13px' }}
              value={staffId}
              onChange={e => setStaffId(e.target.value)}
            >
              <option value="all">All Sales Staff</option>
              {staffList.map(s => (
                <option key={s.id} value={s.id}>{s.name} ({s.staff_id})</option>
              ))}
            </select>

            <select
              className="form-control"
              style={{ width: 'auto', padding: '6px 12px', fontSize: '13px' }}
              value={status}
              onChange={e => setStatus(e.target.value)}
            >
              <option value="all">All Statuses</option>
              <option value="Confirmed">Confirmed</option>
              <option value="Delivered">Delivered</option>
              <option value="Pending">Pending</option>
              <option value="Cancelled">Cancelled</option>
            </select>
          </div>
        </div>

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
                <th>Incentive</th>
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
                        {o.customer_phone === '9999999999' ? 'Direct' : o.customer_phone}
                      </div>
                    </td>
                    <td>{o.product_name}</td>
                    <td><strong>{o.quantity}</strong></td>
                    <td><strong>₹{o.total_amount.toLocaleString()}</strong></td>
                    <td>
                      <span className={`badge ${o.payment_method === 'Prepaid' ? 'badge-success' : 'badge-neutral'}`}>
                        {o.payment_method}
                      </span>
                    </td>
                    <td>
                      <span style={{ color: '#d97706', fontWeight: 700 }}>₹{o.net_incentive}</span>
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
                      <button className="btn btn-secondary btn-sm" onClick={() => setSelectedOrder(o)}>
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
                </div>

                <div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Product</div>
                  <div style={{ fontWeight: 700 }}>{selectedOrder.product_name} ({selectedOrder.product_code})</div>
                  <div style={{ fontSize: '12px' }}>Qty: <strong>{selectedOrder.quantity}</strong> @ ₹{selectedOrder.unit_price}</div>
                </div>
              </div>

              <div className="preview-box">
                <div className="preview-grid">
                  <div>
                    <div className="preview-item-label">Total Amount</div>
                    <div className="preview-item-val" style={{ color: 'var(--primary-600)' }}>₹{selectedOrder.total_amount}</div>
                  </div>
                  <div>
                    <div className="preview-item-label">Payment Method</div>
                    <div style={{ fontWeight: 700 }}>{selectedOrder.payment_method}</div>
                  </div>
                  <div>
                    <div className="preview-item-label">Saved Incentive Snapshot</div>
                    <div className="preview-item-val" style={{ color: '#d97706' }}>₹{selectedOrder.incentive_amount}</div>
                    <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                      Rule: {selectedOrder.incentive_type} ({selectedOrder.incentive_basis})
                    </div>
                  </div>
                  <div>
                    <div className="preview-item-label">Remaining Returnable</div>
                    <div className="preview-item-val">{selectedOrder.returnable_quantity} units</div>
                  </div>
                </div>
              </div>

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
