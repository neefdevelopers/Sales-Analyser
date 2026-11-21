// server/db.js
// Dual-engine database layer:
// - PostgreSQL via `pg` pool when DATABASE_URL is set (e.g. Neon on Render)
// - SQLite fallback via `sql.js` WebAssembly with filesystem persistence when DATABASE_URL is not set

import initSqlJs from 'sql.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import bcrypt from 'bcryptjs';
import pg from 'pg';

const { Pool } = pg;
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, '..', 'data');
const DB_PATH = path.join(DATA_DIR, 'sales.db');

export const isPg = Boolean(process.env.DATABASE_URL);

let pgPool = null;
let inPgTx = null;

let dbInstance = null;
let SQL = null;
let inTransaction = false;

// Converts ? parameter placeholders to PostgreSQL $1, $2, ... placeholders
function convertSqlForPg(sql) {
  let paramIndex = 1;
  return sql.replace(/\?/g, () => `$${paramIndex++}`);
}

export async function getDb() {
  if (isPg) {
    if (pgPool) return pgPool;
    console.log('Connecting to PostgreSQL (Neon database)...');
    pgPool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: {
        rejectUnauthorized: false
      }
    });

    await initPgSchema(pgPool);
    return pgPool;
  }

  // SQLite fallback
  if (dbInstance) return dbInstance;

  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }

  if (!SQL) {
    SQL = await initSqlJs();
  }

  let dbBuffer = null;
  if (fs.existsSync(DB_PATH)) {
    try {
      dbBuffer = fs.readFileSync(DB_PATH);
    } catch (err) {
      console.warn('Could not read existing SQLite database file, creating fresh one:', err.message);
    }
  }

  dbInstance = dbBuffer ? new SQL.Database(dbBuffer) : new SQL.Database();
  initSqliteSchema(dbInstance);
  saveDb();
  return dbInstance;
}

export function saveDb() {
  if (isPg || !dbInstance || inTransaction) return;
  try {
    const data = dbInstance.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(DB_PATH, buffer);
  } catch (err) {
    console.error('Failed to save SQLite database to disk:', err);
  }
}

/**
 * Execute SELECT query and return array of objects
 */
export async function query(sql, params = []) {
  if (isPg) {
    if (!pgPool) await getDb();
    const pgSql = convertSqlForPg(sql);
    const client = inPgTx || pgPool;
    const res = await client.query(pgSql, params);
    return res.rows;
  }

  // SQLite fallback
  if (!dbInstance) await getDb();
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
export async function get(sql, params = []) {
  const rows = await query(sql, params);
  return rows.length > 0 ? rows[0] : null;
}

/**
 * Execute INSERT, UPDATE, DELETE query
 */
export async function run(sql, params = []) {
  if (isPg) {
    if (!pgPool) await getDb();
    let pgSql = convertSqlForPg(sql);
    const isInsert = /^\s*INSERT\s+INTO/i.test(sql);
    if (isInsert && !/RETURNING/i.test(sql)) {
      pgSql += ' RETURNING id';
    }
    const client = inPgTx || pgPool;
    const res = await client.query(pgSql, params);
    return {
      lastInsertRowid: res.rows[0]?.id || 0,
      changes: res.rowCount || 0
    };
  }

  // SQLite fallback
  if (!dbInstance) await getDb();
  dbInstance.run(sql, params);

  const stmtId = dbInstance.prepare('SELECT last_insert_rowid() AS id');
  let lastId = 0;
  if (stmtId.step()) {
    lastId = stmtId.getAsObject().id;
  }
  stmtId.free();

  const stmtCh = dbInstance.prepare('SELECT changes() AS changes');
  let changes = 0;
  if (stmtCh.step()) {
    changes = stmtCh.getAsObject().changes;
  }
  stmtCh.free();

  saveDb();

  return {
    lastInsertRowid: lastId || 0,
    changes: changes || 0
  };
}

/**
 * Execute raw multiple SQL statements
 */
export async function exec(sql) {
  if (isPg) {
    if (!pgPool) await getDb();
    const client = inPgTx || pgPool;
    await client.query(sql);
    return;
  }

  // SQLite fallback
  if (!dbInstance) await getDb();
  dbInstance.exec(sql);
  saveDb();
}

/**
 * Run callback inside a transaction
 */
export async function transaction(callback) {
  if (isPg) {
    if (!pgPool) await getDb();
    const client = await pgPool.connect();
    inPgTx = client;
    try {
      await client.query('BEGIN');
      const result = await callback();
      await client.query('COMMIT');
      return result;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      inPgTx = null;
      client.release();
    }
  }

  // SQLite fallback
  if (!dbInstance) await getDb();
  inTransaction = true;
  dbInstance.run('BEGIN TRANSACTION;');
  try {
    const result = await callback();
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

async function initPgSchema(pool) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      staff_id VARCHAR(100) UNIQUE NOT NULL,
      name VARCHAR(255) NOT NULL,
      username VARCHAR(100) UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role VARCHAR(50) NOT NULL CHECK(role IN ('brand_manager', 'sales_staff')),
      status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'inactive')),
      created_at TIMESTAMPTZ NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL
    );

    CREATE TABLE IF NOT EXISTS products (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      code VARCHAR(100) UNIQUE NOT NULL,
      price NUMERIC NOT NULL CHECK(price >= 0),
      status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'inactive')),
      prepaid_incentive_type VARCHAR(20) NOT NULL DEFAULT 'fixed' CHECK(prepaid_incentive_type IN ('fixed', 'percentage')),
      prepaid_incentive_basis VARCHAR(20) NOT NULL DEFAULT 'per_unit' CHECK(prepaid_incentive_basis IN ('per_unit', 'per_order')),
      prepaid_incentive_value NUMERIC NOT NULL DEFAULT 0 CHECK(prepaid_incentive_value >= 0),
      cod_incentive_type VARCHAR(20) NOT NULL DEFAULT 'fixed' CHECK(cod_incentive_type IN ('fixed', 'percentage')),
      cod_incentive_basis VARCHAR(20) NOT NULL DEFAULT 'per_unit' CHECK(cod_incentive_basis IN ('per_unit', 'per_order')),
      cod_incentive_value NUMERIC NOT NULL DEFAULT 0 CHECK(cod_incentive_value >= 0),
      created_at TIMESTAMPTZ NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL
    );

    CREATE TABLE IF NOT EXISTS customers (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      phone VARCHAR(50) NOT NULL UNIQUE,
      address TEXT,
      created_at TIMESTAMPTZ NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL
    );

    CREATE TABLE IF NOT EXISTS orders (
      id SERIAL PRIMARY KEY,
      order_number VARCHAR(100) UNIQUE NOT NULL,
      staff_id INTEGER NOT NULL REFERENCES users(id),
      customer_id INTEGER NOT NULL REFERENCES customers(id),
      product_id INTEGER NOT NULL REFERENCES products(id),
      quantity INTEGER NOT NULL CHECK(quantity > 0),
      unit_price NUMERIC NOT NULL,
      total_amount NUMERIC NOT NULL,
      payment_method VARCHAR(20) NOT NULL CHECK(payment_method IN ('Prepaid', 'COD')),
      order_date VARCHAR(50) NOT NULL,
      status VARCHAR(50) NOT NULL DEFAULT 'Confirmed' CHECK(status IN ('Confirmed', 'Delivered', 'Pending', 'Cancelled')),
      remarks TEXT,
      incentive_type VARCHAR(50) NOT NULL,
      incentive_basis VARCHAR(50) NOT NULL,
      incentive_rate NUMERIC NOT NULL,
      incentive_amount NUMERIC NOT NULL,
      created_at TIMESTAMPTZ NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL
    );

    CREATE TABLE IF NOT EXISTS returns (
      id SERIAL PRIMARY KEY,
      return_number VARCHAR(100) UNIQUE NOT NULL,
      order_id INTEGER REFERENCES orders(id),
      staff_id INTEGER NOT NULL REFERENCES users(id),
      product_id INTEGER REFERENCES products(id),
      returned_by_staff_id INTEGER REFERENCES users(id),
      payment_method VARCHAR(20),
      return_quantity INTEGER NOT NULL CHECK(return_quantity > 0),
      return_amount NUMERIC NOT NULL,
      return_date VARCHAR(50) NOT NULL,
      return_reason VARCHAR(255) NOT NULL DEFAULT 'Product Return',
      remarks TEXT,
      reversed_incentive NUMERIC NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL
    );

    CREATE TABLE IF NOT EXISTS import_logs (
      id SERIAL PRIMARY KEY,
      file_hash VARCHAR(255) UNIQUE NOT NULL,
      file_name VARCHAR(255) NOT NULL,
      total_rows INTEGER NOT NULL,
      updated_count INTEGER NOT NULL,
      created_at TIMESTAMPTZ NOT NULL,
      created_by INTEGER REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS monthly_reports (
      id SERIAL PRIMARY KEY,
      report_month VARCHAR(50) UNIQUE NOT NULL,
      month_name VARCHAR(100) NOT NULL,
      filename VARCHAR(255) NOT NULL,
      file_hash VARCHAR(255),
      sheet_names TEXT,
      columns_json TEXT,
      total_records INTEGER DEFAULT 0,
      total_employees INTEGER DEFAULT 0,
      total_sales_amount NUMERIC DEFAULT 0,
      imported_by INTEGER REFERENCES users(id),
      import_status VARCHAR(50) DEFAULT 'completed',
      created_at TIMESTAMPTZ NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL
    );

    CREATE TABLE IF NOT EXISTS employee_sales_reports (
      id SERIAL PRIMARY KEY,
      monthly_report_id INTEGER NOT NULL REFERENCES monthly_reports(id) ON DELETE CASCADE,
      report_month VARCHAR(50) NOT NULL,
      employee_id VARCHAR(100) NOT NULL,
      employee_name VARCHAR(255) NOT NULL,
      record_count INTEGER DEFAULT 0,
      summary_json TEXT,
      columns_json TEXT,
      created_at TIMESTAMPTZ NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL,
      UNIQUE(monthly_report_id, employee_id)
    );

    CREATE TABLE IF NOT EXISTS sales_records (
      id SERIAL PRIMARY KEY,
      monthly_report_id INTEGER NOT NULL REFERENCES monthly_reports(id) ON DELETE CASCADE,
      employee_sales_report_id INTEGER NOT NULL REFERENCES employee_sales_reports(id) ON DELETE CASCADE,
      report_month VARCHAR(50) NOT NULL,
      employee_id VARCHAR(100) NOT NULL,
      employee_name VARCHAR(255) NOT NULL,
      record_date VARCHAR(50),
      row_index INTEGER,
      data_json TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_monthly_reports_month ON monthly_reports(report_month);
    CREATE INDEX IF NOT EXISTS idx_emp_sales_rep_emp ON employee_sales_reports(employee_id);
    CREATE INDEX IF NOT EXISTS idx_emp_sales_rep_month ON employee_sales_reports(report_month);
    CREATE INDEX IF NOT EXISTS idx_sales_records_emp ON sales_records(employee_id);
    CREATE INDEX IF NOT EXISTS idx_sales_records_month ON sales_records(report_month);
    CREATE INDEX IF NOT EXISTS idx_sales_records_date ON sales_records(record_date);
  `);

  // Seed default manager if users table is empty
  const userCountRes = await pool.query('SELECT COUNT(*) AS c FROM users');
  const count = parseInt(userCountRes.rows[0]?.c || '0', 10);
  if (count === 0) {
    console.log('Seeding initial PostgreSQL database with default manager account...');
    const now = new Date().toISOString();
    const adminHash = bcrypt.hashSync('admin123', 10);
    await pool.query(`
      INSERT INTO users (staff_id, name, username, password_hash, role, status, created_at, updated_at) VALUES
      ($1, $2, $3, $4, $5, $6, $7, $8)
    `, ['MGR-001', 'Arun Varma (Brand Manager)', 'manager', adminHash, 'brand_manager', 'active', now, now]);
    console.log('PostgreSQL database initialized with default manager account.');
  }
}

function initSqliteSchema(db) {
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
      order_id INTEGER REFERENCES orders(id),
      staff_id INTEGER NOT NULL REFERENCES users(id),
      product_id INTEGER REFERENCES products(id),
      returned_by_staff_id INTEGER REFERENCES users(id),
      payment_method TEXT,
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

    CREATE TABLE IF NOT EXISTS import_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      file_hash TEXT UNIQUE NOT NULL,
      file_name TEXT NOT NULL,
      total_rows INTEGER NOT NULL,
      updated_count INTEGER NOT NULL,
      created_at TEXT NOT NULL,
      created_by INTEGER REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS monthly_reports (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      report_month TEXT UNIQUE NOT NULL,
      month_name TEXT NOT NULL,
      filename TEXT NOT NULL,
      file_hash TEXT,
      sheet_names TEXT,
      columns_json TEXT,
      total_records INTEGER DEFAULT 0,
      total_employees INTEGER DEFAULT 0,
      total_sales_amount REAL DEFAULT 0,
      imported_by INTEGER REFERENCES users(id),
      import_status TEXT DEFAULT 'completed',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS employee_sales_reports (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      monthly_report_id INTEGER NOT NULL REFERENCES monthly_reports(id) ON DELETE CASCADE,
      report_month TEXT NOT NULL,
      employee_id TEXT NOT NULL,
      employee_name TEXT NOT NULL,
      record_count INTEGER DEFAULT 0,
      summary_json TEXT,
      columns_json TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      UNIQUE(monthly_report_id, employee_id)
    );

    CREATE TABLE IF NOT EXISTS sales_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      monthly_report_id INTEGER NOT NULL REFERENCES monthly_reports(id) ON DELETE CASCADE,
      employee_sales_report_id INTEGER NOT NULL REFERENCES employee_sales_reports(id) ON DELETE CASCADE,
      report_month TEXT NOT NULL,
      employee_id TEXT NOT NULL,
      employee_name TEXT NOT NULL,
      record_date TEXT,
      row_index INTEGER,
      data_json TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_monthly_reports_month ON monthly_reports(report_month);
    CREATE INDEX IF NOT EXISTS idx_emp_sales_rep_emp ON employee_sales_reports(employee_id);
    CREATE INDEX IF NOT EXISTS idx_emp_sales_rep_month ON employee_sales_reports(report_month);
    CREATE INDEX IF NOT EXISTS idx_sales_records_emp ON sales_records(employee_id);
    CREATE INDEX IF NOT EXISTS idx_sales_records_month ON sales_records(report_month);
    CREATE INDEX IF NOT EXISTS idx_sales_records_date ON sales_records(record_date);
  `);

  // Seed default manager if users table is empty
  const userCount = db.exec("SELECT COUNT(*) AS c FROM users;");
  const count = userCount[0]?.values[0]?.[0] || 0;
  if (count === 0) {
    console.log('Seeding initial SQLite database with default manager account...');
    const now = new Date().toISOString();
    const adminHash = bcrypt.hashSync('admin123', 10);
    db.run(`
      INSERT INTO users (staff_id, name, username, password_hash, role, status, created_at, updated_at) VALUES
      ('MGR-001', 'Arun Varma (Brand Manager)', 'manager', ?, 'brand_manager', 'active', ?, ?);
    `, [adminHash, now, now]);
    console.log('SQLite database initialized with default manager account.');
  }
}
