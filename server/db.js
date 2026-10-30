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

export function saveDb() {
  if (!dbInstance) return;
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
  dbInstance.run('BEGIN TRANSACTION;');
  try {
    const result = callback();
    dbInstance.run('COMMIT;');
    saveDb();
    return result;
  } catch (err) {
    dbInstance.run('ROLLBACK;');
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
      enquiry_id INTEGER,
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
      return_quantity INTEGER NOT NULL CHECK(return_quantity > 0),
      return_amount REAL NOT NULL,
      return_date TEXT NOT NULL,
      return_reason TEXT NOT NULL,
      remarks TEXT,
      reversed_incentive REAL NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS enquiries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      staff_id INTEGER NOT NULL REFERENCES users(id),
      customer_name TEXT NOT NULL,
      customer_phone TEXT NOT NULL,
      product_id INTEGER REFERENCES products(id),
      enquiry_date TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'New' CHECK(status IN ('New', 'Follow-up', 'Converted', 'Lost')),
      follow_up_date TEXT,
      remarks TEXT,
      converted_order_id INTEGER,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS calls (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      staff_id INTEGER NOT NULL REFERENCES users(id),
      customer_name TEXT NOT NULL,
      customer_phone TEXT NOT NULL,
      enquiry_id INTEGER,
      call_date TEXT NOT NULL,
      call_time TEXT NOT NULL,
      outcome TEXT NOT NULL CHECK(outcome IN ('Connected', 'Not Answered', 'Busy', 'Follow-up Required')),
      remarks TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS staff_performance_remarks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      staff_id INTEGER NOT NULL UNIQUE REFERENCES users(id),
      manager_id INTEGER NOT NULL REFERENCES users(id),
      remarks TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS daily_activities (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      staff_id INTEGER NOT NULL REFERENCES users(id),
      activity_date TEXT NOT NULL,
      total_calls INTEGER NOT NULL DEFAULT 0 CHECK(total_calls >= 0),
      connected_calls INTEGER NOT NULL DEFAULT 0 CHECK(connected_calls >= 0),
      total_enquiries INTEGER NOT NULL DEFAULT 0 CHECK(total_enquiries >= 0),
      remarks TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE(staff_id, activity_date)
    );

    CREATE INDEX IF NOT EXISTS idx_orders_staff ON orders(staff_id);
    CREATE INDEX IF NOT EXISTS idx_orders_date ON orders(order_date);
    CREATE INDEX IF NOT EXISTS idx_orders_cust ON orders(customer_id);
    CREATE INDEX IF NOT EXISTS idx_returns_order ON returns(order_id);
    CREATE INDEX IF NOT EXISTS idx_returns_staff ON returns(staff_id);
    CREATE INDEX IF NOT EXISTS idx_enquiries_staff ON enquiries(staff_id);
    CREATE INDEX IF NOT EXISTS idx_calls_staff ON calls(staff_id);
    CREATE INDEX IF NOT EXISTS idx_calls_date ON calls(call_date);
    CREATE INDEX IF NOT EXISTS idx_daily_act_staff ON daily_activities(staff_id);
    CREATE INDEX IF NOT EXISTS idx_daily_act_date ON daily_activities(activity_date);
  `);

  // Seed default data if users table is empty
  const userCount = db.exec("SELECT COUNT(*) AS c FROM users;");
  const count = userCount[0]?.values[0]?.[0] || 0;
  if (count === 0) {
    seedDatabase(db);
  }

  // Ensure daily_activities has sample data
  try {
    const actCount = db.exec("SELECT COUNT(*) AS c FROM daily_activities;");
    const aCount = actCount[0]?.values[0]?.[0] || 0;
    if (aCount === 0) {
      seedDailyActivities(db);
    }
  } catch (err) {
    console.error('Error checking daily_activities count:', err);
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

  // 2. Seed Products with explicit separate prepaid & COD incentive configs
  // Product 1: Aura Smartwatch (Price 4999) - Prepaid: 5% per order, COD: 200 flat per unit
  // Product 2: Nova Wireless Earbuds (Price 1999) - Prepaid: 150 flat per unit, COD: 100 flat per unit
  // Product 3: Lumina 4K Action Camera (Price 8999) - Prepaid: 8% per unit, COD: 5% per unit
  // Product 4: Pulse Fitness Tracker (Price 1499) - Prepaid: 100 flat per unit, COD: 50 flat per unit
  // Product 5: Zenith Pro Headphone (Price 3499, Inactive)
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

  // 4. Seed Enquiries
  db.run(`
    INSERT INTO enquiries (staff_id, customer_name, customer_phone, product_id, enquiry_date, status, follow_up_date, remarks, created_at, updated_at) VALUES
    (2, 'Amit Kumar', '9876543210', 1, ?, 'Converted', NULL, 'Customer was looking for Aura Smartwatch with heart rate monitor.', ?, ?),
    (2, 'Sneha Reddy', '9812345678', 2, ?, 'Converted', NULL, 'Interested in Nova Earbuds black color.', ?, ?),
    (2, 'Ramesh Nair', '9845112233', 3, ?, 'Follow-up', ?, 'Needs demo video of Lumina 4K Camera.', ?, ?),
    (3, 'Rohan Mehta', '9723456789', 2, ?, 'Converted', NULL, 'Wants 2 units for family.', ?, ?),
    (3, 'Pooja Joshi', '9988776655', 4, ?, 'New', ?, 'Enquired about water resistance of Pulse tracker.', ?, ?),
    (4, 'Deepak Verma', '9123456780', 1, ?, 'Lost', NULL, 'Budget mismatch, opted for unbranded alternative.', ?, ?);
  `, [
    yesterday, now, now,
    yesterday, now, now,
    today, today, now, now,
    yesterday, now, now,
    today, today, now, now,
    yesterday, now, now
  ]);

  // 5. Seed Calls
  db.run(`
    INSERT INTO calls (staff_id, customer_name, customer_phone, enquiry_id, call_date, call_time, outcome, remarks, created_at, updated_at) VALUES
    (2, 'Amit Kumar', '9876543210', 1, ?, '10:15:00', 'Connected', 'Explained prepaid discount and 1-year warranty.', ?, ?),
    (2, 'Sneha Reddy', '9812345678', 2, ?, '11:30:00', 'Connected', 'Confirmed COD order details.', ?, ?),
    (2, 'Ramesh Nair', '9845112233', 3, ?, '14:20:00', 'Follow-up Required', 'Sent product catalog via WhatsApp.', ?, ?),
    (2, 'Vikas Gupta', '9765432190', NULL, ?, '16:00:00', 'Busy', 'Customer was in a meeting, requested callback.', ?, ?),
    (3, 'Rohan Mehta', '9723456789', 4, ?, '10:45:00', 'Connected', 'Finalized order for 2 Nova Earbuds.', ?, ?),
    (3, 'Pooja Joshi', '9988776655', 5, ?, '12:10:00', 'Connected', 'Answering specifications on battery life.', ?, ?),
    (3, 'Alok Sinha', '9876123450', NULL, ?, '15:00:00', 'Not Answered', 'Ringing, no response.', ?, ?),
    (4, 'Deepak Verma', '9123456780', 6, ?, '11:00:00', 'Connected', 'Pitch rejected due to price.', ?, ?);
  `, [
    yesterday, now, now,
    yesterday, now, now,
    today, now, now,
    today, now, now,
    yesterday, now, now,
    today, now, now,
    today, now, now,
    yesterday, now, now
  ]);

  // 6. Seed Orders (with snapshot incentive fields!)
  // Order 1: Rahul (staff 2), Amit Kumar (cust 1), Aura Smartwatch (prod 1), qty 1, Prepaid.
  //   Unit price 4999, Total 4999. Prepaid incentive: 5% per order = 249.95 rounded to 250.00
  // Order 2: Rahul (staff 2), Sneha Reddy (cust 2), Nova Earbuds (prod 2), qty 2, COD.
  //   Unit price 1999, Total 3998. COD incentive: 100 flat per unit * 2 = 200.00
  // Order 3: Priya (staff 3), Rohan Mehta (cust 3), Nova Earbuds (prod 2), qty 2, Prepaid.
  //   Unit price 1999, Total 3998. Prepaid incentive: 150 flat per unit * 2 = 300.00
  // Order 4: Priya (staff 3), Ananya Iyer (cust 4), Lumina Camera (prod 3), qty 1, COD.
  //   Unit price 8999, Total 8999. COD incentive: 5% per unit * 1 = 449.95
  // Order 5: Rahul (staff 2), Karan Kapoor (cust 5), Pulse Tracker (prod 4), qty 3, Prepaid.
  //   Unit price 1499, Total 4497. Prepaid incentive: 100 flat per unit * 3 = 300.00
  db.run(`
    INSERT INTO orders (order_number, staff_id, customer_id, product_id, quantity, unit_price, total_amount, payment_method, order_date, status, remarks, enquiry_id, incentive_type, incentive_basis, incentive_rate, incentive_amount, created_at, updated_at) VALUES
    ('ORD-20261028-0001', 2, 1, 1, 1, 4999.00, 4999.00, 'Prepaid', ?, 'Delivered', 'Paid via UPI, priority shipping requested.', 1, 'percentage', 'per_order', 5.0, 249.95, ?, ?),
    ('ORD-20261028-0002', 2, 2, 2, 2, 1999.00, 3998.00, 'COD', ?, 'Delivered', 'Customer verified phone OTP on delivery.', 2, 'fixed', 'per_unit', 100.0, 200.00, ?, ?),
    ('ORD-20261028-0003', 3, 3, 2, 2, 1999.00, 3998.00, 'Prepaid', ?, 'Delivered', 'Prepaid credit card payment.', 4, 'fixed', 'per_unit', 150.0, 300.00, ?, ?),
    ('ORD-20261029-0004', 3, 4, 3, 1, 8999.00, 8999.00, 'COD', ?, 'Confirmed', 'Dispatched from central warehouse.', NULL, 'percentage', 'per_unit', 5.0, 449.95, ?, ?),
    ('ORD-20261029-0005', 2, 5, 4, 3, 1499.00, 4497.00, 'Prepaid', ?, 'Confirmed', 'Bulk order for corporate fitness challenge.', NULL, 'fixed', 'per_unit', 100.0, 300.00, ?, ?);
  `, [
    yesterday, now, now,
    yesterday, now, now,
    yesterday, now, now,
    today, now, now,
    today, now, now
  ]);

  // Link converted enquiries to created orders
  db.run(`UPDATE enquiries SET converted_order_id = 1 WHERE id = 1;`);
  db.run(`UPDATE enquiries SET converted_order_id = 2 WHERE id = 2;`);
  db.run(`UPDATE enquiries SET converted_order_id = 3 WHERE id = 4;`);

  // 7. Seed Sample Return
  // Order 2 had 2 units of Nova Earbuds. Customer returns 1 unit because 1 earbud had volume imbalance.
  // Return qty: 1. Return amount: 1999.00.
  // Reversed incentive: 100.00 (since COD was 100 flat per unit)
  db.run(`
    INSERT INTO returns (return_number, order_id, staff_id, return_quantity, return_amount, return_date, return_reason, remarks, reversed_incentive, created_at, updated_at) VALUES
    ('RET-20261029-0001', 2, 2, 1, 1999.00, ?, 'Defective item', 'Left earbud volume lower than right, verified with QA.', 100.00, ?, ?);
  `, [today, now, now]);

  // 8. Seed Manager Observation Remarks
  db.run(`
    INSERT INTO staff_performance_remarks (staff_id, manager_id, remarks, updated_at) VALUES
    (2, 1, 'Consistent performer with high customer engagement. Follow up on returns turnaround.', ?),
    (3, 1, 'Excellent conversion rate on premium audio products this month.', ?);
  `, [now, now]);

  seedDailyActivities(db);

  console.log('Database seeded successfully!');
}

function seedDailyActivities(db) {
  const now = new Date().toISOString();
  const today = now.split('T')[0];

  const yestDate = new Date();
  yestDate.setDate(yestDate.getDate() - 1);
  const yesterday = yestDate.toISOString().split('T')[0];

  console.log('Seeding daily activity count records...');
  try {
    db.run(`
      INSERT OR IGNORE INTO daily_activities (staff_id, activity_date, total_calls, connected_calls, total_enquiries, remarks, created_at, updated_at) VALUES
      (2, ?, 38, 29, 12, 'High engagement on smartwatch promotion leads.', ?, ?),
      (2, ?, 42, 34, 15, 'Active calling session for weekend audio discount campaign.', ?, ?),
      (3, ?, 35, 27, 10, 'Targeted corporate leads outreach.', ?, ?),
      (3, ?, 40, 31, 14, 'Customer inquiries answered for Nova Earbuds.', ?, ?),
      (4, ?, 25, 18, 8, 'Initial orientation outreach.', ?, ?),
      (4, ?, 30, 22, 9, 'Follow-up calls on fitness tracker leads.', ?, ?);
    `, [
      yesterday, now, now,
      today, now, now,
      yesterday, now, now,
      today, now, now,
      yesterday, now, now,
      today, now, now
    ]);
  } catch (err) {
    console.error('Failed to seed daily_activities:', err);
  }
}

