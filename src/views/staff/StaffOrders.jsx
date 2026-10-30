// src/views/staff/StaffOrders.jsx
import React, { useState, useEffect } from 'react';
import { api } from '../../api';
import {
  ShoppingCart,
  Plus,
  Search,
  Filter,
  CheckCircle,
  AlertCircle,
  Clock,
  ArrowRight,
  Eye,
  FileText
} from 'lucide-react';

export default function StaffOrders() {
  const [orders, setOrders] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedOrderDetails, setSelectedOrderDetails] = useState(null);

  // Form state - only product and quantity are required
  const [selectedProductId, setSelectedProductId] = useState('');
  const [quantity, setQuantity] = useState(1);

  // Preview state
  const [preview, setPreview] = useState(null);
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [notification, setNotification] = useState('');

  useEffect(() => {
    fetchOrders();
    fetchProducts();
  }, [statusFilter]);

  async function fetchOrders() {
    setLoading(true);
    try {
      let queryStr = `?status=${statusFilter}`;
      if (search) queryStr += `&search=${encodeURIComponent(search)}`;
      const res = await api.get(`/orders${queryStr}`);
      setOrders(res.orders || []);
    } catch (err) {
      console.error('Failed to load orders:', err);
    } finally {
      setLoading(false);
    }
  }

  async function fetchProducts() {
    try {
      const res = await api.get('/products');
      setProducts(res.products || []);
      if (res.products && res.products.length > 0 && !selectedProductId) {
        setSelectedProductId(res.products[0].id);
      }
    } catch (err) {
      console.error('Failed to load products:', err);
    }
  }

  // Update preview whenever product or quantity changes
  useEffect(() => {
    if (selectedProductId && quantity > 0) {
      updateOrderPreview();
    } else {
      setPreview(null);
    }
  }, [selectedProductId, quantity]);

  async function updateOrderPreview() {
    try {
      const res = await api.post('/orders/preview', {
        product_id: parseInt(selectedProductId, 10),
        quantity: parseInt(quantity, 10)
      });
      setPreview(res);
      setFormError('');
    } catch (err) {
      setFormError(err.message);
      setPreview(null);
    }
  }

  async function handleCreateOrder(e) {
    e.preventDefault();
    setFormError('');
    setSubmitting(true);

    try {
      const res = await api.post('/orders', {
        product_id: parseInt(selectedProductId, 10),
        quantity: parseInt(quantity, 10)
      });

      setNotification(`Order ${res.order.order_number} created successfully! Earned Incentive: ₹${res.order.incentive_amount}`);
      setTimeout(() => setNotification(''), 6000);

      // Reset form
      setShowAddModal(false);
      setQuantity(1);
      fetchOrders();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSubmitting(false);
    }
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
          <h2 className="page-title">My Orders</h2>
        </div>

        <button
          className="btn btn-primary"
          onClick={() => {
            setShowAddModal(true);
            setFormError('');
          }}
        >
          <Plus size={16} />
          <span>New Order</span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="table-card">
        <div className="table-toolbar">
          <div className="search-input-wrap">
            <Search size={16} />
            <input
              type="text"
              className="search-input"
              placeholder="Search by Order #, Customer, Phone, Product..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && fetchOrders()}
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)' }}>Status:</span>
            <select
              className="form-control"
              style={{ width: 'auto', padding: '6px 12px', fontSize: '13px' }}
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
            >
              <option value="all">All Statuses</option>
              <option value="Confirmed">Confirmed</option>
              <option value="Delivered">Delivered</option>
              <option value="Pending">Pending</option>
              <option value="Cancelled">Cancelled</option>
            </select>
          </div>
        </div>

        {/* Orders Table */}
        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th>Order Number</th>
                <th>Date</th>
                <th>Customer</th>
                <th>Product</th>
                <th>Qty</th>
                <th>Total (₹)</th>
                <th>Method</th>
                <th>Staff Incentive</th>
                <th>Status</th>
                <th>Returns</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="11" style={{ textAlign: 'center', padding: '32px' }}>Loading orders...</td>
                </tr>
              ) : orders.length === 0 ? (
                <tr>
                  <td colSpan="11">
                    <div className="empty-state">
                      <div className="empty-state-icon"><ShoppingCart size={24} /></div>
                      <div className="empty-state-title">No orders found</div>
                      <div className="empty-state-desc">You have not created any orders matching the filters.</div>
                      <button className="btn btn-primary btn-sm" onClick={() => setShowAddModal(true)}>
                        <Plus size={14} /> Create First Order
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                orders.map((o) => (
                  <tr key={o.id}>
                    <td>
                      <strong style={{ color: 'var(--primary-700)' }}>{o.order_number}</strong>
                    </td>
                    <td>{o.order_date}</td>
                    <td>
                      <div><strong>{o.customer_name}</strong></div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                        {o.customer_phone === '9999999999' ? 'Direct' : o.customer_phone}
                      </div>
                    </td>
                    <td>
                      <div>{o.product_name}</div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>₹{o.unit_price} / unit</div>
                    </td>
                    <td><strong>{o.quantity}</strong></td>
                    <td><strong>₹{o.total_amount.toLocaleString()}</strong></td>
                    <td>
                      <span className={`badge ${o.payment_method === 'Prepaid' ? 'badge-success' : 'badge-neutral'}`}>
                        {o.payment_method}
                      </span>
                    </td>
                    <td>
                      <div style={{ color: 'var(--warning-text)', fontWeight: 700 }}>
                        ₹{o.net_incentive}
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
                        <span style={{ fontSize: '11.5px', color: 'var(--text-subtle)' }}>None</span>
                      )}
                    </td>
                    <td>
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => setSelectedOrderDetails(o)}
                        title="View Order Details"
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

      {/* Add Order Modal - Only Product and Quantity */}
      {showAddModal && (
        <div className="modal-overlay">
          <div className="modal-dialog" style={{ maxWidth: '480px' }}>
            <div className="modal-header">
              <h3 className="modal-title">Create New Order</h3>
              <button className="modal-close" onClick={() => setShowAddModal(false)}>✕</button>
            </div>

            <form onSubmit={handleCreateOrder}>
              <div className="modal-body" style={{ padding: '24px' }}>
                {formError && (
                  <div style={{ padding: '10px 14px', background: 'var(--danger-bg)', border: '1px solid var(--danger-border)', color: 'var(--danger-text)', borderRadius: 'var(--radius-md)', marginBottom: '16px', fontSize: '13px' }}>
                    {formError}
                  </div>
                )}

                <div className="form-group" style={{ marginBottom: '20px' }}>
                  <label className="form-label" style={{ fontWeight: 600, fontSize: '13.5px', marginBottom: '8px', display: 'block' }}>
                    Select Product <span className="required">*</span>
                  </label>
                  <select
                    className="form-control"
                    value={selectedProductId}
                    onChange={e => setSelectedProductId(e.target.value)}
                    style={{ fontSize: '14.5px', padding: '10px 14px', height: '46px', borderRadius: '8px' }}
                    required
                  >
                    {products.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="form-group" style={{ marginBottom: '20px' }}>
                  <label className="form-label" style={{ fontWeight: 600, fontSize: '13.5px', marginBottom: '8px', display: 'block' }}>
                    Quantity <span className="required">*</span>
                  </label>
                  <input
                    type="number"
                    min="1"
                    className="form-control"
                    value={quantity}
                    onChange={e => setQuantity(Math.max(1, parseInt(e.target.value, 10) || 1))}
                    style={{ fontSize: '15px', padding: '10px 14px', height: '46px', borderRadius: '8px', fontWeight: 600 }}
                    required
                  />
                </div>

                {/* Live Staff Incentive Preview */}
                {preview && (
                  <div className="preview-box" style={{ marginTop: '16px', padding: '16px 20px', borderRadius: '10px', background: '#f8fafc', border: '1px solid var(--border-color)' }}>
                    <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <CheckCircle size={14} color="var(--primary-600)" />
                      <span>Order Incentive Preview</span>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                      <div>
                        <div className="preview-item-label" style={{ fontSize: '11.5px', color: 'var(--text-muted)', marginBottom: '4px' }}>Quantity</div>
                        <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--text-main)' }}>
                          {preview.quantity} {preview.quantity === 1 ? 'unit' : 'units'}
                        </div>
                      </div>
                      <div>
                        <div className="preview-item-label" style={{ fontSize: '11.5px', color: 'var(--text-muted)', marginBottom: '4px' }}>Staff Incentive</div>
                        <div style={{ fontSize: '20px', fontWeight: 800, color: '#16a34a' }}>
                          ₹{preview.estimated_incentive?.amount ?? 0}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="modal-footer" style={{ padding: '16px 24px', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setShowAddModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={submitting}>
                  {submitting ? 'Creating...' : 'Confirm & Save Order'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Order Details Drawer / Modal */}
      {selectedOrderDetails && (
        <div className="modal-overlay">
          <div className="modal-dialog">
            <div className="modal-header">
              <h3 className="modal-title">Order Details: {selectedOrderDetails.order_number}</h3>
              <button className="modal-close" onClick={() => setSelectedOrderDetails(null)}>✕</button>
            </div>
            <div className="modal-body">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                <div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Customer</div>
                  <div style={{ fontWeight: 700, fontSize: '15px' }}>{selectedOrderDetails.customer_name}</div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                    {selectedOrderDetails.customer_phone === '9999999999' ? 'Direct Order' : `Phone: ${selectedOrderDetails.customer_phone}`}
                  </div>
                  {selectedOrderDetails.customer_address && (
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
                      Address: {selectedOrderDetails.customer_address}
                    </div>
                  )}
                </div>

                <div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Product</div>
                  <div style={{ fontWeight: 700, fontSize: '15px' }}>{selectedOrderDetails.product_name}</div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Code: {selectedOrderDetails.product_code}</div>
                  <div style={{ fontSize: '12px' }}>Quantity: <strong>{selectedOrderDetails.quantity}</strong> @ ₹{selectedOrderDetails.unit_price}</div>
                </div>
              </div>

              <div className="preview-box">
                <div className="preview-grid">
                  <div>
                    <div className="preview-item-label">Gross Amount</div>
                    <div className="preview-item-val" style={{ color: 'var(--text-main)', fontSize: '16px' }}>
                      ₹{selectedOrderDetails.total_amount}
                    </div>
                  </div>
                  <div>
                    <div className="preview-item-label">Payment</div>
                    <div style={{ fontWeight: 700 }}>{selectedOrderDetails.payment_method}</div>
                  </div>
                  <div>
                    <div className="preview-item-label">Snapshotted Incentive</div>
                    <div className="preview-item-val" style={{ color: '#d97706' }}>
                      ₹{selectedOrderDetails.incentive_amount}
                    </div>
                    <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                      Rule: {selectedOrderDetails.incentive_type} ({selectedOrderDetails.incentive_basis})
                    </div>
                  </div>
                  <div>
                    <div className="preview-item-label">Remaining Returnable</div>
                    <div className="preview-item-val" style={{ color: 'var(--primary-600)' }}>
                      {selectedOrderDetails.returnable_quantity} units
                    </div>
                  </div>
                </div>
              </div>

              {selectedOrderDetails.remarks && (
                <div style={{ marginTop: '12px' }}>
                  <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)' }}>Staff Remarks:</div>
                  <div style={{ fontSize: '13px', background: '#f8fafc', padding: '8px 12px', borderRadius: 'var(--radius-sm)', marginTop: '4px' }}>
                    {selectedOrderDetails.remarks}
                  </div>
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setSelectedOrderDetails(null)}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
