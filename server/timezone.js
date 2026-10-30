// server/timezone.js
// Configurable business timezone utility for date and time standardization

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
