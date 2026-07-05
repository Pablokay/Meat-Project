import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ArrowLeft, Scale, Package, Plus, Minus, Star, ShoppingCart, ShoppingBag } from 'lucide-react';
import { supabase, availableUnits, priceForUnit, UNIT_LABELS, type Unit, type CartItem, type AdminSetting } from '../lib/supabase';
import { useProduct, useReviews } from '../hooks/queries';
import { useApp } from '../providers/AppProvider';
import { useToast } from '../components/Toast';

function fmt(n: number) {
  return new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 }).format(n);
}
const UNIT_ICON: Partial<Record<Unit, React.ReactNode>> = { kg: <Scale size={18} />, portion: <Package size={18} /> };

export default function ProductPage() {
  const { id } = useParams();
  const { data: product, isLoading } = useProduct(id);
  const { data: reviews = [] } = useReviews();
  const { addToCart, setCartOpen } = useApp();
  const toast = useToast();

  const [unit, setUnit] = useState<Unit>('kg');
  const [quantity, setQuantity] = useState(1);
  const [prepTypes, setPrepTypes] = useState<string[]>([]);
  const [fallbackPrep, setFallbackPrep] = useState<string[]>([]);

  useEffect(() => {
    if (product) setUnit(availableUnits(product)[0] ?? 'kg');
  }, [product?.id]);

  useEffect(() => {
    supabase.from('admin_settings').select('*').eq('key', 'preparation_types').maybeSingle().then(({ data }) => {
      if (data) { try { setFallbackPrep(JSON.parse((data as AdminSetting).value)); } catch { /* */ } }
    });
  }, []);

  if (isLoading) return <div className="min-h-screen bg-cream flex items-center justify-center"><div className="w-8 h-8 border-[3px] border-forest-100 border-t-forest-700 rounded-full animate-spin" /></div>;
  if (!product) return (
    <div className="min-h-screen bg-cream flex flex-col items-center justify-center gap-3">
      <p className="text-forest-800/60">Product not found.</p>
      <Link to="/shop" className="btn-primary">Back to shop</Link>
    </div>
  );

  const units = availableUnits(product);
  const prepPrices = product.preparation_prices ?? {};
  const prepEntries = Object.keys(prepPrices).length > 0
    ? Object.entries(prepPrices).map(([name, s]) => ({ name, surcharge: Number(s) || 0 }))
    : fallbackPrep.map((name) => ({ name, surcharge: 0 }));

  const base = priceForUnit(product, unit);
  const surcharge = prepTypes.reduce((s, n) => s + (Number(prepPrices[n]) || 0), 0);
  const unitPrice = base + surcharge;
  const subtotal = unitPrice * quantity;

  const productReviews = reviews.filter((r) => r.livestock_id === product.id);
  const avg = productReviews.length ? productReviews.reduce((s, r) => s + r.rating, 0) / productReviews.length : 0;

  function buildItem(): CartItem {
    return {
      id: `cart_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      livestock_id: product!.id, livestock_name: product!.name, livestock_image: product!.image_url, livestock_type: product!.type,
      quantity, unit, unit_price: unitPrice, preparation_types: prepTypes,
      portion_size: ['full', 'half', 'quarter'].includes(unit) ? unit : undefined, subtotal, added_at: new Date().toISOString(),
    };
  }
  function add(open: boolean) {
    if (units.length === 0) return;
    addToCart(buildItem());
    toast(`${product!.name} added to cart`);
    if (open) setCartOpen(true);
  }

  return (
    <div className="bg-cream min-h-screen">
      <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <Link to="/shop" className="inline-flex items-center gap-1.5 text-sm text-forest-800/60 hover:text-forest-800 font-medium mb-5"><ArrowLeft size={15} />Back to shop</Link>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Image */}
          <div className="rounded-lg overflow-hidden bg-sand aspect-[4/3] lg:aspect-auto lg:h-[600px]">
            <img src={product.image_url} alt={product.name} className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).src = 'https://images.pexels.com/photos/735968/pexels-photo-735968.jpeg'; }} />
          </div>

          {/* Config */}
          <div>
            <span className="tag-pill">{product.type}</span>
            <h1 className="text-3xl font-bold text-forest-900 mt-3">{product.name}</h1>
            <div className="flex items-center gap-1 mt-2 text-sage-600">
              {[...Array(5)].map((_, i) => <Star key={i} size={15} className={i < Math.round(avg || 5) ? 'fill-sage-400 text-sage-400' : 'text-forest-800/20'} />)}
              <span className="text-xs text-forest-800/50 ml-1">{productReviews.length ? `${avg.toFixed(1)} · ${productReviews.length} review${productReviews.length > 1 ? 's' : ''}` : 'No reviews yet'}</span>
            </div>
            <p className="text-forest-800/60 mt-4 leading-relaxed">{product.description}</p>

            <div className="mt-6">
              <p className="text-sm font-semibold text-forest-800 mb-2">Select Unit</p>
              <div className="grid grid-cols-3 gap-3">
                {units.map((u) => (
                  <button key={u} onClick={() => setUnit(u)} className={`p-3 rounded-lg border-2 flex flex-col items-center gap-1 transition-all ${unit === u ? 'border-forest-600 bg-forest-50' : 'border-gray-200 hover:border-gray-300'}`}>
                    <div className={unit === u ? 'text-forest-700' : 'text-gray-400'}>{UNIT_ICON[u] ?? <Package size={18} />}</div>
                    <span className={`text-sm font-bold ${unit === u ? 'text-forest-700' : 'text-gray-600'}`}>{UNIT_LABELS[u]}</span>
                    <span className="text-[11px] text-gray-500">{fmt(priceForUnit(product, u))}</span>
                  </button>
                ))}
                {units.length === 0 && <p className="text-sm text-gray-400 col-span-3">No pricing configured.</p>}
              </div>
            </div>

            {prepEntries.length > 0 && (
              <div className="mt-5">
                <p className="text-sm font-semibold text-forest-800 mb-2">Preparation <span className="font-normal text-forest-800/40">(select any)</span></p>
                <div className="flex flex-wrap gap-2">
                  {prepEntries.map(({ name, surcharge: sc }) => {
                    const on = prepTypes.includes(name);
                    return <button key={name} onClick={() => setPrepTypes((p) => on ? p.filter((x) => x !== name) : [...p, name])} className={`px-3 py-2 rounded-full border-2 text-sm font-semibold transition-all ${on ? 'border-forest-600 bg-forest-50 text-forest-700' : 'border-gray-200 text-gray-600'}`}>{name}{sc > 0 ? ` +${fmt(sc)}` : ''}</button>;
                  })}
                </div>
              </div>
            )}

            <div className="mt-5 flex items-center gap-4">
              <p className="text-sm font-semibold text-forest-800">Quantity</p>
              <div className="flex items-center border border-forest-700/15 rounded-lg">
                <button onClick={() => setQuantity(Math.max(1, quantity - 1))} className="w-9 h-9 flex items-center justify-center text-forest-800/70 hover:bg-forest-50"><Minus size={15} /></button>
                <span className="w-10 text-center font-bold">{quantity}</span>
                <button onClick={() => setQuantity(quantity + 1)} className="w-9 h-9 flex items-center justify-center text-forest-800/70 hover:bg-forest-50"><Plus size={15} /></button>
              </div>
            </div>

            <div className="mt-6 flex items-center justify-between bg-paper rounded-lg border border-forest-700/10 p-4">
              <span className="text-sm text-forest-800/60">Subtotal</span>
              <span className="text-2xl font-bold text-forest-900">{fmt(subtotal)}</span>
            </div>

            <div className="mt-4 flex gap-3">
              <button onClick={() => add(false)} disabled={units.length === 0} className="flex-1 btn-outline"><ShoppingCart size={18} />Add to Cart</button>
              <button onClick={() => add(true)} disabled={units.length === 0} className="flex-1 btn-primary"><ShoppingBag size={18} />Buy Now</button>
            </div>
          </div>
        </div>

        {/* Reviews */}
        {productReviews.length > 0 && (
          <div className="mt-14">
            <h2 className="text-2xl font-bold text-forest-900 mb-5">Customer <span className="accent text-forest-600">reviews</span></h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {productReviews.map((r) => (
                <div key={r.id} className="surface p-5">
                  <div className="flex items-center gap-0.5 mb-2">{[...Array(5)].map((_, i) => <Star key={i} size={13} className={i < r.rating ? 'fill-sage-400 text-sage-400' : 'text-forest-800/15'} />)}</div>
                  <p className="text-sm text-forest-800/80 leading-relaxed">{r.comment || 'Great product!'}</p>
                  <p className="text-sm font-semibold text-forest-900 mt-4">{r.customer_name || 'Verified customer'}</p>
                  <p className="text-xs text-forest-800/40">Verified purchase</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
