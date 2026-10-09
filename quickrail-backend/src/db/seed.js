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
  ['SRVD', 'Srivardhan', 'Srivardhan', 'Maharashtra'],
  ['UCHL', 'Uchila', 'Uchila', 'Karnataka'],
  ['INDB', 'Indore Junction', 'Indore', 'Madhya Pradesh'],
  ['PUNE', 'Pune Junction', 'Pune', 'Maharashtra'],
  ['NGP', 'Nagpur Junction', 'Nagpur', 'Maharashtra'],
  ['HYB', 'Hyderabad Deccan', 'Hyderabad', 'Telangana'],
  ['SC', 'Secunderabad Junction', 'Hyderabad', 'Telangana'],
  ['VSKP', 'Visakhapatnam Junction', 'Visakhapatnam', 'Andhra Pradesh'],
  ['JP', 'Jaipur Junction', 'Jaipur', 'Rajasthan'],
  ['ADI', 'Ahmedabad Junction', 'Ahmedabad', 'Gujarat'],
  ['UJN', 'Ujjain Junction', 'Ujjain', 'Madhya Pradesh'],
  ['BPL', 'Bhopal Junction', 'Bhopal', 'Madhya Pradesh'],
  ['JBP', 'Jabalpur Junction', 'Jabalpur', 'Madhya Pradesh'],
  ['LKO', 'Lucknow Junction', 'Lucknow', 'Uttar Pradesh'],
  ['CNB', 'Kanpur Central', 'Kanpur', 'Uttar Pradesh'],
  ['PRYJ', 'Prayagraj Junction', 'Prayagraj', 'Uttar Pradesh'],
  ['GKP', 'Gorakhpur Junction', 'Gorakhpur', 'Uttar Pradesh'],
  ['PNBE', 'Patna Junction', 'Patna', 'Bihar'],
  ['RNC', 'Ranchi Junction', 'Ranchi', 'Jharkhand'],
  ['BBS', 'Bhubaneswar', 'Bhubaneswar', 'Odisha'],
  ['ERS', 'Ernakulam Junction', 'Kochi', 'Kerala'],
  ['TVC', 'Thiruvananthapuram Central', 'Thiruvananthapuram', 'Kerala'],
  ['MAO', 'Madgaon Junction', 'Goa', 'Goa'],
  ['MYS', 'Mysuru Junction', 'Mysuru', 'Karnataka'],
  ['HUBB', 'Hubballi Junction', 'Hubballi', 'Karnataka'],
  ['MDU', 'Madurai Junction', 'Madurai', 'Tamil Nadu'],
  ['CBE', 'Coimbatore Junction', 'Coimbatore', 'Tamil Nadu'],
  ['TPTY', 'Tirupati', 'Tirupati', 'Andhra Pradesh'],
  ['VJA', 'Vijayawada Junction', 'Vijayawada', 'Andhra Pradesh'],
  ['NED', 'Hazur Sahib Nanded', 'Nanded', 'Maharashtra'],
  ['AII', 'Ajmer Junction', 'Ajmer', 'Rajasthan'],
  ['JU', 'Jodhpur Junction', 'Jodhpur', 'Rajasthan'],
  ['BKN', 'Bikaner Junction', 'Bikaner', 'Rajasthan'],
  ['ASR', 'Amritsar Junction', 'Amritsar', 'Punjab'],
  ['LDH', 'Ludhiana Junction', 'Ludhiana', 'Punjab'],
  ['GHY', 'Guwahati', 'Guwahati', 'Assam'],
  ['NJP', 'New Jalpaiguri Junction', 'Siliguri', 'West Bengal'],
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
  {
    number: '19081',
    name: 'SRIVARDHAN UCHILA EXPRESS',
    badge: 'Coastal Express',
    typeText: 'LHB Rake',
    from: 'SRVD',
    to: 'UCHL',
    departureTime: '06:30',
    departurePlatform: 'Platform 1',
    arrivalTime: '18:15',
    arrivalPlatform: 'Platform 2',
    duration: '11h 45m',
    routeHighlight: 'Konkan Coastal Route',
    stopsCount: 8,
    intermediateStops: ['Ratnagiri (09:10)', 'Madgaon (13:25)', 'Mangaluru (17:10)'],
    features: ['Pantry Included', 'On-Time 91%'],
    operatingDays: 'Daily',
    classes: [
      { code: 'SL', name: 'Sleeper Class', price: 480, seats: 90, rac: 15 },
      { code: '3A', name: 'AC 3 Tier', price: 1190, seats: 64, rac: 8 },
      { code: '2A', name: 'AC 2 Tier', price: 1690, seats: 46, rac: 4 },
    ],
  },
  {
    number: '19325',
    name: 'KOTA INDORE EXPRESS',
    badge: 'Intercity Express',
    typeText: 'LHB Rake',
    from: 'KOTA',
    to: 'INDB',
    departureTime: '07:20',
    departurePlatform: 'Platform 4',
    arrivalTime: '14:10',
    arrivalPlatform: 'Platform 1',
    duration: '6h 50m',
    routeHighlight: 'Fast Rajasthan–Madhya Pradesh Route',
    stopsCount: 6,
    intermediateStops: ['Ramganj Mandi (08:05)', 'Nagda Junction (11:20)', 'Dewas (13:20)'],
    features: ['Onboard Catering', 'On-Time 94%'],
    operatingDays: 'Daily',
    classes: [
      { code: 'SL', name: 'Sleeper Class', price: 295, seats: 90, rac: 15 },
      { code: '3A', name: 'AC 3 Tier', price: 890, seats: 64, rac: 8 },
      { code: 'CC', name: 'AC Chair Car', price: 680, seats: 78, rac: 6 },
    ],
  },
  {
    number: '19326',
    name: 'INDORE KOTA EXPRESS',
    badge: 'Intercity Express',
    typeText: 'LHB Rake',
    from: 'INDB',
    to: 'KOTA',
    departureTime: '15:30',
    departurePlatform: 'Platform 2',
    arrivalTime: '22:25',
    arrivalPlatform: 'Platform 3',
    duration: '6h 55m',
    routeHighlight: 'Evening Intercity Route',
    stopsCount: 6,
    intermediateStops: ['Dewas (16:10)', 'Nagda Junction (18:35)', 'Ramganj Mandi (21:35)'],
    features: ['Onboard Catering', 'On-Time 93%'],
    operatingDays: 'Daily',
    classes: [
      { code: 'SL', name: 'Sleeper Class', price: 295, seats: 90, rac: 15 },
      { code: '3A', name: 'AC 3 Tier', price: 890, seats: 64, rac: 8 },
      { code: 'CC', name: 'AC Chair Car', price: 680, seats: 78, rac: 6 },
    ],
  },
];
const allTrainClasses = () => [
  { code: 'SL', name: 'Sleeper Class', price: 450, seats: 90, rac: 15 },
  { code: '3A', name: 'AC 3 Tier', price: 1250, seats: 64, rac: 8 },
  { code: '2A', name: 'AC 2 Tier', price: 1850, seats: 46, rac: 4 },
  { code: '1A', name: 'AC First Class', price: 3200, seats: 18, rac: 0 },
  { code: 'CC', name: 'AC Chair Car', price: 850, seats: 78, rac: 6 },
];

for (const train of trains) {
  train.classes = allTrainClasses();
}
const extraTrainClasses = () => [
  { code: 'SL', name: 'Sleeper Class', price: 450, seats: 90, rac: 15 },
  { code: '3A', name: 'AC 3 Tier', price: 1250, seats: 64, rac: 8 },
  { code: '2A', name: 'AC 2 Tier', price: 1850, seats: 46, rac: 4 },
  { code: '1A', name: 'AC First Class', price: 3200, seats: 18, rac: 0 },
  { code: 'CC', name: 'AC Chair Car', price: 850, seats: 78, rac: 6 },
];
const extraTrainRoutes = [

  ['60001', 'PUNE NAGPUR EXPRESS', 'PUNE', 'NGP'],
  ['60002', 'NAGPUR PUNE EXPRESS', 'NGP', 'PUNE'],
  ['60003', 'SECUNDERABAD VISAKHAPATNAM EXPRESS', 'SC', 'VSKP'],
  ['60004', 'VISAKHAPATNAM SECUNDERABAD EXPRESS', 'VSKP', 'SC'],
  ['60005', 'JAIPUR AHMEDABAD EXPRESS', 'JP', 'ADI'],
  ['60006', 'AHMEDABAD JAIPUR EXPRESS', 'ADI', 'JP'],
  ['60007', 'BHOPAL JABALPUR INTERCITY', 'BPL', 'JBP'],
  ['60008', 'JABALPUR BHOPAL INTERCITY', 'JBP', 'BPL'],
  ['60009', 'LUCKNOW KANPUR INTERCITY', 'LKO', 'CNB'],
  ['60010', 'KANPUR LUCKNOW INTERCITY', 'CNB', 'LKO'],
  ['60011', 'PRAYAGRAJ GORAKHPUR EXPRESS', 'PRYJ', 'GKP'],
  ['60012', 'GORAKHPUR PRAYAGRAJ EXPRESS', 'GKP', 'PRYJ'],
  ['60013', 'PATNA RANCHI EXPRESS', 'PNBE', 'RNC'],
  ['60014', 'RANCHI PATNA EXPRESS', 'RNC', 'PNBE'],
  ['60015', 'BHUBANESWAR HOWRAH EXPRESS', 'BBS', 'HWH'],
  ['60016', 'HOWRAH BHUBANESWAR EXPRESS', 'HWH', 'BBS'],
  ['60017', 'ERNAKULAM TRIVANDRUM EXPRESS', 'ERS', 'TVC'],
  ['60018', 'TRIVANDRUM ERNAKULAM EXPRESS', 'TVC', 'ERS'],
  ['60019', 'MADGAON HUBBALLI EXPRESS', 'MAO', 'HUBB'],
  ['60020', 'HUBBALLI MADGAON EXPRESS', 'HUBB', 'MAO'],
  ['60021', 'MYSURU BENGALURU EXPRESS', 'MYS', 'SBC'],
  ['60022', 'BENGALURU MYSURU EXPRESS', 'SBC', 'MYS'],
  ['60023', 'MADURAI CHENNAI EXPRESS', 'MDU', 'MAS'],
  ['60024', 'CHENNAI MADURAI EXPRESS', 'MAS', 'MDU'],
  ['60025', 'COIMBATORE BENGALURU EXPRESS', 'CBE', 'SBC'],
  ['60026', 'BENGALURU COIMBATORE EXPRESS', 'SBC', 'CBE'],
  ['60027', 'TIRUPATI VIJAYAWADA EXPRESS', 'TPTY', 'VJA'],
  ['60028', 'VIJAYAWADA TIRUPATI EXPRESS', 'VJA', 'TPTY'],
  ['60029', 'NANDED HYDERABAD EXPRESS', 'NED', 'HYB'],
  ['60030', 'HYDERABAD NANDED EXPRESS', 'HYB', 'NED'],
  ['60031', 'AJMER JODHPUR EXPRESS', 'AII', 'JU'],
  ['60032', 'JODHPUR AJMER EXPRESS', 'JU', 'AII'],
  ['60033', 'BIKANER JODHPUR EXPRESS', 'BKN', 'JU'],
  ['60034', 'JODHPUR BIKANER EXPRESS', 'JU', 'BKN'],
  ['60035', 'AMRITSAR LUDHIANA EXPRESS', 'ASR', 'LDH'],
  ['60036', 'LUDHIANA AMRITSAR EXPRESS', 'LDH', 'ASR'],
  ['60037', 'UJJAIN INDORE INTERCITY', 'UJN', 'INDB'],
  ['60038', 'INDORE UJJAIN INTERCITY', 'INDB', 'UJN'],
  ['60039', 'GUWAHATI NEW JALPAIGURI EXPRESS', 'GHY', 'NJP'],
  ['60040', 'NEW JALPAIGURI GUWAHATI EXPRESS', 'NJP', 'GHY'],
  ['60041', 'UDIT EXPRESS', 'MMCT', 'LKO'],
['60042', 'JAY RATH', 'MMCT', 'KOTA'],
['60043', 'SAMYAK YATRA', 'UCHL', 'SRVD'],
];

trains.push(
  ...extraTrainRoutes.map(([number, name, from, to], index) => ({
    number,
    name,
    badge: index % 2 === 0 ? 'Superfast' : 'Express',
    typeText: 'Demo LHB Rake',
    from,
    to,
    departureTime: index % 2 === 0 ? '06:30' : '15:15',
    departurePlatform: 'Platform 1',
    arrivalTime: index % 2 === 0 ? '14:45' : '23:30',
    arrivalPlatform: 'Platform 2',
    duration: '8h 15m',
    routeHighlight: 'Demo Route • Online Booking',
    stopsCount: 6,
    intermediateStops: ['Major Junction (09:15)', 'Regional Stop (11:30)'],
    features: ['Pantry Included', 'Demo Availability'],
    operatingDays: 'Daily',
    classes: extraTrainClasses(),
  }))
);
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
        ON CONFLICT (number) DO UPDATE SET
  name = EXCLUDED.name,
  badge = EXCLUDED.badge,
  type_text = EXCLUDED.type_text,
  from_station_code = EXCLUDED.from_station_code,
  to_station_code = EXCLUDED.to_station_code,
  departure_time = EXCLUDED.departure_time,
  departure_platform = EXCLUDED.departure_platform,
  arrival_time = EXCLUDED.arrival_time,
  arrival_platform = EXCLUDED.arrival_platform,
  duration = EXCLUDED.duration,
  route_highlight = EXCLUDED.route_highlight,
  stops_count = EXCLUDED.stops_count,
  intermediate_stops = EXCLUDED.intermediate_stops,
  features = EXCLUDED.features,
  operating_days = EXCLUDED.operating_days
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
