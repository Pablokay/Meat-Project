import { Plus, Star, Sliders } from 'lucide-react';
import { availableUnits, priceForUnit, UNIT_LABELS, type Livestock, type CartItem } from '../lib/supabase';
import { useToast } from './Toast';

type LivestockCardProps = {
  livestock: Livestock;
  onQuickAdd: (item: CartItem) => void;
  onCustomize: (livestock: Livestock) => void;
};

function fmt(n: number) {
  return new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 }).format(n);
}

export default function LivestockCard({ livestock, onQuickAdd, onCustomize }: LivestockCardProps) {
  const toast = useToast();
  const units = availableUnits(livestock);
  const fromUnit = units[0];
  const fromPrice = fromUnit ? priceForUnit(livestock, fromUnit) : livestock.price_per_kg;

  function quickAdd() {
    if (!fromUnit) { onCustomize(livestock); return; }
    onQuickAdd({
      id: `cart_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      livestock_id: livestock.id,
      livestock_name: livestock.name,
      livestock_image: livestock.image_url,
      livestock_type: livestock.type,
      quantity: 1,
      unit: fromUnit,
      unit_price: fromPrice,
      preparation_types: [],
      portion_size: ['full', 'half', 'quarter'].includes(fromUnit) ? fromUnit : undefined,
      subtotal: fromPrice,
      added_at: new Date().toISOString(),
    });
    toast(`${livestock.name} added to cart`);
  }

  return (
    <div className="group bg-white rounded-lg p-3 shadow-card border border-forest-700/5 hover:shadow-soft transition-all duration-300 flex flex-col">
      <button onClick={() => onCustomize(livestock)} className="relative overflow-hidden rounded-lg bg-sand aspect-[4/3] text-left">
        <img
          src={livestock.image_url}
          alt={livestock.name}
          className="w-full h-full object-cover group-hover:scale-[1.04] transition-transform duration-500"
          onError={(e) => { (e.target as HTMLImageElement).src = 'https://images.pexels.com/photos/735968/pexels-photo-735968.jpeg'; }}
        />
        <span className="absolute top-3 left-3 tag-pill">{livestock.type}</span>
        {livestock.is_available && (
          <span className="absolute top-3 right-3 tag-pill bg-forest-700/90 text-cream border-transparent">Available</span>
        )}
        {livestock.logo_url && (
          <img src={livestock.logo_url} alt="" className="absolute bottom-3 right-3 w-9 h-9 rounded-full bg-cream object-cover border-2 border-cream shadow-sm" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
        )}
      </button>

      <div className="px-2 pt-4 pb-2 flex flex-col flex-1">
        <div className="flex items-center gap-1 text-sage-600 mb-1">
          <Star size={13} className="fill-sage-400 text-sage-400" />
          <span className="text-xs font-medium">Farm-verified</span>
        </div>
        <button onClick={() => onCustomize(livestock)} className="text-left">
          <h3 className="text-base font-bold text-forest-900 leading-snug hover:text-forest-600 transition-colors">{livestock.name}</h3>
        </button>
        <p className="text-sm text-forest-800/55 mt-1 leading-relaxed line-clamp-2 flex-1">{livestock.description}</p>

        <div className="mt-4 flex items-end justify-between gap-2">
          <div>
            <p className="text-[11px] text-forest-800/45 font-medium">From {fromUnit ? `/ ${UNIT_LABELS[fromUnit]}` : ''}</p>
            <p className="text-lg font-bold text-forest-900">{fmt(fromPrice)}</p>
          </div>
          <div className="flex items-center gap-1.5">
            <button onClick={() => onCustomize(livestock)} title="Customize" className="w-10 h-10 flex items-center justify-center rounded-full border border-forest-700/15 text-forest-700 hover:bg-forest-50 transition-colors">
              <Sliders size={16} />
            </button>
            <button onClick={quickAdd} className="flex items-center gap-1.5 rounded-full bg-forest-700 text-cream text-sm font-semibold px-4 py-2.5 hover:bg-forest-800 active:scale-95 transition-all">
              <Plus size={16} strokeWidth={2.25} />Add
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
