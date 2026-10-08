// Deterministic intent + entity extraction. Works with no API key and is the fallback / safety net
// for the optional LLM extractor (llm.js). Output uses RAW phrases that normalise() resolves.
import { parseDate, parseTimePreference } from './dateTime.js';

export const INTENTS = [
  'SEARCH_TRAIN', 'BOOK_TICKET', 'SELECT_TRAIN', 'CHANGE_DATE', 'CHANGE_SOURCE', 'CHANGE_DESTINATION',
  'CHANGE_CLASS', 'ADD_PASSENGER', 'REMOVE_PASSENGER', 'CHECK_FARE', 'CONFIRM_BOOKING', 'CANCEL_BOOKING',
  'VIEW_BOOKINGS', 'CHECK_PNR', 'HELP', 'ABORT_FLOW', 'DECLINE', 'GREETING', 'MODIFY', 'UNKNOWN',
];

const NUM_WORDS = { a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, couple: 2 };
const numOf = (s) => (/^\d+$/.test(s) ? +s : NUM_WORDS[s?.toLowerCase()] ?? null);

export const CLASS_PATTERNS = [
  ['3E', /\b3\s?e\b|\b3\s*(?:tier\s*)?economy\b|\bthird\s+economy\b/],
  ['1A', /\b1\s?a\b|\b(?:ac\s*)?(?:first|1st)\s*(?:class\s*)?(?:ac)?\b(?!\s*(?:of|time))|\bfirst ac\b|\bac\s*1\b/],
  ['2A', /\b2\s?a\b|\b2\s?-?\s?(?:tier|ac)\b|\bac\s*2\b|\bsecond ac\b|\b2\s*ac\b/],
  ['3A', /\b3\s?a\b|\b3\s?-?\s?(?:tier|ac)\b|\bac\s*3\b|\bthird ac\b|\b3\s*ac\b/],
  ['SL', /\bsl\b|\bsleeper\b|\bnon[- ]?ac\b/],
  ['EC', /\bec\b|\bexecutive(?: chair(?: car)?)?\b/],
  ['CC', /\bcc\b|\bchair car\b|\bac chair\b/],
];
export function parseClass(text) {
  const t = String(text).toLowerCase();
  for (const [code, re] of CLASS_PATTERNS) if (re.test(t)) return code;
  return null;
}

export function parsePassengerCount(text) {
  const t = String(text).toLowerCase();
  let m;
  if ((m = t.match(/\b(\d+|one|two|three|four|five|six|a couple of)\s*(?:more\s+)?(?:adults?|persons?|people|passengers?|pax|tickets?|seats?|travell?ers?|members|of us)\b/)))
    return { n: numOf(m[1] === 'a couple of' ? 'couple' : m[1]), more: /more/.test(m[0]) };
  if ((m = t.match(/\bfor\s+(\d+|one|two|three|four|five|six)\b(?!\s*(?:a|am|pm|:|st|nd|rd|th|oct|nov|dec|jan))/)))
    return { n: numOf(m[1]), more: false };
  if (/\b(just me|only me|myself|solo|alone|for me)\b/.test(t) && !/\band\b/.test(t)) return { n: 1, more: false };
  if (/\b(me and|myself and)\s+\w+/.test(t)) return { n: null, more: false, withOthers: true };
  if (/\bone more\b|\banother (?:passenger|person|traveller)\b|\badd (?:one|a) (?:more )?(?:passenger|person)\b/.test(t)) return { n: 1, more: true };
  return null;
}

export function parsePreference(text) {
  const t = String(text).toLowerCase();
  if (/\b(cheap(?:est|er)?|lowest (?:fare|price|cost)|budget|least expensive|economical)\b/.test(t)) return /\bcheaper\b/.test(t) ? 'CHEAPER' : 'CHEAPEST';
  if (/\b(fast(?:est)?|quick(?:est)?|shortest|least time|express(?:ly)?)\b/.test(t)) return 'FASTEST';
  if (/\b(best|recommend|top)\b/.test(t)) return 'BEST';
  if (/\b(earliest)\b/.test(t)) return 'EARLIEST';
  if (/\b(latest)\b/.test(t)) return 'LATEST';
  return null;
}

export function parseBerth(text) {
  const t = String(text).toLowerCase();
  if (/\bside lower\b|\bsl\b(?=.*berth)/.test(t)) return 'Side Lower (SL)';
  if (/\bside upper\b/.test(t)) return 'Side Upper (SU)';
  if (/\blower\b/.test(t)) return 'Lower (LB)';
  if (/\bmiddle\b/.test(t)) return 'Middle (MB)';
  if (/\bupper\b/.test(t)) return 'Upper (UB)';
  return null;
}
export function parseQuota(text) {
  const t = String(text).toLowerCase();
  if (/\btatkal\b|\btq\b/.test(t)) return 'TQ';
  if (/\bladies\b/.test(t)) return 'LD';
  if (/\bsenior\b/.test(t)) return 'SS';
  return null;
}
export function parseBudget(text) {
  const m = String(text).toLowerCase().match(/(?:under|below|within|less than|max(?:imum)?|upto|up to|budget of)\s*(?:rs\.?|inr|₹)?\s*(\d[\d,]*)/);
  return m ? Number(m[1].replace(/,/g, '')) : null;
}
export function parsePnr(text) {
  const m = String(text).match(/\b(\d{3})[- ]?(\d{7})\b/);
  return m ? `${m[1]}-${m[2]}` : null;
}

// ---- place phrase extraction ----
const STOP = '(?:\\s+(?:on|for|in|at|by|via|tomorrow|today|tonight|day|next|this|coming|after|before|around|leaving|departing|with|using|sleeper|ac|[123]\\s?a|cc|sl|cheapest|fastest|early|late|morning|afternoon|evening|night|\\d)|[,.?!]|$)';
const PLACE = "([a-z][a-z .'-]*?)";
function cleanPlace(p) {
  return p?.replace(/\b(the|a|an|train|ticket|tickets|please|pls)\b/g, ' ').replace(/\s+/g, ' ').trim() || null;
}
export function extractPlaces(text) {
  const t = ` ${String(text).toLowerCase().replace(/→|->|➝|–|—/g, ' to ')} `;
  let m;
  if ((m = t.match(new RegExp(`\\bfrom\\s+${PLACE}\\s+to\\s+${PLACE}${STOP}`))))
    return { source: cleanPlace(m[1]), destination: cleanPlace(m[2]) };
  if ((m = t.match(new RegExp(`\\bbetween\\s+${PLACE}\\s+and\\s+${PLACE}${STOP}`))))
    return { source: cleanPlace(m[1]), destination: cleanPlace(m[2]) };
  if ((m = t.match(new RegExp(`\\bto\\s+${PLACE}\\s+from\\s+${PLACE}${STOP}`))))
    return { source: cleanPlace(m[2]), destination: cleanPlace(m[1]) };
  if ((m = t.match(new RegExp(`\\b(?:book|find|get|need|want|search|show|train|trains|ticket|tickets|reserve)\\s+(?:me\\s+)?(?:a\\s+|the\\s+|some\\s+)?(?:cheap(?:est)?\\s+|fast(?:est)?\\s+|best\\s+)?(?:train\\s+|trains\\s+|ticket\\s+|tickets\\s+)*${PLACE}\\s+to\\s+${PLACE}${STOP}`))))
    return { source: cleanPlace(m[1]), destination: cleanPlace(m[2]) };
  if (!/^\s*(change|make|set|update|switch|move|actually)\b/.test(t) && (m = t.match(new RegExp(`^\\s*${PLACE}\\s+to\\s+${PLACE}${STOP}`))))
    return { source: cleanPlace(m[1]), destination: cleanPlace(m[2]) };
  return {};
}

/**
 * @param {string} text
 * @param {{pendingQuestion?: string|null, stage?: string, resultCount?: number}} ctx
 */
export function extractRules(text, ctx = {}) {
  const raw = String(text);
  const t = raw.toLowerCase().trim();
  const e = { intent: 'UNKNOWN', entities: {} };
  const ent = e.entities;

  const places = /^\s*(change|make|set|update|switch|actually)\b.*\b(destination|source|origin)\b/i.test(raw) ? {} : extractPlaces(raw);
  if (places.source) ent.source = places.source;
  if (places.destination) ent.destination = places.destination;
  const dt = parseDate(raw);
  if (dt) { ent.dateText = raw; ent.dateParsed = dt; }
  const tp = parseTimePreference(raw);
  if (tp) ent.time = tp;
  const cls = parseClass(raw);
  if (cls) ent.classCode = cls;
  const pc = parsePassengerCount(raw);
  if (pc) ent.passengers = pc;
  const pref = parsePreference(raw);
  if (pref) ent.preference = pref;
  const berth = parseBerth(raw); if (berth) ent.berth = berth;
  const quota = parseQuota(raw); if (quota) ent.quota = quota;
  const budget = parseBudget(raw); if (budget) ent.budget = budget;
  const pnr = parsePnr(raw); if (pnr) ent.pnr = pnr;
  if (/\b(me and|and me|with me|for me and)\b/.test(t) || /\bfor\s+[a-z]+\s+and\s+[a-z]+\b/.test(t)) { ent.withPeople = extractPeople(raw); ent.includeSelf = /\b(me|myself)\b/.test(t); }

  // ---- bare answers to a pending question ----
  const bare = t.replace(/[.!?]+$/, '');
  if (ctx.pendingQuestion === 'passengers' && /^(\d+|one|two|three|four|five|six)$/.test(bare)) { ent.passengers = { n: numOf(bare), more: false }; e.intent = 'BOOK_TICKET'; return e; }
  if (ctx.pendingQuestion === 'class' && ent.classCode && bare.length < 25) { e.intent = 'CHANGE_CLASS'; return e; }
  if (ctx.pendingQuestion === 'date' && ent.dateParsed && bare.length < 40) { e.intent = 'CHANGE_DATE'; return e; }
  if ((ctx.pendingQuestion === 'source' || ctx.pendingQuestion === 'destination') && !places.source && !places.destination && bare.length > 1 && bare.length < 40 && !/\d/.test(bare)) {
    ent[ctx.pendingQuestion] = bare.replace(/^(from|to)\s+/, ''); e.intent = ctx.pendingQuestion === 'source' ? 'CHANGE_SOURCE' : 'CHANGE_DESTINATION'; return e;
  }
  if (ctx.stage === 'SHOWING_TRAINS' && /^(?:option\s+|number\s+|no\.?\s*|#|the\s+)?(\d)(?:st|nd|rd|th)?(?:\s+one|\s+option)?$/.test(bare)) {
    ent.selection = { index: +bare.match(/\d/)[0] }; e.intent = 'SELECT_TRAIN'; return e;
  }
  if (ctx.stage === 'SHOWING_TRAINS' && /^(?:the\s+)?(first|second|third|fourth|fifth|1st|2nd|3rd)(?:\s+one|\s+option|\s+train)?$/.test(bare)) {
    const idx = { first: 1, '1st': 1, second: 2, '2nd': 2, third: 3, '3rd': 3, fourth: 4, fifth: 5 }[bare.match(/first|second|third|fourth|fifth|1st|2nd|3rd/)[0]];
    ent.selection = { index: idx }; e.intent = 'SELECT_TRAIN'; return e;
  }
  const tn = raw.match(/\b(\d{5})\b/);
  if (tn && /\b(select|book|choose|take|pick|go with|want|train)\b/.test(t) && !parsePnr(raw)) { ent.selection = { trainNumber: tn[1] }; e.intent = 'SELECT_TRAIN'; return e; }

  // ---- yes / no ----
  if (/^(yes|yep|yeah|y|ok|okay|sure|confirm|confirmed|proceed|go ahead|do it|looks good|correct|that's right|yes please|please proceed|shall proceed|book it|pay)\b[\s.!]*$/.test(bare) || /^(yes|yep|yeah|ok|okay|sure),?\s*(proceed|confirm|go ahead|book|please)/.test(bare)) { e.intent = 'CONFIRM_BOOKING'; return e; }
  if (/^(no|nope|nah|n|don'?t|not now|keep it|keep ticket|no thanks)\b[\s.!]*$/.test(bare)) { e.intent = 'DECLINE'; return e; }

  // ---- intents ----
  if (/\b(cancel|refund)\b.*\b(ticket|booking|pnr|reservation|trip)\b|\bcancel my\b|\bcancel (?:it|this ticket)\b(?=.*\b(ticket|booking)\b)/.test(t)) { e.intent = 'CANCEL_BOOKING'; return e; }
  if (/^(cancel|stop|abort|never ?mind|start over|reset|forget it|exit|quit|clear)\b/.test(bare) || /\b(start over|forget (?:it|that)|never ?mind|reset (?:the )?(?:booking|chat))\b/.test(t)) { e.intent = 'ABORT_FLOW'; return e; }
  if (/\b(my bookings?|my tickets?|booking history|past bookings|upcoming (?:trips|bookings|journeys))\b|\bshow (?:me )?(?:my )?(?:bookings|tickets)\b/.test(t)) { e.intent = 'VIEW_BOOKINGS'; return e; }
  if (ent.pnr || /\bpnr\b/.test(t)) { e.intent = 'CHECK_PNR'; return e; }
  if (/^(help|\?|what can you do|how does this work|commands)\b/.test(bare)) { e.intent = 'HELP'; return e; }
  if (/^(hi|hello|hey|namaste|good (morning|afternoon|evening))\b[\s!.]*$/.test(bare)) { e.intent = 'GREETING'; return e; }
  if (/\b(fare|price|cost|how much)\b/.test(t) && !places.source) { e.intent = 'CHECK_FARE'; return e; }

  if (/\b(any time|all times|remove (?:the )?time|no time (?:filter|preference))\b/.test(t)) { ent.clearTime = true; e.intent = 'MODIFY'; return e; }
  if (/\b(nearby dates?|next day|following day|search (?:the )?next day)\b/.test(t) && !ent.dateParsed) { ent.dateShift = 1; e.intent = 'MODIFY'; return e; }

  // Modification commands (work on existing state)
  if (/\b(remove|delete|drop)\b.*\b(passenger|person|traveller|last one)\b|\bone (?:less|fewer) passenger\b/.test(t)) { e.intent = 'REMOVE_PASSENGER'; return e; }
  if (/\b(add|include)\b.*\b(passenger|person|traveller)\b|\bone more\b|\banother passenger\b|\badd (\w+)\b$/.test(t) && pc?.more) { e.intent = 'ADD_PASSENGER'; return e; }
  if (/\b(leave|depart|go|start)\s+(?:one |an |1 )?(hour|hr)s? (later|earlier)\b|\b(later|earlier) (?:train|departure)\b/.test(t)) {
    ent.shift = /earlier/.test(t) ? -60 : 60; e.intent = 'MODIFY'; return e;
  }
  if (/\bshow (?:me )?(?:some )?(?:cheaper|other|more|different) (?:options|trains)?\b|\bcheaper options\b|\bany other\b/.test(t)) { ent.preference = ent.preference || 'CHEAPER'; e.intent = 'MODIFY'; return e; }
  if (/\b(change|make|switch|update|shift|move|set)\b/.test(t) || /^actually\b/.test(t)) {
    if (/\bdestination\b|\bto\s+[a-z]/.test(t) && /\bdestination\b/.test(t)) {
      const m = bare.match(/destination (?:to|as)\s+([a-z .]+?)\s*$/); if (m) ent.destination = m[1]; e.intent = 'CHANGE_DESTINATION'; return e;
    }
    if (/\b(source|origin|starting|departure station)\b/.test(t)) {
      const m = bare.match(/(?:source|origin|starting point|departure station) (?:to|as)\s+([a-z .]+?)\s*$/); if (m) ent.source = m[1]; e.intent = 'CHANGE_SOURCE'; return e;
    }
    if (ent.classCode && !ent.dateParsed && !pc) { e.intent = 'CHANGE_CLASS'; return e; }
    if (ent.dateParsed && !ent.classCode) { e.intent = 'CHANGE_DATE'; return e; }
    if (pc && !ent.classCode) { e.intent = 'MODIFY'; return e; }
    if (ent.classCode || ent.dateParsed || ent.time) { e.intent = 'MODIFY'; return e; }
  }
  if (/^actually\b/.test(t) && (ent.dateParsed || ent.classCode)) { e.intent = ent.dateParsed ? 'CHANGE_DATE' : 'CHANGE_CLASS'; return e; }

  const bookish = /\b(book|reserve|ticket|tickets|get me|i need|i want|i'd like|need a|want a)\b/.test(t);
  const searchish = /\b(find|search|show|look|any|check|available|options|list|which|trains?)\b/.test(t);
  if (bookish && !/\bsearch\b/.test(t)) { e.intent = 'BOOK_TICKET'; return e; }
  if (searchish || ent.source || ent.destination) { e.intent = 'SEARCH_TRAIN'; return e; }
  if (ctx.stage && !['IDLE', 'CONFIRMED'].includes(ctx.stage)) {
    // contextual follow-ups in an active flow
    if (ent.classCode) { e.intent = 'CHANGE_CLASS'; return e; }
    if (ent.dateParsed) { e.intent = 'CHANGE_DATE'; return e; }
    if (pc) { e.intent = 'MODIFY'; return e; }
    if (ent.time || ent.preference) { e.intent = 'MODIFY'; return e; }
  }
  return e;
}

function extractPeople(raw) {
  const t = raw.replace(/[.!?]+$/, '');
  const m = t.match(/\b(?:for|with)\s+(.+?)(?:\s+(?:on|in|tomorrow|today|tonight|next|this|from|to|at|after|before)\b|$)/i);
  if (!m) return [];
  return m[1].split(/\s*(?:,|\band\b|&)\s*/i).map((s) => s.trim()).filter((s) => s && !/^(me|myself|us|i)$/i.test(s) && /^[A-Za-z][A-Za-z .'-]{0,40}$/.test(s));
}
export { extractPeople };
