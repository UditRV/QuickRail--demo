# QuickRail — full-stack train booking demo

Two projects:

- **`/quickrail`** — the React/Vite frontend (your original UI).
- **`/quickrail-backend`** — a real Node.js + Express + PostgreSQL API, with Razorpay
  payments in test mode.

This is a real, working full-stack app: real database, real auth, real payment
processing (Razorpay test mode — swap in live keys later if you get a merchant
account). The one thing that's necessarily simulated is train inventory itself —
live Indian Railways seat data is only available through IRCTC's own licensed
partner APIs, so trains/seats here run on realistic seeded data in your own
Postgres DB rather than real IRCTC systems. See the note in the second chat
message of this conversation for why.

## 1. Backend setup

```bash
cd quickrail-backend
cp .env.example .env
# edit .env: set DATABASE_URL, JWT_SECRET, and your Razorpay TEST keys
# (get test keys free at https://dashboard.razorpay.com/app/keys)

npm install
npm run migrate   # creates tables
npm run seed       # loads sample stations + trains
npm run dev         # starts on http://localhost:4000
```

Verify it's up: `curl http://localhost:4000/api/health`

### Getting Razorpay test keys (free, no business verification needed for test mode)
1. Sign up at https://dashboard.razorpay.com/signup
2. Switch to **Test Mode** (toggle top-left)
3. Settings → API Keys → Generate Test Key
4. Paste `Key Id` / `Key Secret` into `.env` as `RAZORPAY_KEY_ID` / `RAZORPAY_KEY_SECRET`
5. For webhooks (optional but recommended): Settings → Webhooks → add
   `https://<your-domain>/api/payments/webhook`, set the same secret as
   `RAZORPAY_WEBHOOK_SECRET`

In test mode, Razorpay Checkout lets you "pay" with published test card numbers /
test UPI IDs — no real money moves. See https://razorpay.com/docs/payments/payments/test-card-upi-details/

## 2. Frontend setup

```bash
cd quickrail
cp .env.example .env.local
# set VITE_API_URL=http://localhost:4000 (or wherever you deploy the backend)

npm install --legacy-peer-deps   # the template's vite/esbuild peer ranges need this flag
npm run dev
```

## 3. What's real vs. simulated

| Feature | Status |
|---|---|
| User accounts, JWT auth, password hashing | Real (Postgres + bcrypt) |
| Train search, per-date seat availability | Real (Postgres, computed live) |
| Booking creation, PNR generation, CNF/RAC/WL allotment | Real |
| Card / UPI / NetBanking payment | Real (Razorpay test mode — swap keys for live money) |
| RailWallet top-up & wallet payments | Real |
| PNR enquiry | Real (public endpoint, like the actual IRCTC PNR checker) |
| Cancellation + refund | Real |
| OTP-based sign-in | UI only — the backend authenticates by password. Wiring real SMS OTP needs an SMS provider (Twilio/MSG91), not included. |
| ePayLater | UI only — not modeled server-side |
| "Digital Boarding Pass" opened directly from PNR enquiry (not from your own booking) | Shows the PNR only; full trip details aren't re-fetched into that screen yet |
| Live IRCTC seat inventory | Not possible without an official IRCTC partner API license — this uses your own seeded train data instead |

## 4. Going to production

- Point `DATABASE_URL` at a managed Postgres (Neon, RDS, Supabase, Railway, etc.)
- Swap Razorpay test keys for live keys once you have a verified business account
- Set a strong random `JWT_SECRET`
- Set `CORS_ORIGIN` to your real frontend domain
- Consider a cron job to expire `PENDING` bookings whose 8-minute `expires_at`
  window has lapsed (releases held seats back into availability) — not included,
  straightforward to add as a scheduled query against `bookings`/`class_availability`
- Rename/replace any remaining "IRCTC" branding text in the UI copy — the backend
  and this README already avoid claiming IRCTC affiliation, but a pass over the
  frontend's marketing copy is worth doing before any public deployment

## 5. QuickRail AI (booking assistant)

A floating **QuickRail AI** chat (bottom-right; full-screen on mobile) that books through the same backend as the website.

- **Backend:** `quickrail-backend/src/ai/*` + `src/routes/ai.js` (`/api/ai/chat`, `/session`, `/search`, `/booking`, `/booking/confirm`, `/booking/payment-result`). Every route requires the QuickRail JWT; the user id only ever comes from the token.
- **Frontend:** `quickrail/src/components/ai/*`, `quickrail/src/services/aiApi.ts`, mounted in `App.tsx`.
- **State machine:** persisted in `booking_agent_sessions`, so a page refresh resumes the booking. New tables are in `schema.sql` (`npm run migrate`): `saved_passengers`, `booking_agent_sessions`, `chat_messages`, `ai_audit_log`.
- **Payment safety:** the agent only places an 8-minute seat *hold* after the user presses **Confirm & Pay**. Money moves only when the user presses **Pay** on the payment card (existing `/api/payments` endpoints); "Ticket Confirmed" appears only after the backend reports the booking as PAID.
- **Optional LLM:** set `ANTHROPIC_API_KEY` to let Claude parse messy phrasing. It sees only the user's message (never train/passenger data) and cannot confirm, pay or cancel. Without a key, a rule-based parser is used.
- **Demo data:** `npm run seed && npm run seed:ai-demo` adds extra routes (Mumbai–Pune/Ahmedabad/Delhi etc.). This is **demo inventory, not real IRCTC data**; Razorpay runs in test mode.
- **Tests:** `cd quickrail-backend && TEST_DATABASE_URL=postgres://… npm test` (needs a throwaway Postgres DB — the tests TRUNCATE tables).
