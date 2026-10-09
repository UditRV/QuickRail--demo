import React, { useEffect, useState } from 'react';
import type { Card, AiAction, TrainView, TrainClassView } from '../../services/aiApi';

// All card text comes from the backend as DATA and is rendered as plain React text (never as HTML).

type Act = (a: AiAction) => void;
interface Common { active: boolean; busy: boolean; onAction: Act }

const inr = (n: number) => `₹${Number(n).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;

const AVAIL: Record<string, { label: string; cls: string }> = {
  AVAILABLE: { label: 'Available', cls: 'bg-green-50 text-green-700 border-green-200' },
  PARTIAL: { label: 'Partly available', cls: 'bg-amber-50 text-amber-700 border-amber-200' },
  RAC: { label: 'RAC', cls: 'bg-amber-50 text-amber-700 border-amber-200' },
  WL: { label: 'Waitlist', cls: 'bg-red-50 text-red-700 border-red-200' },
};
const AvailBadge = ({ c }: { c: TrainClassView }) => {
  const a = AVAIL[c.availability] || AVAIL.WL;
  const detail = c.availability === 'AVAILABLE' || c.availability === 'PARTIAL' ? ` · ${c.availableCount}` : c.statusLabel && c.availability !== 'RAC' ? ` · ${c.statusLabel}` : '';
  return <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${a.cls}`}>{a.label}{detail}</span>;
};

const btnPrimary = 'px-4 py-2 rounded-lg bg-[#001026] text-white text-sm font-semibold hover:bg-[#0b2545] disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-[#ff8928]';
const btnGhost = 'px-4 py-2 rounded-lg border border-[#c4c6cf] bg-white text-[#001026] text-sm font-semibold hover:bg-[#eff4ff] disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-[#ff8928]';
const shell = (active: boolean) => `rounded-xl border border-[#dce9ff] bg-white shadow-sm overflow-hidden ${active ? '' : 'opacity-70'}`;

// ------------------------------------------------------------------ trains
function TrainCard({ t, onPick, disabled, single }: { t: TrainView; onPick: (n: string, cls?: string) => void; disabled: boolean; single: string | null }) {
  const cheapest = [...t.classes].sort((a, b) => a.fare - b.fare)[0];
  const shown = single ? t.classes.filter((c) => c.classCode === single) : t.classes;
  return (
    <div className="rounded-lg border border-[#dce9ff] p-3 bg-white">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-sm font-bold text-[#001026] truncate">{t.trainNumber} {t.trainName}</div>
          {t.badge && <div className="text-[11px] text-[#44474e]">{t.badge}</div>}
        </div>
        <div className="text-right shrink-0">
          <div className="text-[11px] text-[#44474e]">from</div>
          <div className="text-sm font-bold text-[#001026]">{inr(cheapest.fare)}</div>
        </div>
      </div>
      <div className="flex items-center gap-2 mt-2 text-xs text-[#0b1c30]">
        <div className="min-w-0">
          <div className="font-mono font-bold text-sm">{t.departure}</div>
          <div className="truncate text-[#44474e]">{t.fromName}</div>
        </div>
        <div className="flex-1 flex flex-col items-center text-[#74777f]">
          <span className="text-[11px]">{t.duration}</span>
          <div className="w-full h-px bg-[#c4c6cf] relative"><span className="material-symbols-outlined absolute -top-[9px] left-1/2 -translate-x-1/2 bg-white text-[16px]">train</span></div>
        </div>
        <div className="min-w-0 text-right">
          <div className="font-mono font-bold text-sm">{t.arrival}{t.arrivalDayOffset > 0 && <sup className="text-[#ff8928]"> +{t.arrivalDayOffset}</sup>}</div>
          <div className="truncate text-[#44474e]">{t.toName}</div>
        </div>
      </div>
      <div className="mt-3 space-y-1.5">
        {shown.map((c) => (
          <div key={c.classCode} className="flex items-center justify-between gap-2 rounded-md bg-[#f8f9ff] px-2 py-1.5">
            <div className="flex items-center gap-2 min-w-0 flex-wrap">
              <span className="text-xs font-bold text-[#001026]">{c.classCode}</span>
              <AvailBadge c={c} />
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-xs font-semibold">{inr(c.fare)}</span>
              <button className="px-3 py-1 rounded-md bg-[#001026] text-white text-xs font-semibold hover:bg-[#0b2545] disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#ff8928]" disabled={disabled} onClick={() => onPick(t.trainNumber, c.classCode)} aria-label={`Select ${t.trainName} in ${c.classCode}`}>Select</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function TrainsCard({ card, active, busy, onAction }: Common & { card: Extract<Card, { type: 'trains' }> }) {
  return (
    <div className="space-y-2">
      <div className="text-[11px] text-[#44474e] px-1">{card.from} → {card.to} · {card.dateLong}{card.classCode ? ` · ${card.classCode}` : ''} · {card.passengers} passenger{card.passengers > 1 ? 's' : ''}</div>
      {card.trains.map((t) => (
        <TrainCard key={t.trainNumber} t={t} single={card.classCode} disabled={!active || busy} onPick={(n, c) => onAction({ type: 'SELECT_TRAIN', trainNumber: n, classCode: c })} />
      ))}
    </div>
  );
}

function RouteChoiceCard({ card, active, busy, onAction }: Common & { card: Extract<Card, { type: 'routeChoice' }> }) {
  return (
    <div className={`${shell(active)} p-3 space-y-2`}>
      {card.options.map((o) => (
        <button key={o.from.code + o.to.code} disabled={!active || busy} onClick={() => onAction({ type: 'CHOOSE_ROUTE', from: o.from.code, to: o.to.code })}
          className="w-full text-left rounded-lg border border-[#dce9ff] px-3 py-2 hover:bg-[#eff4ff] disabled:opacity-60 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-[#ff8928]">
          <span className="font-semibold">{o.from.name}</span> <span className="text-[#74777f]">({o.from.code})</span> → <span className="font-semibold">{o.to.name}</span> <span className="text-[#74777f]">({o.to.code})</span>
        </button>
      ))}
    </div>
  );
}

function ClassChoiceCard({ card, active, busy, onAction }: Common & { card: Extract<Card, { type: 'classChoice' }> }) {
  return (
    <div className={`${shell(active)} p-3 space-y-2`}>
      <div className="text-xs font-bold">{card.trainNumber} {card.trainName}</div>
      {card.classes.map((c) => (
        <button key={c.classCode} disabled={!active || busy} onClick={() => onAction({ type: 'SELECT_TRAIN', trainNumber: card.trainNumber, classCode: c.classCode })}
          className="w-full flex items-center justify-between gap-2 rounded-lg border border-[#dce9ff] px-3 py-2 hover:bg-[#eff4ff] disabled:opacity-60 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-[#ff8928]">
          <span className="font-semibold">{c.name} ({c.classCode})</span>
          <span className="flex items-center gap-2"><AvailBadge c={c} /><span className="font-semibold">{inr(c.fare)}</span></span>
        </button>
      ))}
    </div>
  );
}

// ------------------------------------------------------------------ review & confirm
function Row({ k, v, strong }: { k: string; v: React.ReactNode; strong?: boolean }) {
  return <div className="flex justify-between gap-3 py-1 text-sm"><span className="text-[#44474e]">{k}</span><span className={`text-right ${strong ? 'font-bold text-[#001026]' : 'font-medium'}`}>{v}</span></div>;
}

function SummaryCard({ card, active, busy, onAction }: Common & { card: Extract<Card, { type: 'summary' }> }) {
  return (
    <div className={shell(active)}>
      <div className="bg-[#001026] text-white px-4 py-2.5 text-sm font-bold flex items-center gap-2"><span className="material-symbols-outlined text-[18px] text-[#ff8928]">fact_check</span>Review Your Booking</div>
      <div className="px-4 py-3 divide-y divide-[#eff4ff]">
        <div className="pb-2">
          <Row k="Train" v={`${card.train.name} (${card.train.number})`} />
          <Row k="From" v={card.from} />
          <Row k="To" v={card.to} />
          <Row k="Date" v={card.dateLong} />
          <Row k="Departs / Arrives" v={`${card.train.departure} → ${card.train.arrival}${card.train.arrivalDayOffset > 0 ? ` (+${card.train.arrivalDayOffset})` : ''}`} />
          <Row k="Class" v={`${card.className} (${card.classCode})`} />
          <Row k="Quota" v={card.quota} />
        </div>
        <div className="py-2">
          <div className="text-xs font-semibold text-[#44474e] mb-1">Passengers ({card.passengers.length})</div>
          {card.passengers.map((p, i) => <div key={i} className="text-sm">{i + 1}. {p.name} · {p.age} · {p.gender}{p.berthPreference && p.berthPreference !== 'No Preference' ? ` · ${p.berthPreference}` : ''}</div>)}
        </div>
        <div className="pt-2">
          <Row k="Base fare" v={inr(card.fare.baseAmount)} />
          <Row k="Convenience fee" v={inr(card.fare.convenienceFee)} />
          <Row k="GST" v={inr(card.fare.gstAmount)} />
          <Row k="Total Fare" v={inr(card.fare.totalAmount)} strong />
        </div>
      </div>
      {card.warning && <div className="mx-4 mb-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-xs px-3 py-2">{card.warning}</div>}
      <div className="px-4 pb-3 text-[11px] text-[#74777f]">Nothing is charged yet. Confirming reserves your seats for 8 minutes while you choose how to pay.</div>
      <div className="px-4 pb-4 flex flex-wrap gap-2">
        <button className={btnPrimary} disabled={!active || busy} onClick={() => onAction({ type: 'CONFIRM_BOOKING', token: card.token })}>Confirm &amp; Pay</button>
        <button className={btnGhost} disabled={!active || busy} onClick={() => onAction({ type: 'CHANGE_DETAILS' })}>Change Details</button>
        <button className={btnGhost} disabled={!active || busy} onClick={() => onAction({ type: 'CANCEL_FLOW' })}>Cancel</button>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ payment (the user's own click is the only thing that charges)
const METHOD_LABEL: Record<string, { label: string; icon: string }> = {
  wallet: { label: 'RailWallet', icon: 'account_balance_wallet' }, upi: { label: 'UPI', icon: 'qr_code_2' },
  card: { label: 'Card', icon: 'credit_card' }, netbanking: { label: 'Net Banking', icon: 'account_balance' },
};

function useCountdown(expiresAt: string) {
  const [left, setLeft] = useState(() => Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000)));
  useEffect(() => {
    const id = setInterval(() => setLeft(Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000))), 1000);
    return () => clearInterval(id);
  }, [expiresAt]);
  return left;
}

function PaymentCard({ card, active, busy, onPay }: { card: Extract<Card, { type: 'payment' }>; active: boolean; busy: boolean; onPay: (method: 'wallet' | 'upi' | 'card' | 'netbanking') => void }) {
  const left = useCountdown(card.expiresAt);
  const [method, setMethod] = useState<'wallet' | 'upi' | 'card' | 'netbanking'>(card.walletBalance >= card.total ? 'wallet' : 'upi');
  const expired = left === 0;
  const short = method === 'wallet' && card.walletBalance < card.total;
  return (
    <div className={shell(active)}>
      <div className="bg-[#001026] text-white px-4 py-2.5 flex items-center justify-between text-sm font-bold">
        <span className="flex items-center gap-2"><span className="material-symbols-outlined text-[18px] text-[#ff8928]">lock</span>Secure payment</span>
        <span className={`font-mono text-xs ${left < 60 ? 'text-[#ffb784]' : 'text-[#cbdbf5]'}`} aria-label="Seat hold time left">{expired ? 'Expired' : `${String(Math.floor(left / 60)).padStart(2, '0')}:${String(left % 60).padStart(2, '0')}`}</span>
      </div>
      <div className="px-4 py-3">
        <div className="text-xs text-[#44474e]">{card.trainLabel} · {card.dateLong}</div>
        <div className="text-2xl font-bold text-[#001026] my-1">{inr(card.total)}</div>
        <div role="radiogroup" aria-label="Payment method" className="grid grid-cols-2 gap-2 mt-2">
          {card.methods.map((m) => (
            <button key={m} role="radio" aria-checked={method === m} disabled={!active || busy || expired} onClick={() => setMethod(m)}
              className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm text-left disabled:opacity-60 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#ff8928] ${method === m ? 'border-[#001026] bg-[#eff4ff] font-semibold' : 'border-[#dce9ff]'}`}>
              <span className="material-symbols-outlined text-[18px]">{METHOD_LABEL[m].icon}</span>
              <span className="min-w-0"><span className="block">{METHOD_LABEL[m].label}</span>{m === 'wallet' && <span className="block text-[11px] text-[#74777f]">Balance {inr(card.walletBalance)}</span>}</span>
            </button>
          ))}
        </div>
        {short && <div className="mt-2 text-xs text-red-700">Your RailWallet balance is lower than the total. Top up from the wallet menu or choose another method.</div>}
        <button className={`${btnPrimary} w-full mt-3`} disabled={!active || busy || expired || short} onClick={() => onPay(method)}>{busy ? 'Processing…' : expired ? 'Hold expired' : `Pay ${inr(card.total)}`}</button>
        <div className="mt-2 text-[11px] text-[#74777f] text-center">You are charged only when you press Pay. Test-mode payments move no real money.</div>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ ticket
function ConfirmationCard({ card, onViewBookings }: { card: Extract<Card, { type: 'confirmation' }>; onViewBookings: () => void }) {
  const ok = card.confirmed;
  return (
    <div className="rounded-xl border border-[#dce9ff] bg-white shadow-sm overflow-hidden">
      <div className={`${ok ? 'bg-green-700' : 'bg-amber-600'} text-white px-4 py-2.5 text-sm font-bold`}>{ok ? '🎉 ' : ''}{card.heading}</div>
      <div className="px-4 py-3 divide-y divide-[#eff4ff]">
        <div className="pb-2">
          <Row k="Train" v={`${card.train.number} ${card.train.name}`} />
          <Row k="From" v={card.from} />
          <Row k="To" v={card.to} />
          <Row k="Date" v={card.dateLong} />
          <Row k="Class" v={card.classCode} />
        </div>
        <div className="py-2">
          {card.passengers.map((p, i) => <div key={i} className="flex justify-between text-sm"><span>{p.name}</span><span className="text-[#44474e]">{p.status}{p.seat ? ` · ${p.seat}` : ''}</span></div>)}
        </div>
        <div className="pt-2">
          <Row k="PNR" v={<span className="font-mono">{card.pnr}</span>} strong />
          <Row k="Booking ID" v={<span className="font-mono">{card.bookingRef}</span>} strong />
          <Row k="Amount paid" v={inr(card.totalAmount)} />
        </div>
      </div>
      <div className="px-4 pb-4 flex flex-wrap gap-2">
        <button className={btnPrimary} onClick={() => window.print()}>Download Ticket</button>
        <button className={btnGhost} onClick={onViewBookings}>My Bookings</button>
      </div>
    </div>
  );
}

function BookingsCard({ card, active, busy, onAction }: Common & { card: Extract<Card, { type: 'bookings' }> }) {
  const cancelMode = /cancel/i.test(card.title);
  return (
    <div className={`${shell(active)} p-3 space-y-2`}>
      <div className="text-xs font-bold text-[#44474e]">{card.title}</div>
      {card.bookings.map((b) => (
        <div key={b.id} className="rounded-lg border border-[#dce9ff] p-2.5 text-sm">
          <div className="flex justify-between gap-2"><span className="font-semibold truncate">{b.trainNumber} {b.trainName}</span><span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-[#eff4ff] shrink-0">{b.status}</span></div>
          <div className="text-xs text-[#44474e]">{b.from} → {b.to} · {b.dateLong}</div>
          <div className="text-xs text-[#44474e]">{b.classCode} · {b.passengers} pax · {inr(b.amount)} · PNR <span className="font-mono">{b.pnr}</span></div>
          {cancelMode && b.cancellable && <button className={`${btnGhost} mt-2 !py-1 !text-xs`} disabled={!active || busy} onClick={() => onAction({ type: 'CANCEL_SELECT', bookingId: b.id })}>Cancel this ticket</button>}
        </div>
      ))}
    </div>
  );
}

function CancelConfirmCard({ card, active, busy, onAction }: Common & { card: Extract<Card, { type: 'cancelConfirm' }> }) {
  return (
    <div className={shell(active)}>
      <div className="bg-red-700 text-white px-4 py-2.5 text-sm font-bold">Booking Found</div>
      <div className="px-4 py-3">
        <Row k="PNR" v={<span className="font-mono">{card.pnr}</span>} strong />
        <Row k="Train" v={card.train} />
        <Row k="Route" v={`${card.from} → ${card.to}`} />
        <Row k="Date" v={card.dateLong} />
        <Row k="Class / passengers" v={`${card.classCode} · ${card.passengers}`} />
        <Row k="Refund to RailWallet" v={card.refund ? inr(card.refund) : '—'} strong />
        <div className="text-xs text-[#44474e] mt-2">Are you sure you want to cancel this ticket?</div>
      </div>
      <div className="px-4 pb-4 flex gap-2">
        <button className="px-4 py-2 rounded-lg bg-red-700 text-white text-sm font-semibold hover:bg-red-800 disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#ff8928]" disabled={!active || busy} onClick={() => onAction({ type: 'CANCEL_CONFIRM', token: card.token })}>Cancel Ticket</button>
        <button className={btnGhost} disabled={!active || busy} onClick={() => onAction({ type: 'KEEP_TICKET' })}>Keep Ticket</button>
      </div>
    </div>
  );
}

// ------------------------------------------------------------------ dispatcher
export function CardView({ card, active, busy, onAction, onPay, onViewBookings, passengerForm }: Common & {
  card: Card; onPay: (m: 'wallet' | 'upi' | 'card' | 'netbanking') => void; onViewBookings: () => void; passengerForm: (c: Extract<Card, { type: 'passengerForm' }>) => React.ReactNode;
}) {
  const c = { active, busy, onAction };
  switch (card.type) {
    case 'trains': return <TrainsCard card={card} {...c} />;
    case 'routeChoice': return <RouteChoiceCard card={card} {...c} />;
    case 'classChoice': return <ClassChoiceCard card={card} {...c} />;
    case 'passengerForm': return <>{passengerForm(card)}</>;
    case 'summary': return <SummaryCard card={card} {...c} />;
    case 'payment': return <PaymentCard card={card} active={active} busy={busy} onPay={onPay} />;
    case 'confirmation': return <ConfirmationCard card={card} onViewBookings={onViewBookings} />;
    case 'bookings': return <BookingsCard card={card} {...c} />;
    case 'cancelConfirm': return <CancelConfirmCard card={card} {...c} />;
    default: return null;
  }
}
