// QuickRail AI endpoints. All require a valid QuickRail JWT; the user id always comes from the token.
//   POST /api/ai/chat            { sessionId?, message? | action? }  → agent reply (text + cards)
//   GET  /api/ai/session         → resume latest session after refresh
//   POST /api/ai/session/reset   → clear current booking flow (releases any unpaid seat hold)
//   GET  /api/ai/search          → structured train search (the "searchTrains" tool, also usable directly)
//   GET  /api/ai/booking         → current booking state-machine snapshot
//   POST /api/ai/booking/confirm → same as pressing "Confirm & Pay" (token-checked, creates the seat HOLD only)
//   POST /api/ai/booking/payment-result → tell the agent a payment attempt finished (verified server-side)
// Auth is a Bearer JWT (not a cookie), so classic CSRF doesn't apply: a third-party page cannot attach the header.
import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { requireAuth } from '../middleware/auth.js';
import { handleTurn, getSessionView, resetSession } from '../ai/agent.js';
import { parseDate, todayISO, isValidISO, daysBetween } from '../ai/dateTime.js';
import * as tools from '../ai/tools.js';
import { resolveStation } from '../ai/stations.js';
import { rankTrains } from '../ai/ranking.js';


export const aiRouter = Router();

const aiLimiter = rateLimit({
  windowMs: 60 * 1000, max: Number(process.env.AI_RATE_LIMIT_PER_MIN || 30),
  keyGenerator: (req) => req.userId || req.ip, standardHeaders: true, legacyHeaders: false,
  message: { error: 'Too many requests to QuickRail AI. Please slow down for a moment.' },
});
aiRouter.use(requireAuth, aiLimiter);

const chatSchema = z.object({
  sessionId: z.string().uuid().optional(),
  message: z.string().min(1).max(500).optional(),
  action: z.object({ type: z.string().max(40) }).passthrough().optional(),
}).refine((b) => (b.message != null) !== (b.action != null) || (b.message == null && b.action == null), 'Send either message or action');

function fail(res, err) {
  if (err.status) return res.status(err.status).json({ error: err.message });
  console.error('[ai]', err);
  return res.status(500).json({ error: 'QuickRail AI hit a problem. Please try again.' });
}

aiRouter.post('/chat', async (req, res) => {
  const p = chatSchema.safeParse(req.body);
  if (!p.success) return res.status(400).json({ error: 'Invalid request' });
  try {
    res.json(await handleTurn({ userId: req.userId, sessionId: p.data.sessionId, message: p.data.message, action: p.data.action }));
  } catch (err) { fail(res, err); }
});

aiRouter.get('/session', async (req, res) => {
  try { res.json(await getSessionView({ userId: req.userId })); } catch (err) { fail(res, err); }
});
aiRouter.post('/session/reset', async (req, res) => {
  try { await resetSession(req.userId); res.json({ ok: true }); } catch (err) { fail(res, err); }
});

// Structured search — mirrors the spec's searchTrains() contract.
aiRouter.get('/search', async (req, res) => {
  const q = z.object({
    from: z.string().min(2).max(60), to: z.string().min(2).max(60), date: z.string().max(40),
    class: z.string().max(3).optional(), passengers: z.coerce.number().int().min(1).max(6).default(1),
    pref: z.enum(['CHEAPEST', 'FASTEST', 'BEST', 'EARLIEST', 'LATEST']).optional(),
  }).safeParse(req.query);
  if (!q.success) return res.status(400).json({ error: 'Invalid search parameters' });
  try {
    const [f, t] = await Promise.all([resolveStation(q.data.from), resolveStation(q.data.to)]);
    if (f.status !== 'ok' || t.status !== 'ok') return res.status(422).json({ error: 'Station not found or ambiguous', from: f, to: t });
    const date = isValidISO(q.data.date) ? q.data.date : parseDate(q.data.date)?.date;
    const today = todayISO();
    if (!date || date < today || daysBetween(today, date) > Number(process.env.AI_MAX_ADVANCE_DAYS || 60)) return res.status(422).json({ error: 'Invalid or out-of-range date' });
    const views = await tools.searchTrains({ source: f.candidates[0].code, destination: t.candidates[0].code, date, classCode: q.data.class || null, passengers: q.data.passengers });
    const ranked = rankTrains(views, { preference: q.data.pref });
    res.json({
      date, from: f.candidates[0], to: t.candidates[0],
      trains: ranked.flatMap((v) => v.classes.map((c) => ({
        trainNumber: v.trainNumber, trainName: v.trainName, departure: v.departure, arrival: v.arrival, duration: v.duration,
        class: c.classCode, availability: c.availability === 'PARTIAL' ? 'AVAILABLE' : c.availability, availableSeats: c.availableCount, fare: c.fare,
      }))),
    });
  } catch (err) { fail(res, err); }
});

aiRouter.get('/booking', async (req, res) => {
  try { const v = await getSessionView({ userId: req.userId }); res.json({ sessionId: v.sessionId, stage: v.stage, state: v.state || null }); } catch (err) { fail(res, err); }
});
aiRouter.post('/booking/confirm', async (req, res) => {
  const p = z.object({ sessionId: z.string().uuid(), token: z.string().max(64) }).safeParse(req.body);
  if (!p.success) return res.status(400).json({ error: 'Invalid request' });
  try { res.json(await handleTurn({ userId: req.userId, sessionId: p.data.sessionId, action: { type: 'CONFIRM_BOOKING', token: p.data.token } })); } catch (err) { fail(res, err); }
});
aiRouter.post('/booking/payment-result', async (req, res) => {
  const p = z.object({ sessionId: z.string().uuid(), outcome: z.enum(['success', 'failed', 'cancelled']) }).safeParse(req.body);
  if (!p.success) return res.status(400).json({ error: 'Invalid request' });
  try { res.json(await handleTurn({ userId: req.userId, sessionId: p.data.sessionId, action: { type: 'PAYMENT_RESULT', outcome: p.data.outcome } })); } catch (err) { fail(res, err); }
});

