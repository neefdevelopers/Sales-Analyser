// src/components/BulkOrderImportModal.jsx
import React, { useState, useEffect, useRef } from 'react';
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
  Layers,
  Users,
  Package,
  Calendar,
  Sparkles,
  Link,
  ChevronDown,
  ChevronUp
} from 'lucide-react';

function isStaffHeader(str) {
  if (!str) return false;
  const s = String(str).toLowerCase().replace(/[^a-z0-9]/g, ' ').replace(/\s+/g, ' ').trim();
  return (
    s === 'employee id' || s === 'staff id' || s === 'emp id' ||
    s === 'employee code' || s === 'staff code' || s === 'emp code' ||
    s === 'empid' || s === 'staffid' || s === 'empcode' || s === 'staffcode' ||
    s === 'employee name' || s === 'staff name' || s === 'emp name' ||
    s === 'employee' || s === 'staff' || s === 'emp' ||
    s === 'sales staff' || s === 'salesperson' || s === 'agent' ||
    s === 'sales staff id' || s === 'sales staff name' ||
    /(?:employee|staff|emp)\s*(?:id|code|no|name)/i.test(s) ||
    /^(?:stf|emp)[-_ ]?\d+$/i.test(s)
  );
}

function detectMonthYearFromFilename(filename) {
  if (!filename) return null;
  const name = filename.toUpperCase();
  const months = {
    'JANUARY': '01', 'JAN': '01',
    'FEBRUARY': '02', 'FEB': '02',
    'MARCH': '03', 'MAR': '03',
    'APRIL': '04', 'APR': '04',
    'MAY': '05',
    'JUNE': '06', 'JUN': '06',
    'JULY': '07', 'JUL': '07',
    'AUGUST': '08', 'AUG': '08',
    'SEPTEMBER': '09', 'SEP': '09',
    'OCTOBER': '10', 'OCT': '10',
    'NOVEMBER': '11', 'NOV': '11',
    'DECEMBER': '12', 'DEC': '12'
  };

  for (const [mName, mNum] of Object.entries(months)) {
    const r1 = new RegExp(`(^|[^A-Z0-9])${mName}[-_ ]?(\\d{4})([^A-Z0-9]|$)`, 'i');
    const m1 = name.match(r1);
    if (m1 && m1[2]) return `${m1[2]}-${mNum}`;
    const r2 = new RegExp(`(^|[^A-Z0-9])(\\d{4})[-_ ]?${mName}([^A-Z0-9]|$)`, 'i');
    const m2 = name.match(r2);
    if (m2 && m2[2]) return `${m2[2]}-${mNum}`;
  }

  const ym = name.match(/(^|[^0-9])(20\d{2})[-_](0[1-9]|1[0-2])([^0-9]|$)/);
  if (ym && ym[2] && ym[3]) return `${ym[2]}-${ym[3]}`;

  const my = name.match(/(^|[^0-9])(0[1-9]|1[0-2])[-_](20\d{2})([^0-9]|$)/);
  if (my && my[2] && my[3]) return `${my[3]}-${my[2]}`;

  return null;
}

export default function BulkOrderImportModal({ isOpen, onClose, onImportSuccess }) {
  const [step, setStep] = useState('upload'); // 'upload' | 'preview' | 'result'
  const [file, setFile] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [downloadingTemplate, setDownloadingTemplate] = useState(false);
  const [error, setError] = useState('');

  // Target report month/year (defaults to current YYYY-MM)
  const [monthYear, setMonthYear] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  });

  // System master data for manual mapping dropdowns
  const [systemStaffList, setSystemStaffList] = useState([]);
  const [systemProductList, setSystemProductList] = useState([]);

  // Manual mappings defined by the user for unmatched entities:
  // staffMappings: { [rawKey]: systemStaffDbId }
  // productMappings: { [rawProductName]: systemProductDbId }
  const [staffMappings, setStaffMappings] = useState({});
  const [productMappings, setProductMappings] = useState({});

  // Preview data
  const [previewData, setPreviewData] = useState(null);
  const [previewViewMode, setPreviewViewMode] = useState('sheet'); // 'sheet' (Dynamic Sheet View) | 'flat' (Order Line Items)
  const [sheetSearch, setSheetSearch] = useState('');
  const [clearingRecords, setClearingRecords] = useState(false);
  const [clearSuccessMsg, setClearSuccessMsg] = useState('');
  const [previewFilter, setPreviewFilter] = useState('all'); // 'all' | 'update' | 'create' | 'no_change' | 'unmatched' | 'invalid'
  const [confirmDuplicate, setConfirmDuplicate] = useState(false);
  const [showLayoutDetails, setShowLayoutDetails] = useState(false);

  // Result data
  const [resultData, setResultData] = useState(null);

  const fileInputRef = useRef(null);

  // Fetch staff and products when modal opens
  useEffect(() => {
    if (isOpen) {
      loadMasterEntities();
    }
  }, [isOpen]);

  async function loadMasterEntities() {
    try {
      const [staffRes, prodRes] = await Promise.all([
        api.get('/staff').catch(() => ({ staff: [] })),
        api.get('/products').catch(() => ({ products: [] }))
      ]);
      setSystemStaffList(staffRes.staff || []);
      setSystemProductList(prodRes.products || []);
    } catch (err) {
      console.error('Failed to load master entities:', err);
    }
  }

  if (!isOpen) return null;

  function handleReset() {
    setStep('upload');
    setFile(null);
    setError('');
    setClearSuccessMsg('');
    setPreviewData(null);
    setPreviewViewMode('sheet');
    setSheetSearch('');
    setPreviewFilter('all');
    setConfirmDuplicate(false);
    setStaffMappings({});
    setProductMappings({});
    setShowLayoutDetails(false);
    setResultData(null);
  }

  async function handleClearAllRecords() {
    if (!window.confirm('Are you sure you want to completely clear ALL orders, returns, and import logs? All sales staff and products will be safely preserved.')) {
      return;
    }
    try {
      setClearingRecords(true);
      setError('');
      setClearSuccessMsg('');
      await api.delete('/orders/clear-all');
      setClearSuccessMsg('All orders, returns, and import history cleared successfully.');
      if (onImportSuccess) {
        onImportSuccess();
      }
    } catch (err) {
      setError(err.message || 'Failed to clear records.');
    } finally {
      setClearingRecords(false);
    }
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
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setError(err.message || 'Failed to download Excel template');
    } finally {
      setDownloadingTemplate(false);
    }
  }

  function handleFileSelected(selectedFile) {
    if (!selectedFile) return;
    const name = selectedFile.name.toLowerCase();
    if (!name.endsWith('.xlsx')) {
      setError('Please upload a valid Excel file (.xlsx format only).');
      return;
    }
    setError('');
    setFile(selectedFile);

    const detected = detectMonthYearFromFilename(selectedFile.name);
    if (detected) {
      setMonthYear(detected);
    }
  }

  function handleDragOver(e) {
    e.preventDefault();
    setIsDragging(true);
  }

  function handleDragLeave(e) {
    e.preventDefault();
    setIsDragging(false);
  }

  function handleDrop(e) {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileSelected(e.dataTransfer.files[0]);
    }
  }

  // Generate / refresh preview with current manual mappings
  async function handleInspectFile(customMappings = null) {
    if (!file) {
      setError('Please select an Excel file to upload.');
      return;
    }
    setLoading(true);
    setError('');

    const activeStaffMappings = customMappings?.staffMappings || staffMappings;
    const activeProductMappings = customMappings?.productMappings || productMappings;

    try {
      const base64 = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const res = reader.result;
          const base64String = typeof res === 'string' && res.includes(',') ? res.split(',')[1] : res;
          resolve(base64String);
        };
        reader.onerror = () => reject(new Error('Failed to read file'));
        reader.readAsDataURL(file);
      });

      const res = await api.post('/orders/bulk-update-preview', {
        fileBase64: base64,
        fileName: file.name,
        monthYear,
        manualMappings: {
          staffMappings: activeStaffMappings,
          productMappings: activeProductMappings
        }
      });
      setPreviewData(res);
      setStep('preview');

      // Pre-fill any newly mapped items in local state
      if (res.summary?.detectedStaff) {
        const sm = { ...activeStaffMappings };
        res.summary.detectedStaff.forEach(s => {
          if (s.matchedStaff && !sm[s.rawId || s.sheetName]) {
            sm[s.rawId || s.sheetName] = String(s.matchedStaff.id);
          }
        });
        setStaffMappings(sm);
      }

      if (res.summary?.detectedProducts) {
        const pm = { ...activeProductMappings };
        res.summary.detectedProducts.forEach(p => {
          if (p.matchedProduct && !pm[p.rawName]) {
            pm[p.rawName] = String(p.matchedProduct.id);
          }
        });
        setProductMappings(pm);
      }
    } catch (err) {
      console.error('Preview error:', err);
      setError(err.message || 'Failed to inspect Excel file. Please verify file structure.');
    } finally {
      setLoading(false);
    }
  }

  function handleStaffMapChange(key, staffDbId) {
    setStaffMappings(prev => ({
      ...prev,
      [key]: staffDbId
    }));
  }

  function handleProductMapChange(rawName, prodDbId) {
    setProductMappings(prev => ({
      ...prev,
      [rawName]: prodDbId
    }));
  }

  async function handleApplyMappingsAndReinspect() {
    await handleInspectFile({ staffMappings, productMappings });
  }

  async function handleConfirmImport() {
    if (!previewData || !previewData.previewToken) {
      setError('Import session expired. Please re-upload the file.');
      return;
    }

    if (previewData.isDuplicate && !confirmDuplicate) {
      setError('Please check the confirmation box to proceed with re-importing this file.');
      return;
    }

    if (!previewData.canConfirm) {
      setError('Cannot proceed: there are unmatched staff members or products that must be mapped.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const res = await api.post('/orders/bulk-update-confirm', {
        previewToken: previewData.previewToken,
        confirmDuplicate
      });
      setResultData(res);
      setStep('result');
      if (onImportSuccess) {
        onImportSuccess(res);
      }
    } catch (err) {
      console.error('Import confirm error:', err);
      setError(err.message || 'Failed to confirm import. Database updates rolled back.');
    } finally {
      setLoading(false);
    }
  }

  // Filter preview rows (Flat line-items)
  const filteredRows = (previewData?.rows || []).filter(r => {
    if (previewFilter === 'all') return true;
    if (previewFilter === 'update') return r.status === 'valid_update';
    if (previewFilter === 'create') return r.status === 'valid_create';
    if (previewFilter === 'no_change') return r.status === 'no_change';
    if (previewFilter === 'unmatched') return r.status === 'unmatched';
    if (previewFilter === 'invalid') return r.status === 'invalid';
    return true;
  });

  // Filter matrix preview rows (Dynamic sheet rows matching Excel sheet)
  const filteredMatrixRows = (previewData?.matrixRows || []).filter(r => {
    if (!sheetSearch.trim()) return true;
    const term = sheetSearch.trim().toLowerCase();
    return (
      (r.employeeId && String(r.employeeId).toLowerCase().includes(term)) ||
      (r.staffName && String(r.staffName).toLowerCase().includes(term)) ||
      (r.date && String(r.date).toLowerCase().includes(term)) ||
      (r.sheetName && String(r.sheetName).toLowerCase().includes(term))
    );
  });

  const matrixProductCols = (previewData?.matrixColumns || []).filter(c => c.type === 'product');
  const matrixReturnCols = (previewData?.matrixColumns || []).filter(c => c.type === 'return');

  const matrixTotals = {
    products: {},
    returns: {},
    grossIncentive: 0,
    returnDeductions: 0,
    netIncentive: 0
  };

  matrixProductCols.forEach(c => { matrixTotals.products[c.key] = 0; });
  matrixReturnCols.forEach(c => { matrixTotals.returns[c.key] = 0; });

  filteredMatrixRows.forEach(r => {
    matrixProductCols.forEach(c => {
      matrixTotals.products[c.key] = (matrixTotals.products[c.key] || 0) + (r.quantities?.[c.key] || 0);
    });
    matrixReturnCols.forEach(c => {
      matrixTotals.returns[c.key] = (matrixTotals.returns[c.key] || 0) + (r.returns?.[c.key] || 0);
    });
    matrixTotals.grossIncentive += (r.grossIncentive || 0);
    matrixTotals.returnDeductions += (r.returnDeductions || 0);
    matrixTotals.netIncentive += (r.netIncentive || 0);
  });

  // Combine all unmatched staff items (including any staff headers that backend might have passed in unmatchedProducts)
  const unmatchedStaffItems = [
    ...(previewData?.summary?.unmatchedStaff || []),
    ...(previewData?.summary?.unmatchedProducts || [])
      .filter(p => isStaffHeader(p.rawName) || isStaffHeader(p.columnHeader))
      .map(p => ({
        rawId: p.rawName || p.columnHeader,
        rawName: p.columnHeader || p.rawName,
        sheetName: 'Column Header',
        isMatched: false
      }))
  ];

  // Truly unmatched products (strictly excluding any staff headers)
  const unmatchedProductItems = (previewData?.summary?.unmatchedProducts || []).filter(
    p => !isStaffHeader(p.rawName) && !isStaffHeader(p.columnHeader)
  );

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.65)',
        backdropFilter: 'blur(3px)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
        animation: 'fadeIn 0.15s ease-out'
      }}
      onClick={e => {
        if (e.target === e.currentTarget && !loading) {
          handleModalClose();
        }
      }}
    >
      <div
        style={{
          backgroundColor: '#ffffff',
          borderRadius: '14px',
          width: '100%',
          maxWidth: step === 'preview' ? '1120px' : '720px',
          maxHeight: '92vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          overflow: 'hidden',
          transition: 'max-width 0.2s ease'
        }}
      >
        {/* Modal Header */}
        <div
          style={{
            padding: '16px 24px',
            borderBottom: '1px solid #e2e8f0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'linear-gradient(to right, #f8fafc, #ffffff)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '10px',
                backgroundColor: '#ecfdf5',
                color: '#059669',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: 'inset 0 0 0 1px rgba(5, 150, 105, 0.2)'
              }}
            >
              <FileSpreadsheet size={22} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 700, color: '#0f172a' }}>
                Bulk Import & Update Staff Orders
              </h3>
              <p style={{ margin: 0, fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
                Multi-sheet workbook support with dynamic staff & product detection
              </p>
            </div>
          </div>
          <button
            onClick={handleModalClose}
            disabled={loading}
            style={{
              background: 'none',
              border: 'none',
              padding: '6px',
              cursor: loading ? 'not-allowed' : 'pointer',
              color: '#94a3b8',
              borderRadius: '6px'
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Modal Body */}
        <div
          style={{
            padding: '20px 24px',
            overflowY: 'auto',
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            gap: '16px'
          }}
        >
          {error && (
            <div
              style={{
                padding: '12px 16px',
                borderRadius: '8px',
                backgroundColor: '#fef2f2',
                border: '1px solid #fecaca',
                color: '#b91c1c',
                fontSize: '13px',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '10px'
              }}
            >
              <AlertTriangle size={18} style={{ flexShrink: 0, marginTop: '2px' }} />
              <div style={{ flex: 1 }}>{error}</div>
            </div>
          )}

          {clearSuccessMsg && (
            <div
              style={{
                padding: '12px 16px',
                borderRadius: '8px',
                backgroundColor: '#ecfdf5',
                border: '1px solid #a7f3d0',
                color: '#065f46',
                fontSize: '13px',
                display: 'flex',
                alignItems: 'center',
                gap: '10px'
              }}
            >
              <CheckCircle2 size={18} color="#059669" style={{ flexShrink: 0 }} />
              <div style={{ flex: 1, fontWeight: 600 }}>{clearSuccessMsg}</div>
            </div>
          )}

          {/* STEP 1: UPLOAD */}
          {step === 'upload' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {/* Report Month / Year Selector */}
              <div
                style={{
                  padding: '14px 18px',
                  backgroundColor: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '10px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '16px',
                  flexWrap: 'wrap'
                }}
              >
                <div>
                  <div style={{ fontWeight: 600, fontSize: '13.5px', color: '#1e293b' }}>
                    Report Month & Year
                  </div>
                  <div style={{ fontSize: '12px', color: '#64748b' }}>
                    Used for monthly day-based sheets (e.g. Day 1–31)
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Calendar size={16} color="#0284c7" />
                  <input
                    type="month"
                    value={monthYear}
                    onChange={e => setMonthYear(e.target.value)}
                    style={{
                      padding: '7px 12px',
                      borderRadius: '6px',
                      border: '1px solid #cbd5e1',
                      fontSize: '13px',
                      fontWeight: 600,
                      color: '#0f172a',
                      backgroundColor: '#ffffff'
                    }}
                  />
                </div>
              </div>

              {/* Drag & Drop Box */}
              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                style={{
                  border: isDragging ? '2px dashed #0284c7' : '2px dashed #cbd5e1',
                  backgroundColor: isDragging ? '#f0f9ff' : '#f8fafc',
                  borderRadius: '12px',
                  padding: '36px 20px',
                  textAlign: 'center',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
              >
                <input
                  type="file"
                  ref={fileInputRef}
                  accept=".xlsx"
                  style={{ display: 'none' }}
                  onChange={e => {
                    if (e.target.files && e.target.files[0]) {
                      handleFileSelected(e.target.files[0]);
                    }
                  }}
                />

                <div
                  style={{
                    width: '52px',
                    height: '52px',
                    borderRadius: '50%',
                    backgroundColor: '#e0f2fe',
                    color: '#0284c7',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: '0 auto 12px'
                  }}
                >
                  <UploadCloud size={28} />
                </div>

                <div style={{ fontSize: '15px', fontWeight: 600, color: '#1e293b' }}>
                  {file ? file.name : 'Click to select or drag and drop your Excel file'}
                </div>
                <div style={{ fontSize: '12px', color: '#64748b', marginTop: '4px' }}>
                  {file
                    ? `${(file.size / 1024).toFixed(1)} KB — Ready to inspect`
                    : 'Supports monthly multi-sheet workbooks (.xlsx format)'}
                </div>
              </div>

              {/* Sample Template & Help Box */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '14px 18px',
                  borderRadius: '10px',
                  backgroundColor: '#f1f5f9',
                  border: '1px solid #e2e8f0',
                  gap: '12px',
                  flexWrap: 'wrap'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <Info size={18} color="#475569" />
                  <span style={{ fontSize: '12.5px', color: '#334155' }}>
                    Need the standard column format? Download our reference template.
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleDownloadTemplate}
                  disabled={downloadingTemplate}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '7px 14px',
                    fontSize: '12.5px',
                    fontWeight: 600,
                    borderRadius: '6px',
                    border: '1px solid #cbd5e1',
                    backgroundColor: '#ffffff',
                    color: '#0f172a',
                    cursor: downloadingTemplate ? 'not-allowed' : 'pointer'
                  }}
                >
                  {downloadingTemplate ? (
                    <RefreshCw size={14} className="animate-spin" />
                  ) : (
                    <Download size={14} />
                  )}
                  {downloadingTemplate ? 'Downloading...' : 'Download Template (.xlsx)'}
                </button>
              </div>

              {/* Dynamic Detection Highlights */}
              <div
                style={{
                  padding: '14px 18px',
                  backgroundColor: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '10px',
                  fontSize: '12px',
                  color: '#475569',
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                  gap: '12px'
                }}
              >
                <div>
                  <strong style={{ color: '#0f172a', display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <Layers size={14} color="#0284c7" /> Dynamic Sheet & Column Detection
                  </strong>
                  <p style={{ margin: '3px 0 0', lineHeight: 1.4 }}>
                    Dynamically detects all product columns (COD & Prepaid) and return columns. Transactional sheets like INCENTIVE are automatically parsed row-by-row matching Employee ID.
                  </p>
                </div>
                <div>
                  <strong style={{ color: '#0f172a', display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <Users size={14} color="#059669" /> Row-Level Employee ID Association
                  </strong>
                  <p style={{ margin: '3px 0 0', lineHeight: 1.4 }}>
                    Reads the Employee ID directly from each row to assign orders and returns to the correct sales staff member.
                  </p>
                </div>
                <div>
                  <strong style={{ color: '#0f172a', display: 'flex', alignItems: 'center', gap: '5px' }}>
                    <Package size={14} color="#d97706" /> Dynamic Returns & Deductions
                  </strong>
                  <p style={{ margin: '3px 0 0', lineHeight: 1.4 }}>
                    Extracts product-specific returns and reverses incentives automatically without manual mapping.
                  </p>
                </div>
              </div>

              {/* Database Clean Reset Action */}
              <div
                style={{
                  padding: '14px 18px',
                  backgroundColor: '#fff1f2',
                  border: '1px solid #fecdd3',
                  borderRadius: '10px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '12px',
                  flexWrap: 'wrap'
                }}
              >
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 700, color: '#9f1239', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <AlertTriangle size={15} color="#e11d48" /> Reset Orders & Returns Database
                  </div>
                  <div style={{ fontSize: '12px', color: '#be123c', marginTop: '2px' }}>
                    Completely clear all existing orders, returns, and import history for a clean re-import. All staff users and products remain preserved.
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleClearAllRecords}
                  disabled={clearingRecords}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '8px 16px',
                    fontSize: '12.5px',
                    fontWeight: 700,
                    borderRadius: '7px',
                    border: '1px solid #f43f5e',
                    backgroundColor: '#ffffff',
                    color: '#e11d48',
                    cursor: clearingRecords ? 'not-allowed' : 'pointer',
                    boxShadow: '0 1px 2px rgba(225, 29, 72, 0.05)'
                  }}
                >
                  <RefreshCw size={14} className={clearingRecords ? 'animate-spin' : ''} />
                  {clearingRecords ? 'Clearing Database...' : 'Clear All Orders & Returns'}
                </button>
              </div>
            </div>
          )}

          {/* STEP 2: PREVIEW & MAPPING */}
          {step === 'preview' && previewData && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* Duplicate Warning */}
              {previewData.isDuplicate && (
                <div
                  style={{
                    padding: '12px 16px',
                    borderRadius: '8px',
                    backgroundColor: '#fffbeb',
                    border: '1px solid #fde68a',
                    color: '#92400e',
                    fontSize: '13px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600 }}>
                    <AlertTriangle size={18} />
                    Warning: This file was already imported previously!
                  </div>
                  <div style={{ fontSize: '12px' }}>
                    Previously imported on {new Date(previewData.duplicateInfo?.importedAt).toLocaleString()} (Updated:{' '}
                    {previewData.duplicateInfo?.updatedCount} orders). Importing again will overwrite existing values.
                  </div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontWeight: 600 }}>
                    <input
                      type="checkbox"
                      checked={confirmDuplicate}
                      onChange={e => setConfirmDuplicate(e.target.checked)}
                    />
                    I understand and want to re-import this file anyway.
                  </label>
                </div>
              )}

              {/* Skipped Summary Sheets Notice */}
              {previewData.summary?.skippedSheets?.length > 0 && (
                <div
                  style={{
                    padding: '10px 14px',
                    borderRadius: '8px',
                    backgroundColor: '#f1f5f9',
                    border: '1px solid #cbd5e1',
                    fontSize: '12.5px',
                    color: '#334155',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}
                >
                  <Info size={16} color="#0284c7" style={{ flexShrink: 0 }} />
                  <div>
                    <strong>Summary sheets skipped to avoid duplication:</strong>{' '}
                    {previewData.summary.skippedSheets.map(s => s.name).join(', ')}.
                  </div>
                </div>
              )}

              {/* Dynamic Worksheet Columns & Subcolumns Detection Panel */}
              {previewData.sheetLayouts?.length > 0 && (
                <div
                  style={{
                    borderRadius: '10px',
                    border: '1px solid #e2e8f0',
                    backgroundColor: '#ffffff',
                    overflow: 'hidden'
                  }}
                >
                  <div
                    onClick={() => setShowLayoutDetails(!showLayoutDetails)}
                    style={{
                      padding: '10px 14px',
                      backgroundColor: '#f8fafc',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      cursor: 'pointer',
                      userSelect: 'none'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', fontWeight: 600, color: '#334155' }}>
                      <Layers size={16} color="#0284c7" />
                      Dynamic Sheet Columns & Subcolumns ({previewData.sheetLayouts.length} sheets analyzed)
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#64748b' }}>
                      <span>{showLayoutDetails ? 'Hide Column Mapping' : 'View Detected Columns & Subcolumns'}</span>
                      {showLayoutDetails ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </div>
                  </div>

                  {showLayoutDetails && (
                    <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '240px', overflowY: 'auto' }}>
                      {previewData.sheetLayouts.map((sl, idx) => (
                        <div
                          key={idx}
                          style={{
                            padding: '10px 12px',
                            borderRadius: '8px',
                            backgroundColor: '#f8fafc',
                            border: '1px solid #e2e8f0',
                            fontSize: '12px',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '6px'
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '6px' }}>
                            <span style={{ fontWeight: 700, color: '#0f172a' }}>{sl.sheetName}</span>
                            <span style={{ fontSize: '11px', color: '#64748b' }}>
                              Staff: <strong style={{ color: sl.isStaffMatched ? '#047857' : '#c2410c' }}>{sl.staff ? `${sl.staff.name} (${sl.staff.staff_id})` : (sl.rawStaffId || 'Unmatched')}</strong>
                              {sl.dateCol && ` • Date Col: C${sl.dateCol}`}
                              {sl.staffCol && ` • Employee ID Col: C${sl.staffCol}`}
                            </span>
                          </div>

                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '2px' }}>
                            {sl.productColumns?.map((p, pIdx) => (
                              <span
                                key={pIdx}
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  padding: '2px 8px',
                                  borderRadius: '4px',
                                  backgroundColor: p.isMatched ? '#ecfdf5' : '#fff7ed',
                                  border: `1px solid ${p.isMatched ? '#a7f3d0' : '#fed7aa'}`,
                                  color: p.isMatched ? '#065f46' : '#9a3412',
                                  fontSize: '11px'
                                }}
                              >
                                <strong>Col {p.colIndex}:</strong> {p.productName} ({p.paymentMethod})
                                {p.matchedProduct?.name && (
                                  <span style={{ opacity: 0.85, fontWeight: 600 }}>&rarr; {p.matchedProduct.name}</span>
                                )}
                              </span>
                            ))}

                            {sl.returnColumns?.map((r, rIdx) => (
                              <span
                                key={rIdx}
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  gap: '4px',
                                  padding: '2px 8px',
                                  borderRadius: '4px',
                                  backgroundColor: '#fff1f2',
                                  border: '1px solid #fecdd3',
                                  color: '#9f1239',
                                  fontSize: '11px'
                                }}
                              >
                                <strong>Col {r.colIndex} (Return):</strong> {r.target}
                                {r.matchedProduct?.name && (
                                  <span style={{ opacity: 0.85, fontWeight: 600 }}>&rarr; {r.matchedProduct.name}</span>
                                )}
                              </span>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* UNMATCHED STAFF PANEL */}
              {unmatchedStaffItems.length > 0 && (
                <div
                  style={{
                    padding: '16px',
                    borderRadius: '10px',
                    backgroundColor: '#fff7ed',
                    border: '1px solid #fdba74',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700, color: '#c2410c' }}>
                      <AlertTriangle size={18} />
                      Unmatched Sales Staff / Employee IDs ({unmatchedStaffItems.length})
                    </div>
                    <span style={{ fontSize: '12px', color: '#9a3412' }}>
                      Match with an existing staff member (Staff ID / Name)
                    </span>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '10px' }}>
                    {unmatchedStaffItems.map((stf, idx) => {
                      const key = stf.rawId || stf.sheetName;
                      return (
                        <div
                          key={idx}
                          style={{
                            padding: '10px 12px',
                            backgroundColor: '#ffffff',
                            borderRadius: '8px',
                            border: '1px solid #fed7aa',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '6px'
                          }}
                        >
                          <div style={{ fontSize: '12.5px', color: '#1e293b' }}>
                            Employee ID: <strong style={{ color: '#c2410c', fontFamily: 'monospace' }}>{stf.rawId || stf.sheetName}</strong>
                            {stf.sheetName && stf.rawId && (
                              <span style={{ fontSize: '11px', color: '#64748b', marginLeft: '6px' }}>({stf.sheetName})</span>
                            )}
                          </div>
                          <select
                            value={staffMappings[key] || ''}
                            onChange={e => handleStaffMapChange(key, e.target.value)}
                            style={{
                              padding: '7px 10px',
                              borderRadius: '6px',
                              border: '1px solid #cbd5e1',
                              fontSize: '12.5px',
                              fontWeight: 600,
                              backgroundColor: '#ffffff',
                              color: '#0f172a'
                            }}
                          >
                            <option value="">-- Match with Staff ID / Staff Member --</option>
                            {systemStaffList.map(s => (
                              <option key={s.id} value={s.id}>
                                {s.name} ({s.staff_id})
                              </option>
                            ))}
                          </select>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* UNMATCHED PRODUCTS PANEL */}
              {unmatchedProductItems.length > 0 && (
                <div
                  style={{
                    padding: '16px',
                    borderRadius: '10px',
                    backgroundColor: '#fff7ed',
                    border: '1px solid #fdba74',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '12px'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700, color: '#c2410c' }}>
                      <AlertTriangle size={18} />
                      Unmatched Product Headers ({unmatchedProductItems.length})
                    </div>
                    <span style={{ fontSize: '12px', color: '#9a3412' }}>
                      Map detected Excel product columns to existing Product records
                    </span>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '10px' }}>
                    {unmatchedProductItems.map((p, idx) => (
                      <div
                        key={idx}
                        style={{
                          padding: '10px 12px',
                          backgroundColor: '#ffffff',
                          borderRadius: '8px',
                          border: '1px solid #fed7aa',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '6px'
                        }}
                      >
                        <div style={{ fontSize: '12px', color: '#475569' }}>
                          Header: <strong>{p.columnHeader || p.rawName}</strong>
                        </div>
                        <select
                          value={productMappings[p.rawName] || ''}
                          onChange={e => handleProductMapChange(p.rawName, e.target.value)}
                          style={{
                            padding: '6px 10px',
                            borderRadius: '6px',
                            border: '1px solid #cbd5e1',
                            fontSize: '12.5px',
                            fontWeight: 500,
                            backgroundColor: '#ffffff',
                            color: '#0f172a'
                          }}
                        >
                          <option value="">-- Map to Existing Product --</option>
                          {systemProductList.map(prod => (
                            <option key={prod.id} value={prod.id}>
                              {prod.name} ({prod.code}) &bull; ₹{prod.price}
                            </option>
                          ))}
                        </select>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Re-Inspect / Apply Mappings Button (when mappings exist) */}
              {(unmatchedStaffItems.length > 0 || unmatchedProductItems.length > 0) && (
                <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                  <button
                    type="button"
                    onClick={handleApplyMappingsAndReinspect}
                    disabled={loading}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '8px 16px',
                      borderRadius: '8px',
                      backgroundColor: '#ea580c',
                      color: '#ffffff',
                      border: 'none',
                      fontSize: '13px',
                      fontWeight: 600,
                      cursor: loading ? 'not-allowed' : 'pointer'
                    }}
                  >
                    <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
                    Apply Mappings & Re-inspect
                  </button>
                </div>
              )}

              {/* KPI Summary Cards */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
                  gap: '10px'
                }}
              >
                <div
                  style={{
                    padding: '12px',
                    borderRadius: '8px',
                    backgroundColor: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    textAlign: 'center'
                  }}
                >
                  <div style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', fontWeight: 600 }}>
                    Total Rows
                  </div>
                  <div style={{ fontSize: '20px', fontWeight: 700, color: '#0f172a', marginTop: '2px' }}>
                    {previewData.summary?.totalRows || 0}
                  </div>
                </div>

                <div
                  style={{
                    padding: '12px',
                    borderRadius: '8px',
                    backgroundColor: '#eff6ff',
                    border: '1px solid #bfdbfe',
                    textAlign: 'center'
                  }}
                >
                  <div style={{ fontSize: '11px', color: '#1d4ed8', textTransform: 'uppercase', fontWeight: 600 }}>
                    To Update
                  </div>
                  <div style={{ fontSize: '20px', fontWeight: 700, color: '#1d4ed8', marginTop: '2px' }}>
                    {previewData.summary?.toUpdate || 0}
                  </div>
                </div>

                <div
                  style={{
                    padding: '12px',
                    borderRadius: '8px',
                    backgroundColor: '#ecfdf5',
                    border: '1px solid #a7f3d0',
                    textAlign: 'center'
                  }}
                >
                  <div style={{ fontSize: '11px', color: '#047857', textTransform: 'uppercase', fontWeight: 600 }}>
                    To Create
                  </div>
                  <div style={{ fontSize: '20px', fontWeight: 700, color: '#047857', marginTop: '2px' }}>
                    {previewData.summary?.toCreate || 0}
                  </div>
                </div>

                <div
                  style={{
                    padding: '12px',
                    borderRadius: '8px',
                    backgroundColor: '#fff1f2',
                    border: '1px solid #fecdd3',
                    textAlign: 'center'
                  }}
                >
                  <div style={{ fontSize: '11px', color: '#be123c', textTransform: 'uppercase', fontWeight: 600 }}>
                    Returns
                  </div>
                  <div style={{ fontSize: '20px', fontWeight: 700, color: '#be123c', marginTop: '2px' }}>
                    {previewData.summary?.totalReturns || 0}
                  </div>
                </div>

                <div
                  style={{
                    padding: '12px',
                    borderRadius: '8px',
                    backgroundColor: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    textAlign: 'center'
                  }}
                >
                  <div style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase', fontWeight: 600 }}>
                    No Change
                  </div>
                  <div style={{ fontSize: '20px', fontWeight: 700, color: '#475569', marginTop: '2px' }}>
                    {previewData.summary?.noChange || 0}
                  </div>
                </div>

                <div
                  style={{
                    padding: '12px',
                    borderRadius: '8px',
                    backgroundColor: previewData.summary?.unmatched > 0 ? '#fff7ed' : '#f8fafc',
                    border: `1px solid ${previewData.summary?.unmatched > 0 ? '#fed7aa' : '#e2e8f0'}`,
                    textAlign: 'center'
                  }}
                >
                  <div
                    style={{
                      fontSize: '11px',
                      color: previewData.summary?.unmatched > 0 ? '#c2410c' : '#64748b',
                      textTransform: 'uppercase',
                      fontWeight: 600
                    }}
                  >
                    Unmatched
                  </div>
                  <div
                    style={{
                      fontSize: '20px',
                      fontWeight: 700,
                      color: previewData.summary?.unmatched > 0 ? '#c2410c' : '#475569',
                      marginTop: '2px'
                    }}
                  >
                    {previewData.summary?.unmatched || 0}
                  </div>
                </div>

                <div
                  style={{
                    padding: '12px',
                    borderRadius: '8px',
                    backgroundColor: previewData.summary?.invalid > 0 ? '#fef2f2' : '#f8fafc',
                    border: `1px solid ${previewData.summary?.invalid > 0 ? '#fecaca' : '#e2e8f0'}`,
                    textAlign: 'center'
                  }}
                >
                  <div
                    style={{
                      fontSize: '11px',
                      color: previewData.summary?.invalid > 0 ? '#b91c1c' : '#64748b',
                      textTransform: 'uppercase',
                      fontWeight: 600
                    }}
                  >
                    Invalid
                  </div>
                  <div
                    style={{
                      fontSize: '20px',
                      fontWeight: 700,
                      color: previewData.summary?.invalid > 0 ? '#b91c1c' : '#475569',
                      marginTop: '2px'
                    }}
                  >
                    {previewData.summary?.invalid || 0}
                  </div>
                </div>
              </div>

              {/* Preview View Mode Switch & Rows Table */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap', borderBottom: '1px solid #e2e8f0', paddingBottom: '8px' }}>
                  <div style={{ display: 'flex', gap: '4px', background: '#f1f5f9', padding: '3px', borderRadius: '8px' }}>
                    <button
                      type="button"
                      onClick={() => setPreviewViewMode('sheet')}
                      style={{
                        padding: '6px 14px',
                        borderRadius: '6px',
                        border: 'none',
                        fontSize: '12px',
                        fontWeight: previewViewMode === 'sheet' ? 700 : 500,
                        backgroundColor: previewViewMode === 'sheet' ? '#ffffff' : 'transparent',
                        color: previewViewMode === 'sheet' ? '#0284c7' : '#64748b',
                        boxShadow: previewViewMode === 'sheet' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px'
                      }}
                    >
                      <Layers size={14} />
                      <span>Dynamic Sheet View ({previewData.matrixRows?.length || 0} rows)</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setPreviewViewMode('flat')}
                      style={{
                        padding: '6px 14px',
                        borderRadius: '6px',
                        border: 'none',
                        fontSize: '12px',
                        fontWeight: previewViewMode === 'flat' ? 700 : 500,
                        backgroundColor: previewViewMode === 'flat' ? '#ffffff' : 'transparent',
                        color: previewViewMode === 'flat' ? '#0284c7' : '#64748b',
                        boxShadow: previewViewMode === 'flat' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px'
                      }}
                    >
                      <Package size={14} />
                      <span>Order Line Items ({previewData.summary?.totalRows || 0})</span>
                    </button>
                  </div>

                  {previewViewMode === 'sheet' && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <input
                        type="text"
                        placeholder="Filter by Employee ID or Name..."
                        value={sheetSearch}
                        onChange={e => setSheetSearch(e.target.value)}
                        style={{
                          padding: '5px 10px',
                          borderRadius: '6px',
                          border: '1px solid #cbd5e1',
                          fontSize: '12px',
                          width: '240px'
                        }}
                      />
                      {sheetSearch && (
                        <button
                          type="button"
                          onClick={() => setSheetSearch('')}
                          style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', padding: '2px' }}
                          title="Clear filter"
                        >
                          <X size={14} />
                        </button>
                      )}
                    </div>
                  )}

                  {previewViewMode === 'flat' && (
                    <div style={{ display: 'flex', gap: '4px', overflowX: 'auto' }}>
                      {[
                        { id: 'all', label: `All (${previewData.summary?.totalRows || 0})` },
                        { id: 'update', label: `To Update (${previewData.summary?.toUpdate || 0})` },
                        { id: 'create', label: `To Create (${previewData.summary?.toCreate || 0})` },
                        { id: 'no_change', label: `No Change (${previewData.summary?.noChange || 0})` },
                        { id: 'unmatched', label: `Unmatched (${previewData.summary?.unmatched || 0})` },
                        { id: 'invalid', label: `Invalid (${previewData.summary?.invalid || 0})` }
                      ].map(tab => (
                        <button
                          key={tab.id}
                          type="button"
                          onClick={() => setPreviewFilter(tab.id)}
                          style={{
                            padding: '4px 10px',
                            borderRadius: '5px',
                            border: 'none',
                            fontSize: '11.5px',
                            fontWeight: previewFilter === tab.id ? 700 : 500,
                            backgroundColor: previewFilter === tab.id ? '#0284c7' : '#f1f5f9',
                            color: previewFilter === tab.id ? '#ffffff' : '#475569',
                            cursor: 'pointer',
                            whiteSpace: 'nowrap'
                          }}
                        >
                          {tab.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* VIEW 1: DYNAMIC SHEET COLUMNS VIEW (Matching Excel Layout) */}
                {previewViewMode === 'sheet' && (
                  <div
                    style={{
                      maxHeight: '380px',
                      overflow: 'auto',
                      border: '1px solid #e2e8f0',
                      borderRadius: '8px'
                    }}
                  >
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11.5px' }}>
                      <thead style={{ backgroundColor: '#f8fafc', position: 'sticky', top: 0, zIndex: 2 }}>
                        <tr style={{ borderBottom: '1px solid #e2e8f0', textAlign: 'left', color: '#475569' }}>
                          <th style={{ padding: '8px 10px', whiteSpace: 'nowrap', borderRight: '1px solid #f1f5f9' }}>Date</th>
                          <th style={{ padding: '8px 10px', whiteSpace: 'nowrap', borderRight: '1px solid #f1f5f9' }}>Employee ID</th>
                          <th style={{ padding: '8px 10px', whiteSpace: 'nowrap', borderRight: '1px solid #f1f5f9' }}>Staff Name</th>
                          {matrixProductCols.map(col => (
                            <th
                              key={col.key}
                              style={{
                                padding: '8px 10px',
                                textAlign: 'center',
                                whiteSpace: 'nowrap',
                                backgroundColor: '#f0f9ff',
                                color: '#0369a1',
                                borderRight: '1px solid #e0f2fe'
                              }}
                            >
                              {col.label}
                            </th>
                          ))}
                          <th style={{ padding: '8px 10px', textAlign: 'right', whiteSpace: 'nowrap', backgroundColor: '#fef3c7', color: '#b45309', borderRight: '1px solid #fde68a' }}>
                            Incentive
                          </th>
                          {matrixReturnCols.map(col => (
                            <th
                              key={col.key}
                              style={{
                                padding: '8px 10px',
                                textAlign: 'center',
                                whiteSpace: 'nowrap',
                                backgroundColor: '#fef2f2',
                                color: '#b91c1c',
                                borderRight: '1px solid #fee2e2'
                              }}
                            >
                              {col.label}
                            </th>
                          ))}
                          <th style={{ padding: '8px 10px', textAlign: 'right', whiteSpace: 'nowrap', backgroundColor: '#fff1f2', color: '#be123c', borderRight: '1px solid #fecdd3' }}>
                            Return Deductions
                          </th>
                          <th style={{ padding: '8px 10px', textAlign: 'right', whiteSpace: 'nowrap', backgroundColor: '#ecfdf5', color: '#047857', borderRight: '1px solid #a7f3d0' }}>
                            Total Net
                          </th>
                          <th style={{ padding: '8px 10px', textAlign: 'center', whiteSpace: 'nowrap' }}>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredMatrixRows.length === 0 ? (
                          <tr>
                            <td colSpan={6 + matrixProductCols.length + matrixReturnCols.length} style={{ textAlign: 'center', padding: '28px', color: '#94a3b8' }}>
                              No sheet rows match the search query "{sheetSearch}".
                            </td>
                          </tr>
                        ) : (
                          filteredMatrixRows.map((r, i) => (
                            <tr
                              key={i}
                              style={{
                                borderBottom: '1px solid #f1f5f9',
                                backgroundColor: i % 2 === 0 ? '#ffffff' : '#fafafa'
                              }}
                            >
                              <td style={{ padding: '7px 10px', whiteSpace: 'nowrap', borderRight: '1px solid #f1f5f9', fontFamily: 'monospace', fontWeight: 600 }}>
                                {r.date}
                              </td>
                              <td style={{ padding: '7px 10px', whiteSpace: 'nowrap', borderRight: '1px solid #f1f5f9' }}>
                                <span
                                  style={{
                                    padding: '2px 8px',
                                    borderRadius: '5px',
                                    backgroundColor: '#f1f5f9',
                                    color: '#0f172a',
                                    fontWeight: 700,
                                    fontFamily: 'monospace',
                                    fontSize: '11px',
                                    border: '1px solid #e2e8f0'
                                  }}
                                >
                                  {r.employeeId || '—'}
                                </span>
                              </td>
                              <td style={{ padding: '7px 10px', whiteSpace: 'nowrap', borderRight: '1px solid #f1f5f9', fontWeight: 600, color: '#334155' }}>
                                {r.staffName || '—'}
                              </td>
                              {matrixProductCols.map(col => {
                                const qty = r.quantities?.[col.key] || 0;
                                return (
                                  <td
                                    key={col.key}
                                    style={{
                                      padding: '7px 10px',
                                      textAlign: 'center',
                                      borderRight: '1px solid #f1f5f9',
                                      fontWeight: qty > 0 ? 700 : 400,
                                      color: qty > 0 ? '#0284c7' : '#94a3b8',
                                      backgroundColor: qty > 0 ? '#f0f9ff44' : 'transparent'
                                    }}
                                  >
                                    {qty > 0 ? qty : '—'}
                                  </td>
                                );
                              })}
                              <td style={{ padding: '7px 10px', textAlign: 'right', borderRight: '1px solid #f1f5f9', fontWeight: 700, color: '#b45309' }}>
                                ₹{Number(r.grossIncentive || 0).toLocaleString()}
                              </td>
                              {matrixReturnCols.map(col => {
                                const retQty = r.returns?.[col.key] || 0;
                                return (
                                  <td
                                    key={col.key}
                                    style={{
                                      padding: '7px 10px',
                                      textAlign: 'center',
                                      borderRight: '1px solid #f1f5f9',
                                      fontWeight: retQty > 0 ? 700 : 400,
                                      color: retQty > 0 ? '#dc2626' : '#94a3b8',
                                      backgroundColor: retQty > 0 ? '#fef2f2' : 'transparent'
                                    }}
                                  >
                                    {retQty > 0 ? retQty : '—'}
                                  </td>
                                );
                              })}
                              <td style={{ padding: '7px 10px', textAlign: 'right', borderRight: '1px solid #f1f5f9', color: r.returnDeductions > 0 ? '#dc2626' : '#94a3b8', fontWeight: r.returnDeductions > 0 ? 700 : 400 }}>
                                {r.returnDeductions > 0 ? `-₹${Number(r.returnDeductions).toLocaleString()}` : '₹0'}
                              </td>
                              <td style={{ padding: '7px 10px', textAlign: 'right', borderRight: '1px solid #f1f5f9', fontWeight: 800, color: '#16a34a' }}>
                                ₹{Number(r.netIncentive || 0).toLocaleString()}
                              </td>
                              <td style={{ padding: '7px 10px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                                <span
                                  style={{
                                    padding: '2px 7px',
                                    borderRadius: '4px',
                                    fontSize: '10.5px',
                                    fontWeight: 700,
                                    backgroundColor: r.isStaffMatched ? '#dcfce7' : '#fee2e2',
                                    color: r.isStaffMatched ? '#166534' : '#991b1b'
                                  }}
                                >
                                  {r.isStaffMatched ? 'Valid' : 'Unmatched'}
                                </span>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                      {filteredMatrixRows.length > 0 && (
                        <tfoot style={{ backgroundColor: '#f8fafc', position: 'sticky', bottom: 0, zIndex: 2, borderTop: '2px solid #cbd5e1' }}>
                          <tr style={{ fontWeight: 800, color: '#0f172a' }}>
                            <td colSpan={3} style={{ padding: '9px 10px', textAlign: 'right', borderRight: '1px solid #e2e8f0' }}>
                              TOTALS ({filteredMatrixRows.length} ROWS):
                            </td>
                            {matrixProductCols.map(col => (
                              <td
                                key={col.key}
                                style={{
                                  padding: '9px 10px',
                                  textAlign: 'center',
                                  borderRight: '1px solid #e2e8f0',
                                  color: '#0284c7',
                                  backgroundColor: '#f0f9ff'
                                }}
                              >
                                {matrixTotals.products[col.key] || 0}
                              </td>
                            ))}
                            <td style={{ padding: '9px 10px', textAlign: 'right', color: '#b45309', backgroundColor: '#fef3c7', borderRight: '1px solid #e2e8f0' }}>
                              ₹{Math.round(matrixTotals.grossIncentive).toLocaleString()}
                            </td>
                            {matrixReturnCols.map(col => (
                              <td
                                key={col.key}
                                style={{
                                  padding: '9px 10px',
                                  textAlign: 'center',
                                  borderRight: '1px solid #e2e8f0',
                                  color: '#dc2626',
                                  backgroundColor: '#fef2f2'
                                }}
                              >
                                {matrixTotals.returns[col.key] || 0}
                              </td>
                            ))}
                            <td style={{ padding: '9px 10px', textAlign: 'right', color: '#dc2626', backgroundColor: '#fff1f2', borderRight: '1px solid #e2e8f0' }}>
                              -₹{Math.round(matrixTotals.returnDeductions).toLocaleString()}
                            </td>
                            <td style={{ padding: '9px 10px', textAlign: 'right', color: '#16a34a', backgroundColor: '#ecfdf5', borderRight: '1px solid #e2e8f0' }}>
                              ₹{Math.round(matrixTotals.netIncentive).toLocaleString()}
                            </td>
                            <td style={{ padding: '9px 10px', textAlign: 'center', color: '#64748b' }}>—</td>
                          </tr>
                        </tfoot>
                      )}
                    </table>
                  </div>
                )}

                {/* VIEW 2: ORDER LINE ITEMS VIEW (Flat Database Records) */}
                {previewViewMode === 'flat' && (
                  <div
                    style={{
                      maxHeight: '340px',
                      overflowY: 'auto',
                      border: '1px solid #e2e8f0',
                      borderRadius: '8px'
                    }}
                  >
                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                      <thead style={{ backgroundColor: '#f8fafc', position: 'sticky', top: 0, zIndex: 1 }}>
                        <tr style={{ borderBottom: '1px solid #e2e8f0', textAlign: 'left', color: '#64748b' }}>
                          <th style={{ padding: '8px 12px' }}>Sheet / Row</th>
                          <th style={{ padding: '8px 12px' }}>Order Date</th>
                          <th style={{ padding: '8px 12px' }}>Sales Staff</th>
                          <th style={{ padding: '8px 12px' }}>Product</th>
                          <th style={{ padding: '8px 12px', textAlign: 'center' }}>Qty</th>
                          <th style={{ padding: '8px 12px', textAlign: 'center' }}>Returns</th>
                          <th style={{ padding: '8px 12px' }}>Payment</th>
                          <th style={{ padding: '8px 12px' }}>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredRows.length === 0 ? (
                          <tr>
                            <td colSpan={8} style={{ textAlign: 'center', padding: '24px', color: '#94a3b8' }}>
                              No rows matching the selected filter.
                            </td>
                          </tr>
                        ) : (
                          filteredRows.map((r, i) => (
                            <tr
                              key={i}
                              style={{
                                borderBottom: '1px solid #f1f5f9',
                                backgroundColor:
                                  r.status === 'valid_update'
                                    ? '#f0f9ff'
                                    : r.status === 'valid_create'
                                    ? '#f0fdf4'
                                    : r.status === 'unmatched'
                                    ? '#fffbeb'
                                    : r.status === 'invalid'
                                    ? '#fef2f2'
                                    : '#ffffff'
                              }}
                            >
                              <td style={{ padding: '8px 12px', whiteSpace: 'nowrap' }}>
                                <span style={{ fontWeight: 600, color: '#0f172a' }}>{r.sheetName}</span>
                                <div style={{ fontSize: '11px', color: '#64748b' }}>Row {r.rowNumber}</div>
                              </td>
                              <td style={{ padding: '8px 12px', whiteSpace: 'nowrap' }}>
                                {r.excelData?.date || '—'}
                              </td>
                              <td style={{ padding: '8px 12px' }}>
                                <span style={{ fontWeight: 600, color: '#1e293b' }}>
                                  {r.matchedStaff ? r.matchedStaff.name : r.excelData?.staffCode || 'Unmatched'}
                                </span>
                                <div style={{ fontSize: '11px', color: '#64748b' }}>
                                  {r.matchedStaff?.staff_id || r.sheetName}
                                </div>
                              </td>
                              <td style={{ padding: '8px 12px' }}>
                                <span style={{ fontWeight: 600, color: '#1e293b' }}>
                                  {r.matchedProduct ? r.matchedProduct.name : r.excelData?.productName || 'Unmatched'}
                                </span>
                                <div style={{ fontSize: '11px', color: '#64748b' }}>
                                  {r.matchedProduct?.code || ''}
                                </div>
                              </td>
                              <td style={{ padding: '8px 12px', textAlign: 'center', fontWeight: 700 }}>
                                {r.excelData?.quantity ?? 0}
                              </td>
                              <td style={{
                                padding: '8px 12px',
                                textAlign: 'center',
                                fontWeight: r.excelData?.returnQuantity > 0 ? 700 : 400,
                                color: r.excelData?.returnQuantity > 0 ? '#dc2626' : '#94a3b8'
                              }}>
                                {r.excelData?.returnQuantity > 0 ? `${r.excelData.returnQuantity} units` : '—'}
                              </td>
                              <td style={{ padding: '8px 12px' }}>
                                <span
                                  style={{
                                    padding: '2px 8px',
                                    borderRadius: '4px',
                                    fontSize: '11px',
                                    fontWeight: 600,
                                    backgroundColor: r.excelData?.paymentMethod === 'Prepaid' ? '#dcfce7' : '#f1f5f9',
                                    color: r.excelData?.paymentMethod === 'Prepaid' ? '#166534' : '#475569'
                                  }}
                                >
                                  {r.excelData?.paymentMethod || 'Prepaid'}
                                </span>
                              </td>
                              <td style={{ padding: '8px 12px' }}>
                                <span
                                  style={{
                                    padding: '2px 8px',
                                    borderRadius: '4px',
                                    fontSize: '11px',
                                    fontWeight: 600,
                                    backgroundColor:
                                      r.status === 'valid_update'
                                        ? '#bfdbfe'
                                        : r.status === 'valid_create'
                                        ? '#bbf7d0'
                                        : r.status === 'no_change'
                                        ? '#e2e8f0'
                                        : r.status === 'unmatched'
                                        ? '#fed7aa'
                                        : '#fecaca',
                                    color:
                                      r.status === 'valid_update'
                                        ? '#1e40af'
                                        : r.status === 'valid_create'
                                        ? '#15803d'
                                        : r.status === 'no_change'
                                        ? '#475569'
                                        : r.status === 'unmatched'
                                        ? '#9a3412'
                                        : '#991b1b'
                                  }}
                                >
                                  {r.status === 'valid_update'
                                    ? 'To Update'
                                    : r.status === 'valid_create'
                                    ? 'To Create'
                                    : r.status === 'no_change'
                                    ? 'No Change'
                                    : r.status === 'unmatched'
                                    ? 'Unmatched'
                                    : 'Invalid'}
                                </span>
                                {r.reasons?.length > 0 && (
                                  <div style={{ fontSize: '10.5px', color: '#b91c1c', marginTop: '2px' }}>
                                    {r.reasons.join(', ')}
                                  </div>
                                )}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* STEP 3: RESULT */}
          {step === 'result' && resultData && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', textAlign: 'center', padding: '20px 0' }}>
              <div
                style={{
                  width: '64px',
                  height: '64px',
                  borderRadius: '50%',
                  backgroundColor: '#ecfdf5',
                  color: '#059669',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto'
                }}
              >
                <CheckCircle2 size={36} />
              </div>

              <div>
                <h4 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: '#0f172a' }}>
                  Orders Successfully Imported!
                </h4>
                <p style={{ margin: '6px 0 0', fontSize: '13px', color: '#64748b' }}>
                  Database has been synchronized with the monthly Excel workbook.
                </p>
              </div>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
                  gap: '12px',
                  textAlign: 'center'
                }}
              >
                <div style={{ padding: '14px', borderRadius: '10px', backgroundColor: '#eff6ff', border: '1px solid #bfdbfe' }}>
                  <div style={{ fontSize: '11px', color: '#1d4ed8', fontWeight: 600, textTransform: 'uppercase' }}>
                    Updated Orders
                  </div>
                  <div style={{ fontSize: '24px', fontWeight: 700, color: '#1d4ed8', marginTop: '4px' }}>
                    {resultData.updatedCount || 0}
                  </div>
                </div>

                <div style={{ padding: '14px', borderRadius: '10px', backgroundColor: '#ecfdf5', border: '1px solid #a7f3d0' }}>
                  <div style={{ fontSize: '11px', color: '#047857', fontWeight: 600, textTransform: 'uppercase' }}>
                    Created Orders
                  </div>
                  <div style={{ fontSize: '24px', fontWeight: 700, color: '#047857', marginTop: '4px' }}>
                    {resultData.createdCount || 0}
                  </div>
                </div>

                <div style={{ padding: '14px', borderRadius: '10px', backgroundColor: '#f8fafc', border: '1px solid #e2e8f0' }}>
                  <div style={{ fontSize: '11px', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>
                    Linked Returns
                  </div>
                  <div style={{ fontSize: '24px', fontWeight: 700, color: '#475569', marginTop: '4px' }}>
                    {resultData.returnsCreatedCount || 0}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div
          style={{
            padding: '14px 24px',
            borderTop: '1px solid #e2e8f0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            backgroundColor: '#f8fafc'
          }}
        >
          {step === 'upload' && (
            <>
              <button
                type="button"
                onClick={handleModalClose}
                disabled={loading}
                style={{
                  padding: '8px 16px',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  backgroundColor: '#ffffff',
                  color: '#334155',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleInspectFile()}
                disabled={!file || loading}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '8px 20px',
                  borderRadius: '6px',
                  backgroundColor: !file || loading ? '#94a3b8' : '#0284c7',
                  color: '#ffffff',
                  border: 'none',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: !file || loading ? 'not-allowed' : 'pointer'
                }}
              >
                {loading ? <RefreshCw size={14} className="animate-spin" /> : null}
                {loading ? 'Inspecting Sheets...' : 'Inspect & Preview'}
              </button>
            </>
          )}

          {step === 'preview' && (
            <>
              <button
                type="button"
                onClick={() => setStep('upload')}
                disabled={loading}
                style={{
                  padding: '8px 16px',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  backgroundColor: '#ffffff',
                  color: '#334155',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
              >
                Back to Upload
              </button>

              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <button
                  type="button"
                  onClick={handleConfirmImport}
                  disabled={loading || !previewData?.canConfirm}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '8px 22px',
                    borderRadius: '6px',
                    backgroundColor:
                      loading || !previewData?.canConfirm ? '#94a3b8' : '#059669',
                    color: '#ffffff',
                    border: 'none',
                    fontSize: '13px',
                    fontWeight: 600,
                    cursor: loading || !previewData?.canConfirm ? 'not-allowed' : 'pointer'
                  }}
                >
                  {loading ? <RefreshCw size={14} className="animate-spin" /> : <FileCheck size={16} />}
                  {loading
                    ? 'Updating Database...'
                    : previewData?.canConfirm
                    ? 'Confirm & Apply Orders'
                    : 'Map Unmatched Items First'}
                </button>
              </div>
            </>
          )}

          {step === 'result' && (
            <div style={{ width: '100%', display: 'flex', justifyContent: 'flex-end' }}>
              <button
                type="button"
                onClick={handleModalClose}
                style={{
                  padding: '8px 24px',
                  borderRadius: '6px',
                  backgroundColor: '#0284c7',
                  color: '#ffffff',
                  border: 'none',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: 'pointer'
                }}
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
