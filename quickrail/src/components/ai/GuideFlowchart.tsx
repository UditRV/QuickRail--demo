import React from 'react';

interface Props {
  text: string;
  onAction: (message: string) => void;
}

const Step: React.FC<{ number: string; title: string; detail: string; onClick?: () => void }> = ({ number, title, detail, onClick }) => (
  <div className="flex flex-col items-center w-full">
    <button
      type="button"
      onClick={onClick}
      className="w-full rounded-xl border border-[#d6e3f8] bg-white px-3 py-3 text-left shadow-sm transition hover:border-[#ff8928] hover:bg-[#fffaf5] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#ff8928]"
    >
      <span className="flex items-start gap-3">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#001026] text-xs font-bold text-white">{number}</span>
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-bold text-[#0b1c30]">{title}</span>
          <span className="mt-1 block whitespace-pre-wrap text-xs leading-relaxed text-[#596579]">{detail}</span>
        </span>
        <span className="material-symbols-outlined text-lg text-[#ff8928]" aria-hidden="true">chevron_right</span>
      </span>
    </button>
  </div>
);

const Connector = () => (
  <div className="flex h-5 items-center justify-center" aria-hidden="true">
    <span className="material-symbols-outlined text-lg text-[#ff8928]">south</span>
  </div>
);

export const GuideFlowchart: React.FC<Props> = ({ text, onAction }) => {
  const booking = text.includes('TICKET BOOKING FLOW');
  const steps = [
    { title: 'Enter journey details', detail: 'Choose your starting station, destination and travel date.', action: 'How do I enter my journey details?' },
    { title: 'Compare trains and classes', detail: 'Review the listed trains, timings and available class options.', action: 'How do I search and compare trains?' },
    { title: 'Add passengers', detail: 'Enter passenger details and any available preferences.', action: 'How do I add passenger details?' },
    { title: 'Review the journey and fare', detail: 'Check the route, date, class, availability and total amount.', action: 'How do I review the fare before booking?' },
    { title: 'Confirm the booking', detail: 'Confirm only after checking all journey and passenger details.', action: 'How do I confirm my booking?' },
    { title: 'Complete payment', detail: 'Choose an available payment option and complete it yourself.', action: 'What payment options can I use?' },
    { title: 'Check the result', detail: 'A booking is confirmed only after the backend verifies its status and payment.', action: 'How do I find my confirmed booking?' },
  ];

  const features = [
    { title: 'Book a train', detail: 'Search a route, compare options and follow the booking steps.', message: 'How do I book a ticket?' },
    { title: 'PNR enquiry', detail: 'Find where to enter your PNR and understand the returned status.', message: 'How do I check PNR enquiry?' },
    { title: 'Running status', detail: 'Find a train and check status when live data is available.', message: 'How do I check running status?' },
    { title: 'Tourist trains', detail: 'Explore the tourist journeys listed on QuickRail.', message: 'How do I use Tourist Trains?' },
    { title: 'QuickBid', detail: 'Explore the demo auction experience; it does not issue real tickets.', message: 'How do I use QuickBid?' },
    { title: 'Meals and retiring rooms', detail: 'Follow the relevant feature and PNR prompts where required.', message: 'Guide me through meals and retiring rooms' },
    { title: 'RailWallet and payments', detail: 'Review wallet options and complete payments only through the app controls.', message: 'Explain RailWallet and payments' },
    { title: 'My Bookings and cancellations', detail: 'Review booking details and check cancellation terms before confirming.', message: 'How do I view or cancel a booking?' },
  ];

  return (
    <div className="w-full max-w-[440px] rounded-2xl border border-[#dce9ff] bg-[#f3f6ff] p-3 text-[#0b1c30]">
      <div className="mb-3 flex items-center gap-2">
        <span className="material-symbols-outlined text-xl text-[#ff8928]" aria-hidden="true">{booking ? 'confirmation_number' : 'account_tree'}</span>
        <div>
          <h3 className="text-sm font-bold">{booking ? 'Ticket booking flow' : 'QuickRail feature guide'}</h3>
          <p className="text-xs text-[#596579]">Select any step to learn more.</p>
        </div>
      </div>

      {booking ? (
        <>
          <div className="mb-1 rounded-xl bg-[#001026] px-3 py-2 text-center text-sm font-bold text-white">START · Your journey</div>
          <Connector />
          <div className="space-y-0">
            {steps.map((step, index) => (
              <React.Fragment key={step.title}>
                <Step number={String(index + 1)} title={step.title} detail={step.detail} onClick={() => onAction(step.action)} />
                {index < steps.length - 1 && <Connector />}
              </React.Fragment>
            ))}
          </div>
          <button type="button" onClick={() => onAction('Book a ticket')} className="mt-3 w-full rounded-xl bg-[#ff8928] px-4 py-3 text-sm font-bold text-[#001026] shadow-sm hover:bg-[#ff9d4c] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#001026]">
            Start booking <span aria-hidden="true">→</span>
          </button>
          <p className="mt-2 text-center text-[11px] leading-relaxed text-[#596579]">Demo data and payment options depend on your deployed backend. Never share payment passwords or OTPs with chat.</p>
        </>
      ) : (
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {features.map((feature, index) => (
            <button key={feature.title} type="button" onClick={() => onAction(feature.message)} className="rounded-xl border border-[#d6e3f8] bg-white p-3 text-left transition hover:border-[#ff8928] hover:bg-[#fffaf5] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#ff8928]">
              <span className="mb-1 flex items-center gap-2">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#001026] text-[11px] font-bold text-white">{index + 1}</span>
                <span className="text-sm font-bold">{feature.title}</span>
              </span>
              <span className="block text-xs leading-relaxed text-[#596579]">{feature.detail}</span>
              <span className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-[#a94e00]">Open guide <span aria-hidden="true">→</span></span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
