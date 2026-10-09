import { Router } from 'express';
import crypto from 'crypto';
import Razorpay from 'razorpay';
import { z } from 'zod';
import { query, withTransaction } from '../db/pool.js';
import { requireAuth } from '../middleware/auth.js';
import { fetchBookingDetail } from './bookings.js';

export const paymentsRouter = Router();

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

// POST /api/payments/create-order  { bookingId, method }
paymentsRouter.post('/create-order', requireAuth, async (req, res) => {
  const schema = z.object({
    bookingId: z.string().uuid(),
    method: z.enum(['upi', 'card', 'netbanking', 'wallet']),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid input' });
  const { bookingId, method } = parsed.data;

  try {
    const bookingResult = await query(
      'SELECT * FROM bookings WHERE id = $1 AND user_id = $2',
      [bookingId, req.userId]
    );
    if (bookingResult.rowCount === 0) return res.status(404).json({ error: 'Booking not found' });
    const booking = bookingResult.rows[0];

    if (booking.status !== 'PENDING') {
      return res.status(409).json({ error: `Booking is ${booking.status}, cannot pay` });
    }
    if (new Date(booking.expires_at) < new Date()) {
      return res.status(410).json({ error: 'Payment window expired, please rebook' });
    }

    // Wallet payments are settled instantly — no Razorpay order needed
    if (method === 'wallet') {
      const result = await payWithWallet(req.userId, booking);
      const full = await fetchBookingDetail(booking.id, req.userId);
      return res.json({ method: 'wallet', booking: full, payment: result });
    }

    const amountPaise = Math.round(Number(booking.total_amount) * 100);
    const order = await razorpay.orders.create({
      amount: amountPaise,
      currency: 'INR',
      receipt: `pnr_${booking.pnr}`,
      notes: { bookingId: booking.id, pnr: booking.pnr },
    });

    await query(
      `INSERT INTO payments (booking_id, method, razorpay_order_id, amount, status)
       VALUES ($1,$2,$3,$4,'CREATED')`,
      [booking.id, method, order.id, booking.total_amount]
    );

    res.json({
      method,
      razorpayKeyId: process.env.RAZORPAY_KEY_ID,
      order: { id: order.id, amount: order.amount, currency: order.currency },
      booking: { id: booking.id, pnr: booking.pnr, totalAmount: Number(booking.total_amount) },
      prefill: { email: booking.contact_email, contact: booking.contact_mobile },
    });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    console.error(err);
    res.status(500).json({ error: 'Failed to create payment order' });
  }
});

// POST /api/payments/verify — called by the frontend after Razorpay Checkout succeeds
paymentsRouter.post('/verify', requireAuth, async (req, res) => {
  const schema = z.object({
    razorpay_order_id: z.string(),
    razorpay_payment_id: z.string(),
    razorpay_signature: z.string(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid input' });
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = parsed.data;

  try {
    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest('hex');

    if (expectedSignature !== razorpay_signature) {
      return res.status(400).json({ error: 'Payment signature verification failed' });
    }

    const result = await withTransaction(async (client) => {
      const paymentResult = await client.query(
        'SELECT * FROM payments WHERE razorpay_order_id = $1 FOR UPDATE',
        [razorpay_order_id]
      );
      if (paymentResult.rowCount === 0) throw httpError(404, 'Payment record not found');
      const payment = paymentResult.rows[0];

      const bookingResult = await client.query(
        'SELECT * FROM bookings WHERE id = $1 AND user_id = $2 FOR UPDATE',
        [payment.booking_id, req.userId]
      );
      if (bookingResult.rowCount === 0) throw httpError(404, 'Booking not found');
      const booking = bookingResult.rows[0];

      await client.query(
        `UPDATE payments SET status = 'PAID', razorpay_payment_id = $1, razorpay_signature = $2,
           bank_ref_number = $3, paid_at = now() WHERE id = $4`,
        [razorpay_payment_id, razorpay_signature, `RB${Date.now()}`, payment.id]
      );

      const finalStatus = await deriveBookingStatus(client, booking);
      await client.query('UPDATE bookings SET status = $1 WHERE id = $2', [finalStatus, booking.id]);

      return booking.id;
    });

    const full = await fetchBookingDetail(result, req.userId);
    res.json({ booking: full });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    console.error(err);
    res.status(500).json({ error: 'Payment verification failed' });
  }
});

// Razorpay server-to-server webhook — the source of truth if the client never calls /verify
// Configure this URL + RAZORPAY_WEBHOOK_SECRET in the Razorpay dashboard.
paymentsRouter.post('/webhook', async (req, res) => {
  const signature = req.headers['x-razorpay-signature'];
  const expected = crypto
    .createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET)
    .update(req.rawBody || JSON.stringify(req.body))
    .digest('hex');

  if (signature !== expected) {
    return res.status(400).json({ error: 'Invalid webhook signature' });
  }

  try {
    const event = req.body;
    if (event.event === 'payment.captured') {
      const orderId = event.payload.payment.entity.order_id;
      const paymentId = event.payload.payment.entity.id;

      await withTransaction(async (client) => {
        const paymentResult = await client.query(
          `SELECT * FROM payments WHERE razorpay_order_id = $1 FOR UPDATE`,
          [orderId]
        );
        if (paymentResult.rowCount === 0) return;
        const payment = paymentResult.rows[0];
        if (payment.status === 'PAID') return; // already handled via /verify

        await client.query(
          `UPDATE payments SET status = 'PAID', razorpay_payment_id = $1, paid_at = now() WHERE id = $2`,
          [paymentId, payment.id]
        );
        const bookingResult = await client.query('SELECT * FROM bookings WHERE id = $1 FOR UPDATE', [payment.booking_id]);
        const booking = bookingResult.rows[0];
        const finalStatus = await deriveBookingStatus(client, booking);
        await client.query('UPDATE bookings SET status = $1 WHERE id = $2', [finalStatus, booking.id]);
      });
    } else if (event.event === 'payment.failed') {
      const orderId = event.payload.payment.entity.order_id;
      await query(`UPDATE payments SET status = 'FAILED' WHERE razorpay_order_id = $1`, [orderId]);
    }
    res.json({ received: true });
  } catch (err) {
    console.error('Webhook handling failed', err);
    res.status(500).json({ error: 'Webhook processing failed' });
  }
});

async function payWithWallet(userId, booking) {
  return withTransaction(async (client) => {
    const userResult = await client.query('SELECT wallet_balance FROM users WHERE id = $1 FOR UPDATE', [userId]);
    const balance = Number(userResult.rows[0].wallet_balance);
    if (balance < Number(booking.total_amount)) {
      throw httpError(402, 'Insufficient RailWallet balance');
    }
    const newBalance = balance - Number(booking.total_amount);
    await client.query('UPDATE users SET wallet_balance = $1 WHERE id = $2', [newBalance, userId]);
    await client.query(
      `INSERT INTO wallet_transactions (user_id, type, amount, balance_after, reference)
       VALUES ($1,'DEBIT',$2,$3,$4)`,
      [userId, booking.total_amount, newBalance, `Payment for PNR ${booking.pnr}`]
    );

    const paymentInsert = await client.query(
      `INSERT INTO payments (booking_id, method, amount, status, bank_ref_number, paid_at)
       VALUES ($1,'wallet',$2,'PAID',$3, now()) RETURNING *`,
      [booking.id, booking.total_amount, `WLT${Date.now()}`]
    );

    const finalStatus = await deriveBookingStatus(client, booking);
    await client.query('UPDATE bookings SET status = $1 WHERE id = $2', [finalStatus, booking.id]);

    return paymentInsert.rows[0];
  });
}

// A booking's final status reflects the seat status already allotted to its passengers at booking time.
async function deriveBookingStatus(client, booking) {
  const passengers = await client.query(
    'SELECT allotted_status FROM passengers WHERE booking_id = $1',
    [booking.id]
  );
  const statuses = passengers.rows.map((p) => p.allotted_status);
  if (statuses.every((s) => s === 'CNF')) return 'CONFIRMED';
  if (statuses.some((s) => s === 'WL')) return 'WAITLIST';
  return 'RAC';
}

function httpError(status, message) {
  const err = new Error(message);
  err.status = status;
  return err;
}
