// src/views/staff/StaffOrders.jsx
import React, { useState, useEffect } from 'react';
import { api } from '../../api';
import { useAuth } from '../../context/AuthContext';
import {
  ShoppingCart,
  Plus,
  Search,
  CheckCircle,
  Eye,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  X,
  CreditCard,
  User,
  Package,
  Calendar,
  Filter
} from 'lucide-react';

export default function StaffOrders() {
  const { user } = useAuth();
  const isManager = user?.role === 'brand_manager';

  const [orders, setOrders] = useState([]);
  const [products, setProducts] = useState([]);
  const [staffList, setStaffList] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState('');
  const [productIdFilter, setProductIdFilter] = useState('all');
  const [paymentMethodFilter, setPaymentMethodFilter] = useState('all');
  const [staffFilter, setStaffFilter] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalOrders, setTotalOrders] = useState(0);

  // Add Order Modal State (Product, Quantity, Payment Method)
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [paymentMethod, setPaymentMethod] = useState('Prepaid');

  // Preview & Feedback
  const [preview, setPreview] = useState(null);
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [notification, setNotification] = useState('');

  // Order Details Modal
  const [selectedOrderDetails, setSelectedOrderDetails] = useState(null);

  useEffect(() => {
    fetchProducts();
    if (isManager) {
      fetchStaffList();
    }
  }, []);

  useEffect(() => {
    fetchOrders();
  }, [page, productIdFilter, paymentMethodFilter, staffFilter, startDate, endDate]);

  async function fetchStaffList() {
    try {
      const res = await api.get('/staff');
      setStaffList(res.staff || []);
    } catch (err) {
      console.error('Failed to load staff list:', err);
    }
  }

  async function fetchProducts() {
    try {
      const res = await api.get('/products');
      const active = (res.products || []).filter(p => p.status === 'active');
      setProducts(active);
      if (active.length > 0 && !selectedProductId) {
        setSelectedProductId(String(active[0].id));
      }
    } catch (err) {
      console.error('Failed to load products:', err);
    }
  }

  async function fetchOrders() {
    setLoading(true);
    try {
      let params = [];
      params.push(`page=${page}`);
      params.push('limit=25');
      if (search.trim()) params.push(`search=${encodeURIComponent(search.trim())}`);
      if (productIdFilter !== 'all') params.push(`productId=${productIdFilter}`);
      if (paymentMethodFilter !== 'all') params.push(`paymentMethod=${paymentMethodFilter}`);
      if (isManager && staffFilter !== 'all') params.push(`staffId=${staffFilter}`);
      if (startDate) params.push(`startDate=${startDate}`);
      if (endDate) params.push(`endDate=${endDate}`);

      const qs = params.length > 0 ? '?' + params.join('&') : '';
      const res = await api.get(`/orders${qs}`);
      setOrders(res.orders || []);
      setTotalPages(res.pagination?.totalPages || 1);
      setTotalOrders(res.pagination?.total || 0);
    } catch (err) {
      console.error('Failed to load orders:', err);
    } finally {
      setLoading(false);
    }
  }

  // Update real-time preview whenever product, quantity, or payment method changes
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
      setPreview(null);
    }
  }

  function openCreateOrderModal() {
    setFormError('');
    setQuantity(1);
    setPaymentMethod('Prepaid');
    if (products.length > 0) {
      setSelectedProductId(String(products[0].id));
    }
    setShowAddModal(true);
  }

  async function handleCreateOrder(e) {
    e.preventDefault();
    setFormError('');

    if (!selectedProductId) {
      setFormError('Please select a product.');
      return;
    }
    const qtyNum = parseInt(quantity, 10);
    if (isNaN(qtyNum) || qtyNum <= 0) {
      setFormError('Quantity must be at least 1.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await api.post('/orders', {
        product_id: parseInt(selectedProductId, 10),
        quantity: qtyNum,
        payment_method: paymentMethod
      });

      setNotification(`Order ${res.order.order_number} created successfully! (Incentive: ₹${res.order.incentive_amount})`);
      setTimeout(() => setNotification(''), 5000);

      setShowAddModal(false);
      fetchOrders();
    } catch (err) {
      setFormError(err.message || 'Failed to create order.');
    } finally {
      setSubmitting(false);
    }
  }

  function handleResetFilters() {
    setSearch('');
    setProductIdFilter('all');
    setPaymentMethodFilter('all');
    setStaffFilter('all');
    setStartDate('');
    setEndDate('');
    setPage(1);
    setTimeout(() => fetchOrders(), 0);
  }

  const hasActiveFilters = search || productIdFilter !== 'all' || paymentMethodFilter !== 'all' || staffFilter !== 'all' || startDate || endDate;

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
          <h2 className="page-title">{isManager ? 'All Orders' : 'Orders'}</h2>
        </div>

        <button
          className="btn btn-primary"
          onClick={openCreateOrderModal}
          style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
        >
          <Plus size={16} />
          <span>New Order</span>
        </button>
      </div>

      {/* Filtration Section */}
      <div className="table-card" style={{ marginBottom: '18px' }}>
        <div
          style={{
            padding: '12px 18px',
            borderBottom: '1px solid var(--border-subtle)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: '#f8fafc'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', fontWeight: 700, color: 'var(--text-main)' }}>
            <Filter size={15} color="var(--primary-600)" />
            <span>Filtration</span>
          </div>
          {hasActiveFilters && (
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={handleResetFilters}
              style={{ padding: '4px 8px', fontSize: '11.5px', height: '26px' }}
            >
              <X size={12} style={{ marginRight: '4px' }} /> Reset Filters
            </button>
          )}
        </div>

        <div
          style={{
            padding: '14px 18px',
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px'
          }}
        >
          {/* Search */}
          <div style={{ display: 'flex', gap: '8px', flex: '1 1 260px' }}>
            <div className="search-input-wrap" style={{ flex: 1, minWidth: '200px' }}>
              <Search size={16} />
              <input
                type="text"
                className="search-input"
                placeholder="Search Order ID, Customer, Phone, Product..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    setPage(1);
                    fetchOrders();
                  }
                }}
              />
            </div>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => {
                setPage(1);
                fetchOrders();
              }}
            >
              Search
            </button>
          </div>

          {/* Filter Dropdowns */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            {/* Product Filter */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)' }}>Product:</span>
              <select
                className="form-control"
                style={{ width: 'auto', padding: '5px 10px', fontSize: '12.5px' }}
                value={productIdFilter}
                onChange={e => {
                  setProductIdFilter(e.target.value);
                  setPage(1);
                }}
              >
                <option value="all">All Products</option>
                {products.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>

            {/* Payment Method Filter */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)' }}>Payment:</span>
              <select
                className="form-control"
                style={{ width: 'auto', padding: '5px 10px', fontSize: '12.5px' }}
                value={paymentMethodFilter}
                onChange={e => {
                  setPaymentMethodFilter(e.target.value);
                  setPage(1);
                }}
              >
                <option value="all">All Methods</option>
                <option value="Prepaid">Prepaid</option>
                <option value="COD">COD</option>
              </select>
            </div>

            {/* Staff Filter (Brand Manager only) */}
            {isManager && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)' }}>Staff:</span>
                <select
                  className="form-control"
                  style={{ width: 'auto', padding: '5px 10px', fontSize: '12.5px' }}
                  value={staffFilter}
                  onChange={e => {
                    setStaffFilter(e.target.value);
                    setPage(1);
                  }}
                >
                  <option value="all">All Sales Staff</option>
                  {staffList.map(s => (
                    <option key={s.id} value={s.id}>{s.name} ({s.staff_id})</option>
                  ))}
                </select>
              </div>
            )}

            {/* Date Filters */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)' }}>From:</span>
              <input
                type="date"
                className="form-control"
                style={{ width: 'auto', padding: '4px 8px', fontSize: '12px' }}
                value={startDate}
                onChange={e => {
                  setStartDate(e.target.value);
                  setPage(1);
                }}
              />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)' }}>To:</span>
              <input
                type="date"
                className="form-control"
                style={{ width: 'auto', padding: '4px 8px', fontSize: '12px' }}
                value={endDate}
                onChange={e => {
                  setEndDate(e.target.value);
                  setPage(1);
                }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Orders Table Card */}
      <div className="table-card">
        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th>Order ID</th>
                <th>Order Date</th>
                <th>Sales Staff</th>
                <th>Product</th>
                <th style={{ textAlign: 'center' }}>Quantity</th>
                <th>Payment Method</th>
                <th style={{ textAlign: 'right' }}>Order Amount</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="7" style={{ textAlign: 'center', padding: '36px', color: 'var(--text-muted)' }}>
                    Loading orders...
                  </td>
                </tr>
              ) : orders.length === 0 ? (
                <tr>
                  <td colSpan="7">
                    <div className="empty-state" style={{ padding: '36px 16px' }}>
                      <div className="empty-state-icon"><ShoppingCart size={28} /></div>
                      <div className="empty-state-title" style={{ fontSize: '16px' }}>No orders found</div>
                      <div className="empty-state-desc" style={{ maxWidth: '360px' }}>
                        No orders matched the specified filters or criteria.
                      </div>
                      <button
                        className="btn btn-primary btn-sm"
                        onClick={openCreateOrderModal}
                        style={{ marginTop: '12px' }}
                      >
                        <Plus size={14} /> Create Order
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                orders.map((o) => (
                  <tr
                    key={o.id}
                    className="table-row-clickable"
                    onClick={() => setSelectedOrderDetails(o)}
                    title="Click to view complete order information and incentive calculation"
                  >
                    <td>
                      <strong style={{ color: 'var(--primary-700)', fontFamily: 'monospace', fontSize: '13px' }}>
                        {o.order_number}
                      </strong>
                    </td>
                    <td>{o.order_date}</td>
                    <td>
                      <div><strong>{o.staff_name}</strong></div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{o.staff_code}</div>
                    </td>
                    <td>
                      <div><strong>{o.product_name}</strong></div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{o.product_code}</div>
                    </td>
                    <td style={{ textAlign: 'center', fontWeight: 700 }}>
                      {o.quantity}
                    </td>
                    <td>
                      <span className={`badge ${o.payment_method === 'Prepaid' ? 'badge-success' : 'badge-neutral'}`}>
                        {o.payment_method}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 700, fontSize: '13.5px' }}>
                      ₹{Number(o.total_amount).toLocaleString()}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        {totalPages > 1 && (
          <div
            style={{
              padding: '12px 20px',
              borderTop: '1px solid var(--border-subtle)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontSize: '13px'
            }}
          >
            <div style={{ color: 'var(--text-muted)' }}>
              Showing {orders.length} of {totalOrders} orders
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <button
                className="btn btn-secondary btn-sm"
                disabled={page <= 1}
                onClick={() => setPage(prev => Math.max(1, prev - 1))}
              >
                <ChevronLeft size={14} /> Previous
              </button>
              <span style={{ fontWeight: 600, padding: '0 8px' }}>
                Page {page} of {totalPages}
              </span>
              <button
                className="btn btn-secondary btn-sm"
                disabled={page >= totalPages}
                onClick={() => setPage(prev => Math.min(totalPages, prev + 1))}
              >
                Next <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 1. Add Order Modal - Exactly 6 Fields */}
      {showAddModal && (
        <div className="modal-overlay">
          <div className="modal-dialog" style={{ maxWidth: '520px' }}>
            <div className="modal-header">
              <h3 className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <ShoppingCart size={18} color="var(--primary-600)" />
                <span>Create New Order</span>
              </h3>
              <button className="modal-close" onClick={() => setShowAddModal(false)}>✕</button>
            </div>

            <form onSubmit={handleCreateOrder}>
              <div className="modal-body" style={{ padding: '20px 24px' }}>
                {formError && (
                  <div
                    style={{
                      padding: '10px 14px',
                      background: 'var(--danger-bg)',
                      border: '1px solid var(--danger-border)',
                      color: 'var(--danger-text)',
                      borderRadius: 'var(--radius-md)',
                      marginBottom: '16px',
                      fontSize: '13px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px'
                    }}
                  >
                    <AlertCircle size={16} style={{ flexShrink: 0 }} />
                    <span>{formError}</span>
                  </div>
                )}



                {/* Field 4: Product Selection */}
                <div className="form-group" style={{ marginBottom: '14px' }}>
                  <label className="form-label" style={{ fontWeight: 600, marginBottom: '6px' }}>
                    Product <span className="required">*</span>
                  </label>
                  <select
                    className="form-control"
                    value={selectedProductId}
                    onChange={e => setSelectedProductId(e.target.value)}
                    required
                  >
                    {products.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.name} — ₹{p.price?.toLocaleString()}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Field 5 & 6: Quantity & Payment Method */}
                <div className="form-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '16px' }}>
                  <div className="form-group">
                    <label className="form-label" style={{ fontWeight: 600, marginBottom: '6px' }}>
                      Quantity <span className="required">*</span>
                    </label>
                    <input
                      type="number"
                      min="1"
                      className="form-control"
                      value={quantity}
                      onChange={e => setQuantity(Math.max(1, parseInt(e.target.value, 10) || 1))}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label" style={{ fontWeight: 600, marginBottom: '6px' }}>
                      Payment Method <span className="required">*</span>
                    </label>
                    <select
                      className="form-control"
                      value={paymentMethod}
                      onChange={e => setPaymentMethod(e.target.value)}
                      required
                    >
                      <option value="Prepaid">Prepaid</option>
                      <option value="COD">Cash on Delivery (COD)</option>
                    </select>
                  </div>
                </div>

                {/* Calculated Order Amount & Estimated Incentive Preview */}
                {preview && (
                  <div
                    style={{
                      background: '#f8fafc',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: 'var(--radius-md)',
                      padding: '14px 16px',
                      display: 'grid',
                      gridTemplateColumns: '1fr 1fr',
                      gap: '12px'
                    }}
                  >
                    <div>
                      <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 600 }}>
                        Order Amount
                      </div>
                      <div style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-main)', marginTop: '2px' }}>
                        ₹{preview.total_amount?.toLocaleString()}
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                        ₹{preview.unit_price} &times; {preview.quantity} units
                      </div>
                    </div>

                    <div>
                      <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 600 }}>
                        Estimated Incentive
                      </div>
                      <div style={{ fontSize: '18px', fontWeight: 800, color: '#16a34a', marginTop: '2px' }}>
                        ₹{preview.estimated_incentive?.amount?.toLocaleString()}
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                        Rule: {preview.estimated_incentive?.type === 'percentage' ? `${preview.estimated_incentive?.rate}%` : `₹${preview.estimated_incentive?.rate}`} ({preview.estimated_incentive?.basis === 'per_unit' ? 'per unit' : 'per order'})
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="modal-footer" style={{ borderTop: '1px solid var(--border-subtle)', padding: '14px 24px' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowAddModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={submitting || products.length === 0}
                >
                  {submitting ? 'Creating Order...' : 'Save Order'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 2. Order Information View (Opened by clicking order row) */}
      {selectedOrderDetails && (
        <div className="modal-overlay">
          <div className="modal-dialog" style={{ maxWidth: '580px' }}>
            <div className="modal-header">
              <h3 className="modal-title">Order Information: {selectedOrderDetails.order_number}</h3>
              <button className="modal-close" onClick={() => setSelectedOrderDetails(null)}>✕</button>
            </div>

            <div className="modal-body" style={{ padding: '20px 24px' }}>
              {/* Order Metadata Strip */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, 1fr)',
                  gap: '12px',
                  background: '#f8fafc',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-md)',
                  padding: '12px 16px',
                  marginBottom: '16px'
                }}
              >
                <div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Order ID</div>
                  <strong style={{ fontFamily: 'monospace', color: 'var(--primary-700)' }}>
                    {selectedOrderDetails.order_number}
                  </strong>
                </div>
                <div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Order Date</div>
                  <strong>{selectedOrderDetails.order_date}</strong>
                </div>
                <div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Sales Staff</div>
                  <strong>{selectedOrderDetails.staff_name}</strong>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{selectedOrderDetails.staff_code}</div>
                </div>
              </div>

              {/* Customer Info Card (if available) */}
              {selectedOrderDetails.customer_phone && selectedOrderDetails.customer_phone !== '0000000000' && (
                <div style={{ border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', padding: '14px 16px', marginBottom: '16px' }}>
                  <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    Customer Information
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                    <div>
                      <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Name: </span>
                      <strong>{selectedOrderDetails.customer_name}</strong>
                    </div>
                    <div>
                      <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Phone: </span>
                      <strong>{selectedOrderDetails.customer_phone}</strong>
                    </div>
                  </div>
                  {selectedOrderDetails.customer_address && (
                    <div style={{ marginTop: '8px', fontSize: '12.5px' }}>
                      <span style={{ color: 'var(--text-muted)' }}>Address: </span>
                      <span>{selectedOrderDetails.customer_address}</span>
                    </div>
                  )}
                </div>
              )}

              {/* Product & Payment Card */}
              <div style={{ border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', padding: '14px 16px', marginBottom: '16px' }}>
                <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Product & Payment
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <div>
                    <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Product: </span>
                    <strong>{selectedOrderDetails.product_name}</strong>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>SKU: {selectedOrderDetails.product_code}</div>
                  </div>
                  <div>
                    <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Unit Price: </span>
                    <strong>₹{selectedOrderDetails.unit_price?.toLocaleString()}</strong>
                  </div>
                  <div>
                    <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Quantity: </span>
                    <strong>{selectedOrderDetails.quantity} units</strong>
                  </div>
                  <div>
                    <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Payment Method: </span>
                    <span className={`badge ${selectedOrderDetails.payment_method === 'Prepaid' ? 'badge-success' : 'badge-neutral'}`}>
                      {selectedOrderDetails.payment_method}
                    </span>
                  </div>
                </div>

                <div style={{ marginTop: '12px', paddingTop: '10px', borderTop: '1px dashed var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '13px', fontWeight: 600 }}>Total Order Amount:</span>
                  <strong style={{ fontSize: '17px', color: 'var(--text-main)' }}>
                    ₹{Number(selectedOrderDetails.total_amount).toLocaleString()}
                  </strong>
                </div>
              </div>

              {/* Incentive Calculation Snapshot Card */}
              <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 'var(--radius-md)', padding: '14px 16px' }}>
                <div style={{ fontSize: '12px', fontWeight: 700, color: '#166534', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Incentive Calculation Snapshot
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', fontSize: '12.5px' }}>
                  <div>
                    <div style={{ fontSize: '11px', color: '#15803d' }}>Rule Type</div>
                    <strong>{selectedOrderDetails.incentive_type === 'percentage' ? 'Percentage' : 'Fixed'}</strong>
                  </div>
                  <div>
                    <div style={{ fontSize: '11px', color: '#15803d' }}>Calculation Basis</div>
                    <strong>{selectedOrderDetails.incentive_basis === 'per_unit' ? 'Per Unit' : 'Per Order'}</strong>
                  </div>
                  <div>
                    <div style={{ fontSize: '11px', color: '#15803d' }}>Applied Rate</div>
                    <strong>{selectedOrderDetails.incentive_rate}{selectedOrderDetails.incentive_type === 'percentage' ? '%' : ' INR'}</strong>
                  </div>
                </div>

                <div style={{ marginTop: '10px', paddingTop: '8px', borderTop: '1px dashed #bbf7d0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '13px', color: '#166534', fontWeight: 600 }}>Earned Order Incentive:</span>
                  <strong style={{ fontSize: '17px', color: '#15803d' }}>
                    ₹{selectedOrderDetails.incentive_amount?.toLocaleString()}
                  </strong>
                </div>

                <div style={{ fontSize: '11px', color: '#15803d', marginTop: '6px' }}>
                  &bull; Saved as an immutable snapshot. Future changes to product incentive settings do not alter this calculation.
                </div>
              </div>
            </div>

            <div className="modal-footer" style={{ borderTop: '1px solid var(--border-subtle)', padding: '12px 24px' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setSelectedOrderDetails(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
