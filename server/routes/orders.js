// server/routes/orders.js
import { Router } from 'express';
import { query, get, run, transaction } from '../db.js';
import { authenticate } from '../auth.js';
import { calculateIncentive } from './products.js';
import { getNowInBusinessTimezone } from '../timezone.js';

const router = Router();

// Normalizes customer phone number
export function normalizePhone(phone) {
  if (!phone) return '';
  return phone.replace(/[^0-9]/g, '');
}

// GET orders list (with search, filter by staff, date range, pagination)
router.get('/', authenticate, (req, res) => {
  const isManager = req.user.role === 'brand_manager';
  const { staffId, search, status, startDate, endDate, page = 1, limit = 50 } = req.query;

  let conditions = [];
  let params = [];

  // Role filtering: sales staff see ONLY their own orders
  if (!isManager) {
    conditions.push('o.staff_id = ?');
    params.push(req.user.id);
  } else if (staffId) {
    conditions.push('o.staff_id = ?');
    params.push(parseInt(staffId, 10));
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
      o.enquiry_id,
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
    customer_address = '',
    product_id,
    quantity,
    payment_method = 'Prepaid',
    order_date,
    remarks = '',
    enquiry_id = null
  } = req.body;

  // 1. Basic validation - only product and quantity are strictly required from staff
  if (!product_id) {
    return res.status(400).json({ error: 'Product selection is required.' });
  }

  const qty = parseInt(quantity, 10);
  if (isNaN(qty) || qty <= 0) {
    return res.status(400).json({ error: 'Quantity must be a positive integer (at least 1).' });
  }

  // Safe defaults for customer and payment method
  const finalCustomerName = (customer_name && customer_name.trim()) ? customer_name.trim() : 'Direct Customer';
  const cleanPhone = customer_phone ? normalizePhone(customer_phone) : '9999999999';
  if (cleanPhone.length < 7) {
    return res.status(400).json({ error: 'Please enter a valid phone number (at least 7 digits).' });
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

  // 3. Calculate order total and staff incentive snapshot
  const unitPrice = product.price || 0;
  const totalAmount = Math.round(unitPrice * qty * 100) / 100;
  const incentive = calculateIncentive(product, finalPaymentMethod, qty, totalAmount);

  // 4. Generate unique order ID: ORD-YYYYMMDD-XXXX
  const dateFormatted = orderDateStr.replace(/-/g, '');
  const countToday = get("SELECT COUNT(*) AS c FROM orders WHERE order_number LIKE ?", [`ORD-${dateFormatted}-%`]);
  const nextSeq = (countToday?.c || 0) + 1;
  const orderNumber = `ORD-${dateFormatted}-${String(nextSeq).padStart(4, '0')}`;

  const staffId = req.user.id;
  const now = new Date().toISOString();

  try {
    const result = transaction(() => {
      // Find or create customer
      let customer = get('SELECT id FROM customers WHERE phone = ?', [cleanPhone]);
      let customerId;

      if (customer) {
        customerId = customer.id;
        if (customer_name && customer_name.trim()) {
          run('UPDATE customers SET name = ?, address = ?, updated_at = ? WHERE id = ?', [
            finalCustomerName,
            customer_address.trim(),
            now,
            customerId
          ]);
        }
      } else {
        const custRes = run(
          'INSERT INTO customers (name, phone, address, created_at, updated_at) VALUES (?, ?, ?, ?, ?)',
          [finalCustomerName, cleanPhone, customer_address.trim(), now, now]
        );
        customerId = custRes.lastInsertRowid;
      }

      // Insert Order with immutable incentive snapshot
      const orderRes = run(
        `INSERT INTO orders (
          order_number, staff_id, customer_id, product_id,
          quantity, unit_price, total_amount, payment_method,
          order_date, status, remarks, enquiry_id,
          incentive_type, incentive_basis, incentive_rate, incentive_amount,
          created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'Confirmed', ?, ?, ?, ?, ?, ?, ?, ?)`,
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
          remarks ? remarks.trim() : null,
          enquiry_id || null,
          incentive.type,
          incentive.basis,
          incentive.rate,
          incentive.amount,
          now,
          now
        ]
      );

      const newOrderId = orderRes.lastInsertRowid;

      // If linked to an enquiry, mark enquiry converted
      if (enquiry_id) {
        run("UPDATE enquiries SET status = 'Converted', converted_order_id = ?, updated_at = ? WHERE id = ?", [
          newOrderId,
          now,
          enquiry_id
        ]);
      }

      return newOrderId;
    });

    const createdOrder = get(`
      SELECT o.*, c.name AS customer_name, c.phone AS customer_phone, p.name AS product_name
      FROM orders o
      JOIN customers c ON o.customer_id = c.id
      JOIN products p ON o.product_id = p.id
      WHERE o.id = ?
    `, [result]);

    res.status(201).json({
      order: createdOrder,
      message: `Order ${orderNumber} created successfully.`
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create order: ' + err.message });
  }
});

export default router;
