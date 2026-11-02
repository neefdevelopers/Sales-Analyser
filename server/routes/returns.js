// server/routes/returns.js
import { Router } from 'express';
import { query, get, run, transaction } from '../db.js';
import { authenticate } from '../auth.js';
import { calculateIncentive } from './products.js';

const router = Router();

/**
 * 1. GET Returns List
 * Brand Manager sees all returns.
 * Sales Staff sees only their own returns.
 * Columns: Return ID, Return Date, Returned By (Staff), Product, Payment Method, Returned Quantity.
 * Supports search, date, and payment method filters.
 */
router.get('/', authenticate, (req, res) => {
  const isManager = req.user.role === 'brand_manager';
  const { staffId, search, startDate, endDate, paymentMethod, page = 1, limit = 50 } = req.query;

  let conditions = [];
  let params = [];

  if (!isManager) {
    // Sales staff can view only their own return records
    conditions.push('(r.returned_by_staff_id = ? OR r.staff_id = ?)');
    params.push(req.user.id, req.user.id);
  } else if (staffId && staffId !== 'all') {
    conditions.push('(r.returned_by_staff_id = ? OR r.staff_id = ?)');
    params.push(parseInt(staffId, 10), parseInt(staffId, 10));
  }

  if (paymentMethod && paymentMethod !== 'all') {
    conditions.push('COALESCE(r.payment_method, o.payment_method, \'Prepaid\') = ?');
    params.push(paymentMethod);
  }

  if (search && search.trim()) {
    conditions.push('(r.return_number LIKE ? OR p.name LIKE ? OR p.code LIKE ? OR u_ret.name LIKE ? OR u_ret.staff_id LIKE ? OR COALESCE(r.payment_method, o.payment_method, \'Prepaid\') LIKE ?)');
    const term = `%${search.trim()}%`;
    params.push(term, term, term, term, term, term);
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
    LEFT JOIN orders o ON r.order_id = o.id
    LEFT JOIN products p ON COALESCE(r.product_id, o.product_id) = p.id
    LEFT JOIN users u_ret ON COALESCE(r.returned_by_staff_id, r.staff_id) = u_ret.id
    ${whereClause}
  `, params);

  const total = countRow?.total || 0;
  const offset = (Math.max(1, parseInt(page, 10)) - 1) * parseInt(limit, 10);

  const sql = `
    SELECT
      r.id,
      r.return_number,
      r.return_date,
      r.return_quantity,
      r.return_amount,
      r.reversed_incentive,
      r.order_id,
      r.staff_id,
      r.product_id,
      r.returned_by_staff_id,
      COALESCE(r.payment_method, o.payment_method, 'Prepaid') AS payment_method,
      r.return_reason,
      r.remarks,
      r.created_at,
      p.name AS product_name,
      p.code AS product_code,
      p.price AS unit_price,
      COALESCE(u_ret.name, u_order.name, 'Staff Member') AS returned_by_name,
      COALESCE(u_ret.staff_id, u_order.staff_id, '') AS returned_by_code,
      u_order.name AS staff_name,
      u_order.staff_id AS staff_code,
      COALESCE(o.order_number, '-') AS order_number,
      c.name AS customer_name,
      c.phone AS customer_phone
    FROM returns r
    LEFT JOIN orders o ON r.order_id = o.id
    LEFT JOIN products p ON COALESCE(r.product_id, o.product_id) = p.id
    LEFT JOIN users u_ret ON COALESCE(r.returned_by_staff_id, r.staff_id) = u_ret.id
    LEFT JOIN users u_order ON COALESCE(r.staff_id, o.staff_id) = u_order.id
    LEFT JOIN customers c ON o.customer_id = c.id
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

/**
 * 2. POST Preview Return (internal helper)
 */
router.post('/preview', authenticate, (req, res) => {
  const { order_id, product_id, payment_method, return_quantity, return_id } = req.body;

  const returnQty = parseInt(return_quantity, 10);
  if (isNaN(returnQty) || returnQty <= 0) {
    return res.status(400).json({ error: 'Return quantity must be at least 1.' });
  }

  if (order_id) {
    const excludeReturnId = return_id ? parseInt(return_id, 10) : 0;
    const order = get(`
      SELECT
        o.*,
        COALESCE((SELECT SUM(r.return_quantity) FROM returns r WHERE r.order_id = o.id AND r.id != ?), 0) AS already_returned_qty
      FROM orders o
      WHERE o.id = ?
    `, [excludeReturnId, order_id]);

    if (!order) {
      return res.status(404).json({ error: 'Order not found.' });
    }

    const remaining = order.quantity - order.already_returned_qty;
    if (returnQty > remaining) {
      return res.status(400).json({
        error: `Cannot return ${returnQty} units. Only ${remaining} returnable units remain for order ${order.order_number}.`
      });
    }

    const returnAmount = Math.round(order.unit_price * returnQty * 100) / 100;
    let reversedIncentive = 0;
    if (order.incentive_amount > 0 && order.quantity > 0) {
      reversedIncentive = Math.round((returnQty / order.quantity) * order.incentive_amount * 100) / 100;
    }

    return res.json({
      order_id: order.id,
      order_number: order.order_number,
      payment_method: order.payment_method,
      original_quantity: order.quantity,
      already_returned_quantity: order.already_returned_qty,
      remaining_returnable_quantity: remaining,
      return_quantity: returnQty,
      unit_price: order.unit_price,
      return_amount: returnAmount,
      reversed_incentive: reversedIncentive
    });
  }

  // Standalone product preview (when no order_id provided)
  const resolvedProductId = product_id ? parseInt(product_id, 10) : null;
  if (!resolvedProductId) {
    return res.status(400).json({ error: 'Product selection is required.' });
  }

  const product = get('SELECT * FROM products WHERE id = ?', [resolvedProductId]);
  if (!product) {
    return res.status(404).json({ error: 'Product not found.' });
  }

  const finalPaymentMethod = (payment_method && ['Prepaid', 'COD'].includes(payment_method)) ? payment_method : 'Prepaid';
  const unitPrice = product.price || 0;
  const returnAmount = Math.round(unitPrice * returnQty * 100) / 100;
  const incObj = calculateIncentive(product, finalPaymentMethod, returnQty, returnAmount);

  res.json({
    order_id: null,
    order_number: '-',
    product_id: product.id,
    product_name: product.name,
    payment_method: finalPaymentMethod,
    return_quantity: returnQty,
    unit_price: unitPrice,
    return_amount: returnAmount,
    reversed_incentive: incObj.amount
  });
});

/**
 * 3. POST Process New Return (Minimal Return Creation)
 * Input:
 * - product_id (required)
 * - payment_method (optional, Prepaid or COD, defaults to Prepaid)
 * - return_quantity (required, positive integer)
 * - order_id (optional)
 * 
 * Automatically captures logged-in user as returned_by_staff_id.
 * Calculates refund amount and incentive reversal automatically.
 */
router.post('/', authenticate, (req, res) => {
  const {
    order_id,
    product_id,
    payment_method,
    return_quantity,
    return_date,
    return_reason,
    remarks,
    staff_id
  } = req.body;

  const returnQty = parseInt(return_quantity, 10);
  if (isNaN(returnQty) || returnQty <= 0) {
    return res.status(400).json({ error: 'Return quantity must be a positive integer (at least 1).' });
  }

  const isManager = req.user.role === 'brand_manager';

  try {
    const newReturnId = transaction(() => {
      let linkedOrderId = null;
      let linkedStaffId = req.user.id;

      if (isManager && staff_id) {
        const targetStaff = get('SELECT id, status FROM users WHERE id = ?', [staff_id]);
        if (!targetStaff) {
          throw new Error('Assigned staff member not found.');
        }
        if (targetStaff.status !== 'active') {
          throw new Error('Cannot assign return to an inactive staff member.');
        }
        linkedStaffId = targetStaff.id;
      }

      let resolvedProductId = product_id ? parseInt(product_id, 10) : null;
      let finalPaymentMethod = (payment_method && ['Prepaid', 'COD'].includes(payment_method))
        ? payment_method
        : 'Prepaid';
      let returnAmount = 0;
      let reversedIncentive = 0;

      if (order_id) {
        const order = get(`
          SELECT
            o.*,
            COALESCE((SELECT SUM(r.return_quantity) FROM returns r WHERE r.order_id = o.id), 0) AS already_returned_qty
          FROM orders o
          WHERE o.id = ?
        `, [order_id]);

        if (!order) {
          throw new Error('Original order not found.');
        }

        // Authorization: Sales staff can only process returns on their own orders if order_id specified
        if (!isManager && order.staff_id !== req.user.id) {
          throw new Error('You are only authorized to process returns for your own orders.');
        }

        if (order.status === 'Cancelled') {
          throw new Error('Cannot process returns for a cancelled order.');
        }

        const remaining = order.quantity - order.already_returned_qty;
        if (remaining <= 0) {
          throw new Error(`Order ${order.order_number} has already been completely returned.`);
        }

        if (returnQty > remaining) {
          throw new Error(`Return quantity (${returnQty}) exceeds remaining returnable quantity (${remaining}).`);
        }

        linkedOrderId = order.id;
        linkedStaffId = order.staff_id;
        resolvedProductId = resolvedProductId || order.product_id;
        finalPaymentMethod = (payment_method && ['Prepaid', 'COD'].includes(payment_method))
          ? payment_method
          : (order.payment_method || 'Prepaid');

        returnAmount = Math.round(order.unit_price * returnQty * 100) / 100;
        if (order.incentive_amount > 0 && order.quantity > 0) {
          reversedIncentive = Math.round((returnQty / order.quantity) * order.incentive_amount * 100) / 100;
        }
      } else {
        // No order_id: product selection is required
        if (!resolvedProductId) {
          throw new Error('Product selection is required.');
        }

        const product = get('SELECT * FROM products WHERE id = ?', [resolvedProductId]);
        if (!product) {
          throw new Error('Selected product not found.');
        }

        // Check if an eligible order exists for this staff member to link against
        const candidateOrder = get(`
          SELECT o.*,
            COALESCE((SELECT SUM(r.return_quantity) FROM returns r WHERE r.order_id = o.id), 0) AS already_returned_qty
          FROM orders o
          WHERE o.staff_id = ? AND o.product_id = ? AND o.payment_method = ? AND o.status != 'Cancelled'
            AND o.quantity > COALESCE((SELECT SUM(r.return_quantity) FROM returns r WHERE r.order_id = o.id), 0)
          ORDER BY o.order_date DESC, o.id DESC
          LIMIT 1
        `, [linkedStaffId, product.id, finalPaymentMethod]);

        if (candidateOrder && (candidateOrder.quantity - candidateOrder.already_returned_qty) >= returnQty) {
          linkedOrderId = candidateOrder.id;
          linkedStaffId = candidateOrder.staff_id;
          returnAmount = Math.round(candidateOrder.unit_price * returnQty * 100) / 100;
          if (candidateOrder.incentive_amount > 0 && candidateOrder.quantity > 0) {
            reversedIncentive = Math.round((returnQty / candidateOrder.quantity) * candidateOrder.incentive_amount * 100) / 100;
          }
        } else {
          linkedOrderId = null;
          // Keep linkedStaffId as established above
          const unitPrice = product.price || 0;
          returnAmount = Math.round(unitPrice * returnQty * 100) / 100;
          const incObj = calculateIncentive(product, finalPaymentMethod, returnQty, returnAmount);
          reversedIncentive = incObj.amount;
        }
      }

      // Unique return number: RET-YYYYMMDD-XXXX
      const todayDate = new Date().toISOString().split('T')[0];
      const returnDateStr = (return_date && /^\d{4}-\d{2}-\d{2}$/.test(String(return_date).trim()))
        ? String(return_date).trim()
        : todayDate;
      const finalReturnReason = (return_reason && String(return_reason).trim())
        ? String(return_reason).trim()
        : 'Product Return';
      const finalRemarks = remarks ? String(remarks).trim() : null;

      const dateFormatted = returnDateStr.replace(/-/g, '');
      const countToday = get("SELECT COUNT(*) AS c FROM returns WHERE return_number LIKE ?", [`RET-${dateFormatted}-%`]);
      const nextSeq = (countToday?.c || 0) + 1;
      const returnNumber = `RET-${dateFormatted}-${String(nextSeq).padStart(4, '0')}`;

      const now = new Date().toISOString();

      const result = run(
        `INSERT INTO returns (
          return_number, order_id, staff_id, product_id, returned_by_staff_id, payment_method,
          return_quantity, return_amount, return_date,
          return_reason, remarks, reversed_incentive,
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          returnNumber,
          linkedOrderId,
          linkedStaffId,
          resolvedProductId,
          req.user.id,
          finalPaymentMethod,
          returnQty,
          returnAmount,
          returnDateStr,
          finalReturnReason,
          finalRemarks,
          reversedIncentive,
          now,
          now
        ]
      );

      return result.lastInsertRowid;
    });

    const createdReturn = get(`
      SELECT
        r.id,
        r.return_number,
        r.return_date,
        r.return_quantity,
        r.return_amount,
        r.reversed_incentive,
        r.order_id,
        r.staff_id,
        r.product_id,
        COALESCE(r.payment_method, o.payment_method, 'Prepaid') AS payment_method,
        r.return_reason,
        r.remarks,
        p.name AS product_name,
        p.code AS product_code,
        u.name AS returned_by_name,
        u.staff_id AS returned_by_code
      FROM returns r
      LEFT JOIN orders o ON r.order_id = o.id
      JOIN products p ON r.product_id = p.id
      JOIN users u ON COALESCE(r.returned_by_staff_id, r.staff_id) = u.id
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

// PUT edit existing return (Brand Manager can edit all, Staff can edit own)
router.put('/:id', authenticate, (req, res) => {
  const isManager = req.user.role === 'brand_manager';
  const returnId = parseInt(req.params.id, 10);

  const existingReturn = get(`
    SELECT r.*, o.quantity AS order_qty, o.unit_price AS order_unit_price, o.incentive_amount AS order_incentive_amount, o.order_number
    FROM returns r
    LEFT JOIN orders o ON r.order_id = o.id
    WHERE r.id = ?
  `, [returnId]);

  if (!existingReturn) {
    return res.status(404).json({ error: 'Return record not found.' });
  }

  // Authorization: Sales staff can only edit their own returns
  if (!isManager && existingReturn.staff_id !== req.user.id && existingReturn.returned_by_staff_id !== req.user.id) {
    return res.status(403).json({ error: 'You are only authorized to edit your own returns.' });
  }

  const {
    staff_id,
    return_quantity,
    return_date,
    payment_method,
    return_reason,
    remarks
  } = req.body;

  let targetStaffId = existingReturn.staff_id;
  if (isManager && staff_id) {
    const assignedStaff = get('SELECT id, status FROM users WHERE id = ?', [staff_id]);
    if (!assignedStaff) {
      return res.status(404).json({ error: 'Assigned staff member not found.' });
    }
    targetStaffId = assignedStaff.id;
  }

  const newReturnQty = return_quantity !== undefined ? parseInt(return_quantity, 10) : existingReturn.return_quantity;
  if (isNaN(newReturnQty) || newReturnQty <= 0) {
    return res.status(400).json({ error: 'Return quantity must be a positive integer (at least 1).' });
  }

  const finalPaymentMethod = (payment_method && ['Prepaid', 'COD'].includes(payment_method))
    ? payment_method
    : (existingReturn.payment_method || 'Prepaid');

  const returnDateStr = (return_date && /^\d{4}-\d{2}-\d{2}$/.test(return_date.trim()))
    ? return_date.trim()
    : existingReturn.return_date;

  let returnAmount = 0;
  let reversedIncentive = 0;

  try {
    if (existingReturn.order_id) {
      // Check against order remaining quantity
      const order = get('SELECT * FROM orders WHERE id = ?', [existingReturn.order_id]);
      if (!order) {
        return res.status(404).json({ error: 'Linked order not found.' });
      }

      const otherReturns = get(`
        SELECT COALESCE(SUM(return_quantity), 0) AS total
        FROM returns
        WHERE order_id = ? AND id != ?
      `, [existingReturn.order_id, existingReturn.id]);

      const otherQty = otherReturns?.total || 0;
      const remainingForThis = order.quantity - otherQty;

      if (newReturnQty > remainingForThis) {
        return res.status(400).json({
          error: `Return quantity (${newReturnQty}) exceeds remaining returnable quantity (${remainingForThis}) for order ${order.order_number}.`
        });
      }

      returnAmount = Math.round(order.unit_price * newReturnQty * 100) / 100;
      if (order.incentive_amount > 0 && order.quantity > 0) {
        reversedIncentive = Math.round((newReturnQty / order.quantity) * order.incentive_amount * 100) / 100;
      }
    } else {
      // Standalone return
      const product = get('SELECT * FROM products WHERE id = ?', [existingReturn.product_id]);
      const unitPrice = product?.price || 0;
      returnAmount = Math.round(unitPrice * newReturnQty * 100) / 100;
      if (product) {
        const incObj = calculateIncentive(product, finalPaymentMethod, newReturnQty, returnAmount);
        reversedIncentive = incObj.amount;
      }
    }

    const now = new Date().toISOString();

    run(`
      UPDATE returns SET
        staff_id = ?,
        return_quantity = ?,
        return_amount = ?,
        reversed_incentive = ?,
        return_date = ?,
        payment_method = ?,
        return_reason = ?,
        remarks = ?,
        updated_at = ?
      WHERE id = ?
    `, [
      targetStaffId,
      newReturnQty,
      returnAmount,
      reversedIncentive,
      returnDateStr,
      finalPaymentMethod,
      return_reason || existingReturn.return_reason || 'Product Return',
      remarks !== undefined ? remarks : existingReturn.remarks,
      now,
      existingReturn.id
    ]);

    const updatedReturn = get(`
      SELECT
        r.id,
        r.return_number,
        r.return_date,
        r.return_quantity,
        r.return_amount,
        r.reversed_incentive,
        r.order_id,
        r.staff_id,
        r.product_id,
        COALESCE(r.payment_method, o.payment_method, 'Prepaid') AS payment_method,
        r.return_reason,
        r.remarks,
        p.name AS product_name,
        p.code AS product_code,
        u.name AS returned_by_name,
        u.staff_id AS returned_by_code,
        u_order.name AS staff_name,
        u_order.staff_id AS staff_code
      FROM returns r
      LEFT JOIN orders o ON r.order_id = o.id
      JOIN products p ON r.product_id = p.id
      JOIN users u ON COALESCE(r.returned_by_staff_id, r.staff_id) = u.id
      LEFT JOIN users u_order ON r.staff_id = u_order.id
      WHERE r.id = ?
    `, [existingReturn.id]);

    res.json({
      returnItem: updatedReturn,
      message: `Return ${updatedReturn.return_number} updated successfully.`
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

export default router;
