import { useState, useEffect } from 'react';
import { ListFilter as Filter, Leaf, Search, Calendar, Clock } from 'lucide-react';
import { supabase, type Livestock, type DeliverySlot, type CartItem } from '../lib/supabase';
import LivestockCard from '../components/LivestockCard';
import OrderModal from '../components/OrderModal';

type ShopProps = {
  onNavigateToTrack: (orderNumber?: string) => void;
  onAddToCart: (item: CartItem) => void;
  onGoToCart: () => void;
};

const TYPES = ['All', 'Cow', 'Ram', 'Goat', 'Chicken', 'Turkey', 'Pig'];

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

  const filtered = livestock.filter(l => {
    const matchesType = selectedType === 'All' || l.type === selectedType;
    const matchesSearch = !search || l.name.toLowerCase().includes(search.toLowerCase()) || l.type.toLowerCase().includes(search.toLowerCase());
    return matchesType && matchesSearch;
  });

  const slotsByDate: Record<string, DeliverySlot[]> = {};
  slots.forEach(s => {
    if (!slotsByDate[s.slot_date]) slotsByDate[s.slot_date] = [];
    slotsByDate[s.slot_date].push(s);
  });

  return (
    <div className="min-h-screen bg-gray-50">
      <section className="relative bg-gray-900 text-white overflow-hidden">
        <img src="https://images.pexels.com/photos/735968/pexels-photo-735968.jpeg" alt="Farm" className="absolute inset-0 w-full h-full object-cover opacity-30" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 text-center">
          <div className="inline-flex items-center gap-2 bg-blue-500/20 border border-blue-400/30 text-blue-300 text-xs font-semibold px-3 py-1.5 rounded-full mb-4">
            <Leaf size={13} />
            Fresh from the Farm
          </div>
          <h1 className="text-4xl sm:text-5xl font-black leading-tight max-w-2xl mx-auto">
            Premium Livestock,<br />
            <span className="text-blue-400">Delivered Fresh</span>
          </h1>
          <p className="mt-4 text-gray-300 text-lg max-w-xl mx-auto">
            Order by kilogram or portion. Choose delivery or pickup. Fast, hygienic, and guaranteed fresh.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-4 text-sm text-gray-300">
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 bg-blue-400 rounded-full" />Same-day processing</span>
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 bg-blue-400 rounded-full" />Home delivery available</span>
            <span className="flex items-center gap-1.5"><span className="w-2 h-2 bg-blue-400 rounded-full" />WhatsApp updates</span>
          </div>
        </div>
      </section>

      {slots.length > 0 && (
        <section className="bg-white border-b border-gray-100">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <div className="flex items-center gap-2 mb-3">
              <Calendar size={16} className="text-blue-600" />
              <h3 className="text-sm font-bold text-gray-900">Available Delivery Slots</h3>
            </div>
            <div className="flex gap-3 overflow-x-auto pb-1 scrollbar-hide">
              {Object.entries(slotsByDate).slice(0, 5).map(([date, dateSlots]) => (
                <div key={date} className="flex-shrink-0 bg-gray-50 rounded-xl p-3 min-w-[160px]">
                  <p className="text-xs font-bold text-gray-700 mb-2">
                    {new Date(date + 'T12:00:00').toLocaleDateString('en-NG', { weekday: 'short', month: 'short', day: 'numeric' })}
                  </p>
                  <div className="space-y-1.5">
                    {dateSlots.map(slot => {
                      const remaining = slot.max_orders - slot.current_orders;
                      return (
                        <div key={slot.id} className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5 text-xs text-gray-600">
                            <Clock size={10} className="text-gray-400" />
                            <span>{slot.slot_label.split('(')[0].trim()}</span>
                          </div>
                          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${remaining <= 0 ? 'bg-red-100 text-red-600' : remaining <= 2 ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'}`}>
                            {remaining <= 0 ? 'Full' : `${remaining} left`}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      <section className="bg-white border-b border-gray-100 sticky top-16 z-30 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center gap-3 overflow-x-auto scrollbar-hide">
          <div className="flex items-center gap-2 text-gray-400 flex-shrink-0"><Filter size={15} /></div>
          {TYPES.map(type => (
            <button key={type} onClick={() => setSelectedType(type)} className={`flex-shrink-0 px-4 py-1.5 rounded-full text-sm font-medium transition-all ${selectedType === type ? 'bg-blue-700 text-white shadow-sm' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
              {type}
            </button>
          ))}
          <div className="relative flex-shrink-0 ml-auto">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input type="text" placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)} className="pl-8 pr-3 py-1.5 border border-gray-200 rounded-full text-sm w-36 focus:outline-none focus:border-blue-400" />
          </div>
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden animate-pulse">
                <div className="h-52 bg-gray-200" />
                <div className="p-5 space-y-3"><div className="h-4 bg-gray-200 rounded w-3/4" /><div className="h-3 bg-gray-100 rounded w-full" /><div className="h-10 bg-gray-100 rounded-xl mt-4" /></div>
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-gray-400 text-lg">No livestock found.</p>
            <button onClick={() => { setSelectedType('All'); setSearch(''); }} className="mt-3 text-blue-600 text-sm font-medium">Clear filters</button>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-2xl font-bold text-gray-900">
                {selectedType === 'All' ? 'All Livestock' : selectedType}
                <span className="ml-2 text-base font-normal text-gray-400">({filtered.length})</span>
              </h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {filtered.map(l => <LivestockCard key={l.id} livestock={l} onOrder={setOrderingLivestock} />)}
            </div>
          </>
        )}
      </section>

      {orderingLivestock && (
        <OrderModal
          livestock={orderingLivestock}
          onClose={() => setOrderingLivestock(null)}
          onAddToCart={onAddToCart}
          onGoToCart={onGoToCart}
        />
      )}
    </div>
  );
}
