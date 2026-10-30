// server/timezone.js
// Configurable business timezone with next-day 9:30 AM deadline verification

const DEFAULT_TIMEZONE = process.env.BUSINESS_TIMEZONE || 'Asia/Kolkata';

/**
 * Returns current timestamp components in configured business timezone
 */
export function getNowInBusinessTimezone(tz = DEFAULT_TIMEZONE, customDate = new Date()) {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: tz,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });
  const parts = {};
  formatter.formatToParts(customDate).forEach(p => {
    parts[p.type] = p.value;
  });

  const dateStr = `${parts.year}-${parts.month}-${parts.day}`;
  const timeStr = `${parts.hour}:${parts.minute}:${parts.second}`;
  const isoLike = `${dateStr}T${timeStr}`;

  return {
    timezone: tz,
    year: parseInt(parts.year, 10),
    month: parseInt(parts.month, 10),
    day: parseInt(parts.day, 10),
    hour: parseInt(parts.hour, 10),
    minute: parseInt(parts.minute, 10),
    second: parseInt(parts.second, 10),
    dateStr,
    timeStr,
    isoLike
  };
}

/**
 * Calculates deadline for a given activity date in business timezone
 * Rule: entries for date D close at (D + 1 day) 09:30:00 AM
 */
export function getActivityDeadline(activityDateStr, tz = DEFAULT_TIMEZONE) {
  if (!activityDateStr || !/^\d{4}-\d{2}-\d{2}$/.test(activityDateStr)) {
    throw new Error('Invalid activity date format. Expected YYYY-MM-DD');
  }

  const [y, m, d] = activityDateStr.split('-').map(Number);
  const actDateObj = new Date(Date.UTC(y, m - 1, d));
  actDateObj.setUTCDate(actDateObj.getUTCDate() + 1);

  const nextY = actDateObj.getUTCFullYear();
  const nextM = String(actDateObj.getUTCMonth() + 1).padStart(2, '0');
  const nextD = String(actDateObj.getUTCDate()).padStart(2, '0');
  const deadlineIso = `${nextY}-${nextM}-${nextD}T09:30:00`;

  return deadlineIso;
}

/**
 * Checks if daily activity for the given date is locked or allowed
 */
export function checkActivityDeadline(activityDateStr, tz = DEFAULT_TIMEZONE, referenceDate = new Date()) {
  const now = getNowInBusinessTimezone(tz, referenceDate);
  const deadlineIso = getActivityDeadline(activityDateStr, tz);

  // Check if date is in the future
  if (activityDateStr > now.dateStr) {
    return {
      allowed: false,
      isFuture: true,
      isLocked: false,
      currentTime: now.isoLike,
      deadline: deadlineIso,
      timezone: tz,
      message: `Cannot record activity for future date ${activityDateStr}. Current business date is ${now.dateStr}.`
    };
  }

  const isLocked = now.isoLike > deadlineIso;

  return {
    allowed: !isLocked,
    isFuture: false,
    isLocked,
    currentTime: now.isoLike,
    deadline: deadlineIso,
    timezone: tz,
    message: isLocked
      ? `Deadline passed for activity date ${activityDateStr}. Entries closed at 09:30 AM on ${deadlineIso.split('T')[0]} (${tz}).`
      : `Active. Entry allowed until 09:30 AM on ${deadlineIso.split('T')[0]} (${tz}).`
  };
}
