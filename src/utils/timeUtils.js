/**
 * Parses a string representing hours and minutes into a decimal number of hours.
 * Supports:
 * - "1471 Hrs 48 Mins"
 * - "1471h 48m"
 * - "450" (number or string)
 * - "450.5"
 * - "48 Mins"
 */
export const parseHoursFromString = (val) => {
  if (val === undefined || val === null || val === '') return 0;
  if (typeof val === 'number') return val;
  
  const str = String(val).trim();
  if (!isNaN(str)) return Number(str);
  
  // Regex to match hours and minutes, e.g., "1471 Hrs 48 Mins" or "1471h 48m"
  const hrsMinsRegex = /(\d+)\s*(?:hrs|hr|h|hours|hour)?\s*(\d+)\s*(?:mins|min|m|minutes|minute)/i;
  const matchHrsMins = str.match(hrsMinsRegex);
  if (matchHrsMins) {
    const h = parseInt(matchHrsMins[1], 10) || 0;
    const m = parseInt(matchHrsMins[2], 10) || 0;
    return h + m / 60;
  }
  
  // Pattern 2: only hours, e.g. "1471 Hrs" or "1471h"
  const hrsRegex = /(\d+)\s*(?:hrs|hr|h|hours|hour)/i;
  const matchHrs = str.match(hrsRegex);
  if (matchHrs) {
    return parseInt(matchHrs[1], 10) || 0;
  }
  
  // Pattern 3: only minutes, e.g. "48 Mins" or "48m"
  const minsRegex = /(\d+)\s*(?:mins|min|m|minutes|minute)/i;
  const matchMins = str.match(minsRegex);
  if (matchMins) {
    return (parseInt(matchMins[1], 10) || 0) / 60;
  }
  
  // Fallback: try parsing float
  const parsedFloat = parseFloat(str);
  return isNaN(parsedFloat) ? 0 : parsedFloat;
};

/**
 * Formats a decimal number of hours into the string format "X Hrs Y Mins".
 */
export const formatHoursToHrsMins = (hoursDecimal) => {
  const num = Number(hoursDecimal) || 0;
  const hours = Math.floor(num);
  const minutes = Math.round((num - hours) * 60);
  
  if (minutes === 60) {
    return `${hours + 1} Hrs 0 Mins`;
  }
  
  return `${hours} Hrs ${minutes} Mins`;
};

/**
 * Helper to convert hours and minutes to decimal.
 */
export const toDecimal = (h, m) => (Number(h) || 0) + (Number(m) || 0) / 60;

/**
 * Helper to convert decimal to hours and minutes.
 */
export const fromDecimal = (d) => {
  const val = Number(d) || 0;
  const h = Math.floor(val);
  const m = Math.round((val - h) * 60);
  if (m === 60) {
    return { h: h + 1, m: 0 };
  }
  return { h, m };
};
