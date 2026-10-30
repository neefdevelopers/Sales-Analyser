// server/routes/enquiries.js
import { Router } from 'express';
import { query, get, run } from '../db.js';
import { authenticate } from '../auth.js';
import { checkActivityDeadline } from '../timezone.js';
import { normalizePhone } from './orders.js';

const router = Router();

// GET enquiries (Sales Staff see their own; Brand Manager sees all)
router.get('/', authenticate, (req, res) => {
  const isManager = req.user.role === 'brand_manager';
  const { staffId, search, status, startDate, endDate, page = 1, limit = 50 } = req.query;

  let conditions = [];
  let params = [];

  if (!isManager) {
    conditions.push('e.staff_id = ?');
    params.push(req.user.id);
  } else if (staffId) {
    conditions.push('e.staff_id = ?');
    params.push(parseInt(staffId, 10));
  }

  if (search && search.trim()) {
    conditions.push('(e.customer_name LIKE ? OR e.customer_phone LIKE ? OR p.name LIKE ?)');
    const term = `%${search.trim()}%`;
    params.push(term, term, term);
  }

  if (status && status !== 'all') {
    conditions.push('e.status = ?');
    params.push(status);
  }

  if (startDate) {
    conditions.push('e.enquiry_date >= ?');
    params.push(startDate);
  }
  if (endDate) {
    conditions.push('e.enquiry_date <= ?');
    params.push(endDate);
  }

  const whereClause = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';

  const countRow = get(`
    SELECT COUNT(*) AS total
    FROM enquiries e
    LEFT JOIN products p ON e.product_id = p.id
    ${whereClause}
  `, params);

  const total = countRow?.total || 0;
  const offset = (Math.max(1, parseInt(page, 10)) - 1) * parseInt(limit, 10);

  const sql = `
    SELECT
      e.id,
      e.staff_id,
      u.name AS staff_name,
      u.staff_id AS staff_code,
      e.customer_name,
      e.customer_phone,
      e.product_id,
      p.name AS product_name,
      e.enquiry_date,
      e.status,
      e.follow_up_date,
      e.remarks,
      e.converted_order_id,
      o.order_number AS converted_order_number,
      e.created_at,
      e.updated_at
    FROM enquiries e
    JOIN users u ON e.staff_id = u.id
    LEFT JOIN products p ON e.product_id = p.id
    LEFT JOIN orders o ON e.converted_order_id = o.id
    ${whereClause}
    ORDER BY e.enquiry_date DESC, e.id DESC
    LIMIT ? OFFSET ?
  `;

  const enquiries = query(sql, [...params, parseInt(limit, 10), offset]);

  // Augment with deadline status indicator
  const augmented = enquiries.map(item => {
    const deadlineCheck = checkActivityDeadline(item.enquiry_date);
    return {
      ...item,
      is_locked: deadlineCheck.isLocked,
      deadline_message: deadlineCheck.message
    };
  });

  res.json({
    enquiries: augmented,
    pagination: {
      total,
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
      totalPages: Math.ceil(total / parseInt(limit, 10))
    }
  });
});

// POST create enquiry
router.post('/', authenticate, (req, res) => {
  const {
    customer_name,
    customer_phone,
    product_id = null,
    enquiry_date,
    status = 'New',
    follow_up_date = null,
    remarks = ''
  } = req.body;

  if (!customer_name || !customer_name.trim()) {
    return res.status(400).json({ error: 'Customer name is required.' });
  }
  if (!customer_phone || !customer_phone.trim()) {
    return res.status(400).json({ error: 'Customer phone is required.' });
  }

  const enquiryDateStr = enquiry_date ? enquiry_date.trim() : new Date().toISOString().split('T')[0];

  // 9:30 AM daily activity deadline enforcement on backend
  const deadlineCheck = checkActivityDeadline(enquiryDateStr);
  if (!deadlineCheck.allowed) {
    return res.status(422).json({
      error: deadlineCheck.message,
      deadlinePassed: deadlineCheck.isLocked,
      currentTime: deadlineCheck.currentTime,
      deadline: deadlineCheck.deadline
    });
  }

  const staffId = req.user.id;
  const now = new Date().toISOString();

  try {
    const result = run(
      `INSERT INTO enquiries (
        staff_id, customer_name, customer_phone, product_id,
        enquiry_date, status, follow_up_date, remarks,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        staffId,
        customer_name.trim(),
        normalizePhone(customer_phone),
        product_id ? parseInt(product_id, 10) : null,
        enquiryDateStr,
        status,
        follow_up_date || null,
        remarks ? remarks.trim() : null,
        now,
        now
      ]
    );

    const created = get(`
      SELECT e.*, p.name AS product_name
      FROM enquiries e
      LEFT JOIN products p ON e.product_id = p.id
      WHERE e.id = ?
    `, [result.lastInsertRowid]);

    res.status(201).json({ enquiry: created, message: 'Enquiry recorded successfully.' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to record enquiry: ' + err.message });
  }
});

// PUT update enquiry
router.put('/:id', authenticate, (req, res) => {
  const enquiryId = parseInt(req.params.id, 10);
  const existing = get('SELECT * FROM enquiries WHERE id = ?', [enquiryId]);

  if (!existing) {
    return res.status(404).json({ error: 'Enquiry not found.' });
  }

  const isManager = req.user.role === 'brand_manager';
  if (!isManager && existing.staff_id !== req.user.id) {
    return res.status(403).json({ error: 'You are only authorized to update your own enquiries.' });
  }

  // Check deadline on existing enquiry date
  const deadlineCheck = checkActivityDeadline(existing.enquiry_date);
  if (!deadlineCheck.allowed) {
    return res.status(422).json({
      error: `Cannot edit this enquiry. ${deadlineCheck.message}`,
      deadlinePassed: deadlineCheck.isLocked
    });
  }

  const {
    customer_name,
    customer_phone,
    product_id,
    status,
    follow_up_date,
    remarks
  } = req.body;

  const now = new Date().toISOString();

  try {
    run(
      `UPDATE enquiries SET
        customer_name = ?,
        customer_phone = ?,
        product_id = ?,
        status = ?,
        follow_up_date = ?,
        remarks = ?,
        updated_at = ?
      WHERE id = ?`,
      [
        customer_name !== undefined ? customer_name.trim() : existing.customer_name,
        customer_phone !== undefined ? normalizePhone(customer_phone) : existing.customer_phone,
        product_id !== undefined ? (product_id ? parseInt(product_id, 10) : null) : existing.product_id,
        status !== undefined ? status : existing.status,
        follow_up_date !== undefined ? (follow_up_date || null) : existing.follow_up_date,
        remarks !== undefined ? (remarks ? remarks.trim() : null) : existing.remarks,
        now,
        enquiryId
      ]
    );

    const updated = get(`
      SELECT e.*, p.name AS product_name
      FROM enquiries e
      LEFT JOIN products p ON e.product_id = p.id
      WHERE e.id = ?
    `, [enquiryId]);

    res.json({ enquiry: updated, message: 'Enquiry updated successfully.' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update enquiry: ' + err.message });
  }
});

export default router;
