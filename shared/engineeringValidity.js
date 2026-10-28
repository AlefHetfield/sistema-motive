const DAY_MS = 86400000;
const todayFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'America/Sao_Paulo', year: 'numeric', month: '2-digit', day: '2-digit',
});

// Dates are calendar days. UTC is only used for arithmetic, never for choosing today.
function calendarDate(value) {
  const source = value instanceof Date && Number.isFinite(value.getTime()) ? value.toISOString() : value;
  if (typeof source !== 'string' || !/^\d{4}-\d{2}-\d{2}(?:T.*)?$/.test(source)) return null;
  const day = source.slice(0, 10);
  const parsed = new Date(`${day}T00:00:00.000Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === day ? parsed : null;
}

export function engineeringToday(now = new Date()) {
  const parts = Object.fromEntries(todayFormatter.formatToParts(now).map(part => [part.type, part.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}

export function addEngineeringDays(value, days) {
  const date = calendarDate(value);
  if (!date || !Number.isInteger(days)) return null;
  date.setUTCDate(date.getUTCDate() + days);
  if (!Number.isFinite(date.getTime())) return null;
  const iso = date.toISOString();
  return /^\d{4}-/.test(iso) ? iso.slice(0, 10) : null;
}

export function engineeringValidity(dataPedido, today = engineeringToday()) {
  const expiresOn = addEngineeringDays(dataPedido, 180);
  const expiryDate = calendarDate(expiresOn);
  const currentDate = calendarDate(today);
  if (!expiryDate || !currentDate) return { expiresOn: null, daysRemaining: null, state: 'undefined' };
  const daysRemaining = Math.round((expiryDate.getTime() - currentDate.getTime()) / DAY_MS);
  return { expiresOn, daysRemaining, state: daysRemaining < 0 ? 'expired' : daysRemaining <= 30 ? 'soon' : 'valid' };
}
