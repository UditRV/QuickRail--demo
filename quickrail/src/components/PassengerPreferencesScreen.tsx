import React, { useState, useEffect } from 'react';
import { Train, CoachClass, Passenger, UserProfile } from '../types';
import { MASTER_PASSENGERS, DESTINATION_MUMBAI_IMAGE } from '../data/mockData';

interface PassengerPreferencesScreenProps {
  train: Train;
  selectedClass: CoachClass;
  journeyDate: string;
  quota: string;
  onBack: () => void;
  currentUser?: UserProfile;
  onOpenAuth?: (mode?: 'signin' | 'register') => void;
  onProceedToPayment: (bookingData: {
    passengers: Passenger[];
    contactMobile: string;
    contactEmail: string;
    autoUpgradation: boolean;
    bookOnlyIfConfirm: boolean;
    preferredCoach: string;
    quickRailAssured: boolean;
    travelInsurance: boolean;
    totalAmount: number;
  }) => void;
}

export const PassengerPreferencesScreen: React.FC<PassengerPreferencesScreenProps> = ({
  train,
  selectedClass,
  journeyDate,
  quota,
  onBack,
  currentUser,
  onOpenAuth,
  onProceedToPayment,
}) => {
  // 10-minute timer for reservation lock
  const [lockSeconds, setLockSeconds] = useState(9 * 60 + 42);

  // Passengers list state
  const [passengers, setPassengers] = useState<Passenger[]>([
    {
      id: 'p-1',
      name: currentUser?.name || 'Rahul Sharma',
      age: 34,
      gender: 'Male',
      berthPreference: 'Side Lower (SL)',
      mealOption: 'Veg (Standard)',
      isSeniorCitizenQuota: false,
    },
  ]);

  // Master passengers toggle tracker
  const [addedMasterIds, setAddedMasterIds] = useState<string[]>(['mp-1']);

  // Contact details
  const [mobile, setMobile] = useState(currentUser?.mobile || '9876543210');
  const [email, setEmail] = useState(currentUser?.email || 'rahul.sharma@example.com');
  const [whatsappUpdates, setWhatsappUpdates] = useState(true);

  // Travel preferences
  const [autoUpgradation, setAutoUpgradation] = useState(true);
  const [bookOnlyIfConfirm, setBookOnlyIfConfirm] = useState(true);
  const [preferredCoach, setPreferredCoach] = useState('B4');

  // Trip protection
  const [quickRailAssured, setQuickRailAssured] = useState(true);
  const [travelInsurance, setTravelInsurance] = useState(true);

  // IRCTC user state
  const [irctcUsername, setIrctcUsername] = useState(currentUser?.irctcUsername || 'rahul_sharma_irctc');
  const [isEditingIrctc, setIsEditingIrctc] = useState(false);

  useEffect(() => {
    if (currentUser?.irctcUsername) {
      setIrctcUsername(currentUser.irctcUsername);
    }
    if (currentUser?.email) {
      setEmail(currentUser.email);
    }
    if (currentUser?.mobile) {
      setMobile(currentUser.mobile);
    }
  }, [currentUser]);

  // Countdown effect
  useEffect(() => {
    const timer = setInterval(() => {
      setLockSeconds((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  const formatLockTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  // Passenger management
  const handleAddAdult = () => {
    const newPassenger: Passenger = {
      id: `p-${Date.now()}`,
      name: '',
      age: 28,
      gender: 'Male',
      berthPreference: 'No Preference',
      mealOption: 'Veg (Standard)',
      isSeniorCitizenQuota: false,
    };
    setPassengers([...passengers, newPassenger]);
  };

  const handleAddChild = () => {
    const newPassenger: Passenger = {
      id: `p-${Date.now()}`,
      name: '',
      age: 4,
      gender: 'Female',
      berthPreference: 'No Preference',
      mealOption: 'No Food (-₹325)',
      isSeniorCitizenQuota: false,
      isChildWithoutBerth: true,
    };
    setPassengers([...passengers, newPassenger]);
  };

  const handleRemovePassenger = (id: string) => {
    if (passengers.length === 1) return;
    setPassengers(passengers.filter((p) => p.id !== id));
  };

  const handleUpdatePassenger = (id: string, updates: Partial<Passenger>) => {
    setPassengers(passengers.map((p) => (p.id === id ? { ...p, ...updates } : p)));
  };

  const handleToggleMasterPassenger = (mp: typeof MASTER_PASSENGERS[0]) => {
    const exists = passengers.some((p) => p.name.toLowerCase() === mp.name.toLowerCase());
    if (exists) {
      if (passengers.length > 1) {
        setPassengers(passengers.filter((p) => p.name.toLowerCase() !== mp.name.toLowerCase()));
        setAddedMasterIds(addedMasterIds.filter((id) => id !== mp.id));
      }
    } else {
      setPassengers([
        ...passengers,
        {
          id: `p-${Date.now()}`,
          name: mp.name,
          age: mp.age,
          gender: mp.gender,
          berthPreference: mp.berthPreference,
          mealOption: mp.mealOption,
          isSeniorCitizenQuota: mp.isSeniorCitizenQuota,
        },
      ]);
      setAddedMasterIds([...addedMasterIds, mp.id]);
    }
  };

  // Fare calculations
  const adultPassengersCount = passengers.filter((p) => !p.isChildWithoutBerth).length;
  const totalPax = passengers.length;
  const baseRate = selectedClass.price || 2380;
  const baseFare = baseRate * adultPassengersCount;
  const reservationFee = 40 * adultPassengersCount;
  const superfastSurcharge = 45 * adultPassengersCount;

  // Catering calculation: if Veg or NonVeg or Jain -> +₹325
  const cateringTotal = passengers.reduce((sum, p) => {
    return p.mealOption.includes('No Food') ? sum : sum + 325;
  }, 0);

  const insuranceFee = travelInsurance ? 0.45 * totalPax : 0;
  const assuredFee = quickRailAssured ? 149 * totalPax : 0;
  const subtotalBeforeGst = baseFare + reservationFee + superfastSurcharge + cateringTotal;
  const gst = Math.round(subtotalBeforeGst * 0.05 * 100) / 100;
  const convenienceFee = 0; // Free with UPI
  const grandTotal = Math.round((subtotalBeforeGst + gst + insuranceFee + assuredFee + convenienceFee) * 100) / 100;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onProceedToPayment({
      passengers,
      contactMobile: mobile,
      contactEmail: email,
      autoUpgradation,
      bookOnlyIfConfirm,
      preferredCoach,
      quickRailAssured,
      travelInsurance,
      totalAmount: grandTotal,
    });
  };

  return (
    <div className="flex flex-col w-full">
      {/* 1. TOP PROGRESS BREADCRUMB STRIP */}
      <div className="bg-[#001026] text-white py-space-xs px-margin lg:px-margin-desktop mb-space-md shadow-sm">
        <div className="max-w-[1440px] mx-auto flex flex-wrap items-center justify-between gap-gutter text-[11px] font-label-sm">
          <div className="flex items-center gap-space-md">
            <button
              type="button"
              onClick={onBack}
              className="flex items-center gap-1 text-[#ffdcc6] hover:text-white transition-colors cursor-pointer"
            >
              <span className="material-symbols-outlined text-[16px]">arrow_back</span>
              <span>Back to Train Search</span>
            </button>
            <span className="text-[#cbdbf5]">•</span>
            <span className="font-bold text-white">Step 2 of 3: Passenger &amp; Preferences</span>
          </div>

          <div className="flex items-center gap-space-md text-[#d5e3ff]">
            <span className="font-data-mono">IRCTC Active Secure Session #QRL-884920</span>
            <div className="w-24 bg-white/20 h-1.5 rounded-full overflow-hidden">
              <div className="bg-[#ff8928] h-full w-2/3"></div>
            </div>
          </div>
        </div>
      </div>

      {/* 2. TRAIN JOURNEY BANNER */}
      <section className="max-w-[1440px] w-full mx-auto px-margin lg:px-margin-desktop mb-space-md">
        <div className="bg-white rounded-xl p-space-md shadow-sm border border-[#eff4ff] flex flex-col lg:flex-row items-start lg:items-center justify-between gap-space-md">
          <div className="space-y-1">
            <div className="flex items-center gap-space-sm flex-wrap">
              <span className="bg-[#ff8928] text-white font-label-sm text-[11px] px-space-xs py-0.5 rounded font-bold uppercase">
                {train.badge || 'Tejas Superfast'}
              </span>
              <h2 className="font-headline-md text-headline-md text-[#001026] font-bold">
                {train.number} {train.name}
              </h2>
              <span className="text-[#74777f] font-body-sm text-body-sm">• {train.operatingDays}</span>
            </div>

            <div className="flex flex-wrap items-center gap-space-md text-body-sm text-[#44474e]">
              <span>
                <strong className="text-[#0b1c30] font-data-mono">{train.fromStationCode}</strong> ({train.departureTime},{' '}
                {journeyDate || 'Fri, 18 Oct'})
              </span>
              <span className="material-symbols-outlined text-[16px] text-[#964900]">arrow_forward</span>
              <span>
                <strong className="text-[#0b1c30] font-data-mono">{train.toStationCode}</strong> ({train.arrivalTime},{' '}
                Sat, 19 Oct)
              </span>
              <span className="text-[#c4c6cf]">|</span>
              <span>Duration: <strong className="text-[#0b1c30] font-data-mono">{train.duration}</strong></span>
              <span className="text-[#c4c6cf]">|</span>
              <span className="bg-[#eff4ff] text-[#001026] px-2 py-0.5 rounded font-label-sm text-label-sm font-semibold">
                Class: {selectedClass.classCode} ({selectedClass.name}) • {quota || 'General (GN)'}
              </span>
            </div>
          </div>

          {/* Live Lock Timer Banner */}
          <div className="bg-gradient-to-r from-[#001026] to-[#0b2545] text-white px-space-lg py-space-sm rounded-lg flex items-center gap-space-md shrink-0 shadow-sm">
            <span className="material-symbols-outlined text-[#ff8928] text-[28px] animate-pulse">lock_clock</span>
            <div>
              <div className="font-label-sm text-[10px] text-[#ffdcc6] uppercase tracking-wider font-bold">
                Reservation Lock
              </div>
              <div className="font-data-mono text-[18px] font-bold tracking-wider text-white">
                {formatLockTime(lockSeconds)}{' '}
                <span className="text-[11px] font-normal text-[#d5e3ff]">Mins Remaining</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 3. MAIN FORM & SIDEBAR GRID */}
      <form onSubmit={handleSubmit} className="max-w-[1440px] w-full mx-auto px-margin lg:px-margin-desktop mb-space-xl">
        <div className="grid grid-cols-1 lg:grid-cols-[1fr,380px] gap-gutter-desktop items-start">
          {/* LEFT FORM COLUMN */}
          <div className="space-y-space-lg">
            {/* SECTION 1: IRCTC PROFILE AUTHENTICATION */}
            <div className="bg-white rounded-xl p-space-md lg:p-space-lg shadow-sm border border-[#eff4ff]">
              <div className="flex items-center justify-between pb-space-sm border-b border-[#eff4ff]">
                <div className="flex items-center gap-space-sm">
                  <div className="w-8 h-8 rounded-full bg-[#e5eeff] text-[#001026] flex items-center justify-center font-bold font-data-mono">
                    1
                  </div>
                  <div>
                    <h3 className="font-headline-sm text-headline-sm text-[#001026] font-bold">
                      IRCTC Profile Authentication
                    </h3>
                    <p className="font-body-sm text-[12px] text-[#44474e]">
                      Required by Indian Railways for official PNR and ticket generation
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => onOpenAuth ? onOpenAuth('signin') : setIsEditingIrctc(!isEditingIrctc)}
                    className="font-label-sm text-[12px] text-[#964900] hover:underline font-bold cursor-pointer"
                  >
                    Switch Account
                  </button>
                  <span className="text-gray-300">|</span>
                  <button
                    type="button"
                    onClick={() => onOpenAuth ? onOpenAuth('register') : null}
                    className="font-label-sm text-[12px] text-[#001026] hover:underline font-bold cursor-pointer"
                  >
                    Register New ID
                  </button>
                </div>
              </div>

              <div className="mt-space-md flex flex-col sm:flex-row items-start sm:items-center justify-between gap-space-sm bg-[#eff4ff] p-space-sm rounded-lg border border-[#d3e4fe]/50">
                <div className="flex items-center gap-space-sm">
                  <span className="material-symbols-outlined text-green-700 text-[22px]">badge</span>
                  <div>
                    <span className="font-label-sm text-[11px] text-[#74777f] block">Linked IRCTC User Profile</span>
                    {isEditingIrctc ? (
                      <input
                        type="text"
                        value={irctcUsername}
                        onChange={(e) => setIrctcUsername(e.target.value)}
                        className="bg-white px-2 py-0.5 rounded font-data-mono text-[#001026] text-[13px] border border-gray-300"
                      />
                    ) : (
                      <div className="flex items-center gap-2">
                        <span className="font-data-mono text-[14px] font-bold text-[#001026]">{irctcUsername}</span>
                        {currentUser?.isAadhaarVerified && (
                          <span className="text-[10px] bg-green-100 text-green-800 font-bold px-1.5 py-0.2 rounded">
                            Aadhaar e-KYC
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
                <span className="bg-green-100 text-green-800 px-space-sm py-1 rounded font-label-sm text-[11px] font-bold flex items-center gap-1">
                  <span className="material-symbols-outlined text-[14px]">check_circle</span>
                  ID Verified &amp; Master List Synced
                </span>
              </div>
              <p className="text-[11px] text-[#74777f] mt-2 flex items-center gap-1">
                <span className="material-symbols-outlined text-[14px] text-[#964900]">info</span>
                Important: You will enter your IRCTC password after payment to verify ticket issuance.
              </p>
            </div>

            {/* SECTION 2: PASSENGER DETAILS */}
            <div className="bg-white rounded-xl p-space-md lg:p-space-lg shadow-sm border border-[#eff4ff]">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-space-sm border-b border-[#eff4ff] gap-space-xs">
                <div className="flex items-center gap-space-sm">
                  <div className="w-8 h-8 rounded-full bg-[#e5eeff] text-[#001026] flex items-center justify-center font-bold font-data-mono">
                    2
                  </div>
                  <div>
                    <h3 className="font-headline-sm text-headline-sm text-[#001026] font-bold">Passenger Details</h3>
                    <p className="font-body-sm text-[12px] text-[#44474e]">
                      Must match government issued ID (Aadhaar, Voter ID, Passport)
                    </p>
                  </div>
                </div>
                <span className="font-label-sm text-[12px] text-[#74777f]">
                  {passengers.length} of 6 Allowed Passengers
                </span>
              </div>

              {/* QUICK ADD FROM MASTER PASSENGER LIST */}
              <div className="mt-space-md bg-[#eff4ff] p-space-sm rounded-lg border border-[#d3e4fe]/40">
                <div className="font-label-sm text-[11px] text-[#44474e] uppercase font-bold mb-1.5 flex items-center gap-1">
                  <span className="material-symbols-outlined text-[16px] text-[#ff8928]">quickreference</span>
                  Quick Add from Saved Master Passenger List:
                </div>
                <div className="flex flex-wrap gap-space-xs">
                  {MASTER_PASSENGERS.map((mp) => {
                    const isAdded = passengers.some((p) => p.name.toLowerCase() === mp.name.toLowerCase());
                    return (
                      <button
                        key={mp.id}
                        type="button"
                        onClick={() => handleToggleMasterPassenger(mp)}
                        className={`px-space-sm py-1 rounded font-label-sm text-[12px] transition-all flex items-center gap-1 cursor-pointer ${
                          isAdded
                            ? 'bg-[#001026] text-white font-bold shadow-sm'
                            : 'bg-white text-[#0b1c30] hover:bg-[#dce9ff] border border-[#dce9ff]'
                        }`}
                      >
                        <span className="material-symbols-outlined text-[14px]">
                          {isAdded ? 'check' : 'add'}
                        </span>
                        <span>
                          {mp.name} ({mp.age}, {mp.gender.charAt(0)})
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* PASSENGERS CARDS */}
              <div className="mt-space-md space-y-space-md">
                {passengers.map((passenger, index) => (
                  <div
                    key={passenger.id}
                    className="bg-[#f8f9ff] rounded-lg p-space-md border border-[#eff4ff] relative transition-shadow hover:shadow-xs"
                  >
                    <div className="flex items-center justify-between mb-space-sm">
                      <span className="font-label-sm text-label-sm font-bold text-[#001026] flex items-center gap-1">
                        <span className="material-symbols-outlined text-[16px] text-[#964900]">person</span>
                        Passenger #{index + 1} {index === 0 ? '(Primary Traveler)' : ''}
                      </span>
                      {passengers.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemovePassenger(passenger.id)}
                          className="text-red-600 hover:text-red-800 font-label-sm text-[11px] flex items-center gap-0.5 cursor-pointer"
                        >
                          <span className="material-symbols-outlined text-[14px]">delete</span>
                          <span>Remove</span>
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-space-sm items-center">
                      {/* Name */}
                      <div className="sm:col-span-6">
                        <label className="block font-label-sm text-[11px] text-[#44474e] mb-0.5">
                          Full Name (as on ID)
                        </label>
                        <input
                          type="text"
                          required
                          value={passenger.name}
                          placeholder="e.g. Rahul Sharma"
                          onChange={(e) => handleUpdatePassenger(passenger.id, { name: e.target.value })}
                          className="w-full bg-white px-space-sm py-1.5 rounded font-label-md text-label-md text-[#001026] border border-[#dce9ff] focus:outline-none focus:border-[#ff8928]"
                        />
                      </div>

                      {/* Age */}
                      <div className="sm:col-span-2">
                        <label className="block font-label-sm text-[11px] text-[#44474e] mb-0.5">Age</label>
                        <input
                          type="number"
                          min={1}
                          max={120}
                          required
                          value={passenger.age}
                          onChange={(e) =>
                            handleUpdatePassenger(passenger.id, { age: parseInt(e.target.value) || 0 })
                          }
                          className="w-full bg-white px-space-sm py-1.5 rounded font-data-mono text-[13px] text-[#001026] border border-[#dce9ff] focus:outline-none focus:border-[#ff8928]"
                        />
                      </div>

                      {/* Gender */}
                      <div className="sm:col-span-4">
                        <label className="block font-label-sm text-[11px] text-[#44474e] mb-0.5">Gender</label>
                        <select
                          value={passenger.gender}
                          onChange={(e) =>
                            handleUpdatePassenger(passenger.id, {
                              gender: e.target.value as 'Male' | 'Female' | 'Transgender',
                            })
                          }
                          className="w-full bg-white px-space-sm py-1.5 rounded font-label-sm text-[12px] text-[#001026] border border-[#dce9ff] focus:outline-none focus:border-[#ff8928] cursor-pointer"
                        >
                          <option value="Male">Male</option>
                          <option value="Female">Female</option>
                          <option value="Transgender">Transgender</option>
                        </select>
                      </div>

                      {/* Berth Preference */}
                      <div className="sm:col-span-6">
                        <label className="block font-label-sm text-[11px] text-[#44474e] mb-0.5">
                          Berth Preference
                        </label>
                        <select
                          value={passenger.berthPreference}
                          onChange={(e) =>
                            handleUpdatePassenger(passenger.id, {
                              berthPreference: e.target.value as Passenger['berthPreference'],
                            })
                          }
                          className="w-full bg-white px-space-sm py-1.5 rounded font-label-sm text-[12px] text-[#001026] border border-[#dce9ff] focus:outline-none focus:border-[#ff8928] cursor-pointer"
                        >
                          <option value="No Preference">No Preference</option>
                          <option value="Lower (LB)">Lower Berth (LB)</option>
                          <option value="Middle (MB)">Middle Berth (MB)</option>
                          <option value="Upper (UB)">Upper Berth (UB)</option>
                          <option value="Side Lower (SL)">Side Lower (SL)</option>
                          <option value="Side Upper (SU)">Side Upper (SU)</option>
                        </select>
                      </div>

                      {/* Food Choice */}
                      <div className="sm:col-span-6">
                        <label className="block font-label-sm text-[11px] text-[#44474e] mb-0.5">
                          IRCTC Catering / Meals
                        </label>
                        <select
                          value={passenger.mealOption}
                          onChange={(e) =>
                            handleUpdatePassenger(passenger.id, {
                              mealOption: e.target.value as Passenger['mealOption'],
                            })
                          }
                          className="w-full bg-white px-space-sm py-1.5 rounded font-label-sm text-[12px] text-[#001026] border border-[#dce9ff] focus:outline-none focus:border-[#ff8928] cursor-pointer"
                        >
                          <option value="Veg (Standard)">Veg (Standard IRCTC) +₹325</option>
                          <option value="Non-Veg (Egg/Chicken)">Non-Veg (Egg / Chicken) +₹325</option>
                          <option value="Jain Meal">Jain Meal (No onion/garlic) +₹325</option>
                          <option value="No Food (-₹325)">Opt-Out of Food (-₹325)</option>
                        </select>
                      </div>
                    </div>

                    {/* Senior Citizen concession checkbox */}
                    <div className="mt-space-xs pt-1 flex items-center justify-between border-t border-[#eff4ff]">
                      <label className="flex items-center gap-space-xs cursor-pointer">
                        <input
                          type="checkbox"
                          checked={passenger.isSeniorCitizenQuota}
                          onChange={(e) =>
                            handleUpdatePassenger(passenger.id, { isSeniorCitizenQuota: e.target.checked })
                          }
                          className="w-3.5 h-3.5 rounded text-[#0b2545] accent-[#0b2545]"
                        />
                        <span className="font-label-sm text-[11px] text-[#44474e]">
                          Senior Citizen Quota / Lower Berth request (Male 60+ / Female 58+)
                        </span>
                      </label>
                      {passenger.isChildWithoutBerth && (
                        <span className="text-[11px] bg-amber-100 text-amber-900 px-1.5 py-0.5 rounded font-semibold">
                          Child under 5 without berth (Free)
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Add Passenger Action Buttons */}
              <div className="mt-space-md flex flex-wrap items-center gap-space-sm">
                <button
                  type="button"
                  onClick={handleAddAdult}
                  className="px-space-md py-1.5 bg-[#eff4ff] hover:bg-[#dce9ff] text-[#001026] rounded-lg font-label-md text-label-md font-bold transition-colors flex items-center gap-1 cursor-pointer border border-[#d3e4fe]"
                >
                  <span className="material-symbols-outlined text-[18px]">add</span>
                  <span>Add Adult (+12 Yrs)</span>
                </button>
                <button
                  type="button"
                  onClick={handleAddChild}
                  className="px-space-md py-1.5 bg-[#eff4ff] hover:bg-[#dce9ff] text-[#001026] rounded-lg font-label-md text-label-md font-bold transition-colors flex items-center gap-1 cursor-pointer border border-[#d3e4fe]"
                >
                  <span className="material-symbols-outlined text-[18px]">child_care</span>
                  <span>Add Child (Under 5 Yrs, No Berth)</span>
                </button>
              </div>
            </div>

            {/* SECTION 3: CONTACT & NOTIFICATION DETAILS */}
            <div className="bg-white rounded-xl p-space-md lg:p-space-lg shadow-sm border border-[#eff4ff]">
              <div className="flex items-center gap-space-sm pb-space-sm border-b border-[#eff4ff]">
                <div className="w-8 h-8 rounded-full bg-[#e5eeff] text-[#001026] flex items-center justify-center font-bold font-data-mono">
                  3
                </div>
                <div>
                  <h3 className="font-headline-sm text-headline-sm text-[#001026] font-bold">
                    Contact &amp; Notification Details
                  </h3>
                  <p className="font-body-sm text-[12px] text-[#44474e]">
                    Tickets and live PNR alerts will be dispatched to these channels
                  </p>
                </div>
              </div>

              <div className="mt-space-md grid grid-cols-1 sm:grid-cols-2 gap-space-md">
                <div>
                  <label className="block font-label-sm text-[11px] text-[#44474e] mb-1">
                    Mobile Number (for SMS &amp; WhatsApp)
                  </label>
                  <div className="flex items-center bg-[#f8f9ff] rounded border border-[#dce9ff] px-space-sm py-1.5 focus-within:border-[#ff8928]">
                    <span className="font-data-mono text-[13px] text-[#74777f] mr-2">+91</span>
                    <input
                      type="tel"
                      required
                      value={mobile}
                      onChange={(e) => setMobile(e.target.value)}
                      className="bg-transparent w-full font-data-mono text-[14px] text-[#001026] focus:outline-none"
                    />
                  </div>
                  <label className="flex items-center gap-1.5 mt-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={whatsappUpdates}
                      onChange={(e) => setWhatsappUpdates(e.target.checked)}
                      className="w-3.5 h-3.5 rounded text-green-700 accent-green-700"
                    />
                    <span className="text-[11px] text-[#44474e] flex items-center gap-1">
                      <span className="material-symbols-outlined text-green-600 text-[14px]">chat</span>
                      Send instant confirmation &amp; platform updates on WhatsApp
                    </span>
                  </label>
                </div>

                <div>
                  <label className="block font-label-sm text-[11px] text-[#44474e] mb-1">
                    Email Address (for Official Tax Invoice)
                  </label>
                  <div className="flex items-center bg-[#f8f9ff] rounded border border-[#dce9ff] px-space-sm py-1.5 focus-within:border-[#ff8928]">
                    <span className="material-symbols-outlined text-[18px] text-[#74777f] mr-2">mail</span>
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="bg-transparent w-full font-body-sm text-[13px] text-[#001026] focus:outline-none"
                    />
                  </div>
                  <span className="text-[11px] text-[#74777f] block mt-1.5">
                    GST invoice eligible for corporate tax credit
                  </span>
                </div>
              </div>
            </div>

            {/* SECTION 4: ADDITIONAL TRAVEL PREFERENCES */}
            <div className="bg-white rounded-xl p-space-md lg:p-space-lg shadow-sm border border-[#eff4ff]">
              <div className="flex items-center gap-space-sm pb-space-sm border-b border-[#eff4ff]">
                <div className="w-8 h-8 rounded-full bg-[#e5eeff] text-[#001026] flex items-center justify-center font-bold font-data-mono">
                  4
                </div>
                <div>
                  <h3 className="font-headline-sm text-headline-sm text-[#001026] font-bold">
                    Additional Travel Preferences
                  </h3>
                  <p className="font-body-sm text-[12px] text-[#44474e]">
                    Seat allocation optimization and auto-upgradation settings
                  </p>
                </div>
              </div>

              <div className="mt-space-md space-y-space-sm">
                <label className="flex items-start gap-space-sm p-space-sm rounded-lg bg-[#eff4ff] hover:bg-[#e5eeff] cursor-pointer transition-colors border border-[#d3e4fe]/40">
                  <input
                    type="checkbox"
                    checked={autoUpgradation}
                    onChange={(e) => setAutoUpgradation(e.target.checked)}
                    className="w-4 h-4 rounded text-[#0b2545] accent-[#0b2545] mt-0.5"
                  />
                  <div>
                    <span className="font-label-md text-label-md font-bold text-[#001026] block">
                      Consider for Free Auto-Upgradation
                    </span>
                    <span className="font-body-sm text-[12px] text-[#44474e]">
                      Get automatically upgraded to 2A (AC 2 Tier) or 1A (AC First) at chart preparation without extra cost if
                      higher class berths are vacant.
                    </span>
                  </div>
                </label>

                <label className="flex items-start gap-space-sm p-space-sm rounded-lg bg-[#eff4ff] hover:bg-[#e5eeff] cursor-pointer transition-colors border border-[#d3e4fe]/40">
                  <input
                    type="checkbox"
                    checked={bookOnlyIfConfirm}
                    onChange={(e) => setBookOnlyIfConfirm(e.target.checked)}
                    className="w-4 h-4 rounded text-[#0b2545] accent-[#0b2545] mt-0.5"
                  />
                  <div>
                    <span className="font-label-md text-label-md font-bold text-[#001026] block">
                      Book only if confirmed berths are allotted
                    </span>
                    <span className="font-body-sm text-[12px] text-[#44474e]">
                      Prevents issuance of RAC or Waitlisted tickets if availability changes mid-transaction.
                    </span>
                  </div>
                </label>

                <div className="p-space-sm rounded-lg bg-[#eff4ff] flex items-center justify-between gap-space-sm border border-[#d3e4fe]/40">
                  <div>
                    <span className="font-label-md text-label-md font-bold text-[#001026] block">
                      Preferred Coach ID (Optional)
                    </span>
                    <span className="font-body-sm text-[12px] text-[#44474e]">
                      Specify a coach number if traveling with colleagues or family (e.g. B4, B2)
                    </span>
                  </div>
                  <input
                    type="text"
                    maxLength={4}
                    value={preferredCoach}
                    onChange={(e) => setPreferredCoach(e.target.value.toUpperCase())}
                    className="w-20 bg-white px-2 py-1 rounded text-center font-data-mono font-bold text-[#001026] border border-[#dce9ff]"
                  />
                </div>
              </div>
            </div>

            {/* SECTION 5: TRIP PROTECTION & GUARANTEES */}
            <div className="bg-white rounded-xl p-space-md lg:p-space-lg shadow-sm border border-[#eff4ff]">
              <div className="flex items-center gap-space-sm pb-space-sm border-b border-[#eff4ff]">
                <div className="w-8 h-8 rounded-full bg-[#e5eeff] text-[#001026] flex items-center justify-center font-bold font-data-mono">
                  5
                </div>
                <div>
                  <h3 className="font-headline-sm text-headline-sm text-[#001026] font-bold">
                    Trip Protection &amp; Guarantees
                  </h3>
                  <p className="font-body-sm text-[12px] text-[#44474e]">
                    Zero risk cancellation &amp; accidental rail passenger insurance
                  </p>
                </div>
              </div>

              <div className="mt-space-md space-y-space-sm">
                {/* Quick Rail Assured */}
                <div className="p-space-md rounded-lg bg-gradient-to-r from-[#eff4ff] to-[#dce9ff] border border-[#d3e4fe] flex items-start justify-between gap-space-md">
                  <div className="flex items-start gap-space-sm">
                    <span className="material-symbols-outlined text-[#ff8928] text-[28px] shrink-0">verified_user</span>
                    <div>
                      <div className="flex items-center gap-space-sm flex-wrap">
                        <span className="font-headline-sm text-headline-sm font-bold text-[#001026]">
                          Quick Rail Assured Zero Cancellation
                        </span>
                        <span className="bg-[#ff8928] text-white text-[10px] font-bold px-1.5 py-0.5 rounded">
                          RECOMMENDED
                        </span>
                      </div>
                      <p className="font-body-sm text-[12px] text-[#44474e] mt-0.5">
                        Get 100% full refund including IRCTC cancellation fees with zero penalty if you cancel up to 4 hours
                        before chart preparation.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-space-sm shrink-0">
                    <span className="font-data-mono text-[12px] font-bold text-[#001026]">+₹149/pax</span>
                    <button
                      type="button"
                      onClick={() => setQuickRailAssured(!quickRailAssured)}
                      className={`w-12 h-6 rounded-full transition-colors relative cursor-pointer ${
                        quickRailAssured ? 'bg-[#ff8928]' : 'bg-gray-300'
                      }`}
                    >
                      <span
                        className={`block w-5 h-5 rounded-full bg-white transition-transform transform shadow-sm ${
                          quickRailAssured ? 'translate-x-6.5' : 'translate-x-0.5'
                        }`}
                      ></span>
                    </button>
                  </div>
                </div>

                {/* Travel Insurance */}
                <div className="p-space-sm rounded-lg bg-[#eff4ff] border border-[#d3e4fe]/40 flex items-center justify-between gap-space-md">
                  <label className="flex items-center gap-space-sm cursor-pointer">
                    <input
                      type="checkbox"
                      checked={travelInsurance}
                      onChange={(e) => setTravelInsurance(e.target.checked)}
                      className="w-4 h-4 rounded text-[#0b2545] accent-[#0b2545]"
                    />
                    <div>
                      <span className="font-label-md text-label-md font-bold text-[#001026] block">
                        IRCTC Partner Rail Travel Insurance (₹0.45 per passenger)
                      </span>
                      <span className="font-body-sm text-[11px] text-[#44474e]">
                        Comprehensive coverage up to ₹10,00,000 for hospitalisation and transit incidents via SBI General
                        Insurance.
                      </span>
                    </div>
                  </label>
                  <span className="font-data-mono text-[12px] font-bold text-green-700 shrink-0">Opted-In</span>
                </div>
              </div>
            </div>
          </div>

          {/* RIGHT STICKY FARE BREAKDOWN COLUMN */}
          <div className="space-y-space-md lg:sticky lg:top-28">
            {/* STICKY FARE CARD */}
            <div className="bg-white rounded-xl p-space-md lg:p-space-lg shadow-md border border-[#eff4ff]">
              <div className="pb-space-sm border-b border-[#eff4ff]">
                <h3 className="font-headline-sm text-headline-sm text-[#001026] font-bold">Fare Breakdown</h3>
                <span className="font-body-sm text-[12px] text-[#74777f]">
                  Calculated for {adultPassengersCount} Adult(s)
                </span>
              </div>

              <div className="py-space-md space-y-space-xs font-body-sm text-[13px] text-[#44474e]">
                <div className="flex items-center justify-between">
                  <span>Base Ticket Fare ({selectedClass.classCode})</span>
                  <span className="font-data-mono text-[#001026] font-semibold">₹{baseFare.toFixed(2)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Reservation Fee</span>
                  <span className="font-data-mono text-[#001026]">₹{reservationFee.toFixed(2)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Superfast Charge</span>
                  <span className="font-data-mono text-[#001026]">₹{superfastSurcharge.toFixed(2)}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Tatkal / Dynamic Surcharge</span>
                  <span className="font-data-mono text-[#001026]">₹0.00</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Catering &amp; Meals ({passengers.length} pax)</span>
                  <span className="font-data-mono text-[#001026]">₹{cateringTotal.toFixed(2)}</span>
                </div>
                {travelInsurance && (
                  <div className="flex items-center justify-between">
                    <span>Rail Travel Insurance</span>
                    <span className="font-data-mono text-[#001026]">₹{insuranceFee.toFixed(2)}</span>
                  </div>
                )}
                {quickRailAssured && (
                  <div className="flex items-center justify-between text-[#964900]">
                    <span className="font-semibold">Quick Rail Assured</span>
                    <span className="font-data-mono font-bold">₹{assuredFee.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex items-center justify-between">
                  <span>GST (5%)</span>
                  <span className="font-data-mono text-[#001026]">₹{gst.toFixed(2)}</span>
                </div>
                <div className="flex items-center justify-between text-green-700">
                  <span className="font-semibold">Payment Gateway Fee</span>
                  <span className="font-data-mono font-bold uppercase">FREE</span>
                </div>
              </div>

              {/* Total Payable Row */}
              <div className="pt-space-md border-t border-[#eff4ff] flex items-center justify-between mb-space-md">
                <div>
                  <span className="font-label-sm text-[11px] text-[#74777f] block">Total Payable Amount</span>
                  <span className="font-headline-lg text-headline-lg font-data-mono text-[#001026] font-bold">
                    ₹{grandTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>
                <span className="bg-green-100 text-green-800 text-[11px] font-bold px-2 py-0.5 rounded">
                  All Taxes Included
                </span>
              </div>

              {/* PROCEED TO PAYMENT CTA */}
              <button
                type="submit"
                className="w-full py-space-md bg-[#ff8928] hover:bg-[#964900] active:scale-[0.98] text-white font-headline-sm text-headline-sm rounded-lg shadow-lg flex items-center justify-center gap-space-sm transition-all tracking-wide font-bold cursor-pointer"
              >
                <span>PROCEED TO PAYMENT</span>
                <span className="material-symbols-outlined text-[20px]">arrow_forward</span>
              </button>

              <div className="mt-space-sm text-center">
                <span className="font-label-sm text-[11px] text-[#74777f] flex items-center justify-center gap-1">
                  <span className="material-symbols-outlined text-[14px] text-green-600">lock</span>
                  Secured with 256-Bit SSL Banking Protocol
                </span>
              </div>
            </div>

            {/* TRAVEL DESTINATION SPOTLIGHT WIDGET */}
            <div className="bg-white rounded-xl overflow-hidden shadow-sm border border-[#eff4ff]">
              <div className="h-32 w-full relative">
                <img
                  src={DESTINATION_MUMBAI_IMAGE}
                  alt="Mumbai Central"
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#001026]/90 via-[#001026]/40 to-transparent"></div>
                <div className="absolute bottom-2 left-3 right-3 text-white">
                  <div className="font-label-sm text-[10px] text-[#ffdcc6] uppercase font-bold">Destination Transit</div>
                  <div className="font-headline-sm text-[15px] font-bold">Arriving into Mumbai Central (MMCT)</div>
                </div>
              </div>
              <div className="p-space-sm text-[#44474e] text-[12px] space-y-1">
                <div className="flex items-center justify-between">
                  <span>Expected Weather:</span>
                  <strong className="text-[#0b1c30]">28°C Clear Skies</strong>
                </div>
                <div className="flex items-center justify-between">
                  <span>Connecting Metro:</span>
                  <strong className="text-[#0b1c30]">Line 3 Aqua Line (Subway)</strong>
                </div>
              </div>
            </div>
          </div>
        </div>
      </form>
    </div>
  );
};
