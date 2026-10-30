// server/db.js
// SQLite database engine using sql.js WebAssembly with filesystem persistence

import initSqlJs from 'sql.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import bcrypt from 'bcryptjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, '..', 'data');
const DB_PATH = path.join(DATA_DIR, 'sales.db');

let dbInstance = null;
let SQL = null;

// Ensure data folder exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

export async function getDb() {
  if (dbInstance) return dbInstance;

  if (!SQL) {
    SQL = await initSqlJs();
  }

  let dbBuffer = null;
  if (fs.existsSync(DB_PATH)) {
    try {
      dbBuffer = fs.readFileSync(DB_PATH);
    } catch (err) {
      console.warn('Could not read existing database file, creating fresh one:', err.message);
    }
  }

  dbInstance = dbBuffer ? new SQL.Database(dbBuffer) : new SQL.Database();
  initSchema(dbInstance);
  saveDb();
  return dbInstance;
}

let inTransaction = false;

export function saveDb() {
  if (!dbInstance || inTransaction) return;
  try {
    const data = dbInstance.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(DB_PATH, buffer);
  } catch (err) {
    console.error('Failed to save database to disk:', err);
  }
}

/**
 * Execute SELECT query and return array of objects
 */
export function query(sql, params = []) {
  if (!dbInstance) throw new Error('Database not initialized');
  const stmt = dbInstance.prepare(sql);
  stmt.bind(params);
  const rows = [];
  while (stmt.step()) {
    rows.push(stmt.getAsObject());
  }
  stmt.free();
  return rows;
}

/**
 * Execute SELECT query and return first object or null
 */
export function get(sql, params = []) {
  const rows = query(sql, params);
  return rows.length > 0 ? rows[0] : null;
}

/**
 * Execute INSERT, UPDATE, DELETE query
 */
export function run(sql, params = []) {
  if (!dbInstance) throw new Error('Database not initialized');
  dbInstance.run(sql, params);
  
  // Get last insert row id and changes
  const lastIdRes = query('SELECT last_insert_rowid() AS id');
  const changesRes = query('SELECT changes() AS changes');
  
  saveDb();

  return {
    lastInsertRowid: lastIdRes[0]?.id || 0,
    changes: changesRes[0]?.changes || 0
  };
}

/**
 * Execute raw multiple SQL statements
 */
export function exec(sql) {
  if (!dbInstance) throw new Error('Database not initialized');
  dbInstance.exec(sql);
  saveDb();
}

/**
 * Run callback inside a transaction
 */
export function transaction(callback) {
  if (!dbInstance) throw new Error('Database not initialized');
  inTransaction = true;
  dbInstance.run('BEGIN TRANSACTION;');
  try {
    const result = callback();
    dbInstance.run('COMMIT;');
    inTransaction = false;
    saveDb();
    return result;
  } catch (err) {
    dbInstance.run('ROLLBACK;');
    inTransaction = false;
    throw err;
  }
}

function initSchema(db) {
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      staff_id TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('brand_manager', 'sales_staff')),
      status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'inactive')),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      code TEXT UNIQUE NOT NULL,
      price REAL NOT NULL CHECK(price >= 0),
      status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'inactive')),
      prepaid_incentive_type TEXT NOT NULL DEFAULT 'fixed' CHECK(prepaid_incentive_type IN ('fixed', 'percentage')),
      prepaid_incentive_basis TEXT NOT NULL DEFAULT 'per_unit' CHECK(prepaid_incentive_basis IN ('per_unit', 'per_order')),
      prepaid_incentive_value REAL NOT NULL DEFAULT 0 CHECK(prepaid_incentive_value >= 0),
      cod_incentive_type TEXT NOT NULL DEFAULT 'fixed' CHECK(cod_incentive_type IN ('fixed', 'percentage')),
      cod_incentive_basis TEXT NOT NULL DEFAULT 'per_unit' CHECK(cod_incentive_basis IN ('per_unit', 'per_order')),
      cod_incentive_value REAL NOT NULL DEFAULT 0 CHECK(cod_incentive_value >= 0),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS customers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      phone TEXT NOT NULL UNIQUE,
      address TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_number TEXT UNIQUE NOT NULL,
      staff_id INTEGER NOT NULL REFERENCES users(id),
      customer_id INTEGER NOT NULL REFERENCES customers(id),
      product_id INTEGER NOT NULL REFERENCES products(id),
      quantity INTEGER NOT NULL CHECK(quantity > 0),
      unit_price REAL NOT NULL,
      total_amount REAL NOT NULL,
      payment_method TEXT NOT NULL CHECK(payment_method IN ('Prepaid', 'COD')),
      order_date TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'Confirmed' CHECK(status IN ('Confirmed', 'Delivered', 'Pending', 'Cancelled')),
      remarks TEXT,
      incentive_type TEXT NOT NULL,
      incentive_basis TEXT NOT NULL,
      incentive_rate REAL NOT NULL,
      incentive_amount REAL NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS returns (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      return_number TEXT UNIQUE NOT NULL,
      order_id INTEGER NOT NULL REFERENCES orders(id),
      staff_id INTEGER NOT NULL REFERENCES users(id),
      product_id INTEGER REFERENCES products(id),
      returned_by_staff_id INTEGER REFERENCES users(id),
      return_quantity INTEGER NOT NULL CHECK(return_quantity > 0),
      return_amount REAL NOT NULL,
      return_date TEXT NOT NULL,
      return_reason TEXT NOT NULL DEFAULT 'Product Return',
      remarks TEXT,
      reversed_incentive REAL NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_orders_staff ON orders(staff_id);
    CREATE INDEX IF NOT EXISTS idx_orders_date ON orders(order_date);
    CREATE INDEX IF NOT EXISTS idx_orders_cust ON orders(customer_id);
    CREATE INDEX IF NOT EXISTS idx_returns_order ON returns(order_id);
    CREATE INDEX IF NOT EXISTS idx_returns_staff ON returns(staff_id);
  `);

  // Ensure returns table has product_id and returned_by_staff_id columns
  try {
    db.run(`ALTER TABLE returns ADD COLUMN product_id INTEGER REFERENCES products(id);`);
  } catch (e) {
    // Column already exists
  }
  try {
    db.run(`ALTER TABLE returns ADD COLUMN returned_by_staff_id INTEGER REFERENCES users(id);`);
  } catch (e) {
    // Column already exists
  }
  try {
    db.run(`
      UPDATE returns
      SET product_id = (SELECT product_id FROM orders WHERE orders.id = returns.order_id)
      WHERE product_id IS NULL;

      UPDATE returns
      SET returned_by_staff_id = staff_id
      WHERE returned_by_staff_id IS NULL;

      CREATE INDEX IF NOT EXISTS idx_returns_returned_by ON returns(returned_by_staff_id);
      CREATE INDEX IF NOT EXISTS idx_returns_product ON returns(product_id);
    `);
  } catch (e) {
    // Ignore
  }

  // Safely drop removed modules tables if they exist
  try {
    db.run(`
      DROP TABLE IF EXISTS staff_performance_remarks;
      DROP TABLE IF EXISTS daily_activities;
      DROP TABLE IF EXISTS calls;
      DROP TABLE IF EXISTS enquiries;
    `);
  } catch (err) {
    // Ignore
  }

  // Seed default data if users table is empty
  const userCount = db.exec("SELECT COUNT(*) AS c FROM users;");
  const count = userCount[0]?.values[0]?.[0] || 0;
  if (count === 0) {
    seedDatabase(db);
  }
}

function seedDatabase(db) {
  console.log('Seeding initial database with sample data...');
  const now = new Date().toISOString();
  const today = now.split('T')[0];
  
  // Calculate yesterday date
  const yestDate = new Date();
  yestDate.setDate(yestDate.getDate() - 1);
  const yesterday = yestDate.toISOString().split('T')[0];

  const adminHash = bcrypt.hashSync('admin123', 10);
  const staffHash = bcrypt.hashSync('staff123', 10);

  // 1. Seed Users
  db.run(`
    INSERT INTO users (staff_id, name, username, password_hash, role, status, created_at, updated_at) VALUES
    ('MGR-001', 'Arun Varma (Brand Manager)', 'manager', ?, 'brand_manager', 'active', ?, ?),
    ('STF-001', 'Rahul Sharma', 'rahul', ?, 'sales_staff', 'active', ?, ?),
    ('STF-002', 'Priya Patel', 'priya', ?, 'sales_staff', 'active', ?, ?),
    ('STF-003', 'Vikram Singh', 'vikram', ?, 'sales_staff', 'active', ?, ?);
  `, [adminHash, now, now, staffHash, now, now, staffHash, now, now, staffHash, now, now]);

  // 2. Seed Products
  db.run(`
    INSERT INTO products (name, code, price, status, prepaid_incentive_type, prepaid_incentive_basis, prepaid_incentive_value, cod_incentive_type, cod_incentive_basis, cod_incentive_value, created_at, updated_at) VALUES
    ('Aura Smartwatch Pro', 'PRD-AURA-01', 4999.00, 'active', 'percentage', 'per_order', 5.0, 'fixed', 'per_unit', 200.0, ?, ?),
    ('Nova Wireless Earbuds', 'PRD-NOVA-02', 1999.00, 'active', 'fixed', 'per_unit', 150.0, 'fixed', 'per_unit', 100.0, ?, ?),
    ('Lumina 4K Action Camera', 'PRD-LUMI-03', 8999.00, 'active', 'percentage', 'per_unit', 8.0, 'percentage', 'per_unit', 5.0, ?, ?),
    ('Pulse Fitness Tracker', 'PRD-PULS-04', 1499.00, 'active', 'fixed', 'per_unit', 100.0, 'fixed', 'per_unit', 50.0, ?, ?),
    ('Zenith Pro Headphone (Legacy)', 'PRD-ZEN-05', 3499.00, 'inactive', 'fixed', 'per_unit', 120.0, 'fixed', 'per_unit', 80.0, ?, ?);
  `, [now, now, now, now, now, now, now, now, now, now]);

  // 3. Seed Customers
  db.run(`
    INSERT INTO customers (name, phone, address, created_at, updated_at) VALUES
    ('Amit Kumar', '9876543210', '124 MG Road, Indiranagar, Bengaluru, Karnataka', ?, ?),
    ('Sneha Reddy', '9812345678', 'Plot 45, Banjara Hills, Hyderabad, Telangana', ?, ?),
    ('Rohan Mehta', '9723456789', 'B-12 Sea View Apartments, Bandra West, Mumbai', ?, ?),
    ('Ananya Iyer', '9654321098', '78 Anna Salai, T. Nagar, Chennai, Tamil Nadu', ?, ?),
    ('Karan Kapoor', '9543210987', '56 Connaught Place, New Delhi', ?, ?);
  `, [now, now, now, now, now, now, now, now, now, now]);

  // 4. Seed Orders (with snapshot incentive fields!)
  db.run(`
    INSERT INTO orders (order_number, staff_id, customer_id, product_id, quantity, unit_price, total_amount, payment_method, order_date, status, remarks, incentive_type, incentive_basis, incentive_rate, incentive_amount, created_at, updated_at) VALUES
    ('ORD-20261028-0001', 2, 1, 1, 1, 4999.00, 4999.00, 'Prepaid', ?, 'Delivered', 'Paid via UPI, priority shipping requested.', 'percentage', 'per_order', 5.0, 249.95, ?, ?),
    ('ORD-20261028-0002', 2, 2, 2, 2, 1999.00, 3998.00, 'COD', ?, 'Delivered', 'Customer verified phone OTP on delivery.', 'fixed', 'per_unit', 100.0, 200.00, ?, ?),
    ('ORD-20261028-0003', 3, 3, 2, 2, 1999.00, 3998.00, 'Prepaid', ?, 'Delivered', 'Prepaid credit card payment.', 'fixed', 'per_unit', 150.0, 300.00, ?, ?),
    ('ORD-20261029-0004', 3, 4, 3, 1, 8999.00, 8999.00, 'COD', ?, 'Confirmed', 'Dispatched from central warehouse.', 'percentage', 'per_unit', 5.0, 449.95, ?, ?),
    ('ORD-20261029-0005', 2, 5, 4, 3, 1499.00, 4497.00, 'Prepaid', ?, 'Confirmed', 'Bulk order for corporate fitness challenge.', 'fixed', 'per_unit', 100.0, 300.00, ?, ?);
  `, [
    yesterday, now, now,
    yesterday, now, now,
    yesterday, now, now,
    today, now, now,
    today, now, now
  ]);

  // 5. Seed Sample Return
  db.run(`
    INSERT INTO returns (return_number, order_id, staff_id, return_quantity, return_amount, return_date, return_reason, remarks, reversed_incentive, created_at, updated_at) VALUES
    ('RET-20261029-0001', 2, 2, 1, 1999.00, ?, 'Defective item', 'Left earbud volume lower than right, verified with QA.', 100.00, ?, ?);
  `, [today, now, now]);

  // 6. Seed Manager Observation Remarks
  db.run(`
    INSERT INTO staff_performance_remarks (staff_id, manager_id, remarks, updated_at) VALUES
    (2, 1, 'Consistent performer with high customer engagement. Follow up on returns turnaround.', ?),
    (3, 1, 'Excellent sales performance on premium audio products this month.', ?);
  `, [now, now]);

  console.log('Database seeded successfully!');
}

