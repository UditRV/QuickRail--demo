// Optional demo data so the QuickRail AI example prompts work out of the box.
// The base seed only has Delhi→Mumbai-style one-way routes; this adds reverse and a few
// popular western-India routes. Safe to re-run (idempotent). DEMO DATA — not real IRCTC inventory.
import { pool } from './pool.js';

const stations = [
  ['PUNE', 'Pune Junction', 'Pune', 'Maharashtra'],
  ['ADI', 'Ahmedabad Junction', 'Ahmedabad', 'Gujarat'],
  ['JP', 'Jaipur Junction', 'Jaipur', 'Rajasthan'],
  ['MAO', 'Madgaon Junction', 'Goa', 'Goa'],
];

const mk = (number, name, from, to, dep, arr, duration, classes, extra = {}) => ({
  number, name, from, to, departureTime: dep, arrivalTime: arr, duration, classes,
  badge: extra.badge || 'Superfast', typeText: extra.typeText || 'LHB Rake',
  stopsCount: extra.stopsCount ?? 4, intermediateStops: extra.intermediateStops || [],
  features: extra.features || ['Pantry Included'], operatingDays: 'Daily',
});

const trains = [
  mk('12951', 'MUMBAI RAJDHANI', 'MMCT', 'NDLS', '17:00', '08:35', '15h 35m', [
    { code: '3A', name: 'AC 3 Tier', price: 2450, seats: 64, rac: 8 },
    { code: '2A', name: 'AC 2 Tier', price: 3520, seats: 46, rac: 4 },
    { code: '1A', name: 'AC First Class', price: 5990, seats: 18, rac: 0 },
  ], { badge: 'Rajdhani' }),
  mk('12953', 'AUGUST KRANTI RAJDHANI', 'MMCT', 'NDLS', '17:10', '10:55', '17h 45m', [
    { code: '3A', name: 'AC 3 Tier', price: 2390, seats: 0, rac: 0 },
    { code: '2A', name: 'AC 2 Tier', price: 3440, seats: 46, rac: 4 },
  ], { badge: 'Rajdhani' }),
  mk('12954', 'MMCT NDLS EXPRESS', 'MMCT', 'NDLS', '18:35', '12:30', '17h 55m', [
    { code: 'SL', name: 'Sleeper Class', price: 780, seats: 90, rac: 15 },
    { code: '3A', name: 'AC 3 Tier', price: 2180, seats: 64, rac: 8 },
    { code: '2A', name: 'AC 2 Tier', price: 3100, seats: 46, rac: 4 },
  ]),
  mk('22221', 'CSMT NIZAMUDDIN RAJDHANI', 'CSMT', 'NZM', '16:10', '08:30', '16h 20m', [
    { code: '3A', name: 'AC 3 Tier', price: 2310, seats: 64, rac: 8 },
    { code: '2A', name: 'AC 2 Tier', price: 3330, seats: 46, rac: 4 },
  ], { badge: 'Rajdhani' }),
  mk('12009', 'SHATABDI EXPRESS', 'MMCT', 'ADI', '06:25', '13:10', '6h 45m', [
    { code: 'CC', name: 'AC Chair Car', price: 1180, seats: 78, rac: 6 },
    { code: 'EC', name: 'Executive Chair Car', price: 2260, seats: 52, rac: 4 },
  ], { badge: 'Shatabdi' }),
  mk('12933', 'KARNAVATI EXPRESS', 'MMCT', 'ADI', '20:05', '04:55', '8h 50m', [
    { code: 'SL', name: 'Sleeper Class', price: 395, seats: 90, rac: 15 },
    { code: '3A', name: 'AC 3 Tier', price: 1020, seats: 64, rac: 8 },
    { code: '2A', name: 'AC 2 Tier', price: 1490, seats: 46, rac: 4 },
  ]),
  mk('12935', 'SURAT INTERCITY', 'MMCT', 'ST', '07:40', '12:55', '5h 15m', [
    { code: 'CC', name: 'AC Chair Car', price: 640, seats: 78, rac: 6 },
    { code: 'SL', name: 'Sleeper Class', price: 215, seats: 90, rac: 15 },
  ]),
  mk('12937', 'FLYING RANEE', 'MMCT', 'ST', '20:20', '00:45', '4h 25m', [
    { code: 'SL', name: 'Sleeper Class', price: 195, seats: 90, rac: 15 },
    { code: '3A', name: 'AC 3 Tier', price: 610, seats: 64, rac: 8 },
  ]),
  mk('12127', 'INTERCITY EXPRESS', 'CSMT', 'PUNE', '06:40', '10:10', '3h 30m', [
    { code: 'CC', name: 'AC Chair Car', price: 520, seats: 78, rac: 6 },
    { code: 'SL', name: 'Sleeper Class', price: 165, seats: 90, rac: 15 },
  ]),
  mk('11029', 'KOYNA EXPRESS', 'CSMT', 'PUNE', '14:55', '19:35', '4h 40m', [
    { code: 'SL', name: 'Sleeper Class', price: 150, seats: 90, rac: 15 },
    { code: '3A', name: 'AC 3 Tier', price: 505, seats: 64, rac: 8 },
  ], { badge: 'Express' }),
  mk('12123', 'DECCAN QUEEN', 'CSMT', 'PUNE', '17:10', '20:25', '3h 15m', [
    { code: 'CC', name: 'AC Chair Car', price: 480, seats: 78, rac: 6 },
  ]),
  mk('12483', 'JAIPUR SUPERFAST', 'NDLS', 'JP', '06:10', '10:35', '4h 25m', [
    { code: 'CC', name: 'AC Chair Car', price: 710, seats: 78, rac: 6 },
    { code: 'SL', name: 'Sleeper Class', price: 260, seats: 90, rac: 15 },
  ]),
  mk('10103', 'MANDOVI EXPRESS', 'CSMT', 'MAO', '07:10', '19:35', '12h 25m', [
    { code: 'SL', name: 'Sleeper Class', price: 480, seats: 90, rac: 15 },
    { code: '3A', name: 'AC 3 Tier', price: 1280, seats: 64, rac: 8 },
  ], { badge: 'Express' }),
];

async function run() {
  for (const s of stations) {
    await pool.query(
      `INSERT INTO stations (code, name, city, state) VALUES ($1,$2,$3,$4) ON CONFLICT (code) DO NOTHING`, s);
  }
  for (const t of trains) {
    const r = await pool.query(
      `INSERT INTO trains (number, name, badge, type_text, from_station_code, to_station_code, departure_time,
         departure_platform, arrival_time, arrival_platform, duration, route_highlight, stops_count,
         intermediate_stops, features, operating_days)
       VALUES ($1,$2,$3,$4,$5,$6,$7,'Platform 1',$8,'Platform 1',$9,'Direct',$10,$11,$12,$13)
       ON CONFLICT (number) DO NOTHING RETURNING id`,
      [t.number, t.name, t.badge, t.typeText, t.from, t.to, t.departureTime, t.arrivalTime, t.duration,
       t.stopsCount, t.intermediateStops, t.features, t.operatingDays]);
    if (r.rowCount === 0) continue;
    for (const c of t.classes) {
      await pool.query(
        `INSERT INTO train_classes (train_id, class_code, name, base_price, total_seats, rac_seats)
         VALUES ($1,$2,$3,$4,$5,$6) ON CONFLICT (train_id, class_code) DO NOTHING`,
        [r.rows[0].id, c.code, c.name, c.price, c.seats, c.rac]);
    }
  }
  console.log('✅ AI demo trains/stations loaded.');
  await pool.end();
}
run().catch((e) => { console.error(e); process.exit(1); });
