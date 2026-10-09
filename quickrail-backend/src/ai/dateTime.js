// Deterministic natural-language date/time understanding (India, Asia/Kolkata, day-first).
// The LLM (if enabled) never does date arithmetic — it only hands raw phrases to this module.

const MONTHS = {
  jan: 0, january: 0, feb: 1, february: 1, mar: 2, march: 2, apr: 3, april: 3, may: 4,
  jun: 5, june: 5, jul: 6, july: 6, aug: 7, august: 7, sep: 8, sept: 8, september: 8,
  oct: 9, october: 9, nov: 10, november: 10, dec: 11, december: 11,
};
const WEEKDAYS = {
  sun: 0, sunday: 0, mon: 1, monday: 1, tue: 2, tues: 2, tuesday: 2, wed: 3, weds: 3, wednesday: 3,
  thu: 4, thur: 4, thurs: 4, thursday: 4, fri: 5, friday: 5, sat: 6, saturday: 6,
};
const MONTH_RE = '(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sept?(?:ember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)';
const WD_RE = '(sun(?:day)?|mon(?:day)?|tue(?:s(?:day)?)?|wed(?:s|nesday)?|thu(?:r(?:s(?:day)?)?)?|fri(?:day)?|sat(?:urday)?)';

/** "Today" in Asia/Kolkata as {y,m,d,minutes} (m is 0-based). `now` injectable for tests. */
export function istNow(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(now);
  const get = (t) => Number(parts.find((p) => p.type === t).value);
  return { y: get('year'), m: get('month') - 1, d: get('day'), minutes: (get('hour') % 24) * 60 + get('minute') };
}

const pad = (n) => String(n).padStart(2, '0');
export const toISO = (y, m, d) => `${y}-${pad(m + 1)}-${pad(d)}`;
function utc(y, m, d) { return new Date(Date.UTC(y, m, d)); }
function addDays(iso, n) {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = utc(y, m - 1, d + n);
  return toISO(dt.getUTCFullYear(), dt.getUTCMonth(), dt.getUTCDate());
}
function weekdayOf(iso) { const [y, m, d] = iso.split('-').map(Number); return utc(y, m - 1, d).getUTCDay(); }
export function isValidISO(iso) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return false;
  const [y, m, d] = iso.split('-').map(Number);
  const dt = utc(y, m - 1, d);
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}
export function todayISO(now) { const n = istNow(now); return toISO(n.y, n.m, n.d); }
export function daysBetween(aISO, bISO) {
  const [y1, m1, d1] = aISO.split('-').map(Number); const [y2, m2, d2] = bISO.split('-').map(Number);
  return Math.round((utc(y2, m2 - 1, d2) - utc(y1, m1 - 1, d1)) / 86400000);
}

/** "6 October 2026" */
export function formatLongDate(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return `${d} ${new Intl.DateTimeFormat('en-GB', { month: 'long', timeZone: 'UTC' }).format(utc(y, m - 1, d))} ${y}`;
}
/** "Tue, 6 Oct 2026" */
export function formatShortDate(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Intl.DateTimeFormat('en-GB', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
    .format(utc(y, m - 1, d)).replace(',', '');
}

/**
 * Find the first date expression in `text`.
 * Returns { date: 'YYYY-MM-DD', matched, impliedWindow? } or null.
 * `impliedWindow` is set for words like "tonight" that also carry a time-of-day.
 */
export function parseDate(text, now = new Date()) {
  const t = ` ${String(text).toLowerCase().replace(/[,]/g, ' ')} `;
  const today = todayISO(now);
  const ist = istNow(now);
  let m;

  // ISO 2026-10-15
  if ((m = t.match(/\b(\d{4})-(\d{1,2})-(\d{1,2})\b/))) {
    const iso = toISO(+m[1], +m[2] - 1, +m[3]);
    return isValidISO(iso) ? { date: iso, matched: m[0] } : { invalid: m[0] };
  }
  // 15/10/2026 15-10-2026 15.10.26 (day-first) and 15/10
  if ((m = t.match(/\b(\d{1,2})[/.-](\d{1,2})(?:[/.-](\d{2,4}))?\b/))) {
    const d = +m[1], mo = +m[2] - 1;
    let y = m[3] ? +m[3] : ist.y;
    if (y < 100) y += 2000;
    let iso = toISO(y, mo, d);
    if (!isValidISO(iso) || mo > 11) return { invalid: m[0] };
    if (!m[3] && iso < today) iso = toISO(y + 1, mo, d);
    return { date: iso, matched: m[0] };
  }
  // 15 October [2026] / 15th Oct / October 15 [2026]
  let re = new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+(?:of\\s+)?${MONTH_RE}\\b(?:\\s+(\\d{4}))?`);
  let re2 = new RegExp(`\\b${MONTH_RE}\\s+(\\d{1,2})(?:st|nd|rd|th)?\\b(?:\\s+(\\d{4}))?`);
  let day, mon, yr, matched;
  if ((m = t.match(re))) { day = +m[1]; mon = MONTHS[m[2]]; yr = m[3] ? +m[3] : null; matched = m[0]; }
  else if ((m = t.match(re2))) { mon = MONTHS[m[1]]; day = +m[2]; yr = m[3] ? +m[3] : null; matched = m[0]; }
  if (matched) {
    let y = yr || ist.y;
    let iso = toISO(y, mon, day);
    if (!isValidISO(iso)) return { invalid: matched.trim() };
    if (!yr && iso < today) iso = toISO(y + 1, mon, day);
    return { date: iso, matched: matched.trim() };
  }

  if (/\bday after tomorrow\b/.test(t)) return { date: addDays(today, 2), matched: 'day after tomorrow' };
  if (/\btonight\b/.test(t)) return { date: today, matched: 'tonight', impliedWindow: 'night' };
  if (/\b(tomorrow|tmrw|tmw|tomorow)\b/.test(t)) return { date: addDays(today, 1), matched: 'tomorrow' };
  if (/\btoday\b/.test(t)) return { date: today, matched: 'today' };
  if ((m = t.match(/\bin (\d{1,2}) days?\b/))) return { date: addDays(today, +m[1]), matched: m[0] };

  // Weekends
  if ((m = t.match(/\b(next|this|coming)\s+weekend\b/))) {
    const wd = weekdayOf(today);
    let toSat = (6 - wd + 7) % 7;               // days until the coming Saturday (0 if today is Sat)
    if (m[1] === 'next') toSat += 7;            // "next weekend" = the Saturday after the coming one? keep simple: +7
    return { date: addDays(today, toSat), matched: m[0] };
  }
  if (/\b(on the |this )?weekend\b/.test(t)) {
    const wd = weekdayOf(today);
    return { date: addDays(today, (6 - wd + 7) % 7), matched: 'weekend' };
  }

  // Weekday names: "friday", "this friday", "next monday"
  re = new RegExp(`\\b(?:(next|this|coming|on)\\s+)?${WD_RE}\\b`);
  if ((m = t.match(re))) {
    const target = WEEKDAYS[m[2]];
    const wd = weekdayOf(today);
    let diff = (target - wd + 7) % 7;
    if (m[1] === 'next') {
      if (diff === 0) diff = 7;
      // "next friday" said on a Tuesday means the Friday of NEXT week, unless that day already falls in next week.
      const daysToNextMonday = ((1 - wd + 7) % 7) || 7;
      if (diff < daysToNextMonday) diff += 7;
    }
    return { date: addDays(today, diff), matched: m[0].trim() };
  }
  return null;
}

// ---- Time of day ----
const WINDOWS = {
  'early morning': { from: '03:00', to: '08:00', label: 'early morning' },
  morning: { from: '05:00', to: '12:00', label: 'morning' },
  afternoon: { from: '12:00', to: '17:00', label: 'afternoon' },
  evening: { from: '16:00', to: '21:00', label: 'evening' },
  night: { from: '20:00', to: '24:00', label: 'night' },
  'late night': { from: '22:00', to: '04:00', label: 'late night' },
};
export function windowByName(name) { return WINDOWS[name] || null; }

export function toMinutes(hhmm) { const [h, m] = hhmm.split(':').map(Number); return h * 60 + m; }
export function fromMinutes(min) {
  const mm = ((min % 1440) + 1440) % 1440; return `${pad(Math.floor(mm / 60))}:${pad(mm % 60)}`;
}

function clock(h, mi, ap) {
  h = +h; mi = mi ? +mi : 0;
  if (ap) { ap = ap.replace(/\./g, ''); if (ap === 'pm' && h < 12) h += 12; if (ap === 'am' && h === 12) h = 0; }
  if (h > 24 || mi > 59) return null;
  return h * 60 + mi;
}

/**
 * Parse departure-time preferences.
 * Returns { window?: {from,to,label}, after?: 'HH:MM', before?: 'HH:MM', around?: 'HH:MM' } or null.
 */
export function parseTimePreference(text) {
  const t = ` ${String(text).toLowerCase()} `;
  const out = {};
  let m;
  const CL = '(\\d{1,2})(?::(\\d{2}))?\\s*(a\\.?m\\.?|p\\.?m\\.?)?';
  if ((m = t.match(new RegExp(`\\b(?:after|post|from|later than|not before)\\s+${CL}`)))) {
    const v = clock(m[1], m[2], m[3]); if (v != null && (m[3] || m[2] || +m[1] > 12 || /after|post|later|before/.test(m[0]))) out.after = fromMinutes(v);
  }
  if ((m = t.match(new RegExp(`\\b(?:before|by|earlier than|not after)\\s+${CL}`)))) {
    const v = clock(m[1], m[2], m[3]); if (v != null) out.before = fromMinutes(v);
  }
  if (!out.after && !out.before && (m = t.match(new RegExp(`\\b(?:at|around|about|approx(?:imately)?|leaving at|departing at|leave at)\\s+${CL}`)))) {
    const v = clock(m[1], m[2], m[3]); if (v != null && (m[3] || m[2] || +m[1] > 12)) out.around = fromMinutes(v);
  }
  if (!out.after && !out.before && !out.around) {
    for (const name of ['late night', 'early morning', 'morning', 'afternoon', 'evening', 'night']) {
      const re = name === 'night' ? /(?<!late )\bnight\b|\btonight\b/ : new RegExp(`\\b${name}\\b`);
      if (re.test(t)) { out.window = WINDOWS[name]; break; }
    }
  }
  return Object.keys(out).length ? out : null;
}

/** Does a train departing at HH:MM satisfy the preference? */
export function departureMatches(hhmm, pref) {
  if (!pref) return true;
  const dep = toMinutes(hhmm);
  if (pref.window) {
    const a = toMinutes(pref.window.from), b = pref.window.to === '24:00' ? 1440 : toMinutes(pref.window.to);
    return a <= b ? dep >= a && dep < b : dep >= a || dep < b;
  }
  if (pref.after && dep < toMinutes(pref.after)) return false;
  if (pref.before && dep > toMinutes(pref.before)) return false;
  if (pref.around) return Math.abs(dep - toMinutes(pref.around)) <= 120;
  return true;
}
export function describeTimePreference(pref) {
  if (!pref) return '';
  if (pref.window) return pref.window.label;
  if (pref.after && pref.before) return `between ${pref.after} and ${pref.before}`;
  if (pref.after) return `after ${pref.after}`;
  if (pref.before) return `before ${pref.before}`;
  if (pref.around) return `around ${pref.around}`;
  return '';
}
