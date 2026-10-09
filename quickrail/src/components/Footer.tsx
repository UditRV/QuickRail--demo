import React from 'react';
import { ScreenType } from '../types';
import { QUICK_RAIL_LOGO } from '../data/mockData';

interface FooterProps {
  onNavigate: (screen: ScreenType) => void;
  onOpenDisha: () => void;
  onOpenPnrModal: () => void;
}

export const Footer: React.FC<FooterProps> = ({ onNavigate, onOpenDisha, onOpenPnrModal }) => {
  return (
    <footer className="w-full bg-white mt-space-xl shadow-[0_-1px_6px_rgba(0,0,0,0.03)] border-t border-[#eff4ff]">
      {/* Upper verification strip */}
      <div className="bg-[#eff4ff] py-space-md px-margin lg:px-margin-desktop border-b border-[#dce9ff]">
        <div className="max-w-[1440px] mx-auto flex flex-wrap items-center justify-between gap-gutter">
          <div className="flex items-center gap-space-sm font-label-md text-label-md text-[#0b1c30]">
            <span className="material-symbols-outlined text-[#ff8928] text-[22px]">verified_user</span>
            <span className="font-semibold">Ministry of Railways &amp; IRCTC Official E-Ticketing System Integration</span>
          </div>
          <div className="flex items-center gap-gutter font-label-sm text-label-sm text-[#44474e] flex-wrap">
            <div className="flex items-center gap-space-xs">
              <span className="material-symbols-outlined text-[#0b2545] text-[16px]">lock</span>
              <span>256-Bit SSL Encrypted Banking</span>
            </div>
            <div className="flex items-center gap-space-xs">
              <span className="material-symbols-outlined text-[#0b2545] text-[16px]">currency_rupee</span>
              <span>Instant Auto-Refund Guarantee</span>
            </div>
            <div className="flex items-center gap-space-xs">
              <span className="material-symbols-outlined text-[#0b2545] text-[16px]">shield</span>
              <span>PCI-DSS Level 1 Certified</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main 4-column footer body */}
      <div className="max-w-[1440px] mx-auto px-margin lg:px-margin-desktop py-space-xl">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-gutter">
          {/* Col 1: Brand & Synopsis */}
          <div className="space-y-space-sm">
            <div className="flex items-center gap-space-sm">
              <img alt="Quick Rail Logo" className="h-6 w-auto object-contain" src={QUICK_RAIL_LOGO} />
              <span className="font-headline-sm text-headline-sm text-[#001026] font-bold">Quick Rail</span>
            </div>
            <p className="font-body-sm text-body-sm text-[#44474e] leading-relaxed">
              Next-generation enterprise ticketing infrastructure providing instant seat availability, Tatkal booking
              engines, and official IRCTC synchronization for multi-segment rail transit.
            </p>
          </div>

          {/* Col 2: Passenger Services */}
          <div>
            <div className="font-label-md text-label-md text-[#0b1c30] uppercase font-bold mb-space-sm tracking-wider">
              Passenger Services
            </div>
            <ul className="space-y-space-xs font-body-sm text-body-sm text-[#44474e]">
              <li>
                <button
                  type="button"
                  onClick={() => onNavigate('home')}
                  className="hover:text-[#0b1c30] transition-colors cursor-pointer text-left"
                >
                  Book Train Tickets
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={onOpenPnrModal}
                  className="hover:text-[#0b1c30] transition-colors cursor-pointer text-left"
                >
                  Check PNR Status
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => onNavigate('confirmed')}
                  className="hover:text-[#0b1c30] transition-colors cursor-pointer text-left"
                >
                  Live Train Running Status
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => onNavigate('results')}
                  className="hover:text-[#0b1c30] transition-colors cursor-pointer text-left"
                >
                  Tatkal Reservation Quota
                </button>
              </li>
            </ul>
          </div>

          {/* Col 3: Policies & Rules */}
          <div>
            <div className="font-label-md text-label-md text-[#0b1c30] uppercase font-bold mb-space-sm tracking-wider">
              Policies &amp; Rules
            </div>
            <ul className="space-y-space-xs font-body-sm text-body-sm text-[#44474e]">
              <li>
                <span className="hover:text-[#0b1c30] transition-colors cursor-pointer">
                  Cancellation &amp; Refund Rules
                </span>
              </li>
              <li>
                <span className="hover:text-[#0b1c30] transition-colors cursor-pointer">
                  Tatkal &amp; Premium Tatkal T&amp;C
                </span>
              </li>
              <li>
                <span className="hover:text-[#0b1c30] transition-colors cursor-pointer">
                  IRCTC Partner Terms of Service
                </span>
              </li>
              <li>
                <span className="hover:text-[#0b1c30] transition-colors cursor-pointer">
                  Data Privacy &amp; Tokenization
                </span>
              </li>
            </ul>
          </div>

          {/* Col 4: 24x7 Assistance */}
          <div>
            <div className="font-label-md text-label-md text-[#0b1c30] uppercase font-bold mb-space-sm tracking-wider">
              24x7 Assistance
            </div>
            <ul className="space-y-space-xs font-body-sm text-body-sm text-[#44474e]">
              <li className="flex items-center gap-space-xs">
                <span className="material-symbols-outlined text-[16px] text-[#964900]">call</span>
                <a href="tel:139" className="hover:underline font-semibold text-[#0b1c30]">
                  RailMadad: 139 (Toll-Free)
                </a>
              </li>
              <li className="flex items-center gap-space-xs">
                <span className="material-symbols-outlined text-[16px] text-[#964900]">chat</span>
                <button type="button" onClick={onOpenDisha} className="hover:underline text-left cursor-pointer">
                  Ask DISHA AI Assistant
                </button>
              </li>
              <li className="flex items-center gap-space-xs">
                <span className="material-symbols-outlined text-[16px] text-[#964900]">security</span>
                <a href="tel:182" className="hover:underline">
                  Security Helpline: 182
                </a>
              </li>
              <li className="flex items-center gap-space-xs">
                <span className="material-symbols-outlined text-[16px] text-[#964900]">mail</span>
                <a href="mailto:support@quickrail.irctc.in" className="hover:underline">
                  support@quickrail.irctc.in
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom copyright line */}
        <div className="mt-space-xl pt-space-lg flex flex-col md:flex-row items-center justify-between gap-space-sm font-label-sm text-label-sm text-[#44474e] border-t border-[#eff4ff]">
          <p>
            © 2025 Quick Rail Ltd. Official Authorized Service Provider of Indian Railway Catering and Tourism Corporation
            (IRCTC). All Rights Reserved.
          </p>
          <div className="flex items-center gap-gutter">
            <span className="hover:text-[#0b1c30] transition-colors cursor-pointer">Security Standards</span>
            <span className="hover:text-[#0b1c30] transition-colors cursor-pointer">Privacy Policy</span>
            <span className="hover:text-[#0b1c30] transition-colors cursor-pointer">Refund Policy</span>
          </div>
        </div>
      </div>
    </footer>
  );
};
