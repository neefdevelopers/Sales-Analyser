// server/routes/calls.js
import { Router } from 'express';
import { query, get, run } from '../db.js';
import { authenticate } from '../auth.js';
import { checkActivityDeadline } from '../timezone.js';
import { normalizePhone } from './orders.js';

const router = Router();

// GET call logs
router.get('/', authenticate, (req, res) => {
  const isManager = req.user.role === 'brand_manager';
  const { staffId, search, outcome, startDate, endDate, page = 1, limit = 50 } = req.query;

  let conditions = [];
  let params = [];

  if (!isManager) {
    conditions.push('c.staff_id = ?');
    params.push(req.user.id);
  } else if (staffId) {
    conditions.push('c.staff_id = ?');
    params.push(parseInt(staffId, 10));
  }

  if (search && search.trim()) {
    conditions.push('(c.customer_name LIKE ? OR c.customer_phone LIKE ?)');
    const term = `%${search.trim()}%`;
    params.push(term, term);
  }

  if (outcome && outcome !== 'all') {
    conditions.push('c.outcome = ?');
    params.push(outcome);
  }

  if (startDate) {
    conditions.push('c.call_date >= ?');
    params.push(startDate);
  }
  if (endDate) {
    conditions.push('c.call_date <= ?');
    params.push(endDate);
  }

  const whereClause = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';

  const countRow = get(`SELECT COUNT(*) AS total FROM calls c ${whereClause}`, params);
  const total = countRow?.total || 0;
  const offset = (Math.max(1, parseInt(page, 10)) - 1) * parseInt(limit, 10);

  const sql = `
    SELECT
      c.id,
      c.staff_id,
      u.name AS staff_name,
      u.staff_id AS staff_code,
      c.customer_name,
      c.customer_phone,
      c.enquiry_id,
      c.call_date,
      c.call_time,
      c.outcome,
      c.remarks,
      c.created_at,
      c.updated_at
    FROM calls c
    JOIN users u ON c.staff_id = u.id
    ${whereClause}
    ORDER BY c.call_date DESC, c.call_time DESC, c.id DESC
    LIMIT ? OFFSET ?
  `;

  const calls = query(sql, [...params, parseInt(limit, 10), offset]);

  // Augment with deadline status indicator
  const augmented = calls.map(item => {
    const deadlineCheck = checkActivityDeadline(item.call_date);
    return {
      ...item,
      is_locked: deadlineCheck.isLocked,
      deadline_message: deadlineCheck.message
    };
  });

  res.json({
    calls: augmented,
    pagination: {
      total,
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
      totalPages: Math.ceil(total / parseInt(limit, 10))
    }
  });
});

// POST log a call
router.post('/', authenticate, (req, res) => {
  const {
    customer_name,
    customer_phone,
    enquiry_id = null,
    call_date,
    call_time,
    outcome,
    remarks = ''
  } = req.body;

  if (!customer_name || !customer_name.trim()) {
    return res.status(400).json({ error: 'Customer name or reference is required.' });
  }
  if (!customer_phone || !customer_phone.trim()) {
    return res.status(400).json({ error: 'Customer phone number is required.' });
  }

  const validOutcomes = ['Connected', 'Not Answered', 'Busy', 'Follow-up Required'];
  if (!outcome || !validOutcomes.includes(outcome)) {
    return res.status(400).json({ error: `Call outcome must be one of: ${validOutcomes.join(', ')}` });
  }

  const callDateStr = call_date ? call_date.trim() : new Date().toISOString().split('T')[0];
  const callTimeStr = call_time ? call_time.trim() : new Date().toTimeString().split(' ')[0];

  // 9:30 AM daily activity deadline enforcement on backend
  const deadlineCheck = checkActivityDeadline(callDateStr);
  if (!deadlineCheck.allowed) {
    return res.status(422).json({
      error: deadlineCheck.message,
      deadlinePassed: deadlineCheck.isLocked,
      currentTime: deadlineCheck.currentTime,
      deadline: deadlineCheck.deadline
    });
  }

  const staffId = req.user.id;
  const cleanPhone = normalizePhone(customer_phone);

  // Prevent accidental duplicate submission within identical minute
  const duplicate = get(
    `SELECT id FROM calls
     WHERE staff_id = ? AND customer_phone = ? AND call_date = ? AND call_time = ?`,
    [staffId, cleanPhone, callDateStr, callTimeStr]
  );
  if (duplicate) {
    return res.status(400).json({ error: 'Duplicate call log detected with identical timestamp and recipient.' });
  }

  const now = new Date().toISOString();

  try {
    const result = run(
      `INSERT INTO calls (
        staff_id, customer_name, customer_phone, enquiry_id,
        call_date, call_time, outcome, remarks,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        staffId,
        customer_name.trim(),
        cleanPhone,
        enquiry_id ? parseInt(enquiry_id, 10) : null,
        callDateStr,
        callTimeStr,
        outcome,
        remarks ? remarks.trim() : null,
        now,
        now
      ]
    );

    const created = get('SELECT * FROM calls WHERE id = ?', [result.lastInsertRowid]);
    res.status(201).json({ call: created, message: 'Call log saved successfully.' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to record call: ' + err.message });
  }
});

// PUT update a call log
router.put('/:id', authenticate, (req, res) => {
  const callId = parseInt(req.params.id, 10);
  const existing = get('SELECT * FROM calls WHERE id = ?', [callId]);

  if (!existing) {
    return res.status(404).json({ error: 'Call log not found.' });
  }

  const isManager = req.user.role === 'brand_manager';
  if (!isManager && existing.staff_id !== req.user.id) {
    return res.status(403).json({ error: 'You are only authorized to update your own call logs.' });
  }

  // Check deadline on existing call date
  const deadlineCheck = checkActivityDeadline(existing.call_date);
  if (!deadlineCheck.allowed) {
    return res.status(422).json({
      error: `Cannot edit this call record. ${deadlineCheck.message}`,
      deadlinePassed: deadlineCheck.isLocked
    });
  }

  const { customer_name, customer_phone, outcome, remarks } = req.body;
  const now = new Date().toISOString();

  try {
    run(
      `UPDATE calls SET
        customer_name = ?,
        customer_phone = ?,
        outcome = ?,
        remarks = ?,
        updated_at = ?
      WHERE id = ?`,
      [
        customer_name !== undefined ? customer_name.trim() : existing.customer_name,
        customer_phone !== undefined ? normalizePhone(customer_phone) : existing.customer_phone,
        outcome !== undefined ? outcome : existing.outcome,
        remarks !== undefined ? (remarks ? remarks.trim() : null) : existing.remarks,
        now,
        callId
      ]
    );

    const updated = get('SELECT * FROM calls WHERE id = ?', [callId]);
    res.json({ call: updated, message: 'Call log updated successfully.' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update call log: ' + err.message });
  }
});

export default router;
