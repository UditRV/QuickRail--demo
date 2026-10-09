import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ApiError, apiCreatePaymentOrder, apiVerifyPayment, openRazorpayCheckout, apiGetWallet } from '../../services/api';
import { aiGetSession, aiResetSession, aiSendAction, aiSendMessage, type AiAction, type AiMessage, type AiTurn, type Suggestion } from '../../services/aiApi';
import { CardView } from './Cards';
import { PassengerForm } from './PassengerForm';
import { apiReserveRoom, apiGetRoomReservations } from '../../services/api';
import { CATERING_MENU_ITEMS } from '../../data/mockData';
import { apiPlaceFoodOrder } from '../../services/api';

interface Props {
isOpen?: boolean;
onOpenChange?: (open: boolean) => void;
  isLoggedIn: boolean;
  userName: string;
  userEmail: string;
  userMobile: string;
  onRequireLogin: () => void;
  onWalletChanged: (balance: number) => void;
}

const DEFAULT_SUGGESTIONS: Suggestion[] = [
  { label: '🧭 Guide me', text: 'How do I use QuickRail?' },
  { label: '🎫 How to book', text: 'How do I book a ticket?' },
  { label: '🔎 Find trains', text: 'How do I search and compare trains?' },
  { label: '📋 PNR & status', text: 'How do I check PNR and running status?' },
  { label: '🍽️ More features', text: 'Guide me through QuickBid, RailWallet, meals and retiring rooms' },
  { label: '🚆 Book now', text: 'Book a ticket' },
];
const WELCOME: AiMessage = { role: 'assistant', text: 'Hi! I’m Disha, your QuickRail guide. I can walk you through booking, train search, PNR enquiry, running status, tourist trains, QuickBid, RailWallet, meals, retiring rooms, payments, cancellations, and account features. Ask “How do I use QuickRail?” or tell me what you want to do.' };

const TypingIndicator = () => (
  <div className="flex items-center gap-1 px-3 py-2.5 rounded-2xl rounded-bl-sm bg-white border border-[#dce9ff] w-fit" role="status" aria-label="Disha is typing">
    {[0, 1, 2].map((i) => <span key={i} className="w-1.5 h-1.5 rounded-full bg-[#74777f] animate-pulse" style={{ animationDelay: `${i * 150}ms` }} />)}
  </div>
);

export const QuickRailAI: React.FC<Props> = ({
  isLoggedIn,
  userName,
  userEmail,
  userMobile,
  onRequireLogin,
  onWalletChanged,
  isOpen,
  onOpenChange,
}) => {
 const [internalOpen, setInternalOpen] = useState(false);
const open = isOpen ?? internalOpen;

const setOpen = (next: boolean) => {
  setInternalOpen(next);
  onOpenChange?.(next);
};
  const [messages, setMessages] = useState<AiMessage[]>([WELCOME]);
  const [suggestions, setSuggestions] = useState<Suggestion[]>(DEFAULT_SUGGESTIONS);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [input, setInput] = useState('');
const [roomStep, setRoomStep] = useState<'idle' | 'waitingForPnr'>('idle');
const [foodStep, setFoodStep] = useState<
  'idle' | 'waitingForPnr' | 'waitingForItems'
>('idle');
const [foodPnr, setFoodPnr] = useState('');
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const scroller = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Restore the in-progress booking after a page refresh (state lives on the server).
  useEffect(() => {
    if (!open || !isLoggedIn || loaded) return;
    setLoaded(true);
    aiGetSession().then((v) => {
      if (!v.sessionId) return;
      setSessionId(v.sessionId);
      const hist: AiMessage[] = v.messages.map((m) => ({ role: m.role, text: m.text }));
      const cur = v.current && (v.current.text || v.current.cards.length) ? [{ role: 'assistant' as const, text: v.current.text, cards: v.current.cards }] : [];
      setMessages([WELCOME, ...hist.slice(-12), ...cur]);
      setSuggestions(v.suggestions?.length ? v.suggestions : []);
    }).catch(() => { /* fall back to a fresh chat */ });
  }, [open, isLoggedIn, loaded]);

  // New login / logout → drop the previous user's conversation from memory.
  useEffect(() => { setLoaded(false); setSessionId(null); setMessages([WELCOME]); setSuggestions(DEFAULT_SUGGESTIONS); }, [isLoggedIn, userEmail]);

  useLayoutEffect(() => { scroller.current?.scrollTo({ top: scroller.current.scrollHeight, behavior: 'smooth' }); }, [messages, busy, open]);
  useEffect(() => { if (open) { const t = setTimeout(() => inputRef.current?.focus(), 50); return () => clearTimeout(t); } }, [open]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', onKey); return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  const applyTurn = useCallback((t: AiTurn) => {
    setSessionId(t.sessionId);
    setMessages((m) => [...m, { role: 'assistant', text: t.message.text, cards: t.message.cards }]);
    setSuggestions(t.suggestions || []);
  }, []);
  const fail = useCallback((err: unknown) => {
    const status = (err as ApiError)?.status;
    const msg = status === 401 ? 'Your session expired. Please sign in again.' : status === 429 ? 'You’re sending requests too quickly. Please wait a moment.' : (err as Error)?.message || 'Something went wrong. Please try again.';
    setMessages((m) => [...m, { role: 'assistant', text: msg, error: true }]);
    if (status === 401) onRequireLogin();
  }, [onRequireLogin]);

  const run = useCallback(async (fn: () => Promise<AiTurn>) => {
    setBusy(true);
    try { applyTurn(await fn()); } catch (e) { fail(e); } finally { setBusy(false); }
  }, [applyTurn, fail]);

  const send = useCallback(async (text: string) => {
    const t = text.trim();
    if (!t || busy) return;
  if (
    foodStep === 'idle' &&
    /\b(food|meal|catering|order food|order meal)\b/i.test(t)
  ) {
    setMessages((m) => [
      ...m,
      { role: 'user', text: t },
      {
        role: 'assistant',
        text: 'Please enter the 10-digit PNR for your confirmed ticket. Then I will show the available food menu.',
      },
    ]);
    setInput('');
    setFoodStep('waitingForPnr');
    return;
  }

  if (foodStep === 'waitingForPnr') {
    const digits = t.replace(/\D/g, '');

    setMessages((m) => [...m, { role: 'user', text: t }]);
    setInput('');

    if (digits.length !== 10) {
      setMessages((m) => [
        ...m,
        {
          role: 'assistant',
          text: 'Please enter only a valid 10-digit PNR, for example: 715-1799538',
          error: true,
        },
      ]);
      return;
    }

    const formattedPnr = `${digits.slice(0, 3)}-${digits.slice(3)}`;
    const menuText = CATERING_MENU_ITEMS.map(
      (item, index) =>
        `${index + 1}. ${item.name} — ₹${item.price}`
    ).join('\n');

    setFoodPnr(formattedPnr);
    setFoodStep('waitingForItems');

    setMessages((m) => [
      ...m,
      {
        role: 'assistant',
        text:
          `Food menu for PNR ${formattedPnr}:\n\n` +
          `${menuText}\n\n` +
          `Reply with menu item number(s), for example: 1, 3`,
      },
    ]);
    return;
  }

  if (foodStep === 'waitingForItems') {
    const selectedNumbers = t
      .split(/[\s,]+/)
      .map(Number)
      .filter(
        (number) =>
          Number.isInteger(number) &&
          number >= 1 &&
          number <= CATERING_MENU_ITEMS.length
      );

    setMessages((m) => [...m, { role: 'user', text: t }]);
    setInput('');

    const itemIds = selectedNumbers.map(
      (number) => CATERING_MENU_ITEMS[number - 1].id
    );

    if (itemIds.length === 0) {
      setMessages((m) => [
        ...m,
        {
          role: 'assistant',
          text: `Please reply with valid menu number(s) from 1 to ${CATERING_MENU_ITEMS.length}, for example: 1, 3`,
          error: true,
        },
      ]);
      return;
    }

    setBusy(true);

    try {
      const { order } = await apiPlaceFoodOrder(foodPnr, itemIds);

      setMessages((m) => [
        ...m,
        {
          role: 'assistant',
          text:
            `Food order confirmed!\n\n` +
            `PNR: ${order.pnr}\n` +
            `Delivery station: ${order.delivery_station}\n` +
            `Amount paid: ₹${order.total_amount}\n` +
            `Status: ${order.status}\n\n` +
            `Your order is now visible in My Bookings.`,
        },
      ]);

      setFoodStep('idle');
      setFoodPnr('');
    } catch (error) {
      setMessages((m) => [
        ...m,
        {
          role: 'assistant',
          text:
            error instanceof Error
              ? error.message
              : 'Could not place the food order.',
          error: true,
        },
      ]);
    } finally {
      setBusy(false);
    }

    return;
  }
if (roomStep === 'idle' && /\b(room|retiring room|reserve room|book room)\b/i.test(t)) {
  setMessages((m) => [
    ...m,
    { role: 'user', text: t },
    {
      role: 'assistant',
      text: 'Please enter the 10-digit PNR for your confirmed ticket. I will reserve a Standard AC Retiring Room at your destination station.',
    },
  ]);
  setInput('');
  setRoomStep('waitingForPnr');
  return;
}
if (roomStep === 'waitingForPnr') {
  setMessages((m) => [...m, { role: 'user', text: t }]);
  setInput('');
  setBusy(true);

  try {
    const { room, ticket } = await apiReserveRoom(t);

    setMessages((m) => [
      ...m,
      {
        role: 'assistant',
        text:
          `Room reservation confirmed!\n\n` +
          `PNR: **${room.pnr}**\n` +
          `Station: **${room.station_name}**\n` +
          `Check-in date: **${room.check_in_date}**\n` +
          `Room: **${room.room_type}**\n\n` +
          `It is now available in My Bookings.`,
      },
    ]);

    setRoomStep('idle');
  } catch (error) {
    setMessages((m) => [
      ...m,
      {
        role: 'assistant',
        text: (error as Error).message || 'I could not reserve a room for this PNR.',
        error: true,
      },
    ]);
  } finally {
    setBusy(false);
  }

  return;
}
    setInput('');
    setMessages((m) => [...m, { role: 'user', text: t }]);
    setSuggestions([]);
    run(() => aiSendMessage(t, sessionId));
  }, [busy, foodPnr, foodStep, roomStep, run, sessionId]);

  const act = useCallback((a: AiAction, echo?: string) => {
    if (busy) return;
    if (echo) setMessages((m) => [...m, { role: 'user', text: echo }]);
    setSuggestions([]);
    run(() => aiSendAction(a, sessionId));
  }, [busy, run, sessionId]);

  // Payment: the user's own click on "Pay" is the only thing that moves money. Result is then verified by the server.
  const pay = useCallback(async (bookingId: string, method: 'wallet' | 'upi' | 'card' | 'netbanking') => {
    if (busy) return;
    setBusy(true);
    let outcome: 'success' | 'failed' | 'cancelled' = 'failed';
    try {
      const r = await apiCreatePaymentOrder(bookingId, method);
      if (method === 'wallet') {
        outcome = 'success';
      } else if (r.order && r.razorpayKeyId) {
        const res = await openRazorpayCheckout({ keyId: r.razorpayKeyId, orderId: r.order.id, amount: r.order.amount, currency: r.order.currency, description: 'QuickRail train ticket', prefill: { email: userEmail, contact: userMobile, name: userName }, method });
        await apiVerifyPayment(res);
        outcome = 'success';
      }
    } catch (e) {
      outcome = (e as ApiError)?.status === 499 ? 'cancelled' : 'failed';
    }
    try {
      applyTurn(await aiSendAction({ type: 'PAYMENT_RESULT', outcome }, sessionId));
      if (outcome === 'success') apiGetWallet().then((w) => onWalletChanged(w.balance)).catch(() => {});
    } catch (e) { fail(e); } finally { setBusy(false); }
  }, [busy, applyTurn, fail, sessionId, userEmail, userMobile, userName, onWalletChanged]);

  const reset = async () => {
    if (busy) return;
    setBusy(true);
    try { await aiResetSession(); } catch { /* ignore */ }
    setSessionId(null); setMessages([WELCOME]); setSuggestions(DEFAULT_SUGGESTIONS); setBusy(false);
  };

  const lastAssistant = messages.map((m, i) => (m.role === 'assistant' ? i : -1)).reduce((a, b) => Math.max(a, b), -1);

  return (
    <>
      {!open && (
        <button onClick={() => setOpen(true)} aria-label="Open Disha booking assistant"
          className="fixed z-50 bottom-5 right-5 flex items-center gap-2 pl-3 pr-4 py-3 rounded-full bg-[#001026] text-white shadow-lg hover:bg-[#0b2545] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#ff8928] focus-visible:ring-offset-2">
          <span className="material-symbols-outlined text-[22px] text-[#ff8928]">smart_toy</span>
          <span className="text-sm font-bold">Disha</span>
        </button>
      )}

      {open && (
        <section role="dialog" aria-label="Disha" className="fixed z-50 inset-0 sm:inset-auto sm:bottom-5 sm:right-5 sm:w-[420px] sm:h-[640px] sm:max-h-[calc(100vh-2.5rem)] flex flex-col bg-[#f8f9ff] sm:rounded-2xl sm:border sm:border-[#dce9ff] shadow-2xl overflow-hidden">
          <header className="flex items-center gap-3 px-4 py-3 bg-[#001026] text-white">
            <span className="material-symbols-outlined text-[24px] text-[#ff8928]">smart_toy</span>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-bold leading-tight">Disha</div>
              <div className="text-[11px] text-[#cbdbf5] truncate">Your AI railway booking assistant</div>
            </div>
            {isLoggedIn && <button onClick={reset} disabled={busy} title="Start over" aria-label="Start a new booking" className="p-1.5 rounded-md hover:bg-white/10 disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#ff8928]"><span className="material-symbols-outlined text-[20px]">restart_alt</span></button>}
            <button onClick={() => setOpen(false)} aria-label="Close Disha " className="p-1.5 rounded-md hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#ff8928]"><span className="material-symbols-outlined text-[20px]">close</span></button>
          </header>

          {!isLoggedIn ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center gap-3 p-8">
              <span className="material-symbols-outlined text-[40px] text-[#0b2545]">lock</span>
              <div className="font-bold text-[#001026]">Sign in to book with Disha </div>
              <p className="text-sm text-[#44474e]">Bookings, saved passengers and payments are tied to your QuickRail account.</p>
              <button onClick={() => { setOpen(false); onRequireLogin(); }} className="px-5 py-2 rounded-lg bg-[#001026] text-white text-sm font-semibold hover:bg-[#0b2545]">Sign in</button>
            </div>
          ) : (
            <>
              <div ref={scroller} className="flex-1 overflow-y-auto px-3 py-3 space-y-3" aria-live="polite">
                {messages.map((m, i) => (
                  <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[92%] space-y-2 ${m.role === 'user' ? '' : 'w-full'}`}>
                      {m.text && (
                        <div className={`px-3 py-2 text-sm whitespace-pre-wrap break-words ${m.role === 'user' ? 'bg-[#001026] text-white rounded-2xl rounded-br-sm ml-auto w-fit' : m.error ? 'bg-red-50 border border-red-200 text-red-800 rounded-2xl rounded-bl-sm w-fit' : 'bg-white border border-[#dce9ff] text-[#0b1c30] rounded-2xl rounded-bl-sm w-fit'}`}>
                          {m.text.split(/(\*\*[^*]+\*\*)/g).map((p, k) => (p.startsWith('**') && p.endsWith('**') ? <strong key={k}>{p.slice(2, -2)}</strong> : <React.Fragment key={k}>{p}</React.Fragment>))}
                        </div>
                      )}
                      {m.cards?.map((c, k) => (
                        <CardView key={k} card={c} active={i === lastAssistant && !busy} busy={busy}
                          onAction={(a) => act(a, a.type === 'SELECT_TRAIN' ? `Select train ${a.trainNumber}${a.classCode ? ` in ${a.classCode}` : ''}` : a.type === 'CONFIRM_BOOKING' ? 'Confirm & Pay' : a.type === 'CHANGE_DETAILS' ? 'Change details' : a.type === 'CANCEL_FLOW' ? 'Cancel' : a.type === 'CANCEL_CONFIRM' ? 'Cancel ticket' : a.type === 'KEEP_TICKET' ? 'Keep ticket' : undefined)}
                          onPay={(method) => c.type === 'payment' && pay(c.bookingId, method)}
                          onViewBookings={() => act({ type: 'VIEW_BOOKINGS' }, 'My bookings')}
                          passengerForm={(pc) => <PassengerForm card={pc} active={i === lastAssistant && !busy} busy={busy} onAction={(a) => act(a, 'Passenger details submitted')} />} />
                      ))}
                    </div>
                  </div>
                ))}
                {busy && <TypingIndicator />}
              </div>

              {suggestions.length > 0 && !busy && (
                <div className="px-3 pb-2 flex gap-2 overflow-x-auto" role="group" aria-label="Quick suggestions">
                  {suggestions.map((s) => (
                    <button key={s.label} onClick={() => send(s.text)} className="shrink-0 px-3 py-1.5 rounded-full border border-[#c4c6cf] bg-white text-xs font-semibold text-[#001026] hover:bg-[#eff4ff] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#ff8928]">{s.label}</button>
                  ))}
                </div>
              )}

              <form className="flex items-center gap-2 p-3 border-t border-[#dce9ff] bg-white" onSubmit={(e) => { e.preventDefault(); send(input); }}>
                <input ref={inputRef} value={input} onChange={(e) => setInput(e.target.value)} maxLength={500} placeholder="e.g. Book Mumbai to Pune tomorrow, 2 in 3A" aria-label="Message Disha "
                  className="flex-1 min-w-0 rounded-full border border-[#c4c6cf] bg-[#f8f9ff] px-4 py-2 text-base sm:text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-[#ff8928]" />
                <button type="submit" disabled={busy || !input.trim()} aria-label="Send message" className="w-10 h-10 shrink-0 rounded-full bg-[#001026] text-white flex items-center justify-center hover:bg-[#0b2545] disabled:opacity-40 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#ff8928]">
                  <span className="material-symbols-outlined text-[20px]">send</span>
                </button>
              </form>
            </>
          )}
        </section>
      )}
    </>
  );
};
