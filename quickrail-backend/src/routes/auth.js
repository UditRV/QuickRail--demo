import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { query } from '../db/pool.js';
import { signToken, requireAuth } from '../middleware/auth.js';

export const authRouter = Router();

const registerSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  mobile: z.string().min(10).max(15),
  password: z.string().min(8),
  irctcUsername: z.string().min(4),
});

authRouter.post('/register', async (req, res) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid input', details: parsed.error.flatten() });
  }
  const { name, email, mobile, password, irctcUsername } = parsed.data;

  try {
    const existing = await query(
      'SELECT id FROM users WHERE email = $1 OR mobile = $2 OR irctc_username = $3',
      [email, mobile, irctcUsername]
    );
    if (existing.rowCount > 0) {
      return res.status(409).json({ error: 'An account with this email, mobile or username already exists' });
    }

    const passwordHash = await bcrypt.hash(password, 12);
    const result = await query(
      `INSERT INTO users (name, email, mobile, password_hash, irctc_username)
       VALUES ($1,$2,$3,$4,$5)
       RETURNING id, name, email, mobile, irctc_username, is_aadhaar_verified, wallet_balance`,
      [name, email, mobile, passwordHash, irctcUsername]
    );
    const user = result.rows[0];
    const token = signToken(user);
    return res.status(201).json({ token, user: serializeUser(user) });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Registration failed' });
  }
});

const loginSchema = z.object({
  identifier: z.string().min(3), // email, mobile, or irctc username
  password: z.string().min(1),
});

authRouter.post('/login', async (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid input' });
  const { identifier, password } = parsed.data;

  try {
    const result = await query(
      `SELECT * FROM users WHERE email = $1 OR mobile = $1 OR irctc_username = $1`,
      [identifier]
    );
    const user = result.rows[0];
    if (!user) return res.status(401).json({ error: 'Invalid credentials' });

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

    const token = signToken(user);
    return res.json({ token, user: serializeUser(user) });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Login failed' });
  }
});

authRouter.get('/me', requireAuth, async (req, res) => {
  const result = await query('SELECT * FROM users WHERE id = $1', [req.userId]);
  if (result.rowCount === 0) return res.status(404).json({ error: 'User not found' });
  return res.json({ user: serializeUser(result.rows[0]) });
});

function serializeUser(u) {
  return {
    id: u.id,
    name: u.name,
    email: u.email,
    mobile: u.mobile,
    irctcUsername: u.irctc_username,
    isAadhaarVerified: u.is_aadhaar_verified,
    city: u.city,
    state: u.state,
    pincode: u.pincode,
    occupation: u.occupation,
    walletBalance: Number(u.wallet_balance),
  };
}
