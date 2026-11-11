// server/services/excelParser.js
import ExcelJS from 'exceljs';
import crypto from 'crypto';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

export function normalizeText(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .trim()
    .toLowerCase()
    .replace(/[\r\n\t_]+/g, ' ')
    .replace(/\s+/g, ' ');
}

export function detectMonthYearFromFilename(filename) {
  if (!filename) return null;
  const name = filename.toUpperCase();
  const months = {
    'JANUARY': '01', 'JAN': '01',
    'FEBRUARY': '02', 'FEB': '02',
    'MARCH': '03', 'MAR': '03',
    'APRIL': '04', 'APR': '04',
    'MAY': '05',
    'JUNE': '06', 'JUN': '06',
    'JULY': '07', 'JUL': '07',
    'AUGUST': '08', 'AUG': '08',
    'SEPTEMBER': '09', 'SEP': '09',
    'OCTOBER': '10', 'OCT': '10',
    'NOVEMBER': '11', 'NOV': '11',
    'DECEMBER': '12', 'DEC': '12'
  };

  for (const [mName, mNum] of Object.entries(months)) {
    const r1 = new RegExp(`(^|[^A-Z0-9])${mName}[-_ ]?(\\d{4})([^A-Z0-9]|$)`, 'i');
    const m1 = name.match(r1);
    if (m1 && m1[2]) return `${m1[2]}-${mNum}`;
    const r2 = new RegExp(`(^|[^A-Z0-9])(\\d{4})[-_ ]?${mName}([^A-Z0-9]|$)`, 'i');
    const m2 = name.match(r2);
    if (m2 && m2[2]) return `${m2[2]}-${mNum}`;
  }

  const ym = name.match(/(^|[^0-9])(20\d{2})[-_](0[1-9]|1[0-2])([^0-9]|$)/);
  if (ym && ym[2] && ym[3]) return `${ym[2]}-${ym[3]}`;

  const my = name.match(/(^|[^0-9])(0[1-9]|1[0-2])[-_](20\d{2})([^0-9]|$)/);
  if (my && my[2] && my[3]) return `${my[3]}-${my[2]}`;

  return null;
}

export function formatMonthName(monthStr) {
  if (!monthStr || !monthStr.includes('-')) return monthStr || '';
  const [y, m] = monthStr.split('-');
  const mIdx = parseInt(m, 10) - 1;
  if (mIdx >= 0 && mIdx < 12) {
    return `${MONTH_NAMES[mIdx]} ${y}`;
  }
  return monthStr;
}

export function getCellValue(cell) {
  if (!cell || cell.value === null || cell.value === undefined) return '';
  const val = cell.value;

  if (val instanceof Date) {
    const y = val.getUTCFullYear();
    const m = String(val.getUTCMonth() + 1).padStart(2, '0');
    const d = String(val.getUTCDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  if (typeof val === 'object') {
    if (val.result !== undefined && val.result !== null) {
      if (val.result instanceof Date) {
        const y = val.result.getUTCFullYear();
        const m = String(val.result.getUTCMonth() + 1).padStart(2, '0');
        const d = String(val.result.getUTCDate()).padStart(2, '0');
        return `${y}-${m}-${d}`;
      }
      return String(val.result).trim();
    }
    if (val.richText && Array.isArray(val.richText)) {
      return val.richText.map(t => t.text).join('').trim();
    }
    if (val.text !== undefined && val.text !== null) {
      return String(val.text).trim();
    }
    return '';
  }

  return String(val).trim();
}

export function parseDateValue(rawVal, fallbackMonthStr = '') {
  if (!rawVal) return '';
  const s = String(rawVal).trim();

  // YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;

  // DD/MM/YYYY or DD-MM-YYYY
  const dmy = s.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})$/);
  if (dmy) {
    const day = String(dmy[1]).padStart(2, '0');
    const month = String(dmy[2]).padStart(2, '0');
    return `${dmy[3]}-${month}-${day}`;
  }

  // Just day number (1-31) when sheet is monthly
  const dayOnly = s.match(/^(\d{1,2})$/);
  if (dayOnly && fallbackMonthStr) {
    const d = parseInt(dayOnly[1], 10);
    if (d >= 1 && d <= 31) {
      return `${fallbackMonthStr}-${String(d).padStart(2, '0')}`;
    }
  }

  // JS Date parse fallback
  const parsed = new Date(s);
  if (!isNaN(parsed.getTime())) {
    const y = parsed.getFullYear();
    const m = String(parsed.getMonth() + 1).padStart(2, '0');
    const d = String(parsed.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  return s;
}

export function isStaffHeaderLabel(str) {
  if (!str) return false;
  const s = normalizeText(str);
  return (
    s === 'employee id' || s === 'staff id' || s === 'emp id' ||
    s === 'employee code' || s === 'staff code' || s === 'emp code' ||
    s === 'empid' || s === 'staffid' || s === 'empcode' || s === 'staffcode' ||
    s === 'employee name' || s === 'staff name' || s === 'emp name' ||
    s === 'employee' || s === 'staff' || s === 'emp' ||
    s === 'sales staff' || s === 'salesperson' || s === 'agent' ||
    s === 'sales staff id' || s === 'sales staff name' ||
    /(?:employee|staff|emp)\s*(?:id|code|no|name)/i.test(s)
  );
}

export function isStaffIdHeader(str) {
  if (!str) return false;
  const s = normalizeText(str);
  return (
    s === 'employee id' || s === 'staff id' || s === 'emp id' ||
    s === 'employee code' || s === 'staff code' || s === 'emp code' ||
    s === 'empid' || s === 'staffid' || s === 'empcode' || s === 'staffcode' ||
    /(?:employee|staff|emp)\s*(?:id|code|no)/i.test(s)
  );
}

export function isStaffNameHeader(str) {
  if (!str) return false;
  const s = normalizeText(str);
  return (
    s === 'employee name' || s === 'staff name' || s === 'emp name' ||
    s === 'employee' || s === 'staff' ||
    /(?:employee|staff|emp)\s*name/i.test(s)
  );
}

export function isDateHeader(str) {
  if (!str) return false;
  const s = normalizeText(str);
  return s === 'date' || s === 'order date' || s === 'day' || s === 'dt' || s === 'sales date' || s === 'reporting date';
}

export function isSummarySheet(sheet) {
  // If the sheet has actual row-level data with DATE and EMPLOYEE ID columns, it is NOT a summary to skip!
  for (let r = 1; r <= Math.min(sheet.rowCount || 10, 10); r++) {
    const row = sheet.getRow(r);
    let hasDate = false;
    let hasStaff = false;
    row.eachCell(cell => {
      const val = normalizeText(getCellValue(cell));
      if (isDateHeader(val)) hasDate = true;
      if (isStaffHeaderLabel(val)) hasStaff = true;
    });
    if (hasDate && hasStaff) {
      return false;
    }
  }

  const nameNorm = normalizeText(sheet.name);
  const summaryKeywords = [
    'summary', 'total', 'consolidated', 'overall',
    'dashboard', 'master summary', 'monthly summary'
  ];
  if (summaryKeywords.some(kw => nameNorm.includes(kw))) {
    return true;
  }

  for (let r = 1; r <= Math.min(sheet.rowCount || 5, 5); r++) {
    const row = sheet.getRow(r);
    let rowText = '';
    row.eachCell(cell => { rowText += ' ' + getCellValue(cell); });
    const rowNorm = normalizeText(rowText);
    if (rowNorm.includes('consolidated') || rowNorm.includes('monthly summary') || rowNorm.includes('all staff incentive')) {
      return true;
    }
  }

  return false;
}

/**
 * Extracts sheet-level Employee ID & Name from top metadata rows or sheet name
 */
export function extractSheetEmployeeInfo(sheet, knownUsers = []) {
  let employeeId = '';
  let employeeName = '';
  let foundIn = '';

  const sheetNorm = normalizeText(sheet.name);

  // 1. Direct match with sheet name against known users
  const byUser = knownUsers.find(u =>
    normalizeText(u.staff_id) === sheetNorm ||
    normalizeText(u.name) === sheetNorm ||
    normalizeText(u.username) === sheetNorm
  );
  if (byUser) {
    return {
      employeeId: byUser.staff_id,
      employeeName: byUser.name,
      foundIn: `Sheet name (${sheet.name})`
    };
  }

  // 2. Pattern in sheet name: e.g. "AS100", "THAHEEL", "AS100_THAHEEL"
  const codeInSheet = sheet.name.match(/\b([A-Z]{1,5}[-_ ]?\d{2,5})\b/i);
  if (codeInSheet) {
    employeeId = codeInSheet[1].trim().toUpperCase();
    employeeName = sheet.name.replace(codeInSheet[0], '').replace(/[-_()]/g, ' ').trim() || employeeId;
    foundIn = `Sheet name pattern (${sheet.name})`;
  }

  // 3. Scan metadata rows 1-8
  const maxRow = Math.min(sheet.rowCount || 10, 10);
  for (let r = 1; r <= maxRow; r++) {
    const row = sheet.getRow(r);
    const maxCol = Math.min(row.cellCount || 20, 20);

    let isHeaderRow = false;
    row.eachCell(cCell => {
      const cNorm = normalizeText(getCellValue(cCell));
      if (isDateHeader(cNorm) || cNorm.includes('product') || cNorm.includes('prepaid') || cNorm.includes('cod')) {
        isHeaderRow = true;
      }
    });
    if (isHeaderRow) continue;

    for (let c = 1; c <= maxCol; c++) {
      const cell = row.getCell(c);
      const val = getCellValue(cell);
      if (!val) continue;
      const valNorm = normalizeText(val);

      // Check for inline Employee ID: e.g. "Employee ID: AS100"
      const inlineId = val.match(/(?:emp(?:loyee)?\s*(?:id|code|no)|staff\s*(?:id|code|no))\s*[:\-#]?\s*([a-zA-Z0-9_\-]+)/i);
      if (inlineId && inlineId[1] && normalizeText(inlineId[1]) !== 'id') {
        employeeId = inlineId[1].trim().toUpperCase();
        foundIn = `Cell ${cell.address} (inline ID)`;
      }

      // Check for label cell "Employee ID" with value to the right or below
      if (!employeeId && (
        valNorm === 'employee id' || valNorm === 'staff id' ||
        valNorm === 'emp id' || valNorm === 'empid' || valNorm === 'staffid'
      )) {
        const rightVal = getCellValue(row.getCell(c + 1));
        if (rightVal && !isStaffHeaderLabel(rightVal) && rightVal.length <= 30) {
          employeeId = rightVal.trim().toUpperCase();
          foundIn = `Cell ${row.getCell(c + 1).address} (right of label)`;
        } else {
          const belowVal = getCellValue(sheet.getRow(r + 1).getCell(c));
          if (belowVal && !isStaffHeaderLabel(belowVal) && belowVal.length <= 30) {
            employeeId = belowVal.trim().toUpperCase();
            foundIn = `Cell ${sheet.getRow(r + 1).getCell(c).address} (below label)`;
          }
        }
      }

      // Check for Employee Name
      const inlineName = val.match(/(?:emp(?:loyee)?\s*name|staff\s*name)\s*[:\-#]?\s*([a-zA-Z\s\.]+)/i);
      if (inlineName && inlineName[1] && normalizeText(inlineName[1]) !== 'name') {
        employeeName = inlineName[1].trim();
      } else if (!employeeName && (valNorm === 'employee name' || valNorm === 'staff name' || valNorm === 'emp name')) {
        const rightVal = getCellValue(row.getCell(c + 1));
        if (rightVal && rightVal.length <= 50) employeeName = rightVal.trim();
      }

      // Pattern fallback: ID code like "AS100", "STF-01" in metadata
      if (!employeeId) {
        const codePattern = val.match(/\b([A-Z]{1,5}[-_ ]?\d{2,5})\b/i);
        if (codePattern && !normalizeText(codePattern[1]).includes('cod') && !normalizeText(codePattern[1]).includes('prepaid')) {
          employeeId = codePattern[1].trim().toUpperCase();
          foundIn = `Cell ${cell.address} (pattern code)`;
        }
      }
    }
  }

  // Fallback: If name found but not ID, or ID found but not name
  if (employeeId && !employeeName) {
    const user = knownUsers.find(u => normalizeText(u.staff_id) === normalizeText(employeeId));
    if (user) employeeName = user.name;
    else employeeName = sheet.name;
  } else if (!employeeId && sheet.name) {
    const user = knownUsers.find(u => normalizeText(u.name) === sheetNorm || normalizeText(u.username) === sheetNorm);
    if (user) {
      employeeId = user.staff_id;
      employeeName = user.name;
    } else {
      employeeId = sheet.name.replace(/[^a-zA-Z0-9]/g, '').toUpperCase() || 'EMP_UNKNOWN';
      employeeName = sheet.name;
    }
  }

  return { employeeId, employeeName, foundIn };
}

/**
 * Identifies table header row and extracts column definitions
 */
export function detectTableColumns(sheet) {
  let headerRowIndex = -1;
  let maxColsFound = 0;
  const maxRow = Math.min(sheet.rowCount || 15, 15);

  for (let r = 1; r <= maxRow; r++) {
    const row = sheet.getRow(r);
    let dateScore = 0;
    let staffScore = 0;
    let productScore = 0;
    let colCount = 0;

    row.eachCell(cell => {
      const val = normalizeText(getCellValue(cell));
      if (!val) return;
      colCount++;
      if (isDateHeader(val)) dateScore++;
      if (isStaffHeaderLabel(val)) staffScore++;
      if (val.includes('cod') || val.includes('prepaid') || val.includes('return') || val.includes('incentive') || val.includes('qty')) {
        productScore++;
      }
    });

    if (dateScore > 0 || (staffScore > 0 && productScore > 0) || (productScore >= 2)) {
      if (colCount > maxColsFound) {
        maxColsFound = colCount;
        headerRowIndex = r;
      }
    }
  }

  if (headerRowIndex === -1) {
    headerRowIndex = 1;
  }

  const headerRow = sheet.getRow(headerRowIndex);
  const columns = [];
  let colIndex = 1;
  let dateCol = -1;
  let staffIdCol = -1;
  let staffNameCol = -1;

  // Check if there is a parent header row above (e.g. grouped headers like HYPER MONK -> COD, Prepaid)
  const parentRow = headerRowIndex > 1 ? sheet.getRow(headerRowIndex - 1) : null;

  headerRow.eachCell({ includeEmpty: false }, (cell, cNum) => {
    let headerText = getCellValue(cell);
    if (!headerText) return;

    // Check parent row for composite column header (e.g. "HYPER MONK" above "COD")
    if (parentRow) {
      const parentVal = getCellValue(parentRow.getCell(cNum));
      if (parentVal && !isStaffHeaderLabel(parentVal) && !isDateHeader(parentVal)) {
        const normHeader = normalizeText(headerText);
        if (normHeader === 'cod' || normHeader === 'prepaid' || normHeader.includes('cod') || normHeader.includes('prepaid')) {
          headerText = `${parentVal.trim()} (${headerText.trim()})`;
        }
      }
    }

    const norm = normalizeText(headerText);

    // Identify special role columns
    if (isDateHeader(norm) && dateCol === -1) dateCol = cNum;
    if (isStaffIdHeader(norm) && staffIdCol === -1) staffIdCol = cNum;
    if (isStaffNameHeader(norm) && staffNameCol === -1) staffNameCol = cNum;

    // Determine type
    let type = 'text';
    if (isDateHeader(norm)) {
      type = 'date';
    } else if (
      norm.includes('incentive') || norm.includes('deduction') ||
      norm.includes('net') || norm.includes('amount') || norm.includes('sales') ||
      norm.includes('payout')
    ) {
      type = 'currency';
    } else if (
      norm.includes('qty') || norm.includes('quantity') || norm.includes('return') ||
      norm.includes('cod') || norm.includes('prepaid') || norm.includes('units')
    ) {
      type = 'number';
    }

    columns.push({
      colIndex: cNum,
      key: `col_${cNum}_${norm.replace(/[^a-z0-9]/g, '_').slice(0, 30)}`,
      label: headerText.trim(),
      type
    });
  });

  return {
    headerRowIndex,
    columns,
    dateCol,
    staffIdCol,
    staffNameCol
  };
}

/**
 * Main parse function for uploaded Excel workbook buffer
 */
export async function parseMonthlyExcelWorkbook(buffer, filename = '', knownUsers = []) {
  const fileHash = crypto.createHash('sha256').update(buffer).digest('hex');

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);

  if (!workbook.worksheets || workbook.worksheets.length === 0) {
    throw new Error('No worksheets found in the uploaded Excel workbook.');
  }

  // 1. Detect Month & Year
  let detectedMonth = detectMonthYearFromFilename(filename);
  const foundDates = [];

  const employeeDataMap = new Map(); // employeeId -> { employeeId, employeeName, sheetName, records: [], columns: Map }
  const skippedSheets = [];
  const recognizedSheets = [];
  const unmatchedRows = [];

  // 2. Iterate through worksheets
  for (const sheet of workbook.worksheets) {
    if (isSummarySheet(sheet)) {
      skippedSheets.push({
        name: sheet.name,
        reason: 'Consolidated summary or rollup worksheet'
      });
      continue;
    }

    const { headerRowIndex, columns, dateCol, staffIdCol, staffNameCol } = detectTableColumns(sheet);

    if (!columns || columns.length === 0) {
      skippedSheets.push({
        name: sheet.name,
        reason: 'No table columns detected'
      });
      continue;
    }

    recognizedSheets.push(sheet.name);

    // Worksheet-level employee fallback
    const sheetEmp = extractSheetEmployeeInfo(sheet, knownUsers);

    // 3. Read data rows
    const totalSheetRows = sheet.rowCount || 0;
    for (let r = headerRowIndex + 1; r <= totalSheetRows; r++) {
      const row = sheet.getRow(r);

      // Check if row has any values
      let hasData = false;
      row.eachCell(() => { hasData = true; });
      if (!hasData) continue;

      // Extract row data
      const rowData = {};
      let rowDate = '';
      let rowStaffId = '';
      let rowStaffName = '';

      for (const col of columns) {
        const cell = row.getCell(col.colIndex);
        let val = getCellValue(cell);

        // Normalize numeric and currency values
        if (col.type === 'number' || col.type === 'currency') {
          if (val === '' || val === null || val === undefined) {
            val = 0;
          } else {
            const num = parseFloat(String(val).replace(/[^0-9.-]/g, ''));
            val = isNaN(num) ? 0 : num;
          }
        }

        if (col.colIndex === dateCol && val) {
          rowDate = parseDateValue(val, detectedMonth);
          val = rowDate;
          if (rowDate && /^\d{4}-\d{2}/.test(rowDate)) {
            foundDates.push(rowDate.slice(0, 7));
          }
        }

        if (col.colIndex === staffIdCol && val) {
          rowStaffId = String(val).trim().toUpperCase();
        }

        if (col.colIndex === staffNameCol && val) {
          rowStaffName = String(val).trim();
        }

        rowData[col.label] = val;
      }

      // Check for summary/footer rows like "Total"
      const firstColVal = normalizeText(Object.values(rowData)[0]);
      if (firstColVal.includes('total') || firstColVal.includes('grand total') || firstColVal.includes('average')) {
        continue;
      }

      // Determine Employee ID for this row
      const empId = rowStaffId || sheetEmp.employeeId;
      const empName = rowStaffName || sheetEmp.employeeName || empId;

      if (!empId) {
        unmatchedRows.push({
          sheetName: sheet.name,
          rowIndex: r,
          data: rowData
        });
        continue;
      }

      if (!employeeDataMap.has(empId)) {
        employeeDataMap.set(empId, {
          employeeId: empId,
          employeeName: empName,
          sheetName: sheet.name,
          records: [],
          columnMap: new Map()
        });
      }

      const empEntry = employeeDataMap.get(empId);
      if (!empEntry.employeeName && empName) empEntry.employeeName = empName;

      // Register columns for this employee
      columns.forEach(c => {
        if (!empEntry.columnMap.has(c.label)) {
          empEntry.columnMap.set(c.label, c);
        }
      });

      empEntry.records.push({
        rowIndex: r,
        recordDate: rowDate || '',
        data: rowData
      });
    }
  }

  // Fallback month detection from data dates if filename lacked it
  if (!detectedMonth && foundDates.length > 0) {
    const counts = {};
    for (const d of foundDates) counts[d] = (counts[d] || 0) + 1;
    let topMonth = '';
    let topCount = 0;
    for (const [m, c] of Object.entries(counts)) {
      if (c > topCount) {
        topCount = c;
        topMonth = m;
      }
    }
    if (topMonth) detectedMonth = topMonth;
  }

  if (!detectedMonth) {
    const now = new Date();
    detectedMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  }

  const monthName = formatMonthName(detectedMonth);

  // Union of all columns
  const allColumnsMap = new Map();
  let totalSalesAmount = 0;
  let hasSalesAmountCol = false;

  const employees = Array.from(employeeDataMap.values()).map(emp => {
    const cols = Array.from(emp.columnMap.values());
    cols.forEach(c => {
      if (!allColumnsMap.has(c.label)) {
        allColumnsMap.set(c.label, c);
      }
    });

    // Check if sales amount exists in records
    emp.records.forEach(rec => {
      for (const [k, v] of Object.entries(rec.data)) {
        const normK = normalizeText(k);
        if (normK.includes('gross sales') || normK.includes('total sales') || normK.includes('order amount')) {
          hasSalesAmountCol = true;
          totalSalesAmount += (typeof v === 'number' ? v : 0);
        }
      }
    });

    return {
      employeeId: emp.employeeId,
      employeeName: emp.employeeName,
      sheetName: emp.sheetName,
      recordCount: emp.records.length,
      columns: cols,
      records: emp.records
    };
  });

  const totalRecords = employees.reduce((sum, e) => sum + e.recordCount, 0);

  return {
    reportMonth: detectedMonth,
    monthName,
    filename,
    fileHash,
    totalRecords,
    totalEmployees: employees.length,
    totalSalesAmount: hasSalesAmountCol ? Math.round(totalSalesAmount * 100) / 100 : null,
    allColumns: Array.from(allColumnsMap.values()),
    employees,
    recognizedSheets,
    skippedSheets,
    unmatchedRows
  };
}
