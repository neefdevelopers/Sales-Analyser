// src/views/staff/StaffOrders.jsx
import React, { useState, useEffect } from 'react';
import { api } from '../../api';
import { useAuth } from '../../context/AuthContext';
import { useSessionState } from '../../hooks/useSessionState';
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
  Filter,
  ChevronDown,
  Edit2,
  RotateCcw,
  FileSpreadsheet
} from 'lucide-react';
import BulkOrderImportModal from '../../components/BulkOrderImportModal';

export default function StaffOrders() {
  const { user } = useAuth();
  const isManager = user?.role === 'brand_manager';

  const [orders, setOrders] = useState([]);
  const [products, setProducts] = useState([]);
  const [staffList, setStaffList] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters (Persisted per session)
  const [search, setSearch] = useSessionState('filter_orders_search', '');
  const [productIdFilter, setProductIdFilter] = useSessionState('filter_orders_product', 'all');
  const [paymentMethodFilter, setPaymentMethodFilter] = useSessionState('filter_orders_payment', 'all');
  const [staffFilter, setStaffFilter] = useSessionState('filter_orders_staff', 'all');
  const [startDate, setStartDate] = useSessionState('filter_orders_start_date', '');
  const [endDate, setEndDate] = useSessionState('filter_orders_end_date', '');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalOrders, setTotalOrders] = useState(0);

  // Toggle filtration panel
  const [showFilters, setShowFilters] = useState(false);

  // Bulk Excel Import Modal State (Brand Manager)
  const [showImportModal, setShowImportModal] = useState(false);

  // Add Order Modal State
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedStaffMemberId, setSelectedStaffMemberId] = useState('');
  const [selectedProductId, setSelectedProductId] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [paymentMethod, setPaymentMethod] = useState('Prepaid');
  const [orderDate, setOrderDate] = useState('');

  // Edit Order Modal State
  const [editingOrder, setEditingOrder] = useState(null);
  const [editStaffId, setEditStaffId] = useState('');
  const [editProductId, setEditProductId] = useState('');
  const [editQuantity, setEditQuantity] = useState(1);
  const [editPaymentMethod, setEditPaymentMethod] = useState('Prepaid');
  const [editOrderDate, setEditOrderDate] = useState('');
  const [editPreview, setEditPreview] = useState(null);
  const [editError, setEditError] = useState('');
  const [editSubmitting, setEditSubmitting] = useState(false);

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
    setOrderDate(new Date().toISOString().split('T')[0]);
    if (products.length > 0) {
      setSelectedProductId(String(products[0].id));
    }
    if (isManager && staffList.length > 0) {
      setSelectedStaffMemberId(String(staffList[0].id));
    } else {
      setSelectedStaffMemberId('');
    }
    setShowAddModal(true);
  }

  async function handleCreateOrder(e) {
    e.preventDefault();
    setFormError('');

    if (isManager && !selectedStaffMemberId) {
      setFormError('Please select a sales staff member.');
      return;
    }
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
      const payload = {
        product_id: parseInt(selectedProductId, 10),
        quantity: qtyNum,
        payment_method: paymentMethod,
        order_date: orderDate || undefined
      };
      if (isManager && selectedStaffMemberId) {
        payload.staff_id = parseInt(selectedStaffMemberId, 10);
      }

      const res = await api.post('/orders', payload);

      setNotification(`Order ${res.order.order_number} created successfully! (Staff: ${res.order.staff_name}, Incentive: ₹${res.order.incentive_amount})`);
      setTimeout(() => setNotification(''), 5000);

      setShowAddModal(false);
      fetchOrders();
    } catch (err) {
      setFormError(err.message || 'Failed to create order.');
    } finally {
      setSubmitting(false);
    }
  }

  function openEditOrderModal(order) {
    setEditingOrder(order);
    setEditStaffId(String(order.staff_id));
    setEditProductId(String(order.product_id));
    setEditQuantity(order.quantity);
    setEditPaymentMethod(order.payment_method || 'Prepaid');
    setEditOrderDate(order.order_date || '');
    setEditError('');
  }

  // Preview for Edit Order
  useEffect(() => {
    if (editingOrder && editProductId && editQuantity > 0) {
      api.post('/orders/preview', {
        product_id: parseInt(editProductId, 10),
        quantity: parseInt(editQuantity, 10),
        payment_method: editPaymentMethod
      }).then(res => setEditPreview(res)).catch(() => setEditPreview(null));
    } else {
      setEditPreview(null);
    }
  }, [editingOrder, editProductId, editQuantity, editPaymentMethod]);

  async function handleSaveEditedOrder(e) {
    e.preventDefault();
    setEditError('');

    if (isManager && !editStaffId) {
      setEditError('Please select an assigned staff member.');
      return;
    }
    const qtyNum = parseInt(editQuantity, 10);
    if (isNaN(qtyNum) || qtyNum <= 0) {
      setEditError('Quantity must be at least 1.');
      return;
    }

    if (editingOrder.returned_quantity > 0 && qtyNum < editingOrder.returned_quantity) {
      setEditError(`Quantity cannot be reduced below ${editingOrder.returned_quantity} units because ${editingOrder.returned_quantity} units have already been returned for this order.`);
      return;
    }

    setEditSubmitting(true);
    try {
      const payload = {
        product_id: parseInt(editProductId, 10),
        quantity: qtyNum,
        payment_method: editPaymentMethod,
        order_date: editOrderDate || undefined
      };
      if (isManager && editStaffId) {
        payload.staff_id = parseInt(editStaffId, 10);
      }

      const res = await api.put(`/orders/${editingOrder.id}`, payload);
      setNotification(`Order ${res.order.order_number} updated successfully!`);
      setTimeout(() => setNotification(''), 5000);

      setEditingOrder(null);
      fetchOrders();
    } catch (err) {
      setEditError(err.message || 'Failed to update order.');
    } finally {
      setEditSubmitting(false);
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
  const activeFilterCount = (search.trim() ? 1 : 0) +
    (productIdFilter !== 'all' ? 1 : 0) +
    (paymentMethodFilter !== 'all' ? 1 : 0) +
    (staffFilter !== 'all' ? 1 : 0) +
    (startDate || endDate ? 1 : 0);

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

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <button
            type="button"
            className={`btn ${showFilters ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setShowFilters(!showFilters)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '7px',
              padding: '8px 14px',
              fontWeight: 600,
              fontSize: '13px'
            }}
          >
            <Filter size={15} />
            <span>Filtration</span>
            {activeFilterCount > 0 && (
              <span
                style={{
                  background: showFilters ? '#ffffff' : 'var(--primary-600)',
                  color: showFilters ? 'var(--primary-600)' : '#ffffff',
                  borderRadius: '10px',
                  fontSize: '11px',
                  fontWeight: 700,
                  padding: '1px 6px',
                  marginLeft: '2px'
                }}
              >
                {activeFilterCount}
              </span>
            )}
            <ChevronDown
              size={14}
              style={{
                transform: showFilters ? 'rotate(180deg)' : 'none',
                transition: 'transform 0.2s ease'
              }}
            />
          </button>

          {isManager && (
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setShowImportModal(true)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                borderColor: '#10b981',
                color: '#047857',
                background: '#ecfdf5',
                fontWeight: 600
              }}
              title="Upload an Excel sheet to bulk update existing staff orders"
            >
              <FileSpreadsheet size={16} />
              <span>Import Orders (Excel)</span>
            </button>
          )}

          <button
            className="btn btn-primary"
            onClick={openCreateOrderModal}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
          >
            <Plus size={16} />
            <span>New Order</span>
          </button>
        </div>
      </div>

      {/* Compact Applied Filtration Pill Bar (when collapsed) */}
      {!showFilters && (
        <div className="filter-pill-bar">
          <div className="filter-pill-items">
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontWeight: 600, color: 'var(--text-secondary)' }}>
              <Filter size={13} color="var(--primary-600)" /> Active Filters:
            </span>
            {productIdFilter !== 'all' && (
              <span className="badge badge-info" style={{ fontSize: '11.5px' }}>
                Product: {products.find(p => String(p.id) === String(productIdFilter))?.name || productIdFilter}
              </span>
            )}
            {paymentMethodFilter !== 'all' && (
              <span className="badge badge-neutral" style={{ fontSize: '11.5px' }}>
                Payment: {paymentMethodFilter}
              </span>
            )}
            {isManager && staffFilter !== 'all' && (
              <span className="badge badge-neutral" style={{ fontSize: '11.5px' }}>
                Staff: {staffList.find(s => String(s.id) === String(staffFilter))?.name || staffFilter}
              </span>
            )}
            {(startDate || endDate) && (
              <span className="badge badge-neutral" style={{ fontSize: '11.5px' }}>
                Dates: {startDate || '...'} to {endDate || '...'}
              </span>
            )}
            {search.trim() && (
              <span className="badge badge-neutral" style={{ fontSize: '11.5px' }}>
                Search: "{search.trim()}"
              </span>
            )}
            {!hasActiveFilters && (
              <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>
                Showing all recent orders
              </span>
            )}
          </div>
          <div className="filter-pill-actions">
            <button
              type="button"
              className="btn btn-sm btn-outline"
              onClick={() => setShowFilters(true)}
              style={{ fontSize: '11.5px', padding: '5px 12px', height: 'auto' }}
            >
              Change Filters ▾
            </button>
            {hasActiveFilters && (
              <button
                type="button"
                className="btn btn-sm btn-ghost"
                onClick={handleResetFilters}
                style={{ fontSize: '11.5px', padding: '5px 10px', color: '#dc2626', height: 'auto' }}
                title="Reset all filters"
              >
                <X size={12} style={{ marginRight: '4px' }} /> Reset
              </button>
            )}
          </div>
        </div>
      )}

      {/* Dedicated Filtration Section Card (when expanded) */}
      {showFilters && (
        <div className="filter-card">
          <div className="filter-card-header">
            <div className="filter-title-wrap">
              <div className="filter-icon-box">
                <Filter size={15} />
              </div>
              <strong className="filter-title">Filtration</strong>
              <span className="filter-desc">
                (Filter orders by product, payment, staff, and date range)
              </span>
            </div>
            <button
              type="button"
              className="filter-hide-btn"
              onClick={() => setShowFilters(false)}
            >
              <X size={14} /> Hide
            </button>
          </div>

          <div className="filter-body">
            <div className="filter-row">
              {/* Search */}
              <div className="filter-search-row">
                <div className="search-input-wrap">
                  <Search size={16} />
                  <input
                    type="text"
                    className="search-input"
                    placeholder="Search Order ID, Product..."
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
                  style={{ minHeight: '36px', padding: '0 14px' }}
                >
                  Search
                </button>
              </div>

              {/* Filter Dropdowns Grid */}
              <div className="filter-fields-wrap">
                {/* Product Filter */}
                <div className="filter-field">
                  <span className="filter-field-label">Product</span>
                  <select
                    className="form-control"
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
                <div className="filter-field">
                  <span className="filter-field-label">Payment</span>
                  <select
                    className="form-control"
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
                  <div className="filter-field">
                    <span className="filter-field-label">Sales Staff</span>
                    <select
                      className="form-control"
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

                {/* Start Date */}
                <div className="filter-field">
                  <span className="filter-field-label">From Date</span>
                  <input
                    type="date"
                    className="form-control"
                    value={startDate}
                    onChange={e => {
                      setStartDate(e.target.value);
                      setPage(1);
                    }}
                  />
                </div>

                {/* End Date */}
                <div className="filter-field">
                  <span className="filter-field-label">To Date</span>
                  <input
                    type="date"
                    className="form-control"
                    value={endDate}
                    onChange={e => {
                      setEndDate(e.target.value);
                      setPage(1);
                    }}
                  />
                </div>

                {/* Reset Button */}
                {hasActiveFilters && (
                  <div className="filter-field" style={{ justifyContent: 'flex-end' }}>
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={handleResetFilters}
                      style={{ minHeight: '36px', padding: '6px 12px', fontSize: '12px' }}
                      title="Reset all filters"
                    >
                      <X size={13} style={{ marginRight: '4px' }} /> Reset
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Orders Table Card */}
      <div className="table-card">
        {/* Desktop & Laptop Table View */}
        <div className="responsive-table-view">
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Order ID</th>
                  <th>Order Date</th>
                  {isManager && <th>Sales Staff</th>}
                  <th>Product</th>
                  <th style={{ textAlign: 'center' }}>Quantity</th>
                  <th>Payment Method</th>
                  <th style={{ textAlign: 'right' }}>Order Amount</th>
                  <th style={{ textAlign: 'center', width: '90px' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={isManager ? 8 : 7} style={{ textAlign: 'center', padding: '36px', color: 'var(--text-muted)' }}>
                      Loading orders...
                    </td>
                  </tr>
                ) : orders.length === 0 ? (
                  <tr>
                    <td colSpan={isManager ? 8 : 7}>
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
                      {isManager && (
                        <td>
                          <div><strong>{o.staff_name}</strong></div>
                          <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{o.staff_code}</div>
                        </td>
                      )}
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
                      <td style={{ textAlign: 'center' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }} onClick={e => e.stopPropagation()}>
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={() => setSelectedOrderDetails(o)}
                            title="View Details"
                            style={{ padding: '4px 7px' }}
                          >
                            <Eye size={13} />
                          </button>
                          {(isManager || o.staff_id === user?.id) && (
                            <button
                              type="button"
                              className="btn btn-secondary btn-sm"
                              onClick={() => openEditOrderModal(o)}
                              title="Edit Order"
                              style={{ padding: '4px 7px', color: 'var(--primary-700)' }}
                            >
                              <Edit2 size={13} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Mobile & Small Tablet Data Card View (<= 768px) */}
        <div className="responsive-card-view">
          {loading ? (
            <div style={{ textAlign: 'center', padding: '36px 16px', color: 'var(--text-muted)' }}>
              Loading orders...
            </div>
          ) : orders.length === 0 ? (
            <div className="empty-state" style={{ padding: '36px 16px' }}>
              <div className="empty-state-icon"><ShoppingCart size={28} /></div>
              <div className="empty-state-title" style={{ fontSize: '16px' }}>No orders found</div>
              <div className="empty-state-desc">No orders matched the specified filters.</div>
              <button
                className="btn btn-primary btn-sm"
                onClick={openCreateOrderModal}
                style={{ marginTop: '12px' }}
              >
                <Plus size={14} /> Create Order
              </button>
            </div>
          ) : (
            orders.map((o) => (
              <div
                key={o.id}
                className="mobile-data-card clickable"
                onClick={() => setSelectedOrderDetails(o)}
              >
                <div className="mobile-card-header">
                  <div className="mobile-card-title-group">
                    <span className="mobile-card-title">{o.order_number}</span>
                    <span className="mobile-card-subtitle">{o.order_date}</span>
                  </div>
                  <span className={`badge ${o.payment_method === 'Prepaid' ? 'badge-success' : 'badge-neutral'}`}>
                    {o.payment_method}
                  </span>
                </div>

                <div className="mobile-card-grid">
                  <div className="mobile-card-item">
                    <span className="mobile-card-label">Product</span>
                    <span className="mobile-card-val">{o.product_name}</span>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{o.product_code}</span>
                  </div>

                  <div className="mobile-card-item">
                    <span className="mobile-card-label">Quantity</span>
                    <span className="mobile-card-val">{o.quantity} {o.quantity === 1 ? 'unit' : 'units'}</span>
                  </div>

                  <div className="mobile-card-item">
                    <span className="mobile-card-label">Order Amount</span>
                    <span className="mobile-card-val accent" style={{ fontSize: '14px' }}>
                      ₹{Number(o.total_amount).toLocaleString()}
                    </span>
                  </div>

                  {isManager ? (
                    <div className="mobile-card-item">
                      <span className="mobile-card-label">Sales Staff</span>
                      <span className="mobile-card-val">{o.staff_name}</span>
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{o.staff_code}</span>
                    </div>
                  ) : (
                    <div className="mobile-card-item">
                      <span className="mobile-card-label">Earned Incentive</span>
                      <span className="mobile-card-val success" style={{ fontSize: '14px' }}>
                        ₹{o.incentive_amount || 0}
                      </span>
                    </div>
                  )}
                </div>

                <div className="mobile-card-footer" onClick={e => e.stopPropagation()}>
                  <button
                    type="button"
                    className="btn btn-secondary btn-sm"
                    onClick={() => setSelectedOrderDetails(o)}
                    style={{ flex: 1, justifyContent: 'center' }}
                  >
                    <Eye size={14} />
                    <span>View Details</span>
                  </button>

                  {(isManager || o.staff_id === user?.id) && (
                    <button
                      type="button"
                      className="btn btn-outline btn-sm"
                      onClick={() => openEditOrderModal(o)}
                      style={{ flex: 1, justifyContent: 'center', color: 'var(--primary-700)' }}
                    >
                      <Edit2 size={14} />
                      <span>Edit</span>
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Pagination Footer */}
        {totalPages > 1 && (
          <div className="pagination-bar">
            <div style={{ color: 'var(--text-muted)', fontSize: '12.5px' }}>
              Showing {orders.length} of {totalOrders} orders
            </div>
            <div className="pagination-controls" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <button
                className="btn btn-secondary btn-sm"
                disabled={page <= 1}
                onClick={() => setPage(prev => Math.max(1, prev - 1))}
              >
                <ChevronLeft size={14} /> Previous
              </button>
              <span style={{ fontWeight: 600, padding: '0 8px', fontSize: '12.5px' }}>
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
          <div
            className="modal-dialog"
            style={{
              width: 'min(640px, 96vw)',
              maxWidth: '640px',
              maxHeight: '90vh',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden'
            }}
          >
            <div className="modal-header" style={{ flexShrink: 0 }}>
              <h3 className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <ShoppingCart size={18} color="var(--primary-600)" />
                <span>Create New Order</span>
              </h3>
              <button className="modal-close" onClick={() => setShowAddModal(false)}>✕</button>
            </div>

            <form
              onSubmit={handleCreateOrder}
              style={{
                display: 'flex',
                flexDirection: 'column',
                flex: 1,
                minHeight: 0,
                overflow: 'hidden'
              }}
            >
              <div className="modal-body" style={{ padding: '20px 24px', overflowY: 'auto', flex: 1, minHeight: 0 }}>
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



                {/* Staff Member Selection (Brand Manager only) */}
                {isManager && (
                  <div className="form-group" style={{ marginBottom: '14px' }}>
                    <label className="form-label" style={{ fontWeight: 600, marginBottom: '6px' }}>
                      Sales Staff Member <span className="required">*</span>
                    </label>
                    <select
                      className="form-control"
                      value={selectedStaffMemberId}
                      onChange={e => setSelectedStaffMemberId(e.target.value)}
                      required
                    >
                      <option value="">Select Staff Member</option>
                      {staffList.filter(s => s.status === 'active').map(s => (
                        <option key={s.id} value={s.id}>
                          {s.name} ({s.staff_id})
                        </option>
                      ))}
                    </select>
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
                <div className="form-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '14px' }}>
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

                {/* Order Date */}
                <div className="form-group" style={{ marginBottom: '14px' }}>
                  <label className="form-label" style={{ fontWeight: 600, marginBottom: '6px' }}>
                    Order Date <span className="required">*</span>
                  </label>
                  <input
                    type="date"
                    className="form-control"
                    value={orderDate}
                    onChange={e => setOrderDate(e.target.value)}
                    required
                  />
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

              <div className="modal-footer" style={{ borderTop: '1px solid var(--border-subtle)', padding: '14px 24px', flexShrink: 0 }}>
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
          <div
            className="modal-dialog"
            style={{
              width: 'min(820px, 96vw)',
              maxWidth: '820px',
              maxHeight: '92vh',
              display: 'flex',
              flexDirection: 'column'
            }}
          >
            <div className="modal-header" style={{ padding: '16px 24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '34px', height: '34px', borderRadius: '8px', background: 'var(--primary-50)', color: 'var(--primary-600)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Package size={18} />
                </div>
                <div>
                  <h3 className="modal-title" style={{ fontSize: '17px', margin: 0 }}>
                    Order Information: <span style={{ fontFamily: 'monospace', color: 'var(--primary-700)' }}>{selectedOrderDetails.order_number}</span>
                  </h3>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                    Recorded on {selectedOrderDetails.order_date} &bull; Status: <span style={{ fontWeight: 600, color: '#16a34a' }}>{selectedOrderDetails.status || 'Confirmed'}</span>
                  </div>
                </div>
              </div>
              <button className="modal-close" onClick={() => setSelectedOrderDetails(null)}>✕</button>
            </div>

            <div className="modal-body" style={{ padding: '20px 24px', overflowY: 'auto', flex: 1 }}>
              {/* Order Metadata Strip */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
                  gap: '12px',
                  background: '#f8fafc',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-md)',
                  padding: '12px 16px',
                  marginBottom: '16px'
                }}
              >
                <div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Order ID</div>
                  <strong style={{ fontFamily: 'monospace', color: 'var(--primary-700)', fontSize: '13.5px' }}>
                    {selectedOrderDetails.order_number}
                  </strong>
                </div>
                <div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Order Date</div>
                  <strong style={{ fontSize: '13px' }}>{selectedOrderDetails.order_date}</strong>
                </div>
                <div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Sales Staff</div>
                  <strong style={{ fontSize: '13px' }}>{selectedOrderDetails.staff_name}</strong>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{selectedOrderDetails.staff_code}</div>
                </div>
                <div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>Payment Method</div>
                  <div style={{ marginTop: '2px' }}>
                    <span className={`badge ${selectedOrderDetails.payment_method === 'Prepaid' ? 'badge-success' : 'badge-neutral'}`} style={{ fontSize: '11.5px' }}>
                      {selectedOrderDetails.payment_method}
                    </span>
                  </div>
                </div>
              </div>

              {/* Product & Pricing Card */}
              <div style={{ border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', padding: '16px 20px', background: '#ffffff', marginBottom: '16px' }}>
                <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Package size={14} color="var(--primary-600)" />
                  <span>Product & Pricing Details</span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '14px', marginBottom: '14px' }}>
                  <div>
                    <span style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>Product</span>
                    <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-main)', marginTop: '2px' }}>
                      {selectedOrderDetails.product_name}
                    </div>
                    <div style={{ fontSize: '11.5px', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                      SKU: {selectedOrderDetails.product_code}
                    </div>
                  </div>

                  <div>
                    <span style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>Unit Price</span>
                    <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-main)', marginTop: '2px' }}>
                      ₹{selectedOrderDetails.unit_price?.toLocaleString('en-IN')}
                    </div>
                  </div>

                  <div>
                    <span style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>Quantity Ordered</span>
                    <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-main)', marginTop: '2px' }}>
                      {selectedOrderDetails.quantity} units
                    </div>
                  </div>

                  <div>
                    <span style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>Payment Method</span>
                    <div style={{ marginTop: '4px' }}>
                      <span className={`badge ${selectedOrderDetails.payment_method === 'Prepaid' ? 'badge-success' : 'badge-neutral'}`} style={{ fontSize: '12px' }}>
                        {selectedOrderDetails.payment_method}
                      </span>
                    </div>
                  </div>
                </div>

                <div style={{ paddingTop: '12px', borderTop: '1px dashed var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-muted)' }}>Total Gross Amount:</span>
                  <strong style={{ fontSize: '19px', color: 'var(--primary-700)' }}>
                    ₹{Number(selectedOrderDetails.total_amount).toLocaleString('en-IN')}
                  </strong>
                </div>
              </div>

              {/* Return Adjustments Banner (if returns exist on this order) */}
              {selectedOrderDetails.returned_quantity > 0 && (
                <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 'var(--radius-md)', padding: '14px 16px', marginBottom: '16px' }}>
                  <div style={{ fontSize: '12px', fontWeight: 700, color: '#991b1b', textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <RotateCcw size={14} color="#dc2626" />
                    <span>Return Adjustments on this Order</span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '10px', fontSize: '12.5px' }}>
                    <div>
                      <div style={{ fontSize: '11px', color: '#b91c1c' }}>Returned Units</div>
                      <strong style={{ fontSize: '14px', color: '#dc2626' }}>{selectedOrderDetails.returned_quantity} units</strong>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Remaining: {selectedOrderDetails.quantity - selectedOrderDetails.returned_quantity} units</div>
                    </div>
                    <div>
                      <div style={{ fontSize: '11px', color: '#b91c1c' }}>Refund Deducted</div>
                      <strong style={{ fontSize: '14px', color: '#dc2626' }}>-₹{Number(selectedOrderDetails.returned_amount || 0).toLocaleString('en-IN')}</strong>
                    </div>
                    <div>
                      <div style={{ fontSize: '11px', color: '#b91c1c' }}>Reversed Incentive</div>
                      <strong style={{ fontSize: '14px', color: '#dc2626' }}>-₹{Number(selectedOrderDetails.reversed_incentive || 0).toLocaleString('en-IN')}</strong>
                    </div>
                    <div>
                      <div style={{ fontSize: '11px', color: '#15803d' }}>Net Order Value</div>
                      <strong style={{ fontSize: '14px', color: '#15803d' }}>
                        ₹{(Number(selectedOrderDetails.total_amount) - Number(selectedOrderDetails.returned_amount || 0)).toLocaleString('en-IN')}
                      </strong>
                    </div>
                  </div>
                </div>
              )}

              {/* Incentive Calculation Snapshot Card */}
              <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 'var(--radius-md)', padding: '16px' }}>
                <div style={{ fontSize: '12px', fontWeight: 700, color: '#166534', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.04em', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <CheckCircle size={14} color="#16a34a" />
                  <span>Incentive Calculation Snapshot</span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: '10px', fontSize: '12.5px', marginBottom: '12px' }}>
                  <div style={{ background: '#ffffff', padding: '8px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid #dcfce7' }}>
                    <div style={{ fontSize: '11px', color: '#15803d' }}>Rule Type</div>
                    <strong style={{ fontSize: '13px' }}>{selectedOrderDetails.incentive_type === 'percentage' ? 'Percentage' : 'Fixed'}</strong>
                  </div>
                  <div style={{ background: '#ffffff', padding: '8px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid #dcfce7' }}>
                    <div style={{ fontSize: '11px', color: '#15803d' }}>Calculation Basis</div>
                    <strong style={{ fontSize: '13px' }}>{selectedOrderDetails.incentive_basis === 'per_unit' ? 'Per Unit' : 'Per Order'}</strong>
                  </div>
                  <div style={{ background: '#ffffff', padding: '8px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid #dcfce7' }}>
                    <div style={{ fontSize: '11px', color: '#15803d' }}>Applied Rate</div>
                    <strong style={{ fontSize: '13px' }}>
                      {selectedOrderDetails.incentive_rate}{selectedOrderDetails.incentive_type === 'percentage' ? '%' : ' INR'}
                    </strong>
                  </div>
                  <div style={{ background: '#ffffff', padding: '8px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid #dcfce7' }}>
                    <div style={{ fontSize: '11px', color: '#15803d' }}>Gross Incentive</div>
                    <strong style={{ fontSize: '13.5px', color: '#15803d' }}>
                      ₹{Number(selectedOrderDetails.incentive_amount || 0).toLocaleString('en-IN')}
                    </strong>
                  </div>
                </div>

                <div style={{ paddingTop: '8px', borderTop: '1px dashed #bbf7d0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                  <div style={{ fontSize: '11.5px', color: '#166534' }}>
                    &bull; Saved as an immutable snapshot. Future changes to product settings do not alter this calculation.
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '13px', color: '#166534', fontWeight: 600 }}>
                      {selectedOrderDetails.returned_quantity > 0 ? 'Net Retained Incentive:' : 'Earned Order Incentive:'}
                    </span>
                    <strong style={{ fontSize: '18px', color: '#15803d' }}>
                      ₹{(Number(selectedOrderDetails.incentive_amount || 0) - Number(selectedOrderDetails.reversed_incentive || 0)).toLocaleString('en-IN')}
                    </strong>
                  </div>
                </div>
              </div>
            </div>

            <div className="modal-footer" style={{ borderTop: '1px solid var(--border-subtle)', padding: '14px 24px', display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setSelectedOrderDetails(null)}
              >
                Close
              </button>
              {(isManager || selectedOrderDetails.staff_id === user?.id) && (
                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => {
                    const target = selectedOrderDetails;
                    setSelectedOrderDetails(null);
                    openEditOrderModal(target);
                  }}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                >
                  <Edit2 size={14} />
                  <span>Edit Order</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 3. Edit Order Modal */}
      {editingOrder && (
        <div className="modal-overlay">
          <div
            className="modal-dialog"
            style={{
              width: 'min(760px, 96vw)',
              maxWidth: '760px',
              maxHeight: '90vh',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden'
            }}
          >
            <div className="modal-header" style={{ flexShrink: 0 }}>
              <h3 className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Edit2 size={18} color="var(--primary-600)" />
                <span>Edit Order: {editingOrder.order_number}</span>
              </h3>
              <button className="modal-close" onClick={() => setEditingOrder(null)}>✕</button>
            </div>

            <form
              onSubmit={handleSaveEditedOrder}
              style={{
                display: 'flex',
                flexDirection: 'column',
                flex: 1,
                minHeight: 0,
                overflow: 'hidden'
              }}
            >
              <div className="modal-body" style={{ padding: '20px 24px', overflowY: 'auto', flex: 1, minHeight: 0 }}>
                {editError && (
                  <div
                    style={{
                      padding: '10px 14px',
                      background: 'var(--danger-bg)',
                      border: '1px solid var(--danger-border)',
                      color: 'var(--danger-text)',
                      borderRadius: 'var(--radius-md)',
                      marginBottom: '14px',
                      fontSize: '13px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px'
                    }}
                  >
                    <AlertCircle size={16} style={{ flexShrink: 0 }} />
                    <span>{editError}</span>
                  </div>
                )}

                {/* Assigned Staff (Manager only) */}
                {isManager ? (
                  <div className="form-group" style={{ marginBottom: '14px' }}>
                    <label className="form-label" style={{ fontWeight: 600, marginBottom: '6px' }}>
                      Sales Staff Member <span className="required">*</span>
                    </label>
                    <select
                      className="form-control"
                      value={editStaffId}
                      onChange={e => setEditStaffId(e.target.value)}
                      required
                    >
                      {staffList.filter(s => s.status === 'active' || String(s.id) === String(editingOrder.staff_id)).map(s => (
                        <option key={s.id} value={s.id}>
                          {s.name} ({s.staff_id})
                        </option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <div style={{ marginBottom: '14px', background: '#f8fafc', padding: '10px 14px', borderRadius: 'var(--radius-sm)', fontSize: '12.5px' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Staff Member: </span>
                    <strong>{editingOrder.staff_name} ({editingOrder.staff_code})</strong>
                  </div>
                )}

                {/* Product & Order Date Grid */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px', marginBottom: '14px' }}>
                  <div className="form-group">
                    <label className="form-label" style={{ fontWeight: 600, marginBottom: '6px' }}>
                      Product <span className="required">*</span>
                    </label>
                    <select
                      className="form-control"
                      value={editProductId}
                      onChange={e => setEditProductId(e.target.value)}
                      required
                    >
                      {products.map(p => (
                        <option key={p.id} value={p.id}>
                          {p.name} — ₹{p.price?.toLocaleString()}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label" style={{ fontWeight: 600, marginBottom: '6px' }}>
                      Order Date <span className="required">*</span>
                    </label>
                    <input
                      type="date"
                      className="form-control"
                      value={editOrderDate}
                      onChange={e => setEditOrderDate(e.target.value)}
                      required
                    />
                  </div>
                </div>

                {/* Quantity & Payment Method */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px', marginBottom: '14px' }}>
                  <div className="form-group">
                    <label className="form-label" style={{ fontWeight: 600, marginBottom: '6px' }}>
                      Quantity <span className="required">*</span>
                    </label>
                    <input
                      type="number"
                      min={editingOrder.returned_quantity > 0 ? editingOrder.returned_quantity : 1}
                      className="form-control"
                      value={editQuantity}
                      onChange={e => setEditQuantity(Math.max(1, parseInt(e.target.value, 10) || 1))}
                      required
                    />
                    {editingOrder.returned_quantity > 0 && (
                      <div style={{ fontSize: '11px', color: '#dc2626', marginTop: '4px' }}>
                        Min: {editingOrder.returned_quantity} (already returned units)
                      </div>
                    )}
                  </div>

                  <div className="form-group">
                    <label className="form-label" style={{ fontWeight: 600, marginBottom: '6px' }}>
                      Payment Method <span className="required">*</span>
                    </label>
                    <select
                      className="form-control"
                      value={editPaymentMethod}
                      onChange={e => setEditPaymentMethod(e.target.value)}
                      required
                    >
                      <option value="Prepaid">Prepaid</option>
                      <option value="COD">Cash on Delivery (COD)</option>
                    </select>
                  </div>
                </div>

                {/* Live Preview */}
                {editPreview && (
                  <div
                    style={{
                      background: '#f8fafc',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: 'var(--radius-md)',
                      padding: '12px 16px',
                      display: 'grid',
                      gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                      gap: '12px'
                    }}
                  >
                    <div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>
                        New Order Amount
                      </div>
                      <div style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-main)', marginTop: '2px' }}>
                        ₹{editPreview.total_amount?.toLocaleString()}
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                        ₹{editPreview.unit_price} &times; {editPreview.quantity} units
                      </div>
                    </div>

                    <div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>
                        Recomputed Incentive
                      </div>
                      <div style={{ fontSize: '18px', fontWeight: 800, color: '#16a34a', marginTop: '2px' }}>
                        ₹{editPreview.estimated_incentive?.amount?.toLocaleString()}
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                        Rule: {editPreview.estimated_incentive?.type === 'percentage' ? `${editPreview.estimated_incentive?.rate}%` : `₹${editPreview.estimated_incentive?.rate}`} ({editPreview.estimated_incentive?.basis === 'per_unit' ? 'per unit' : 'per order'})
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="modal-footer" style={{ borderTop: '1px solid var(--border-subtle)', padding: '14px 24px', flexShrink: 0 }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setEditingOrder(null)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={editSubmitting}
                >
                  {editSubmitting ? 'Saving Changes...' : 'Update Order'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Bulk Order Import Modal (Brand Manager Only) */}
      {isManager && (
        <BulkOrderImportModal
          isOpen={showImportModal}
          onClose={() => setShowImportModal(false)}
          onImportSuccess={fetchOrders}
        />
      )}
    </div>
  );
}
