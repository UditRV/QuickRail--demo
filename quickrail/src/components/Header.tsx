import React, { useState } from 'react';
import { ScreenType, UserProfile } from '../types';
import { QUICK_RAIL_LOGO, USER_AVATAR } from '../data/mockData';

interface HeaderProps {
  currentScreen: ScreenType;
  onNavigate: (screen: ScreenType) => void;
  onOpenDisha: () => void;
  onOpenPnrModal: () => void;
  onOpenWallet: () => void;
  onOpenCatering: () => void;
  language: 'ENG' | 'हिन्दी';
  onToggleLanguage: (lang: 'ENG' | 'हिन्दी') => void;
  currentUser: UserProfile;
  onNavigateToAuth: (mode?: 'signin' | 'register') => void;
  onLogout: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentScreen,
  onNavigate,
  onOpenDisha,
  onOpenPnrModal,
  onOpenWallet,
  onOpenCatering,
  language,
  onToggleLanguage,
  currentUser,
  onNavigateToAuth,
  onLogout,
}) => {
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
  return (
    <header className="fixed top-0 w-full z-50 bg-white/95 backdrop-blur-md shadow-[0_1px_8px_rgba(0,0,0,0.04)] border-b border-[#eff4ff]">
      {/* Top Notification Strip */}
      <div className="bg-[#001026] text-white py-space-xs px-margin lg:px-margin-desktop">
        <div className="max-w-[1440px] mx-auto flex flex-wrap items-center justify-between gap-gutter">
          <div className="flex items-center gap-space-sm font-label-sm text-[11px]">
            <span className="flex items-center text-[#ff8928] font-bold">
              <span className="material-symbols-outlined text-[15px] mr-space-xs text-[#ff8928]">bolt</span>
              TATKAL BOOKING OPENS:
            </span>
            <span className="bg-white/15 px-space-sm py-0.5 rounded-lg text-white font-data-mono text-[11px]">
              10:00 AM (AC)
            </span>
            <span className="text-[#cbdbf5]">•</span>
            <span className="bg-white/15 px-space-sm py-0.5 rounded-lg text-white font-data-mono text-[11px]">
              11:00 AM (Non-AC)
            </span>
          </div>

          <div className="flex items-center gap-space-md">
            <div className="flex items-center gap-space-xs text-white font-label-sm text-[11px]">
              <span className="material-symbols-outlined text-[15px] text-[#ff8928]">support_agent</span>
              <span>RailMadad Helpline:</span>
              <a href="tel:139" className="font-bold font-data-mono hover:underline">139</a>
            </div>
            <span className="text-[#74777f]">|</span>
            <div className="flex items-center gap-space-xs font-label-sm text-[11px]">
              <button
                type="button"
                onClick={() => onToggleLanguage('ENG')}
                className={`transition-colors cursor-pointer ${
                  language === 'ENG' ? 'text-white font-bold' : 'text-[#c4c6cf] hover:text-white'
                }`}
              >
                ENG
              </button>
              <span className="text-[#74777f]">/</span>
              <button
                type="button"
                onClick={() => onToggleLanguage('हिन्दी')}
                className={`transition-colors cursor-pointer ${
                  language === 'हिन्दी' ? 'text-white font-bold' : 'text-[#c4c6cf] hover:text-white'
                }`}
              >
                हिन्दी
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main App Navigation Bar */}
      <div className="h-20 max-w-[1440px] mx-auto px-margin lg:px-margin-desktop flex items-center justify-between gap-gutter">
        {/* Brand Logo */}
        <div className="flex items-center gap-gutter">
          <button
            type="button"
            onClick={() => onNavigate('home')}
            className="flex items-center gap-space-md text-left cursor-pointer group"
          >
            <img
              alt="Quick Rail Logo"
              className="h-8 w-auto object-contain transition-transform group-hover:scale-105"
              src={QUICK_RAIL_LOGO}
            />
            <div className="flex flex-col">
              <span className="font-headline-md text-headline-md text-[#001026] tracking-tight font-bold">
                Quick Rail
              </span>
              <div className="flex items-center gap-space-xs">
                <span className="w-1.5 h-1.5 rounded-full bg-[#ff8928]"></span>
                <span className="font-label-sm text-[11px] text-[#44474e]">IRCTC Authorized Partner</span>
              </div>
            </div>
          </button>
        </div>

        {/* Navigation Links */}
        <nav className="hidden xl:flex items-center gap-space-xs">
          <button
            type="button"
            onClick={() => onNavigate(currentScreen === 'home' ? 'results' : 'home')}
            className={`px-space-md py-space-sm font-label-lg text-label-lg rounded-lg transition-colors cursor-pointer font-bold ${
              currentScreen === 'home' || currentScreen === 'results'
                ? 'bg-[#0b2545] text-white'
                : 'text-[#44474e] hover:text-[#0b1c30] hover:bg-[#eff4ff]'
            }`}
          >
            Book Train
          </button>

          <button
            type="button"
            onClick={onOpenPnrModal}
            className="px-space-md py-space-sm font-label-lg text-label-lg text-[#44474e] hover:text-[#0b1c30] hover:bg-[#eff4ff] rounded-lg transition-colors cursor-pointer"
          >
            PNR Enquiry
          </button>

          <button
            type="button"
            onClick={() => onNavigate('confirmed')}
            className={`px-space-md py-space-sm font-label-lg text-label-lg rounded-lg transition-colors cursor-pointer ${
              currentScreen === 'confirmed'
                ? 'bg-[#0b2545] text-white font-bold'
                : 'text-[#44474e] hover:text-[#0b1c30] hover:bg-[#eff4ff]'
            }`}
          >
            Running Status
          </button>

          <button
            type="button"
            onClick={() => onNavigate('results')}
            className="px-space-md py-space-sm font-label-lg text-label-lg text-[#44474e] hover:text-[#0b1c30] hover:bg-[#eff4ff] rounded-lg transition-colors cursor-pointer"
          >
            Tourist Trains
          </button>

          <button
            type="button"
            onClick={onOpenCatering}
            className="px-space-md py-space-sm font-label-lg text-label-lg text-[#44474e] hover:text-[#0b1c30] hover:bg-[#eff4ff] rounded-lg transition-colors cursor-pointer flex items-center gap-1"
          >
            <span>Meals &amp; Catering</span>
            <span className="bg-[#ff8928]/15 text-[#964900] text-[9px] font-bold px-1 py-0.5 rounded">NEW</span>
          </button>

          <button
            type="button"
            onClick={onOpenDisha}
            className="px-space-md py-space-sm font-label-lg text-label-lg text-[#44474e] hover:text-[#0b1c30] hover:bg-[#eff4ff] rounded-lg transition-colors cursor-pointer flex items-center gap-1.5"
          >
            <span className="material-symbols-outlined text-[16px] text-[#ff8928]">smart_toy</span>
            <span>Ask DISHA 2.0</span>
          </button>

          <button
            type="button"
            onClick={() => onNavigateToAuth('signin')}
            className={`px-space-md py-space-sm font-label-lg text-label-lg rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 ${
              currentScreen === 'login'
                ? 'bg-[#0b2545] text-white font-bold'
                : 'text-[#44474e] hover:text-[#0b1c30] hover:bg-[#eff4ff]'
            }`}
          >
            <span className="material-symbols-outlined text-[16px] text-[#964900]">badge</span>
            <span>IRCTC Portal</span>
          </button>
        </nav>

        {/* Right User & Wallet controls */}
        <div className="flex items-center gap-gutter relative">
          <button
            type="button"
            onClick={onOpenWallet}
            className="hidden sm:flex items-center gap-space-sm bg-[#eff4ff] hover:bg-[#e5eeff] px-space-md py-space-xs rounded-lg transition-colors cursor-pointer border border-[#d3e4fe]/60"
            title="Open RailWallet"
          >
            <span className="material-symbols-outlined text-[18px] text-[#964900]">account_balance_wallet</span>
            <div className="flex flex-col text-left">
              <span className="font-label-sm text-[10px] text-[#44474e] leading-none">RailWallet</span>
              <span className="font-data-mono text-data-mono font-bold text-[#0b1c30] leading-none mt-0.5">
                ₹{currentUser.walletBalance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
              </span>
            </div>
          </button>

          {currentUser.isLoggedIn ? (
            <div className="relative">
              <button
                type="button"
                onClick={() => setProfileDropdownOpen(!profileDropdownOpen)}
                className="flex items-center gap-space-sm pl-space-xs cursor-pointer p-1 rounded-lg hover:bg-[#eff4ff] transition-colors"
              >
                <img
                  alt="Profile"
                  className="w-8 h-8 rounded-full object-cover ring-2 ring-[#d5e3ff]"
                  src={USER_AVATAR}
                />
                <div className="hidden md:flex flex-col text-left">
                  <span className="font-label-md text-label-md text-[#0b1c30] font-bold leading-snug">
                    {currentUser.name.split(' ')[0]}
                  </span>
                  <span className="font-label-sm text-[10px] text-[#44474e] leading-none flex items-center gap-0.5">
                    <span className="material-symbols-outlined text-[11px] text-green-600">verified</span>
                    IRCTC Verified
                  </span>
                </div>
                <span className="material-symbols-outlined text-[16px] text-gray-500">
                  {profileDropdownOpen ? 'expand_less' : 'expand_more'}
                </span>
              </button>

              {/* Profile Dropdown */}
              {profileDropdownOpen && (
                <div className="absolute right-0 mt-2 w-64 bg-white rounded-xl shadow-xl border border-[#eff4ff] p-space-sm z-50 animate-in fade-in zoom-in-95">
                  <div className="p-space-sm bg-[#eff4ff] rounded-lg mb-2">
                    <div className="font-bold text-[#001026] text-[13px]">{currentUser.name}</div>
                    <div className="font-data-mono text-[11px] text-[#74777f]">
                      ID: {currentUser.irctcUsername}
                    </div>
                    <div className="mt-1 flex items-center gap-1 text-[10px] text-green-800 font-bold bg-green-100 px-1.5 py-0.5 rounded w-fit">
                      <span className="material-symbols-outlined text-[12px]">verified</span>
                      <span>Aadhaar e-KYC (24 Tix/Mo)</span>
                    </div>
                  </div>

                  <div className="space-y-0.5 text-[12px]">
                    <button
                      type="button"
                      onClick={() => {
                        setProfileDropdownOpen(false);
                        onNavigate('bookings');
                      }}
                      className="w-full text-left px-3 py-2 rounded-md hover:bg-[#f8f9ff] text-[#001026] flex items-center gap-2 cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-[16px] text-[#ff8928]">confirmation_number</span>
                      <span>My Bookings &amp; PNRs</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setProfileDropdownOpen(false);
                        onOpenWallet();
                      }}
                      className="w-full text-left px-3 py-2 rounded-md hover:bg-[#f8f9ff] text-[#001026] flex items-center gap-2 cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-[16px] text-[#964900]">account_balance_wallet</span>
                      <span>RailWallet (₹{currentUser.walletBalance.toFixed(2)})</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setProfileDropdownOpen(false);
                        onNavigateToAuth('signin');
                      }}
                      className="w-full text-left px-3 py-2 rounded-md hover:bg-[#f8f9ff] text-[#001026] flex items-center gap-2 cursor-pointer"
                    >
                      <span className="material-symbols-outlined text-[16px] text-blue-600">switch_account</span>
                      <span>Switch Account</span>
                    </button>

                    <div className="border-t border-[#eff4ff] my-1"></div>

                    <button
                      type="button"
                      onClick={() => {
                        setProfileDropdownOpen(false);
                        onLogout();
                      }}
                      className="w-full text-left px-3 py-2 rounded-md hover:bg-red-50 text-red-600 flex items-center gap-2 cursor-pointer font-semibold"
                    >
                      <span className="material-symbols-outlined text-[16px]">logout</span>
                      <span>Logout from IRCTC</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <button
              type="button"
              onClick={() => onNavigateToAuth('signin')}
              className="px-space-md py-2 bg-[#ff8928] hover:bg-[#964900] active:scale-[0.98] text-white font-label-md text-label-md font-bold rounded-lg transition-all shadow-sm flex items-center gap-1.5 cursor-pointer"
            >
              <span className="material-symbols-outlined text-[16px]">login</span>
              <span>Login / Register</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
