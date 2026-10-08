/**
 * QuickBid — "Can you beat the AI?"
 *
 * DEMO / SIMULATION ONLY — not real ticket resale. Trains, bidders, bids and prices are all generated in the
 * browser. No payments, no IRCTC / QuickRail API calls, no tickets are issued, nothing is stored or sent anywhere.
 *
 * Self-contained: one file, depends only on React (+ react-dom for a portal) and Tailwind utility classes that the
 * QuickRail project already uses. Keyframes are injected by this file (all prefixed `qb-`), so no CSS file is needed.
 *
 * Exports
 *   QuickBidLauncher  – the "⚡ QuickBid – Can you beat the AI?" button + the full-screen page it opens (easiest to wire up)
 *   QuickBidButton    – just the button (if you want to control open/close yourself)
 *   QuickBidPage      – just the full-screen page (props: onBack)  — also the default export
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

/* =====================================================================================================================
 * 1. Types & small helpers
 * ===================================================================================================================== */

type FeedKind = 'bid' | 'you' | 'ai' | 'sys';
type Tone = 'good' | 'warn' | 'info' | 'win';

interface BidEntry { amount: number; seq: number }
interface FeedItem { id: number; kind: FeedKind; text: string; at: number }
interface Bot { id: string; name: string; emoji: string; max: number; eagerness: number }
interface AuctionEvent { id: number; tone: Tone; text: string }
interface Winner { id: string; name: string; amount: number }
interface AuctionResult {
  winners: Winner[]; cutoff: number; totalBids: number; youBid: boolean;
  youWon: boolean; youPaid: number | null; youBestBid: number | null; youSaved: number;
  aiWon: boolean; aiPaid: number | null; duel: 'you' | 'ai' | 'draw' | 'skipped';
}
interface Auction {
  id: string; trainNo: string; trainName: string; from: string; to: string; dep: string; arr: string; cls: string;
  dateLabel: string; fare: number; seats: number; startPrice: number; step: number;
  demand: number; total: number; timeLeft: number; elapsed: number; extensions: number;
  bids: Record<string, BidEntry>; bots: Bot[]; aiSnipeAt: number;
  feed: FeedItem[]; history: number[]; activity: number[];
  seq: number; feedSeq: number; evSeq: number; event: AuctionEvent | null;
  earlyForecast: number | null; status: 'live' | 'ended'; result?: AuctionResult;
}
interface Advice {
  status: 'BID' | 'WAIT' | 'SNIPE' | 'SKIP' | 'CLOSED';
  headline: string; reason: string;
  suggested: number; predicted: number; fair: number; minBid: number; growth: number;
  factors: { seats: number; time: number; demand: number; activity: number };
  notes: { seats: string; time: string; demand: string; activity: string };
}
interface Toast { id: number; tone: Tone; text: string }
interface Score { you: number; ai: number; draw: number; saved: number }

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const clamp01 = (v: number) => clamp(v, 0, 1);
const inr = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`;
const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.max(0, s) % 60).padStart(2, '0')}`;
const roundTo = (v: number, step: number) => Math.round(v / step) * step;
const shuffle = <T,>(arr: T[]): T[] => { const a = [...arr]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const MONO: React.CSSProperties = { fontFamily: "'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace" };
const HEAD: React.CSSProperties = { fontFamily: "'Plus Jakarta Sans', 'Inter', system-ui, sans-serif" };

const DEMO_LABEL = 'Demo / Simulation – not real ticket resale';

/* =====================================================================================================================
 * 2. Simulated data
 * ===================================================================================================================== */

const TEMPLATES = [
  { trainNo: '12951', trainName: 'Mumbai Rajdhani', from: 'Mumbai Central', to: 'New Delhi', dep: '17:00', arr: '08:35', cls: '3A', fare: 2450, seats: 3 },
  { trainNo: '12009', trainName: 'Shatabdi Express', from: 'Mumbai Central', to: 'Ahmedabad', dep: '06:25', arr: '12:50', cls: 'CC', fare: 1180, seats: 4 },
  { trainNo: '12301', trainName: 'Howrah Rajdhani', from: 'New Delhi', to: 'Howrah', dep: '16:55', arr: '10:00', cls: '1A', fare: 4650, seats: 2 },
  { trainNo: '12627', trainName: 'Karnataka Express', from: 'New Delhi', to: 'Bengaluru', dep: '21:15', arr: '06:40', cls: 'SL', fare: 1150, seats: 5 },
  { trainNo: '12723', trainName: 'Telangana Express', from: 'Hyderabad', to: 'New Delhi', dep: '06:10', arr: '05:20', cls: '2A', fare: 3320, seats: 3 },
  { trainNo: '22209', trainName: 'Duronto Express', from: 'Mumbai CSMT', to: 'Pune', dep: '07:30', arr: '10:45', cls: 'CC', fare: 640, seats: 4 },
];

const BOT_NAMES: Array<[string, string]> = [
  ['RailRaja', '🦁'], ['TatkalTina', '🐯'], ['Nikhil_M', '🧑‍💻'], ['ChaiOnTracks', '☕'], ['SleeperSam', '😴'],
  ['Priya_K', '🎯'], ['MetroMax', '🚇'], ['BerthBandit', '🦊'], ['Aarav_S', '🚀'], ['WaitlistWiz', '🧙'],
];

const nameOf = (a: Auction, id: string) => (id === 'you' ? 'You' : id === 'ai' ? 'QuickBid AI' : a.bots.find((b) => b.id === id)?.name || 'Bidder');
const emojiOf = (a: Auction, id: string) => (id === 'you' ? '🧑' : id === 'ai' ? '🤖' : a.bots.find((b) => b.id === id)?.emoji || '👤');

/* =====================================================================================================================
 * 3. Auction engine (pure functions; all randomness is simulated bidding behaviour)
 *    Rules: each bidder holds one bid. The top `seats` bids win and each winner pays their OWN bid (pay-as-bid).
 *    Sniper guard: a bid in the last 5s adds 5s (max 3 times).
 * ===================================================================================================================== */

const cloneA = (a: Auction): Auction => ({ ...a, bids: { ...a.bids }, feed: [...a.feed], activity: [...a.activity], history: [...a.history] });

function ranked(a: Auction): Array<{ id: string; amount: number; seq: number }> {
  return Object.entries(a.bids).map(([id, b]) => ({ id, amount: b.amount, seq: b.seq })).sort((x, y) => y.amount - x.amount || x.seq - y.seq);
}
const rankOf = (a: Auction, id: string) => ranked(a).findIndex((r) => r.id === id);
const isWinning = (a: Auction, id: string) => { const r = rankOf(a, id); return r >= 0 && r < a.seats; };
const cutoffOf = (a: Auction) => { const r = ranked(a); return r.length >= a.seats ? r[a.seats - 1].amount : 0; };
const priceToBeat = (a: Auction) => Math.max(a.startPrice, cutoffOf(a));

/** Lowest legal bid for `who` right now. */
function minBid(a: Auction, who: string): number {
  const own = a.bids[who]?.amount;
  let m = a.startPrice;
  if (own != null) m = Math.max(m, own + a.step);
  if (!isWinning(a, who) && ranked(a).length >= a.seats) m = Math.max(m, cutoffOf(a) + a.step);
  return m;
}

function pushFeed(a: Auction, kind: FeedKind, text: string) {
  a.feed = [{ id: a.feedSeq++, kind, text, at: a.elapsed }, ...a.feed].slice(0, 40);
}
function setEvent(a: Auction, tone: Tone, text: string) { a.event = { id: a.evSeq++, tone, text }; }

function placeBid(a: Auction, who: string, raw: number, seed = false): Auction {
  if (a.status !== 'live') return a;
  const amount = Math.round(raw);
  if (!Number.isFinite(amount) || amount < minBid(a, who)) return a;
  const n = cloneA(a);
  n.bids[who] = { amount, seq: n.seq++ };
  n.activity.push(n.elapsed);
  pushFeed(n, who === 'you' ? 'you' : who === 'ai' ? 'ai' : 'bid', `${nameOf(n, who)} bid ${inr(amount)}`);
  if (!seed && n.timeLeft <= 5 && n.extensions < 3) {
    n.timeLeft += 5; n.extensions += 1;
    pushFeed(n, 'sys', `⏱ Sniper guard: +5s (${n.extensions}/3)`);
  }
  if (who === 'you') {
    const rk = rankOf(n, 'you');
    if (rk < n.seats) setEvent(n, 'good', `Bid placed: ${inr(amount)} — you hold seat ${rk + 1} of ${n.seats}`);
    else setEvent(n, 'info', `Bid placed: ${inr(amount)} — not in the top ${n.seats} yet. Beat ${inr(cutoffOf(n) + n.step)}`);
  }
  return n;
}

/** The "AI": forecasts where the winning price is heading from seats, time, demand and recent bid activity. */
function advise(a: Auction, who = 'you'): Advice {
  const r = ranked(a);
  const bidders = r.length;
  const base = priceToBeat(a);
  const frac = a.total > 0 ? a.timeLeft / a.total : 0;                     // 1 = just opened, 0 = closing
  const recent = a.activity.filter((t) => a.elapsed - t <= 20).length;     // bids in the last 20s
  const seatScore = clamp01((bidders / a.seats) / 2.5);                    // competition per seat
  const timeScore = 1 - frac;                                              // urgency
  const activityScore = clamp01(recent / 8);                               // momentum
  const demandScore = clamp01(0.5 * seatScore + 0.5 * activityScore);
  const growth = clamp(0.02 + 0.10 * frac + 0.10 * activityScore + 0.08 * seatScore, 0, 0.35);
  const predicted = Math.max(base, roundTo(base * (1 + growth), a.step));
  const fair = roundTo(a.fare * (0.82 + 0.40 * demandScore), a.step);
  const min = minBid(a, who);
  const suggested = Math.max(min, roundTo(predicted + a.step, a.step));
  const notes = {
    seats: `${bidders} bidder${bidders === 1 ? '' : 's'} for ${a.seats} seats`,
    time: `${mmss(a.timeLeft)} left`,
    demand: demandScore > 0.66 ? 'High demand' : demandScore > 0.33 ? 'Moderate demand' : 'Soft demand',
    activity: `${recent} bid${recent === 1 ? '' : 's'} in last 20s`,
  };
  let status: Advice['status'] = 'BID';
  let headline = 'Good entry point';
  let reason = `Forecast winning price ${inr(predicted)}; a bid of ${inr(suggested)} should clear it.`;
  if (a.status === 'ended') { status = 'CLOSED'; headline = 'Auction closed'; reason = 'Bidding has ended.'; }
  else if (a.timeLeft <= 12) { status = 'SNIPE'; headline = 'Snipe window — bid now'; reason = `Only ${a.timeLeft}s left. Rivals have little time to react — ${inr(suggested)} is the AI's pick.`; }
  else if (suggested > fair * 1.12) { status = 'SKIP'; headline = 'Running above fair value'; reason = `Needed ${inr(suggested)} vs AI fair price ${inr(fair)}. Overpaying is likely — consider skipping.`; }
  else if (frac > 0.6 && recent < 3) { status = 'WAIT'; headline = 'Calm market — wait and bid late'; reason = `Few bids so far (${recent} in 20s). Prices tend to climb near the close, so hold your fire.`; }
  return { status, headline, reason, suggested, predicted, fair, minBid: min, growth, factors: { seats: seatScore, time: timeScore, demand: demandScore, activity: activityScore }, notes };
}

/** AI's estimated chance that a bid of `amount` ends inside the winning seats. */
function winChance(a: Auction, amount: number, adv: Advice): number {
  if (a.status === 'ended') return 0;
  if (ranked(a).length < a.seats && amount >= a.startPrice) return 0.97;
  const spread = 0.6 + 1.4 * (a.timeLeft / a.total);   // more uncertainty early in the auction
  const x = (amount - adv.predicted) / a.step;
  return clamp(1 / (1 + Math.exp(-(x / spread) * 1.6)), 0.02, 0.98);
}

function botAct(n: Auction): Auction {
  const bot = n.bots[Math.floor(Math.random() * n.bots.length)];
  if (Math.random() > bot.eagerness * 0.7) return n;
  const m = minBid(n, bot.id);
  if (isWinning(n, bot.id) && Math.random() < 0.85) return n;
  let amt = m + n.step * Math.floor(Math.random() * 3);
  if (amt > bot.max) { if (m <= bot.max && Math.random() < 0.5) amt = m; else return n; }
  return placeBid(n, bot.id, amt);
}

function aiAct(n: Auction): Auction {
  if (n.timeLeft <= 0) return n;
  const ad = advise(n, 'ai');
  const winning = isWinning(n, 'ai');
  if (!n.bids.ai && n.timeLeft > n.total * 0.55 && Math.random() < 0.05 && ad.minBid <= ad.fair * 0.8) return placeBid(n, 'ai', ad.minBid);
  if (n.timeLeft <= n.aiSnipeAt && !winning && Math.random() < 0.75) {
    const amt = Math.min(ad.fair, ad.suggested);        // the AI never pays above its own fair-price estimate
    if (amt >= ad.minBid) return placeBid(n, 'ai', amt);
  }
  return n;
}

function finalize(a: Auction): Auction {
  const n = cloneA(a);
  const r = ranked(n);
  const winners = r.slice(0, n.seats).map((x) => ({ id: x.id, name: nameOf(n, x.id), amount: x.amount }));
  const you = winners.find((w) => w.id === 'you');
  const ai = winners.find((w) => w.id === 'ai');
  const youBid = !!n.bids.you;
  let duel: AuctionResult['duel'] = 'skipped';
  if (youBid) {
    if (you && !ai) duel = 'you';
    else if (ai && !you) duel = 'ai';
    else if (you && ai) duel = you.amount < ai.amount ? 'you' : you.amount > ai.amount ? 'ai' : 'draw';
    else duel = 'draw';
  }
  n.result = {
    winners, cutoff: r.length >= n.seats ? r[n.seats - 1].amount : n.startPrice, totalBids: r.length, youBid,
    youWon: !!you, youPaid: you ? you.amount : null, youBestBid: n.bids.you?.amount ?? null, youSaved: you ? n.fare - you.amount : 0,
    aiWon: !!ai, aiPaid: ai ? ai.amount : null, duel,
  };
  n.status = 'ended'; n.timeLeft = 0;
  pushFeed(n, 'sys', `🔨 Closed. ${winners.length} seat${winners.length === 1 ? '' : 's'} sold, lowest winning bid ${inr(n.result.cutoff)}`);
  if (you) setEvent(n, 'win', `🎉 You won a seat on ${n.trainName} for ${inr(you.amount)}${duel === 'you' ? ' — and you beat the AI!' : ''}`);
  else if (youBid) setEvent(n, 'warn', `Auction closed — you lost ${n.trainName}. Winning cutoff was ${inr(n.result.cutoff)}`);
  else setEvent(n, 'info', `${n.trainName} closed at ${inr(n.result.cutoff)}`);
  return n;
}

function tick(a: Auction): Auction {
  if (a.status !== 'live') return a;
  let n = cloneA(a);
  n.elapsed += 1; n.timeLeft -= 1;
  if (n.timeLeft <= 0) return finalize(n);
  const wasWinning = isWinning(a, 'you');
  const frac = n.timeLeft / n.total;
  let lam = (0.3 + 0.9 * n.demand) * (1 + 2.2 * Math.pow(1 - frac, 2));   // bids/second climb as the clock runs down
  while (lam > 0) { if (Math.random() < Math.min(1, lam)) n = botAct(n); lam -= 1; }
  n = aiAct(n);
  if (n === a) n = cloneA(a);
  if (n.bids.you && wasWinning && !isWinning(n, 'you')) { n = cloneA(n); setEvent(n, 'warn', `You were outbid on ${n.trainName} — raise above ${inr(cutoffOf(n))}`); }
  if (n.elapsed === 4 && n.earlyForecast == null) n.earlyForecast = advise(n).predicted;
  n.history = [...n.history, priceToBeat(n)].slice(-120);
  return n;
}

function makeRound(round: number): Auction[] {
  const date = new Date(Date.now() + 864e5).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
  return TEMPLATES.map((t, i) => {
    const demand = 0.3 + Math.random() * 0.7;
    const step = Math.max(10, Math.round((t.fare * 0.02) / 10) * 10);
    const startPrice = Math.round((t.fare * 0.55) / step) * step;
    const fairHidden = t.fare * (0.82 + 0.4 * demand);
    const bots: Bot[] = shuffle(BOT_NAMES).slice(0, 7).map(([name, emoji], k) => ({ id: `b${k}`, name, emoji, max: fairHidden * (0.72 + Math.random() * 0.5), eagerness: 0.5 + Math.random() }));
    const total = 55 + Math.floor(Math.random() * 56);
    let a: Auction = {
      id: `r${round}-${i}`, ...t, dateLabel: date, startPrice, step, demand, total, timeLeft: total, elapsed: 0, extensions: 0,
      bids: {}, bots, aiSnipeAt: 7 + Math.floor(Math.random() * 7), feed: [], history: [startPrice], activity: [],
      seq: 1, feedSeq: 1, evSeq: 1, event: null, earlyForecast: null, status: 'live',
    };
    pushFeed(a, 'sys', `Auction opened · ${t.seats} seats · starts at ${inr(startPrice)}`);
    const seedN = Math.max(2, Math.floor(t.seats * 0.8));
    for (let k = 0; k < seedN; k++) a = placeBid(a, bots[k].id, minBid(a, bots[k].id) + step * Math.floor(Math.random() * 3), true);
    a.event = null;
    return a;
  });
}

/* =====================================================================================================================
 * 4. Styles (injected once; every class is prefixed qb-)
 * ===================================================================================================================== */

const CSS = `
@keyframes qb-rise{from{opacity:0;transform:translateY(16px) scale(.98)}to{opacity:1;transform:none}}
@keyframes qb-pop{0%{transform:scale(1)}40%{transform:scale(1.16);color:#ff8928}100%{transform:scale(1)}}
@keyframes qb-live{0%,100%{box-shadow:0 0 0 0 rgba(52,211,153,.65)}70%{box-shadow:0 0 0 7px rgba(52,211,153,0)}}
@keyframes qb-float{0%,100%{transform:translate(0,0)}50%{transform:translate(26px,-30px)}}
@keyframes qb-urgent{0%,100%{box-shadow:0 0 0 0 rgba(251,113,133,0)}50%{box-shadow:0 0 26px 2px rgba(251,113,133,.5)}}
@keyframes qb-toast{from{opacity:0;transform:translateX(30px)}to{opacity:1;transform:none}}
@keyframes qb-sheet{from{opacity:0;transform:translateY(46px)}to{opacity:1;transform:none}}
@keyframes qb-feed{from{opacity:0;transform:translateY(-8px);background:rgba(255,137,40,.28)}to{opacity:1;transform:none;background:transparent}}
@keyframes qb-confetti{0%{transform:translate3d(0,-8vh,0) rotate(0)}100%{transform:translate3d(var(--dx),108vh,0) rotate(720deg)}}
@keyframes qb-shimmer{from{background-position:-200% 0}to{background-position:200% 0}}
@keyframes qb-bolt{0%,100%{transform:rotate(0) scale(1)}25%{transform:rotate(-12deg) scale(1.18)}50%{transform:rotate(8deg) scale(1)}}
.qb-rise{animation:qb-rise .5s cubic-bezier(.2,.8,.2,1) both}
.qb-pop{display:inline-block;animation:qb-pop .55s ease-out}
.qb-live{animation:qb-live 1.6s infinite}
.qb-float{animation:qb-float 14s ease-in-out infinite}
.qb-urgent{animation:qb-urgent 1s ease-in-out infinite}
.qb-toast{animation:qb-toast .35s ease-out both}
.qb-sheet{animation:qb-sheet .38s cubic-bezier(.2,.8,.2,1) both}
.qb-feed{animation:qb-feed 1.1s ease-out both}
.qb-confetti{position:fixed;top:0;width:9px;height:14px;border-radius:2px;animation:qb-confetti var(--dur) linear var(--delay) forwards;pointer-events:none}
.qb-shimmer{background-size:200% 100%;animation:qb-shimmer 3.2s linear infinite}
.qb-bolt{display:inline-block;animation:qb-bolt 2.2s ease-in-out infinite}
.qb-scroll::-webkit-scrollbar{width:6px}.qb-scroll::-webkit-scrollbar-thumb{background:rgba(255,255,255,.18);border-radius:6px}
@media (prefers-reduced-motion:reduce){.qb-root *,.qb-btn *,.qb-btn{animation:none!important;transition:none!important}}
`;
function QuickBidStyles() { return <style data-quickbid>{CSS}</style>; }

/* =====================================================================================================================
 * 5. Small UI pieces
 * ===================================================================================================================== */

function DemoBadge({ compact = false }: { compact?: boolean }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border border-amber-300/40 bg-amber-300/10 text-amber-200 font-semibold ${compact ? 'px-2 py-0.5 text-[10px]' : 'px-3 py-1 text-xs'}`} role="note">
      <span aria-hidden>🧪</span>{DEMO_LABEL}
    </span>
  );
}

function Ring({ left, total, size = 56 }: { left: number; total: number; size?: number }) {
  const r = size / 2 - 5, c = 2 * Math.PI * r;
  const frac = total > 0 ? clamp01(left / total) : 0;
  const hot = left <= 10 && left > 0;
  return (
    <div className={`relative shrink-0 rounded-full ${hot ? 'qb-urgent' : ''}`} style={{ width: size, height: size }} role="timer" aria-label={`${left} seconds left`}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,.12)" strokeWidth="5" />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth="5" strokeLinecap="round" stroke={hot ? '#fb7185' : left <= 25 ? '#fbbf24' : '#34d399'}
          strokeDasharray={c} strokeDashoffset={c * (1 - frac)} style={{ transition: 'stroke-dashoffset 1s linear, stroke .3s' }} />
      </svg>
      <div className={`absolute inset-0 flex items-center justify-center text-[11px] font-bold ${hot ? 'text-rose-300' : 'text-white'}`} style={MONO}>{left > 0 ? mmss(left) : '0:00'}</div>
    </div>
  );
}

function SeatDots({ a }: { a: Auction }) {
  const r = ranked(a);
  return (
    <div className="flex items-center gap-1" aria-label={`${Math.min(r.length, a.seats)} of ${a.seats} seats currently held by a top bid`}>
      {Array.from({ length: a.seats }, (_, i) => {
        const who = r[i]?.id;
        const cls = !who ? 'bg-white/10 border-white/20' : who === 'you' ? 'bg-[#ff8928] border-[#ff8928] shadow-[0_0_10px_#ff8928]' : who === 'ai' ? 'bg-cyan-400 border-cyan-300 shadow-[0_0_10px_#22d3ee]' : 'bg-emerald-400/80 border-emerald-300/60';
        return <span key={i} className={`h-3.5 w-3.5 rounded-[4px] border transition-all duration-500 ${cls}`} />;
      })}
    </div>
  );
}

function Sparkline({ values, w = 260, h = 56 }: { values: number[]; w?: number; h?: number }) {
  if (values.length < 2) return <div className="h-14" />;
  const lo = Math.min(...values), hi = Math.max(...values), span = Math.max(1, hi - lo);
  const pts = values.map((v, i) => `${(i / (values.length - 1)) * w},${h - 4 - ((v - lo) / span) * (h - 10)}`);
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-14" preserveAspectRatio="none" aria-hidden>
      <defs><linearGradient id="qbg" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#ff8928" stopOpacity=".45" /><stop offset="1" stopColor="#ff8928" stopOpacity="0" /></linearGradient></defs>
      <polygon points={`0,${h} ${pts.join(' ')} ${w},${h}`} fill="url(#qbg)" />
      <polyline points={pts.join(' ')} fill="none" stroke="#ff8928" strokeWidth="2" strokeLinejoin="round" />
    </svg>
  );
}

function Bar({ label, value, note, color }: { label: string; value: number; note: string; color: string }) {
  return (
    <div>
      <div className="flex justify-between text-[11px] text-slate-300"><span className="font-semibold">{label}</span><span className="text-slate-400">{note}</span></div>
      <div className="mt-1 h-1.5 rounded-full bg-white/10 overflow-hidden"><div className="h-full rounded-full" style={{ width: `${Math.round(value * 100)}%`, background: color, transition: 'width .8s ease' }} /></div>
    </div>
  );
}

function statusOf(a: Auction): { label: string; cls: string } {
  const rk = rankOf(a, 'you');
  if (!a.bids.you) return { label: 'No bid yet', cls: 'text-slate-400 bg-white/5 border-white/10' };
  if (a.status === 'ended') return a.result?.youWon ? { label: 'You won', cls: 'text-emerald-300 bg-emerald-400/10 border-emerald-400/30' } : { label: 'Lost', cls: 'text-rose-300 bg-rose-400/10 border-rose-400/30' };
  return rk < a.seats ? { label: `Leading · seat ${rk + 1}`, cls: 'text-emerald-300 bg-emerald-400/10 border-emerald-400/30' } : { label: 'Outbid', cls: 'text-rose-300 bg-rose-400/10 border-rose-400/30' };
}

/* =====================================================================================================================
 * 6. Auction card
 * ===================================================================================================================== */

function AuctionCard({ a, index, onOpen }: { a: Auction; index: number; onOpen: () => void }) {
  const r = ranked(a);
  const top = r[0]?.amount ?? a.startPrice;
  const st = statusOf(a);
  const ended = a.status === 'ended';
  const hot = !ended && a.timeLeft <= 10;
  return (
    <article className={`qb-rise group relative rounded-2xl border bg-white/[0.04] backdrop-blur-md p-4 sm:p-5 transition-all duration-300 hover:-translate-y-1 hover:bg-white/[0.07] ${hot ? 'border-rose-400/50 qb-urgent' : 'border-white/10 hover:border-[#ff8928]/50'}`} style={{ animationDelay: `${index * 70}ms` }}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-[11px]">
            <span className="rounded-md bg-white/10 px-1.5 py-0.5 text-slate-200" style={MONO}>{a.trainNo}</span>
            <span className="rounded-md bg-[#ff8928]/15 px-1.5 py-0.5 font-bold text-[#ffb784]">{a.cls}</span>
            {ended ? <span className="rounded-md bg-slate-500/30 px-1.5 py-0.5 text-slate-300">ENDED</span>
              : <span className="inline-flex items-center gap-1.5 text-emerald-300 font-semibold"><span className="qb-live h-2 w-2 rounded-full bg-emerald-400" />LIVE</span>}
          </div>
          <h3 className="mt-1.5 truncate text-base sm:text-lg font-extrabold text-white" style={HEAD}>{a.trainName}</h3>
          <p className="truncate text-xs text-slate-400">{a.from} → {a.to} · {a.dateLabel} · {a.dep}–{a.arr}</p>
        </div>
        <Ring left={a.timeLeft} total={a.total} />
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2 text-center">
        <div className="col-span-3 sm:col-span-1 rounded-xl bg-black/25 p-2.5 text-left sm:text-center">
          <div className="text-[10px] uppercase tracking-wider text-slate-400">Current bid</div>
          <div key={top} className="qb-pop text-2xl font-extrabold text-white" style={MONO}>{inr(top)}</div>
        </div>
        <div className="rounded-xl bg-black/25 p-2.5"><div className="text-[10px] uppercase tracking-wider text-slate-400">Starting</div><div className="text-sm font-bold text-slate-200" style={MONO}>{inr(a.startPrice)}</div></div>
        <div className="rounded-xl bg-black/25 p-2.5"><div className="text-[10px] uppercase tracking-wider text-slate-400">Seats</div><div className="text-sm font-bold text-slate-200" style={MONO}>{a.seats}</div></div>
      </div>

      <div className="mt-3 flex items-center justify-between gap-2">
        <SeatDots a={a} />
        <span className="text-[11px] text-slate-400">{r.length} bidder{r.length === 1 ? '' : 's'}</span>
        <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${st.cls}`}>{st.label}</span>
      </div>

      <button onClick={onOpen} className={`mt-4 w-full rounded-xl px-4 py-2.5 text-sm font-bold transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-[#ff8928] focus-visible:ring-offset-2 focus-visible:ring-offset-[#050b1a] ${ended ? 'border border-white/20 bg-white/5 text-white hover:bg-white/10' : 'bg-gradient-to-r from-[#ff8928] to-[#ff5e3a] text-[#1a0a00] shadow-[0_8px_24px_-8px_#ff8928] hover:brightness-110 active:scale-[.98]'}`}>
        {ended ? '📊 View results' : '⚡ Place Bid'}
      </button>
    </article>
  );
}

/* =====================================================================================================================
 * 7. Detail sheet: bid panel, AI advisor, seat board, live feed, results
 * ===================================================================================================================== */

function ResultPanel({ a }: { a: Auction }) {
  const res = a.result!;
  const verdict = res.duel === 'you' ? { t: '🏆 You beat the AI!', c: 'from-emerald-500/30 to-emerald-500/5 border-emerald-400/40' }
    : res.duel === 'ai' ? { t: '🤖 The AI wins this round', c: 'from-cyan-500/30 to-cyan-500/5 border-cyan-400/40' }
    : res.duel === 'draw' ? { t: '🤝 Draw with the AI', c: 'from-amber-500/25 to-amber-500/5 border-amber-400/40' }
    : { t: '👀 You sat this one out', c: 'from-slate-500/25 to-slate-500/5 border-white/15' };
  const err = a.earlyForecast ? Math.round((Math.abs(a.earlyForecast - res.cutoff) / res.cutoff) * 100) : null;
  return (
    <div className="space-y-4">
      <div className={`qb-rise rounded-2xl border bg-gradient-to-br p-4 ${verdict.c}`}>
        <div className="text-xl font-extrabold text-white" style={HEAD}>{verdict.t}</div>
        <p className="mt-1 text-sm text-slate-200">
          {res.youWon ? <>You won a seat for <b>{inr(res.youPaid!)}</b> — {res.youSaved >= 0 ? <>that's <b className="text-emerald-300">{inr(res.youSaved)} under</b> the standard {inr(a.fare)} fare.</> : <>that's <b className="text-rose-300">{inr(-res.youSaved)} over</b> the standard {inr(a.fare)} fare.</>}</>
            : res.youBid ? <>You bid {inr(res.youBestBid!)} but the lowest winning bid was <b>{inr(res.cutoff)}</b>.</> : <>You didn't place a bid. The lowest winning bid was <b>{inr(res.cutoff)}</b>.</>}
        </p>
        <p className="mt-1 text-xs text-slate-400">{res.aiWon ? `QuickBid AI won a seat at ${inr(res.aiPaid!)}.` : a.bids.ai ? 'QuickBid AI bid but was outbid.' : 'QuickBid AI stayed out of this one.'}</p>
      </div>

      <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
        <div className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-400">Winners (pay-as-bid)</div>
        <ol className="space-y-1.5">
          {res.winners.map((w, i) => (
            <li key={w.id} className={`flex items-center justify-between rounded-lg px-3 py-2 text-sm ${w.id === 'you' ? 'bg-[#ff8928]/15 ring-1 ring-[#ff8928]/50' : w.id === 'ai' ? 'bg-cyan-400/10 ring-1 ring-cyan-400/40' : 'bg-white/5'}`}>
              <span className="flex items-center gap-2 text-slate-100"><span className="text-slate-400" style={MONO}>S{i + 1}</span>{emojiOf(a, w.id)} {w.name}</span>
              <span className="font-bold text-white" style={MONO}>{inr(w.amount)}</span>
            </li>
          ))}
        </ol>
      </div>

      <div className="grid grid-cols-3 gap-2 text-center text-xs">
        <div className="rounded-xl bg-white/5 p-2.5"><div className="text-slate-400">Total bids</div><div className="text-base font-bold text-white" style={MONO}>{a.seq - 1}</div></div>
        <div className="rounded-xl bg-white/5 p-2.5"><div className="text-slate-400">Cutoff</div><div className="text-base font-bold text-white" style={MONO}>{inr(res.cutoff)}</div></div>
        <div className="rounded-xl bg-white/5 p-2.5"><div className="text-slate-400">Sniper +s</div><div className="text-base font-bold text-white" style={MONO}>{a.extensions * 5}</div></div>
      </div>
      {a.earlyForecast != null && err != null && (
        <p className="rounded-xl border border-cyan-400/30 bg-cyan-400/10 p-3 text-xs text-cyan-100">🤖 The AI's early forecast was <b>{inr(a.earlyForecast)}</b>; the final cutoff was <b>{inr(res.cutoff)}</b> ({err}% off).</p>
      )}
    </div>
  );
}

function DetailSheet({ a, onClose, onBid }: { a: Auction; onClose: () => void; onBid: (id: string, amount: number) => void }) {
  const adv = advise(a);
  const [amount, setAmount] = useState(String(adv.minBid));
  const [error, setError] = useState('');
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => { closeRef.current?.focus(); }, []);

  const val = Number(amount.replace(/[^0-9]/g, '')) || 0;
  const maxAllowed = Math.round(a.fare * 2.5);
  const chance = winChance(a, val || adv.suggested, adv);
  const you = a.bids.you;
  const st = statusOf(a);
  const r = ranked(a);
  const ended = a.status === 'ended';
  const tone = adv.status === 'SNIPE' ? 'border-rose-400/50 bg-rose-400/10 text-rose-200' : adv.status === 'SKIP' ? 'border-amber-400/50 bg-amber-400/10 text-amber-200' : adv.status === 'WAIT' ? 'border-sky-400/50 bg-sky-400/10 text-sky-200' : 'border-emerald-400/50 bg-emerald-400/10 text-emerald-200';

  const submit = () => {
    if (ended) return;
    if (!val) return setError('Enter a bid amount.');
    if (val < adv.minBid) return setError(`Minimum bid right now is ${inr(adv.minBid)}.`);
    if (val > maxAllowed) return setError(`Demo cap: bids above ${inr(maxAllowed)} aren't allowed.`);
    setError('');
    onBid(a.id, val);
    setAmount(String(val + a.step));
  };

  return (
    <div className="fixed inset-0 z-[110] flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm sm:p-6" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div role="dialog" aria-modal="true" aria-label={`${a.trainName} auction`} className="qb-sheet qb-scroll flex h-full w-full max-w-5xl flex-col overflow-y-auto rounded-none border border-white/10 bg-[#07102a] shadow-2xl sm:h-auto sm:max-h-full sm:rounded-3xl">
        <div className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-white/10 bg-[#07102a]/95 px-4 py-3 backdrop-blur sm:px-6">
          <div className="min-w-0">
            <div className="truncate text-base font-extrabold text-white sm:text-lg" style={HEAD}>{a.trainNo} {a.trainName} · {a.cls}</div>
            <div className="truncate text-xs text-slate-400">{a.from} → {a.to} · {a.dateLabel}</div>
          </div>
          <div className="flex items-center gap-3"><Ring left={a.timeLeft} total={a.total} size={52} />
            <button ref={closeRef} onClick={onClose} aria-label="Close auction" className="grid h-9 w-9 place-items-center rounded-full bg-white/10 text-white hover:bg-white/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#ff8928]">✕</button></div>
        </div>

        <div className="grid gap-5 p-4 sm:p-6 lg:grid-cols-5">
          {/* left: bid or results */}
          <div className="space-y-4 lg:col-span-3">
            {ended && a.result ? <ResultPanel a={a} /> : (
              <>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-xl bg-black/30 p-3"><div className="text-[10px] uppercase tracking-wider text-slate-400">Current bid</div><div key={r[0]?.amount} className="qb-pop text-xl font-extrabold text-white sm:text-2xl" style={MONO}>{inr(r[0]?.amount ?? a.startPrice)}</div></div>
                  <div className="rounded-xl bg-black/30 p-3"><div className="text-[10px] uppercase tracking-wider text-slate-400">Next min bid</div><div key={priceToBeat(a)} className="qb-pop text-xl font-extrabold text-[#ffb784] sm:text-2xl" style={MONO}>{inr(adv.minBid)}</div></div>
                  <div className="rounded-xl bg-black/30 p-3"><div className="text-[10px] uppercase tracking-wider text-slate-400">Starting</div><div className="text-xl font-extrabold text-slate-200 sm:text-2xl" style={MONO}>{inr(a.startPrice)}</div></div>
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
                  <div className="mb-2 flex items-center justify-between"><label htmlFor="qb-amount" className="text-sm font-bold text-white">Your bid</label>
                    <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${st.cls}`}>{st.label}{you ? ` · ${inr(you.amount)}` : ''}</span></div>
                  <div className="flex items-stretch gap-2">
                    <div className="relative flex-1"><span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">₹</span>
                      <input id="qb-amount" inputMode="numeric" autoComplete="off" value={amount} onChange={(e) => { setAmount(e.target.value.replace(/[^0-9]/g, '').slice(0, 6)); setError(''); }} onKeyDown={(e) => { if (e.key === 'Enter') submit(); }}
                        className="w-full rounded-xl border border-white/15 bg-black/40 py-3 pl-7 pr-3 text-lg font-bold text-white focus:border-[#ff8928] focus:outline-none focus:ring-2 focus:ring-[#ff8928]/40" style={MONO} aria-describedby="qb-hint" /></div>
                    <button onClick={submit} className="rounded-xl bg-gradient-to-r from-[#ff8928] to-[#ff5e3a] px-5 text-sm font-extrabold text-[#1a0a00] shadow-[0_8px_24px_-8px_#ff8928] transition hover:brightness-110 active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-white">{you ? 'Raise Bid' : 'Place Bid'}</button>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2 text-xs">
                    <button onClick={() => setAmount(String(adv.minBid))} className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-slate-200 hover:bg-white/10">Min {inr(adv.minBid)}</button>
                    <button onClick={() => setAmount(String((val || adv.minBid) + a.step))} className="rounded-full border border-white/15 bg-white/5 px-3 py-1 text-slate-200 hover:bg-white/10">+{inr(a.step)}</button>
                    <button onClick={() => setAmount(String(adv.suggested))} className="rounded-full border border-cyan-400/40 bg-cyan-400/10 px-3 py-1 text-cyan-200 hover:bg-cyan-400/20">🤖 AI pick {inr(adv.suggested)}</button>
                  </div>
                  <p id="qb-hint" role={error ? 'alert' : undefined} className={`mt-2 text-xs ${error ? 'text-rose-300' : 'text-slate-400'}`}>{error || `Bid steps are ${inr(a.step)}. Top ${a.seats} bids win and pay their own bid. Last-5s bids add +5s.`}</p>
                  <div className="mt-3"><div className="flex justify-between text-[11px] text-slate-300"><span>AI win-chance at {inr(val || adv.suggested)}</span><b style={MONO}>{Math.round(chance * 100)}%</b></div>
                    <div className="mt-1 h-2 rounded-full bg-white/10 overflow-hidden"><div className="h-full rounded-full bg-gradient-to-r from-rose-400 via-amber-300 to-emerald-400" style={{ width: `${Math.round(chance * 100)}%`, transition: 'width .5s ease' }} /></div></div>
                </div>
              </>
            )}

            <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
              <div className="mb-2 flex items-center justify-between text-xs"><span className="font-bold uppercase tracking-wider text-slate-400">Seat board</span><span className="text-slate-500">{a.seats} seats · line = winning cutoff</span></div>
              <ol className="space-y-1.5">
                {r.slice(0, a.seats + 2).map((x, i) => (
                  <React.Fragment key={x.id}>
                    {i === a.seats && <li aria-hidden className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-rose-300"><span className="h-px flex-1 bg-rose-400/50" />cutoff<span className="h-px flex-1 bg-rose-400/50" /></li>}
                    <li className={`flex items-center justify-between rounded-lg px-3 py-1.5 text-sm transition-all duration-500 ${i < a.seats ? 'bg-emerald-400/10' : 'bg-white/[0.03] opacity-70'} ${x.id === 'you' ? 'ring-1 ring-[#ff8928]' : x.id === 'ai' ? 'ring-1 ring-cyan-400' : ''}`}>
                      <span className="flex items-center gap-2 text-slate-100"><span className="w-5 text-slate-500" style={MONO}>{i + 1}</span>{emojiOf(a, x.id)} {nameOf(a, x.id)}</span>
                      <span className="font-bold text-white" style={MONO}>{inr(x.amount)}</span>
                    </li>
                  </React.Fragment>
                ))}
                {r.length === 0 && <li className="px-3 py-2 text-sm text-slate-500">No bids yet — be the first!</li>}
              </ol>
            </div>
          </div>

          {/* right: AI advisor + chart + feed */}
          <div className="space-y-4 lg:col-span-2">
            <div className="rounded-2xl border border-cyan-400/30 bg-gradient-to-br from-cyan-400/10 to-transparent p-4">
              <div className="flex items-center justify-between"><div className="text-sm font-extrabold text-cyan-200" style={HEAD}>🤖 QuickBid AI Advisor</div>
                <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${tone}`}>{adv.status}</span></div>
              <div className="mt-2 text-sm font-bold text-white">{adv.headline}</div>
              <p className="mt-1 text-xs leading-relaxed text-slate-300">{adv.reason}</p>
              <div className="mt-3 grid grid-cols-2 gap-2 text-center text-xs">
                <div className="rounded-lg bg-black/30 p-2"><div className="text-slate-400">Forecast cutoff</div><div className="font-bold text-white" style={MONO}>{inr(adv.predicted)}</div></div>
                <div className="rounded-lg bg-black/30 p-2"><div className="text-slate-400">AI fair price</div><div className="font-bold text-white" style={MONO}>{inr(adv.fair)}</div></div>
              </div>
              <div className="mt-3 space-y-2.5">
                <Bar label="Seats" value={adv.factors.seats} note={adv.notes.seats} color="#34d399" />
                <Bar label="Time pressure" value={adv.factors.time} note={adv.notes.time} color="#fbbf24" />
                <Bar label="Demand" value={adv.factors.demand} note={adv.notes.demand} color="#ff8928" />
                <Bar label="Bid activity" value={adv.factors.activity} note={adv.notes.activity} color="#22d3ee" />
              </div>
              <p className="mt-3 text-[10px] text-slate-500">Expected price growth to close: +{Math.round(adv.growth * 100)}%. Simulated heuristic — not financial advice.</p>
            </div>

            <div className="rounded-2xl border border-white/10 bg-black/20 p-3"><div className="mb-1 text-xs font-bold uppercase tracking-wider text-slate-400">Price to beat</div><Sparkline values={a.history} /></div>

            <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
              <div className="mb-2 flex items-center justify-between text-xs"><span className="font-bold uppercase tracking-wider text-slate-400">Live bids</span><span className="inline-flex items-center gap-1.5 text-emerald-300"><span className="qb-live h-1.5 w-1.5 rounded-full bg-emerald-400" />{ended ? 'closed' : 'streaming'}</span></div>
              <ul className="qb-scroll max-h-56 space-y-1 overflow-y-auto pr-1" aria-live="polite">
                {a.feed.map((f) => (
                  <li key={f.id} className={`qb-feed rounded-md px-2 py-1 text-xs ${f.kind === 'you' ? 'text-[#ffb784] font-semibold' : f.kind === 'ai' ? 'text-cyan-200' : f.kind === 'sys' ? 'text-slate-400 italic' : 'text-slate-200'}`}>
                    <span className="mr-2 text-slate-500" style={MONO}>{mmss(f.at)}</span>{f.text}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
        <div className="border-t border-white/10 px-4 py-3 text-center sm:px-6"><DemoBadge compact /></div>
      </div>
    </div>
  );
}

/* =====================================================================================================================
 * 8. Toasts + confetti
 * ===================================================================================================================== */

function Toasts({ toasts }: { toasts: Toast[] }) {
  const color = (t: Tone) => (t === 'win' ? 'border-emerald-400/60 bg-emerald-900/90' : t === 'good' ? 'border-emerald-400/40 bg-[#0b2a22]/95' : t === 'warn' ? 'border-rose-400/50 bg-[#2a0e18]/95' : 'border-sky-400/40 bg-[#0b1f3a]/95');
  return (
    <div className="pointer-events-none fixed right-3 top-3 z-[130] flex w-[min(92vw,360px)] flex-col gap-2" aria-live="polite">
      {toasts.map((t) => <div key={t.id} className={`qb-toast rounded-xl border px-3.5 py-2.5 text-sm text-white shadow-xl backdrop-blur ${color(t.tone)}`}>{t.text}</div>)}
    </div>
  );
}

function Confetti({ burst }: { burst: number }) {
  const [show, setShow] = useState(false);
  const pieces = useMemo(() => Array.from({ length: 44 }, (_, i) => ({
    id: i, left: Math.random() * 100, dx: `${Math.round(Math.random() * 160 - 80)}px`, delay: `${(Math.random() * 0.6).toFixed(2)}s`, dur: `${(2.2 + Math.random() * 1.6).toFixed(2)}s`,
    color: ['#ff8928', '#22d3ee', '#34d399', '#fbbf24', '#fb7185', '#a78bfa'][i % 6],
  })), [burst]);
  useEffect(() => { if (!burst) return; setShow(true); const t = setTimeout(() => setShow(false), 4200); return () => clearTimeout(t); }, [burst]);
  if (!show) return null;
  return <div className="pointer-events-none fixed inset-0 z-[125] overflow-hidden" aria-hidden>{pieces.map((p) => <span key={`${burst}-${p.id}`} className="qb-confetti" style={{ left: `${p.left}%`, background: p.color, ['--dx' as string]: p.dx, ['--dur' as string]: p.dur, ['--delay' as string]: p.delay }} />)}</div>;
}

/* =====================================================================================================================
 * 9. Page
 * ===================================================================================================================== */

export function QuickBidPage({ onBack }: { onBack?: () => void }) {
  const [round, setRound] = useState(1);
  const [auctions, setAuctions] = useState<Auction[]>(() => makeRound(1));
  const [career, setCareer] = useState<Score>({ you: 0, ai: 0, draw: 0, saved: 0 });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [burst, setBurst] = useState(0);
  const [showRules, setShowRules] = useState(false);
  const seen = useRef<Set<string>>(new Set());
  const toastId = useRef(1);

  // simulation clock: 1 tick per second (paused while the browser tab is hidden)
  useEffect(() => {
    const id = setInterval(() => { if (typeof document !== 'undefined' && document.hidden) return; setAuctions((prev) => prev.map(tick)); }, 1000);
    return () => clearInterval(id);
  }, []);

  // turn auction events into toasts / confetti (each event shown once)
  useEffect(() => {
    auctions.forEach((a) => {
      if (!a.event) return;
      const key = `${a.id}:${a.event.id}`;
      if (seen.current.has(key)) return;
      seen.current.add(key);
      const id = toastId.current++;
      const ev = a.event;
      setToasts((t) => [...t.slice(-3), { id, tone: ev.tone, text: ev.text }]);
      setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4200);
      if (ev.tone === 'win') setBurst((b) => b + 1);
    });
  }, [auctions]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key !== 'Escape') return; if (selectedId) setSelectedId(null); else onBack?.(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selectedId, onBack]);

  const onBid = useCallback((id: string, amount: number) => setAuctions((prev) => prev.map((a) => (a.id === id ? placeBid(a, 'you', amount) : a))), []);

  const roundScore = useMemo<Score>(() => {
    const s: Score = { you: 0, ai: 0, draw: 0, saved: 0 };
    auctions.forEach((a) => { const r = a.result; if (!r || !r.youBid) return; if (r.duel === 'you') s.you++; else if (r.duel === 'ai') s.ai++; else s.draw++; if (r.youWon) s.saved += r.youSaved; });
    return s;
  }, [auctions]);
  const total: Score = { you: career.you + roundScore.you, ai: career.ai + roundScore.ai, draw: career.draw + roundScore.draw, saved: career.saved + roundScore.saved };
  const live = auctions.filter((a) => a.status === 'live').length;
  const allEnded = live === 0;
  const selected = auctions.find((a) => a.id === selectedId) || null;

  const newRound = () => { setCareer(total); setRound((r) => r + 1); setAuctions(makeRound(round + 1)); setSelectedId(null); };
  const resetAll = () => { setCareer({ you: 0, ai: 0, draw: 0, saved: 0 }); setRound(1); setAuctions(makeRound(1)); setSelectedId(null); };

  const lead = total.you > total.ai ? 'You are ahead of the AI 🔥' : total.ai > total.you ? 'The AI is ahead — fight back!' : 'All square';

  return (
    <div className="qb-root relative min-h-full w-full overflow-x-hidden bg-[#050b1a] text-white" style={{ fontFamily: "'Inter', system-ui, sans-serif" }}>
      <QuickBidStyles />
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="qb-float absolute -left-24 -top-24 h-96 w-96 rounded-full bg-[#ff8928]/20 blur-3xl" />
        <div className="qb-float absolute -right-24 top-1/3 h-96 w-96 rounded-full bg-cyan-500/15 blur-3xl" style={{ animationDelay: '-6s' }} />
        <div className="qb-float absolute bottom-0 left-1/3 h-80 w-80 rounded-full bg-violet-500/15 blur-3xl" style={{ animationDelay: '-10s' }} />
      </div>

      {/* demo ribbon */}
      <div className="relative z-10 border-b border-amber-300/30 bg-amber-300/10 px-4 py-2 text-center text-xs font-semibold text-amber-100">
        🧪 {DEMO_LABEL} · fake trains, fake bidders, fake bids · no payments, no IRCTC, no tickets issued
      </div>

      <div className="relative z-10 mx-auto max-w-7xl px-4 pb-16 pt-5 sm:px-6">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            {onBack && <button onClick={onBack} className="rounded-full border border-white/20 bg-white/5 px-3.5 py-1.5 text-sm font-semibold text-white hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#ff8928]">← Back to QuickRail</button>}
          </div>
          <div className="flex items-center gap-2 text-xs">
            <button onClick={() => setShowRules((v) => !v)} aria-expanded={showRules} className="rounded-full border border-white/20 bg-white/5 px-3 py-1.5 font-semibold hover:bg-white/10">{showRules ? 'Hide' : 'How it works'}</button>
            <button onClick={resetAll} className="rounded-full border border-white/20 bg-white/5 px-3 py-1.5 font-semibold hover:bg-white/10">Reset score</button>
          </div>
        </header>

        <div className="mt-6 text-center">
          <h1 className="text-3xl font-black tracking-tight sm:text-5xl" style={HEAD}><span className="qb-bolt">⚡</span> Quick<span className="bg-gradient-to-r from-[#ff8928] via-[#ffb784] to-cyan-300 bg-clip-text text-transparent qb-shimmer">Bid</span></h1>
          <p className="mt-2 text-base font-semibold text-slate-200 sm:text-lg">Can you beat the AI?</p>
          <div className="mt-3"><DemoBadge /></div>
        </div>

        {showRules && (
          <div className="qb-rise mx-auto mt-5 max-w-3xl rounded-2xl border border-white/10 bg-white/[0.05] p-4 text-sm text-slate-200">
            <ul className="list-disc space-y-1 pl-5">
              <li>Each train has a few seats. The <b>top bids win</b> and every winner pays <b>their own bid</b>.</li>
              <li>Bid low and you risk losing; bid high and you overpay. The AI Advisor forecasts the winning price from <b>seats, time, demand and bid activity</b>.</li>
              <li><b>Sniper guard:</b> a bid in the last 5 seconds adds 5 seconds (max 3 times).</li>
              <li>The rival <b>QuickBid AI</b> bids too. Win a seat cheaper than it does to score a point.</li>
              <li>Everything here is simulated: no real tickets, money or QuickRail bookings are involved.</li>
            </ul>
          </div>
        )}

        {/* scoreboard */}
        <section aria-label="Scoreboard" className="mx-auto mt-6 grid max-w-3xl grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-2xl border border-[#ff8928]/40 bg-[#ff8928]/10 p-3 text-center"><div className="text-[11px] uppercase tracking-wider text-[#ffb784]">You</div><div key={total.you} className="qb-pop text-3xl font-black" style={MONO}>{total.you}</div></div>
          <div className="rounded-2xl border border-cyan-400/40 bg-cyan-400/10 p-3 text-center"><div className="text-[11px] uppercase tracking-wider text-cyan-200">QuickBid AI</div><div key={total.ai} className="qb-pop text-3xl font-black" style={MONO}>{total.ai}</div></div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-3 text-center"><div className="text-[11px] uppercase tracking-wider text-slate-400">Draws</div><div className="text-3xl font-black" style={MONO}>{total.draw}</div></div>
          <div className="rounded-2xl border border-white/10 bg-white/5 p-3 text-center"><div className="text-[11px] uppercase tracking-wider text-slate-400">Saved vs fare</div><div className={`text-xl font-black sm:text-2xl ${total.saved < 0 ? 'text-rose-300' : 'text-emerald-300'}`} style={MONO}>{total.saved < 0 ? '-' : ''}{inr(Math.abs(total.saved))}</div></div>
        </section>
        <p className="mt-2 text-center text-xs text-slate-400">Round {round} · {live} live · {lead}</p>

        {allEnded && (
          <div className="qb-rise mx-auto mt-5 flex max-w-3xl flex-col items-center gap-3 rounded-2xl border border-emerald-400/40 bg-emerald-400/10 p-4 text-center sm:flex-row sm:justify-between sm:text-left">
            <div><div className="font-extrabold text-white" style={HEAD}>Round {round} complete 🎉</div><div className="text-sm text-slate-300">Open any card to see the results, or start a fresh round of simulated auctions.</div></div>
            <button onClick={newRound} className="rounded-xl bg-gradient-to-r from-[#ff8928] to-[#ff5e3a] px-5 py-2.5 text-sm font-extrabold text-[#1a0a00] hover:brightness-110 active:scale-95">Start round {round + 1} →</button>
          </div>
        )}

        <section aria-label="Live auctions" className="mt-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {auctions.map((a, i) => <AuctionCard key={a.id} a={a} index={i} onOpen={() => setSelectedId(a.id)} />)}
        </section>

        <footer className="mt-10 text-center text-xs text-slate-500">
          <DemoBadge compact />
          <p className="mt-2">QuickBid is a hackathon demo. Trains, prices, bidders and the AI advisor are simulated in your browser. Nothing here can book, resell or issue a real ticket.</p>
        </footer>
      </div>

      {selected && <DetailSheet key={selected.id} a={selected} onClose={() => setSelectedId(null)} onBid={onBid} />}
      <Toasts toasts={toasts} />
      <Confetti burst={burst} />
    </div>
  );
}

/* =====================================================================================================================
 * 10. Button + launcher (button that opens the full-screen page)
 * ===================================================================================================================== */

export function QuickBidButton({ onClick, className = '', shortOnMobile = false }: { onClick: () => void; className?: string; shortOnMobile?: boolean }) {
  return (
    <>
      <QuickBidStyles />
      <button onClick={onClick} aria-haspopup="dialog"
        className={`qb-btn qb-shimmer inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-[#001026] via-[#12306b] to-[#001026] px-4 py-2.5 text-sm font-bold text-white shadow-[0_8px_28px_-8px_rgba(255,137,40,.7)] ring-1 ring-[#ff8928]/60 transition hover:scale-[1.03] hover:ring-[#ff8928] active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#ff8928] ${className}`}>
        <span className="qb-bolt text-[#ff8928]" aria-hidden>⚡</span>
        {shortOnMobile ? (<><span className="sm:hidden">QuickBid</span><span className="hidden sm:inline">QuickBid – Can you beat the AI?</span></>) : <span>QuickBid – Can you beat the AI?</span>}
        <span className="rounded-full bg-amber-300/20 px-2 py-0.5 text-[10px] font-semibold text-amber-200">DEMO</span>
      </button>
    </>
  );
}

export function QuickBidLauncher({ variant = 'inline', className = '' }: { variant?: 'inline' | 'floating'; className?: string }) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [open]);
  const btn = <QuickBidButton onClick={() => setOpen(true)} shortOnMobile={variant === 'floating'} className={variant === 'floating' ? `fixed bottom-5 left-5 z-40 ${className}` : className} />;
  return (
    <>
      {btn}
      {open && typeof document !== 'undefined' && createPortal(
        <div role="dialog" aria-modal="true" aria-label="QuickBid demo" className="fixed inset-0 z-[100] overflow-y-auto bg-[#050b1a]"><QuickBidPage onBack={() => setOpen(false)} /></div>,
        document.body,
      )}
    </>
  );
}

export default QuickBidPage;
