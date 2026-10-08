import express from 'express';
import cors from 'cors';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';

import { authRouter } from './routes/auth.js';
import { stationsRouter } from './routes/stations.js';
import { trainsRouter } from './routes/trains.js';
import { bookingsRouter } from './routes/bookings.js';
import { paymentsRouter } from './routes/payments.js';
import { walletRouter } from './routes/wallet.js';
import { pnrRouter } from './routes/pnr.js';
import { aiRouter } from './routes/ai.js';
import { roomsRouter } from './routes/rooms.js';

dotenv.config();

export const app = express();

app.use(cors({ origin: process.env.CORS_ORIGIN || '*', credentials: true }));
app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));

const limiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 300 });
app.use(limiter);

// The Razorpay webhook needs the exact raw request body to verify its HMAC signature,
// so it's captured before the JSON body-parser transforms it.
app.use(
  express.json({
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  })
);

app.get('/api/health', (req, res) => res.json({ ok: true, service: 'quickrail-backend' }));

app.use('/api/auth', authRouter);
app.use('/api/stations', stationsRouter);
app.use('/api/trains', trainsRouter);
app.use('/api/bookings', bookingsRouter);
app.use('/api/rooms', roomsRouter);
app.use('/api/payments', paymentsRouter);
app.use('/api/wallet', walletRouter);
app.use('/api/pnr', pnrRouter);
app.use('/api/ai', aiRouter);

app.use((req, res) => res.status(404).json({ error: 'Not found' }));

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.status || 500).json({ error: err.message || 'Internal server error' });
});
