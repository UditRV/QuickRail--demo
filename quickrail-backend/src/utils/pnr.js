export function generatePnr() {
  // IRCTC-style 10-digit PNR, formatted as XXX-XXXXXXX for display
  const digits = Math.floor(1000000000 + Math.random() * 9000000000).toString();
  return `${digits.slice(0, 3)}-${digits.slice(3)}`;
}

export function computeFare({ basePrice, passengerCount }) {
  const CONVENIENCE_FEE_FLAT = Number(process.env.CONVENIENCE_FEE_FLAT || 17.7);
  const GST_RATE_PERCENT = Number(process.env.GST_RATE_PERCENT || 18);

  const baseAmount = round2(basePrice * passengerCount);
  const convenienceFee = round2(CONVENIENCE_FEE_FLAT * passengerCount);
  const gstAmount = round2((baseAmount + convenienceFee) * (GST_RATE_PERCENT / 100) * 0.25);
  // (Only a portion of GST applies to convenience fee/insurance in real IRCTC; simplified here.)
  const totalAmount = round2(baseAmount + convenienceFee + gstAmount);

  return { baseAmount, convenienceFee, gstAmount, totalAmount };
}

function round2(n) {
  return Math.round(n * 100) / 100;
}

export function allotSeat({ availableSeats, racAvailable, index }) {
  if (index < availableSeats) return { status: 'CNF', seat: null };
  if (index < availableSeats + racAvailable) return { status: 'RAC', seat: null };
  return { status: 'WL', seat: null };
}
