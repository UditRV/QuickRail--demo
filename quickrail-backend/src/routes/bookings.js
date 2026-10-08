import { Router } from 'express';
import { z } from 'zod';
import { query, withTransaction } from '../db/pool.js';
import { requireAuth } from '../middleware/auth.js';
import { generatePnr, computeFare } from '../utils/pnr.js';

export const bookingsRouter = Router();
bookingsRouter.use(requireAuth);

const passengerSchema = z.object({
  name: z.string().min(1),
  age: z.number().int().min(0).max(120),
  gender: z.enum(['Male', 'Female', 'Transgender']),
  berthPreference: z.string().optional(),
  mealOption: z.string().optional(),
  isSeniorCitizenQuota: z.boolean().optional(),
  isChildWithoutBerth: z.boolean().optional(),
});

const createBookingSchema = z.object({
  trainNumber: z.string(),
  classCode: z.string(),
  journeyDate: z.string(), // YYYY-MM-DD
  fromStationCode: z.string(),
  toStationCode: z.string(),
  quota: z.string().default('GN'),
  contactMobile: z.string(),
  contactEmail: z.string().email(),
  preferredCoach: z.string().optional(),
  autoUpgradation: z.boolean().optional(),
  bookOnlyIfConfirm: z.boolean().optional(),
  quickRailAssured: z.boolean().optional(),
  travelInsurance: z.boolean().optional(),
  passengers: z.array(passengerSchema).min(1).max(6),
});

// POST /api/bookings — creates a PENDING booking, allots seats/RAC/WL atomically,
// and holds a 8-minute payment window (mirrors the frontend's payment gateway timer).
bookingsRouter.post('/', async (req, res) => {
  const parsed = createBookingSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() });
  }
  try {
    const result = await createPendingBooking(req.userId, parsed.data);
    const full = await fetchBookingDetail(result.id, req.userId);
    res.status(201).json({ booking: full });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    console.error(err);
    res.status(500).json({ error: 'Booking creation failed' });
  }
});

bookingsRouter.get('/mine', async (req, res) => {
  try {
    const result = await query(
      `SELECT b.*, t.number AS train_number, t.name AS train_name
       FROM bookings b JOIN trains t ON t.id = b.train_id
       WHERE b.user_id = $1 ORDER BY b.booking_time DESC`,
      [req.userId]
    );
    res.json({ bookings: result.rows.map(serializeBookingRow) });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch bookings' });
  }
});

bookingsRouter.get('/:id', async (req, res) => {
  try {
    const booking = await fetchBookingDetail(req.params.id, req.userId);
    if (!booking) return res.status(404).json({ error: 'Booking not found' });
    res.json({ booking });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch booking' });
  }
});

// Cancel a booking — releases held seats back into availability and refunds to wallet if paid.
bookingsRouter.post('/:id/cancel', async (req, res) => {
  try {
    const result = await cancelBookingForUser(req.userId, req.params.id);
    const full = await fetchBookingDetail(result.id, req.userId);
    res.json({ booking: full });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    console.error(err);
    res.status(500).json({ error: 'Cancellation failed' });
  }
});

/**
 * Creates a PENDING booking, allots seats/RAC/WL atomically and holds an 8-minute payment window.
 * Shared by POST /api/bookings and the QuickRail AI agent. `data` is re-validated here, so every caller
 * gets the same checks. Returns the raw bookings row.
 */
export async function createPendingBooking(userId, input) {
  const data = createBookingSchema.parse(input);
  return withTransaction(async (client) => {
    const trainResult = await client.query('SELECT * FROM trains WHERE number = $1', [data.trainNumber]);
    if (trainResult.rowCount === 0) throw httpError(404, 'Train not found');
    const train = trainResult.rows[0];

    const classResult = await client.query(
      'SELECT * FROM train_classes WHERE train_id = $1 AND class_code = $2 FOR UPDATE',
      [train.id, data.classCode]
    );
    if (classResult.rowCount === 0) throw httpError(404, 'Class not found for this train');
    const trainClass = classResult.rows[0];

    let availResult = await client.query(
      'SELECT * FROM class_availability WHERE train_class_id = $1 AND journey_date = $2 FOR UPDATE',
      [trainClass.id, data.journeyDate]
    );
    let availability;
    if (availResult.rowCount === 0) {
      const inserted = await client.query(
        `INSERT INTO class_availability (train_class_id, journey_date, available_seats, rac_available, waitlist_count)
         VALUES ($1,$2,$3,$4,0) RETURNING *`,
        [trainClass.id, data.journeyDate, trainClass.total_seats, trainClass.rac_seats]
      );
      availability = inserted.rows[0];
    } else {
      availability = availResult.rows[0];
    }

    const { baseAmount, convenienceFee, gstAmount, totalAmount } = computeFare({
      basePrice: Number(trainClass.base_price),
      passengerCount: data.passengers.length,
    });

    const pnr = generatePnr();
    const expiresAt = new Date(Date.now() + 8 * 60 * 1000); // 8-minute payment lock, matches frontend timer

    const bookingInsert = await client.query(
      `INSERT INTO bookings (user_id, pnr, train_id, class_code, journey_date, from_station_code, to_station_code,
         quota, contact_mobile, contact_email, preferred_coach, auto_upgradation, book_only_if_confirm,
         quick_rail_assured, travel_insurance, base_amount, convenience_fee, gst_amount, total_amount,
         status, expires_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,'PENDING',$20)
       RETURNING *`,
      [userId, pnr, train.id, data.classCode, data.journeyDate, data.fromStationCode, data.toStationCode,
       data.quota, data.contactMobile, data.contactEmail, data.preferredCoach ?? null,
       !!data.autoUpgradation, !!data.bookOnlyIfConfirm, !!data.quickRailAssured, !!data.travelInsurance,
       baseAmount, convenienceFee, gstAmount, totalAmount, expiresAt]
    );
    const booking = bookingInsert.rows[0];

    // Allot each passenger a seat status against remaining capacity (seats are held, not yet confirmed-paid)
    let available = availability.available_seats;
    let rac = availability.rac_available;
    let waitlist = availability.waitlist_count;

    for (const p of data.passengers) {
      let status, seatLabel = null;
      if (available > 0) {
        status = 'CNF';
        seatLabel = `Coach ${data.preferredCoach || autoCoach(data.classCode)} / Berth ${randomBerthNumber()}`;
        available -= 1;
      } else if (rac > 0) {
        status = 'RAC';
        rac -= 1;
      } else {
        status = 'WL';
        waitlist += 1;
      }

      await client.query(
        `INSERT INTO passengers (booking_id, name, age, gender, berth_preference, meal_option,
           is_senior_citizen_quota, is_child_without_berth, allotted_status, allotted_seat)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
        [booking.id, p.name, p.age, p.gender, p.berthPreference ?? null, p.mealOption ?? null,
         !!p.isSeniorCitizenQuota, !!p.isChildWithoutBerth, status, seatLabel]
      );
    }

    await client.query(
      `UPDATE class_availability SET available_seats = $1, rac_available = $2, waitlist_count = $3
       WHERE id = $4`,
      [available, rac, waitlist, availability.id]
    );

    return booking;
  });
}

/** Cancels a booking owned by userId (ownership enforced in SQL), releases seats, refunds 75% to the wallet if paid. */
export async function cancelBookingForUser(userId, bookingId) {
  return withTransaction(async (client) => {
    const bookingResult = await client.query(
      'SELECT * FROM bookings WHERE id = $1 AND user_id = $2 FOR UPDATE',
      [bookingId, userId]
    );
    if (bookingResult.rowCount === 0) throw httpError(404, 'Booking not found');
    const booking = bookingResult.rows[0];
    if (booking.status === 'CANCELLED') throw httpError(409, 'Booking already cancelled');

    const passengers = await client.query('SELECT * FROM passengers WHERE booking_id = $1', [booking.id]);
    const classResult = await client.query(
      'SELECT * FROM train_classes WHERE train_id = $1 AND class_code = $2',
      [booking.train_id, booking.class_code]
    );
    const trainClass = classResult.rows[0];

    const availResult = await client.query(
      'SELECT * FROM class_availability WHERE train_class_id = $1 AND journey_date = $2 FOR UPDATE',
      [trainClass.id, booking.journey_date]
    );
    const availability = availResult.rows[0];

    let available = availability.available_seats;
    let rac = availability.rac_available;
    let waitlist = availability.waitlist_count;
    for (const p of passengers.rows) {
      if (p.allotted_status === 'CNF') available += 1;
      else if (p.allotted_status === 'RAC') rac += 1;
      else waitlist = Math.max(0, waitlist - 1);
    }
    await client.query(
      'UPDATE class_availability SET available_seats = $1, rac_available = $2, waitlist_count = $3 WHERE id = $4',
      [available, rac, waitlist, availability.id]
    );

    await client.query(`UPDATE bookings SET status = 'CANCELLED' WHERE id = $1`, [booking.id]);

    // Refund to wallet if the booking had been paid
    const paidPayment = await client.query(
      `SELECT * FROM payments WHERE booking_id = $1 AND status = 'PAID' ORDER BY paid_at DESC LIMIT 1`,
      [booking.id]
    );
    if (paidPayment.rowCount > 0) {
      const refundAmount = Number(booking.total_amount) * 0.75; // simplified IRCTC-style cancellation charge
      const userResult = await client.query('SELECT wallet_balance FROM users WHERE id = $1 FOR UPDATE', [userId]);
      const newBalance = Number(userResult.rows[0].wallet_balance) + refundAmount;
      await client.query('UPDATE users SET wallet_balance = $1 WHERE id = $2', [newBalance, userId]);
      await client.query(
        `INSERT INTO wallet_transactions (user_id, type, amount, balance_after, reference)
         VALUES ($1,'REFUND',$2,$3,$4)`,
        [userId, refundAmount, newBalance, `Refund for PNR ${booking.pnr}`]
      );
      await client.query(`UPDATE payments SET status = 'REFUNDED' WHERE id = $1`, [paidPayment.rows[0].id]);
    }

    return booking;
  });
}

export async function fetchBookingDetail(bookingId, userId) {
  const bookingResult = await query(
    `SELECT b.*, t.number AS train_number, t.name AS train_name, t.departure_time, t.arrival_time,
            t.duration, t.badge
     FROM bookings b JOIN trains t ON t.id = b.train_id
     WHERE b.id = $1 AND b.user_id = $2`,
    [bookingId, userId]
  );
  if (bookingResult.rowCount === 0) return null;
  const booking = bookingResult.rows[0];

  const passengers = await query('SELECT * FROM passengers WHERE booking_id = $1', [bookingId]);
  const payments = await query(
    'SELECT * FROM payments WHERE booking_id = $1 ORDER BY created_at DESC',
    [bookingId]
  );

  return {
    ...serializeBookingRow(booking),
    passengers: passengers.rows.map((p) => ({
      id: p.id,
      name: p.name,
      age: p.age,
      gender: p.gender,
      berthPreference: p.berth_preference,
      mealOption: p.meal_option,
      isSeniorCitizenQuota: p.is_senior_citizen_quota,
      isChildWithoutBerth: p.is_child_without_berth,
      allottedStatus: p.allotted_status,
      allottedSeat: p.allotted_seat,
    })),
    payments: payments.rows.map((pay) => ({
      id: pay.id,
      method: pay.method,
      amount: Number(pay.amount),
      status: pay.status,
      razorpayOrderId: pay.razorpay_order_id,
      razorpayPaymentId: pay.razorpay_payment_id,
      bankRefNumber: pay.bank_ref_number,
      paidAt: pay.paid_at,
    })),
  };
}

function serializeBookingRow(b) {
  return {
    id: b.id,
    pnr: b.pnr,
    trainNumber: b.train_number,
    trainName: b.train_name,
    classCode: b.class_code,
    journeyDate: b.journey_date,
    fromStationCode: b.from_station_code,
    toStationCode: b.to_station_code,
    quota: b.quota,
    contactMobile: b.contact_mobile,
    contactEmail: b.contact_email,
    preferredCoach: b.preferred_coach,
    autoUpgradation: b.auto_upgradation,
    bookOnlyIfConfirm: b.book_only_if_confirm,
    quickRailAssured: b.quick_rail_assured,
    travelInsurance: b.travel_insurance,
    baseAmount: Number(b.base_amount),
    convenienceFee: Number(b.convenience_fee),
    gstAmount: Number(b.gst_amount),
    totalAmount: Number(b.total_amount),
    status: b.status,
    bookingTime: b.booking_time,
    expiresAt: b.expires_at,
  };
}

function autoCoach(classCode) {
  const map = { '1A': 'H1', '2A': 'A1', '3A': 'B4', SL: 'S6', CC: 'C3', EC: 'E1', '3E': 'M1' };
  return map[classCode] || 'B1';
}

function randomBerthNumber() {
  return Math.floor(Math.random() * 72) + 1;
}

function httpError(status, message) {
  const err = new Error(message);
  err.status = status;
  return err;
}
