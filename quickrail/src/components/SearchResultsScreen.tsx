import React, { useState, useEffect } from 'react';
import { Train, CoachClass } from '../types';
import { INITIAL_TRAINS } from '../data/mockData';
import { apiSearchTrains } from '../services/api';

// Backend station names are just codes (e.g. "NDLS"); the UI passes "NDLS - New Delhi".
// Extract the leading code for the API call.
function stationCode(label: string): string {
  return label.split(' - ')[0].split(' ')[0].trim();
}

interface SearchResultsScreenProps {
  fromStation: string;
  toStation: string;
  journeyDate: string;
  quota: string;
  travelClass: string;
  onJourneyDateChange: (date: string) => void;
  onSelectTrainAndClass: (train: Train, selectedClass: CoachClass) => void;
  onModifySearch: () => void;
  onOpenDisha: () => void;
}

export const SearchResultsScreen: React.FC<SearchResultsScreenProps> = ({
  fromStation,
  toStation,
  journeyDate,
  quota,
  onJourneyDateChange,
  onSelectTrainAndClass,
  onModifySearch,
  onOpenDisha,
}) => {
  const [trains, setTrains] = useState<Train[]>(INITIAL_TRAINS);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [selectedTrainClasses, setSelectedTrainClasses] = useState<Record<string, string>>({
    '12952': '3A',
    '22222': '2A',
    '12926': '3A',
  });

  // Pull live trains + real per-date seat availability from the backend.
  useEffect(() => {
    let cancelled = false;
    const fromCode = stationCode(fromStation);
    const toCode = stationCode(toStation);
    if (!fromCode || !toCode || !journeyDate) return;

    setIsSearching(true);
    setSearchError('');

    apiSearchTrains(fromCode, toCode, journeyDate)
      .then(({ trains: apiTrains }) => {
        if (cancelled) return;
        if (apiTrains.length === 0) {
          setSearchError(`No direct trains found from ${fromCode} to ${toCode} on this date.`);
          setTrains([]);
          return;
        }
        const mapped: Train[] = apiTrains.map((t: any) => ({
          number: t.number,
          name: t.name,
          badge: t.badge,
          typeText: t.typeText,
          fromStationCode: t.fromStationCode,
          fromStationName: fromStation,
          departureTime: t.departureTime,
          departurePlatform: t.departurePlatform,
          departureDay: journeyDate,
          toStationCode: t.toStationCode,
          toStationName: toStation,
          arrivalTime: t.arrivalTime,
          arrivalPlatform: t.arrivalPlatform,
          arrivalDay: journeyDate,
          duration: t.duration,
          routeHighlight: t.routeHighlight,
          stopsCount: t.stopsCount,
          intermediateStops: t.intermediateStops || [],
          features: t.features || [],
          operatingDays: t.operatingDays,
          selectedClassCode: t.classes?.[0]?.classCode || '',
          classes: (t.classes || []).map((c: any) => ({
            classCode: c.classCode,
            name: c.name,
            price: c.price,
            status: c.status,
            statusType: c.statusType,
            availableCount: c.availableCount,
          })),
        }));
        setTrains(mapped);
      })
      .catch(() => {
        if (cancelled) return;
        // Backend unreachable — fall back to the bundled sample trains so the UI still works offline.
        setSearchError('Could not reach QuickRail servers — showing sample trains.');
        setTrains(INITIAL_TRAINS);
      })
      .finally(() => {
        if (!cancelled) setIsSearching(false);
      });

    return () => {
      cancelled = true;
    };
  }, [fromStation, toStation, journeyDate]);

  // Filter states
  const [activeQuota, setActiveQuota] = useState(quota || 'GN');
  const [acOnly, setAcOnly] = useState(false);
  const [availableOnly, setAvailableOnly] = useState(true);
  const [selectedTimeWindow, setSelectedTimeWindow] = useState<string | null>(null);
  const [selectedSort, setSelectedSort] = useState<'earliest' | 'fastest' | 'available'>('fastest');
  const formatDateLabel = (date: Date) =>
    new Intl.DateTimeFormat('en-IN', { weekday: 'short', day: 'numeric', month: 'short' }).format(date);

  // Build the carousel from the journey date selected on the home screen.
  // Noon avoids browser time-zone conversion moving the date to the previous day.
  const selectedDate = new Date(`${journeyDate}T12:00:00`);
  const datesList = [-1, 0, 1, 2, 3].map((offset) => {
    const date = new Date(selectedDate);
    date.setDate(date.getDate() + offset);
    return {
      iso: date.toISOString().slice(0, 10),
      label: formatDateLabel(date),
      status: offset === 0 ? 'Selected journey date' : offset === 1 ? 'Tatkal Open' : 'Check availability',
    };
  });
  const dateIndex = 1;

  const changeJourneyDate = (date: string) => {
    onJourneyDateChange(date);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSelectClass = (trainNumber: string, classCode: string) => {
    setSelectedTrainClasses((prev) => ({
      ...prev,
      [trainNumber]: classCode,
    }));
  };

  const handleBookNow = (train: Train) => {
    const classCode = selectedTrainClasses[train.number] || train.classes[0].classCode;
    const selectedClass = train.classes.find((c) => c.classCode === classCode) || train.classes[0];
    onSelectTrainAndClass(train, selectedClass);
  };

  // Filtered trains
  const filteredTrains = trains.filter((train) => {
    if (acOnly && train.classes.every((c) => c.classCode === 'SL')) return false;
    return true;
  });

  return (
    <div className="flex flex-col w-full">
      {isSearching && (
        <div className="bg-blue-50 text-blue-800 text-sm font-medium text-center py-2">
          Searching live availability…
        </div>
      )}
      {searchError && (
        <div className="bg-amber-50 text-amber-800 text-sm font-medium text-center py-2">{searchError}</div>
      )}
      {/* 1. OPERATIONAL TELEMETRY RIBBON */}
      <div className="bg-[#001026] text-white py-space-xs px-margin lg:px-margin-desktop mb-space-md shadow-sm">
        <div className="max-w-[1440px] mx-auto flex flex-wrap items-center justify-between gap-gutter text-[11px] font-label-sm">
          <div className="flex items-center gap-space-md">
            <span className="flex items-center gap-1 text-green-400 font-bold">
              <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse"></span>
              IRCTC Live Sync: Operational
            </span>
            <span className="text-[#cbdbf5]">•</span>
            <span className="flex items-center gap-1 text-[#ff8928]">
              <span className="material-symbols-outlined text-[14px]">local_fire_department</span>
              High Tatkal Volume Detected
            </span>
            <span className="text-[#cbdbf5]">•</span>
            <span className="text-[#cbdbf5] hidden sm:inline">Server Node: DEL-CRIS-08</span>
          </div>
          <div className="flex items-center gap-space-md text-[#d5e3ff]">
            <span>Current PNR Quotas Refreshed: Just now</span>
            <span className="bg-white/10 px-2 py-0.5 rounded font-data-mono text-white">Zero PG Surcharge</span>
          </div>
        </div>
      </div>

      {/* 2. ROUTE SEARCH HEADER & MODIFY BAR */}
      <section className="max-w-[1440px] w-full mx-auto px-margin lg:px-margin-desktop mb-space-md">
        <div className="bg-white rounded-xl p-space-md shadow-sm border border-[#eff4ff] flex flex-col md:flex-row items-start md:items-center justify-between gap-space-md">
          <div>
            <div className="flex items-center gap-space-xs text-[#964900] font-label-sm text-label-sm uppercase font-bold tracking-wider">
              <span>Selected Corridor</span>
              <span>•</span>
              <span className="text-green-700">All Trains Verified with IRCTC</span>
            </div>
            <div className="flex items-center gap-space-sm mt-0.5 flex-wrap">
              <h1 className="font-headline-lg text-headline-lg text-[#001026] font-bold">
                {fromStation.split(' - ')[1] || fromStation} ({fromStation.split(' - ')[0] || 'NDLS'}) ➔{' '}
                {toStation.split(' - ')[1] || toStation} ({toStation.split(' - ')[0] || 'MMCT'})
              </h1>
            </div>
            <div className="flex flex-wrap items-center gap-space-sm text-body-sm text-[#44474e] mt-1">
              <span className="font-semibold text-[#0b1c30]">
                {journeyDate || 'Friday, 18 Oct 2024'}
              </span>
              <span>•</span>
              <span className="font-bold text-[#ff8928]">12 Trains Available (3 High-Speed Specials)</span>
              <span>•</span>
              <span className="bg-[#eff4ff] px-2 py-0.5 rounded font-label-sm text-[11px] text-[#001026] font-semibold">
                Quota: {activeQuota === 'GN' ? 'General (GN)' : activeQuota === 'TQ' ? 'Tatkal (TQ)' : activeQuota}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-space-sm w-full md:w-auto">
            <button
              type="button"
              onClick={onModifySearch}
              className="w-full md:w-auto px-space-lg py-space-sm bg-[#eff4ff] hover:bg-[#dce9ff] text-[#001026] rounded-lg font-label-md text-label-md font-bold transition-colors flex items-center justify-center gap-1.5 cursor-pointer border border-[#d3e4fe]"
            >
              <span className="material-symbols-outlined text-[18px]">tune</span>
              <span>Modify Journey</span>
            </button>
          </div>
        </div>
      </section>

      {/* 3. DATE CAROUSEL */}
      <section className="max-w-[1440px] w-full mx-auto px-margin lg:px-margin-desktop mb-space-md">
        <div className="bg-white rounded-xl p-space-xs shadow-sm border border-[#eff4ff] flex items-center justify-between gap-1 overflow-x-auto">
          <button
            type="button"
            onClick={() => {
              const date = new Date(`${journeyDate}T12:00:00`);
              date.setDate(date.getDate() - 1);
              changeJourneyDate(date.toISOString().slice(0, 10));
            }}
            className="p-space-sm text-[#44474e] hover:text-[#001026] hover:bg-[#eff4ff] rounded-lg cursor-pointer"
            title="Previous Day"
          >
            <span className="material-symbols-outlined text-[20px]">chevron_left</span>
          </button>

          <div className="flex items-center gap-space-xs flex-1 justify-around min-w-[500px]">
            {datesList.map((d, idx) => (
              <button
                key={d.label}
                type="button"
                onClick={() => changeJourneyDate(d.iso)}
                className={`flex-1 py-space-xs px-space-sm rounded-lg text-center transition-all cursor-pointer ${
                  dateIndex === idx
                    ? 'bg-[#0b2545] text-white shadow-sm'
                    : 'hover:bg-[#eff4ff] text-[#44474e]'
                }`}
              >
                <div className="font-label-md text-label-md font-bold leading-tight">{d.label}</div>
                <div
                  className={`font-label-sm text-[10px] mt-0.5 ${
                    dateIndex === idx ? 'text-[#ffb786]' : 'text-[#74777f]'
                  }`}
                >
                  {d.status}
                </div>
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={() => {
              const date = new Date(`${journeyDate}T12:00:00`);
              date.setDate(date.getDate() + 1);
              changeJourneyDate(date.toISOString().slice(0, 10));
            }}
            className="p-space-sm text-[#44474e] hover:text-[#001026] hover:bg-[#eff4ff] rounded-lg cursor-pointer"
            title="Next Day"
          >
            <span className="material-symbols-outlined text-[20px]">chevron_right</span>
          </button>
        </div>
      </section>

      {/* 4. MAIN BODY: FILTER SIDEBAR & TRAINS LIST */}
      <div className="max-w-[1440px] w-full mx-auto px-margin lg:px-margin-desktop mb-space-xl">
        <div className="grid grid-cols-1 lg:grid-cols-[280px,1fr] gap-gutter-desktop items-start">
          {/* FILTER SIDEBAR */}
          <aside className="bg-white rounded-xl p-space-md shadow-sm border border-[#eff4ff] space-y-space-lg">
            {/* Header */}
            <div className="flex items-center justify-between pb-space-sm border-b border-[#eff4ff]">
              <span className="font-headline-sm text-headline-sm text-[#001026] font-bold flex items-center gap-1.5">
                <span className="material-symbols-outlined text-[20px] text-[#964900]">filter_list</span>
                Filters
              </span>
              <button
                type="button"
                onClick={() => {
                  setAcOnly(false);
                  setAvailableOnly(false);
                  setSelectedTimeWindow(null);
                  setActiveQuota('GN');
                }}
                className="font-label-sm text-[11px] text-[#964900] hover:underline font-bold cursor-pointer"
              >
                Reset All
              </button>
            </div>

            {/* Quota Filter */}
            <div>
              <label className="block font-label-sm text-label-sm text-[#44474e] uppercase font-bold mb-space-xs">
                Booking Quota
              </label>
              <div className="grid grid-cols-2 gap-space-xs">
                {[
                  { code: 'GN', label: 'General' },
                  { code: 'TQ', label: 'Tatkal' },
                  { code: 'LD', label: 'Ladies' },
                  { code: 'SS', label: 'Sr. Citizen' },
                ].map((q) => (
                  <button
                    key={q.code}
                    type="button"
                    onClick={() => setActiveQuota(q.code)}
                    className={`py-1.5 px-space-xs text-center rounded font-label-sm text-[12px] font-semibold transition-colors cursor-pointer ${
                      activeQuota === q.code
                        ? 'bg-[#001026] text-white shadow-sm'
                        : 'bg-[#eff4ff] text-[#44474e] hover:bg-[#dce9ff]'
                    }`}
                  >
                    {q.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Quick Checkbox Filters */}
            <div>
              <label className="block font-label-sm text-label-sm text-[#44474e] uppercase font-bold mb-space-xs">
                Quick Filters
              </label>
              <div className="space-y-space-xs">
                <label className="flex items-center gap-space-xs cursor-pointer">
                  <input
                    type="checkbox"
                    checked={acOnly}
                    onChange={(e) => setAcOnly(e.target.checked)}
                    className="w-4 h-4 rounded text-[#0b2545] accent-[#0b2545] cursor-pointer"
                  />
                  <span className="font-body-sm text-body-sm text-[#0b1c30]">AC Coaches Only</span>
                </label>
                <label className="flex items-center gap-space-xs cursor-pointer">
                  <input
                    type="checkbox"
                    checked={availableOnly}
                    onChange={(e) => setAvailableOnly(e.target.checked)}
                    className="w-4 h-4 rounded text-[#0b2545] accent-[#0b2545] cursor-pointer"
                  />
                  <span className="font-body-sm text-body-sm text-[#0b1c30]">Available Berths Only</span>
                </label>
                <label className="flex items-center gap-space-xs cursor-pointer">
                  <input
                    type="checkbox"
                    defaultChecked
                    className="w-4 h-4 rounded text-[#0b2545] accent-[#0b2545] cursor-pointer"
                  />
                  <span className="font-body-sm text-body-sm text-[#0b1c30]">Show Tatkal Quota</span>
                </label>
                <label className="flex items-center gap-space-xs cursor-pointer">
                  <input
                    type="checkbox"
                    defaultChecked
                    className="w-4 h-4 rounded text-[#0b2545] accent-[#0b2545] cursor-pointer"
                  />
                  <span className="font-body-sm text-body-sm text-[#0b1c30]">Free Cancellation Eligible</span>
                </label>
              </div>
            </div>

            {/* Departure Time Windows */}
            <div>
              <label className="block font-label-sm text-label-sm text-[#44474e] uppercase font-bold mb-space-xs">
                Departure Time
              </label>
              <div className="grid grid-cols-2 gap-space-xs">
                {[
                  { id: 't1', title: 'Early Morning', time: '00:00 - 06:00' },
                  { id: 't2', title: 'Morning', time: '06:00 - 12:00' },
                  { id: 't3', title: 'Mid Day', time: '12:00 - 18:00' },
                  { id: 't4', title: 'Night', time: '18:00 - 24:00' },
                ].map((tw) => (
                  <button
                    key={tw.id}
                    type="button"
                    onClick={() => setSelectedTimeWindow(selectedTimeWindow === tw.id ? null : tw.id)}
                    className={`p-space-xs rounded text-left border transition-all cursor-pointer ${
                      selectedTimeWindow === tw.id
                        ? 'border-[#ff8928] bg-[#ffdcc6]/30 text-[#001026]'
                        : 'border-[#eff4ff] bg-[#f8f9ff] text-[#44474e] hover:bg-[#eff4ff]'
                    }`}
                  >
                    <div className="font-label-sm text-[11px] font-bold">{tw.title}</div>
                    <div className="font-data-mono text-[10px] text-[#74777f]">{tw.time}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Journey Class */}
            <div>
              <label className="block font-label-sm text-label-sm text-[#44474e] uppercase font-bold mb-space-xs">
                Journey Class
              </label>
              <div className="flex flex-wrap gap-space-xs">
                {['1A', '2A', '3A', '3E', 'CC', 'EC', 'SL'].map((c) => (
                  <span
                    key={c}
                    className="px-space-sm py-1 rounded bg-[#eff4ff] hover:bg-[#dce9ff] text-[#001026] font-label-sm text-[11px] font-bold cursor-pointer transition-colors"
                  >
                    {c}
                  </span>
                ))}
              </div>
            </div>

            {/* Train Type */}
            <div>
              <label className="block font-label-sm text-label-sm text-[#44474e] uppercase font-bold mb-space-xs">
                Train Type
              </label>
              <div className="space-y-space-xs font-body-sm text-body-sm text-[#44474e]">
                <label className="flex items-center gap-space-xs cursor-pointer">
                  <input type="checkbox" defaultChecked className="rounded accent-[#0b2545]" />
                  <span>Rajdhani / Tejas Express</span>
                </label>
                <label className="flex items-center gap-space-xs cursor-pointer">
                  <input type="checkbox" defaultChecked className="rounded accent-[#0b2545]" />
                  <span>Vande Bharat Special</span>
                </label>
                <label className="flex items-center gap-space-xs cursor-pointer">
                  <input type="checkbox" defaultChecked className="rounded accent-[#0b2545]" />
                  <span>Superfast Express</span>
                </label>
                <label className="flex items-center gap-space-xs cursor-pointer">
                  <input type="checkbox" defaultChecked className="rounded accent-[#0b2545]" />
                  <span>Garib Rath</span>
                </label>
              </div>
            </div>

            {/* Help Widget */}
            <div className="bg-[#eff4ff] p-space-sm rounded-lg border border-[#d3e4fe]/50">
              <div className="flex items-center gap-space-xs font-headline-sm text-headline-sm text-[#001026] font-bold">
                <span className="material-symbols-outlined text-[#ff8928] text-[20px]">support_agent</span>
                <span>Need Booking Help?</span>
              </div>
              <p className="font-body-sm text-[12px] text-[#44474e] mt-1 leading-relaxed">
                Ask DISHA 2.0 can predict your waitlist confirmation or check live seat quotas across trains.
              </p>
              <button
                type="button"
                onClick={onOpenDisha}
                className="mt-2 w-full py-1 bg-[#0b2545] hover:bg-[#495f82] text-white font-label-sm text-label-sm rounded font-bold transition-colors cursor-pointer"
              >
                Chat with DISHA AI
              </button>
            </div>
          </aside>

          {/* RIGHT COLUMN: TRAIN CARDS */}
          <div className="space-y-space-md">
            {/* Sorting bar */}
            <div className="bg-white rounded-xl p-space-sm shadow-sm border border-[#eff4ff] flex flex-wrap items-center justify-between gap-space-sm">
              <div className="flex items-center gap-space-sm font-label-md text-label-md text-[#44474e]">
                <span className="font-bold text-[#001026]">Sort by:</span>
                <button
                  type="button"
                  onClick={() => setSelectedSort('fastest')}
                  className={`px-space-sm py-1 rounded font-semibold transition-colors cursor-pointer ${
                    selectedSort === 'fastest' ? 'bg-[#001026] text-white' : 'hover:bg-[#eff4ff] text-[#44474e]'
                  }`}
                >
                  Fastest Duration
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedSort('earliest')}
                  className={`px-space-sm py-1 rounded font-semibold transition-colors cursor-pointer ${
                    selectedSort === 'earliest' ? 'bg-[#001026] text-white' : 'hover:bg-[#eff4ff] text-[#44474e]'
                  }`}
                >
                  Earliest Departure
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedSort('available')}
                  className={`px-space-sm py-1 rounded font-semibold transition-colors cursor-pointer ${
                    selectedSort === 'available' ? 'bg-[#001026] text-white' : 'hover:bg-[#eff4ff] text-[#44474e]'
                  }`}
                >
                  Availability High-Low
                </button>
              </div>
              <div className="font-data-mono text-[11px] text-[#74777f]">
                Updated: <strong>Live CRIS Feed</strong>
              </div>
            </div>

            {/* Train List */}
            {filteredTrains.map((train) => {
              const activeClassCode = selectedTrainClasses[train.number] || train.classes[0].classCode;
              const activeClass = train.classes.find((c) => c.classCode === activeClassCode) || train.classes[0];

              return (
                <div
                  key={train.number}
                  className="bg-white rounded-xl p-space-md lg:p-space-lg shadow-sm hover:shadow-md transition-shadow border border-[#eff4ff]"
                >
                  {/* Train Header */}
                  <div className="flex flex-wrap items-center justify-between gap-space-sm pb-space-sm border-b border-[#eff4ff]">
                    <div className="flex items-center gap-space-sm flex-wrap">
                      <span className="bg-[#ff8928] text-white font-label-sm text-[11px] px-space-xs py-0.5 rounded font-bold">
                        {train.badge}
                      </span>
                      <h3 className="font-headline-md text-headline-md text-[#001026] font-bold">
                        {train.number} {train.name}
                      </h3>
                      <span className="text-[#74777f] font-body-sm text-body-sm">• {train.typeText}</span>
                    </div>
                    <div className="flex items-center gap-space-sm font-label-sm text-[12px] text-[#44474e]">
                      <span className="font-data-mono font-semibold text-[#001026]">{train.operatingDays}</span>
                      <span className="text-[#c4c6cf]">|</span>
                      <span className="text-green-700 font-semibold">{train.features.join(' • ')}</span>
                    </div>
                  </div>

                  {/* Train Timings & Route */}
                  <div className="py-space-md grid grid-cols-1 md:grid-cols-[1fr,auto,1fr] gap-space-md items-center">
                    {/* Departure */}
                    <div>
                      <div className="font-headline-lg text-headline-lg font-data-mono text-[#001026] font-bold">
                        {train.departureTime}
                      </div>
                      <div className="font-headline-sm text-headline-sm font-bold text-[#0b1c30]">
                        {train.fromStationName} ({train.fromStationCode})
                      </div>
                      <div className="font-body-sm text-body-sm text-[#74777f]">
                        {train.departureDay} • {train.departurePlatform}
                      </div>
                    </div>

                    {/* Middle Duration & Line */}
                    <div className="flex flex-col items-center justify-center px-space-md text-center">
                      <span className="font-data-mono text-data-mono text-[#964900] font-bold">{train.duration}</span>
                      <div className="w-40 sm:w-56 h-[2px] bg-[#dce9ff] relative my-1.5">
                        <div className="w-2.5 h-2.5 rounded-full bg-[#001026] absolute -top-1 left-0"></div>
                        <div className="w-2.5 h-2.5 rounded-full bg-[#ff8928] absolute -top-1 right-0"></div>
                      </div>
                      <span className="font-label-sm text-[11px] text-[#74777f]">
                        {train.stopsCount} stops ({train.intermediateStops.join(', ')})
                      </span>
                    </div>

                    {/* Arrival */}
                    <div className="text-left md:text-right">
                      <div className="font-headline-lg text-headline-lg font-data-mono text-[#001026] font-bold">
                        {train.arrivalTime}
                      </div>
                      <div className="font-headline-sm text-headline-sm font-bold text-[#0b1c30]">
                        {train.toStationName} ({train.toStationCode})
                      </div>
                      <div className="font-body-sm text-body-sm text-[#74777f]">
                        {train.arrivalDay} • {train.arrivalPlatform}
                      </div>
                    </div>
                  </div>

                  {/* Classes & Berth Availability Cards */}
                  <div className="pt-space-sm border-t border-[#eff4ff]">
                    <div className="font-label-sm text-label-sm text-[#44474e] uppercase font-bold mb-space-xs">
                      Available Classes &amp; Instant Quota:
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-space-sm">
                      {train.classes.map((cls) => {
                        const isSelected = activeClassCode === cls.classCode;
                        const isAvailable = cls.statusType === 'available';
                        const isRac = cls.statusType === 'rac';
                        const isWL = cls.statusType === 'waitlist';
                        const isNotRunning = cls.statusType === 'not_running';

                        return (
                          <div
                            key={cls.classCode}
                            onClick={() => {
                              if (!isNotRunning) {
                                handleSelectClass(train.number, cls.classCode);
                              }
                            }}
                            className={`rounded-lg p-space-sm transition-all border text-left ${
                              isNotRunning
                                ? 'opacity-50 cursor-not-allowed bg-gray-50 border-gray-200'
                                : isSelected
                                ? 'border-[#ff8928] bg-[#ffdcc6]/20 ring-2 ring-[#ff8928]/30 cursor-pointer'
                                : 'border-[#dce9ff] bg-[#eff4ff] hover:bg-[#e5eeff] cursor-pointer'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <span className="font-headline-sm text-headline-sm font-bold text-[#001026]">
                                {cls.classCode}
                              </span>
                              {cls.price > 0 && (
                                <span className="font-data-mono text-data-mono font-bold text-[#0b1c30]">
                                  ₹{cls.price.toLocaleString('en-IN')}
                                </span>
                              )}
                            </div>
                            <div className="font-label-sm text-[11px] text-[#44474e]">{cls.name}</div>
                            <div
                              className={`mt-2 font-data-mono text-[12px] font-bold leading-none ${
                                isAvailable
                                  ? 'text-green-700'
                                  : isRac
                                  ? 'text-amber-700'
                                  : isWL
                                  ? 'text-orange-700'
                                  : 'text-gray-400'
                              }`}
                            >
                              {cls.status}
                            </div>
                            {cls.subtext && (
                              <div className="font-label-sm text-[10px] text-[#74777f] mt-1 truncate">
                                {cls.subtext}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>

                    {/* Book Button and Fare Summary Row */}
                    <div className="mt-space-md pt-space-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-space-sm bg-[#eff4ff] rounded-lg p-space-sm border border-[#d3e4fe]/50">
                      <div className="flex items-center gap-space-sm">
                        <span className="material-symbols-outlined text-green-700 text-[20px]">verified</span>
                        <div>
                          <span className="font-label-md text-label-md font-bold text-[#001026]">
                            Selected: {activeClass.classCode} ({activeClass.name})
                          </span>
                          <span className="font-body-sm text-[12px] text-[#44474e] block">
                            Free Cancellation • Instant refund via UPI / RailWallet
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-space-md w-full sm:w-auto justify-between sm:justify-end">
                        <div className="text-right">
                          <span className="font-label-sm text-[11px] text-[#74777f] block">Total Base Fare</span>
                          <span className="font-headline-md text-headline-md text-[#001026] font-bold font-data-mono">
                            ₹{activeClass.price.toLocaleString('en-IN')}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleBookNow(train)}
                          className="bg-[#ff8928] hover:bg-[#964900] active:scale-[0.98] text-white px-space-xl py-space-sm rounded-lg font-headline-sm text-headline-sm font-bold shadow-md transition-all flex items-center gap-1.5 cursor-pointer"
                        >
                          <span>BOOK NOW</span>
                          <span className="material-symbols-outlined text-[18px]">arrow_forward</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}

            {/* Bottom Guarantee Bento Card */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-gutter mt-space-lg">
              <div className="bg-white rounded-xl p-space-md shadow-sm border border-[#eff4ff] flex items-center gap-space-sm">
                <span className="material-symbols-outlined text-[#ff8928] text-[28px]">currency_exchange</span>
                <div>
                  <div className="font-headline-sm text-headline-sm text-[#001026] font-bold">
                    Zero Cancellation Charges
                  </div>
                  <div className="font-body-sm text-[12px] text-[#44474e]">
                    Get 100% full refund on Waitlist &amp; RAC cancellations
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl p-space-md shadow-sm border border-[#eff4ff] flex items-center gap-space-sm">
                <span className="material-symbols-outlined text-[#ff8928] text-[28px]">auto_awesome</span>
                <div>
                  <div className="font-headline-sm text-headline-sm text-[#001026] font-bold">Predictive WL Engine</div>
                  <div className="font-body-sm text-[12px] text-[#44474e]">
                    94% accurate AI seat confirmation forecasting
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl p-space-md shadow-sm border border-[#eff4ff] flex items-center gap-space-sm">
                <span className="material-symbols-outlined text-[#ff8928] text-[28px]">flash_on</span>
                <div>
                  <div className="font-headline-sm text-headline-sm text-[#001026] font-bold">
                    Tatkal Super-Fast Fill
                  </div>
                  <div className="font-body-sm text-[12px] text-[#44474e]">
                    Auto-saved IRCTC profile logs you in instantly at 10 AM
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
