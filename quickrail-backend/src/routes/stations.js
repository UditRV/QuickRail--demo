import { Router } from 'express';
import { query } from '../db/pool.js';

export const stationsRouter = Router();

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
