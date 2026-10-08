// Pure view builders: state/data → JSON "cards" the chat UI renders. Cards are re-derived from state,
// never persisted, so passenger data doesn't accumulate in transcripts.
import { formatLongDate, formatShortDate } from './dateTime.js';

export const inr = (n) => `₹${Number(n).toLocaleString('en-IN', { maximumFractionDigits: 2 })}`;
export const bookingRef = (id) => `QR-${String(id).replace(/-/g, '').slice(0, 8).toUpperCase()}`;

export function trainsCard({ views, source, destination, date, dateLabel, classCode, passengers }) {
  return { type: 'trains', from: source.name, to: destination.name, date, dateLong: formatLongDate(date), dateLabel, classCode, passengers, trains: views };
}

export function routeChoiceCard(options, question) {
  return { type: 'routeChoice', question, options };
}
export function classChoiceCard(view) {
  return { type: 'classChoice', trainNumber: view.trainNumber, trainName: view.trainName, classes: view.classes };
}

export function passengerFormCard({ count, saved, preselected, current, defaultBerth, userName }) {
  return { type: 'passengerForm', count, maxCount: 6, saved, preselected, current, defaultBerth: defaultBerth || 'No Preference', userName };
}

export function summaryCard({ token, expiresAt, view, cls, from, to, date, passengers, fare, status, quota }) {
  const warn = status === 'WL' ? 'This class is currently on the waiting list. A waitlisted ticket may not get a confirmed seat.'
    : status === 'RAC' ? 'Only RAC (shared berth) is available. You may not get a full berth.'
    : status === 'PARTIAL' ? 'Not enough confirmed seats for everyone — some passengers may be RAC/waitlisted.' : null;
  return {
    type: 'summary', token, expiresAt,
    train: { number: view.trainNumber, name: view.trainName, departure: view.departure, arrival: view.arrival, duration: view.duration, arrivalDayOffset: view.arrivalDayOffset },
    from, to, date, dateLong: formatLongDate(date), dateShort: formatShortDate(date),
    classCode: cls.classCode, className: cls.name, quota,
    passengers: passengers.map((p) => ({ name: p.name, age: p.age, gender: p.gender, berthPreference: p.berthPreference })),
    fare, availability: status, warning: warn,
  };
}

export function paymentCard({ bookingId, total, expiresAt, walletBalance, trainLabel, dateLong }) {
  return { type: 'payment', bookingId, total, expiresAt, walletBalance, trainLabel, dateLong, methods: ['wallet', 'upi', 'card', 'netbanking'] };
}

export function confirmationCard(b) {
  const heading = b.status === 'CONFIRMED' ? 'Ticket Confirmed' : b.status === 'RAC' ? 'Ticket Booked — RAC' : 'Booked on Waiting List';
  return {
    type: 'confirmation', heading, status: b.status, confirmed: b.status === 'CONFIRMED',
    pnr: b.pnr, bookingRef: bookingRef(b.id), bookingId: b.id,
    train: { number: b.trainNumber, name: b.trainName, departure: b.departureTime, arrival: b.arrivalTime, duration: b.duration, badge: b.badge },
    fromCode: b.fromStationCode, toCode: b.toStationCode, from: b.fromName, to: b.toName,
    date: b.journeyDate, dateLong: formatLongDate(b.journeyDate), classCode: b.classCode, quota: b.quota,
    totalAmount: b.totalAmount, paymentMethod: b.payments?.find((p) => p.status === 'PAID')?.method || null,
    passengers: b.passengers.map((p) => ({ name: p.name, status: p.allottedStatus, seat: p.allottedSeat })),
  };
}

export function bookingsCard(bookings, names, title = 'Your bookings') {
  return {
    type: 'bookings', title,
    bookings: bookings.map((b) => ({
      id: b.id, pnr: b.pnr, status: b.status, trainNumber: b.trainNumber, trainName: b.trainName,
      from: names[b.fromCode] || b.fromCode, to: names[b.toCode] || b.toCode, date: b.journeyDate, dateLong: formatLongDate(b.journeyDate),
      classCode: b.classCode, passengers: b.passengerCount, amount: b.totalAmount, departure: b.departure,
      cancellable: ['CONFIRMED', 'RAC', 'WAITLIST'].includes(b.status) && b.journeyDate >= new Date().toISOString().slice(0, 10),
    })),
  };
}

export function cancelConfirmCard({ token, booking, names, refund }) {
  return {
    type: 'cancelConfirm', token, pnr: booking.pnr, bookingId: booking.id, status: booking.status,
    train: `${booking.trainNumber} ${booking.trainName}`, from: names[booking.fromCode] || booking.fromCode, to: names[booking.toCode] || booking.toCode,
    dateLong: formatLongDate(booking.journeyDate), classCode: booking.classCode, passengers: booking.passengerCount,
    amount: booking.totalAmount, refund,
  };
}
