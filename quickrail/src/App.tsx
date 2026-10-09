import React, { useState, useEffect } from 'react';
import { ScreenType, Train, CoachClass, BookingState, Passenger, UserProfile, PaymentDetails } from './types';
import { INITIAL_TRAINS, MASTER_PASSENGERS } from './data/mockData';
import { Header } from './components/Header';
import { Footer } from './components/Footer';
import { HomeScreen } from './components/HomeScreen';
import { SearchResultsScreen } from './components/SearchResultsScreen';
import { PassengerPreferencesScreen } from './components/PassengerPreferencesScreen';
import { ConfirmedTicketScreen } from './components/ConfirmedTicketScreen';
import { AuthScreen } from './components/AuthScreen';
import { PaymentGatewayScreen } from './components/PaymentGatewayScreen';
import { QuickRailAI } from './components/ai/QuickRailAI';
import { CateringModal } from './components/CateringModal';
import { PnrEnquiryModal } from './components/PnrEnquiryModal';
import { RailWalletModal } from './components/RailWalletModal';
import { apiMe, apiCreateBooking, apiGetWallet, getToken, setToken, ApiError } from './services/api';
import { MyBookingsScreen } from './components/MyBookingsScreen';
import QuickBid from './components/QuickBid';

export function App() {
  const [currentScreen, setCurrentScreen] = useState<ScreenType>('home');
  const [previousScreen, setPreviousScreen] = useState<ScreenType>('home');
  const [language, setLanguage] = useState<'ENG' | 'हिन्दी'>('ENG');

  // User Profile state — starts as a signed-out guest; a real session is restored
  // below from a stored JWT (if any) via GET /api/auth/me.
  const [currentUser, setCurrentUser] = useState<UserProfile>({
    id: 'guest',
    name: 'Guest Traveler',
    irctcUsername: 'guest_user',
    email: '',
    mobile: '',
    isAadhaarVerified: false,
    walletBalance: 0,
    isLoggedIn: false,
  });

  // Restore a logged-in session on load if a valid token is already stored.
  useEffect(() => {
    const token = getToken();
    if (!token) return;
    apiMe()
      .then(({ user }) => {
        setCurrentUser({
          id: user.id,
          name: user.name,
          irctcUsername: user.irctcUsername,
          email: user.email,
          mobile: user.mobile,
          isAadhaarVerified: user.isAadhaarVerified,
          city: user.city,
          state: user.state,
          pincode: user.pincode,
          occupation: user.occupation,
          walletBalance: user.walletBalance,
          isLoggedIn: true,
        });
      })
      .catch(() => {
        // Stored token is invalid/expired — clear it and stay signed out.
        setToken(null);
      });
  }, []);

  const [authInitialMode, setAuthInitialMode] = useState<'signin' | 'register'>('signin');

  // The real backend booking behind the current in-progress purchase (set once
  // PassengerPreferencesScreen hands off to payment). Payment cannot proceed without it.
  const [backendBookingId, setBackendBookingId] = useState<string | null>(null);
  const [bookingError, setBookingError] = useState('');
  const [isCreatingBooking, setIsCreatingBooking] = useState(false);

  // Search parameters
  const [fromStation, setFromStation] = useState('NDLS - New Delhi');
  const [toStation, setToStation] = useState('MMCT - Mumbai Central');
  const [journeyDate, setJourneyDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().split('T')[0];
  });
  const [travelQuota, setTravelQuota] = useState('GN');
  const [travelClass, setTravelClass] = useState('3A');

  // Active selection
  const [selectedTrain, setSelectedTrain] = useState<Train>(INITIAL_TRAINS[0]);
  const [selectedClass, setSelectedClass] = useState<CoachClass>(INITIAL_TRAINS[0].classes[0]);

  // Active booking for Confirmed screen & Payment
  const [currentBooking, setCurrentBooking] = useState<BookingState>({
    fromStation: 'NDLS - New Delhi',
    toStation: 'MMCT - Mumbai Central',
    journeyDate: 'Fri, 18 Oct 2024',
    quota: 'General (GN)',
    selectedTrain: INITIAL_TRAINS[0],
    selectedClass: INITIAL_TRAINS[0].classes[0],
    passengers: [
      {
        id: 'p-1',
        name: 'Rahul Sharma',
        age: 34,
        gender: 'Male',
        berthPreference: 'Side Lower (SL)',
        mealOption: 'Veg (Standard)',
        isSeniorCitizenQuota: false,
      },
    ],
    contactMobile: '+91 98765 43210',
    contactEmail: 'rahul.sharma@example.com',
    autoUpgradation: true,
    bookOnlyIfConfirm: true,
    preferredCoach: 'B4',
    quickRailAssured: true,
    travelInsurance: true,
    totalAmount: 2677.95,
    pnr: '241-9084321',
    transactionId: 'TXN-8849201948',
    bookingTime: 'Today, 10:14 AM',
  });

  // Modals state
  const [isDishaOpen, setIsDishaOpen] = useState(false);
  const [isCateringOpen, setIsCateringOpen] = useState(false);
  const [isPnrModalOpen, setIsPnrModalOpen] = useState(false);
  const [isWalletOpen, setIsWalletOpen] = useState(false);
  const [walletTopUpAmount, setWalletTopUpAmount] = useState<number | undefined>(undefined);

  // Authentication Navigation
  const handleOpenAuth = (mode: 'signin' | 'register' = 'signin') => {
    setAuthInitialMode(mode);
    setPreviousScreen(currentScreen);
    setCurrentScreen('login');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleLoginSuccess = (profile: UserProfile) => {
    setCurrentUser(profile);
    // Return to previous screen or results
    if (previousScreen === 'passenger' || previousScreen === 'results') {
      setCurrentScreen(previousScreen);
    } else {
      setCurrentScreen('home');
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleLogout = () => {
    setToken(null);
    setCurrentUser({
      id: 'guest',
      name: 'Guest Traveler',
      irctcUsername: 'guest_user',
      email: '',
      mobile: '',
      isAadhaarVerified: false,
      walletBalance: 0,
      isLoggedIn: false,
    });
  };

  // Navigation handlers
  const handleSearch = (from: string, to: string, date: string, quota: string, tClass: string) => {
    setFromStation(from);
    setToStation(to);
    setJourneyDate(date);
    setTravelQuota(quota);
    setTravelClass(tClass);
    setCurrentScreen('results');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSelectRouteFromPopular = (from: string, to: string, trainNumber?: string) => {
    setFromStation(from);
    setToStation(to);
    if (trainNumber) {
      const match = INITIAL_TRAINS.find((t) => t.number === trainNumber);
      if (match) {
        setSelectedTrain(match);
        setSelectedClass(match.classes[0]);
      }
    }
    setCurrentScreen('results');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSelectTrainAndClass = (train: Train, coachClass: CoachClass) => {
    setSelectedTrain(train);
    setSelectedClass(coachClass);
    setCurrentScreen('passenger');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleProceedToPayment = async (bookingData: {
    passengers: Passenger[];
    contactMobile: string;
    contactEmail: string;
    autoUpgradation: boolean;
    bookOnlyIfConfirm: boolean;
    preferredCoach: string;
    quickRailAssured: boolean;
    travelInsurance: boolean;
    totalAmount: number;
  }) => {
    if (!currentUser.isLoggedIn) {
      handleOpenAuth('signin');
      return;
    }

    setBookingError('');
    setIsCreatingBooking(true);
    try {
      const stationCode = (label: string) => label.split(' - ')[0].split(' ')[0].trim();

      const { booking: backendBooking } = await apiCreateBooking({
        trainNumber: selectedTrain.number,
        classCode: selectedClass.classCode,
        journeyDate,
        fromStationCode: stationCode(fromStation),
        toStationCode: stationCode(toStation),
        quota: travelQuota,
        contactMobile: bookingData.contactMobile,
        contactEmail: bookingData.contactEmail,
        preferredCoach: bookingData.preferredCoach || 'B4',
        autoUpgradation: bookingData.autoUpgradation,
        bookOnlyIfConfirm: bookingData.bookOnlyIfConfirm,
        quickRailAssured: bookingData.quickRailAssured,
        travelInsurance: bookingData.travelInsurance,
        passengers: bookingData.passengers.map((p) => ({
          name: p.name,
          age: p.age,
          gender: p.gender,
          berthPreference: p.berthPreference,
          mealOption: p.mealOption,
          isSeniorCitizenQuota: p.isSeniorCitizenQuota,
          isChildWithoutBerth: p.isChildWithoutBerth,
        })),
      });

      setBackendBookingId(backendBooking.id);
      setCurrentBooking({
        fromStation,
        toStation,
        journeyDate,
        quota: travelQuota === 'GN' ? 'General (GN)' : travelQuota === 'TQ' ? 'Tatkal (TQ)' : travelQuota,
        selectedTrain,
        selectedClass,
        passengers: bookingData.passengers,
        contactMobile: bookingData.contactMobile,
        contactEmail: bookingData.contactEmail,
        autoUpgradation: bookingData.autoUpgradation,
        bookOnlyIfConfirm: bookingData.bookOnlyIfConfirm,
        preferredCoach: bookingData.preferredCoach || 'B4',
        quickRailAssured: bookingData.quickRailAssured,
        travelInsurance: bookingData.travelInsurance,
        pnr: backendBooking.pnr,
        transactionId: '',
        bookingTime: 'Just Now',
        totalAmount: backendBooking.totalAmount,
      });

      setCurrentScreen('payment');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err) {
      setBookingError(err instanceof ApiError ? err.message : 'Could not create booking. Please try again.');
    } finally {
      setIsCreatingBooking(false);
    }
  };

  const handlePaymentSuccess = (paymentDetails: PaymentDetails, backendBooking: any) => {
    setCurrentBooking((prev) => ({
      ...prev,
      paymentDetails,
      pnr: backendBooking?.pnr || prev.pnr,
      totalAmount: backendBooking?.totalAmount ?? paymentDetails.netPayable,
    }));

    if (paymentDetails.method === 'wallet') {
      // Wallet balance changed server-side — pull the authoritative figure back.
      apiGetWallet()
        .then(({ balance }) => setCurrentUser((prev) => ({ ...prev, walletBalance: balance })))
        .catch(() => {
          setCurrentUser((prev) => ({
            ...prev,
            walletBalance: Math.max(0, prev.walletBalance - paymentDetails.netPayable),
          }));
        });
    }

    setCurrentScreen('confirmed');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleOpenPnrStatus = (pnrNumber: string) => {
    setCurrentBooking((prev) => ({
      ...prev,
      pnr: pnrNumber.includes('-') ? pnrNumber : `${pnrNumber.slice(0, 3)}-${pnrNumber.slice(3)}`,
    }));
    setCurrentScreen('confirmed');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#f8f9ff] text-[#0b1c30]">
      {/* Fixed Global Header */}
      <Header
        currentScreen={currentScreen}
        onNavigate={(screen) => {
          setCurrentScreen(screen);
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
        onOpenDisha={() => setIsDishaOpen(true)}
        onOpenPnrModal={() => setIsPnrModalOpen(true)}
        onOpenWallet={() => setIsWalletOpen(true)}
        onOpenCatering={() => setIsCateringOpen(true)}
        currentUser={currentUser}
        onNavigateToAuth={handleOpenAuth}
        onLogout={handleLogout}
        language={language}
        onToggleLanguage={setLanguage}
      />

      {/* Screen Container with Top Margin for Fixed Header */}
      <main className="flex-1 pt-32 sm:pt-36">
        {currentScreen === 'home' && (
          <>
            <div className="max-w-[1440px] w-full mx-auto px-4 sm:px-6 pb-3 flex justify-center">
              <button
                type="button"
                onClick={() => {
                  setCurrentScreen('quickbid');
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-[#001026] via-[#12306b] to-[#001026] px-5 py-2.5 text-sm font-bold text-white shadow-lg ring-1 ring-[#ff8928]/60 transition hover:scale-[1.03] hover:ring-[#ff8928] active:scale-95"
              >
                <span className="text-[#ff8928]">⚡</span>
                QuickBid – Can you beat the AI?
                <span className="rounded-full bg-amber-300/20 px-2 py-0.5 text-[10px] font-semibold text-amber-200">
                  DEMO
                </span>
              </button>
            </div>
            <HomeScreen
              onSearch={handleSearch}
              onSelectRoute={handleSelectRouteFromPopular}
              onOpenPnrStatus={handleOpenPnrStatus}
              onOpenCatering={() => setIsCateringOpen(true)}
              onOpenDisha={() => setIsDishaOpen(true)}
            />
          </>
        )}

        {currentScreen === 'results' && (
          <SearchResultsScreen
            fromStation={fromStation}
            toStation={toStation}
            journeyDate={journeyDate}
            quota={travelQuota}
            travelClass={travelClass}
            onSelectTrainAndClass={handleSelectTrainAndClass}
            onModifySearch={() => {
              setCurrentScreen('home');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            onOpenDisha={() => setIsDishaOpen(true)}
          />
        )}

        {currentScreen === 'passenger' && (
          <>
            {bookingError && (
              <div className="max-w-[1440px] w-full mx-auto px-margin lg:px-margin-desktop pt-space-md">
                <div className="rounded-xl border border-red-300 bg-red-50 px-space-md py-3 text-red-800 text-sm font-medium">
                  {bookingError}
                </div>
              </div>
            )}
            {isCreatingBooking && (
              <div className="max-w-[1440px] w-full mx-auto px-margin lg:px-margin-desktop pt-space-md">
                <div className="rounded-xl border border-blue-200 bg-blue-50 px-space-md py-3 text-blue-800 text-sm font-medium">
                  Creating your booking and locking in seats…
                </div>
              </div>
            )}
            <PassengerPreferencesScreen
              train={selectedTrain}
              selectedClass={selectedClass}
              journeyDate={journeyDate}
              quota={travelQuota}
              currentUser={currentUser}
              onOpenAuth={handleOpenAuth}
              onBack={() => {
                setCurrentScreen('results');
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              onProceedToPayment={handleProceedToPayment}
            />
          </>
        )}

        {currentScreen === 'payment' && backendBookingId && (
          <PaymentGatewayScreen
            booking={currentBooking}
            backendBookingId={backendBookingId}
            currentUser={currentUser}
            onPaymentSuccess={handlePaymentSuccess}
            onOpenWalletTopUp={() => setIsWalletOpen(true)}
            onCancel={() => {
              setCurrentScreen('passenger');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
          />
        )}

        {currentScreen === 'login' && (
          <AuthScreen
            currentUser={currentUser}
            initialMode={authInitialMode}
            onLoginSuccess={handleLoginSuccess}
            onCancel={() => {
              setCurrentScreen(previousScreen || 'home');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
          />
        )}

        {currentScreen === 'confirmed' && (
          <ConfirmedTicketScreen
            booking={currentBooking}
            onBookAnother={() => {
              setCurrentScreen('home');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            onOpenCatering={() => setIsCateringOpen(true)}
            onOpenDisha={() => setIsDishaOpen(true)}
          />
        )}
{currentScreen === 'bookings' && (
  <MyBookingsScreen
    onBack={() => {
      setCurrentScreen('home');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }}
  />
)}
        {currentScreen === 'quickbid' && (
          <QuickBid
            onBack={() => {
              setCurrentScreen('home');
              window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
          />
        )}
      </main>

      {/* Global Footer */}
      <Footer
        onNavigate={(screen) => {
          setCurrentScreen(screen);
          window.scrollTo({ top: 0, behavior: 'smooth' });
        }}
        onOpenDisha={() => setIsDishaOpen(true)}
        onOpenPnrModal={() => setIsPnrModalOpen(true)}
      />

      {/* Interactive Modals */}
            <QuickRailAI
        isOpen={isDishaOpen}
        onOpenChange={setIsDishaOpen}
        isLoggedIn={currentUser.isLoggedIn}
        userName={currentUser.name}
        userEmail={currentUser.email}
        userMobile={currentUser.mobile}
        onRequireLogin={() => handleOpenAuth('signin')}
        onWalletChanged={(balance) =>
          setCurrentUser((prev) => ({ ...prev, walletBalance: balance }))
        }
        onOpenWallet={(amount) => {
          setWalletTopUpAmount(amount);
          setIsWalletOpen(true);
        }}
      />

      <CateringModal
        isOpen={isCateringOpen}
        onClose={() => setIsCateringOpen(false)}
        pnrNumber={currentBooking.pnr}
      />

      <PnrEnquiryModal
        isOpen={isPnrModalOpen}
        onClose={() => setIsPnrModalOpen(false)}
        onViewTicket={handleOpenPnrStatus}
      />

      <RailWalletModal
        initialTopUpAmount={walletTopUpAmount}
        isOpen={isWalletOpen}
        onClose={() => {
          setIsWalletOpen(false);
          setWalletTopUpAmount(undefined);
        }}
        balance={currentUser.walletBalance}
        onTopUpSuccess={(newBal) => {
          setCurrentUser((prev) => ({ ...prev, walletBalance: newBal }));
        }}
      />
    </div>
  );
}

export default App;
