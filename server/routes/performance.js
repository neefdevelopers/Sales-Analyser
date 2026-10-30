// server/routes/performance.js
import { Router } from 'express';
import { query, get, run } from '../db.js';
import { authenticate, requireRole } from '../auth.js';
import { getNowInBusinessTimezone } from '../timezone.js';

const router = Router();

// GET all staff performance records (Brand Manager or single staff member)
router.get('/', authenticate, (req, res) => {
  const isManager = req.user.role === 'brand_manager';
  const { startDate, endDate, search, sortBy = 'net_sales', sortDir = 'desc' } = req.query;

  const nowInfo = getNowInBusinessTimezone();
  const todayStr = nowInfo.dateStr;

  const defaultStart = `${nowInfo.year}-${String(nowInfo.month).padStart(2, '0')}-01`;
  const sDate = startDate || defaultStart;
  const eDate = endDate || todayStr;

  let staffFilter = '';
  let params = [];

  if (!isManager) {
    staffFilter = 'AND u.id = ?';
    params.push(req.user.id);
  }

  const staffList = query(`
    SELECT u.id, u.staff_id, u.name, u.username, u.status
    FROM users u
    WHERE u.role = 'sales_staff' ${staffFilter}
    ORDER BY u.name ASC
  `, params);

  // Compute metrics for each staff member within date range
  const performanceRows = staffList.map(staff => {
    // 1. Orders
    const orderData = get(`
      SELECT
        COUNT(o.id) AS total_orders,
        COALESCE(SUM(o.quantity), 0) AS gross_quantity,
        COALESCE(SUM(o.total_amount), 0) AS gross_sales,
        COALESCE(SUM(o.incentive_amount), 0) AS gross_incentive,
        COUNT(DISTINCT c.phone) AS total_customers
      FROM orders o
      JOIN customers c ON o.customer_id = c.id
      WHERE o.staff_id = ? AND o.order_date >= ? AND o.order_date <= ?
    `, [staff.id, sDate, eDate]);

    // 2. Returns
    const returnData = get(`
      SELECT
        COUNT(r.id) AS total_returns,
        COALESCE(SUM(r.return_quantity), 0) AS returned_quantity,
        COALESCE(SUM(r.return_amount), 0) AS returned_amount,
        COALESCE(SUM(r.reversed_incentive), 0) AS reversed_incentive
      FROM returns r
      WHERE r.staff_id = ? AND r.return_date >= ? AND r.return_date <= ?
    `, [staff.id, sDate, eDate]);

    // Manager remarks record
    const remarkRow = get('SELECT remarks, updated_at FROM staff_performance_remarks WHERE staff_id = ?', [staff.id]);

    const grossSales = orderData?.gross_sales || 0;
    const returnedAmount = returnData?.returned_amount || 0;
    const netSales = Math.max(0, Math.round((grossSales - returnedAmount) * 100) / 100);

    const grossQty = orderData?.gross_quantity || 0;
    const returnedQty = returnData?.returned_quantity || 0;
    const netQty = Math.max(0, grossQty - returnedQty);

    const grossInc = orderData?.gross_incentive || 0;
    const revInc = returnData?.reversed_incentive || 0;
    const netIncentive = Math.max(0, Math.round((grossInc - revInc) * 100) / 100);

    return {
      staff_id: staff.id,
      staff_code: staff.staff_id,
      name: staff.name,
      username: staff.username,
      status: staff.status,
      total_orders: orderData?.total_orders || 0,
      gross_sales: Math.round(grossSales * 100) / 100,
      total_returns: returnData?.total_returns || 0,
      returned_amount: Math.round(returnedAmount * 100) / 100,
      net_sales: netSales,
      total_customers: orderData?.total_customers || 0,
      gross_quantity: grossQty,
      returned_quantity: returnedQty,
      net_quantity: netQty,
      gross_incentive: Math.round(grossInc * 100) / 100,
      reversed_incentive: Math.round(revInc * 100) / 100,
      net_incentive: netIncentive,
      manager_remarks: remarkRow?.remarks || ''
    };
  });

  // Client-side search and sort
  let filtered = performanceRows;
  if (search && search.trim()) {
    const q = search.trim().toLowerCase();
    filtered = filtered.filter(row =>
      row.name.toLowerCase().includes(q) ||
      row.staff_code.toLowerCase().includes(q) ||
      row.username.toLowerCase().includes(q)
    );
  }

  // Sort
  filtered.sort((a, b) => {
    let aVal = a[sortBy];
    let bVal = b[sortBy];
    if (typeof aVal === 'string') {
      aVal = aVal.toLowerCase();
      bVal = (bVal || '').toLowerCase();
      return sortDir === 'asc' ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
    }
    aVal = aVal || 0;
    bVal = bVal || 0;
    return sortDir === 'asc' ? aVal - bVal : bVal - aVal;
  });

  res.json({
    performance: filtered,
    dateRange: { startDate: sDate, endDate: eDate }
  });
});

// GET detailed individual staff breakdown
router.get('/staff/:id', authenticate, (req, res) => {
  const targetId = parseInt(req.params.id, 10);
  const isManager = req.user.role === 'brand_manager';

  if (!isManager && req.user.id !== targetId) {
    return res.status(403).json({ error: 'Unauthorized to view other staff performance.' });
  }

  const { startDate, endDate } = req.query;
  const nowInfo = getNowInBusinessTimezone();
  const defaultStart = `${nowInfo.year}-${String(nowInfo.month).padStart(2, '0')}-01`;
  const sDate = startDate || defaultStart;
  const eDate = endDate || nowInfo.dateStr;

  const staff = get('SELECT id, staff_id, name, username, role, status FROM users WHERE id = ?', [targetId]);
  if (!staff) {
    return res.status(404).json({ error: 'Staff member not found.' });
  }

  // 1. Orders
  const orders = query(`
    SELECT
      o.id,
      o.order_number,
      o.order_date,
      o.quantity,
      o.unit_price,
      o.total_amount,
      o.payment_method,
      o.status,
      o.incentive_type,
      o.incentive_basis,
      o.incentive_rate,
      o.incentive_amount,
      o.remarks,
      p.name AS product_name,
      p.code AS product_code,
      c.name AS customer_name,
      c.phone AS customer_phone
    FROM orders o
    JOIN products p ON o.product_id = p.id
    JOIN customers c ON o.customer_id = c.id
    WHERE o.staff_id = ? AND o.order_date >= ? AND o.order_date <= ?
    ORDER BY o.order_date DESC, o.id DESC
  `, [targetId, sDate, eDate]);

  // 2. Returns
  const returns = query(`
    SELECT
      r.id,
      r.return_number,
      r.return_date,
      r.return_quantity,
      r.return_amount,
      r.return_reason,
      r.reversed_incentive,
      r.remarks,
      o.order_number,
      p.name AS product_name,
      c.name AS customer_name
    FROM returns r
    JOIN orders o ON r.order_id = o.id
    JOIN products p ON o.product_id = p.id
    JOIN customers c ON o.customer_id = c.id
    WHERE r.staff_id = ? AND r.return_date >= ? AND r.return_date <= ?
    ORDER BY r.return_date DESC, r.id DESC
  `, [targetId, sDate, eDate]);

  // 3. Incentive breakdown by Payment Method
  const incentiveByPayment = query(`
    SELECT
      payment_method,
      COUNT(id) AS order_count,
      SUM(total_amount) AS gross_sales,
      SUM(incentive_amount) AS gross_incentive,
      COALESCE((SELECT SUM(r.reversed_incentive) FROM returns r JOIN orders o2 ON r.order_id = o2.id WHERE o2.staff_id = ? AND o2.payment_method = o.payment_method AND r.return_date >= ? AND r.return_date <= ?), 0) AS reversed_incentive
    FROM orders o
    WHERE staff_id = ? AND order_date >= ? AND order_date <= ?
    GROUP BY payment_method
  `, [targetId, sDate, eDate, targetId, sDate, eDate]).map(item => ({
    ...item,
    net_incentive: Math.max(0, Math.round((item.gross_incentive - item.reversed_incentive) * 100) / 100)
  }));

  // 4. Incentive breakdown by Product
  const incentiveByProduct = query(`
    SELECT
      p.id AS product_id,
      p.name AS product_name,
      p.code AS product_code,
      COUNT(o.id) AS order_count,
      SUM(o.quantity) AS quantity_sold,
      SUM(o.total_amount) AS gross_sales,
      SUM(o.incentive_amount) AS gross_incentive,
      COALESCE((SELECT SUM(r.reversed_incentive) FROM returns r JOIN orders o2 ON r.order_id = o2.id WHERE o2.staff_id = ? AND o2.product_id = p.id AND r.return_date >= ? AND r.return_date <= ?), 0) AS reversed_incentive
    FROM orders o
    JOIN products p ON o.product_id = p.id
    WHERE o.staff_id = ? AND o.order_date >= ? AND o.order_date <= ?
    GROUP BY p.id
  `, [targetId, sDate, eDate, targetId, sDate, eDate]).map(item => ({
    ...item,
    net_incentive: Math.max(0, Math.round((item.gross_incentive - item.reversed_incentive) * 100) / 100)
  }));

  // Manager remarks
  const remarkRow = get('SELECT remarks, updated_at FROM staff_performance_remarks WHERE staff_id = ?', [targetId]);

  res.json({
    staff,
    dateRange: { startDate: sDate, endDate: eDate },
    orders,
    returns,
    incentiveBreakdown: {
      byPaymentMethod: incentiveByPayment,
      byProduct: incentiveByProduct
    },
    managerRemarks: remarkRow?.remarks || ''
  });
});

// POST save Brand Manager's performance observations
router.post('/staff/:id/remarks', authenticate, requireRole('brand_manager'), (req, res) => {
  const targetId = parseInt(req.params.id, 10);
  const staff = get('SELECT id, name FROM users WHERE id = ?', [targetId]);

  if (!staff) {
    return res.status(404).json({ error: 'Staff member not found.' });
  }

  const { remarks } = req.body;
  const now = new Date().toISOString();
  const managerId = req.user.id;

  const existing = get('SELECT id FROM staff_performance_remarks WHERE staff_id = ?', [targetId]);
  if (existing) {
    run('UPDATE staff_performance_remarks SET remarks = ?, manager_id = ?, updated_at = ? WHERE staff_id = ?', [
      remarks ? remarks.trim() : '',
      managerId,
      now,
      targetId
    ]);
  } else {
    run('INSERT INTO staff_performance_remarks (staff_id, manager_id, remarks, updated_at) VALUES (?, ?, ?, ?)', [
      targetId,
      managerId,
      remarks ? remarks.trim() : '',
      now
    ]);
  }

  res.json({ message: `Performance remarks saved for ${staff.name}.`, remarks: remarks || '' });
});

// GET export performance report to CSV
router.get('/export', authenticate, requireRole('brand_manager'), (req, res) => {
  const { startDate, endDate } = req.query;
  const nowInfo = getNowInBusinessTimezone();
  const sDate = startDate || `${nowInfo.year}-${String(nowInfo.month).padStart(2, '0')}-01`;
  const eDate = endDate || nowInfo.dateStr;

  const staffList = query("SELECT id, staff_id, name, username, status FROM users WHERE role = 'sales_staff' ORDER BY name ASC");

  const rows = [];
  rows.push([
    'Staff ID',
    'Staff Name',
    'Total Orders',
    'Gross Sales (INR)',
    'Returns Count',
    'Returned Amount (INR)',
    'Net Sales (INR)',
    'Total Customers',
    'Gross Qty Sold',
    'Net Qty Sold',
    'Net Incentive (INR)',
    'Manager Remarks'
  ]);

  for (const staff of staffList) {
    const o = get(`
      SELECT COUNT(o.id) AS total_orders, COALESCE(SUM(o.quantity), 0) AS gross_qty, COALESCE(SUM(o.total_amount), 0) AS gross_sales, COALESCE(SUM(o.incentive_amount), 0) AS gross_inc, COUNT(DISTINCT c.phone) AS custs
      FROM orders o JOIN customers c ON o.customer_id = c.id
      WHERE o.staff_id = ? AND o.order_date >= ? AND o.order_date <= ?
    `, [staff.id, sDate, eDate]);

    const r = get(`
      SELECT COUNT(r.id) AS ret_count, COALESCE(SUM(r.return_quantity), 0) AS ret_qty, COALESCE(SUM(r.return_amount), 0) AS ret_amount, COALESCE(SUM(r.reversed_incentive), 0) AS rev_inc
      FROM returns r
      WHERE r.staff_id = ? AND r.return_date >= ? AND r.return_date <= ?
    `, [staff.id, sDate, eDate]);

    const remarkRow = get('SELECT remarks FROM staff_performance_remarks WHERE staff_id = ?', [staff.id]);

    const grossSales = o?.gross_sales || 0;
    const retAmount = r?.ret_amount || 0;
    const netSales = Math.max(0, Math.round((grossSales - retAmount) * 100) / 100);
    const grossQty = o?.gross_qty || 0;
    const retQty = r?.ret_qty || 0;
    const netQty = Math.max(0, grossQty - retQty);
    const grossInc = o?.gross_inc || 0;
    const revInc = r?.rev_inc || 0;
    const netInc = Math.max(0, Math.round((grossInc - revInc) * 100) / 100);

    rows.push([
      staff.staff_id,
      `"${staff.name.replace(/"/g, '""')}"`,
      o?.total_orders || 0,
      grossSales.toFixed(2),
      r?.ret_count || 0,
      retAmount.toFixed(2),
      netSales.toFixed(2),
      o?.custs || 0,
      grossQty,
      netQty,
      netInc.toFixed(2),
      `"${(remarkRow?.remarks || '').replace(/"/g, '""')}"`
    ]);
  }

  const csvContent = rows.map(r => r.join(',')).join('\n');
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename=staff_performance_${sDate}_to_${eDate}.csv`);
  res.send(csvContent);
});

export default router;
