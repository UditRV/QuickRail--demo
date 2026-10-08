import test from 'node:test';
import assert from 'node:assert/strict';
import { parseDate, parseTimePreference, departureMatches, formatLongDate } from '../src/ai/dateTime.js';

const NOW = new Date('2026-10-06T08:00:00Z'); // Tuesday 6 Oct 2026, 13:30 IST
const d = (s) => parseDate(s, NOW)?.date;

test('relative dates', () => {
  assert.equal(d('today'), '2026-10-06');
  assert.equal(d('tomorrow evening'), '2026-10-07');
  assert.equal(d('day after tomorrow'), '2026-10-08');
  assert.equal(d('tonight'), '2026-10-06');
  assert.equal(parseDate('tonight', NOW).impliedWindow, 'night');
  assert.equal(d('in 3 days'), '2026-10-09');
});
test('weekdays: this / next / bare', () => {
  assert.equal(d('this Friday'), '2026-10-09');
  assert.equal(d('Saturday'), '2026-10-10');
  assert.equal(d('next Monday'), '2026-10-12');
  assert.equal(d('next Friday'), '2026-10-16');
  assert.equal(d('Tuesday'), '2026-10-06');
});
test('weekends', () => {
  assert.equal(d('this weekend'), '2026-10-10');
  assert.equal(d('next weekend'), '2026-10-17');
});
test('absolute dates, day-first, with and without year', () => {
  for (const s of ['15 October', '15/10/2026', '15 Oct 2026', 'Oct 15th', '15-10-2026', '2026-10-15', '15/10', '15th of October']) assert.equal(d(s), '2026-10-15', s);
  assert.equal(d('5 January'), '2027-01-05'); // already past this year → next year
});
test('invalid dates are flagged, not guessed', () => {
  assert.deepEqual(parseDate('31 Feb', NOW), { invalid: '31 feb' });
  assert.equal(parseDate('book me a train', NOW), null);
});
test('long format shown back to the user', () => assert.equal(formatLongDate('2026-10-06'), '6 October 2026'));

test('time-of-day', () => {
  assert.equal(parseTimePreference('tomorrow evening').window.label, 'evening');
  assert.equal(parseTimePreference('late night').window.label, 'late night');
  assert.equal(parseTimePreference('early morning').window.label, 'early morning');
  assert.equal(parseTimePreference('after 8 PM').after, '20:00');
  assert.equal(parseTimePreference('before 10am').before, '10:00');
  assert.equal(parseTimePreference('tonight').window.label, 'night');
  assert.equal(parseTimePreference('a train to pune'), null);
});
test('departureMatches handles wrap-around windows', () => {
  const late = parseTimePreference('late night');
  assert.ok(departureMatches('23:30', late)); assert.ok(departureMatches('01:15', late)); assert.ok(!departureMatches('12:00', late));
  assert.ok(departureMatches('20:00', { after: '20:00' })); assert.ok(!departureMatches('19:59', { after: '20:00' }));
});
