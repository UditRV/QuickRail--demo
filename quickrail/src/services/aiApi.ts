// QuickRail AI client. Talks only to /api/ai/* (JWT from the normal QuickRail login).
// Cards are plain JSON rendered by the chat UI; the server rebuilds them from state, so nothing sensitive is cached here.
import { request } from './api';

export interface Suggestion { label: string; text: string }

export interface TrainClassView { classCode: string; name: string; fare: number; availableCount: number; availability: 'AVAILABLE' | 'PARTIAL' | 'RAC' | 'WL'; statusLabel?: string }
export interface TrainView {
  trainNumber: string; trainName: string; badge?: string; fromName: string; toName: string;
  departure: string; arrival: string; duration: string; arrivalDayOffset: number; classes: TrainClassView[];
}
export interface SavedPassenger { id: string; name: string; age: number; gender: 'Male' | 'Female' | 'Transgender'; berthPreference?: string | null; isSelf?: boolean }

export type Card =
  | { type: 'trains'; from: string; to: string; dateLong: string; dateLabel?: string; classCode: string | null; passengers: number; trains: TrainView[] }
  | { type: 'routeChoice'; question?: string; options: Array<{ from: { code: string; name: string }; to: { code: string; name: string } }> }
  | { type: 'classChoice'; trainNumber: string; trainName: string; classes: TrainClassView[] }
  | { type: 'passengerForm'; count: number; maxCount: number; saved: SavedPassenger[]; preselected: string[]; current: Array<{ name: string; age: number; gender: string; berthPreference?: string }>; defaultBerth: string; userName?: string }
  | { type: 'summary'; token: string; expiresAt?: string; train: { number: string; name: string; departure: string; arrival: string; duration: string; arrivalDayOffset: number }; from: string; to: string; dateLong: string; classCode: string; className: string; quota: string; passengers: Array<{ name: string; age: number; gender: string; berthPreference?: string }>; fare: { baseAmount: number; convenienceFee: number; gstAmount: number; totalAmount: number }; availability: string; warning: string | null }
  | { type: 'payment'; bookingId: string; total: number; expiresAt: string; walletBalance: number; trainLabel: string; dateLong: string; methods: Array<'wallet' | 'upi' | 'card' | 'netbanking'> }
  | { type: 'confirmation'; heading: string; status: string; confirmed: boolean; pnr: string; bookingRef: string; bookingId: string; train: { number: string; name: string; departure: string; arrival: string; duration: string }; from: string; to: string; fromCode: string; toCode: string; dateLong: string; classCode: string; totalAmount: number; paymentMethod: string | null; passengers: Array<{ name: string; status: string; seat: string | null }> }
  | { type: 'bookings'; title: string; bookings: Array<{ id: string; pnr: string; status: string; trainNumber: string; trainName: string; from: string; to: string; dateLong: string; classCode: string; passengers: number; amount: number; departure: string; cancellable: boolean }> }
  | { type: 'cancelConfirm'; token: string; pnr: string; bookingId: string; status: string; train: string; from: string; to: string; dateLong: string; classCode: string; passengers: number; amount: number; refund: number };

export interface AiMessage { role: 'user' | 'assistant'; text: string; cards?: Card[]; error?: boolean }
export interface AiTurn { sessionId: string; stage: string; message: { role: 'assistant'; text: string; cards: Card[] }; suggestions: Suggestion[] }
export interface AiSessionView { sessionId: string | null; stage: string; messages: Array<{ role: 'user' | 'assistant'; text: string }>; current: { text: string; cards: Card[] } | null; suggestions: Suggestion[] }

export type AiAction =
  | { type: 'SELECT_TRAIN'; trainNumber: string; classCode?: string }
  | { type: 'CHOOSE_ROUTE'; from: string; to: string }
  | { type: 'SUBMIT_PASSENGERS'; passengers: Array<{ savedId?: string; name?: string; age?: number; gender?: string; berthPreference?: string; save?: boolean }> }
  | { type: 'CONFIRM_BOOKING'; token: string }
  | { type: 'CHANGE_DETAILS' } | { type: 'CANCEL_FLOW' } | { type: 'KEEP_TICKET' } | { type: 'VIEW_BOOKINGS' }
  | { type: 'CANCEL_SELECT'; bookingId: string } | { type: 'CANCEL_CONFIRM'; token: string }
  | { type: 'PAYMENT_RESULT'; outcome: 'success' | 'failed' | 'cancelled' };

export const aiSendMessage = (message: string, sessionId?: string | null) =>
  request<AiTurn>('/api/ai/chat', { method: 'POST', body: JSON.stringify({ sessionId: sessionId || undefined, message }) });
export const aiSendAction = (action: AiAction, sessionId?: string | null) =>
  request<AiTurn>('/api/ai/chat', { method: 'POST', body: JSON.stringify({ sessionId: sessionId || undefined, action }) });
export const aiGetSession = () => request<AiSessionView>('/api/ai/session');
export const aiResetSession = () => request<{ ok: true }>('/api/ai/session/reset', { method: 'POST' });
