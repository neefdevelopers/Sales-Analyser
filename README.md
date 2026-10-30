# SalesPulse — Orders, Returns & Incentives Management System

A simplified, lightweight, full-stack web application purpose-built for managing **customer orders**, **product returns**, and **staff incentive calculations** with strict role-based access control.

---

## 1. System Purpose & Scope

The system is focused strictly on:
1. **Adding and managing orders** (with customer details, product selection, quantity, payment method, order total, and live incentive preview).
2. **Adding and managing product returns** (supporting partial and full returns with proportional incentive reversal and returnable quantity validation).
3. **Automatically calculating staff incentives** based on product-specific rules and payment methods (Prepaid vs. COD).
4. **Brand Manager governance**: Managing products, staff accounts, and configuring independent incentive rules.
5. **Audit records**: Clean views for orders, returns, staff personal records, and organization-wide incentive records.

All other unnecessary functionality (dashboards, charts, daily activity deadlines, call tracking, enquiry tracking, performance ranking, and payroll disbursement) has been completely removed.

---

## 2. User Roles & Navigation

The application supports exactly two roles:

### Role 1: Sales Staff
Focused on rapid order entry, returns handling, and viewing personal records.

**Navigation**:
1. **Orders** (`/orders`):
   - Create new orders with product selection, customer details (name, phone, address), quantity, payment method (Prepaid or COD), order date, and optional remarks.
   - Live preview of calculated order total amount and estimated staff incentive before submitting.
   - View own order history, search by order number, customer, phone, product, and filter by status.
   - View individual order details with snapshotted incentive calculations.
2. **Returns** (`/returns`):
   - Record partial or full returns against own returnable orders.
   - View original customer name, phone, product name, and remaining returnable quantity.
   - Select return reason (Defective item, Wrong item delivered, Customer rejected, Size issue, Transit damage, Other) and optional remarks.
   - Live preview of refund amount and proportional reversed incentive.
   - Server-enforced validation ensuring return quantity cannot exceed remaining returnable units.
3. **My Records** (`/my-records`):
   - Summary cards displaying **My Total Orders**, **My Returned Orders**, and **My Total Incentives** (Net incentive, with earned gross and reversed breakdown).
   - Order history table and Return history table with date-range filters and search.

### Role 2: Brand Manager
Focused on administrative setup, governance, and auditing.

**Navigation**:
1. **Product Management** (`/products`):
   - Add and edit products, set pricing, and toggle active/inactive status.
   - Configure independent incentive rules for **Prepaid** and **Cash on Delivery**:
     - Incentive Type: Fixed amount (₹) or Percentage (%)
     - Calculation Basis: Per product unit or Per order
     - Incentive Value: Rate / amount
2. **Staff Management** (`/staff`):
   - Add new sales staff accounts with sequential Staff IDs (`STF-001`, `STF-002`, ...).
   - Edit staff details, toggle active/inactive account status.
   - Securely reset login passwords (hashed with `bcrypt`).
3. **Orders** (`/orders`):
   - View and search all orders placed across the entire sales team.
   - Filter orders by sales staff, product, payment method (Prepaid, COD), order status, and date range.
   - Inspect complete order details including customer data, unit price, quantity, total amount, and snapshotted incentive.
4. **Returns** (`/returns`):
   - View and search all product returns recorded across all staff.
   - Filter returns by staff and search by return number, order number, customer, or product.
   - Audit return reasons, refund amounts, and reversed staff incentives.
5. **Incentive Records** (`/incentives`):
   - Comprehensive incentive audit table showing:
     - Staff Name & Staff ID
     - Order Number & Order Date
     - Product Name & SKU
     - Payment Method
     - Order Quantity & Net Quantity
     - Applied Incentive Rule description
     - Gross Earned Incentive
     - Return Adjustment (reversed incentive)
     - Final Net Incentive
   - Summary KPI cards: Orders with Incentive, Gross Earned Incentive, Return Adjustments, and Total Final Incentive.
   - Filters: Staff, Product, Payment Method, Date Range, and search.
   - One-click CSV export for external reporting.

---

## 3. Product-Specific Incentive Calculation Rules

1. **Rule Configuration**:
   - Every product has separate, independently configurable rules for **Prepaid** and **COD** orders:
     - `Fixed / Per Unit`: `incentive = incentive_value * quantity`
     - `Fixed / Per Order`: `incentive = incentive_value`
     - `Percentage / Per Unit`: `incentive = (unit_price * quantity) * (incentive_value / 100)`
     - `Percentage / Per Order`: `incentive = total_order_amount * (incentive_value / 100)`
2. **Snapshotting**:
   - When an order is placed, the system snapshots the product's applied rule (`type`, `basis`, `rate`) and the calculated `incentive_amount` into the order record.
3. **Preservation of History**:
   - If a Brand Manager later changes a product's price or incentive configuration, historical orders retain their original snapshotted values.
4. **Return Adjustments**:
   - When a partial or full return is processed, the system automatically calculates the reversed incentive proportionally:
     `reversed_incentive = Math.round((return_quantity / order.quantity) * order.incentive_amount * 100) / 100`
   - Final incentive is always: `earned_incentive - return_adjustment`.

---

## 4. System Architecture & Tech Stack

```
+--------------------------------------------------------------+
|                      CLIENT (Browser)                        |
|   React 19 + Vite + Vanilla CSS (Responsive UI, Lucide Icons)|
+------------------------------+-------------------------------+
                               | HTTP / JSON REST
                               v
+--------------------------------------------------------------+
|                     BACKEND (Node.js / Express 5)            |
|   - auth.js        : JWT authentication & Role middleware    |
|   - products.js    : Product CRUD & calculateIncentive engine|
|   - staff.js       : Staff account management & credential   |
|   - orders.js      : Order creation, preview & my-summary    |
|   - returns.js     : Return processing & incentive reversal  |
|   - incentives.js  : Brand Manager Incentive Records audit   |
|   - system.js      : Server clock and business timezone      |
+------------------------------+-------------------------------+
                               | sql.js (WebAssembly SQLite)
                               v
+--------------------------------------------------------------+
|                     DATA STORE                               |
|   data/sales.db (Single-file SQLite persistent database)     |
+--------------------------------------------------------------+
```

---

## 5. Database Schema

The SQLite database (`data/sales.db`) consists of 5 core tables:

1. **`users`**:
   - `id`, `staff_id` (e.g. STF-001), `name`, `username`, `password_hash`, `role` (`brand_manager` | `sales_staff`), `status` (`active` | `inactive`), timestamps.
2. **`products`**:
   - `id`, `name`, `code` (SKU), `price`, `status`,
   - `prepaid_incentive_type`, `prepaid_incentive_basis`, `prepaid_incentive_value`,
   - `cod_incentive_type`, `cod_incentive_basis`, `cod_incentive_value`, timestamps.
3. **`customers`**:
   - `id`, `name`, `phone` (unique), `address`, timestamps.
4. **`orders`**:
   - `id`, `order_number` (ORD-YYYYMMDD-XXXX), `staff_id`, `customer_id`, `product_id`,
   - `quantity`, `unit_price`, `total_amount`, `payment_method` (`Prepaid` | `COD`),
   - `order_date`, `status`, `remarks`,
   - `incentive_type`, `incentive_basis`, `incentive_rate`, `incentive_amount`, timestamps.
5. **`returns`**:
   - `id`, `return_number` (RET-YYYYMMDD-XXXX), `order_id`, `staff_id`,
   - `return_quantity`, `return_amount`, `return_date`, `return_reason`, `remarks`,
   - `reversed_incentive`, timestamps.

---

## 6. Project Structure

```
Sales Analyser/
├── data/
│   └── sales.db                   # Persistent SQLite database
├── server/
│   ├── index.js                   # Express application entry point
│   ├── db.js                      # sql.js DB initialization & schema
│   ├── auth.js                    # JWT authentication & requireRole middleware
│   ├── timezone.js                # Asia/Kolkata server time helper
│   └── routes/
│       ├── auth.js                # Login & credentials
│       ├── products.js            # Product catalog & incentive calculation logic
│       ├── staff.js               # Sales staff account management
│       ├── orders.js              # Order creation, validation & preview
│       ├── returns.js             # Return creation & incentive reversal
│       ├── incentives.js          # Brand Manager incentive audit records
│       └── system.js              # Server clock
├── src/
│   ├── main.jsx                   # React root entry
│   ├── App.jsx                    # Role-based route controller & shell
│   ├── index.css                  # Clean, modern design system tokens & UI styles
│   ├── api.js                     # Centralized API fetch client with JWT
│   ├── context/
│   │   └── AuthContext.jsx        # Authentication state & role switching
│   ├── components/
│   │   ├── Navbar.jsx             # Top bar with current view title & clock
│   │   └── Sidebar.jsx            # Role-specific navigation menu
│   └── views/
│       ├── Login.jsx              # Login screen with test demo accounts
│       ├── staff/
│       │   ├── StaffOrders.jsx    # New order form with live preview & order list
│       │   ├── StaffReturns.jsx   # Return recording form & return list
│       │   └── StaffMyRecords.jsx # Personal orders, returns & incentives summary
│       └── manager/
│           ├── ProductManagement.jsx  # Products list & incentive rule configurator
│           ├── StaffManagement.jsx    # Staff accounts & credential management
│           ├── ManagerOrders.jsx      # All staff orders with multi-filters
│           └── IncentiveRecords.jsx   # Incentive records audit & CSV export
├── package.json
└── vite.config.js
```

---

## 7. Running the Application

### Development Mode
```bash
npm run dev
```
Starts Express API on port `5000` and Vite dev server on port `5173`.
Access application at: `http://localhost:5173/`

### Production Build
```bash
npm run build
npm start
```

---

## 8. Default Credentials for Testing

| Role | Username | Password | Notes |
| :--- | :--- | :--- | :--- |
| **Brand Manager** | `manager` | `admin123` | Full administrative access to products, staff, orders, returns, and incentives |
| **Sales Staff** | `rahul` | `staff123` | STF-001 — Rahul Sharma |
| **Sales Staff** | `priya` | `staff123` | STF-002 — Priya Patel |
| **Sales Staff** | `vikram` | `staff123` | STF-003 — Vikram Singh |
