import { Plus, Heart } from 'lucide-react';
import { Link } from 'react-router-dom';
import { availableUnits, priceForUnit, UNIT_LABELS, type Livestock, type CartItem } from '../lib/supabase';
import { useToast } from './Toast';

type LivestockCardProps = {
  livestock: Livestock;
  onQuickAdd: (item: CartItem) => void;
  isFavorite?: boolean;
  canFavorite?: boolean;
  onToggleFavorite?: (livestock: Livestock) => void;
  avgRating?: number;
  reviewCount?: number;
  badge?: 'New' | 'Popular' | 'Low stock' | null;
  layout?: 'grid' | 'list';
};

function fmt(n: number) {
  return new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 }).format(n);
}

export default function LivestockCard({ livestock, onQuickAdd, isFavorite, canFavorite, onToggleFavorite, badge, layout = 'grid' }: LivestockCardProps) {
  const toast = useToast();
  const units = availableUnits(livestock);
  const fromUnit = units[0];
  const fromPrice = fromUnit ? priceForUnit(livestock, fromUnit) : livestock.price_per_kg;
  const stock = Math.max(livestock.available_kg ?? 0, livestock.available_portions ?? 0);
  const low = stock > 0 && stock <= 10;

  function quickAdd() {
    if (!fromUnit) return;
    onQuickAdd({
      id: `cart_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      livestock_id: livestock.id, livestock_name: livestock.name, livestock_image: livestock.image_url, livestock_type: livestock.type,
      quantity: 1, unit: fromUnit, unit_price: fromPrice, preparation_types: [],
      portion_size: ['full', 'half', 'quarter'].includes(fromUnit) ? fromUnit : undefined, subtotal: fromPrice, added_at: new Date().toISOString(),
    });
    toast(`${livestock.name} added to cart`);
  }

  const heart = canFavorite && (
    <button onClick={(e) => { e.preventDefault(); onToggleFavorite?.(livestock); }} className="absolute top-3 right-3 w-8 h-8 flex items-center justify-center rounded-full bg-cream/90 hover:bg-cream transition-colors" aria-label={isFavorite ? 'Remove from wishlist' : 'Add to wishlist'}>
      <Heart size={15} className={isFavorite ? 'fill-clay text-clay' : 'text-forest-800/50'} />
    </button>
  );
  const badgePill = (
    <span className="absolute top-3 left-3 inline-flex items-center gap-1 text-[11px] font-semibold bg-cream/95 text-forest-800 px-2.5 py-1 rounded-full border border-forest-700/10">
      <span className="w-1.5 h-1.5 rounded-full bg-forest-500" />{badge ?? livestock.type}
    </span>
  );
  const img = (
    <img src={livestock.image_url} alt={livestock.name} className="w-full h-full object-cover group-hover:scale-[1.03] transition-transform duration-500" onError={(e) => { (e.target as HTMLImageElement).src = 'https://images.pexels.com/photos/735968/pexels-photo-735968.jpeg'; }} />
  );
  const addBtn = (
    <button onClick={quickAdd} disabled={!fromUnit} aria-label="Add to cart" className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-full bg-forest-700 text-cream hover:bg-forest-800 disabled:opacity-40 active:scale-95 transition-all">
      <Plus size={16} strokeWidth={2.5} />
    </button>
  );

  if (layout === 'list') {
    return (
      <div className="group flex gap-4 bg-paper rounded-lg border border-forest-700/10 p-3">
        <Link to={`/product/${livestock.id}`} className="relative block w-36 sm:w-44 flex-shrink-0 rounded-lg overflow-hidden bg-sand aspect-square">{img}{badgePill}</Link>
        <div className="flex-1 min-w-0 flex flex-col justify-center">
          <p className="text-xs text-forest-800/45 font-medium">{livestock.type}</p>
          <Link to={`/product/${livestock.id}`}><h3 className="text-base font-bold text-forest-900 hover:text-forest-600 transition-colors">{livestock.name}</h3></Link>
          <p className="text-sm text-forest-800/55 mt-1 line-clamp-2">{livestock.description}</p>
          <div className="mt-3 flex items-center justify-between">
            <div>
              <p className="text-forest-700 font-bold">{fmt(fromPrice)}<span className="text-[11px] font-medium text-forest-800/40"> / {fromUnit ? UNIT_LABELS[fromUnit] : 'KG'}</span></p>
              {low && <span className="text-[11px] font-medium text-clay">{stock} left!</span>}
            </div>
            {addBtn}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="group">
      <Link to={`/product/${livestock.id}`} className="relative block rounded-lg overflow-hidden bg-sand aspect-[4/5]">{img}{badgePill}{heart}</Link>
      <div className="pt-3">
        <p className="text-xs text-forest-800/45 font-medium">{livestock.type}</p>
        <div className="flex items-start justify-between gap-2 mt-0.5">
          <Link to={`/product/${livestock.id}`}><h3 className="text-[15px] font-bold text-forest-900 leading-snug hover:text-forest-600 transition-colors">{livestock.name}</h3></Link>
          {addBtn}
        </div>
        <div className="mt-1.5 flex items-center justify-between">
          <p className="text-forest-700 font-bold">{fmt(fromPrice)}<span className="text-[11px] font-medium text-forest-800/40"> / {fromUnit ? UNIT_LABELS[fromUnit] : 'KG'}</span></p>
          {low && <span className="text-[11px] font-medium text-clay">{stock} left!</span>}
        </div>
      </div>
    </div>
  );
}
