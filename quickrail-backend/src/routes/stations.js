import { Router } from 'express';
import { query } from '../db/pool.js';

export const stationsRouter = Router();

// Direct destinations that can actually be searched from one origin station.
stationsRouter.get('/destinations/:fromCode', async (req, res) => {
  const fromCode = String(req.params.fromCode || '').trim().toUpperCase();
  if (!fromCode) return res.status(400).json({ error: 'Origin station code is required' });

  try {
    const result = await query(
      `SELECT DISTINCT s.code, s.name, s.city, s.state
       FROM trains t
       JOIN stations s ON s.code = t.to_station_code
       WHERE t.from_station_code = $1
       ORDER BY s.name`,
      [fromCode]
    );
    res.json({ stations: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch destination stations' });
  }
});

stationsRouter.get('/', async (req, res) => {
  const { q } = req.query;
  try {
    let result;
    if (q) {
      result = await query(
        `SELECT code, name, city, state FROM stations
         WHERE code ILIKE $1 OR name ILIKE $1 OR city ILIKE $1
         ORDER BY name LIMIT 20`,
        [`%${q}%`]
      );
    } else {
      result = await query('SELECT code, name, city, state FROM stations ORDER BY name');
    }
    res.json({ stations: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to fetch stations' });
  }
});
