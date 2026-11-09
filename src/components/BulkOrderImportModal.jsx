// src/components/BulkOrderImportModal.jsx
import React, { useState, useRef } from 'react';
import { api } from '../api';
import {
  FileSpreadsheet,
  UploadCloud,
  Download,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  ArrowRight,
  RefreshCw,
  X,
  FileCheck,
  Info,
  HelpCircle
} from 'lucide-react';

export default function BulkOrderImportModal({ isOpen, onClose, onImportSuccess }) {
  const [step, setStep] = useState('upload'); // 'upload' | 'preview' | 'result'
  const [file, setFile] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [downloadingTemplate, setDownloadingTemplate] = useState(false);
  const [error, setError] = useState('');

  // Preview data
  const [previewData, setPreviewData] = useState(null);
  const [previewFilter, setPreviewFilter] = useState('all'); // 'all' | 'update' | 'no_change' | 'unmatched' | 'invalid'

  // Result data
  const [resultData, setResultData] = useState(null);

  const fileInputRef = useRef(null);

  if (!isOpen) return null;

  function handleReset() {
    setStep('upload');
    setFile(null);
    setError('');
    setPreviewData(null);
    setPreviewFilter('all');
    setResultData(null);
  }

  function handleModalClose() {
    handleReset();
    onClose();
  }

  async function handleDownloadTemplate() {
    try {
      setDownloadingTemplate(true);
      setError('');
      const token = localStorage.getItem('sales_token') || localStorage.getItem('token');
      const response = await fetch('/api/orders/bulk-template', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      if (!response.ok) {
        const errJson = await response.json().catch(() => ({}));
        throw new Error(errJson.error || 'Failed to download template');
      }
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `orders_bulk_update_template_${new Date().toISOString().slice(0, 10)}.xlsx`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      a.remove();
    } catch (err) {
      setError(err.message || 'Failed to download template');
    } finally {
      setDownloadingTemplate(false);
    }
  }

  function handleFileSelect(selectedFile) {
    setError('');
    if (!selectedFile) return;
    if (!selectedFile.name.endsWith('.xlsx')) {
      setError('Please select a valid Excel (.xlsx) file.');
      return;
    }
    setFile(selectedFile);
  }

  function handleDrop(e) {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  }

  async function handleUploadAndPreview() {
    if (!file) {
      setError('Please select an Excel file to upload.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const base64 = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const res = reader.result;
          const base64String = res.includes(',') ? res.split(',')[1] : res;
          resolve(base64String);
        };
        reader.onerror = () => reject(new Error('Failed to read file'));
        reader.readAsDataURL(file);
      });

      const res = await api.post('/orders/bulk-update-preview', {
        fileBase64: base64,
        fileName: file.name
      });

      if (res && res.previewToken) {
        setPreviewData(res);
        setStep('preview');
      } else {
        throw new Error('Invalid preview response received from server.');
      }
    } catch (err) {
      console.error('Bulk update preview error:', err);
      setError(err.message || 'Failed to process Excel file.');
    } finally {
      setLoading(false);
    }
  }

  async function handleConfirmUpdate() {
    if (!previewData || !previewData.previewToken) {
      setError('Preview session expired. Please re-upload your Excel file.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const res = await api.post('/orders/bulk-update-confirm', {
        previewToken: previewData.previewToken
      });

      setResultData(res);
      setStep('result');
      if (onImportSuccess) {
        onImportSuccess();
      }
    } catch (err) {
      console.error('Bulk update confirmation error:', err);
      setError(err.message || 'Failed to apply order updates to database.');
    } finally {
      setLoading(false);
    }
  }

  // Filter preview items
  const filteredPreviewRows = (previewData?.rows || []).filter(item => {
    if (previewFilter === 'all') return true;
    if (previewFilter === 'update') return item.status === 'valid_update';
    if (previewFilter === 'no_change') return item.status === 'no_change';
    if (previewFilter === 'unmatched') return item.status === 'unmatched';
    if (previewFilter === 'invalid') return item.status === 'invalid';
    return true;
  });

  return (
    <div className="modal-overlay" onClick={handleModalClose}>
      <div
        className="modal-dialog large"
        onClick={e => e.stopPropagation()}
        style={{ maxWidth: '960px', maxHeight: '92vh' }}
      >
        {/* Modal Header */}
        <div className="modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '8px',
                background: '#ecfdf5',
                color: '#059669',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <FileSpreadsheet size={20} />
            </div>
            <div>
              <h3 className="modal-title" style={{ fontSize: '17px', margin: 0 }}>
                Bulk Update Staff Orders Through Excel
              </h3>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '2px' }}>
                Brand Manager Dashboard • Fast batch synchronization via .xlsx
              </div>
            </div>
          </div>
          <button type="button" className="modal-close" onClick={handleModalClose}>
            <X size={18} />
          </button>
        </div>

        {/* Modal Body */}
        <div className="modal-body" style={{ padding: '20px 24px', overflowY: 'auto' }}>
          {error && (
            <div
              className="alert alert-danger"
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: '10px',
                padding: '12px 16px',
                marginBottom: '16px',
                borderRadius: 'var(--radius-md)',
                background: '#fef2f2',
                border: '1px solid #fecaca',
                color: '#b91c1c'
              }}
            >
              <AlertTriangle size={18} style={{ flexShrink: 0, marginTop: '2px' }} />
              <div style={{ fontSize: '13px', lineHeight: 1.5 }}>{error}</div>
            </div>
          )}

          {/* STEP 1: UPLOAD */}
          {step === 'upload' && (
            <div>
              {/* Template download card */}
              <div
                style={{
                  background: '#f0fdf4',
                  border: '1px solid #bbf7d0',
                  borderRadius: 'var(--radius-md)',
                  padding: '14px 18px',
                  marginBottom: '20px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '16px',
                  flexWrap: 'wrap'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div
                    style={{
                      width: '36px',
                      height: '36px',
                      borderRadius: '8px',
                      background: '#dcfce7',
                      color: '#15803d',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0
                    }}
                  >
                    <Download size={18} />
                  </div>
                  <div>
                    <strong style={{ fontSize: '13.5px', color: '#166534', display: 'block' }}>
                      Download Official Orders Excel Template
                    </strong>
                    <span style={{ fontSize: '12px', color: '#15803d' }}>
                      Pre-populated with existing orders, staff IDs, product codes, and format validation guide.
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  onClick={handleDownloadTemplate}
                  disabled={downloadingTemplate}
                  style={{
                    borderColor: '#16a34a',
                    color: '#16a34a',
                    fontWeight: 600,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    whiteSpace: 'nowrap'
                  }}
                >
                  {downloadingTemplate ? (
                    <>
                      <RefreshCw size={14} className="spin" /> Generating...
                    </>
                  ) : (
                    <>
                      <Download size={14} /> Download Template (.xlsx)
                    </>
                  )}
                </button>
              </div>

              {/* Drag and drop upload zone */}
              <div
                onDragOver={e => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                style={{
                  border: `2px dashed ${isDragging ? 'var(--primary-600)' : file ? '#10b981' : 'var(--border-subtle)'}`,
                  background: isDragging ? '#eff6ff' : file ? '#f0fdf4' : '#fafafa',
                  borderRadius: 'var(--radius-lg)',
                  padding: '36px 20px',
                  textAlign: 'center',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  marginBottom: '16px'
                }}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx"
                  style={{ display: 'none' }}
                  onChange={e => handleFileSelect(e.target.files?.[0])}
                />

                <div
                  style={{
                    width: '52px',
                    height: '52px',
                    borderRadius: '50%',
                    background: file ? '#dcfce7' : 'var(--primary-50)',
                    color: file ? '#16a34a' : 'var(--primary-600)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginBottom: '12px'
                  }}
                >
                  {file ? <FileCheck size={28} /> : <UploadCloud size={28} />}
                </div>

                {file ? (
                  <div>
                    <strong style={{ fontSize: '15px', color: 'var(--text-main)', display: 'block' }}>
                      {file.name}
                    </strong>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
                      {(file.size / 1024).toFixed(1)} KB • Ready to inspect and preview
                    </div>
                    <div style={{ marginTop: '10px' }}>
                      <span className="badge badge-success" style={{ fontSize: '11.5px' }}>
                        Excel File Selected
                      </span>
                    </div>
                  </div>
                ) : (
                  <div>
                    <strong style={{ fontSize: '14.5px', color: 'var(--text-main)', display: 'block' }}>
                      Click to browse or drag and drop your Excel file here
                    </strong>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
                      Only Microsoft Excel (.xlsx) files are supported
                    </div>
                  </div>
                )}
              </div>

              {/* Rules summary banner */}
              <div
                style={{
                  background: 'var(--bg-subtle, #f8fafc)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-md)',
                  padding: '14px 16px',
                  fontSize: '12.5px',
                  color: 'var(--text-secondary)'
                }}
              >
                <div style={{ fontWeight: 700, color: 'var(--text-main)', marginBottom: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <HelpCircle size={14} color="var(--primary-600)" />
                  How Excel Order Updates Work:
                </div>
                <ul style={{ margin: 0, paddingLeft: '18px', lineHeight: 1.6 }}>
                  <li>Orders are matched using their unique <strong>Order ID</strong> (e.g. <code>ORD-20261102-0001</code>).</li>
                  <li>Staff ownership is strictly validated with <strong>Staff ID</strong> (e.g. <code>STF-001</code>) to prevent accidental cross-staff modifications.</li>
                  <li>No duplicate orders are created; unmatched records are flagged for review.</li>
                  <li>Total amounts and incentives are automatically recalculated using existing business rules.</li>
                  <li>SHA-256 fingerprinting prevents accidental duplicate imports of the same file twice.</li>
                </ul>
              </div>
            </div>
          )}

          {/* STEP 2: PREVIEW */}
          {step === 'preview' && previewData && (
            <div>
              {/* Duplicate Warning Alert if applicable */}
              {previewData.isDuplicate && (
                <div
                  style={{
                    background: '#fffbeb',
                    border: '1px solid #fde68a',
                    borderRadius: 'var(--radius-md)',
                    padding: '12px 16px',
                    marginBottom: '16px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '12px',
                    color: '#92400e'
                  }}
                >
                  <AlertTriangle size={20} style={{ flexShrink: 0 }} />
                  <div style={{ fontSize: '12.5px', lineHeight: 1.5 }}>
                    <strong>Notice: Duplicate File Detected.</strong> This exact file (or identical content) was previously imported on{' '}
                    {new Date(previewData.previousImport.created_at).toLocaleString()}. You can still re-apply updates if intended.
                  </div>
                </div>
              )}

              {/* KPI Summary Cards */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
                  gap: '10px',
                  marginBottom: '16px'
                }}
              >
                <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '10px 12px' }}>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>Total Rows</div>
                  <div style={{ fontSize: '20px', fontWeight: 800, color: 'var(--text-main)', marginTop: '2px' }}>
                    {previewData.totalRows ?? 0}
                  </div>
                </div>

                <div style={{ background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: '8px', padding: '10px 12px' }}>
                  <div style={{ fontSize: '11px', color: '#047857', fontWeight: 600 }}>Matched Orders</div>
                  <div style={{ fontSize: '20px', fontWeight: 800, color: '#065f46', marginTop: '2px' }}>
                    {previewData.matchedCount ?? 0}
                  </div>
                </div>

                <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '8px', padding: '10px 12px' }}>
                  <div style={{ fontSize: '11px', color: '#1d4ed8', fontWeight: 600 }}>To Be Updated</div>
                  <div style={{ fontSize: '20px', fontWeight: 800, color: '#1e40af', marginTop: '2px' }}>
                    {previewData.toUpdateCount ?? 0}
                  </div>
                </div>

                <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '10px 12px' }}>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600 }}>No Changes</div>
                  <div style={{ fontSize: '20px', fontWeight: 800, color: 'var(--text-muted)', marginTop: '2px' }}>
                    {previewData.unchangedCount ?? 0}
                  </div>
                </div>

                <div style={{ background: '#fef3c7', border: '1px solid #fde68a', borderRadius: '8px', padding: '10px 12px' }}>
                  <div style={{ fontSize: '11px', color: '#b45309', fontWeight: 600 }}>Unmatched</div>
                  <div style={{ fontSize: '20px', fontWeight: 800, color: '#92400e', marginTop: '2px' }}>
                    {previewData.unmatchedCount ?? 0}
                  </div>
                </div>

                <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', padding: '10px 12px' }}>
                  <div style={{ fontSize: '11px', color: '#b91c1c', fontWeight: 600 }}>Invalid Rows</div>
                  <div style={{ fontSize: '20px', fontWeight: 800, color: '#991b1b', marginTop: '2px' }}>
                    {previewData.invalidCount ?? 0}
                  </div>
                </div>
              </div>

              {/* Filter Tabs */}
              <div
                style={{
                  display: 'flex',
                  gap: '6px',
                  borderBottom: '1px solid var(--border-subtle)',
                  paddingBottom: '10px',
                  marginBottom: '14px',
                  flexWrap: 'wrap'
                }}
              >
                {[
                  { id: 'all', label: `All Rows (${previewData.rows?.length || 0})` },
                  { id: 'update', label: `To Update (${previewData.toUpdateCount ?? 0})` },
                  { id: 'no_change', label: `No Changes (${previewData.unchangedCount ?? 0})` },
                  { id: 'unmatched', label: `Unmatched (${previewData.unmatchedCount ?? 0})` },
                  { id: 'invalid', label: `Invalid (${previewData.invalidCount ?? 0})` }
                ].map(tab => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setPreviewFilter(tab.id)}
                    style={{
                      padding: '5px 12px',
                      fontSize: '12px',
                      fontWeight: previewFilter === tab.id ? 700 : 500,
                      borderRadius: 'var(--radius-sm)',
                      border: '1px solid',
                      borderColor: previewFilter === tab.id ? 'var(--primary-600)' : 'var(--border-subtle)',
                      background: previewFilter === tab.id ? 'var(--primary-50)' : '#ffffff',
                      color: previewFilter === tab.id ? 'var(--primary-700)' : 'var(--text-secondary)',
                      cursor: 'pointer'
                    }}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              {/* Preview Table */}
              <div
                style={{
                  maxHeight: '340px',
                  overflowY: 'auto',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-md)'
                }}
              >
                <table className="data-table" style={{ fontSize: '12px', margin: 0 }}>
                  <thead style={{ position: 'sticky', top: 0, zIndex: 2 }}>
                    <tr>
                      <th style={{ width: '50px' }}>Row</th>
                      <th>Order ID</th>
                      <th>Staff</th>
                      <th>Product</th>
                      <th>Quantity</th>
                      <th>Payment</th>
                      <th>Order Total</th>
                      <th>Incentive</th>
                      <th>Review Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredPreviewRows.length === 0 ? (
                      <tr>
                        <td colSpan="9" style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>
                          No records match the selected filter.
                        </td>
                      </tr>
                    ) : (
                      filteredPreviewRows.map((row, idx) => {
                        const isUpdate = row.status === 'valid_update';
                        const isNoChange = row.status === 'no_change';
                        const isUnmatched = row.status === 'unmatched';
                        const isInvalid = row.status === 'invalid';

                        const orderNum = row.excelData?.orderNumber || row.currentOrder?.orderNumber;
                        const staffCode = row.currentOrder?.staffCode || row.excelData?.staffId;
                        const staffName = row.currentOrder?.staffName;
                        const prodName = row.newValues?.productName || row.currentOrder?.productName || row.excelData?.productCode;

                        const curQty = row.currentOrder?.quantity;
                        const newQty = row.newValues?.quantity;
                        const qtyChanged = curQty !== undefined && newQty !== undefined && curQty !== newQty;

                        const curPay = row.currentOrder?.paymentMethod;
                        const newPay = row.newValues?.paymentMethod;
                        const payChanged = curPay && newPay && curPay !== newPay;

                        const curTotal = row.currentOrder?.totalAmount;
                        const newTotal = row.newValues?.totalAmount;
                        const totalChanged = curTotal !== undefined && newTotal !== undefined && curTotal !== newTotal;

                        const curInc = row.currentOrder?.incentiveAmount;
                        const newInc = row.newValues?.incentiveAmount;
                        const incChanged = curInc !== undefined && newInc !== undefined && curInc !== newInc;

                        return (
                          <tr
                            key={idx}
                            style={{
                              background: isUpdate ? '#f0fdf4' : isInvalid ? '#fef2f2' : isUnmatched ? '#fffbeb' : '#ffffff'
                            }}
                          >
                            <td style={{ fontWeight: 600 }}>#{row.rowNumber}</td>
                            <td>
                              <strong style={{ fontFamily: 'monospace', color: 'var(--primary-700)' }}>
                                {orderNum || '-'}
                              </strong>
                            </td>
                            <td>
                              {staffName ? (
                                <div>
                                  <div style={{ fontWeight: 600 }}>{staffName}</div>
                                  <div style={{ fontSize: '10.5px', color: 'var(--text-muted)' }}>{staffCode}</div>
                                </div>
                              ) : (
                                <span style={{ color: 'var(--text-muted)' }}>{staffCode || '-'}</span>
                              )}
                            </td>
                            <td>
                              <div>
                                <div style={{ fontWeight: 600 }}>{prodName}</div>
                                {row.newValues?.productCode && row.currentOrder?.productCode && row.newValues.productCode !== row.currentOrder.productCode && (
                                  <div style={{ fontSize: '10.5px', color: '#16a34a' }}>
                                    Changed from: {row.currentOrder.productName}
                                  </div>
                                )}
                              </div>
                            </td>
                            <td>
                              {qtyChanged ? (
                                <div>
                                  <span style={{ textDecoration: 'line-through', color: 'var(--text-muted)', marginRight: '4px' }}>
                                    {curQty}
                                  </span>
                                  <strong style={{ color: '#16a34a' }}>{newQty}</strong>
                                </div>
                              ) : (
                                <span>{newQty ?? curQty ?? row.excelData?.quantity ?? '-'}</span>
                              )}
                            </td>
                            <td>
                              {payChanged ? (
                                <div>
                                  <span style={{ textDecoration: 'line-through', color: 'var(--text-muted)', fontSize: '10.5px' }}>
                                    {curPay}
                                  </span>
                                  <span className="badge badge-success" style={{ marginLeft: '4px', fontSize: '10.5px' }}>
                                    {newPay}
                                  </span>
                                </div>
                              ) : (
                                <span>{newPay || curPay || row.excelData?.paymentMethod || '-'}</span>
                              )}
                            </td>
                            <td>
                              {totalChanged ? (
                                <div>
                                  <div style={{ fontSize: '10.5px', textDecoration: 'line-through', color: 'var(--text-muted)' }}>
                                    ₹{curTotal?.toLocaleString()}
                                  </div>
                                  <strong style={{ color: '#16a34a' }}>
                                    ₹{newTotal?.toLocaleString()}
                                  </strong>
                                </div>
                              ) : (
                                <span>{newTotal ? `₹${newTotal.toLocaleString()}` : curTotal ? `₹${curTotal.toLocaleString()}` : '-'}</span>
                              )}
                            </td>
                            <td>
                              {incChanged ? (
                                <div>
                                  <div style={{ fontSize: '10.5px', textDecoration: 'line-through', color: 'var(--text-muted)' }}>
                                    ₹{curInc}
                                  </div>
                                  <strong style={{ color: 'var(--warning-text)' }}>
                                    ₹{newInc}
                                  </strong>
                                </div>
                              ) : (
                                <span>{newInc !== undefined ? `₹${newInc}` : curInc !== undefined ? `₹${curInc}` : '-'}</span>
                              )}
                            </td>
                            <td>
                              {isUpdate && (
                                <div>
                                  <span className="badge badge-success" style={{ fontSize: '11px', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                                    <CheckCircle2 size={12} /> Will Update
                                  </span>
                                  {row.changes && row.changes.length > 0 && (
                                    <div style={{ fontSize: '10px', color: '#15803d', marginTop: '2px' }}>
                                      {row.changes.map(c => c.field).join(', ')}
                                    </div>
                                  )}
                                </div>
                              )}
                              {isNoChange && (
                                <span className="badge badge-neutral" style={{ fontSize: '11px' }}>
                                  No Changes
                                </span>
                              )}
                              {isUnmatched && (
                                <div>
                                  <span className="badge badge-warning" style={{ fontSize: '11px', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                                    <AlertTriangle size={12} /> Unmatched
                                  </span>
                                  <div style={{ fontSize: '10.5px', color: '#92400e', marginTop: '2px' }}>
                                    {row.error}
                                  </div>
                                </div>
                              )}
                              {isInvalid && (
                                <div>
                                  <span className="badge badge-danger" style={{ fontSize: '11px', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                                    <XCircle size={12} /> Invalid
                                  </span>
                                  <div style={{ fontSize: '10.5px', color: '#b91c1c', marginTop: '2px' }}>
                                    {row.error}
                                  </div>
                                </div>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* STEP 3: RESULT */}
          {step === 'result' && resultData && (
            <div style={{ textAlign: 'center', padding: '16px 8px' }}>
              <div
                style={{
                  width: '64px',
                  height: '64px',
                  borderRadius: '50%',
                  background: '#dcfce7',
                  color: '#16a34a',
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: '16px'
                }}
              >
                <CheckCircle2 size={36} />
              </div>

              <h3 style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-main)', margin: '0 0 6px 0' }}>
                Bulk Order Updates Successfully Applied!
              </h3>
              <div style={{ fontSize: '13.5px', color: 'var(--text-secondary)', maxWidth: '480px', margin: '0 auto 20px auto' }}>
                {resultData.message || `Successfully updated ${resultData.updatedCount} orders in the database.`}
              </div>

              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '20px',
                  background: '#f8fafc',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-md)',
                  padding: '12px 24px',
                  marginBottom: '20px'
                }}
              >
                <div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Updated Orders</div>
                  <strong style={{ fontSize: '20px', color: '#16a34a' }}>{resultData.updatedCount}</strong>
                </div>
                <div style={{ width: '1px', height: '28px', background: 'var(--border-subtle)' }} />
                <div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Failed / Errors</div>
                  <strong style={{ fontSize: '20px', color: resultData.errors?.length > 0 ? '#dc2626' : 'var(--text-muted)' }}>
                    {resultData.errors?.length || 0}
                  </strong>
                </div>
              </div>

              {resultData.errors && resultData.errors.length > 0 && (
                <div style={{ textAlign: 'left', marginTop: '16px' }}>
                  <div style={{ fontWeight: 700, fontSize: '13px', color: '#dc2626', marginBottom: '8px' }}>
                    Failed Row Details ({resultData.errors.length}):
                  </div>
                  <div style={{ maxHeight: '160px', overflowY: 'auto', border: '1px solid #fecaca', borderRadius: '8px', background: '#fef2f2', padding: '10px 14px' }}>
                    {resultData.errors.map((errItem, idx) => (
                      <div key={idx} style={{ fontSize: '12px', color: '#991b1b', marginBottom: '4px' }}>
                        Row #{errItem.rowNumber} (Order: {errItem.orderNumber}): {errItem.reason}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="modal-footer" style={{ padding: '14px 24px', borderTop: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          {step === 'upload' && (
            <>
              <button type="button" className="btn btn-secondary" onClick={handleModalClose}>
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleUploadAndPreview}
                disabled={!file || loading}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
              >
                {loading ? (
                  <>
                    <RefreshCw size={14} className="spin" /> Inspecting Excel...
                  </>
                ) : (
                  <>
                    <span>Inspect & Preview</span>
                    <ArrowRight size={14} />
                  </>
                )}
              </button>
            </>
          )}

          {step === 'preview' && (
            <>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setStep('upload')}
                disabled={loading}
              >
                Back to Upload
              </button>
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                  {previewData?.toUpdateCount || 0} order(s) will be modified
                </span>
                <button
                  type="button"
                  className="btn btn-success"
                  onClick={handleConfirmUpdate}
                  disabled={loading || (previewData?.toUpdateCount === 0)}
                  style={{
                    background: '#16a34a',
                    borderColor: '#16a34a',
                    color: '#ffffff',
                    fontWeight: 700,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                >
                  {loading ? (
                    <>
                      <RefreshCw size={14} className="spin" /> Updating Database...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 size={15} /> Confirm & Apply Updates
                    </>
                  )}
                </button>
              </div>
            </>
          )}

          {step === 'result' && (
            <div style={{ width: '100%', display: 'flex', justifyContent: 'flex-end' }}>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleModalClose}
                style={{ minWidth: '120px' }}
              >
                Done
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
