// server/routes/incentives.js
import { Router } from 'express';
import { query, get } from '../db.js';
import { authenticate, requireRole } from '../auth.js';
import { getNowInBusinessTimezone } from '../timezone.js';

const router = Router();

const MONTH_NAMES = [
  '',
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

// Helper to resolve start & end date for a given year & month
function resolveMonthDateRange(yearParam, monthParam) {
  const now = getNowInBusinessTimezone();
  const year = parseInt(yearParam, 10) || now.year;
  const month = parseInt(monthParam, 10) || now.month;

  const validMonth = Math.max(1, Math.min(12, month));
  const mStr = String(validMonth).padStart(2, '0');
  const startDate = `${year}-${mStr}-01`;

  // Last day of month
  const lastDay = new Date(Date.UTC(year, validMonth, 0)).getUTCDate();
  const endDate = `${year}-${mStr}-${String(lastDay).padStart(2, '0')}`;

  return {
    year,
    month: validMonth,
    monthName: MONTH_NAMES[validMonth],
    startDate,
    endDate
  };
}

/**
 * 1. GET Monthly Staff-Wise Incentive Summary (Brand Manager only)
 * Returns all active sales staff with their monthly incentive summary for the selected calendar month.
 * Query params: year, month, search
 */
router.get('/monthly-summary', authenticate, requireRole('brand_manager'), (req, res) => {
  const { year: qYear, month: qMonth, search } = req.query;
  const { year, month, monthName, startDate, endDate } = resolveMonthDateRange(qYear, qMonth);

  // Fetch all active sales staff
  let staffUsers = query(`
    SELECT id, staff_id, name, username, status
    FROM users
    WHERE role = 'sales_staff' AND status = 'active'
    ORDER BY name ASC
  `);

  if (search && search.trim()) {
    const term = search.trim().toLowerCase();
    staffUsers = staffUsers.filter(u =>
      u.name.toLowerCase().includes(term) ||
      u.staff_id.toLowerCase().includes(term) ||
      u.username.toLowerCase().includes(term)
    );
  }

  // Calculate incentives for each staff member for orders created in the selected month
  const staffSummaries = staffUsers.map(staff => {
    // 1. Orders within the selected month (excluding cancelled orders)
    const orderStats = get(`
      SELECT
        COUNT(o.id) AS total_orders,
        COALESCE(SUM(o.quantity), 0) AS total_quantity,
        COALESCE(SUM(o.total_amount), 0) AS gross_sales,
        COALESCE(SUM(o.incentive_amount), 0) AS gross_incentive
      FROM orders o
      WHERE o.staff_id = ?
        AND o.order_date >= ?
        AND o.order_date <= ?
        AND o.status != 'Cancelled'
    `, [staff.id, startDate, endDate]);

    // 2. Return adjustments attributable to orders or direct returns in the selected month
    const returnStats = get(`
      SELECT
        COALESCE(SUM(r.reversed_incentive), 0) AS total_reversed_incentive,
        COALESCE(SUM(r.return_quantity), 0) AS total_returned_quantity,
        COALESCE(SUM(r.return_amount), 0) AS total_returned_amount
      FROM returns r
      LEFT JOIN orders o ON r.order_id = o.id
      WHERE (o.staff_id = ? OR r.staff_id = ? OR r.returned_by_staff_id = ?)
        AND (
          (o.order_date >= ? AND o.order_date <= ? AND o.status != 'Cancelled')
          OR (r.order_id IS NULL AND r.return_date >= ? AND r.return_date <= ?)
        )
    `, [staff.id, staff.id, staff.id, startDate, endDate, startDate, endDate]);

    const totalOrders = orderStats?.total_orders || 0;
    const grossIncentive = Math.round((orderStats?.gross_incentive || 0) * 100) / 100;
    const returnAdjustments = Math.round((returnStats?.total_reversed_incentive || 0) * 100) / 100;
    const netIncentive = Math.max(0, Math.round((grossIncentive - returnAdjustments) * 100) / 100);
    const grossSales = Math.round((orderStats?.gross_sales || 0) * 100) / 100;

    return {
      id: staff.id,
      staff_id: staff.id,
      staff_code: staff.staff_id,
      name: staff.name,
      username: staff.username,
      status: staff.status,
      total_orders: totalOrders,
      total_incentive: grossIncentive,
      return_adjustments: returnAdjustments,
      net_incentive: netIncentive,
      gross_sales: grossSales,
      total_quantity: orderStats?.total_quantity || 0,
      returned_quantity: returnStats?.total_returned_quantity || 0
    };
  });

  // Sort by net incentive, highest first by default
  staffSummaries.sort((a, b) => b.net_incentive - a.net_incentive || b.total_orders - a.total_orders);

  // Overall totals across all staff
  const totals = staffSummaries.reduce((acc, curr) => ({
    total_staff: staffSummaries.length,
    total_orders: acc.total_orders + curr.total_orders,
    total_incentive: Math.round((acc.total_incentive + curr.total_incentive) * 100) / 100,
    return_adjustments: Math.round((acc.return_adjustments + curr.return_adjustments) * 100) / 100,
    net_incentive: Math.round((acc.net_incentive + curr.net_incentive) * 100) / 100,
    gross_sales: Math.round((acc.gross_sales + curr.gross_sales) * 100) / 100
  }), {
    total_staff: 0,
    total_orders: 0,
    total_incentive: 0,
    return_adjustments: 0,
    net_incentive: 0,
    gross_sales: 0
  });

  res.json({
    period: {
      year,
      month,
      monthName,
      startDate,
      endDate
    },
    totals,
    staffSummaries
  });
});

/**
 * 2. GET Staff-Wise Incentive Details (Brand Manager only)
 * Detailed orders and incentive calculations for a specific staff member in a selected month.
 * Path param: staffId (accepts numeric user id or string staff_code like 'STF-001')
 * Query params: year, month
 */
router.get('/staff/:staffId/monthly', authenticate, requireRole('brand_manager'), (req, res) => {
  const staffParam = req.params.staffId;
  const numericId = parseInt(staffParam, 10);
  const { year: qYear, month: qMonth } = req.query;
  const { year, month, monthName, startDate, endDate } = resolveMonthDateRange(qYear, qMonth);

  const staff = get(`
    SELECT id, staff_id, name, username, status, created_at
    FROM users
    WHERE (id = ? OR staff_id = ?) AND role = 'sales_staff'
  `, [isNaN(numericId) ? -1 : numericId, staffParam]);

  if (!staff) {
    return res.status(404).json({ error: 'Sales staff member not found.' });
  }

  // Fetch all orders created in this month by this staff member (excluding cancelled)
  const orders = query(`
    SELECT
      o.id,
      o.order_number,
      o.order_date,
      o.status,
      o.payment_method,
      o.quantity,
      o.unit_price,
      o.total_amount,
      o.remarks,
      o.incentive_type,
      o.incentive_basis,
      o.incentive_rate,
      o.incentive_amount AS order_incentive,
      c.name AS customer_name,
      c.phone AS customer_phone,
      c.address AS customer_address,
      p.name AS product_name,
      p.code AS product_code
    FROM orders o
    JOIN customers c ON o.customer_id = c.id
    JOIN products p ON o.product_id = p.id
    WHERE o.staff_id = ?
      AND o.order_date >= ?
      AND o.order_date <= ?
      AND o.status != 'Cancelled'
    ORDER BY o.order_date DESC, o.id DESC
  `, [staff.id, startDate, endDate]);

  // For each order, fetch attached return records & calculate adjustments
  const detailedOrders = orders.map(ord => {
    const returnRows = query(`
      SELECT
        r.id,
        r.return_number,
        r.return_date,
        r.return_quantity,
        r.return_amount,
        r.reversed_incentive,
        r.return_reason,
        r.remarks
      FROM returns r
      WHERE r.order_id = ?
      ORDER BY r.return_date ASC, r.id ASC
    `, [ord.id]);

    const returnAdjustment = Math.round(
      returnRows.reduce((sum, r) => sum + (r.reversed_incentive || 0), 0) * 100
    ) / 100;

    const returnedQuantity = returnRows.reduce((sum, r) => sum + (r.return_quantity || 0), 0);
    const orderIncentive = Math.round((ord.order_incentive || 0) * 100) / 100;
    const netIncentive = Math.max(0, Math.round((orderIncentive - returnAdjustment) * 100) / 100);

    return {
      ...ord,
      order_incentive: orderIncentive,
      return_adjustment: returnAdjustment,
      net_incentive: netIncentive,
      returned_quantity: returnedQuantity,
      net_quantity: Math.max(0, ord.quantity - returnedQuantity),
      returns: returnRows
    };
  });

  // Fetch all return records for this staff member in the selected month
  const staffReturns = query(`
    SELECT
      r.id,
      r.return_number,
      r.return_date,
      r.return_quantity,
      r.return_amount,
      r.reversed_incentive,
      COALESCE(r.payment_method, o.payment_method, 'Prepaid') AS payment_method,
      r.return_reason,
      r.remarks,
      o.id AS order_id,
      COALESCE(o.order_number, '-') AS order_number,
      o.order_date,
      p.name AS product_name,
      p.code AS product_code,
      c.name AS customer_name,
      c.phone AS customer_phone
    FROM returns r
    LEFT JOIN orders o ON r.order_id = o.id
    LEFT JOIN products p ON COALESCE(r.product_id, o.product_id) = p.id
    LEFT JOIN customers c ON o.customer_id = c.id
    WHERE (o.staff_id = ? OR r.staff_id = ? OR r.returned_by_staff_id = ?)
      AND (
        (o.order_date >= ? AND o.order_date <= ? AND o.status != 'Cancelled')
        OR (r.order_id IS NULL AND r.return_date >= ? AND r.return_date <= ?)
      )
    ORDER BY r.return_date DESC, r.id DESC
  `, [staff.id, staff.id, staff.id, startDate, endDate, startDate, endDate]);

  const standaloneReturnAdjustment = Math.round(
    staffReturns.filter(r => !r.order_id).reduce((sum, r) => sum + (r.reversed_incentive || 0), 0) * 100
  ) / 100;
  const standaloneReturnedQty = staffReturns.filter(r => !r.order_id).reduce((sum, r) => sum + (r.return_quantity || 0), 0);

  // Reconciled summary totals for this staff member in this month
  const summary = {
    totalOrders: detailedOrders.length,
    grossIncentive: Math.round(detailedOrders.reduce((sum, o) => sum + o.order_incentive, 0) * 100) / 100,
    returnAdjustments: Math.round((detailedOrders.reduce((sum, o) => sum + o.return_adjustment, 0) + standaloneReturnAdjustment) * 100) / 100,
    netIncentive: Math.max(0, Math.round((detailedOrders.reduce((sum, o) => sum + o.order_incentive, 0) - (detailedOrders.reduce((sum, o) => sum + o.return_adjustment, 0) + standaloneReturnAdjustment)) * 100) / 100),
    grossSales: Math.round(detailedOrders.reduce((sum, o) => sum + o.total_amount, 0) * 100) / 100,
    totalQuantity: detailedOrders.reduce((sum, o) => sum + o.quantity, 0),
    returnedQuantity: detailedOrders.reduce((sum, o) => sum + o.returned_quantity, 0) + standaloneReturnedQty
  };

  res.json({
    staff: {
      id: staff.id,
      staff_code: staff.staff_id,
      name: staff.name,
      username: staff.username,
      status: staff.status
    },
    period: {
      year,
      month,
      monthName,
      startDate,
      endDate
    },
    summary,
    orders: detailedOrders,
    returns: staffReturns
  });
});

export default router;
