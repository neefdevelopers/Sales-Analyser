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
      { header: 'Staff ID', key: 'staff_code', width: 14 },
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
      { field: 'Staff ID', req: 'Required', desc: 'Valid Staff ID code (e.g. STF-001). Order must belong to this staff member.' },
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

// 2. POST /api/orders/bulk-update-preview - Upload & parse Excel, match records, generate preview
router.post('/bulk-update-preview', authenticate, async (req, res) => {
  if (req.user.role !== 'brand_manager') {
    return res.status(403).json({ error: 'Only Brand Managers can upload and preview bulk order updates.' });
  }

  const fileName = req.body.fileName || 'bulk_orders.xlsx';
  const fileData = req.body.fileData || req.body.fileBase64;
  if (!fileData) {
    return res.status(400).json({ error: 'No Excel file data received. Please select a valid .xlsx file.' });
  }

  try {
    const buffer = Buffer.from(fileData, 'base64');
    if (!buffer || buffer.length === 0) {
      return res.status(400).json({ error: 'Invalid or empty file content.' });
    }

    // Compute SHA-256 hash to prevent accidental re-imports
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

    // Pick first worksheet or one named Orders
    let sheet = workbook.worksheets.find(w => w.name.toLowerCase().includes('order')) || workbook.worksheets[0];
    if (!sheet) {
      return res.status(400).json({ error: 'No readable worksheet found in the uploaded Excel workbook.' });
    }

    // Identify header row (typically row 1)
    const headerMap = {};
    const headerRow = sheet.getRow(1);
    headerRow.eachCell((cell, colNumber) => {
      const text = getCellValue(cell).toLowerCase().replace(/[^a-z0-9]/g, '');
      if (text.includes('ordernumber') || text.includes('orderid') || text.includes('orderno') || text === 'order' || text.startsWith('order')) {
        if (!headerMap.orderNumber) headerMap.orderNumber = colNumber;
      } else if (text.includes('staffid') || text.includes('staffcode') || text === 'staff') {
        if (!headerMap.staffCode) headerMap.staffCode = colNumber;
      } else if (text.includes('productcode') || text.includes('sku')) {
        if (!headerMap.productCode) headerMap.productCode = colNumber;
      } else if (text.includes('productname') || text === 'product' || text === 'item') {
        if (!headerMap.productName) headerMap.productName = colNumber;
      } else if (text.includes('quantity') || text.includes('qty') || text === 'units') {
        if (!headerMap.quantity) headerMap.quantity = colNumber;
      } else if (text.includes('payment') || text.includes('method') || text.includes('paymode')) {
        if (!headerMap.paymentMethod) headerMap.paymentMethod = colNumber;
      } else if (text.includes('date')) {
        if (!headerMap.orderDate) headerMap.orderDate = colNumber;
      } else if (text.includes('status')) {
        if (!headerMap.status) headerMap.status = colNumber;
      } else if (text.includes('remark') || text.includes('note') || text.includes('comment')) {
        if (!headerMap.remarks) headerMap.remarks = colNumber;
      }
    });

    // Fallbacks if columns weren't labeled strictly
    if (!headerMap.orderNumber) headerMap.orderNumber = 1;
    if (!headerMap.staffCode) headerMap.staffCode = 2;
    if (!headerMap.quantity) headerMap.quantity = 6;
    if (!headerMap.paymentMethod) headerMap.paymentMethod = 7;
    if (!headerMap.orderDate) headerMap.orderDate = 8;

    // Load reference data from DB
    const allUsers = query('SELECT id, staff_id, name, username, status FROM users WHERE role = "sales_staff"');
    const staffMap = new Map();
    for (const u of allUsers) {
      if (u.staff_id) staffMap.set(u.staff_id.trim().toLowerCase(), u);
      if (u.username) staffMap.set(u.username.trim().toLowerCase(), u);
      staffMap.set(String(u.id), u);
    }

    const allProducts = query('SELECT * FROM products');
    const productMap = new Map();
    for (const p of allProducts) {
      if (p.code) productMap.set(p.code.trim().toUpperCase(), p);
      if (p.name) productMap.set(p.name.trim().toLowerCase(), p);
      productMap.set(String(p.id), p);
    }

    const allOrdersList = query(`
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
    const orderMap = new Map();
    for (const o of allOrdersList) {
      if (o.order_number) orderMap.set(o.order_number.trim().toLowerCase(), o);
      orderMap.set(String(o.id), o);
    }

    const parsedRows = [];
    let matchedCount = 0;
    let toUpdateCount = 0;
    let unchangedCount = 0;
    let unmatchedCount = 0;
    let invalidCount = 0;

    const validUpdateRowsToCache = [];

    // Helper for date parsing
    function parseDateString(raw) {
      if (!raw) return null;
      const s = String(raw).trim();
      if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
      const parts = s.split(/[/.-]/);
      if (parts.length === 3) {
        if (parts[0].length === 4) {
          return `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
        } else if (parts[2].length === 4) {
          return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
        }
      }
      return null;
    }

    // Process rows starting from row 2
    sheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return; // Skip header

      const rawOrderId = getCellValue(row.getCell(headerMap.orderNumber));
      const rawStaffId = getCellValue(row.getCell(headerMap.staffCode));
      const rawQty = getCellValue(row.getCell(headerMap.quantity));
      const rawPayment = headerMap.paymentMethod ? getCellValue(row.getCell(headerMap.paymentMethod)) : '';
      const rawProdCode = headerMap.productCode ? getCellValue(row.getCell(headerMap.productCode)) : '';
      const rawProdName = headerMap.productName ? getCellValue(row.getCell(headerMap.productName)) : '';
      const rawDate = headerMap.orderDate ? getCellValue(row.getCell(headerMap.orderDate)) : '';
      const rawStatus = headerMap.status ? getCellValue(row.getCell(headerMap.status)) : '';
      const rawRemarks = headerMap.remarks ? getCellValue(row.getCell(headerMap.remarks)) : '';

      // Skip completely empty row
      if (!rawOrderId && !rawStaffId && !rawQty) return;

      const rowResult = {
        rowNumber,
        excelData: {
          orderNumber: rawOrderId,
          staffId: rawStaffId,
          productCode: rawProdCode || rawProdName,
          quantity: rawQty,
          paymentMethod: rawPayment,
          orderDate: rawDate,
          status: rawStatus,
          remarks: rawRemarks
        },
        currentOrder: null,
        newValues: null,
        status: 'pending',
        error: null,
        changes: []
      };

      // 1. Order Identification
      if (!rawOrderId) {
        rowResult.status = 'invalid';
        rowResult.error = 'Order ID is missing in Excel row.';
        invalidCount++;
        parsedRows.push(rowResult);
        return;
      }

      const existingOrder = orderMap.get(rawOrderId.toLowerCase());
      if (!existingOrder) {
        rowResult.status = 'unmatched';
        rowResult.error = `Order ID "${rawOrderId}" not found in database.`;
        unmatchedCount++;
        parsedRows.push(rowResult);
        return;
      }

      rowResult.currentOrder = {
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
        remarks: existingOrder.remarks || '',
        incentiveAmount: existingOrder.incentive_amount,
        returnedQuantity: existingOrder.returned_quantity
      };

      // 2. Staff Verification & Matching (Do not modify unrelated staff records)
      if (!rawStaffId) {
        rowResult.status = 'invalid';
        rowResult.error = 'Staff ID is missing in Excel row.';
        invalidCount++;
        parsedRows.push(rowResult);
        return;
      }

      const matchedStaff = staffMap.get(rawStaffId.toLowerCase());
      if (!matchedStaff) {
        rowResult.status = 'invalid';
        rowResult.error = `Staff ID "${rawStaffId}" does not exist in system.`;
        invalidCount++;
        parsedRows.push(rowResult);
        return;
      }

      if (matchedStaff.status !== 'active') {
        rowResult.status = 'invalid';
        rowResult.error = `Staff member "${matchedStaff.name}" (${matchedStaff.staff_id}) is inactive.`;
        invalidCount++;
        parsedRows.push(rowResult);
        return;
      }

      // Security & Safety check: Order must match the designated staff
      if (existingOrder.staff_id !== matchedStaff.id) {
        rowResult.status = 'unmatched';
        rowResult.error = `Staff mismatch: Order "${existingOrder.order_number}" belongs to ${existingOrder.staff_name} (${existingOrder.staff_code}), not ${matchedStaff.name} (${matchedStaff.staff_id}).`;
        unmatchedCount++;
        parsedRows.push(rowResult);
        return;
      }

      // 3. Product Verification (optional in Excel; defaults to current order's product)
      let targetProduct = productMap.get(String(existingOrder.product_id));
      if (rawProdCode || rawProdName) {
        const prodLookupKey = (rawProdCode || rawProdName).trim();
        const foundProd = productMap.get(prodLookupKey.toUpperCase()) || productMap.get(prodLookupKey.toLowerCase());
        if (!foundProd) {
          rowResult.status = 'invalid';
          rowResult.error = `Product "${prodLookupKey}" was not found in catalog.`;
          invalidCount++;
          parsedRows.push(rowResult);
          return;
        }
        if (foundProd.status !== 'active') {
          rowResult.status = 'invalid';
          rowResult.error = `Product "${foundProd.name}" (${foundProd.code}) is inactive.`;
          invalidCount++;
          parsedRows.push(rowResult);
          return;
        }
        targetProduct = foundProd;
      }

      // 4. Quantity Validation
      let targetQty = existingOrder.quantity;
      if (rawQty !== '') {
        const parsedQ = parseInt(rawQty, 10);
        if (isNaN(parsedQ) || parsedQ <= 0) {
          rowResult.status = 'invalid';
          rowResult.error = `Quantity must be a positive number (found "${rawQty}").`;
          invalidCount++;
          parsedRows.push(rowResult);
          return;
        }
        if (parsedQ < existingOrder.returned_quantity) {
          rowResult.status = 'invalid';
          rowResult.error = `Cannot reduce quantity to ${parsedQ}; ${existingOrder.returned_quantity} units have already been returned for this order.`;
          invalidCount++;
          parsedRows.push(rowResult);
          return;
        }
        targetQty = parsedQ;
      }

      // 5. Payment Method Validation
      let targetPayment = existingOrder.payment_method;
      if (rawPayment) {
        const normP = rawPayment.trim().toLowerCase();
        if (normP === 'prepaid') {
          targetPayment = 'Prepaid';
        } else if (normP === 'cod' || normP === 'cash on delivery') {
          targetPayment = 'COD';
        } else {
          rowResult.status = 'invalid';
          rowResult.error = `Invalid payment method "${rawPayment}". Must be "Prepaid" or "COD".`;
          invalidCount++;
          parsedRows.push(rowResult);
          return;
        }
      }

      // 6. Order Date Validation
      let targetDate = existingOrder.order_date;
      if (rawDate) {
        const parsedD = parseDateString(rawDate);
        if (!parsedD) {
          rowResult.status = 'invalid';
          rowResult.error = `Invalid order date format "${rawDate}". Expected YYYY-MM-DD.`;
          invalidCount++;
          parsedRows.push(rowResult);
          return;
        }
        targetDate = parsedD;
      }

      // 7. Status Validation
      let targetStatus = existingOrder.status;
      if (rawStatus) {
        const cleanS = rawStatus.trim();
        const validStatuses = ['Confirmed', 'Delivered', 'Pending', 'Cancelled'];
        const matchedS = validStatuses.find(s => s.toLowerCase() === cleanS.toLowerCase());
        if (!matchedS) {
          rowResult.status = 'invalid';
          rowResult.error = `Invalid status "${rawStatus}". Must be Confirmed, Delivered, Pending, or Cancelled.`;
          invalidCount++;
          parsedRows.push(rowResult);
          return;
        }
        targetStatus = matchedS;
      }

      // 8. Remarks
      const targetRemarks = rawRemarks !== '' ? rawRemarks.trim() : (existingOrder.remarks || '');

      // Successfully matched order!
      matchedCount++;

      // 9. Recalculate financial snapshot & detect changes
      const unitPrice = targetProduct.price || 0;
      const newTotalAmount = Math.round(unitPrice * targetQty * 100) / 100;
      const newIncentive = calculateIncentive(targetProduct, targetPayment, targetQty, newTotalAmount);

      rowResult.newValues = {
        productId: targetProduct.id,
        productCode: targetProduct.code,
        productName: targetProduct.name,
        quantity: targetQty,
        unitPrice: unitPrice,
        totalAmount: newTotalAmount,
        paymentMethod: targetPayment,
        orderDate: targetDate,
        status: targetStatus,
        remarks: targetRemarks,
        incentiveType: newIncentive.type,
        incentiveBasis: newIncentive.basis,
        incentiveRate: newIncentive.rate,
        incentiveAmount: newIncentive.amount
      };

      // Detect diffs
      const diffs = [];
      if (targetQty !== existingOrder.quantity) {
        diffs.push({ field: 'Quantity', oldVal: `${existingOrder.quantity} units`, newVal: `${targetQty} units` });
      }
      if (targetPayment !== existingOrder.payment_method) {
        diffs.push({ field: 'Payment Method', oldVal: existingOrder.payment_method, newVal: targetPayment });
      }
      if (targetProduct.id !== existingOrder.product_id) {
        diffs.push({ field: 'Product', oldVal: `${existingOrder.product_name} (${existingOrder.product_code})`, newVal: `${targetProduct.name} (${targetProduct.code})` });
      }
      if (targetDate !== existingOrder.order_date) {
        diffs.push({ field: 'Order Date', oldVal: existingOrder.order_date, newVal: targetDate });
      }
      if (targetStatus !== existingOrder.status) {
        diffs.push({ field: 'Status', oldVal: existingOrder.status, newVal: targetStatus });
      }
      if (targetRemarks !== (existingOrder.remarks || '')) {
        diffs.push({ field: 'Remarks', oldVal: existingOrder.remarks || '-', newVal: targetRemarks || '-' });
      }

      rowResult.changes = diffs;

      if (diffs.length > 0) {
        rowResult.status = 'valid_update';
        toUpdateCount++;
        validUpdateRowsToCache.push({
          rowNumber,
          orderId: existingOrder.id,
          orderNumber: existingOrder.order_number,
          staffId: matchedStaff.id,
          newProductId: targetProduct.id,
          newQuantity: targetQty,
          newPaymentMethod: targetPayment,
          newOrderDate: targetDate,
          newStatus: targetStatus,
          newRemarks: targetRemarks
        });
      } else {
        rowResult.status = 'no_change';
        unchangedCount++;
      }

      parsedRows.push(rowResult);
    });

    if (parsedRows.length === 0) {
      return res.status(400).json({ error: 'The uploaded Excel file contains no order rows.' });
    }

    // Generate cryptographic preview token (15-minute TTL)
    const previewToken = crypto.randomBytes(24).toString('hex');
    previewCache.set(previewToken, {
      fileHash,
      fileName: fileName || 'Uploaded_Orders.xlsx',
      rowsToUpdate: validUpdateRowsToCache,
      createdAt: Date.now(),
      expiresAt: Date.now() + 15 * 60 * 1000,
      createdBy: req.user.id
    });

    res.json({
      previewToken,
      fileHash,
      fileName: fileName || 'Uploaded_Orders.xlsx',
      isDuplicate,
      duplicateInfo,
      totalRows: parsedRows.length,
      matchedCount,
      toUpdateCount,
      unchangedCount,
      unmatchedCount,
      invalidCount,
      rows: parsedRows
    });
  } catch (err) {
    console.error('Error during bulk update preview:', err);
    res.status(500).json({ error: 'Failed to process Excel file: ' + (err.message || 'Unknown parsing error') });
  }
});

// 3. POST /api/orders/bulk-update-confirm - Safely execute confirmed updates in transaction
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
  const errors = [];

  try {
    transaction(() => {
      for (const item of preview.rowsToUpdate) {
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
              reason: 'Product record was not found.'
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
            item.newStatus,
            item.newRemarks,
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

          updatedOrdersCount++;
        } catch (rowErr) {
          errors.push({
            rowNumber: item.rowNumber,
            orderNumber: item.orderNumber,
            reason: rowErr.message || 'Failed to update record'
          });
        }
      }

      // Record in import_logs
      run(`
        INSERT INTO import_logs (file_hash, file_name, total_rows, updated_count, created_at, created_by)
        VALUES (?, ?, ?, ?, ?, ?)
      `, [
        preview.fileHash,
        preview.fileName,
        preview.rowsToUpdate.length,
        updatedOrdersCount,
        now,
        req.user.id
      ]);
    });

    // Invalidate token
    previewCache.delete(previewToken);

    res.json({
      success: true,
      updatedCount: updatedOrdersCount,
      errors,
      message: `Successfully updated ${updatedOrdersCount} orders in the database.`
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
