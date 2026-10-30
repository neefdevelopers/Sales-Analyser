// server/routes/returns.js
import { Router } from 'express';
import { query, get, run, transaction } from '../db.js';
import { authenticate } from '../auth.js';

const router = Router();

// GET all returns
router.get('/', authenticate, (req, res) => {
  const isManager = req.user.role === 'brand_manager';
  const { staffId, search, startDate, endDate, page = 1, limit = 50 } = req.query;

  let conditions = [];
  let params = [];

  if (!isManager) {
    conditions.push('r.staff_id = ?');
    params.push(req.user.id);
  } else if (staffId) {
    conditions.push('r.staff_id = ?');
    params.push(parseInt(staffId, 10));
  }

  if (search && search.trim()) {
    conditions.push('(r.return_number LIKE ? OR o.order_number LIKE ? OR c.name LIKE ? OR c.phone LIKE ? OR p.name LIKE ?)');
    const term = `%${search.trim()}%`;
    params.push(term, term, term, term, term);
  }

  if (startDate) {
    conditions.push('r.return_date >= ?');
    params.push(startDate);
  }
  if (endDate) {
    conditions.push('r.return_date <= ?');
    params.push(endDate);
  }

  const whereClause = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';

  const countRow = get(`
    SELECT COUNT(*) AS total
    FROM returns r
    JOIN orders o ON r.order_id = o.id
    JOIN customers c ON o.customer_id = c.id
    JOIN products p ON o.product_id = p.id
    ${whereClause}
  `, params);

  const total = countRow?.total || 0;
  const offset = (Math.max(1, parseInt(page, 10)) - 1) * parseInt(limit, 10);

  const sql = `
    SELECT
      r.id,
      r.return_number,
      r.order_id,
      r.staff_id,
      u.name AS staff_name,
      u.staff_id AS staff_code,
      r.return_quantity,
      r.return_amount,
      r.return_date,
      r.return_reason,
      r.remarks AS return_remarks,
      r.reversed_incentive,
      r.created_at,
      o.order_number,
      o.quantity AS original_order_quantity,
      o.total_amount AS original_order_amount,
      o.payment_method,
      o.incentive_amount AS original_order_incentive,
      c.name AS customer_name,
      c.phone AS customer_phone,
      p.name AS product_name,
      p.code AS product_code,
      p.price AS unit_price
    FROM returns r
    JOIN orders o ON r.order_id = o.id
    JOIN users u ON r.staff_id = u.id
    JOIN customers c ON o.customer_id = c.id
    JOIN products p ON o.product_id = p.id
    ${whereClause}
    ORDER BY r.return_date DESC, r.id DESC
    LIMIT ? OFFSET ?
  `;

  const returns = query(sql, [...params, parseInt(limit, 10), offset]);

  res.json({
    returns,
    pagination: {
      total,
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
      totalPages: Math.ceil(total / parseInt(limit, 10))
    }
  });
});

// POST calculate return preview (preview reversed incentive and refund amount)
router.post('/preview', authenticate, (req, res) => {
  const { order_id, return_quantity } = req.body;

  if (!order_id || !return_quantity) {
    return res.status(400).json({ error: 'order_id and return_quantity are required for preview.' });
  }

  const order = get(`
    SELECT
      o.*,
      COALESCE((SELECT SUM(r.return_quantity) FROM returns r WHERE r.order_id = o.id), 0) AS already_returned_qty
    FROM orders o
    WHERE o.id = ?
  `, [order_id]);

  if (!order) {
    return res.status(404).json({ error: 'Order not found.' });
  }

  const returnQty = parseInt(return_quantity, 10);
  if (isNaN(returnQty) || returnQty <= 0) {
    return res.status(400).json({ error: 'Return quantity must be at least 1.' });
  }

  const remaining = order.quantity - order.already_returned_qty;
  if (returnQty > remaining) {
    return res.status(400).json({
      error: `Cannot return ${returnQty} units. Only ${remaining} returnable units remain for order ${order.order_number}.`
    });
  }

  const returnAmount = Math.round(order.unit_price * returnQty * 100) / 100;
  
  // Calculate proportional reversed incentive
  let reversedIncentive = 0;
  if (order.incentive_amount > 0 && order.quantity > 0) {
    reversedIncentive = Math.round((returnQty / order.quantity) * order.incentive_amount * 100) / 100;
  }

  res.json({
    order_id: order.id,
    order_number: order.order_number,
    original_quantity: order.quantity,
    already_returned_quantity: order.already_returned_qty,
    remaining_returnable_quantity: remaining,
    return_quantity: returnQty,
    unit_price: order.unit_price,
    return_amount: returnAmount,
    reversed_incentive: reversedIncentive
  });
});

// POST process new return
router.post('/', authenticate, (req, res) => {
  const {
    order_id,
    return_quantity,
    return_date,
    return_reason,
    remarks = ''
  } = req.body;

  // 1. Validation
  if (!order_id) {
    return res.status(400).json({ error: 'Order selection is required.' });
  }

  const returnQty = parseInt(return_quantity, 10);
  if (isNaN(returnQty) || returnQty <= 0) {
    return res.status(400).json({ error: 'Return quantity must be a positive integer (at least 1).' });
  }

  if (!return_reason || !return_reason.trim()) {
    return res.status(400).json({ error: 'Return reason is required.' });
  }

  const returnDateStr = return_date ? return_date.trim() : new Date().toISOString().split('T')[0];
  if (!/^\d{4}-\d{2}-\d{2}$/.test(returnDateStr)) {
    return res.status(400).json({ error: 'Invalid return date format. Expected YYYY-MM-DD.' });
  }

  const isManager = req.user.role === 'brand_manager';

  try {
    const newReturnId = transaction(() => {
      // 2. Fetch order with current returned status inside transaction
      const order = get(`
        SELECT
          o.*,
          COALESCE((SELECT SUM(r.return_quantity) FROM returns r WHERE r.order_id = o.id), 0) AS already_returned_qty
        FROM orders o
        WHERE o.id = ?
      `, [order_id]);

      if (!order) {
        throw new Error('Order not found.');
      }

      // Authorization: Sales staff can only process returns on their own orders
      if (!isManager && order.staff_id !== req.user.id) {
        throw new Error('You are only authorized to process returns for your own orders.');
      }

      const remaining = order.quantity - order.already_returned_qty;
      if (remaining <= 0) {
        throw new Error(`Order ${order.order_number} has already been completely returned.`);
      }

      if (returnQty > remaining) {
        throw new Error(`Return quantity (${returnQty}) exceeds remaining returnable quantity (${remaining}).`);
      }

      // Calculate return value and reversed incentive
      const returnAmount = Math.round(order.unit_price * returnQty * 100) / 100;
      let reversedIncentive = 0;
      if (order.incentive_amount > 0 && order.quantity > 0) {
        reversedIncentive = Math.round((returnQty / order.quantity) * order.incentive_amount * 100) / 100;
      }

      // Generate unique return number: RET-YYYYMMDD-XXXX
      const dateFormatted = returnDateStr.replace(/-/g, '');
      const countToday = get("SELECT COUNT(*) AS c FROM returns WHERE return_number LIKE ?", [`RET-${dateFormatted}-%`]);
      const nextSeq = (countToday?.c || 0) + 1;
      const returnNumber = `RET-${dateFormatted}-${String(nextSeq).padStart(4, '0')}`;

      const now = new Date().toISOString();

      const result = run(
        `INSERT INTO returns (
          return_number, order_id, staff_id,
          return_quantity, return_amount, return_date,
          return_reason, remarks, reversed_incentive,
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          returnNumber,
          order.id,
          order.staff_id, // Attributed to original staff member
          returnQty,
          returnAmount,
          returnDateStr,
          return_reason.trim(),
          remarks ? remarks.trim() : null,
          reversedIncentive,
          now,
          now
        ]
      );

      return result.lastInsertRowid;
    });

    const createdReturn = get(`
      SELECT r.*, o.order_number, c.name AS customer_name, p.name AS product_name
      FROM returns r
      JOIN orders o ON r.order_id = o.id
      JOIN customers c ON o.customer_id = c.id
      JOIN products p ON o.product_id = p.id
      WHERE r.id = ?
    `, [newReturnId]);

    res.status(201).json({
      returnItem: createdReturn,
      message: `Return ${createdReturn.return_number} processed successfully.`
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

export default router;
