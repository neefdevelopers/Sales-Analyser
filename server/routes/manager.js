// server/routes/manager.js
import express from 'express';
import ExcelJS from 'exceljs';
import bcrypt from 'bcryptjs';
import { getDb, query, get, run, transaction, saveDb } from '../db.js';
import { authenticate, requireRole } from '../auth.js';
import { parseMonthlyExcelWorkbook, formatMonthName } from '../services/excelParser.js';

const router = express.Router();

// Require brand_manager authentication for all manager routes
router.use(authenticate, requireRole('brand_manager'));

/**
 * 1. GET /api/manager/dashboard
 * Simple executive summary:
 * - Total employees found in imported reports
 * - Total sales records imported
 * - Current imported month
 * - Total sales amount if available
 * - Latest Excel import details
 */
router.get('/dashboard', (req, res) => {
  try {
    const totalEmpRow = get(`SELECT COUNT(DISTINCT employee_id) AS cnt FROM employee_sales_reports`);
    const totalRecordsRow = get(`SELECT COUNT(*) AS cnt FROM sales_records`);
    const latestReport = get(`SELECT * FROM monthly_reports ORDER BY report_month DESC, id DESC LIMIT 1`);
    const allMonths = query(`SELECT id, report_month, month_name, total_records, total_employees, total_sales_amount, filename, created_at FROM monthly_reports ORDER BY report_month DESC`);

    const totalEmployees = totalEmpRow?.cnt || 0;
    const totalSalesRecords = totalRecordsRow?.cnt || 0;
    const currentMonth = latestReport?.month_name || 'No reports imported';
    const totalSalesAmount = latestReport?.total_sales_amount || null;

    res.json({
      totalEmployees,
      totalSalesRecords,
      currentMonth,
      currentReportMonth: latestReport?.report_month || null,
      totalSalesAmount,
      latestImport: latestReport ? {
        id: latestReport.id,
        filename: latestReport.filename,
        monthName: latestReport.month_name,
        reportMonth: latestReport.report_month,
        totalRecords: latestReport.total_records,
        totalEmployees: latestReport.total_employees,
        importedAt: latestReport.created_at,
        status: latestReport.import_status
      } : null,
      availableMonths: allMonths
    });
  } catch (err) {
    console.error('Manager dashboard error:', err);
    res.status(500).json({ error: 'Failed to load manager dashboard: ' + err.message });
  }
});

/**
 * 2. POST /api/manager/import/preview
 * Parses uploaded Excel workbook and generates preview
 */
router.post('/import/preview', async (req, res) => {
  try {
    const { fileBase64, filename } = req.body;
    if (!fileBase64) {
      return res.status(400).json({ error: 'No Excel file data provided.' });
    }

    const buffer = Buffer.from(fileBase64, 'base64');
    const knownUsers = query('SELECT id, staff_id, name, username FROM users');

    const preview = await parseMonthlyExcelWorkbook(buffer, filename || 'Monthly_Report.xlsx', knownUsers);

    // Check if report month is already in database
    const existing = get('SELECT id, filename, created_at, total_records, total_employees FROM monthly_reports WHERE report_month = ?', [preview.reportMonth]);

    const isDuplicateMonth = !!existing;
    const duplicateDetails = existing ? {
      filename: existing.filename,
      importedAt: existing.created_at,
      totalRecords: existing.total_records,
      totalEmployees: existing.total_employees
    } : null;

    res.json({
      ...preview,
      isDuplicateMonth,
      duplicateDetails
    });
  } catch (err) {
    console.error('Excel preview error:', err);
    res.status(400).json({ error: 'Failed to parse Excel workbook: ' + err.message });
  }
});

/**
 * 3. POST /api/manager/import/confirm
 * Persists parsed Excel workbook into the database
 */
router.post('/import/confirm', async (req, res) => {
  try {
    const { fileBase64, filename, customMonth } = req.body;
    if (!fileBase64) {
      return res.status(400).json({ error: 'No Excel file provided for confirmation.' });
    }

    const buffer = Buffer.from(fileBase64, 'base64');
    const knownUsers = query('SELECT id, staff_id, name, username FROM users');

    const parsed = await parseMonthlyExcelWorkbook(buffer, filename || 'Monthly_Report.xlsx', knownUsers);

    const reportMonth = customMonth || parsed.reportMonth;
    const monthName = formatMonthName(reportMonth);
    const now = new Date().toISOString();
    const defaultPasswordHash = bcrypt.hashSync('sales123', 10);

    transaction(() => {
      // 1. Delete previous records for this month if re-importing (prevents duplicate data)
      const existingReport = get('SELECT id FROM monthly_reports WHERE report_month = ?', [reportMonth]);
      if (existingReport) {
        run('DELETE FROM sales_records WHERE monthly_report_id = ?', [existingReport.id]);
        run('DELETE FROM employee_sales_reports WHERE monthly_report_id = ?', [existingReport.id]);
        run('DELETE FROM monthly_reports WHERE id = ?', [existingReport.id]);
      }

      // 2. Insert into monthly_reports
      run(`
        INSERT INTO monthly_reports (
          report_month, month_name, filename, file_hash, sheet_names,
          columns_json, total_records, total_employees, total_sales_amount,
          imported_by, import_status, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `, [
        reportMonth,
        monthName,
        filename || parsed.filename,
        parsed.fileHash,
        JSON.stringify(parsed.recognizedSheets),
        JSON.stringify(parsed.allColumns),
        parsed.totalRecords,
        parsed.totalEmployees,
        parsed.totalSalesAmount || 0,
        req.user.id,
        'completed',
        now,
        now
      ]);

      const monthlyReport = get('SELECT id FROM monthly_reports WHERE report_month = ?', [reportMonth]);
      const monthlyReportId = monthlyReport.id;

      // 3. For each employee, insert into employee_sales_reports and sales_records
      for (const emp of parsed.employees) {
        // Auto-provision user account if Employee ID does not exist in users
        const existingUser = get('SELECT id FROM users WHERE staff_id = ?', [emp.employeeId]);
        if (!existingUser) {
          const cleanUsername = (emp.employeeId || emp.employeeName).toLowerCase().replace(/[^a-z0-9]/g, '');
          const username = cleanUsername || `emp${Math.floor(1000 + Math.random() * 9000)}`;
          // Verify unique username
          const usernameTaken = get('SELECT id FROM users WHERE username = ?', [username]);
          const finalUsername = usernameTaken ? `${username}_${Math.floor(10 + Math.random() * 90)}` : username;

          run(`
            INSERT INTO users (staff_id, name, username, password_hash, role, status, created_at, updated_at)
            VALUES (?, ?, ?, ?, 'sales_staff', 'active', ?, ?)
          `, [emp.employeeId, emp.employeeName || emp.employeeId, finalUsername, defaultPasswordHash, now, now]);
        }

        // Insert into employee_sales_reports
        run(`
          INSERT INTO employee_sales_reports (
            monthly_report_id, report_month, employee_id, employee_name,
            record_count, columns_json, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          monthlyReportId,
          reportMonth,
          emp.employeeId,
          emp.employeeName,
          emp.recordCount,
          JSON.stringify(emp.columns),
          now,
          now
        ]);

        const empReport = get('SELECT id FROM employee_sales_reports WHERE monthly_report_id = ? AND employee_id = ?', [monthlyReportId, emp.employeeId]);
        const empReportId = empReport.id;

        // Insert all rows into sales_records
        for (const rec of emp.records) {
          run(`
            INSERT INTO sales_records (
              monthly_report_id, employee_sales_report_id, report_month,
              employee_id, employee_name, record_date, row_index,
              data_json, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          `, [
            monthlyReportId,
            empReportId,
            reportMonth,
            emp.employeeId,
            emp.employeeName,
            rec.recordDate || '',
            rec.rowIndex || 0,
            JSON.stringify(rec.data),
            now
          ]);
        }
      }
    });

    saveDb();

    res.json({
      success: true,
      message: `Successfully imported ${monthName} report with ${parsed.totalRecords} records across ${parsed.totalEmployees} employees.`,
      reportMonth,
      monthName,
      totalRecords: parsed.totalRecords,
      totalEmployees: parsed.totalEmployees
    });
  } catch (err) {
    console.error('Import confirmation error:', err);
    res.status(500).json({ error: 'Failed to confirm and save import: ' + err.message });
  }
});

/**
 * 4. GET /api/manager/reports/months
 * Lists all imported months
 */
router.get('/reports/months', (req, res) => {
  try {
    const months = query(`
      SELECT id, report_month, month_name, filename, total_records, total_employees, total_sales_amount, created_at
      FROM monthly_reports
      ORDER BY report_month DESC
    `);
    res.json({ months });
  } catch (err) {
    res.status(500).json({ error: 'Failed to load report months: ' + err.message });
  }
});

/**
 * 5. GET /api/manager/reports/month/:reportMonth
 * Lists all employees for a given month with their record count and summary
 */
router.get('/reports/month/:reportMonth', (req, res) => {
  try {
    const { reportMonth } = req.params;
    const monthlyReport = get('SELECT * FROM monthly_reports WHERE report_month = ?', [reportMonth]);
    if (!monthlyReport) {
      return res.status(404).json({ error: `No imported report found for month ${reportMonth}` });
    }

    const employees = query(`
      SELECT
        esr.id,
        esr.employee_id,
        esr.employee_name,
        esr.record_count,
        esr.columns_json,
        u.username,
        u.status as user_status
      FROM employee_sales_reports esr
      LEFT JOIN users u ON esr.employee_id = u.staff_id
      WHERE esr.report_month = ?
      ORDER BY esr.employee_name ASC, esr.employee_id ASC
    `, [reportMonth]);

    res.json({
      reportMonth,
      monthName: monthlyReport.month_name,
      filename: monthlyReport.filename,
      totalRecords: monthlyReport.total_records,
      totalEmployees: monthlyReport.total_employees,
      importedAt: monthlyReport.created_at,
      employees: employees.map(e => ({
        ...e,
        columns: e.columns_json ? JSON.parse(e.columns_json) : []
      }))
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to load employee list: ' + err.message });
  }
});

/**
 * 6. GET /api/manager/reports/month/:reportMonth/employee/:employeeId
 * Returns the full sales report for an individual employee
 */
router.get('/reports/month/:reportMonth/employee/:employeeId', (req, res) => {
  try {
    const { reportMonth, employeeId } = req.params;

    const empReport = get(`
      SELECT esr.*, mr.month_name, mr.filename
      FROM employee_sales_reports esr
      JOIN monthly_reports mr ON esr.monthly_report_id = mr.id
      WHERE esr.report_month = ? AND esr.employee_id = ?
    `, [reportMonth, employeeId]);

    if (!empReport) {
      return res.status(404).json({ error: `No sales report found for employee ${employeeId} in ${reportMonth}` });
    }

    const columns = empReport.columns_json ? JSON.parse(empReport.columns_json) : [];

    const rawRecords = query(`
      SELECT id, record_date, row_index, data_json
      FROM sales_records
      WHERE employee_sales_report_id = ?
      ORDER BY record_date ASC, row_index ASC, id ASC
    `, [empReport.id]);

    const rows = rawRecords.map(r => ({
      id: r.id,
      recordDate: r.record_date,
      data: r.data_json ? JSON.parse(r.data_json) : {}
    }));

    res.json({
      employeeId: empReport.employee_id,
      employeeName: empReport.employee_name,
      reportMonth: empReport.report_month,
      monthName: empReport.month_name,
      filename: empReport.filename,
      recordCount: empReport.record_count,
      columns,
      rows
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to load employee sales report: ' + err.message });
  }
});

/**
 * 7. GET /api/manager/reports/month/:reportMonth/employee/:employeeId/export-excel
 * Downloads Excel spreadsheet for an employee's report
 */
router.get('/reports/month/:reportMonth/employee/:employeeId/export-excel', async (req, res) => {
  try {
    const { reportMonth, employeeId } = req.params;

    const empReport = get(`
      SELECT esr.*, mr.month_name
      FROM employee_sales_reports esr
      JOIN monthly_reports mr ON esr.monthly_report_id = mr.id
      WHERE esr.report_month = ? AND esr.employee_id = ?
    `, [reportMonth, employeeId]);

    if (!empReport) {
      return res.status(404).json({ error: 'Employee report not found.' });
    }

    const columns = empReport.columns_json ? JSON.parse(empReport.columns_json) : [];
    const rawRecords = query(`
      SELECT data_json FROM sales_records
      WHERE employee_sales_report_id = ?
      ORDER BY record_date ASC, row_index ASC, id ASC
    `, [empReport.id]);

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Employee Sales Report System';
    workbook.created = new Date();

    const sheetName = (empReport.employee_name || empReport.employee_id).slice(0, 31);
    const sheet = workbook.addWorksheet(sheetName);

    // Style Title Row
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
    res.setHeader('Content-Disposition', `attachment; filename="${empReport.employee_id}_${reportMonth}_Sales_Report.xlsx"`);

    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error('Export error:', err);
    res.status(500).json({ error: 'Failed to export Excel report: ' + err.message });
  }
});

/**
 * 8. GET /api/manager/history
 * Lists all imported monthly reports
 */
router.get('/history', (req, res) => {
  try {
    const history = query(`
      SELECT
        mr.id,
        mr.report_month,
        mr.month_name,
        mr.filename,
        mr.total_records,
        mr.total_employees,
        mr.total_sales_amount,
        mr.import_status,
        mr.created_at,
        u.name as imported_by_name
      FROM monthly_reports mr
      LEFT JOIN users u ON mr.imported_by = u.id
      ORDER BY mr.report_month DESC, mr.id DESC
    `);
    res.json({ history });
  } catch (err) {
    res.status(500).json({ error: 'Failed to load import history: ' + err.message });
  }
});

/**
 * 9. DELETE /api/manager/history/:id
 * Removes an imported monthly report and all its associated employee records
 */
router.delete('/history/:id', (req, res) => {
  try {
    const { id } = req.params;
    const report = get('SELECT id, report_month, month_name FROM monthly_reports WHERE id = ?', [id]);
    if (!report) {
      return res.status(404).json({ error: 'Monthly report not found.' });
    }

    transaction(() => {
      run('DELETE FROM sales_records WHERE monthly_report_id = ?', [id]);
      run('DELETE FROM employee_sales_reports WHERE monthly_report_id = ?', [id]);
      run('DELETE FROM monthly_reports WHERE id = ?', [id]);
    });

    saveDb();

    res.json({
      success: true,
      message: `Successfully deleted sales report for ${report.month_name}.`
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete report: ' + err.message });
  }
});

export default router;
