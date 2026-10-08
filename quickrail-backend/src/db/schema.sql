-- QuickRail database schema (PostgreSQL)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS users (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name                TEXT NOT NULL,
  email               TEXT UNIQUE NOT NULL,
  mobile              TEXT UNIQUE NOT NULL,
  password_hash       TEXT NOT NULL,
  irctc_username      TEXT UNIQUE NOT NULL,
  is_aadhaar_verified BOOLEAN NOT NULL DEFAULT FALSE,
  aadhaar_last4       TEXT,
  city                TEXT,
  state               TEXT,
  pincode             TEXT,
  occupation          TEXT,
  wallet_balance      NUMERIC(12,2) NOT NULL DEFAULT 0,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS stations (
  code  TEXT PRIMARY KEY,
  name  TEXT NOT NULL,
  city  TEXT,
  state TEXT
);

CREATE TABLE IF NOT EXISTS trains (
  id                 SERIAL PRIMARY KEY,
  number             TEXT UNIQUE NOT NULL,
  name               TEXT NOT NULL,
  badge              TEXT,
  type_text          TEXT,
  from_station_code  TEXT NOT NULL REFERENCES stations(code),
  to_station_code    TEXT NOT NULL REFERENCES stations(code),
  departure_time     TEXT NOT NULL,
  departure_platform TEXT,
  arrival_time       TEXT NOT NULL,
  arrival_platform   TEXT,
  duration           TEXT,
  route_highlight    TEXT,
  stops_count        INT DEFAULT 0,
  intermediate_stops TEXT[] DEFAULT '{}',
  features           TEXT[] DEFAULT '{}',
  operating_days     TEXT DEFAULT 'Daily'
);

-- Base class/fare config per train (capacity template)
CREATE TABLE IF NOT EXISTS train_classes (
  id           SERIAL PRIMARY KEY,
  train_id     INT NOT NULL REFERENCES trains(id) ON DELETE CASCADE,
  class_code   TEXT NOT NULL,      -- e.g. 3A, SL, 2A, 1A, CC
  name         TEXT NOT NULL,
  base_price   NUMERIC(10,2) NOT NULL,
  total_seats  INT NOT NULL,
  rac_seats    INT NOT NULL DEFAULT 0,
  UNIQUE (train_id, class_code)
);

-- Per-journey-date availability, created lazily on first search for that date
CREATE TABLE IF NOT EXISTS class_availability (
  id                SERIAL PRIMARY KEY,
  train_class_id    INT NOT NULL REFERENCES train_classes(id) ON DELETE CASCADE,
  journey_date      DATE NOT NULL,
  available_seats   INT NOT NULL,
  rac_available     INT NOT NULL DEFAULT 0,
  waitlist_count    INT NOT NULL DEFAULT 0,
  UNIQUE (train_class_id, journey_date)
);

CREATE TABLE IF NOT EXISTS bookings (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  pnr                   TEXT UNIQUE NOT NULL,
  train_id              INT NOT NULL REFERENCES trains(id),
  class_code            TEXT NOT NULL,
  journey_date          DATE NOT NULL,
  from_station_code     TEXT NOT NULL,
  to_station_code       TEXT NOT NULL,
  quota                 TEXT NOT NULL DEFAULT 'GN',
  contact_mobile        TEXT NOT NULL,
  contact_email         TEXT NOT NULL,
  preferred_coach       TEXT,
  auto_upgradation      BOOLEAN DEFAULT FALSE,
  book_only_if_confirm  BOOLEAN DEFAULT FALSE,
  quick_rail_assured    BOOLEAN DEFAULT FALSE,
  travel_insurance      BOOLEAN DEFAULT FALSE,
  base_amount           NUMERIC(10,2) NOT NULL,
  convenience_fee       NUMERIC(10,2) NOT NULL DEFAULT 0,
  gst_amount            NUMERIC(10,2) NOT NULL DEFAULT 0,
  total_amount          NUMERIC(10,2) NOT NULL,
  status                TEXT NOT NULL DEFAULT 'PENDING', -- PENDING | CONFIRMED | RAC | WAITLIST | CANCELLED | EXPIRED
  booking_time          TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at            TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS passengers (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id             UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  name                   TEXT NOT NULL,
  age                    INT NOT NULL,
  gender                 TEXT NOT NULL,
  berth_preference       TEXT,
  meal_option            TEXT,
  is_senior_citizen_quota BOOLEAN DEFAULT FALSE,
  is_child_without_berth BOOLEAN DEFAULT FALSE,
  allotted_status        TEXT,   -- CNF | RAC | WL
  allotted_seat          TEXT    -- e.g. "B4 / 23 / Side Lower"
);

CREATE TABLE IF NOT EXISTS payments (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id          UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  method              TEXT NOT NULL, -- upi | card | netbanking | wallet
  razorpay_order_id   TEXT,
  razorpay_payment_id TEXT,
  razorpay_signature  TEXT,
  amount              NUMERIC(10,2) NOT NULL,
  status              TEXT NOT NULL DEFAULT 'CREATED', -- CREATED | PAID | FAILED | REFUNDED
  bank_ref_number     TEXT,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  paid_at             TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS wallet_transactions (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type           TEXT NOT NULL, -- TOPUP | DEBIT | REFUND
  amount         NUMERIC(10,2) NOT NULL,
  balance_after  NUMERIC(10,2) NOT NULL,
  reference      TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_bookings_user ON bookings(user_id);
CREATE INDEX IF NOT EXISTS idx_bookings_pnr ON bookings(pnr);
CREATE INDEX IF NOT EXISTS idx_payments_booking ON payments(booking_id);
CREATE INDEX IF NOT EXISTS idx_class_avail_lookup ON class_availability(train_class_id, journey_date);

-- ---------------------------------------------------------------------------
-- QuickRail AI (booking agent). Stores only what the state machine needs:
-- no payment data, and passenger details live only in the session state until booking completes.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS saved_passengers (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name             TEXT NOT NULL,
  age              INT NOT NULL,
  gender           TEXT NOT NULL,
  berth_preference TEXT,
  is_self          BOOLEAN NOT NULL DEFAULT FALSE,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS booking_agent_sessions (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  stage      TEXT NOT NULL DEFAULT 'IDLE',
  state      JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS chat_messages (
  id         BIGSERIAL PRIMARY KEY,
  session_id UUID NOT NULL REFERENCES booking_agent_sessions(id) ON DELETE CASCADE,
  role       TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content    TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ai_audit_log (
  id         BIGSERIAL PRIMARY KEY,
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  session_id UUID,
  action     TEXT NOT NULL,
  details    JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS room_reservations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  pnr TEXT NOT NULL,
  station_code TEXT NOT NULL REFERENCES stations(code),
  station_name TEXT NOT NULL,
  check_in_date DATE NOT NULL,
  room_type TEXT NOT NULL DEFAULT 'Standard AC Retiring Room',
  status TEXT NOT NULL DEFAULT 'CONFIRMED',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, booking_id)
);
CREATE TABLE IF NOT EXISTS food_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  pnr TEXT NOT NULL,
  items JSONB NOT NULL,
  total_amount NUMERIC(10,2) NOT NULL,
  delivery_station TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'CONFIRMED',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_agent_sessions_user ON booking_agent_sessions(user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_chat_messages_session ON chat_messages(session_id, id);
CREATE INDEX IF NOT EXISTS idx_saved_passengers_user ON saved_passengers(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_audit_user ON ai_audit_log(user_id, created_at DESC);
