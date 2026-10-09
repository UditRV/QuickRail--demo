import React, { useState } from 'react';
import { BookingState } from '../types';
import { TRACKER_HALTS } from '../data/mockData';

interface ConfirmedTicketScreenProps {
  booking: BookingState;
  onBookAnother: () => void;
  onOpenCatering: () => void;
  onOpenDisha: () => void;
}

export const ConfirmedTicketScreen: React.FC<ConfirmedTicketScreenProps> = ({
  booking,
  onBookAnother,
  onOpenCatering,
  onOpenDisha,
}) => {
  const [copied, setCopied] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [cancelled, setCancelled] = useState(false);
  const [selectedCoach, setSelectedCoach] = useState('B4');

  const handleCopyPnr = () => {
    navigator.clipboard.writeText(booking.pnr);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handlePrint = () => {
    window.print();
  };

  const coaches = [
    { id: 'ENG', label: 'LOCO' },
    { id: 'EOG', label: 'EOG' },
    { id: 'B1', label: 'B1' },
    { id: 'B2', label: 'B2' },
    { id: 'B3', label: 'B3' },
    { id: 'B4', label: 'B4', isUser: true },
    { id: 'B5', label: 'B5' },
    { id: 'B6', label: 'B6' },
    { id: 'PC', label: 'PANTRY' },
    { id: 'A1', label: 'A1' },
    { id: 'A2', label: 'A2' },
    { id: 'H1', label: 'H1' },
  ];

  return (
    <div className="flex flex-col w-full">
      {/* 1. TOP CONFIRMATION BANNER */}
      <section className="max-w-[1440px] w-full mx-auto px-margin lg:px-margin-desktop mb-space-md">
        <div className="bg-green-700 text-white rounded-xl p-space-md shadow-md flex flex-col md:flex-row items-start md:items-center justify-between gap-space-md">
          <div className="flex items-center gap-space-md">
            <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-[28px] text-white">check_circle</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-headline-md text-headline-md font-bold">Booking Confirmed! (CNF)</h1>
                <span className="bg-white/20 px-2 py-0.5 rounded text-[11px] font-bold uppercase tracking-wider">
                  IRCTC Validated
                </span>
              </div>
              <p className="font-body-sm text-[13px] text-green-100 mt-0.5">
                SMS &amp; WhatsApp ticket sent to <strong className="font-data-mono">{booking.contactMobile}</strong> and
                e-Ticket to <strong className="font-data-mono">{booking.contactEmail}</strong>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-space-md font-label-sm text-[12px] bg-green-800/60 px-space-md py-1.5 rounded-lg border border-green-600/40">
            <div>
              <span className="text-green-200 block text-[10px]">TRANSACTION ID</span>
              <span className="font-data-mono font-bold">{booking.transactionId}</span>
            </div>
            <span className="text-green-400">|</span>
            <div>
              <span className="text-green-200 block text-[10px]">BANK REF</span>
              <span className="font-data-mono font-bold">SBIN-991208</span>
            </div>
          </div>
        </div>
      </section>

      {/* 2. PNR & ACTION TOOLBAR */}
      <section className="max-w-[1440px] w-full mx-auto px-margin lg:px-margin-desktop mb-space-md">
        <div className="bg-white rounded-xl p-space-md shadow-sm border border-[#eff4ff] flex flex-col md:flex-row items-start md:items-center justify-between gap-space-md">
          {/* PNR DISPLAY */}
          <div className="flex items-center gap-space-md">
            {/* Minimal SVG QR Code */}
            <div className="w-14 h-14 bg-[#eff4ff] rounded-lg p-1.5 shrink-0 flex items-center justify-center border border-[#d3e4fe]">
              <svg className="w-full h-full text-[#001026]" viewBox="0 0 100 100" fill="currentColor">
                <rect x="10" y="10" width="25" height="25" fill="currentColor" />
                <rect x="15" y="15" width="15" height="15" fill="white" />
                <rect x="18" y="18" width="9" height="9" fill="currentColor" />
                <rect x="65" y="10" width="25" height="25" fill="currentColor" />
                <rect x="70" y="15" width="15" height="15" fill="white" />
                <rect x="73" y="18" width="9" height="9" fill="currentColor" />
                <rect x="10" y="65" width="25" height="25" fill="currentColor" />
                <rect x="15" y="70" width="15" height="15" fill="white" />
                <rect x="18" y="73" width="9" height="9" fill="currentColor" />
                <rect x="42" y="20" width="8" height="8" fill="currentColor" />
                <rect x="42" y="42" width="16" height="16" fill="currentColor" />
                <rect x="65" y="42" width="10" height="8" fill="currentColor" />
                <rect x="20" y="42" width="12" height="10" fill="currentColor" />
                <rect x="42" y="65" width="8" height="15" fill="currentColor" />
                <rect x="65" y="65" width="15" height="15" fill="currentColor" />
              </svg>
            </div>

            <div>
              <span className="font-label-sm text-[11px] text-[#74777f] uppercase font-bold tracking-wider block">
                Official IRCTC 10-Digit PNR
              </span>
              <div className="flex items-center gap-space-sm">
                <span className="font-headline-lg text-headline-lg font-data-mono font-bold text-[#001026] tracking-wider">
                  {booking.pnr}
                </span>
                <button
                  type="button"
                  onClick={handleCopyPnr}
                  className="px-space-sm py-1 bg-[#eff4ff] hover:bg-[#dce9ff] text-[#001026] rounded font-label-sm text-[11px] font-bold flex items-center gap-1 transition-colors cursor-pointer"
                >
                  <span className="material-symbols-outlined text-[14px]">content_copy</span>
                  <span>{copied ? 'Copied!' : 'Copy PNR'}</span>
                </button>
              </div>
            </div>
          </div>

          {/* ACTIONS */}
          <div className="flex flex-wrap items-center gap-space-sm">
            <button
              type="button"
              onClick={handlePrint}
              className="px-space-md py-1.5 bg-[#eff4ff] hover:bg-[#dce9ff] text-[#001026] rounded-lg font-label-md text-label-md font-bold transition-colors flex items-center gap-1.5 cursor-pointer border border-[#d3e4fe]"
            >
              <span className="material-symbols-outlined text-[18px]">print</span>
              <span>Print E-Ticket</span>
            </button>

            <button
              type="button"
              onClick={() => {
                if (navigator.share) {
                  navigator.share({
                    title: `IRCTC Ticket PNR ${booking.pnr}`,
                    text: `Train 12952 NDLS to MMCT on ${booking.journeyDate}. Seat B4/32 (CNF).`,
                  });
                } else {
                  handleCopyPnr();
                }
              }}
              className="px-space-md py-1.5 bg-[#eff4ff] hover:bg-[#dce9ff] text-[#001026] rounded-lg font-label-md text-label-md font-bold transition-colors flex items-center gap-1.5 cursor-pointer border border-[#d3e4fe]"
            >
              <span className="material-symbols-outlined text-[18px]">share</span>
              <span>Share Ticket</span>
            </button>

            <button
              type="button"
              onClick={() => setShowCancelModal(true)}
              className="px-space-md py-1.5 bg-red-50 hover:bg-red-100 text-red-700 rounded-lg font-label-md text-label-md font-bold transition-colors flex items-center gap-1.5 cursor-pointer border border-red-200"
            >
              <span className="material-symbols-outlined text-[18px]">cancel</span>
              <span>Cancel Ticket</span>
            </button>

            <button
              type="button"
              onClick={onBookAnother}
              className="px-space-md py-1.5 bg-[#001026] hover:bg-[#0b2545] text-white rounded-lg font-label-md text-label-md font-bold transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <span className="material-symbols-outlined text-[18px]">add_circle</span>
              <span>Book Another</span>
            </button>
          </div>
        </div>
      </section>

      {/* 3. MAIN BODY: DIGITAL BOARDING PASS & LIVE TRACKER */}
      <section className="max-w-[1440px] w-full mx-auto px-margin lg:px-margin-desktop mb-space-xl">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr,420px] gap-gutter-desktop items-start">
          {/* LEFT: DIGITAL BOARDING PASS */}
          <div className="space-y-space-md">
            <div className="bg-white rounded-xl overflow-hidden shadow-sm border border-[#eff4ff]">
              {/* Boarding Pass Header Strip */}
              <div className="bg-[#001026] text-white p-space-md flex flex-wrap items-center justify-between gap-space-sm">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="bg-[#ff8928] text-white font-label-sm text-[10px] font-bold px-1.5 py-0.5 rounded uppercase">
                      {booking.selectedTrain.badge}
                    </span>
                    <span className="text-[#ffdcc6] font-label-sm text-[12px]">Tatkal Smart Express</span>
                  </div>
                  <h2 className="font-headline-md text-headline-md font-bold text-white mt-1">
                    {booking.selectedTrain.number} {booking.selectedTrain.name}
                  </h2>
                </div>
                <div className="text-right">
                  <span className="text-[#cbdbf5] text-[11px] block">CRIS RAKE CODE</span>
                  <span className="font-data-mono font-bold text-white text-[13px]">LHB-TEJAS-22C</span>
                </div>
              </div>

              {/* Station Timings Strip */}
              <div className="p-space-lg border-b border-[#eff4ff]">
                <div className="grid grid-cols-1 md:grid-cols-[1fr,auto,1fr] gap-space-md items-center">
                  {/* Origin */}
                  <div>
                    <span className="text-[11px] uppercase font-bold text-[#964900] tracking-wider block">
                      Boarding Station
                    </span>
                    <div className="font-headline-lg text-headline-lg font-data-mono text-[#001026] font-bold">
                      {booking.selectedTrain.departureTime}
                    </div>
                    <div className="font-headline-sm text-headline-sm font-bold text-[#0b1c30]">
                      {booking.selectedTrain.fromStationName} ({booking.selectedTrain.fromStationCode})
                    </div>
                    <div className="font-body-sm text-[12px] text-[#44474e] mt-0.5">
                      Platform 3 • Ajmeri Gate Concourse Side
                    </div>
                    <div className="font-data-mono text-[11px] text-[#74777f] mt-0.5">
                      {booking.journeyDate || 'Fri, 18 Oct 2024'}
                    </div>
                  </div>

                  {/* Mid transit telemetry */}
                  <div className="flex flex-col items-center justify-center text-center px-space-md">
                    <span className="font-data-mono font-bold text-[#964900] text-[13px]">
                      {booking.selectedTrain.duration}
                    </span>
                    <div className="w-36 sm:w-48 h-[2px] bg-[#dce9ff] relative my-2">
                      <div className="w-2.5 h-2.5 rounded-full bg-[#001026] absolute -top-1 left-0"></div>
                      <div className="w-2.5 h-2.5 rounded-full bg-green-600 absolute -top-1 right-0"></div>
                    </div>
                    <span className="text-[11px] text-[#74777f]">1,384 km Track • 130 km/h Peak</span>
                  </div>

                  {/* Destination */}
                  <div className="text-left md:text-right">
                    <span className="text-[11px] uppercase font-bold text-[#964900] tracking-wider block">
                      Destination Station
                    </span>
                    <div className="font-headline-lg text-headline-lg font-data-mono text-[#001026] font-bold">
                      {booking.selectedTrain.arrivalTime}
                    </div>
                    <div className="font-headline-sm text-headline-sm font-bold text-[#0b1c30]">
                      {booking.selectedTrain.toStationName} ({booking.selectedTrain.toStationCode})
                    </div>
                    <div className="font-body-sm text-[12px] text-[#44474e] mt-0.5">
                      Platform 1 • Main Concourse
                    </div>
                    <div className="font-data-mono text-[11px] text-[#74777f] mt-0.5">Next Day Arrival</div>
                  </div>
                </div>
              </div>

              {/* Metadata Ribbon */}
              <div className="bg-[#eff4ff] p-space-sm px-space-lg flex flex-wrap items-center justify-between gap-space-sm text-[12px] font-label-sm text-[#0b1c30] border-b border-[#dce9ff]">
                <div>
                  <span className="text-[#74777f] mr-1">Quota:</span>
                  <strong>{booking.quota || 'General (GN)'}</strong>
                </div>
                <div>
                  <span className="text-[#74777f] mr-1">Class:</span>
                  <strong>{booking.selectedClass.classCode} ({booking.selectedClass.name})</strong>
                </div>
                <div>
                  <span className="text-[#74777f] mr-1">Booking Date:</span>
                  <strong>{booking.bookingTime || 'Today'}</strong>
                </div>
                <div>
                  <span className="text-[#74777f] mr-1">Total Fare Paid:</span>
                  <strong className="text-[#964900] font-data-mono font-bold">
                    ₹{booking.totalAmount ? booking.totalAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '2,677.95'}
                  </strong>
                </div>
              </div>

              {/* Payment Verification Badge */}
              <div className="bg-emerald-50 px-space-lg py-2 border-b border-emerald-100 flex flex-wrap items-center justify-between gap-2 text-[11px] text-emerald-900">
                <div className="flex items-center gap-1.5 font-bold">
                  <span className="material-symbols-outlined text-[16px] text-emerald-700">verified_user</span>
                  <span>Payment Settled via IRCTC iPay</span>
                  <span className="bg-emerald-200/80 px-1.5 py-0.2 rounded uppercase font-data-mono text-[10px]">
                    {booking.paymentDetails?.method ? booking.paymentDetails.method.toUpperCase() : 'UPI'}
                  </span>
                </div>
                <div className="font-data-mono text-emerald-800">
                  <span>Bank Ref: <strong>{booking.paymentDetails?.bankRefNumber || 'SBI-882190'}</strong></span>
                  <span className="mx-2">•</span>
                  <span>Txn ID: <strong>{booking.paymentDetails?.transactionId || booking.transactionId}</strong></span>
                </div>
              </div>

              {/* PASSENGERS & BERTH ALLOCATION TABLE */}
              <div className="p-space-lg">
                <h3 className="font-headline-sm text-headline-sm font-bold text-[#001026] mb-space-sm flex items-center justify-between">
                  <span>Passenger &amp; Berth Allocation</span>
                  <span className="text-green-700 bg-green-50 px-2 py-0.5 rounded text-[11px] font-bold">
                    Official Charted Berths
                  </span>
                </h3>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-[#eff4ff] text-[#44474e] font-label-sm text-[11px] uppercase">
                        <th className="p-space-sm rounded-l"># Pax Name</th>
                        <th className="p-space-sm">Age/Sex</th>
                        <th className="p-space-sm">Booking Status</th>
                        <th className="p-space-sm">Coach</th>
                        <th className="p-space-sm">Berth</th>
                        <th className="p-space-sm rounded-r">Catering Choice</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#eff4ff] font-body-sm text-[13px]">
                      {booking.passengers.map((p, idx) => (
                        <tr key={p.id} className="hover:bg-[#f8f9ff]">
                          <td className="p-space-sm font-bold text-[#001026]">
                            <div className="flex items-center gap-1.5">
                              <span className="material-symbols-outlined text-green-600 text-[16px]">verified</span>
                              <span>{p.name || 'Rahul Sharma'}</span>
                            </div>
                            <span className="text-[10px] text-[#74777f] font-normal block pl-5">UIDAI Aadhaar Verified</span>
                          </td>
                          <td className="p-space-sm font-data-mono">
                            {p.age} / {p.gender.charAt(0)}
                          </td>
                          <td className="p-space-sm">
                            <span className="bg-green-100 text-green-800 font-bold px-2 py-0.5 rounded text-[11px]">
                              CNF (Confirmed)
                            </span>
                          </td>
                          <td className="p-space-sm font-data-mono font-bold text-[#001026]">
                            B4
                          </td>
                          <td className="p-space-sm font-data-mono font-bold text-[#964900]">
                            {idx === 0 ? '32 (Side Lower)' : idx === 1 ? '33 (Side Upper)' : '34 (Lower)'}
                          </td>
                          <td className="p-space-sm">
                            <span className="text-[#001026] font-semibold">{p.mealOption}</span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* INTERACTIVE COACH LAYOUT & PLATFORM POSITION */}
              <div className="bg-[#eff4ff] p-space-md lg:p-space-lg border-t border-[#dce9ff]">
                <div className="flex items-center justify-between mb-space-sm">
                  <div className="flex items-center gap-space-xs font-label-md text-label-md font-bold text-[#001026]">
                    <span className="material-symbols-outlined text-[#ff8928] text-[20px]">train</span>
                    <span>Platform Yard &amp; Coach Layout (22 Coaches)</span>
                  </div>
                  <span className="text-[11px] text-[#44474e]">Engine Facing Mumbai ➔</span>
                </div>

                {/* Horizontal Coach Train Sequence */}
                <div className="overflow-x-auto pb-space-xs">
                  <div className="flex items-center gap-1 min-w-[700px] py-1">
                    {coaches.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => setSelectedCoach(c.id)}
                        className={`flex-1 py-2 px-1 rounded text-center transition-all cursor-pointer border ${
                          c.isUser
                            ? 'bg-[#ff8928] text-white border-[#964900] shadow-md ring-2 ring-[#ff8928]/40'
                            : selectedCoach === c.id
                            ? 'bg-[#001026] text-white border-[#001026]'
                            : 'bg-white text-[#44474e] hover:bg-[#dce9ff] border-[#dce9ff]'
                        }`}
                      >
                        <div className="font-data-mono text-[11px] font-bold">{c.label}</div>
                        {c.isUser && (
                          <div className="text-[9px] bg-white text-[#964900] font-bold px-1 rounded mt-0.5">
                            YOU (32)
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="flex items-center justify-between text-[11px] text-[#44474e] mt-2">
                  <span>Your Coach: <strong className="text-[#001026]">B4 (Near Middle of Platform 3)</strong></span>
                  <span>Yard Distance from Concourse: <strong>~180 meters</strong></span>
                </div>
              </div>

              {/* VALUE ADD: E-CATERING BANNER */}
              <div className="p-space-md bg-gradient-to-r from-[#ffdcc6] to-[#ffe8d9] flex flex-col sm:flex-row items-center justify-between gap-space-md">
                <div className="flex items-center gap-space-sm">
                  <span className="material-symbols-outlined text-[#964900] text-[32px]">dinner_dining</span>
                  <div>
                    <h4 className="font-headline-sm text-headline-sm font-bold text-[#001026]">
                      Order Piping Hot Meals to Seat 32
                    </h4>
                    <p className="font-body-sm text-[12px] text-[#44474e]">
                      Domino&apos;s Pizza, Haldiram&apos;s Thali, and fresh Kulhad Chai delivered during halts at Kota &amp; Vadodara.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={onOpenCatering}
                  className="px-space-lg py-space-xs bg-[#964900] hover:bg-[#723600] text-white rounded-lg font-label-md text-label-md font-bold transition-colors shrink-0 shadow-sm cursor-pointer"
                >
                  Order Food Now
                </button>
              </div>
            </div>
          </div>

          {/* RIGHT: LIVE COMPANION & ROUTE TIMELINE */}
          <div className="space-y-space-md">
            {/* LIVE GPS TRAIN TRACKER */}
            <div className="bg-white rounded-xl p-space-md lg:p-space-lg shadow-sm border border-[#eff4ff]">
              <div className="flex items-center justify-between pb-space-sm border-b border-[#eff4ff]">
                <div className="flex items-center gap-space-xs">
                  <span className="w-2.5 h-2.5 rounded-full bg-green-600 animate-pulse"></span>
                  <h3 className="font-headline-sm text-headline-sm font-bold text-[#001026]">
                    Live Companion &amp; Tracker
                  </h3>
                </div>
                <span className="text-[11px] font-data-mono font-bold text-green-700 bg-green-50 px-2 py-0.5 rounded">
                  GPS ACTIVE
                </span>
              </div>

              <div className="py-space-sm">
                <div className="flex items-center justify-between text-[12px] text-[#44474e] mb-space-sm">
                  <span>Scheduled Departure: <strong>16:55 HRS</strong></span>
                  <span className="text-green-700 font-bold">Right Time (0m Delay)</span>
                </div>

                {/* Vertical Halts Timeline */}
                <div className="space-y-space-md relative pl-6 before:content-[''] before:absolute before:left-2 before:top-2 before:bottom-2 before:w-[2px] before:bg-[#dce9ff]">
                  {TRACKER_HALTS.map((halt, idx) => (
                    <div key={halt.code} className="relative">
                      <span
                        className={`absolute -left-6 top-0.5 w-4 h-4 rounded-full border-2 border-white flex items-center justify-center ${
                          halt.isDone ? 'bg-green-600' : idx === 1 ? 'bg-[#ff8928] animate-pulse' : 'bg-gray-300'
                        }`}
                      ></span>
                      <div className="flex items-start justify-between">
                        <div>
                          <span className="font-label-md text-label-md font-bold text-[#001026] block">
                            {halt.name}
                          </span>
                          <span className="text-[11px] text-[#74777f]">{halt.note}</span>
                        </div>
                        <span className="font-data-mono text-[11px] font-bold text-[#001026]">{halt.time}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Station Wi-Fi & Helpline */}
              <div className="mt-space-md pt-space-sm border-t border-[#eff4ff] space-y-space-xs">
                <div className="flex items-center justify-between text-[12px]">
                  <span className="flex items-center gap-1 text-[#44474e]">
                    <span className="material-symbols-outlined text-[16px] text-[#964900]">wifi</span>
                    Free Station Wi-Fi at NDLS:
                  </span>
                  <strong className="font-data-mono text-[#001026]">RailWire_Free_WiFi</strong>
                </div>

                <div className="flex items-center justify-between text-[12px]">
                  <span className="flex items-center gap-1 text-[#44474e]">
                    <span className="material-symbols-outlined text-[16px] text-[#964900]">support_agent</span>
                    RailMadad On-Train Help:
                  </span>
                  <a href="tel:139" className="font-data-mono font-bold text-[#001026] hover:underline">
                    Dial 139
                  </a>
                </div>

                <div className="flex items-center justify-between text-[12px]">
                  <span className="flex items-center gap-1 text-[#44474e]">
                    <span className="material-symbols-outlined text-[16px] text-[#964900]">security</span>
                    RPF Security Helpline:
                  </span>
                  <a href="tel:182" className="font-data-mono font-bold text-[#001026] hover:underline">
                    Dial 182
                  </a>
                </div>
              </div>
            </div>

            {/* TRAVEL ADVISORY CARD */}
            <div className="bg-[#eff4ff] rounded-xl p-space-md border border-[#d3e4fe]/60">
              <div className="flex items-center gap-space-xs font-headline-sm text-[14px] font-bold text-[#001026] mb-1">
                <span className="material-symbols-outlined text-[#ff8928] text-[18px]">verified</span>
                <span>IRCTC Boarding Guidelines</span>
              </div>
              <ul className="text-[12px] text-[#44474e] space-y-1 list-disc list-inside leading-relaxed">
                <li>Original Government Photo ID (Aadhaar, PAN, Voter ID, Driving License) is mandatory.</li>
                <li>Digital Boarding Pass shown on mobile is officially recognized by TTE without physical print.</li>
                <li>Bedrolls, linen, blankets, and pillows are provided in Coach B4.</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* TICKET CANCELLATION MODAL */}
      {showCancelModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-margin">
          <div className="bg-white rounded-xl max-w-md w-full p-space-lg shadow-2xl border border-[#eff4ff]">
            <div className="flex items-center justify-between pb-space-sm border-b border-[#eff4ff]">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-red-600 text-[24px]">warning</span>
                <h3 className="font-headline-sm text-headline-sm font-bold text-[#001026]">Cancel Train Ticket</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowCancelModal(false)}
                className="text-gray-400 hover:text-gray-600 cursor-pointer"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            {cancelled ? (
              <div className="py-space-lg text-center space-y-space-sm">
                <div className="w-12 h-12 rounded-full bg-green-100 text-green-700 flex items-center justify-center mx-auto">
                  <span className="material-symbols-outlined text-[28px]">check</span>
                </div>
                <h4 className="font-headline-md text-headline-md font-bold text-[#001026]">Ticket Cancelled</h4>
                <p className="font-body-sm text-[13px] text-[#44474e]">
                  Quick Rail Assured Activated: Full 100% refund of <strong className="text-green-700">₹2,677.95</strong> has
                  been processed back to your RailWallet / UPI account.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setShowCancelModal(false);
                    onBookAnother();
                  }}
                  className="mt-2 w-full py-2 bg-[#001026] text-white rounded-lg font-bold cursor-pointer"
                >
                  Return to Home
                </button>
              </div>
            ) : (
              <div className="py-space-md space-y-space-sm">
                <p className="font-body-sm text-[13px] text-[#44474e]">
                  Are you sure you want to cancel ticket for PNR <strong className="font-data-mono">{booking.pnr}</strong>?
                </p>

                <div className="bg-[#eff4ff] p-space-sm rounded-lg text-[12px] space-y-1">
                  <div className="flex justify-between">
                    <span>Fare Paid:</span>
                    <strong className="font-data-mono">₹2,677.95</strong>
                  </div>
                  <div className="flex justify-between text-green-700">
                    <span>Quick Rail Assured Zero Penalty:</span>
                    <strong className="font-data-mono">-₹0.00</strong>
                  </div>
                  <div className="flex justify-between font-bold border-t border-[#dce9ff] pt-1 text-[#001026]">
                    <span>Net Refund to RailWallet:</span>
                    <strong className="font-data-mono text-green-700">₹2,677.95</strong>
                  </div>
                </div>

                <div className="flex items-center gap-space-sm pt-space-sm">
                  <button
                    type="button"
                    onClick={() => setShowCancelModal(false)}
                    className="flex-1 py-2 bg-[#eff4ff] hover:bg-[#dce9ff] text-[#001026] rounded-lg font-bold cursor-pointer"
                  >
                    Keep Ticket
                  </button>
                  <button
                    type="button"
                    onClick={() => setCancelled(true)}
                    className="flex-1 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-bold cursor-pointer"
                  >
                    Confirm Cancellation
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
