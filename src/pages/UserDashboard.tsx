import { useState, useEffect, useCallback, useRef } from 'react';
import { LogOut, Package, ShoppingBag, Award, Bell, MessageCircle, Send, CircleCheck as CheckCircle2, Truck, CreditCard } from 'lucide-react';
import { supabase, type Order, type OrderItem, type Notification, type Message, type Profile, type CartItem, type Unit } from '../lib/supabase';
import PayNowModal from '../components/PayNowModal';
import { useToast } from '../components/Toast';

type UserDashboardProps = {
  profile: Profile;
  onLogout: () => void;
  onShop: () => void;
  onRefreshProfile: () => void;
  onReorder: (items: CartItem[]) => void;
};

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  pending: { label: 'Pending', color: 'text-amber-700', bg: 'bg-amber-100' },
  awaiting_confirmation: { label: 'Awaiting Confirmation', color: 'text-purple-700', bg: 'bg-purple-100' },
  awaiting_payment: { label: 'Awaiting Payment', color: 'text-amber-700', bg: 'bg-amber-100' },
  confirmed: { label: 'Confirmed', color: 'text-blue-700', bg: 'bg-blue-100' },
  processing: { label: 'Processing', color: 'text-orange-700', bg: 'bg-orange-100' },
  ready: { label: 'Ready', color: 'text-teal-700', bg: 'bg-teal-100' },
  in_transit: { label: 'In Transit', color: 'text-indigo-700', bg: 'bg-indigo-100' },
  delivered: { label: 'Delivered', color: 'text-green-700', bg: 'bg-green-100' },
  cancelled: { label: 'Cancelled', color: 'text-red-700', bg: 'bg-red-100' },
};

function fmt(n: number) {
  return new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 }).format(n);
}

export default function UserDashboard({ profile, onLogout, onShop, onRefreshProfile, onReorder }: UserDashboardProps) {
  const toast = useToast();
  const [tab, setTab] = useState<'orders' | 'notifications' | 'chat'>('orders');
  const [orders, setOrders] = useState<Order[]>([]);
  const [items, setItems] = useState<Record<string, OrderItem[]>>({});
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [payNowOrder, setPayNowOrder] = useState<Order | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const needsPayment = (o: Order) => o.payment_status !== 'confirmed' && !['awaiting_confirmation', 'cancelled'].includes(o.order_status);

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    const own = await supabase.from('orders').select('*').eq('user_id', profile.id).order('created_at', { ascending: false });
    let list: Order[] = own.data ?? [];
    if (profile.email) {
      const byEmail = await supabase.rpc('get_orders_by_contact', { p_phone: '', p_email: profile.email });
      if (byEmail.data) {
        const seen = new Set(list.map((o) => o.id));
        for (const o of byEmail.data as Order[]) if (!seen.has(o.id)) list.push(o);
      }
    }
    list.sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
    setOrders(list);
    setLoading(false);
  }, [profile.id, profile.email]);

  const fetchNotifications = useCallback(async () => {
    const { data } = await supabase.from('notifications').select('*').eq('recipient_type', 'user').eq('user_id', profile.id).order('created_at', { ascending: false });
    setNotifications(data ?? []);
  }, [profile.id]);

  const fetchMessages = useCallback(async () => {
    const { data } = await supabase.from('messages').select('*').eq('user_id', profile.id).order('created_at');
    setMessages(data ?? []);
  }, [profile.id]);

  useEffect(() => { fetchOrders(); fetchNotifications(); fetchMessages(); }, [fetchOrders, fetchNotifications, fetchMessages]);

  useEffect(() => { if (tab === 'chat') chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, tab]);

  async function loadItems(orderId: string, orderNumber: string) {
    if (items[orderId]) return;
    // own orders: RLS lets us read order_items; fall back to RPC for by-email orders.
    let data: OrderItem[] = [];
    const direct = await supabase.from('order_items').select('*').eq('order_id', orderId);
    if (direct.data && direct.data.length) data = direct.data;
    else {
      const rpc = await supabase.rpc('get_order_items_by_number', { p_number: orderNumber });
      if (rpc.data) data = rpc.data as OrderItem[];
    }
    setItems((prev) => ({ ...prev, [orderId]: data }));
  }

  async function confirmReceipt(order: Order) {
    setConfirming(order.id);
    await supabase.rpc('confirm_order_receipt', { p_access_token: order.access_token });
    setConfirming(null);
    fetchOrders();
    fetchNotifications();
    onRefreshProfile();
  }

  const cancellable = (o: Order) => ['pending', 'awaiting_confirmation', 'awaiting_payment'].includes(o.order_status) && o.payment_status !== 'confirmed';

  async function reorder(order: Order) {
    let lineItems = items[order.id];
    if (!lineItems) {
      const direct = await supabase.from('order_items').select('*').eq('order_id', order.id);
      lineItems = (direct.data && direct.data.length) ? direct.data : ((await supabase.rpc('get_order_items_by_number', { p_number: order.order_number })).data as OrderItem[] ?? []);
    }
    if (!lineItems.length) { toast('Nothing to reorder', 'error'); return; }
    const cartItems: CartItem[] = lineItems.map((it) => ({
      id: `cart_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
      livestock_id: it.livestock_id ?? '',
      livestock_name: it.livestock_name,
      livestock_image: it.livestock_image,
      livestock_type: '',
      quantity: it.quantity,
      unit: it.unit as Unit,
      unit_price: it.unit_price,
      preparation_types: it.preparation_types ?? [],
      portion_size: it.portion_size || undefined,
      subtotal: it.subtotal,
      added_at: new Date().toISOString(),
    }));
    onReorder(cartItems);
  }

  async function cancelOrder(order: Order) {
    if (!confirm(`Cancel order #${order.order_number}?`)) return;
    await supabase.from('orders').update({ order_status: 'cancelled', updated_at: new Date().toISOString() }).eq('id', order.id);
    await supabase.from('order_updates').insert({ order_id: order.id, status: 'cancelled', message: `Order #${order.order_number} was cancelled by the customer.`, created_by: 'customer' });
    await supabase.from('notifications').insert({ recipient_type: 'admin', title: 'Order cancelled', body: `Order #${order.order_number} was cancelled by the customer.`, type: 'order', order_id: order.id });
    toast('Order cancelled');
    fetchOrders();
  }

  async function sendMessage() {
    if (!chatInput.trim()) return;
    const body = chatInput.trim();
    setChatInput('');
    await supabase.from('messages').insert({ user_id: profile.id, sender: 'user', body });
    fetchMessages();
    // notify admin
    await supabase.from('notifications').insert({ recipient_type: 'admin', title: 'New message', body: `${profile.full_name || 'A customer'}: ${body.slice(0, 80)}`, type: 'message' });
  }

  const stats = {
    total: orders.length,
    active: orders.filter((o) => !['delivered', 'cancelled'].includes(o.order_status)).length,
    delivered: orders.filter((o) => o.order_status === 'delivered').length,
    spent: orders.filter((o) => o.payment_status === 'confirmed').reduce((s, o) => s + o.total_amount, 0),
  };

  const unreadNotif = notifications.filter((n) => !n.is_read).length;

  return (
    <div className="min-h-screen bg-cream">
      <div className="bg-white shadow-sm border-b border-forest-700/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">My Account</h1>
            <p className="text-gray-600 text-sm">Welcome, {profile.full_name || profile.email}</p>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={onShop} className="flex items-center gap-2 px-4 py-2 bg-forest-700 text-white hover:bg-forest-800 rounded-lg font-semibold transition-colors"><ShoppingBag size={16} />Shop</button>
            <button onClick={onLogout} className="flex items-center gap-2 px-4 py-2 bg-red-50 text-red-700 hover:bg-red-100 rounded-lg font-semibold transition-colors"><LogOut size={16} />Logout</button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Points + stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className="bg-gradient-to-br from-forest-600 to-forest-800 rounded-lg p-4 text-white">
            <div className="flex items-center gap-2"><Award size={18} /><p className="text-xs opacity-90">Reward Points</p></div>
            <p className="text-2xl font-bold mt-1">{profile.points ?? 0}</p>
            <p className="text-[11px] opacity-80 mt-1">Earn points on every confirmed order</p>
          </div>
          {[
            { label: 'Total Orders', value: stats.total, color: 'text-gray-900' },
            { label: 'Active', value: stats.active, color: 'text-forest-700' },
            { label: 'Total Spent', value: fmt(stats.spent), color: 'text-green-700' },
          ].map(({ label, value, color }) => (
            <div key={label} className="bg-white rounded-lg border border-forest-700/10 p-4">
              <p className="text-xs text-gray-500">{label}</p>
              <p className={`text-lg font-bold mt-1 ${color}`}>{value}</p>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-5">
          {([
            { key: 'orders' as const, label: 'My Orders', icon: Package },
            { key: 'notifications' as const, label: `Notifications${unreadNotif ? ` (${unreadNotif})` : ''}`, icon: Bell },
            { key: 'chat' as const, label: 'Chat with us', icon: MessageCircle },
          ]).map(({ key, label, icon: Icon }) => (
            <button key={key} onClick={() => { setTab(key); if (key === 'notifications') supabase.from('notifications').update({ is_read: true }).eq('recipient_type', 'user').eq('user_id', profile.id).then(() => fetchNotifications()); }} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${tab === key ? 'bg-forest-700 text-white' : 'bg-white text-gray-600 border border-forest-700/10 hover:bg-forest-50'}`}>
              <Icon size={14} />{label}
            </button>
          ))}
        </div>

        {tab === 'orders' && (
          <div className="space-y-4">
            {loading ? (
              <div className="text-center py-12"><div className="inline-flex w-8 h-8 border-3 border-forest-700/15 border-t-forest-700 rounded-full animate-spin" /></div>
            ) : orders.length === 0 ? (
              <div className="bg-white rounded-lg border border-forest-700/10 p-12 text-center">
                <Package size={48} className="mx-auto text-gray-300 mb-4" />
                <p className="text-gray-600 font-medium">No orders yet</p>
                <button onClick={onShop} className="mt-3 text-forest-700 text-sm font-semibold">Start shopping</button>
              </div>
            ) : (
              orders.map((order) => (
                <div key={order.id} className="bg-white rounded-lg border border-forest-700/10 overflow-hidden">
                  <div className="p-4 flex items-center justify-between cursor-pointer hover:bg-forest-50" onClick={() => { setExpanded(expanded === order.id ? null : order.id); loadItems(order.id, order.order_number); }}>
                    <div>
                      <p className="font-semibold text-gray-900">Order #{order.order_number}</p>
                      <p className="text-sm text-gray-600">{order.livestock_name}</p>
                      <div className="flex flex-wrap items-center gap-2 mt-1">
                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${STATUS_CONFIG[order.order_status]?.bg} ${STATUS_CONFIG[order.order_status]?.color}`}>{STATUS_CONFIG[order.order_status]?.label ?? order.order_status}</span>
                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${order.payment_status === 'confirmed' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'}`}>{order.payment_status === 'confirmed' ? 'Paid' : 'Payment pending'}</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-bold text-gray-900">{fmt(order.total_amount)}</p>
                      <p className="text-xs text-gray-500">{new Date(order.created_at).toLocaleDateString()}</p>
                    </div>
                  </div>

                  {/* Pay now when payment is outstanding */}
                  {needsPayment(order) && (
                    <div className="border-t border-forest-700/10 bg-sand p-4 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2 text-forest-800 text-sm font-medium"><CreditCard size={16} />
                        {order.order_status === 'awaiting_payment' ? 'Confirmed — complete your payment' : 'Payment pending for this order'}
                      </div>
                      <button onClick={() => setPayNowOrder(order)} className="flex items-center gap-2 bg-forest-700 hover:bg-forest-800 text-cream px-4 py-2 rounded-lg text-sm font-semibold"><CreditCard size={15} />Pay Now</button>
                    </div>
                  )}

                  {/* Confirm receipt when in transit / ready */}
                  {(order.order_status === 'in_transit' || order.order_status === 'ready') && !order.customer_confirmed && (
                    <div className="border-t border-forest-700/10 bg-indigo-50 p-4 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-2 text-indigo-700 text-sm font-medium"><Truck size={16} />{order.order_status === 'in_transit' ? 'On its way — confirm when you receive it' : 'Ready — confirm when you receive it'}</div>
                      <button onClick={() => confirmReceipt(order)} disabled={confirming === order.id} className="flex items-center gap-2 bg-forest-700 hover:bg-forest-800 disabled:bg-sage-400 text-white px-4 py-2 rounded-lg text-sm font-semibold">
                        {confirming === order.id ? <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> : <CheckCircle2 size={16} />}Confirm Receipt
                      </button>
                    </div>
                  )}

                  {expanded === order.id && (
                    <div className="border-t border-forest-700/10 p-4 bg-cream space-y-3">
                      {(items[order.id] ?? []).length > 0 && (
                        <div>
                          <p className="text-xs text-gray-600 font-medium mb-1">Items</p>
                          {(items[order.id] ?? []).map((it) => (
                            <div key={it.id} className="flex justify-between text-sm"><span className="text-gray-700">{it.livestock_name} · {it.quantity} {it.unit}{it.preparation_types?.length ? ` · ${it.preparation_types.join(', ')}` : ''}</span><span className="font-medium">{fmt(it.subtotal)}</span></div>
                          ))}
                        </div>
                      )}
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div><p className="text-xs text-gray-600 font-medium">Fulfillment</p><p className="text-gray-900 capitalize">{order.fulfillment_type}{order.delivery_location_name ? ` · ${order.delivery_location_name}` : ''}</p></div>
                        {order.fulfillment_type === 'delivery' && <div><p className="text-xs text-gray-600 font-medium">Address</p><p className="text-gray-900">{order.delivery_address}</p></div>}
                        {order.pickup_time && <div><p className="text-xs text-gray-600 font-medium">Pickup Time</p><p className="text-gray-900">{order.pickup_time}</p></div>}
                        <div><p className="text-xs text-gray-600 font-medium">Delivery Fee</p><p className="text-gray-900">{fmt(order.delivery_fee)}</p></div>
                        <div><p className="text-xs text-gray-600 font-medium">Total</p><p className="font-bold text-gray-900">{fmt(order.total_amount)}</p></div>
                      </div>
                      <div className="flex flex-wrap gap-2 pt-1">
                        <button onClick={() => reorder(order)} className="flex items-center gap-1.5 text-sm font-semibold text-forest-700 border border-forest-700/20 hover:bg-forest-50 rounded-lg px-3 py-1.5">Reorder</button>
                        {cancellable(order) && (
                          <button onClick={() => cancelOrder(order)} className="flex items-center gap-1.5 text-sm font-semibold text-red-600 border border-red-200 hover:bg-red-50 rounded-lg px-3 py-1.5">Cancel order</button>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        )}

        {tab === 'notifications' && (
          <div className="bg-white rounded-lg border border-forest-700/10 divide-y divide-forest-700/5">
            {notifications.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-12">No notifications yet.</p>
            ) : notifications.map((n) => (
              <div key={n.id} className="p-4">
                <p className="text-sm font-semibold text-gray-900">{n.title}</p>
                <p className="text-sm text-gray-600 mt-0.5">{n.body}</p>
                <p className="text-[11px] text-gray-400 mt-1">{new Date(n.created_at).toLocaleString()}</p>
              </div>
            ))}
          </div>
        )}

        {tab === 'chat' && (
          <div className="bg-white rounded-lg border border-forest-700/10 flex flex-col h-[500px]">
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {messages.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-12">Start a conversation with our team.</p>
              ) : messages.map((m) => (
                <div key={m.id} className={`flex ${m.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[75%] rounded-lg px-4 py-2 text-sm ${m.sender === 'user' ? 'bg-forest-700 text-white' : 'bg-sand text-forest-900'}`}>
                    {m.body}
                    <div className={`text-[10px] mt-1 ${m.sender === 'user' ? 'text-cream/70' : 'text-gray-400'}`}>{new Date(m.created_at).toLocaleString()}</div>
                  </div>
                </div>
              ))}
              <div ref={chatEndRef} />
            </div>
            <div className="border-t border-forest-700/10 p-3 flex gap-2">
              <input value={chatInput} onChange={(e) => setChatInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && sendMessage()} placeholder="Type a message..." className="flex-1 border border-forest-700/10 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-forest-600" />
              <button onClick={sendMessage} className="bg-forest-700 hover:bg-forest-800 text-white px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-1"><Send size={14} />Send</button>
            </div>
          </div>
        )}
      </div>

      {payNowOrder && (
        <PayNowModal order={payNowOrder} onClose={() => setPayNowOrder(null)} onPaid={fetchOrders} />
      )}
    </div>
  );
}
