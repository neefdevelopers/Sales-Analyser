// src/views/manager/ImportExcel.jsx
import React, { useState, useRef } from 'react';
import { api } from '../../api';
import {
  UploadCloud,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  ArrowRight,
  RefreshCw,
  X,
  Users,
  Calendar,
  Layers,
  ArrowLeft,
  FileText
} from 'lucide-react';

export default function ImportExcel({ onNavigate }) {
  const [step, setStep] = useState('upload'); // 'upload' | 'preview' | 'success'
  const [file, setFile] = useState(null);
  const [fileBase64, setFileBase64] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Preview data from server
  const [preview, setPreview] = useState(null);
  const [customMonth, setCustomMonth] = useState('');
  const [confirming, setConfirming] = useState(false);
  const [result, setResult] = useState(null);

  const fileInputRef = useRef(null);

  function handleFileSelect(selectedFile) {
    if (!selectedFile) return;

    if (!selectedFile.name.endsWith('.xlsx') && !selectedFile.name.endsWith('.xls')) {
      setError('Please upload a valid Excel file (.xlsx or .xls)');
      return;
    }

    setFile(selectedFile);
    setError('');

    const reader = new FileReader();
    reader.onload = async (e) => {
      const base64 = e.target.result.split(',')[1];
      setFileBase64(base64);
      await fetchPreview(base64, selectedFile.name);
    };
    reader.onerror = () => {
      setError('Failed to read the file.');
    };
    reader.readAsDataURL(selectedFile);
  }

  async function fetchPreview(base64Data, filename) {
    setLoading(true);
    setError('');
    try {
      const res = await api.post('/manager/import/preview', {
        fileBase64: base64Data,
        filename
      });
      setPreview(res);
      setCustomMonth(res.reportMonth || '');
      setStep('preview');
    } catch (err) {
      console.error('Failed to parse Excel preview:', err);
      setError(err.message || 'Failed to parse Excel workbook.');
    } finally {
      setLoading(false);
    }
  }

  async function handleConfirmImport() {
    if (!fileBase64) return;
    setConfirming(true);
    setError('');
    try {
      const res = await api.post('/manager/import/confirm', {
        fileBase64,
        filename: file?.name || preview?.filename,
        customMonth
      });
      setResult(res);
      setStep('success');
    } catch (err) {
      console.error('Import confirmation error:', err);
      setError(err.message || 'Failed to save imported sales records.');
    } finally {
      setConfirming(false);
    }
  }

  function handleReset() {
    setStep('upload');
    setFile(null);
    setFileBase64('');
    setPreview(null);
    setResult(null);
    setError('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  return (
    <div className="page-body">
      {/* Header */}
      <div className="page-header" style={{ marginBottom: '20px' }}>
        <div>
          <h1 className="page-title" style={{ fontSize: '24px', fontWeight: 800 }}>
            Import Monthly Excel Report
          </h1>
          <p className="page-subtitle" style={{ color: 'var(--text-muted)', fontSize: '13px', marginTop: '4px' }}>
            Upload the monthly sales workbook to generate employee sales reports dynamically
          </p>
        </div>

        {step !== 'upload' && (
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={handleReset}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
          >
            <ArrowLeft size={14} />
            <span>Upload Another File</span>
          </button>
        )}
      </div>

      {error && (
        <div style={{ padding: '12px 16px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', color: '#991b1b', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <XCircle size={18} color="#dc2626" />
          <span>{error}</span>
        </div>
      )}

      {/* ==========================================
          STEP 1: UPLOAD EXCEL FILE
          ========================================== */}
      {step === 'upload' && (
        <div style={{ maxWidth: '680px', margin: '0 auto' }}>
          <div
            className={`dropzone ${isDragging ? 'dragging' : ''}`}
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setIsDragging(false);
              if (e.dataTransfer.files?.[0]) handleFileSelect(e.dataTransfer.files[0]);
            }}
            onClick={() => fileInputRef.current?.click()}
            style={{
              padding: '48px 24px',
              border: '2px dashed var(--border-color, #cbd5e1)',
              borderRadius: '12px',
              background: isDragging ? '#eff6ff' : '#ffffff',
              textAlign: 'center',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              marginBottom: '20px'
            }}
          >
            <input
              type="file"
              ref={fileInputRef}
              onChange={(e) => { if (e.target.files?.[0]) handleFileSelect(e.target.files[0]); }}
              accept=".xlsx, .xls"
              style={{ display: 'none' }}
            />

            <div style={{ width: '56px', height: '56px', borderRadius: '14px', background: '#ecfdf5', color: '#047857', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: '14px' }}>
              {loading ? <RefreshCw size={28} className="spin" /> : <UploadCloud size={28} />}
            </div>

            <h3 style={{ fontSize: '17px', fontWeight: 700, margin: '0 0 6px 0' }}>
              {loading ? 'Reading and scanning workbook...' : 'Click to select or drag & drop Excel workbook'}
            </h3>

            <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: '0 0 16px 0' }}>
              Supports Microsoft Excel files (<code style={{ color: '#047857', fontWeight: 600 }}>.xlsx</code>) with individual employee sheets or consolidated data
            </p>

            <button
              type="button"
              className="btn btn-primary"
              disabled={loading}
              onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}
            >
              Select Excel File (.xlsx)
            </button>
          </div>

          <div style={{ background: '#f8fafc', padding: '16px 20px', borderRadius: '10px', border: '1px solid #e2e8f0', fontSize: '12.5px', color: '#475569', lineHeight: 1.6 }}>
            <strong style={{ display: 'block', color: '#1e293b', marginBottom: '6px', fontSize: '13px' }}>
              Automatic Data Processing Rules:
            </strong>
            <ul style={{ margin: 0, paddingLeft: '18px' }}>
              <li>Automatically detects all employee worksheets and employee table columns.</li>
              <li>Extracts Employee IDs, staff names, and all product, quantity, return, and incentive columns dynamically.</li>
              <li>Consolidated summary sheets (e.g. "Summary", "Totals") are skipped to prevent duplicate counting.</li>
              <li>Original Excel column headers and data values are 100% preserved.</li>
            </ul>
          </div>
        </div>
      )}

      {/* ==========================================
          STEP 2: IMPORT PREVIEW & CONFIRMATION
          ========================================== */}
      {step === 'preview' && preview && (
        <div>
          {/* Duplicate Alert Banner if month already exists */}
          {preview.isDuplicateMonth && (
            <div style={{ padding: '14px 18px', background: '#fffbeb', border: '1px solid #fef3c7', borderRadius: '8px', color: '#92400e', marginBottom: '20px', display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
              <AlertTriangle size={20} color="#d97706" style={{ flexShrink: 0, marginTop: '2px' }} />
              <div>
                <strong>Report month ({preview.reportMonth}) already exists!</strong>
                <div style={{ fontSize: '12.5px', marginTop: '2px' }}>
                  A report for {preview.monthName} was previously imported from <code>{preview.duplicateDetails?.filename}</code>.
                  Confirming this import will <strong>update and replace</strong> the previous report for {preview.monthName} to prevent duplicate records.
                </div>
              </div>
            </div>
          )}

          {/* Top Summary Metrics Strip */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '14px', marginBottom: '22px' }}>
            <div className="table-card" style={{ padding: '16px', marginBottom: 0, borderLeft: '4px solid #3b82f6' }}>
              <div style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>Employees Detected</div>
              <div style={{ fontSize: '22px', fontWeight: 800, color: '#1e293b', marginTop: '2px' }}>
                {preview.totalEmployees} employees
              </div>
            </div>

            <div className="table-card" style={{ padding: '16px', marginBottom: 0, borderLeft: '4px solid #10b981' }}>
              <div style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>Total Records Recognized</div>
              <div style={{ fontSize: '22px', fontWeight: 800, color: '#047857', marginTop: '2px' }}>
                {preview.totalRecords?.toLocaleString()} rows
              </div>
            </div>

            <div className="table-card" style={{ padding: '16px', marginBottom: 0, borderLeft: '4px solid #8b5cf6' }}>
              <div style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>Worksheets Scanned</div>
              <div style={{ fontSize: '22px', fontWeight: 800, color: '#6d28d9', marginTop: '2px' }}>
                {preview.recognizedSheets?.length || 0} sheets
              </div>
            </div>

            <div className="table-card" style={{ padding: '16px', marginBottom: 0, borderLeft: '4px solid #f59e0b' }}>
              <div style={{ fontSize: '11.5px', color: 'var(--text-muted)' }}>Columns Identified</div>
              <div style={{ fontSize: '22px', fontWeight: 800, color: '#b45309', marginTop: '2px' }}>
                {preview.allColumns?.length || 0} columns
              </div>
            </div>
          </div>

          {/* Reporting Month Configuration */}
          <div className="table-card" style={{ padding: '18px 22px', marginBottom: '22px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <Calendar size={20} color="var(--primary-600)" />
                <div>
                  <strong style={{ fontSize: '14px' }}>Target Reporting Month:</strong>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                    Auto-detected from file: <strong>{preview.monthName} ({preview.reportMonth})</strong>
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <label style={{ fontSize: '12.5px', fontWeight: 600 }}>Period (YYYY-MM):</label>
                <input
                  type="month"
                  className="form-control"
                  value={customMonth}
                  onChange={(e) => setCustomMonth(e.target.value)}
                  style={{ width: '170px', height: '36px', fontSize: '13px' }}
                />
              </div>
            </div>
          </div>

          {/* Detected Employees Table */}
          <div className="table-card" style={{ marginBottom: '22px' }}>
            <div className="table-toolbar" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Users size={16} color="var(--primary-600)" />
                <strong style={{ fontSize: '14.5px' }}>Detected Employees ({preview.employees?.length || 0})</strong>
              </div>
              <span className="badge badge-info" style={{ fontSize: '11px' }}>
                Individual reports will be generated
              </span>
            </div>

            <div className="responsive-table-view">
              <div className="table-responsive" style={{ maxHeight: '320px', overflowY: 'auto' }}>
                <table className="data-table" style={{ fontSize: '12.5px' }}>
                  <thead>
                    <tr>
                      <th style={{ width: '130px' }}>Employee ID</th>
                      <th>Staff Name</th>
                      <th>Worksheet Source</th>
                      <th style={{ textAlign: 'right', width: '130px' }}>Records Found</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.employees.map((emp) => (
                      <tr key={emp.employeeId}>
                        <td>
                          <span className="badge badge-neutral" style={{ fontWeight: 700, fontSize: '12px' }}>
                            {emp.employeeId}
                          </span>
                        </td>
                        <td>
                          <strong>{emp.employeeName}</strong>
                        </td>
                        <td>
                          <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>{emp.sheetName}</span>
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: 600 }}>
                          {emp.recordCount} rows
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Available Columns Badges */}
          <div className="table-card" style={{ padding: '18px 22px', marginBottom: '22px' }}>
            <strong style={{ display: 'block', fontSize: '13.5px', marginBottom: '10px' }}>
              Available Sheet Columns ({preview.allColumns?.length || 0}):
            </strong>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {preview.allColumns.map((col, idx) => (
                <span
                  key={idx}
                  className="badge badge-neutral"
                  style={{ fontSize: '11.5px', padding: '4px 10px', background: '#f1f5f9', color: '#1e293b' }}
                >
                  {col.label}
                </span>
              ))}
            </div>
          </div>

          {/* Action Confirmation Bar */}
          <div style={{ background: '#ffffff', padding: '18px 24px', borderRadius: '12px', border: '1px solid var(--border-subtle)', boxShadow: '0 4px 16px rgba(0,0,0,0.06)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '14px' }}>
            <div>
              <strong style={{ fontSize: '14.5px', display: 'block' }}>Ready to Confirm Import?</strong>
              <span style={{ fontSize: '12.5px', color: 'var(--text-muted)' }}>
                This will save <strong>{preview.totalRecords} records</strong> across <strong>{preview.totalEmployees} employee reports</strong> for <strong>{customMonth || preview.reportMonth}</strong>.
              </span>
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={handleReset}
                disabled={confirming}
              >
                Cancel
              </button>

              <button
                type="button"
                className="btn btn-primary"
                onClick={handleConfirmImport}
                disabled={confirming}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '9px 20px', fontWeight: 700 }}
              >
                {confirming ? (
                  <>
                    <RefreshCw size={16} className="spin" />
                    <span>Saving Records to Database...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 size={16} />
                    <span>Confirm &amp; Save Import</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ==========================================
          STEP 3: SUCCESS RESULT
          ========================================== */}
      {step === 'success' && result && (
        <div style={{ maxWidth: '600px', margin: '30px auto', textAlign: 'center' }}>
          <div className="table-card" style={{ padding: '36px 24px' }}>
            <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: '#dcfce7', color: '#16a34a', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: '16px' }}>
              <CheckCircle2 size={36} />
            </div>

            <h2 style={{ fontSize: '22px', fontWeight: 800, margin: '0 0 8px 0' }}>
              Import Completed Successfully!
            </h2>

            <p style={{ fontSize: '13.5px', color: 'var(--text-muted)', margin: '0 0 24px 0', lineHeight: 1.6 }}>
              {result.message}
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px', background: '#f8fafc', padding: '16px', borderRadius: '8px', marginBottom: '24px', textAlign: 'left' }}>
              <div>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Reporting Month</span>
                <strong style={{ display: 'block', fontSize: '15px' }}>{result.monthName}</strong>
              </div>
              <div>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Employees Updated</span>
                <strong style={{ display: 'block', fontSize: '15px' }}>{result.totalEmployees} employees</strong>
              </div>
              <div>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Total Records Saved</span>
                <strong style={{ display: 'block', fontSize: '15px' }}>{result.totalRecords} records</strong>
              </div>
              <div>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Status</span>
                <span className="badge badge-success" style={{ marginTop: '2px' }}>Active in System</span>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'center', gap: '12px' }}>
              <button
                type="button"
                className="btn btn-primary"
                onClick={() => onNavigate && onNavigate('employee-reports', { month: result.reportMonth })}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '9px 18px', fontWeight: 600 }}
              >
                <FileText size={16} />
                <span>Open Employee Reports</span>
              </button>

              <button
                type="button"
                className="btn btn-secondary"
                onClick={handleReset}
              >
                Import Another Month
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
