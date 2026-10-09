import { query } from '../db/pool.js';

const MASK = /\d{8,}/g; // phone / ID-like digit runs never reach the transcript table

export function emptyState() {
  return {
    mode: null, source: null, destination: null, sourceCandidates: null, destinationCandidates: null, routeChoices: null,
    date: null, time: null, classCode: null, passengerCount: null, quota: 'GN', preference: null, budget: null,
    berth: null, peopleNames: [], includeSelf: false, fareCeiling: null,
    shown: null, pendingTrain: null, selected: null, passengers: [], fare: null, expected: null,
    confirmToken: null, confirmExpires: null, hold: null, pendingCancel: null, awaiting: null, pendingQuestion: null, completed: null,
  };
}

export async function loadLatestSession(userId, maxAgeHours = 24) {
  const r = await query(
    `SELECT * FROM booking_agent_sessions WHERE user_id = $1 AND updated_at > now() - ($2 || ' hours')::interval
     ORDER BY updated_at DESC LIMIT 1`, [userId, String(maxAgeHours)]);
  return r.rows[0] ? hydrate(r.rows[0]) : null;
}
export async function loadSession(userId, sessionId) {
  // user_id is part of the WHERE clause: another user's session id simply doesn't exist for you.
  const r = await query('SELECT * FROM booking_agent_sessions WHERE id = $1 AND user_id = $2', [sessionId, userId]);
  return r.rows[0] ? hydrate(r.rows[0]) : null;
}
export async function createSession(userId) {
  const r = await query(`INSERT INTO booking_agent_sessions (user_id, stage, state) VALUES ($1,'IDLE',$2) RETURNING *`, [userId, JSON.stringify(emptyState())]);
  return hydrate(r.rows[0]);
}
function hydrate(row) {
  return { id: row.id, userId: row.user_id, stage: row.stage, state: { ...emptyState(), ...row.state }, updatedAt: row.updated_at };
}
export async function saveSession(session) {
  await query('UPDATE booking_agent_sessions SET stage = $1, state = $2, updated_at = now() WHERE id = $3 AND user_id = $4',
    [session.stage, JSON.stringify(session.state), session.id, session.userId]);
}
export async function appendMessage(sessionId, role, content) {
  const clean = String(content).replace(MASK, '••••').slice(0, 2000);
  await query('INSERT INTO chat_messages (session_id, role, content) VALUES ($1,$2,$3)', [sessionId, role, clean]);
}
export async function recentMessages(sessionId, limit = 30) {
  const r = await query('SELECT role, content, created_at FROM chat_messages WHERE session_id = $1 ORDER BY id DESC LIMIT $2', [sessionId, limit]);
  return r.rows.reverse().map((m) => ({ role: m.role, text: m.content, at: m.created_at }));
}
export async function audit(userId, sessionId, action, details = {}) {
  // details must never contain passenger names / payment data — only ids, codes, amounts.
  await query('INSERT INTO ai_audit_log (user_id, session_id, action, details) VALUES ($1,$2,$3,$4)', [userId, sessionId, action, JSON.stringify(details)]);
}
