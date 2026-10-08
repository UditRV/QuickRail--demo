import React, { useState } from 'react';
import { apiPnrEnquiry, ApiError } from '../services/api';

interface PnrEnquiryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onViewTicket: (pnr: string) => void;
}

export const PnrEnquiryModal: React.FC<PnrEnquiryModalProps> = ({ isOpen, onClose, onViewTicket }) => {
  const [pnr, setPnr] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState<{
    pnr: string;
    train: string;
    date: string;
    from: string;
    to: string;
    status: string;
    coach: string;
    berth: string;
  } | null>(null);

  if (!isOpen) return null;

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pnr.trim()) return;
    setLoading(true);
    setError('');
    setResult(null);
    try {
      const data = await apiPnrEnquiry(pnr.trim());
      const firstPassenger = data.passengers?.[0];
      setResult({
        pnr: data.pnr,
        train: `${data.trainNumber} ${data.trainName}`,
        date: data.journeyDate,
        from: data.fromStationCode,
        to: data.toStationCode,
        status: firstPassenger
          ? `${firstPassenger.currentStatus} (${data.bookingStatus})`
          : data.bookingStatus,
        coach: firstPassenger?.seat?.split(' / ')[0]?.replace('Coach ', '') || '—',
        berth: firstPassenger?.seat || 'Not allotted',
      });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'PNR lookup failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-margin">
      <div className="bg-white rounded-xl max-w-md w-full p-space-lg shadow-2xl border border-[#eff4ff]">
        <div className="flex items-center justify-between pb-space-sm border-b border-[#eff4ff]">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[#ff8928] text-[24px]">confirmation_number</span>
            <h3 className="font-headline-sm text-headline-sm font-bold text-[#001026]">IRCTC PNR Enquiry</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 cursor-pointer"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <form onSubmit={handleSearch} className="mt-space-md space-y-space-sm">
          <div>
            <label className="block font-label-sm text-[11px] text-[#44474e] uppercase font-bold mb-1">
              Enter PNR (e.g. 123-4567890)
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={pnr}
                onChange={(e) => setPnr(e.target.value)}
                placeholder="123-4567890"
                className="flex-1 bg-[#eff4ff] px-space-md py-2 rounded font-data-mono font-bold text-[#001026] text-[15px] border border-[#d3e4fe] focus:outline-none"
              />
              <button
                type="submit"
                disabled={loading || !pnr.trim()}
                className="px-space-md py-2 bg-[#001026] hover:bg-[#0b2545] disabled:opacity-50 text-white font-bold rounded text-[13px] cursor-pointer"
              >
                {loading ? 'Checking...' : 'Check'}
              </button>
            </div>
            {error && <p className="text-[11px] text-red-700 font-bold mt-1">{error}</p>}
          </div>
        </form>

        {result && (
          <div className="mt-space-md bg-[#eff4ff] rounded-xl p-space-md border border-[#d3e4fe]/50 space-y-2 text-[13px]">
            <div className="flex justify-between items-center">
              <span className="font-label-sm text-[11px] text-[#74777f]">PNR NUMBER</span>
              <span className="font-data-mono font-bold text-[#001026]">{result.pnr}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="font-label-sm text-[11px] text-[#74777f]">TRAIN</span>
              <span className="font-bold text-[#001026]">{result.train}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="font-label-sm text-[11px] text-[#74777f]">DATE &amp; ROUTE</span>
              <span className="text-[#44474e]">{result.from} ➔ {result.to}</span>
            </div>
            <div className="flex justify-between items-center pt-2 border-t border-[#dce9ff]">
              <span className="font-label-sm text-[11px] text-[#74777f]">CURRENT STATUS</span>
              <span className="bg-green-100 text-green-800 font-bold px-2 py-0.5 rounded text-[11px]">
                {result.status}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="font-label-sm text-[11px] text-[#74777f]">SEAT</span>
              <span className="font-data-mono font-bold text-[#964900]">{result.berth}</span>
            </div>

            <button
              type="button"
              onClick={() => {
                onClose();
                onViewTicket(result.pnr);
              }}
              className="mt-3 w-full py-2 bg-[#ff8928] hover:bg-[#964900] text-white font-bold rounded-lg transition-colors cursor-pointer text-center"
            >
              Open Digital Boarding Pass
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
