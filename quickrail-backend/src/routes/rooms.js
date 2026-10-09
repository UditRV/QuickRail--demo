import { Router } from 'express';
import { z } from 'zod';
import { query } from '../db/pool.js';
import { requireAuth } from '../middleware/auth.js';

export const roomsRouter = Router();
roomsRouter.use(requireAuth);

const pnrSchema = z.object({
  pnr: z.string().regex(/^\d{3}-?\d{7}$/, 'Enter a valid 10-digit PNR'),
});

async function findTicket(userId, rawPnr) {
  const pnr = rawPnr.replace(/[^0-9]/g, '');
  const formattedPnr = `${pnr.slice(0, 3)}-${pnr.slice(3)}`;

  const result = await query(
    `SELECT
       b.id AS booking_id,
       b.pnr,
       b.journey_date,
       b.status,
       destination.code AS station_code,
       destination.name AS station_name
     FROM bookings b
     JOIN stations destination ON destination.code = b.to_station_code
     WHERE b.user_id = $1
       AND b.pnr = $2
       AND b.status IN ('CONFIRMED', 'RAC')`,
    [userId, formattedPnr]
  );

  return result.rows[0] || null;
}

roomsRouter.post('/reservations', async (req, res) => {
  const parsed = pnrSchema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({ error: 'Enter a valid 10-digit PNR.' });
  }

  try {
    const ticket = await findTicket(req.userId, parsed.data.pnr);

    if (!ticket) {
      return res.status(404).json({
        error: 'No confirmed ticket with this PNR belongs to your account.',
      });
    }

    const created = await query(
      `INSERT INTO room_reservations
        (user_id, booking_id, pnr, station_code, station_name, check_in_date)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (user_id, booking_id) DO NOTHING
       RETURNING *`,
      [
        req.userId,
        ticket.booking_id,
        ticket.pnr,
        ticket.station_code,
        ticket.station_name,
        ticket.journey_date,
      ]
    );

    const room = created.rows[0] || (
      await query(
        `SELECT * FROM room_reservations
         WHERE user_id = $1 AND booking_id = $2`,
        [req.userId, ticket.booking_id]
      )
    ).rows[0];

    res.status(created.rows[0] ? 201 : 200).json({ room, ticket });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Could not reserve the room.' });
  }
});

roomsRouter.get('/mine', async (req, res) => {
  try {
    const result = await query(
      `SELECT * FROM room_reservations
       WHERE user_id = $1
       ORDER BY created_at DESC`,
      [req.userId]
    );

    res.json({ rooms: result.rows });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Could not load room reservations.' });
  }
});