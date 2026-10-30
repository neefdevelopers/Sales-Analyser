// server/routes/incentives.js
import { Router } from 'express';
import { query, get } from '../db.js';
import { authenticate, requireRole } from '../auth.js';

const router = Router();

// Helper to format rule description
function formatIncentiveRule(type, basis, rate) {
  if (type === 'fixed') {
    return `Fixed ₹${rate} / ${basis === 'per_unit' ? 'unit' : 'order'}`;
  } else {
    return `${rate}% / ${basis === 'per_unit' ? 'unit price' : 'order'}`;
  }
}

// GET all incentive records (Brand Manager only)
// Query params: staffId, productId, paymentMethod, startDate, endDate, search, page, limit
router.get('/', authenticate, requireRole('brand_manager'), (req, res) => {
  const {
    staffId,
    productId,
    paymentMethod,
    startDate,
    endDate,
    search,
    page = 1,
    limit = 50
  } = req.query;

  let conditions = [];
  let params = [];

  if (staffId && staffId !== 'all') {
    conditions.push('o.staff_id = ?');
    params.push(parseInt(staffId, 10));
  }

  if (productId && productId !== 'all') {
    conditions.push('o.product_id = ?');
    params.push(parseInt(productId, 10));
  }

  if (paymentMethod && paymentMethod !== 'all') {
    conditions.push('o.payment_method = ?');
    params.push(paymentMethod);
  }

  if (startDate) {
    conditions.push('o.order_date >= ?');
    params.push(startDate);
  }
  if (endDate) {
    conditions.push('o.order_date <= ?');
    params.push(endDate);
  }

  if (search && search.trim()) {
    conditions.push('(o.order_number LIKE ? OR u.name LIKE ? OR u.staff_id LIKE ? OR p.name LIKE ?)');
    const term = `%${search.trim()}%`;
    params.push(term, term, term, term);
  }

  const whereClause = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';

  // Calculate summary aggregates across filtered dataset
  const summarySql = `
    SELECT
      COUNT(o.id) AS total_orders,
      COALESCE(SUM(o.quantity), 0) AS total_quantity,
      COALESCE(SUM(o.total_amount), 0) AS total_sales,
      COALESCE(SUM(o.incentive_amount), 0) AS total_earned_incentive,
      COALESCE((
        SELECT SUM(r.reversed_incentive)
        FROM returns r
        JOIN orders o2 ON r.order_id = o2.id
        JOIN users u2 ON o2.staff_id = u2.id
        JOIN products p2 ON o2.product_id = p2.id
        ${whereClause.replace(/\bo\./g, 'o2.').replace(/\bu\./g, 'u2.').replace(/\bp\./g, 'p2.')}
      ), 0) AS total_return_adjustment
    FROM orders o
    JOIN users u ON o.staff_id = u.id
    JOIN products p ON o.product_id = p.id
    ${whereClause}
  `;

  const summaryRow = get(summarySql, [...params, ...params]);

  const totalOrders = summaryRow?.total_orders || 0;
  const totalEarnedIncentive = Math.round((summaryRow?.total_earned_incentive || 0) * 100) / 100;
  const totalReturnAdjustment = Math.round((summaryRow?.total_return_adjustment || 0) * 100) / 100;
  const totalFinalIncentive = Math.max(0, Math.round((totalEarnedIncentive - totalReturnAdjustment) * 100) / 100);

  // Pagination
  const offset = (Math.max(1, parseInt(page, 10)) - 1) * parseInt(limit, 10);

  // Fetch paginated records
  const sql = `
    SELECT
      o.id,
      o.order_number,
      o.order_date,
      o.staff_id,
      u.name AS staff_name,
      u.staff_id AS staff_code,
      o.product_id,
      p.name AS product_name,
      p.code AS product_code,
      p.price AS unit_price,
      o.payment_method,
      o.quantity AS order_quantity,
      o.total_amount,
      o.incentive_type,
      o.incentive_basis,
      o.incentive_rate,
      o.incentive_amount AS earned_incentive,
      COALESCE((SELECT SUM(r.reversed_incentive) FROM returns r WHERE r.order_id = o.id), 0) AS return_adjustment,
      COALESCE((SELECT SUM(r.return_quantity) FROM returns r WHERE r.order_id = o.id), 0) AS returned_quantity
    FROM orders o
    JOIN users u ON o.staff_id = u.id
    JOIN products p ON o.product_id = p.id
    ${whereClause}
    ORDER BY o.order_date DESC, o.id DESC
    LIMIT ? OFFSET ?
  `;

  const rows = query(sql, [...params, parseInt(limit, 10), offset]);

  const records = rows.map(r => {
    const earned = Math.round((r.earned_incentive || 0) * 100) / 100;
    const adjustment = Math.round((r.return_adjustment || 0) * 100) / 100;
    const finalIncentive = Math.max(0, Math.round((earned - adjustment) * 100) / 100);

    return {
      id: r.id,
      order_id: r.id,
      order_number: r.order_number,
      order_date: r.order_date,
      staff_id: r.staff_id,
      staff_name: r.staff_name,
      staff_code: r.staff_code,
      product_id: r.product_id,
      product_name: r.product_name,
      product_code: r.product_code,
      unit_price: r.unit_price,
      payment_method: r.payment_method,
      order_quantity: r.order_quantity,
      returned_quantity: r.returned_quantity,
      net_quantity: Math.max(0, r.order_quantity - r.returned_quantity),
      total_amount: r.total_amount,
      incentive_type: r.incentive_type,
      incentive_basis: r.incentive_basis,
      incentive_rate: r.incentive_rate,
      applied_rule: formatIncentiveRule(r.incentive_type, r.incentive_basis, r.incentive_rate),
      earned_incentive: earned,
      return_adjustment: adjustment,
      final_incentive: finalIncentive
    };
  });

  res.json({
    records,
    summary: {
      totalOrders,
      totalEarnedIncentive,
      totalReturnAdjustment,
      totalFinalIncentive
    },
    pagination: {
      total: totalOrders,
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
      totalPages: Math.ceil(totalOrders / parseInt(limit, 10))
    }
  });
});

export default router;
