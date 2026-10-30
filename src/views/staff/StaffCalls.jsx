// src/views/staff/StaffCalls.jsx
import React, { useState, useEffect } from 'react';
import { api } from '../../api';
import {
  PhoneCall,
  Plus,
  Search,
  CheckCircle,
  AlertCircle,
  Clock,
  Lock,
  Edit2,
  PhoneForwarded,
  PhoneOff,
  PhoneMissed
} from 'lucide-react';

export default function StaffCalls() {
  const [calls, setCalls] = useState([]);
  const [enquiries, setEnquiries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [outcomeFilter, setOutcomeFilter] = useState('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingCall, setEditingCall] = useState(null);

  // Form fields
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [enquiryId, setEnquiryId] = useState('');
  const [callDate, setCallDate] = useState(new Date().toISOString().split('T')[0]);
  const [callTime, setCallTime] = useState(new Date().toTimeString().split(' ')[0]);
  const [outcome, setOutcome] = useState('Connected');
  const [remarks, setRemarks] = useState('');

  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [notification, setNotification] = useState('');

  useEffect(() => {
    fetchCalls();
    fetchEnquiries();
  }, [outcomeFilter]);

  async function fetchCalls() {
    setLoading(true);
    try {
      let queryStr = `?outcome=${outcomeFilter}`;
      if (search) queryStr += `&search=${encodeURIComponent(search)}`;
      const res = await api.get(`/calls${queryStr}`);
      setCalls(res.calls || []);
    } catch (err) {
      console.error('Failed to load calls:', err);
    } finally {
      setLoading(false);
    }
  }

  async function fetchEnquiries() {
    try {
      const res = await api.get('/enquiries');
      setEnquiries(res.enquiries || []);
    } catch (err) {
      console.error('Failed to load enquiries:', err);
    }
  }

  function openCreateModal() {
    setEditingCall(null);
    setCustomerName('');
    setCustomerPhone('');
    setEnquiryId('');
    setCallDate(new Date().toISOString().split('T')[0]);
    setCallTime(new Date().toTimeString().split(' ')[0]);
    setOutcome('Connected');
    setRemarks('');
    setFormError('');
    setShowAddModal(true);
  }

  function openEditModal(item) {
    if (item.is_locked) {
      alert(`This call record is locked because the 09:30 AM deadline for ${item.call_date} has passed.`);
      return;
    }
    setEditingCall(item);
    setCustomerName(item.customer_name);
    setCustomerPhone(item.customer_phone);
    setEnquiryId(item.enquiry_id ? String(item.enquiry_id) : '');
    setCallDate(item.call_date);
    setCallTime(item.call_time);
    setOutcome(item.outcome);
    setRemarks(item.remarks || '');
    setFormError('');
    setShowAddModal(true);
  }

  async function handleSaveCall(e) {
    e.preventDefault();
    setFormError('');
    setSubmitting(true);

    try {
      if (editingCall) {
        await api.put(`/calls/${editingCall.id}`, {
          customer_name: customerName,
          customer_phone: customerPhone,
          outcome,
          remarks
        });
        setNotification('Call log updated successfully!');
      } else {
        await api.post('/calls', {
          customer_name: customerName,
          customer_phone: customerPhone,
          enquiry_id: enquiryId ? parseInt(enquiryId, 10) : null,
          call_date: callDate,
          call_time: callTime,
          outcome,
          remarks
        });
        setNotification('Call log saved successfully!');
      }

      setTimeout(() => setNotification(''), 5000);
      setShowAddModal(false);
      fetchCalls();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  // Pre-fill customer info if an enquiry is selected in modal
  function handleEnquirySelect(id) {
    setEnquiryId(id);
    if (id) {
      const enq = enquiries.find(e => e.id === parseInt(id, 10));
      if (enq) {
        setCustomerName(enq.customer_name);
        setCustomerPhone(enq.customer_phone);
      }
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
          <h2 className="page-title">Call Logs</h2>
        </div>

        <button className="btn btn-primary" onClick={openCreateModal}>
          <Plus size={16} />
          <span>Log Call</span>
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
              placeholder="Search by customer name or phone..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && fetchCalls()}
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)' }}>Outcome:</span>
            <select
              className="form-control"
              style={{ width: 'auto', padding: '6px 12px', fontSize: '13px' }}
              value={outcomeFilter}
              onChange={e => setOutcomeFilter(e.target.value)}
            >
              <option value="all">All Outcomes</option>
              <option value="Connected">Connected</option>
              <option value="Follow-up Required">Follow-up Required</option>
              <option value="Busy">Busy</option>
              <option value="Not Answered">Not Answered</option>
            </select>
          </div>
        </div>

        {/* Calls Table */}
        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th>Date & Time</th>
                <th>Customer</th>
                <th>Outcome</th>
                <th>Remarks</th>
                <th>Deadline Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="6" style={{ textAlign: 'center', padding: '32px' }}>Loading call logs...</td>
                </tr>
              ) : calls.length === 0 ? (
                <tr>
                  <td colSpan="6">
                    <div className="empty-state">
                      <div className="empty-state-icon"><PhoneCall size={24} /></div>
                      <div className="empty-state-title">No call records found</div>
                      <div className="empty-state-desc">You have not logged any calls under this filter.</div>
                      <button className="btn btn-primary btn-sm" onClick={openCreateModal}>
                        <Plus size={14} /> Log Your First Call
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                calls.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <div><strong>{c.call_date}</strong></div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{c.call_time}</div>
                    </td>
                    <td>
                      <div><strong>{c.customer_name}</strong></div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{c.customer_phone}</div>
                    </td>
                    <td>
                      <span className={`badge ${
                        c.outcome === 'Connected' ? 'badge-success' :
                        c.outcome === 'Follow-up Required' ? 'badge-info' :
                        c.outcome === 'Busy' ? 'badge-warning' : 'badge-danger'
                      }`}>
                        {c.outcome}
                      </span>
                    </td>
                    <td style={{ fontSize: '12px', color: 'var(--text-muted)', maxWidth: '280px' }}>
                      {c.remarks || '—'}
                    </td>
                    <td>
                      {c.is_locked ? (
                        <span className="badge badge-danger" title={c.deadline_message}>
                          <Lock size={11} /> Locked (Passed 9:30 AM)
                        </span>
                      ) : (
                        <span className="badge badge-success" title={c.deadline_message}>
                          Editable
                        </span>
                      )}
                    </td>
                    <td>
                      {!c.is_locked ? (
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => openEditModal(c)}
                          title="Edit Call Log"
                        >
                          <Edit2 size={13} />
                        </button>
                      ) : (
                        <span style={{ fontSize: '11.5px', color: 'var(--text-subtle)' }}>Locked</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Log Call Modal */}
      {showAddModal && (
        <div className="modal-overlay">
          <div className="modal-dialog">
            <div className="modal-header">
              <h3 className="modal-title">{editingCall ? 'Edit Call Log' : 'Log Customer Call'}</h3>
              <button className="modal-close" onClick={() => setShowAddModal(false)}>✕</button>
            </div>

            <form onSubmit={handleSaveCall}>
              <div className="modal-body">
                {formError && (
                  <div style={{ padding: '10px 14px', background: 'var(--danger-bg)', border: '1px solid var(--danger-border)', color: 'var(--danger-text)', borderRadius: 'var(--radius-md)', marginBottom: '16px', fontSize: '13px' }}>
                    {formError}
                  </div>
                )}

                {/* Optional Enquiry Auto-Fill */}
                {!editingCall && enquiries.length > 0 && (
                  <div className="form-group">
                    <label className="form-label">Link to Customer Enquiry (Optional)</label>
                    <select
                      className="form-control"
                      value={enquiryId}
                      onChange={e => handleEnquirySelect(e.target.value)}
                    >
                      <option value="">-- Manual entry / New Customer --</option>
                      {enquiries.map(enq => (
                        <option key={enq.id} value={enq.id}>
                          {enq.customer_name} ({enq.customer_phone}) — {enq.product_name || 'General'}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Customer Name or Reference <span className="required">*</span></label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="e.g. Amit Kumar"
                      value={customerName}
                      onChange={e => setCustomerName(e.target.value)}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Phone Number <span className="required">*</span></label>
                    <input
                      type="tel"
                      className="form-control"
                      placeholder="e.g. 9876543210"
                      value={customerPhone}
                      onChange={e => setCustomerPhone(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">
                      Call Date <span className="required">*</span>
                      <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 500, marginLeft: '4px' }}>
                        (9:30 AM cutoff rule applies)
                      </span>
                    </label>
                    <input
                      type="date"
                      className="form-control"
                      value={callDate}
                      onChange={e => setCallDate(e.target.value)}
                      disabled={!!editingCall}
                      required
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">Call Time <span className="required">*</span></label>
                    <input
                      type="time"
                      step="1"
                      className="form-control"
                      value={callTime}
                      onChange={e => setCallTime(e.target.value)}
                      disabled={!!editingCall}
                      required
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Call Outcome <span className="required">*</span></label>
                  <select
                    className="form-control"
                    value={outcome}
                    onChange={e => setOutcome(e.target.value)}
                    required
                  >
                    <option value="Connected">Connected (Spoke to decision maker)</option>
                    <option value="Follow-up Required">Follow-up Required (Callback scheduled)</option>
                    <option value="Busy">Busy (Asked to call back later)</option>
                    <option value="Not Answered">Not Answered (Ringing / Switched off)</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Call Remarks</label>
                  <textarea
                    className="form-control"
                    rows="3"
                    placeholder="Key discussion points, customer objections, next agreed action..."
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
                  {submitting ? 'Saving...' : editingCall ? 'Update Call Log' : 'Save Call Record'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
