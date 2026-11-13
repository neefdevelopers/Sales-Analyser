// src/views/manager/ImportHistory.jsx
import React, { useState, useEffect } from 'react';
import { api } from '../../api';
import {
  Clock,
  FileSpreadsheet,
  Trash2,
  Eye,
  AlertCircle,
  CheckCircle2,
  X,
  UploadCloud,
  ArrowLeftRight
} from 'lucide-react';

export default function ImportHistory({ onNavigate }) {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    loadHistory();
  }, []);

  async function loadHistory() {
    setLoading(true);
    setError('');
    try {
      const res = await api.get('/manager/history');
      setHistory(res.history || []);
    } catch (err) {
      console.error('Failed to load history:', err);
      setError(err.message || 'Failed to load import history.');
    } finally {
      setLoading(false);
    }
  }

  async function handleConfirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await api.delete(`/manager/history/${deleteTarget.id}`);
      setDeleteTarget(null);
      await loadHistory();
    } catch (err) {
      alert(err.message || 'Failed to delete import history item.');
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="page-body">
      {/* Header */}
      <div className="page-header" style={{ marginBottom: '20px' }}>
        <div>
          <h1 className="page-title" style={{ fontSize: '24px', fontWeight: 800 }}>
            Excel Import History
          </h1>
        </div>

        <button
          type="button"
          className="btn btn-primary"
          onClick={() => onNavigate && onNavigate('import-excel')}
          style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '9px 16px', fontWeight: 600 }}
        >
          <UploadCloud size={16} />
          <span>Import New Excel Report</span>
        </button>
      </div>

      {error && (
        <div style={{ padding: '12px 16px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', color: '#991b1b', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <AlertCircle size={18} color="#dc2626" />
          <span>{error}</span>
        </div>
      )}

      {/* Table Card */}
      <div className="table-card" style={{ overflow: 'hidden' }}>
        <div className="table-toolbar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Clock size={16} color="var(--primary-600)" />
            <strong style={{ fontSize: '14.5px' }}>Import History Entries</strong>
            <span className="badge badge-neutral" style={{ fontSize: '11px' }}>
              {history.length} records
            </span>
          </div>
        </div>

        {history.length > 0 && (
          <div className="mobile-table-hint">
            <ArrowLeftRight size={13} color="var(--primary-600)" />
            <span>Swipe table horizontally to view audit logs</span>
          </div>
        )}

        <div className="responsive-table-view">
          <div className="table-responsive">
            <table className="data-table" style={{ minWidth: '680px' }}>
              <thead>
                <tr>
                  <th>Reporting Month</th>
                  <th>Filename</th>
                  <th style={{ textAlign: 'right' }}>Total Employees</th>
                  <th style={{ textAlign: 'right' }}>Total Records</th>
                  <th>Uploaded At</th>
                  <th>Uploaded By</th>
                  <th>Status</th>
                  <th style={{ textAlign: 'center', width: '160px' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan="8" style={{ textAlign: 'center', padding: '36px' }}>Loading import history...</td>
                  </tr>
                ) : history.length === 0 ? (
                  <tr>
                    <td colSpan="8">
                      <div className="empty-state" style={{ padding: '36px' }}>
                        <div className="empty-state-icon"><FileSpreadsheet size={24} /></div>
                        <div className="empty-state-title">No imports on record</div>
                        <div className="empty-state-desc">Upload a monthly Excel file to see its import history here.</div>
                      </div>
                    </td>
                  </tr>
                ) : (
                  history.map((h) => (
                    <tr key={h.id}>
                      <td>
                        <strong style={{ color: 'var(--primary-700)', fontSize: '13.5px' }}>
                          {h.month_name}
                        </strong>
                        <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{h.report_month}</div>
                      </td>
                      <td>
                        <code style={{ fontSize: '12px' }}>{h.filename}</code>
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 600 }}>
                        {h.total_employees}
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 600 }}>
                        {h.total_records?.toLocaleString()}
                      </td>
                      <td>
                        {new Date(h.created_at).toLocaleString()}
                      </td>
                      <td>
                        {h.imported_by_name || 'Brand Manager'}
                      </td>
                      <td>
                        <span className="badge badge-success" style={{ textTransform: 'capitalize' }}>
                          {h.import_status || 'Completed'}
                        </span>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <div style={{ display: 'inline-flex', gap: '6px' }}>
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={() => onNavigate && onNavigate('employee-reports', { month: h.report_month })}
                            title="View Reports for this month"
                            style={{ padding: '4px 8px', fontSize: '12px' }}
                          >
                            <Eye size={13} style={{ marginRight: '4px' }} />
                            View
                          </button>
                          <button
                            type="button"
                            className="btn btn-secondary btn-sm"
                            onClick={() => setDeleteTarget(h)}
                            title="Delete this month's imported report"
                            style={{ padding: '4px 8px', fontSize: '12px', color: '#dc2626', borderColor: '#fca5a5' }}
                          >
                            <Trash2 size={13} />
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
      </div>

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <div className="modal-backdrop" onClick={() => !deleting && setDeleteTarget(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '460px' }}>
            <div className="modal-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#dc2626' }}>
                <AlertCircle size={20} />
                <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 700 }}>Delete Monthly Report?</h3>
              </div>
              <button
                type="button"
                className="btn-icon"
                onClick={() => !deleting && setDeleteTarget(null)}
                disabled={deleting}
              >
                <X size={18} />
              </button>
            </div>
            <div className="modal-body" style={{ padding: '16px 20px', fontSize: '13.5px', color: '#475569', lineHeight: 1.6 }}>
              <p style={{ margin: '0 0 10px 0' }}>
                Are you sure you want to permanently delete the imported sales report for <strong>{deleteTarget.month_name}</strong> (<code>{deleteTarget.filename}</code>)?
              </p>
              <p style={{ margin: 0, color: '#b91c1c', background: '#fef2f2', padding: '10px 14px', borderRadius: '6px', fontSize: '12.5px' }}>
                This will delete all <strong>{deleteTarget.total_records} records</strong> associated with this month. Staff users will remain intact.
              </p>
            </div>
            <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', padding: '12px 20px' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setDeleteTarget(null)}
                disabled={deleting}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-danger"
                onClick={handleConfirmDelete}
                disabled={deleting}
                style={{ background: '#dc2626', borderColor: '#b91c1c', color: '#ffffff', fontWeight: 600 }}
              >
                {deleting ? 'Deleting...' : 'Yes, Delete Report'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
