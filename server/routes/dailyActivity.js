// server/routes/dailyActivity.js
import { Router } from 'express';
import { query, get, run } from '../db.js';
import { authenticate } from '../auth.js';
import { checkActivityDeadline, getNowInBusinessTimezone } from '../timezone.js';

const router = Router();

// GET daily activity logs
// Sales staff sees their own; Brand manager can see all or filter by staffId
router.get('/', authenticate, (req, res) => {
  const isManager = req.user.role === 'brand_manager';
  const { staffId, startDate, endDate } = req.query;

  const nowInfo = getNowInBusinessTimezone();
  const defaultStart = `${nowInfo.year}-${String(nowInfo.month).padStart(2, '0')}-01`;
  const sDate = startDate || defaultStart;
  const eDate = endDate || nowInfo.dateStr;

  let filterSql = 'WHERE da.activity_date >= ? AND da.activity_date <= ?';
  let params = [sDate, eDate];

  if (!isManager) {
    // Sales staff can only view their own
    filterSql += ' AND da.staff_id = ?';
    params.push(req.user.id);
  } else if (staffId && staffId !== 'all') {
    filterSql += ' AND da.staff_id = ?';
    params.push(parseInt(staffId, 10));
  }

  const activities = query(`
    SELECT
      da.id,
      da.staff_id,
      da.activity_date,
      da.total_calls,
      da.connected_calls,
      da.total_enquiries,
      da.remarks,
      da.created_at,
      da.updated_at,
      u.name AS staff_name,
      u.staff_id AS staff_code
    FROM daily_activities da
    JOIN users u ON da.staff_id = u.id
    ${filterSql}
    ORDER BY da.activity_date DESC, da.id DESC
  `, params).map(row => {
    const deadline = checkActivityDeadline(row.activity_date);
    const connRate = row.total_calls > 0 ? Math.round((row.connected_calls / row.total_calls) * 1000) / 10 : 0;
    return {
      ...row,
      connection_rate: connRate,
      is_locked: deadline.isLocked,
      deadline_info: deadline
    };
  });

  res.json({
    activities,
    dateRange: { startDate: sDate, endDate: eDate },
    serverTime: nowInfo
  });
});

// GET status for Today and Yesterday (quick indicator for staff entry)
router.get('/status', authenticate, (req, res) => {
  const isManager = req.user.role === 'brand_manager';
  const targetStaffId = isManager && req.query.staffId ? parseInt(req.query.staffId, 10) : req.user.id;

  const nowInfo = getNowInBusinessTimezone();
  const todayStr = nowInfo.dateStr;

  // Yesterday in business timezone
  const yestDateObj = new Date(Date.UTC(nowInfo.year, nowInfo.month - 1, nowInfo.day));
  yestDateObj.setUTCDate(yestDateObj.getUTCDate() - 1);
  const yestStr = yestDateObj.toISOString().split('T')[0];

  const todayRecord = get(
    'SELECT * FROM daily_activities WHERE staff_id = ? AND activity_date = ?',
    [targetStaffId, todayStr]
  );

  const yestRecord = get(
    'SELECT * FROM daily_activities WHERE staff_id = ? AND activity_date = ?',
    [targetStaffId, yestStr]
  );

  const todayDeadline = checkActivityDeadline(todayStr);
  const yestDeadline = checkActivityDeadline(yestStr);

  res.json({
    currentTime: nowInfo,
    today: {
      date: todayStr,
      hasLogged: !!todayRecord,
      record: todayRecord || null,
      deadline: todayDeadline
    },
    yesterday: {
      date: yestStr,
      hasLogged: !!yestRecord,
      record: yestRecord || null,
      deadline: yestDeadline
    }
  });
});

// POST create or update daily activity count entry
router.post('/', authenticate, (req, res) => {
  const isManager = req.user.role === 'brand_manager';
  const { activity_date, total_calls, connected_calls, total_enquiries, remarks, staff_id } = req.body;

  // Resolve staff ID
  let targetStaffId = req.user.id;
  if (isManager && staff_id) {
    targetStaffId = parseInt(staff_id, 10);
  }

  // 1. Validate activity date format
  if (!activity_date || !/^\d{4}-\d{2}-\d{2}$/.test(activity_date)) {
    return res.status(400).json({ error: 'Valid activity date (YYYY-MM-DD) is required.' });
  }

  // 2. Validate 9:30 AM next-day cutoff rule (managers can be exempt if needed, but staff strictly enforced)
  const deadlineCheck = checkActivityDeadline(activity_date);
  if (!isManager && !deadlineCheck.allowed) {
    return res.status(422).json({
      error: deadlineCheck.message,
      deadlineInfo: deadlineCheck
    });
  }

  // 3. Validate numbers
  const calls = parseInt(total_calls || 0, 10);
  const connected = parseInt(connected_calls || 0, 10);
  const enquiries = parseInt(total_enquiries || 0, 10);

  if (isNaN(calls) || calls < 0) {
    return res.status(400).json({ error: 'Total calls count must be a non-negative integer.' });
  }
  if (isNaN(connected) || connected < 0) {
    return res.status(400).json({ error: 'Connected calls count must be a non-negative integer.' });
  }
  if (connected > calls) {
    return res.status(400).json({ error: 'Connected calls count cannot exceed total calls count.' });
  }
  if (isNaN(enquiries) || enquiries < 0) {
    return res.status(400).json({ error: 'Total enquiries count must be a non-negative integer.' });
  }

  const nowIso = new Date().toISOString();
  const cleanRemarks = remarks ? String(remarks).trim() : null;

  // 4. Upsert record for (staff_id, activity_date)
  const existing = get(
    'SELECT id FROM daily_activities WHERE staff_id = ? AND activity_date = ?',
    [targetStaffId, activity_date]
  );

  let recordId;
  if (existing) {
    run(`
      UPDATE daily_activities
      SET total_calls = ?, connected_calls = ?, total_enquiries = ?, remarks = ?, updated_at = ?
      WHERE id = ?
    `, [calls, connected, enquiries, cleanRemarks, nowIso, existing.id]);
    recordId = existing.id;
  } else {
    const result = run(`
      INSERT INTO daily_activities (staff_id, activity_date, total_calls, connected_calls, total_enquiries, remarks, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [targetStaffId, activity_date, calls, connected, enquiries, cleanRemarks, nowIso, nowIso]);
    recordId = result.lastInsertRowid;
  }

  const savedRecord = get(`
    SELECT
      da.*,
      u.name AS staff_name,
      u.staff_id AS staff_code
    FROM daily_activities da
    JOIN users u ON da.staff_id = u.id
    WHERE da.id = ?
  `, [recordId]);

  res.status(existing ? 200 : 210).json({
    message: existing ? 'Daily activity count updated successfully.' : 'Daily activity count logged successfully.',
    activity: savedRecord,
    deadlineInfo: deadlineCheck
  });
});

export default router;
