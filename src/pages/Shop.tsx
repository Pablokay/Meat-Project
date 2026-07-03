import { useState, useEffect } from 'react';
import { Search, Leaf, ArrowRight, Truck, Clock, MessageCircle, Star, Quote } from 'lucide-react';
import { supabase, type Livestock, type DeliverySlot, type CartItem } from '../lib/supabase';
import LivestockCard from '../components/LivestockCard';
import OrderModal from '../components/OrderModal';

type ShopProps = {
  onNavigateToTrack: (orderNumber?: string) => void;
  onAddToCart: (item: CartItem) => void;
  onGoToCart: () => void;
};

const TYPES = ['All', 'Cow', 'Ram', 'Goat', 'Chicken', 'Turkey', 'Pig'];

const REVIEWS = [
  { name: 'Adaeze O.', role: 'Home cook', text: 'Freshest ram I have had in Lagos. Delivery was on time and the WhatsApp updates were reassuring.' },
  { name: 'Tunde B.', role: 'Event planner', text: 'Ordered a full cow for a wedding — perfectly prepared and portioned. Will absolutely reorder.' },
  { name: 'Ngozi K.', role: 'Restaurateur', text: 'Consistent quality every single week. The per-KG pricing makes stock planning so easy.' },
  { name: 'Emeka U.', role: 'Family of six', text: 'Love that I can pick preparation type and pickup time. Felt premium end to end.' },
];

function fmt(n: number) {
  return new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 }).format(n);
}

export default function Shop({ onAddToCart, onGoToCart }: ShopProps) {
  const [livestock, setLivestock] = useState<Livestock[]>([]);
  const [slots, setSlots] = useState<DeliverySlot[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedType, setSelectedType] = useState('All');
  const [search, setSearch] = useState('');
  const [orderingLivestock, setOrderingLivestock] = useState<Livestock | null>(null);

  useEffect(() => {
    Promise.all([
      supabase.from('livestock').select('*').eq('is_available', true).order('created_at'),
      supabase.from('delivery_slots').select('*').gte('slot_date', new Date().toISOString().split('T')[0]).order('slot_date'),
    ]).then(([livestockRes, slotsRes]) => {
      setLivestock(livestockRes.data ?? []);
      setSlots(slotsRes.data ?? []);
      setLoading(false);
    });
  }, []);

  const filtered = livestock.filter((l) => {
    const matchesType = selectedType === 'All' || l.type === selectedType;
    const matchesSearch = !search || l.name.toLowerCase().includes(search.toLowerCase()) || l.type.toLowerCase().includes(search.toLowerCase());
    return matchesType && matchesSearch;
  });

  const featured = livestock[livestock.length - 1];
  const gallery = livestock.slice(0, 6);

  return (
    <div className="bg-cream">
      {/* ===== HERO (full width) ===== */}
      <section className="relative w-full min-h-[480px] sm:min-h-[600px] flex items-center overflow-hidden">
        <img src="https://images.pexels.com/photos/735968/pexels-photo-735968.jpeg" alt="Farm" className="absolute inset-0 w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-r from-forest-900/85 via-forest-900/55 to-forest-900/10" />
        <div className="relative w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="py-16 max-w-xl">
            <span className="inline-flex items-center gap-2 tag-pill bg-cream/15 text-cream border-cream/20 backdrop-blur">
              <Leaf size={13} /> Farm fresh, every order
            </span>
            <h1 className="mt-5 text-4xl sm:text-6xl font-bold text-cream leading-[1.05]">
              Premium <span className="accent text-sage-300">Livestock</span><br />for a fuller table
            </h1>
            <p className="mt-4 text-cream/75 text-base sm:text-lg max-w-md">
              Order by kilogram or portion. Choose your preparation, delivery or pickup — hygienic, fast, and guaranteed fresh.
            </p>
            <div className="mt-7 flex items-center gap-3">
              <a href="#shop" className="btn-primary bg-cream text-forest-800 hover:bg-white">Shop now <ArrowRight size={17} /></a>
              <a href="#gallery" className="btn-outline border-cream/30 text-cream hover:bg-cream/10">Explore</a>
            </div>
          </div>
        </div>
        <div className="hidden lg:block absolute bottom-10 right-[max(2rem,calc((100%-80rem)/2+2rem))] bg-forest-800/70 backdrop-blur rounded-lg p-5 text-cream w-52 border border-cream/10">
          <p className="text-xs text-cream/70">Natural. Hygienic.<br />Trusted by families.</p>
          <p className="text-4xl font-bold mt-3 accent">4.9<span className="text-lg not-italic font-sans text-cream/70">/5</span></p>
        </div>
      </section>

      {/* trust strip */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-6">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            { icon: Clock, label: 'Same-day processing' },
            { icon: Truck, label: 'Home delivery available' },
            { icon: MessageCircle, label: 'WhatsApp order updates' },
          ].map(({ icon: Icon, label }) => (
            <div key={label} className="surface flex items-center gap-3 px-5 py-4">
              <div className="w-9 h-9 rounded-full bg-forest-50 flex items-center justify-center text-forest-700"><Icon size={17} strokeWidth={1.75} /></div>
              <span className="text-sm font-medium text-forest-800">{label}</span>
            </div>
          ))}
        </div>
      </section>

      {/* ===== PRODUCTS ===== */}
      <section id="shop" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-14">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sage-600 font-medium text-sm">Fresh from our farms</p>
            <h2 className="text-3xl font-bold text-forest-900">Bestselling <span className="accent text-forest-600">Livestock</span></h2>
          </div>
          <div className="relative">
            <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-forest-800/40" />
            <input type="text" placeholder="Search livestock..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10 pr-4 py-3 bg-white border border-forest-700/10 rounded-full text-sm w-full sm:w-64 focus:outline-none focus:border-forest-400" />
          </div>
        </div>

        <div className="flex gap-2 mt-6 overflow-x-auto scrollbar-hide pb-1">
          {TYPES.map((type) => (
            <button key={type} onClick={() => setSelectedType(type)} className={`flex-shrink-0 px-5 py-2 rounded-full text-sm font-semibold transition-all ${selectedType === type ? 'bg-forest-700 text-cream' : 'bg-white text-forest-800/70 border border-forest-700/10 hover:bg-forest-50'}`}>{type}</button>
          ))}
        </div>

        <div className="mt-8">
          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="bg-white rounded-lg p-3 animate-pulse">
                  <div className="aspect-[4/3] bg-sand rounded-lg" />
                  <div className="p-3 space-y-3"><div className="h-4 bg-sand rounded w-3/4" /><div className="h-3 bg-sand/70 rounded w-full" /><div className="h-9 bg-sand rounded-full mt-3" /></div>
                </div>
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-20">
              <p className="text-forest-800/50 text-lg">No livestock found.</p>
              <button onClick={() => { setSelectedType('All'); setSearch(''); }} className="mt-3 text-forest-700 font-semibold">Clear filters</button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              {filtered.map((l) => <LivestockCard key={l.id} livestock={l} onQuickAdd={onAddToCart} onCustomize={setOrderingLivestock} />)}
            </div>
          )}
        </div>
      </section>

      {/* ===== NEW ARRIVAL FEATURE ===== */}
      {featured && (
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-16">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-center bg-white rounded-lg overflow-hidden shadow-card border border-forest-700/5">
            <div className="h-72 lg:h-full min-h-[300px]">
              <img src={featured.image_url} alt={featured.name} className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).src = 'https://images.pexels.com/photos/735968/pexels-photo-735968.jpeg'; }} />
            </div>
            <div className="p-8 sm:p-12">
              <p className="text-sage-600 font-medium text-sm">Freshly added</p>
              <h3 className="text-3xl font-bold text-forest-900 mt-1">New <span className="accent text-forest-600">Arrival</span></h3>
              <p className="text-forest-800/60 mt-3 leading-relaxed">{featured.description || `Introducing our ${featured.name} — sourced with care and prepared to your preference. A wholesome, planet-friendly choice for your table.`}</p>
              <p className="mt-5 text-2xl font-bold text-forest-900">{fmt(featured.price_per_kg)}<span className="text-sm font-medium text-forest-800/50"> / KG</span></p>
              <button onClick={() => setOrderingLivestock(featured)} className="btn-primary mt-6">Order {featured.name} <ArrowRight size={17} /></button>
            </div>
          </div>
        </section>
      )}

      {/* ===== GALLERY ===== */}
      {gallery.length > 0 && (
        <section id="gallery" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-16">
          <p className="text-sage-600 font-medium text-sm">Thoughtful, farm-to-table</p>
          <h3 className="text-3xl font-bold text-forest-900">Our <span className="accent text-forest-600">Gallery</span></h3>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mt-6">
            {gallery.map((g, i) => (
              <button key={g.id} onClick={() => setOrderingLivestock(g)} className={`relative overflow-hidden rounded-lg bg-sand group ${i === 0 ? 'col-span-2 row-span-2 aspect-square md:aspect-auto' : 'aspect-square'}`}>
                <img src={g.image_url} alt={g.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" onError={(e) => { (e.target as HTMLImageElement).src = 'https://images.pexels.com/photos/735968/pexels-photo-735968.jpeg'; }} />
                <span className="absolute bottom-2 left-2 tag-pill text-[11px]">{g.name}</span>
              </button>
            ))}
          </div>
        </section>
      )}

      {/* ===== REVIEWS ===== */}
      <section className="w-full bg-forest-800 text-cream mt-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14 sm:py-16">
          <div className="flex flex-wrap items-end gap-4 justify-between">
            <div className="flex items-end gap-4">
              <p className="text-5xl font-bold accent">4.9<span className="text-xl not-italic font-sans text-cream/60">/5</span></p>
              <div className="flex items-center gap-1 mb-2">{[...Array(5)].map((_, i) => <Star key={i} size={16} className="fill-sage-300 text-sage-300" />)}</div>
            </div>
            <p className="text-cream/70 text-sm max-w-xs">Loved by 20,000+ families and kitchens across the country.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-8">
            {REVIEWS.map((r) => (
              <div key={r.name} className="bg-cream/5 border border-cream/10 rounded-lg p-5">
                <Quote size={20} className="text-sage-300" />
                <p className="text-sm text-cream/85 mt-3 leading-relaxed">{r.text}</p>
                <p className="text-sm font-semibold mt-4">{r.name}</p>
                <p className="text-xs text-cream/50">{r.role}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== DELIVERY SLOTS ===== */}
      {slots.length > 0 && (
        <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-16">
          <h3 className="text-2xl font-bold text-forest-900">Upcoming <span className="accent text-forest-600">delivery slots</span></h3>
          <div className="flex gap-3 overflow-x-auto scrollbar-hide pb-1 mt-5">
            {slots.slice(0, 8).map((slot) => {
              const remaining = slot.max_orders - slot.current_orders;
              return (
                <div key={slot.id} className="flex-shrink-0 surface px-5 py-4 min-w-[190px]">
                  <p className="text-sm font-bold text-forest-900">{new Date(slot.slot_date + 'T12:00:00').toLocaleDateString('en-NG', { weekday: 'short', month: 'short', day: 'numeric' })}</p>
                  <p className="text-xs text-forest-800/50 mt-0.5">{slot.slot_label}</p>
                  <span className={`inline-block mt-2 text-[11px] font-semibold px-2.5 py-1 rounded-full ${remaining <= 0 ? 'bg-clay/10 text-clay' : 'bg-forest-50 text-forest-700'}`}>{remaining <= 0 ? 'Full' : `${remaining} slots left`}</span>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* ===== CTA (full width band) ===== */}
      <section className="w-full bg-sand mt-16">
        <div className="max-w-2xl mx-auto px-4 py-16 text-center">
          <p className="text-forest-800/70 text-lg leading-relaxed">
            Committed to <span className="accent text-forest-600">humane sourcing</span>, hygienic processing, and <span className="accent text-forest-600">fresh delivery</span> — for a healthier table and happier home.
          </p>
          <a href="#shop" className="btn-primary mt-6">Start your order <ArrowRight size={17} /></a>
        </div>
      </section>

      {orderingLivestock && (
        <OrderModal livestock={orderingLivestock} onClose={() => setOrderingLivestock(null)} onAddToCart={onAddToCart} onGoToCart={onGoToCart} />
      )}
    </div>
  );
}
