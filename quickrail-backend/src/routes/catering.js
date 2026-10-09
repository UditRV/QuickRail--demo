import { Router } from 'express';
import { z } from 'zod';
import { query } from '../db/pool.js';
import { requireAuth } from '../middleware/auth.js';

export const cateringRouter = Router();

cateringRouter.use(requireAuth);

const MENU = [
  {
    id: 'cat-1',
    name: "Haldiram's Deluxe Executive Thali",
    price: 249,
  },
  {
    id: 'cat-2',
    name: "Domino's Farmhouse Veggie Pizza (Regular)",
    price: 199,
  },
  {
    id: 'cat-3',
    name: 'Amritsari Kulcha & Chole Combo',
    price: 149,
  },
  {
    id: 'cat-4',
    name: 'Chai Point Special Kulhad Ginger Chai (Pack of 2)',
    price: 89,
  },
];

const orderSchema = z.object({
  pnr: z.string().regex(/^\d{3}-?\d{7}$/, 'Enter a valid 10-digit PNR.'),
  itemIds: z.array(z.string()).min(1, 'Choose at least one food item.'),
});

cateringRouter.post('/orders', async (req, res) => {
  const parsed = orderSchema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0].message });
  }

  try {
    const digits = parsed.data.pnr.replace(/\D/g, '');
    const formattedPnr = `${digits.slice(0, 3)}-${digits.slice(3)}`;

    const ticketResult = await query(
      `SELECT
        b.id AS booking_id,
        b.pnr,
        destination.name AS station_name
      FROM bookings b
      JOIN stations destination ON destination.code = b.to_station_code
      WHERE b.user_id = $1
        AND b.pnr = $2
        AND b.status IN ('CONFIRMED', 'RAC')`,
      [req.userId, formattedPnr]
    );

    const ticket = ticketResult.rows[0];

    if (!ticket) {
      return res.status(404).json({
        error: 'No confirmed ticket with this PNR belongs to your account.',
      });
    }

    const selectedItems = parsed.data.itemIds
      .map((itemId) => MENU.find((item) => item.id === itemId))
      .filter(Boolean);

    if (selectedItems.length !== parsed.data.itemIds.length) {
      return res.status(400).json({ error: 'One or more food items are invalid.' });
    }

    const items = Object.values(
      selectedItems.reduce((result, item) => {
        if (!result[item.id]) {
          result[item.id] = {
            id: item.id,
            name: item.name,
            price: item.price,
            quantity: 0,
          };
        }

        result[item.id].quantity += 1;
        return result;
      }, {})
    );

    const totalAmount = items.reduce(
      (total, item) => total + item.price * item.quantity,
      0
    );

    const result = await query(
      `INSERT INTO food_orders
        (user_id, booking_id, pnr, items, total_amount, delivery_station)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        req.userId,
        ticket.booking_id,
        ticket.pnr,
        JSON.stringify(items),
        totalAmount,
        ticket.station_name,
      ]
    );

    res.status(201).json({ order: result.rows[0] });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Could not place the food order.' });
  }
});

cateringRouter.get('/mine', async (req, res) => {
  try {
    const result = await query(
      `SELECT * FROM food_orders
       WHERE user_id = $1
       ORDER BY created_at DESC`,
      [req.userId]
    );

    res.json({ orders: result.rows });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Could not load food orders.' });
  }
});