import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ApiError, apiCreatePaymentOrder, apiVerifyPayment, openRazorpayCheckout, apiGetWallet } from '../../services/api';
import { aiGetSession, aiResetSession, aiSendAction, aiSendMessage, type AiAction, type AiMessage, type AiTurn, type Suggestion } from '../../services/aiApi';
import { CardView } from './Cards';
import { PassengerForm } from './PassengerForm';
import { GuideFlowchart } from './GuideFlowchart';
import { apiReserveRoom, apiGetRoomReservations } from '../../services/api';
import { CATERING_MENU_ITEMS } from '../../data/mockData';
import { apiPlaceFoodOrder } from '../../services/api';

interface Props {
isOpen?: boolean;
onOpenChange?: (open: boolean) => void;
  language?: 'ENG' | 'हिन्दी';
  isLoggedIn: boolean;
  userName: string;
  userEmail: string;
  userMobile: string;
  onRequireLogin: () => void;
  onWalletChanged: (balance: number) => void;
  onOpenWallet: (amount?: number) => void;
}

const HINDI_SUGGESTIONS: Suggestion[] = [
  { label: '🧭 मार्गदर्शन', text: 'मुझे QuickRail का उपयोग करना सिखाएँ' },
  { label: '🎫 टिकट बुक करें', text: 'टिकट बुक करें' },
  { label: '🔎 ट्रेन खोजें', text: 'ट्रेन खोजें' },
  { label: '📋 पीएनआर और स्थिति', text: 'पीएनआर स्थिति दिखाएँ' },
  { label: '🍽️ अन्य सुविधाएँ', text: 'क्विकबिड और रेलवॉलेट के बारे में बताएँ' },
  { label: '🚆 बुकिंग शुरू करें', text: 'टिकट बुक करें' },
];
const WELCOME_HI: AiMessage = { role: 'assistant', text: 'नमस्ते! मैं दिशा हूँ, आपकी QuickRail सहायक। मैं टिकट बुकिंग, ट्रेन खोज, पीएनआर पूछताछ, ट्रेन की स्थिति, पर्यटक ट्रेनें, क्विकबिड, रेलवॉलेट, भोजन, रिटायरिंग रूम, भुगतान, रद्दीकरण और खाते की सुविधाओं में मदद कर सकती हूँ। पूछें “QuickRail का उपयोग कैसे करें?” या बताएं कि आप क्या करना चाहते हैं।' };

const normalizeHindiCommand = (value: string): string => {
  const text = value.trim().toLocaleLowerCase('hi-IN');
  if (/quickrail.*(उपयोग|कैसे)|मार्गदर्शन|मदद/.test(text)) return 'How do I use QuickRail?';
  if (/टिकट.*बुक|बुक.*टिकट/.test(text)) return 'Book a ticket';
  if (/ट्रेन.*खोज|ट्रेन.*ढूँढ|ट्रेन.*ढूंढ/.test(text)) return 'Find trains';
  if (/पीएनआर|चलती ट्रेन|ट्रेन की स्थिति/.test(text)) return 'How do I check PNR and running status?';
  if (/क्विकबिड|रेलवॉलेट|भोजन|रिटायरिंग रूम/.test(text)) return 'Guide me through QuickBid, RailWallet, meals and retiring rooms';
  if (/मेरी बुकिंग|बुकिंग दिखा/.test(text)) return 'Show my bookings';
  if (/रद्द|कैंसल/.test(text)) return 'cancel';
  return value;
};

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
onOpenWallet,
  isOpen,
  onOpenChange,
  language = 'ENG',
}) => {
 const [internalOpen, setInternalOpen] = useState(false);
const [panelPosition, setPanelPosition] = useState<{ x: number; y: number } | null>(null);
const [isDraggingPanel, setIsDraggingPanel] = useState(false);
const dragOffset = useRef({ x: 0, y: 0 });
const [launcherPosition, setLauncherPosition] = useState<{ x: number; y: number } | null>(null);
const [isDraggingLauncher, setIsDraggingLauncher] = useState(false);
const launcherDragOffset = useRef({ x: 0, y: 0 });
const launcherMoved = useRef(false);
const open = isOpen ?? internalOpen;

useEffect(() => {
  if (!isDraggingPanel) return;
  const onPointerMove = (event: PointerEvent) => {
    const panel = document.querySelector<HTMLElement>('[data-disha-panel="true"]');
    const width = panel?.offsetWidth ?? 560;
    const height = panel?.offsetHeight ?? 780;
    const x = Math.max(8, Math.min(window.innerWidth - width - 8, event.clientX - dragOffset.current.x));
    const y = Math.max(8, Math.min(window.innerHeight - height - 8, event.clientY - dragOffset.current.y));
    setPanelPosition({ x, y });
  };
  const onPointerUp = () => setIsDraggingPanel(false);
  window.addEventListener('pointermove', onPointerMove);
  window.addEventListener('pointerup', onPointerUp);
  window.addEventListener('pointercancel', onPointerUp);
  return () => {
    window.removeEventListener('pointermove', onPointerMove);
    window.removeEventListener('pointerup', onPointerUp);
    window.removeEventListener('pointercancel', onPointerUp);
  };
}, [isDraggingPanel]);

const startPanelDrag = (event: React.PointerEvent<HTMLElement>) => {
  if ((event.target as HTMLElement).closest('button')) return;
  const panel = event.currentTarget.closest<HTMLElement>('[data-disha-panel="true"]');
  if (!panel) return;
  const rect = panel.getBoundingClientRect();
  dragOffset.current = { x: event.clientX - rect.left, y: event.clientY - rect.top };
  setPanelPosition({ x: rect.left, y: rect.top });
  setIsDraggingPanel(true);
};

useEffect(() => {
  if (!isDraggingLauncher) return;
  const onPointerMove = (event: PointerEvent) => {
    const launcher = document.querySelector<HTMLElement>('[data-disha-launcher="true"]');
    const width = launcher?.offsetWidth ?? 110;
    const height = launcher?.offsetHeight ?? 52;
    const x = Math.max(8, Math.min(window.innerWidth - width - 8, event.clientX - launcherDragOffset.current.x));
    const y = Math.max(8, Math.min(window.innerHeight - height - 8, event.clientY - launcherDragOffset.current.y));
    launcherMoved.current = true;
    setLauncherPosition({ x, y });
  };
  const onPointerUp = () => setIsDraggingLauncher(false);
  window.addEventListener('pointermove', onPointerMove);
  window.addEventListener('pointerup', onPointerUp);
  window.addEventListener('pointercancel', onPointerUp);
  return () => {
    window.removeEventListener('pointermove', onPointerMove);
    window.removeEventListener('pointerup', onPointerUp);
    window.removeEventListener('pointercancel', onPointerUp);
  };
}, [isDraggingLauncher]);

const startLauncherDrag = (event: React.PointerEvent<HTMLButtonElement>) => {
  const rect = event.currentTarget.getBoundingClientRect();
  launcherMoved.current = false;
  launcherDragOffset.current = { x: event.clientX - rect.left, y: event.clientY - rect.top };
  setLauncherPosition({ x: rect.left, y: rect.top });
  setIsDraggingLauncher(true);
};

const setOpen = (next: boolean) => {
  setInternalOpen(next);
  onOpenChange?.(next);
};
  const [messages, setMessages] = useState<AiMessage[]>([language === 'हिन्दी' ? WELCOME_HI : WELCOME]);
  const [suggestions, setSuggestions] = useState<Suggestion[]>(language === 'हिन्दी' ? HINDI_SUGGESTIONS : DEFAULT_SUGGESTIONS);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [input, setInput] = useState('');
const [roomStep, setRoomStep] = useState<'idle' | 'waitingForPnr'>('idle');
const [foodStep, setFoodStep] = useState<
  'idle' | 'waitingForPnr' | 'waitingForItems'
>('idle');
const [foodPnr, setFoodPnr] = useState('');
const [walletStep, setWalletStep] = useState<
  'idle' | 'waitingForAmount' | 'waitingForConfirmation'
>('idle');
const [walletAmount, setWalletAmount] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const scroller = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (messages.length <= 1) {
      setMessages([language === 'हिन्दी' ? WELCOME_HI : WELCOME]);
      setSuggestions(language === 'हिन्दी' ? HINDI_SUGGESTIONS : DEFAULT_SUGGESTIONS);
    }
  // Preserve any active conversation when the language changes.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [language]);

  // Restore the in-progress booking after a page refresh (state lives on the server).
  useEffect(() => {
    if (!open || !isLoggedIn || loaded) return;
    setLoaded(true);
    aiGetSession().then((v) => {
      if (!v.sessionId) return;
      setSessionId(v.sessionId);
      const hist: AiMessage[] = v.messages.map((m) => ({ role: m.role, text: m.text }));
      const cur = v.current && (v.current.text || v.current.cards.length) ? [{ role: 'assistant' as const, text: v.current.text, cards: v.current.cards }] : [];
      setMessages([language === 'हिन्दी' ? WELCOME_HI : WELCOME, ...hist.slice(-12), ...cur]);
      setSuggestions(v.suggestions?.length ? v.suggestions : []);
    }).catch(() => { /* fall back to a fresh chat */ });
  }, [open, isLoggedIn, loaded]);

  // New login / logout → drop the previous user's conversation from memory.
  useEffect(() => { setLoaded(false); setSessionId(null); setMessages([language === 'हिन्दी' ? WELCOME_HI : WELCOME]); setSuggestions(language === 'हिन्दी' ? HINDI_SUGGESTIONS : DEFAULT_SUGGESTIONS); }, [isLoggedIn, userEmail]);

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
  const getWalletAmount = (value: string) => {
    const match = value.match(/(?:₹|rs\.?|inr)?\s*(\d+(?:\.\d{1,2})?)/i);
    const amount = Number(match?.[1]);
    return Number.isFinite(amount) && amount >= 100 && amount <= 50000
      ? amount
      : null;
  };

  const isWalletRequest =
    /\b(top\s*up|topup|add money|recharge)\b.*\b(wallet|railwallet)\b/i.test(t) ||
    /\b(wallet|railwallet)\b.*\b(top\s*up|topup|add money|recharge)\b/i.test(t);

  if (walletStep === 'idle' && isWalletRequest) {
    const amount = getWalletAmount(t);

    setMessages((m) => [...m, { role: 'user', text: t }]);
    setInput('');

    if (!amount) {
      setMessages((m) => [
        ...m,
        {
          role: 'assistant',
          text: 'How much would you like to add to your RailWallet? Enter an amount from ₹100 to ₹50,000.',
        },
      ]);
      setWalletStep('waitingForAmount');
      return;
    }

    setWalletAmount(amount);
    setWalletStep('waitingForConfirmation');
    setMessages((m) => [
      ...m,
      {
        role: 'assistant',
        text: `You want to top up your RailWallet by ₹${amount.toFixed(2)}. Reply Yes to open secure payment, or No to cancel.`,
      },
    ]);
    return;
  }

  if (walletStep === 'waitingForAmount') {
    const amount = getWalletAmount(t);

    setMessages((m) => [...m, { role: 'user', text: t }]);
    setInput('');

    if (!amount) {
      setMessages((m) => [
        ...m,
        {
          role: 'assistant',
          text: 'Please enter a valid amount between ₹100 and ₹50,000.',
          error: true,
        },
      ]);
      return;
    }

    setWalletAmount(amount);
    setWalletStep('waitingForConfirmation');
    setMessages((m) => [
      ...m,
      {
        role: 'assistant',
        text: `Confirm top-up of ₹${amount.toFixed(2)}? Reply Yes to continue or No to cancel.`,
      },
    ]);
    return;
  }

  if (walletStep === 'waitingForConfirmation') {
    setMessages((m) => [...m, { role: 'user', text: t }]);
    setInput('');

    if (/^(yes|y|confirm|okay|ok|proceed)$/i.test(t) && walletAmount) {
      onOpenWallet(walletAmount);
      setMessages((m) => [
        ...m,
        {
          role: 'assistant',
          text: `Opening secure payment for ₹${walletAmount.toFixed(2)}. Complete the Razorpay payment to add money to your RailWallet.`,
        },
      ]);
      setWalletAmount(null);
      setWalletStep('idle');
      return;
    }

    setWalletAmount(null);
    setWalletStep('idle');
    setMessages((m) => [
      ...m,
      { role: 'assistant', text: 'RailWallet top-up cancelled.' },
    ]);
    return;
  }
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
    const backendMessage = language === 'हिन्दी' ? normalizeHindiCommand(t) : t;
    run(() => aiSendMessage(backendMessage, sessionId));
  }, [busy, foodPnr, foodStep, roomStep, run, sessionId, walletAmount, walletStep, onOpenWallet, language]);

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
    setSessionId(null); setMessages([language === 'हिन्दी' ? WELCOME_HI : WELCOME]); setSuggestions(language === 'हिन्दी' ? HINDI_SUGGESTIONS : DEFAULT_SUGGESTIONS); setBusy(false);
  };

  const lastAssistant = messages.map((m, i) => (m.role === 'assistant' ? i : -1)).reduce((a, b) => Math.max(a, b), -1);

  return (
    <>
      {!open && (
        <button
          data-disha-launcher="true"
          onPointerDown={(event) => {
            if (event.button !== 0) return;
            const target = event.currentTarget;
            const rect = target.getBoundingClientRect();
            dragOffset.current = { x: event.clientX - rect.left, y: event.clientY - rect.top };
            const startX = event.clientX;
            const startY = event.clientY;
            let moved = false;
            const onMove = (moveEvent: PointerEvent) => {
              if (!moved && Math.hypot(moveEvent.clientX - startX, moveEvent.clientY - startY) < 5) return;
              moved = true;
              setPanelPosition({
                x: Math.max(8, Math.min(window.innerWidth - rect.width - 8, moveEvent.clientX - dragOffset.current.x)),
                y: Math.max(8, Math.min(window.innerHeight - rect.height - 8, moveEvent.clientY - dragOffset.current.y)),
              });
            };
            const onUp = () => {
              window.removeEventListener('pointermove', onMove);
              window.removeEventListener('pointerup', onUp);
              window.removeEventListener('pointercancel', onUp);
              if (moved) {
                target.dataset.dragged = 'true';
                window.setTimeout(() => { delete target.dataset.dragged; }, 100);
              }
            };
            window.addEventListener('pointermove', onMove);
            window.addEventListener('pointerup', onUp);
            window.addEventListener('pointercancel', onUp);
          }}
          onClick={(event) => {
            if (event.currentTarget.dataset.dragged === 'true') {
              event.preventDefault();
              event.stopPropagation();
              return;
            }
            setOpen(true);
          }}
          aria-label={language === "हिन्दी" ? "दिशा सहायक खोलें। खिसकाने के लिए खींचें।" : "Open Disha booking assistant. Drag to move."}
          title={language === "हिन्दी" ? "दिशा खोलने के लिए क्लिक करें · खिसकाने के लिए खींचें" : "Click to open Disha · Drag to move"}
          className={`fixed z-50 w-[260px] max-w-[calc(100vw-16px)] justify-between flex items-center gap-4 px-7 py-4 rounded-full bg-[#001026] text-white shadow-xl border border-[#24466b] hover:bg-[#0b2545] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#ff8928] focus-visible:ring-offset-2 cursor-grab active:cursor-grabbing touch-none select-none ${panelPosition ? '' : 'bottom-6 right-6'}`}
          style={panelPosition ? { left: panelPosition.x, top: panelPosition.y, right: 'auto', bottom: 'auto' } : undefined}
        >
          <span className="material-symbols-outlined text-[32px] text-[#ff8928]">smart_toy</span>
          <span className="text-lg font-bold">Disha</span>
          <span className="material-symbols-outlined text-base text-white/60" aria-hidden="true">open_with</span>
        </button>
      )}

      {open && (
        <section data-disha-panel="true" role="dialog" aria-label="Disha" style={panelPosition ? { left: panelPosition.x, top: panelPosition.y, right: 'auto', bottom: 'auto' } : undefined} className={`fixed z-50 flex flex-col bg-[#f8f9ff] shadow-2xl overflow-hidden inset-0 md:inset-auto md:w-[60vw] md:h-[60vh] md:max-w-[960px] md:max-h-[calc(100vh-2.5rem)] md:rounded-2xl md:border md:border-[#dce9ff] ${panelPosition ? '' : 'md:bottom-5 md:right-5'}`}>
          <header onPointerDown={startPanelDrag} className={`flex items-center gap-3 px-4 py-3 bg-[#001026] text-white select-none touch-none ${isDraggingPanel ? 'cursor-grabbing' : 'cursor-grab'}`} title="Drag to move Disha">
            <span className="material-symbols-outlined text-[24px] text-[#ff8928]">smart_toy</span>
            <div className="min-w-0 flex-1">
              <div className="text-base font-bold leading-tight">Disha</div>
              <div className="text-xs text-[#cbdbf5] truncate">आपकी AI रेलवे बुकिंग सहायक · खिसकाने के लिए हेडर खींचें</div>
            </div>
            <span className="material-symbols-outlined hidden sm:inline text-white/60" aria-hidden="true">open_with</span>
            {isLoggedIn && <button onClick={reset} disabled={busy} title="Start over" aria-label="Start a new booking" className="p-1.5 rounded-md hover:bg-white/10 disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#ff8928]"><span className="material-symbols-outlined text-[20px]">restart_alt</span></button>}
            <button onClick={() => setOpen(false)} aria-label="Close Disha " className="p-1.5 rounded-md hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#ff8928]"><span className="material-symbols-outlined text-[20px]">close</span></button>
          </header>

          {!isLoggedIn ? (
            <div className="flex-1 flex flex-col items-center justify-center text-center gap-3 p-8">
              <span className="material-symbols-outlined text-[40px] text-[#0b2545]">lock</span>
              <div className="font-bold text-[#001026]">Sign in to book with Disha </div>
              <p className="text-sm text-[#44474e]">Bookings, saved passengers and payments are tied to your QuickRail account.</p>
              <button onClick={() => { setOpen(false); onRequireLogin(); }} className="px-5 py-2 rounded-lg bg-[#001026] text-white text-sm font-semibold hover:bg-[#0b2545]">साइन इन करें</button>
            </div>
          ) : (
            <>
              <div ref={scroller} className="flex-1 overflow-y-auto px-3 py-3 space-y-3" aria-live="polite">
                {messages.map((m, i) => (
                  <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[92%] space-y-2 ${m.role === 'user' ? '' : 'w-full'}`}>
                      {m.text && (
                        m.role === 'assistant' && !m.error && (m.text.includes('QUICKRAIL — TICKET BOOKING FLOW') || m.text.includes('QUICKRAIL — FEATURE GUIDE')) ? (
                          <GuideFlowchart text={m.text} onAction={(message) => send(message)} />
                        ) : (
                          <div className={`px-3 py-2 text-sm whitespace-pre-wrap break-words ${m.role === 'user' ? 'bg-[#001026] text-white rounded-2xl rounded-br-sm ml-auto w-fit' : m.error ? 'bg-red-50 border border-red-200 text-red-800 rounded-2xl rounded-bl-sm w-fit' : 'bg-white border border-[#dce9ff] text-[#0b1c30] rounded-2xl rounded-bl-sm w-fit'}`}>
                            {m.text.split(/(\*\*[^*]+\*\*)/g).map((p, k) => (p.startsWith('**') && p.endsWith('**') ? <strong key={k}>{p.slice(2, -2)}</strong> : <React.Fragment key={k}>{p}</React.Fragment>))}
                          </div>
                        )
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
                <input ref={inputRef} value={input} onChange={(e) => setInput(e.target.value)} maxLength={500} placeholder={language === "हिन्दी" ? "QuickRail की किसी भी सुविधा के बारे में दिशा से पूछें..." : "Ask Disha how to use any QuickRail feature..."} aria-label={language === "हिन्दी" ? "दिशा को संदेश भेजें" : "Message Disha "}
                  className="flex-1 min-w-0 rounded-full border border-[#c4c6cf] bg-[#f8f9ff] px-4 py-2 text-base sm:text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-[#ff8928]" />
                <button type="submit" disabled={busy || !input.trim()} aria-label={language === "हिन्दी" ? "संदेश भेजें" : "Send message"} className="w-10 h-10 shrink-0 rounded-full bg-[#001026] text-white flex items-center justify-center hover:bg-[#0b2545] disabled:opacity-40 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#ff8928]">
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
