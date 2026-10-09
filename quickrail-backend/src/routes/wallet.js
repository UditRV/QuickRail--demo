import { Router } from 'express';
import crypto from 'crypto';
import Razorpay from 'razorpay';
import { z } from 'zod';
import { query, withTransaction } from '../db/pool.js';
import { requireAuth } from '../middleware/auth.js';

export const walletRouter = Router();
walletRouter.use(requireAuth);

const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

walletRouter.get('/', async (req, res) => {
  const result = await query('SELECT wallet_balance FROM users WHERE id = $1', [req.userId]);
  const txns = await query(
    'SELECT * FROM wallet_transactions WHERE user_id = $1 ORDER BY created_at DESC LIMIT 25',
    [req.userId]
  );
  res.json({
    balance: Number(result.rows[0].wallet_balance),
    transactions: txns.rows.map((t) => ({
      id: t.id,
      type: t.type,
      amount: Number(t.amount),
      balanceAfter: Number(t.balance_after),
      reference: t.reference,
      createdAt: t.created_at,
    })),
  });
});

// POST /api/wallet/topup/create-order { amount }
walletRouter.post('/topup/create-order', async (req, res) => {
  const schema = z.object({ amount: z.number().positive().max(50000) });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid amount' });

  try {
    const order = await razorpay.orders.create({
      amount: Math.round(parsed.data.amount * 100),
      currency: 'INR',
      receipt: `topup_${req.userId}_${Date.now()}`,
      notes: { userId: req.userId, purpose: 'wallet_topup' },
    });
    res.json({
      razorpayKeyId: process.env.RAZORPAY_KEY_ID,
      order: { id: order.id, amount: order.amount, currency: order.currency },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to create top-up order' });
  }
});

// POST /api/wallet/topup/verify
walletRouter.post('/topup/verify', async (req, res) => {
  const schema = z.object({
    razorpay_order_id: z.string(),
    razorpay_payment_id: z.string(),
    razorpay_signature: z.string(),
    amount: z.number().positive(),
  });
  const parsed = schema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid input' });
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature, amount } = parsed.data;

  const expectedSignature = crypto
    .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
    .update(`${razorpay_order_id}|${razorpay_payment_id}`)
    .digest('hex');
  if (expectedSignature !== razorpay_signature) {
    return res.status(400).json({ error: 'Signature verification failed' });
  }

  try {
    const newBalance = await withTransaction(async (client) => {
      const userResult = await client.query('SELECT wallet_balance FROM users WHERE id = $1 FOR UPDATE', [req.userId]);
      const balance = Number(userResult.rows[0].wallet_balance) + amount;
      await client.query('UPDATE users SET wallet_balance = $1 WHERE id = $2', [balance, req.userId]);
      await client.query(
        `INSERT INTO wallet_transactions (user_id, type, amount, balance_after, reference)
         VALUES ($1,'TOPUP',$2,$3,$4)`,
        [req.userId, amount, balance, razorpay_payment_id]
      );
      return balance;
    });
    res.json({ balance: newBalance });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Top-up failed' });
  }
});
