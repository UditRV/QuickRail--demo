// API client for the QuickRail backend (Express + Postgres).
// Base URL comes from VITE_API_URL (see .env.local), defaults to localhost:4000 for dev.

const API_BASE = (import.meta as any).env?.VITE_API_URL || 'http://localhost:4000';

const TOKEN_KEY = 'quickrail_token';

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string | null) {
  if (token) localStorage.setItem(TOKEN_KEY, token);
  else localStorage.removeItem(TOKEN_KEY);
}

class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> | undefined),
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  const isJson = res.headers.get('content-type')?.includes('application/json');
  const body = isJson ? await res.json() : null;

  if (!res.ok) {
    throw new ApiError(body?.error || `Request failed (${res.status})`, res.status);
  }
  return body as T;
}

// ---------- Auth ----------

export interface BackendUser {
  id: string;
  name: string;
  email: string;
  mobile: string;
  irctcUsername: string;
  isAadhaarVerified: boolean;
  city?: string;
  state?: string;
  pincode?: string;
  occupation?: string;
  walletBalance: number;
}

export function apiRegister(input: {
  name: string;
  email: string;
  mobile: string;
  password: string;
  irctcUsername: string;
}) {
  return request<{ token: string; user: BackendUser }>('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function apiLogin(identifier: string, password: string) {
  return request<{ token: string; user: BackendUser }>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ identifier, password }),
  });
}

export function apiMe() {
  return request<{ user: BackendUser }>('/api/auth/me');
}

// ---------- Trains ----------

export function apiSearchTrains(from: string, to: string, date: string) {
  const params = new URLSearchParams({ from, to, date });
  return request<{ trains: any[]; journeyDate: string }>(`/api/trains/search?${params}`);
}

export interface StationOption {
  code: string;
  name: string;
  city: string;
  state: string;
}

export function apiGetStations() {
  return request<{ stations: StationOption[] }>('/api/stations');
}

export function apiGetDestinationStations(fromCode: string) {
  return request<{ stations: StationOption[] }>(`/api/stations/destinations/${encodeURIComponent(fromCode)}`);
}

// ---------- Bookings ----------

export interface CreateBookingInput {
  trainNumber: string;
  classCode: string;
  journeyDate: string;
  fromStationCode: string;
  toStationCode: string;
  quota: string;
  contactMobile: string;
  contactEmail: string;
  preferredCoach?: string;
  autoUpgradation?: boolean;
  bookOnlyIfConfirm?: boolean;
  quickRailAssured?: boolean;
  travelInsurance?: boolean;
  passengers: Array<{
    name: string;
    age: number;
    gender: 'Male' | 'Female' | 'Transgender';
    berthPreference?: string;
    mealOption?: string;
    isSeniorCitizenQuota?: boolean;
    isChildWithoutBerth?: boolean;
  }>;
}

export function apiCreateBooking(input: CreateBookingInput) {
  return request<{ booking: any }>('/api/bookings', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

export function apiGetBooking(id: string) {
  return request<{ booking: any }>(`/api/bookings/${id}`);
}

export function apiCancelBooking(id: string) {
  return request<{ booking: any }>(`/api/bookings/${id}/cancel`, { method: 'POST' });
}

export function apiGetMyBookings() {
  return request<{ bookings: any[] }>('/api/bookings/mine');
}

export function apiReserveRoom(pnr: string) {
  return request<{ room: any; ticket: any }>('/api/rooms/reservations', {
    method: 'POST',
    body: JSON.stringify({ pnr }),
  });
}

export function apiGetRoomReservations() {
  return request<{ rooms: any[] }>('/api/rooms/mine');
}

// ---------- Payments ----------

export function apiCreatePaymentOrder(bookingId: string, method: 'upi' | 'card' | 'netbanking' | 'wallet') {
  return request<{
    method: string;
    razorpayKeyId?: string;
    order?: { id: string; amount: number; currency: string };
    booking: any;
    payment?: any;
    prefill?: { email: string; contact: string };
  }>('/api/payments/create-order', {
    method: 'POST',
    body: JSON.stringify({ bookingId, method }),
  });
}

export function apiVerifyPayment(input: {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}) {
  return request<{ booking: any }>('/api/payments/verify', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

// ---------- Wallet ----------

export function apiGetWallet() {
  return request<{ balance: number; transactions: any[] }>('/api/wallet');
}

export function apiCreateWalletTopupOrder(amount: number) {
  return request<{ razorpayKeyId: string; order: { id: string; amount: number; currency: string } }>(
    '/api/wallet/topup/create-order',
    { method: 'POST', body: JSON.stringify({ amount }) }
  );
}

export function apiVerifyWalletTopup(input: {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
  amount: number;
}) {
  return request<{ balance: number }>('/api/wallet/topup/verify', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}

// ---------- PNR ----------

export function apiPnrEnquiry(pnr: string) {
  return request<any>(`/api/pnr/${encodeURIComponent(pnr)}`);
}

// ---------- Razorpay Checkout loader ----------
// Loads the Razorpay Checkout.js SDK once and opens the payment widget.
// Docs: https://razorpay.com/docs/payments/payment-gateway/web-integration/standard/

let razorpayScriptPromise: Promise<void> | null = null;

function loadRazorpayScript(): Promise<void> {
  if ((window as any).Razorpay) return Promise.resolve();
  if (razorpayScriptPromise) return razorpayScriptPromise;

  razorpayScriptPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load Razorpay Checkout script'));
    document.body.appendChild(script);
  });
  return razorpayScriptPromise;
}

export interface RazorpayResult {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}

export async function openRazorpayCheckout(opts: {
  keyId: string;
  orderId: string;
  amount: number;
  currency: string;
  name?: string;
  description?: string;
  prefill?: { email?: string; contact?: string; name?: string };
  method?: 'upi' | 'card' | 'netbanking' | 'wallet';
}): Promise<RazorpayResult> {
  await loadRazorpayScript();

  return new Promise((resolve, reject) => {
    const rzp = new (window as any).Razorpay({
      key: opts.keyId,
      amount: opts.amount,
      currency: opts.currency,
      name: opts.name || 'QuickRail',
      description: opts.description || 'Train ticket booking',
      order_id: opts.orderId,
      prefill: opts.prefill,
      theme: { color: '#0b5fff' },
      handler: (response: RazorpayResult) => resolve(response),
      modal: {
        ondismiss: () => reject(new ApiError('Payment cancelled by user', 499)),
      },
    });
    rzp.on('payment.failed', (response: any) => {
      reject(new ApiError(response?.error?.description || 'Payment failed', 402));
    });
    rzp.open();
  });
}

export { ApiError };
export function apiPlaceFoodOrder(pnr: string, itemIds: string[]) {
  return request<{ order: any }>('/api/catering/orders', {
    method: 'POST',
    body: JSON.stringify({ pnr, itemIds }),
  });
}

export function apiGetFoodOrders() {
  return request<{ orders: any[] }>('/api/catering/mine');
}
