// server/routes/products.js
import { Router } from 'express';
import { query, get, run } from '../db.js';
import { authenticate, requireRole } from '../auth.js';

const router = Router();

// GET all products (Sales Staff see active products only; Brand Manager sees all)
router.get('/', authenticate, (req, res) => {
  const isManager = req.user.role === 'brand_manager';
  const includeInactive = req.query.all === 'true' && isManager;

  const sql = includeInactive
    ? 'SELECT * FROM products ORDER BY name ASC'
    : "SELECT * FROM products WHERE status = 'active' ORDER BY name ASC";

  const products = query(sql);
  res.json({ products });
});

// GET single product by ID
router.get('/:id', authenticate, (req, res) => {
  const product = get('SELECT * FROM products WHERE id = ?', [req.params.id]);
  if (!product) {
    return res.status(404).json({ error: 'Product not found' });
  }
  res.json({ product });
});

// POST create product (Brand Manager only)
router.post('/', authenticate, requireRole('brand_manager'), (req, res) => {
  const {
    name,
    code,
    price,
    status = 'active',
    prepaid_incentive_type = 'fixed',
    prepaid_incentive_basis = 'per_unit',
    prepaid_incentive_value = 0,
    cod_incentive_type = 'fixed',
    cod_incentive_basis = 'per_unit',
    cod_incentive_value = 0
  } = req.body;

  if (!name || !name.trim()) {
    return res.status(400).json({ error: 'Product name is required.' });
  }

  // Auto-generate SKU code if omitted
  let productCode = (code && code.trim()) ? code.trim().toUpperCase() : null;
  if (!productCode) {
    const slug = name.trim().toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6) || 'PRD';
    const countRow = get('SELECT COUNT(*) AS c FROM products');
    const seq = (countRow?.c || 0) + 1;
    productCode = `PRD-${slug}-${String(seq).padStart(3, '0')}`;
  }

  const numericPrice = price !== undefined && price !== '' ? parseFloat(price) : 0;
  if (isNaN(numericPrice) || numericPrice < 0) {
    return res.status(400).json({ error: 'Price must be a non-negative number.' });
  }

  // Validate incentive fields
  if (!['fixed', 'percentage'].includes(prepaid_incentive_type)) {
    return res.status(400).json({ error: 'Prepaid incentive type must be fixed or percentage.' });
  }
  if (!['per_unit', 'per_order'].includes(prepaid_incentive_basis)) {
    return res.status(400).json({ error: 'Prepaid incentive basis must be per_unit or per_order.' });
  }
  if (!['fixed', 'percentage'].includes(cod_incentive_type)) {
    return res.status(400).json({ error: 'COD incentive type must be fixed or percentage.' });
  }
  if (!['per_unit', 'per_order'].includes(cod_incentive_basis)) {
    return res.status(400).json({ error: 'COD incentive basis must be per_unit or per_order.' });
  }

  const prepVal = parseFloat(prepaid_incentive_value);
  const codVal = parseFloat(cod_incentive_value);
  if (isNaN(prepVal) || prepVal < 0 || isNaN(codVal) || codVal < 0) {
    return res.status(400).json({ error: 'Incentive values must be non-negative.' });
  }

  // Check unique code
  const existing = get('SELECT id FROM products WHERE code = ?', [productCode]);
  if (existing) {
    return res.status(400).json({ error: `Product code "${productCode}" already exists.` });
  }

  const now = new Date().toISOString();
  try {
    const result = run(
      `INSERT INTO products (
        name, code, price, status,
        prepaid_incentive_type, prepaid_incentive_basis, prepaid_incentive_value,
        cod_incentive_type, cod_incentive_basis, cod_incentive_value,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        name.trim(),
        productCode,
        numericPrice,
        status === 'inactive' ? 'inactive' : 'active',
        prepaid_incentive_type,
        prepaid_incentive_basis,
        prepVal,
        cod_incentive_type,
        cod_incentive_basis,
        codVal,
        now,
        now
      ]
    );

    const created = get('SELECT * FROM products WHERE id = ?', [result.lastInsertRowid]);
    res.status(201).json({ product: created, message: 'Product created successfully.' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create product: ' + err.message });
  }
});

// PUT update product (Brand Manager only)
router.put('/:id', authenticate, requireRole('brand_manager'), (req, res) => {
  const { id } = req.params;
  const product = get('SELECT * FROM products WHERE id = ?', [id]);
  if (!product) {
    return res.status(404).json({ error: 'Product not found.' });
  }

  const {
    name,
    code,
    price,
    status,
    prepaid_incentive_type,
    prepaid_incentive_basis,
    prepaid_incentive_value,
    cod_incentive_type,
    cod_incentive_basis,
    cod_incentive_value
  } = req.body;

  if (name !== undefined && !name.trim()) {
    return res.status(400).json({ error: 'Product name cannot be empty.' });
  }

  if (code !== undefined) {
    const codeCheck = get('SELECT id FROM products WHERE code = ? AND id != ?', [code.trim(), id]);
    if (codeCheck) {
      return res.status(400).json({ error: `Product code "${code}" is already in use by another product.` });
    }
  }

  const numericPrice = price !== undefined ? parseFloat(price) : product.price;
  if (isNaN(numericPrice) || numericPrice < 0) {
    return res.status(400).json({ error: 'Price must be a non-negative number.' });
  }

  const prepVal = prepaid_incentive_value !== undefined ? parseFloat(prepaid_incentive_value) : product.prepaid_incentive_value;
  const codVal = cod_incentive_value !== undefined ? parseFloat(cod_incentive_value) : product.cod_incentive_value;

  const now = new Date().toISOString();

  try {
    run(
      `UPDATE products SET
        name = ?,
        code = ?,
        price = ?,
        status = ?,
        prepaid_incentive_type = ?,
        prepaid_incentive_basis = ?,
        prepaid_incentive_value = ?,
        cod_incentive_type = ?,
        cod_incentive_basis = ?,
        cod_incentive_value = ?,
        updated_at = ?
      WHERE id = ?`,
      [
        name !== undefined ? name.trim() : product.name,
        code !== undefined ? code.trim().toUpperCase() : product.code,
        numericPrice,
        status !== undefined ? status : product.status,
        prepaid_incentive_type || product.prepaid_incentive_type,
        prepaid_incentive_basis || product.prepaid_incentive_basis,
        prepVal,
        cod_incentive_type || product.cod_incentive_type,
        cod_incentive_basis || product.cod_incentive_basis,
        codVal,
        now,
        id
      ]
    );

    const updated = get('SELECT * FROM products WHERE id = ?', [id]);
    res.json({ product: updated, message: 'Product updated successfully.' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update product: ' + err.message });
  }
});

// Helper for calculating incentive based on product configuration
export function calculateIncentive(product, paymentMethod, quantity, orderTotal) {
  const isPrepaid = paymentMethod === 'Prepaid';
  const type = isPrepaid ? product.prepaid_incentive_type : product.cod_incentive_type;
  const basis = isPrepaid ? product.prepaid_incentive_basis : product.cod_incentive_basis;
  const value = isPrepaid ? product.prepaid_incentive_value : product.cod_incentive_value;

  let amount = 0;

  if (type === 'fixed') {
    if (basis === 'per_unit') {
      amount = value * quantity;
    } else {
      // per_order
      amount = value;
    }
  } else if (type === 'percentage') {
    if (basis === 'per_unit') {
      // % of each unit's price * quantity = % of total order
      amount = (product.price * quantity) * (value / 100);
    } else {
      // % of total order
      amount = orderTotal * (value / 100);
    }
  }

  // Consistent 2-decimal rounding rule
  amount = Math.round(amount * 100) / 100;

  return {
    type,
    basis,
    rate: value,
    amount
  };
}

export default router;
