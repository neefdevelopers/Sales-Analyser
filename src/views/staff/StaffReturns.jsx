// src/views/staff/StaffReturns.jsx
import React, { useState, useEffect } from 'react';
import { api } from '../../api';
import {
  RotateCcw,
  Plus,
  Search,
  CheckCircle,
  AlertCircle,
  Clock,
  Eye,
  AlertTriangle
} from 'lucide-react';

export default function StaffReturns() {
  const [returns, setReturns] = useState([]);
  const [returnableOrders, setReturnableOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);

  // Form fields
  const [selectedOrderId, setSelectedOrderId] = useState('');
  const [returnQuantity, setReturnQuantity] = useState(1);
  const [returnDate, setReturnDate] = useState(new Date().toISOString().split('T')[0]);
  const [returnReason, setReturnReason] = useState('Defective item');
  const [remarks, setRemarks] = useState('');

  // Preview & feedback
  const [preview, setPreview] = useState(null);
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [notification, setNotification] = useState('');

  useEffect(() => {
    fetchReturns();
    fetchReturnableOrders();
  }, []);

  async function fetchReturns() {
    setLoading(true);
    try {
      let queryStr = '';
      if (search) queryStr += `?search=${encodeURIComponent(search)}`;
      const res = await api.get(`/returns${queryStr}`);
      setReturns(res.returns || []);
    } catch (err) {
      console.error('Failed to load returns:', err);
    } finally {
      setLoading(false);
    }
  }

  async function fetchReturnableOrders() {
    try {
      const res = await api.get('/orders/returnable');
      setReturnableOrders(res.returnableOrders || []);
      if (res.returnableOrders && res.returnableOrders.length > 0 && !selectedOrderId) {
        setSelectedOrderId(res.returnableOrders[0].id);
      }
    } catch (err) {
      console.error('Failed to load returnable orders:', err);
    }
  }

  // Update return preview whenever selected order or return quantity changes
  useEffect(() => {
    if (selectedOrderId && returnQuantity > 0) {
      updateReturnPreview();
    } else {
      setPreview(null);
    }
  }, [selectedOrderId, returnQuantity]);

  async function updateReturnPreview() {
    try {
      const res = await api.post('/returns/preview', {
        order_id: parseInt(selectedOrderId, 10),
        return_quantity: parseInt(returnQuantity, 10)
      });
      setPreview(res);
      setFormError('');
    } catch (err) {
      setFormError(err.message);
      setPreview(null);
    }
  }

  async function handleCreateReturn(e) {
    e.preventDefault();
    setFormError('');
    setSubmitting(true);

    try {
      const res = await api.post('/returns', {
        order_id: parseInt(selectedOrderId, 10),
        return_quantity: parseInt(returnQuantity, 10),
        return_date: returnDate,
        return_reason: returnReason,
        remarks
      });

      setNotification(`Return ${res.returnItem.return_number} processed! Refund: ₹${res.returnItem.return_amount}, Reversed Incentive: ₹${res.returnItem.reversed_incentive}`);
      setTimeout(() => setNotification(''), 6000);

      setShowAddModal(false);
      setReturnQuantity(1);
      setRemarks('');
      fetchReturns();
      fetchReturnableOrders();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  const selectedOrderObj = returnableOrders.find(o => o.id === parseInt(selectedOrderId, 10));

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
          <h2 className="page-title">Order Returns</h2>
          <p className="page-subtitle">Process partial and full product returns with automatic incentive adjustment</p>
        </div>

        <button
          className="btn btn-primary"
          onClick={() => {
            setShowAddModal(true);
            setFormError('');
            fetchReturnableOrders();
          }}
        >
          <Plus size={16} />
          <span>Record Return</span>
        </button>
      </div>

      {/* Search Toolbar */}
      <div className="table-card">
        <div className="table-toolbar">
          <div className="search-input-wrap">
            <Search size={16} />
            <input
              type="text"
              className="search-input"
              placeholder="Search by Return #, Order #, Customer, Product..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && fetchReturns()}
            />
          </div>
        </div>

        {/* Returns Table */}
        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th>Return #</th>
                <th>Return Date</th>
                <th>Original Order</th>
                <th>Customer</th>
                <th>Product</th>
                <th>Returned Qty</th>
                <th>Refund Amount</th>
                <th>Incentive Reversed</th>
                <th>Reason</th>
                <th>Return Remarks</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="10" style={{ textAlign: 'center', padding: '32px' }}>Loading returns...</td>
                </tr>
              ) : returns.length === 0 ? (
                <tr>
                  <td colSpan="10">
                    <div className="empty-state">
                      <div className="empty-state-icon"><RotateCcw size={24} /></div>
                      <div className="empty-state-title">No returns recorded</div>
                      <div className="empty-state-desc">You have not recorded any product returns yet.</div>
                      {returnableOrders.length > 0 && (
                        <button className="btn btn-primary btn-sm" onClick={() => setShowAddModal(true)}>
                          <Plus size={14} /> Record Return
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                returns.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <strong style={{ color: 'var(--danger-text)' }}>{r.return_number}</strong>
                    </td>
                    <td>{r.return_date}</td>
                    <td>
                      <div><strong>{r.order_number}</strong></div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                        Orig Qty: {r.original_order_quantity} ({r.payment_method})
                      </div>
                    </td>
                    <td>
                      <div><strong>{r.customer_name}</strong></div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{r.customer_phone}</div>
                    </td>
                    <td>{r.product_name}</td>
                    <td>
                      <span className="badge badge-danger">
                        {r.return_quantity} unit{r.return_quantity > 1 ? 's' : ''}
                      </span>
                    </td>
                    <td><strong>₹{r.return_amount.toLocaleString()}</strong></td>
                    <td>
                      <span style={{ color: 'var(--danger-solid)', fontWeight: 700 }}>
                        -₹{r.reversed_incentive}
                      </span>
                    </td>
                    <td>
                      <span className="badge badge-warning">{r.return_reason}</span>
                    </td>
                    <td style={{ fontSize: '12px', color: 'var(--text-muted)', maxWidth: '200px' }}>
                      {r.return_remarks || '—'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Return Modal */}
      {showAddModal && (
        <div className="modal-overlay">
          <div className="modal-dialog">
            <div className="modal-header">
              <h3 className="modal-title">Record Order Return</h3>
              <button className="modal-close" onClick={() => setShowAddModal(false)}>✕</button>
            </div>

            <form onSubmit={handleCreateReturn}>
              <div className="modal-body">
                {formError && (
                  <div style={{ padding: '10px 14px', background: 'var(--danger-bg)', border: '1px solid var(--danger-border)', color: 'var(--danger-text)', borderRadius: 'var(--radius-md)', marginBottom: '16px', fontSize: '13px' }}>
                    {formError}
                  </div>
                )}

                {returnableOrders.length === 0 ? (
                  <div className="empty-state" style={{ padding: '24px' }}>
                    <AlertTriangle size={32} color="var(--warning-solid)" />
                    <div className="empty-state-title" style={{ marginTop: '8px' }}>No Returnable Orders</div>
                    <div className="empty-state-desc">All eligible orders have already been completely returned or no orders exist.</div>
                  </div>
                ) : (
                  <>
                    <div className="form-group">
                      <label className="form-label">Select Original Order <span className="required">*</span></label>
                      <select
                        className="form-control"
                        value={selectedOrderId}
                        onChange={e => setSelectedOrderId(e.target.value)}
                        required
                      >
                        {returnableOrders.map(o => (
                          <option key={o.id} value={o.id}>
                            {o.order_number} — {o.customer_name} ({o.product_name}, {o.returnable_quantity} returnable)
                          </option>
                        ))}
                      </select>
                    </div>

                    {selectedOrderObj && (
                      <div style={{ background: '#f8fafc', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', padding: '12px 16px', marginBottom: '16px', fontSize: '12.5px' }}>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                          <div>Customer: <strong>{selectedOrderObj.customer_name}</strong> ({selectedOrderObj.customer_phone})</div>
                          <div>Product: <strong>{selectedOrderObj.product_name}</strong></div>
                          <div>Original Quantity: <strong>{selectedOrderObj.quantity} units</strong></div>
                          <div>Max Returnable: <strong style={{ color: 'var(--primary-600)' }}>{selectedOrderObj.returnable_quantity} units</strong></div>
                        </div>
                      </div>
                    )}

                    <div className="form-row">
                      <div className="form-group">
                        <label className="form-label">
                          Return Quantity <span className="required">*</span>
                          {selectedOrderObj && (
                            <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 500, marginLeft: '4px' }}>
                              (Max: {selectedOrderObj.returnable_quantity})
                            </span>
                          )}
                        </label>
                        <input
                          type="number"
                          min="1"
                          max={selectedOrderObj ? selectedOrderObj.returnable_quantity : 99}
                          className="form-control"
                          value={returnQuantity}
                          onChange={e => setReturnQuantity(parseInt(e.target.value, 10) || 1)}
                          required
                        />
                      </div>

                      <div className="form-group">
                        <label className="form-label">Return Date <span className="required">*</span></label>
                        <input
                          type="date"
                          className="form-control"
                          value={returnDate}
                          onChange={e => setReturnDate(e.target.value)}
                          required
                        />
                      </div>
                    </div>

                    <div className="form-group">
                      <label className="form-label">Return Reason <span className="required">*</span></label>
                      <select
                        className="form-control"
                        value={returnReason}
                        onChange={e => setReturnReason(e.target.value)}
                        required
                      >
                        <option value="Defective item">Defective item</option>
                        <option value="Wrong item delivered">Wrong item delivered</option>
                        <option value="Customer cancelled/rejected">Customer cancelled/rejected</option>
                        <option value="Size or fit issue">Size or fit issue</option>
                        <option value="Transit damage">Transit damage</option>
                        <option value="Other">Other</option>
                      </select>
                    </div>

                    {/* Return Preview & Incentive Reversal Box */}
                    {preview && (
                      <div className="preview-box">
                        <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <CheckCircle size={14} color="var(--primary-600)" />
                          <span>RETURN ADJUSTMENT PREVIEW</span>
                        </div>
                        <div className="preview-grid">
                          <div>
                            <div className="preview-item-label">Refund Value</div>
                            <div className="preview-item-val" style={{ color: 'var(--danger-text)' }}>
                              ₹{preview.return_amount.toLocaleString()}
                            </div>
                          </div>
                          <div>
                            <div className="preview-item-label">Reversed Incentive</div>
                            <div className="preview-item-val" style={{ color: 'var(--danger-solid)' }}>
                              -₹{preview.reversed_incentive}
                            </div>
                          </div>
                          <div>
                            <div className="preview-item-label">Remaining in Order</div>
                            <div className="preview-item-val" style={{ color: 'var(--text-main)', fontSize: '15px' }}>
                              {preview.remaining_returnable_quantity - preview.return_quantity} units
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="form-group">
                      <label className="form-label">Remarks (Optional)</label>
                      <textarea
                        className="form-control"
                        rows="2"
                        placeholder="Detailed QA notes or inspection observations"
                        value={remarks}
                        onChange={e => setRemarks(e.target.value)}
                      />
                    </div>
                  </>
                )}
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowAddModal(false)}>
                  Cancel
                </button>
                {returnableOrders.length > 0 && (
                  <button type="submit" className="btn btn-primary" disabled={submitting}>
                    {submitting ? 'Processing...' : 'Confirm Return'}
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
