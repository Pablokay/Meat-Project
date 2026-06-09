import { Scale, Package, ShoppingBag, CircleCheck as CheckCircle } from 'lucide-react';
import type { Livestock } from '../lib/supabase';

type LivestockCardProps = {
  livestock: Livestock;
  onOrder: (livestock: Livestock) => void;
};

const typeColors: Record<string, string> = {
  Cow: 'bg-amber-100 text-amber-800',
  Ram: 'bg-red-100 text-red-800',
  Goat: 'bg-teal-100 text-teal-800',
  Chicken: 'bg-yellow-100 text-yellow-800',
  Turkey: 'bg-orange-100 text-orange-800',
  Pig: 'bg-pink-100 text-pink-800',
};

function fmt(n: number) {
  return new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 }).format(n);
}

export default function LivestockCard({ livestock, onOrder }: LivestockCardProps) {
  const colorClass = typeColors[livestock.type] || 'bg-gray-100 text-gray-700';
  const hasPortionPrices = livestock.price_full || livestock.price_half || livestock.price_quarter;

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition-all duration-300 group flex flex-col">
      <div className="relative overflow-hidden h-52">
        <img
          src={livestock.image_url}
          alt={livestock.name}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          onError={(e) => {
            (e.target as HTMLImageElement).src = 'https://images.pexels.com/photos/735968/pexels-photo-735968.jpeg';
          }}
        />
        <div className="absolute top-3 left-3">
          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${colorClass}`}>
            {livestock.type}
          </span>
        </div>
        {livestock.is_available && (
          <div className="absolute top-3 right-3 bg-blue-600 text-white text-xs font-semibold px-2 py-1 rounded-full flex items-center gap-1">
            <CheckCircle size={11} />
            Available
          </div>
        )}
        {livestock.logo_url && (
          <div className="absolute bottom-3 right-3">
            <img src={livestock.logo_url} alt="" className="w-8 h-8 rounded-full bg-white/90 object-cover border border-white shadow-sm" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
          </div>
        )}
      </div>

      <div className="p-5 flex flex-col flex-1">
        <h3 className="text-lg font-bold text-gray-900">{livestock.name}</h3>
        <p className="text-sm text-gray-500 mt-1 leading-relaxed flex-1">{livestock.description}</p>

        <div className="mt-4 grid grid-cols-2 gap-2">
          {livestock.unit_options.includes('kg') && (
            <div className="bg-gray-50 rounded-xl p-3 text-center">
              <div className="flex items-center justify-center gap-1 text-gray-500 mb-1">
                <Scale size={13} />
                <span className="text-xs">Per KG</span>
              </div>
              <p className="text-sm font-bold text-gray-900">{fmt(livestock.price_per_kg)}</p>
            </div>
          )}
          {livestock.unit_options.includes('portion') && livestock.price_per_portion && (
            <div className="bg-blue-50 rounded-xl p-3 text-center">
              <div className="flex items-center justify-center gap-1 text-blue-600 mb-1">
                <Package size={13} />
                <span className="text-xs">Per Portion</span>
              </div>
              <p className="text-sm font-bold text-blue-700">{fmt(livestock.price_per_portion)}</p>
            </div>
          )}
        </div>

        {hasPortionPrices && (
          <div className="mt-2 grid grid-cols-3 gap-2">
            {livestock.price_full && (
              <div className="bg-blue-50 rounded-xl p-2.5 text-center">
                <p className="text-[10px] text-blue-600 font-semibold">Full</p>
                <p className="text-xs font-bold text-blue-700">{fmt(livestock.price_full)}</p>
              </div>
            )}
            {livestock.price_half && (
              <div className="bg-amber-50 rounded-xl p-2.5 text-center">
                <p className="text-[10px] text-amber-600 font-semibold">Half</p>
                <p className="text-xs font-bold text-amber-700">{fmt(livestock.price_half)}</p>
              </div>
            )}
            {livestock.price_quarter && (
              <div className="bg-teal-50 rounded-xl p-2.5 text-center">
                <p className="text-[10px] text-teal-600 font-semibold">Quarter</p>
                <p className="text-xs font-bold text-teal-700">{fmt(livestock.price_quarter)}</p>
              </div>
            )}
          </div>
        )}

        <div className="mt-3 flex items-center gap-3 text-xs text-gray-500">
          {livestock.available_kg > 0 && (
            <span className="flex items-center gap-1">
              <Scale size={12} className="text-blue-500" />
              {livestock.available_kg}kg available
            </span>
          )}
          {livestock.available_portions > 0 && (
            <span className="flex items-center gap-1">
              <Package size={12} className="text-blue-500" />
              {livestock.available_portions} portions
            </span>
          )}
        </div>

        <button
          onClick={() => onOrder(livestock)}
          className="mt-4 w-full flex items-center justify-center gap-2 bg-blue-700 hover:bg-blue-800 active:bg-blue-900 text-white font-semibold py-3 rounded-xl transition-colors text-sm"
        >
          <ShoppingBag size={16} />
          Place Order
        </button>
      </div>
    </div>
  );
}
