import { CircleCheck as CheckCircle2, Copy, MessageCircle, Mail, Search } from 'lucide-react';
import { useState } from 'react';

type OrderSuccessProps = {
  orderNumber: string;
  accessToken: string;
  onTrackOrder: () => void;
  onClose: () => void;
};

export default function OrderSuccess({ orderNumber, onTrackOrder, onClose }: OrderSuccessProps) {
  const [copied, setCopied] = useState(false);

  function copy() {
    navigator.clipboard.writeText(orderNumber);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" />
      <div className="relative bg-white rounded-2xl shadow-2xl max-w-sm w-full mx-4 p-6 text-center">
        <div className="flex justify-center mb-4">
          <div className="bg-blue-100 p-4 rounded-full">
            <CheckCircle2 size={40} className="text-blue-600" />
          </div>
        </div>
        <h2 className="text-2xl font-bold text-gray-900">Order Placed!</h2>
        <p className="text-gray-500 mt-2 text-sm">Your order has been received. We will review and confirm it shortly.</p>

        <div className="mt-5 bg-gray-50 rounded-xl p-4">
          <p className="text-xs text-gray-500 mb-1">Your Order Number</p>
          <div className="flex items-center justify-between gap-2">
            <p className="text-xl font-bold text-gray-900 tracking-widest">{orderNumber}</p>
            <button onClick={copy} className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 font-medium">
              <Copy size={13} />
              {copied ? 'Copied!' : 'Copy'}
            </button>
          </div>
          <p className="text-xs text-gray-400 mt-1">Save this number to track your order</p>
        </div>

        <div className="mt-4 bg-blue-50 rounded-xl p-4 text-left space-y-2">
          <div className="flex items-start gap-2">
            <MessageCircle size={15} className="text-blue-500 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-blue-700">A WhatsApp message with order details has been sent to your number.</p>
          </div>
          <div className="flex items-start gap-2">
            <Mail size={15} className="text-blue-500 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-blue-700">A confirmation email with payment instructions has been sent to your email.</p>
          </div>
        </div>

        <div className="mt-5 space-y-2">
          <button
            onClick={onTrackOrder}
            className="w-full flex items-center justify-center gap-2 bg-blue-700 hover:bg-blue-800 text-white font-semibold py-3 rounded-xl transition-colors text-sm"
          >
            <Search size={16} />
            Track My Order
          </button>
          <button onClick={onClose} className="w-full text-sm text-gray-500 hover:text-gray-700 py-2 transition-colors">
            Continue Shopping
          </button>
        </div>
      </div>
    </div>
  );
}
