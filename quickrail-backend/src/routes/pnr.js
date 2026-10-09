import { Router } from 'express';
import { query } from '../db/pool.js';

export const pnrRouter = Router();

// GET /api/pnr/:pnr — no auth required, same as IRCTC's public PNR status check
pnrRouter.get('/:pnr', async (req, res) => {
  const pnr = req.params.pnr.trim();
  try {
    const bookingResult = await query(
      `SELECT b.*, t.number AS train_number, t.name AS train_name, t.departure_time, t.arrival_time, t.duration
       FROM bookings b JOIN trains t ON t.id = b.train_id
       WHERE b.pnr = $1`,
      [pnr]
    );
    if (bookingResult.rowCount === 0) {
      return res.status(404).json({ error: 'No booking found for this PNR' });
    }
    const booking = bookingResult.rows[0];
    const passengers = await query(
      'SELECT name, age, gender, allotted_status, allotted_seat FROM passengers WHERE booking_id = $1',
      [booking.id]
    );

    res.json({
      pnr: booking.pnr,
      trainNumber: booking.train_number,
      trainName: booking.train_name,
      journeyDate: booking.journey_date,
      fromStationCode: booking.from_station_code,
      toStationCode: booking.to_station_code,
      classCode: booking.class_code,
      quota: booking.quota,
      bookingStatus: booking.status,
      chartStatus: booking.status === 'CONFIRMED' ? 'Chart Prepared' : 'Chart Not Prepared',
      passengers: passengers.rows.map((p) => ({
        name: p.name,
        age: p.age,
        gender: p.gender,
        currentStatus: p.allotted_status,
        seat: p.allotted_seat,
      })),
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'PNR lookup failed' });
  }
});
