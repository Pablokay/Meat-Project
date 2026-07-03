import { useState, useEffect } from 'react';
import { Search, Package, CircleCheck as CheckCircle2, Clock, Truck, Store, CircleAlert as AlertCircle, MessageCircle, Mail, Phone, ChevronDown, ChevronUp, ArrowLeft, User, Hash } from 'lucide-react';
import { supabase, type Order, type OrderUpdate } from '../lib/supabase';

type TrackOrderProps = {
  initialOrderNumber?: string;
};

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; icon: React.ReactNode }> = {
  pending: { label: 'Order Pending', color: 'text-amber-700', bg: 'bg-amber-50 border-amber-200', icon: <Clock size={16} /> },
  confirmed: { label: 'Order Confirmed', color: 'text-blue-700', bg: 'bg-blue-50 border-blue-200', icon: <CheckCircle2 size={16} /> },
  processing: { label: 'Processing', color: 'text-orange-700', bg: 'bg-orange-50 border-orange-200', icon: <Package size={16} /> },
  ready: { label: 'Ready for Pickup/Delivery', color: 'text-teal-700', bg: 'bg-teal-50 border-teal-200', icon: <Package size={16} /> },
  in_transit: { label: 'In Transit', color: 'text-indigo-700', bg: 'bg-indigo-50 border-indigo-200', icon: <Truck size={16} /> },
  delivered: { label: 'Delivered / Picked Up', color: 'text-green-700', bg: 'bg-green-50 border-green-200', icon: <CheckCircle2 size={16} /> },
  cancelled: { label: 'Cancelled', color: 'text-red-700', bg: 'bg-red-50 border-red-200', icon: <AlertCircle size={16} /> },
  awaiting_confirmation: { label: 'Awaiting Confirmation', color: 'text-purple-700', bg: 'bg-purple-50 border-purple-200', icon: <Clock size={16} /> },
  awaiting_payment: { label: 'Awaiting Payment', color: 'text-amber-700', bg: 'bg-amber-50 border-amber-200', icon: <Clock size={16} /> },
};

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-800', confirmed: 'bg-blue-100 text-blue-800',
  processing: 'bg-orange-100 text-orange-800', ready: 'bg-teal-100 text-teal-800',
  in_transit: 'bg-indigo-100 text-indigo-800',
  delivered: 'bg-green-100 text-green-800', cancelled: 'bg-red-100 text-red-800',
};

const STEPS = ['pending', 'confirmed', 'processing', 'ready', 'in_transit', 'delivered'];

function fmt(n: number) {
  return new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 }).format(n);
}

export default function TrackOrder({ initialOrderNumber }: TrackOrderProps) {
  const [query, setQuery] = useState(initialOrderNumber ?? '');
  const [orders, setOrders] = useState<Order[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
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
    setOrders([order]); setSelectedOrder(order); loadUpdates(order.order_number); setLoading(false);
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

  async function loadUpdates(orderNumber: string) {
    const { data } = await supabase.rpc('get_order_updates_by_number', { p_number: orderNumber });
    setUpdates((data as OrderUpdate[] | null) ?? []);
  }

  async function confirmDelivery(order: Order) {
    setConfirming(true);
    await supabase.rpc('confirm_order_receipt', { p_access_token: order.access_token });
    setConfirming(false);
    if (searchMode === 'tracking') searchByTracking(order.order_number);
    else searchByPhone();
  }

  function selectOrder(order: Order) { setSelectedOrder(order); setShowFullTimeline(false); loadUpdates(order.order_number); }

  const statusConfig = selectedOrder ? (STATUS_CONFIG[selectedOrder.order_status] ?? STATUS_CONFIG.pending) : null;
  const stepIndex = selectedOrder ? STEPS.indexOf(selectedOrder.order_status) : -1;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-gray-900 text-white py-12">
        <div className="max-w-2xl mx-auto px-4 text-center">
          <div className="inline-flex items-center gap-2 bg-blue-500/20 border border-blue-400/30 text-blue-300 text-xs font-semibold px-3 py-1.5 rounded-full mb-4">
            <Package size={13} /> Order Tracking
          </div>
          <h1 className="text-3xl font-black">Track Your Order</h1>
          <p className="text-gray-400 mt-2 text-sm">Search by tracking ID or find all your orders</p>

          <div className="mt-6 flex justify-center gap-2 mb-4">
            <button onClick={() => setSearchMode('tracking')} className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${searchMode === 'tracking' ? 'bg-blue-600 text-white' : 'bg-white/10 text-white/70 hover:bg-white/20'}`}>
              <Hash size={14} />By Tracking ID
            </button>
            <button onClick={() => setSearchMode('phone')} className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${searchMode === 'phone' ? 'bg-blue-600 text-white' : 'bg-white/10 text-white/70 hover:bg-white/20'}`}>
              <User size={14} />By Phone / Email
            </button>
          </div>

          {searchMode === 'tracking' ? (
            <div className="flex gap-3">
              <input type="text" placeholder="e.g. ORD-AB12CD34" value={query} onChange={e => setQuery(e.target.value.toUpperCase())} onKeyDown={e => e.key === 'Enter' && searchByTracking()} className="flex-1 px-4 py-3 rounded-xl text-gray-900 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-400" />
              <button onClick={() => searchByTracking()} disabled={loading} className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-500 text-white px-5 py-3 rounded-xl font-semibold text-sm flex items-center gap-2 transition-colors">
                {loading ? <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> : <Search size={16} />} Track
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex gap-3">
                <div className="relative flex-1">
                  <Phone size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input type="tel" placeholder="Phone number" value={phoneQuery} onChange={e => setPhoneQuery(e.target.value)} onKeyDown={e => e.key === 'Enter' && searchByPhone()} className="w-full pl-9 pr-4 py-3 rounded-xl text-gray-900 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-400" />
                </div>
                <span className="text-gray-500 self-center">or</span>
                <div className="relative flex-1">
                  <Mail size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input type="email" placeholder="Email address" value={emailQuery} onChange={e => setEmailQuery(e.target.value)} onKeyDown={e => e.key === 'Enter' && searchByPhone()} className="w-full pl-9 pr-4 py-3 rounded-xl text-gray-900 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-blue-400" />
                </div>
              </div>
              <button onClick={() => searchByPhone()} disabled={loading} className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-blue-500 text-white px-5 py-3 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-colors">
                {loading ? <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> : <Search size={16} />} Find My Orders
              </button>
            </div>
          )}
          {error && <div className="mt-3 flex items-center gap-2 bg-red-500/20 border border-red-400/30 rounded-xl px-4 py-2.5 text-red-300 text-sm"><AlertCircle size={15} />{error}</div>}
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">
        {orders.length > 1 && !selectedOrder && (
          <div className="space-y-3">
            <h2 className="text-lg font-bold text-gray-900">Your Orders ({orders.length})</h2>
            {orders.map(order => (
              <button key={order.id} onClick={() => selectOrder(order)} className="w-full bg-white rounded-2xl border border-gray-100 p-4 text-left hover:shadow-md transition-all">
                <div className="flex items-center justify-between">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold text-gray-900 text-sm">{order.order_number}</span>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[order.order_status] ?? 'bg-gray-100 text-gray-600'}`}>{STATUS_CONFIG[order.order_status]?.label ?? order.order_status}</span>
                    </div>
                    <p className="text-xs text-gray-500 mt-1">{order.livestock_name} x {order.quantity} {order.unit} &middot; {fmt(order.total_amount)}</p>
                  </div>
                  <ChevronDown size={16} className="text-gray-400 -rotate-90" />
                </div>
              </button>
            ))}
          </div>
        )}

        {orders.length === 1 && !selectedOrder && (
          <div className="bg-white rounded-2xl border border-gray-100 p-4">
            <button onClick={() => selectOrder(orders[0])} className="w-full text-left">
              <div className="flex items-center justify-between">
                <div><span className="font-bold text-gray-900 text-sm">{orders[0].order_number}</span><p className="text-xs text-gray-500 mt-0.5">{orders[0].livestock_name} &middot; {fmt(orders[0].total_amount)}</p></div>
                <ChevronDown size={16} className="text-gray-400 -rotate-90" />
              </div>
            </button>
          </div>
        )}

        {selectedOrder && statusConfig && (
          <div className="space-y-4">
            {orders.length > 1 && <button onClick={() => { setSelectedOrder(null); setUpdates([]); }} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 font-medium"><ArrowLeft size={14} />Back to all orders</button>}

            <div className={`border rounded-2xl p-5 ${statusConfig.bg}`}>
              <div className="flex items-center gap-3">
                <div className={statusConfig.color}>{statusConfig.icon}</div>
                <div className="flex-1">
                  <p className={`font-bold ${statusConfig.color}`}>{statusConfig.label}</p>
                  <p className="text-xs text-gray-500 mt-0.5">Order #{selectedOrder.order_number} &middot; {new Date(selectedOrder.created_at).toLocaleDateString('en-NG', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
                </div>
              </div>
            </div>

            {(selectedOrder.order_status === 'ready' || selectedOrder.order_status === 'in_transit') && !selectedOrder.customer_confirmed && (
              <div className="bg-white rounded-2xl border-2 border-blue-200 p-5">
                <div className="flex items-start gap-3">
                  <div className="bg-blue-100 p-2 rounded-xl flex-shrink-0"><CheckCircle2 size={20} className="text-blue-600" /></div>
                  <div className="flex-1">
                    <h3 className="font-bold text-gray-900 text-sm">Confirm Receipt</h3>
                    <p className="text-xs text-gray-500 mt-0.5">Click below to confirm you have received your order.</p>
                    <button onClick={() => confirmDelivery(selectedOrder)} disabled={confirming} className="mt-3 flex items-center gap-2 bg-blue-700 hover:bg-blue-800 disabled:bg-blue-400 text-white px-5 py-2.5 rounded-xl text-sm font-semibold transition-colors">
                      {confirming ? <><div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />Confirming...</> : <><CheckCircle2 size={16} />Yes, I Have Received My Order</>}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {selectedOrder.order_status !== 'cancelled' && (
              <div className="bg-white rounded-2xl border border-gray-100 p-5">
                <h3 className="text-sm font-bold text-gray-700 mb-4">Order Progress</h3>
                <div className="relative">
                  <div className="absolute left-4 top-4 bottom-4 w-0.5 bg-gray-100" />
                  <div className="space-y-4">
                    {STEPS.map((s, i) => {
                      const cfg = STATUS_CONFIG[s]; const done = i <= stepIndex; const active = i === stepIndex;
                      return (
                        <div key={s} className="flex items-start gap-4 relative">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 z-10 transition-all ${done ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-300'} ${active ? 'ring-4 ring-blue-100' : ''}`}>
                            {done ? <CheckCircle2 size={16} /> : cfg.icon}
                          </div>
                          <div className="pt-1"><p className={`text-sm font-semibold ${done ? 'text-gray-900' : 'text-gray-400'}`}>{cfg.label}</p></div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            <div className="bg-white rounded-2xl border border-gray-100 p-5">
              <h3 className="text-sm font-bold text-gray-700 mb-4">Order Summary</h3>
              <div className="space-y-2.5 text-sm">
                {[
                  { label: 'Item', value: selectedOrder.livestock_name },
                  { label: 'Quantity', value: `${selectedOrder.quantity} ${selectedOrder.unit === 'kg' ? 'KG' : 'Portion(s)'}` },
                  { label: 'Preparation', value: selectedOrder.preparation_type === 'roasted' ? 'Roasted' : 'Fresh' },
                  { label: 'Portion Size', value: selectedOrder.portion_size.charAt(0).toUpperCase() + selectedOrder.portion_size.slice(1) },
                  ...(selectedOrder.customer_comment ? [{ label: 'Comment', value: selectedOrder.customer_comment }] : []),
                  { label: 'Fulfillment', value: selectedOrder.fulfillment_type === 'delivery' ? 'Home Delivery' : 'Self Pickup' },
                  { label: 'Scheduled', value: selectedOrder.delivery_date ? `${new Date(selectedOrder.delivery_date + 'T12:00:00').toLocaleDateString('en-NG', { weekday: 'short', month: 'short', day: 'numeric' })} - ${selectedOrder.delivery_slot_label}` : 'Not set' },
                  { label: 'Payment', value: `${selectedOrder.payment_method === 'bank_transfer' ? 'Bank Transfer' : 'Virtual Account'} - ${selectedOrder.payment_status.charAt(0).toUpperCase() + selectedOrder.payment_status.slice(1)}` },
                ].map(({ label, value }) => (
                  <div key={label} className="flex items-start justify-between gap-3"><span className="text-gray-500 w-28 flex-shrink-0">{label}</span><span className="font-medium text-gray-900 text-right">{value}</span></div>
                ))}
                <div className="border-t border-gray-100 pt-2.5 flex justify-between"><span className="font-bold text-gray-900">Total</span><span className="font-bold text-blue-700 text-lg">{fmt(selectedOrder.total_amount)}</span></div>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-gray-100 p-5">
              <h3 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2">
                {selectedOrder.fulfillment_type === 'delivery' ? <Truck size={15} className="text-blue-600" /> : <Store size={15} className="text-blue-600" />}
                {selectedOrder.fulfillment_type === 'delivery' ? 'Delivery Details' : 'Pickup Details'}
              </h3>
              {selectedOrder.fulfillment_type === 'delivery' ? (
                <p className="text-sm text-gray-700">{selectedOrder.delivery_address || 'Address not provided'}</p>
              ) : (
                <p className="text-sm text-gray-700">You selected self pickup. Our team will contact you with the pickup location.</p>
              )}
            </div>

            <div className="bg-white rounded-2xl border border-gray-100 p-5">
              <h3 className="text-sm font-bold text-gray-700 mb-3">Contact Information</h3>
              <div className="space-y-2 text-sm">
                <div className="flex items-center gap-2 text-gray-600"><Phone size={14} />{selectedOrder.customer_phone}</div>
                <div className="flex items-center gap-2 text-gray-600"><Mail size={14} />{selectedOrder.customer_email}</div>
                <div className="flex items-center gap-2 text-gray-600"><MessageCircle size={14} />{selectedOrder.customer_whatsapp} (WhatsApp)</div>
              </div>
            </div>

            {updates.length > 0 && (
              <div className="bg-white rounded-2xl border border-gray-100 p-5">
                <button onClick={() => setShowFullTimeline(v => !v)} className="w-full flex items-center justify-between">
                  <h3 className="text-sm font-bold text-gray-700">Order Updates ({updates.length})</h3>
                  {showFullTimeline ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
                </button>
                <div className={`space-y-3 mt-3 ${showFullTimeline ? '' : 'max-h-32 overflow-hidden'}`}>
                  {updates.map(upd => (
                    <div key={upd.id} className="flex gap-3">
                      <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${upd.created_by === 'customer' ? 'bg-blue-400' : 'bg-green-400'}`} />
                      <div>
                        <p className="text-xs text-gray-900 leading-relaxed">{upd.message}</p>
                        <p className="text-[11px] text-gray-400 mt-0.5">{new Date(upd.created_at).toLocaleString('en-NG')}{upd.created_by === 'customer' && <span className="ml-1 text-blue-500 font-medium">(by you)</span>}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
