// src/views/manager/EmployeeManagement.jsx
import React, { useState, useEffect } from 'react';
import { api } from '../../api';
import {
  Users,
  UserCheck,
  UserX,
  Plus,
  Search,
  Edit2,
  KeyRound,
  Trash2,
  FileSpreadsheet,
  AlertCircle,
  CheckCircle2,
  X,
  Shield,
  RefreshCw,
  ExternalLink,
  Sparkles,
  UploadCloud,
  ArrowRight,
  Eye,
  ChevronRight
} from 'lucide-react';

export default function EmployeeManagement({ navParams, onNavigate }) {
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notification, setNotification] = useState('');

  // Pending unregistered employees detected from Excel upload
  const [pendingSuggestions, setPendingSuggestions] = useState([]);
  const [batchRegistering, setBatchRegistering] = useState(false);

  // Filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  // Modals state
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState(null);
  const [resettingEmployee, setResettingEmployee] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [selectedEmployee, setSelectedEmployee] = useState(null);

  // Form fields
  const [formStaffId, setFormStaffId] = useState('');
  const [formName, setFormName] = useState('');
  const [formUsername, setFormUsername] = useState('');
  const [formPassword, setFormPassword] = useState('');
  const [formStatus, setFormStatus] = useState('active');
  const [newPassword, setNewPassword] = useState('');

  const [modalSubmitting, setModalSubmitting] = useState(false);
  const [modalError, setModalError] = useState('');

  useEffect(() => {
    loadEmployees();
    const stored = loadPendingSuggestions();
    if (navParams?.prefillEmployee) {
      handlePrefillFromExcel(navParams.prefillEmployee);
    } else if (navParams?.autoOpenAdd) {
      const candidate = (stored && stored.length > 0) ? stored[0] : null;
      handleOpenCreate(candidate);
    }
  }, [navParams]);

  function loadPendingSuggestions() {
    try {
      const stored = sessionStorage.getItem('pending_excel_employees');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          setPendingSuggestions(parsed);
          return parsed;
        }
      }
    } catch (e) {
      // Ignore
    }
    return [];
  }

  async function loadEmployees() {
    setLoading(true);
    setError('');
    try {
      const res = await api.get('/manager/employees');
      const loadedEmps = res.employees || [];
      setEmployees(loadedEmps);

      // Re-filter pending suggestions against currently loaded employees
      const stored = sessionStorage.getItem('pending_excel_employees');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          const remaining = parsed.filter(p =>
            !loadedEmps.some(e => e.staff_id.toUpperCase() === (p.employeeId || '').toUpperCase())
          );
          setPendingSuggestions(remaining);
          if (remaining.length === 0) {
            sessionStorage.removeItem('pending_excel_employees');
          } else {
            sessionStorage.setItem('pending_excel_employees', JSON.stringify(remaining));
          }
        }
      }
    } catch (err) {
      console.error('Failed to load employees:', err);
      setError(err.message || 'Failed to fetch employees list.');
    } finally {
      setLoading(false);
    }
  }

  function showToast(msg, duration = 4000) {
    setNotification(msg);
    setTimeout(() => setNotification(''), duration);
  }

  // Pre-fill creation modal with suggested employee details from Excel
  function handlePrefillFromExcel(item) {
    if (!item) return;
    setEditingEmployee(null);
    const cleanId = (item.employeeId || '').trim().toUpperCase();
    const cleanName = (item.detectedName || item.name || cleanId).trim();
    const cleanUsername = cleanName.toLowerCase().replace(/[^a-z0-9]/g, '') || cleanId.toLowerCase();

    setFormStaffId(cleanId);
    setFormName(cleanName);
    setFormUsername(cleanUsername);
    setFormPassword('sales123');
    setFormStatus('active');
    setModalError('');
    setShowAddModal(true);
  }

  // Batch register all pending suggestions with one click
  async function handleBatchRegisterAll() {
    if (pendingSuggestions.length === 0) return;
    setBatchRegistering(true);
    let successCount = 0;

    for (const item of pendingSuggestions) {
      const cleanId = (item.employeeId || '').trim().toUpperCase();
      const cleanName = (item.detectedName || item.name || cleanId).trim();
      const cleanUsername = cleanName.toLowerCase().replace(/[^a-z0-9]/g, '') || cleanId.toLowerCase();

      try {
        await api.post('/manager/employees', {
          staff_id: cleanId,
          name: cleanName,
          username: cleanUsername,
          password: 'sales123',
          status: 'active'
        });
        successCount++;
      } catch (err) {
        console.warn(`Could not auto-register ${cleanId}:`, err.message);
      }
    }

    setBatchRegistering(false);
    sessionStorage.removeItem('pending_excel_employees');
    setPendingSuggestions([]);
    showToast(`Successfully registered ${successCount} employee(s) from Excel!`);
    await loadEmployees();
  }

  function handleDismissSuggestions() {
    sessionStorage.removeItem('pending_excel_employees');
    setPendingSuggestions([]);
  }

  // Open Create Modal (auto-prefills first suggested non-existing employee if available)
  function handleOpenCreate(candidate = null) {
    setEditingEmployee(null);
    const item = candidate || (pendingSuggestions.length > 0 ? pendingSuggestions[0] : null);
    if (item) {
      const cleanId = (item.employeeId || '').trim().toUpperCase();
      const cleanName = (item.detectedName || item.name || cleanId).trim();
      const cleanUsername = cleanName.toLowerCase().replace(/[^a-z0-9]/g, '') || cleanId.toLowerCase();
      setFormStaffId(cleanId);
      setFormName(cleanName);
      setFormUsername(cleanUsername);
    } else {
      setFormStaffId('');
      setFormName('');
      setFormUsername('');
    }
    setFormPassword('sales123');
    setFormStatus('active');
    setModalError('');
    setShowAddModal(true);
  }

  // Open Edit Modal
  function handleOpenEdit(emp) {
    setEditingEmployee(emp);
    setFormStaffId(emp.staff_id);
    setFormName(emp.name);
    setFormUsername(emp.username);
    setFormStatus(emp.status);
    setModalError('');
    setShowAddModal(true);
  }

  // Open Reset Password Modal
  function handleOpenReset(emp) {
    setResettingEmployee(emp);
    setNewPassword('');
    setModalError('');
  }

  // Save Add/Edit
  async function handleSaveEmployee(e) {
    e.preventDefault();
    setModalError('');
    setModalSubmitting(true);

    try {
      if (editingEmployee) {
        await api.put(`/manager/employees/${editingEmployee.id}`, {
          staff_id: formStaffId,
          name: formName,
          username: formUsername,
          status: formStatus
        });
        showToast(`Employee "${formName}" updated successfully.`);
      } else {
        await api.post('/manager/employees', {
          staff_id: formStaffId,
          name: formName,
          username: formUsername,
          password: formPassword,
          status: formStatus
        });
        showToast(`Employee "${formName}" created successfully.`);

        // Remove from pending suggestions if matched
        const updatedPending = pendingSuggestions.filter(p => (p.employeeId || '').toUpperCase() !== formStaffId.toUpperCase());
        setPendingSuggestions(updatedPending);
        if (updatedPending.length > 0) {
          sessionStorage.setItem('pending_excel_employees', JSON.stringify(updatedPending));
        } else {
          sessionStorage.removeItem('pending_excel_employees');
        }
      }

      setShowAddModal(false);
      await loadEmployees();
    } catch (err) {
      setModalError(err.message || 'Failed to save employee.');
    } finally {
      setModalSubmitting(false);
    }
  }

  // Save current employee and immediately load the next pending suggestion into fields
  async function handleSaveAndNext(e) {
    if (e) e.preventDefault();
    setModalError('');
    setModalSubmitting(true);

    try {
      await api.post('/manager/employees', {
        staff_id: formStaffId,
        name: formName,
        username: formUsername,
        password: formPassword,
        status: formStatus
      });

      showToast(`Employee "${formName}" created!`);

      // Filter out just saved employee
      const remaining = pendingSuggestions.filter(p => (p.employeeId || '').toUpperCase() !== formStaffId.toUpperCase());
      setPendingSuggestions(remaining);

      if (remaining.length > 0) {
        sessionStorage.setItem('pending_excel_employees', JSON.stringify(remaining));
        // Immediately load next suggestion into the fields
        const next = remaining[0];
        const cleanId = (next.employeeId || '').trim().toUpperCase();
        const cleanName = (next.detectedName || next.name || cleanId).trim();
        const cleanUsername = cleanName.toLowerCase().replace(/[^a-z0-9]/g, '') || cleanId.toLowerCase();

        setFormStaffId(cleanId);
        setFormName(cleanName);
        setFormUsername(cleanUsername);
        setFormPassword('sales123');
        setFormStatus('active');
        showToast(`Created! Now auto-filled next: "${cleanName}" (${cleanId})`);
      } else {
        sessionStorage.removeItem('pending_excel_employees');
        setShowAddModal(false);
        showToast(`All sheet suggestions created successfully!`);
      }

      await loadEmployees();
    } catch (err) {
      setModalError(err.message || 'Failed to save employee.');
    } finally {
      setModalSubmitting(false);
    }
  }

  // Toggle Status
  async function handleToggleStatus(emp) {
    const nextStatus = emp.status === 'active' ? 'inactive' : 'active';
    try {
      await api.put(`/manager/employees/${emp.id}`, { status: nextStatus });
      showToast(`Employee "${emp.name}" is now ${nextStatus}.`);
      if (selectedEmployee && selectedEmployee.id === emp.id) {
        setSelectedEmployee(prev => ({ ...prev, status: nextStatus }));
      }
      await loadEmployees();
    } catch (err) {
      alert(err.message || 'Failed to update employee status.');
    }
  }

  // Reset Password Submit
  async function handleResetPasswordSubmit(e) {
    e.preventDefault();
    setModalError('');
    setModalSubmitting(true);

    try {
      await api.post(`/manager/employees/${resettingEmployee.id}/reset-password`, {
        newPassword
      });
      showToast(`Password reset successfully for ${resettingEmployee.name}.`);
      setResettingEmployee(null);
    } catch (err) {
      setModalError(err.message || 'Failed to reset password.');
    } finally {
      setModalSubmitting(false);
    }
  }

  // Confirm Delete Submit
  async function handleConfirmDelete() {
    if (!deleteTarget) return;
    setModalSubmitting(true);
    try {
      await api.delete(`/manager/employees/${deleteTarget.id}`);
      showToast(`Employee account "${deleteTarget.name}" deleted.`);
      setDeleteTarget(null);
      await loadEmployees();
    } catch (err) {
      alert(err.message || 'Failed to delete employee account.');
    } finally {
      setModalSubmitting(false);
    }
  }

  // Filtered list
  const filteredEmployees = employees.filter(emp => {
    if (statusFilter !== 'all' && emp.status !== statusFilter) return false;
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      (emp.name && emp.name.toLowerCase().includes(q)) ||
      (emp.staff_id && emp.staff_id.toLowerCase().includes(q)) ||
      (emp.username && emp.username.toLowerCase().includes(q))
    );
  });

  const totalEmps = employees.length;
  const activeEmps = employees.filter(e => e.status === 'active').length;
  const inactiveEmps = totalEmps - activeEmps;
  const totalRecordsCount = employees.reduce((acc, e) => acc + (parseInt(e.total_records, 10) || 0), 0);

  return (
    <div className="page-body">
      {/* Toast Notification */}
      {notification && (
        <div style={{
          position: 'fixed',
          top: '20px',
          right: '24px',
          zIndex: 9999,
          background: '#10b981',
          color: '#fff',
          padding: '12px 20px',
          borderRadius: '8px',
          boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          fontWeight: 600,
          fontSize: '14px'
        }}>
          <CheckCircle2 size={18} />
          <span>{notification}</span>
        </div>
      )}

      {/* Header */}
      <div className="page-header" style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h1 className="page-title" style={{ fontSize: '24px', fontWeight: 800 }}>
            Employee Management
          </h1>
        </div>

        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={loadEmployees}
            disabled={loading}
            title="Refresh employees list"
          >
            <RefreshCw size={15} className={loading ? 'spin' : ''} />
            <span>Refresh</span>
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleOpenCreate}
          >
            <Plus size={16} />
            <span>Add Employee</span>
          </button>
        </div>
      </div>

      {error && (
        <div style={{ padding: '12px 16px', background: 'var(--danger-bg)', border: '1px solid var(--danger-border)', color: 'var(--danger-text)', borderRadius: '8px', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <AlertCircle size={18} />
          <span>{error}</span>
        </div>
      )}

      {/* ========================================================
          PENDING SUGGESTIONS FROM EXCEL UPLOAD
          ======================================================== */}
      {pendingSuggestions.length > 0 && (
        <div style={{
          padding: '18px 22px',
          background: '#eff6ff',
          border: '1.5px solid #bfdbfe',
          borderRadius: '12px',
          marginBottom: '24px',
          boxShadow: '0 2px 8px rgba(37,99,235,0.06)'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '14px', marginBottom: '14px' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Sparkles size={18} color="#2563eb" />
                <strong style={{ fontSize: '15px', color: '#1e40af' }}>
                  Suggested Employees from Uploaded Excel ({pendingSuggestions.length} pending)
                </strong>
              </div>
              <p style={{ fontSize: '13px', color: '#1e3a8a', margin: '4px 0 0 0' }}>
                These employees were detected in your uploaded spreadsheet. Click <strong>"+ Fill &amp; Create"</strong> to auto-fill their details, or register all at once.
              </p>
            </div>

            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleBatchRegisterAll}
                disabled={batchRegistering}
                style={{ fontSize: '12.5px', padding: '6px 14px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
              >
                {batchRegistering ? <RefreshCw size={14} className="spin" /> : <UserCheck size={14} />}
                <span>Register All ({pendingSuggestions.length}) Now</span>
              </button>

              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => onNavigate && onNavigate('import-excel')}
                style={{ fontSize: '12.5px', padding: '6px 12px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
              >
                <UploadCloud size={14} />
                <span>Return to Import Excel</span>
              </button>

              <button
                type="button"
                className="btn btn-secondary"
                onClick={handleDismissSuggestions}
                style={{ fontSize: '12.5px', padding: '6px 10px', color: 'var(--text-muted)' }}
                title="Dismiss suggestions"
              >
                <X size={14} />
              </button>
            </div>
          </div>

          {/* Quick-fill Suggestion Badges */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
            {pendingSuggestions.map((item) => (
              <div
                key={item.employeeId}
                style={{
                  background: '#ffffff',
                  border: '1px solid #bfdbfe',
                  borderRadius: '8px',
                  padding: '8px 12px',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '10px',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
                }}
              >
                <span style={{ fontWeight: 800, fontSize: '12px', color: '#1d4ed8', background: '#dbeafe', padding: '2px 8px', borderRadius: '4px' }}>
                  {item.employeeId}
                </span>
                <strong style={{ fontSize: '13px', color: '#1e293b' }}>
                  {item.detectedName}
                </strong>
                {item.recordCount > 0 && (
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                    ({item.recordCount} rows in Excel)
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => handlePrefillFromExcel(item)}
                  style={{
                    background: '#2563eb',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '4px',
                    padding: '3px 8px',
                    fontSize: '11.5px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px'
                  }}
                  title="Click to pre-fill creation form"
                >
                  <Plus size={11} />
                  <span>Fill &amp; Create</span>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Return to Import Excel notification banner if some employees exist */}
      {employees.length > 0 && (
        <div style={{
          marginBottom: '20px',
          background: '#f8fafc',
          border: '1px solid #e2e8f0',
          padding: '10px 16px',
          borderRadius: '8px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontSize: '13px',
          color: '#334155'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <FileSpreadsheet size={16} color="var(--primary-600)" />
            <span>Ready to import reports? Uploaded sheets will automatically match your registered Employee IDs.</span>
          </div>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => onNavigate && onNavigate('import-excel')}
            style={{ fontSize: '12px', padding: '4px 12px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
          >
            <span>Import Excel</span>
            <ArrowRight size={13} />
          </button>
        </div>
      )}

      {/* Table Card Container */}
      <div style={{
        background: '#ffffff',
        border: '1px solid #e2e8f0',
        borderRadius: '10px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
        overflow: 'hidden',
        marginBottom: '28px'
      }}>
        {/* Table Toolbar: Search, Filters, and Stats */}
        <div style={{
          padding: '14px 18px',
          borderBottom: '1px solid #e2e8f0',
          background: '#ffffff',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '12px'
        }}>
          {/* Search Box */}
          <div style={{ position: 'relative', flex: '1 1 260px', maxWidth: '380px' }}>
            <Search size={15} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
            <input
              type="text"
              className="form-control"
              placeholder="Search by name, employee ID, or username..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{
                paddingLeft: '36px',
                height: '36px',
                borderRadius: '6px',
                fontSize: '13px',
                borderColor: '#cbd5e1'
              }}
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                style={{
                  position: 'absolute',
                  right: '10px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  color: '#94a3b8',
                  cursor: 'pointer'
                }}
              >
                <X size={13} />
              </button>
            )}
          </div>

          {/* Status Filter & Summary */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <select
              className="form-control"
              style={{ width: 'auto', minWidth: '150px', height: '36px', fontSize: '13px', borderRadius: '6px' }}
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
            >
              <option value="all">All Statuses ({totalEmps})</option>
              <option value="active">Active Only ({activeEmps})</option>
              <option value="inactive">Inactive Only ({inactiveEmps})</option>
            </select>

            <span style={{ fontSize: '12.5px', color: '#64748b', fontWeight: 500 }}>
              {filteredEmployees.length} of {totalEmps} staff
            </span>
          </div>
        </div>

        {/* The Clean Data Table */}
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '13px' }}>
            <thead style={{ background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
              <tr>
                <th style={{ width: '50px', padding: '11px 16px', fontWeight: 600, fontSize: '11.5px', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.5px' }}>#</th>
                <th style={{ padding: '11px 16px', fontWeight: 600, fontSize: '11.5px', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Employee</th>
                <th style={{ width: '160px', padding: '11px 16px', fontWeight: 600, fontSize: '11.5px', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Employee ID</th>
                <th style={{ width: '140px', padding: '11px 16px', fontWeight: 600, fontSize: '11.5px', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Status</th>
                <th style={{ width: '130px', padding: '11px 16px', fontWeight: 600, fontSize: '11.5px', color: '#475569', textTransform: 'uppercase', letterSpacing: '0.5px', textAlign: 'right' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center', padding: '36px', color: '#64748b' }}>
                    Loading employee accounts...
                  </td>
                </tr>
              ) : filteredEmployees.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center', padding: '40px 20px', color: '#64748b' }}>
                    <div style={{ fontWeight: 600, fontSize: '14px', color: '#1e293b', marginBottom: '4px' }}>
                      {employees.length === 0 ? 'No employees registered yet' : 'No matching employees found'}
                    </div>
                    <div style={{ fontSize: '12.5px' }}>
                      {employees.length === 0 ? 'Add an employee or use Excel upload suggestions.' : 'Try adjusting your search criteria.'}
                    </div>
                  </td>
                </tr>
              ) : (
                filteredEmployees.map((emp, idx) => {
                  const initials = (emp.name || 'E').split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);

                  return (
                    <tr
                      key={emp.id}
                      onClick={() => setSelectedEmployee(emp)}
                      style={{
                        borderBottom: '1px solid #f1f5f9',
                        cursor: 'pointer',
                        transition: 'background-color 0.15s ease'
                      }}
                      onMouseEnter={e => e.currentTarget.style.backgroundColor = '#f8fafc'}
                      onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                      title="Click row to view details"
                    >
                      <td style={{ padding: '12px 16px', color: '#94a3b8', fontSize: '12px' }}>
                        {idx + 1}
                      </td>

                      <td style={{ padding: '12px 16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <div style={{
                            width: '32px',
                            height: '32px',
                            borderRadius: '6px',
                            background: '#f1f5f9',
                            color: '#334155',
                            border: '1px solid #e2e8f0',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontWeight: 700,
                            fontSize: '12px',
                            flexShrink: 0
                          }}>
                            {initials}
                          </div>
                          <div>
                            <div style={{ fontWeight: 600, color: '#0f172a' }}>
                              {emp.name}
                            </div>
                            <div style={{ fontSize: '11.5px', color: '#64748b' }}>
                              @{emp.username}
                            </div>
                          </div>
                        </div>
                      </td>

                      <td style={{ padding: '12px 16px' }}>
                        <code style={{
                          background: '#f8fafc',
                          border: '1px solid #e2e8f0',
                          color: '#334155',
                          padding: '2px 8px',
                          borderRadius: '4px',
                          fontSize: '12px',
                          fontWeight: 600
                        }}>
                          {emp.staff_id}
                        </code>
                      </td>

                      <td style={{ padding: '12px 16px' }}>
                        <span style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          fontSize: '12px',
                          fontWeight: 500,
                          color: emp.status === 'active' ? '#16a34a' : '#64748b'
                        }}>
                          <span style={{
                            width: '6px',
                            height: '6px',
                            borderRadius: '50%',
                            background: emp.status === 'active' ? '#16a34a' : '#94a3b8'
                          }} />
                          {emp.status === 'active' ? 'Active' : 'Inactive'}
                        </span>
                      </td>

                      <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }} onClick={e => e.stopPropagation()}>
                          <button
                            type="button"
                            className="btn btn-secondary"
                            style={{ padding: '4px 8px', fontSize: '11.5px', height: '28px', color: '#475569' }}
                            onClick={() => setSelectedEmployee(emp)}
                            title="View full details"
                          >
                            <span>Details</span>
                            <ChevronRight size={12} style={{ marginLeft: '2px' }} />
                          </button>
                          <button
                            type="button"
                            className="btn btn-secondary"
                            style={{ padding: '4px 8px', fontSize: '11.5px', height: '28px' }}
                            onClick={() => handleOpenEdit(emp)}
                            title="Edit employee"
                          >
                            <Edit2 size={12} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ========================================================
          EMPLOYEE DETAILS POPUP MODAL (ON ROW CLICK)
          ======================================================== */}
      {selectedEmployee && (
        <div className="modal-overlay" onClick={() => setSelectedEmployee(null)}>
          <div
            className="modal-dialog"
            onClick={e => e.stopPropagation()}
            style={{ maxWidth: '540px', width: '100%', borderRadius: '14px', overflow: 'hidden' }}
          >
            {/* Header */}
            <div style={{
              padding: '20px 24px',
              background: 'linear-gradient(135deg, #1e293b, #0f172a)',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                <div style={{
                  width: '42px',
                  height: '42px',
                  borderRadius: '8px',
                  background: '#334155',
                  color: '#ffffff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 700,
                  fontSize: '15px'
                }}>
                  {(selectedEmployee.name || 'E').split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)}
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 700, color: '#ffffff' }}>
                      {selectedEmployee.name}
                    </h3>
                    <span style={{
                      background: 'rgba(255,255,255,0.12)',
                      color: '#e2e8f0',
                      padding: '2px 8px',
                      borderRadius: '4px',
                      fontSize: '11.5px',
                      fontWeight: 600,
                      fontFamily: 'monospace'
                    }}>
                      {selectedEmployee.staff_id}
                    </span>
                  </div>
                  <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '2px' }}>
                    Sales Staff &bull; Login username: <code>{selectedEmployee.username}</code>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setSelectedEmployee(null)}
                style={{
                  background: 'rgba(255,255,255,0.1)',
                  border: 'none',
                  color: '#cbd5e1',
                  borderRadius: '50%',
                  width: '32px',
                  height: '32px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '16px'
                }}
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <div style={{ padding: '22px 24px', background: '#f8fafc' }}>
              {/* Highlight metrics */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: '12px',
                marginBottom: '20px'
              }}>
                <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', padding: '12px', borderRadius: '10px', textAlign: 'center' }}>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', textTransform: 'uppercase', fontWeight: 700 }}>Account Status</span>
                  <span style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '5px',
                    marginTop: '5px',
                    fontSize: '12.5px',
                    fontWeight: 700,
                    color: selectedEmployee.status === 'active' ? '#15803d' : '#b91c1c'
                  }}>
                    <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: selectedEmployee.status === 'active' ? '#16a34a' : '#dc2626' }} />
                    {selectedEmployee.status === 'active' ? 'Active' : 'Inactive'}
                  </span>
                </div>

                <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', padding: '12px', borderRadius: '10px', textAlign: 'center' }}>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', textTransform: 'uppercase', fontWeight: 700 }}>Monthly Reports</span>
                  <strong style={{ fontSize: '15px', color: '#1e293b', marginTop: '3px', display: 'block' }}>
                    {selectedEmployee.report_count || 0}
                  </strong>
                </div>

                <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', padding: '12px', borderRadius: '10px', textAlign: 'center' }}>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', textTransform: 'uppercase', fontWeight: 700 }}>Sales Records</span>
                  <strong style={{ fontSize: '15px', color: '#1e293b', marginTop: '3px', display: 'block' }}>
                    {selectedEmployee.total_records || 0} rows
                  </strong>
                </div>
              </div>

              {/* Detailed specs */}
              <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '16px 18px', marginBottom: '20px' }}>
                <h4 style={{ fontSize: '12px', fontWeight: 700, color: '#475569', margin: '0 0 12px 0', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Account &amp; System Information
                </h4>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px', fontSize: '13px' }}>
                  <div>
                    <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '11px', fontWeight: 600 }}>FULL NAME</span>
                    <strong style={{ color: '#1e293b' }}>{selectedEmployee.name}</strong>
                  </div>

                  <div>
                    <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '11px', fontWeight: 600 }}>EMPLOYEE ID</span>
                    <code style={{ background: '#eff6ff', color: '#1d4ed8', padding: '2px 6px', borderRadius: '4px', fontWeight: 700, fontSize: '12px' }}>
                      {selectedEmployee.staff_id}
                    </code>
                  </div>

                  <div>
                    <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '11px', fontWeight: 600 }}>LOGIN USERNAME</span>
                    <code style={{ background: '#f1f5f9', color: '#334155', padding: '2px 6px', borderRadius: '4px', fontSize: '12px' }}>
                      {selectedEmployee.username}
                    </code>
                  </div>

                  <div>
                    <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '11px', fontWeight: 600 }}>ROLE</span>
                    <span style={{ fontWeight: 600, color: '#475569' }}>Sales Staff</span>
                  </div>

                  <div>
                    <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '11px', fontWeight: 600 }}>REGISTERED DATE</span>
                    <span style={{ color: '#475569' }}>
                      {selectedEmployee.created_at ? new Date(selectedEmployee.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
                    </span>
                  </div>

                  <div>
                    <span style={{ color: 'var(--text-muted)', display: 'block', fontSize: '11px', fontWeight: 600 }}>LAST UPDATED</span>
                    <span style={{ color: '#475569' }}>
                      {selectedEmployee.updated_at ? new Date(selectedEmployee.updated_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
                    </span>
                  </div>
                </div>
              </div>

              {/* View Reports Shortcut if reports exist */}
              {selectedEmployee.report_count > 0 && (
                <div style={{
                  background: '#eff6ff',
                  border: '1px solid #bfdbfe',
                  borderRadius: '10px',
                  padding: '12px 16px',
                  marginBottom: '20px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: '10px'
                }}>
                  <div style={{ fontSize: '13px', color: '#1e3a8a' }}>
                    <strong>Monthly Sales Data Available</strong>
                    <div style={{ fontSize: '12px', color: '#3b82f6', marginTop: '2px' }}>
                      {selectedEmployee.report_count} monthly report(s) and {selectedEmployee.total_records} rows imported
                    </div>
                  </div>
                  <button
                    type="button"
                    className="btn btn-primary"
                    style={{ padding: '6px 12px', fontSize: '12px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                    onClick={() => {
                      setSelectedEmployee(null);
                      onNavigate && onNavigate('employee-reports');
                    }}
                  >
                    <ExternalLink size={13} />
                    <span>View Sales Reports</span>
                  </button>
                </div>
              )}

              {/* Action Buttons Toolbar */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(115px, 1fr))',
                gap: '8px'
              }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => {
                    const target = selectedEmployee;
                    setSelectedEmployee(null);
                    handleOpenEdit(target);
                  }}
                  style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '6px', fontSize: '12.5px', padding: '8px 12px' }}
                >
                  <Edit2 size={14} />
                  <span>Edit Profile</span>
                </button>

                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => {
                    const target = selectedEmployee;
                    setSelectedEmployee(null);
                    handleOpenReset(target);
                  }}
                  style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '6px', fontSize: '12.5px', padding: '8px 12px' }}
                >
                  <KeyRound size={14} />
                  <span>Reset Password</span>
                </button>

                <button
                  type="button"
                  className={`btn ${selectedEmployee.status === 'active' ? 'btn-secondary' : 'btn-primary'}`}
                  onClick={() => handleToggleStatus(selectedEmployee)}
                  style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '6px', fontSize: '12.5px', padding: '8px 12px' }}
                >
                  {selectedEmployee.status === 'active' ? <UserX size={14} /> : <UserCheck size={14} />}
                  <span>{selectedEmployee.status === 'active' ? 'Deactivate' : 'Activate'}</span>
                </button>

                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => {
                    const target = selectedEmployee;
                    setSelectedEmployee(null);
                    setDeleteTarget(target);
                  }}
                  style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '6px', fontSize: '12.5px', padding: '8px 12px', color: 'var(--danger-text)', borderColor: 'var(--danger-border)' }}
                >
                  <Trash2 size={14} />
                  <span>Delete</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add / Edit Modal */}
      {showAddModal && (
        <div className="modal-overlay">
          <div className="modal-dialog">
            <div className="modal-header">
              <h3 className="modal-title">
                {editingEmployee ? `Edit Employee: ${editingEmployee.name}` : 'Add New Employee'}
              </h3>
              <button
                type="button"
                className="modal-close"
                onClick={() => setShowAddModal(false)}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveEmployee}>
              <div className="modal-body">
                {modalError && (
                  <div style={{ padding: '10px 14px', background: 'var(--danger-bg)', border: '1px solid var(--danger-border)', color: 'var(--danger-text)', borderRadius: '6px', marginBottom: '16px', fontSize: '13px' }}>
                    {modalError}
                  </div>
                )}

                {/* Suggestions interactive selector inside modal when adding new employee */}
                {!editingEmployee && pendingSuggestions.length > 0 && (
                  <div style={{
                    marginBottom: '20px',
                    background: '#eff6ff',
                    border: '1.5px solid #93c5fd',
                    borderRadius: '10px',
                    padding: '14px 16px',
                    boxShadow: '0 2px 6px rgba(37,99,235,0.06)'
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px', flexWrap: 'wrap', gap: '6px' }}>
                      <span style={{ fontSize: '13px', fontWeight: 800, color: '#1e40af', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <Sparkles size={16} color="#2563eb" />
                        <span>Suggested from Uploaded Sheet ({pendingSuggestions.length} pending):</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          setFormStaffId('');
                          setFormName('');
                          setFormUsername('');
                          setFormPassword('sales123');
                        }}
                        style={{
                          background: 'transparent',
                          border: 'none',
                          color: '#64748b',
                          fontSize: '11.5px',
                          cursor: 'pointer',
                          textDecoration: 'underline'
                        }}
                      >
                        Clear fields / enter manually
                      </button>
                    </div>

                    <p style={{ fontSize: '12px', color: '#1e3a8a', margin: '0 0 10px 0' }}>
                      Click any employee below to instantly auto-fill into the creation fields:
                    </p>

                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                      {pendingSuggestions.map(p => {
                        const isSelected = formStaffId.toUpperCase() === (p.employeeId || '').toUpperCase();
                        return (
                          <button
                            key={p.employeeId}
                            type="button"
                            onClick={() => handlePrefillFromExcel(p)}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '6px',
                              background: isSelected ? '#2563eb' : '#ffffff',
                              border: isSelected ? '1.5px solid #1d4ed8' : '1px solid #bfdbfe',
                              color: isSelected ? '#ffffff' : '#1e3a8a',
                              padding: '5px 12px',
                              borderRadius: '6px',
                              fontSize: '12px',
                              fontWeight: 700,
                              cursor: 'pointer',
                              boxShadow: isSelected ? '0 2px 5px rgba(37,99,235,0.2)' : 'none',
                              transition: 'all 0.15s ease'
                            }}
                            title={`Click to fill with ${p.detectedName} (${p.employeeId})`}
                          >
                            <span style={{
                              background: isSelected ? '#1d4ed8' : '#dbeafe',
                              color: isSelected ? '#ffffff' : '#1e40af',
                              padding: '1px 6px',
                              borderRadius: '4px',
                              fontSize: '11px',
                              fontWeight: 800
                            }}>
                              {p.employeeId}
                            </span>
                            <span>{p.detectedName}</span>
                            {isSelected && <CheckCircle2 size={13} color="#ffffff" />}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Native Datalists for instant field auto-suggestions */}
                <datalist id="suggested-employee-names">
                  {pendingSuggestions.map(p => (
                    <option key={`name-${p.employeeId}`} value={p.detectedName}>
                      {p.employeeId} - {p.detectedName} ({p.recordCount} rows in Excel)
                    </option>
                  ))}
                </datalist>

                <datalist id="suggested-employee-ids">
                  {pendingSuggestions.map(p => (
                    <option key={`id-${p.employeeId}`} value={p.employeeId}>
                      {p.detectedName} ({p.sheetName})
                    </option>
                  ))}
                </datalist>

                <div className="form-group" style={{ marginBottom: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                    <label className="form-label" style={{ fontWeight: 600, margin: 0 }}>
                      Full Name <span style={{ color: 'var(--danger-text)' }}>*</span>
                    </label>
                    {pendingSuggestions.some(p => p.detectedName.toLowerCase() === (formName || '').trim().toLowerCase()) && (
                      <span style={{ fontSize: '11.5px', color: '#16a34a', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                        <CheckCircle2 size={13} />
                        <span>Suggested from Sheet</span>
                      </span>
                    )}
                  </div>
                  <input
                    type="text"
                    className="form-control"
                    list="suggested-employee-names"
                    placeholder="e.g. THASHEEL"
                    value={formName}
                    onChange={e => {
                      const val = e.target.value;
                      setFormName(val);
                      // If user picked a suggested name, match with pending suggestion
                      const matched = pendingSuggestions.find(p => p.detectedName.toLowerCase() === val.toLowerCase());
                      if (matched) {
                        setFormStaffId(matched.employeeId);
                        setFormUsername(matched.detectedName.toLowerCase().replace(/[^a-z0-9]/g, ''));
                      } else if (!formUsername || formUsername === formName.toLowerCase().replace(/[^a-z0-9]/g, '')) {
                        setFormUsername(val.toLowerCase().replace(/[^a-z0-9]/g, ''));
                      }
                    }}
                    required
                    autoFocus
                  />
                  <span style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px', display: 'block' }}>
                    The staff member's official full name (Excel-detected names suggested in dropdown).
                  </span>
                </div>

                <div className="form-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                  <div className="form-group">
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                      <label className="form-label" style={{ fontWeight: 600, margin: 0 }}>
                        Employee ID <span style={{ color: 'var(--danger-text)' }}>*</span>
                      </label>
                      {pendingSuggestions.some(p => (p.employeeId || '').toUpperCase() === (formStaffId || '').trim().toUpperCase()) && (
                        <span style={{ fontSize: '11px', color: '#16a34a', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                          <CheckCircle2 size={12} />
                          <span>Sheet ID</span>
                        </span>
                      )}
                    </div>
                    <input
                      type="text"
                      className="form-control"
                      list="suggested-employee-ids"
                      placeholder="e.g. AS100 or AST04"
                      value={formStaffId}
                      onChange={e => {
                        const val = e.target.value.toUpperCase();
                        setFormStaffId(val);
                        const matched = pendingSuggestions.find(p => (p.employeeId || '').toUpperCase() === val);
                        if (matched) {
                          if (!formName) setFormName(matched.detectedName);
                          if (!formUsername) setFormUsername(matched.detectedName.toLowerCase().replace(/[^a-z0-9]/g, ''));
                        }
                      }}
                      required
                    />
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px', display: 'block' }}>
                      Must match worksheet tab or ID in Excel.
                    </span>
                  </div>

                  <div className="form-group">
                    <label className="form-label" style={{ fontWeight: 600, display: 'block', marginBottom: '6px' }}>
                      Login Username <span style={{ color: 'var(--danger-text)' }}>*</span>
                    </label>
                    <input
                      type="text"
                      className="form-control"
                      placeholder="e.g. thasheel"
                      value={formUsername}
                      onChange={e => setFormUsername(e.target.value.toLowerCase())}
                      required
                    />
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px', display: 'block' }}>
                      Username used by staff member to log in.
                    </span>
                  </div>
                </div>

                {!editingEmployee && (
                  <div className="form-group" style={{ marginBottom: '16px' }}>
                    <label className="form-label" style={{ fontWeight: 600, display: 'block', marginBottom: '6px' }}>
                      Initial Password <span style={{ color: 'var(--danger-text)' }}>*</span>
                    </label>
                    <input
                      type="password"
                      className="form-control"
                      placeholder="At least 6 characters (default: sales123)"
                      value={formPassword}
                      onChange={e => setFormPassword(e.target.value)}
                      required
                      minLength={6}
                    />
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px', display: 'block' }}>
                      Pre-filled with default initial password <code>sales123</code>. Staff can change it after login.
                    </span>
                  </div>
                )}

                <div className="form-group">
                  <label className="form-label" style={{ fontWeight: 600, display: 'block', marginBottom: '6px' }}>
                    Account Status
                  </label>
                  <select
                    className="form-control"
                    value={formStatus}
                    onChange={e => setFormStatus(e.target.value)}
                  >
                    <option value="active">Active (Can log in &amp; view their reports)</option>
                    <option value="inactive">Inactive (Access suspended)</option>
                  </select>
                </div>
              </div>

              <div className="modal-footer" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowAddModal(false)}
                >
                  Cancel
                </button>

                <div style={{ display: 'flex', gap: '8px' }}>
                  {!editingEmployee && pendingSuggestions.length > 1 && (
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={handleSaveAndNext}
                      disabled={modalSubmitting}
                      style={{
                        color: '#1d4ed8',
                        borderColor: '#93c5fd',
                        background: '#eff6ff',
                        fontWeight: 700,
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px'
                      }}
                      title="Create this employee and immediately auto-fill the next suggested employee from Excel"
                    >
                      <Sparkles size={14} color="#2563eb" />
                      <span>Save &amp; Next ({pendingSuggestions.length - 1} left)</span>
                    </button>
                  )}

                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={modalSubmitting}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                  >
                    {modalSubmitting ? <RefreshCw size={14} className="spin" /> : editingEmployee ? <CheckCircle2 size={14} /> : <UserCheck size={14} />}
                    <span>{modalSubmitting ? 'Saving...' : editingEmployee ? 'Save Changes' : 'Create Employee'}</span>
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reset Password Modal */}
      {resettingEmployee && (
        <div className="modal-overlay">
          <div className="modal-dialog">
            <div className="modal-header">
              <h3 className="modal-title">
                Reset Password: {resettingEmployee.name}
              </h3>
              <button
                type="button"
                className="modal-close"
                onClick={() => setResettingEmployee(null)}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleResetPasswordSubmit}>
              <div className="modal-body">
                {modalError && (
                  <div style={{ padding: '10px 14px', background: 'var(--danger-bg)', border: '1px solid var(--danger-border)', color: 'var(--danger-text)', borderRadius: '6px', marginBottom: '16px', fontSize: '13px' }}>
                    {modalError}
                  </div>
                )}

                <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '16px' }}>
                  Assign a new password for <strong>{resettingEmployee.name}</strong> (Employee ID: <code>{resettingEmployee.staff_id}</code>).
                </p>

                <div className="form-group">
                  <label className="form-label" style={{ fontWeight: 600, display: 'block', marginBottom: '6px' }}>
                    New Password <span style={{ color: 'var(--danger-text)' }}>*</span>
                  </label>
                  <input
                    type="password"
                    className="form-control"
                    placeholder="Enter new password (min. 6 characters)"
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                    required
                    minLength={6}
                    autoFocus
                  />
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px', display: 'block' }}>
                    Passwords are securely encrypted with bcrypt.
                  </span>
                </div>
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setResettingEmployee(null)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={modalSubmitting}
                >
                  {modalSubmitting ? 'Updating...' : 'Set New Password'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <div className="modal-overlay">
          <div className="modal-dialog">
            <div className="modal-header">
              <h3 className="modal-title" style={{ color: 'var(--danger-text)' }}>
                Delete Employee Account
              </h3>
              <button
                type="button"
                className="modal-close"
                onClick={() => setDeleteTarget(null)}
              >
                ✕
              </button>
            </div>

            <div className="modal-body">
              <p style={{ fontSize: '14px', lineHeight: '1.6', marginBottom: '12px' }}>
                Are you sure you want to delete the employee account for{' '}
                <strong>{deleteTarget.name}</strong> (<code>{deleteTarget.staff_id}</code>)?
              </p>
              {deleteTarget.report_count > 0 && (
                <div style={{ padding: '10px 14px', background: '#fffbeb', border: '1px solid #fde68a', color: '#b45309', borderRadius: '6px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <AlertCircle size={16} />
                  <span>This employee has <strong>{deleteTarget.report_count} imported monthly report(s)</strong>. Deleting the user account removes their login access.</span>
                </div>
              )}
            </div>

            <div className="modal-footer">
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setDeleteTarget(null)}
                disabled={modalSubmitting}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-danger"
                onClick={handleConfirmDelete}
                disabled={modalSubmitting}
              >
                {modalSubmitting ? 'Deleting...' : 'Delete Employee'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
