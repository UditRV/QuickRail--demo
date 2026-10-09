import React, { useState } from 'react';
import { CATERING_MENU_ITEMS } from '../data/mockData';
import { apiPlaceFoodOrder } from '../services/api';

interface CateringModalProps {
  isOpen: boolean;
  onClose: () => void;
  pnrNumber?: string;
}

export const CateringModal: React.FC<CateringModalProps> = ({ isOpen, onClose, pnrNumber = '241-9084321' }) => {
  const [cart, setCart] = useState<Record<string, number>>({});
  const [orderPlaced, setOrderPlaced] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [orderError, setOrderError] = useState('');
  const [enteredPnr, setEnteredPnr] = useState(pnrNumber);

  if (!isOpen) return null;

  const handleAddToCart = (id: string) => {
    setCart((prev) => ({
      ...prev,
      [id]: (prev[id] || 0) + 1,
    }));
  };

  const handleRemoveFromCart = (id: string) => {
    setCart((prev) => {
      const current = prev[id] || 0;
      if (current <= 1) {
        const copy = { ...prev };
        delete copy[id];
        return copy;
      }
      return { ...prev, [id]: current - 1 };
    });
  };

  const totalAmount = Object.entries(cart).reduce((sum, [id, qty]) => {
    const item = CATERING_MENU_ITEMS.find((i) => i.id === id);
    return sum + (item ? item.price * qty : 0);
  }, 0);

  const totalItems = Object.values(cart).reduce((a, b) => a + b, 0);

  const handleConfirmFoodOrder = async () => {
    const itemIds = Object.entries(cart).flatMap(([id, quantity]) =>
      Array.from({ length: quantity }, () => id)
    );

    if (itemIds.length === 0) return;

    setSubmitting(true);
    setOrderError('');

    try {
      await apiPlaceFoodOrder(enteredPnr.trim(), itemIds);
      setOrderPlaced(true);
    } catch (error) {
      setOrderError(
        error instanceof Error ? error.message : 'Could not place the food order.'
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-margin">
      <div className="bg-white rounded-xl max-w-2xl w-full max-h-[85vh] flex flex-col shadow-2xl overflow-hidden border border-[#eff4ff]">
        {/* Header */}
        <div className="bg-[#001026] text-white p-space-md flex items-center justify-between">
          <div className="flex items-center gap-space-sm">
            <div className="w-10 h-10 rounded-full bg-[#ff8928] text-white flex items-center justify-center">
              <span className="material-symbols-outlined text-[24px]">restaurant_menu</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-headline-sm text-headline-sm font-bold">IRCTC e-Catering At Your Seat</h3>
                <label className="flex items-center gap-1 rounded bg-[#ff8928] px-1.5 py-0.5 text-[10px] font-bold text-white">
                  PNR
                  <input
                    value={enteredPnr}
                    onChange={(event) => setEnteredPnr(event.target.value)}
                    placeholder="123-4567890"
                    className="w-24 bg-transparent text-white outline-none placeholder:text-[#ffdcc6]"
                    aria-label="Confirmed ticket PNR"
                  />
                </label>
              </div>
              <p className="text-[11px] text-[#ffdcc6]">Fresh hygienic station food delivered to Coach B4 / Seat 32</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-300 hover:text-white cursor-pointer p-1"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 p-space-md overflow-y-auto space-y-space-md bg-[#f8f9ff]">
          {orderPlaced ? (
            <div className="py-space-xl text-center space-y-space-sm">
              <div className="w-16 h-16 rounded-full bg-green-100 text-green-700 flex items-center justify-center mx-auto">
                <span className="material-symbols-outlined text-[36px]">check_circle</span>
              </div>
              <h4 className="font-headline-md text-headline-md font-bold text-[#001026]">
                Food Order Confirmed!
              </h4>
              <p className="font-body-sm text-[13px] text-[#44474e] max-w-md mx-auto">
                Your meals will be handed to you hot and sealed at Kota Junction (21:40) &amp; Vadodara (03:56) directly at
                Berth 32. Total ₹{totalAmount} charged to RailWallet.
              </p>
              <button
                type="button"
                onClick={onClose}
                className="mt-space-md px-space-xl py-2 bg-[#001026] text-white rounded-lg font-bold cursor-pointer"
              >
                Back to Boarding Pass
              </button>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-space-sm">
                {CATERING_MENU_ITEMS.map((item) => {
                  const qty = cart[item.id] || 0;
                  return (
                    <div
                      key={item.id}
                      className="bg-white rounded-xl p-space-sm shadow-xs border border-[#eff4ff] flex flex-col justify-between"
                    >
                      <div>
                        <div className="h-28 w-full rounded-lg overflow-hidden relative mb-2">
                          <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                          <span className="absolute top-1.5 left-1.5 bg-green-700 text-white text-[9px] font-bold px-1.5 py-0.5 rounded">
                            PURE VEG
                          </span>
                        </div>
                        <div className="flex items-start justify-between gap-1">
                          <h4 className="font-label-md text-label-md font-bold text-[#001026] leading-tight">
                            {item.name}
                          </h4>
                          <span className="font-data-mono font-bold text-[#001026] text-[13px] shrink-0">
                            ₹{item.price}
                          </span>
                        </div>
                        <p className="font-body-sm text-[11px] text-[#74777f] mt-1 leading-tight line-clamp-2">
                          {item.description}
                        </p>
                        <div className="text-[10px] text-[#964900] font-semibold mt-1 flex items-center gap-1">
                          <span className="material-symbols-outlined text-[13px]">schedule</span>
                          <span>Halt: {item.station}</span>
                        </div>
                      </div>

                      <div className="mt-space-sm pt-2 border-t border-[#eff4ff] flex items-center justify-between">
                        <span className="text-[11px] text-[#44474e]">{item.category}</span>
                        {qty > 0 ? (
                          <div className="flex items-center gap-2 bg-[#eff4ff] rounded-lg px-2 py-1">
                            <button
                              type="button"
                              onClick={() => handleRemoveFromCart(item.id)}
                              className="font-bold text-[#001026] hover:text-red-600 cursor-pointer"
                            >
                              -
                            </button>
                            <span className="font-data-mono font-bold text-[12px]">{qty}</span>
                            <button
                              type="button"
                              onClick={() => handleAddToCart(item.id)}
                              className="font-bold text-[#001026] hover:text-green-700 cursor-pointer"
                            >
                              +
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleAddToCart(item.id)}
                            className="px-space-md py-1 bg-[#0b2545] hover:bg-[#ff8928] text-white rounded font-label-sm text-[11px] font-bold transition-colors cursor-pointer"
                          >
                            + Add
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>

        {/* Footer Checkout Strip */}
        {!orderPlaced && (
          <div className="p-space-sm px-space-md bg-white border-t border-[#eff4ff] flex items-center justify-between">
            <div>
              <span className="text-[11px] text-[#74777f] block">
                {totalItems} item(s) in meal basket
              </span>
              <span className="font-headline-sm text-headline-sm font-data-mono font-bold text-[#001026]">
                ₹{totalAmount}
              </span>
            </div>

            <div className="text-right">
              {orderError && <p className="mb-2 text-xs font-medium text-red-600">{orderError}</p>}
              <button
                type="button"
                disabled={totalItems === 0 || submitting}
                onClick={handleConfirmFoodOrder}
              className="px-space-lg py-2 bg-[#ff8928] hover:bg-[#964900] disabled:opacity-50 text-white rounded-lg font-label-md text-label-md font-bold transition-colors shadow-sm cursor-pointer"
            >
                {submitting ? 'Saving order...' : 'Confirm Seat Delivery'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
