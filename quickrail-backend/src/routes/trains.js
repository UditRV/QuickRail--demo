import { Router } from 'express';
import { query, withTransaction } from '../db/pool.js';

export const trainsRouter = Router();

// GET /api/trains/search?from=NDLS&to=MMCT&date=2026-10-18
trainsRouter.get('/search', async (req, res) => {
  const { from, to, date } = req.query;
  if (!from || !to || !date) {
    return res.status(400).json({ error: 'from, to and date are required query params' });
  }

  try {
    const trainsResult = await query(
      `SELECT * FROM trains WHERE from_station_code = $1 AND to_station_code = $2 ORDER BY departure_time`,
      [from, to]
    );

    const trains = [];
    for (const train of trainsResult.rows) {
      const classesResult = await query(
        `SELECT * FROM train_classes WHERE train_id = $1 ORDER BY base_price`,
        [train.id]
      );

      const classes = [];
      for (const cls of classesResult.rows) {
        const availability = await ensureAvailability(cls, date);
        classes.push({
          classCode: cls.class_code,
          name: cls.name,
          price: Number(cls.base_price),
          availableCount: availability.available_seats,
          racCount: availability.rac_available,
          waitlistCount: availability.waitlist_count,
          statusType: statusTypeFor(availability),
          status: statusLabel(availability),
        });
      }

      trains.push({
        id: train.id,
        number: train.number,
        name: train.name,
        badge: train.badge,
        typeText: train.type_text,
        fromStationCode: train.from_station_code,
        toStationCode: train.to_station_code,
        departureTime: train.departure_time,
        departurePlatform: train.departure_platform,
        arrivalTime: train.arrival_time,
        arrivalPlatform: train.arrival_platform,
        duration: train.duration,
        routeHighlight: train.route_highlight,
        stopsCount: train.stops_count,
        intermediateStops: train.intermediate_stops,
        features: train.features,
        operatingDays: train.operating_days,
        classes,
      });
    }

    res.json({ trains, journeyDate: date });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Search failed' });
  }
});

trainsRouter.get('/:number', async (req, res) => {
  try {
    const result = await query('SELECT * FROM trains WHERE number = $1', [req.params.number]);
    if (result.rowCount === 0) return res.status(404).json({ error: 'Train not found' });
    res.json({ train: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch train' });
  }
});

// Lazily create the per-date availability row from the train's base capacity template.
async function ensureAvailability(trainClass, journeyDate) {
  return withTransaction(async (client) => {
    const existing = await client.query(
      `SELECT * FROM class_availability WHERE train_class_id = $1 AND journey_date = $2 FOR UPDATE`,
      [trainClass.id, journeyDate]
    );
    if (existing.rowCount > 0) return existing.rows[0];

    const inserted = await client.query(
      `INSERT INTO class_availability (train_class_id, journey_date, available_seats, rac_available, waitlist_count)
       VALUES ($1,$2,$3,$4,0)
       RETURNING *`,
      [trainClass.id, journeyDate, trainClass.total_seats, trainClass.rac_seats]
    );
    return inserted.rows[0];
  });
}

function statusTypeFor(availability) {
  if (availability.available_seats > 0) return 'available';
  if (availability.rac_available > 0) return 'rac';
  return 'waitlist';
}

function statusLabel(availability) {
  if (availability.available_seats > 0) return `AVAILABLE-${availability.available_seats}`;
  if (availability.rac_available > 0) return `RAC ${availability.rac_available}`;
  return `WL ${availability.waitlist_count + 1}`;
}
