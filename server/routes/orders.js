// server/routes/orders.js
import { Router } from 'express';
import crypto from 'crypto';
import ExcelJS from 'exceljs';
import { query, get, run, transaction } from '../db.js';
import { authenticate } from '../auth.js';
import { calculateIncentive } from './products.js';
import { getNowInBusinessTimezone } from '../timezone.js';

const router = Router();

// Helper to extract clean string value from Excel cell
function getCellValue(cell) {
  if (!cell || cell.value === null || cell.value === undefined) return '';
  const val = cell.value;
  if (typeof val === 'object') {
    if (val instanceof Date) {
      const y = val.getFullYear();
      const m = String(val.getMonth() + 1).padStart(2, '0');
      const d = String(val.getDate()).padStart(2, '0');
      return `${y}-${m}-${d}`;
    }
    if (val.result !== undefined && val.result !== null) return String(val.result).trim();
    if (val.text !== undefined && val.text !== null) return String(val.text).trim();
    if (Array.isArray(val.richText)) {
      return val.richText.map(t => t.text || '').join('').trim();
    }
  }
  return String(val).trim();
}

// In-memory cache for bulk update preview sessions (15-minute TTL)
const previewCache = new Map();

setInterval(() => {
  const now = Date.now();
  for (const [token, data] of previewCache.entries()) {
    if (data.expiresAt && data.expiresAt < now) {
      previewCache.delete(token);
    }
  }
}, 5 * 60 * 1000);

// Normalizes customer phone number
export function normalizePhone(phone) {
  if (!phone) return '';
  return phone.replace(/[^0-9]/g, '');
}

// GET orders list (with search, filter by staff, product, payment method, date range, pagination)
router.get('/', authenticate, (req, res) => {
  const isManager = req.user.role === 'brand_manager';
  const { staffId, productId, paymentMethod, search, status, startDate, endDate, page = 1, limit = 50 } = req.query;

  let conditions = [];
  let params = [];

  // Role filtering: sales staff see ONLY their own orders
  if (!isManager) {
    conditions.push('o.staff_id = ?');
    params.push(req.user.id);
  } else if (staffId && staffId !== 'all') {
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

  if (search && search.trim()) {
    conditions.push('(o.order_number LIKE ? OR c.name LIKE ? OR c.phone LIKE ? OR p.name LIKE ?)');
    const term = `%${search.trim()}%`;
    params.push(term, term, term, term);
  }

  if (status && status !== 'all') {
    conditions.push('o.status = ?');
    params.push(status);
  }

  if (startDate) {
    conditions.push('o.order_date >= ?');
    params.push(startDate);
  }
  if (endDate) {
    conditions.push('o.order_date <= ?');
    params.push(endDate);
  }

  const whereClause = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';

  // Get total count
  const countSql = `
    SELECT COUNT(*) AS total
    FROM orders o
    JOIN customers c ON o.customer_id = c.id
    JOIN products p ON o.product_id = p.id
    ${whereClause}
  `;
  const countRow = get(countSql, params);
  const total = countRow?.total || 0;

  // Pagination
  const offset = (Math.max(1, parseInt(page, 10)) - 1) * parseInt(limit, 10);

  // Query with returned calculations
  const sql = `
    SELECT
      o.id,
      o.order_number,
      o.staff_id,
      u.name AS staff_name,
      u.staff_id AS staff_code,
      o.customer_id,
      c.name AS customer_name,
      c.phone AS customer_phone,
      c.address AS customer_address,
      o.product_id,
      p.name AS product_name,
      p.code AS product_code,
      o.quantity,
      o.unit_price,
      o.total_amount,
      o.payment_method,
      o.order_date,
      o.status,
      o.remarks,
      o.incentive_type,
      o.incentive_basis,
      o.incentive_rate,
      o.incentive_amount,
      o.created_at,
      COALESCE((SELECT SUM(r.return_quantity) FROM returns r WHERE r.order_id = o.id), 0) AS returned_quantity,
      COALESCE((SELECT SUM(r.return_amount) FROM returns r WHERE r.order_id = o.id), 0) AS returned_amount,
      COALESCE((SELECT SUM(r.reversed_incentive) FROM returns r WHERE r.order_id = o.id), 0) AS reversed_incentive
    FROM orders o
    JOIN users u ON o.staff_id = u.id
    JOIN customers c ON o.customer_id = c.id
    JOIN products p ON o.product_id = p.id
    ${whereClause}
    ORDER BY o.order_date DESC, o.id DESC
    LIMIT ? OFFSET ?
  `;

  const orders = query(sql, [...params, parseInt(limit, 10), offset]);

  // Augment with remaining returnable quantity & net values
  const augmented = orders.map(order => {
    const returnableQuantity = Math.max(0, order.quantity - order.returned_quantity);
    const netAmount = Math.max(0, order.total_amount - order.returned_amount);
    const netIncentive = Math.max(0, order.incentive_amount - order.reversed_incentive);
    return {
      ...order,
      returnable_quantity: returnableQuantity,
      net_amount: Math.round(netAmount * 100) / 100,
      net_incentive: Math.round(netIncentive * 100) / 100
    };
  });

  res.json({
    orders: augmented,
    pagination: {
      total,
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
      totalPages: Math.ceil(total / parseInt(limit, 10))
    }
  });
});

// GET summary metrics for logged-in staff member (My Records page)
router.get('/my-summary', authenticate, (req, res) => {
  const staffId = req.user.id;
  const { startDate, endDate } = req.query;

  let dateCondOrders = '';
  let dateCondReturns = '';
  let paramsOrders = [staffId];
  let paramsReturns = [staffId];

  if (startDate) {
    dateCondOrders += ' AND o.order_date >= ?';
    paramsOrders.push(startDate);
    dateCondReturns += ' AND r.return_date >= ?';
    paramsReturns.push(startDate);
  }
  if (endDate) {
    dateCondOrders += ' AND o.order_date <= ?';
    paramsOrders.push(endDate);
    dateCondReturns += ' AND r.return_date <= ?';
    paramsReturns.push(endDate);
  }

  const orderStats = get(`
    SELECT
      COUNT(o.id) AS total_orders,
      COALESCE(SUM(o.quantity), 0) AS total_quantity,
      COALESCE(SUM(o.total_amount), 0) AS gross_sales,
      COALESCE(SUM(o.incentive_amount), 0) AS gross_incentive
    FROM orders o
    WHERE o.staff_id = ? ${dateCondOrders}
  `, paramsOrders);

  const returnStats = get(`
    SELECT
      COUNT(DISTINCT r.order_id) AS returned_orders,
      COUNT(r.id) AS total_returns_count,
      COALESCE(SUM(r.return_quantity), 0) AS total_returned_quantity,
      COALESCE(SUM(r.return_amount), 0) AS total_returned_amount,
      COALESCE(SUM(r.reversed_incentive), 0) AS total_reversed_incentive
    FROM returns r
    WHERE r.staff_id = ? ${dateCondReturns}
  `, paramsReturns);

  const totalOrders = orderStats?.total_orders || 0;
  const returnedOrders = returnStats?.returned_orders || 0;
  const grossIncentive = Math.round((orderStats?.gross_incentive || 0) * 100) / 100;
  const reversedIncentive = Math.round((returnStats?.total_reversed_incentive || 0) * 100) / 100;
  const netIncentive = Math.max(0, Math.round((grossIncentive - reversedIncentive) * 100) / 100);

  res.json({
    summary: {
      totalOrders,
      returnedOrders,
      grossIncentive,
      reversedIncentive,
      netIncentive,
      grossSales: Math.round((orderStats?.gross_sales || 0) * 100) / 100,
      totalQuantity: orderStats?.total_quantity || 0,
      returnedQuantity: returnStats?.total_returned_quantity || 0
    }
  });
});

// GET returnable orders list (Orders where returnable_quantity > 0)
router.get('/returnable', authenticate, (req, res) => {
  const isManager = req.user.role === 'brand_manager';
  let conditions = [];
  let params = [];

  if (!isManager) {
    conditions.push('o.staff_id = ?');
    params.push(req.user.id);
  }

  const whereClause = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';

  const sql = `
    SELECT
      o.id,
      o.order_number,
      o.staff_id,
      u.name AS staff_name,
      c.name AS customer_name,
      c.phone AS customer_phone,
      p.name AS product_name,
      p.code AS product_code,
      o.quantity,
      o.unit_price,
      o.total_amount,
      o.payment_method,
      o.order_date,
      o.incentive_type,
      o.incentive_basis,
      o.incentive_rate,
      o.incentive_amount,
      COALESCE((SELECT SUM(r.return_quantity) FROM returns r WHERE r.order_id = o.id), 0) AS returned_quantity,
      COALESCE((SELECT SUM(r.return_amount) FROM returns r WHERE r.order_id = o.id), 0) AS returned_amount,
      COALESCE((SELECT SUM(r.reversed_incentive) FROM returns r WHERE r.order_id = o.id), 0) AS reversed_incentive
    FROM orders o
    JOIN users u ON o.staff_id = u.id
    JOIN customers c ON o.customer_id = c.id
    JOIN products p ON o.product_id = p.id
    ${whereClause}
    ORDER BY o.order_date DESC, o.id DESC
  `;

  const allOrders = query(sql, params);

  // Filter to those with remaining returnable quantity > 0
  const returnable = allOrders
    .map(o => ({
      ...o,
      returnable_quantity: o.quantity - o.returned_quantity
    }))
    .filter(o => o.returnable_quantity > 0);

  res.json({ returnableOrders: returnable });
});

// GET /api/orders/date-range - Get min and max dates of all orders in database
router.get('/date-range', authenticate, (req, res) => {
  const range = get(`
    SELECT
      MIN(order_date) AS minDate,
      MAX(order_date) AS maxDate,
      COUNT(*) AS totalOrders
    FROM orders
  `);
  res.json({
    minDate: range?.minDate || null,
    maxDate: range?.maxDate || null,
    totalOrders: range?.totalOrders || 0
  });
});

// DELETE /api/orders/clear-all - Clear all orders, returns, and import logs (Brand Manager only)
router.delete('/clear-all', authenticate, (req, res) => {
  if (req.user.role !== 'brand_manager') {
    return res.status(403).json({ error: 'Only Brand Managers can clear all orders and returns.' });
  }

  try {
    transaction(() => {
      run('DELETE FROM returns');
      run('DELETE FROM orders');
      run('DELETE FROM import_logs');
      run('DELETE FROM customers');
      try {
        run("DELETE FROM sqlite_sequence WHERE name IN ('orders', 'returns', 'import_logs', 'customers')");
      } catch (e) {
        // Ignored if sequence is absent
      }
    });

    const ordersCount = query('SELECT COUNT(*) as c FROM orders')[0].c;
    const returnsCount = query('SELECT COUNT(*) as c FROM returns')[0].c;
    const logsCount = query('SELECT COUNT(*) as c FROM import_logs')[0].c;

    res.json({
      success: true,
      message: 'All orders, returns, and import logs have been completely cleared.',
      counts: {
        orders: ordersCount,
        returns: returnsCount,
        import_logs: logsCount
      }
    });
  } catch (err) {
    console.error('Failed to clear orders & returns:', err);
    res.status(500).json({ error: 'Failed to clear records: ' + err.message });
  }
});

// POST preview order calculations (estimate total & incentive before saving)
router.post('/preview', authenticate, (req, res) => {
  const { product_id, quantity, payment_method = 'Prepaid' } = req.body;

  if (!product_id || !quantity) {
    return res.status(400).json({ error: 'product_id and quantity are required for preview.' });
  }

  const product = get('SELECT * FROM products WHERE id = ?', [product_id]);
  if (!product) {
    return res.status(404).json({ error: 'Product not found.' });
  }

  const qty = parseInt(quantity, 10);
  if (isNaN(qty) || qty <= 0) {
    return res.status(400).json({ error: 'Quantity must be at least 1.' });
  }

  const unitPrice = product.price || 0;
  const totalAmount = Math.round(unitPrice * qty * 100) / 100;
  const safePaymentMethod = (payment_method && ['Prepaid', 'COD'].includes(payment_method)) ? payment_method : 'Prepaid';
  const incentive = calculateIncentive(product, safePaymentMethod, qty, totalAmount);

  res.json({
    product: {
      id: product.id,
      name: product.name,
      code: product.code,
      price: unitPrice,
      status: product.status
    },
    quantity: qty,
    unit_price: unitPrice,
    total_amount: totalAmount,
    payment_method: safePaymentMethod,
    estimated_incentive: incentive
  });
});

// POST create new order
router.post('/', authenticate, (req, res) => {
  const {
    customer_name,
    customer_phone,
    customer_address,
    product_id,
    quantity,
    payment_method = 'Prepaid',
    order_date
  } = req.body;

  // 1. Validation for required fields (customer details are optional)
  if (!product_id) {
    return res.status(400).json({ error: 'Product selection is required.' });
  }

  const custName = (customer_name && customer_name.trim()) ? customer_name.trim() : 'Direct Customer';
  const rawPhone = customer_phone ? normalizePhone(customer_phone) : '';
  const cleanPhone = (rawPhone && rawPhone.length >= 7) ? rawPhone : '0000000000';
  const custAddress = (customer_address && customer_address.trim()) ? customer_address.trim() : 'Direct Order';

  if (!product_id) {
    return res.status(400).json({ error: 'Product selection is required.' });
  }

  const qty = parseInt(quantity, 10);
  if (isNaN(qty) || qty <= 0) {
    return res.status(400).json({ error: 'Quantity must be a positive integer (at least 1).' });
  }

  const finalPaymentMethod = (payment_method && ['Prepaid', 'COD'].includes(payment_method)) ? payment_method : 'Prepaid';

  const todayDateStr = getNowInBusinessTimezone().dateStr;
  const orderDateStr = (order_date && /^\d{4}-\d{2}-\d{2}$/.test(order_date.trim()))
    ? order_date.trim()
    : todayDateStr;

  // 2. Fetch product and verify active status
  const product = get('SELECT * FROM products WHERE id = ?', [product_id]);
  if (!product) {
    return res.status(404).json({ error: 'Selected product was not found.' });
  }
  if (product.status !== 'active') {
    return res.status(400).json({ error: 'Cannot create an order for an inactive product.' });
  }

  // 3. Calculate order total and staff incentive snapshot automatically
  const unitPrice = product.price || 0;
  const totalAmount = Math.round(unitPrice * qty * 100) / 100;
  const incentive = calculateIncentive(product, finalPaymentMethod, qty, totalAmount);

  // 4. Generate unique order ID: ORD-YYYYMMDD-XXXX
  const dateFormatted = orderDateStr.replace(/-/g, '');
  const countToday = get("SELECT COUNT(*) AS c FROM orders WHERE order_number LIKE ?", [`ORD-${dateFormatted}-%`]);
  const nextSeq = (countToday?.c || 0) + 1;
  const orderNumber = `ORD-${dateFormatted}-${String(nextSeq).padStart(4, '0')}`;

  const isManager = req.user.role === 'brand_manager';
  let staffId = req.user.id;

  if (isManager && req.body.staff_id) {
    const targetStaff = get('SELECT id, name, status FROM users WHERE id = ?', [req.body.staff_id]);
    if (!targetStaff) {
      return res.status(404).json({ error: 'Assigned staff member not found.' });
    }
    if (targetStaff.status !== 'active') {
      return res.status(400).json({ error: 'Cannot assign order to an inactive staff member.' });
    }
    staffId = targetStaff.id;
  }

  const now = new Date().toISOString();

  try {
    const result = transaction(() => {
      // Find or create customer
      let customer = get('SELECT id FROM customers WHERE phone = ?', [cleanPhone]);
      let customerId;

      if (customer) {
        customerId = customer.id;
        if (customer_name || customer_address) {
          run('UPDATE customers SET name = ?, address = ?, updated_at = ? WHERE id = ?', [
            custName,
            custAddress,
            now,
            customerId
          ]);
        }
      } else {
        const custRes = run(
          'INSERT INTO customers (name, phone, address, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
          [custName, cleanPhone, custAddress, now, now]
        );
        customerId = custRes.lastInsertRowid;
      }

      // Insert Order with immutable incentive snapshot
      const orderRes = run(
        `INSERT INTO orders (
          order_number, staff_id, customer_id, product_id,
          quantity, unit_price, total_amount, payment_method,
          order_date, status, remarks,
          incentive_type, incentive_basis, incentive_rate, incentive_amount,
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'Confirmed', NULL, ?, ?, ?, ?, ?, ?)`,
        [
          orderNumber,
          staffId,
          customerId,
          product.id,
          qty,
          unitPrice,
          totalAmount,
          finalPaymentMethod,
          orderDateStr,
          incentive.type,
          incentive.basis,
          incentive.rate,
          incentive.amount,
          now,
          now
        ]
      );

      return orderRes.lastInsertRowid;
    });

    const createdOrder = get(`
      SELECT
        o.*,
        c.name AS customer_name,
        c.phone AS customer_phone,
        c.address AS customer_address,
        p.name AS product_name,
        p.code AS product_code,
        u.name AS staff_name,
        u.staff_id AS staff_code
      FROM orders o
      JOIN customers c ON o.customer_id = c.id
      JOIN products p ON o.product_id = p.id
      JOIN users u ON o.staff_id = u.id
      WHERE o.id = ?
    `, [result]);

    res.status(201).json({
      order: createdOrder,
      message: `Order ${createdOrder.order_number} created successfully.`
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// =========================================================================
// BULK UPDATE STAFF ORDERS VIA EXCEL (Brand Manager Feature)
// =========================================================================

// 1. GET /api/orders/bulk-template - Download starter/sample Excel template
router.get('/bulk-template', authenticate, async (req, res) => {
  if (req.user.role !== 'brand_manager') {
    return res.status(403).json({ error: 'Only Brand Managers can download the bulk update template.' });
  }

  try {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'SalesPulse System';
    workbook.created = new Date();

    const sheet = workbook.addWorksheet('Orders_Update_Template');

    sheet.columns = [
      { header: 'Order ID', key: 'order_number', width: 24 },
      { header: 'Employee ID', key: 'staff_code', width: 14 },
      { header: 'Staff Name (Ref)', key: 'staff_name', width: 22 },
      { header: 'Product Code', key: 'product_code', width: 16 },
      { header: 'Product Name (Ref)', key: 'product_name', width: 26 },
      { header: 'Quantity', key: 'quantity', width: 14 },
      { header: 'Payment Method', key: 'payment_method', width: 18 },
      { header: 'Order Date (YYYY-MM-DD)', key: 'order_date', width: 24 },
      { header: 'Status', key: 'status', width: 16 },
      { header: 'Remarks', key: 'remarks', width: 28 }
    ];

    // Style header row
    const headerRow = sheet.getRow(1);
    headerRow.height = 28;
    headerRow.eachCell((cell) => {
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF3B82F6' }
      };
      cell.font = {
        name: 'Segoe UI',
        size: 11,
        bold: true,
        color: { argb: 'FFFFFFFF' }
      };
      cell.alignment = { vertical: 'middle', horizontal: 'center' };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FF2563EB' } },
        left: { style: 'thin', color: { argb: 'FF2563EB' } },
        bottom: { style: 'medium', color: { argb: 'FF1D4ED8' } },
        right: { style: 'thin', color: { argb: 'FF2563EB' } }
      };
    });

    // Populate with real orders from database (up to 25 orders for turnkey editing)
    const existingOrders = query(`
      SELECT
        o.order_number,
        u.staff_id AS staff_code,
        u.name AS staff_name,
        p.code AS product_code,
        p.name AS product_name,
        o.quantity,
        o.payment_method,
        o.order_date,
        o.status,
        o.remarks
      FROM orders o
      JOIN users u ON o.staff_id = u.id
      JOIN products p ON o.product_id = p.id
      ORDER BY o.order_date DESC, o.id DESC
      LIMIT 25
    `);

    for (const ord of existingOrders) {
      const row = sheet.addRow({
        order_number: ord.order_number,
        staff_code: ord.staff_code,
        staff_name: ord.staff_name,
        product_code: ord.product_code,
        product_name: ord.product_name,
        quantity: ord.quantity,
        payment_method: ord.payment_method,
        order_date: ord.order_date,
        status: ord.status,
        remarks: ord.remarks || ''
      });
      row.height = 22;
      row.eachCell((cell) => {
        cell.font = { name: 'Segoe UI', size: 10 };
        cell.alignment = { vertical: 'middle' };
      });
    }

    // Add Instructions worksheet
    const infoSheet = workbook.addWorksheet('Instructions');
    infoSheet.columns = [
      { header: 'Field Name', key: 'field', width: 26 },
      { header: 'Requirement', key: 'req', width: 16 },
      { header: 'Description & Accepted Format', key: 'desc', width: 64 }
    ];

    const infoHeader = infoSheet.getRow(1);
    infoHeader.height = 26;
    infoHeader.eachCell((cell) => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
      cell.font = { name: 'Segoe UI', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
      cell.alignment = { vertical: 'middle', horizontal: 'left' };
    });

    const instructionsData = [
      { field: 'Order ID', req: 'Required', desc: 'Existing unique order identifier (e.g. ORD-20261102-0001). Cannot be empty.' },
      { field: 'Employee ID', req: 'Required', desc: 'Valid Employee ID code (e.g. STF-001). Order must belong to this staff member.' },
      { field: 'Staff Name (Ref)', req: 'Optional', desc: 'Reference only. Ignored during matching.' },
      { field: 'Product Code', req: 'Optional', desc: 'Valid active product SKU (e.g. PRD-001). Leave blank to keep existing product.' },
      { field: 'Product Name (Ref)', req: 'Optional', desc: 'Reference only. Ignored during matching.' },
      { field: 'Quantity', req: 'Required', desc: 'Positive whole number (>= 1). Cannot be lower than already returned units.' },
      { field: 'Payment Method', req: 'Optional', desc: 'Must be either "Prepaid" or "COD".' },
      { field: 'Order Date', req: 'Optional', desc: 'Date format: YYYY-MM-DD (e.g. 2026-11-02).' },
      { field: 'Status', req: 'Optional', desc: 'Order status: Confirmed, Delivered, Pending, or Cancelled.' },
      { field: 'Remarks', req: 'Optional', desc: 'Notes or internal reference remarks.' }
    ];

    for (const item of instructionsData) {
      const row = infoSheet.addRow(item);
      row.height = 22;
      row.eachCell((cell) => {
        cell.font = { name: 'Segoe UI', size: 10 };
        cell.alignment = { vertical: 'middle' };
      });
    }

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="Staff_Orders_Update_Template.xlsx"');

    const buffer = await workbook.xlsx.writeBuffer();
    res.send(buffer);
  } catch (err) {
    console.error('Failed to generate template:', err);
    res.status(500).json({ error: 'Failed to generate Excel template: ' + err.message });
  }
});

// =========================================================================
// BULK ORDER IMPORT & UPDATE ENGINE (Dynamic Staff & Product Detection)
// =========================================================================

// Normalizes text for robust comparison
function normalizeText(str) {
  if (!str) return '';
  return String(str)
    .toLowerCase()
    .replace(/[^a-z0-9]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Helper to check if a string is a staff/employee header label (e.g. "Employee ID")
function isStaffHeaderLabel(str) {
  if (!str) return false;
  const s = normalizeText(str);
  return (
    s === 'employee id' || s === 'staff id' || s === 'emp id' ||
    s === 'employee code' || s === 'staff code' || s === 'emp code' ||
    s === 'empid' || s === 'staffid' || s === 'empcode' || s === 'staffcode' ||
    s === 'employee name' || s === 'staff name' || s === 'emp name' ||
    s === 'employee' || s === 'staff' || s === 'emp' ||
    s === 'sales staff' || s === 'salesperson' || s === 'agent' ||
    s === 'sales staff id' || s === 'sales staff name' ||
    /(?:employee|staff|emp)\s*(?:id|code|no|name)/i.test(s)
  );
}

// Helper to check if a header or value represents staff identification (label or code)
function isStaffHeader(str) {
  if (!str) return false;
  return isStaffHeaderLabel(str) || /^(?:stf|emp)[-_ ]?\d+$/i.test(normalizeText(str));
}

// Cleans product column header to isolate product name
function cleanProductName(headerStr) {
  if (!headerStr) return '';
  if (isStaffHeader(headerStr)) return '';
  return headerStr
    .replace(/\b(prepaid|cod|cash\s*on\s*delivery|c\.?o\.?d\.?|online|card|upi|returns?|ret|quantity|qty|units?|amount|total|order|orders|nos|rate|rs|inr|net\s*banking|neft|pod|advance)\b/gi, ' ')
    .replace(/[()[\]{}_:;#\-–—/]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Auto-detect month & year from filename (e.g. JULY-2026-HYP MONK -> 2026-07)
export function detectMonthYearFromFilename(filename) {
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

  const ym = name.match(/(^|[^0-9])(20\\d{2})[-_](0[1-9]|1[0-2])([^0-9]|$)/);
  if (ym && ym[2] && ym[3]) return `${ym[2]}-${ym[3]}`;

  const my = name.match(/(^|[^0-9])(0[1-9]|1[0-2])[-_](20\\d{2})([^0-9]|$)/);
  if (my && my[2] && my[3]) return `${my[3]}-${my[2]}`;

  return null;
}

// Checks if a normalized string corresponds to a payment method subcolumn
function isPaymentHeader(norm) {
  if (!norm) return false;
  return (
    norm === 'cod' || norm === 'prepaid' || norm === 'cash' || norm === 'online' ||
    norm === 'upi' || norm === 'card' || norm === 'cash on delivery' ||
    norm === 'pre paid' || norm === 'c o d' || norm === 'net banking' ||
    norm === 'paid' || norm === 'advance' || norm === 'pod' || norm === 'neft' ||
    norm.includes('cod') || norm.includes('prepaid') || norm.includes('cash on delivery')
  );
}

// Identifies consolidated summary / rollup sheets to skip (e.g. INCENTIVE, SUMMARY)
function isSummarySheet(sheet) {
  // If the sheet has actual row-level data with DATE and EMPLOYEE ID columns, it is NOT a summary to skip!
  for (let r = 1; r <= Math.min(sheet.rowCount || 10, 10); r++) {
    const row = sheet.getRow(r);
    let hasDate = false;
    let hasStaff = false;
    row.eachCell(cell => {
      const val = normalizeText(getCellValue(cell));
      if (val === 'date' || val === 'day' || val === 'order date' || val === 'dt') hasDate = true;
      if (isStaffHeader(val)) hasStaff = true;
    });
    if (hasDate && hasStaff) {
      return false; // It has real date and employee id transaction rows!
    }
  }

  const nameNorm = normalizeText(sheet.name);
  const summaryKeywords = [
    'summary', 'total', 'consolidated', 'overall',
    'dashboard', 'master summary', 'monthly summary'
  ];
  if (summaryKeywords.some(kw => nameNorm.includes(kw))) {
    return true;
  }
  // Check first 5 rows for summary keywords
  for (let r = 1; r <= Math.min(sheet.rowCount || 5, 5); r++) {
    const row = sheet.getRow(r);
    let rowText = '';
    row.eachCell(cell => { rowText += ' ' + getCellValue(cell); });
    const rowNorm = normalizeText(rowText);
    if (rowNorm.includes('consolidated') || rowNorm.includes('monthly summary') || rowNorm.includes('all staff incentive')) {
      return true;
    }
  }
  return false;
}

// Dynamically extracts Employee ID & Staff Name from a worksheet's header data
function extractStaffInfo(sheet, allStaff = []) {
  let staffId = '';
  let staffName = '';
  let foundIn = '';

  // 1. Direct match on sheet name against any existing staff ID or name
  const sheetNorm = normalizeText(sheet.name);
  const bySheet = allStaff.find(s =>
    normalizeText(s.staff_id) === sheetNorm ||
    normalizeText(s.name) === sheetNorm ||
    normalizeText(s.username) === sheetNorm
  );
  if (bySheet) {
    return {
      rawStaffId: bySheet.staff_id,
      rawStaffName: bySheet.name,
      foundIn: `Sheet name (${sheet.name})`,
      sheetName: sheet.name
    };
  }

  // 2. Scan top rows for explicit staff ID, name, or metadata
  const maxRow = Math.min(sheet.rowCount || 10, 10);
  for (let r = 1; r <= maxRow; r++) {
    const row = sheet.getRow(r);
    const maxCol = Math.min(row.cellCount || 20, 20);

    // Check if this row is a table header row (contains columns like date, product, qty, prepaid, cod)
    let isTableHeaderRow = false;
    row.eachCell(cCell => {
      const cNorm = normalizeText(getCellValue(cCell));
      if (cNorm.includes('date') || cNorm.includes('product') || cNorm.includes('prepaid') || cNorm.includes('cod') || cNorm.includes('qty')) {
        isTableHeaderRow = true;
      }
    });

    for (let c = 1; c <= maxCol; c++) {
      const cell = row.getCell(c);
      const val = getCellValue(cell);
      if (!val) continue;

      const valNorm = normalizeText(val);

      // Check if cell value directly matches any known staff member (only outside table header rows)
      if (!isTableHeaderRow) {
        const directMatch = allStaff.find(s =>
          normalizeText(s.staff_id) === valNorm ||
          normalizeText(s.name) === valNorm ||
          normalizeText(s.username) === valNorm
        );
        if (directMatch) {
          staffId = directMatch.staff_id;
          staffName = directMatch.name;
          foundIn = `Cell ${cell.address} (known staff)`;
          break;
        }
      }

      // Check for inline Employee ID match: e.g. "Employee ID: AS111" or "Emp ID - 102"
      const inlineIdMatch = val.match(/(?:emp(?:loyee)?\s*(?:id|code|no)|staff\s*(?:id|code|no))\s*[:\-#]?\s*([a-zA-Z0-9_\-]+)/i);
      if (inlineIdMatch && inlineIdMatch[1] && normalizeText(inlineIdMatch[1]) !== 'id') {
        staffId = inlineIdMatch[1].trim();
        foundIn = `Cell ${cell.address} (inline)`;
      }

      // Check for label cell: e.g. "Employee ID" or "Staff ID" in metadata (ONLY when not a table header row)
      if (!staffId && !isTableHeaderRow && (
        valNorm === 'employee id' || valNorm === 'staff id' ||
        valNorm === 'emp id' || valNorm === 'emp code' ||
        valNorm === 'staff code' || valNorm === 'empid' || valNorm === 'staffid'
      )) {
        const rightVal = getCellValue(row.getCell(c + 1));
        if (rightVal && !isStaffHeaderLabel(rightVal) && rightVal.length <= 30) {
          staffId = rightVal.trim();
          foundIn = `Cell ${row.getCell(c + 1).address} (right)`;
        } else {
          const belowVal = getCellValue(sheet.getRow(r + 1).getCell(c));
          if (belowVal && !isStaffHeaderLabel(belowVal) && belowVal.length <= 30) {
            staffId = belowVal.trim();
            foundIn = `Cell ${sheet.getRow(r + 1).getCell(c).address} (below)`;
          }
        }
      }

      // Check for Staff Name
      const inlineNameMatch = val.match(/(?:emp(?:loyee)?\s*name|staff\s*name)\s*[:\-#]?\s*([a-zA-Z\s\.]+)/i);
      if (inlineNameMatch && inlineNameMatch[1] && normalizeText(inlineNameMatch[1]) !== 'name') {
        staffName = inlineNameMatch[1].trim();
      } else if (!staffName && !isTableHeaderRow && (valNorm === 'employee name' || valNorm === 'staff name' || valNorm === 'emp name')) {
        const rightVal = getCellValue(row.getCell(c + 1));
        if (rightVal && rightVal.length <= 50) staffName = rightVal.trim();
      }

      // Pattern fallback: explicit ID code like "AS111", "STF-001", "EMP-01" in metadata
      if (!staffId && !isTableHeaderRow) {
        const codePattern = val.match(/\b([A-Z]{1,5}[-_ ]?\d{2,5})\b/i);
        if (codePattern && !normalizeText(codePattern[1]).includes('prepaid') && !normalizeText(codePattern[1]).includes('cod')) {
          staffId = codePattern[1].trim();
          foundIn = `Cell ${cell.address} (pattern)`;
        }
      }
    }
    if (staffId && staffName) break;
  }

  // If staffId or staffName was literally captured as "Employee ID" or "Staff ID", reset it
  if (staffId && isStaffHeaderLabel(staffId)) staffId = '';
  if (staffName && isStaffHeaderLabel(staffName)) staffName = '';

  // Fallback to sheet name if no explicit staff ID was found in cells
  if (!staffId && sheet.name) {
    const sheetCodePattern = sheet.name.match(/\b([A-Z]{1,5}[-_ ]?\d{2,5})\b/i);
    if (sheetCodePattern && !isStaffHeaderLabel(sheetCodePattern[1])) {
      staffId = sheetCodePattern[1].trim();
      foundIn = `Sheet name (${sheet.name})`;
    } else if (!isStaffHeaderLabel(sheet.name)) {
      staffId = sheet.name.trim();
      foundIn = `Sheet name (${sheet.name})`;
    }
  }

  if (!staffName && sheet.name && !isStaffHeaderLabel(sheet.name)) {
    staffName = sheet.name.trim();
  }

  return { rawStaffId: staffId, rawStaffName: staffName, foundIn, sheetName: sheet.name };
}

// Matches extracted staff against database staff with manual mapping support
function matchStaffRecord(staffInfo, allStaff, manualMappings) {
  const { rawStaffId, rawStaffName, sheetName } = staffInfo;

  // 1. Check manual mapping by Brand Manager
  if (manualMappings?.staffMappings) {
    const mappedId = manualMappings.staffMappings[rawStaffId] ||
                     manualMappings.staffMappings[sheetName] ||
                     manualMappings.staffMappings[rawStaffName];
    if (mappedId) {
      const found = allStaff.find(s => String(s.id) === String(mappedId));
      if (found) return { staff: found, isMatched: true, mappedManually: true };
    }
  }

  const idNorm = normalizeText(rawStaffId);
  const nameNorm = normalizeText(rawStaffName);
  const sheetNorm = normalizeText(sheetName);

  // 2. Exact match on staff_id (e.g. STF-001)
  if (rawStaffId) {
    const byCode = allStaff.find(s => normalizeText(s.staff_id) === idNorm);
    if (byCode) return { staff: byCode, isMatched: true };
  }

  // 3. Match on username
  if (rawStaffId) {
    const byUser = allStaff.find(s => normalizeText(s.username) === idNorm);
    if (byUser) return { staff: byUser, isMatched: true };
  }

  // 4. Match on full staff name
  if (rawStaffName) {
    const byName = allStaff.find(s => normalizeText(s.name) === nameNorm);
    if (byName) return { staff: byName, isMatched: true };
  }

  // 5. Match sheet name against staff name or code
  if (sheetName) {
    const bySheet = allStaff.find(s =>
      normalizeText(s.staff_id) === sheetNorm ||
      normalizeText(s.name) === sheetNorm ||
      normalizeText(s.username) === sheetNorm
    );
    if (bySheet) return { staff: bySheet, isMatched: true };
  }

  return {
    staff: null,
    isMatched: false,
    rawStaffId: rawStaffId || sheetName,
    rawStaffName: rawStaffName || sheetName,
    sheetName
  };
}

// Matches extracted product against database products with manual mapping support
function matchProductRecord(rawProductName, allProducts, manualMappings) {
  if (!rawProductName || isStaffHeader(rawProductName)) {
    return { product: null, isMatched: false, rawProductName: rawProductName || '', isStaff: true };
  }

  const rawClean = cleanProductName(rawProductName);
  if (!rawClean || isStaffHeader(rawClean)) {
    return { product: null, isMatched: false, rawProductName: rawProductName || '', isStaff: true };
  }
  const rawNorm = normalizeText(rawClean);

  // 1. Check manual mapping by Brand Manager
  if (manualMappings?.productMappings) {
    const mappedId = manualMappings.productMappings[rawProductName] ||
                     manualMappings.productMappings[rawClean] ||
                     manualMappings.productMappings[rawNorm];
    if (mappedId) {
      const found = allProducts.find(p => String(p.id) === String(mappedId));
      if (found) return { product: found, isMatched: true, mappedManually: true, rawProductName };
    }
  }

  if (!rawNorm) return { product: null, isMatched: false, rawProductName };

  // 2. Exact normalized name match
  const exactName = allProducts.find(p => normalizeText(p.name) === rawNorm);
  if (exactName) return { product: exactName, isMatched: true, rawProductName };

  // 3. Exact normalized code match
  const exactCode = allProducts.find(p => normalizeText(p.code) === rawNorm);
  if (exactCode) return { product: exactCode, isMatched: true, rawProductName };

  // 4. Token subset match (e.g. "Hyper Monk" matches "Hyper Monk 500mg" or vice versa)
  const rawTokens = rawNorm.split(' ').filter(Boolean);
  const tokenMatch = allProducts.find(p => {
    const pTokens = normalizeText(p.name).split(' ').filter(Boolean);
    const pCodeTokens = normalizeText(p.code).split(' ').filter(Boolean);
    const allInP = rawTokens.length > 0 && rawTokens.every(t => pTokens.includes(t) || pCodeTokens.includes(t));
    const allInRaw = pTokens.length > 0 && pTokens.every(t => rawTokens.includes(t));
    return allInP || allInRaw;
  });
  if (tokenMatch) return { product: tokenMatch, isMatched: true, rawProductName };

  // 5. Substring match (e.g. "max ojus" matches "OJUS" or vice versa)
  const subMatch = allProducts.find(p => {
    const pNorm = normalizeText(p.name);
    return (rawNorm.length >= 3 && pNorm.includes(rawNorm)) || (pNorm.length >= 3 && rawNorm.includes(pNorm));
  });
  if (subMatch) return { product: subMatch, isMatched: true, rawProductName };

  // 6. Common business aliases: "MAX" or "HYPER MAX" -> OJUS if an OJUS product exists and not Hyper Monk
  if ((rawNorm.includes('max') || rawNorm === 'hyper max') && !rawNorm.includes('monk')) {
    const ojusProd = allProducts.find(p => normalizeText(p.name).includes('ojus') || normalizeText(p.code).includes('ojus'));
    if (ojusProd) return { product: ojusProd, isMatched: true, rawProductName };
  }

  return { product: null, isMatched: false, rawProductName };
}

// Detects sheet layout (Matrix vs List) and maps product/date/return columns
function detectSheetColumns(sheet, allProducts, manualMappings) {
  const maxScanRows = Math.min(sheet.rowCount || 15, 20);

  // Check for List / Tabular layout headers
  for (let r = 1; r <= maxScanRows; r++) {
    const row = sheet.getRow(r);
    const textMap = {};
    row.eachCell((cell, colIdx) => {
      const t = normalizeText(getCellValue(cell));
      if (t.includes('order') && (t.includes('id') || t.includes('number') || t.includes('no'))) textMap.orderNumber = colIdx;
      else if (t.includes('date') || t === 'dt') textMap.date = colIdx;
      else if (isStaffHeader(t)) textMap.staffCode = colIdx;
      else if (t.includes('product') || t === 'item' || t === 'sku') textMap.product = colIdx;
      else if (t.includes('qty') || t.includes('quantity') || t === 'units') textMap.quantity = colIdx;
      else if (t.includes('payment') || t.includes('paymode') || t === 'method') textMap.paymentMethod = colIdx;
      else if (t.includes('status')) textMap.status = colIdx;
      else if (t.includes('remark') || t.includes('note')) textMap.remarks = colIdx;
      else if (t.includes('return') || t.includes('refund')) textMap.returnQty = colIdx;
    });

    if (textMap.product && textMap.quantity) {
      return {
        layoutType: 'list',
        headerRow: r,
        dataStartRow: r + 1,
        columns: textMap
      };
    }
  }

  // Check for Matrix / Columnar layout (Products in columns across Prepaid / COD)
  // Step 1: Scan rows 1-20 to locate the row containing DATE / DAY / DT / ORDER DATE / SL NO
  let dateRowIdx = null;
  let dateCol = null;

  for (let r = 1; r <= maxScanRows; r++) {
    const row = sheet.getRow(r);
    for (let c = 1; c <= Math.min(sheet.columnCount || 30, 30); c++) {
      const t = normalizeText(getCellValue(row.getCell(c)));
      if (t === 'date' || t === 'day' || t === 'order date' || t === 'dt' || t === 'sl no' || t === 'slno') {
        dateRowIdx = r;
        dateCol = c;
        break;
      }
    }
    if (dateRowIdx) break;
  }

  if (!dateRowIdx) {
    dateRowIdx = 1;
    dateCol = 1;
  }

  // Step 2: Determine if this is a 2-row header (e.g. Row A = products/returns, Row B = COD/Prepaid/Monk/Ojus)
  let headerRowA = dateRowIdx;
  let headerRowB = dateRowIdx;
  let dataStartRow = dateRowIdx + 1;

  if (dateRowIdx < (sheet.rowCount || 0)) {
    const nextRow = sheet.getRow(dateRowIdx + 1);
    let subHeaderCount = 0;
    nextRow.eachCell(cell => {
      const val = normalizeText(getCellValue(cell));
      if (
        val === 'cod' || val === 'prepaid' || val === 'monk' || val === 'ojus' ||
        val === 'amount' || val === 'date' || val === 'incentive' ||
        val === 'total amount' || isStaffHeader(val)
      ) {
        subHeaderCount++;
      }
    });

    if (subHeaderCount >= 2) {
      headerRowA = dateRowIdx;
      headerRowB = dateRowIdx + 1;
      dataStartRow = dateRowIdx + 2;
    }
  }

  const rowA = sheet.getRow(headerRowA);
  const rowB = sheet.getRow(headerRowB);

  let staffCol = null;
  let staffNameCol = null;
  let remarksCol = null;
  let returnAmountCol = null;
  let generalReturnCol = null;
  let incentiveCol = null;
  let totalNetCol = null;
  const productCols = [];
  const returnCols = [];

  const maxCol = Math.min(sheet.columnCount || 35, 35);

  let lastNonEmptyValA = '';
  let lastValAWasReturn = false;

  for (let c = 1; c <= maxCol; c++) {
    if (c === dateCol) continue;

    const cellA = rowA.getCell(c);
    const cellB = rowB.getCell(c);

    let valA = getCellValue(cellA);
    if (!valA && cellA.master) {
      valA = getCellValue(cellA.master);
    }

    let valB = getCellValue(cellB);
    if (!valB && cellB.master) {
      valB = getCellValue(cellB.master);
    }

    const normA = normalizeText(valA);
    const normB = normalizeText(valB);

    // Forward-fill merged parent headers if valA is empty
    if (!valA && lastNonEmptyValA && headerRowA !== headerRowB) {
      const isSubPayment = isPaymentHeader(normB);
      const isSubReturn = lastValAWasReturn && !isSubPayment && normB && !normB.includes('total') && !normB.includes('incentive');
      if (isSubPayment || isSubReturn) {
        valA = lastNonEmptyValA;
      }
    }

    if (valA) {
      lastNonEmptyValA = valA;
      const vNorm = normalizeText(valA);
      lastValAWasReturn = vNorm.includes('return') || vNorm.includes('refund');
    }

    const combinedHeader = [valA, valB].filter(Boolean).join(' ');
    const combinedNorm = normalizeText(combinedHeader);

    if (!combinedNorm) continue;

    // Detect Staff / Employee column - MUST NEVER be treated as a product
    if (isStaffHeader(combinedNorm) || isStaffHeader(valA) || isStaffHeader(valB)) {
      if (combinedNorm.includes('name')) {
        if (!staffNameCol) staffNameCol = c;
      } else {
        if (!staffCol) staffCol = c;
      }
      continue;
    }

    // Detect returns column (product-specific return quantity vs return monetary amount)
    const isReturn = combinedNorm.includes('return') || combinedNorm.includes('refund') || combinedNorm.includes('ret qty') || normB === 'return' || normB === 'returns' || normB === 'ret';
    if (isReturn) {
      const isAmount = combinedNorm.includes('amount') || combinedNorm.includes('inr') || combinedNorm.includes('rs') || combinedNorm.includes('price');
      if (isAmount) {
        if (!returnAmountCol) returnAmountCol = c;
      } else {
        const targetClean = cleanProductName(combinedHeader) || cleanProductName(valB) || cleanProductName(valA);
        const match = targetClean ? matchProductRecord(targetClean, allProducts, manualMappings) : { product: null, isMatched: false };
        returnCols.push({
          colIndex: c,
          rawHeader: combinedHeader,
          rawTarget: targetClean || combinedHeader,
          matchedProduct: match.product,
          isMatched: match.isMatched,
          mappedManually: match.mappedManually || false
        });
        if (!generalReturnCol) generalReturnCol = c;
      }
      continue;
    }

    // Detect remarks column
    if (combinedNorm.includes('remark') || combinedNorm.includes('note') || combinedNorm.includes('comment')) {
      if (!remarksCol) remarksCol = c;
      continue;
    }

    // Detect explicit incentive column on the sheet
    if (combinedNorm.includes('incentive') || combinedNorm.includes('commission')) {
      if (!incentiveCol) incentiveCol = c;
      continue;
    }

    // Detect total amount / net payout column on the sheet
    if (combinedNorm.includes('total amount') || combinedNorm.includes('net amount') || combinedNorm.includes('total net')) {
      if (!totalNetCol) totalNetCol = c;
      continue;
    }

    // Skip rollup / totals / non-product columns
    if (
      combinedNorm.includes('total') || combinedNorm.includes('sum') || combinedNorm.includes('grand') ||
      combinedNorm.includes('basic pay') || combinedNorm.includes('attendance') ||
      combinedNorm.includes('loan') || combinedNorm.includes('deduction') ||
      combinedNorm.includes('bonus') || combinedNorm.includes('present') ||
      combinedNorm.includes('absent') || combinedNorm.includes('leave')
    ) {
      continue;
    }

    // Product name
    const rawProdName = cleanProductName(valA) || cleanProductName(valB) || cleanProductName(combinedHeader);
    if (!rawProdName || rawProdName.length < 2) continue;

    // Determine payment method dynamically
    let paymentMethod = 'Prepaid';
    if (
      combinedNorm.includes('cod') || combinedNorm.includes('cash on delivery') ||
      combinedNorm.includes('cash') || normB === 'cod' || normB === 'cash' || normA === 'cod' ||
      normB.includes('cod') || normA.includes('cod')
    ) {
      paymentMethod = 'COD';
    } else if (
      combinedNorm.includes('prepaid') || combinedNorm.includes('online') ||
      combinedNorm.includes('card') || combinedNorm.includes('upi') ||
      normB === 'prepaid' || normB === 'online' || normA === 'prepaid' ||
      normB.includes('prepaid') || normA.includes('prepaid')
    ) {
      paymentMethod = 'Prepaid';
    }

    const match = matchProductRecord(rawProdName, allProducts, manualMappings);

    productCols.push({
      colIndex: c,
      rawProductHeader: combinedHeader,
      rawProductName: rawProdName,
      paymentMethod,
      matchedProduct: match.product,
      isMatched: match.isMatched,
      mappedManually: match.mappedManually || false
    });
  }

  return {
    layoutType: 'matrix',
    headerRow: headerRowB,
    dataStartRow,
    dateCol,
    staffCol,
    staffNameCol,
    remarksCol,
    returnAmountCol,
    generalReturnCol,
    incentiveCol,
    totalNetCol,
    returnCols,
    productCols
  };
}

// Helper to normalize and parse dates from cells
function parseExcelDate(raw, defaultMonthYear) {
  if (!raw) return null;
  const s = String(raw).trim();

  // Full ISO date YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;

  // Day of month number (e.g. 1 through 31)
  if (/^\d{1,2}$/.test(s)) {
    const day = parseInt(s, 10);
    if (day >= 1 && day <= 31) {
      const my = defaultMonthYear || new Date().toISOString().slice(0, 7);
      return `${my}-${String(day).padStart(2, '0')}`;
    }
  }

  // Format DD/MM/YYYY or DD-MM-YYYY
  const parts = s.split(/[/.-]/);
  if (parts.length === 3) {
    if (parts[0].length === 4) {
      return `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
    } else if (parts[2].length === 4) {
      return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
    }
  }

  // JS Date string
  const d = new Date(raw);
  if (!isNaN(d.getTime())) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  return null;
}

// 2. POST /api/orders/bulk-update-preview - Multi-sheet, dynamic staff & product detection with manual mapping
router.post('/bulk-update-preview', authenticate, async (req, res) => {
  if (req.user.role !== 'brand_manager') {
    return res.status(403).json({ error: 'Only Brand Managers can upload and preview bulk order updates.' });
  }

  const fileName = req.body.fileName || 'monthly_orders.xlsx';
  const fileData = req.body.fileData || req.body.fileBase64;
  const detectedMonth = detectMonthYearFromFilename(fileName);
  const monthYear = (req.body.monthYear && /^\d{4}-\d{2}$/.test(req.body.monthYear.trim()))
    ? req.body.monthYear.trim()
    : (detectedMonth || new Date().toISOString().slice(0, 7));
  const manualMappings = req.body.manualMappings || {};

  if (!fileData) {
    return res.status(400).json({ error: 'No Excel file data received. Please select a valid .xlsx file.' });
  }

  try {
    const buffer = Buffer.from(fileData, 'base64');
    if (!buffer || buffer.length === 0) {
      return res.status(400).json({ error: 'Invalid or empty file content.' });
    }

    // Compute SHA-256 hash to detect accidental duplicate uploads
    const fileHash = crypto.createHash('sha256').update(buffer).digest('hex');
    const existingLog = get('SELECT * FROM import_logs WHERE file_hash = ?', [fileHash]);
    const isDuplicate = !!existingLog;
    const duplicateInfo = existingLog ? {
      fileName: existingLog.file_name,
      importedAt: existingLog.created_at,
      updatedCount: existingLog.updated_count
    } : null;

    // Load Excel workbook
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);

    if (!workbook.worksheets || workbook.worksheets.length === 0) {
      return res.status(400).json({ error: 'No worksheets found in the uploaded Excel workbook.' });
    }

    // Reference data from database
    const allStaff = query('SELECT id, staff_id, name, username, status FROM users WHERE role = "sales_staff"');
    const allProducts = query('SELECT * FROM products');
    const allOrders = query(`
      SELECT
        o.*,
        u.staff_id AS staff_code,
        u.name AS staff_name,
        p.code AS product_code,
        p.name AS product_name,
        COALESCE((SELECT SUM(r.return_quantity) FROM returns r WHERE r.order_id = o.id), 0) AS returned_quantity
      FROM orders o
      JOIN users u ON o.staff_id = u.id
      JOIN products p ON o.product_id = p.id
    `);

    // Index existing orders by order_number and by (staff_id, product_id, payment_method, order_date)
    const orderByNum = new Map();
    const orderByKey = new Map();
    for (const ord of allOrders) {
      if (ord.order_number) orderByNum.set(ord.order_number.trim().toLowerCase(), ord);
      const k = `${ord.staff_id}_${ord.product_id}_${ord.payment_method}_${ord.order_date}`;
      orderByKey.set(k, ord);
    }

    const skippedSheets = [];
    const sheetLayoutSummaries = [];
    const detectedStaffMap = new Map();
    const detectedProductsMap = new Map();

    const parsedRows = [];
    const validUpdateRowsToCache = [];
    const validCreateRowsToCache = [];
    const validStandaloneReturnsToCache = [];
    let totalDetectedReturns = 0;

    const batchOrderKeys = new Set();
    const batchReturnKeys = new Set();
    const matrixPreviewRows = [];
    const seenMatrixRowKeys = new Set();
    const detectedMatrixColDefs = new Map();
    const detectedReturnColDefs = new Map();

    let processedSheetsCount = 0;
    let globalRowIndex = 1;

    // Iterate through all worksheets dynamically
    for (const sheet of workbook.worksheets) {
      // 1. Check if consolidated summary sheet (e.g. INCENTIVE, SUMMARY, TOTALS)
      if (isSummarySheet(sheet)) {
        skippedSheets.push({
          name: sheet.name,
          reason: 'Consolidated summary or incentive calculation sheet'
        });
        continue;
      }

      processedSheetsCount++;

      // 2. Detect column layout (Matrix vs List) and product headers
      const layout = detectSheetColumns(sheet, allProducts, manualMappings);

      // 3. Extract and match staff for this worksheet
      const staffInfo = extractStaffInfo(sheet, allStaff);
      const staffMatch = matchStaffRecord(staffInfo, allStaff, manualMappings);

      // Only register sheet-level staff in detectedStaffMap if sheet does NOT have a staff column in table rows
      if (!layout.staffCol && !layout.columns?.staffCode) {
        const staffKey = staffInfo.rawStaffId || sheet.name;
        if (staffKey && !isStaffHeaderLabel(staffKey) && !detectedStaffMap.has(staffKey)) {
          detectedStaffMap.set(staffKey, {
            rawId: staffInfo.rawStaffId,
            rawName: staffInfo.rawStaffName,
            sheetName: sheet.name,
            matchedStaff: staffMatch.staff,
            isMatched: staffMatch.isMatched,
            mappedManually: staffMatch.mappedManually || false
          });
        }
      }

      if (layout.layoutType === 'matrix') {
        // Register detected products from matrix columns
        for (const pCol of layout.productCols) {
          const prodKey = pCol.rawProductName;
          if (!detectedProductsMap.has(prodKey)) {
            detectedProductsMap.set(prodKey, {
              rawName: pCol.rawProductName,
              columnHeader: pCol.rawProductHeader,
              matchedProduct: pCol.matchedProduct,
              isMatched: pCol.isMatched,
              mappedManually: pCol.mappedManually || false
            });
          }
        }

        // Register any product from return columns that might not be in productCols
        for (const rCol of (layout.returnCols || [])) {
          const prodKey = rCol.rawTarget;
          if (prodKey && !detectedProductsMap.has(prodKey)) {
            detectedProductsMap.set(prodKey, {
              rawName: prodKey,
              columnHeader: rCol.rawHeader,
              matchedProduct: rCol.matchedProduct,
              isMatched: rCol.isMatched,
              mappedManually: rCol.mappedManually || false
            });
          }
        }

        // Iterate data rows (daily records)
        const rowCount = sheet.rowCount || 0;
        for (let r = layout.dataStartRow; r <= rowCount; r++) {
          const row = sheet.getRow(r);
          const rawDateVal = getCellValue(row.getCell(layout.dateCol));
          if (!rawDateVal) continue;

          // Skip total rows
          const rawDateNorm = normalizeText(rawDateVal);
          if (rawDateNorm.includes('total') || rawDateNorm.includes('sum') || rawDateNorm.includes('grand')) {
            continue;
          }

          const parsedDate = parseExcelDate(rawDateVal, monthYear);
          if (!parsedDate) continue;

          // 1. Determine staff for this row (from layout.staffCol or sheet info)
          let currentStaff = staffMatch.staff;
          let currentStaffId = staffInfo.rawStaffId || sheet.name;
          let currentStaffName = staffInfo.rawStaffName || sheet.name;
          let isCurrentStaffMatched = staffMatch.isMatched;

          if (layout.staffCol) {
            const rawCellStaff = getCellValue(row.getCell(layout.staffCol));
            const rawCellStaffName = layout.staffNameCol ? getCellValue(row.getCell(layout.staffNameCol)) : '';
            if (rawCellStaff && !isStaffHeaderLabel(rawCellStaff)) {
              currentStaffId = String(rawCellStaff).trim();
              currentStaffName = rawCellStaffName || currentStaffId;
              const rStaffMatch = matchStaffRecord(
                { rawStaffId: currentStaffId, rawStaffName: currentStaffName, sheetName: sheet.name },
                allStaff,
                manualMappings
              );
              currentStaff = rStaffMatch.staff;
              isCurrentStaffMatched = rStaffMatch.isMatched;

              const staffKey = currentStaffId;
              if (!detectedStaffMap.has(staffKey)) {
                detectedStaffMap.set(staffKey, {
                  rawId: currentStaffId,
                  rawName: currentStaff ? currentStaff.name : currentStaffName,
                  sheetName: sheet.name,
                  matchedStaff: currentStaff,
                  isMatched: rStaffMatch.isMatched,
                  mappedManually: rStaffMatch.mappedManually || false
                });
              }
            }
          }

          // 2. Extract all returns present on this row from detected return columns
          const rowReturns = [];
          for (const rCol of (layout.returnCols || [])) {
            const rawRet = getCellValue(row.getCell(rCol.colIndex));
            const retQty = parseInt(rawRet, 10);
            if (!isNaN(retQty) && retQty > 0) {
              const retTargetKey = rCol.matchedProduct ? rCol.matchedProduct.id : rCol.rawTarget;
              const batchRetKey = `${currentStaffId}_${retTargetKey}_${parsedDate}_${retQty}`;
              if (!batchReturnKeys.has(batchRetKey)) {
                batchReturnKeys.add(batchRetKey);
                rowReturns.push({
                  colIndex: rCol.colIndex,
                  rawHeader: rCol.rawHeader,
                  rawTarget: rCol.rawTarget,
                  matchedProduct: rCol.matchedProduct,
                  returnQty: retQty
                });
                totalDetectedReturns += retQty;
              }
            }
          }

          // Build returns remaining map for this row (keyed by product id or target name)
          const returnsRemainingMap = new Map();
          for (const ret of rowReturns) {
            const key = ret.matchedProduct ? ret.matchedProduct.id : ret.rawTarget;
            returnsRemainingMap.set(key, (returnsRemainingMap.get(key) || 0) + ret.returnQty);
          }

          // 3. Build matrix row snapshot for dynamic columns preview
          const rowQuantities = {};
          const rowReturnsObj = {};
          let rowIncentiveEarned = 0;
          let rowReturnDeduction = 0;

          for (const pCol of layout.productCols) {
            const rawQ = getCellValue(row.getCell(pCol.colIndex));
            const q = parseInt(rawQ, 10);
            const pKey = `${pCol.matchedProduct ? pCol.matchedProduct.code : pCol.rawProductName}_${pCol.paymentMethod}`;
            rowQuantities[pKey] = (!isNaN(q) && q > 0) ? q : 0;
            if (!isNaN(q) && q > 0 && pCol.matchedProduct) {
              const uPrice = pCol.matchedProduct.price || 0;
              const tAmt = Math.round(uPrice * q * 100) / 100;
              const inc = calculateIncentive(pCol.matchedProduct, pCol.paymentMethod, q, tAmt);
              rowIncentiveEarned += inc.amount;
            }
            if (!detectedMatrixColDefs.has(pKey)) {
              detectedMatrixColDefs.set(pKey, {
                key: pKey,
                label: `${pCol.matchedProduct ? pCol.matchedProduct.name : pCol.rawProductName} (${pCol.paymentMethod})`,
                type: 'product',
                productName: pCol.matchedProduct ? pCol.matchedProduct.name : pCol.rawProductName,
                paymentMethod: pCol.paymentMethod
              });
            }
          }

          for (const rCol of (layout.returnCols || [])) {
            const rawR = getCellValue(row.getCell(rCol.colIndex));
            const rq = parseInt(rawR, 10);
            const rKey = `RET_${rCol.matchedProduct ? rCol.matchedProduct.code : rCol.rawTarget}`;
            rowReturnsObj[rKey] = (!isNaN(rq) && rq > 0) ? rq : 0;
            if (!isNaN(rq) && rq > 0 && rCol.matchedProduct) {
              const uPrice = rCol.matchedProduct.price || 0;
              const refAmt = Math.round(uPrice * rq * 100) / 100;
              const rInc = calculateIncentive(rCol.matchedProduct, 'COD', rq, refAmt);
              rowReturnDeduction += rInc.amount;
            }
            if (!detectedReturnColDefs.has(rKey)) {
              detectedReturnColDefs.set(rKey, {
                key: rKey,
                label: `Return ${rCol.matchedProduct ? rCol.matchedProduct.name : rCol.rawTarget}`,
                type: 'return',
                productName: rCol.matchedProduct ? rCol.matchedProduct.name : rCol.rawTarget
              });
            }
          }

          let rowRetAmt = 0;
          if (layout.returnAmountCol) {
            const rawA = getCellValue(row.getCell(layout.returnAmountCol));
            const numA = parseFloat(String(rawA).replace(/[^0-9.]/g, ''));
            if (!isNaN(numA) && numA > 0) rowRetAmt = numA;
          }

          let sheetIncentive = 0;
          if (layout.incentiveCol) {
            const rawInc = getCellValue(row.getCell(layout.incentiveCol));
            const numInc = parseFloat(String(rawInc).replace(/[^0-9.]/g, ''));
            if (!isNaN(numInc) && numInc > 0) sheetIncentive = numInc;
          }

          let sheetTotalNet = 0;
          if (layout.totalNetCol) {
            const rawTot = getCellValue(row.getCell(layout.totalNetCol));
            const numTot = parseFloat(String(rawTot).replace(/[^0-9.]/g, ''));
            if (!isNaN(numTot) && numTot > 0) sheetTotalNet = numTot;
          }

          const matrixKey = `${currentStaffId}_${parsedDate}`;
          if (!seenMatrixRowKeys.has(matrixKey)) {
            seenMatrixRowKeys.add(matrixKey);
            matrixPreviewRows.push({
              sheetName: sheet.name,
              rowNumber: r,
              date: parsedDate,
              employeeId: currentStaffId,
              staffName: currentStaff ? currentStaff.name : (currentStaffName || currentStaffId),
              isStaffMatched: isCurrentStaffMatched,
              quantities: rowQuantities,
              returns: rowReturnsObj,
              returnAmount: rowRetAmt,
              grossIncentive: sheetIncentive > 0 ? sheetIncentive : Math.round(rowIncentiveEarned * 100) / 100,
              sheetIncentive,
              returnDeductions: Math.round(rowReturnDeduction * 100) / 100,
              netIncentive: sheetTotalNet > 0 ? sheetTotalNet : Math.max(0, Math.round((rowIncentiveEarned - rowReturnDeduction) * 100) / 100),
              sheetTotalNet,
              status: isCurrentStaffMatched ? 'valid' : 'unmatched'
            });
          }

          // Evaluate each product sales column
          for (const pCol of layout.productCols) {
            const rawQtyVal = getCellValue(row.getCell(pCol.colIndex));
            if (!rawQtyVal || isNaN(parseInt(rawQtyVal, 10))) continue;

            const quantity = parseInt(rawQtyVal, 10);
            if (quantity <= 0) continue;

            const currentProduct = pCol.matchedProduct;

            // Allocate product-specific return quantity (does not bleed into other products)
            const prodKey = currentProduct ? currentProduct.id : pCol.rawProductName;
            const availReturn = returnsRemainingMap.get(prodKey) || 0;
            const orderReturnQty = Math.min(quantity, availReturn);
            if (orderReturnQty > 0) {
              returnsRemainingMap.set(prodKey, availReturn - orderReturnQty);
            }

            const rowItem = {
              rowNumber: globalRowIndex++,
              sheetName: sheet.name,
              excelData: {
                date: parsedDate,
                staffId: currentStaffId,
                staffName: currentStaff ? currentStaff.name : currentStaffName,
                productName: pCol.rawProductName,
                quantity,
                paymentMethod: pCol.paymentMethod,
                returnQuantity: orderReturnQty
              },
              currentOrder: null,
              newValues: null,
              status: 'pending',
              error: null,
              changes: []
            };

            // Check staff match
            if (!isCurrentStaffMatched || !currentStaff) {
              rowItem.status = 'unmatched';
              rowItem.error = `Unmatched staff Employee ID "${currentStaffId}" on sheet "${sheet.name}". Please map to an existing sales staff member.`;
              parsedRows.push(rowItem);
              continue;
            }

            // Check product match
            if (!pCol.isMatched || !currentProduct) {
              rowItem.status = 'unmatched';
              rowItem.error = `Unmatched product "${pCol.rawProductName}". Please map to an existing product in Product Management.`;
              parsedRows.push(rowItem);
              continue;
            }

            // Calculate price, amount, incentive
            const unitPrice = currentProduct.price || 0;
            const totalAmount = Math.round(unitPrice * quantity * 100) / 100;
            const incentive = calculateIncentive(currentProduct, pCol.paymentMethod, quantity, totalAmount);

            rowItem.newValues = {
              staffId: currentStaff.id,
              staffCode: currentStaff.staff_id,
              staffName: currentStaff.name,
              productId: currentProduct.id,
              productCode: currentProduct.code,
              productName: currentProduct.name,
              quantity,
              unitPrice,
              totalAmount,
              paymentMethod: pCol.paymentMethod,
              orderDate: parsedDate,
              status: 'Confirmed',
              incentiveType: incentive.type,
              incentiveBasis: incentive.basis,
              incentiveRate: incentive.rate,
              incentiveAmount: incentive.amount
            };

            // Look up existing order by (staff_id, product_id, payment_method, order_date)
            const matchKey = `${currentStaff.id}_${currentProduct.id}_${pCol.paymentMethod}_${parsedDate}`;
            if (batchOrderKeys.has(matchKey)) {
              continue;
            }
            batchOrderKeys.add(matchKey);

            const existingOrder = orderByKey.get(matchKey);

            if (existingOrder) {
              rowItem.currentOrder = {
                id: existingOrder.id,
                orderNumber: existingOrder.order_number,
                staffId: existingOrder.staff_id,
                staffCode: existingOrder.staff_code,
                staffName: existingOrder.staff_name,
                productId: existingOrder.product_id,
                productCode: existingOrder.product_code,
                productName: existingOrder.product_name,
                quantity: existingOrder.quantity,
                unitPrice: existingOrder.unit_price,
                totalAmount: existingOrder.total_amount,
                paymentMethod: existingOrder.payment_method,
                orderDate: existingOrder.order_date,
                status: existingOrder.status,
                incentiveAmount: existingOrder.incentive_amount,
                returnedQuantity: existingOrder.returned_quantity
              };

              // Check if values changed
              if (existingOrder.quantity === quantity && existingOrder.product_id === currentProduct.id) {
                rowItem.status = 'no_change';
                if (orderReturnQty > 0) {
                  validUpdateRowsToCache.push({
                    orderId: existingOrder.id,
                    orderNumber: existingOrder.order_number,
                    staffId: currentStaff.id,
                    newProductId: currentProduct.id,
                    newQuantity: quantity,
                    newPaymentMethod: pCol.paymentMethod,
                    newOrderDate: parsedDate,
                    newStatus: existingOrder.status || 'Confirmed',
                    newRemarks: existingOrder.remarks || '',
                    returnQuantity: orderReturnQty,
                    rowNumber: rowItem.rowNumber
                  });
                }
              } else {
                rowItem.status = 'valid_update';
                rowItem.changes.push({
                  field: 'Quantity',
                  oldVal: `${existingOrder.quantity} units`,
                  newVal: `${quantity} units`
                });
                validUpdateRowsToCache.push({
                  orderId: existingOrder.id,
                  orderNumber: existingOrder.order_number,
                  staffId: currentStaff.id,
                  newProductId: currentProduct.id,
                  newQuantity: quantity,
                  newPaymentMethod: pCol.paymentMethod,
                  newOrderDate: parsedDate,
                  newStatus: existingOrder.status || 'Confirmed',
                  newRemarks: existingOrder.remarks || '',
                  returnQuantity: orderReturnQty,
                  rowNumber: rowItem.rowNumber
                });
              }
            } else {
              // Valid new order to create
              rowItem.status = 'valid_create';
              validCreateRowsToCache.push({
                staffId: currentStaff.id,
                productId: currentProduct.id,
                quantity,
                paymentMethod: pCol.paymentMethod,
                orderDate: parsedDate,
                returnQuantity: orderReturnQty,
                rowNumber: rowItem.rowNumber
              });
            }

            parsedRows.push(rowItem);
          }

          // Handle any unallocated returns on this date (e.g. staff on leave or returns > sales)
          for (const [prodKey, remQty] of returnsRemainingMap.entries()) {
            if (remQty > 0) {
              const retItem = rowReturns.find(r => (r.matchedProduct ? r.matchedProduct.id : r.rawTarget) === prodKey);
              const targetProduct = retItem?.matchedProduct || allProducts.find(p => p.id === prodKey);
              const targetProdName = targetProduct?.name || retItem?.rawTarget || String(prodKey);

              const rowItem = {
                rowNumber: globalRowIndex++,
                sheetName: sheet.name,
                excelData: {
                  date: parsedDate,
                  staffId: currentStaffId,
                  staffName: currentStaff ? currentStaff.name : currentStaffName,
                  productName: targetProdName,
                  quantity: 0,
                  paymentMethod: 'COD',
                  returnQuantity: remQty
                },
                currentOrder: null,
                newValues: null,
                status: (isCurrentStaffMatched && targetProduct) ? 'valid_create' : 'unmatched',
                error: !isCurrentStaffMatched
                  ? `Unmatched staff Employee ID "${currentStaffId}" on sheet "${sheet.name}".`
                  : (!targetProduct ? `Unmatched product "${targetProdName}".` : null),
                changes: []
              };

              if (isCurrentStaffMatched && currentStaff && targetProduct) {
                const retMatchKey = `${currentStaff.id}_${targetProduct.id}_${parsedDate}_${remQty}`;
                if (batchReturnKeys.has(retMatchKey)) {
                  continue;
                }
                batchReturnKeys.add(retMatchKey);

                validStandaloneReturnsToCache.push({
                  staffId: currentStaff.id,
                  productId: targetProduct.id,
                  paymentMethod: 'COD',
                  returnQuantity: remQty,
                  orderDate: parsedDate,
                  sheetName: sheet.name,
                  rowNumber: rowItem.rowNumber
                });
              }

              parsedRows.push(rowItem);
            }
          }
        }
      } else {
        // LayoutType: List / Tabular layout
        const rowCount = sheet.rowCount || 0;
        const cols = layout.columns;

        for (let r = layout.dataStartRow; r <= rowCount; r++) {
          const row = sheet.getRow(r);
          const rawProdVal = getCellValue(row.getCell(cols.product));
          const rawQtyVal = getCellValue(row.getCell(cols.quantity));
          if (!rawProdVal && !rawQtyVal) continue;

          const rawDateVal = cols.date ? getCellValue(row.getCell(cols.date)) : null;
          const parsedDate = parseExcelDate(rawDateVal, monthYear) || new Date().toISOString().slice(0, 10);
          const rawOrderNum = cols.orderNumber ? getCellValue(row.getCell(cols.orderNumber)) : null;
          const rawPayment = cols.paymentMethod ? getCellValue(row.getCell(cols.paymentMethod)) : 'Prepaid';
          const paymentMethod = normalizeText(rawPayment).includes('cod') ? 'COD' : 'Prepaid';
          const quantity = parseInt(rawQtyVal, 10) || 1;

          let returnQty = 0;
          if (cols.returnQty) {
            const rawRet = getCellValue(row.getCell(cols.returnQty));
            const q = parseInt(rawRet, 10);
            if (!isNaN(q) && q > 0) {
              returnQty = q;
              totalDetectedReturns += q;
            }
          }

          // Product matching (ensure staff headers/codes are never registered as products)
          let rawProdValClean = rawProdVal;
          if (isStaffHeader(rawProdVal)) {
            rawProdValClean = '';
          }

          const prodMatch = matchProductRecord(rawProdValClean, allProducts, manualMappings);
          if (rawProdValClean && !isStaffHeader(rawProdValClean) && !detectedProductsMap.has(rawProdValClean)) {
            detectedProductsMap.set(rawProdValClean, {
              rawName: rawProdValClean,
              columnHeader: 'Product Column',
              matchedProduct: prodMatch.product,
              isMatched: prodMatch.isMatched,
              mappedManually: prodMatch.mappedManually || false
            });
          }

          // Staff matching (per row or per sheet)
          let rowStaff = staffMatch.staff;
          let rowStaffId = staffInfo.rawStaffId || sheet.name;
          let rowStaffName = staffInfo.rawStaffName || '';
          let isRowStaffMatched = staffMatch.isMatched;

          if (cols.staffCode) {
            const rawRowStaff = getCellValue(row.getCell(cols.staffCode));
            if (rawRowStaff && !isStaffHeaderLabel(rawRowStaff)) {
              rowStaffId = String(rawRowStaff).trim();
              const rStaffMatch = matchStaffRecord(
                { rawStaffId: rowStaffId, rawStaffName: '', sheetName: sheet.name },
                allStaff,
                manualMappings
              );
              rowStaff = rStaffMatch.staff;
              isRowStaffMatched = rStaffMatch.isMatched;

              const staffKey = rowStaffId;
              if (!detectedStaffMap.has(staffKey)) {
                detectedStaffMap.set(staffKey, {
                  rawId: rowStaffId,
                  rawName: rowStaff ? rowStaff.name : rowStaffId,
                  sheetName: sheet.name,
                  matchedStaff: rowStaff,
                  isMatched: rStaffMatch.isMatched,
                  mappedManually: rStaffMatch.mappedManually || false
                });
              }
            }
          }

          const rowItem = {
            rowNumber: globalRowIndex++,
            sheetName: sheet.name,
            excelData: {
              orderNumber: rawOrderNum,
              date: parsedDate,
              staffId: rowStaffId,
              staffName: rowStaff ? rowStaff.name : (rowStaffName || rowStaffId),
              productName: rawProdValClean || rawProdVal,
              quantity,
              paymentMethod,
              returnQuantity: returnQty
            },
            currentOrder: null,
            newValues: null,
            status: 'pending',
            error: null,
            changes: []
          };

          if (!isRowStaffMatched || !rowStaff) {
            rowItem.status = 'unmatched';
            rowItem.error = `Unmatched staff Employee ID "${rowStaffId}". Please map to an existing sales staff member.`;
            parsedRows.push(rowItem);
            continue;
          }

          if (!prodMatch.isMatched || !prodMatch.product) {
            rowItem.status = 'unmatched';
            rowItem.error = `Unmatched product "${rawProdVal}". Please map to an existing product in Product Management.`;
            parsedRows.push(rowItem);
            continue;
          }

          const currentProduct = prodMatch.product;
          const unitPrice = currentProduct.price || 0;
          const totalAmount = Math.round(unitPrice * quantity * 100) / 100;
          const incentive = calculateIncentive(currentProduct, paymentMethod, quantity, totalAmount);

          rowItem.newValues = {
            staffId: rowStaff.id,
            staffCode: rowStaff.staff_id,
            staffName: rowStaff.name,
            productId: currentProduct.id,
            productCode: currentProduct.code,
            productName: currentProduct.name,
            quantity,
            unitPrice,
            totalAmount,
            paymentMethod,
            orderDate: parsedDate,
            status: 'Confirmed',
            incentiveAmount: incentive.amount
          };

          // Existing order lookup by order_number or (staff, product, payment, date)
          let existingOrder = null;
          if (rawOrderNum) {
            existingOrder = orderByNum.get(rawOrderNum.trim().toLowerCase());
          }
          if (!existingOrder) {
            const k = `${rowStaff.id}_${currentProduct.id}_${paymentMethod}_${parsedDate}`;
            existingOrder = orderByKey.get(k);
          }

          if (existingOrder) {
            rowItem.currentOrder = {
              id: existingOrder.id,
              orderNumber: existingOrder.order_number,
              staffId: existingOrder.staff_id,
              staffCode: existingOrder.staff_code,
              staffName: existingOrder.staff_name,
              productId: existingOrder.product_id,
              productCode: existingOrder.product_code,
              productName: existingOrder.product_name,
              quantity: existingOrder.quantity,
              unitPrice: existingOrder.unit_price,
              totalAmount: existingOrder.total_amount,
              paymentMethod: existingOrder.payment_method,
              orderDate: existingOrder.order_date,
              status: existingOrder.status,
              incentiveAmount: existingOrder.incentive_amount,
              returnedQuantity: existingOrder.returned_quantity
            };

            if (existingOrder.quantity === quantity && existingOrder.product_id === currentProduct.id) {
              rowItem.status = 'no_change';
              if (returnQty > 0) {
                validUpdateRowsToCache.push({
                  orderId: existingOrder.id,
                  orderNumber: existingOrder.order_number,
                  staffId: rowStaff.id,
                  newProductId: currentProduct.id,
                  newQuantity: quantity,
                  newPaymentMethod: paymentMethod,
                  newOrderDate: parsedDate,
                  newStatus: existingOrder.status || 'Confirmed',
                  newRemarks: existingOrder.remarks || '',
                  returnQuantity: returnQty,
                  rowNumber: rowItem.rowNumber
                });
              }
            } else {
              rowItem.status = 'valid_update';
              rowItem.changes.push({
                field: 'Quantity',
                oldVal: `${existingOrder.quantity} units`,
                newVal: `${quantity} units`
              });
              validUpdateRowsToCache.push({
                orderId: existingOrder.id,
                orderNumber: existingOrder.order_number,
                staffId: rowStaff.id,
                newProductId: currentProduct.id,
                newQuantity: quantity,
                newPaymentMethod: paymentMethod,
                newOrderDate: parsedDate,
                newStatus: existingOrder.status || 'Confirmed',
                newRemarks: existingOrder.remarks || '',
                returnQuantity: returnQty,
                rowNumber: rowItem.rowNumber
              });
            }
          } else {
            rowItem.status = 'valid_create';
            validCreateRowsToCache.push({
              staffId: rowStaff.id,
              productId: currentProduct.id,
              quantity,
              paymentMethod,
              orderDate: parsedDate,
              returnQuantity: returnQty,
              rowNumber: rowItem.rowNumber
            });
          }

          parsedRows.push(rowItem);
        }
      }

      // Record sheet layout summary for dynamic column visibility
      sheetLayoutSummaries.push({
        sheetName: sheet.name,
        layoutType: layout.layoutType,
        staff: staffMatch.staff ? { id: staffMatch.staff.id, name: staffMatch.staff.name, staff_id: staffMatch.staff.staff_id } : null,
        rawStaffId: staffInfo.rawStaffId || sheet.name,
        isStaffMatched: staffMatch.isMatched,
        dateCol: layout.dateCol,
        staffCol: layout.staffCol,
        productColumns: (layout.productCols || []).map(p => ({
          colIndex: p.colIndex,
          header: p.rawProductHeader,
          productName: p.rawProductName,
          paymentMethod: p.paymentMethod,
          matchedProduct: p.matchedProduct ? { id: p.matchedProduct.id, name: p.matchedProduct.name, code: p.matchedProduct.code } : null,
          isMatched: p.isMatched
        })),
        returnColumns: (layout.returnCols || []).map(r => ({
          colIndex: r.colIndex,
          header: r.rawHeader,
          target: r.rawTarget,
          matchedProduct: r.matchedProduct ? { id: r.matchedProduct.id, name: r.matchedProduct.name, code: r.matchedProduct.code } : null,
          isMatched: r.isMatched
        }))
      });
    }

    const detectedStaff = Array.from(detectedStaffMap.values()).filter(
      s => (s.rawId || s.sheetName) && !isStaffHeaderLabel(s.rawId) && !isStaffHeaderLabel(s.sheetName)
    );
    const detectedProducts = Array.from(detectedProductsMap.values()).filter(
      p => !isStaffHeader(p.rawName) && !isStaffHeader(p.columnHeader)
    );

    const unmatchedStaff = detectedStaff.filter(s => !s.isMatched);
    const unmatchedProducts = detectedProducts.filter(p => !p.isMatched);

    const toUpdateCount = parsedRows.filter(r => r.status === 'valid_update').length;
    const toCreateCount = parsedRows.filter(r => r.status === 'valid_create').length;
    const unchangedCount = parsedRows.filter(r => r.status === 'no_change').length;
    const unmatchedCount = parsedRows.filter(r => r.status === 'unmatched').length;
    const invalidCount = parsedRows.filter(r => r.status === 'invalid').length;

    const canConfirm = unmatchedStaff.length === 0 &&
                       unmatchedProducts.length === 0 &&
                       (toUpdateCount > 0 || toCreateCount > 0 || validStandaloneReturnsToCache.length > 0);

    // Cache preview session
    const previewToken = crypto.randomBytes(24).toString('hex');
    previewCache.set(previewToken, {
      fileHash,
      fileName,
      rowsToUpdate: validUpdateRowsToCache,
      rowsToCreate: validCreateRowsToCache,
      standaloneReturns: validStandaloneReturnsToCache,
      createdBy: req.user.id,
      expiresAt: Date.now() + 15 * 60 * 1000
    });

    const matrixColumns = [
      { key: 'date', label: 'Date', width: '100px' },
      { key: 'employeeId', label: 'Employee ID', width: '110px' },
      { key: 'staffName', label: 'Staff Name', width: '130px' },
      ...Array.from(detectedMatrixColDefs.values()),
      { key: 'grossIncentive', label: 'Incentive', type: 'currency' },
      ...Array.from(detectedReturnColDefs.values()),
      { key: 'returnDeductions', label: 'Return Deductions', type: 'currency' },
      { key: 'netIncentive', label: 'Total Net', type: 'currency' },
      { key: 'status', label: 'Status', width: '90px' }
    ];

    res.json({
      previewToken,
      fileHash,
      fileName,
      isDuplicate,
      duplicateInfo,
      monthYear,
      summary: {
        totalWorksheets: workbook.worksheets.length,
        processedSheets: processedSheetsCount,
        skippedSheets,
        detectedStaff,
        unmatchedStaff,
        detectedProducts,
        unmatchedProducts,
        totalRows: parsedRows.length,
        totalReturns: totalDetectedReturns,
        matchedOrders: toUpdateCount + toCreateCount + unchangedCount,
        toUpdate: toUpdateCount,
        toCreate: toCreateCount,
        noChange: unchangedCount,
        unmatched: unmatchedCount,
        invalid: invalidCount
      },
      canConfirm,
      mappingRequired: unmatchedStaff.length > 0 || unmatchedProducts.length > 0,
      sheetLayouts: sheetLayoutSummaries,
      matrixColumns,
      matrixRows: matrixPreviewRows,
      rows: parsedRows
    });
  } catch (err) {
    console.error('Failed to process bulk update preview:', err);
    res.status(500).json({ error: 'Failed to process Excel file: ' + (err.message || 'Unknown parsing error') });
  }
});

// 3. POST /api/orders/bulk-update-confirm - Safely execute confirmed updates and creations in transaction
router.post('/bulk-update-confirm', authenticate, (req, res) => {
  if (req.user.role !== 'brand_manager') {
    return res.status(403).json({ error: 'Only Brand Managers can confirm bulk order updates.' });
  }

  const { previewToken } = req.body;
  if (!previewToken) {
    return res.status(400).json({ error: 'Preview token is required to confirm updates.' });
  }

  const preview = previewCache.get(previewToken);
  if (!preview) {
    return res.status(400).json({ error: 'Preview session has expired or was already applied. Please re-upload your Excel file.' });
  }

  if (preview.createdBy !== req.user.id) {
    return res.status(403).json({ error: 'Unauthorized to confirm this import session.' });
  }

  const now = new Date().toISOString();
  let updatedOrdersCount = 0;
  let createdOrdersCount = 0;
  let returnsCreatedCount = 0;
  const errors = [];

  try {
    transaction(() => {
      // 1. Process Updates
      for (const item of (preview.rowsToUpdate || [])) {
        try {
          const currentOrder = get('SELECT * FROM orders WHERE id = ?', [item.orderId]);
          if (!currentOrder) {
            errors.push({
              rowNumber: item.rowNumber,
              orderNumber: item.orderNumber,
              reason: 'Order record was deleted from database.'
            });
            continue;
          }

          const product = get('SELECT * FROM products WHERE id = ?', [item.newProductId]);
          if (!product) {
            errors.push({
              rowNumber: item.rowNumber,
              orderNumber: item.orderNumber,
              reason: 'Product record was not found in catalog.'
            });
            continue;
          }

          const unitPrice = product.price || 0;
          const totalAmount = Math.round(unitPrice * item.newQuantity * 100) / 100;
          const incentive = calculateIncentive(product, item.newPaymentMethod, item.newQuantity, totalAmount);

          run(`
            UPDATE orders SET
              product_id = ?,
              quantity = ?,
              unit_price = ?,
              total_amount = ?,
              payment_method = ?,
              order_date = ?,
              status = ?,
              remarks = ?,
              incentive_type = ?,
              incentive_basis = ?,
              incentive_rate = ?,
              incentive_amount = ?,
              updated_at = ?
            WHERE id = ?
          `, [
            product.id,
            item.newQuantity,
            unitPrice,
            totalAmount,
            item.newPaymentMethod,
            item.newOrderDate,
            item.newStatus || 'Confirmed',
            item.newRemarks || '',
            incentive.type,
            incentive.basis,
            incentive.rate,
            incentive.amount,
            now,
            currentOrder.id
          ]);

          // Recalculate any existing returns linked to this order
          const linkedReturns = query('SELECT id, return_quantity FROM returns WHERE order_id = ?', [currentOrder.id]);
          for (const ret of linkedReturns) {
            const newRev = item.newQuantity > 0
              ? Math.round((ret.return_quantity / item.newQuantity) * incentive.amount * 100) / 100
              : 0;
            run('UPDATE returns SET reversed_incentive = ?, updated_at = ? WHERE id = ?', [
              newRev,
              now,
              ret.id
            ]);
          }

          // If row had a return recorded and no return exists yet
          if (item.returnQuantity && item.returnQuantity > 0 && linkedReturns.length === 0) {
            const dateClean = (item.newOrderDate || now.slice(0, 10)).replace(/-/g, '');
            const retNum = `RET-${dateClean}-${String(Math.floor(1000 + Math.random() * 9000))}`;
            const revIncentive = item.newQuantity > 0
              ? Math.round((item.returnQuantity / item.newQuantity) * incentive.amount * 100) / 100
              : 0;
            const refundAmount = Math.round(unitPrice * item.returnQuantity * 100) / 100;

            run(`
              INSERT INTO returns (
                return_number, order_id, staff_id, product_id, returned_by_staff_id, payment_method,
                return_quantity, return_amount, return_date, return_reason, remarks, reversed_incentive,
                created_at, updated_at
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [
              retNum,
              currentOrder.id,
              currentOrder.staff_id,
              product.id,
              currentOrder.staff_id,
              item.newPaymentMethod,
              item.returnQuantity,
              refundAmount,
              item.newOrderDate,
              'Product Return (Excel Import)',
              'Imported via monthly Excel report',
              revIncentive,
              now,
              now
            ]);
            returnsCreatedCount++;
          }

          updatedOrdersCount++;
        } catch (rowErr) {
          errors.push({
            rowNumber: item.rowNumber,
            orderNumber: item.orderNumber,
            reason: rowErr.message || 'Failed to update record'
          });
        }
      }

      // 2. Process Creations (New Orders)
      let defaultCustomer = get('SELECT id FROM customers WHERE phone = ?', ['0000000000']);
      if (!defaultCustomer) {
        const custRes = run(
          'INSERT INTO customers (name, phone, address, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
          ['Direct Customer', '0000000000', 'Direct In-Store / Monthly Report', now, now]
        );
        defaultCustomer = { id: custRes.lastInsertRowid };
      }

      for (const item of (preview.rowsToCreate || [])) {
        try {
          const product = get('SELECT * FROM products WHERE id = ?', [item.productId]);
          if (!product) {
            errors.push({
              rowNumber: item.rowNumber,
              reason: 'Product record was not found in catalog.'
            });
            continue;
          }

          const staff = get('SELECT id, staff_id FROM users WHERE id = ? AND role = "sales_staff"', [item.staffId]);
          if (!staff) {
            errors.push({
              rowNumber: item.rowNumber,
              reason: 'Assigned staff member not found in database.'
            });
            continue;
          }

          const unitPrice = product.price || 0;
          const totalAmount = Math.round(unitPrice * item.quantity * 100) / 100;
          const incentive = calculateIncentive(product, item.paymentMethod, item.quantity, totalAmount);

          // Generate unique order number: ORD-YYYYMMDD-XXXX
          const dateClean = (item.orderDate || now.slice(0, 10)).replace(/-/g, '');
          let uniqueOrderNum = '';
          let attempts = 0;
          while (!uniqueOrderNum && attempts < 10) {
            attempts++;
            const randSuffix = String(Math.floor(1000 + Math.random() * 9000));
            const candidate = `ORD-${dateClean}-${randSuffix}`;
            const exists = get('SELECT id FROM orders WHERE order_number = ?', [candidate]);
            if (!exists) uniqueOrderNum = candidate;
          }
          if (!uniqueOrderNum) {
            uniqueOrderNum = `ORD-${dateClean}-${Date.now().toString().slice(-4)}`;
          }

          const orderRes = run(`
            INSERT INTO orders (
              order_number,
              staff_id,
              customer_id,
              product_id,
              quantity,
              unit_price,
              total_amount,
              payment_method,
              order_date,
              status,
              remarks,
              incentive_type,
              incentive_basis,
              incentive_rate,
              incentive_amount,
              created_at,
              updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `, [
            uniqueOrderNum,
            staff.id,
            defaultCustomer.id,
            product.id,
            item.quantity,
            unitPrice,
            totalAmount,
            item.paymentMethod,
            item.orderDate,
            'Confirmed',
            'Imported via Excel monthly report',
            incentive.type,
            incentive.basis,
            incentive.rate,
            incentive.amount,
            now,
            now
          ]);

          const newOrderId = orderRes.lastInsertRowid;

          // If row had a return recorded and quantity was valid
          if (item.returnQuantity && item.returnQuantity > 0) {
            const retNum = `RET-${dateClean}-${String(Math.floor(1000 + Math.random() * 9000))}`;
            const revIncentive = Math.round((item.returnQuantity / item.quantity) * incentive.amount * 100) / 100;
            const refundAmount = Math.round(unitPrice * item.returnQuantity * 100) / 100;

            run(`
              INSERT INTO returns (
                return_number,
                order_id,
                staff_id,
                product_id,
                returned_by_staff_id,
                payment_method,
                return_quantity,
                return_amount,
                return_date,
                return_reason,
                remarks,
                reversed_incentive,
                created_at,
                updated_at
              ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [
              retNum,
              newOrderId,
              staff.id,
              product.id,
              staff.id,
              item.paymentMethod,
              item.returnQuantity,
              refundAmount,
              item.orderDate,
              'Product Return (Excel Import)',
              'Imported via monthly Excel report',
              revIncentive,
              now,
              now
            ]);
            returnsCreatedCount++;
          }

          createdOrdersCount++;
        } catch (createErr) {
          errors.push({
            rowNumber: item.rowNumber,
            reason: createErr.message || 'Failed to create new order record'
          });
        }
      }

      // 3. Process Standalone Returns (Returns on leave days or where return quantity was unattached)
      for (const item of (preview.standaloneReturns || [])) {
        try {
          const product = get('SELECT * FROM products WHERE id = ?', [item.productId]);
          const staff = get('SELECT id FROM users WHERE id = ? AND role = "sales_staff"', [item.staffId]);
          if (!product || !staff) continue;

          // Find candidate order for this staff and product to link if available
          const candidateOrder = get(`
            SELECT o.*,
              COALESCE((SELECT SUM(r.return_quantity) FROM returns r WHERE r.order_id = o.id), 0) AS already_returned_qty
            FROM orders o
            WHERE o.staff_id = ? AND o.product_id = ? AND o.status != 'Cancelled'
              AND o.quantity > COALESCE((SELECT SUM(r.return_quantity) FROM returns r WHERE r.order_id = o.id), 0)
            ORDER BY o.order_date DESC, o.id DESC
            LIMIT 1
          `, [staff.id, product.id]);

          const linkedOrderId = (candidateOrder && (candidateOrder.quantity - candidateOrder.already_returned_qty) >= item.returnQuantity)
            ? candidateOrder.id
            : null;

          const dateClean = (item.orderDate || now.slice(0, 10)).replace(/-/g, '');
          const retNum = `RET-${dateClean}-${String(Math.floor(1000 + Math.random() * 9000))}`;
          const unitPrice = product.price || 0;
          const refundAmount = Math.round(unitPrice * item.returnQuantity * 100) / 100;
          const incObj = calculateIncentive(product, item.paymentMethod || 'COD', item.returnQuantity, refundAmount);

          run(`
            INSERT INTO returns (
              return_number,
              order_id,
              staff_id,
              product_id,
              returned_by_staff_id,
              payment_method,
              return_quantity,
              return_amount,
              return_date,
              return_reason,
              remarks,
              reversed_incentive,
              created_at,
              updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `, [
            retNum,
            linkedOrderId,
            staff.id,
            product.id,
            staff.id,
            item.paymentMethod || 'COD',
            item.returnQuantity,
            refundAmount,
            item.orderDate,
            'Product Return (Excel Import)',
            'Imported via monthly Excel report',
            incObj.amount,
            now,
            now
          ]);
          returnsCreatedCount++;
        } catch (stErr) {
          console.error('Failed to create standalone return record:', stErr);
        }
      }

      // Record in import_logs
      run(`
        INSERT INTO import_logs (file_hash, file_name, total_rows, updated_count, created_at, created_by)
        VALUES (?, ?, ?, ?, ?, ?)
      `, [
        preview.fileHash,
        preview.fileName,
        (preview.rowsToUpdate?.length || 0) + (preview.rowsToCreate?.length || 0),
        updatedOrdersCount + createdOrdersCount,
        now,
        req.user.id
      ]);
    });

    // Invalidate token
    previewCache.delete(previewToken);

    res.json({
      success: true,
      updatedCount: updatedOrdersCount,
      createdCount: createdOrdersCount,
      returnsCreatedCount,
      totalProcessed: updatedOrdersCount + createdOrdersCount,
      errors,
      message: `Successfully processed ${updatedOrdersCount + createdOrdersCount} orders (${updatedOrdersCount} updated, ${createdOrdersCount} created) and recorded ${returnsCreatedCount} returns.`
    });
  } catch (err) {
    console.error('Failed to commit bulk order updates:', err);
    res.status(500).json({ error: 'Database transaction failed: ' + (err.message || 'Unknown database error') });
  }
});

// PUT edit existing order (Brand Manager can edit all, Staff can edit own)
router.put('/:id', authenticate, (req, res) => {
  const isManager = req.user.role === 'brand_manager';
  const orderId = parseInt(req.params.id, 10);

  const order = get('SELECT * FROM orders WHERE id = ?', [orderId]);
  if (!order) {
    return res.status(404).json({ error: 'Order not found.' });
  }

  // Authorization: Sales staff can only edit their own orders
  if (!isManager && order.staff_id !== req.user.id) {
    return res.status(403).json({ error: 'You are only authorized to edit your own orders.' });
  }

  const {
    staff_id,
    customer_name,
    customer_phone,
    customer_address,
    product_id,
    quantity,
    payment_method,
    order_date,
    status,
    remarks
  } = req.body;

  // Determine target staff
  let targetStaffId = order.staff_id;
  if (isManager && staff_id) {
    const assignedStaff = get('SELECT id, status FROM users WHERE id = ?', [staff_id]);
    if (!assignedStaff) {
      return res.status(404).json({ error: 'Assigned staff member not found.' });
    }
    if (assignedStaff.status !== 'active') {
      return res.status(400).json({ error: 'Cannot assign order to an inactive staff member.' });
    }
    targetStaffId = assignedStaff.id;
  }

  // Check product
  const targetProductId = product_id ? parseInt(product_id, 10) : order.product_id;
  const product = get('SELECT * FROM products WHERE id = ?', [targetProductId]);
  if (!product) {
    return res.status(404).json({ error: 'Selected product not found.' });
  }

  // Check quantity against already returned units
  const newQty = quantity !== undefined ? parseInt(quantity, 10) : order.quantity;
  if (isNaN(newQty) || newQty <= 0) {
    return res.status(400).json({ error: 'Quantity must be a positive integer (at least 1).' });
  }

  const retStats = get('SELECT COALESCE(SUM(return_quantity), 0) AS total_returned FROM returns WHERE order_id = ?', [order.id]);
  const totalReturned = retStats?.total_returned || 0;
  if (newQty < totalReturned) {
    return res.status(400).json({
      error: `Quantity cannot be reduced to ${newQty}. ${totalReturned} units have already been returned for this order.`
    });
  }

  const finalPaymentMethod = (payment_method && ['Prepaid', 'COD'].includes(payment_method))
    ? payment_method
    : order.payment_method;

  const orderDateStr = (order_date && /^\d{4}-\d{2}-\d{2}$/.test(order_date.trim()))
    ? order_date.trim()
    : order.order_date;

  const orderStatus = (status && ['Confirmed', 'Delivered', 'Pending', 'Cancelled'].includes(status))
    ? status
    : order.status;

  // Calculate new unit price, total amount, and snapshot incentive
  const unitPrice = product.price || 0;
  const totalAmount = Math.round(unitPrice * newQty * 100) / 100;
  const incentive = calculateIncentive(product, finalPaymentMethod, newQty, totalAmount);
  const now = new Date().toISOString();

  try {
    transaction(() => {
      // Update customer details if provided
      if (customer_name || customer_phone || customer_address) {
        const custName = customer_name ? customer_name.trim() : undefined;
        const custAddr = customer_address ? customer_address.trim() : undefined;
        const cleanPhone = customer_phone ? normalizePhone(customer_phone) : undefined;

        let custUpdates = [];
        let custParams = [];
        if (custName !== undefined) { custUpdates.push('name = ?'); custParams.push(custName); }
        if (custAddr !== undefined) { custUpdates.push('address = ?'); custParams.push(custAddr); }
        if (cleanPhone !== undefined && cleanPhone.length >= 7) { custUpdates.push('phone = ?'); custParams.push(cleanPhone); }
        custUpdates.push('updated_at = ?'); custParams.push(now);

        if (custUpdates.length > 1) {
          run(`UPDATE customers SET ${custUpdates.join(', ')} WHERE id = ?`, [...custParams, order.customer_id]);
        }
      }

      // Update Order
      run(`
        UPDATE orders SET
          staff_id = ?,
          product_id = ?,
          quantity = ?,
          unit_price = ?,
          total_amount = ?,
          payment_method = ?,
          order_date = ?,
          status = ?,
          remarks = ?,
          incentive_type = ?,
          incentive_basis = ?,
          incentive_rate = ?,
          incentive_amount = ?,
          updated_at = ?
        WHERE id = ?
      `, [
        targetStaffId,
        product.id,
        newQty,
        unitPrice,
        totalAmount,
        finalPaymentMethod,
        orderDateStr,
        orderStatus,
        remarks !== undefined ? remarks : order.remarks,
        incentive.type,
        incentive.basis,
        incentive.rate,
        incentive.amount,
        now,
        order.id
      ]);

      // If staff changed, synchronize existing returns' staff_id
      if (targetStaffId !== order.staff_id) {
        run('UPDATE returns SET staff_id = ?, updated_at = ? WHERE order_id = ?', [
          targetStaffId,
          now,
          order.id
        ]);
      }

      // If quantity or incentive changed, recalculate reversed_incentive on existing returns
      const linkedReturns = query('SELECT id, return_quantity FROM returns WHERE order_id = ?', [order.id]);
      for (const ret of linkedReturns) {
        const newRev = newQty > 0
          ? Math.round((ret.return_quantity / newQty) * incentive.amount * 100) / 100
          : 0;
        run('UPDATE returns SET reversed_incentive = ?, updated_at = ? WHERE id = ?', [
          newRev,
          now,
          ret.id
        ]);
      }
    });

    const updatedOrder = get(`
      SELECT
        o.*,
        c.name AS customer_name,
        c.phone AS customer_phone,
        c.address AS customer_address,
        p.name AS product_name,
        p.code AS product_code,
        u.name AS staff_name,
        u.staff_id AS staff_code,
        COALESCE((SELECT SUM(r.return_quantity) FROM returns r WHERE r.order_id = o.id), 0) AS returned_quantity,
        COALESCE((SELECT SUM(r.return_amount) FROM returns r WHERE r.order_id = o.id), 0) AS returned_amount,
        COALESCE((SELECT SUM(r.reversed_incentive) FROM returns r WHERE r.order_id = o.id), 0) AS reversed_incentive
      FROM orders o
      JOIN customers c ON o.customer_id = c.id
      JOIN products p ON o.product_id = p.id
      JOIN users u ON o.staff_id = u.id
      WHERE o.id = ?
    `, [order.id]);

    const returnableQuantity = Math.max(0, updatedOrder.quantity - updatedOrder.returned_quantity);
    const netAmount = Math.max(0, updatedOrder.total_amount - updatedOrder.returned_amount);
    const netIncentive = Math.max(0, updatedOrder.incentive_amount - updatedOrder.reversed_incentive);

    res.json({
      order: {
        ...updatedOrder,
        returnable_quantity: returnableQuantity,
        net_amount: Math.round(netAmount * 100) / 100,
        net_incentive: Math.round(netIncentive * 100) / 100
      },
      message: `Order ${updatedOrder.order_number} updated successfully.`
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

export default router;
