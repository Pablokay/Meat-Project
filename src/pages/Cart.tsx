import { useState } from 'react';
import { Trash2, ShoppingBag, ChevronRight, X } from 'lucide-react';
import type { CartItem } from '../lib/supabase';

type CartProps = {
  items: CartItem[];
  onUpdateQuantity: (itemId: string, quantity: number) => void;
  onRemoveItem: (itemId: string) => void;
  onCheckout: () => void;
  onContinueShopping: () => void;
};

function fmt(n: number) {
  return new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 }).format(n);
}

export default function Cart({ items, onUpdateQuantity, onRemoveItem, onCheckout, onContinueShopping }: CartProps) {
  const subtotal = items.reduce((sum, item) => sum + item.subtotal, 0);
  const deliveryFee = 2500; // Same as in OrderModal
  const total = subtotal + deliveryFee;

  if (items.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-100 rounded-2xl mb-4">
            <ShoppingBag size={32} className="text-blue-600" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Your Cart is Empty</h1>
          <p className="text-gray-600 mb-6">Start shopping to add items to your cart</p>
          <button
            onClick={onContinueShopping}
            className="bg-blue-700 hover:bg-blue-800 text-white px-6 py-3 rounded-xl font-semibold transition-colors flex items-center gap-2 mx-auto"
          >
            Continue Shopping
            <ChevronRight size={18} />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="flex items-center gap-3 mb-8">
          <ShoppingBag size={28} className="text-blue-700" />
          <h1 className="text-3xl font-bold text-gray-900">Shopping Cart</h1>
          <span className="text-gray-500 text-lg ml-2">({items.length} {items.length === 1 ? 'item' : 'items'})</span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Cart Items */}
          <div className="lg:col-span-2 space-y-4">
            {items.map(item => (
              <div key={item.id} className="bg-white rounded-2xl border border-gray-100 p-5 flex gap-5 hover:shadow-md transition-shadow">
                {/* Image */}
                <div className="w-24 h-24 flex-shrink-0 rounded-xl overflow-hidden bg-gray-100">
                  <img src={item.livestock_image} alt={item.livestock_name} className="w-full h-full object-cover" />
                </div>

                {/* Details */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold text-gray-500 uppercase">{item.livestock_type}</p>
                      <h3 className="text-lg font-bold text-gray-900">{item.livestock_name}</h3>
                    </div>
                    <button
                      onClick={() => onRemoveItem(item.id)}
                      className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors flex-shrink-0"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>

                  <div className="mt-3 flex flex-wrap items-center gap-4 text-sm">
                    <span className="text-gray-600">{item.preparation_type}</span>
                    {item.portion_size && <span className="text-gray-600">({item.portion_size})</span>}
                    <span className="text-gray-400">|</span>
                    <span className="text-gray-600">{fmt(item.unit_price)} per {item.unit}</span>
                  </div>

                  {/* Quantity Control */}
                  <div className="mt-4 flex items-center gap-3">
                    <div className="flex items-center gap-2 border border-gray-200 rounded-lg p-1">
                      <button
                        onClick={() => onUpdateQuantity(item.id, Math.max(0.5, item.quantity - 1))}
                        className="w-8 h-8 flex items-center justify-center text-gray-600 hover:bg-gray-100 rounded transition-colors"
                      >
                        −
                      </button>
                      <span className="w-8 text-center font-semibold text-gray-900">
                        {item.unit === 'kg' ? item.quantity.toFixed(1) : item.quantity}
                      </span>
                      <button
                        onClick={() => onUpdateQuantity(item.id, item.quantity + (item.unit === 'kg' ? 0.5 : 1))}
                        className="w-8 h-8 flex items-center justify-center text-gray-600 hover:bg-gray-100 rounded transition-colors"
                      >
                        +
                      </button>
                    </div>
                    <span className="text-lg font-bold text-gray-900 flex-1">{fmt(item.subtotal)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Order Summary */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-2xl border border-gray-100 p-6 sticky top-24 space-y-4">
              <h2 className="text-lg font-bold text-gray-900">Order Summary</h2>

              <div className="space-y-2 border-b border-gray-100 pb-4">
                <div className="flex justify-between text-sm text-gray-600">
                  <span>Subtotal ({items.length} items)</span>
                  <span className="font-semibold text-gray-900">{fmt(subtotal)}</span>
                </div>
                <div className="flex justify-between text-sm text-gray-600">
                  <span>Delivery Fee</span>
                  <span className="font-semibold text-gray-900">{fmt(deliveryFee)}</span>
                </div>
              </div>

              <div className="flex justify-between text-lg font-bold">
                <span>Total</span>
                <span className="text-blue-700">{fmt(total)}</span>
              </div>

              <button
                onClick={onCheckout}
                className="w-full bg-blue-700 hover:bg-blue-800 text-white font-semibold py-3 rounded-xl transition-colors flex items-center justify-center gap-2"
              >
                Proceed to Checkout
                <ChevronRight size={18} />
              </button>

              <button
                onClick={onContinueShopping}
                className="w-full border-2 border-gray-200 text-gray-700 hover:bg-gray-50 font-semibold py-3 rounded-xl transition-colors"
              >
                Continue Shopping
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
