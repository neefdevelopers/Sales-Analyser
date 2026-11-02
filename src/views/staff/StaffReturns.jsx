// src/views/staff/StaffReturns.jsx
import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../api';
import { useSessionState } from '../../hooks/useSessionState';
import {
  RotateCcw,
  Plus,
  Search,
  CheckCircle,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  X,
  Filter,
  ChevronDown,
  Eye,
  Edit2,
  Calendar,
  User,
  Package,
  FileText,
  DollarSign
} from 'lucide-react';

export default function StaffReturns() {
  const { user } = useAuth();
  const isManager = user?.role === 'brand_manager';

  const [returns, setReturns] = useState([]);
  const [products, setProducts] = useState([]);
  const [staffList, setStaffList] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters (Persisted per session)
  const [search, setSearch] = useSessionState('filter_returns_search', '');
  const [startDate, setStartDate] = useSessionState('filter_returns_start_date', '');
  const [endDate, setEndDate] = useSessionState('filter_returns_end_date', '');
  const [staffFilter, setStaffFilter] = useSessionState('filter_returns_staff', 'all');
  const [paymentMethodFilter, setPaymentMethodFilter] = useSessionState('filter_returns_payment', 'all');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalReturns, setTotalReturns] = useState(0);

  // Toggle filtration panel
  const [showFilters, setShowFilters] = useState(false);

  // Add Return Modal & Form State
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedStaffMemberId, setSelectedStaffMemberId] = useState('');
  const [selectedProductId, setSelectedProductId] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('Prepaid');
  const [returnQuantity, setReturnQuantity] = useState(1);
  const [returnDate, setReturnDate] = useState('');
  const [returnReason, setReturnReason] = useState('Product Return');
  const [remarks, setRemarks] = useState('');
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [toastMessage, setToastMessage] = useState('');

  // View Details Modal State
  const [selectedReturnDetails, setSelectedReturnDetails] = useState(null);

  // Edit Return Modal State
  const [editingReturn, setEditingReturn] = useState(null);
  const [editStaffId, setEditStaffId] = useState('');
  const [editReturnQuantity, setEditReturnQuantity] = useState(1);
  const [editPaymentMethod, setEditPaymentMethod] = useState('Prepaid');
  const [editReturnDate, setEditReturnDate] = useState('');
  const [editReturnReason, setEditReturnReason] = useState('Product Return');
  const [editRemarks, setEditRemarks] = useState('');
  const [editError, setEditError] = useState('');
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [editPreview, setEditPreview] = useState(null);

  // Initial fetch and trigger on filters
  useEffect(() => {
    fetchReturns();
  }, [page, staffFilter, paymentMethodFilter, startDate, endDate]);

  useEffect(() => {
    fetchProducts();
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

  async function fetchProducts() {
    try {
      const res = await api.get('/products');
      const prods = res.products || [];
      setProducts(prods);
      if (prods.length > 0 && !selectedProductId) {
        setSelectedProductId(String(prods[0].id));
      }
    } catch (err) {
      console.error('Failed to load products:', err);
    }
  }

  function openCreateModal() {
    setFormError('');
    setReturnQuantity(1);
    setPaymentMethod('Prepaid');
    setReturnDate(new Date().toISOString().split('T')[0]);
    setReturnReason('Product Return');
    setRemarks('');
    if (products.length > 0) {
      setSelectedProductId(String(products[0].id));
    }
    if (isManager && staffList.length > 0) {
      setSelectedStaffMemberId(String(staffList[0].id));
    } else {
      setSelectedStaffMemberId('');
    }
    fetchProducts().then(() => {
      setShowAddModal(true);
    });
  }

  async function handleSubmitReturn(e) {
    e.preventDefault();
    setFormError('');

    if (isManager && !selectedStaffMemberId) {
      setFormError('Please select an assigned staff member.');
      return;
    }

    const prodIdNum = parseInt(selectedProductId, 10);
    const returnQtyNum = parseInt(returnQuantity, 10);

    if (!prodIdNum) {
      setFormError('Please select a product.');
      return;
    }

    if (isNaN(returnQtyNum) || returnQtyNum <= 0) {
      setFormError('Return quantity must be at least 1.');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        product_id: prodIdNum,
        payment_method: paymentMethod,
        return_quantity: returnQtyNum,
        return_date: returnDate || undefined,
        return_reason: returnReason || undefined,
        remarks: remarks.trim() || undefined
      };

      if (isManager && selectedStaffMemberId) {
        payload.staff_id = parseInt(selectedStaffMemberId, 10);
      }

      const res = await api.post('/returns', payload);

      setToastMessage(`Return ${res.returnItem?.return_number || 'processed'} successfully recorded.`);
      setTimeout(() => setToastMessage(''), 5000);

      setShowAddModal(false);
      fetchReturns();
    } catch (err) {
      setFormError(err.message || 'Failed to record return.');
    } finally {
      setSubmitting(false);
    }
  }

  function openEditReturnModal(ret) {
    setEditingReturn(ret);
    setEditStaffId(String(ret.staff_id || ret.returned_by_staff_id || ''));
    setEditReturnQuantity(ret.return_quantity || 1);
    setEditPaymentMethod(ret.payment_method || 'Prepaid');
    setEditReturnDate(ret.return_date || new Date().toISOString().split('T')[0]);
    setEditReturnReason(ret.return_reason || 'Product Return');
    setEditRemarks(ret.remarks || '');
    setEditError('');
    setSelectedReturnDetails(null);
  }

  // Preview live changes for editing return
  useEffect(() => {
    if (editingReturn && editReturnQuantity > 0) {
      api.post('/returns/preview', {
        return_id: editingReturn.id,
        order_id: editingReturn.order_id,
        product_id: editingReturn.product_id,
        payment_method: editPaymentMethod,
        return_quantity: parseInt(editReturnQuantity, 10)
      })
        .then(res => {
          setEditPreview(res);
          setEditError('');
        })
        .catch(err => {
          setEditPreview(null);
          if (err.message) {
            setEditError(err.message);
          }
        });
    } else {
      setEditPreview(null);
    }
  }, [editingReturn, editReturnQuantity, editPaymentMethod]);

  async function handleSaveEditedReturn(e) {
    e.preventDefault();
    setEditError('');

    if (isManager && !editStaffId) {
      setEditError('Please select an assigned staff member.');
      return;
    }

    const qtyNum = parseInt(editReturnQuantity, 10);
    if (isNaN(qtyNum) || qtyNum <= 0) {
      setEditError('Return quantity must be at least 1.');
      return;
    }

    setEditSubmitting(true);
    try {
      const payload = {
        return_quantity: qtyNum,
        payment_method: editPaymentMethod,
        return_date: editReturnDate || undefined,
        return_reason: editReturnReason || undefined,
        remarks: editRemarks.trim() || undefined
      };

      if (isManager && editStaffId) {
        payload.staff_id = parseInt(editStaffId, 10);
      }

      const res = await api.put(`/returns/${editingReturn.id}`, payload);
      setToastMessage(`Return ${res.returnItem?.return_number || 'record'} updated successfully.`);
      setTimeout(() => setToastMessage(''), 5000);

      setEditingReturn(null);
      fetchReturns();
    } catch (err) {
      setEditError(err.message || 'Failed to update return.');
    } finally {
      setEditSubmitting(false);
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

  const selectedProductObj = products.find(p => String(p.id) === String(selectedProductId)) || (products.length > 0 ? products[0] : null);
  const unitPrice = selectedProductObj?.price || 0;
  const returnQtyNum = parseInt(returnQuantity, 10) || 0;
  const refundAmount = Math.round(unitPrice * returnQtyNum * 100) / 100;

  // Calculate estimated reversed incentive for Add Modal
  let estReversedIncentive = 0;
  if (selectedProductObj && returnQtyNum > 0) {
    const isPrepaid = paymentMethod === 'Prepaid';
    const type = isPrepaid ? selectedProductObj.prepaid_incentive_type : selectedProductObj.cod_incentive_type;
    const basis = isPrepaid ? selectedProductObj.prepaid_incentive_basis : selectedProductObj.cod_incentive_basis;
    const val = isPrepaid ? (selectedProductObj.prepaid_incentive_value || 0) : (selectedProductObj.cod_incentive_value || 0);

    if (type === 'fixed') {
      estReversedIncentive = basis === 'per_unit' ? val * returnQtyNum : val;
    } else if (type === 'percentage') {
      estReversedIncentive = (unitPrice * returnQtyNum) * (val / 100);
    }
    estReversedIncentive = Math.round(estReversedIncentive * 100) / 100;
  }

  const hasActiveFilters = search || startDate || endDate || paymentMethodFilter !== 'all' || staffFilter !== 'all';
  const activeFilterCount = (search.trim() ? 1 : 0) +
    (paymentMethodFilter !== 'all' ? 1 : 0) +
    (staffFilter !== 'all' ? 1 : 0) +
    (startDate || endDate ? 1 : 0);

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

          <button
            className="btn btn-primary"
            onClick={openCreateModal}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
          >
            <Plus size={16} />
            <span>Record Return</span>
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
                Showing all recent returns
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
                (Filter returns by keyword, payment method, staff, and date range)
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
              {/* Search by Return ID, Product, Staff, Payment Method */}
              <div className="filter-search-row">
                <div className="search-input-wrap">
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
                  style={{ minHeight: '36px', padding: '0 14px' }}
                >
                  Search
                </button>
              </div>

              {/* Payment Method, Date & Staff Filters Grid */}
              <div className="filter-fields-wrap">
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
                        <option key={s.id} value={s.id}>
                          {s.name} ({s.staff_id})
                        </option>
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

                {/* Reset Filters */}
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

      {/* Returns Table Card */}
      <div className="table-card">
        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th>Return ID</th>
                <th>Return Date</th>
                <th>Staff Member</th>
                <th>Product</th>
                <th>Payment Method</th>
                <th style={{ textAlign: 'right' }}>Returned Quantity</th>
                <th style={{ textAlign: 'center', width: '90px' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="7" style={{ textAlign: 'center', padding: '36px', color: 'var(--text-muted)' }}>
                    Loading return records...
                  </td>
                </tr>
              ) : returns.length === 0 ? (
                <tr>
                  <td colSpan="7">
                    <div className="empty-state" style={{ padding: '36px 16px' }}>
                      <div className="empty-state-icon">
                        <RotateCcw size={28} />
                      </div>
                      <div className="empty-state-title" style={{ fontSize: '16px' }}>No returns recorded</div>
                      <div className="empty-state-desc" style={{ maxWidth: '360px' }}>
                        No product returns matching the selected filters were found.
                      </div>
                      <button
                        className="btn btn-primary btn-sm"
                        onClick={openCreateModal}
                        style={{ marginTop: '12px' }}
                      >
                        <Plus size={14} /> Record Return
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                returns.map(r => {
                  const canEdit = isManager || r.staff_id === user?.id || r.returned_by_staff_id === user?.id;

                  return (
                    <tr key={r.id}>
                      <td>
                        <strong style={{ color: 'var(--primary-700)', fontFamily: 'monospace', fontSize: '13px' }}>
                          {r.return_number}
                        </strong>
                        {r.order_number && r.order_number !== '-' && (
                          <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                            Ord: {r.order_number}
                          </div>
                        )}
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
                      <td style={{ textAlign: 'center' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', justifyContent: 'center' }}>
                          <button
                            type="button"
                            className="btn btn-sm btn-ghost"
                            style={{ padding: '4px 6px', color: 'var(--text-muted)' }}
                            title="View Return Details"
                            onClick={() => setSelectedReturnDetails(r)}
                          >
                            <Eye size={15} />
                          </button>
                          {canEdit && (
                            <button
                              type="button"
                              className="btn btn-sm btn-ghost"
                              style={{ padding: '4px 6px', color: 'var(--primary-600)' }}
                              title="Edit Return"
                              onClick={() => openEditReturnModal(r)}
                            >
                              <Edit2 size={15} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
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

      {/* Record Return Modal (Add Return) */}
      {showAddModal && (
        <div className="modal-overlay">
          <div
            className="modal-dialog"
            style={{
              width: 'min(580px, 96vw)',
              maxWidth: '580px',
              maxHeight: '90vh',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden'
            }}
          >
            <div className="modal-header" style={{ flexShrink: 0 }}>
              <h3 className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <RotateCcw size={18} color="var(--primary-600)" />
                <span>Record Return</span>
              </h3>
              <button className="modal-close" onClick={() => setShowAddModal(false)}>✕</button>
            </div>

            <form
              onSubmit={handleSubmitReturn}
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

                {/* Brand Manager: Assign Staff Member */}
                {isManager && (
                  <div className="form-group" style={{ marginBottom: '16px' }}>
                    <label className="form-label" style={{ fontWeight: 600, marginBottom: '6px' }}>
                      Assign to Sales Staff <span className="required">*</span>
                    </label>
                    <select
                      className="form-control"
                      value={selectedStaffMemberId}
                      onChange={e => setSelectedStaffMemberId(e.target.value)}
                      required
                      style={{ fontSize: '13.5px' }}
                    >
                      <option value="" disabled>Select staff member...</option>
                      {staffList.filter(s => s.status === 'active').map(s => (
                        <option key={s.id} value={s.id}>
                          {s.name} ({s.staff_id}) &bull; {s.email}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Field 1: Product */}
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
                    <option value="" disabled>Select a product...</option>
                    {products.map(p => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.code}) &bull; ₹{p.price.toLocaleString('en-IN')}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Field 2 & 3: Payment Method and Return Quantity */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '16px' }}>
                  <div className="form-group">
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

                  <div className="form-group">
                    <label className="form-label" style={{ fontWeight: 600, marginBottom: '6px' }}>
                      Return Quantity <span className="required">*</span>
                    </label>
                    <input
                      type="number"
                      min="1"
                      className="form-control"
                      value={returnQuantity}
                      onChange={e => {
                        const val = parseInt(e.target.value, 10);
                        setReturnQuantity(isNaN(val) ? '' : val);
                      }}
                      required
                      style={{ fontSize: '14px' }}
                    />
                  </div>
                </div>

                {/* Field 4: Return Date */}
                <div className="form-group" style={{ marginBottom: '16px' }}>
                  <label className="form-label" style={{ fontWeight: 600, marginBottom: '6px' }}>
                    Return Date <span className="required">*</span>
                  </label>
                  <input
                    type="date"
                    className="form-control"
                    value={returnDate}
                    onChange={e => setReturnDate(e.target.value)}
                    required
                    style={{ fontSize: '13.5px' }}
                  />
                </div>

                {/* Field 5 & 6: Return Reason & Remarks */}
                <div className="form-group" style={{ marginBottom: '16px' }}>
                  <label className="form-label" style={{ fontWeight: 600, marginBottom: '6px' }}>
                    Return Reason
                  </label>
                  <select
                    className="form-control"
                    value={returnReason}
                    onChange={e => setReturnReason(e.target.value)}
                    style={{ fontSize: '13.5px', marginBottom: '8px' }}
                  >
                    <option value="Product Return">Product Return</option>
                    <option value="Damaged / Defective">Damaged / Defective</option>
                    <option value="Incorrect Size / Color">Incorrect Size / Color</option>
                    <option value="Customer Cancellation">Customer Cancellation</option>
                    <option value="Exchange">Exchange</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                <div className="form-group" style={{ marginBottom: '16px' }}>
                  <label className="form-label" style={{ fontWeight: 600, marginBottom: '6px' }}>
                    Remarks (Optional)
                  </label>
                  <textarea
                    className="form-control"
                    rows="2"
                    placeholder="Optional notes or details regarding this return..."
                    value={remarks}
                    onChange={e => setRemarks(e.target.value)}
                    style={{ fontSize: '13px' }}
                  />
                </div>

                {/* Live Preview of Refund Amount and Incentive Reversal */}
                {selectedProductObj && (
                  <div
                    style={{
                      background: 'var(--bg-subtle)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: 'var(--radius-md)',
                      padding: '12px 14px',
                      fontSize: '13px'
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                      <span style={{ color: 'var(--text-muted)' }}>Unit Price:</span>
                      <strong>₹{unitPrice.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                      <span style={{ color: 'var(--text-muted)' }}>Refund Amount:</span>
                      <strong>₹{refundAmount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', color: '#b91c1c' }}>
                      <span>Incentive Reversal:</span>
                      <strong>-₹{estReversedIncentive.toLocaleString('en-IN', { minimumFractionDigits: 2 })}</strong>
                    </div>
                  </div>
                )}
              </div>

              <div className="modal-footer" style={{ borderTop: '1px solid var(--border-subtle)', padding: '14px 20px', flexShrink: 0 }}>
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
                  disabled={submitting || !selectedProductId || returnQuantity < 1}
                >
                  {submitting ? 'Saving...' : 'Save Return'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Return Modal */}
      {editingReturn && (
        <div className="modal-overlay">
          <div
            className="modal-dialog"
            style={{
              width: 'min(620px, 96vw)',
              maxWidth: '620px',
              maxHeight: '90vh',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden'
            }}
          >
            <div className="modal-header" style={{ flexShrink: 0 }}>
              <h3 className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Edit2 size={18} color="var(--primary-600)" />
                <span>Edit Return: {editingReturn.return_number}</span>
              </h3>
              <button className="modal-close" onClick={() => setEditingReturn(null)}>✕</button>
            </div>

            <form
              onSubmit={handleSaveEditedReturn}
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
                      marginBottom: '16px',
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

                {/* Assigned Staff Member */}
                {isManager ? (
                  <div className="form-group" style={{ marginBottom: '16px' }}>
                    <label className="form-label" style={{ fontWeight: 600, marginBottom: '6px' }}>
                      Assigned Sales Staff <span className="required">*</span>
                    </label>
                    <select
                      className="form-control"
                      value={editStaffId}
                      onChange={e => setEditStaffId(e.target.value)}
                      required
                      style={{ fontSize: '13.5px' }}
                    >
                      {staffList.filter(s => s.status === 'active' || String(s.id) === String(editingReturn.staff_id)).map(s => (
                        <option key={s.id} value={s.id}>
                          {s.name} ({s.staff_id}) &bull; {s.email}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <div className="form-group" style={{ marginBottom: '16px' }}>
                    <label className="form-label" style={{ fontWeight: 600, marginBottom: '4px' }}>
                      Assigned Staff
                    </label>
                    <div style={{ fontSize: '13px', color: 'var(--text-secondary)', background: 'var(--bg-subtle)', padding: '8px 12px', borderRadius: 'var(--radius-md)' }}>
                      <strong>{editingReturn.staff_name || editingReturn.returned_by_name || 'Staff Member'}</strong>
                    </div>
                  </div>
                )}

                {/* Product Information (Read-only for return) */}
                <div style={{ border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', padding: '12px 14px', marginBottom: '16px', background: '#f8fafc' }}>
                  <div style={{ fontSize: '11.5px', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 700, marginBottom: '4px' }}>
                    Product Details
                  </div>
                  <div style={{ fontSize: '13.5px', fontWeight: 600, color: 'var(--text-main)' }}>
                    {editingReturn.product_name}
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                    SKU: {editingReturn.product_code}
                    {editingReturn.order_number && editingReturn.order_number !== '-' && (
                      <span style={{ marginLeft: '10px', color: 'var(--primary-700)', fontWeight: 600 }}>
                        Linked Order: {editingReturn.order_number}
                      </span>
                    )}
                  </div>
                </div>

                {/* Return Quantity & Payment Method */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', marginBottom: '16px' }}>
                  <div className="form-group">
                    <label className="form-label" style={{ fontWeight: 600, marginBottom: '6px' }}>
                      Return Quantity <span className="required">*</span>
                    </label>
                    <input
                      type="number"
                      min="1"
                      className="form-control"
                      value={editReturnQuantity}
                      onChange={e => {
                        const val = parseInt(e.target.value, 10);
                        setEditReturnQuantity(isNaN(val) ? '' : val);
                      }}
                      required
                      style={{ fontSize: '14px' }}
                    />
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
                      style={{ fontSize: '13.5px' }}
                    >
                      <option value="Prepaid">Prepaid</option>
                      <option value="COD">Cash on Delivery (COD)</option>
                    </select>
                  </div>
                </div>

                {/* Return Date */}
                <div className="form-group" style={{ marginBottom: '16px' }}>
                  <label className="form-label" style={{ fontWeight: 600, marginBottom: '6px' }}>
                    Return Date <span className="required">*</span>
                  </label>
                  <input
                    type="date"
                    className="form-control"
                    value={editReturnDate}
                    onChange={e => setEditReturnDate(e.target.value)}
                    required
                    style={{ fontSize: '13.5px' }}
                  />
                </div>

                {/* Return Reason & Remarks */}
                <div className="form-group" style={{ marginBottom: '16px' }}>
                  <label className="form-label" style={{ fontWeight: 600, marginBottom: '6px' }}>
                    Return Reason
                  </label>
                  <select
                    className="form-control"
                    value={editReturnReason}
                    onChange={e => setEditReturnReason(e.target.value)}
                    style={{ fontSize: '13.5px' }}
                  >
                    <option value="Product Return">Product Return</option>
                    <option value="Damaged / Defective">Damaged / Defective</option>
                    <option value="Incorrect Size / Color">Incorrect Size / Color</option>
                    <option value="Customer Cancellation">Customer Cancellation</option>
                    <option value="Exchange">Exchange</option>
                    <option value="Other">Other</option>
                  </select>
                </div>

                <div className="form-group" style={{ marginBottom: '16px' }}>
                  <label className="form-label" style={{ fontWeight: 600, marginBottom: '6px' }}>
                    Remarks (Optional)
                  </label>
                  <textarea
                    className="form-control"
                    rows="2"
                    placeholder="Optional notes or details regarding this return..."
                    value={editRemarks}
                    onChange={e => setEditRemarks(e.target.value)}
                    style={{ fontSize: '13px' }}
                  />
                </div>

                {/* Live Preview Card */}
                {editPreview && (
                  <div
                    style={{
                      background: 'var(--bg-subtle)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: 'var(--radius-md)',
                      padding: '12px 16px',
                      display: 'grid',
                      gridTemplateColumns: '1fr 1fr',
                      gap: '12px'
                    }}
                  >
                    <div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>
                        Updated Refund Amount
                      </div>
                      <div style={{ fontSize: '17px', fontWeight: 800, color: 'var(--text-main)', marginTop: '2px' }}>
                        ₹{Number(editPreview.return_amount).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                        ₹{editPreview.unit_price} &times; {editPreview.return_quantity} units
                      </div>
                    </div>

                    <div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600 }}>
                        Reversed Incentive
                      </div>
                      <div style={{ fontSize: '17px', fontWeight: 800, color: '#dc2626', marginTop: '2px' }}>
                        -₹{Number(editPreview.reversed_incentive).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                        Deducted from sales rep
                      </div>
                    </div>
                  </div>
                )}
              </div>

              <div className="modal-footer" style={{ borderTop: '1px solid var(--border-subtle)', padding: '14px 20px', flexShrink: 0 }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setEditingReturn(null)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={editSubmitting || !editReturnQuantity || editReturnQuantity < 1}
                >
                  {editSubmitting ? 'Saving Changes...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Return Details Modal */}
      {selectedReturnDetails && (
        <div className="modal-overlay">
          <div
            className="modal-dialog"
            style={{
              width: 'min(720px, 96vw)',
              maxWidth: '720px',
              maxHeight: '92vh',
              display: 'flex',
              flexDirection: 'column'
            }}
          >
            <div className="modal-header">
              <h3 className="modal-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <RotateCcw size={18} color="var(--primary-600)" />
                <span>Return Details: {selectedReturnDetails.return_number}</span>
              </h3>
              <button className="modal-close" onClick={() => setSelectedReturnDetails(null)}>✕</button>
            </div>

            <div className="modal-body" style={{ padding: '20px 24px', overflowY: 'auto', flex: 1 }}>
              {/* Return Overview Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '10px', marginBottom: '16px' }}>
                <div style={{ background: 'var(--bg-subtle)', padding: '10px 12px', borderRadius: 'var(--radius-md)' }}>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Return Date</div>
                  <strong>{selectedReturnDetails.return_date}</strong>
                </div>
                <div style={{ background: 'var(--bg-subtle)', padding: '10px 12px', borderRadius: 'var(--radius-md)' }}>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Payment Method</div>
                  <span className={`badge ${selectedReturnDetails.payment_method === 'Prepaid' ? 'badge-success' : 'badge-neutral'}`}>
                    {selectedReturnDetails.payment_method || 'Prepaid'}
                  </span>
                </div>
                <div style={{ background: 'var(--bg-subtle)', padding: '10px 12px', borderRadius: 'var(--radius-md)' }}>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Returned Quantity</div>
                  <strong style={{ fontSize: '14px' }}>{selectedReturnDetails.return_quantity} units</strong>
                </div>
              </div>

              {/* Staff Member Card */}
              <div style={{ border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', padding: '12px 14px', marginBottom: '14px' }}>
                <div style={{ fontSize: '11.5px', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 700, marginBottom: '6px' }}>
                  Staff Attribution
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <strong style={{ fontSize: '13.5px' }}>{selectedReturnDetails.returned_by_name || selectedReturnDetails.staff_name || 'Staff Member'}</strong>
                    <div style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>
                      ID: {selectedReturnDetails.returned_by_code || selectedReturnDetails.staff_code || '-'}
                    </div>
                  </div>
                </div>
              </div>

              {/* Product & Order Information */}
              <div style={{ border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', padding: '12px 14px', marginBottom: '14px' }}>
                <div style={{ fontSize: '11.5px', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 700, marginBottom: '6px' }}>
                  Product Details
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <span style={{ fontSize: '12.5px', color: 'var(--text-muted)' }}>Product:</span>
                  <strong>{selectedReturnDetails.product_name}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                  <span style={{ fontSize: '12.5px', color: 'var(--text-muted)' }}>SKU / Code:</span>
                  <span style={{ fontFamily: 'monospace', fontSize: '12px' }}>{selectedReturnDetails.product_code}</span>
                </div>
                {selectedReturnDetails.order_number && selectedReturnDetails.order_number !== '-' && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '6px', paddingTop: '6px', borderTop: '1px dashed var(--border-subtle)' }}>
                    <span style={{ fontSize: '12.5px', color: 'var(--text-muted)' }}>Linked Order:</span>
                    <strong style={{ color: 'var(--primary-700)', fontFamily: 'monospace' }}>
                      {selectedReturnDetails.order_number}
                    </strong>
                  </div>
                )}
              </div>

              {/* Financial Impact Snapshot */}
              <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 'var(--radius-md)', padding: '12px 14px', marginBottom: '14px' }}>
                <div style={{ fontSize: '11.5px', textTransform: 'uppercase', color: '#991b1b', fontWeight: 700, marginBottom: '8px' }}>
                  Financial Adjustments
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <span style={{ fontSize: '12.5px', color: 'var(--text-muted)' }}>Refund Amount:</span>
                  <strong style={{ fontSize: '14px', color: 'var(--text-main)' }}>
                    ₹{Number(selectedReturnDetails.return_amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#b91c1c' }}>
                  <span style={{ fontSize: '12.5px' }}>Incentive Reversal:</span>
                  <strong style={{ fontSize: '14px' }}>
                    -₹{Number(selectedReturnDetails.reversed_incentive || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </strong>
                </div>
              </div>

              {/* Reason & Remarks */}
              <div style={{ border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', padding: '12px 14px' }}>
                <div style={{ fontSize: '11.5px', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 700, marginBottom: '6px' }}>
                  Return Notes
                </div>
                <div style={{ fontSize: '12.5px', marginBottom: '4px' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Reason: </span>
                  <strong>{selectedReturnDetails.return_reason || 'Product Return'}</strong>
                </div>
                {selectedReturnDetails.remarks && (
                  <div style={{ fontSize: '12.5px', marginTop: '4px', color: 'var(--text-secondary)' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Remarks: </span>
                    {selectedReturnDetails.remarks}
                  </div>
                )}
              </div>
            </div>

            <div className="modal-footer" style={{ borderTop: '1px solid var(--border-subtle)', padding: '14px 20px', display: 'flex', justifyContent: 'space-between' }}>
              {(isManager || selectedReturnDetails.staff_id === user?.id || selectedReturnDetails.returned_by_staff_id === user?.id) ? (
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => openEditReturnModal(selectedReturnDetails)}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                >
                  <Edit2 size={14} /> Edit Return
                </button>
              ) : <div />}
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => setSelectedReturnDetails(null)}
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
