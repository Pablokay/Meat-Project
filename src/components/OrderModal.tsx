import { useState, useEffect } from 'react';
import { X, Scale, Package, ShoppingBag, ShoppingCart, CircleCheck as CheckCircle2 } from 'lucide-react';
import { supabase, availableUnits, priceForUnit, UNIT_LABELS, type Livestock, type Unit, type CartItem, type AdminSetting } from '../lib/supabase';
import { useToast } from './Toast';

type OrderModalProps = {
  livestock: Livestock;
  onClose: () => void;
  onAddToCart: (item: CartItem) => void;
  onGoToCart: () => void;
};

function fmt(n: number) {
  return new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 }).format(n);
}

const UNIT_ICON: Partial<Record<Unit, React.ReactNode>> = {
  kg: <Scale size={18} />,
  portion: <Package size={18} />,
};

export default function OrderModal({ livestock, onClose, onAddToCart, onGoToCart }: OrderModalProps) {
  const toast = useToast();
  const units = availableUnits(livestock);
  const [unit, setUnit] = useState<Unit>(units[0] ?? 'kg');
  const [quantity, setQuantity] = useState(1);
  const [prepTypes, setPrepTypes] = useState<string[]>([]);
  const [comment, setComment] = useState('');
  const [commentEnabled, setCommentEnabled] = useState(true);
  const [commentLabel, setCommentLabel] = useState('Additional Comments');
  const [added, setAdded] = useState(false);

  // Preparation options + surcharges come from the livestock item, with a fallback
  // to the global list of names (surcharge 0) for back-compat.
  const [prepPrices, setPrepPrices] = useState<Record<string, number>>(livestock.preparation_prices ?? {});
  const [fallbackPrepNames, setFallbackPrepNames] = useState<string[]>([]);

  useEffect(() => {
    supabase.from('admin_settings').select('*').in('key', ['comment_field_enabled', 'comment_field_label', 'preparation_types']).then(({ data }) => {
      if (!data) return;
      const ce = data.find((s: AdminSetting) => s.key === 'comment_field_enabled');
      const cl = data.find((s: AdminSetting) => s.key === 'comment_field_label');
      const ps = data.find((s: AdminSetting) => s.key === 'preparation_types');
      if (ce) setCommentEnabled(ce.value === 'true');
      if (cl) setCommentLabel(cl.value || 'Additional Comments');
      if (ps) {
        try { setFallbackPrepNames(JSON.parse(ps.value)); } catch { /* ignore */ }
      }
    });
  }, []);

  useEffect(() => {
    setPrepPrices(livestock.preparation_prices ?? {});
  }, [livestock.id]);

  const prepEntries: { name: string; surcharge: number }[] =
    Object.keys(prepPrices).length > 0
      ? Object.entries(prepPrices).map(([name, surcharge]) => ({ name, surcharge: Number(surcharge) || 0 }))
      : fallbackPrepNames.map((name) => ({ name, surcharge: 0 }));

  const basePrice = priceForUnit(livestock, unit);
  const prepSurcharge = prepTypes.reduce((s, name) => s + (Number(prepPrices[name]) || 0), 0);
  const unitPrice = basePrice + prepSurcharge;
  const subtotal = unitPrice * quantity;

  function togglePrep(name: string) {
    setPrepTypes((prev) => (prev.includes(name) ? prev.filter((p) => p !== name) : [...prev, name]));
  }

  function buildItem(): CartItem {
    return {
      id: `cart_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      livestock_id: livestock.id,
      livestock_name: livestock.name,
      livestock_image: livestock.image_url,
      livestock_type: livestock.type,
      quantity,
      unit,
      unit_price: unitPrice,
      preparation_types: prepTypes,
      portion_size: ['full', 'half', 'quarter'].includes(unit) ? unit : undefined,
      subtotal,
      added_at: new Date().toISOString(),
    };
  }

  function handleAdd(goToCart: boolean) {
    onAddToCart(buildItem());
    toast(`${livestock.name} added to cart`);
    if (goToCart) {
      onClose();
      onGoToCart();
    } else {
      setAdded(true);
      setTimeout(() => setAdded(false), 1500);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-t-2xl sm:rounded-lg shadow-2xl w-full sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white z-10 border-b border-gray-100 p-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-gray-900">{livestock.name}</h2>
          <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600"><X size={20} /></button>
        </div>

        <div className="p-5 space-y-5">
          {/* Unit selection: KG, Portion, Full, Half, Quarter (only priced ones) */}
          <div>
            <p className="text-sm font-semibold text-gray-700 mb-2">Select Unit</p>
            <div className="grid grid-cols-3 gap-3">
              {units.map((u) => (
                <button
                  key={u}
                  onClick={() => setUnit(u)}
                  className={`p-3 rounded-xl border-2 flex flex-col items-center gap-1 transition-all ${unit === u ? 'border-forest-600 bg-forest-50' : 'border-gray-200 hover:border-gray-300'}`}
                >
                  <div className={unit === u ? 'text-forest-700' : 'text-gray-400'}>{UNIT_ICON[u] ?? <Package size={18} />}</div>
                  <span className={`text-sm font-bold ${unit === u ? 'text-forest-700' : 'text-gray-600'}`}>{UNIT_LABELS[u]}</span>
                  <span className="text-[11px] text-gray-500">{fmt(priceForUnit(livestock, u))}</span>
                </button>
              ))}
            </div>
            {units.length === 0 && <p className="text-sm text-gray-400">No pricing configured for this item.</p>}
          </div>

          {/* Quantity */}
          <div>
            <p className="text-sm font-semibold text-gray-700 mb-2">Quantity ({UNIT_LABELS[unit]})</p>
            <div className="flex items-center gap-4">
              <button onClick={() => setQuantity(Math.max(1, quantity - 1))} className="w-10 h-10 rounded-xl border border-gray-200 flex items-center justify-center text-gray-600 hover:bg-cream text-lg font-bold">-</button>
              <span className="text-2xl font-bold text-gray-900 w-12 text-center">{quantity}</span>
              <button onClick={() => setQuantity(quantity + 1)} className="w-10 h-10 rounded-xl border border-gray-200 flex items-center justify-center text-gray-600 hover:bg-cream text-lg font-bold">+</button>
            </div>
          </div>

          {/* Preparation types (multi-select, each with surcharge) */}
          {prepEntries.length > 0 && (
            <div>
              <p className="text-sm font-semibold text-gray-700 mb-2">Preparation Type <span className="font-normal text-gray-400">(select any)</span></p>
              <div className="grid grid-cols-2 gap-2">
                {prepEntries.map(({ name, surcharge }) => {
                  const selected = prepTypes.includes(name);
                  return (
                    <button
                      key={name}
                      onClick={() => togglePrep(name)}
                      className={`p-3 rounded-xl border-2 flex items-center justify-between gap-2 transition-all text-left ${selected ? 'border-forest-600 bg-forest-50' : 'border-gray-200 hover:border-gray-300'}`}
                    >
                      <span className={`text-sm font-semibold ${selected ? 'text-forest-700' : 'text-gray-600'}`}>{name}</span>
                      <span className="text-[11px] text-gray-500">{surcharge > 0 ? `+${fmt(surcharge)}` : 'Free'}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {commentEnabled && (
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1">{commentLabel} (optional)</label>
              <textarea value={comment} onChange={(e) => setComment(e.target.value)} rows={2} placeholder="Any special instructions..." className="w-full px-4 py-2.5 border-2 border-gray-200 rounded-xl text-sm focus:outline-none focus:border-forest-600 resize-none" />
            </div>
          )}

          <div className="bg-forest-50 rounded-xl p-4 space-y-1">
            <div className="flex justify-between text-sm"><span className="text-gray-600">Unit price</span><span className="font-semibold">{fmt(unitPrice)}</span></div>
            {prepSurcharge > 0 && <div className="flex justify-between text-xs text-gray-500"><span>incl. preparation</span><span>+{fmt(prepSurcharge)}</span></div>}
            <div className="flex justify-between text-sm font-bold border-t border-forest-700/15 pt-1"><span>Subtotal</span><span className="text-forest-700">{fmt(subtotal)}</span></div>
          </div>
        </div>

        <div className="sticky bottom-0 bg-white border-t border-gray-100 p-4 flex items-center gap-3">
          <button
            onClick={() => handleAdd(false)}
            disabled={units.length === 0}
            className="flex-1 flex items-center justify-center gap-2 border-2 border-forest-700 text-forest-700 hover:bg-forest-50 disabled:opacity-50 font-semibold py-3 rounded-xl transition-colors"
          >
            {added ? <><CheckCircle2 size={18} />Added!</> : <><ShoppingCart size={18} />Add to Cart</>}
          </button>
          <button
            onClick={() => handleAdd(true)}
            disabled={units.length === 0}
            className="flex-1 flex items-center justify-center gap-2 bg-forest-700 hover:bg-forest-800 disabled:bg-gray-300 text-white font-semibold py-3 rounded-xl transition-colors"
          >
            <ShoppingBag size={18} />Buy Now
          </button>
        </div>
      </div>
    </div>
  );
}
