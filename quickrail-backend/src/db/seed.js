import { pool } from './pool.js';

const stations = [
  ['NDLS', 'New Delhi', 'New Delhi', 'Delhi'],
  ['NZM', 'Hazrat Nizamuddin', 'New Delhi', 'Delhi'],
  ['MMCT', 'Mumbai Central', 'Mumbai', 'Maharashtra'],
  ['CSMT', 'Chhatrapati Shivaji Maharaj Terminus', 'Mumbai', 'Maharashtra'],
  ['BDTS', 'Bandra Terminus', 'Mumbai', 'Maharashtra'],
  ['KOTA', 'Kota Junction', 'Kota', 'Rajasthan'],
  ['BRC', 'Vadodara Junction', 'Vadodara', 'Gujarat'],
  ['ST', 'Surat', 'Surat', 'Gujarat'],
  ['SBC', 'KSR Bengaluru', 'Bengaluru', 'Karnataka'],
  ['MAS', 'Chennai Central', 'Chennai', 'Tamil Nadu'],
  ['HWH', 'Howrah Junction', 'Kolkata', 'West Bengal'],
  ['PURI', 'Puri', 'Puri', 'Odisha'],
  ['BSB', 'Varanasi Junction', 'Varanasi', 'Uttar Pradesh'],
];

const trains = [
  {
    number: '12952', name: 'TEJAS RAJDHANI', badge: 'Superfast Special', typeText: 'Tejas Smart Rake',
    from: 'NDLS', to: 'MMCT', departureTime: '16:55', departurePlatform: 'Platform 3',
    arrivalTime: '08:35', arrivalPlatform: 'Platform 1', duration: '15h 40m',
    routeHighlight: 'Fastest Route • Non-Stop Hub Transit', stopsCount: 5,
    intermediateStops: ['Kota (21:30)', 'Vadodara (03:50)', 'Surat (05:15)'],
    features: ['Pantry Included', 'On-Time 98%'], operatingDays: 'Daily',
    classes: [
      { code: '3A', name: 'AC 3 Tier', price: 2380, seats: 64, rac: 8 },
      { code: '2A', name: 'AC 2 Tier', price: 3410, seats: 46, rac: 4 },
      { code: '1A', name: 'AC First Class', price: 5845, seats: 18, rac: 0 },
      { code: '3E', name: '3 Economy', price: 1890, seats: 72, rac: 10 },
    ],
  },
  {
    number: '22222', name: 'CSMT RAJDHANI', badge: 'Rajdhani', typeText: 'LHB Rake',
    from: 'NZM', to: 'CSMT', departureTime: '16:55', departurePlatform: 'Platform 1',
    arrivalTime: '08:55', arrivalPlatform: 'Platform 5', duration: '16h 00m',
    routeHighlight: 'Premium Rajdhian Service', stopsCount: 6,
    intermediateStops: ['Kota (21:40)', 'Vadodara (04:05)', 'Surat (05:30)'],
    features: ['Pantry Included', 'On-Time 95%'], operatingDays: 'Daily',
    classes: [
      { code: '3A', name: 'AC 3 Tier', price: 2290, seats: 64, rac: 8 },
      { code: '2A', name: 'AC 2 Tier', price: 3290, seats: 46, rac: 4 },
      { code: '1A', name: 'AC First Class', price: 5620, seats: 18, rac: 0 },
      { code: 'SL', name: 'Sleeper', price: 890, seats: 80, rac: 12 },
    ],
  },
  {
    number: '12926', name: 'PASCHIM EXPRESS', badge: 'Superfast', typeText: 'ICF Rake',
    from: 'NDLS', to: 'BDTS', departureTime: '16:35', departurePlatform: 'Platform 6',
    arrivalTime: '14:45', arrivalPlatform: 'Platform 2', duration: '22h 10m',
    routeHighlight: 'Classic Long-Distance Route', stopsCount: 14,
    intermediateStops: ['Kota (21:15)', 'Vadodara (07:20)', 'Surat (09:05)'],
    features: ['Pantry Included', 'On-Time 89%'], operatingDays: 'Daily',
    classes: [
      { code: 'SL', name: 'Sleeper Class', price: 620, seats: 90, rac: 15 },
      { code: '3A', name: 'AC 3 Tier', price: 1650, seats: 64, rac: 8 },
      { code: '2A', name: 'AC 2 Tier', price: 2390, seats: 46, rac: 4 },
      { code: '1A', name: 'AC First Class', price: 4120, seats: 18, rac: 0 },
    ],
  },
  {
    number: '20904', name: 'VANDE BHARAT 2.0', badge: 'Vande Bharat 2.0', typeText: 'Semi-High Speed Rake',
    from: 'NDLS', to: 'MMCT', departureTime: '15:05', departurePlatform: 'Platform 4',
    arrivalTime: '03:20', arrivalPlatform: 'Platform 1', duration: '12h 15m',
    routeHighlight: 'Fastest Route • Chair Car & Executive', stopsCount: 3,
    intermediateStops: ['Kota (19:50)', 'Vadodara (00:40)'],
    features: ['Onboard Catering', 'On-Time 99%'], operatingDays: 'Daily',
    classes: [
      { code: 'CC', name: 'AC Chair Car', price: 1985, seats: 78, rac: 6 },
      { code: 'EC', name: 'Executive Chair Car', price: 3650, seats: 52, rac: 4 },
    ],
  },
  {
    number: '12008', name: 'SHATABDI EXP', badge: 'Shatabdi Exp', typeText: 'LHB Rake',
    from: 'SBC', to: 'MAS', departureTime: '06:00', departurePlatform: 'Platform 2',
    arrivalTime: '10:35', arrivalPlatform: 'Platform 3', duration: '4h 35m',
    routeHighlight: 'Except Tue', stopsCount: 4,
    intermediateStops: ['Katpadi (08:10)', 'Arakkonam (09:20)'],
    features: ['Breakfast Included', 'On-Time 97%'], operatingDays: 'Except Tue',
    classes: [
      { code: 'CC', name: 'AC Chair Car', price: 790, seats: 78, rac: 6 },
      { code: 'EC', name: 'Executive Chair Car', price: 1450, seats: 52, rac: 4 },
    ],
  },
  {
    number: '12821', name: 'DHAULI EXPRESS', badge: 'Dhauli Express', typeText: 'ICF Rake',
    from: 'HWH', to: 'PURI', departureTime: '09:15', departurePlatform: 'Platform 9',
    arrivalTime: '17:35', arrivalPlatform: 'Platform 1', duration: '8h 20m',
    routeHighlight: 'Daily', stopsCount: 7,
    intermediateStops: ['Kharagpur (10:20)', 'Bhubaneswar (16:10)'],
    features: ['Pantry Included', 'On-Time 92%'], operatingDays: 'Daily',
    classes: [
      { code: 'SL', name: 'Sleeper Class', price: 245, seats: 90, rac: 15 },
      { code: '3A', name: 'AC 3 Tier', price: 890, seats: 64, rac: 8 },
      { code: 'CC', name: 'AC Chair Car', price: 560, seats: 78, rac: 6 },
    ],
  },
  {
    number: '22435', name: 'VANDE BHARAT EXP', badge: 'Vande Bharat Exp', typeText: 'Semi-High Speed Rake',
    from: 'BSB', to: 'NDLS', departureTime: '15:00', departurePlatform: 'Platform 1',
    arrivalTime: '23:00', arrivalPlatform: 'Platform 3', duration: '8h 00m',
    routeHighlight: 'Except Mon/Thu', stopsCount: 4,
    intermediateStops: ['Prayagraj (17:10)', 'Kanpur (19:00)'],
    features: ['Onboard Catering', 'On-Time 98%'], operatingDays: 'Except Mon/Thu',
    classes: [
      { code: 'CC', name: 'AC Chair Car', price: 1750, seats: 78, rac: 6 },
      { code: 'EC', name: 'Executive Chair Car', price: 3210, seats: 52, rac: 4 },
    ],
  },
];

async function seed() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    for (const [code, name, city, state] of stations) {
      await client.query(
        `INSERT INTO stations (code, name, city, state) VALUES ($1,$2,$3,$4)
         ON CONFLICT (code) DO UPDATE SET name = EXCLUDED.name, city = EXCLUDED.city, state = EXCLUDED.state`,
        [code, name, city, state]
      );
    }

    for (const t of trains) {
      const trainRes = await client.query(
        `INSERT INTO trains (number, name, badge, type_text, from_station_code, to_station_code,
           departure_time, departure_platform, arrival_time, arrival_platform, duration,
           route_highlight, stops_count, intermediate_stops, features, operating_days)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
         ON CONFLICT (number) DO UPDATE SET name = EXCLUDED.name
         RETURNING id`,
        [t.number, t.name, t.badge, t.typeText, t.from, t.to, t.departureTime, t.departurePlatform,
         t.arrivalTime, t.arrivalPlatform, t.duration, t.routeHighlight, t.stopsCount,
         t.intermediateStops, t.features, t.operatingDays]
      );
      const trainId = trainRes.rows[0].id;

      for (const c of t.classes) {
        await client.query(
          `INSERT INTO train_classes (train_id, class_code, name, base_price, total_seats, rac_seats)
           VALUES ($1,$2,$3,$4,$5,$6)
           ON CONFLICT (train_id, class_code) DO UPDATE SET base_price = EXCLUDED.base_price`,
          [trainId, c.code, c.name, c.price, c.seats, c.rac]
        );
      }
    }

    await client.query('COMMIT');
    console.log(`✅ Seeded ${stations.length} stations and ${trains.length} trains.`);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

seed().catch((err) => {
  console.error('❌ Seed failed:', err);
  process.exit(1);
});
