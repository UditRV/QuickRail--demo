import { query } from '../db/pool.js';

// Colloquial / legacy names → search term the DB understands.
const ALIASES = {
  bombay: 'mumbai', 'bombay central': 'MMCT', bct: 'MMCT', cst: 'CSMT', cstm: 'CSMT', vt: 'CSMT',
  'victoria terminus': 'CSMT', 'mumbai cst': 'CSMT', 'mumbai csmt': 'CSMT', 'mumbai central': 'MMCT',
  'new delhi': 'NDLS', 'old delhi': 'DLI', nizamuddin: 'NZM', 'h nizamuddin': 'NZM', 'hazrat nizamuddin': 'NZM',
  bangalore: 'bengaluru', blr: 'SBC', bengaluru: 'bengaluru', madras: 'chennai', calcutta: 'kolkata',
  banaras: 'varanasi', benares: 'varanasi', kashi: 'varanasi', baroda: 'vadodara', amdavad: 'ahmedabad',
  poona: 'pune', panaji: 'goa', panjim: 'goa', margao: 'goa', madgaon: 'goa', 'goa': 'goa',
  bandra: 'BDTS', 'bandra terminus': 'BDTS',
};

let cache = { at: 0, rows: [] };
async function allStations() {
  if (Date.now() - cache.at > 60_000) {
    const r = await query('SELECT code, name, city, state FROM stations ORDER BY name');
    cache = { at: Date.now(), rows: r.rows };
  }
  return cache.rows;
}
export function clearStationCache() { cache = { at: 0, rows: [] }; }

const NOISE = /\b(railway|rly|station|stn|junction|jn|terminus|city)\b/g;
const norm = (s) => String(s).toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim();
const stripNoise = (s) => norm(s).replace(NOISE, ' ').replace(/\s+/g, ' ').trim();

/**
 * Resolve free text to stations.
 * → { status: 'ok'|'ambiguous'|'none', candidates: [{code,name,city}] , text }
 * 'ambiguous' means a city with several stations (e.g. Mumbai → MMCT, CSMT, BDTS).
 */
export async function resolveStation(text) {
  const raw = String(text || '').trim();
  if (!raw) return { status: 'none', candidates: [], text: raw };
  const stations = await allStations();
  const pick = (rows) => rows.map(({ code, name, city }) => ({ code, name, city }));
  const n = norm(raw);

  // exact code (e.g. "NDLS", "mmct")
  const byCode = stations.find((s) => s.code.toLowerCase() === n.replace(/ /g, ''));
  if (byCode && n.length >= 2) return { status: 'ok', candidates: pick([byCode]), text: raw };

  let term = ALIASES[n] ?? n;
  if (/^[A-Z]{2,5}$/.test(term)) {
    const s = stations.find((x) => x.code === term);
    if (s) return { status: 'ok', candidates: pick([s]), text: raw };
  }
  term = stripNoise(term);
  if (!term) return { status: 'none', candidates: [], text: raw };

  const exactName = stations.filter((s) => stripNoise(s.name) === term);
  if (exactName.length === 1) return { status: 'ok', candidates: pick(exactName), text: raw };

  const byCity = stations.filter((s) => norm(s.city) === term);
  if (byCity.length === 1) return { status: 'ok', candidates: pick(byCity), text: raw };
  if (byCity.length > 1) return { status: 'ambiguous', candidates: pick(byCity), text: raw };

  const contains = stations.filter((s) => {
    const nm = stripNoise(s.name);
    return nm.includes(term) || term.includes(nm) || norm(s.city).includes(term);
  });
  if (contains.length === 1) return { status: 'ok', candidates: pick(contains), text: raw };
  if (contains.length > 1) return { status: 'ambiguous', candidates: pick(contains), text: raw };
  return { status: 'none', candidates: [], text: raw };
}

export async function getStation(code) {
  const stations = await allStations();
  const s = stations.find((x) => x.code === code);
  return s ? { code: s.code, name: s.name, city: s.city } : null;
}

/** searchStations() tool — autocomplete style, parameterised SQL only. */
export async function searchStations(q, limit = 10) {
  const r = await query(
    `SELECT code, name, city FROM stations WHERE code ILIKE $1 OR name ILIKE $1 OR city ILIKE $1 ORDER BY name LIMIT $2`,
    [`%${String(q).slice(0, 60).replace(/[%_]/g, '')}%`, limit]
  );
  return r.rows;
}
