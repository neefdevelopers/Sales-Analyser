// src/views/staff/StaffEnquiries.jsx
import React, { useState, useEffect } from 'react';
import { api } from '../../api';
import {
  HelpCircle,
  Plus,
  Search,
  CheckCircle,
  AlertCircle,
  Clock,
  Lock,
  ArrowUpRight,
  Edit2,
  Calendar
} from 'lucide-react';

export default function StaffEnquiries({ onNavigateToOrder }) {
  const [enquiries, setEnquiries] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingEnquiry, setEditingEnquiry] = useState(null);

  // Form fields
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [productId, setProductId] = useState('');
  const [enquiryDate, setEnquiryDate] = useState(new Date().toISOString().split('T')[0]);
  const [status, setStatus] = useState('New');
  const [followUpDate, setFollowUpDate] = useState('');
  const [remarks, setRemarks] = useState('');

  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [notification, setNotification] = useState('');

  useEffect(() => {
    fetchEnquiries();
    fetchProducts();
  }, [statusFilter]);

  async function fetchEnquiries() {
    setLoading(true);
    try {
      let queryStr = `?status=${statusFilter}`;
      if (search) queryStr += `&search=${encodeURIComponent(search)}`;
      const res = await api.get(`/enquiries${queryStr}`);
      setEnquiries(res.enquiries || []);
    } catch (err) {
      console.error('Failed to load enquiries:', err);
    } finally {
      setLoading(false);
    }
  }

  async function fetchProducts() {
    try {
      const res = await api.get('/products');
      setProducts(res.products || []);
    } catch (err) {
      console.error('Failed to load products:', err);
    }
  }

  function openCreateModal() {
    setEditingEnquiry(null);
    setCustomerName('');
    setCustomerPhone('');
    setProductId('');
    setEnquiryDate(new Date().toISOString().split('T')[0]);
    setStatus('New');
    setFollowUpDate('');
    setRemarks('');
    setFormError('');
    setShowAddModal(true);
  }

  function openEditModal(item) {
    if (item.is_locked) {
      alert(`This enquiry is locked because the 09:30 AM deadline for ${item.enquiry_date} has passed.`);
      return;
    }
    setEditingEnquiry(item);
    setCustomerName(item.customer_name);
    setCustomerPhone(item.customer_phone);
    setProductId(item.product_id ? String(item.product_id) : '');
    setEnquiryDate(item.enquiry_date);
    setStatus(item.status);
    setFollowUpDate(item.follow_up_date || '');
    setRemarks(item.remarks || '');
    setFormError('');
    setShowAddModal(true);
  }

  async function handleSaveEnquiry(e) {
    e.preventDefault();
    setFormError('');
    setSubmitting(true);

    try {
      if (editingEnquiry) {
        await api.put(`/enquiries/${editingEnquiry.id}`, {
          customer_name: customerName,
          customer_phone: customerPhone,
          product_id: productId ? parseInt(productId, 10) : null,
          status,
          follow_up_date: followUpDate || null,
          remarks
        });
        setNotification('Enquiry updated successfully!');
      } else {
        await api.post('/enquiries', {
          customer_name: customerName,
          customer_phone: customerPhone,
          product_id: productId ? parseInt(productId, 10) : null,
          enquiry_date: enquiryDate,
          status,
          follow_up_date: followUpDate || null,
          remarks
        });
        setNotification('Enquiry recorded successfully!');
      }

      setTimeout(() => setNotification(''), 5000);
      setShowAddModal(false);
      fetchEnquiries();
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
          <h2 className="page-title">Customer Enquiries</h2>
          <p className="page-subtitle">Track customer interest, follow-ups, and convert enquiries directly into orders</p>
        </div>

        <button className="btn btn-primary" onClick={openCreateModal}>
          <Plus size={16} />
          <span>New Enquiry</span>
        </button>
      </div>

      {/* Search and Filter Toolbar */}
      <div className="table-card">
        <div className="table-toolbar">
          <div className="search-input-wrap">
            <Search size={16} />
            <input
              type="text"
              className="search-input"
              placeholder="Search by customer, phone, product..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && fetchEnquiries()}
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
              <option value="all">All Enquiries</option>
              <option value="New">New</option>
              <option value="Follow-up">Follow-up</option>
              <option value="Converted">Converted</option>
              <option value="Lost">Lost</option>
            </select>
          </div>
        </div>

        {/* Enquiries Table */}
        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Customer</th>
                <th>Product of Interest</th>
                <th>Status</th>
                <th>Follow-up Date</th>
                <th>Remarks</th>
                <th>Deadline Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="8" style={{ textAlign: 'center', padding: '32px' }}>Loading enquiries...</td>
                </tr>
              ) : enquiries.length === 0 ? (
                <tr>
                  <td colSpan="8">
                    <div className="empty-state">
                      <div className="empty-state-icon"><HelpCircle size={24} /></div>
                      <div className="empty-state-title">No enquiries recorded</div>
                      <div className="empty-state-desc">You have no enquiries under this filter.</div>
                      <button className="btn btn-primary btn-sm" onClick={openCreateModal}>
                        <Plus size={14} /> Record First Enquiry
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                enquiries.map((e) => (
                  <tr key={e.id}>
                    <td>
                      <div><strong>{e.enquiry_date}</strong></div>
                    </td>
                    <td>
                      <div><strong>{e.customer_name}</strong></div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{e.customer_phone}</div>
                    </td>
                    <td>{e.product_name || <span style={{ color: 'var(--text-subtle)' }}>General / Any</span>}</td>
                    <td>
                      <span className={`badge ${
                        e.status === 'Converted' ? 'badge-success' :
                        e.status === 'Follow-up' ? 'badge-info' :
                        e.status === 'New' ? 'badge-warning' : 'badge-danger'
                      }`}>
                        {e.status}
                      </span>
                    </td>
                    <td>{e.follow_up_date || '—'}</td>
                    <td style={{ fontSize: '12px', color: 'var(--text-muted)', maxWidth: '240px' }}>
                      {e.remarks || '—'}
                    </td>
                    <td>
                      {e.is_locked ? (
                        <span className="badge badge-danger" title={e.deadline_message}>
                          <Lock size={11} /> Locked (Passed 9:30 AM)
                        </span>
                      ) : (
                        <span className="badge badge-success" title={e.deadline_message}>
                          Editable
                        </span>
                      )}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        {!e.is_locked && (
                          <button
                            className="btn btn-secondary btn-sm"
                            onClick={() => openEditModal(e)}
                            title="Edit Enquiry"
                          >
                            <Edit2 size={13} />
                          </button>
                        )}

                        {e.status !== 'Converted' && onNavigateToOrder && (
                          <button
                            className="btn btn-primary btn-sm"
                            onClick={() => onNavigateToOrder(e)}
                            title="Convert to Order"
                          >
                            <ArrowUpRight size={13} /> Convert
                          </button>
                        )}

                        {e.converted_order_number && (
                          <span className="badge badge-success" style={{ fontSize: '10.5px' }}>
                            Order: {e.converted_order_number}
                          </span>
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

      {/* Add / Edit Enquiry Modal */}
      {showAddModal && (
        <div className="modal-overlay">
          <div className="modal-dialog">
            <div className="modal-header">
              <h3 className="modal-title">{editingEnquiry ? 'Edit Enquiry' : 'Record New Enquiry'}</h3>
              <button className="modal-close" onClick={() => setShowAddModal(false)}>✕</button>
            </div>

            <form onSubmit={handleSaveEnquiry}>
              <div className="modal-body">
                {formError && (
                  <div style={{ padding: '10px 14px', background: 'var(--danger-bg)', border: '1px solid var(--danger-border)', color: 'var(--danger-text)', borderRadius: 'var(--radius-md)', marginBottom: '16px', fontSize: '13px' }}>
                    {formError}
                  </div>
                )}

                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Customer Name <span className="required">*</span></label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="e.g. Anand Menon"
                      value={customerName}
                      onChange={e => setCustomerName(e.target.value)}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Customer Phone <span className="required">*</span></label>
                    <input
                      type="tel"
                      className="form-control"
                      placeholder="e.g. 9845112233"
                      value={customerPhone}
                      onChange={e => setCustomerPhone(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Product of Interest (Optional)</label>
                    <select
                      className="form-control"
                      value={productId}
                      onChange={e => setProductId(e.target.value)}
                    >
                      <option value="">-- General Enquiry (No specific product) --</option>
                      {products.map(p => (
                        <option key={p.id} value={p.id}>
                          {p.name} (₹{p.price})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label">
                      Activity Date <span className="required">*</span>
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 500, marginLeft: '4px' }}>
                        (9:30 AM cutoff rule applies)
                      </span>
                    </label>
                    <input
                      type="date"
                      className="form-control"
                      value={enquiryDate}
                      onChange={e => setEnquiryDate(e.target.value)}
                      disabled={!!editingEnquiry}
                      required
                    />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Status <span className="required">*</span></label>
                    <select
                      className="form-control"
                      value={status}
                      onChange={e => setStatus(e.target.value)}
                    >
                      <option value="New">New</option>
                      <option value="Follow-up">Follow-up</option>
                      <option value="Converted">Converted</option>
                      <option value="Lost">Lost</option>
                    </select>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Follow-up Date (Optional)</label>
                    <input
                      type="date"
                      className="form-control"
                      value={followUpDate}
                      onChange={e => setFollowUpDate(e.target.value)}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Remarks</label>
                  <textarea
                    className="form-control"
                    rows="3"
                    placeholder="Customer requirements, budget considerations, callback timing..."
                    value={remarks}
                    onChange={e => setRemarks(e.target.value)}
                  />
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowAddModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={submitting}>
                  {submitting ? 'Saving...' : editingEnquiry ? 'Update Enquiry' : 'Save Enquiry'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
