// The ONLY way the agent touches QuickRail data. Every function goes through the same services/routes
// the website uses; the agent never writes SQL against booking/payment tables itself.
// userId always comes from the verified JWT (req.userId) — never from message text.
import { query } from '../db/pool.js';
import { searchTrainsRaw } from '../services/trainSearch.js';
import { createPendingBooking, cancelBookingForUser, fetchBookingDetail } from '../routes/bookings.js';
import { computeFare } from '../utils/pnr.js';
import { searchStations as searchStationsDb, getStation } from './stations.js';
import { toTrainView } from './ranking.js';

export const searchStations = (q, limit) => searchStationsDb(q, limit);

export async function searchTrains({ source, destination, date, classCode = null, passengers = 1 }) {
  const [from, to] = await Promise.all([getStation(source), getStation(destination)]);
  const names = { [source]: from?.name, [destination]: to?.name };
  const trains = await searchTrainsRaw(source, destination, date);
  return trains.map((t) => toTrainView(t, { passengers, classCode, stationNames: names })).filter(Boolean);
}

/** Which (from,to) station pairs actually have direct trains — used to resolve "Mumbai → Delhi". */
export async function routesWithTrains(fromCodes, toCodes) {
  const r = await query(
    `SELECT DISTINCT from_station_code AS f, to_station_code AS t FROM trains
     WHERE from_station_code = ANY($1) AND to_station_code = ANY($2)`,
    [fromCodes, toCodes]
  );
  return r.rows.map((x) => ({ from: x.f, to: x.t }));
}

export async function checkAvailability({ source, destination, date, trainNumber, classCode, passengers = 1 }) {
  const views = await searchTrains({ source, destination, date, classCode, passengers });
  const v = views.find((x) => x.trainNumber === trainNumber);
  return v ? { train: v, class: v.classes[0] } : null;
}

export async function getTrainDetails(trainNumber) {
  const r = await query('SELECT number, name, badge, departure_time, arrival_time, duration FROM trains WHERE number = $1', [trainNumber]);
  return r.rows[0] || null;
}

export function calculateFare({ basePrice, passengerCount }) {
  return computeFare({ basePrice, passengerCount });
}
export const getFare = calculateFare;

export async function getSavedPassengers(userId) {
  const r = await query(
    `SELECT id, name, age, gender, berth_preference, is_self FROM saved_passengers WHERE user_id = $1 ORDER BY is_self DESC, created_at LIMIT 30`,
    [userId]
  );
  return r.rows.map((p) => ({ id: p.id, name: p.name, age: p.age, gender: p.gender, berthPreference: p.berth_preference, isSelf: p.is_self }));
}
export async function savePassenger(userId, p) {
  const c = await query('SELECT count(*)::int AS n FROM saved_passengers WHERE user_id = $1', [userId]);
  if (c.rows[0].n >= 20) return null;
  const dup = await query('SELECT id FROM saved_passengers WHERE user_id = $1 AND lower(name) = lower($2) AND age = $3', [userId, p.name, p.age]);
  if (dup.rowCount) return dup.rows[0].id;
  const r = await query(
    `INSERT INTO saved_passengers (user_id, name, age, gender, berth_preference) VALUES ($1,$2,$3,$4,$5) RETURNING id`,
    [userId, p.name, p.age, p.gender, p.berthPreference ?? null]
  );
  return r.rows[0].id;
}

export async function getUserProfile(userId) {
  const r = await query('SELECT id, name, email, mobile, wallet_balance FROM users WHERE id = $1', [userId]);
  const u = r.rows[0];
  return u ? { id: u.id, name: u.name, email: u.email, mobile: u.mobile, walletBalance: Number(u.wallet_balance) } : null;
}

/** Creates a PENDING (seat-held, unpaid) booking. Money only moves later, via the user's own payment click. */
export const createBooking = (userId, payload) => createPendingBooking(userId, payload);
export const cancelBooking = (userId, bookingId) => cancelBookingForUser(userId, bookingId);
// owner-scoped in SQL; journeyDate normalised to YYYY-MM-DD (pg DATE → JS Date is timezone-fragile)
export async function getBookingStatus(userId, bookingId) {
  const b = await fetchBookingDetail(bookingId, userId);
  if (!b) return null;
  const d = await query(
    `SELECT to_char(b.journey_date,'YYYY-MM-DD') AS d, t.departure_time, t.arrival_time, t.duration, t.badge, t.number
     FROM bookings b JOIN trains t ON t.id = b.train_id WHERE b.id = $1 AND b.user_id = $2`, [bookingId, userId]);
  return { ...b, journeyDate: d.rows[0].d, departureTime: d.rows[0].departure_time, arrivalTime: d.rows[0].arrival_time, duration: d.rows[0].duration, badge: d.rows[0].badge };
}

export async function getUserBookings(userId, { activeOnly = false, limit = 10 } = {}) {
  const r = await query(
    `SELECT b.id, b.pnr, b.status, to_char(b.journey_date,'YYYY-MM-DD') AS journey_date, b.class_code, b.total_amount, b.from_station_code, b.to_station_code,
            t.number AS train_number, t.name AS train_name, t.departure_time,
            (SELECT count(*)::int FROM passengers p WHERE p.booking_id = b.id) AS passenger_count,
            EXISTS (SELECT 1 FROM payments pay WHERE pay.booking_id = b.id AND pay.status = 'PAID') AS paid
     FROM bookings b JOIN trains t ON t.id = b.train_id
     WHERE b.user_id = $1 ${activeOnly ? `AND b.status IN ('CONFIRMED','RAC','WAITLIST') AND b.journey_date >= (now() AT TIME ZONE 'Asia/Kolkata')::date` : `AND b.status <> 'EXPIRED'`}
     ORDER BY b.journey_date DESC, b.booking_time DESC LIMIT $2`,
    [userId, limit]
  );
  return r.rows.map((b) => ({
    id: b.id, pnr: b.pnr, status: b.status, journeyDate: b.journey_date,
    classCode: b.class_code, totalAmount: Number(b.total_amount), fromCode: b.from_station_code, toCode: b.to_station_code,
    trainNumber: b.train_number, trainName: b.train_name, departure: b.departure_time, passengerCount: b.passenger_count, paid: b.paid,
  }));
}

/** Owner-scoped PNR lookup — the chat only reveals PNRs booked from the signed-in account. */
export async function getPNR(userId, pnr) {
  const r = await query('SELECT id FROM bookings WHERE pnr = $1 AND user_id = $2', [pnr, userId]);
  return r.rowCount ? getBookingStatus(userId, r.rows[0].id) : null;
}
