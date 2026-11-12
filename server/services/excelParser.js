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

export function isInvalidEmployeeId(idStr) {
  if (!idStr) return true;
  const s = normalizeText(idStr);
  const invalid = [
    'employee id', 'employeeid', 'staff id', 'staffid', 'emp id', 'empid',
    'employee code', 'staff code', 'emp code', 'code', 'id',
    'date', 'order date', 'sales date', 'dt', 'day',
    'total', 'grand total', 'sub total', 'subtotal', 'average', 'avg',
    'amount', 'net', 'gross', 'sum', 'payout', 'incentive',
    'sl', 'no', 'sr', 's.no', 'sr.no', 'name', 'employee name', 'staff name',
    'status', 'remarks', 'signature', 'verified', 'approved', 'present', 'absent',
    'ot (hours)', 'incomplete hours', 'basic pay', 'emergency loan', 'loan',
    'incentive amount', 'total amount', 'salary', 'advance'
  ];
  if (invalid.includes(s)) return true;
  if (/^(?:total|grand\s*total|average|subtotal|date|employee\s*id|staff\s*id|salary|basic\s*pay)$/i.test(s)) return true;
  if (s.length < 2 || s.length > 30) return true;
  if (!/[a-z0-9]/i.test(s)) return true;
  return false;
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

export function parseEmployeeCodeAndName(text, knownUsers = []) {
  if (!text) return { employeeId: '', employeeName: '' };
  const textNorm = normalizeText(text);

  // Direct match with knownUsers
  const matchedUser = knownUsers.find(u =>
    normalizeText(u.staff_id) === textNorm ||
    normalizeText(u.name) === textNorm ||
    normalizeText(u.username) === textNorm
  );
  if (matchedUser) {
    return {
      employeeId: matchedUser.staff_id,
      employeeName: matchedUser.name || matchedUser.staff_id
    };
  }

  // Regex pattern for codes like AS100, AST04, STF01
  const codeMatch = text.match(/\b([A-Za-z]{1,5}\s*[-_]?\s*\d{2,5})\b/);
  if (codeMatch) {
    const rawCode = codeMatch[1].replace(/\s+/g, '').toUpperCase();
    if (!isInvalidEmployeeId(rawCode)) {
      const remainingName = text.replace(codeMatch[0], '').replace(/[-_()]/g, ' ').replace(/\s+/g, ' ').trim();
      const userByCode = knownUsers.find(u => normalizeText(u.staff_id) === normalizeText(rawCode));
      const finalName = remainingName.length >= 2 ? remainingName : (userByCode?.name || rawCode);
      return {
        employeeId: rawCode,
        employeeName: finalName
      };
    }
  }

  return { employeeId: '', employeeName: '' };
}

export function extractSheetEmployeeInfo(sheet, knownUsers = []) {
  const parsedSheetName = parseEmployeeCodeAndName(sheet.name, knownUsers);
  if (parsedSheetName.employeeId) {
    return {
      employeeId: parsedSheetName.employeeId,
      employeeName: parsedSheetName.employeeName,
      foundIn: `Sheet name (${sheet.name})`
    };
  }

  let employeeId = '';
  let employeeName = '';
  let foundIn = '';

  const maxRow = Math.min(sheet.rowCount || 10, 10);
  for (let r = 1; r <= maxRow; r++) {
    const row = sheet.getRow(r);
    for (let c = 1; c <= Math.min(row.cellCount || 15, 15); c++) {
      const val = getCellValue(row.getCell(c));
      if (!val) continue;

      // Check for inline Employee ID: e.g. "Employee ID: AS100"
      const inlineId = val.match(/(?:emp(?:loyee)?\s*(?:id|code|no)|staff\s*(?:id|code|no))\s*[:\-#]?\s*([a-zA-Z0-9_\-]+)/i);
      if (inlineId && inlineId[1] && !isInvalidEmployeeId(inlineId[1])) {
        employeeId = inlineId[1].trim().toUpperCase();
        foundIn = `Cell ${row.getCell(c).address} (inline ID)`;
      }

      // Pattern fallback: "AS100 THASHEEL SALARY REPORT"
      const parsedCell = parseEmployeeCodeAndName(val, knownUsers);
      if (parsedCell.employeeId && !employeeId) {
        employeeId = parsedCell.employeeId;
        employeeName = parsedCell.employeeName;
        foundIn = `Cell ${row.getCell(c).address} (cell text pattern)`;
      }
    }
  }

  if (employeeId && !employeeName) {
    const user = knownUsers.find(u => normalizeText(u.staff_id) === normalizeText(employeeId));
    employeeName = user ? user.name : employeeId;
  }

  return { employeeId, employeeName, foundIn };
}

export function detectTableColumns(sheet) {
  let headerRowIndex = -1;
  let maxScore = -1;
  const maxRow = Math.min(sheet.rowCount || 12, 12);

  for (let r = 1; r <= maxRow; r++) {
    const row = sheet.getRow(r);
    let dateScore = 0;
    let staffScore = 0;
    let productScore = 0;
    let colCount = 0;
    let hasSubheaders = false;

    row.eachCell(cell => {
      const val = normalizeText(getCellValue(cell));
      if (!val) return;
      colCount++;
      if (isDateHeader(val)) dateScore++;
      if (isStaffHeaderLabel(val)) staffScore++;
      if (
        val.includes('cod') || val.includes('prepaid') || val.includes('return') ||
        val.includes('incentive') || val.includes('amount') || val.includes('monk') ||
        val.includes('ojus') || val.includes('sales')
      ) {
        productScore++;
      }
      if (val === 'cod' || val === 'prepaid' || val === 'monk' || val === 'amount' || val === 'ojus') {
        hasSubheaders = true;
      }
    });

    const score = (dateScore * 10) + (staffScore * 8) + (productScore * 5) + colCount + (hasSubheaders ? 20 : 0);

    if (dateScore > 0 || (staffScore > 0 && productScore > 0) || (productScore >= 2)) {
      if (score > maxScore) {
        maxScore = score;
        headerRowIndex = r;
      }
    }
  }

  if (headerRowIndex === -1) headerRowIndex = 1;

  const headerRow = sheet.getRow(headerRowIndex);
  const columns = [];
  let dateCol = -1;
  let staffIdCol = -1;
  let staffNameCol = -1;

  const parentRow = headerRowIndex > 1 ? sheet.getRow(headerRowIndex - 1) : null;

  headerRow.eachCell({ includeEmpty: false }, (cell, cNum) => {
    let headerText = getCellValue(cell);
    if (!headerText) return;

    const norm = normalizeText(headerText);
    // Exclude side tables beyond column 12 (basic pay, attendance, duty hours, etc.)
    if (cNum > 12 && (
      norm.includes('basic pay') || norm.includes('attendance') ||
      norm.includes('check in') || norm.includes('duty') ||
      norm.includes('emergency') || norm.includes('loan')
    )) {
      return;
    }
    // If column is separated by 2+ blank columns after the main table, ignore
    if (columns.length > 0 && cNum - columns[columns.length - 1].colIndex > 2) {
      return;
    }

    if (parentRow) {
      const parentVal = getCellValue(parentRow.getCell(cNum));
      if (parentVal && !isStaffHeaderLabel(parentVal) && !isDateHeader(parentVal)) {
        const normHeader = normalizeText(headerText);
        if (
          normHeader === 'cod' || normHeader === 'prepaid' ||
          normHeader === 'monk' || normHeader === 'ojus' ||
          normHeader === 'amount' ||
          normHeader.includes('cod') || normHeader.includes('prepaid')
        ) {
          headerText = `${parentVal.trim()} (${headerText.trim()})`;
        }
      }
    }

    const normAfter = normalizeText(headerText);

    if (isDateHeader(normAfter) && dateCol === -1) dateCol = cNum;
    if (isStaffIdHeader(normAfter) && staffIdCol === -1) staffIdCol = cNum;
    if (isStaffNameHeader(normAfter) && staffNameCol === -1) staffNameCol = cNum;

    let type = 'text';
    if (isDateHeader(normAfter)) {
      type = 'date';
    } else if (normAfter.includes('incentive') || normAfter.includes('amount') || normAfter.includes('sales')) {
      type = 'currency';
    } else if (
      normAfter.includes('cod') || normAfter.includes('prepaid') ||
      normAfter.includes('return') || normAfter.includes('qty') ||
      normAfter.includes('units') || normAfter.includes('quantity')
    ) {
      type = 'number';
    }

    columns.push({
      colIndex: cNum,
      key: `col_${cNum}_${normAfter.replace(/[^a-z0-9]/g, '_').slice(0, 30)}`,
      label: headerText.trim(),
      type
    });
  });

  return { headerRowIndex, columns, dateCol, staffIdCol, staffNameCol };
}

export function isSummaryOrRollupSheet(sheetName, hasMultipleEmployeeSheets) {
  const s = normalizeText(sheetName);
  if (s.includes('summary') || s.includes('consolidated') || s.includes('overall') || s.includes('dashboard')) {
    return true;
  }
  if (hasMultipleEmployeeSheets) {
    if (s === 'incentive' || s === 'total' || s === 'totals' || s === 'incentives' || s.includes('salary report') || s.includes('all staff')) {
      return true;
    }
  }
  return false;
}

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

  // 2. Pre-scan all worksheets to build master employee mapping and detect sheet mode
  const sheetAnalysis = [];
  const masterEmpMap = new Map();
  const registeredStaffMap = new Map();

  for (const user of knownUsers) {
    if (user.staff_id && !isInvalidEmployeeId(user.staff_id)) {
      const uId = user.staff_id.trim().toUpperCase();
      registeredStaffMap.set(uId, user);
      masterEmpMap.set(uId, {
        employeeId: uId,
        employeeName: user.name || uId
      });
    }
  }

  for (const sheet of workbook.worksheets) {
    const parsed = parseEmployeeCodeAndName(sheet.name, knownUsers);
    let isEmpSheet = false;
    let detectedEmpId = '';
    let detectedEmpName = '';

    if (parsed.employeeId && !isInvalidEmployeeId(parsed.employeeId)) {
      isEmpSheet = true;
      detectedEmpId = parsed.employeeId;
      detectedEmpName = parsed.employeeName;
    } else {
      const meta = extractSheetEmployeeInfo(sheet, knownUsers);
      if (meta.employeeId && !isInvalidEmployeeId(meta.employeeId)) {
        detectedEmpId = meta.employeeId;
        detectedEmpName = meta.employeeName || detectedEmpId;
        const sNorm = normalizeText(sheet.name);
        if (!sNorm.includes('summary') && !sNorm.includes('incentive') && !sNorm.includes('consolidated')) {
          isEmpSheet = true;
        }
      }
    }

    if (isEmpSheet && detectedEmpId) {
      masterEmpMap.set(detectedEmpId, {
        employeeId: detectedEmpId,
        employeeName: detectedEmpName || masterEmpMap.get(detectedEmpId)?.employeeName || detectedEmpId
      });
    }

    sheetAnalysis.push({
      sheet,
      name: sheet.name,
      isEmpSheet,
      detectedEmpId,
      detectedEmpName
    });
  }

  const empSheets = sheetAnalysis.filter(s => s.isEmpSheet);
  const hasMultipleEmployeeSheets = empSheets.length >= 2;

  const employeeDataMap = new Map();
  const unregisteredEmployeesMap = new Map();
  const skippedSheets = [];
  const recognizedSheets = [];
  const unmatchedRows = [];

  // 3. Process worksheets
  for (let i = 0; i < sheetAnalysis.length; i++) {
    const { sheet, name, isEmpSheet, detectedEmpId, detectedEmpName } = sheetAnalysis[i];

    if (isSummaryOrRollupSheet(name, hasMultipleEmployeeSheets)) {
      skippedSheets.push({
        name,
        reason: 'Consolidated summary or rollup worksheet'
      });
      continue;
    }

    const { headerRowIndex, columns, dateCol, staffIdCol, staffNameCol } = detectTableColumns(sheet);
    if (!columns || columns.length === 0) {
      skippedSheets.push({
        name,
        reason: 'No table columns detected'
      });
      continue;
    }

    let sheetEmpId = detectedEmpId;
    let sheetEmpName = detectedEmpName;
    if (!sheetEmpId) {
      const sInfo = extractSheetEmployeeInfo(sheet, knownUsers);
      sheetEmpId = sInfo.employeeId;
      sheetEmpName = sInfo.employeeName;
    }

    // RULE: Only existing registered employee IDs are fetched!
    // If workbook has multiple employee sheets and this sheet belongs to an unregistered employee:
    if (hasMultipleEmployeeSheets && sheetEmpId && !registeredStaffMap.has(sheetEmpId)) {
      let unregRowsCount = 0;
      const totalSheetRows = sheet.rowCount || 0;
      for (let r = headerRowIndex + 1; r <= totalSheetRows; r++) {
        const row = sheet.getRow(r);
        const dateRaw = dateCol !== -1 ? getCellValue(row.getCell(dateCol)) : '';
        const firstColVal = normalizeText(getCellValue(row.getCell(1)) || getCellValue(row.getCell(2)));
        if (firstColVal.includes('total') || normalizeText(dateRaw).includes('total')) break;
        const rowDate = parseDateValue(dateRaw, detectedMonth);
        if (rowDate && /^\d{4}-\d{2}-\d{2}$/.test(rowDate)) {
          unregRowsCount++;
        }
      }

      unregisteredEmployeesMap.set(sheetEmpId, {
        employeeId: sheetEmpId,
        detectedName: detectedEmpName || sheetEmpName || sheetEmpId,
        sheetName: name,
        recordCount: unregRowsCount,
        reason: `Employee ID "${sheetEmpId}" does not exist in Employee Management.`
      });
      continue; // Skip fetching this unregistered sheet!
    }

    recognizedSheets.push(name);

    const totalSheetRows = sheet.rowCount || 0;
    for (let r = headerRowIndex + 1; r <= totalSheetRows; r++) {
      const row = sheet.getRow(r);
      let hasData = false;
      row.eachCell(() => { hasData = true; });
      if (!hasData) continue;

      const dateRaw = dateCol !== -1 ? getCellValue(row.getCell(dateCol)) : '';
      const firstColVal = normalizeText(getCellValue(row.getCell(1)) || getCellValue(row.getCell(2)));

      // Stop as soon as we encounter a Total or Summary row in the daily sales table
      if (firstColVal.includes('total') || normalizeText(dateRaw).includes('total')) {
        break; // Daily records completed
      }

      // Check for summary/footer rows
      if (
        firstColVal.includes('grand total') || firstColVal.includes('average') ||
        firstColVal.includes('basic pay') || firstColVal.includes('emergency loan') ||
        firstColVal.includes('attendance') || firstColVal.includes('incomplete') ||
        firstColVal.includes('signature')
      ) {
        continue;
      }

      // Parse date
      const rowDate = parseDateValue(dateRaw, detectedMonth);
      if (!rowDate || !/^\d{4}-\d{2}-\d{2}$/.test(rowDate)) {
        continue; // Must be a valid daily date in the month
      }

      foundDates.push(rowDate.slice(0, 7));

      let rowStaffId = staffIdCol !== -1 ? getCellValue(row.getCell(staffIdCol)).trim().toUpperCase() : '';
      let rowStaffName = staffNameCol !== -1 ? getCellValue(row.getCell(staffNameCol)).trim() : '';

      let empId = '';
      let empName = '';

      if (hasMultipleEmployeeSheets && sheetEmpId) {
        empId = sheetEmpId;
        empName = masterEmpMap.get(empId)?.employeeName || sheetEmpName || empId;
      } else {
        empId = rowStaffId || sheetEmpId;
        if (isInvalidEmployeeId(empId)) continue;
        empName = rowStaffName || masterEmpMap.get(empId)?.employeeName || (rowStaffId === sheetEmpId ? sheetEmpName : '') || empId;
      }

      if (!empId || isInvalidEmployeeId(empId)) {
        unmatchedRows.push({
          sheetName: name,
          rowIndex: r,
          data: {}
        });
        continue;
      }

      // In flat sheet mode: if employee ID is not in registeredStaffMap, skip and track as unregistered
      if (!registeredStaffMap.has(empId)) {
        if (!unregisteredEmployeesMap.has(empId)) {
          unregisteredEmployeesMap.set(empId, {
            employeeId: empId,
            detectedName: empName || empId,
            sheetName: name,
            recordCount: 0,
            reason: `Employee ID "${empId}" does not exist in Employee Management.`
          });
        }
        unregisteredEmployeesMap.get(empId).recordCount++;
        continue;
      }

      // Extract row data
      const rowData = {};
      for (const col of columns) {
        let val = getCellValue(row.getCell(col.colIndex));

        if (col.type === 'number' || col.type === 'currency') {
          if (val === '' || val === null || val === undefined) {
            val = 0;
          } else {
            const num = parseFloat(String(val).replace(/[^0-9.-]/g, ''));
            val = isNaN(num) ? 0 : num;
          }
        }

        if (col.colIndex === dateCol) {
          val = rowDate;
        }

        rowData[col.label] = val;
      }

      if (!employeeDataMap.has(empId)) {
        employeeDataMap.set(empId, {
          employeeId: empId,
          employeeName: empName,
          sheetName: name,
          records: [],
          columnMap: new Map()
        });
      }

      const empEntry = employeeDataMap.get(empId);
      if ((!empEntry.employeeName || empEntry.employeeName === empId) && empName && empName !== empId) {
        empEntry.employeeName = empName;
      }

      columns.forEach(c => {
        if (!empEntry.columnMap.has(c.label)) {
          empEntry.columnMap.set(c.label, c);
        }
      });

      empEntry.records.push({
        rowIndex: r,
        recordDate: rowDate,
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

    emp.records.forEach(rec => {
      for (const [k, v] of Object.entries(rec.data)) {
        const normK = normalizeText(k);
        if (normK.includes('gross sales') || normK.includes('total sales') || normK.includes('order amount') || normK === 'total amount') {
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

  const unregisteredEmployees = Array.from(unregisteredEmployeesMap.values());
  const hasUnregistered = unregisteredEmployees.length > 0;
  const allUnregistered = employees.length === 0 && hasUnregistered;

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
    unregisteredEmployees,
    hasUnregistered,
    allUnregistered,
    recognizedSheets,
    skippedSheets,
    unmatchedRows
  };
}
