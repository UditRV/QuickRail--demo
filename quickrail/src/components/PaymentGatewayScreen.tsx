import React, { useState, useEffect } from 'react';
import { BookingState, PaymentDetails, UserProfile } from '../types';
import { apiCreatePaymentOrder, apiVerifyPayment, openRazorpayCheckout, ApiError } from '../services/api';

interface PaymentGatewayScreenProps {
  booking: BookingState;
  /** Real backend booking id — the booking must already exist server-side before payment. */
  backendBookingId: string;
  currentUser: UserProfile;
  onPaymentSuccess: (paymentDetails: PaymentDetails, backendBooking: any) => void;
  onCancel: () => void;
  onOpenWalletTopUp: () => void;
}

export const PaymentGatewayScreen: React.FC<PaymentGatewayScreenProps> = ({
  booking,
  backendBookingId,
  currentUser,
  onPaymentSuccess,
  onCancel,
  onOpenWalletTopUp,
}) => {
  const [paymentError, setPaymentError] = useState('');
  // 8-minute payment gateway lock timer
  const [sessionSeconds, setSessionSeconds] = useState(8 * 60);

  // Active payment category
  const [paymentMethod, setPaymentMethod] = useState<'upi' | 'card' | 'netbanking' | 'wallet' | 'epaylater'>('upi');

  // UPI State
  const [upiMode, setUpiMode] = useState<'qr' | 'vpa'>('qr');
  const [upiId, setUpiId] = useState('rahul.sharma@okhdfcbank');
  const [isVpaVerified, setIsVpaVerified] = useState(true);
  const [upiNotificationSent, setUpiNotificationSent] = useState(false);
  const [upiCountdown, setUpiCountdown] = useState(300);

  // Card State
  const [cardNumber, setCardNumber] = useState('4532 8921 4098 7721');
  const [cardHolder, setCardHolder] = useState('RAHUL SHARMA');
  const [cardExpiry, setCardExpiry] = useState('11/28');
  const [cardCvv, setCardCvv] = useState('892');
  const [saveCardRbi, setSaveCardRbi] = useState(true);
  const [cardBrand, setCardBrand] = useState<'visa' | 'mastercard' | 'rupay'>('visa');
  const [showOtpModal, setShowOtpModal] = useState(false);
  const [otpValue, setOtpValue] = useState('');
  const [otpTimer, setOtpTimer] = useState(60);

  // Net Banking State
  const [selectedBank, setSelectedBank] = useState('SBI');
  const [showNetBankingModal, setShowNetBankingModal] = useState(false);
  const [nbUsername, setNbUsername] = useState('user_sbi_retail');

  // Wallet State
  const [walletBalance, setWalletBalance] = useState(currentUser.walletBalance || 1450);

  // Processing state
  const [isProcessing, setIsProcessing] = useState(false);
  const [processingStatus, setProcessingStatus] = useState('Initiating secure connection with bank...');

  // Countdown timer effect
  useEffect(() => {
    const timer = setInterval(() => {
      setSessionSeconds((prev) => (prev > 0 ? prev - 1 : 0));
      setUpiCountdown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // OTP Countdown
  useEffect(() => {
    let t: any;
    if (showOtpModal && otpTimer > 0) {
      t = setInterval(() => setOtpTimer((prev) => prev - 1), 1000);
    }
    return () => clearInterval(t);
  }, [showOtpModal, otpTimer]);

  const formatTimer = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  // Fare calculations
  const paxCount = booking.passengers.length || 1;
  const baseTicketFare = booking.selectedClass.price * paxCount;
  const reservationCharge = 40 * paxCount;
  const superfastCharge = 45 * paxCount;
  const irctcConvenienceFee = booking.selectedClass.classCode.includes('A') ? 30.0 : 15.0;
  const gstConvenience = Number((irctcConvenienceFee * 0.18).toFixed(2));
  const cateringCharge = booking.passengers.some((p) => p.mealOption.includes('No Food'))
    ? 0
    : 325 * paxCount;
  const insuranceCharge = booking.travelInsurance ? Number((0.35 * paxCount).toFixed(2)) : 0;
  const quickRailFee = booking.quickRailAssured ? 149 : 0;

  // PG charges (RuPay & UPI = ₹0, others = ₹0 promotion)
  const pgFee = 0.0;

  const grandTotal =
    baseTicketFare +
    reservationCharge +
    superfastCharge +
    irctcConvenienceFee +
    gstConvenience +
    cateringCharge +
    insuranceCharge +
    quickRailFee +
    pgFee;

  // Card brand detection
  const handleCardNumberChange = (val: string) => {
    const cleaned = val.replace(/\D/g, '').slice(0, 16);
    const formatted = cleaned.match(/.{1,4}/g)?.join(' ') || cleaned;
    setCardNumber(formatted);

    if (cleaned.startsWith('4')) {
      setCardBrand('visa');
    } else if (cleaned.startsWith('5') || cleaned.startsWith('2')) {
      setCardBrand('mastercard');
    } else if (cleaned.startsWith('6') || cleaned.startsWith('8')) {
      setCardBrand('rupay');
    }
  };

  // Card Expiry formatting
  const handleExpiryChange = (val: string) => {
    const cleaned = val.replace(/\D/g, '').slice(0, 4);
    if (cleaned.length >= 2) {
      setCardExpiry(`${cleaned.slice(0, 2)}/${cleaned.slice(2)}`);
    } else {
      setCardExpiry(cleaned);
    }
  };

  // Trigger Completion — talks to the real backend + Razorpay (test mode).
  const executePayment = async (details: Partial<PaymentDetails>) => {
    setPaymentError('');
    setIsProcessing(true);
    setProcessingStatus('Creating secure payment order...');

    try {
      const order = await apiCreatePaymentOrder(backendBookingId, paymentMethod as 'upi' | 'card' | 'netbanking' | 'wallet');

      let razorpayPaymentId = '';
      let bankRef = '';
      let backendBooking = order.booking;

      if (paymentMethod === 'wallet') {
        // Wallet payments are settled instantly server-side — no Razorpay step needed.
        razorpayPaymentId = order.payment?.id || '';
        bankRef = order.payment?.bank_ref_number || order.payment?.bankRefNumber || '';
      } else {
        if (!order.order || !order.razorpayKeyId) {
          throw new ApiError('Payment gateway did not return an order', 500);
        }
        setProcessingStatus('Opening secure Razorpay checkout...');
        const result = await openRazorpayCheckout({
          keyId: order.razorpayKeyId,
          orderId: order.order.id,
          amount: order.order.amount,
          currency: order.order.currency,
          name: 'QuickRail',
          description: `PNR payment — ${booking.pnr}`,
          prefill: {
            email: order.prefill?.email,
            contact: order.prefill?.contact,
            name: currentUser.name,
          },
          method: paymentMethod as 'upi' | 'card' | 'netbanking',
        });

        setProcessingStatus('Verifying payment with QuickRail servers...');
        const verified = await apiVerifyPayment(result);
        backendBooking = verified.booking;
        razorpayPaymentId = result.razorpay_payment_id;
        bankRef = backendBooking.payments?.[backendBooking.payments.length - 1]?.bankRefNumber || '';
      }

      setIsProcessing(false);
      const completePayment: PaymentDetails = {
        method: paymentMethod,
        amount: baseTicketFare,
        convenienceFee: irctcConvenienceFee,
        gstAmount: gstConvenience,
        netPayable: backendBooking?.totalAmount ?? grandTotal,
        transactionId: razorpayPaymentId || `TXN-${Date.now()}`,
        bankRefNumber: bankRef || '—',
        paidAt: new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }),
        ...details,
      };

      onPaymentSuccess(completePayment, backendBooking);
    } catch (err) {
      setIsProcessing(false);
      const message = err instanceof ApiError ? err.message : 'Payment failed. Please try again.';
      setPaymentError(message);
    }
  };

  // Handle Form Submission per tab
  const handlePayClick = (e: React.FormEvent) => {
    e.preventDefault();

    if (paymentMethod === 'upi') {
      if (upiMode === 'qr') {
        executePayment({ method: 'upi', upiId: 'QR-Scanner@upi' });
      } else {
        if (!upiId.includes('@')) {
          alert('Please enter a valid UPI VPA handle.');
          return;
        }
        setUpiNotificationSent(true);
        setTimeout(() => {
          executePayment({ method: 'upi', upiId });
        }, 1500);
      }
    } else if (paymentMethod === 'card') {
      if (cardNumber.replace(/\s/g, '').length < 16) {
        alert('Please enter a valid 16-digit card number.');
        return;
      }
      if (cardCvv.length < 3) {
        alert('Please enter valid CVV.');
        return;
      }
      // Open 3D Secure OTP Modal
      setOtpValue('842910'); // Auto-fill for testing ease
      setOtpTimer(60);
      setShowOtpModal(true);
    } else if (paymentMethod === 'netbanking') {
      setShowNetBankingModal(true);
    } else if (paymentMethod === 'wallet') {
      if (walletBalance < grandTotal) {
        alert('Insufficient RailWallet balance. Please top up or select UPI/Card.');
        return;
      }
      setWalletBalance((prev) => prev - grandTotal);
      executePayment({ method: 'wallet', walletName: 'Quick RailWallet' });
    } else if (paymentMethod === 'epaylater') {
      setPaymentError('ePayLater is a demo-only option in this build — please pay via UPI, Card, NetBanking or RailWallet.');
    }
  };

  return (
    <div className="max-w-[1440px] w-full mx-auto px-margin lg:px-margin-desktop py-space-md mb-space-xl">
      {paymentError && (
        <div className="mb-space-md rounded-xl border border-red-300 bg-red-50 px-space-md py-3 text-red-800 text-sm font-medium flex items-center gap-2">
          <span className="material-symbols-outlined text-[18px]">error</span>
          {paymentError}
        </div>
      )}
      {/* Top CRIS Security Header */}
      <div className="bg-[#001026] text-white rounded-xl p-space-md mb-space-md shadow-md flex flex-col md:flex-row items-start md:items-center justify-between gap-space-md border border-[#0b2545]">
        <div className="flex items-center gap-space-md">
          <div className="w-12 h-12 rounded-lg bg-white/10 flex items-center justify-center shrink-0 border border-white/20">
            <span className="material-symbols-outlined text-[28px] text-[#ff8928]">lock_person</span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-headline-md text-headline-md font-bold">IRCTC iPay Multi-Payment Gateway</h1>
              <span className="bg-green-600 text-white text-[10px] font-bold px-2 py-0.5 rounded uppercase">
                RBI Compliant
              </span>
            </div>
            <p className="font-body-sm text-[12px] text-[#cbdbf5] mt-0.5">
              Secure official payment switch powered by Indian Railways (CRIS) and National Payments Corporation of India (NPCI)
            </p>
          </div>
        </div>

        {/* Lock Timer */}
        <div className="flex items-center gap-space-md">
          <div className="flex items-center gap-2 bg-red-950/80 px-space-md py-1.5 rounded-lg border border-red-700/50">
            <span className="material-symbols-outlined text-[18px] text-red-400 animate-pulse">timer</span>
            <div>
              <span className="text-[10px] text-red-200 block uppercase font-bold">Session Closes In</span>
              <span className="font-data-mono font-bold text-white text-[14px]">
                {formatTimer(sessionSeconds)}
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="px-space-md py-2 bg-white/10 hover:bg-white/20 text-white font-label-md text-label-md font-bold rounded-lg transition-colors cursor-pointer"
          >
            Cancel
          </button>
        </div>
      </div>

      {/* Main Grid: Payment Methods on Left, Bill Summary on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr,440px] gap-gutter-desktop items-start">
        {/* ========================================================================= */}
        {/* LEFT COLUMN: MULTI-OPTION PAYMENT MODES */}
        {/* ========================================================================= */}
        <div className="bg-white rounded-2xl shadow-sm border border-[#eff4ff] overflow-hidden">
          {/* Payment Method Selector Ribbon */}
          <div className="flex border-b border-[#eff4ff] overflow-x-auto bg-[#f8f9ff]">
            {[
              { id: 'upi', label: 'UPI / QR', icon: 'qr_code_scanner', badge: 'FASTEST (0% PG)' },
              { id: 'card', label: 'Cards', icon: 'credit_card', badge: 'Visa/RuPay' },
              { id: 'netbanking', label: 'Net Banking', icon: 'account_balance', badge: '50+ Banks' },
              { id: 'wallet', label: 'RailWallet', icon: 'account_balance_wallet', badge: `₹${walletBalance.toFixed(0)}` },
              { id: 'epaylater', label: 'PayLater', icon: 'schedule', badge: '14 Days' },
            ].map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => setPaymentMethod(m.id as any)}
                className={`flex-1 min-w-[120px] py-space-md px-space-sm text-center transition-all cursor-pointer border-b-2 flex flex-col items-center gap-1 ${
                  paymentMethod === m.id
                    ? 'bg-white text-[#001026] border-[#ff8928] shadow-xs'
                    : 'text-[#74777f] border-transparent hover:text-[#001026] hover:bg-[#eff4ff]'
                }`}
              >
                <div className="flex items-center gap-1">
                  <span className="material-symbols-outlined text-[18px]">{m.icon}</span>
                  <span className="font-label-md text-label-md font-bold">{m.label}</span>
                </div>
                <span
                  className={`text-[10px] font-bold px-1.5 py-0.2 rounded ${
                    paymentMethod === m.id
                      ? 'bg-[#ff8928]/15 text-[#964900]'
                      : 'bg-gray-100 text-gray-600'
                  }`}
                >
                  {m.badge}
                </span>
              </button>
            ))}
          </div>

          {/* TAB CONTENT */}
          <div className="p-space-lg">
            {/* 1. UPI TAB */}
            {paymentMethod === 'upi' && (
              <div className="space-y-space-md">
                {/* UPI Mode Selector */}
                <div className="flex items-center gap-2 p-1 bg-[#eff4ff] rounded-xl max-w-sm">
                  <button
                    type="button"
                    onClick={() => setUpiMode('qr')}
                    className={`flex-1 py-1.5 rounded-lg text-[13px] font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                      upiMode === 'qr' ? 'bg-white text-[#001026] shadow-xs' : 'text-[#44474e]'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[16px]">qr_code_2</span>
                    <span>Scan QR Code</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setUpiMode('vpa')}
                    className={`flex-1 py-1.5 rounded-lg text-[13px] font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                      upiMode === 'vpa' ? 'bg-white text-[#001026] shadow-xs' : 'text-[#44474e]'
                    }`}
                  >
                    <span className="material-symbols-outlined text-[16px]">alternate_email</span>
                    <span>Enter UPI ID / VPA</span>
                  </button>
                </div>

                {upiMode === 'qr' ? (
                  <div className="bg-[#f8f9ff] p-space-lg rounded-2xl border border-[#d3e4fe] flex flex-col items-center text-center">
                    <div className="flex items-center gap-2 mb-space-sm">
                      <span className="text-[12px] font-bold text-[#001026]">
                        Scan with ANY UPI App (Google Pay, PhonePe, Paytm, BHIM, CRED)
                      </span>
                    </div>

                    {/* QR Code Graphic with Live Scan Frame */}
                    <div className="w-52 h-52 bg-white p-3 rounded-2xl shadow-md border-2 border-[#001026] relative flex items-center justify-center">
                      <svg className="w-full h-full text-[#001026]" viewBox="0 0 100 100" fill="currentColor">
                        {/* Realistic QR pattern */}
                        <rect x="5" y="5" width="28" height="28" fill="currentColor" />
                        <rect x="9" y="9" width="20" height="20" fill="white" />
                        <rect x="13" y="13" width="12" height="12" fill="currentColor" />

                        <rect x="67" y="5" width="28" height="28" fill="currentColor" />
                        <rect x="71" y="9" width="20" height="20" fill="white" />
                        <rect x="75" y="13" width="12" height="12" fill="currentColor" />

                        <rect x="5" y="67" width="28" height="28" fill="currentColor" />
                        <rect x="9" y="71" width="20" height="20" fill="white" />
                        <rect x="13" y="75" width="12" height="12" fill="currentColor" />

                        <rect x="38" y="10" width="8" height="8" fill="currentColor" />
                        <rect x="50" y="15" width="10" height="10" fill="currentColor" />
                        <rect x="38" y="38" width="24" height="24" fill="currentColor" />
                        <rect x="42" y="42" width="16" height="16" fill="white" />
                        <rect x="46" y="46" width="8" height="8" fill="#ff8928" />

                        <rect x="10" y="38" width="12" height="12" fill="currentColor" />
                        <rect x="25" y="42" width="8" height="15" fill="currentColor" />
                        <rect x="68" y="38" width="14" height="10" fill="currentColor" />
                        <rect x="85" y="42" width="10" height="14" fill="currentColor" />

                        <rect x="38" y="68" width="12" height="15" fill="currentColor" />
                        <rect x="55" y="68" width="10" height="10" fill="currentColor" />
                        <rect x="70" y="68" width="25" height="12" fill="currentColor" />
                        <rect x="70" y="85" width="15" height="10" fill="currentColor" />
                      </svg>

                      {/* Animated Scanner Laser */}
                      <div className="absolute left-2 right-2 h-1 bg-[#ff8928] opacity-80 animate-bounce rounded-full shadow-[0_0_8px_#ff8928]"></div>
                    </div>

                    <div className="mt-space-md text-[13px] text-[#44474e]">
                      <span>Amount Payable: </span>
                      <strong className="font-data-mono text-[#001026] text-[16px]">
                        ₹{grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </strong>
                    </div>

                    <div className="text-[11px] text-[#74777f] mt-1 flex items-center gap-1">
                      <span className="material-symbols-outlined text-[14px] text-green-600">timer</span>
                      <span>QR Valid for: <strong className="font-data-mono text-[#001026]">{formatTimer(upiCountdown)}</strong></span>
                    </div>

                    {/* Instant Simulator Action */}
                    <div className="mt-space-md w-full max-w-sm">
                      <button
                        type="button"
                        onClick={() => executePayment({ method: 'upi', upiId: 'QR-AppScan@upi' })}
                        className="w-full py-3 bg-[#ff8928] hover:bg-[#964900] active:scale-[0.99] text-white font-headline-sm text-headline-sm rounded-xl font-bold flex items-center justify-center gap-2 transition-all shadow-md cursor-pointer"
                      >
                        <span className="material-symbols-outlined text-[20px]">check_circle</span>
                        <span>SIMULATE UPI APP PAYMENT (₹{grandTotal.toFixed(2)})</span>
                      </button>
                      <span className="text-[10px] text-[#74777f] mt-1 block">
                        Clicking simulates instant notification approval from your UPI mobile app.
                      </span>
                    </div>
                  </div>
                ) : (
                  <form onSubmit={handlePayClick} className="space-y-space-md">
                    <div>
                      <label className="block font-label-md text-label-md font-bold text-[#001026] mb-1">
                        Enter Virtual Payment Address (VPA / UPI ID)
                      </label>
                      <div className="relative">
                        <input
                          type="text"
                          value={upiId}
                          onChange={(e) => {
                            setUpiId(e.target.value);
                            setIsVpaVerified(e.target.value.includes('@'));
                          }}
                          placeholder="e.g. mobile@upi or name@okhdfcbank"
                          className="w-full bg-[#f8f9ff] px-4 py-3 rounded-lg border border-[#d3e4fe] font-data-mono text-[14px] text-[#001026] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#ff8928]"
                        />
                        {isVpaVerified && (
                          <span className="absolute right-3 top-3 text-[11px] text-green-700 font-bold flex items-center gap-1">
                            <span className="material-symbols-outlined text-[16px]">verified</span>
                            <span>Verified</span>
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Quick Handle Chips */}
                    <div>
                      <span className="text-[11px] text-[#74777f] block mb-1.5 font-bold">
                        Popular Handles:
                      </span>
                      <div className="flex flex-wrap gap-1.5">
                        {['@okhdfcbank', '@okaxis', '@paytm', '@ybl', '@okicici', '@sbi'].map((handle) => (
                          <button
                            key={handle}
                            type="button"
                            onClick={() => {
                              const prefix = upiId.includes('@') ? upiId.split('@')[0] : upiId || 'rahul.sharma';
                              setUpiId(`${prefix}${handle}`);
                              setIsVpaVerified(true);
                            }}
                            className="px-2.5 py-1 bg-[#eff4ff] hover:bg-[#dce9ff] text-[#001026] font-data-mono text-[11px] font-bold rounded border border-[#d3e4fe] transition-colors cursor-pointer"
                          >
                            {handle}
                          </button>
                        ))}
                      </div>
                    </div>

                    {upiNotificationSent && (
                      <div className="p-space-md bg-green-50 rounded-xl border border-green-200 text-green-800 text-[13px] flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="material-symbols-outlined text-[20px] animate-bounce">notifications_active</span>
                          <span>Collect request sent to <strong>{upiId}</strong>. Open your UPI app and authorize!</span>
                        </div>
                        <span className="font-data-mono font-bold">Auto-Polling...</span>
                      </div>
                    )}

                    <button
                      type="submit"
                      className="w-full py-3.5 bg-[#001026] hover:bg-[#0b2545] active:scale-[0.99] text-white font-headline-sm text-headline-sm rounded-xl font-bold flex items-center justify-center gap-2 transition-all shadow-md cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-[20px]">lock</span>
                      <span>PAY ₹{grandTotal.toFixed(2)} VIA UPI</span>
                    </button>
                  </form>
                )}
              </div>
            )}

            {/* 2. CARD TAB */}
            {paymentMethod === 'card' && (
              <form onSubmit={handlePayClick} className="space-y-space-md">
                {/* Accepted Cards Ribbon */}
                <div className="flex items-center justify-between pb-space-xs border-b border-[#eff4ff]">
                  <span className="text-[12px] font-bold text-[#44474e]">Credit, Debit &amp; ATM Cards</span>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-100 text-blue-800">VISA</span>
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-orange-100 text-orange-800">MASTERCARD</span>
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-green-100 text-green-800">RUPAY</span>
                  </div>
                </div>

                {/* Card Number */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="font-label-md text-label-md font-bold text-[#001026]">
                      Card Number
                    </label>
                    <span className="text-[11px] font-bold uppercase text-[#ff8928]">
                      {cardBrand} Detected
                    </span>
                  </div>
                  <div className="relative">
                    <span className="material-symbols-outlined absolute left-3 top-3 text-[#74777f] text-[20px]">
                      credit_card
                    </span>
                    <input
                      type="text"
                      maxLength={19}
                      value={cardNumber}
                      onChange={(e) => handleCardNumberChange(e.target.value)}
                      placeholder="XXXX XXXX XXXX XXXX"
                      className="w-full bg-[#f8f9ff] pl-10 pr-4 py-2.5 rounded-lg border border-[#d3e4fe] font-data-mono font-bold text-[15px] text-[#001026] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#ff8928]"
                    />
                  </div>
                </div>

                {/* Cardholder Name */}
                <div>
                  <label className="block font-label-md text-label-md font-bold text-[#001026] mb-1">
                    Cardholder Name (as on card)
                  </label>
                  <input
                    type="text"
                    value={cardHolder}
                    onChange={(e) => setCardHolder(e.target.value.toUpperCase())}
                    placeholder="e.g. RAHUL SHARMA"
                    className="w-full bg-[#f8f9ff] px-4 py-2.5 rounded-lg border border-[#d3e4fe] font-data-mono font-bold text-[14px] text-[#001026] uppercase focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#ff8928]"
                  />
                </div>

                {/* Expiry and CVV */}
                <div className="grid grid-cols-2 gap-space-md">
                  <div>
                    <label className="block font-label-md text-label-md font-bold text-[#001026] mb-1">
                      Expiry Date
                    </label>
                    <input
                      type="text"
                      maxLength={5}
                      value={cardExpiry}
                      onChange={(e) => handleExpiryChange(e.target.value)}
                      placeholder="MM/YY"
                      className="w-full bg-[#f8f9ff] px-4 py-2.5 rounded-lg border border-[#d3e4fe] font-data-mono font-bold text-[14px] text-[#001026] text-center focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#ff8928]"
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="font-label-md text-label-md font-bold text-[#001026]">
                        CVV / CVC
                      </label>
                      <span className="text-[10px] text-[#74777f]">3 digits on back</span>
                    </div>
                    <input
                      type="password"
                      maxLength={4}
                      value={cardCvv}
                      onChange={(e) => setCardCvv(e.target.value.replace(/\D/g, ''))}
                      placeholder="•••"
                      className="w-full bg-[#f8f9ff] px-4 py-2.5 rounded-lg border border-[#d3e4fe] font-data-mono font-bold text-[14px] text-[#001026] text-center focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#ff8928]"
                    />
                  </div>
                </div>

                {/* RBI Tokenization Checkbox */}
                <div>
                  <label className="flex items-center gap-2 text-[12px] text-[#44474e] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={saveCardRbi}
                      onChange={(e) => setSaveCardRbi(e.target.checked)}
                      className="w-4 h-4 rounded text-[#ff8928] focus:ring-[#ff8928]"
                    />
                    <span>Save card securely as per RBI tokenization guidelines for 1-click booking</span>
                  </label>
                </div>

                <button
                  type="submit"
                  className="w-full py-3.5 bg-[#001026] hover:bg-[#0b2545] active:scale-[0.99] text-white font-headline-sm text-headline-sm rounded-xl font-bold flex items-center justify-center gap-2 transition-all shadow-md cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[20px]">lock</span>
                  <span>PAY ₹{grandTotal.toFixed(2)} SECURELY</span>
                </button>
              </form>
            )}

            {/* 3. NET BANKING TAB */}
            {paymentMethod === 'netbanking' && (
              <div className="space-y-space-md">
                <span className="text-[12px] font-bold text-[#44474e] block">
                  Select Your Retail / Corporate Bank
                </span>

                {/* Popular Banks Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-space-sm">
                  {[
                    { id: 'SBI', name: 'State Bank of India', tag: 'Fastest' },
                    { id: 'HDFC', name: 'HDFC Bank', tag: 'Popular' },
                    { id: 'ICICI', name: 'ICICI Bank', tag: 'Popular' },
                    { id: 'AXIS', name: 'Axis Bank', tag: '' },
                    { id: 'PNB', name: 'Punjab National Bank', tag: '' },
                    { id: 'BOB', name: 'Bank of Baroda', tag: '' },
                  ].map((bank) => (
                    <button
                      key={bank.id}
                      type="button"
                      onClick={() => setSelectedBank(bank.id)}
                      className={`p-space-sm rounded-xl border text-left transition-all cursor-pointer ${
                        selectedBank === bank.id
                          ? 'border-[#ff8928] bg-[#ffdcc6]/20 ring-2 ring-[#ff8928]/30 shadow-xs'
                          : 'border-[#d3e4fe] bg-white hover:bg-[#eff4ff]'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-data-mono font-bold text-[13px] text-[#001026]">
                          {bank.id}
                        </span>
                        {bank.tag && (
                          <span className="text-[9px] bg-green-100 text-green-800 font-bold px-1 rounded">
                            {bank.tag}
                          </span>
                        )}
                      </div>
                      <span className="text-[11px] text-[#44474e] block mt-0.5 leading-tight font-semibold">
                        {bank.name}
                      </span>
                    </button>
                  ))}
                </div>

                {/* All Banks Dropdown */}
                <div>
                  <label className="block font-label-md text-label-md font-bold text-[#001026] mb-1">
                    Or Choose from 50+ Other Banks
                  </label>
                  <select
                    value={selectedBank}
                    onChange={(e) => setSelectedBank(e.target.value)}
                    className="w-full bg-[#f8f9ff] px-4 py-2.5 rounded-lg border border-[#d3e4fe] text-[13px] text-[#001026] focus:outline-none focus:ring-2 focus:ring-[#ff8928]"
                  >
                    <option value="SBI">State Bank of India</option>
                    <option value="HDFC">HDFC Bank</option>
                    <option value="ICICI">ICICI Bank</option>
                    <option value="AXIS">Axis Bank</option>
                    <option value="PNB">Punjab National Bank</option>
                    <option value="BOB">Bank of Baroda</option>
                    <option value="CANARA">Canara Bank</option>
                    <option value="UNION">Union Bank of India</option>
                    <option value="KOTAK">Kotak Mahindra Bank</option>
                    <option value="IDFC">IDFC FIRST Bank</option>
                    <option value="INDUSIND">IndusInd Bank</option>
                    <option value="FEDERAL">Federal Bank</option>
                  </select>
                </div>

                <button
                  type="button"
                  onClick={handlePayClick}
                  className="w-full py-3.5 bg-[#001026] hover:bg-[#0b2545] active:scale-[0.99] text-white font-headline-sm text-headline-sm rounded-xl font-bold flex items-center justify-center gap-2 transition-all shadow-md cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[20px]">account_balance</span>
                  <span>LOGIN TO {selectedBank} NETBANKING (₹{grandTotal.toFixed(2)})</span>
                </button>
              </div>
            )}

            {/* 4. RAILWALLET TAB */}
            {paymentMethod === 'wallet' && (
              <div className="space-y-space-md">
                <div className="bg-gradient-to-r from-[#001026] to-[#0b2545] text-white p-space-md rounded-xl shadow-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-[#ffdcc6] uppercase tracking-wider font-bold">
                      Available Quick RailWallet Balance
                    </span>
                    <span className="bg-green-500/20 text-green-300 text-[10px] font-bold px-2 py-0.5 rounded">
                      ● Active
                    </span>
                  </div>
                  <div className="font-headline-lg text-headline-lg font-data-mono font-bold mt-1 text-white">
                    ₹{walletBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                  </div>
                  <p className="text-[11px] text-[#cbdbf5] mt-1">
                    No OTP required! Ideal for high-speed Tatkal booking confirmation in &lt; 2 seconds.
                  </p>
                </div>

                {walletBalance < grandTotal ? (
                  <div className="bg-red-50 p-space-md rounded-xl border border-red-200 text-red-800 text-[13px] space-y-2">
                    <div className="flex items-center gap-2 font-bold">
                      <span className="material-symbols-outlined text-[20px] text-red-600">warning</span>
                      <span>Insufficient Balance in RailWallet</span>
                    </div>
                    <p className="text-[12px] text-red-700">
                      You need ₹{(grandTotal - walletBalance).toFixed(2)} more to complete this booking.
                    </p>
                    <button
                      type="button"
                      onClick={onOpenWalletTopUp}
                      className="px-space-md py-1.5 bg-[#ff8928] hover:bg-[#964900] text-white text-[12px] font-bold rounded-lg cursor-pointer transition-colors"
                    >
                      Top Up RailWallet Now
                    </button>
                  </div>
                ) : (
                  <div className="bg-green-50 p-space-sm rounded-lg border border-green-200 text-green-800 text-[12px] flex items-center gap-2">
                    <span className="material-symbols-outlined text-[18px]">check_circle</span>
                    <span>Sufficient balance! Ticket will be issued in 1 second.</span>
                  </div>
                )}

                <button
                  type="button"
                  disabled={walletBalance < grandTotal}
                  onClick={handlePayClick}
                  className="w-full py-3.5 bg-[#ff8928] hover:bg-[#964900] disabled:opacity-50 active:scale-[0.99] text-white font-headline-sm text-headline-sm rounded-xl font-bold flex items-center justify-center gap-2 transition-all shadow-md cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[20px]">bolt</span>
                  <span>1-CLICK DEBIT &amp; CONFIRM (₹{grandTotal.toFixed(2)})</span>
                </button>
              </div>
            )}

            {/* 5. EPAYLATER / EMI TAB */}
            {paymentMethod === 'epaylater' && (
              <div className="space-y-space-md">
                <div className="bg-[#eff4ff] p-space-md rounded-xl border border-[#d3e4fe]">
                  <div className="flex items-center gap-2 font-bold text-[#001026] text-[14px]">
                    <span className="material-symbols-outlined text-[#ff8928] text-[20px]">schedule</span>
                    <span>IRCTC ePayLater Powered by ICICI Bank</span>
                  </div>
                  <p className="text-[12px] text-[#44474e] mt-1">
                    Book ticket right now, travel stress-free, and pay anytime within 14 days with zero interest.
                  </p>
                  <div className="mt-3 flex items-center justify-between text-[12px] pt-2 border-t border-[#dce9ff]">
                    <span>Credit Limit Available:</span>
                    <strong className="font-data-mono text-green-700">₹15,000.00</strong>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handlePayClick}
                  className="w-full py-3.5 bg-[#001026] hover:bg-[#0b2545] active:scale-[0.99] text-white font-headline-sm text-headline-sm rounded-xl font-bold flex items-center justify-center gap-2 transition-all shadow-md cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[20px]">verified</span>
                  <span>CONFIRM WITH EPAYLATER (₹{grandTotal.toFixed(2)})</span>
                </button>
              </div>
            )}
          </div>
        </div>

        {/* ========================================================================= */}
        {/* RIGHT COLUMN: TICKET DETAILS & ITEMIZED FARE BREAKDOWN */}
        {/* ========================================================================= */}
        <div className="space-y-space-md">
          <div className="bg-white rounded-2xl shadow-sm border border-[#eff4ff] p-space-lg">
            <h3 className="font-headline-sm text-headline-sm font-bold text-[#001026] pb-space-sm border-b border-[#eff4ff] flex items-center justify-between">
              <span>Journey Summary</span>
              <span className="bg-[#ff8928] text-white text-[10px] font-bold px-2 py-0.5 rounded uppercase">
                {booking.selectedTrain.badge}
              </span>
            </h3>

            {/* Train & Stations */}
            <div className="py-space-sm border-b border-[#eff4ff] space-y-1">
              <div className="font-headline-sm text-[15px] font-bold text-[#001026]">
                {booking.selectedTrain.number} {booking.selectedTrain.name}
              </div>
              <div className="flex items-center justify-between text-[12px] text-[#44474e]">
                <span>
                  {booking.fromStation.split(' - ')[0]} ➔ {booking.toStation.split(' - ')[0]}
                </span>
                <span className="font-data-mono font-bold text-[#001026]">{booking.journeyDate}</span>
              </div>
              <div className="text-[11px] text-[#74777f]">
                Class: <strong className="text-[#001026]">{booking.selectedClass.classCode} ({booking.selectedClass.name})</strong> • Quota: <strong>{booking.quota}</strong>
              </div>
            </div>

            {/* Passenger Preview */}
            <div className="py-space-sm border-b border-[#eff4ff]">
              <span className="font-label-sm text-[11px] text-[#74777f] uppercase font-bold block mb-1">
                Passengers ({paxCount})
              </span>
              <div className="space-y-1">
                {booking.passengers.map((p, idx) => (
                  <div key={p.id} className="flex items-center justify-between text-[12px]">
                    <span className="font-semibold text-[#001026]">
                      {p.name || 'Rahul Sharma'} ({p.age}, {p.gender.charAt(0)})
                    </span>
                    <span className="font-data-mono text-[11px] text-[#964900] font-bold">
                      {idx === 0 ? 'B4 / 32 (SL)' : idx === 1 ? 'B4 / 33 (SU)' : 'B4 / 34 (LB)'}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Itemized Fare Card */}
            <div className="py-space-sm space-y-1.5 text-[12px] text-[#44474e]">
              <span className="font-label-sm text-[11px] text-[#74777f] uppercase font-bold block mb-1">
                Fare Breakdown
              </span>

              <div className="flex justify-between">
                <span>Base Fare ({paxCount} Pax):</span>
                <span className="font-data-mono font-semibold text-[#001026]">
                  ₹{baseTicketFare.toFixed(2)}
                </span>
              </div>

              <div className="flex justify-between">
                <span>Reservation &amp; Superfast Fee:</span>
                <span className="font-data-mono font-semibold text-[#001026]">
                  ₹{(reservationCharge + superfastCharge).toFixed(2)}
                </span>
              </div>

              <div className="flex justify-between">
                <span>IRCTC Convenience Fee (AC):</span>
                <span className="font-data-mono font-semibold text-[#001026]">
                  ₹{irctcConvenienceFee.toFixed(2)}
                </span>
              </div>

              <div className="flex justify-between">
                <span>18% GST on Convenience Fee:</span>
                <span className="font-data-mono font-semibold text-[#001026]">
                  ₹{gstConvenience.toFixed(2)}
                </span>
              </div>

              {cateringCharge > 0 && (
                <div className="flex justify-between">
                  <span>Pantry Catering Service:</span>
                  <span className="font-data-mono font-semibold text-[#001026]">
                    ₹{cateringCharge.toFixed(2)}
                  </span>
                </div>
              )}

              {quickRailFee > 0 && (
                <div className="flex justify-between text-green-700">
                  <span>Quick Rail Assured Zero Penalty:</span>
                  <span className="font-data-mono font-semibold">₹{quickRailFee.toFixed(2)}</span>
                </div>
              )}

              {insuranceCharge > 0 && (
                <div className="flex justify-between">
                  <span>Travel Insurance (₹0.35/pax):</span>
                  <span className="font-data-mono font-semibold text-[#001026]">
                    ₹{insuranceCharge.toFixed(2)}
                  </span>
                </div>
              )}

              <div className="flex justify-between text-green-700 font-semibold">
                <span>Payment Gateway Charges:</span>
                <span>FREE (₹0.00)</span>
              </div>

              {/* Total Row */}
              <div className="pt-space-sm border-t border-[#eff4ff] flex items-center justify-between">
                <div>
                  <span className="font-label-sm text-[11px] text-[#74777f] block">Total Payable</span>
                  <span className="font-headline-lg text-headline-lg font-data-mono text-[#001026] font-bold">
                    ₹{grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
                <span className="bg-green-100 text-green-800 text-[10px] font-bold px-2 py-0.5 rounded">
                  All Taxes Included
                </span>
              </div>
            </div>
          </div>

          {/* Security & Customer Care Seals */}
          <div className="bg-[#eff4ff] p-space-md rounded-xl border border-[#d3e4fe] space-y-1.5 text-[11px] text-[#44474e]">
            <div className="flex items-center gap-1.5 font-bold text-[#001026]">
              <span className="material-symbols-outlined text-green-600 text-[18px]">verified</span>
              <span>100% Safe &amp; Verified Transaction</span>
            </div>
            <p>
              Your payment information is tokenized and protected under ISO/IEC 27001 and PCI-DSS standards.
              In case of failed reservation, full refund is credited to your source account within 15 minutes.
            </p>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 3D SECURE OTP MODAL (For Card Payments) */}
      {/* ========================================================================= */}
      {showOtpModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-margin">
          <div className="bg-white rounded-2xl max-w-md w-full p-space-lg shadow-2xl border border-[#eff4ff]">
            <div className="flex items-center justify-between pb-space-sm border-b border-[#eff4ff]">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-blue-600 text-[24px]">security</span>
                <div>
                  <h3 className="font-headline-sm text-headline-sm font-bold text-[#001026]">
                    State Bank of India 3D SecurePay
                  </h3>
                  <span className="text-[10px] text-[#74777f]">Verified by VISA / RuPay Secure</span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowOtpModal(false)}
                className="text-gray-400 hover:text-gray-600 cursor-pointer"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="py-space-md space-y-space-sm">
              <div className="bg-[#eff4ff] p-space-sm rounded-lg text-[12px] space-y-1">
                <div className="flex justify-between">
                  <span>Merchant:</span>
                  <strong className="text-[#001026]">IRCTC Quick Rail Booking</strong>
                </div>
                <div className="flex justify-between">
                  <span>Card Ending In:</span>
                  <strong className="font-data-mono">{cardNumber.slice(-4)}</strong>
                </div>
                <div className="flex justify-between">
                  <span>Amount Debited:</span>
                  <strong className="font-data-mono font-bold text-[#001026]">
                    ₹{grandTotal.toFixed(2)}
                  </strong>
                </div>
              </div>

              <p className="text-[13px] text-[#44474e]">
                A One Time Password (OTP) has been sent to your registered mobile number ending in{' '}
                <strong className="font-data-mono">******3210</strong>.
              </p>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="font-label-md text-label-md font-bold text-[#001026]">
                    Enter 6-Digit Bank OTP
                  </label>
                  <span className="text-[11px] text-green-700 font-bold">Auto-filled for testing</span>
                </div>
                <input
                  type="text"
                  maxLength={6}
                  value={otpValue}
                  onChange={(e) => setOtpValue(e.target.value.replace(/\D/g, ''))}
                  placeholder="6-digit OTP"
                  className="w-full bg-[#f8f9ff] px-4 py-2.5 rounded-lg border border-[#d3e4fe] font-data-mono font-bold text-center tracking-[8px] text-[18px] text-[#001026] focus:outline-none focus:ring-2 focus:ring-[#ff8928]"
                />
              </div>

              <div className="flex items-center justify-between text-[11px] text-[#74777f]">
                <span>Resend OTP in: <strong className="font-data-mono">{otpTimer}s</strong></span>
                <button
                  type="button"
                  onClick={() => setOtpTimer(60)}
                  disabled={otpTimer > 0}
                  className="text-[#964900] disabled:opacity-40 font-bold hover:underline cursor-pointer"
                >
                  Resend OTP
                </button>
              </div>

              <div className="flex items-center gap-space-sm pt-space-sm">
                <button
                  type="button"
                  onClick={() => setShowOtpModal(false)}
                  className="flex-1 py-2.5 bg-[#eff4ff] hover:bg-[#dce9ff] text-[#001026] rounded-lg font-bold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowOtpModal(false);
                    executePayment({
                      method: 'card',
                      cardNumber: `•••• •••• •••• ${cardNumber.slice(-4)}`,
                      cardBank: 'SBI Visa Platinum',
                    });
                  }}
                  className="flex-1 py-2.5 bg-[#001026] hover:bg-[#0b2545] text-white rounded-lg font-bold cursor-pointer"
                >
                  Submit OTP
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* NET BANKING MODAL */}
      {/* ========================================================================= */}
      {showNetBankingModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex items-center justify-center p-margin">
          <div className="bg-white rounded-2xl max-w-md w-full p-space-lg shadow-2xl border border-[#eff4ff]">
            <div className="flex items-center justify-between pb-space-sm border-b border-[#eff4ff]">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[#ff8928] text-[24px]">account_balance</span>
                <h3 className="font-headline-sm text-headline-sm font-bold text-[#001026]">
                  {selectedBank} Retail Internet Banking
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowNetBankingModal(false)}
                className="text-gray-400 hover:text-gray-600 cursor-pointer"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="py-space-md space-y-space-sm">
              <p className="text-[13px] text-[#44474e]">
                Authorize payment of <strong className="font-data-mono text-[#001026]">₹{grandTotal.toFixed(2)}</strong> for IRCTC Railway E-Ticket.
              </p>

              <div>
                <label className="block font-label-md text-label-md font-bold text-[#001026] mb-1">
                  Internet Banking User ID
                </label>
                <input
                  type="text"
                  value={nbUsername}
                  onChange={(e) => setNbUsername(e.target.value)}
                  className="w-full bg-[#f8f9ff] px-4 py-2 rounded-lg border border-[#d3e4fe] font-data-mono text-[13px]"
                />
              </div>

              <div>
                <label className="block font-label-md text-label-md font-bold text-[#001026] mb-1">
                  Login Password / Transaction PIN
                </label>
                <input
                  type="password"
                  defaultValue="••••••••"
                  className="w-full bg-[#f8f9ff] px-4 py-2 rounded-lg border border-[#d3e4fe] font-data-mono text-[13px]"
                />
              </div>

              <div className="flex items-center gap-space-sm pt-space-sm">
                <button
                  type="button"
                  onClick={() => setShowNetBankingModal(false)}
                  className="flex-1 py-2.5 bg-[#eff4ff] hover:bg-[#dce9ff] text-[#001026] rounded-lg font-bold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowNetBankingModal(false);
                    executePayment({ method: 'netbanking', bankName: selectedBank });
                  }}
                  className="flex-1 py-2.5 bg-[#ff8928] hover:bg-[#964900] text-white rounded-lg font-bold cursor-pointer"
                >
                  Confirm &amp; Pay
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* PROCESSING OVERLAY (High Fidelity Bank Connection) */}
      {/* ========================================================================= */}
      {isProcessing && (
        <div className="fixed inset-0 z-50 bg-[#001026]/85 backdrop-blur-md flex items-center justify-center p-margin">
          <div className="bg-white rounded-2xl max-w-md w-full p-space-xl shadow-2xl text-center space-y-space-md border border-[#eff4ff]">
            {/* Animated Train & Bank Ring */}
            <div className="w-20 h-20 rounded-full bg-[#eff4ff] border-4 border-[#ff8928] border-t-transparent animate-spin flex items-center justify-center mx-auto">
              <span className="material-symbols-outlined text-[#ff8928] text-[32px] animate-none">train</span>
            </div>

            <div>
              <h3 className="font-headline-md text-headline-md font-bold text-[#001026]">
                Processing IRCTC Booking
              </h3>
              <p className="font-body-sm text-[13px] text-[#44474e] mt-1">
                {processingStatus}
              </p>
            </div>

            <div className="bg-[#f8f9ff] p-space-sm rounded-xl text-[11px] text-[#74777f] border border-[#d3e4fe]">
              <span className="block font-bold text-red-600">PLEASE DO NOT PRESS BACK OR REFRESH</span>
              <span>Communicating directly with Indian Railways Central Server Node (CRIS)</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
