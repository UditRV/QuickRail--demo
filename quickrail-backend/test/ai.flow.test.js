import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import * as h from './helpers.js';

let pool, srv;
before(async () => { pool = await h.setupDb(); srv = await h.startServer(); });
after(async () => { await srv.close(); await pool.end(); });

const newUser = async (name) => { const u = await h.registerUser(srv.base, name); return { ...u, c: h.client(srv.base, u.token) }; };
const fund = (id, amt = 20000) => pool.query('UPDATE users SET wallet_balance = $1 WHERE id = $2', [amt, id]);

/** Drive the chat from a request up to the payment card (hold placed, nothing charged). */
async function toPayment(u, { from = 'Mumbai', to = 'Pune', cls = 'SL', pax = 1 } = {}) {
  let r = await u.c.say(`Book ${from} to ${to} tomorrow for ${pax} passenger${pax > 1 ? 's' : ''} in ${cls}`);
  assert.ok(h.cardOf(r, 'trains'), 'trains shown');
  r = await u.c.say('1');
  const names = ['Udit Vishwakarma', 'Rahul Sharma', 'Priya Sharma', 'Anil Kumar'];
  r = await u.c.act({ type: 'SUBMIT_PASSENGERS', passengers: Array.from({ length: pax }, (_, i) => h.goodPassenger(names[i])) });
  const summary = h.cardOf(r, 'summary'); assert.ok(summary, 'summary shown');
  r = await u.c.act({ type: 'CONFIRM_BOOKING', token: summary.token });
  return { r, summary, pay: h.cardOf(r, 'payment') };
}

test('basic booking: asks only what is missing, then books end-to-end (DoD 1–16)', async () => {
  const u = await newUser();
  let r = await u.c.say('Book Mumbai to Pune tomorrow.');
  assert.match(h.text(r), /How many passengers/i);
  assert.equal(r.body.stage, 'COLLECTING_JOURNEY');
  r = await u.c.say('1');
  assert.match(h.text(r), /Which class/i);
  r = await u.c.say('SL');
  const trains = h.cardOf(r, 'trains');
  assert.ok(trains.trains.length >= 1 && trains.trains.length <= 5);
  assert.equal(trains.date, h.tomorrowISO());
  assert.match(h.text(r), /tomorrow/);                     // interpreted date echoed back
  assert.equal(r.body.stage, 'SHOWING_TRAINS');
  assert.ok(trains.trains.every((t) => t.fromName === 'Chhatrapati Shivaji Maharaj Terminus' && t.toName === 'Pune Junction'));

  r = await u.c.say('2');
  assert.equal(r.body.stage, 'COLLECTING_PASSENGERS');
  const form = h.cardOf(r, 'passengerForm'); assert.equal(form.count, 1);
  r = await u.c.act({ type: 'SUBMIT_PASSENGERS', passengers: [{ ...h.goodPassenger(), save: true }] });
  const summary = h.cardOf(r, 'summary');
  assert.equal(r.body.stage, 'AWAITING_USER_CONFIRMATION');
  assert.equal(summary.passengers.length, 1); assert.ok(summary.fare.totalAmount > 0); assert.equal(summary.dateLong.split(' ').length, 3);

  // 'yes' → seat HOLD only. No payment row, wallet untouched.
  await fund(u.id, 5000);
  r = await u.c.say('yes');
  assert.equal(r.body.stage, 'PAYMENT');
  const pay = h.cardOf(r, 'payment');
  const noPay = await pool.query('SELECT count(*)::int n FROM payments WHERE booking_id = $1', [pay.bookingId]);
  assert.equal(noPay.rows[0].n, 0, 'agent must not create any payment');
  assert.equal(Number((await pool.query('SELECT wallet_balance FROM users WHERE id=$1', [u.id])).rows[0].wallet_balance), 5000);
  assert.ok(!r.body.message.cards.some((c) => c.type === 'confirmation'));

  // The USER pays through the existing payment endpoint.
  const paid = await u.c.post('/api/payments/create-order', { bookingId: pay.bookingId, method: 'wallet' });
  assert.equal(paid.status, 200);
  r = await u.c.act({ type: 'PAYMENT_RESULT', outcome: 'success' });
  const conf = h.cardOf(r, 'confirmation');
  assert.equal(r.body.stage, 'CONFIRMED'); assert.equal(conf.confirmed, true); assert.match(conf.pnr, /^\d{3}-\d{7}$/);

  // appears in My Bookings (both the existing API and the chat)
  const mine = await u.c.get('/api/bookings/mine');
  assert.ok(mine.body.bookings.some((b) => b.pnr === conf.pnr && b.status === 'CONFIRMED'));
  r = await u.c.say('show my bookings');
  assert.ok(h.cardOf(r, 'bookings').bookings.some((b) => b.pnr === conf.pnr));

  // saved passenger now usable: "Book for me and ..." resolves from profile
  const saved = await pool.query('SELECT name FROM saved_passengers WHERE user_id=$1', [u.id]);
  assert.equal(saved.rowCount, 1);
});

test('missing information: asks for the source first, one question at a time', async () => {
  const u = await newUser();
  let r = await u.c.say('Book me a ticket.');
  assert.match(h.text(r), /travelling from/i);
  r = await u.c.say('Surat');
  assert.match(h.text(r), /where would you like to go/i);
  r = await u.c.say('Mumbai Central');
  assert.match(h.text(r), /Which date/i);      // never invents a date
  assert.equal(r.body.state.date, null);
});

test('ambiguous station: asks which Mumbai→Delhi route, restricted to routes that really have trains', async () => {
  const u = await newUser();
  let r = await u.c.say('Book Mumbai to Delhi tomorrow.');
  const choice = h.cardOf(r, 'routeChoice');
  assert.ok(choice.options.length >= 2);
  assert.ok(choice.options.every((o) => /Mumbai|Chhatrapati|Bandra/.test(o.from.name + o.from.city) ));
  assert.match(h.text(r), /more than one station/i);
  r = await u.c.act({ type: 'CHOOSE_ROUTE', from: 'MMCT', to: 'NDLS' });
  assert.match(h.text(r), /How many passengers/i);
  assert.equal(r.body.state.source, 'Mumbai Central');
  // a route that wasn't offered is rejected
  const bad = await newUser(); await bad.c.say('Book Mumbai to Delhi tomorrow.');
  const rr = await bad.c.act({ type: 'CHOOSE_ROUTE', from: 'HWH', to: 'PURI' });
  assert.match(h.text(rr), /isn’t one of the options/);
});

test('a city with only one useful station is resolved without needless questions', async () => {
  const u = await newUser();
  const r = await u.c.say('Find trains from Mumbai to Pune tomorrow');
  assert.ok(h.cardOf(r, 'trains'));
  assert.match(h.text(r), /Using .* the only direct route/);
});

test('unknown station: says so rather than inventing one', async () => {
  const u = await newUser();
  const r = await u.c.say('Find trains from Mumbai to Atlantis tomorrow');
  assert.match(h.text(r), /couldn't find a station matching “atlantis”/i);
  assert.ok(!h.cardOf(r, 'trains'));
});

test('class change keeps everything else (only class updated)', async () => {
  const u = await newUser();
  let r = await u.c.say('Book Mumbai Central to Delhi tomorrow for 2 in 3A');
  const before = r.body.state;
  assert.equal(before.classCode, '3A');
  r = await u.c.say('Make it 2A.');
  const after = r.body.state;
  assert.equal(after.classCode, '2A');
  assert.deepEqual([after.source, after.destination, after.date, after.passengers], [before.source, before.destination, before.date, before.passengers]);
  assert.ok(h.cardOf(r, 'trains').trains.every((t) => t.classes.length === 1 && t.classes[0].classCode === '2A'));
});

test('passenger change: add one more passenger from the summary', async () => {
  const u = await newUser();
  let r = await u.c.say('Book Mumbai to Pune tomorrow for 1 in SL'); r = await u.c.say('1');
  r = await u.c.act({ type: 'SUBMIT_PASSENGERS', passengers: [h.goodPassenger()] });
  assert.ok(h.cardOf(r, 'summary'));
  r = await u.c.say('Add one more passenger');
  assert.equal(r.body.state.passengers, 2);
  const form = h.cardOf(r, 'passengerForm'); assert.equal(form.count, 2); assert.equal(form.current.length, 1);
  assert.equal(r.body.stage, 'COLLECTING_PASSENGERS');
  // wrong count is rejected
  r = await u.c.act({ type: 'SUBMIT_PASSENGERS', passengers: [h.goodPassenger()] });
  assert.match(h.text(r), /exactly that many/);
  r = await u.c.act({ type: 'SUBMIT_PASSENGERS', passengers: [h.goodPassenger(), h.goodPassenger('Rahul Sharma')] });
  assert.equal(h.cardOf(r, 'summary').passengers.length, 2);
});

test('cheapest and fastest rank by the right metric', async () => {
  const u = await newUser();
  let r = await u.c.say('Find the cheapest train from Mumbai Central to Delhi tomorrow');
  const t = h.cardOf(r, 'trains').trains;
  const fares = t.map((x) => Math.min(...x.classes.map((c) => c.fare)));
  const bookable = t.filter((x) => x.classes.some((c) => c.availability === 'AVAILABLE'));
  assert.equal(Math.min(...bookable.map((x) => Math.min(...x.classes.map((c) => c.fare)))), Math.min(...fares.slice(0, bookable.length)));
  assert.equal(t[0].tag, 'Cheapest');
  r = await u.c.say('Find the fastest train');
  const f = h.cardOf(r, 'trains').trains;
  const bk = f.filter((x) => x.classes.some((c) => c.availability === 'AVAILABLE'));
  assert.deepEqual(bk.map((x) => x.durationMin), [...bk.map((x) => x.durationMin)].sort((a, b) => a - b));
  assert.equal(f[0].tag, 'Fastest');
  assert.equal(f[0].trainNumber, '12951');   // 15h35 beats 17h45 / 17h55
});

test('date modification mid-flow: "Actually, make it next Monday"', async () => {
  const u = await newUser();
  await u.c.say('Find trains from Mumbai Central to Surat tomorrow');
  const r = await u.c.say('Actually, make it next Monday.');
  assert.match(r.body.state.date, /^2026-\d\d-\d\d$/);
  const d = new Date(`${r.body.state.date}T00:00:00Z`);
  assert.equal(d.getUTCDay(), 1);
  assert.ok(h.cardOf(r, 'trains'));
  assert.equal(r.body.state.source, 'Mumbai Central');
});

test('past dates and out-of-range dates are refused', async () => {
  const u = await newUser();
  let r = await u.c.say('Find trains from Mumbai Central to Surat on 1 January 2020');
  assert.match(h.text(r), /already passed/);
  r = await u.c.say('Find trains from Mumbai Central to Surat on 31 Feb');
  assert.match(h.text(r), /valid date/);
});

test('no trains → offers nearby dates', async () => {
  const u = await newUser();
  const r = await u.c.say('Find trains from Chennai to Puri tomorrow');
  assert.match(h.text(r), /couldn't find any direct trains|couldn't find any trains/);
});

test('no availability: waitlisted class is flagged, and the summary warns', async () => {
  const u = await newUser();
  let r = await u.c.say('Book Mumbai Central to Delhi tomorrow for 1 in 3A');
  const wl = h.cardOf(r, 'trains').trains.find((t) => t.trainNumber === '12953');
  assert.equal(wl.classes[0].availability, 'WL');
  assert.equal(h.cardOf(r, 'trains').trains[h.cardOf(r, 'trains').trains.length - 1].trainNumber, '12953', 'WL ranked last');
  const idx = h.cardOf(r, 'trains').trains.findIndex((t) => t.trainNumber === '12953') + 1;
  r = await u.c.say(String(idx));
  r = await u.c.act({ type: 'SUBMIT_PASSENGERS', passengers: [h.goodPassenger()] });
  assert.match(h.cardOf(r, 'summary').warning, /waiting list/i);
});

test('cancellation requires explicit confirmation, refunds, and only touches own booking', async () => {
  const u = await newUser();
  const { pay } = await toPayment(u); await fund(u.id);
  await u.c.post('/api/payments/create-order', { bookingId: pay.bookingId, method: 'wallet' });
  let r = await u.c.act({ type: 'PAYMENT_RESULT', outcome: 'success' });
  const pnr = h.cardOf(r, 'confirmation').pnr;
  r = await u.c.say('Cancel my ticket.');
  const cc = h.cardOf(r, 'cancelConfirm');
  assert.equal(cc.pnr, pnr); assert.ok(cc.refund > 0);
  assert.equal((await pool.query('SELECT status FROM bookings WHERE id=$1', [pay.bookingId])).rows[0].status, 'CONFIRMED', 'not cancelled before confirmation');
  r = await u.c.say('no');
  assert.match(h.text(r), /unchanged/);
  assert.equal((await pool.query('SELECT status FROM bookings WHERE id=$1', [pay.bookingId])).rows[0].status, 'CONFIRMED');
  r = await u.c.say('Cancel my booking'); const cc2 = h.cardOf(r, 'cancelConfirm');
  r = await u.c.act({ type: 'CANCEL_CONFIRM', token: cc2.token });
  assert.match(h.text(r), /has been cancelled/);
  assert.equal((await pool.query('SELECT status FROM bookings WHERE id=$1', [pay.bookingId])).rows[0].status, 'CANCELLED');
  const log = await pool.query(`SELECT action FROM ai_audit_log WHERE user_id=$1`, [u.id]);
  assert.ok(['HOLD_CREATED', 'BOOKING_COMPLETED', 'CANCEL_REQUESTED', 'CANCELLED'].every((a) => log.rows.some((x) => x.action === a)));
});

test('payment failure: ticket is NOT confirmed, hold stays retryable', async () => {
  const u = await newUser(); // wallet = 0 → real insufficient-funds failure from the existing payment API
  const { pay } = await toPayment(u);
  const attempt = await u.c.post('/api/payments/create-order', { bookingId: pay.bookingId, method: 'wallet' });
  assert.equal(attempt.status, 402);
  let r = await u.c.act({ type: 'PAYMENT_RESULT', outcome: 'failed' });
  assert.match(h.text(r), /payment wasn’t completed\. Your ticket has not been confirmed/);
  assert.ok(!h.cardOf(r, 'confirmation')); assert.ok(h.cardOf(r, 'payment'));
  assert.equal(r.body.stage, 'PAYMENT');
  assert.equal((await pool.query('SELECT status FROM bookings WHERE id=$1', [pay.bookingId])).rows[0].status, 'PENDING');
});

test('client claiming "success" without a real payment is not believed', async () => {
  const u = await newUser();
  await toPayment(u);
  const r = await u.c.act({ type: 'PAYMENT_RESULT', outcome: 'success' });
  assert.match(h.text(r), /has not been confirmed/);
  assert.ok(!h.cardOf(r, 'confirmation')); assert.notEqual(r.body.stage, 'CONFIRMED');
});

test('booking failure: backend error → honest message, no confirmation', async () => {
  const u = await newUser();
  let r = await u.c.say('Book Mumbai to Pune tomorrow for 1 in SL'); r = await u.c.say('1');
  r = await u.c.act({ type: 'SUBMIT_PASSENGERS', passengers: [h.goodPassenger()] });
  const summary = h.cardOf(r, 'summary');
  // simulate the booking API failing at the moment of confirmation (bookings table unavailable)
  await pool.query('ALTER TABLE bookings RENAME TO bookings_x');
  try { r = await u.c.act({ type: 'CONFIRM_BOOKING', token: summary.token }); }
  finally { await pool.query('ALTER TABLE bookings_x RENAME TO bookings'); }
  assert.match(h.text(r), /booking could not be completed/i);
  assert.ok(!h.cardOf(r, 'confirmation')); assert.ok(!h.cardOf(r, 'payment'));
});

test('fare/availability changed between summary and confirmation → re-confirm, no hold', async () => {
  const u = await newUser();
  let r = await u.c.say('Book Mumbai to Pune tomorrow for 1 in SL'); r = await u.c.say('1');
  r = await u.c.act({ type: 'SUBMIT_PASSENGERS', passengers: [h.goodPassenger()] });
  const summary = h.cardOf(r, 'summary');
  await pool.query(`UPDATE train_classes SET base_price = base_price + 50 WHERE class_code='SL' AND train_id IN (SELECT id FROM trains WHERE from_station_code='CSMT' AND to_station_code='PUNE')`);
  r = await u.c.act({ type: 'CONFIRM_BOOKING', token: summary.token });
  await pool.query(`UPDATE train_classes SET base_price = base_price - 50 WHERE class_code='SL' AND train_id IN (SELECT id FROM trains WHERE from_station_code='CSMT' AND to_station_code='PUNE')`);
  assert.match(h.text(r), /fare or availability changed/);
  assert.equal(r.body.stage, 'AWAITING_USER_CONFIRMATION');
  assert.equal((await pool.query('SELECT count(*)::int n FROM bookings WHERE user_id=$1', [u.id])).rows[0].n, 0);
});

test('refresh survival: session + current card restored from state', async () => {
  const u = await newUser();
  await u.c.say('Book Mumbai to Pune tomorrow for 1 in SL');
  const s = await u.c.get('/api/ai/session');
  assert.equal(s.body.stage, 'SHOWING_TRAINS'); assert.ok(s.body.current.cards.some((c) => c.type === 'trains'));
  assert.ok(s.body.messages.length >= 2);
  await u.c.say('1');
  const s2 = await u.c.get('/api/ai/session');
  assert.equal(s2.body.stage, 'COLLECTING_PASSENGERS'); assert.ok(s2.body.current.cards.some((c) => c.type === 'passengerForm'));
  // reset releases/clears
  await u.c.post('/api/ai/session/reset', {});
  assert.equal((await u.c.get('/api/ai/session')).body.stage, 'IDLE');
});

test('abort during PAYMENT releases the unpaid hold and restores seats', async () => {
  const u = await newUser();
  let r = await u.c.say('Book Mumbai to Pune tomorrow for 1 in SL'); r = await u.c.say('1');
  assert.equal(r.body.stage, 'COLLECTING_PASSENGERS');
  const chosen = r.body.state.selectedTrain; assert.ok(chosen);
  const before = Number((await pool.query(`SELECT ca.available_seats FROM class_availability ca JOIN train_classes tc ON tc.id=ca.train_class_id JOIN trains t ON t.id=tc.train_id WHERE t.number=$1 AND tc.class_code='SL' AND ca.journey_date=$2`, [chosen, h.tomorrowISO()])).rows[0].available_seats);
  r = await u.c.act({ type: 'SUBMIT_PASSENGERS', passengers: [h.goodPassenger()] });
  r = await u.c.act({ type: 'CONFIRM_BOOKING', token: h.cardOf(r, 'summary').token });
  const pay = h.cardOf(r, 'payment');
  const held = Number((await pool.query(`SELECT ca.available_seats FROM class_availability ca JOIN train_classes tc ON tc.id=ca.train_class_id JOIN trains t ON t.id=tc.train_id WHERE t.number=$1 AND tc.class_code='SL' AND ca.journey_date=$2`, [chosen, h.tomorrowISO()])).rows[0].available_seats);
  assert.equal(held, before - 1, 'hold takes a seat');
  r = await u.c.say('cancel');
  assert.match(h.text(r), /nothing was charged/);
  assert.equal((await pool.query('SELECT status FROM bookings WHERE id=$1', [pay.bookingId])).rows[0].status, 'CANCELLED');
  const after = Number((await pool.query(`SELECT ca.available_seats FROM class_availability ca JOIN train_classes tc ON tc.id=ca.train_class_id JOIN trains t ON t.id=tc.train_id WHERE t.number=$1 AND tc.class_code='SL' AND ca.journey_date=$2`, [chosen, h.tomorrowISO()])).rows[0].available_seats);
  assert.equal(after, before, 'seat released');
});

test('structured search endpoint returns spec-shaped data', async () => {
  const u = await newUser();
  const r = await u.c.get(`/api/ai/search?from=Mumbai%20Central&to=New%20Delhi&date=${h.tomorrowISO()}&class=3A&passengers=1&pref=CHEAPEST`);
  assert.equal(r.status, 200);
  const t = r.body.trains[0];
  assert.deepEqual(Object.keys(t).sort(), ['arrival', 'availability', 'availableSeats', 'class', 'departure', 'duration', 'fare', 'trainName', 'trainNumber'].sort());
  assert.ok(['AVAILABLE', 'RAC', 'WL'].includes(t.availability));
});
