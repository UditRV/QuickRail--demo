// QuickRail AI — task-oriented booking agent.
//
// The conversation is driven by an explicit state machine (booking_agent_sessions.state), NOT by chat history:
//   IDLE → COLLECTING_JOURNEY → SEARCHING → SHOWING_TRAINS → TRAIN_SELECTED → COLLECTING_PASSENGERS
//        → FARE_CONFIRMATION → AWAITING_USER_CONFIRMATION → PAYMENT → BOOKING → CONFIRMED
//
// Safety invariants (see test/ai.safety.test.js):
//  1. The agent can never charge a payment method: payments are only created by the user's own click on the
//     existing /api/payments endpoints. The agent only places a seat HOLD after explicit confirmation.
//  2. "Confirmed" is shown only after the backend reports a PAID payment on the booking.
//  3. Every id (user, booking, passenger) is checked against the authenticated user in SQL.
//  4. Train names / API data are rendered as data and never fed back into any model prompt.
import crypto from 'crypto';
import { z } from 'zod';
import * as tools from './tools.js';
import * as store from './store.js';
import { resolveStation, getStation } from './stations.js';
import { extractRules } from './nlu.js';
import { llmEnabled, llmExtract } from './llm.js';
import { rankTrains, bestClassOf, minFare } from './ranking.js';
import {
  todayISO, istNow, daysBetween, formatLongDate, formatShortDate, parseDate, departureMatches, describeTimePreference,
  windowByName, toMinutes, fromMinutes,
} from './dateTime.js';
import * as cards from './cards.js';
import { findKnowledgeReply } from './knowledge.js';

const MAX_ADVANCE_DAYS = Number(process.env.AI_MAX_ADVANCE_DAYS || 60);
const MAX_RESULTS = 4;
const MAX_PAX = 6;
const CONFIRM_TTL_MS = 10 * 60 * 1000;
const CLASS_NAMES = { SL: 'Sleeper', '3A': 'AC 3 Tier', '2A': 'AC 2 Tier', '1A': 'AC First Class', CC: 'AC Chair Car', EC: 'Executive Chair Car', '3E': 'AC 3 Economy' };
const BERTHS = ['No Preference', 'Lower (LB)', 'Middle (MB)', 'Upper (UB)', 'Side Lower (SL)', 'Side Upper (SU)'];

const httpError = (status, message) => Object.assign(new Error(message), { status });

// ------------------------------------------------------------------ public entry point
export async function handleTurn({ userId, sessionId, message, action, now = new Date(), llm = llmExtract }) {
  let session;
  if (sessionId) {
    session = await store.loadSession(userId, sessionId);
    if (!session) throw httpError(404, 'Chat session not found');
  } else {
    session = (await store.loadLatestSession(userId)) || (await store.createSession(userId));
  }
  const ctx = { userId, session, state: session.state, now, llm, texts: [], cards: [], suggestions: null, notes: [] };

  if (message != null) {
    const clean = sanitizeText(message);
    await store.appendMessage(session.id, 'user', clean);
    await onText(ctx, clean);
  } else if (action) {
    await onAction(ctx, action);
  } else {
    await renderCurrent(ctx);
  }
  return finish(ctx);
}

/** Restore after refresh: transcript text + the card for the current stage, rebuilt from state. */
export async function getSessionView({ userId, now = new Date() }) {
  const session = await store.loadLatestSession(userId);
  if (!session) return { sessionId: null, stage: 'IDLE', messages: [], current: null, suggestions: defaultSuggestions() };
  const ctx = { userId, session, state: session.state, now, texts: [], cards: [], suggestions: null, notes: [] };
  await renderCurrent(ctx);
  ctx.session.state = ctx.state; await store.saveSession(ctx.session);   // persist refreshed tokens/holds
  const messages = await store.recentMessages(session.id);
  return { sessionId: session.id, stage: session.stage, messages, current: { text: ctx.texts.join('\n\n'), cards: ctx.cards }, suggestions: ctx.suggestions || suggestionsFor(ctx), state: publicState(ctx.state, session.stage) };
}

export async function resetSession(userId) {
  const session = await store.loadLatestSession(userId);
  if (session) {
    const ctx = { userId, session, state: session.state, now: new Date(), texts: [], cards: [], notes: [] };
    await releaseHold(ctx, 'RESET');
    session.state = store.emptyState(); session.stage = 'IDLE';
    await store.saveSession(session);
  }
}

async function finish(ctx) {
  const text = ctx.texts.join('\n\n');
  if (text) await store.appendMessage(ctx.session.id, 'assistant', text);
  ctx.session.state = ctx.state;
  await store.saveSession(ctx.session);
  return {
    sessionId: ctx.session.id, stage: ctx.session.stage,
    message: { role: 'assistant', text, cards: ctx.cards },
    suggestions: ctx.suggestions || suggestionsFor(ctx),
    state: publicState(ctx.state, ctx.session.stage),
  };
}

const say = (ctx, t) => { if (t) ctx.texts.push(t); };
const card = (ctx, c) => { if (c) ctx.cards.push(c); };
const setStage = (ctx, st) => { ctx.session.stage = st; };

export function sanitizeText(s) {
  // strip control chars, collapse whitespace, hard length cap. (Output is rendered as text by the UI.)
  return String(s).replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 500);
}

function publicState(s, stage) {
  return {
    stage,
    source: s.source?.name || null, destination: s.destination?.name || null, date: s.date, classCode: s.classCode,
    passengers: s.passengerCount, selectedTrain: s.selected?.trainNumber || null, fare: s.fare?.totalAmount ?? null,
    holdExpiresAt: s.hold?.expiresAt || null,
  };
}

function defaultSuggestions() {
  return [
    { label: '🚆 Book a Ticket', text: 'Book a ticket' }, { label: '🔎 Find Trains', text: 'Find trains' },
    { label: '💰 Cheapest Train', text: 'Find the cheapest train' }, { label: '⚡ Fastest Train', text: 'Find the fastest train' },
    { label: '📋 My Bookings', text: 'Show my bookings' },
  ];
}
function suggestionsFor(ctx) {
  const s = ctx.state, st = ctx.session.stage;
  if (s.pendingQuestion === 'passengers') return [1, 2, 3, 4].map((n) => ({ label: `${n} passenger${n > 1 ? 's' : ''}`, text: String(n) }));
  if (s.pendingQuestion === 'class') return ['SL', '3A', '2A', '1A', 'CC'].map((c) => ({ label: CLASS_NAMES[c] + ` (${c})`, text: c }));
  if (s.pendingQuestion === 'date') return [{ label: 'Today', text: 'today' }, { label: 'Tomorrow', text: 'tomorrow' }, { label: 'Day after', text: 'day after tomorrow' }];
  if (st === 'SHOWING_TRAINS') return [{ label: 'Cheapest', text: 'Show the cheapest' }, { label: 'Fastest', text: 'Show the fastest' }, { label: 'Change date', text: 'Change the date' }, { label: 'Change class', text: 'Change the class' }];
  if (st === 'AWAITING_USER_CONFIRMATION') return [{ label: 'Change date', text: 'Change the date' }, { label: 'Change class', text: 'Change the class' }, { label: 'Add passenger', text: 'Add one more passenger' }];
  if (['IDLE', 'CONFIRMED'].includes(st) || (!s.source && !s.destination && !s.pendingQuestion)) return defaultSuggestions();
  return [];
}

// ------------------------------------------------------------------ text handling
async function onText(ctx, text) {
  const s = ctx.state;

  // Answer guide/how-to questions before station extraction: words such as "book ticket"
  // must never be mistaken for a city or station.
  const guideQuestion = /^(?:how\s+(?:do|can|should)\s+i\b|how\s+to\b|guide\s+me\b|please\s+guide\b|show\s+me\s+how\b|tell\s+me\s+how\b|where\s+(?:do|can)\s+i\b|what\s+can\s+i\s+do\b|how\s+does\s+(?:quickrail|disha|quickbid)\b|explain\s+(?:how|the)\b)/i.test(text.trim());
  const explicitRoute = /\bfrom\s+[\p{L}][\p{L} .'-]*?\s+to\s+[\p{L}][\p{L} .'-]*?(?=\s+(?:tomorrow|today|on|for|in|at|after|before|with|using|\d)|[,.?!]|$)/iu.test(text)
    || /\bbetween\s+[\p{L}][\p{L} .'-]*?\s+and\s+[\p{L}][\p{L} .'-]*?(?=\s+(?:tomorrow|today|on|for|in|at|after|before|with|using|\d)|[,.?!]|$)/iu.test(text);
  const hasActualPnr = /\b\d{3}[- ]?\d{7}\b/.test(text);
  // A help question may be asked at any point in a booking flow.  Handle it
  // before entity extraction so phrases such as "how to book a ticket" are
  // never sent to station lookup as a source called "book".
  if (guideQuestion && !explicitRoute && !hasActualPnr) {
    const lowerQuestion = text.toLowerCase();
    const focusedGuide = [
      [/journey details|starting station|destination|enter my route/, `🧭 STEP 1 — ENTER JOURNEY DETAILS

[ From station ] → Choose your starting station
        ↓
[ To station ] → Choose your destination
        ↓
[ Travel date ] → Select the date you want to travel
        ↓
[ Continue ] → Search trains for this route and date

Tip: You can type “Book Mumbai to Pune tomorrow for 2 in 3A” to start the booking flow.`],
      [/search and compare|compare trains|find trains/, `🔎 STEP 2 — SEARCH AND COMPARE TRAINS

[ Route + date ]
      ↓
[ Search results ]
      ↓
[ Compare timings, duration and displayed availability ]
      ↓
[ Choose a train ]
      ↓
[ Select an available class ]

Only rely on live availability when a verified live data provider is connected. Select a train to continue.`],
      [/add passenger|passenger details|passenger information/, `👤 STEP 3 — ADD PASSENGERS

[ Select passenger count ]
      ↓
[ Enter each passenger’s required details ]
      ↓
[ Review names, ages and preferences ]
      ↓
[ Submit passenger details ]

Enter accurate information as requested by the form. Do not send passwords, payment OTPs or card details in chat.`],
      [/review (?:the )?fare|check (?:the )?fare|fare before|total amount|price before/, `💰 STEP 4 — REVIEW THE FARE

[ Check train + route + date ]
      ↓
[ Check class + passenger count ]
      ↓
[ Review availability and fare breakdown ]
      ↓
[ Continue only if the details and total are correct ]

The displayed fare depends on the data and pricing configured for this QuickRail deployment.`],
      [/confirm (?:my |the )?booking|booking confirmation/, `✅ STEP 5 — CONFIRM BOOKING

[ Recheck journey and passenger details ]
      ↓
[ Select the explicit Confirm action ]
      ↓
[ Follow the payment step if enabled ]
      ↓
[ Wait for the backend result ]

Do not treat a pending or failed payment as a confirmed booking.`],
      [/payment options|complete payment|pay for|payment method/, `💳 STEP 6 — PAYMENT

[ Review the amount ]
      ↓
[ Choose an available payment option ]
      ↓
[ Complete payment in the secure payment window ]
      ↓
[ Return to QuickRail and wait for verification ]

Never share your OTP, password, PIN or full card details with Disha.`],
      [/confirmed booking|find my booking|view my booking|my bookings/, `📋 FIND A BOOKING

[ Open My Bookings ]
      ↓
[ Find the relevant journey ]
      ↓
[ Open its details ]
      ↓
[ Check the status and PNR if available ]

Disha should report confirmation only when the backend returns a verified booking status.`],
      [/pnr/, `🔎 PNR ENQUIRY

[ Open PNR Enquiry ]
      ↓
[ Enter your PNR ]
      ↓
[ Submit the enquiry ]
      ↓
[ Review the status returned by QuickRail ]

The result depends on the PNR data source connected to this deployment.`],
      [/running status|live train|train status/, `🚆 RUNNING STATUS

[ Open Running Status ]
      ↓
[ Search for or select a train ]
      ↓
[ Request its status ]
      ↓
[ Review the result and last-updated information ]

Live location or delay information is available only if a live status provider is connected.`],
      [/tourist train/, `🧳 TOURIST TRAINS

[ Open Tourist Trains ]
      ↓
[ Browse listed journeys or packages ]
      ↓
[ Open an option to review its details ]
      ↓
[ Follow the available booking or enquiry action ]

Only options actually listed in the deployed app should be treated as available.`],
      [/quickbid|auction/, `⚡ QUICKBID

[ Open QuickBid ]
      ↓
[ Review the demo listing and rules ]
      ↓
[ Explore the auction interaction ]

QuickBid is a demo feature and does not itself issue real railway tickets.`],
      [/meal|catering|food|retiring room|reserve room|book room/, `🍽️ MEALS AND 🛏️ RETIRING ROOMS

[ Open Meals & Catering or the room feature ]
      ↓
[ Provide the PNR or details requested by the feature ]
      ↓
[ Review available options and any displayed amount ]
      ↓
[ Confirm only in the app if the feature supports it ]

Availability and fulfilment depend on the current backend integration.`],
      [/wallet|railwallet|payment/, `💳 RAILWALLET AND PAYMENTS

[ Open RailWallet ]
      ↓
[ Review the balance and available actions ]
      ↓
[ Choose a supported wallet or payment action ]
      ↓
[ Confirm through the app’s own controls ]

Never send payment credentials or OTPs in the chat.`],
      [/cancel/, `↩️ CANCELLATION FLOW

[ Open My Bookings ]
      ↓
[ Select the booking ]
      ↓
[ Review cancellation eligibility and refund information ]
      ↓
[ Confirm cancellation only if you agree ]
      ↓
[ Check the status returned by QuickRail ]

Refunds depend on the booking rules and payment provider; do not assume a refund is complete until it is confirmed.`],
    ].find(([pattern]) => pattern.test(lowerQuestion))?.[1];

    if (focusedGuide) {
      say(ctx, focusedGuide);
      ctx.suggestions = [
        { label: '🧭 Full guide', text: 'How do I use QuickRail?' },
        { label: '🎫 Start booking', text: 'Book a ticket' },
      ];
      return;
    }

    const bookingHowTo = /\b(book|booking|ticket|reserve|reservation)\b/i.test(text);
    const bookingFlow = `🎫 QUICKRAIL — TICKET BOOKING FLOW

[ START ]
    ↓
[ 1. Enter journey ]
From station + To station + Travel date
    ↓
[ 2. Compare trains ]
Choose a train and available class
    ↓
[ 3. Add passengers ]
Names, ages, passenger details and preferences
    ↓
[ 4. Review journey ]
Check train, date, class, availability and total fare
    ↓
[ 5. Confirm booking ]
Confirm only if all details are correct
    ↓
[ 6. Complete payment ]
Use an available payment method, if enabled
    ↓
[ 7. Verify result ]
QuickRail shows a confirmed booking/PNR only after the backend verifies the booking and payment status

Tip: You can type “Book Mumbai to Pune tomorrow for 2 in 3A” to start.`;
    const featureFlow = `🧭 QUICKRAIL — FEATURE GUIDE

[ What do you want to do? ]
    |
    ├── 🎫 Book Train
    |      ↓
    |   Route + date → Train/class → Passengers
    |      → Review fare → Confirm → Payment/result
    |
    ├── 🔎 PNR Enquiry
    |      ↓
    |   Enter PNR → View available ticket status
    |
    ├── 🚆 Running Status
    |      ↓
    |   Find train → View status if live data is connected
    |
    ├── 🧳 Tourist Trains
    |      ↓
    |   Open Tourist Trains → Explore listed journeys
    |
    ├── ⚡ QuickBid
    |      ↓
    |   Open QuickBid → Explore the demo auction
    |   (This does not itself issue real railway tickets)
    |
    ├── 🍽️ Meals / 🛏️ Retiring Rooms
    |      ↓
    |   Open the feature → Follow its PNR-based steps if requested
    |
    ├── 💳 RailWallet / Payments
    |      ↓
    |   Open RailWallet → Review balance/options
    |   Confirm payments yourself
    |
    └── 📋 My Bookings / Cancellations
           ↓
        Open My Bookings → Review booking details
        → Check refund/cancellation terms → Confirm if desired

Which branch should I walk you through?`;
    say(ctx, bookingHowTo ? bookingFlow : featureFlow);
    ctx.suggestions = [
      { label: '🎫 How to book', text: 'How do I book a ticket?' },
      { label: '🔎 PNR & status', text: 'How do I check PNR and running status?' },
      { label: '🍽️ Meals & rooms', text: 'Guide me through meals and retiring rooms' },
      { label: '⚡ QuickBid & wallet', text: 'Explain QuickBid and RailWallet' },
    ];
    return;
  }

  const pctx = { pendingQuestion: s.pendingQuestion, stage: ctx.session.stage, resultCount: s.shown?.length || 0 };
  const rules = extractRules(text, pctx);

  let parsed = rules;
  const strict = ['CONFIRM_BOOKING', 'DECLINE', 'SELECT_TRAIN', 'ABORT_FLOW'].includes(rules.intent);
  if (!strict && llmEnabled()) {
    const l = await ctx.llm(text, pctx);
    if (l) {
      // CONFIRM_BOOKING is honoured only from the strict rule parser — never from a model.
      const intent = l.intent === 'UNKNOWN' || l.intent === 'CONFIRM_BOOKING' || l.intent === 'DECLINE' ? rules.intent : l.intent;
      parsed = { intent, entities: { ...l.entities, ...rules.entities } };
    }
  }
  // Prevent the language model from turning generic commands like “book ticket” into fake station names.
  const entityText = text.trim().toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
  if (/^(?:book|reserve)(?: me)?(?: a)?(?: train)? tickets?$/.test(entityText) ||
      /^(?:a|the) tickets?$/.test(entityText)) {
    if (parsed.entities) {
      if (/^(?:book|reserve)(?: me)?(?: a)?(?: train)? tickets?$/.test(String(parsed.entities.source || '').toLowerCase().trim())) delete parsed.entities.source;
      if (/^(?:book|reserve)(?: me)?(?: a)?(?: train)? tickets?$/.test(String(parsed.entities.destination || '').toLowerCase().trim())) delete parsed.entities.destination;
    }
  }
  // Generic booking requests contain no route. Never accept model-guessed words like
  // "i want" or "book" as station entities; let the state machine ask for the source.
  const genericBookingRequest = /^(?:(?:i\\s+)?(?:want|wanna|need|would\\s+like|\\x27d\\s+like)\\s+(?:to\\s+)?(?:book|reserve)(?:\\s+(?:me\\s+)?(?:a|the)?\\s*(?:train\\s+)?tickets?)?|(?:book|reserve)(?:\\s+me)?(?:\\s+a)?(?:\\s+train)?\\s*tickets?)$/i.test(text.trim());
  if (genericBookingRequest && !/\\bfrom\\b.*\\bto\\b|\\bbetween\\b.*\\band\\b/i.test(text)) {
    parsed.intent = 'BOOK_TICKET';
    if (parsed.entities) {
      delete parsed.entities.source;
      delete parsed.entities.destination;
    }
  }
  const { intent, entities } = parsed;

  // Use stored FAQ/greeting answers only for general conversation while no booking flow is active.
  const generalConversation = ['GREETING', 'HELP', 'UNKNOWN'].includes(intent)
    && ['IDLE', 'CONFIRMED'].includes(ctx.session.stage)
    && !entities.source && !entities.destination && !entities.dateParsed
    && !entities.classCode && !entities.passengers && !entities.pnr;
  if (generalConversation) {
    const knowledgeReply = await findKnowledgeReply(text);
    if (knowledgeReply) { say(ctx, knowledgeReply); return; }
  }

  // A finished booking → a fresh request starts a fresh flow.
  if (ctx.session.stage === 'CONFIRMED' && !['VIEW_BOOKINGS', 'CHECK_PNR', 'HELP', 'GREETING', 'CANCEL_BOOKING', 'CONFIRM_BOOKING', 'DECLINE'].includes(intent)) {
    ctx.state = store.emptyState(); setStage(ctx, 'IDLE');
  }

  // Answering a "which route / which class" question typed in free text
  if (ctx.state.pendingQuestion === 'route' && ctx.state.routeChoices && !['ABORT_FLOW', 'CANCEL_BOOKING'].includes(intent)) {
    if (await answerRoute(ctx, text)) return;
  }
  if (ctx.state.pendingTrain && entities.classCode && !['ABORT_FLOW'].includes(intent)) {
    return selectTrain(ctx, ctx.state.pendingTrain, entities.classCode);
  }

  switch (intent) {
    case 'GREETING': say(ctx, `Hi ${await firstName(ctx)}! I'm QuickRail AI — I can search trains, book tickets, check your PNRs and cancel bookings. Where would you like to go?`); return;
    case 'HELP': return help(ctx);
    case 'ABORT_FLOW': return abort(ctx);
    case 'DECLINE': return decline(ctx);
    case 'CONFIRM_BOOKING': return confirmByText(ctx);
    case 'CANCEL_BOOKING': return startCancel(ctx, entities);
    case 'VIEW_BOOKINGS': return showBookings(ctx);
    case 'CHECK_PNR': return checkPnr(ctx, entities.pnr);
    case 'CHECK_FARE': return showFare(ctx);
    case 'SELECT_TRAIN': return selectFromText(ctx, entities.selection);
    case 'ADD_PASSENGER': return adjustPassengers(ctx, +1);
    case 'REMOVE_PASSENGER': return adjustPassengers(ctx, -1);
    default: break;
  }

  // Everything else edits journey fields and then lets the state machine decide what is missing.
  if (intent === 'BOOK_TICKET') ctx.state.mode = 'BOOK';
  else if (intent === 'SEARCH_TRAIN') ctx.state.mode = ctx.state.mode || 'SEARCH';

  const before = JSON.stringify(journeyKey(ctx.state));
  await applyEntities(ctx, entities, intent, text);
  if (intent === 'CHANGE_DATE' && !entities.dateParsed) { ctx.state.pendingQuestion = 'date'; say(ctx, 'Which date would you like to travel on?'); setStage(ctx, 'COLLECTING_JOURNEY'); return; }
  if (intent === 'CHANGE_CLASS' && !entities.classCode) { ctx.state.pendingQuestion = 'class'; say(ctx, 'Which class would you prefer — Sleeper, 3A, 2A, or 1A?'); return; }
  if (intent === 'CHANGE_SOURCE' && !entities.source) { ctx.state.pendingQuestion = 'source'; say(ctx, 'Which station are you starting from?'); return; }
  if (intent === 'CHANGE_DESTINATION' && !entities.destination) { ctx.state.pendingQuestion = 'destination'; say(ctx, 'Which station are you travelling to?'); return; }

  const nothing = intent === 'UNKNOWN' && before === JSON.stringify(journeyKey(ctx.state)) && !ctx.notes.length;
  if (nothing) {
    say(ctx, "Sorry, I didn't quite get that. I can search trains, book a ticket, show your bookings, check a PNR or cancel a ticket. For example: “Book Mumbai to Pune tomorrow morning for 2 in 3A”.");
    return;
  }
  ctx.notes.forEach((n) => say(ctx, n));
  await drive(ctx);
}

const journeyKey = (s) => [s.source?.code, s.destination?.code, s.date, s.classCode, s.passengerCount, s.preference, s.time && JSON.stringify(s.time), s.selected?.trainNumber, s.passengers.length];

// ------------------------------------------------------------------ entity application
async function applyEntities(ctx, e, intent) {
  const s = ctx.state;
  const changed = new Set();
  const today = todayISO(ctx.now);

  for (const field of ['source', 'destination']) {
    if (!e[field]) continue;
    const r = await resolveStation(e[field]);
    if (r.status === 'none') {
      ctx.notes.push(`I couldn't find a station matching “${e[field].slice(0, 40)}”. Could you check the spelling or give me a nearby city?`);
      s[field] = null; s[`${field}Candidates`] = null; changed.add(field); continue;
    }
    const prev = s[field]?.code;
    if (r.status === 'ok') { s[field] = r.candidates[0]; s[`${field}Candidates`] = null; if (prev !== s[field].code) changed.add(field); }
    else { s[field] = null; s[`${field}Candidates`] = r.candidates; s.routeChoices = null; changed.add(field); }
  }
  if (s.source && s.destination && s.source.code === s.destination.code) {
    ctx.notes.push('Your source and destination are the same station — where would you like to go?');
    s.destination = null; changed.add('destination');
  }

  if (e.dateParsed) {
    if (e.dateParsed.invalid) ctx.notes.push(`“${e.dateParsed.invalid}” doesn't look like a valid date — could you give it again (e.g. 15 October)?`);
    else {
      const d = e.dateParsed.date;
      if (d < today) ctx.notes.push(`${formatLongDate(d)} has already passed — which upcoming date would you like?`);
      else if (daysBetween(today, d) > MAX_ADVANCE_DAYS) ctx.notes.push(`Bookings open up to ${MAX_ADVANCE_DAYS} days ahead (latest: ${formatLongDate(addDaysISO(today, MAX_ADVANCE_DAYS))}). Please choose an earlier date.`);
      else { if (s.date !== d) changed.add('date'); s.date = d; }
      if (e.dateParsed.impliedWindow && !e.time) e.time = { window: windowByName(e.dateParsed.impliedWindow) };
    }
  }
  if (e.dateShift && s.date) { s.date = addDaysISO(s.date, e.dateShift); changed.add('date'); }
  if (e.clearTime && s.time) { s.time = null; changed.add('time'); }
  if (e.time) { if (JSON.stringify(s.time) !== JSON.stringify(e.time)) changed.add('time'); s.time = e.time; }
  if (e.shift) {
    const base = s.time?.after ? toMinutes(s.time.after) : s.shown?.[0] ? toMinutes((s.shown.find((v) => v.trainNumber === s.selected?.trainNumber) || s.shown[0]).departure) : null;
    if (base != null) { s.time = { after: fromMinutes(base + e.shift) }; changed.add('time'); }
    else ctx.notes.push('Tell me roughly what time you want to leave (e.g. “after 8 PM”) and I’ll search again.');
  }
  if (e.classCode) { if (s.classCode !== e.classCode) changed.add('class'); s.classCode = e.classCode; }
  if (e.preference) { if (s.preference !== e.preference) changed.add('preference'); s.preference = e.preference === 'CHEAPER' ? 'CHEAPEST' : e.preference; if (e.preference === 'CHEAPER') s.fareCeiling = currentMinFare(s); }
  if (e.budget) { s.budget = e.budget; changed.add('budget'); }
  if (e.berth) s.berth = e.berth;
  if (e.quota) s.quota = e.quota;

  // passengers
  if (e.withPeople || (e.passengers?.withOthers)) {
    s.peopleNames = (e.withPeople || []).slice(0, MAX_PAX - 1);
    s.includeSelf = e.includeSelf ?? !!e.passengers?.withOthers;
    const n = s.peopleNames.length + (s.includeSelf ? 1 : 0);
    if (n && n !== s.passengerCount) { s.passengerCount = Math.min(n, MAX_PAX); s.passengers = []; changed.add('passengerCount'); }
  } else if (e.passengers?.n) {
    let n = e.passengers.n;
    if (e.passengers.more) n = (s.passengerCount || s.passengers.length || 1) + (e.passengers.delta ?? n);
    n = Math.max(1, Math.min(MAX_PAX, n));
    if (n !== s.passengerCount) {
      s.passengerCount = n; changed.add('passengerCount');
      if (s.passengers.length > n) s.passengers = s.passengers.slice(0, n);
    }
    if (e.passengers.n > MAX_PAX) ctx.notes.push(`I can book up to ${MAX_PAX} passengers per ticket.`);
  }

  const journeyChanged = ['source', 'destination', 'date', 'time', 'class', 'preference', 'budget'].some((k) => changed.has(k));
  if (journeyChanged || changed.has('passengerCount')) {
    if (s.hold) await releaseHold(ctx, 'JOURNEY_CHANGED');
    s.confirmToken = null; s.fare = null; s.awaiting = null;
    if (ctx.session.stage === 'PAYMENT' || ctx.session.stage === 'AWAITING_USER_CONFIRMATION') setStage(ctx, 'COLLECTING_PASSENGERS');
  }
  if (journeyChanged) { s.shown = null; s.selected = null; s.pendingTrain = null; s.routeChoices = null; s.pendingQuestion = null; }
  if (changed.has('source') || changed.has('destination')) s.routeChoices = null;
  s.pendingQuestion = ['source', 'destination', 'date', 'class', 'passengers'].includes(s.pendingQuestion) ? null : s.pendingQuestion;
  if (changed.has('passengerCount') && s.selected) s.passengers = s.passengers.slice(0, s.passengerCount);
}
const addDaysISO = (iso, n) => { const d = new Date(`${iso}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const currentMinFare = (s) => (s.shown?.length ? Math.min(...s.shown.map(minFare)) : null);

// ------------------------------------------------------------------ the state machine "driver"
async function drive(ctx) {
  const s = ctx.state;
  setStage(ctx, 'COLLECTING_JOURNEY');
  const ask = (q, text, suggestions) => { s.pendingQuestion = q; say(ctx, text); return null; };

  if (!s.source && !s.sourceCandidates) return ask('source', ctx.texts.length ? 'Where are you starting your journey from?' : 'Sure! Which station or city are you travelling from?');
  if (!s.destination && !s.destinationCandidates) return ask('destination', 'And where would you like to go?');
  if (!s.date) return ask('date', 'Which date would you like to travel on? (e.g. tomorrow, 15 October, next Friday)');
  // Resolve "Mumbai"/"Delhi"-style ambiguity first: it changes which trains exist, so ask it before anything else.
  s.pendingQuestion = null;
  const routeState = await ensureRoute(ctx);
  if (routeState !== 'READY') return;
  if (s.mode === 'BOOK') {
    if (!s.passengerCount && !s.peopleNames.length && !s.includeSelf) return ask('passengers', 'Sure. How many passengers should I book for?');
    if (!s.classCode) return ask('class', 'Which class would you prefer — Sleeper, 3A, 2A, or 1A?');
  }
  if (!s.shown) { await doSearch(ctx); if (!s.shown) return; }
  if (!s.selected) { setStage(ctx, 'SHOWING_TRAINS'); return; }

  // ---- train selected → passengers → fare → confirmation
  if (!s.passengerCount && !s.peopleNames.length && !s.includeSelf) return ask('passengers', 'Great choice. How many passengers should I book for?');
  return passengerPhase(ctx);
}

async function ensureRoute(ctx) {
  const s = ctx.state;
  if (s.source && s.destination) return 'READY';
  const fromList = s.source ? [s.source] : s.sourceCandidates;
  const toList = s.destination ? [s.destination] : s.destinationCandidates;
  const pairs = await tools.routesWithTrains(fromList.map((x) => x.code), toList.map((x) => x.code));
  const label = (list) => list[0].city || list[0].name;
  if (!pairs.length) {
    setStage(ctx, 'COLLECTING_JOURNEY');
    say(ctx, `I couldn't find any direct trains between ${label(fromList)} and ${label(toList)}. Would you like to try a different station or city?`);
    s.source = s.source || null; s.pendingQuestion = null;
    return 'NONE';
  }
  const byCode = (list) => Object.fromEntries(list.map((x) => [x.code, x]));
  const F = byCode(fromList), T = byCode(toList);
  if (pairs.length === 1) {
    s.source = F[pairs[0].from]; s.destination = T[pairs[0].to]; s.sourceCandidates = s.destinationCandidates = null;
    ctx.notes.push(`Using ${s.source.name} → ${s.destination.name}, the only direct route I have for that.`);
    ctx.notes.splice(0).forEach((n) => say(ctx, n));
    return 'READY';
  }
  s.routeChoices = pairs.slice(0, 6).map((p) => ({ from: F[p.from], to: T[p.to] }));
  s.pendingQuestion = 'route';
  setStage(ctx, 'COLLECTING_JOURNEY');
  say(ctx, `I found more than one station for that. Which route do you mean?`);
  card(ctx, cards.routeChoiceCard(s.routeChoices));
  return 'ASKED';
}

async function answerRoute(ctx, text) {
  const s = ctx.state;
  const t = text.trim().toLowerCase();
  let pick = null;
  const num = t.match(/^(?:option\s*)?(\d)$/);
  if (num && s.routeChoices[+num[1] - 1]) pick = s.routeChoices[+num[1] - 1];
  else {
    const r = await resolveStation(text);
    if (r.status !== 'none') {
      const codes = new Set(r.candidates.map((c) => c.code));
      const narrowed = s.routeChoices.filter((c) => codes.has(c.from.code) || codes.has(c.to.code));
      if (narrowed.length === 1) pick = narrowed[0];
      else if (narrowed.length > 1 && narrowed.length < s.routeChoices.length) { s.routeChoices = narrowed; say(ctx, 'Which of these routes?'); card(ctx, cards.routeChoiceCard(narrowed)); return true; }
    }
  }
  if (!pick) return false;
  return chooseRoute(ctx, pick.from.code, pick.to.code).then(() => true);
}
async function chooseRoute(ctx, from, to) {
  const s = ctx.state;
  const c = (s.routeChoices || []).find((x) => x.from.code === from && x.to.code === to);
  if (!c) { say(ctx, 'That route isn’t one of the options I showed — please pick from the list.'); return; }
  s.source = c.from; s.destination = c.to; s.sourceCandidates = s.destinationCandidates = s.routeChoices = null; s.pendingQuestion = null;
  s.shown = null; s.selected = null;
  await drive(ctx);
}

// ------------------------------------------------------------------ search
async function doSearch(ctx) {
  const s = ctx.state;
  setStage(ctx, 'SEARCHING');
  const today = todayISO(ctx.now);
  const nowMin = istNow(ctx.now).minutes;
  const dateLabel = relLabel(s.date, today);
  let views;
  try {
    views = await tools.searchTrains({ source: s.source.code, destination: s.destination.code, date: s.date, classCode: s.classCode, passengers: s.passengerCount || 1 });
  } catch (err) {
    console.error('[ai] search failed', err.message);
    setStage(ctx, 'COLLECTING_JOURNEY');
    say(ctx, 'Sorry, I couldn’t reach the train search just now. Please try again in a moment.');
    return;
  }
  const where = `${s.source.name} → ${s.destination.name}`;
  const allForRoute = views.length;
  if (!views.length) {
    setStage(ctx, 'COLLECTING_JOURNEY');
    const base = s.classCode ? await tools.searchTrains({ source: s.source.code, destination: s.destination.code, date: s.date }) : [];
    if (s.classCode && base.length) {
      const have = [...new Set(base.flatMap((v) => v.classes.map((c) => c.classCode)))];
      say(ctx, `No train on ${where} has ${s.classCode}. Classes available on this route: ${have.join(', ')}. Which would you like?`);
      s.pendingQuestion = 'class';
    } else {
      say(ctx, `I couldn't find any trains matching those requirements on ${where}. Would you like me to search nearby dates?`);
      ctx.suggestions = [{ label: 'Search nearby dates', text: 'search nearby dates' }, { label: 'Change route', text: 'Change the source' }];
    }
    return;
  }
  if (s.date === today) views = views.filter((v) => toMinutes(v.departure) > nowMin);
  if (s.budget) views = views.filter((v) => minFare(v) <= s.budget);
  if (s.fareCeiling) { const cheaper = views.filter((v) => minFare(v) < s.fareCeiling); if (cheaper.length) views = cheaper; else say(ctx, 'That’s already the cheapest I have for this search.'); s.fareCeiling = null; }

  // Time preference: explicit after/before/around are hard filters; named windows ("evening") are soft.
  let outside = new Set();
  if (s.time) {
    const hard = s.time.after || s.time.before || s.time.around;
    const ok = views.filter((v) => departureMatches(v.departure, s.time));
    if (hard) views = ok;
    else { const okNums = new Set(ok.map((v) => v.trainNumber)); views.forEach((v) => { if (!okNums.has(v.trainNumber)) outside.add(v.trainNumber); }); }
  }
  if (!views.length) {
    setStage(ctx, 'COLLECTING_JOURNEY');
    say(ctx, `I couldn't find any trains matching those requirements${s.time ? ` (${describeTimePreference(s.time)})` : ''}${s.date === today ? ' that haven’t already left' : ''}. Would you like me to search nearby dates or any time of day?`);
    ctx.suggestions = [{ label: 'Any time', text: 'any time' }, { label: 'Search nearby dates', text: 'search nearby dates' }];
    return;
  }
  // in-window trains first, then others only to fill the list
  let ranked = rankTrains(views.filter((v) => !outside.has(v.trainNumber)), { preference: s.preference, timePref: s.time });
  if (ranked.length < 3) ranked = ranked.concat(rankTrains(views.filter((v) => outside.has(v.trainNumber)), { preference: s.preference, timePref: s.time }));
  ranked = ranked.slice(0, MAX_RESULTS).map((v, i) => ({
    ...v, outsideWindow: outside.has(v.trainNumber),
    tag: i === 0 && s.preference === 'CHEAPEST' ? 'Cheapest' : i === 0 && s.preference === 'FASTEST' ? 'Fastest' : i === 0 && (!s.preference || s.preference === 'BEST') && ranked.length > 1 ? 'Best match' : null,
  }));
  s.shown = ranked; s.selected = null; s.pendingTrain = null;
  setStage(ctx, 'SHOWING_TRAINS');

  const anyBookable = ranked.some((v) => v.classes.some((c) => ['AVAILABLE', 'PARTIAL'].includes(c.availability)));
  const pax = s.passengerCount || 1;
  const head = `Here ${ranked.length === 1 ? 'is the option' : `are the best ${ranked.length} options`} for ${where} on ${formatShortDate(s.date)}${dateLabel ? ` (${dateLabel})` : ''}${s.classCode ? ` in ${s.classCode}` : ''}${s.time ? `, ${describeTimePreference(s.time)}` : ''}:`;
  say(ctx, head);
  if (outside.size && ranked.some((v) => v.outsideWindow)) say(ctx, `Fewer than 3 trains run in your preferred time, so I've also included the nearest alternatives (marked).`);
  if (!anyBookable) say(ctx, `${s.classCode ? `This ${s.classCode} class currently doesn't` : 'These trains currently don’t'} have confirmed availability${pax > 1 ? ` for ${pax} passengers` : ''}. I can show other classes or dates, or you can book a waitlist/RAC ticket.`);
  card(ctx, cards.trainsCard({ views: ranked, source: s.source, destination: s.destination, date: s.date, dateLabel, classCode: s.classCode, passengers: pax }));
  say(ctx, 'Which train would you like to book? Tap Select, or reply with the option number.');
  void allForRoute;
}
const relLabel = (date, today) => { const d = daysBetween(today, date); return d === 0 ? 'today' : d === 1 ? 'tomorrow' : null; };

// ------------------------------------------------------------------ selection
async function selectFromText(ctx, sel) {
  const s = ctx.state;
  if (!s.shown?.length || !sel) { say(ctx, 'Let me first find trains for you — where would you like to go?'); return drive(ctx); }
  let view = null;
  if (sel.index) view = s.shown[sel.index - 1];
  else if (sel.trainNumber) view = s.shown.find((v) => v.trainNumber === sel.trainNumber);
  if (!view) { say(ctx, `Please pick one of the options I showed (1–${s.shown.length}).`); card(ctx, await currentTrainsCard(ctx)); return; }
  return selectTrain(ctx, view.trainNumber, null);
}
async function selectTrain(ctx, trainNumber, classCode) {
  const s = ctx.state;
  const view = s.shown?.find((v) => v.trainNumber === trainNumber);   // never trust a client-supplied train outside what we showed
  if (!view) { say(ctx, 'That train isn’t in my current results — let me search again.'); s.shown = null; return drive(ctx); }
  classCode = classCode || s.classCode || (view.classes.length === 1 ? view.classes[0].classCode : null);
  if (!classCode) {
    s.pendingTrain = trainNumber; s.pendingQuestion = null;
    say(ctx, `Which class on ${view.trainName} (${view.trainNumber})?`);
    card(ctx, cards.classChoiceCard(view));
    return;
  }
  if (!view.classes.some((c) => c.classCode === classCode)) {
    say(ctx, `${view.trainName} doesn't have ${classCode}. Available: ${view.classes.map((c) => c.classCode).join(', ')}.`);
    s.pendingTrain = trainNumber; card(ctx, cards.classChoiceCard(view)); return;
  }
  s.selected = { trainNumber, classCode }; s.pendingTrain = null; s.mode = 'BOOK';
  s.classCode = s.classCode || classCode;
  s.fare = null; s.confirmToken = null;
  setStage(ctx, 'TRAIN_SELECTED');
  await drive(ctx);
}

// ------------------------------------------------------------------ passengers
async function passengerPhase(ctx) {
  const s = ctx.state;
  setStage(ctx, 'COLLECTING_PASSENGERS');
  const user = await tools.getUserProfile(ctx.userId);
  const saved = await tools.getSavedPassengers(ctx.userId);

  // "Book for me and Rahul" → try to fill from saved profiles
  if (s.passengers.length < s.passengerCount && (s.peopleNames.length || s.includeSelf)) {
    const found = [];
    const missing = [];
    if (s.includeSelf) {
      const me = saved.find((p) => p.isSelf) || saved.find((p) => p.name.toLowerCase() === (user?.name || '').toLowerCase());
      me ? found.push(me) : missing.push('you');
    }
    for (const n of s.peopleNames) {
      const lc = n.toLowerCase();
      const exact = saved.filter((p) => p.name.toLowerCase() === lc);
      const part = saved.filter((p) => p.name.toLowerCase().split(' ')[0] === lc.split(' ')[0]);
      const hit = exact.length === 1 ? exact[0] : part.length === 1 ? part[0] : null;
      hit && !found.includes(hit) ? found.push(hit) : missing.push(n);
    }
    if (!missing.length && found.length === s.passengerCount) {
      s.passengers = found.map(toPax(s.berth));
      s.peopleNames = []; s.includeSelf = false;
    } else {
      s.prefillIds = found.map((p) => p.id);
    }
  }
  if (s.passengers.length === s.passengerCount) return summaryPhase(ctx);

  say(ctx, `Please add the ${s.passengerCount === 1 ? 'passenger’s' : `${s.passengerCount} passengers’`} details${saved.length ? ' — you can pick saved passengers or enter new ones' : ''}. This form is sent securely and isn’t stored in the chat history.`);
  card(ctx, cards.passengerFormCard({
    count: s.passengerCount, saved, preselected: s.prefillIds || [], current: s.passengers,
    defaultBerth: s.berth, userName: user?.name,
  }));
}
const toPax = (berth) => (p) => ({ name: p.name, age: p.age, gender: p.gender, berthPreference: berth || p.berthPreference || 'No Preference', savedId: p.id });

const paxSchema = z.object({
  savedId: z.string().uuid().optional(),
  name: z.string().trim().min(1).max(60).regex(/^[A-Za-z][A-Za-z .'-]*$/, 'Names can only contain letters').optional(),
  age: z.number().int().min(0).max(120).optional(),
  gender: z.enum(['Male', 'Female', 'Transgender']).optional(),
  berthPreference: z.enum(BERTHS).optional(),
  save: z.boolean().optional(),
});

async function submitPassengers(ctx, list) {
  const s = ctx.state;
  if (!s.selected || ctx.session.stage !== 'COLLECTING_PASSENGERS') { say(ctx, 'There’s no booking waiting for passenger details right now.'); return; }
  const parsed = z.array(paxSchema).min(1).max(MAX_PAX).safeParse(list);
  if (!parsed.success) { say(ctx, 'Some passenger details look invalid — names should be letters only and ages between 0 and 120.'); return passengerPhase(ctx); }
  const saved = await tools.getSavedPassengers(ctx.userId);   // ownership: only THIS user's saved passengers are ever resolvable
  const out = [];
  for (const p of parsed.data) {
    if (p.savedId) {
      const hit = saved.find((x) => x.id === p.savedId);
      if (!hit) { say(ctx, 'One of the selected saved passengers couldn’t be found on your account.'); return passengerPhase(ctx); }
      out.push({ name: hit.name, age: hit.age, gender: hit.gender, berthPreference: p.berthPreference || hit.berthPreference || 'No Preference', savedId: hit.id });
    } else {
      if (!p.name || p.age == null || !p.gender) { say(ctx, 'Please fill in name, age and gender for every passenger.'); return passengerPhase(ctx); }
      out.push({ name: p.name, age: p.age, gender: p.gender, berthPreference: p.berthPreference || 'No Preference' });
      if (p.save) await tools.savePassenger(ctx.userId, out[out.length - 1]);
    }
  }
  if (s.passengerCount && out.length !== s.passengerCount) { say(ctx, `You asked for ${s.passengerCount} passenger${s.passengerCount > 1 ? 's' : ''} — please provide exactly that many (or tell me to change the number).`); return passengerPhase(ctx); }
  const names = out.map((p) => p.name.toLowerCase());
  if (new Set(names).size !== names.length) { say(ctx, 'Two passengers have the same name — please check the details.'); return passengerPhase(ctx); }
  s.passengers = out; s.passengerCount = out.length; s.peopleNames = []; s.includeSelf = false; s.prefillIds = [];
  await store.audit(ctx.userId, ctx.session.id, 'PASSENGERS_SUBMITTED', { count: out.length });
  say(ctx, 'Thanks — passenger details received.');
  await summaryPhase(ctx);
}

async function adjustPassengers(ctx, delta) {
  const s = ctx.state;
  const cur = s.passengerCount || s.passengers.length || 1;
  const n = cur + delta;
  if (n < 1) { say(ctx, 'A booking needs at least one passenger.'); return; }
  if (n > MAX_PAX) { say(ctx, `I can book up to ${MAX_PAX} passengers per ticket.`); return; }
  if (s.hold) await releaseHold(ctx, 'PASSENGERS_CHANGED');
  s.passengerCount = n; s.fare = null; s.confirmToken = null; s.awaiting = null;
  if (delta < 0) s.passengers = s.passengers.slice(0, n);
  if (!s.mode) s.mode = 'BOOK';
  say(ctx, `Okay — ${n} passenger${n > 1 ? 's' : ''}.`);
  if (!s.shown && s.source) { s.shown = null; }
  await drive(ctx);
}

// ------------------------------------------------------------------ summary → confirm → hold
async function liveQuote(ctx) {
  const s = ctx.state;
  const live = await tools.checkAvailability({ source: s.source.code, destination: s.destination.code, date: s.date, trainNumber: s.selected.trainNumber, classCode: s.selected.classCode, passengers: s.passengerCount });
  if (!live) return null;
  const fare = tools.calculateFare({ basePrice: live.class.fare, passengerCount: s.passengerCount });
  return { view: live.train, cls: live.class, fare: { ...fare, perPassenger: live.class.fare, passengers: s.passengerCount } };
}

async function summaryPhase(ctx, notice) {
  const s = ctx.state;
  setStage(ctx, 'FARE_CONFIRMATION');
  const q = await liveQuote(ctx);
  if (!q) {
    say(ctx, 'That train/class is no longer available for your date. Let me search again.');
    s.shown = null; s.selected = null; return drive(ctx);
  }
  s.fare = q.fare; s.expected = { availability: q.cls.availability, total: q.fare.totalAmount };
  s.confirmToken = crypto.randomBytes(16).toString('hex'); s.confirmExpires = ctx.now.getTime() + CONFIRM_TTL_MS; s.awaiting = 'booking';
  setStage(ctx, 'AWAITING_USER_CONFIRMATION');
  if (notice) say(ctx, notice);
  say(ctx, 'Great. Please review your booking. Nothing is charged until you confirm and pay.');
  card(ctx, cards.summaryCard({
    token: s.confirmToken, expiresAt: new Date(s.confirmExpires).toISOString(), view: q.view, cls: q.cls,
    from: s.source.name, to: s.destination.name, date: s.date, passengers: s.passengers, fare: q.fare, status: q.cls.availability, quota: s.quota,
  }));
  say(ctx, 'Shall I proceed? You can tap Confirm & Pay, or reply “yes”.');
}

async function confirmByText(ctx) {
  const s = ctx.state;
  if (s.awaiting === 'cancel') return executeCancel(ctx, null);
  if (s.awaiting === 'booking' && ctx.session.stage === 'AWAITING_USER_CONFIRMATION') return confirmBooking(ctx, null);
  if (s.awaiting === 'payment' && s.hold) { say(ctx, 'Your seats are held — please choose a payment method on the card above to complete the booking.'); await renderCurrent(ctx, { skipText: true }); return; }
  say(ctx, 'There’s nothing waiting for confirmation right now. What would you like to do?');
}

async function confirmBooking(ctx, token) {
  const s = ctx.state;
  if (ctx.session.stage !== 'AWAITING_USER_CONFIRMATION' || s.awaiting !== 'booking' || !s.confirmToken) { say(ctx, 'There’s no booking waiting for confirmation.'); return; }
  if (token != null && token !== s.confirmToken) { say(ctx, 'That confirmation is out of date. Let me show you the latest summary.'); return summaryPhase(ctx); }
  if (ctx.now.getTime() > s.confirmExpires) { say(ctx, 'That summary has expired, so I’ve refreshed it with live availability.'); return summaryPhase(ctx); }

  // Re-check live fare/availability at the moment of confirmation — never book on stale numbers.
  const q = await liveQuote(ctx);
  if (!q) { say(ctx, 'That train/class is no longer available. Let me search again.'); s.shown = null; s.selected = null; return drive(ctx); }
  const tier = (a) => (['AVAILABLE', 'PARTIAL'].includes(a) ? 0 : a === 'RAC' ? 1 : 2);
  if (q.fare.totalAmount !== s.expected.total || tier(q.cls.availability) !== tier(s.expected.availability)) {
    return summaryPhase(ctx, 'The fare or availability changed since I showed you the summary, so please review it again.');
  }
  setStage(ctx, 'BOOKING');
  const user = await tools.getUserProfile(ctx.userId);
  try {
    const booking = await tools.createBooking(ctx.userId, {
      trainNumber: s.selected.trainNumber, classCode: s.selected.classCode, journeyDate: s.date,
      fromStationCode: s.source.code, toStationCode: s.destination.code, quota: s.quota || 'GN',
      contactMobile: user.mobile, contactEmail: user.email, preferredCoach: undefined,
      autoUpgradation: false, bookOnlyIfConfirm: false, quickRailAssured: false, travelInsurance: false,
      passengers: s.passengers.map((p) => ({ name: p.name, age: p.age, gender: p.gender, berthPreference: p.berthPreference })),
    });
    s.hold = { bookingId: booking.id, expiresAt: new Date(booking.expires_at).toISOString(), total: Number(booking.total_amount) };
    s.confirmToken = null; s.awaiting = 'payment';
    setStage(ctx, 'PAYMENT');
    await store.audit(ctx.userId, ctx.session.id, 'HOLD_CREATED', { bookingId: booking.id, train: s.selected.trainNumber, classCode: s.selected.classCode, date: s.date, passengers: s.passengers.length, total: s.hold.total });
    say(ctx, 'Seats are held for 8 minutes. Choose how you’d like to pay — you’ll be charged only when you press pay.');
    card(ctx, paymentCardFor(s, user));
  } catch (err) {
    console.error('[ai] hold failed', err.message);
    await store.audit(ctx.userId, ctx.session.id, 'BOOKING_FAILED', { reason: String(err.message).slice(0, 120) });
    s.confirmToken = null; s.awaiting = null;
    setStage(ctx, 'COLLECTING_JOURNEY');
    say(ctx, 'The booking could not be completed. Please check your booking status before trying again.');
    ctx.suggestions = [{ label: '📋 My Bookings', text: 'Show my bookings' }, { label: 'Search again', text: 'Find trains' }];
  }
}
function paymentCardFor(s, user) {
  const v = s.shown?.find((x) => x.trainNumber === s.selected.trainNumber);
  return cards.paymentCard({ bookingId: s.hold.bookingId, total: s.hold.total, expiresAt: s.hold.expiresAt, walletBalance: user?.walletBalance ?? 0, trainLabel: `${s.selected.trainNumber} ${v?.trainName || ''}`.trim(), dateLong: formatLongDate(s.date) });
}

async function releaseHold(ctx, reason) {
  const s = ctx.state;
  if (!s.hold) return;
  const id = s.hold.bookingId;
  try {
    const b = await tools.getBookingStatus(ctx.userId, id);
    // Only an unpaid PENDING hold may be released — never cancel something already paid (that would refund 75%).
    if (b && b.status === 'PENDING') { await tools.cancelBooking(ctx.userId, id); await store.audit(ctx.userId, ctx.session.id, 'HOLD_RELEASED', { bookingId: id, reason }); }
  } catch (err) { console.error('[ai] releaseHold failed', err.message); }
  s.hold = null;
  if (s.awaiting === 'payment') s.awaiting = null;
}

async function onPaymentResult(ctx, outcome) {
  const s = ctx.state;
  if (!s.hold || ctx.session.stage !== 'PAYMENT') { say(ctx, 'I don’t have a payment in progress.'); return; }
  if (outcome !== 'success') {
    await store.audit(ctx.userId, ctx.session.id, 'PAYMENT_NOT_COMPLETED', { bookingId: s.hold.bookingId, outcome });
    say(ctx, 'The payment wasn’t completed. Your ticket has not been confirmed.');
    if (new Date(s.hold.expiresAt).getTime() > ctx.now.getTime()) {
      say(ctx, 'Your seats are still held for a few minutes — you can try again.');
      const user = await tools.getUserProfile(ctx.userId); card(ctx, paymentCardFor(s, user));
    } else {
      await releaseHold(ctx, 'EXPIRED'); s.awaiting = null; s.confirmToken = null; setStage(ctx, 'COLLECTING_PASSENGERS');
      say(ctx, 'The 8-minute hold has expired and the seats were released. Say “yes” after I show the summary again to retry.');
      await summaryPhase(ctx);
    }
    return;
  }
  // Never trust the client's word: ask the backend whether the booking is really paid.
  setStage(ctx, 'BOOKING');
  const b = await tools.getBookingStatus(ctx.userId, s.hold.bookingId);
  const paid = b?.payments?.some((p) => p.status === 'PAID');
  if (!b || !paid || !['CONFIRMED', 'RAC', 'WAITLIST'].includes(b.status)) {
    setStage(ctx, 'PAYMENT');
    say(ctx, 'I couldn’t verify that payment yet, so your ticket has not been confirmed. Please check My Bookings in a minute before paying again.');
    return;
  }
  const [from, to] = await Promise.all([getStation(b.fromStationCode), getStation(b.toStationCode)]);
  const view = cards.confirmationCard({ ...b, fromName: from?.name, toName: to?.name });
  await store.audit(ctx.userId, ctx.session.id, 'BOOKING_COMPLETED', { bookingId: b.id, status: b.status, total: b.totalAmount });
  s.completed = { bookingId: b.id };
  // booking done → drop passenger data from the session state
  const done = { ...store.emptyState(), completed: s.completed };
  ctx.state = done;
  setStage(ctx, 'CONFIRMED');
  say(ctx, b.status === 'CONFIRMED' ? '🎉 Your ticket is confirmed!' : `Your booking is placed with status ${b.status}. It is not a confirmed berth yet.`);
  card(ctx, view);
}

// ------------------------------------------------------------------ cancel, view, pnr
async function startCancel(ctx, ents) {
  const s = ctx.state;
  const list = await tools.getUserBookings(ctx.userId, { activeOnly: true, limit: 10 });
  const names = await stationNames(list);
  if (s.hold && ctx.session.stage === 'PAYMENT' && !ents.pnr) {
    say(ctx, 'You have a seat hold waiting for payment. Say “cancel” to release it, or tell me the PNR of an existing ticket to cancel.');
    return;
  }
  let target = ents.pnr ? list.filter((b) => b.pnr === ents.pnr) : list;
  if (ents.pnr && !target.length) { say(ctx, 'I couldn’t find an active booking with that PNR on your account.'); return; }
  if (!target.length) { say(ctx, 'You don’t have any active bookings to cancel.'); return; }
  if (target.length > 1) {
    say(ctx, 'Which booking would you like to cancel?');
    card(ctx, cards.bookingsCard(target, names, 'Choose a booking to cancel'));
    return;
  }
  return presentCancel(ctx, target[0], names);
}
async function presentCancel(ctx, b, names) {
  const s = ctx.state;
  s.pendingCancel = { bookingId: b.id, token: crypto.randomBytes(16).toString('hex'), expires: ctx.now.getTime() + CONFIRM_TTL_MS };
  s.awaiting = 'cancel';
  const refund = b.paid ? Math.round(b.totalAmount * 0.75 * 100) / 100 : 0;
  say(ctx, 'Booking found. Are you sure you want to cancel this ticket?');
  card(ctx, cards.cancelConfirmCard({ token: s.pendingCancel.token, booking: b, names, refund }));
}
async function cancelSelect(ctx, bookingId) {
  const list = await tools.getUserBookings(ctx.userId, { activeOnly: true, limit: 20 });   // scoped to this user in SQL
  const b = list.find((x) => x.id === bookingId);
  if (!b) { say(ctx, 'I couldn’t find that booking on your account.'); await store.audit(ctx.userId, ctx.session.id, 'CANCEL_DENIED', { bookingId }); return; }
  return presentCancel(ctx, b, await stationNames([b]));
}
async function executeCancel(ctx, token) {
  const s = ctx.state, pc = s.pendingCancel;
  if (!pc || s.awaiting !== 'cancel') { say(ctx, 'There’s no cancellation waiting for confirmation.'); return; }
  if (token != null && token !== pc.token) { say(ctx, 'That cancellation request is out of date.'); s.pendingCancel = null; s.awaiting = null; return; }
  if (ctx.now.getTime() > pc.expires) { say(ctx, 'That cancellation request expired — please ask me to cancel again.'); s.pendingCancel = null; s.awaiting = null; return; }
  const bookingId = pc.bookingId;
  s.pendingCancel = null; s.awaiting = s.hold ? 'payment' : null;
  await store.audit(ctx.userId, ctx.session.id, 'CANCEL_REQUESTED', { bookingId });
  try {
    const before = await tools.getBookingStatus(ctx.userId, bookingId);
    const paid = before?.payments?.some((p) => p.status === 'PAID');
    await tools.cancelBooking(ctx.userId, bookingId);
    await store.audit(ctx.userId, ctx.session.id, 'CANCELLED', { bookingId });
    const refund = paid ? Math.round(before.totalAmount * 0.75 * 100) / 100 : 0;
    say(ctx, `Your ticket (PNR ${before?.pnr}) has been cancelled.${refund ? ` ${cards.inr(refund)} was refunded to your RailWallet per the cancellation policy.` : ''}`);
  } catch (err) {
    console.error('[ai] cancel failed', err.message);
    say(ctx, err.status === 409 ? 'That booking was already cancelled.' : 'I couldn’t cancel that ticket. Please check My Bookings and try again.');
  }
}
async function decline(ctx) {
  const s = ctx.state;
  if (s.awaiting === 'cancel') { s.pendingCancel = null; s.awaiting = s.hold ? 'payment' : null; say(ctx, 'Okay — your ticket is unchanged.'); return; }
  if (s.awaiting === 'booking') { s.awaiting = null; say(ctx, 'No problem. What would you like to change — the date, class, passengers or the train?'); ctx.suggestions = [{ label: 'Change date', text: 'Change the date' }, { label: 'Change class', text: 'Change the class' }, { label: 'Another train', text: 'Show other trains' }, { label: 'Cancel booking flow', text: 'cancel' }]; return; }
  say(ctx, 'Okay. Anything else I can help with?');
}
async function abort(ctx) {
  const s = ctx.state;
  if (s.awaiting === 'cancel') return decline(ctx);
  await releaseHold(ctx, 'USER_ABORTED');
  ctx.state = store.emptyState(); setStage(ctx, 'IDLE');
  say(ctx, 'Okay, I’ve cleared this booking — nothing was charged. What would you like to do next?');
}
async function showBookings(ctx) {
  const list = await tools.getUserBookings(ctx.userId, { limit: 10 });
  if (!list.length) { say(ctx, 'You don’t have any bookings yet. Want to book a ticket?'); return; }
  say(ctx, `Here ${list.length === 1 ? 'is your booking' : 'are your latest bookings'}:`);
  card(ctx, cards.bookingsCard(list, await stationNames(list)));
}
async function checkPnr(ctx, pnr) {
  if (!pnr) { say(ctx, 'Please send me the 10-digit PNR (for example 241-9084321).'); return; }
  const b = await tools.getPNR(ctx.userId, pnr);
  if (!b) { say(ctx, 'I can only show PNRs booked from your account, and I couldn’t find that one. For any other PNR, use PNR Enquiry on the QuickRail site.'); return; }
  const [from, to] = await Promise.all([getStation(b.fromStationCode), getStation(b.toStationCode)]);
  say(ctx, `PNR ${b.pnr}: ${b.status}`);
  card(ctx, { ...cards.confirmationCard({ ...b, fromName: from?.name, toName: to?.name }), heading: `PNR status — ${b.status}` });
}
async function stationNames(list) {
  const codes = [...new Set(list.flatMap((b) => [b.fromCode, b.toCode]))];
  const out = {};
  for (const c of codes) out[c] = (await getStation(c))?.name || c;
  return out;
}

// ------------------------------------------------------------------ fare / help
async function showFare(ctx) {
  const s = ctx.state;
  if (s.selected && s.passengerCount) {
    const q = await liveQuote(ctx);
    if (q) { const f = q.fare; say(ctx, `Fare for ${s.passengerCount} passenger${s.passengerCount > 1 ? 's' : ''} in ${s.selected.classCode}: base ${cards.inr(f.baseAmount)} + convenience fee ${cards.inr(f.convenienceFee)} + GST ${cards.inr(f.gstAmount)} = **${cards.inr(f.totalAmount)}**.`); return; }
  }
  if (s.shown?.length) { say(ctx, 'Per-passenger fares are shown on each train card above. Select a train and I’ll calculate the exact total.'); card(ctx, await currentTrainsCard(ctx)); return; }
  say(ctx, 'Tell me the route and date (e.g. “Mumbai to Pune tomorrow”) and I’ll show you the fares.');
}
function help(ctx) {
  say(ctx, 'I can: \n• search trains (“cheapest train from Mumbai to Surat on Saturday”)\n• book a ticket step by step — you always review the fare before anything is charged\n• change details mid-way (“make it 2A”, “leave an hour later”)\n• show your bookings, check a PNR, or cancel a ticket.');
  ctx.suggestions = defaultSuggestions();
}
async function firstName(ctx) { const u = await tools.getUserProfile(ctx.userId); return (u?.name || '').split(' ')[0] || 'there'; }

// ------------------------------------------------------------------ re-render current stage (page refresh / resume)
async function currentTrainsCard(ctx) {
  const s = ctx.state, today = todayISO(ctx.now);
  return cards.trainsCard({ views: s.shown, source: s.source, destination: s.destination, date: s.date, dateLabel: relLabel(s.date, today), classCode: s.classCode, passengers: s.passengerCount || 1 });
}
async function renderCurrent(ctx, opts = {}) {
  const s = ctx.state, st = ctx.session.stage;
  const t = (x) => { if (!opts.skipText) say(ctx, x); };
  if (st === 'IDLE' || (!s.source && !s.destination && !s.sourceCandidates && !s.hold && !s.pendingCancel)) {
    if (st === 'CONFIRMED' && s.completed) {
      const b = await tools.getBookingStatus(ctx.userId, s.completed.bookingId);
      if (b) { const [f, to] = await Promise.all([getStation(b.fromStationCode), getStation(b.toStationCode)]); card(ctx, cards.confirmationCard({ ...b, fromName: f?.name, toName: to?.name })); return; }
    }
    t(`Hi ${await firstName(ctx)}! I'm QuickRail AI, your AI railway booking assistant. Tell me where you want to go — for example “Book Mumbai to Pune tomorrow morning for 2 in 3A”.`);
    return;
  }
  if (s.awaiting === 'cancel' && s.pendingCancel) {
    const list = await tools.getUserBookings(ctx.userId, { activeOnly: true });
    const b = list.find((x) => x.id === s.pendingCancel.bookingId);
    if (b) return presentCancel(ctx, b, await stationNames([b]));
  }
  if (st === 'PAYMENT' && s.hold) {
    const b = await tools.getBookingStatus(ctx.userId, s.hold.bookingId);
    if (b && b.status !== 'PENDING') { return onPaymentResult(ctx, 'success'); }
    if (new Date(s.hold.expiresAt) < ctx.now) { await releaseHold(ctx, 'EXPIRED'); s.awaiting = null; return summaryPhase(ctx, 'Your payment window expired and the seats were released. Here is a fresh summary.'); }
    t('Welcome back — your seats are still held. Choose a payment method to finish.');
    card(ctx, paymentCardFor(s, await tools.getUserProfile(ctx.userId))); return;
  }
  if (st === 'AWAITING_USER_CONFIRMATION' && s.selected) { return summaryPhase(ctx); }
  if (st === 'COLLECTING_PASSENGERS' && s.selected) return passengerPhase(ctx);
  if (s.routeChoices && s.pendingQuestion === 'route') { t('Which route do you mean?'); card(ctx, cards.routeChoiceCard(s.routeChoices)); return; }
  if (s.pendingTrain && s.shown) { const v = s.shown.find((x) => x.trainNumber === s.pendingTrain); if (v) { t('Which class would you like?'); card(ctx, cards.classChoiceCard(v)); return; } }
  if (st === 'SHOWING_TRAINS' && s.shown) { t('Here are your options again. Which train would you like?'); card(ctx, await currentTrainsCard(ctx)); return; }
  t('Welcome back! Let’s continue with your booking.');
  await drive(ctx);
}

// ------------------------------------------------------------------ button actions
const actionSchema = z.discriminatedUnion('type', [
  z.object({
  type: z.literal('SELECT_TRAIN'),
  trainNumber: z.string().min(3).max(8).regex(/^[A-Z0-9]+$/),
  classCode: z.string().max(3).optional(),
}),
  z.object({ type: z.literal('CHOOSE_ROUTE'), from: z.string().max(8), to: z.string().max(8) }),
  z.object({ type: z.literal('SUBMIT_PASSENGERS'), passengers: z.array(z.any()).min(1).max(MAX_PAX) }),
  z.object({ type: z.literal('CONFIRM_BOOKING'), token: z.string().max(64) }),
  z.object({ type: z.literal('CHANGE_DETAILS') }),
  z.object({ type: z.literal('CANCEL_FLOW') }),
  z.object({ type: z.literal('PAYMENT_RESULT'), outcome: z.enum(['success', 'failed', 'cancelled']) }),
  z.object({ type: z.literal('CANCEL_SELECT'), bookingId: z.string().uuid() }),
  z.object({ type: z.literal('CANCEL_CONFIRM'), token: z.string().max(64) }),
  z.object({ type: z.literal('KEEP_TICKET') }),
  z.object({ type: z.literal('VIEW_BOOKINGS') }),
]);
export async function onAction(ctx, raw) {
  const parsed = actionSchema.safeParse(raw);
  if (!parsed.success) throw httpError(400, 'Invalid action');
  const a = parsed.data;
  switch (a.type) {
    case 'SELECT_TRAIN': return selectTrain(ctx, a.trainNumber, a.classCode || null);
    case 'CHOOSE_ROUTE': return chooseRoute(ctx, a.from, a.to);
    case 'SUBMIT_PASSENGERS': return submitPassengers(ctx, a.passengers);
    case 'CONFIRM_BOOKING': return confirmBooking(ctx, a.token);
    case 'CHANGE_DETAILS': return decline(ctx).then(() => { ctx.state.awaiting = null; });
    case 'CANCEL_FLOW': return abort(ctx);
    case 'PAYMENT_RESULT': return onPaymentResult(ctx, a.outcome);
    case 'CANCEL_SELECT': return cancelSelect(ctx, a.bookingId);
    case 'CANCEL_CONFIRM': return executeCancel(ctx, a.token);
    case 'KEEP_TICKET': return decline(ctx);
    case 'VIEW_BOOKINGS': return showBookings(ctx);
    default: throw httpError(400, 'Unsupported action');
  }
}
