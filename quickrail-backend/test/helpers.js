// Test harness: real Express app + real Postgres (TEST_DATABASE_URL), no mocks for booking/payment logic.
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL || process.env.DATABASE_URL || 'postgres://postgres@localhost:54329/quickrail_test';
process.env.JWT_SECRET = 'test-secret';
process.env.RAZORPAY_KEY_ID = 'rzp_test_dummy';
process.env.RAZORPAY_KEY_SECRET = 'dummy_secret';
process.env.RAZORPAY_WEBHOOK_SECRET = 'dummy_hook';
process.env.NODE_ENV = 'test';
process.env.AI_DISABLE_LLM = 'true';
process.env.AI_RATE_LIMIT_PER_MIN = '10000';

import { execFileSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');

export async function setupDb() {
  for (const f of ['migrate.js', 'seed.js', 'seed-ai-demo.js']) {
    execFileSync('node', [path.join(root, 'src/db', f)], { env: process.env, stdio: 'pipe' });
  }
  const { pool } = await import('../src/db/pool.js');
  await pool.query('TRUNCATE bookings, passengers, payments, wallet_transactions, saved_passengers, booking_agent_sessions, chat_messages, ai_audit_log, users CASCADE');
  await pool.query('UPDATE class_availability SET available_seats = (SELECT total_seats FROM train_classes tc WHERE tc.id = train_class_id), rac_available = (SELECT rac_seats FROM train_classes tc WHERE tc.id = train_class_id), waitlist_count = 0');
  return pool;
}

export async function startServer() {
  const { app } = await import('../src/app.js');
  const server = await new Promise((r) => { const s = app.listen(0, () => r(s)); });
  const base = `http://127.0.0.1:${server.address().port}`;
  return { base, close: () => new Promise((r) => server.close(r)) };
}

let n = 0;
export async function registerUser(base, name = 'Udit Vishwakarma') {
  n += 1;
  const stamp = `${Date.now()}${n}`;
  const res = await fetch(`${base}/api/auth/register`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name, email: `u${stamp}@example.com`, mobile: `9${stamp.slice(-9).padStart(9, '0')}`, password: 'password123', irctcUsername: `user${stamp}` }),
  });
  const j = await res.json();
  if (!res.ok) throw new Error(`register failed ${JSON.stringify(j)}`);
  return { token: j.token, id: j.user.id, user: j.user };
}

export function client(base, token) {
  const call = async (method, p, body) => {
    const res = await fetch(`${base}${p}`, { method, headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) }, body: body ? JSON.stringify(body) : undefined });
    return { status: res.status, body: await res.json().catch(() => null) };
  };
  const api = { get: (p) => call('GET', p), post: (p, b) => call('POST', p, b), sessionId: null };
  api.say = async (message) => { const r = await call('POST', '/api/ai/chat', { sessionId: api.sessionId || undefined, message }); if (r.body?.sessionId) api.sessionId = r.body.sessionId; return r; };
  api.act = async (action) => { const r = await call('POST', '/api/ai/chat', { sessionId: api.sessionId || undefined, action }); if (r.body?.sessionId) api.sessionId = r.body.sessionId; return r; };
  return api;
}

export const cardOf = (r, type) => r.body.message.cards.find((c) => c.type === type);
export const text = (r) => r.body.message.text;
export const tomorrowISO = () => { const d = new Date(Date.now() + 5.5 * 3600e3 + 86400e3); return d.toISOString().slice(0, 10); };
export const goodPassenger = (name = 'Udit Vishwakarma') => ({ name, age: 30, gender: 'Male', berthPreference: 'Lower (LB)' });
