// src/views/staff/StaffReturns.jsx
import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../api';
import {
  RotateCcw,
  Plus,
  Search,
  CheckCircle,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  X
} from 'lucide-react';

export default function StaffReturns() {
  const { user } = useAuth();
  const isManager = user?.role === 'brand_manager';

  const [returns, setReturns] = useState([]);
  const [returnableOrders, setReturnableOrders] = useState([]);
  const [staffList, setStaffList] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [staffFilter, setStaffFilter] = useState('all');
  const [paymentMethodFilter, setPaymentMethodFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalReturns, setTotalReturns] = useState(0);

  // Modal & Form State
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedOrderId, setSelectedOrderId] = useState('');
  const [selectedProductId, setSelectedProductId] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('Prepaid');
  const [returnQuantity, setReturnQuantity] = useState(1);
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [toastMessage, setToastMessage] = useState('');

  // Initial fetch and trigger on filters
  useEffect(() => {
    fetchReturns();
  }, [page, staffFilter, paymentMethodFilter, startDate, endDate]);

  useEffect(() => {
    fetchReturnableOrders();
    if (isManager) {
      fetchStaffList();
    }
  }, []);

  async function fetchStaffList() {
    try {
      const res = await api.get('/staff');
      setStaffList(res.staff || []);
    } catch (err) {
      console.error('Failed to load staff list:', err);
    }
  }

  async function fetchReturns() {
    setLoading(true);
    try {
      let params = [];
      params.push(`page=${page}`);
      params.push('limit=25');
      if (search.trim()) params.push(`search=${encodeURIComponent(search.trim())}`);
      if (isManager && staffFilter !== 'all') params.push(`staffId=${staffFilter}`);
      if (paymentMethodFilter !== 'all') params.push(`paymentMethod=${paymentMethodFilter}`);
      if (startDate) params.push(`startDate=${startDate}`);
      if (endDate) params.push(`endDate=${endDate}`);

      const qs = params.length > 0 ? '?' + params.join('&') : '';
      const res = await api.get(`/returns${qs}`);
      setReturns(res.returns || []);
      setTotalPages(res.pagination?.totalPages || 1);
      setTotalReturns(res.pagination?.total || 0);
    } catch (err) {
      console.error('Failed to load returns:', err);
    } finally {
      setLoading(false);
    }
  }

  async function fetchReturnableOrders() {
    try {
      const res = await api.get('/orders/returnable');
      const orders = res.returnableOrders || [];
      setReturnableOrders(orders);
      if (orders.length > 0 && !selectedOrderId) {
        setSelectedOrderId(String(orders[0].id));
        setSelectedProductId(String(orders[0].product_id));
        setPaymentMethod(orders[0].payment_method || 'Prepaid');
        setReturnQuantity(1);
      }
    } catch (err) {
      console.error('Failed to load returnable orders:', err);
    }
  }

  // When selected order changes, auto-load its product, payment method & reset quantity
  function handleOrderChange(orderIdStr) {
    setSelectedOrderId(orderIdStr);
    const orderObj = returnableOrders.find(o => String(o.id) === orderIdStr);
    if (orderObj) {
      setSelectedProductId(String(orderObj.product_id));
      setPaymentMethod(orderObj.payment_method || 'Prepaid');
      setReturnQuantity(1);
    }
    setFormError('');
  }

  function openCreateModal() {
    setFormError('');
    fetchReturnableOrders().then(() => {
      setShowAddModal(true);
    });
  }

  async function handleSubmitReturn(e) {
    e.preventDefault();
    setFormError('');

    const orderIdNum = parseInt(selectedOrderId, 10);
    const returnQtyNum = parseInt(returnQuantity, 10);

    if (!orderIdNum) {
      setFormError('Please select an original order.');
      return;
    }

    const orderObj = returnableOrders.find(o => o.id === orderIdNum);
    if (!orderObj) {
      setFormError('Selected order is not eligible for return.');
      return;
    }

    if (isNaN(returnQtyNum) || returnQtyNum <= 0) {
      setFormError('Return quantity must be at least 1.');
      return;
    }

    if (returnQtyNum > orderObj.returnable_quantity) {
      setFormError(`Cannot return ${returnQtyNum} units. Only ${orderObj.returnable_quantity} returnable units remain.`);
      return;
    }

    setSubmitting(true);
    try {
      const res = await api.post('/returns', {
        order_id: orderIdNum,
        product_id: parseInt(selectedProductId || orderObj.product_id, 10),
        payment_method: paymentMethod,
        return_quantity: returnQtyNum
      });

      setToastMessage(`Return ${res.returnItem?.return_number || 'processed'} successfully recorded.`);
      setTimeout(() => setToastMessage(''), 5000);

      setShowAddModal(false);
      fetchReturns();
      fetchReturnableOrders();
    } catch (err) {
      setFormError(err.message || 'Failed to record return.');
    } finally {
      setSubmitting(false);
    }
  }

  function handleResetFilters() {
    setSearch('');
    setStartDate('');
    setEndDate('');
    setPaymentMethodFilter('all');
    setStaffFilter('all');
    setPage(1);
    setTimeout(() => {
      fetchReturns();
    }, 0);
  }

  const selectedOrderObj = returnableOrders.find(o => String(o.id) === String(selectedOrderId));
  const maxReturnable = selectedOrderObj?.returnable_quantity || 1;
  const hasActiveFilters = search || startDate || endDate || paymentMethodFilter !== 'all' || staffFilter !== 'all';

  return (
    <div className="page-body">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="toast-container">
          <div className="toast success">
            <CheckCircle size={18} color="var(--success-solid)" />
            <span>{toastMessage}</span>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="page-header">
        <div>
          <h2 className="page-title">{isManager ? 'Returns Audit' : 'Returns'}</h2>
        </div>

        <button
          className="btn btn-primary"
          onClick={openCreateModal}
          style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
        >
          <Plus size={16} />
          <span>Record Return</span>
        </button>
      </div>

      {/* Search & Filter Card */}
      <div className="table-card">
        <div
          className="table-toolbar"
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px'
          }}
        >
          {/* Search by Return ID, Product, Staff, Payment Method */}
          <div style={{ display: 'flex', gap: '10px', flex: '1 1 260px', flexWrap: 'wrap' }}>
            <div className="search-input-wrap" style={{ minWidth: '220px', flex: 1 }}>
              <Search size={16} />
              <input
                type="text"
                className="search-input"
                placeholder="Search Return ID, Product, Staff..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    setPage(1);
                    fetchReturns();
                  }
                }}
              />
            </div>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => {
                setPage(1);
                fetchReturns();
              }}
            >
              Search
            </button>
          </div>

          {/* Payment Method, Date & Staff Filters */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            {/* Payment Method Filter (Prepaid or COD) */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
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

            {/* Start Date */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)' }}>From:</span>
              <input
                type="date"
                className="form-control"
                style={{ width: 'auto', padding: '5px 10px', fontSize: '12.5px' }}
                value={startDate}
                onChange={e => {
                  setStartDate(e.target.value);
                  setPage(1);
                }}
              />
            </div>

            {/* End Date */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)' }}>To:</span>
              <input
                type="date"
                className="form-control"
                style={{ width: 'auto', padding: '5px 10px', fontSize: '12.5px' }}
                value={endDate}
                onChange={e => {
                  setEndDate(e.target.value);
                  setPage(1);
                }}
              />
            </div>

            {/* Staff Filter (Brand Manager only) */}
            {isManager && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
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
                    <option key={s.id} value={s.id}>
                      {s.name} ({s.staff_id})
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Reset Filters */}
            {hasActiveFilters && (
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={handleResetFilters}
                title="Reset all filters"
                style={{ padding: '5px 10px', fontSize: '12px' }}
              >
                <X size={13} style={{ marginRight: '4px' }} /> Reset
              </button>
            )}
          </div>
        </div>

        {/* Returns Table: Return ID | Return Date | Returned By | Product | Payment Method | Returned Quantity */}
        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th>Return ID</th>
                <th>Return Date</th>
                <th>Returned By (Staff)</th>
                <th>Product</th>
                <th>Payment Method</th>
                <th style={{ textAlign: 'right' }}>Returned Quantity</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="6" style={{ textAlign: 'center', padding: '36px', color: 'var(--text-muted)' }}>
                    Loading return records...
                  </td>
                </tr>
              ) : returns.length === 0 ? (
                <tr>
                  <td colSpan="6">
                    <div className="empty-state" style={{ padding: '36px 16px' }}>
                      <div className="empty-state-icon">
                        <RotateCcw size={28} />
                      </div>
                      <div className="empty-state-title" style={{ fontSize: '16px' }}>No returns recorded</div>
                      <div className="empty-state-desc" style={{ maxWidth: '360px' }}>
                        No product returns matching the selected filters were found.
                      </div>
                      {returnableOrders.length > 0 && (
                        <button
                          className="btn btn-primary btn-sm"
                          onClick={openCreateModal}
                          style={{ marginTop: '12px' }}
                        >
                          <Plus size={14} /> Record Return
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                returns.map(r => (
                  <tr key={r.id}>
                    <td>
                      <strong style={{ color: 'var(--primary-700)', fontFamily: 'monospace', fontSize: '13px' }}>
                        {r.return_number}
                      </strong>
                    </td>
                    <td>{r.return_date}</td>
                    <td>
                      <div>
                        <strong>{r.returned_by_name || r.staff_name || 'Staff Member'}</strong>
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                        {r.returned_by_code || r.staff_code || ''}
                      </div>
                    </td>
                    <td>
                      <div>
                        <strong>{r.product_name}</strong>
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                        {r.product_code}
                      </div>
                    </td>
                    <td>
                      <span className={`badge ${r.payment_method === 'Prepaid' ? 'badge-success' : 'badge-neutral'}`}>
                        {r.payment_method || 'Prepaid'}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right', fontWeight: 700, fontSize: '14px' }}>
                      {r.return_quantity}
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
              Showing {returns.length} of {totalReturns} returns
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

      {/* Add Return Modal */}
      {showAddModal && (
        <div className="modal-overlay">
          <div className="modal-dialog" style={{ maxWidth: '480px' }}>
            <div className="modal-header">
              <h3 className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <RotateCcw size={18} color="var(--primary-600)" />
                <span>Record Return</span>
              </h3>
              <button className="modal-close" onClick={() => setShowAddModal(false)}>✕</button>
            </div>

            <form onSubmit={handleSubmitReturn}>
              <div className="modal-body">
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

                {returnableOrders.length === 0 ? (
                  <div className="empty-state" style={{ padding: '24px 16px' }}>
                    <div className="empty-state-title">No Returnable Orders</div>
                    <div className="empty-state-desc">
                      All confirmed orders have already been fully returned, or no eligible orders were found.
                    </div>
                  </div>
                ) : (
                  <>
                    {/* Field 1: Original Order */}
                    <div className="form-group" style={{ marginBottom: '16px' }}>
                      <label className="form-label" style={{ fontWeight: 600, marginBottom: '6px' }}>
                        Original Order <span className="required">*</span>
                      </label>
                      <select
                        className="form-control"
                        value={selectedOrderId}
                        onChange={e => handleOrderChange(e.target.value)}
                        required
                        style={{ fontSize: '13.5px' }}
                      >
                        {returnableOrders.map(o => (
                          <option key={o.id} value={o.id}>
                            {o.order_number} &bull; {o.order_date} ({o.product_name} &bull; {o.payment_method})
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Field 2: Product (Belonging to selected order) */}
                    <div className="form-group" style={{ marginBottom: '16px' }}>
                      <label className="form-label" style={{ fontWeight: 600, marginBottom: '6px' }}>
                        Product <span className="required">*</span>
                      </label>
                      <select
                        className="form-control"
                        value={selectedProductId}
                        onChange={e => setSelectedProductId(e.target.value)}
                        required
                        style={{ fontSize: '13.5px' }}
                      >
                        {selectedOrderObj && (
                          <option value={selectedOrderObj.product_id}>
                            {selectedOrderObj.product_name} ({selectedOrderObj.product_code})
                          </option>
                        )}
                      </select>

                      {/* Remaining returnable quantity indicator */}
                      <div
                        style={{
                          marginTop: '6px',
                          fontSize: '12.5px',
                          color: 'var(--primary-700)',
                          background: 'var(--primary-50)',
                          padding: '6px 10px',
                          borderRadius: 'var(--radius-sm)',
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px'
                        }}
                      >
                        <span>Remaining Returnable Quantity:</span>
                        <strong style={{ fontSize: '13px' }}>{maxReturnable} units</strong>
                      </div>
                    </div>

                    {/* Field 3: Payment Method (Prepaid or COD) */}
                    <div className="form-group" style={{ marginBottom: '16px' }}>
                      <label className="form-label" style={{ fontWeight: 600, marginBottom: '6px' }}>
                        Payment Method <span className="required">*</span>
                      </label>
                      <select
                        className="form-control"
                        value={paymentMethod}
                        onChange={e => setPaymentMethod(e.target.value)}
                        required
                        style={{ fontSize: '13.5px' }}
                      >
                        <option value="Prepaid">Prepaid</option>
                        <option value="COD">Cash on Delivery (COD)</option>
                      </select>
                    </div>

                    {/* Field 4: Return Quantity */}
                    <div className="form-group" style={{ marginBottom: '10px' }}>
                      <label className="form-label" style={{ fontWeight: 600, marginBottom: '6px' }}>
                        Return Quantity <span className="required">*</span>
                      </label>
                      <input
                        type="number"
                        min="1"
                        max={maxReturnable}
                        className="form-control"
                        value={returnQuantity}
                        onChange={e => {
                          const val = parseInt(e.target.value, 10);
                          setReturnQuantity(isNaN(val) ? '' : val);
                          if (val > maxReturnable) {
                            setFormError(`Quantity cannot exceed remaining returnable quantity (${maxReturnable}).`);
                          } else {
                            setFormError('');
                          }
                        }}
                        required
                        style={{ fontSize: '14px' }}
                      />
                      {returnQuantity > maxReturnable && (
                        <div style={{ color: 'var(--danger-text)', fontSize: '12px', marginTop: '4px' }}>
                          Return quantity exceeds remaining returnable quantity ({maxReturnable}).
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>

              <div className="modal-footer" style={{ borderTop: '1px solid var(--border-subtle)', padding: '14px 20px' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowAddModal(false)}
                >
                  Cancel
                </button>
                {returnableOrders.length > 0 && (
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={submitting || returnQuantity > maxReturnable || returnQuantity < 1}
                  >
                    {submitting ? 'Saving...' : 'Save Return'}
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
