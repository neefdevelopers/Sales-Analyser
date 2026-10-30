// src/views/staff/StaffOrders.jsx
import React, { useState, useEffect } from 'react';
import { api } from '../../api';
import {
  ShoppingCart,
  Plus,
  Search,
  Filter,
  CheckCircle,
  Eye,
  CreditCard,
  User,
  Phone,
  MapPin,
  Calendar,
  Package
} from 'lucide-react';

export default function StaffOrders() {
  const [orders, setOrders] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedOrderDetails, setSelectedOrderDetails] = useState(null);

  // Form state
  const [selectedProductId, setSelectedProductId] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [paymentMethod, setPaymentMethod] = useState('Prepaid');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerAddress, setCustomerAddress] = useState('');
  const [orderDate, setOrderDate] = useState(new Date().toISOString().split('T')[0]);
  const [remarks, setRemarks] = useState('');

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
      const activeProducts = (res.products || []).filter(p => p.status === 'active');
      setProducts(activeProducts);
      if (activeProducts.length > 0 && !selectedProductId) {
        setSelectedProductId(activeProducts[0].id);
      }
    } catch (err) {
      console.error('Failed to load products:', err);
    }
  }

  // Update preview whenever product, quantity, or payment method changes
  useEffect(() => {
    if (selectedProductId && quantity > 0) {
      updateOrderPreview();
    } else {
      setPreview(null);
    }
  }, [selectedProductId, quantity, paymentMethod]);

  async function updateOrderPreview() {
    try {
      const res = await api.post('/orders/preview', {
        product_id: parseInt(selectedProductId, 10),
        quantity: parseInt(quantity, 10),
        payment_method: paymentMethod
      });
      setPreview(res);
      setFormError('');
    } catch (err) {
      setFormError(err.message);
      setPreview(null);
    }
  }

  function openCreateOrderModal() {
    setFormError('');
    setQuantity(1);
    setPaymentMethod('Prepaid');
    setCustomerName('');
    setCustomerPhone('');
    setCustomerAddress('');
    setOrderDate(new Date().toISOString().split('T')[0]);
    setRemarks('');
    if (products.length > 0) {
      setSelectedProductId(products[0].id);
    }
    setShowAddModal(true);
  }

  async function handleCreateOrder(e) {
    e.preventDefault();
    setFormError('');

    if (!customerName.trim()) {
      setFormError('Customer name is required.');
      return;
    }
    if (!customerPhone.trim() || customerPhone.replace(/\D/g, '').length < 7) {
      setFormError('Please enter a valid phone number (at least 7 digits).');
      return;
    }

    setSubmitting(true);

    try {
      const res = await api.post('/orders', {
        product_id: parseInt(selectedProductId, 10),
        quantity: parseInt(quantity, 10),
        payment_method: paymentMethod,
        customer_name: customerName.trim(),
        customer_phone: customerPhone.trim(),
        customer_address: customerAddress.trim(),
        order_date: orderDate,
        remarks: remarks.trim()
      });

      setNotification(`Order ${res.order.order_number} created successfully! Calculated Incentive: ₹${res.order.incentive_amount}`);
      setTimeout(() => setNotification(''), 6000);

      setShowAddModal(false);
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
          onClick={openCreateOrderModal}
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
                <th>Calculated Incentive</th>
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
                      <button className="btn btn-primary btn-sm" onClick={openCreateOrderModal}>
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
                        <Eye size={13} /> Details
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Order Modal - Complete Order Entry */}
      {showAddModal && (
        <div className="modal-overlay">
          <div className="modal-dialog" style={{ maxWidth: '560px' }}>
            <div className="modal-header">
              <h3 className="modal-title">Create New Order</h3>
              <button className="modal-close" onClick={() => setShowAddModal(false)}>✕</button>
            </div>

            <form onSubmit={handleCreateOrder}>
              <div className="modal-body" style={{ padding: '20px 24px' }}>
                {formError && (
                  <div style={{ padding: '10px 14px', background: 'var(--danger-bg)', border: '1px solid var(--danger-border)', color: 'var(--danger-text)', borderRadius: 'var(--radius-md)', marginBottom: '16px', fontSize: '13px' }}>
                    {formError}
                  </div>
                )}

                {/* Product Selection */}
                <div className="form-group" style={{ marginBottom: '14px' }}>
                  <label className="form-label" style={{ fontWeight: 600, fontSize: '13px', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Package size={15} color="var(--primary-600)" />
                    <span>Select Product <span className="required">*</span></span>
                  </label>
                  <select
                    className="form-control"
                    value={selectedProductId}
                    onChange={e => setSelectedProductId(e.target.value)}
                    style={{ fontSize: '14px', padding: '8px 12px' }}
                    required
                  >
                    {products.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.name} — ₹{p.price}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Quantity and Payment Method */}
                <div className="form-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '14px' }}>
                  <div className="form-group">
                    <label className="form-label" style={{ fontWeight: 600, fontSize: '13px', marginBottom: '6px', display: 'block' }}>
                      Quantity <span className="required">*</span>
                    </label>
                    <input
                      type="number"
                      min="1"
                      className="form-control"
                      value={quantity}
                      onChange={e => setQuantity(Math.max(1, parseInt(e.target.value, 10) || 1))}
                      style={{ fontSize: '14px', padding: '8px 12px', fontWeight: 600 }}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label" style={{ fontWeight: 600, fontSize: '13px', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <CreditCard size={15} color="var(--primary-600)" />
                      <span>Payment Method <span className="required">*</span></span>
                    </label>
                    <select
                      className="form-control"
                      value={paymentMethod}
                      onChange={e => setPaymentMethod(e.target.value)}
                      style={{ fontSize: '14px', padding: '8px 12px' }}
                      required
                    >
                      <option value="Prepaid">Prepaid</option>
                      <option value="COD">Cash on Delivery (COD)</option>
                    </select>
                  </div>
                </div>

                {/* Customer Details */}
                <div className="form-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '14px' }}>
                  <div className="form-group">
                    <label className="form-label" style={{ fontWeight: 600, fontSize: '13px', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <User size={15} color="var(--primary-600)" />
                      <span>Customer Name <span className="required">*</span></span>
                    </label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="e.g. Rahul Sharma"
                      value={customerName}
                      onChange={e => setCustomerName(e.target.value)}
                      style={{ fontSize: '13.5px', padding: '8px 12px' }}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label" style={{ fontWeight: 600, fontSize: '13px', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Phone size={15} color="var(--primary-600)" />
                      <span>Phone Number <span className="required">*</span></span>
                    </label>
                    <input
                      type="tel"
                      className="form-control"
                      placeholder="10-digit mobile number"
                      value={customerPhone}
                      onChange={e => setCustomerPhone(e.target.value)}
                      style={{ fontSize: '13.5px', padding: '8px 12px' }}
                      required
                    />
                  </div>
                </div>

                {/* Customer Address */}
                <div className="form-group" style={{ marginBottom: '14px' }}>
                  <label className="form-label" style={{ fontWeight: 600, fontSize: '13px', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <MapPin size={15} color="var(--primary-600)" />
                    <span>Customer Address</span>
                  </label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="Delivery street address, area, city"
                    value={customerAddress}
                    onChange={e => setCustomerAddress(e.target.value)}
                    style={{ fontSize: '13.5px', padding: '8px 12px' }}
                  />
                </div>

                {/* Order Date and Remarks */}
                <div className="form-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '16px' }}>
                  <div className="form-group">
                    <label className="form-label" style={{ fontWeight: 600, fontSize: '13px', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Calendar size={15} color="var(--primary-600)" />
                      <span>Order Date <span className="required">*</span></span>
                    </label>
                    <input
                      type="date"
                      className="form-control"
                      value={orderDate}
                      onChange={e => setOrderDate(e.target.value)}
                      style={{ fontSize: '13.5px', padding: '8px 12px' }}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label" style={{ fontWeight: 600, fontSize: '13px', marginBottom: '6px', display: 'block' }}>
                      Remarks (Optional)
                    </label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="Special instructions"
                      value={remarks}
                      onChange={e => setRemarks(e.target.value)}
                      style={{ fontSize: '13.5px', padding: '8px 12px' }}
                    />
                  </div>
                </div>

                {/* Live Order & Incentive Calculation Preview */}
                {preview && (
                  <div className="preview-box" style={{ padding: '16px 20px', borderRadius: '10px', background: '#f8fafc', border: '1px solid var(--border-color)' }}>
                    <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <CheckCircle size={14} color="var(--primary-600)" />
                      <span>Order & Incentive Calculation Preview</span>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
                      <div>
                        <div className="preview-item-label" style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '3px' }}>Unit Price</div>
                        <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-main)' }}>
                          ₹{preview.unit_price}
                        </div>
                      </div>
                      <div>
                        <div className="preview-item-label" style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '3px' }}>Total Amount</div>
                        <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--primary-700)' }}>
                          ₹{preview.total_amount?.toLocaleString()}
                        </div>
                      </div>
                      <div>
                        <div className="preview-item-label" style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '3px' }}>Applied Rule</div>
                        <div style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-main)' }}>
                          {preview.estimated_incentive?.type === 'fixed'
                            ? `Fixed ₹${preview.estimated_incentive?.rate}`
                            : `${preview.estimated_incentive?.rate}%`}
                          {' / '}
                          {preview.estimated_incentive?.basis === 'per_unit' ? 'unit' : 'order'}
                        </div>
                      </div>
                      <div>
                        <div className="preview-item-label" style={{ fontSize: '11px', color: 'var(--text-muted)', marginBottom: '3px' }}>Estimated Incentive</div>
                        <div style={{ fontSize: '18px', fontWeight: 800, color: '#16a34a' }}>
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
                    Phone: {selectedOrderDetails.customer_phone}
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
                      ₹{selectedOrderDetails.total_amount?.toLocaleString()}
                    </div>
                  </div>
                  <div>
                    <div className="preview-item-label">Payment Method</div>
                    <div style={{ fontWeight: 700 }}>{selectedOrderDetails.payment_method}</div>
                  </div>
                  <div>
                    <div className="preview-item-label">Calculated Incentive</div>
                    <div className="preview-item-val" style={{ color: '#d97706' }}>
                      ₹{selectedOrderDetails.incentive_amount}
                    </div>
                    <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>
                      Rule: {selectedOrderDetails.incentive_type === 'fixed' ? `Fixed ₹${selectedOrderDetails.incentive_rate}` : `${selectedOrderDetails.incentive_rate}%`} ({selectedOrderDetails.incentive_basis})
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

              {selectedOrderDetails.returned_quantity > 0 && (
                <div style={{ marginTop: '14px', padding: '10px 14px', background: '#fef2f2', border: '1px solid #fee2e2', borderRadius: 'var(--radius-md)' }}>
                  <div style={{ fontSize: '12px', fontWeight: 700, color: '#b91c1c' }}>Return Adjustments Recorded:</div>
                  <div style={{ fontSize: '12.5px', color: '#991b1b', marginTop: '4px' }}>
                    Returned Quantity: <strong>{selectedOrderDetails.returned_quantity} units</strong> (Refund: ₹{selectedOrderDetails.returned_amount})
                    {' | '}Reversed Incentive: <strong>-₹{selectedOrderDetails.reversed_incentive}</strong>
                    {' | '}Net Staff Incentive: <strong>₹{selectedOrderDetails.net_incentive}</strong>
                  </div>
                </div>
              )}

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
