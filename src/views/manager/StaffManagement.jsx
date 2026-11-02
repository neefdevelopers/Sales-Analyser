// src/views/manager/StaffManagement.jsx
import React, { useState, useEffect } from 'react';
import { api } from '../../api';
import { useSessionState } from '../../hooks/useSessionState';
import {
  Users,
  Plus,
  Search,
  CheckCircle,
  AlertCircle,
  Edit2,
  KeyRound,
  Shield,
  UserCheck,
  UserX,
  Filter,
  X,
  ChevronDown
} from 'lucide-react';

export default function StaffManagement() {
  const [staffList, setStaffList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useSessionState('filter_staff_search', '');
  const [statusFilter, setStatusFilter] = useSessionState('filter_staff_status', 'all');
  const [showFilters, setShowFilters] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingStaff, setEditingStaff] = useState(null);
  const [resettingStaff, setResettingStaff] = useState(null);

  // Add/Edit Form fields
  const [staffId, setStaffId] = useState('');
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [status, setStatus] = useState('active');

  // Reset Password fields
  const [newPassword, setNewPassword] = useState('');

  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [notification, setNotification] = useState('');

  useEffect(() => {
    fetchStaff();
  }, []);

  async function fetchStaff() {
    setLoading(true);
    try {
      const res = await api.get('/staff');
      setStaffList(res.staff || []);
    } catch (err) {
      console.error('Failed to load staff list:', err);
    } finally {
      setLoading(false);
    }
  }

  function openCreateModal() {
    setEditingStaff(null);
    setStaffId('');
    setName('');
    setUsername('');
    setPassword('');
    setStatus('active');
    setFormError('');
    setShowAddModal(true);
  }

  function openEditModal(staff) {
    setEditingStaff(staff);
    setStaffId(staff.staff_id);
    setName(staff.name);
    setUsername(staff.username);
    setStatus(staff.status);
    setFormError('');
    setShowAddModal(true);
  }

  function openResetPasswordModal(staff) {
    setResettingStaff(staff);
    setNewPassword('');
    setFormError('');
  }

  async function handleToggleStatus(staff) {
    const newStatus = staff.status === 'active' ? 'inactive' : 'active';
    try {
      await api.put(`/staff/${staff.id}`, { status: newStatus });
      setNotification(`Staff account "${staff.name}" marked as ${newStatus}.`);
      setTimeout(() => setNotification(''), 4000);
      fetchStaff();
    } catch (err) {
      alert('Failed to update staff status: ' + err.message);
    }
  }

  async function handleSaveStaff(e) {
    e.preventDefault();
    setFormError('');
    setSubmitting(true);

    try {
      if (editingStaff) {
        await api.put(`/staff/${editingStaff.id}`, {
          staff_id: staffId,
          name,
          username,
          status
        });
        setNotification(`Staff details for "${name}" updated.`);
      } else {
        await api.post('/staff', {
          staff_id: staffId,
          name,
          username,
          password,
          status
        });
        setNotification(`Staff account for "${name}" created.`);
      }

      setTimeout(() => setNotification(''), 4000);
      setShowAddModal(false);
      fetchStaff();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleResetPassword(e) {
    e.preventDefault();
    setFormError('');
    setSubmitting(true);

    try {
      await api.post(`/staff/${resettingStaff.id}/reset-password`, {
        newPassword
      });
      setNotification(`Password reset successfully for ${resettingStaff.name}.`);
      setTimeout(() => setNotification(''), 4000);
      setResettingStaff(null);
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  const filteredStaff = staffList.filter(s => {
    if (statusFilter !== 'all' && s.status !== statusFilter) return false;
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return s.name.toLowerCase().includes(q) || s.staff_id.toLowerCase().includes(q) || s.username.toLowerCase().includes(q);
  });

  const hasActiveFilters = Boolean(search.trim() || statusFilter !== 'all');
  const activeFilterCount = (search.trim() ? 1 : 0) + (statusFilter !== 'all' ? 1 : 0);

  function handleResetFilters() {
    setSearch('');
    setStatusFilter('all');
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
          <h2 className="page-title">Staff Management</h2>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <button
            type="button"
            className={`btn ${showFilters ? 'btn-primary' : 'btn-secondary'} btn-sm`}
            onClick={() => setShowFilters(!showFilters)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '7px',
              padding: '8px 14px',
              fontWeight: 600,
              fontSize: '12.5px'
            }}
          >
            <Filter size={14} />
            <span>Filtration</span>
            {hasActiveFilters && (
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

          <button className="btn btn-primary" onClick={openCreateModal}>
            <Plus size={16} />
            <span>Add Staff Member</span>
          </button>
        </div>
      </div>

      {/* Compact Applied Filtration Pill Bar (when collapsed) */}
      {!showFilters && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '10px',
            background: '#f8fafc',
            border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-md)',
            padding: '8px 14px',
            marginBottom: '18px',
            fontSize: '12.5px'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', fontWeight: 600, color: 'var(--text-secondary)' }}>
              <Filter size={13} color="var(--primary-600)" /> Active Filters:
            </span>
            {statusFilter !== 'all' && (
              <span className="badge badge-info" style={{ fontSize: '11.5px' }}>
                Status: {statusFilter === 'active' ? 'Active Only' : 'Inactive Only'}
              </span>
            )}
            {search.trim() && (
              <span className="badge badge-neutral" style={{ fontSize: '11.5px' }}>
                Search: "{search.trim()}"
              </span>
            )}
            {!hasActiveFilters && (
              <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>
                Showing all staff members
              </span>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              type="button"
              className="btn btn-sm btn-outline"
              onClick={() => setShowFilters(true)}
              style={{ fontSize: '11.5px', padding: '3px 10px', height: 'auto' }}
            >
              Change Filters ▾
            </button>
            {hasActiveFilters && (
              <button
                type="button"
                className="btn btn-sm btn-ghost"
                onClick={handleResetFilters}
                style={{ fontSize: '11.5px', padding: '3px 8px', color: '#dc2626', height: 'auto' }}
                title="Reset filters"
              >
                <X size={12} style={{ marginRight: '4px' }} /> Reset
              </button>
            )}
          </div>
        </div>
      )}

      {/* Dedicated Filtration Section Card (when expanded) */}
      {showFilters && (
        <div className="table-card" style={{ marginBottom: '18px', padding: '16px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '10px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ width: '26px', height: '26px', borderRadius: '6px', background: 'var(--primary-50)', color: 'var(--primary-600)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Filter size={15} />
              </div>
              <strong style={{ fontSize: '13.5px', color: 'var(--text-main)', letterSpacing: '0.2px' }}>Filtration</strong>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                (Filter staff accounts by keyword and account status)
              </span>
            </div>
            <button
              type="button"
              className="btn btn-sm btn-ghost"
              onClick={() => setShowFilters(false)}
              style={{ fontSize: '12px', display: 'inline-flex', alignItems: 'center', gap: '4px', color: 'var(--text-muted)' }}
            >
              <X size={14} /> Hide
            </button>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
            <div className="search-input-wrap" style={{ flex: '1 1 260px', maxWidth: '380px' }}>
              <Search size={16} />
              <input
                type="text"
                className="search-input"
                placeholder="Search staff by name, ID or username..."
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)' }}>Status:</span>
                <select
                  className="form-control"
                  style={{ width: 'auto', padding: '5px 10px', fontSize: '12.5px' }}
                  value={statusFilter}
                  onChange={e => setStatusFilter(e.target.value)}
                >
                  <option value="all">All Accounts</option>
                  <option value="active">Active Only</option>
                  <option value="inactive">Inactive Only</option>
                </select>
              </div>

              {hasActiveFilters && (
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={handleResetFilters}
                  style={{ padding: '5px 10px', fontSize: '12px' }}
                  title="Reset filters"
                >
                  <X size={13} style={{ marginRight: '4px' }} /> Reset
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Staff Table Card */}
      <div className="table-card">
        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th>Staff ID</th>
                <th>Staff Name</th>
                <th>Login Username</th>
                <th>Account Status</th>
                <th>Member Since</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="6" style={{ textAlign: 'center', padding: '32px' }}>Loading staff accounts...</td>
                </tr>
              ) : filteredStaff.length === 0 ? (
                <tr>
                  <td colSpan="6">
                    <div className="empty-state">
                      <div className="empty-state-icon"><Users size={24} /></div>
                      <div className="empty-state-title">No staff members found</div>
                      <div className="empty-state-desc">Create your sales staff accounts to begin receiving customer orders.</div>
                      <button className="btn btn-primary btn-sm" onClick={openCreateModal}>
                        <Plus size={14} /> Add Staff Member
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                filteredStaff.map((s) => (
                  <tr key={s.id}>
                    <td>
                      <strong style={{ color: 'var(--primary-700)' }}>{s.staff_id}</strong>
                    </td>
                    <td>
                      <strong>{s.name}</strong>
                    </td>
                    <td>
                      <span style={{ color: 'var(--text-muted)' }}>@{s.username}</span>
                    </td>
                    <td>
                      <span className={`badge ${s.status === 'active' ? 'badge-success' : 'badge-neutral'}`}>
                        {s.status}
                      </span>
                    </td>
                    <td style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                      {s.created_at ? s.created_at.split('T')[0] : '—'}
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => openEditModal(s)}
                          title="Edit Staff Details"
                        >
                          <Edit2 size={13} />
                        </button>

                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => openResetPasswordModal(s)}
                          title="Reset Password"
                        >
                          <KeyRound size={13} />
                        </button>

                        <button
                          className={`btn ${s.status === 'active' ? 'btn-danger' : 'btn-secondary'} btn-sm`}
                          onClick={() => handleToggleStatus(s)}
                          title={s.status === 'active' ? 'Deactivate Account' : 'Activate Account'}
                        >
                          {s.status === 'active' ? 'Deactivate' : 'Activate'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit Staff Modal */}
      {showAddModal && (
        <div className="modal-overlay">
          <div className="modal-dialog">
            <div className="modal-header">
              <h3 className="modal-title">{editingStaff ? 'Edit Staff Member' : 'Add New Staff Member'}</h3>
              <button className="modal-close" onClick={() => setShowAddModal(false)}>✕</button>
            </div>

            <form onSubmit={handleSaveStaff}>
              <div className="modal-body">
                {formError && (
                  <div style={{ padding: '10px 14px', background: 'var(--danger-bg)', border: '1px solid var(--danger-border)', color: 'var(--danger-text)', borderRadius: 'var(--radius-md)', marginBottom: '16px', fontSize: '13px' }}>
                    {formError}
                  </div>
                )}

                <div className="form-group">
                  <label className="form-label">Full Name <span className="required">*</span></label>
                  <input
                    type="text"
                    className="form-control"
                    placeholder="e.g. Rahul Sharma"
                    value={name}
                    onChange={e => setName(e.target.value)}
                    required
                    autoFocus
                  />
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Login Username <span className="required">*</span></label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="e.g. rahul"
                      value={username}
                      onChange={e => setUsername(e.target.value)}
                      required
                    />
                  </div>

                  {!editingStaff && (
                    <div className="form-group">
                      <label className="form-label">Initial Password <span className="required">*</span></label>
                      <input
                        type="password"
                        className="form-control"
                        placeholder="At least 6 characters"
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        required
                        minLength={6}
                      />
                    </div>
                  )}
                </div>

                <div className="form-group">
                  <label className="form-label">Account Status</label>
                  <select
                    className="form-control"
                    value={status}
                    onChange={e => setStatus(e.target.value)}
                  >
                    <option value="active">Active (Can log in and record sales)</option>
                    <option value="inactive">Inactive (Access suspended)</option>
                  </select>
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowAddModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={submitting}>
                  {submitting ? 'Saving...' : editingStaff ? 'Save Changes' : 'Create Staff Account'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reset Password Modal */}
      {resettingStaff && (
        <div className="modal-overlay">
          <div className="modal-dialog">
            <div className="modal-header">
              <h3 className="modal-title">Reset Password: {resettingStaff.name}</h3>
              <button className="modal-close" onClick={() => setResettingStaff(null)}>✕</button>
            </div>

            <form onSubmit={handleResetPassword}>
              <div className="modal-body">
                {formError && (
                  <div style={{ padding: '10px 14px', background: 'var(--danger-bg)', border: '1px solid var(--danger-border)', color: 'var(--danger-text)', borderRadius: 'var(--radius-md)', marginBottom: '16px', fontSize: '13px' }}>
                    {formError}
                  </div>
                )}

                <div className="form-group">
                  <label className="form-label">New Password <span className="required">*</span></label>
                  <input
                    type="password"
                    className="form-control"
                    placeholder="Enter new password (min. 6 chars)"
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                    required
                    minLength={6}
                  />
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>
                    Passwords are securely hashed with bcrypt. Passwords will never be stored in plaintext.
                  </div>
                </div>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setResettingStaff(null)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={submitting}>
                  {submitting ? 'Resetting...' : 'Set New Password'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
