import { toMinutes } from './dateTime.js';

export function durationMinutes(str) {
  const m = String(str || '').match(/(?:(\d+)\s*h)?\s*(?:(\d+)\s*m)?/i);
  return (m?.[1] ? +m[1] * 60 : 0) + (m?.[2] ? +m[2] : 0);
}

/** 'AVAILABLE' (enough confirmed seats) | 'PARTIAL' | 'RAC' | 'WL' for `n` passengers. */
export function availabilityFor(cls, n = 1) {
  if (cls.availableCount >= n) return 'AVAILABLE';
  if (cls.availableCount > 0) return 'PARTIAL';
  if (cls.racCount > 0) return 'RAC';
  return 'WL';
}
const TIER = { AVAILABLE: 0, PARTIAL: 0, RAC: 1, WL: 2 };

/** Normalise a raw backend train into the card/view shape the agent works with. */
export function toTrainView(train, { passengers = 1, classCode = null, stationNames = {} } = {}) {
  let classes = train.classes.map((c) => ({
    classCode: c.classCode,
    name: c.name,
    fare: c.price,
    availableCount: c.availableCount,
    availability: availabilityFor(c, passengers),
    statusLabel: c.status,
  }));
  if (classCode) classes = classes.filter((c) => c.classCode === classCode);
  if (!classes.length) return null;
  const dur = durationMinutes(train.duration);
  const dep = toMinutes(train.departureTime);
  return {
    trainNumber: train.number,
    trainName: train.name,
    badge: train.badge,
    fromCode: train.fromStationCode,
    toCode: train.toStationCode,
    fromName: stationNames[train.fromStationCode] || train.fromStationCode,
    toName: stationNames[train.toStationCode] || train.toStationCode,
    departure: train.departureTime,
    arrival: train.arrivalTime,
    duration: train.duration,
    durationMin: dur,
    arrivalDayOffset: Math.floor((dep + dur) / 1440),
    classes,
  };
}

const bestClass = (v) => [...v.classes].sort((a, b) => TIER[a.availability] - TIER[b.availability] || a.fare - b.fare)[0];
export const minFare = (v) => Math.min(...v.classes.map((c) => c.fare));
const tierOf = (v) => Math.min(...v.classes.map((c) => TIER[c.availability]));

function norm(values) {
  const lo = Math.min(...values), hi = Math.max(...values);
  return values.map((x) => (hi === lo ? 0 : (x - lo) / (hi - lo)));
}

/**
 * Rank trains for the user's request. Bookable (confirmed/partial) options always come before RAC, then WL.
 * pref: CHEAPEST | FASTEST | EARLIEST | LATEST | BEST | null(=BEST)
 */
export function rankTrains(views, { preference = null, timePref = null } = {}) {
  if (!views.length) return [];
  const pref = preference === 'CHEAPER' ? 'CHEAPEST' : preference || 'BEST';
  const fares = views.map(minFare), durs = views.map((v) => v.durationMin);
  const nf = norm(fares), nd = norm(durs);
  const target = timePref?.around ? toMinutes(timePref.around)
    : timePref?.after ? toMinutes(timePref.after)
    : timePref?.window ? toMinutes(timePref.window.from) + 120 : null;
  const scored = views.map((v, i) => {
    const dep = toMinutes(v.departure);
    const timeDist = target == null ? 0 : Math.min(Math.abs(dep - target), 1440 - Math.abs(dep - target)) / 720;
    let metric;
    switch (pref) {
      case 'CHEAPEST': metric = fares[i] + durs[i] / 1000; break;
      case 'FASTEST': metric = durs[i] + fares[i] / 100000; break;
      case 'EARLIEST': metric = dep; break;
      case 'LATEST': metric = -dep; break;
      default: metric = 0.4 * nf[i] + 0.4 * nd[i] + 0.2 * timeDist; // BEST
    }
    return { v, tier: tierOf(v), metric };
  });
  scored.sort((a, b) => a.tier - b.tier || a.metric - b.metric);
  return scored.map((s) => s.v);
}
export function bestClassOf(view) { return bestClass(view); }
