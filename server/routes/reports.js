// server/routes/reports.js
import { Router } from 'express';
import ExcelJS from 'exceljs';
import { query, get } from '../db.js';
import { authenticate, requireRole } from '../auth.js';
import { getNowInBusinessTimezone } from '../timezone.js';

const router = Router();

// Only Brand Manager has access to Sales Reports
router.use(authenticate, requireRole('brand_manager'));

/**
 * Helper to compute date range from presets or custom inputs
 */
export function resolveReportDateRange({ preset = 'this_month', startDate, endDate }) {
  const now = getNowInBusinessTimezone();
  const todayStr = now.dateStr;
  const year = now.year;
  const month = now.month;
  const day = now.day;

  const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
  let validStart = startDate && DATE_REGEX.test(startDate) ? startDate : null;
  let validEnd = endDate && DATE_REGEX.test(endDate) ? endDate : null;

  if (validStart && validEnd && validStart > validEnd) {
    const tmp = validStart;
    validStart = validEnd;
    validEnd = tmp;
  }

  if (preset === 'all' || preset === 'all_time') {
    const rangeRes = query(`
      SELECT
        MIN(min_d) AS s_date,
        MAX(max_d) AS e_date
      FROM (
        SELECT MIN(order_date) AS min_d, MAX(order_date) AS max_d FROM orders
        UNION ALL
        SELECT MIN(return_date) AS min_d, MAX(return_date) AS max_d FROM returns
      )
    `);
    const sDate = rangeRes[0]?.s_date || `${year}-${String(month).padStart(2, '0')}-01`;
    const eDate = rangeRes[0]?.e_date || todayStr;
    return {
      startDate: sDate,
      endDate: eDate,
      preset: 'all',
      label: 'All Records'
    };
  }

  if (preset === 'today') {
    return { startDate: todayStr, endDate: todayStr, preset: 'today', label: 'Today' };
  }
  if (preset === 'yesterday') {
    const d = new Date(Date.UTC(year, month - 1, day - 1));
    const yNow = getNowInBusinessTimezone('Asia/Kolkata', d);
    return { startDate: yNow.dateStr, endDate: yNow.dateStr, preset: 'yesterday', label: 'Yesterday' };
  }
  if (preset === 'this_week') {
    const d = new Date(Date.UTC(year, month - 1, day));
    const dayOfWeek = d.getUTCDay(); // 0 is Sunday
    const diffToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    const monday = new Date(d);
    monday.setUTCDate(d.getUTCDate() - diffToMonday);
    const mStr = getNowInBusinessTimezone('Asia/Kolkata', monday).dateStr;
    return { startDate: mStr, endDate: todayStr, preset: 'this_week', label: 'This Week' };
  }
  if (preset === 'this_month') {
    const mStr = String(month).padStart(2, '0');
    const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
    return {
      startDate: `${year}-${mStr}-01`,
      endDate: `${year}-${mStr}-${String(lastDay).padStart(2, '0')}`,
      preset: 'this_month',
      label: 'This Month'
    };
  }
  if (preset === 'previous_month') {
    const prevMonthDate = new Date(Date.UTC(year, month - 2, 1));
    const pYear = prevMonthDate.getUTCFullYear();
    const pMonth = prevMonthDate.getUTCMonth() + 1;
    const pMStr = String(pMonth).padStart(2, '0');
    const pLastDay = new Date(Date.UTC(pYear, pMonth, 0)).getUTCDate();
    return {
      startDate: `${pYear}-${pMStr}-01`,
      endDate: `${pYear}-${pMStr}-${String(pLastDay).padStart(2, '0')}`,
      preset: 'previous_month',
      label: 'Previous Month'
    };
  }

  // Custom
  const customStart = validStart || `${year}-${String(month).padStart(2, '0')}-01`;
  const customEnd = validEnd || todayStr;
  return {
    startDate: customStart,
    endDate: customEnd,
    preset: 'custom',
    label: `${customStart} to ${customEnd}`
  };
}

/**
 * Core aggregator function for sales report data
 */
export function getSalesReportData(filters = {}) {
  const { startDate, endDate, staffId = 'all', productId = 'all', paymentMethod = 'all' } = filters;

  // 1. Build Orders Query (Excludes Cancelled orders, strictly NO customer fields)
  let orderConditions = [
    "o.status != 'Cancelled'",
    'o.order_date >= ?',
    'o.order_date <= ?'
  ];
  let orderParams = [startDate, endDate];

  if (staffId && staffId !== 'all') {
    orderConditions.push('o.staff_id = ?');
    orderParams.push(parseInt(staffId, 10));
  }
  if (productId && productId !== 'all') {
    orderConditions.push('o.product_id = ?');
    orderParams.push(parseInt(productId, 10));
  }
  if (paymentMethod && paymentMethod !== 'all') {
    orderConditions.push('o.payment_method = ?');
    orderParams.push(paymentMethod);
  }

  const orderSql = `
    SELECT
      o.id,
      o.order_number,
      o.order_date,
      o.staff_id,
      u.name AS staff_name,
      u.staff_id AS staff_code,
      o.product_id,
      p.name AS product_name,
      p.code AS product_code,
      o.quantity,
      o.unit_price,
      o.total_amount AS order_amount,
      o.payment_method,
      o.status,
      o.incentive_amount,
      o.created_at
    FROM orders o
    JOIN users u ON o.staff_id = u.id
    JOIN products p ON o.product_id = p.id
    WHERE ${orderConditions.join(' AND ')}
    ORDER BY o.order_date DESC, o.id DESC
  `;

  const orders = query(orderSql, orderParams);

  // 2. Build Returns Query (Attributable returns in period, strictly NO customer fields)
  let returnConditions = [
    'r.return_date >= ?',
    'r.return_date <= ?'
  ];
  let returnParams = [startDate, endDate];

  if (staffId && staffId !== 'all') {
    const sId = parseInt(staffId, 10);
    returnConditions.push('(COALESCE(r.staff_id, o.staff_id) = ? OR r.returned_by_staff_id = ?)');
    returnParams.push(sId, sId);
  }
  if (productId && productId !== 'all') {
    returnConditions.push('COALESCE(r.product_id, o.product_id) = ?');
    returnParams.push(parseInt(productId, 10));
  }
  if (paymentMethod && paymentMethod !== 'all') {
    returnConditions.push("COALESCE(r.payment_method, o.payment_method, 'Prepaid') = ?");
    returnParams.push(paymentMethod);
  }

  const returnSql = `
    SELECT
      r.id,
      r.return_number,
      r.return_date,
      r.return_quantity,
      r.return_amount,
      r.reversed_incentive,
      r.order_id,
      COALESCE(o.order_number, '-') AS original_order_number,
      COALESCE(r.staff_id, o.staff_id) AS staff_id,
      COALESCE(u_staff.name, 'Sales Staff') AS staff_name,
      COALESCE(u_staff.staff_id, '') AS staff_code,
      COALESCE(r.returned_by_staff_id, r.staff_id, o.staff_id) AS returned_by_staff_id,
      COALESCE(u_ret.name, u_staff.name, 'Staff Member') AS returned_by_name,
      COALESCE(u_ret.staff_id, u_staff.staff_id, '') AS returned_by_code,
      COALESCE(r.product_id, o.product_id) AS product_id,
      p.name AS product_name,
      p.code AS product_code,
      p.price AS unit_price,
      COALESCE(r.payment_method, o.payment_method, 'Prepaid') AS payment_method,
      r.return_reason
    FROM returns r
    LEFT JOIN orders o ON r.order_id = o.id
    LEFT JOIN products p ON COALESCE(r.product_id, o.product_id) = p.id
    LEFT JOIN users u_staff ON COALESCE(r.staff_id, o.staff_id) = u_staff.id
    LEFT JOIN users u_ret ON COALESCE(r.returned_by_staff_id, r.staff_id, o.staff_id) = u_ret.id
    WHERE ${returnConditions.join(' AND ')}
    ORDER BY r.return_date DESC, r.id DESC
  `;

  const returns = query(returnSql, returnParams);

  // 3. Fetch Master Lists for Staff and Products
  let allStaff = query(`
    SELECT id, staff_id, name, username, status
    FROM users
    WHERE role = 'sales_staff'
      AND (
        status = 'active'
        OR id IN (
          SELECT DISTINCT staff_id FROM orders WHERE status != 'Cancelled' AND order_date >= ? AND order_date <= ?
        )
        OR id IN (
          SELECT DISTINCT COALESCE(staff_id, returned_by_staff_id) FROM returns WHERE return_date >= ? AND return_date <= ?
        )
      )
    ORDER BY name ASC
  `, [startDate, endDate, startDate, endDate]);
  let allProducts = query("SELECT id, name, code, price, status FROM products ORDER BY name ASC");

  // If filtered by specific staff or product, narrow the list
  if (staffId && staffId !== 'all') {
    const sId = parseInt(staffId, 10);
    allStaff = allStaff.filter(s => s.id === sId);
  }
  if (productId && productId !== 'all') {
    const pId = parseInt(productId, 10);
    allProducts = allProducts.filter(p => p.id === pId);
  }

  // 4. Calculate Summary Figures
  const total_orders = orders.length;
  const gross_sales = Math.round(orders.reduce((sum, o) => sum + (o.order_amount || 0), 0) * 100) / 100;
  const total_returns = Math.round(returns.reduce((sum, r) => sum + (r.return_amount || 0), 0) * 100) / 100;
  const net_sales = Math.round((gross_sales - total_returns) * 100) / 100;

  const ordered_quantity = orders.reduce((sum, o) => sum + (o.quantity || 0), 0);
  const returned_quantity = returns.reduce((sum, r) => sum + (r.return_quantity || 0), 0);
  const net_quantity = ordered_quantity - returned_quantity;

  const earned_incentive = Math.round(orders.reduce((sum, o) => sum + (o.incentive_amount || 0), 0) * 100) / 100;
  const reversed_incentive = Math.round(returns.reduce((sum, r) => sum + (r.reversed_incentive || 0), 0) * 100) / 100;
  const total_incentives = Math.round((earned_incentive - reversed_incentive) * 100) / 100;

  const summary = {
    total_orders,
    gross_sales,
    total_returns,
    net_sales,
    ordered_quantity,
    returned_quantity,
    net_quantity,
    earned_incentive,
    reversed_incentive,
    total_incentives
  };

  // 5. Calculate Staff-Wise Report
  // Columns: Staff Name, Total Orders, Gross Sales, Total Returns, Net Sales, Product Quantity
  const staffReport = allStaff.map(staff => {
    const staffOrders = orders.filter(o => o.staff_id === staff.id);
    const staffReturns = returns.filter(r => (r.staff_id === staff.id || (!r.staff_id && r.returned_by_staff_id === staff.id)));

    const stfOrdersCount = staffOrders.length;
    const stfGrossSales = Math.round(staffOrders.reduce((sum, o) => sum + (o.order_amount || 0), 0) * 100) / 100;
    const stfReturns = Math.round(staffReturns.reduce((sum, r) => sum + (r.return_amount || 0), 0) * 100) / 100;
    const stfNetSales = Math.round((stfGrossSales - stfReturns) * 100) / 100;

    const stfOrderedQty = staffOrders.reduce((sum, o) => sum + (o.quantity || 0), 0);
    const stfReturnedQty = staffReturns.reduce((sum, r) => sum + (r.return_quantity || 0), 0);
    const stfNetQty = stfOrderedQty - stfReturnedQty;

    const stfEarnedIncentive = Math.round(staffOrders.reduce((sum, o) => sum + (o.incentive_amount || 0), 0) * 100) / 100;
    const stfReversedIncentive = Math.round(staffReturns.reduce((sum, r) => sum + (r.reversed_incentive || 0), 0) * 100) / 100;
    const stfNetIncentive = Math.round((stfEarnedIncentive - stfReversedIncentive) * 100) / 100;

    return {
      staff_id: staff.id,
      staff_code: staff.staff_id,
      staff_name: staff.name,
      username: staff.username,
      status: staff.status,
      total_orders: stfOrdersCount,
      gross_sales: stfGrossSales,
      returns: stfReturns,
      total_returns: stfReturns,
      net_sales: stfNetSales,
      product_quantity: stfOrderedQty,
      returned_quantity: stfReturnedQty,
      net_quantity: stfNetQty,
      earned_incentive: stfEarnedIncentive,
      total_incentive: stfEarnedIncentive,
      gross_incentive: stfEarnedIncentive,
      reversed_incentive: stfReversedIncentive,
      return_adjustments: stfReversedIncentive,
      net_incentive: stfNetIncentive
    };
  });

  staffReport.sort((a, b) => b.net_sales - a.net_sales || b.total_orders - a.total_orders);

  // 6. Calculate Product-Wise Report
  // Columns: Product, Orders, Ordered Quantity, Returned Quantity, Net Quantity, Gross Sales, Net Sales
  const productReport = allProducts.map(prod => {
    const prodOrders = orders.filter(o => o.product_id === prod.id);
    const prodReturns = returns.filter(r => r.product_id === prod.id);

    const prdOrdersCount = prodOrders.length;
    const prdOrderedQty = prodOrders.reduce((sum, o) => sum + (o.quantity || 0), 0);
    const prdReturnedQty = prodReturns.reduce((sum, r) => sum + (r.return_quantity || 0), 0);
    const prdNetQty = prdOrderedQty - prdReturnedQty;

    const prdGrossSales = Math.round(prodOrders.reduce((sum, o) => sum + (o.order_amount || 0), 0) * 100) / 100;
    const prdReturnsAmount = Math.round(prodReturns.reduce((sum, r) => sum + (r.return_amount || 0), 0) * 100) / 100;
    const prdNetSales = Math.round((prdGrossSales - prdReturnsAmount) * 100) / 100;

    return {
      product_id: prod.id,
      product_code: prod.code,
      product_name: prod.name,
      price: prod.price,
      orders: prdOrdersCount,
      ordered_quantity: prdOrderedQty,
      returned_quantity: prdReturnedQty,
      net_quantity: prdNetQty,
      gross_sales: prdGrossSales,
      returns: prdReturnsAmount,
      net_sales: prdNetSales
    };
  });

  productReport.sort((a, b) => b.net_sales - a.net_sales || b.net_quantity - a.net_quantity);

  // 7. Dynamic Sheet Matrix matching imported Excel workbook layout
  const sheetColumns = [
    { key: 'date', label: 'Date', width: '95px' },
    { key: 'employee_id', label: 'Employee ID', width: '110px' },
    { key: 'staff_name', label: 'Staff Name', width: '130px' },
    ...allProducts.flatMap(p => [
      { key: `${p.code}_COD`, label: `${p.name} (COD)`, type: 'product', productId: p.id, productName: p.name, paymentMethod: 'COD' },
      { key: `${p.code}_Prepaid`, label: `${p.name} (Prepaid)`, type: 'product', productId: p.id, productName: p.name, paymentMethod: 'Prepaid' }
    ]),
    { key: 'incentive', label: 'Incentive', type: 'currency' },
    ...allProducts.map(p => (
      { key: `RET_${p.code}`, label: `Return ${p.name}`, type: 'return', productId: p.id, productName: p.name }
    )),
    { key: 'return_deductions', label: 'Return Deductions', type: 'currency' },
    { key: 'total_net', label: 'Total Net', type: 'currency' }
  ];

  const sheetRowMap = new Map();

  for (const o of orders) {
    const k = `${o.order_date}_${o.staff_id}`;
    if (!sheetRowMap.has(k)) {
      sheetRowMap.set(k, {
        date: o.order_date,
        staff_id: o.staff_id,
        employee_id: o.staff_code,
        staff_name: o.staff_name,
        quantities: {},
        incentive: 0,
        returns: {},
        return_deductions: 0,
        total_net: 0
      });
    }
    const r = sheetRowMap.get(k);
    const pKey = `${o.product_code}_${o.payment_method}`;
    r.quantities[pKey] = (r.quantities[pKey] || 0) + (o.quantity || 0);
    r.incentive += (o.incentive_amount || 0);
  }

  for (const ret of returns) {
    const date = ret.return_date;
    const staffIdVal = ret.staff_id || ret.returned_by_staff_id;
    const k = `${date}_${staffIdVal}`;
    if (!sheetRowMap.has(k)) {
      sheetRowMap.set(k, {
        date,
        staff_id: staffIdVal,
        employee_id: ret.staff_code || ret.returned_by_code || '',
        staff_name: ret.staff_name || ret.returned_by_name || '',
        quantities: {},
        incentive: 0,
        returns: {},
        return_deductions: 0,
        total_net: 0
      });
    }
    const r = sheetRowMap.get(k);
    const rKey = `RET_${ret.product_code}`;
    r.returns[rKey] = (r.returns[rKey] || 0) + (ret.return_quantity || 0);
    r.return_deductions += (ret.reversed_incentive || 0);
  }

  const sheetRows = Array.from(sheetRowMap.values()).map(r => {
    r.incentive = Math.round(r.incentive * 100) / 100;
    r.return_deductions = Math.round(r.return_deductions * 100) / 100;
    r.total_net = Math.max(0, Math.round((r.incentive - r.return_deductions) * 100) / 100);
    return r;
  });

  sheetRows.sort((a, b) => a.date.localeCompare(b.date) || (a.employee_id || '').localeCompare(b.employee_id || ''));

  return {
    summary,
    staffReport,
    productReport,
    orders,
    returns,
    products: allProducts,
    sheetColumns,
    sheetRows
  };
}

/**
 * 1. GET /api/reports/sales
 * Returns full aggregated JSON dataset for Sales Reports page
 */
router.get('/sales', (req, res) => {
  try {
    const { preset, startDate, endDate, staffId, productId, paymentMethod } = req.query;
    const dateRange = resolveReportDateRange({ preset, startDate, endDate });

    const reportData = getSalesReportData({
      startDate: dateRange.startDate,
      endDate: dateRange.endDate,
      staffId,
      productId,
      paymentMethod
    });

    const now = getNowInBusinessTimezone();

    res.json({
      period: {
        ...dateRange,
        generatedAt: now.isoLike
      },
      filters: {
        staffId: staffId || 'all',
        productId: productId || 'all',
        paymentMethod: paymentMethod || 'all'
      },
      staffReport: reportData.staffReport,
      productReport: reportData.productReport,
      summary: {
        ...reportData.summary,
        totalOrders: reportData.orders.length,
        totalReturns: reportData.returns.length,
        grossSales: reportData.summary.gross_sales,
        grossIncentive: reportData.summary.earned_incentive,
        earnedIncentive: reportData.summary.earned_incentive,
        returnAdjustments: reportData.summary.reversed_incentive,
        reversedIncentive: reportData.summary.reversed_incentive,
        netIncentive: reportData.summary.total_incentives,
        totalQuantity: reportData.summary.ordered_quantity,
        returnedQuantity: reportData.summary.returned_quantity,
        netQuantity: reportData.summary.net_quantity
      },
      orders: reportData.orders,
      returns: reportData.returns,
      products: reportData.products,
      sheetColumns: reportData.sheetColumns,
      sheetRows: reportData.sheetRows
    });
  } catch (err) {
    console.error('Failed to generate sales report:', err);
    res.status(500).json({ error: 'Failed to generate sales report: ' + err.message });
  }
});

/**
 * 2. GET /api/reports/sales/staff/:staffId
 * Returns individual staff sales report (validated & backend-scoped).
 * Prevents URL/API manipulation and unauthorized staff record leakage.
 */
router.get('/sales/staff/:staffId', (req, res) => {
  try {
    const { staffId } = req.params;
    const parsedId = parseInt(staffId, 10);

    const sRows = !isNaN(parsedId)
      ? query("SELECT id, staff_id, name, username, status FROM users WHERE (id = ? OR staff_id = ?) AND role = 'sales_staff'", [parsedId, String(staffId)])
      : query("SELECT id, staff_id, name, username, status FROM users WHERE staff_id = ? AND role = 'sales_staff'", [String(staffId)]);

    if (!sRows || sRows.length === 0) {
      return res.status(404).json({ error: 'Sales staff member not found or access unauthorized.' });
    }
    const staff = sRows[0];

    const { preset, startDate, endDate, productId, paymentMethod } = req.query;
    const dateRange = resolveReportDateRange({ preset, startDate, endDate });

    const reportData = getSalesReportData({
      startDate: dateRange.startDate,
      endDate: dateRange.endDate,
      staffId: staff.id,
      productId,
      paymentMethod
    });

    const now = getNowInBusinessTimezone();

    res.json({
      staff: {
        ...staff,
        staff_code: staff.staff_id,
        employee_id: staff.staff_id
      },
      period: {
        ...dateRange,
        generatedAt: now.isoLike
      },
      filters: {
        productId: productId || 'all',
        paymentMethod: paymentMethod || 'all'
      },
      ordersSummary: {
        total_orders: reportData.summary.total_orders,
        total_order_amount: reportData.summary.gross_sales,
        ordered_quantity: reportData.summary.ordered_quantity
      },
      returnsSummary: {
        total_returns: reportData.returns.length,
        total_refunded_amount: reportData.summary.total_returns,
        returned_quantity: reportData.summary.returned_quantity
      },
      summary: {
        totalOrders: reportData.orders.length,
        total_orders: reportData.orders.length,
        grossSales: reportData.summary.gross_sales,
        gross_sales: reportData.summary.gross_sales,
        grossIncentive: reportData.summary.earned_incentive,
        gross_incentive: reportData.summary.earned_incentive,
        earnedIncentive: reportData.summary.earned_incentive,
        earned_incentive: reportData.summary.earned_incentive,
        returnAdjustments: reportData.summary.reversed_incentive,
        return_adjustments: reportData.summary.reversed_incentive,
        reversedIncentive: reportData.summary.reversed_incentive,
        reversed_incentive: reportData.summary.reversed_incentive,
        netIncentive: reportData.summary.total_incentives,
        net_incentive: reportData.summary.total_incentives,
        totalQuantity: reportData.summary.ordered_quantity,
        returnedQuantity: reportData.summary.returned_quantity,
        netQuantity: reportData.summary.net_quantity
      },
      orders: reportData.orders,
      returns: reportData.returns,
      products: reportData.products,
      sheetColumns: reportData.sheetColumns,
      sheetRows: reportData.sheetRows
    });
  } catch (err) {
    console.error('Failed to generate individual staff sales report:', err);
    res.status(500).json({ error: 'Failed to generate staff sales report: ' + err.message });
  }
});

/**
 * Helper to style an Excel table header row
 */
function applyHeaderStyle(row, color = '1E293B') {
  row.height = 24;
  row.eachCell((cell) => {
    cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF' + color } };
    cell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
    cell.border = {
      top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
      bottom: { style: 'medium', color: { argb: 'FF94A3B8' } },
      left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
      right: { style: 'thin', color: { argb: 'FFCBD5E1' } }
    };
  });
}

/**
 * 2. GET /api/reports/sales/export-excel
 * Generates and downloads a genuine .xlsx workbook containing EXACTLY ONE worksheet.
 *
 * Case 1: Specific Sales Staff selected -> Filename: Sales_Report_StaffName.xlsx
 * Case 2: No Sales Staff selected (All Staff) -> Filename: Overall_Sales_Report.xlsx
 *
 * Exactly 5 Organized Sections in One Worksheet:
 * 1. Report Information (Title, Generation Date, Reporting Period, Staff)
 * 2. Orders Summary (Total Orders, Total Order Amount, Total Products Ordered)
 * 3. Returns Summary (Total Returns, Total Refunded Amount, Total Returned Quantity)
 * 4. Order Details (Order ID, Order Date, Staff Name, Product, Quantity, Payment Method, Unit Price, Order Amount, Order Status)
 * 5. Return Details (Return ID, Return Date, Returned By, Product, Returned Quantity, Refund Amount)
 *
 * Strict Privacy: Strictly NO customer fields, customer counts, or customer analysis.
 * Strict Scope: Strictly NO incentive calculations, NO incentive adjustments, NO separate staff/product analysis sections.
 */
export async function handleExportSalesReportExcel(req, res) {
  try {
    const { preset, startDate, endDate, productId, paymentMethod } = req.query;
    const staffId = req.params.staffId || req.query.staffId;
    const dateRange = resolveReportDateRange({ preset, startDate, endDate });

    // Determine selected staff member if staff filter applied
    let selectedStaff = null;
    let effectiveStaffId = staffId;
    if (staffId && staffId !== 'all') {
      const parsedId = parseInt(staffId, 10);
      const sRows = !isNaN(parsedId)
        ? query("SELECT id, staff_id, name, username FROM users WHERE (id = ? OR staff_id = ?) AND role = 'sales_staff'", [parsedId, String(staffId)])
        : query("SELECT id, staff_id, name, username FROM users WHERE staff_id = ? AND role = 'sales_staff'", [String(staffId)]);
      if (!sRows || sRows.length === 0) {
        return res.status(404).json({ error: 'Sales staff member not found or access unauthorized.' });
      }
      selectedStaff = sRows[0];
      effectiveStaffId = selectedStaff.id;
    }

    const reportData = getSalesReportData({
      startDate: dateRange.startDate,
      endDate: dateRange.endDate,
      staffId: effectiveStaffId,
      productId,
      paymentMethod
    });

    const now = getNowInBusinessTimezone();
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Sales Management System';
    workbook.lastModifiedBy = 'Brand Manager';
    workbook.created = new Date();
    workbook.modified = new Date();

    const currencyFormat = '"₹"#,##0.00;[Red]("-₹"#,##0.00);"₹0.00"';
    const numberFormat = '#,##0;[Red]-#,##0;0';

    // Exactly ONE worksheet
    const sheet = workbook.addWorksheet('Sales Report', {
      properties: { tabColor: { argb: 'FF2563EB' } },
      pageSetup: {
        orientation: 'landscape',
        fitToPage: true,
        fitToWidth: 1,
        fitToHeight: 0,
        paperSize: 9
      },
      views: [{ showGridLines: true }]
    });

    // Balanced column widths for clean readability and printing
    sheet.columns = [
      { key: 'col1', width: 28 }, // Col A: Section Labels / Order ID / Return ID
      { key: 'col2', width: 16 }, // Col B: Values / Order Date / Return Date
      { key: 'col3', width: 24 }, // Col C: Staff Name / Returned By
      { key: 'col4', width: 28 }, // Col D: Product
      { key: 'col5', width: 14 }, // Col E: Quantity / Returned Quantity
      { key: 'col6', width: 18 }, // Col F: Payment Method / Refund Amount
      { key: 'col7', width: 16 }, // Col G: Unit Price
      { key: 'col8', width: 18 }, // Col H: Order Amount
      { key: 'col9', width: 16 }  // Col I: Order Status
    ];

    // ==========================================
    // SECTION 1: Report Information
    // - Report Title
    // - Report Generation Date
    // - Selected Reporting Period
    // - Selected Staff Name or "All Staff"
    // ==========================================
    const titleRow = sheet.addRow(['SALES MANAGEMENT SYSTEM - SALES REPORT']);
    titleRow.height = 26;
    titleRow.font = { name: 'Calibri', size: 14, bold: true, color: { argb: 'FF1E293B' } };
    titleRow.alignment = { vertical: 'middle' };

    const meta1 = sheet.addRow(['Report Generation Date:', `${now.isoLike} (${now.timezone})`]);
    meta1.getCell(1).font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF475569' } };
    meta1.getCell(2).font = { name: 'Calibri', size: 10, color: { argb: 'FF1E293B' } };

    const meta2 = sheet.addRow(['Selected Reporting Period:', `${dateRange.startDate} to ${dateRange.endDate} (${dateRange.label})`]);
    meta2.getCell(1).font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF475569' } };
    meta2.getCell(2).font = { name: 'Calibri', size: 10, color: { argb: 'FF1E293B' } };

    if (selectedStaff) {
      const metaStaffName = sheet.addRow(['Staff Name:', selectedStaff.name]);
      metaStaffName.getCell(1).font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF475569' } };
      metaStaffName.getCell(2).font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF2563EB' } };

      const metaStaffCode = sheet.addRow(['Employee ID:', selectedStaff.staff_id]);
      metaStaffCode.getCell(1).font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF475569' } };
      metaStaffCode.getCell(2).font = { name: 'Calibri', size: 10, color: { argb: 'FF1E293B' } };
    } else {
      const metaStaff = sheet.addRow(['Selected Staff:', 'All Staff']);
      metaStaff.getCell(1).font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF475569' } };
      metaStaff.getCell(2).font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF1E293B' } };
    }

    sheet.addRow([]); // Blank spacer

    // ==========================================
    // SECTION 2: Orders Summary
    // - Total Orders
    // - Total Order Amount
    // - Total Products Ordered (Quantity)
    // ==========================================
    const osHeaderRow = sheet.addRow(['2. ORDERS SUMMARY']);
    osHeaderRow.height = 22;
    osHeaderRow.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FF1E3A8A' } };
    osHeaderRow.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDBEAFE' } };

    const osRow1 = sheet.addRow(['Total Orders', Number(reportData.summary.total_orders) || 0]);
    osRow1.getCell(1).font = { name: 'Calibri', size: 10, color: { argb: 'FF334155' } };
    osRow1.getCell(2).font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF1E293B' } };
    osRow1.getCell(2).numFmt = numberFormat;

    const osRow2 = sheet.addRow(['Total Order Amount', Number(reportData.summary.gross_sales) || 0]);
    osRow2.getCell(1).font = { name: 'Calibri', size: 10, color: { argb: 'FF334155' } };
    osRow2.getCell(2).font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF1E40AF' } };
    osRow2.getCell(2).numFmt = currencyFormat;

    const osRow3 = sheet.addRow(['Total Products Ordered (Quantity)', Number(reportData.summary.ordered_quantity) || 0]);
    osRow3.getCell(1).font = { name: 'Calibri', size: 10, color: { argb: 'FF334155' } };
    osRow3.getCell(2).font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF1E293B' } };
    osRow3.getCell(2).numFmt = numberFormat;

    [osRow1, osRow2, osRow3].forEach(r => {
      r.height = 20;
      r.getCell(1).border = {
        left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } }
      };
      r.getCell(2).border = {
        right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } }
      };
    });

    sheet.addRow([]); // Blank spacer

    // ==========================================
    // SECTION 3: Returns Summary
    // - Total Returns
    // - Total Refunded Amount
    // - Total Returned Quantity
    // ==========================================
    const rsHeaderRow = sheet.addRow(['3. RETURNS SUMMARY']);
    rsHeaderRow.height = 22;
    rsHeaderRow.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FF991B1B' } };
    rsHeaderRow.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEE2E2' } };

    const rsRow1 = sheet.addRow(['Total Returns', Number(reportData.returns.length) || 0]);
    rsRow1.getCell(1).font = { name: 'Calibri', size: 10, color: { argb: 'FF334155' } };
    rsRow1.getCell(2).font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF1E293B' } };
    rsRow1.getCell(2).numFmt = numberFormat;

    const rsRow2 = sheet.addRow(['Total Refunded Amount', Number(reportData.summary.total_returns) || 0]);
    rsRow2.getCell(1).font = { name: 'Calibri', size: 10, color: { argb: 'FF334155' } };
    rsRow2.getCell(2).font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FFDC2626' } };
    rsRow2.getCell(2).numFmt = currencyFormat;

    const rsRow3 = sheet.addRow(['Total Returned Quantity', Number(reportData.summary.returned_quantity) || 0]);
    rsRow3.getCell(1).font = { name: 'Calibri', size: 10, color: { argb: 'FF334155' } };
    rsRow3.getCell(2).font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF1E293B' } };
    rsRow3.getCell(2).numFmt = numberFormat;

    [rsRow1, rsRow2, rsRow3].forEach(r => {
      r.height = 20;
      r.getCell(1).border = {
        left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } }
      };
      r.getCell(2).border = {
        right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } }
      };
    });

    sheet.addRow([]); // Blank spacer

    // ==========================================
    // SECTION 4: Order Details
    // Columns: Order ID | Order Date | Staff Name | Product | Quantity | Payment Method | Unit Price | Order Amount | Order Status
    // ==========================================
    const odHeaderRow = sheet.addRow(['4. ORDER DETAILS']);
    odHeaderRow.height = 22;
    odHeaderRow.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
    odHeaderRow.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E40AF' } };

    const orderTableHeaders = [
      'Order ID',
      'Order Date',
      'Staff Name',
      'Product',
      'Quantity',
      'Payment Method',
      'Unit Price',
      'Order Amount',
      'Order Status'
    ];
    const orderTh = sheet.addRow(orderTableHeaders);
    applyHeaderStyle(orderTh, '2563EB');
    orderTh.height = 24;

    if (reportData.orders.length === 0) {
      const emptyOrderRow = sheet.addRow(['No orders recorded matching the selected filters.']);
      emptyOrderRow.height = 22;
      emptyOrderRow.getCell(1).font = { name: 'Calibri', size: 10, italic: true, color: { argb: 'FF64748B' } };
    } else {
      reportData.orders.forEach((o, idx) => {
        const row = sheet.addRow([
          o.order_number,
          o.order_date,
          o.staff_name,
          o.product_name,
          Number(o.quantity) || 0,
          o.payment_method,
          Number(o.unit_price) || 0,
          Number(o.order_amount) || 0,
          o.status
        ]);
        row.height = 20;
        const isAlt = idx % 2 === 1;
        const bg = isAlt ? 'FFF8FAFC' : 'FFFFFFFF';
        row.eachCell((cell, colNum) => {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
          cell.border = {
            top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
            bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
            left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
            right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
          };
          if ([7, 8].includes(colNum)) {
            cell.numFmt = currencyFormat;
            cell.alignment = { horizontal: 'right', vertical: 'middle' };
          } else if (colNum === 5) {
            cell.numFmt = numberFormat;
            cell.alignment = { horizontal: 'center', vertical: 'middle' };
          } else if ([1, 2, 6, 9].includes(colNum)) {
            cell.alignment = { horizontal: 'center', vertical: 'middle' };
          } else {
            cell.alignment = { horizontal: 'left', vertical: 'middle' };
          }
        });
      });

      // Total Row for Order Details
      const odTotalRow = sheet.addRow([
        'TOTAL',
        '',
        `Orders: ${reportData.orders.length}`,
        '',
        Number(reportData.summary.ordered_quantity) || 0,
        '',
        '',
        Number(reportData.summary.gross_sales) || 0,
        ''
      ]);
      odTotalRow.height = 22;
      odTotalRow.eachCell((cell, colNum) => {
        cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF1E40AF' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDBEAFE' } };
        cell.border = {
          top: { style: 'thin', color: { argb: 'FF93C5FD' } },
          bottom: { style: 'double', color: { argb: 'FF1E40AF' } }
        };
        if (colNum === 8) {
          cell.numFmt = currencyFormat;
          cell.alignment = { horizontal: 'right', vertical: 'middle' };
        } else if (colNum === 5) {
          cell.numFmt = numberFormat;
          cell.alignment = { horizontal: 'center', vertical: 'middle' };
        }
      });
    }

    sheet.addRow([]); // Blank spacer

    // ==========================================
    // SECTION 5: Return Details
    // Columns: Return ID | Return Date | Returned By | Product | Returned Quantity | Refund Amount
    // ==========================================
    const rdHeaderRow = sheet.addRow(['5. RETURN DETAILS']);
    rdHeaderRow.height = 22;
    rdHeaderRow.font = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
    rdHeaderRow.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFB91C1C' } };

    const returnTableHeaders = [
      'Return ID',
      'Return Date',
      'Returned By',
      'Product',
      'Returned Quantity',
      'Refund Amount'
    ];
    const returnTh = sheet.addRow(returnTableHeaders);
    applyHeaderStyle(returnTh, 'DC2626');
    returnTh.height = 24;

    if (reportData.returns.length === 0) {
      const emptyReturnRow = sheet.addRow(['No returns recorded matching the selected filters.']);
      emptyReturnRow.height = 22;
      emptyReturnRow.getCell(1).font = { name: 'Calibri', size: 10, italic: true, color: { argb: 'FF64748B' } };
    } else {
      reportData.returns.forEach((r, idx) => {
        const row = sheet.addRow([
          r.return_number,
          r.return_date,
          r.returned_by_name || r.staff_name,
          r.product_name,
          Number(r.return_quantity) || 0,
          Number(r.return_amount) || 0
        ]);
        row.height = 20;
        const isAlt = idx % 2 === 1;
        const bg = isAlt ? 'FFFEF2F2' : 'FFFFFFFF';
        row.eachCell((cell, colNum) => {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: bg } };
          cell.border = {
            top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
            bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
            left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
            right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
          };
          if (colNum === 6) {
            cell.numFmt = currencyFormat;
            cell.alignment = { horizontal: 'right', vertical: 'middle' };
          } else if (colNum === 5) {
            cell.numFmt = numberFormat;
            cell.alignment = { horizontal: 'center', vertical: 'middle' };
          } else if ([1, 2].includes(colNum)) {
            cell.alignment = { horizontal: 'center', vertical: 'middle' };
          } else {
            cell.alignment = { horizontal: 'left', vertical: 'middle' };
          }
        });
      });

      // Total Row for Return Details
      const rdTotalRow = sheet.addRow([
        'TOTAL',
        '',
        `Returns: ${reportData.returns.length}`,
        '',
        Number(reportData.summary.returned_quantity) || 0,
        Number(reportData.summary.total_returns) || 0
      ]);
      rdTotalRow.height = 22;
      rdTotalRow.eachCell((cell, colNum) => {
        cell.font = { name: 'Calibri', size: 10, bold: true, color: { argb: 'FF991B1B' } };
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEE2E2' } };
        cell.border = {
          top: { style: 'thin', color: { argb: 'FFFCA5A5' } },
          bottom: { style: 'double', color: { argb: 'FF991B1B' } }
        };
        if (colNum === 6) {
          cell.numFmt = currencyFormat;
          cell.alignment = { horizontal: 'right', vertical: 'middle' };
        } else if (colNum === 5) {
          cell.numFmt = numberFormat;
          cell.alignment = { horizontal: 'center', vertical: 'middle' };
        }
      });
    }

    // Determine filename:
    // Case 1: Specific Sales Staff selected -> Sales_Report_StaffName.xlsx
    // Case 2: No Sales Staff selected -> Overall_Sales_Report.xlsx
    let filename = 'Overall_Sales_Report.xlsx';
    if (selectedStaff && selectedStaff.name) {
      const sanitizedStaffName = selectedStaff.name.trim().replace(/[^a-zA-Z0-9_-]/g, '_');
      filename = `Sales_Report_${sanitizedStaffName}.xlsx`;
    }

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition');

    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error('Failed to export Excel report:', err);
    res.status(500).json({ error: 'Failed to export Excel report: ' + err.message });
  }
}

router.get('/sales/export-excel', handleExportSalesReportExcel);
router.get('/sales/staff/:staffId/export-excel', handleExportSalesReportExcel);

export default router;
