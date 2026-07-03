import { CircleCheck as CheckCircle2, Copy, Search, PartyPopper } from 'lucide-react';
import { useState } from 'react';

type OrderSuccessProps = {
  orderNumber: string;
  accessToken: string;
  requiresConfirmation?: boolean;
  onTrackOrder: () => void;
  onClose: () => void;
};

export default function OrderSuccess({ orderNumber, requiresConfirmation, onTrackOrder, onClose }: OrderSuccessProps) {
  const [copied, setCopied] = useState(false);

  function copy() {
    navigator.clipboard.writeText(orderNumber);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-forest-900/50 backdrop-blur-sm" />
      <div className="relative bg-white rounded-lg shadow-soft max-w-sm w-full p-7 text-center">
        <div className="flex justify-center mb-4">
          <div className="bg-forest-50 p-4 rounded-full relative">
            <CheckCircle2 size={40} className="text-forest-700" />
            <PartyPopper size={18} className="text-clay absolute -top-1 -right-1" />
          </div>
        </div>
        <h2 className="text-2xl font-bold text-forest-900">Order <span className="accent text-forest-600">placed!</span></h2>
        <p className="text-forest-800/60 mt-2 text-sm">
          {requiresConfirmation
            ? 'Your order has been received. We\'ll confirm it shortly, then you can complete payment.'
            : 'Your order has been received. We\'ll review and confirm it shortly.'}
        </p>

        <div className="mt-5 bg-cream rounded-lg p-4 border border-forest-700/10">
          <p className="text-xs text-forest-800/50 mb-1">Your Order Number</p>
          <div className="flex items-center justify-between gap-2">
            <p className="text-xl font-bold text-forest-900 tracking-widest">{orderNumber}</p>
            <button onClick={copy} className="flex items-center gap-1 text-xs text-forest-700 hover:text-forest-800 font-semibold">
              <Copy size={13} />{copied ? 'Copied!' : 'Copy'}
            </button>
          </div>
          <p className="text-xs text-forest-800/40 mt-1">Save this number to track your order</p>
        </div>

        <div className="mt-5 space-y-2">
          <button onClick={onTrackOrder} className="btn-primary w-full"><Search size={16} />Track My Order</button>
          <button onClick={onClose} className="w-full text-sm text-forest-800/60 hover:text-forest-800 py-2 transition-colors">Continue Shopping</button>
        </div>
      </div>
    </div>
  );
}
