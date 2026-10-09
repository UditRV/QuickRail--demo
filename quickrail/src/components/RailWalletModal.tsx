import React, { useState } from 'react';
import { apiCreateWalletTopupOrder, apiVerifyWalletTopup, apiGetWallet, openRazorpayCheckout, ApiError } from '../services/api';

interface RailWalletModalProps {
  isOpen: boolean;
  onClose: () => void;
  balance?: number;
  onTopUpSuccess?: (newBalance: number) => void;
}

interface WalletTxn {
  id: string;
  type: string;
  amount: number;
  reference: string;
  createdAt: string;
}

export const RailWalletModal: React.FC<RailWalletModalProps> = ({
  isOpen,
  onClose,
  balance: initialBalance = 0,
  onTopUpSuccess,
}) => {
  const [balance, setBalance] = useState(initialBalance);
  const [topUpAmount, setTopUpAmount] = useState('');
  const [topUpSuccess, setTopUpSuccess] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState('');
  const [transactions, setTransactions] = useState<WalletTxn[]>([]);

  React.useEffect(() => {
    setBalance(initialBalance);
  }, [initialBalance]);

  // Pull real balance + transaction history from the backend whenever the modal opens.
  React.useEffect(() => {
    if (!isOpen) return;
    apiGetWallet()
      .then(({ balance: b, transactions: txns }) => {
        setBalance(b);
        setTransactions(txns);
      })
      .catch(() => {
        // Not logged in, or backend unreachable — keep showing the balance passed in via props.
      });
  }, [isOpen]);

  if (!isOpen) return null;

  const handleTopUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const amt = parseFloat(topUpAmount);
    if (!amt || isNaN(amt) || amt <= 0) {
      setError('Enter a valid amount.');
      return;
    }

    setIsProcessing(true);
    try {
      const { razorpayKeyId, order } = await apiCreateWalletTopupOrder(amt);
      const result = await openRazorpayCheckout({
        keyId: razorpayKeyId,
        orderId: order.id,
        amount: order.amount,
        currency: order.currency,
        name: 'QuickRail',
        description: 'RailWallet top-up',
      });
      const { balance: newBal } = await apiVerifyWalletTopup({ ...result, amount: amt });

      setBalance(newBal);
      onTopUpSuccess?.(newBal);
      setTopUpAmount('');
      setTopUpSuccess(true);
      setTimeout(() => setTopUpSuccess(false), 2500);

      apiGetWallet()
        .then(({ transactions: txns }) => setTransactions(txns))
        .catch(() => {});
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Top-up failed. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-margin">
      <div className="bg-white rounded-xl max-w-md w-full p-space-lg shadow-2xl border border-[#eff4ff]">
        {/* Header */}
        <div className="flex items-center justify-between pb-space-sm border-b border-[#eff4ff]">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-[#964900] text-[24px]">account_balance_wallet</span>
            <h3 className="font-headline-sm text-headline-sm font-bold text-[#001026]">Quick RailWallet</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 cursor-pointer"
          >
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        {/* Balance Card */}
        <div className="mt-space-md bg-gradient-to-r from-[#001026] to-[#0b2545] text-white p-space-md rounded-xl shadow-sm">
          <span className="text-[11px] text-[#ffdcc6] uppercase tracking-wider font-bold block">
            Available Rail Credits
          </span>
          <div className="font-headline-lg text-headline-lg font-data-mono font-bold mt-0.5">
            ₹{balance.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
          </div>
          <div className="flex items-center justify-between text-[11px] text-[#cbdbf5] mt-2 pt-2 border-t border-white/10">
            <span>Instant 1-Click Tatkal Checkout</span>
            <span className="text-green-400 font-bold">● Active &amp; Synced</span>
          </div>
        </div>

        {/* Quick Top-Up */}
        <form onSubmit={handleTopUp} className="mt-space-md">
          <label className="block font-label-sm text-[11px] text-[#44474e] uppercase font-bold mb-1">
            Top-Up via Razorpay (UPI / Card / NetBanking)
          </label>
          <div className="flex gap-2">
            <input
              type="number"
              min="100"
              placeholder="e.g. 500"
              value={topUpAmount}
              onChange={(e) => setTopUpAmount(e.target.value)}
              disabled={isProcessing}
              className="flex-1 bg-[#eff4ff] px-space-sm py-2 rounded font-data-mono text-[14px] text-[#001026] border border-[#d3e4fe] focus:outline-none disabled:opacity-60"
            />
            <button
              type="submit"
              disabled={isProcessing}
              className="px-space-md py-2 bg-[#ff8928] hover:bg-[#964900] text-white font-bold rounded text-[12px] cursor-pointer disabled:opacity-60"
            >
              {isProcessing ? 'Processing…' : 'Add Money'}
            </button>
          </div>
          {error && <span className="text-[11px] text-red-700 font-bold block mt-1">{error}</span>}
          {topUpSuccess && (
            <span className="text-[11px] text-green-700 font-bold block mt-1">
              ✓ Money added successfully to RailWallet!
            </span>
          )}
        </form>

        {/* Recent Transactions */}
        <div className="mt-space-md">
          <span className="font-label-sm text-[11px] text-[#74777f] uppercase font-bold block mb-1">
            Recent Activity
          </span>
          <div className="space-y-1.5 divide-y divide-[#eff4ff]">
            {transactions.length === 0 && (
              <p className="text-[12px] text-[#74777f] pt-1.5">No transactions yet.</p>
            )}
            {transactions.map((tx) => (
              <div key={tx.id} className="pt-1.5 flex items-center justify-between text-[12px]">
                <div>
                  <span className="font-semibold text-[#001026] block leading-tight">{tx.reference || tx.type}</span>
                  <span className="text-[10px] text-[#74777f]">
                    {new Date(tx.createdAt).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </span>
                </div>
                <span
                  className={`font-data-mono font-bold ${
                    tx.type === 'DEBIT' ? 'text-[#001026]' : 'text-green-700'
                  }`}
                >
                  {tx.type === 'DEBIT' ? '-' : '+'}₹{tx.amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
