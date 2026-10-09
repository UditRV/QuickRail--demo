import React, { useState, useEffect } from 'react';
import { POPULAR_ROUTES } from '../data/mockData';
import { ScreenType } from '../types';
import { apiGetDestinationStations, apiGetStations, type StationOption } from '../services/api';

const toDateInputValue = (date: Date) => {
  const localDate = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return localDate.toISOString().slice(0, 10);
};

const secondsUntilLocalTime = (hour: number) => {
  const now = new Date();
  const target = new Date(now);
  target.setHours(hour, 0, 0, 0);
  if (target.getTime() <= now.getTime()) target.setDate(target.getDate() + 1);
  return Math.ceil((target.getTime() - now.getTime()) / 1000);
};

interface HomeScreenProps {
  onSearch: (from: string, to: string, date: string, quota: string, travelClass: string) => void;
  onSelectRoute: (from: string, to: string, trainNumber?: string) => void;
  onOpenPnrStatus: (pnr: string) => void;
  onOpenCatering: () => void;
  onOpenDisha: () => void;
}

export const HomeScreen: React.FC<HomeScreenProps> = ({
  onSearch,
  onSelectRoute,
  onOpenPnrStatus,
  onOpenCatering,
  onOpenDisha,
}) => {
  // Tatkal radar countdown in seconds
  const [acSeconds, setAcSeconds] = useState(() => secondsUntilLocalTime(10));
  const [nonAcSeconds, setNonAcSeconds] = useState(() => secondsUntilLocalTime(11));
  const [reminderSet, setReminderSet] = useState(false);

  // Search state
  const [fromStation, setFromStation] = useState('NDLS - New Delhi (New Delhi)');
  const [toStation, setToStation] = useState('MMCT - Mumbai Central (Mumbai)');
  const [stations, setStations] = useState<StationOption[]>([]);
  const [destinationStations, setDestinationStations] = useState<StationOption[]>([]);
  const [isLoadingDestinations, setIsLoadingDestinations] = useState(false);
  const [travelClass, setTravelClass] = useState('VB');
  const [travelQuota, setTravelQuota] = useState('GN');
  const [isSwapping, setIsSwapping] = useState(false);
  const [activeDateOffset, setActiveDateOffset] = useState<'0' | '1' | 'weekend'>('1');
  const [journeyDate, setJourneyDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().split('T')[0];
  });
  const [datePreviewText, setDatePreviewText] = useState('Tomorrow, Friday • High seat churn');
  const bookingMinDate = toDateInputValue(new Date());
  const bookingMaxDate = (() => {
    const date = new Date();
    date.setDate(date.getDate() + 196);
    return toDateInputValue(date);
  })();

  // Include code, full name and city in the value so the browser's native
  // searchable dropdown can match abbreviations, names and city keywords.
  const stationValue = (station: StationOption) => `${station.code} - ${station.name} (${station.city})`;
  const stationCode = (value: string) => value.split(' - ')[0];

  useEffect(() => {
    apiGetStations().then(({ stations: results }) => setStations(results)).catch(() => setStations([]));
  }, []);

  useEffect(() => {
    const selectedFrom = stations.find((station) => stationValue(station) === fromStation);
    if (!selectedFrom) {
      setDestinationStations([]);
      setIsLoadingDestinations(false);
      return;
    }

    const fromCode = selectedFrom.code;
    setIsLoadingDestinations(true);
    apiGetDestinationStations(fromCode)
      .then(({ stations: results }) => {
        setDestinationStations(results);
        if (results.length && !results.some((station) => stationValue(station) === toStation)) {
          setToStation(stationValue(results[0]));
        }
      })
      .catch(() => setDestinationStations([]))
      .finally(() => setIsLoadingDestinations(false));
  }, [fromStation, stations]);

  // PNR Widget State
  const [pnrInput, setPnrInput] = useState('');
  const [isCheckingPnr, setIsCheckingPnr] = useState(false);
  const [pnrError, setPnrError] = useState(false);

  // Spot Train Widget State
  const [trainSpotInput, setTrainSpotInput] = useState('12004 - LKO SHTBDI');
  const [isSpotting, setIsSpotting] = useState(false);
  const [spotSuccess, setSpotSuccess] = useState(true);

  // Recalculate against the local system clock every second, rather than
  // decrementing a fixed demo number. AC opens at 10 AM, non-AC at 11 AM.
  useEffect(() => {
    const updateTatkalCountdowns = () => {
      setAcSeconds(secondsUntilLocalTime(10));
      setNonAcSeconds(secondsUntilLocalTime(11));
    };
    updateTatkalCountdowns();
    const timer = setInterval(updateTatkalCountdowns, 1000);
    return () => clearInterval(timer);
  }, []);

  const formatAcTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}m ${String(s).padStart(2, '0')}s`;
  };

  const formatNonAcTime = (secs: number) => {
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    return `${h}h ${m}m ${String(s).padStart(2, '0')}s`;
  };

  const handleSwapStations = () => {
    setIsSwapping(true);
    setTimeout(() => {
      setFromStation(toStation);
      setToStation(fromStation);
      setIsSwapping(false);
    }, 150);
  };

  const handleDateOffset = (offset: '0' | '1' | 'weekend') => {
    setActiveDateOffset(offset);
    const target = new Date();
    if (offset === '1') {
      target.setDate(target.getDate() + 1);
    } else if (offset === 'weekend') {
      const day = target.getDay();
      const diff = (6 - day + 7) % 7 || 7;
      target.setDate(target.getDate() + diff);
    }
    const iso = target.toISOString().split('T')[0];
    setJourneyDate(iso);

    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    setDatePreviewText(`${days[target.getDay()]}, ${target.getDate()} ${months[target.getMonth()]} • Regular Quota Active`);
  };

  const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setJourneyDate(val);
    if (val) {
      const target = new Date(val);
      const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      setDatePreviewText(`${days[target.getDay()]}, ${target.getDate()} ${months[target.getMonth()]} • Regular Quota Active`);
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSearch(fromStation, toStation, journeyDate, travelQuota, travelClass);
  };

  const handlePnrCheck = () => {
    if (pnrInput.length < 10) {
      setPnrError(true);
      setTimeout(() => setPnrError(false), 1200);
      return;
    }
    setIsCheckingPnr(true);
    setTimeout(() => {
      setIsCheckingPnr(false);
      onOpenPnrStatus(pnrInput);
    }, 600);
  };

  const handleSpotTrain = () => {
    setIsSpotting(true);
    setTimeout(() => {
      setIsSpotting(false);
      setSpotSuccess(true);
    }, 500);
  };

  return (
    <div className="flex flex-col w-full">
      {/* TATKAL LIVE NOTIFICATION BANNER */}
      <section className="max-w-[1440px] w-full mx-auto px-margin lg:px-margin-desktop mb-space-md">
        <div className="bg-gradient-to-r from-[#0b2545] via-[#e5eeff] to-[#dce9ff] rounded-xl p-space-sm sm:p-space-md shadow-sm flex flex-col md:flex-row items-center justify-between gap-space-md text-[#0b1c30]">
          <div className="flex items-center gap-space-md min-w-0">
            <span className="flex h-3 w-3 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#ff8928] opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-[#964900]"></span>
            </span>
            <div className="flex items-center gap-space-xs font-label-lg text-label-lg">
              <span className="material-symbols-outlined text-[#964900] text-[20px]">timer</span>
              <span className="font-bold text-[#001026]">TATKAL RADAR:</span>
            </div>
            <p className="font-body-md text-body-md truncate">
              <span className="font-semibold text-[#964900]">AC Tatkal</span> opens in{' '}
              <span className="font-data-mono text-data-mono font-bold text-[#001026] bg-white px-space-xs py-0.5 rounded shadow-sm">
                {formatAcTime(acSeconds)}
              </span>{' '}
              (10:00 AM)
              <span className="text-[#c4c6cf] mx-space-xs">|</span>
              <span className="font-semibold text-[#001026]">Non-AC Tatkal</span> in{' '}
              <span className="font-data-mono text-data-mono font-bold text-[#001026] bg-white px-space-xs py-0.5 rounded shadow-sm">
                {formatNonAcTime(nonAcSeconds)}
              </span>{' '}
              (11:00 AM)
            </p>
          </div>
          <div className="flex items-center gap-space-sm shrink-0">
            <span className="font-label-sm text-label-sm text-[#44474e] bg-white/80 px-space-sm py-1 rounded">
              Pre-fill IRCTC Master List Active
            </span>
            <button
              type="button"
              onClick={() => setReminderSet(!reminderSet)}
              className={`font-label-md text-label-md px-space-md py-1.5 rounded transition-colors shadow-sm cursor-pointer ${
                reminderSet ? 'bg-green-700 text-white' : 'bg-[#001026] text-white hover:bg-[#495f82]'
              }`}
            >
              {reminderSet ? 'Reminder Set ✓' : 'Set Reminder'}
            </button>
          </div>
        </div>
      </section>

      {/* HERO & HIGH-VELOCITY BOOKING MATRIX */}
      <section className="max-w-[1440px] w-full mx-auto px-margin lg:px-margin-desktop mb-space-xl">
        <div className="relative rounded-xl overflow-hidden bg-[#001026] shadow-xl">
          {/* Background Graphic Accents */}
          <div className="absolute inset-0 opacity-15 pointer-events-none">
            <svg className="w-full h-full" fill="none" viewBox="0 0 1440 600" xmlns="http://www.w3.org/2000/svg">
              <path
                className="text-[#b1c7f0]"
                d="M-100 150 Q 300 50, 700 250 T 1540 180"
                stroke="currentColor"
                strokeDasharray="8 8"
                strokeWidth="2"
              ></path>
              <path
                className="text-[#ffdcc6]"
                d="M-100 220 Q 400 320, 900 120 T 1600 300"
                stroke="currentColor"
                strokeWidth="1.5"
              ></path>
              <circle
                className="text-[#00254c]"
                cx="720"
                cy="220"
                fill="radial-gradient(circle, currentColor 0%, transparent 70%)"
                opacity="0.4"
                r="380"
              ></circle>
            </svg>
          </div>

          <div className="relative z-10 p-space-lg lg:p-space-xl">
            {/* Hero Micro Header */}
            <div className="flex flex-wrap items-center justify-between gap-space-sm mb-space-lg">
              <div className="flex items-center gap-space-sm">
                <span className="bg-[#ff8928] text-white font-label-sm text-[11px] px-space-sm py-0.5 rounded uppercase font-bold tracking-wider">
                  Zero Payment Gateway Fee
                </span>
                <span className="text-[#d5e3ff] font-body-sm text-body-sm flex items-center gap-1">
                  <span className="material-symbols-outlined text-[16px] text-[#ffdcc6]">verified</span>
                  Authorized IRCTC API Provider
                </span>
              </div>
              <div className="text-[#a7c8ff] font-data-mono text-data-mono flex items-center gap-space-sm text-[12px]">
                <span className="inline-block w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
                <span>IRCTC SERVER SPEED: 42ms</span>
              </div>
            </div>

            {/* MAIN SEARCH CARD */}
            <div className="bg-white text-[#0b1c30] rounded-xl shadow-2xl p-space-md lg:p-space-lg">
              <form onSubmit={handleSearchSubmit} className="space-y-space-md">
                {/* STATIONS ROW WITH SWAP INTERACTION */}
                <div className="grid grid-cols-1 lg:grid-cols-[1fr,auto,1fr] gap-space-xs items-center relative">
                  {/* Origin Station */}
                  <div className="relative flex-1 bg-[#eff4ff] hover:bg-[#e5eeff] rounded-lg p-space-sm transition-colors cursor-text focus-within:bg-white focus-within:shadow-md border border-[#d3e4fe]/40">
                    <label
                      className="block font-label-sm text-label-sm text-[#44474e] uppercase font-semibold"
                      htmlFor="origin-station-input"
                    >
                      From Station
                    </label>
                    <div className="flex items-center gap-space-sm mt-0.5">
                      <span className="material-symbols-outlined text-[#964900] text-[22px]">train</span>
                      <input
                        className="w-full min-w-0 bg-transparent font-headline-sm text-headline-sm text-[#001026] font-bold focus:outline-none placeholder:text-[#74777f]"
                        id="origin-station-input"
                        list="origin-station-options"
                        placeholder="Type code, station or city"
                        type="text"
                        value={fromStation}
                        onChange={(e) => setFromStation(e.target.value)}
                      />
                      <datalist id="origin-station-options">
                        {stations.map((station) => (
                          <option key={station.code} value={stationValue(station)} />
                        ))}
                      </datalist>
                    </div>
                    <div className="text-[#44474e] font-body-sm text-body-sm mt-0.5 truncate">
                      Select any station in the QuickRail network
                    </div>
                  </div>

                  {/* Station Swap Button */}
                  <div className="flex justify-center -my-2 lg:my-0 z-20">
                    <button
                      type="button"
                      onClick={handleSwapStations}
                      className={`w-10 h-10 rounded-full bg-[#0b2545] text-white flex items-center justify-center hover:bg-[#ff8928] hover:scale-105 active:scale-95 transition-all shadow-md cursor-pointer ${
                        isSwapping ? 'rotate-180 duration-300' : ''
                      }`}
                      title="Swap Stations"
                    >
                      <span className="material-symbols-outlined text-[20px]">sync_alt</span>
                    </button>
                  </div>

                  {/* Destination Station */}
                  <div className="relative flex-1 bg-[#eff4ff] hover:bg-[#e5eeff] rounded-lg p-space-sm transition-colors cursor-text focus-within:bg-white focus-within:shadow-md border border-[#d3e4fe]/40">
                    <label
                      className="block font-label-sm text-label-sm text-[#44474e] uppercase font-semibold"
                      htmlFor="dest-station-input"
                    >
                      To Station
                    </label>
                    <div className="flex items-center gap-space-sm mt-0.5">
                      <span className="material-symbols-outlined text-[#964900] text-[22px]">location_on</span>
                      <input
                        className="w-full min-w-0 bg-transparent font-headline-sm text-headline-sm text-[#001026] font-bold focus:outline-none placeholder:text-[#74777f] disabled:opacity-60"
                        id="dest-station-input"
                        list="destination-station-options"
                        placeholder={isLoadingDestinations ? 'Loading destinations…' : 'Type code, station or city'}
                        type="text"
                        value={toStation}
                        onChange={(e) => setToStation(e.target.value)}
                        disabled={isLoadingDestinations || destinationStations.length === 0}
                      />
                      <datalist id="destination-station-options">
                        {destinationStations.map((station) => (
                          <option key={station.code} value={stationValue(station)} />
                        ))}
                      </datalist>
                    </div>
                    <div className="text-[#44474e] font-body-sm text-body-sm mt-0.5 truncate">
                      {isLoadingDestinations ? 'Loading available destinations…' : `${destinationStations.length} direct destination${destinationStations.length === 1 ? '' : 's'} available`}
                    </div>
                  </div>
                </div>

                {/* DATE & FILTERS ROW */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-space-md">
                  {/* Date Picker & Quick Toggles */}
                  <div className="bg-[#eff4ff] rounded-lg p-space-sm flex flex-col justify-between border border-[#d3e4fe]/40">
                    <div className="flex items-center justify-between mb-1">
                      <label
                        className="font-label-sm text-label-sm text-[#44474e] uppercase font-semibold"
                        htmlFor="journey-date-input"
                      >
                        Journey Date
                      </label>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleDateOffset('0')}
                          className={`px-space-xs py-0.5 font-label-sm text-[11px] rounded transition-colors cursor-pointer ${
                            activeDateOffset === '0'
                              ? 'bg-[#0b2545] text-white font-bold shadow-sm'
                              : 'bg-[#e5eeff] text-[#44474e] hover:bg-[#dce9ff]'
                          }`}
                        >
                          Today
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDateOffset('1')}
                          className={`px-space-xs py-0.5 font-label-sm text-[11px] rounded transition-colors cursor-pointer ${
                            activeDateOffset === '1'
                              ? 'bg-[#0b2545] text-white font-bold shadow-sm'
                              : 'bg-[#e5eeff] text-[#44474e] hover:bg-[#dce9ff]'
                          }`}
                        >
                          Tomorrow
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDateOffset('weekend')}
                          className={`px-space-xs py-0.5 font-label-sm text-[11px] rounded transition-colors cursor-pointer ${
                            activeDateOffset === 'weekend'
                              ? 'bg-[#0b2545] text-white font-bold shadow-sm'
                              : 'bg-[#e5eeff] text-[#44474e] hover:bg-[#dce9ff]'
                          }`}
                        >
                          Weekend
                        </button>
                      </div>
                    </div>
                    <div className="flex items-center gap-space-sm">
                      <span className="material-symbols-outlined text-[#964900] text-[20px]">calendar_month</span>
                      <input
                        className="bg-transparent font-headline-sm text-headline-sm text-[#001026] font-bold focus:outline-none cursor-pointer w-full"
                        id="journey-date-input"
                        type="date"
                        value={journeyDate}
                        min={bookingMinDate}
                        max={bookingMaxDate}
                        onChange={handleDateChange}
                      />
                    </div>
                    <div className="text-[#44474e] font-body-sm text-body-sm mt-1">{datePreviewText}</div>
                  </div>

                  {/* All Classes Dropdown */}
                  <div className="bg-[#eff4ff] rounded-lg p-space-sm flex flex-col justify-between border border-[#d3e4fe]/40">
                    <label
                      className="block font-label-sm text-label-sm text-[#44474e] uppercase font-semibold mb-1"
                      htmlFor="travel-class-select"
                    >
                      Class Option
                    </label>
                    <div className="flex items-center gap-space-sm">
                      <span className="material-symbols-outlined text-[#964900] text-[20px]">airline_seat_recline_extra</span>
                      <select
                        className="w-full bg-transparent font-headline-sm text-headline-sm text-[#001026] font-bold focus:outline-none cursor-pointer"
                        id="travel-class-select"
                        value={travelClass}
                        onChange={(e) => setTravelClass(e.target.value)}
                      >
                        <option value="ALL">All Classes (1A, 2A, 3A, SL...)</option>
                        <option value="VB">Vande Bharat Chair Car (CC / EC)</option>
                        <option value="1A">AC First Class (1A)</option>
                        <option value="2A">AC 2 Tier (2A)</option>
                        <option value="3A">AC 3 Tier (3A)</option>
                        <option value="3E">AC 3 Economy (3E)</option>
                        <option value="SL">Sleeper Class (SL)</option>
                        <option value="EA">Anubhuti Class (EA)</option>
                      </select>
                    </div>
                    <div className="text-[#44474e] font-body-sm text-body-sm mt-1">
                      Tatkal quota available in 2A, 3A, CC, SL
                    </div>
                  </div>

                  {/* Quota Dropdown */}
                  <div className="bg-[#eff4ff] rounded-lg p-space-sm flex flex-col justify-between border border-[#d3e4fe]/40">
                    <label
                      className="block font-label-sm text-label-sm text-[#44474e] uppercase font-semibold mb-1"
                      htmlFor="travel-quota-select"
                    >
                      Quota / Concession
                    </label>
                    <div className="flex items-center gap-space-sm">
                      <span className="material-symbols-outlined text-[#964900] text-[20px]">groups</span>
                      <select
                        className="w-full bg-transparent font-headline-sm text-headline-sm text-[#001026] font-bold focus:outline-none cursor-pointer"
                        id="travel-quota-select"
                        value={travelQuota}
                        onChange={(e) => setTravelQuota(e.target.value)}
                      >
                        <option value="GN">General Quota (GN)</option>
                        <option value="TQ">Tatkal Quota (TQ)</option>
                        <option value="PT">Premium Tatkal (PT)</option>
                        <option value="LD">Ladies Quota (LD)</option>
                        <option value="SS">Lower Berth / Sr. Citizen (45+)</option>
                        <option value="HP">Person with Disability (Divyangjan)</option>
                        <option value="DP">Duty Pass Quota</option>
                      </select>
                    </div>
                    <div className="text-[#44474e] font-body-sm text-body-sm mt-1">
                      Official IRCTC verified quota policies apply
                    </div>
                  </div>
                </div>

                {/* SMART CHECKBOXES & CTA */}
                <div className="pt-space-xs flex flex-col lg:flex-row items-center justify-between gap-space-md">
                  <div className="flex flex-wrap items-center gap-space-md">
                    <label className="flex items-center gap-space-xs cursor-pointer group">
                      <input
                        defaultChecked
                        className="w-4 h-4 rounded bg-[#dce9ff] text-[#001026] focus:ring-0 cursor-pointer accent-[#0b2545]"
                        type="checkbox"
                      />
                      <span className="font-body-sm text-body-sm text-[#0b1c30] group-hover:text-[#001026] transition-colors">
                        Flexible with Date (±1 Day)
                      </span>
                    </label>
                    <label className="flex items-center gap-space-xs cursor-pointer group">
                      <input
                        defaultChecked
                        className="w-4 h-4 rounded bg-[#dce9ff] text-[#001026] focus:ring-0 cursor-pointer accent-[#0b2545]"
                        type="checkbox"
                      />
                      <span className="font-body-sm text-body-sm text-[#0b1c30] group-hover:text-[#001026] transition-colors">
                        Train with Available Berth only
                      </span>
                    </label>
                    <label className="flex items-center gap-space-xs cursor-pointer group">
                      <input
                        className="w-4 h-4 rounded bg-[#dce9ff] text-[#001026] focus:ring-0 cursor-pointer accent-[#0b2545]"
                        type="checkbox"
                      />
                      <span className="font-body-sm text-body-sm text-[#0b1c30] group-hover:text-[#001026] transition-colors">
                        Railway Pass Concession
                      </span>
                    </label>
                  </div>

                  {/* BIG ORANGE CONVERSION CTA */}
                  <button
                    type="submit"
                    className="w-full lg:w-auto px-space-xl py-space-md bg-[#ff8928] hover:bg-[#964900] active:scale-[0.99] text-white font-headline-sm text-headline-sm rounded-lg shadow-lg flex items-center justify-center gap-space-sm transition-all duration-150 tracking-wide font-bold cursor-pointer"
                  >
                    <span className="material-symbols-outlined text-[24px]">search</span>
                    <span>SEARCH TRAINS</span>
                    <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
                  </button>
                </div>
              </form>
            </div>

            {/* QUICK ACCESS PILLS BENEATH SEARCH */}
            <div className="mt-space-md flex flex-wrap items-center justify-between gap-space-sm text-white">
              <div className="flex flex-wrap items-center gap-space-xs font-label-sm text-label-sm">
                <span className="text-[#a7c8ff]">Recent Searches:</span>
                <button
                  type="button"
                  onClick={() => {
                    setFromStation('NDLS - New Delhi');
                    setToStation('MMCT - Mumbai Central');
                    onSearch('NDLS - New Delhi', 'MMCT - Mumbai Central', journeyDate, travelQuota, travelClass);
                  }}
                  className="bg-white/15 hover:bg-white/25 px-space-sm py-1 rounded text-white transition-colors cursor-pointer"
                >
                  NDLS ➔ MMCT (Tomorrow, VB)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setFromStation('SBC - KSR Bengaluru');
                    setToStation('MAS - Chennai Central');
                    onSearch('SBC - KSR Bengaluru', 'MAS - Chennai Central', journeyDate, travelQuota, '2A');
                  }}
                  className="bg-white/15 hover:bg-white/25 px-space-sm py-1 rounded text-white transition-colors cursor-pointer"
                >
                  SBC ➔ MAS (24 Oct, 2A)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setFromStation('HWH - Howrah Junction');
                    setToStation('PURI - Puri Railway Station');
                    onSearch('HWH - Howrah Junction', 'PURI - Puri Railway Station', journeyDate, travelQuota, travelClass);
                  }}
                  className="bg-white/15 hover:bg-white/25 px-space-sm py-1 rounded text-white transition-colors cursor-pointer"
                >
                  HWH ➔ PURI (Weekend)
                </button>
              </div>
              <div className="flex items-center gap-space-sm font-label-sm text-label-sm text-[#d5e3ff]">
                <span className="material-symbols-outlined text-[16px] text-[#ff8928]">workspace_premium</span>
                <span>Free Cancellation: 100% Refund on WL Tickets</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* DUAL UTILITY SUITE: LIVE RUNNING STATUS & PNR STATUS */}
      <section className="max-w-[1440px] w-full mx-auto px-margin lg:px-margin-desktop mb-space-xl">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-gutter-desktop">
          {/* WIDGET 1: PNR STATUS CHECKER */}
          <div className="bg-white rounded-xl p-space-lg shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between border border-[#eff4ff]">
            <div>
              <div className="flex items-center justify-between mb-space-sm">
                <div className="flex items-center gap-space-sm">
                  <div className="w-10 h-10 rounded-lg bg-[#e5eeff] flex items-center justify-center text-[#001026]">
                    <span className="material-symbols-outlined text-[24px]">confirmation_number</span>
                  </div>
                  <div>
                    <h2 className="font-headline-md text-headline-md text-[#001026] font-bold">
                      Check IRCTC PNR Status
                    </h2>
                    <p className="font-body-sm text-body-sm text-[#44474e]">
                      Instant confirmation probability, coach, and berth details
                    </p>
                  </div>
                </div>
                <span className="bg-[#eff4ff] text-[#001026] px-space-sm py-1 rounded font-label-sm text-label-sm font-semibold">
                  10-Digit PNR
                </span>
              </div>

              {/* PNR Input Form */}
              <div className="mt-space-md">
                <div className="flex flex-col sm:flex-row items-stretch gap-space-sm">
                  <div className="relative flex-1">
                    <input
                      className={`w-full bg-[#eff4ff] px-space-md py-space-sm rounded font-data-mono text-data-mono text-[#001026] text-[15px] tracking-widest focus:outline-none focus:bg-[#e5eeff] transition-colors border ${
                        pnrError ? 'border-red-500 bg-red-50' : 'border-[#d3e4fe]/50'
                      }`}
                      maxLength={10}
                      placeholder="Enter 10-Digit PNR Number"
                      type="text"
                      value={pnrInput}
                      onChange={(e) => {
                        const val = e.target.value.replace(/\D/g, '');
                        setPnrInput(val);
                      }}
                    />
                    <span className="absolute right-3 top-2.5 font-label-sm text-label-sm text-[#44474e]">
                      {pnrInput.length}/10
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={handlePnrCheck}
                    disabled={isCheckingPnr}
                    className="bg-[#001026] hover:bg-[#495f82] text-white font-label-lg text-label-lg px-space-lg py-space-sm rounded transition-colors flex items-center justify-center gap-space-xs shrink-0 cursor-pointer disabled:opacity-70"
                  >
                    {isCheckingPnr ? (
                      <>
                        <span className="material-symbols-outlined text-[18px] animate-spin">progress_activity</span>
                        <span>Verifying...</span>
                      </>
                    ) : (
                      <>
                        <span>Check Status</span>
                        <span className="material-symbols-outlined text-[18px]">bolt</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* RECENT PNR CHIP */}
              <div className="mt-space-md bg-[#eff4ff] rounded-lg p-space-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-space-xs border border-[#d3e4fe]/40">
                <button
                  type="button"
                  onClick={() => onOpenPnrStatus('241-9084321')}
                  className="flex items-center gap-space-sm min-w-0 text-left hover:opacity-85 cursor-pointer"
                >
                  <span className="material-symbols-outlined text-green-600 text-[18px]">check_circle</span>
                  <div className="truncate">
                    <span className="font-data-mono text-data-mono text-[#001026] font-bold">PNR 2419084321</span>
                    <span className="text-[#44474e] font-body-sm text-body-sm ml-1 truncate">
                      NDLS ➔ MMCT (Rajdhani Exp)
                    </span>
                  </div>
                </button>
                <div className="flex items-center gap-space-sm shrink-0">
                  <span className="bg-green-100 text-green-800 font-label-sm text-[11px] px-space-xs py-0.5 rounded font-bold">
                    B4, Berth 32 (CNF)
                  </span>
                  <button
                    type="button"
                    onClick={() => onOpenPnrStatus('241-9084321')}
                    className="text-[#964900] hover:underline font-label-sm text-label-sm font-bold cursor-pointer"
                  >
                    View Ticket
                  </button>
                </div>
              </div>
            </div>

            {/* Micro Features */}
            <div className="mt-space-md pt-space-sm flex items-center justify-between text-[#44474e] font-label-sm text-label-sm border-t border-[#eff4ff]">
              <span className="flex items-center gap-1">
                <span className="material-symbols-outlined text-[15px] text-[#964900]">notifications_active</span>
                Auto WhatsApp Alert on CNF
              </span>
              <span className="flex items-center gap-1">
                <span className="material-symbols-outlined text-[15px] text-[#964900]">history</span>
                Status syncs every 15 min
              </span>
            </div>
          </div>

          {/* WIDGET 2: LIVE TRAIN RUNNING STATUS */}
          <div className="bg-white rounded-xl p-space-lg shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between border border-[#eff4ff]">
            <div>
              <div className="flex items-center justify-between mb-space-sm">
                <div className="flex items-center gap-space-sm">
                  <div className="w-10 h-10 rounded-lg bg-[#e5eeff] flex items-center justify-center text-[#001026]">
                    <span className="material-symbols-outlined text-[24px]">radar</span>
                  </div>
                  <div>
                    <h2 className="font-headline-md text-headline-md text-[#001026] font-bold">
                      Live Train Running Status
                    </h2>
                    <p className="font-body-sm text-body-sm text-[#44474e]">
                      Real-time GPS track, delay prediction &amp; next upcoming halt
                    </p>
                  </div>
                </div>
                <span className="bg-green-100 text-green-800 px-space-sm py-1 rounded font-label-sm text-label-sm font-semibold flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-600 animate-pulse"></span>
                  GPS LIVE
                </span>
              </div>

              {/* Train Tracker Input Form */}
              <div className="mt-space-md">
                <div className="flex flex-col sm:flex-row items-stretch gap-space-sm">
                  <div className="relative flex-1">
                    <input
                      className="w-full bg-[#eff4ff] px-space-md py-space-sm rounded font-data-mono text-data-mono text-[#001026] text-[15px] focus:outline-none focus:bg-[#e5eeff] border border-[#d3e4fe]/50"
                      placeholder="Enter Train Number (e.g. 12004) or Name"
                      type="text"
                      value={trainSpotInput}
                      onChange={(e) => setTrainSpotInput(e.target.value)}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleSpotTrain}
                    className="bg-[#0b2545] hover:bg-[#495f82] text-white font-label-lg text-label-lg px-space-lg py-space-sm rounded transition-colors flex items-center justify-center gap-space-xs shrink-0 cursor-pointer"
                  >
                    {isSpotting ? (
                      <span>Locating...</span>
                    ) : (
                      <>
                        <span>Spot Train</span>
                        <span className="material-symbols-outlined text-[18px]">near_me</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* LIVE STATUS PREVIEW STRIP */}
              <div className="mt-space-md bg-[#eff4ff] rounded-lg p-space-sm border border-[#d3e4fe]/40">
                <div className="flex items-center justify-between text-[#0b1c30] mb-1">
                  <span className="font-label-md text-label-md font-bold">12004 Lucknow Shatabdi Express</span>
                  <span className="bg-green-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded uppercase">
                    On Time
                  </span>
                </div>
                <div className="flex items-center justify-between font-body-sm text-body-sm text-[#44474e]">
                  <span>
                    Departed: <strong className="text-[#0b1c30] font-data-mono">Ghaziabad (GZB)</strong>
                  </span>
                  <span>
                    Next Halt: <strong className="text-[#0b1c30] font-data-mono">Aligarh Jn (ALJN)</strong> in 22m
                  </span>
                </div>
                {/* Progress Bar */}
                <div className="w-full bg-[#dce9ff] h-2 rounded-full mt-2 overflow-hidden">
                  <div className="bg-[#ff8928] h-full rounded-full transition-all duration-500" style={{ width: '68%' }}></div>
                </div>
              </div>
            </div>

            {/* Micro Features */}
            <div className="mt-space-md pt-space-sm flex items-center justify-between text-[#44474e] font-label-sm text-label-sm border-t border-[#eff4ff]">
              <span className="flex items-center gap-1">
                <span className="material-symbols-outlined text-[15px] text-[#964900]">my_location</span>
                NTES Certified Satellite Feeds
              </span>
              <span className="flex items-center gap-1">
                <span className="material-symbols-outlined text-[15px] text-[#964900]">speed</span>
                Avg Speed 118 km/h
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* POPULAR HIGH-SPEED ROUTES SECTION */}
      <section className="max-w-[1440px] w-full mx-auto px-margin lg:px-margin-desktop mb-space-xl">
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-space-md gap-space-sm">
          <div>
            <div className="flex items-center gap-space-xs font-label-sm text-label-sm text-[#964900] uppercase font-bold tracking-wider">
              <span>High Frequency Corridors</span>
              <span>•</span>
              <span>Vande Bharat &amp; Rajdhani Specials</span>
            </div>
            <h2 className="font-headline-lg text-headline-lg text-[#001026] mt-0.5 font-bold">
              Popular Indian Rail Routes
            </h2>
          </div>
          <div className="flex items-center gap-space-xs">
            <span className="font-body-sm text-body-sm text-[#44474e]">Showing current lowest base fares</span>
          </div>
        </div>

        {/* CARDS GRID */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-gutter">
          {POPULAR_ROUTES.map((route) => (
            <div
              key={route.id}
              className="bg-white rounded-xl overflow-hidden shadow-sm hover:shadow-lg transition-all duration-200 group flex flex-col border border-[#eff4ff]"
            >
              <div className="relative h-40 w-full overflow-hidden">
                <img
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  alt={route.title}
                  src={route.image}
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#001026]/90 via-[#001026]/30 to-transparent"></div>
                <span className="absolute top-2 left-2 bg-[#ff8928] text-white font-label-sm text-[11px] px-space-xs py-0.5 rounded font-bold">
                  {route.badge}
                </span>
                <div className="absolute bottom-2 left-2 right-2 text-white">
                  <div className="font-label-sm text-label-sm text-[#ffdcc6]">Train #{route.trainNumber}</div>
                  <div className="font-headline-sm text-headline-sm font-bold truncate">{route.title}</div>
                </div>
              </div>

              <div className="p-space-md flex-1 flex flex-col justify-between">
                <div className="space-y-space-xs">
                  <div className="flex items-center justify-between font-label-sm text-label-sm text-[#44474e]">
                    <span>
                      Duration: <strong className="text-[#0b1c30]">{route.duration}</strong>
                    </span>
                    <span className="text-green-700 bg-green-50 px-1.5 py-0.5 rounded font-bold">
                      {route.frequency}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-body-sm text-body-sm text-[#44474e]">
                    <span>
                      Departs: <strong className="font-data-mono text-[#0b1c30]">{route.departs}</strong>
                    </span>
                    <span>
                      Arrives: <strong className="font-data-mono text-[#0b1c30]">{route.arrives}</strong>
                    </span>
                  </div>
                </div>

                <div className="mt-space-md pt-space-xs flex items-center justify-between border-t border-[#eff4ff]">
                  <div>
                    <span className="font-label-sm text-label-sm text-[#44474e] block">Starts from</span>
                    <span className="font-headline-md text-headline-md text-[#001026] font-bold">{route.price}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => onSelectRoute(route.fromName, route.toName, route.trainNumber)}
                    className="bg-[#001026] hover:bg-[#ff8928] text-white px-space-md py-1.5 rounded font-label-md text-label-md transition-colors font-semibold cursor-pointer"
                  >
                    Book Now
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* QUICK VALUE ADDED SERVICES & TRUST BAR */}
      <section className="max-w-[1440px] w-full mx-auto px-margin lg:px-margin-desktop mb-space-xl">
        <div className="bg-[#eff4ff] rounded-xl p-space-lg border border-[#d3e4fe]/50">
          <div className="mb-space-md">
            <h3 className="font-headline-md text-headline-md text-[#001026] font-bold">
              Passenger Convenience Ecosystem
            </h3>
            <p className="font-body-sm text-body-sm text-[#44474e]">
              Direct integration with IRCTC hospitality, catering, and automated refund engines
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-gutter">
            {/* Feature 1: E-Catering */}
            <div className="bg-white rounded-xl p-space-md flex items-start gap-space-md shadow-sm hover:shadow-md transition-all border border-[#d3e4fe]/40">
              <div className="w-12 h-12 rounded-lg bg-[#e5eeff] flex items-center justify-center shrink-0 text-[#964900]">
                <span className="material-symbols-outlined text-[28px]">restaurant</span>
              </div>
              <div>
                <h4 className="font-headline-sm text-headline-sm text-[#001026] font-bold">Order Hot Food on Train</h4>
                <p className="font-body-sm text-body-sm text-[#44474e] mt-1 leading-relaxed">
                  Get fresh restaurant meals from Haldiram&apos;s, Domino&apos;s, and local partners delivered right to your seat
                  using your PNR.
                </p>
                <button
                  type="button"
                  onClick={onOpenCatering}
                  className="mt-space-sm inline-flex items-center gap-1 font-label-sm text-label-sm text-[#964900] font-bold hover:underline cursor-pointer"
                >
                  <span>View Station Menus</span>
                  <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
                </button>
              </div>
            </div>

            {/* Feature 2: Retiring Rooms */}
            <div className="bg-white rounded-xl p-space-md flex items-start gap-space-md shadow-sm hover:shadow-md transition-all border border-[#d3e4fe]/40">
              <div className="w-12 h-12 rounded-lg bg-[#e5eeff] flex items-center justify-center shrink-0 text-[#964900]">
                <span className="material-symbols-outlined text-[28px]">hotel</span>
              </div>
              <div>
                <h4 className="font-headline-sm text-headline-sm text-[#001026] font-bold">Station Retiring Rooms</h4>
                <p className="font-body-sm text-body-sm text-[#44474e] mt-1 leading-relaxed">
                  Book executive IRCTC lounge pods, AC resting rooms, and dormitory beds across 600+ major junctions for
                  comfortable stopovers.
                </p>
                <button
                  type="button"
                  onClick={onOpenDisha}
                  className="mt-space-sm inline-flex items-center gap-1 font-label-sm text-label-sm text-[#964900] font-bold hover:underline cursor-pointer"
                >
                  <span>Reserve Room via PNR</span>
                  <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
                </button>
              </div>
            </div>

            {/* Feature 3: Instant Refunds */}
            <div className="bg-white rounded-xl p-space-md flex items-start gap-space-md shadow-sm hover:shadow-md transition-all border border-[#d3e4fe]/40">
              <div className="w-12 h-12 rounded-lg bg-[#e5eeff] flex items-center justify-center shrink-0 text-[#964900]">
                <span className="material-symbols-outlined text-[28px]">currency_rupee_circle</span>
              </div>
              <div>
                <h4 className="font-headline-sm text-headline-sm text-[#001026] font-bold">
                  Instant Auto-Refund in 15 Min
                </h4>
                <p className="font-body-sm text-body-sm text-[#44474e] mt-1 leading-relaxed">
                  Zero-delay bank rollback via RailWallet. Automatic 100% full ticket refund without deduction if your
                  waitlisted chart remains unconfirmed.
                </p>
                <button
                  type="button"
                  onClick={onOpenDisha}
                  className="mt-space-sm inline-flex items-center gap-1 font-label-sm text-label-sm text-[#964900] font-bold hover:underline cursor-pointer"
                >
                  <span>Learn Refund Rules</span>
                  <span className="material-symbols-outlined text-[14px]">arrow_forward</span>
                </button>
              </div>
            </div>
          </div>

          {/* OFFICIAL IRCTC VERIFICATION & SECURITY BADGES STRIP */}
          <div className="mt-space-lg pt-space-md bg-white rounded-lg p-space-md flex flex-col md:flex-row items-center justify-between gap-space-md border border-[#d3e4fe]/50">
            <div className="flex items-center gap-space-md">
              <span className="material-symbols-outlined text-[#ff8928] text-[32px]">military_tech</span>
              <div>
                <div className="font-headline-sm text-headline-sm text-[#001026] font-bold">
                  IRCTC Authorized Principal Service Partner
                </div>
                <div className="font-body-sm text-body-sm text-[#44474e]">
                  License Ref: <strong className="font-data-mono text-[#0b1c30]">IRCTC/APR/2024/9912</strong> • Validated
                  National Transit Infrastructure Node
                </div>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-space-md font-label-sm text-label-sm text-[#0b1c30]">
              <span className="flex items-center gap-1 bg-[#eff4ff] px-space-sm py-1 rounded">
                <span className="material-symbols-outlined text-green-700 text-[18px]">lock</span> 256-Bit SSL Rail Direct
                Connect
              </span>
              <span className="flex items-center gap-1 bg-[#eff4ff] px-space-sm py-1 rounded">
                <span className="material-symbols-outlined text-green-700 text-[18px]">verified</span> Zero Surcharge UPI
                Integration
              </span>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};
