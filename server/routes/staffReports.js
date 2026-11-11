// server/routes/staffReports.js
import express from 'express';
import ExcelJS from 'exceljs';
import { query, get } from '../db.js';
import { authenticate, requireRole } from '../auth.js';

const router = express.Router();

// Require sales_staff authentication for all staff routes
router.use(authenticate, requireRole('sales_staff'));

/**
 * 1. GET /api/staff/dashboard
 * Staff home dashboard:
 * - Profile info (Name, Employee ID)
 * - Available reporting months where this employee has records
 * - Summary for current/latest month
 */
router.get('/dashboard', (req, res) => {
  try {
    const employeeId = req.user.staff_id;

    // Fetch all months where this employee has reports
    const availableMonths = query(`
      SELECT
        esr.id,
        esr.report_month,
        mr.month_name,
        esr.record_count,
        mr.created_at as imported_at
      FROM employee_sales_reports esr
      JOIN monthly_reports mr ON esr.monthly_report_id = mr.id
      WHERE esr.employee_id = ?
      ORDER BY esr.report_month DESC
    `, [employeeId]);

    const latestMonth = availableMonths[0] || null;

    res.json({
      profile: {
        employeeId: req.user.staff_id,
        name: req.user.name,
        username: req.user.username
      },
      availableMonths,
      latestMonth: latestMonth ? {
        reportMonth: latestMonth.report_month,
        monthName: latestMonth.month_name,
        recordCount: latestMonth.record_count,
        importedAt: latestMonth.imported_at
      } : null
    });
  } catch (err) {
    console.error('Staff dashboard error:', err);
    res.status(500).json({ error: 'Failed to load staff dashboard: ' + err.message });
  }
});

/**
 * 2. GET /api/staff/my-report
 * Returns the authenticated employee's sales report for a given month
 * STRICT PRIVACY: Bound strictly to req.user.staff_id on the backend!
 */
router.get('/my-report', (req, res) => {
  try {
    const employeeId = req.user.staff_id;
    let { month } = req.query;

    // If no month specified, default to the latest available month for this employee
    if (!month) {
      const latestMonthRow = get(`
        SELECT report_month
        FROM employee_sales_reports
        WHERE employee_id = ?
        ORDER BY report_month DESC
        LIMIT 1
      `, [employeeId]);
      month = latestMonthRow?.report_month;
    }

    if (!month) {
      return res.json({
        employeeId,
        employeeName: req.user.name,
        month: null,
        monthName: null,
        availableMonths: [],
        columns: [],
        rows: []
      });
    }

    // Available months list for month selector
    const availableMonths = query(`
      SELECT esr.report_month, mr.month_name, esr.record_count
      FROM employee_sales_reports esr
      JOIN monthly_reports mr ON esr.monthly_report_id = mr.id
      WHERE esr.employee_id = ?
      ORDER BY esr.report_month DESC
    `, [employeeId]);

    // Strictly fetch report for authenticated employee_id
    const empReport = get(`
      SELECT esr.*, mr.month_name, mr.filename
      FROM employee_sales_reports esr
      JOIN monthly_reports mr ON esr.monthly_report_id = mr.id
      WHERE esr.report_month = ? AND esr.employee_id = ?
    `, [month, employeeId]);

    if (!empReport) {
      return res.status(404).json({
        error: `No sales report records found for your Employee ID (${employeeId}) in ${month}.`,
        availableMonths
      });
    }

    const columns = empReport.columns_json ? JSON.parse(empReport.columns_json) : [];

    const rawRecords = query(`
      SELECT id, record_date, row_index, data_json
      FROM sales_records
      WHERE employee_sales_report_id = ? AND employee_id = ?
      ORDER BY record_date ASC, row_index ASC, id ASC
    `, [empReport.id, employeeId]);

    const rows = rawRecords.map(r => ({
      id: r.id,
      recordDate: r.record_date,
      data: r.data_json ? JSON.parse(r.data_json) : {}
    }));

    res.json({
      employeeId: empReport.employee_id,
      employeeName: empReport.employee_name,
      month: empReport.report_month,
      monthName: empReport.month_name,
      filename: empReport.filename,
      recordCount: empReport.record_count,
      availableMonths,
      columns,
      rows
    });
  } catch (err) {
    console.error('Staff my-report error:', err);
    res.status(500).json({ error: 'Failed to load your sales report: ' + err.message });
  }
});

/**
 * 3. GET /api/staff/my-report/export-excel
 * Downloads the authenticated employee's sales report as an Excel spreadsheet
 */
router.get('/my-report/export-excel', async (req, res) => {
  try {
    const employeeId = req.user.staff_id;
    let { month } = req.query;

    if (!month) {
      const latestMonthRow = get(`
        SELECT report_month
        FROM employee_sales_reports
        WHERE employee_id = ?
        ORDER BY report_month DESC
        LIMIT 1
      `, [employeeId]);
      month = latestMonthRow?.report_month;
    }

    if (!month) {
      return res.status(400).json({ error: 'No report month available to export.' });
    }

    const empReport = get(`
      SELECT esr.*, mr.month_name
      FROM employee_sales_reports esr
      JOIN monthly_reports mr ON esr.monthly_report_id = mr.id
      WHERE esr.report_month = ? AND esr.employee_id = ?
    `, [month, employeeId]);

    if (!empReport) {
      return res.status(404).json({ error: 'No report records found for export.' });
    }

    const columns = empReport.columns_json ? JSON.parse(empReport.columns_json) : [];
    const rawRecords = query(`
      SELECT data_json FROM sales_records
      WHERE employee_sales_report_id = ? AND employee_id = ?
      ORDER BY record_date ASC, row_index ASC, id ASC
    `, [empReport.id, employeeId]);

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Employee Sales Report System';
    workbook.created = new Date();

    const sheetName = `${empReport.employee_id}_${month}`.slice(0, 31);
    const sheet = workbook.addWorksheet(sheetName);

    // Title Row
    sheet.mergeCells(1, 1, 1, Math.max(columns.length, 4));
    const titleCell = sheet.getCell('A1');
    titleCell.value = `${empReport.employee_name} (${empReport.employee_id}) - ${empReport.month_name} Sales Report`;
    titleCell.font = { name: 'Segoe UI', size: 13, bold: true, color: { argb: 'FF1E293B' } };
    titleCell.alignment = { vertical: 'middle', horizontal: 'left' };
    sheet.getRow(1).height = 30;

    // Header Row at Row 3
    const headerRow = sheet.getRow(3);
    headerRow.height = 26;
    columns.forEach((col, idx) => {
      const cell = headerRow.getCell(idx + 1);
      cell.value = col.label;
      cell.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
      cell.alignment = { vertical: 'middle', horizontal: col.type === 'number' || col.type === 'currency' ? 'right' : 'left' };
    });

    // Populate Data Rows
    let curRowIdx = 4;
    const totals = {};

    for (const rec of rawRecords) {
      const data = rec.data_json ? JSON.parse(rec.data_json) : {};
      const row = sheet.getRow(curRowIdx);
      row.height = 20;

      columns.forEach((col, idx) => {
        const cell = row.getCell(idx + 1);
        const val = data[col.label];
        cell.value = val !== undefined && val !== null ? val : '';
        cell.font = { name: 'Segoe UI', size: 9.5 };

        if (col.type === 'number' || col.type === 'currency') {
          cell.alignment = { vertical: 'middle', horizontal: 'right' };
          const num = typeof val === 'number' ? val : parseFloat(val);
          if (!isNaN(num)) {
            totals[col.label] = (totals[col.label] || 0) + num;
          }
        } else {
          cell.alignment = { vertical: 'middle', horizontal: 'left' };
        }
      });
      curRowIdx++;
    }

    // Totals Row
    const totalRow = sheet.getRow(curRowIdx);
    totalRow.height = 24;
    columns.forEach((col, idx) => {
      const cell = totalRow.getCell(idx + 1);
      if (idx === 0) {
        cell.value = 'Total';
      } else if (col.type === 'number' || col.type === 'currency') {
        cell.value = totals[col.label] || 0;
      } else {
        cell.value = '';
      }
      cell.font = { name: 'Segoe UI', size: 10, bold: true };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
      cell.alignment = { vertical: 'middle', horizontal: col.type === 'number' || col.type === 'currency' ? 'right' : 'left' };
    });

    // Auto fit column widths
    columns.forEach((col, idx) => {
      sheet.getColumn(idx + 1).width = Math.max((col.label || '').length + 4, 14);
    });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="My_Sales_Report_${month}.xlsx"`);

    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error('Staff export error:', err);
    res.status(500).json({ error: 'Failed to export sales report: ' + err.message });
  }
});

export default router;
