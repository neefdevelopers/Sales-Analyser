// src/views/DailyActivity.jsx
import React, { useState, useEffect } from 'react';
import { api } from '../api';
import { useAuth } from '../context/AuthContext';
import {
  Calendar,
  PhoneCall,
  HelpCircle,
  Clock,
  CheckCircle2,
  AlertCircle,
  Lock,
  Edit2,
  TrendingUp,
  Users,
  Search,
  Filter,
  RefreshCw,
  Sparkles,
  Award,
  ChevronRight,
  ShieldCheck,
  Check,
  Plus,
  Minus,
  CalendarDays
} from 'lucide-react';

export default function DailyActivity() {
  const { user } = useAuth();
  const isManager = user?.role === 'brand_manager';

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [activities, setActivities] = useState([]);
  const [statusInfo, setStatusInfo] = useState(null);
  const [staffList, setStaffList] = useState([]);
  const [selectedStaffFilter, setSelectedStaffFilter] = useState('all');

  // Form State
  const [activityDate, setActivityDate] = useState('');
  const [totalCalls, setTotalCalls] = useState('');
  const [connectedCalls, setConnectedCalls] = useState('');
  const [totalEnquiries, setTotalEnquiries] = useState('');
  const [remarks, setRemarks] = useState('');
  const [targetStaffId, setTargetStaffId] = useState('');

  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [searchHistory, setSearchHistory] = useState('');

  // Preset quick tags for effortless remarks
  const quickTags = [
    '⚡ High Lead Response',
    '🎯 Weekend Campaign Leads',
    '📞 Callback Follow-ups',
    '✨ Strong Interest in Smartwatches',
    '💬 Audio Accessories Queries',
    '🛒 Corporate Bulk Inquiries'
  ];

  useEffect(() => {
    loadInitialData();
  }, [selectedStaffFilter]);

  async function loadInitialData() {
    setLoading(true);
    setErrorMsg('');
    try {
      // 1. Fetch Daily Activity Status
      const statusRes = await api.get('/daily-activity/status');
      setStatusInfo(statusRes);

      // Default date to today
      const defaultDate = activityDate || statusRes.today.date;
      setActivityDate(defaultDate);

      // Pre-fill today's record if present and not modified yet
      if (!activityDate && statusRes.today.record) {
        setTotalCalls(String(statusRes.today.record.total_calls));
        setConnectedCalls(String(statusRes.today.record.connected_calls));
        setTotalEnquiries(String(statusRes.today.record.total_enquiries));
        setRemarks(statusRes.today.record.remarks || '');
      }

      // 2. Fetch Daily Activity History
      let historyUrl = '/daily-activity';
      if (isManager && selectedStaffFilter !== 'all') {
        historyUrl += `?staffId=${selectedStaffFilter}`;
      }
      const historyRes = await api.get(historyUrl);
      setActivities(historyRes.activities || []);

      // 3. If Brand Manager, load staff list
      if (isManager) {
        const staffRes = await api.get('/staff');
        setStaffList(staffRes.staff || []);
      }
    } catch (err) {
      console.error('Failed to load daily activity data:', err);
      setErrorMsg('Failed to load activity information.');
    } finally {
      setLoading(false);
    }
  }

  // Handle switching date (Today / Yesterday / Custom)
  function handleSelectDate(dateStr) {
    setActivityDate(dateStr);
    setSuccessMsg('');
    setErrorMsg('');

    // Pre-populate if record exists in history
    const existing = activities.find(a => a.activity_date === dateStr && (!isManager || !targetStaffId || a.staff_id === parseInt(targetStaffId, 10)));
    if (existing) {
      setTotalCalls(String(existing.total_calls));
      setConnectedCalls(String(existing.connected_calls));
      setTotalEnquiries(String(existing.total_enquiries));
      setRemarks(existing.remarks || '');
    } else {
      setTotalCalls('');
      setConnectedCalls('');
      setTotalEnquiries('');
      setRemarks('');
    }
  }

  // Quick increment/decrement helper
  function adjustValue(setter, currentVal, delta, maxVal = null) {
    const cur = parseInt(currentVal, 10) || 0;
    let next = Math.max(0, cur + delta);
    if (maxVal !== null && next > maxVal) {
      next = maxVal;
    }
    setter(String(next));
  }

  // Pre-fill form from history row
  function handleEditRow(row) {
    setActivityDate(row.activity_date);
    setTotalCalls(String(row.total_calls));
    setConnectedCalls(String(row.connected_calls));
    setTotalEnquiries(String(row.total_enquiries));
    setRemarks(row.remarks || '');
    if (isManager) {
      setTargetStaffId(String(row.staff_id));
    }
    window.scrollTo({ top: 120, behavior: 'smooth' });
  }

  // Add quick tag to remarks
  function handleAddTag(tag) {
    setRemarks(prev => {
      const clean = tag.replace(/^[^\w\s]+/, '').trim();
      if (!prev) return clean;
      if (prev.includes(clean)) return prev;
      return `${prev}, ${clean}`;
    });
  }

  // Numerical calculations
  const callsNum = parseInt(totalCalls, 10) || 0;
  const connNum = parseInt(connectedCalls, 10) || 0;
  const enqNum = parseInt(totalEnquiries, 10) || 0;
  const liveConnRate = callsNum > 0 ? Math.round((connNum / callsNum) * 1000) / 10 : 0;

  // Lock status calculation
  const isDateYesterday = statusInfo?.yesterday?.date === activityDate;
  const isYesterdayLocked = statusInfo?.yesterday?.deadline?.isLocked;
  const isPastLocked = activityDate < (statusInfo?.today?.date || '') && isYesterdayLocked;
  const isFormLocked = (isDateYesterday ? isYesterdayLocked : isPastLocked) && !isManager;

  async function handleSubmit(e) {
    e.preventDefault();
    setSuccessMsg('');
    setErrorMsg('');

    if (!activityDate) {
      setErrorMsg('Please select an activity date.');
      return;
    }

    if (callsNum < 0 || connNum < 0 || enqNum < 0) {
      setErrorMsg('Counts must be non-negative integers.');
      return;
    }

    if (connNum > callsNum) {
      setErrorMsg('Connected calls count cannot exceed total calls count.');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        activity_date: activityDate,
        total_calls: callsNum,
        connected_calls: connNum,
        total_enquiries: enqNum,
        remarks: remarks.trim(),
        staff_id: isManager && targetStaffId ? targetStaffId : undefined
      };

      const res = await api.post('/daily-activity', payload);
      setSuccessMsg(res.message || 'Daily activity count saved successfully!');

      // Reload fresh data
      await loadInitialData();
    } catch (err) {
      console.error('Failed to submit daily activity count:', err);
      setErrorMsg(err.response?.data?.error || err.message || 'Failed to save daily activity count.');
    } finally {
      setSubmitting(false);
    }
  }

  // Filtered history list
  const filteredActivities = activities.filter(act => {
    if (!searchHistory.trim()) return true;
    const q = searchHistory.toLowerCase();
    return (
      act.activity_date.toLowerCase().includes(q) ||
      (act.staff_name && act.staff_name.toLowerCase().includes(q)) ||
      (act.remarks && act.remarks.toLowerCase().includes(q))
    );
  });

  // Format date readable
  function formatDateLabel(dateStr) {
    if (!dateStr) return '';
    try {
      const [y, m, d] = dateStr.split('-');
      const dt = new Date(Date.UTC(y, m - 1, d));
      return dt.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', timeZone: 'UTC' });
    } catch (e) {
      return dateStr;
    }
  }

  return (
    <div className="page-body">
      {/* 1. Spacious Clean Page Header */}
      <div className="page-header" style={{ marginBottom: '28px' }}>
        <div>
          <h2 className="page-title" style={{ fontSize: '26px' }}>
            {isManager ? 'Daily Activity Audit Hub' : 'Daily Activity Logging'}
          </h2>
        </div>

        {/* 9:30 AM Cutoff Pill with breathing room */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', background: 'white', padding: '10px 18px', borderRadius: 'var(--radius-full)', border: '1px solid var(--border-subtle)', boxShadow: 'var(--shadow-xs)' }}>
          <Clock size={16} color="var(--primary-600)" />
          <div style={{ fontSize: '13px' }}>
            <span style={{ fontWeight: 600, color: 'var(--text-muted)' }}>Daily Cutoff: </span>
            <span style={{ fontWeight: 700, color: 'var(--text-main)' }}>09:30 AM Next Day</span>
            <span style={{ color: 'var(--primary-600)', fontWeight: 600, marginLeft: '4px' }}>(Asia/Kolkata)</span>
          </div>
        </div>
      </div>

      {/* 2. Spacious Date Selection Cards */}
      {statusInfo && (
        <div className="date-cards-grid">
          {/* Card 1: Today */}
          <div
            className={`date-select-card ${activityDate === statusInfo.today.date ? 'active' : ''}`}
            onClick={() => handleSelectDate(statusInfo.today.date)}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <span style={{ fontSize: '11.5px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  TODAY
                </span>
                <div style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text-main)', marginTop: '2px' }}>
                  {formatDateLabel(statusInfo.today.date)}
                </div>
              </div>
              <span className={`badge ${statusInfo.today.hasLogged ? 'badge-success' : 'badge-warning'}`} style={{ padding: '4px 10px' }}>
                <span className={`pulsing-dot ${statusInfo.today.hasLogged ? 'success' : 'warning'}`} style={{ marginRight: '6px' }} />
                {statusInfo.today.hasLogged ? 'Logged' : 'Pending Entry'}
              </span>
            </div>

            <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '12px' }}>
              {statusInfo.today.hasLogged ? (
                <span>
                  Calls: <strong style={{ color: '#0284c7' }}>{statusInfo.today.record?.total_calls}</strong> | Conn: <strong style={{ color: '#16a34a' }}>{statusInfo.today.record?.connected_calls}</strong> | Enquiries: <strong style={{ color: '#8b5cf6' }}>{statusInfo.today.record?.total_enquiries}</strong>
                </span>
              ) : (
                <span>Entries open until tomorrow 09:30 AM IST</span>
              )}
            </div>
          </div>

          {/* Card 2: Yesterday */}
          <div
            className={`date-select-card ${activityDate === statusInfo.yesterday.date ? 'active' : ''}`}
            onClick={() => handleSelectDate(statusInfo.yesterday.date)}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <span style={{ fontSize: '11.5px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  YESTERDAY
                </span>
                <div style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text-main)', marginTop: '2px' }}>
                  {formatDateLabel(statusInfo.yesterday.date)}
                </div>
              </div>
              <span className={`badge ${statusInfo.yesterday.deadline.isLocked ? 'badge-danger' : (statusInfo.yesterday.hasLogged ? 'badge-success' : 'badge-warning')}`} style={{ padding: '4px 10px' }}>
                {statusInfo.yesterday.deadline.isLocked ? (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                    <Lock size={11} /> Locked
                  </span>
                ) : (
                  <span>Open until 9:30 AM</span>
                )}
              </span>
            </div>

            <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '12px' }}>
              {statusInfo.yesterday.hasLogged ? (
                <span>
                  Calls: <strong style={{ color: '#0284c7' }}>{statusInfo.yesterday.record?.total_calls}</strong> | Conn: <strong style={{ color: '#16a34a' }}>{statusInfo.yesterday.record?.connected_calls}</strong> | Enquiries: <strong style={{ color: '#8b5cf6' }}>{statusInfo.yesterday.record?.total_enquiries}</strong>
                </span>
              ) : (
                <span style={{ color: statusInfo.yesterday.deadline.isLocked ? 'var(--danger-solid)' : 'var(--text-muted)' }}>
                  {statusInfo.yesterday.deadline.isLocked ? 'Closed at 09:30 AM today' : 'Can be recorded before 09:30 AM'}
                </span>
              )}
            </div>
          </div>

          {/* Card 3: Date Picker & Period Scope */}
          <div className="date-select-card" style={{ cursor: 'default' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <span style={{ fontSize: '11.5px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  CUSTOM DATE
                </span>
                <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-main)', marginTop: '2px' }}>
                  Select specific date
                </div>
              </div>
              <CalendarDays size={18} color="var(--primary-600)" />
            </div>

            <div style={{ marginTop: '12px' }}>
              <input
                type="date"
                className="form-control"
                style={{ padding: '7px 12px', fontSize: '13px' }}
                value={activityDate}
                max={statusInfo?.today?.date}
                onChange={e => handleSelectDate(e.target.value)}
              />
            </div>
          </div>
        </div>
      )}

      {/* Brand Manager Team Filter Bar */}
      {isManager && staffList.length > 0 && (
        <div style={{ background: 'white', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-lg)', padding: '16px 24px', marginBottom: '28px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '16px', boxShadow: 'var(--shadow-xs)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Users size={16} color="var(--primary-600)" />
              <span>Today's Staff Submissions:</span>
            </span>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {staffList.map(s => {
                const logged = activities.some(a => a.staff_id === s.id && a.activity_date === statusInfo?.today?.date);
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setSelectedStaffFilter(selectedStaffFilter === String(s.id) ? 'all' : String(s.id))}
                    style={{
                      padding: '5px 12px',
                      borderRadius: 'var(--radius-full)',
                      fontSize: '12px',
                      fontWeight: 600,
                      border: selectedStaffFilter === String(s.id) ? '2px solid var(--primary-600)' : '1px solid var(--border-subtle)',
                      background: logged ? 'var(--success-bg)' : '#fff7ed',
                      color: logged ? 'var(--success-text)' : '#c2410c',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <span className={`pulsing-dot ${logged ? 'success' : 'warning'}`} style={{ width: '7px', height: '7px' }} />
                    <span>{s.name}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {selectedStaffFilter !== 'all' && (
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => setSelectedStaffFilter('all')}
            >
              Reset Staff Filter
            </button>
          )}
        </div>
      )}

      {/* 3. Spacious Metric Logging Station */}
      <div className="card" style={{ padding: '32px 36px', marginBottom: '36px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px', paddingBottom: '24px', borderBottom: '1px solid var(--border-subtle)', marginBottom: '28px' }}>
          <div>
            <h3 style={{ fontSize: '18px', fontWeight: 800, color: 'var(--text-main)', letterSpacing: '-0.01em' }}>
              {isFormLocked ? 'View Daily Activity Record (Locked)' : 'Daily Activity Entry Station'}
            </h3>
            <p style={{ fontSize: '13.5px', color: 'var(--text-muted)', marginTop: '4px' }}>
              Recording daily totals for: <strong style={{ color: 'var(--text-main)' }}>{formatDateLabel(activityDate)}</strong>
            </p>
          </div>

          <span className={`badge ${isFormLocked ? 'badge-danger' : 'badge-success'}`} style={{ fontSize: '13px', padding: '6px 14px' }}>
            {isFormLocked ? 'Read-Only (Cutoff Passed)' : 'Active Entry Window'}
          </span>
        </div>

        {successMsg && (
          <div className="alert alert-success" style={{ marginBottom: '24px', padding: '14px 20px' }}>
            <CheckCircle2 size={18} />
            <div style={{ fontWeight: 600 }}>{successMsg}</div>
          </div>
        )}

        {errorMsg && (
          <div className="alert alert-danger" style={{ marginBottom: '24px', padding: '14px 20px' }}>
            <AlertCircle size={18} />
            <div>{errorMsg}</div>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {/* Manager: Assign to Staff */}
          {isManager && (
            <div style={{ marginBottom: '28px', background: '#f8fafc', padding: '18px 24px', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-subtle)', display: 'flex', alignItems: 'center', gap: '16px' }}>
              <Users size={20} color="var(--primary-600)" />
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-main)', display: 'block', marginBottom: '4px' }}>
                  Assign to Sales Staff Member *
                </label>
                <select
                  className="form-control"
                  style={{ fontSize: '13.5px', padding: '8px 12px' }}
                  value={targetStaffId}
                  onChange={e => {
                    setTargetStaffId(e.target.value);
                    const ex = activities.find(a => a.staff_id === parseInt(e.target.value, 10) && a.activity_date === activityDate);
                    if (ex) {
                      setTotalCalls(String(ex.total_calls));
                      setConnectedCalls(String(ex.connected_calls));
                      setTotalEnquiries(String(ex.total_enquiries));
                      setRemarks(ex.remarks || '');
                    }
                  }}
                  required
                >
                  <option value="">Select Staff Member...</option>
                  {staffList.map(s => (
                    <option key={s.id} value={s.id}>{s.name} ({s.staff_id})</option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {/* 3 Spacious Metric Counter Cards */}
          <div className="metric-counter-grid">
            {/* Card 1: Total Calls */}
            <div className="metric-counter-card blue">
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <span style={{ fontSize: '12px', fontWeight: 800, color: '#0369a1', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      1. TOTAL CALLS
                    </span>
                    <div style={{ fontSize: '12.5px', color: 'var(--text-muted)', marginTop: '2px' }}>
                      All outreach dials made
                    </div>
                  </div>
                  <div style={{ width: '38px', height: '38px', borderRadius: 'var(--radius-md)', background: '#e0f2fe', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#0284c7' }}>
                    <PhoneCall size={20} />
                  </div>
                </div>
              </div>

              {/* Input Box */}
              <div className="counter-value-box">
                <input
                  type="number"
                  min="0"
                  placeholder="0"
                  className="counter-value-input"
                  value={totalCalls}
                  onChange={e => setTotalCalls(e.target.value)}
                  disabled={isFormLocked}
                  style={{ color: '#0369a1' }}
                />
              </div>

              {!isFormLocked && (
                <div>
                  <div style={{ fontSize: '11.5px', color: 'var(--text-subtle)', fontWeight: 600 }}>Quick Steppers:</div>
                  <div className="stepper-btn-group">
                    <button type="button" className="stepper-btn" onClick={() => adjustValue(setTotalCalls, totalCalls, -1)}>
                      <Minus size={13} />
                    </button>
                    <button type="button" className="stepper-btn" onClick={() => adjustValue(setTotalCalls, totalCalls, 1)}>
                      +1
                    </button>
                    <button type="button" className="stepper-btn" onClick={() => adjustValue(setTotalCalls, totalCalls, 5)}>
                      +5
                    </button>
                    <button type="button" className="stepper-btn" onClick={() => adjustValue(setTotalCalls, totalCalls, 10)}>
                      +10
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Card 2: Connected Calls */}
            <div className="metric-counter-card emerald">
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <span style={{ fontSize: '12px', fontWeight: 800, color: '#15803d', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      2. CONNECTED CALLS
                    </span>
                    <div style={{ fontSize: '12.5px', color: 'var(--text-muted)', marginTop: '2px' }}>
                      Spoke with prospective customer
                    </div>
                  </div>
                  <div style={{ width: '38px', height: '38px', borderRadius: 'var(--radius-md)', background: '#dcfce7', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#16a34a' }}>
                    <CheckCircle2 size={20} />
                  </div>
                </div>
              </div>

              {/* Input Box */}
              <div className="counter-value-box">
                <input
                  type="number"
                  min="0"
                  max={callsNum || undefined}
                  placeholder="0"
                  className="counter-value-input"
                  value={connectedCalls}
                  onChange={e => setConnectedCalls(e.target.value)}
                  disabled={isFormLocked}
                  style={{ color: '#15803d' }}
                />
              </div>

              {/* Progress and Live Stats */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12.5px', fontWeight: 700, marginBottom: '4px' }}>
                  <span style={{ color: liveConnRate >= 65 ? '#15803d' : (liveConnRate >= 45 ? '#b45309' : '#b91c1c') }}>
                    Connection Rate: {liveConnRate}%
                  </span>
                  <span style={{ color: 'var(--text-muted)', fontWeight: 500 }}>
                    {connNum} of {callsNum}
                  </span>
                </div>
                <div className="progress-track">
                  <div
                    className="progress-fill"
                    style={{
                      width: `${Math.min(100, liveConnRate)}%`,
                      background: liveConnRate >= 65 ? '#10b981' : (liveConnRate >= 45 ? '#f59e0b' : '#ef4444')
                    }}
                  />
                </div>
              </div>

              {!isFormLocked && (
                <div style={{ marginTop: '16px' }}>
                  <div style={{ fontSize: '11.5px', color: 'var(--text-subtle)', fontWeight: 600 }}>Quick Steppers:</div>
                  <div className="stepper-btn-group">
                    <button type="button" className="stepper-btn" onClick={() => adjustValue(setConnectedCalls, connectedCalls, -1)}>
                      <Minus size={13} />
                    </button>
                    <button type="button" className="stepper-btn" onClick={() => adjustValue(setConnectedCalls, connectedCalls, 1, callsNum || null)}>
                      +1
                    </button>
                    <button type="button" className="stepper-btn" onClick={() => adjustValue(setConnectedCalls, connectedCalls, 5, callsNum || null)}>
                      +5
                    </button>
                    <button type="button" className="stepper-btn" onClick={() => adjustValue(setConnectedCalls, connectedCalls, 10, callsNum || null)}>
                      +10
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Card 3: Total Enquiries */}
            <div className="metric-counter-card violet">
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <span style={{ fontSize: '12px', fontWeight: 800, color: '#7e22ce', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                      3. TOTAL ENQUIRIES
                    </span>
                    <div style={{ fontSize: '12.5px', color: 'var(--text-muted)', marginTop: '2px' }}>
                      Customer interest & follow-ups
                    </div>
                  </div>
                  <div style={{ width: '38px', height: '38px', borderRadius: 'var(--radius-md)', background: '#f3e8ff', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9333ea' }}>
                    <HelpCircle size={20} />
                  </div>
                </div>
              </div>

              {/* Input Box */}
              <div className="counter-value-box">
                <input
                  type="number"
                  min="0"
                  placeholder="0"
                  className="counter-value-input"
                  value={totalEnquiries}
                  onChange={e => setTotalEnquiries(e.target.value)}
                  disabled={isFormLocked}
                  style={{ color: '#7e22ce' }}
                />
              </div>

              <div>
                <div style={{ fontSize: '12.5px', color: 'var(--text-muted)', minHeight: '26px' }}>
                  {callsNum > 0 ? (
                    <span>Lead-to-Call Ratio: <strong style={{ color: '#7e22ce' }}>{Math.round((enqNum / callsNum) * 1000) / 10}%</strong></span>
                  ) : (
                    <span>Direct customer leads recorded</span>
                  )}
                </div>
              </div>

              {!isFormLocked && (
                <div style={{ marginTop: '16px' }}>
                  <div style={{ fontSize: '11.5px', color: 'var(--text-subtle)', fontWeight: 600 }}>Quick Steppers:</div>
                  <div className="stepper-btn-group">
                    <button type="button" className="stepper-btn" onClick={() => adjustValue(setTotalEnquiries, totalEnquiries, -1)}>
                      <Minus size={13} />
                    </button>
                    <button type="button" className="stepper-btn" onClick={() => adjustValue(setTotalEnquiries, totalEnquiries, 1)}>
                      +1
                    </button>
                    <button type="button" className="stepper-btn" onClick={() => adjustValue(setTotalEnquiries, totalEnquiries, 5)}>
                      +5
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Spacious Remarks & Quick Suggestion Tags */}
          <div style={{ background: '#f8fafc', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-xl)', padding: '24px 28px', marginTop: '28px', marginBottom: '28px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <label style={{ fontSize: '13.5px', fontWeight: 700, color: 'var(--text-main)' }}>
                Day Notes & Context (Optional)
              </label>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                Click any tag below to quickly append to notes
              </span>
            </div>

            <input
              type="text"
              className="form-control"
              placeholder="e.g. High response for audio accessories; completed follow-ups from yesterday leads."
              value={remarks}
              onChange={e => setRemarks(e.target.value)}
              disabled={isFormLocked}
              style={{ padding: '12px 16px', fontSize: '13.5px', background: 'white' }}
            />

            {!isFormLocked && (
              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginTop: '14px' }}>
                {quickTags.map((tag, idx) => (
                  <span
                    key={idx}
                    className="quick-tag-chip"
                    onClick={() => handleAddTag(tag)}
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Action Row with Breathing Room */}
          {!isFormLocked ? (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px', paddingTop: '20px', borderTop: '1px solid var(--border-subtle)' }}>
              <div style={{ fontSize: '13.5px', color: 'var(--text-muted)' }}>
                Logging for date: <strong style={{ color: 'var(--text-main)' }}>{formatDateLabel(activityDate)}</strong>
              </div>

              <div style={{ display: 'flex', gap: '14px' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => handleSelectDate(statusInfo?.today?.date || activityDate)}
                  disabled={submitting}
                  style={{ padding: '12px 24px' }}
                >
                  Reset Form
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={submitting}
                  style={{ minWidth: '220px', padding: '12px 32px', fontSize: '15px', fontWeight: 700 }}
                >
                  {submitting ? 'Saving Activity...' : 'Save Daily Activity Count'}
                </button>
              </div>
            </div>
          ) : (
            <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 'var(--radius-lg)', padding: '16px 20px', display: 'flex', alignItems: 'center', gap: '12px', color: '#991b1b', fontSize: '13.5px' }}>
              <Lock size={18} />
              <span>
                This date ({activityDate}) is locked for editing. The 09:30 AM cutoff in <strong>Asia/Kolkata</strong> has passed.
              </span>
            </div>
          )}
        </form>
      </div>

      {/* 4. Spacious Audit History Table */}
      <div className="table-card" style={{ marginTop: '36px' }}>
        <div className="table-toolbar" style={{ padding: '20px 28px' }}>
          <div>
            <h3 style={{ fontSize: '16px', fontWeight: 800, color: 'var(--text-main)', marginBottom: '3px' }}>
              Activity Count Audit History
            </h3>
            <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
              {isManager
                ? 'Audited log of daily total calls and enquiries recorded across the sales organization.'
                : 'All your logged daily activity totals and cutoff statuses.'}
            </div>
          </div>

          <div style={{ display: 'flex', gap: '14px', alignItems: 'center', flexWrap: 'wrap' }}>
            <div className="search-input-wrap">
              <Search size={15} />
              <input
                type="text"
                className="search-input"
                placeholder="Search date, staff, notes..."
                value={searchHistory}
                onChange={e => setSearchHistory(e.target.value)}
              />
            </div>

            {isManager && (
              <select
                className="form-control"
                style={{ padding: '8px 14px', fontSize: '13px', minWidth: '180px' }}
                value={selectedStaffFilter}
                onChange={e => setSelectedStaffFilter(e.target.value)}
              >
                <option value="all">All Sales Staff</option>
                {staffList.map(s => (
                  <option key={s.id} value={s.id}>{s.name} ({s.staff_id})</option>
                ))}
              </select>
            )}

            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={loadInitialData}
              title="Refresh Records"
              style={{ padding: '8px 14px' }}
            >
              <RefreshCw size={14} />
              <span>Refresh</span>
            </button>
          </div>
        </div>

        <div className="table-responsive">
          {loading ? (
            <div style={{ padding: '48px', textAlign: 'center', color: 'var(--text-muted)' }}>
              Loading activity history...
            </div>
          ) : filteredActivities.length === 0 ? (
            <div style={{ padding: '48px', textAlign: 'center', color: 'var(--text-muted)' }}>
              No activity records found matching your filters.
            </div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ padding: '14px 20px' }}>Activity Date</th>
                  {isManager && <th style={{ padding: '14px 20px' }}>Staff Member</th>}
                  <th style={{ padding: '14px 20px' }}>Total Calls</th>
                  <th style={{ padding: '14px 20px' }}>Connected</th>
                  <th style={{ padding: '14px 20px', minWidth: '130px' }}>Connection Rate</th>
                  <th style={{ padding: '14px 20px' }}>Enquiries</th>
                  <th style={{ padding: '14px 20px' }}>Remarks</th>
                  <th style={{ padding: '14px 20px' }}>Cutoff Status</th>
                  <th style={{ padding: '14px 20px', textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredActivities.map((act) => {
                  const isLocked = act.is_locked && !isManager;
                  const rate = act.connection_rate || 0;
                  return (
                    <tr key={act.id}>
                      <td style={{ padding: '16px 20px', fontWeight: 700, color: 'var(--text-main)', whiteSpace: 'nowrap' }}>
                        <div>{act.activity_date}</div>
                        <div style={{ fontSize: '11.5px', color: 'var(--text-subtle)', fontWeight: 500 }}>
                          {formatDateLabel(act.activity_date)}
                        </div>
                      </td>

                      {isManager && (
                        <td style={{ padding: '16px 20px' }}>
                          <div style={{ fontWeight: 700 }}>{act.staff_name}</div>
                          <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{act.staff_code}</div>
                        </td>
                      )}

                      <td style={{ padding: '16px 20px' }}>
                        <span style={{ fontSize: '15px', fontWeight: 800, color: '#0284c7' }}>
                          {act.total_calls}
                        </span>
                      </td>

                      <td style={{ padding: '16px 20px' }}>
                        <span style={{ fontSize: '15px', fontWeight: 800, color: '#16a34a' }}>
                          {act.connected_calls}
                        </span>
                      </td>

                      <td style={{ padding: '16px 20px' }}>
                        <div style={{ minWidth: '100px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', fontWeight: 700, marginBottom: '4px' }}>
                            <span style={{ color: rate >= 65 ? '#15803d' : (rate >= 45 ? '#b45309' : '#b91c1c') }}>
                              {rate}%
                            </span>
                          </div>
                          <div className="progress-track" style={{ height: '6px', margin: 0 }}>
                            <div
                              className="progress-fill"
                              style={{
                                width: `${Math.min(100, rate)}%`,
                                background: rate >= 65 ? '#10b981' : (rate >= 45 ? '#f59e0b' : '#ef4444')
                              }}
                            />
                          </div>
                        </div>
                      </td>

                      <td style={{ padding: '16px 20px' }}>
                        <span style={{ fontSize: '15px', fontWeight: 800, color: '#8b5cf6' }}>
                          {act.total_enquiries}
                        </span>
                      </td>

                      <td style={{ padding: '16px 20px', maxWidth: '300px', fontSize: '12.5px', color: 'var(--text-muted)' }}>
                        {act.remarks ? (
                          <span>{act.remarks}</span>
                        ) : (
                          <span style={{ color: 'var(--text-subtle)', fontStyle: 'italic' }}>No notes provided</span>
                        )}
                      </td>

                      <td style={{ padding: '16px 20px' }}>
                        {act.is_locked ? (
                          <span className="badge badge-neutral" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '4px 8px' }}>
                            <Lock size={11} /> Locked
                          </span>
                        ) : (
                          <span className="badge badge-success" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '4px 8px' }}>
                            <CheckCircle2 size={11} /> Active
                          </span>
                        )}
                      </td>

                      <td style={{ padding: '16px 20px', textAlign: 'right' }}>
                        <button
                          type="button"
                          className="btn btn-secondary btn-sm"
                          onClick={() => handleEditRow(act)}
                          title={isLocked ? 'View activity' : 'Edit activity count'}
                          style={{ padding: '6px 12px' }}
                        >
                          <Edit2 size={12} style={{ marginRight: '4px' }} />
                          <span>{isLocked ? 'View' : 'Edit'}</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
