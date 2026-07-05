import { useState, useEffect } from 'react';
import { Search, Package, CircleCheck as CheckCircle2, Check, Clock, Truck, Store, CircleAlert as AlertCircle, MessageCircle, Mail, Phone, ChevronDown, ChevronUp, ArrowLeft, User, Hash, MapPin, Calendar, CreditCard, Award, Sparkles } from 'lucide-react';
import { supabase, type Order, type OrderItem, type OrderUpdate } from '../lib/supabase';

type TrackOrderProps = {
  initialOrderNumber?: string;
};

type Tone = 'amber' | 'forest' | 'teal' | 'indigo' | 'green' | 'red';

const TONE: Record<Tone, { text: string; bg: string; border: string; dot: string; soft: string }> = {
  amber: { text: 'text-amber-700', bg: 'bg-amber-500', border: 'border-amber-200', dot: 'bg-amber-500', soft: 'bg-amber-50' },
  forest: { text: 'text-forest-700', bg: 'bg-forest-700', border: 'border-forest-700/15', dot: 'bg-forest-600', soft: 'bg-sage-50' },
  teal: { text: 'text-teal-700', bg: 'bg-teal-600', border: 'border-teal-200', dot: 'bg-teal-500', soft: 'bg-teal-50' },
  indigo: { text: 'text-indigo-700', bg: 'bg-indigo-600', border: 'border-indigo-200', dot: 'bg-indigo-500', soft: 'bg-indigo-50' },
  green: { text: 'text-green-700', bg: 'bg-green-600', border: 'border-green-200', dot: 'bg-green-500', soft: 'bg-green-50' },
  red: { text: 'text-red-700', bg: 'bg-red-600', border: 'border-red-200', dot: 'bg-red-500', soft: 'bg-red-50' },
};

const STATUS_CONFIG: Record<string, { label: string; tone: Tone; icon: typeof Clock }> = {
  pending: { label: 'Order Received', tone: 'amber', icon: Clock },
  awaiting_confirmation: { label: 'Awaiting Confirmation', tone: 'amber', icon: Clock },
  awaiting_payment: { label: 'Awaiting Payment', tone: 'amber', icon: CreditCard },
  confirmed: { label: 'Order Confirmed', tone: 'forest', icon: CheckCircle2 },
  processing: { label: 'Being Prepared', tone: 'forest', icon: Package },
  ready: { label: 'Ready for You', tone: 'teal', icon: Package },
  in_transit: { label: 'On the Way', tone: 'indigo', icon: Truck },
  delivered: { label: 'Completed', tone: 'green', icon: CheckCircle2 },
  cancelled: { label: 'Cancelled', tone: 'red', icon: AlertCircle },
};

// Happy-path steps and their short labels for the horizontal tracker.
const STEPS: { key: string; short: string; icon: typeof Clock }[] = [
  { key: 'pending', short: 'Placed', icon: Clock },
  { key: 'confirmed', short: 'Confirmed', icon: CheckCircle2 },
  { key: 'processing', short: 'Prepping', icon: Package },
  { key: 'ready', short: 'Ready', icon: Store },
  { key: 'in_transit', short: 'On the way', icon: Truck },
  { key: 'delivered', short: 'Done', icon: CheckCircle2 },
];
// Pre-confirmation statuses sit at the "placed" position on the tracker.
const STEP_ALIAS: Record<string, string> = { awaiting_confirmation: 'pending', awaiting_payment: 'pending' };

function fmt(n: number) {
  return new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 }).format(n);
}
function unitLabel(u: string) {
  const m: Record<string, string> = { kg: 'KG', portion: 'Portion', full: 'Full', half: 'Half', quarter: 'Quarter' };
  return m[u] ?? (u ? u.charAt(0).toUpperCase() + u.slice(1) : '');
}
function cap(s: string) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : s; }

function SectionCard({ title, icon: Icon, children, action }: { title: string; icon: typeof Clock; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="bg-paper rounded-lg border border-forest-700/10 p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-bold text-forest-900 flex items-center gap-2"><Icon size={15} className="text-forest-600" />{title}</h3>
        {action}
      </div>
      {children}
    </div>
  );
}

export default function TrackOrder({ initialOrderNumber }: TrackOrderProps) {
  const [query, setQuery] = useState(initialOrderNumber ?? '');
  const [orders, setOrders] = useState<Order[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [items, setItems] = useState<OrderItem[]>([]);
  const [updates, setUpdates] = useState<OrderUpdate[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showFullTimeline, setShowFullTimeline] = useState(false);
  const [confirming, setConfirming] = useState(false);
  const [searchMode, setSearchMode] = useState<'tracking' | 'phone'>('tracking');
  const [phoneQuery, setPhoneQuery] = useState('');
  const [emailQuery, setEmailQuery] = useState('');

  useEffect(() => {
    if (initialOrderNumber) {
      setQuery(initialOrderNumber);
      searchByTracking(initialOrderNumber);
    }
  }, [initialOrderNumber]);

  async function searchByTracking(overrideQuery?: string) {
    const q = (overrideQuery ?? query).trim().toUpperCase();
    if (!q) { setError('Please enter your order number'); return; }
    setLoading(true); setError(''); setOrders([]); setSelectedOrder(null);
    const { data, error: err } = await supabase.rpc('get_order_by_number', { p_number: q });
    const order = (data as Order[] | null)?.[0];
    if (err || !order) { setError('Order not found. Please check your order number and try again.'); setLoading(false); return; }
    setOrders([order]); selectOrder(order); setLoading(false);
  }

  async function searchByPhone() {
    const phone = phoneQuery.trim(); const email = emailQuery.trim();
    if (!phone && !email) { setError('Please enter your phone number or email'); return; }
    setLoading(true); setError(''); setOrders([]); setSelectedOrder(null);
    const { data, error: err } = await supabase.rpc('get_orders_by_contact', { p_phone: phone, p_email: email });
    const list = (data as Order[] | null) ?? [];
    if (err || list.length === 0) { setError('No orders found. Please check your phone number or email.'); setLoading(false); return; }
    setOrders(list); setSelectedOrder(null); setLoading(false);
  }

  async function loadDetails(orderNumber: string) {
    const [upd, its] = await Promise.all([
      supabase.rpc('get_order_updates_by_number', { p_number: orderNumber }),
      supabase.rpc('get_order_items_by_number', { p_number: orderNumber }),
    ]);
    setUpdates((upd.data as OrderUpdate[] | null) ?? []);
    setItems((its.data as OrderItem[] | null) ?? []);
  }

  async function confirmDelivery(order: Order) {
    setConfirming(true);
    await supabase.rpc('confirm_order_receipt', { p_access_token: order.access_token });
    setConfirming(false);
    if (searchMode === 'tracking') searchByTracking(order.order_number);
    else searchByPhone();
  }

  function selectOrder(order: Order) { setSelectedOrder(order); setShowFullTimeline(false); setItems([]); setUpdates([]); loadDetails(order.order_number); }

  const statusConfig = selectedOrder ? (STATUS_CONFIG[selectedOrder.order_status] ?? STATUS_CONFIG.pending) : null;
  const tone = statusConfig ? TONE[statusConfig.tone] : TONE.forest;
  const effStatus = selectedOrder ? (STEP_ALIAS[selectedOrder.order_status] ?? selectedOrder.order_status) : '';
  const stepIndex = STEPS.findIndex((s) => s.key === effStatus);
  const isCancelled = selectedOrder?.order_status === 'cancelled';

  // Line items: prefer the real order_items; fall back to the legacy single-item columns.
  const lineItems: { name: string; image: string; unit: string; qty: number; price: number; prep: string[]; portion: string; subtotal: number }[] =
    items.length > 0
      ? items.map((it) => ({ name: it.livestock_name, image: it.livestock_image, unit: it.unit, qty: it.quantity, price: it.unit_price, prep: it.preparation_types ?? [], portion: it.portion_size, subtotal: it.subtotal }))
      : selectedOrder
        ? [{ name: selectedOrder.livestock_name, image: '', unit: selectedOrder.unit, qty: selectedOrder.quantity, price: selectedOrder.unit_price, prep: selectedOrder.preparation_type ? [selectedOrder.preparation_type] : [], portion: selectedOrder.portion_size, subtotal: selectedOrder.subtotal || selectedOrder.total_amount }]
        : [];
  const itemsSubtotal = lineItems.reduce((s, i) => s + (i.subtotal || 0), 0);

  const inputCls = 'w-full pl-10 pr-4 py-3 rounded-lg bg-cream border border-forest-700/10 text-forest-900 text-sm font-medium focus:outline-none focus:border-forest-400';

  return (
    <div className="min-h-screen bg-cream">
      {/* Hero */}
      <section className="relative w-full bg-gradient-to-br from-forest-800 to-forest-900 pt-14 pb-28 text-center overflow-hidden">
        <div className="max-w-2xl mx-auto px-4 relative">
          <span className="inline-flex items-center gap-2 tag-pill bg-cream/10 text-cream border-cream/15">
            <Package size={13} /> Order Tracking
          </span>
          <h1 className="mt-4 text-4xl sm:text-5xl font-bold text-cream leading-tight">Track your <span className="accent text-sage-300">order</span></h1>
          <p className="text-cream/60 mt-3 text-sm">Search by tracking ID, or find every order with your phone or email.</p>
        </div>
      </section>

      {/* Floating search card */}
      <div className="max-w-2xl mx-auto px-4 -mt-16 relative z-10">
        <div className="surface p-5 sm:p-6">
          <div className="flex gap-1.5 p-1 bg-forest-50 rounded-full mb-4 w-full sm:w-auto sm:inline-flex">
            <button onClick={() => setSearchMode('tracking')} className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 rounded-full text-sm font-semibold transition-colors ${searchMode === 'tracking' ? 'bg-forest-700 text-cream' : 'text-forest-800/60 hover:text-forest-800'}`}>
              <Hash size={14} />Tracking ID
            </button>
            <button onClick={() => setSearchMode('phone')} className={`flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 rounded-full text-sm font-semibold transition-colors ${searchMode === 'phone' ? 'bg-forest-700 text-cream' : 'text-forest-800/60 hover:text-forest-800'}`}>
              <User size={14} />Phone / Email
            </button>
          </div>

          {searchMode === 'tracking' ? (
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Hash size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-forest-800/40" />
                <input type="text" placeholder="e.g. ORD-AB12CD34" value={query} onChange={e => setQuery(e.target.value.toUpperCase())} onKeyDown={e => e.key === 'Enter' && searchByTracking()} className={inputCls} />
              </div>
              <button onClick={() => searchByTracking()} disabled={loading} className="btn-primary py-3 sm:w-auto">
                {loading ? <div className="w-4 h-4 border-2 border-cream/40 border-t-cream rounded-full animate-spin" /> : <Search size={16} />} Track
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="relative">
                  <Phone size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-forest-800/40" />
                  <input type="tel" placeholder="Phone number" value={phoneQuery} onChange={e => setPhoneQuery(e.target.value)} onKeyDown={e => e.key === 'Enter' && searchByPhone()} className={inputCls} />
                </div>
                <div className="relative">
                  <Mail size={15} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-forest-800/40" />
                  <input type="email" placeholder="Email address" value={emailQuery} onChange={e => setEmailQuery(e.target.value)} onKeyDown={e => e.key === 'Enter' && searchByPhone()} className={inputCls} />
                </div>
              </div>
              <button onClick={() => searchByPhone()} disabled={loading} className="btn-primary w-full py-3">
                {loading ? <div className="w-4 h-4 border-2 border-cream/40 border-t-cream rounded-full animate-spin" /> : <Search size={16} />} Find My Orders
              </button>
            </div>
          )}
          {error && <div className="mt-3 flex items-center gap-2 bg-clay/10 border border-clay/20 rounded-lg px-4 py-2.5 text-clay text-sm"><AlertCircle size={15} />{error}</div>}
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-8 space-y-4">
        {/* Multi-order picker */}
        {orders.length > 1 && !selectedOrder && (
          <div className="space-y-3">
            <h2 className="text-lg font-bold text-forest-900">Your Orders ({orders.length})</h2>
            {orders.map(order => {
              const c = STATUS_CONFIG[order.order_status] ?? STATUS_CONFIG.pending; const t = TONE[c.tone];
              return (
                <button key={order.id} onClick={() => selectOrder(order)} className="w-full bg-paper rounded-lg border border-forest-700/10 p-4 text-left hover:border-forest-700/25 transition-colors">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-forest-900 text-sm">{order.order_number}</span>
                        <span className={`inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full font-semibold ${t.soft} ${t.text}`}><span className={`w-1.5 h-1.5 rounded-full ${t.dot}`} />{c.label}</span>
                      </div>
                      <p className="text-xs text-forest-800/50 mt-1">{order.livestock_name} · {fmt(order.total_amount)}</p>
                    </div>
                    <ChevronDown size={16} className="text-forest-800/30 -rotate-90 flex-shrink-0" />
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {orders.length === 1 && !selectedOrder && (
          <div className="bg-paper rounded-lg border border-forest-700/10 p-4">
            <button onClick={() => selectOrder(orders[0])} className="w-full text-left flex items-center justify-between gap-3">
              <div><span className="font-bold text-forest-900 text-sm">{orders[0].order_number}</span><p className="text-xs text-forest-800/50 mt-0.5">{orders[0].livestock_name} · {fmt(orders[0].total_amount)}</p></div>
              <ChevronDown size={16} className="text-forest-800/30 -rotate-90" />
            </button>
          </div>
        )}

        {/* Selected order detail */}
        {selectedOrder && statusConfig && (
          <div className="space-y-4">
            {orders.length > 1 && <button onClick={() => { setSelectedOrder(null); setUpdates([]); setItems([]); }} className="flex items-center gap-1.5 text-sm text-forest-800/60 hover:text-forest-800 font-medium"><ArrowLeft size={14} />Back to all orders</button>}

            {/* Status + progress */}
            <div className="bg-paper rounded-lg border border-forest-700/10 overflow-hidden">
              <div className={`${tone.bg} px-5 py-4 flex items-center gap-3 text-cream`}>
                <div className="bg-white/15 rounded-lg p-2"><statusConfig.icon size={20} /></div>
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-base leading-tight">{statusConfig.label}</p>
                  <p className="text-cream/70 text-xs mt-0.5">#{selectedOrder.order_number} · {new Date(selectedOrder.created_at).toLocaleDateString('en-NG', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
                </div>
              </div>

              {isCancelled ? (
                <div className="px-5 py-4 text-sm text-forest-800/60">This order was cancelled. Contact us if you believe this is a mistake.</div>
              ) : (
                <div className="px-4 sm:px-6 pt-6 pb-5">
                  <div className="flex">
                    {STEPS.map((s, i) => {
                      const done = i < stepIndex; const active = i === stepIndex; const reached = i <= stepIndex;
                      const StepIcon = s.icon;
                      return (
                        <div key={s.key} className="flex-1 flex flex-col items-center relative">
                          {i > 0 && <div className={`absolute top-4 right-1/2 w-full h-0.5 ${reached ? 'bg-forest-600' : 'bg-forest-100'}`} />}
                          <div className={`relative z-10 w-8 h-8 rounded-full flex items-center justify-center transition-all ${reached ? 'bg-forest-700 text-cream' : 'bg-forest-50 text-forest-800/30'} ${active ? 'ring-4 ring-sage-200' : ''}`}>
                            {done ? <Check size={15} /> : <StepIcon size={15} />}
                          </div>
                          <span className={`mt-2 text-[10px] font-semibold text-center leading-tight ${reached ? 'text-forest-800' : 'text-forest-800/40'}`}>{s.short}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Confirm receipt CTA */}
            {(selectedOrder.order_status === 'ready' || selectedOrder.order_status === 'in_transit') && !selectedOrder.customer_confirmed && (
              <div className="bg-sage-50 rounded-lg border-2 border-forest-700/15 p-5">
                <div className="flex items-start gap-3">
                  <div className="bg-forest-700 p-2 rounded-lg flex-shrink-0"><Sparkles size={20} className="text-cream" /></div>
                  <div className="flex-1">
                    <h3 className="font-bold text-forest-900 text-sm">Got your order?</h3>
                    <p className="text-xs text-forest-800/60 mt-0.5">Confirm receipt so we can close this out — it also lets you leave a review.</p>
                    <button onClick={() => confirmDelivery(selectedOrder)} disabled={confirming} className="mt-3 inline-flex items-center gap-2 bg-forest-700 hover:bg-forest-800 disabled:bg-sage-400 text-cream px-5 py-2.5 rounded-lg text-sm font-semibold transition-colors">
                      {confirming ? <><div className="w-4 h-4 border-2 border-cream/40 border-t-cream rounded-full animate-spin" />Confirming…</> : <><CheckCircle2 size={16} />Yes, I've received it</>}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Items + totals */}
            <SectionCard title={`Items (${lineItems.length})`} icon={Package}>
              <div className="-mt-1">
                {lineItems.map((it, idx) => (
                  <div key={idx} className="flex items-start justify-between gap-3 py-3 border-b border-forest-700/10 last:border-0 first:pt-0">
                    <div className="flex gap-3 min-w-0">
                      {it.image
                        ? <img src={it.image} alt="" className="w-12 h-12 rounded-lg object-cover flex-shrink-0 border border-forest-700/10" />
                        : <div className="w-12 h-12 rounded-lg bg-forest-50 flex items-center justify-center flex-shrink-0"><Package size={18} className="text-forest-800/30" /></div>}
                      <div className="min-w-0">
                        <p className="font-semibold text-forest-900 text-sm">{it.name}</p>
                        <p className="text-xs text-forest-800/50 mt-0.5">{it.qty} × {unitLabel(it.unit)}{it.portion ? ` · ${cap(it.portion)}` : ''} · {fmt(it.price)}</p>
                        {it.prep.length > 0 && (
                          <div className="flex flex-wrap gap-1 mt-1.5">
                            {it.prep.map((p) => <span key={p} className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-forest-50 text-forest-700">{p}</span>)}
                          </div>
                        )}
                      </div>
                    </div>
                    <span className="font-semibold text-forest-900 text-sm whitespace-nowrap">{fmt(it.subtotal)}</span>
                  </div>
                ))}
              </div>
              <div className="border-t border-forest-700/10 mt-1 pt-3 space-y-1.5 text-sm">
                <div className="flex justify-between text-forest-800/60"><span>Subtotal</span><span>{fmt(itemsSubtotal)}</span></div>
                {selectedOrder.delivery_fee > 0 && <div className="flex justify-between text-forest-800/60"><span>Delivery{selectedOrder.delivery_location_name ? ` · ${selectedOrder.delivery_location_name}` : ''}</span><span>{fmt(selectedOrder.delivery_fee)}</span></div>}
                <div className="flex justify-between items-center pt-1"><span className="font-bold text-forest-900">Total</span><span className="font-bold text-forest-700 text-lg">{fmt(selectedOrder.total_amount)}</span></div>
              </div>
              {selectedOrder.points_earned > 0 && (
                <div className="mt-3 flex items-center gap-2 bg-forest-50 rounded-lg px-3 py-2 text-xs font-semibold text-forest-700"><Award size={14} />You earned {selectedOrder.points_earned} reward points on this order</div>
              )}
            </SectionCard>

            {/* Fulfillment + schedule */}
            <SectionCard title={selectedOrder.fulfillment_type === 'delivery' ? 'Delivery' : 'Pickup'} icon={selectedOrder.fulfillment_type === 'delivery' ? Truck : Store}>
              <div className="space-y-3 text-sm">
                <div className="flex items-start gap-2.5">
                  <MapPin size={15} className="text-forest-800/40 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-forest-800/50 text-xs">{selectedOrder.fulfillment_type === 'delivery' ? 'Delivery address' : 'Pickup'}</p>
                    <p className="text-forest-900 font-medium">{selectedOrder.fulfillment_type === 'delivery' ? (selectedOrder.delivery_address || 'Address not provided') : 'Self pickup — our team will share the pickup location with you.'}</p>
                  </div>
                </div>
                {(selectedOrder.delivery_date || selectedOrder.delivery_slot_label || selectedOrder.pickup_time) && (
                  <div className="flex items-start gap-2.5">
                    <Calendar size={15} className="text-forest-800/40 mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="text-forest-800/50 text-xs">Scheduled</p>
                      <p className="text-forest-900 font-medium">
                        {selectedOrder.delivery_date ? new Date(selectedOrder.delivery_date + 'T12:00:00').toLocaleDateString('en-NG', { weekday: 'short', month: 'short', day: 'numeric' }) : ''}
                        {selectedOrder.delivery_slot_label ? ` · ${selectedOrder.delivery_slot_label}` : ''}
                        {selectedOrder.pickup_time ? ` · ${selectedOrder.pickup_time}` : ''}
                        {!selectedOrder.delivery_date && !selectedOrder.delivery_slot_label && !selectedOrder.pickup_time ? 'Not set' : ''}
                      </p>
                    </div>
                  </div>
                )}
                <div className="flex items-start gap-2.5">
                  <CreditCard size={15} className="text-forest-800/40 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-forest-800/50 text-xs">Payment</p>
                    <p className="text-forest-900 font-medium">{selectedOrder.payment_method === 'bank_transfer' ? 'Bank Transfer' : 'Virtual Account'} · {cap(selectedOrder.payment_status)}</p>
                  </div>
                </div>
              </div>
            </SectionCard>

            {/* Contact */}
            <SectionCard title="Contact" icon={User}>
              <div className="space-y-2 text-sm">
                {selectedOrder.customer_name && <div className="flex items-center gap-2.5 text-forest-800/70"><User size={14} className="text-forest-800/40" />{selectedOrder.customer_name}</div>}
                {selectedOrder.customer_phone && <div className="flex items-center gap-2.5 text-forest-800/70"><Phone size={14} className="text-forest-800/40" />{selectedOrder.customer_phone}</div>}
                {selectedOrder.customer_email && <div className="flex items-center gap-2.5 text-forest-800/70"><Mail size={14} className="text-forest-800/40" />{selectedOrder.customer_email}</div>}
                {selectedOrder.customer_whatsapp && <div className="flex items-center gap-2.5 text-forest-800/70"><MessageCircle size={14} className="text-forest-800/40" />{selectedOrder.customer_whatsapp} (WhatsApp)</div>}
              </div>
            </SectionCard>

            {/* Updates timeline */}
            {updates.length > 0 && (
              <SectionCard title={`Order Updates (${updates.length})`} icon={Clock} action={
                <button onClick={() => setShowFullTimeline(v => !v)} className="text-forest-800/40 hover:text-forest-800">{showFullTimeline ? <ChevronUp size={16} /> : <ChevronDown size={16} />}</button>
              }>
                <div className="relative pl-1">
                  <div className={`space-y-4 ${showFullTimeline ? '' : 'max-h-40 overflow-hidden'}`}>
                    {updates.map((upd, i) => (
                      <div key={upd.id} className="flex gap-3 relative">
                        {i < updates.length - 1 && <div className="absolute left-[3px] top-3 bottom-[-16px] w-0.5 bg-forest-100" />}
                        <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 z-10 ${upd.created_by === 'customer' ? 'bg-sage-400' : 'bg-forest-600'}`} />
                        <div>
                          <p className="text-xs text-forest-900 leading-relaxed">{upd.message}</p>
                          <p className="text-[11px] text-forest-800/40 mt-0.5">{new Date(upd.created_at).toLocaleString('en-NG')}{upd.created_by === 'customer' && <span className="ml-1 text-forest-600 font-medium">(by you)</span>}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                  {!showFullTimeline && updates.length > 3 && <div className="absolute bottom-0 inset-x-0 h-8 bg-gradient-to-t from-paper to-transparent pointer-events-none" />}
                </div>
              </SectionCard>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
