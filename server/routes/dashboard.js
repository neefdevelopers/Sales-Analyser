// server/routes/dashboard.js
import { Router } from 'express';
import { query, get } from '../db.js';
import { authenticate, requireRole } from '../auth.js';
import { getNowInBusinessTimezone } from '../timezone.js';

const router = Router();

// Helper to resolve start & end dates from filter
function resolveDateRange(filter, customStart, customEnd) {
  const nowInfo = getNowInBusinessTimezone();
  const todayStr = nowInfo.dateStr;

  if (filter === 'today') {
    return { startDate: todayStr, endDate: todayStr };
  }

  if (filter === 'yesterday') {
    const d = new Date(Date.UTC(nowInfo.year, nowInfo.month - 1, nowInfo.day));
    d.setUTCDate(d.getUTCDate() - 1);
    const yStr = d.toISOString().split('T')[0];
    return { startDate: yStr, endDate: yStr };
  }

  if (filter === 'this_week') {
    const d = new Date(Date.UTC(nowInfo.year, nowInfo.month - 1, nowInfo.day));
    // Day 0 is Sunday, day 1 is Monday
    const dayOfWeek = d.getUTCDay();
    const diff = d.getUTCDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1);
    const monday = new Date(d.setUTCDate(diff)).toISOString().split('T')[0];
    return { startDate: monday, endDate: todayStr };
  }

  if (filter === 'this_month') {
    const mStr = String(nowInfo.month).padStart(2, '0');
    const startOfMonth = `${nowInfo.year}-${mStr}-01`;
    return { startDate: startOfMonth, endDate: todayStr };
  }

  if (filter === 'custom' && customStart && customEnd) {
    return { startDate: customStart, endDate: customEnd };
  }

  // Default to this month
  const mStr = String(nowInfo.month).padStart(2, '0');
  return { startDate: `${nowInfo.year}-${mStr}-01`, endDate: todayStr };
}

// GET Sales Staff Personal Dashboard
router.get('/staff', authenticate, (req, res) => {
  const staffId = req.user.id;
  const { filter = 'this_month', startDate: customStart, endDate: customEnd } = req.query;
  const { startDate, endDate } = resolveDateRange(filter, customStart, customEnd);

  const todayStr = getNowInBusinessTimezone().dateStr;

  // 1. Orders & Sales KPI
  const orderKpi = get(`
    SELECT
      COUNT(o.id) AS total_orders,
      COALESCE(SUM(o.quantity), 0) AS total_quantity_sold,
      COALESCE(SUM(o.total_amount), 0) AS gross_sales,
      COALESCE(SUM(o.incentive_amount), 0) AS gross_incentive,
      COUNT(DISTINCT c.phone) AS total_customers
    FROM orders o
    JOIN customers c ON o.customer_id = c.id
    WHERE o.staff_id = ? AND o.order_date >= ? AND o.order_date <= ?
  `, [staffId, startDate, endDate]);

  // 2. Returns KPI
  const returnKpi = get(`
    SELECT
      COUNT(r.id) AS total_return_orders,
      COALESCE(SUM(r.return_quantity), 0) AS total_returned_quantity,
      COALESCE(SUM(r.return_amount), 0) AS total_returned_amount,
      COALESCE(SUM(r.reversed_incentive), 0) AS total_reversed_incentive
    FROM returns r
    WHERE r.staff_id = ? AND r.return_date >= ? AND r.return_date <= ?
  `, [staffId, startDate, endDate]);

  // 3. Daily Activities KPI (Total Calls & Enquiries counts)
  const actKpi = get(`
    SELECT
      COALESCE(SUM(total_calls), 0) AS total_calls,
      COALESCE(SUM(connected_calls), 0) AS connected_calls,
      COALESCE(SUM(total_enquiries), 0) AS total_enquiries
    FROM daily_activities
    WHERE staff_id = ? AND activity_date >= ? AND activity_date <= ?
  `, [staffId, startDate, endDate]);

  // 4. Today's Activity Summary
  const todaySummary = get(`
    SELECT
      (SELECT COALESCE(total_calls, 0) FROM daily_activities WHERE staff_id = ? AND activity_date = ?) AS calls_today,
      (SELECT COALESCE(total_enquiries, 0) FROM daily_activities WHERE staff_id = ? AND activity_date = ?) AS enquiries_today,
      (SELECT COUNT(*) FROM orders WHERE staff_id = ? AND order_date = ?) AS orders_today,
      (SELECT COALESCE(SUM(total_amount), 0) FROM orders WHERE staff_id = ? AND order_date = ?) AS sales_today
  `, [staffId, todayStr, staffId, todayStr, staffId, todayStr, staffId, todayStr]);

  // Net calculations
  const grossSales = orderKpi?.gross_sales || 0;
  const returnedAmount = returnKpi?.total_returned_amount || 0;
  const netSales = Math.max(0, Math.round((grossSales - returnedAmount) * 100) / 100);

  const grossQty = orderKpi?.total_quantity_sold || 0;
  const returnedQty = returnKpi?.total_returned_quantity || 0;
  const netQty = Math.max(0, grossQty - returnedQty);

  const grossIncentive = orderKpi?.gross_incentive || 0;
  const reversedIncentive = returnKpi?.total_reversed_incentive || 0;
  const netIncentive = Math.max(0, Math.round((grossIncentive - reversedIncentive) * 100) / 100);

  // 5. Chart: Daily orders & sales
  const dailyOrders = query(`
    SELECT
      o.order_date AS date,
      COUNT(o.id) AS order_count,
      SUM(o.total_amount) AS gross_sales,
      COALESCE((SELECT SUM(r.return_amount) FROM returns r WHERE r.staff_id = o.staff_id AND r.return_date = o.order_date), 0) AS return_amount
    FROM orders o
    WHERE o.staff_id = ? AND o.order_date >= ? AND o.order_date <= ?
    GROUP BY o.order_date
    ORDER BY o.order_date ASC
  `, [staffId, startDate, endDate]).map(row => ({
    ...row,
    net_sales: Math.max(0, Math.round((row.gross_sales - row.return_amount) * 100) / 100)
  }));

  // 6. Chart: Orders by Product
  const ordersByProduct = query(`
    SELECT
      p.name AS product_name,
      p.code AS product_code,
      COUNT(o.id) AS order_count,
      SUM(o.quantity) AS total_quantity,
      SUM(o.total_amount) AS total_sales
    FROM orders o
    JOIN products p ON o.product_id = p.id
    WHERE o.staff_id = ? AND o.order_date >= ? AND o.order_date <= ?
    GROUP BY p.id
    ORDER BY total_quantity DESC
  `, [staffId, startDate, endDate]);

  // 7. Chart: Calls & Enquiries over time from daily_activities
  const activityOverTime = query(`
    SELECT
      activity_date AS date,
      total_calls AS calls,
      total_enquiries AS enquiries,
      connected_calls
    FROM daily_activities
    WHERE staff_id = ? AND activity_date >= ? AND activity_date <= ?
    ORDER BY activity_date ASC
  `, [staffId, startDate, endDate]);

  // 9. Chart: Order status distribution
  const orderStatusDist = query(`
    SELECT status, COUNT(*) AS count
    FROM orders
    WHERE staff_id = ? AND order_date >= ? AND order_date <= ?
    GROUP BY status
  `, [staffId, startDate, endDate]);

  // 10. Chart: Returns over time
  const returnsOverTime = query(`
    SELECT
      return_date AS date,
      COUNT(*) AS count,
      SUM(return_quantity) AS returned_quantity,
      SUM(return_amount) AS returned_amount
    FROM returns
    WHERE staff_id = ? AND return_date >= ? AND return_date <= ?
    GROUP BY return_date
    ORDER BY return_date ASC
  `, [staffId, startDate, endDate]);

  res.json({
    dateRange: { filter, startDate, endDate },
    kpis: {
      totalOrders: orderKpi?.total_orders || 0,
      totalReturnedOrders: returnKpi?.total_return_orders || 0,
      totalEnquiries: actKpi?.total_enquiries || 0,
      totalCalls: actKpi?.total_calls || 0,
      connectedCalls: actKpi?.connected_calls || 0,
      totalCustomers: orderKpi?.total_customers || 0,
      grossQuantitySold: grossQty,
      netQuantitySold: netQty,
      grossSales: Math.round(grossSales * 100) / 100,
      netSales,
      grossIncentive: Math.round(grossIncentive * 100) / 100,
      reversedIncentive: Math.round(reversedIncentive * 100) / 100,
      netIncentive,
      todaySummary: {
        calls: todaySummary?.calls_today || 0,
        enquiries: todaySummary?.enquiries_today || 0,
        orders: todaySummary?.orders_today || 0,
        sales: todaySummary?.sales_today || 0
      }
    },
    charts: {
      dailyOrders,
      ordersByProduct,
      activityOverTime,
      orderStatusDist,
      returnsOverTime
    }
  });
});

// GET Brand Manager Consolidated Dashboard
router.get('/manager', authenticate, requireRole('brand_manager'), (req, res) => {
  const { filter = 'this_month', staffId, startDate: customStart, endDate: customEnd } = req.query;
  const { startDate, endDate } = resolveDateRange(filter, customStart, customEnd);

  const todayStr = getNowInBusinessTimezone().dateStr;

  let staffConditionOrders = '';
  let staffConditionReturns = '';
  let staffConditionAct = '';
  let paramsOrders = [startDate, endDate];
  let paramsReturns = [startDate, endDate];
  let paramsAct = [startDate, endDate];

  if (staffId && staffId !== 'all') {
    const sId = parseInt(staffId, 10);
    staffConditionOrders = ' AND o.staff_id = ?';
    paramsOrders.push(sId);
    staffConditionReturns = ' AND r.staff_id = ?';
    paramsReturns.push(sId);
    staffConditionAct = ' AND da.staff_id = ?';
    paramsAct.push(sId);
  }

  // 1. Orders KPI
  const orderKpi = get(`
    SELECT
      COUNT(o.id) AS total_orders,
      COALESCE(SUM(o.quantity), 0) AS total_quantity,
      COALESCE(SUM(o.total_amount), 0) AS gross_sales,
      COALESCE(SUM(o.incentive_amount), 0) AS gross_incentive,
      COUNT(DISTINCT c.phone) AS total_customers
    FROM orders o
    JOIN customers c ON o.customer_id = c.id
    WHERE o.order_date >= ? AND o.order_date <= ? ${staffConditionOrders}
  `, paramsOrders);

  // 2. Returns KPI
  const returnKpi = get(`
    SELECT
      COUNT(r.id) AS total_returns,
      COALESCE(SUM(r.return_quantity), 0) AS total_returned_quantity,
      COALESCE(SUM(r.return_amount), 0) AS total_returned_amount,
      COALESCE(SUM(r.reversed_incentive), 0) AS total_reversed_incentive
    FROM returns r
    WHERE r.return_date >= ? AND r.return_date <= ? ${staffConditionReturns}
  `, paramsReturns);

  // 3. Daily Activities KPI (Total Calls & Enquiries counts)
  const actKpi = get(`
    SELECT
      COALESCE(SUM(da.total_calls), 0) AS total_calls,
      COALESCE(SUM(da.connected_calls), 0) AS connected_calls,
      COALESCE(SUM(da.total_enquiries), 0) AS total_enquiries
    FROM daily_activities da
    WHERE da.activity_date >= ? AND da.activity_date <= ? ${staffConditionAct}
  `, paramsAct);

  const grossSales = orderKpi?.gross_sales || 0;
  const returnAmount = returnKpi?.total_returned_amount || 0;
  const netSales = Math.max(0, Math.round((grossSales - returnAmount) * 100) / 100);

  const grossQty = orderKpi?.total_quantity || 0;
  const returnedQty = returnKpi?.total_returned_quantity || 0;
  const netQty = Math.max(0, grossQty - returnedQty);

  const grossIncentive = orderKpi?.gross_incentive || 0;
  const reversedIncentive = returnKpi?.total_reversed_incentive || 0;
  const totalIncentives = Math.max(0, Math.round((grossIncentive - reversedIncentive) * 100) / 100);

  const totalCalls = actKpi?.total_calls || 0;
  const connectedCalls = actKpi?.connected_calls || 0;
  const connectedPercentage = totalCalls > 0 ? Math.round((connectedCalls / totalCalls) * 1000) / 10 : 0;

  const totalEnquiries = actKpi?.total_enquiries || 0;
  const conversionPercentage = totalEnquiries > 0 && orderKpi?.total_orders ? Math.round((orderKpi.total_orders / totalEnquiries) * 1000) / 10 : 0;

  // 5. Top-performing staff
  const topStaff = query(`
    SELECT
      u.id,
      u.staff_id,
      u.name,
      COUNT(DISTINCT o.id) AS orders_count,
      COALESCE(SUM(o.total_amount), 0) AS gross_sales,
      COALESCE((SELECT SUM(r.return_amount) FROM returns r WHERE r.staff_id = u.id AND r.return_date >= ? AND r.return_date <= ?), 0) AS return_amount,
      COALESCE(SUM(o.incentive_amount), 0) - COALESCE((SELECT SUM(r.reversed_incentive) FROM returns r WHERE r.staff_id = u.id AND r.return_date >= ? AND r.return_date <= ?), 0) AS net_incentive
    FROM users u
    LEFT JOIN orders o ON u.id = o.staff_id AND o.order_date >= ? AND o.order_date <= ?
    WHERE u.role = 'sales_staff' AND u.status = 'active'
    GROUP BY u.id
    ORDER BY (gross_sales - return_amount) DESC
  `, [startDate, endDate, startDate, endDate, startDate, endDate]).map(s => ({
    ...s,
    net_sales: Math.max(0, Math.round((s.gross_sales - s.return_amount) * 100) / 100),
    net_incentive: Math.max(0, Math.round(s.net_incentive * 100) / 100)
  }));

  // 6. Top-selling products
  const topProducts = query(`
    SELECT
      p.id,
      p.name,
      p.code,
      p.price,
      COUNT(DISTINCT o.id) AS orders_count,
      COALESCE(SUM(o.quantity), 0) AS gross_quantity,
      COALESCE((SELECT SUM(r.return_quantity) FROM returns r JOIN orders o2 ON r.order_id = o2.id WHERE o2.product_id = p.id AND r.return_date >= ? AND r.return_date <= ?), 0) AS returned_quantity,
      COALESCE(SUM(o.total_amount), 0) AS gross_sales
    FROM products p
    LEFT JOIN orders o ON p.id = o.product_id AND o.order_date >= ? AND o.order_date <= ?
    GROUP BY p.id
    ORDER BY (gross_quantity - returned_quantity) DESC
  `, [startDate, endDate, startDate, endDate]).map(p => ({
    ...p,
    net_quantity: Math.max(0, p.gross_quantity - p.returned_quantity)
  }));

  // 7. Staff Activity Status & Pending Daily Entries (Today)
  const staffActivity = query(`
    SELECT
      u.id,
      u.staff_id,
      u.name,
      (SELECT COALESCE(total_calls, 0) FROM daily_activities WHERE staff_id = u.id AND activity_date = ?) AS calls_today,
      (SELECT COALESCE(total_enquiries, 0) FROM daily_activities WHERE staff_id = u.id AND activity_date = ?) AS enquiries_today,
      (SELECT COUNT(*) FROM orders WHERE staff_id = u.id AND order_date = ?) AS orders_today
    FROM users u
    WHERE u.role = 'sales_staff' AND u.status = 'active'
    ORDER BY u.name ASC
  `, [todayStr, todayStr, todayStr]).map(s => {
    const isPending = s.calls_today === 0 && s.enquiries_today === 0;
    return {
      ...s,
      is_pending: isPending,
      status: isPending ? 'Pending Entries' : 'Active'
    };
  });

  // 8. Consolidated Daily Trend Chart
  const salesTrend = query(`
    SELECT
      o.order_date AS date,
      COUNT(o.id) AS order_count,
      SUM(o.total_amount) AS gross_sales,
      COALESCE((SELECT SUM(r.return_amount) FROM returns r WHERE r.return_date = o.order_date), 0) AS return_amount
    FROM orders o
    WHERE o.order_date >= ? AND o.order_date <= ? ${staffConditionOrders}
    GROUP BY o.order_date
    ORDER BY o.order_date ASC
  `, paramsOrders).map(row => ({
    ...row,
    net_sales: Math.max(0, Math.round((row.gross_sales - row.return_amount) * 100) / 100)
  }));

  res.json({
    dateRange: { filter, startDate, endDate },
    kpis: {
      totalOrders: orderKpi?.total_orders || 0,
      grossSales: Math.round(grossSales * 100) / 100,
      totalReturns: returnKpi?.total_returns || 0,
      totalReturnedQuantity: returnedQty,
      totalReturnedAmount: returnAmount,
      netSales,
      totalCustomers: orderKpi?.total_customers || 0,
      grossQuantitySold: grossQty,
      netQuantitySold: netQty,
      totalEnquiries,
      totalCalls,
      connectedCallPercentage: connectedPercentage,
      enquiryConversionPercentage: conversionPercentage,
      totalIncentives
    },
    topStaff,
    topProducts,
    staffActivity,
    salesTrend
  });
});

export default router;
