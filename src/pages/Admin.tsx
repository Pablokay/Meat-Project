import { useState, useEffect, useRef, useCallback } from 'react';
import {
  supabase, type Order, type OrderUpdate, type OrderItem, type Livestock, type BankAccount,
  type DeliverySlot, type Customer, type AdminSetting, type DeliveryLocation, type Message,
} from '../lib/supabase';
import PasswordManager from '../components/PasswordManager';
import {
  Package, CircleCheck as CheckCircle2, RefreshCw, ChevronDown, ChevronUp, Send, Bell, Search,
  ListFilter as Filter, LogOut, Plus, Pencil, Trash2, Upload, X, Image as ImageIcon, CreditCard,
  ExternalLink, FileText, Users, Settings, ToggleLeft, ToggleRight, Phone, Mail, MessageCircle,
  Lock, Building2, Calendar, Download, MapPin, Truck, RotateCcw, ShoppingCart, BarChart3, Award,
} from 'lucide-react';

const STATUS_LABELS: Record<string, string> = {
  pending: 'Pending', awaiting_confirmation: 'Awaiting Confirmation', confirmed: 'Confirmed',
  processing: 'Processing', ready: 'Ready', in_transit: 'In Transit', delivered: 'Delivered', cancelled: 'Cancelled',
};
const PAYMENT_LABELS: Record<string, string> = { pending: 'Pending', confirmed: 'Confirmed', failed: 'Failed' };
const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-800', awaiting_confirmation: 'bg-purple-100 text-purple-800',
  confirmed: 'bg-blue-100 text-blue-800', processing: 'bg-orange-100 text-orange-800',
  ready: 'bg-teal-100 text-teal-800', in_transit: 'bg-indigo-100 text-indigo-800',
  delivered: 'bg-green-100 text-green-800', cancelled: 'bg-red-100 text-red-800',
};
const PAYMENT_COLORS: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-800', confirmed: 'bg-green-100 text-green-800', failed: 'bg-red-100 text-red-800',
};

function fmt(n: number) {
  return new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 }).format(n);
}

type AdminProps = { onLogout: () => void; onNotify?: () => void };

type PrepPrice = { name: string; price: string };
type LivestockForm = {
  name: string; type: string; description: string; price_per_kg: string;
  price_per_portion: string; price_full: string; price_half: string; price_quarter: string;
  available_kg: string; available_portions: string;
  unit_options: string[]; image_url: string; logo_url: string; prep: PrepPrice[];
};

const emptyLivestockForm: LivestockForm = {
  name: '', type: 'Cow', description: '', price_per_kg: '', price_per_portion: '',
  price_full: '', price_half: '', price_quarter: '',
  available_kg: '0', available_portions: '0', unit_options: ['kg', 'portion'], image_url: '', logo_url: '', prep: [],
};

const LIVESTOCK_TYPES = ['Cow', 'Ram', 'Goat', 'Chicken', 'Turkey', 'Pig', 'Other'];

type Tab = 'orders' | 'payments' | 'livestock' | 'customers' | 'logistics' | 'chat' | 'carts' | 'blast' | 'settings' | 'password';

export default function Admin({ onLogout, onNotify }: AdminProps) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [livestock, setLivestock] = useState<Livestock[]>([]);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [deliverySlots, setDeliverySlots] = useState<DeliverySlot[]>([]);
  const [deliveryLocations, setDeliveryLocations] = useState<DeliveryLocation[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [carts, setCarts] = useState<any[]>([]);
  const [blastLog, setBlastLog] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedOrder, setExpandedOrder] = useState<string | null>(null);
  const [updatingOrder, setUpdatingOrder] = useState<string | null>(null);
  const [updateMessage, setUpdateMessage] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [paymentFilter, setPaymentFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState<Tab>('orders');
  const [orderUpdates, setOrderUpdates] = useState<Record<string, OrderUpdate[]>>({});
  const [orderItems, setOrderItems] = useState<Record<string, OrderItem[]>>({});
  const [ordersView, setOrdersView] = useState<'cards' | 'table'>('cards');

  // Livestock form
  const [showLivestockForm, setShowLivestockForm] = useState(false);
  const [editingLivestock, setEditingLivestock] = useState<Livestock | null>(null);
  const [livestockForm, setLivestockForm] = useState<LivestockForm>(emptyLivestockForm);
  const [uploading, setUploading] = useState(false);
  const [savingLivestock, setSavingLivestock] = useState(false);
  const [deletingLivestock, setDeletingLivestock] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Bank / slot / location / customer forms
  const [showBankForm, setShowBankForm] = useState(false);
  const [bankForm, setBankForm] = useState({ bank_name: '', account_name: '', account_number: '', sort_code: '' });
  const [editingBank, setEditingBank] = useState<BankAccount | null>(null);
  const [showSlotForm, setShowSlotForm] = useState(false);
  const [slotForm, setSlotForm] = useState({ slot_date: '', slot_label: 'Morning (8am - 12pm)', max_orders: '10' });
  const [locForm, setLocForm] = useState({ name: '', fee: '' });
  const [editingLoc, setEditingLoc] = useState<DeliveryLocation | null>(null);
  const [showCustomerForm, setShowCustomerForm] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [customerForm, setCustomerForm] = useState({ name: '', phone: '', email: '', whatsapp: '', notes: '' });
  const [customerSearch, setCustomerSearch] = useState('');

  // Settings
  const [commentFieldEnabled, setCommentFieldEnabled] = useState(true);
  const [commentFieldLabel, setCommentFieldLabel] = useState('Additional Comments');
  const [customerCarePhone, setCustomerCarePhone] = useState('');
  const [customerCareEmail, setCustomerCareEmail] = useState('');
  const [pickupTimesText, setPickupTimesText] = useState('');
  const [lateDisclaimer, setLateDisclaimer] = useState('');
  const [pointsPer1000, setPointsPer1000] = useState('1');
  const [savingSettings, setSavingSettings] = useState(false);

  // Chat
  const [threads, setThreads] = useState<{ user_id: string; name: string; last: string; unread: number }[]>([]);
  const [activeThread, setActiveThread] = useState<string | null>(null);
  const [threadMessages, setThreadMessages] = useState<Message[]>([]);
  const [chatInput, setChatInput] = useState('');

  // Blast
  const [blastMessage, setBlastMessage] = useState('');
  const [blastAudience, setBlastAudience] = useState('all_active');
  const [blastEmail, setBlastEmail] = useState(false);
  const [blasting, setBlasting] = useState(false);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const [ordersRes, livestockRes, banksRes, slotsRes, customersRes, settingsRes, locsRes, cartsRes, blastRes] = await Promise.all([
      supabase.from('orders').select('*').order('created_at', { ascending: false }),
      supabase.from('livestock').select('*').order('created_at'),
      supabase.from('bank_accounts').select('*').order('created_at'),
      supabase.from('delivery_slots').select('*').order('slot_date'),
      supabase.from('customers').select('*').order('created_at', { ascending: false }),
      supabase.from('admin_settings').select('*'),
      supabase.from('delivery_locations').select('*').order('fee'),
      supabase.from('carts').select('*').order('updated_at', { ascending: false }),
      supabase.from('blast_log').select('*').order('created_at', { ascending: false }),
    ]);
    setOrders(ordersRes.data ?? []);
    setLivestock(livestockRes.data ?? []);
    setBankAccounts(banksRes.data ?? []);
    setDeliverySlots(slotsRes.data ?? []);
    setCustomers(customersRes.data ?? []);
    setDeliveryLocations(locsRes.data ?? []);
    setCarts(cartsRes.data ?? []);
    setBlastLog(blastRes.data ?? []);

    const s = settingsRes.data ?? [];
    const get = (k: string) => s.find((x: AdminSetting) => x.key === k);
    if (get('comment_field_enabled')) setCommentFieldEnabled(get('comment_field_enabled')!.value === 'true');
    if (get('comment_field_label')) setCommentFieldLabel(get('comment_field_label')!.value || 'Additional Comments');
    if (get('customer_care_phone')) setCustomerCarePhone(get('customer_care_phone')!.value);
    if (get('customer_care_email')) setCustomerCareEmail(get('customer_care_email')!.value);
    if (get('points_per_1000')) setPointsPer1000(get('points_per_1000')!.value || '1');
    if (get('late_pickup_disclaimer')) setLateDisclaimer(get('late_pickup_disclaimer')!.value);
    if (get('pickup_times')) { try { setPickupTimesText((JSON.parse(get('pickup_times')!.value) as string[]).join('\n')); } catch { /* */ } }

    setLoading(false);
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // ---- helpers -----------------------------------------------------------
  async function notifyUser(order: Order, title: string, body: string, type = 'order') {
    if (!order.user_id) return;
    await supabase.from('notifications').insert({ recipient_type: 'user', user_id: order.user_id, title, body, type, order_id: order.id });
  }

  async function awardPoints(order: Order) {
    if (!order.user_id || order.points_earned > 0) return;
    const rate = parseFloat(pointsPer1000) || 1;
    const pts = Math.floor((order.total_amount / 1000) * rate);
    if (pts <= 0) return;
    await supabase.from('orders').update({ points_earned: pts }).eq('id', order.id);
    const { data: prof } = await supabase.from('profiles').select('points').eq('id', order.user_id).maybeSingle();
    const current = prof?.points ?? 0;
    await supabase.from('profiles').update({ points: current + pts }).eq('id', order.user_id);
  }

  async function loadUpdates(orderId: string) {
    const { data } = await supabase.from('order_updates').select('*').eq('order_id', orderId).order('created_at', { ascending: false });
    setOrderUpdates((prev) => ({ ...prev, [orderId]: data ?? [] }));
    const { data: it } = await supabase.from('order_items').select('*').eq('order_id', orderId);
    setOrderItems((prev) => ({ ...prev, [orderId]: it ?? [] }));
  }

  async function updateOrderStatus(order: Order, newStatus: string) {
    setUpdatingOrder(order.id);
    await supabase.from('orders').update({ order_status: newStatus, updated_at: new Date().toISOString() }).eq('id', order.id);
    const msg = newStatus === 'in_transit'
      ? `Your order #${order.order_number} is now in transit to your address.`
      : `Your order #${order.order_number} status is now: ${STATUS_LABELS[newStatus]}.`;
    await supabase.from('order_updates').insert({ order_id: order.id, status: newStatus, message: msg, created_by: 'admin' });
    await notifyUser(order, 'Order update', msg);
    setUpdatingOrder(null);
    fetchAll();
  }

  // Confirm an order that was awaiting admin confirmation -> customer can pay.
  async function confirmOrder(order: Order) {
    setUpdatingOrder(order.id);
    await supabase.from('orders').update({ order_status: 'awaiting_payment', updated_at: new Date().toISOString() }).eq('id', order.id);
    const msg = `Your order #${order.order_number} has been confirmed. You can now proceed to payment.`;
    await supabase.from('order_updates').insert({ order_id: order.id, status: 'awaiting_payment', message: msg, created_by: 'admin' });
    await notifyUser(order, 'Order confirmed — pay now', msg, 'payment');
    setUpdatingOrder(null);
    fetchAll();
  }

  async function confirmPayment(order: Order, status: 'confirmed' | 'failed') {
    setUpdatingOrder(order.id);
    await supabase.from('orders').update({ payment_status: status, updated_at: new Date().toISOString() }).eq('id', order.id);
    const label = status === 'confirmed' ? 'confirmed' : 'declined';
    const msg = `Payment for order #${order.order_number} has been ${label}.`;
    await supabase.from('order_updates').insert({ order_id: order.id, status: order.order_status, message: msg, created_by: 'admin' });
    await notifyUser(order, 'Payment ' + label, msg, 'payment');
    if (status === 'confirmed') {
      await supabase.from('orders').update({ order_status: 'confirmed', updated_at: new Date().toISOString() }).eq('id', order.id);
      await awardPoints(order);
    }
    setUpdatingOrder(null);
    fetchAll();
  }

  // Reverse a confirmed payment back to pending.
  async function reversePayment(order: Order) {
    if (!confirm(`Reverse payment for #${order.order_number}?`)) return;
    setUpdatingOrder(order.id);
    await supabase.from('orders').update({ payment_status: 'pending', updated_at: new Date().toISOString() }).eq('id', order.id);
    const msg = `Payment for order #${order.order_number} has been reversed and is pending again.`;
    await supabase.from('order_updates').insert({ order_id: order.id, status: order.order_status, message: msg, created_by: 'admin' });
    await notifyUser(order, 'Payment reversed', msg, 'payment');
    setUpdatingOrder(null);
    fetchAll();
  }

  async function sendCustomMessage(order: Order) {
    if (!updateMessage.trim()) return;
    setUpdatingOrder(order.id);
    await supabase.from('order_updates').insert({ order_id: order.id, status: order.order_status, message: updateMessage.trim(), created_by: 'admin' });
    await notifyUser(order, 'Message about your order', updateMessage.trim(), 'message');
    setUpdateMessage('');
    setUpdatingOrder(null);
    loadUpdates(order.id);
  }

  // ---- CSV export --------------------------------------------------------
  function exportCSV() {
    const cols = ['Order', 'Date', 'Status', 'Payment', 'Customer', 'Phone', 'Email', 'Fulfillment', 'Location', 'Address', 'Pickup Time', 'Item', 'Preparation', 'Total'];
    const rows = filteredOrders.map((o) => [
      o.order_number, new Date(o.created_at).toLocaleString(), STATUS_LABELS[o.order_status] ?? o.order_status,
      PAYMENT_LABELS[o.payment_status] ?? o.payment_status, o.customer_name, o.customer_phone, o.customer_email,
      o.fulfillment_type, o.delivery_location_name, o.delivery_address, o.pickup_time, o.livestock_name,
      o.preparation_type, o.total_amount,
    ]);
    const esc = (v: any) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const csv = [cols.map(esc).join(','), ...rows.map((r) => r.map(esc).join(','))].join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    const a = document.createElement('a');
    a.href = url; a.download = `koyan-orders-${new Date().toISOString().slice(0, 10)}.csv`; a.click();
    URL.revokeObjectURL(url);
  }

  // ---- Livestock CRUD ----------------------------------------------------
  async function handleImageUpload(file: File) {
    setUploading(true);
    const ext = file.name.split('.').pop();
    const path = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const { error } = await supabase.storage.from('livestock-images').upload(path, file, { cacheControl: '3600', upsert: false });
    if (error) { alert('Upload failed: ' + error.message); setUploading(false); return; }
    const { data: urlData } = supabase.storage.from('livestock-images').getPublicUrl(path);
    setLivestockForm((f) => ({ ...f, image_url: urlData.publicUrl }));
    setUploading(false);
  }

  function openAddLivestock() {
    setEditingLivestock(null);
    setLivestockForm(emptyLivestockForm);
    setShowLivestockForm(true);
  }

  function openEditLivestock(l: Livestock) {
    setEditingLivestock(l);
    setLivestockForm({
      name: l.name, type: l.type, description: l.description,
      price_per_kg: String(l.price_per_kg), price_per_portion: l.price_per_portion ? String(l.price_per_portion) : '',
      price_full: l.price_full ? String(l.price_full) : '', price_half: l.price_half ? String(l.price_half) : '',
      price_quarter: l.price_quarter ? String(l.price_quarter) : '',
      available_kg: String(l.available_kg), available_portions: String(l.available_portions),
      unit_options: l.unit_options ?? ['kg', 'portion'], image_url: l.image_url, logo_url: l.logo_url ?? '',
      prep: Object.entries(l.preparation_prices ?? {}).map(([name, price]) => ({ name, price: String(price) })),
    });
    setShowLivestockForm(true);
  }

  async function saveLivestock() {
    setSavingLivestock(true);
    const prepObj: Record<string, number> = {};
    for (const p of livestockForm.prep) if (p.name.trim()) prepObj[p.name.trim()] = parseFloat(p.price) || 0;
    const payload = {
      name: livestockForm.name, type: livestockForm.type, description: livestockForm.description,
      price_per_kg: parseFloat(livestockForm.price_per_kg) || 0,
      price_per_portion: livestockForm.price_per_portion ? parseFloat(livestockForm.price_per_portion) : null,
      price_full: livestockForm.price_full ? parseFloat(livestockForm.price_full) : null,
      price_half: livestockForm.price_half ? parseFloat(livestockForm.price_half) : null,
      price_quarter: livestockForm.price_quarter ? parseFloat(livestockForm.price_quarter) : null,
      available_kg: parseFloat(livestockForm.available_kg) || 0,
      available_portions: parseInt(livestockForm.available_portions) || 0,
      unit_options: livestockForm.unit_options, image_url: livestockForm.image_url,
      logo_url: livestockForm.logo_url || null, preparation_prices: prepObj, is_available: true,
    };
    if (editingLivestock) await supabase.from('livestock').update(payload).eq('id', editingLivestock.id);
    else await supabase.from('livestock').insert(payload);
    setSavingLivestock(false);
    setShowLivestockForm(false);
    fetchAll();
  }

  async function deleteLivestock(id: string) {
    if (!confirm('Remove this livestock?')) return;
    setDeletingLivestock(id);
    await supabase.from('livestock').update({ is_available: false }).eq('id', id);
    setDeletingLivestock(null);
    fetchAll();
  }
  async function toggleLivestockAvailability(l: Livestock) {
    await supabase.from('livestock').update({ is_available: !l.is_available }).eq('id', l.id);
    fetchAll();
  }

  // ---- Bank / Slot / Location / Customer ---------------------------------
  async function saveBank() {
    const payload = { ...bankForm, is_active: true };
    if (editingBank) await supabase.from('bank_accounts').update(payload).eq('id', editingBank.id);
    else await supabase.from('bank_accounts').insert(payload);
    setShowBankForm(false); fetchAll();
  }
  async function deleteBank(id: string) { if (confirm('Remove account?')) { await supabase.from('bank_accounts').update({ is_active: false }).eq('id', id); fetchAll(); } }

  async function saveSlot() {
    await supabase.from('delivery_slots').insert({ slot_date: slotForm.slot_date, slot_label: slotForm.slot_label, max_orders: parseInt(slotForm.max_orders) || 10 });
    setShowSlotForm(false); fetchAll();
  }
  async function deleteSlot(id: string) { if (confirm('Remove slot?')) { await supabase.from('delivery_slots').delete().eq('id', id); fetchAll(); } }

  async function saveLocation() {
    if (!locForm.name.trim()) return;
    const payload = { name: locForm.name.trim(), fee: parseFloat(locForm.fee) || 0, is_active: true };
    if (editingLoc) await supabase.from('delivery_locations').update(payload).eq('id', editingLoc.id);
    else await supabase.from('delivery_locations').insert(payload);
    setLocForm({ name: '', fee: '' }); setEditingLoc(null); fetchAll();
  }
  async function deleteLocation(id: string) { if (confirm('Remove location?')) { await supabase.from('delivery_locations').delete().eq('id', id); fetchAll(); } }

  async function saveCustomer() {
    if (editingCustomer) await supabase.from('customers').update(customerForm).eq('id', editingCustomer.id);
    else await supabase.from('customers').insert(customerForm);
    setShowCustomerForm(false); fetchAll();
  }
  async function deleteCustomer(id: string) { if (confirm('Remove customer?')) { await supabase.from('customers').delete().eq('id', id); fetchAll(); } }

  async function saveSettings() {
    setSavingSettings(true);
    const pickupTimes = pickupTimesText.split('\n').map((t) => t.trim()).filter(Boolean);
    await supabase.from('admin_settings').upsert([
      { key: 'comment_field_enabled', value: String(commentFieldEnabled) },
      { key: 'comment_field_label', value: commentFieldLabel },
      { key: 'customer_care_phone', value: customerCarePhone },
      { key: 'customer_care_email', value: customerCareEmail },
      { key: 'points_per_1000', value: pointsPer1000 },
      { key: 'pickup_times', value: JSON.stringify(pickupTimes) },
      { key: 'late_pickup_disclaimer', value: lateDisclaimer },
    ], { onConflict: 'key' });
    setSavingSettings(false);
  }

  // ---- Cart reminders ----------------------------------------------------
  async function remindCart(cart: any) {
    if (!cart.user_id) return;
    await supabase.from('notifications').insert({
      recipient_type: 'user', user_id: cart.user_id, title: 'Items in your cart',
      body: `You still have ${(cart.items?.length ?? 0)} item(s) waiting in your cart (${fmt(cart.total || 0)}). Complete your order today!`, type: 'reminder',
    });
    alert('Reminder sent.');
  }

  // ---- Chat --------------------------------------------------------------
  const loadThreads = useCallback(async () => {
    const { data } = await supabase.from('messages').select('*').order('created_at', { ascending: false });
    const map = new Map<string, { user_id: string; name: string; last: string; unread: number }>();
    for (const m of (data ?? []) as Message[]) {
      if (!map.has(m.user_id)) map.set(m.user_id, { user_id: m.user_id, name: '', last: m.body, unread: 0 });
      if (m.sender === 'user' && !m.is_read) map.get(m.user_id)!.unread++;
    }
    const ids = [...map.keys()];
    if (ids.length) {
      const { data: profs } = await supabase.from('profiles').select('id, full_name, email').in('id', ids);
      for (const p of profs ?? []) { const t = map.get(p.id); if (t) t.name = p.full_name || p.email; }
    }
    setThreads([...map.values()]);
  }, []);

  useEffect(() => { if (tab === 'chat') loadThreads(); }, [tab, loadThreads]);

  async function openThread(userId: string) {
    setActiveThread(userId);
    const { data } = await supabase.from('messages').select('*').eq('user_id', userId).order('created_at');
    setThreadMessages(data ?? []);
    await supabase.from('messages').update({ is_read: true }).eq('user_id', userId).eq('sender', 'user');
    loadThreads();
  }

  async function sendAdminMessage() {
    if (!chatInput.trim() || !activeThread) return;
    const body = chatInput.trim();
    setChatInput('');
    await supabase.from('messages').insert({ user_id: activeThread, sender: 'admin', body });
    await supabase.from('notifications').insert({ recipient_type: 'user', user_id: activeThread, title: 'New message from Koyan', body, type: 'message' });
    openThread(activeThread);
  }

  // ---- Blast / batch -----------------------------------------------------
  function audienceUserIds(): string[] {
    let src = orders;
    if (blastAudience === 'all_active') src = orders.filter((o) => !['delivered', 'cancelled'].includes(o.order_status));
    else if (blastAudience !== 'all') src = orders.filter((o) => o.order_status === blastAudience);
    const ids = new Set<string>();
    for (const o of src) if (o.user_id) ids.add(o.user_id);
    return [...ids];
  }

  async function sendBlast() {
    if (!blastMessage.trim()) return;
    setBlasting(true);
    const ids = audienceUserIds();
    if (ids.length) {
      await supabase.from('notifications').insert(ids.map((uid) => ({
        recipient_type: 'user' as const, user_id: uid, title: 'Announcement', body: blastMessage.trim(), type: 'blast',
      })));
    }
    await supabase.from('blast_log').insert({ channel: blastEmail ? 'email' : 'in_app', audience: blastAudience, message: blastMessage.trim(), recipient_count: ids.length });
    if (blastEmail) {
      // Best-effort email blast via edge function per matching order email.
      const emails = [...new Set(orders.filter((o) => (blastAudience === 'all' ? true : blastAudience === 'all_active' ? !['delivered', 'cancelled'].includes(o.order_status) : o.order_status === blastAudience) && o.customer_email).map((o) => o.customer_email))];
      try { await supabase.functions.invoke('send-order-notification', { body: { blast: true, emails, message: blastMessage.trim() } }); } catch { /* */ }
    }
    setBlastMessage('');
    setBlasting(false);
    onNotify?.();
    fetchAll();
    alert(`Blast sent to ${ids.length} user(s).`);
  }

  // ---- derived -----------------------------------------------------------
  const filteredOrders = orders.filter((o) => {
    const matchStatus = statusFilter === 'all' || o.order_status === statusFilter;
    const matchPayment = paymentFilter === 'all' || o.payment_status === paymentFilter;
    const matchSearch = !search || o.order_number.includes(search.toUpperCase()) || o.customer_name.toLowerCase().includes(search.toLowerCase()) || o.customer_phone.includes(search);
    return matchStatus && matchPayment && matchSearch;
  });
  const filteredCustomers = customers.filter((c) => {
    if (!customerSearch) return true;
    const q = customerSearch.toLowerCase();
    return c.name.toLowerCase().includes(q) || c.phone.includes(q) || c.email.toLowerCase().includes(q);
  });
  const abandonedCarts = carts.filter((c) => (c.items?.length ?? 0) > 0 && c.status !== 'checked_out');
  const stats = {
    total: orders.length,
    pending: orders.filter((o) => ['pending', 'awaiting_confirmation', 'awaiting_payment'].includes(o.order_status)).length,
    active: orders.filter((o) => ['confirmed', 'processing', 'ready', 'in_transit'].includes(o.order_status)).length,
    delivered: orders.filter((o) => o.order_status === 'delivered').length,
    revenue: orders.filter((o) => o.payment_status === 'confirmed').reduce((s, o) => s + o.total_amount, 0),
    pendingPayments: orders.filter((o) => o.payment_status === 'pending').length,
  };

  const TABS: { key: Tab; label: string; icon: any }[] = [
    { key: 'orders', label: 'Orders', icon: Package },
    { key: 'payments', label: `Payments (${stats.pendingPayments})`, icon: CreditCard },
    { key: 'livestock', label: 'Livestock', icon: ImageIcon },
    { key: 'carts', label: `Carts (${abandonedCarts.length})`, icon: ShoppingCart },
    { key: 'customers', label: 'Customers', icon: Users },
    { key: 'chat', label: 'Chat', icon: MessageCircle },
    { key: 'logistics', label: 'Logistics', icon: Truck },
    { key: 'blast', label: 'Blast', icon: Bell },
    { key: 'settings', label: 'Settings', icon: Settings },
    { key: 'password', label: 'Password', icon: Lock },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-gray-900 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold">Admin Dashboard</h1>
            <p className="text-gray-400 text-sm">Koyan FreshLivestock — orders, logistics & customers</p>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={fetchAll} className="p-2 bg-white/10 hover:bg-white/20 rounded-lg transition-colors"><RefreshCw size={16} /></button>
            <button onClick={onLogout} className="flex items-center gap-1.5 px-3 py-2 bg-white/10 hover:bg-white/20 rounded-lg transition-colors text-sm"><LogOut size={14} />Logout</button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
          {[
            { label: 'Total Orders', value: stats.total, color: 'text-gray-900' },
            { label: 'Pending', value: stats.pending, color: 'text-amber-600' },
            { label: 'Active', value: stats.active, color: 'text-blue-600' },
            { label: 'Delivered', value: stats.delivered, color: 'text-green-600' },
            { label: 'Revenue', value: fmt(stats.revenue), color: 'text-green-700' },
            { label: 'Unconfirmed Pay', value: stats.pendingPayments, color: 'text-red-600' },
          ].map(({ label, value, color }) => (
            <div key={label} className="bg-white rounded-2xl border border-gray-100 p-4">
              <p className="text-xs text-gray-500">{label}</p>
              <p className={`text-lg font-bold mt-1 ${color}`}>{value}</p>
            </div>
          ))}
        </div>

        <div className="flex gap-2 mb-5 overflow-x-auto pb-1">
          {TABS.map(({ key, label, icon: Icon }) => (
            <button key={key} onClick={() => setTab(key)} className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-colors flex-shrink-0 ${tab === key ? 'bg-blue-700 text-white' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'}`}>
              <Icon size={14} />{label}
            </button>
          ))}
        </div>

        {/* ORDERS */}
        {tab === 'orders' && (
          <>
            <div className="bg-white rounded-2xl border border-gray-100 p-4 mb-4 flex flex-wrap items-center gap-3">
              <div className="relative flex-1 min-w-48">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input type="text" placeholder="Search order #, name, phone..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-full pl-8 pr-4 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-blue-400" />
              </div>
              <div className="flex items-center gap-2">
                <Filter size={14} className="text-gray-400" />
                <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="border border-gray-200 rounded-xl py-2 px-3 text-sm focus:outline-none focus:border-blue-400">
                  <option value="all">All Status</option>
                  {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              <button onClick={() => setOrdersView(ordersView === 'cards' ? 'table' : 'cards')} className="flex items-center gap-1.5 border border-gray-200 rounded-xl py-2 px-3 text-sm font-medium text-gray-600 hover:bg-gray-50">
                <BarChart3 size={14} />{ordersView === 'cards' ? 'Table view' : 'Card view'}
              </button>
              <button onClick={exportCSV} className="flex items-center gap-1.5 bg-blue-700 hover:bg-blue-800 text-white rounded-xl py-2 px-3 text-sm font-semibold"><Download size={14} />Export CSV</button>
            </div>

            {loading ? <div className="text-center py-10 text-gray-400">Loading...</div> : filteredOrders.length === 0 ? <div className="text-center py-10 text-gray-400">No orders found.</div> : ordersView === 'table' ? (
              <div className="bg-white rounded-2xl border border-gray-100 overflow-x-auto">
                <table className="w-full text-xs">
                  <thead className="bg-gray-50 text-gray-500">
                    <tr>{['Order', 'Customer', 'Phone', 'Email', 'Fulfillment', 'Location/Address', 'Prep', 'Status', 'Total'].map((h) => <th key={h} className="text-left px-3 py-2 font-semibold whitespace-nowrap">{h}</th>)}</tr>
                  </thead>
                  <tbody>
                    {filteredOrders.map((o) => (
                      <tr key={o.id} className="border-t border-gray-50">
                        <td className="px-3 py-2 font-semibold text-gray-900 whitespace-nowrap">{o.order_number}</td>
                        <td className="px-3 py-2 whitespace-nowrap">{o.customer_name}</td>
                        <td className="px-3 py-2 whitespace-nowrap">{o.customer_phone}</td>
                        <td className="px-3 py-2 whitespace-nowrap">{o.customer_email || '—'}</td>
                        <td className="px-3 py-2 capitalize">{o.fulfillment_type}</td>
                        <td className="px-3 py-2 max-w-[200px] truncate">{o.fulfillment_type === 'delivery' ? `${o.delivery_location_name} · ${o.delivery_address}` : o.pickup_time || '—'}</td>
                        <td className="px-3 py-2">{o.preparation_type || '—'}</td>
                        <td className="px-3 py-2"><span className={`px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[o.order_status]}`}>{STATUS_LABELS[o.order_status]}</span></td>
                        <td className="px-3 py-2 font-semibold whitespace-nowrap">{fmt(o.total_amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredOrders.map((order) => (
                  <div key={order.id} className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                    <div className="p-4 flex items-center justify-between cursor-pointer hover:bg-gray-50" onClick={() => { const open = expandedOrder === order.id; setExpandedOrder(open ? null : order.id); if (!open) loadUpdates(order.id); }}>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-gray-900 text-sm">{order.order_number}</span>
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[order.order_status]}`}>{STATUS_LABELS[order.order_status]}</span>
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${PAYMENT_COLORS[order.payment_status]}`}>Pay: {PAYMENT_LABELS[order.payment_status]}</span>
                          {order.customer_confirmed && <span className="text-xs px-2 py-0.5 rounded-full bg-green-50 text-green-700 font-medium">Confirmed by customer</span>}
                        </div>
                        <p className="text-xs text-gray-500 mt-0.5 truncate">{order.customer_name} · {order.livestock_name} · {fmt(order.total_amount)}</p>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                        <span className="text-xs text-gray-400 hidden sm:block">{new Date(order.created_at).toLocaleDateString()}</span>
                        {expandedOrder === order.id ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
                      </div>
                    </div>
                    {expandedOrder === order.id && (
                      <div className="border-t border-gray-100 p-4 space-y-4">
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                          {[
                            { label: 'Customer', value: order.customer_name },
                            { label: 'Email', value: order.customer_email || '—' },
                            { label: 'Phone', value: order.customer_phone },
                            { label: 'WhatsApp', value: order.customer_whatsapp },
                            { label: 'Fulfillment', value: order.fulfillment_type === 'delivery' ? `Delivery · ${order.delivery_location_name}` : `Pickup${order.pickup_time ? ' · ' + order.pickup_time : ''}` },
                            { label: 'Payment Ref', value: order.payment_reference || '—' },
                            { label: 'Total', value: fmt(order.total_amount) },
                          ].map(({ label, value }) => (
                            <div key={label}><p className="text-gray-400 mb-0.5">{label}</p><p className="font-semibold text-gray-800 break-words">{value}</p></div>
                          ))}
                          {order.fulfillment_type === 'delivery' && order.delivery_address && (
                            <div className="col-span-2 sm:col-span-3"><p className="text-gray-400 mb-0.5">Address</p><p className="font-semibold text-gray-800">{order.delivery_address}</p></div>
                          )}
                        </div>

                        {(orderItems[order.id] ?? []).length > 0 && (
                          <div className="pt-2 border-t border-gray-100">
                            <p className="text-xs font-semibold text-gray-500 mb-1">Items</p>
                            {(orderItems[order.id] ?? []).map((it) => (
                              <div key={it.id} className="flex justify-between text-xs text-gray-700"><span>{it.livestock_name} · {it.quantity} {it.unit}{it.preparation_types?.length ? ` · ${it.preparation_types.join(', ')}` : ''}</span><span>{fmt(it.subtotal)}</span></div>
                            ))}
                          </div>
                        )}

                        {order.payment_proof_url && (
                          <div className="pt-2 border-t border-gray-100">
                            <a href={order.payment_proof_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-xl px-3 py-2 text-xs font-medium text-blue-700 hover:bg-blue-100"><ExternalLink size={12} />View Payment Proof</a>
                          </div>
                        )}

                        <div className="flex flex-wrap gap-2 pt-2 border-t border-gray-100 items-center">
                          {order.order_status === 'awaiting_confirmation' && (
                            <button onClick={() => confirmOrder(order)} disabled={updatingOrder === order.id} className="flex items-center gap-1 bg-purple-600 hover:bg-purple-700 text-white px-3 py-1.5 rounded-lg text-xs font-semibold"><CheckCircle2 size={12} />Confirm Order</button>
                          )}
                          {order.order_status === 'ready' && (
                            <button onClick={() => updateOrderStatus(order, 'in_transit')} disabled={updatingOrder === order.id} className="flex items-center gap-1 bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded-lg text-xs font-semibold"><Truck size={12} />Mark In Transit</button>
                          )}
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold text-gray-500">Status:</span>
                            <select value={order.order_status} onChange={(e) => updateOrderStatus(order, e.target.value)} disabled={updatingOrder === order.id} className="text-xs border border-gray-200 rounded-lg py-1 px-2 focus:outline-none focus:border-blue-400">
                              {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                            </select>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold text-gray-500">Payment:</span>
                            <select value={order.payment_status} onChange={(e) => confirmPayment(order, e.target.value as 'confirmed' | 'failed')} disabled={updatingOrder === order.id} className="text-xs border border-gray-200 rounded-lg py-1 px-2 focus:outline-none focus:border-blue-400">
                              {Object.entries(PAYMENT_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                            </select>
                            {order.payment_status === 'confirmed' && (
                              <button onClick={() => reversePayment(order)} title="Reverse payment" className="flex items-center gap-1 text-xs text-red-600 hover:bg-red-50 border border-red-200 rounded-lg px-2 py-1"><RotateCcw size={11} />Reverse</button>
                            )}
                          </div>
                        </div>

                        <div className="flex gap-2 pt-2 border-t border-gray-100">
                          <input type="text" placeholder="Send a custom update message..." value={updateMessage} onChange={(e) => setUpdateMessage(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && sendCustomMessage(order)} className="flex-1 text-xs border border-gray-200 rounded-lg py-2 px-3 focus:outline-none focus:border-blue-400" />
                          <button onClick={() => sendCustomMessage(order)} disabled={updatingOrder === order.id || !updateMessage.trim()} className="flex items-center gap-1 bg-blue-700 hover:bg-blue-800 disabled:bg-gray-300 text-white px-3 py-2 rounded-lg text-xs font-semibold"><Send size={12} />Send</button>
                        </div>

                        {(orderUpdates[order.id] ?? []).length > 0 && (
                          <div className="pt-2 border-t border-gray-100">
                            <p className="text-xs font-semibold text-gray-500 mb-2">Recent Updates</p>
                            <div className="space-y-2 max-h-32 overflow-y-auto">
                              {(orderUpdates[order.id] ?? []).map((upd) => (
                                <div key={upd.id} className="flex gap-2">
                                  <div className={`w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0 ${upd.created_by === 'customer' ? 'bg-blue-400' : 'bg-green-400'}`} />
                                  <div><p className="text-xs text-gray-700">{upd.message}</p><p className="text-[10px] text-gray-400">{new Date(upd.created_at).toLocaleString()}</p></div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* PAYMENTS */}
        {tab === 'payments' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-900">Payment Confirmation</h2>
              <select value={paymentFilter} onChange={(e) => setPaymentFilter(e.target.value)} className="border border-gray-200 rounded-xl py-2 px-3 text-sm focus:outline-none focus:border-blue-400">
                <option value="all">All Payments</option>
                {Object.entries(PAYMENT_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            {orders.filter((o) => paymentFilter === 'all' || o.payment_status === paymentFilter).map((order) => (
              <div key={order.id} className={`bg-white rounded-2xl border p-4 ${order.payment_status === 'pending' ? 'border-amber-200' : order.payment_status === 'confirmed' ? 'border-green-200' : 'border-red-200'}`}>
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <span className="font-bold text-gray-900 text-sm">{order.order_number}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${PAYMENT_COLORS[order.payment_status]}`}>{PAYMENT_LABELS[order.payment_status]}</span>
                </div>
                <p className="text-xs text-gray-500">{order.customer_name} · {order.customer_phone} · {fmt(order.total_amount)} · Ref: {order.payment_reference || '—'}</p>
                {order.payment_proof_url && <a href={order.payment_proof_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 mt-2 bg-blue-50 border border-blue-200 rounded-xl px-3 py-1.5 text-xs font-medium text-blue-700"><ExternalLink size={12} />Proof</a>}
                <div className="mt-3 pt-3 border-t border-gray-100 flex items-center gap-3">
                  {order.payment_status !== 'confirmed' && <button onClick={() => confirmPayment(order, 'confirmed')} disabled={updatingOrder === order.id} className="flex items-center gap-2 bg-blue-700 hover:bg-blue-800 disabled:bg-gray-300 text-white px-4 py-2 rounded-xl text-sm font-semibold"><CheckCircle2 size={16} />Confirm</button>}
                  {order.payment_status === 'pending' && <button onClick={() => confirmPayment(order, 'failed')} disabled={updatingOrder === order.id} className="flex items-center gap-2 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 px-4 py-2 rounded-xl text-sm font-semibold"><X size={16} />Decline</button>}
                  {order.payment_status === 'confirmed' && <button onClick={() => reversePayment(order)} disabled={updatingOrder === order.id} className="flex items-center gap-2 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 px-4 py-2 rounded-xl text-sm font-semibold"><RotateCcw size={16} />Reverse Payment</button>}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* LIVESTOCK */}
        {tab === 'livestock' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-900">Manage Livestock</h2>
              <button onClick={openAddLivestock} className="flex items-center gap-2 bg-blue-700 hover:bg-blue-800 text-white px-4 py-2.5 rounded-xl text-sm font-semibold"><Plus size={16} />Add Livestock</button>
            </div>

            {showLivestockForm && (
              <div className="fixed inset-0 z-50 flex items-center justify-center">
                <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowLivestockForm(false)} />
                <div className="relative bg-white rounded-2xl shadow-2xl max-w-lg w-full mx-4 max-h-[90vh] overflow-y-auto">
                  <div className="sticky top-0 bg-white border-b border-gray-100 px-5 py-4 flex items-center justify-between z-10">
                    <h3 className="text-lg font-bold text-gray-900">{editingLivestock ? 'Edit Livestock' : 'Add New Livestock'}</h3>
                    <button onClick={() => setShowLivestockForm(false)} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"><X size={18} /></button>
                  </div>
                  <div className="p-5 space-y-4">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">Image</label>
                      {livestockForm.image_url ? (
                        <div className="relative rounded-xl overflow-hidden group">
                          <img src={livestockForm.image_url} alt="Preview" className="w-full h-48 object-cover" />
                          <button onClick={() => setLivestockForm((f) => ({ ...f, image_url: '' }))} className="absolute top-2 right-2 bg-white text-gray-900 px-3 py-1.5 rounded-lg text-sm font-medium flex items-center gap-1"><X size={14} />Remove</button>
                        </div>
                      ) : (
                        <div onClick={() => fileInputRef.current?.click()} className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50/50">
                          {uploading ? <div className="flex flex-col items-center gap-2"><div className="w-8 h-8 border-3 border-blue-400 border-t-transparent rounded-full animate-spin" /><p className="text-sm text-gray-500">Uploading...</p></div> : <><Upload size={32} className="mx-auto text-gray-300 mb-2" /><p className="text-sm font-medium text-gray-600">Click to upload image</p></>}
                        </div>
                      )}
                      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleImageUpload(f); }} />
                      <input type="text" placeholder="Or paste image URL" value={livestockForm.image_url} onChange={(e) => setLivestockForm((f) => ({ ...f, image_url: e.target.value }))} className="w-full mt-2 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-blue-400" />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div><label className="block text-sm font-semibold text-gray-700 mb-1">Name</label><input type="text" value={livestockForm.name} onChange={(e) => setLivestockForm((f) => ({ ...f, name: e.target.value }))} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-blue-400" /></div>
                      <div><label className="block text-sm font-semibold text-gray-700 mb-1">Type</label><select value={livestockForm.type} onChange={(e) => setLivestockForm((f) => ({ ...f, type: e.target.value }))} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-blue-400">{LIVESTOCK_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}</select></div>
                    </div>
                    <div><label className="block text-sm font-semibold text-gray-700 mb-1">Description</label><textarea value={livestockForm.description} onChange={(e) => setLivestockForm((f) => ({ ...f, description: e.target.value }))} rows={2} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-blue-400 resize-none" /></div>
                    <div>
                      <p className="text-sm font-semibold text-gray-700 mb-2">Unit Prices (leave blank to disable a unit)</p>
                      <div className="grid grid-cols-3 gap-3">
                        {[
                          { k: 'price_per_kg', label: 'Per KG' },
                          { k: 'price_per_portion', label: 'Per Portion' },
                          { k: 'price_full', label: 'Full' },
                          { k: 'price_half', label: 'Half' },
                          { k: 'price_quarter', label: 'Quarter' },
                        ].map(({ k, label }) => (
                          <div key={k}><label className="block text-xs font-semibold text-gray-600 mb-1">{label}</label><input type="number" value={(livestockForm as any)[k]} onChange={(e) => setLivestockForm((f) => ({ ...f, [k]: e.target.value }))} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-blue-400" /></div>
                        ))}
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div><label className="block text-sm font-semibold text-gray-700 mb-1">Available KG</label><input type="number" value={livestockForm.available_kg} onChange={(e) => setLivestockForm((f) => ({ ...f, available_kg: e.target.value }))} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-blue-400" /></div>
                      <div><label className="block text-sm font-semibold text-gray-700 mb-1">Available Portions</label><input type="number" value={livestockForm.available_portions} onChange={(e) => setLivestockForm((f) => ({ ...f, available_portions: e.target.value }))} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-blue-400" /></div>
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <label className="text-sm font-semibold text-gray-700">Preparation Types & Prices</label>
                        <button onClick={() => setLivestockForm((f) => ({ ...f, prep: [...f.prep, { name: '', price: '' }] }))} className="text-xs text-blue-600 font-semibold flex items-center gap-1"><Plus size={12} />Add</button>
                      </div>
                      <div className="space-y-2">
                        {livestockForm.prep.map((p, i) => (
                          <div key={i} className="flex gap-2">
                            <input type="text" placeholder="e.g. Roasted" value={p.name} onChange={(e) => setLivestockForm((f) => ({ ...f, prep: f.prep.map((x, j) => j === i ? { ...x, name: e.target.value } : x) }))} className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-blue-400" />
                            <input type="number" placeholder="Surcharge" value={p.price} onChange={(e) => setLivestockForm((f) => ({ ...f, prep: f.prep.map((x, j) => j === i ? { ...x, price: e.target.value } : x) }))} className="w-28 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-blue-400" />
                            <button onClick={() => setLivestockForm((f) => ({ ...f, prep: f.prep.filter((_, j) => j !== i) }))} className="p-2 text-gray-400 hover:text-red-600"><Trash2 size={14} /></button>
                          </div>
                        ))}
                        {livestockForm.prep.length === 0 && <p className="text-xs text-gray-400">No preparation options. Add e.g. Fresh (0), Roasted (5000).</p>}
                      </div>
                    </div>
                    <div className="flex gap-3 pt-2">
                      <button onClick={() => setShowLivestockForm(false)} className="flex-1 py-2.5 border-2 border-gray-200 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-50">Cancel</button>
                      <button onClick={saveLivestock} disabled={savingLivestock || !livestockForm.name || !livestockForm.price_per_kg} className="flex-1 flex items-center justify-center gap-2 bg-blue-700 hover:bg-blue-800 disabled:bg-gray-300 text-white py-2.5 rounded-xl text-sm font-semibold">
                        {savingLivestock ? <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> : <CheckCircle2 size={16} />}{editingLivestock ? 'Save Changes' : 'Add Livestock'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {livestock.map((l) => (
                <div key={l.id} className={`bg-white rounded-2xl border overflow-hidden ${l.is_available ? 'border-gray-100' : 'border-gray-200 opacity-60'}`}>
                  <div className="relative h-40 overflow-hidden">
                    <img src={l.image_url || 'https://images.pexels.com/photos/735968/pexels-photo-735968.jpeg'} alt={l.name} className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).src = 'https://images.pexels.com/photos/735968/pexels-photo-735968.jpeg'; }} />
                    <span className={`absolute top-2 right-2 text-xs px-2 py-1 rounded-full font-medium ${l.is_available ? 'bg-green-500 text-white' : 'bg-gray-500 text-white'}`}>{l.is_available ? 'Active' : 'Inactive'}</span>
                  </div>
                  <div className="p-4">
                    <div className="flex items-start justify-between">
                      <div><h3 className="font-bold text-gray-900">{l.name}</h3><p className="text-xs text-gray-500">{l.type}</p></div>
                      <div className="flex items-center gap-1">
                        <button onClick={() => openEditLivestock(l)} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg"><Pencil size={14} /></button>
                        <button onClick={() => toggleLivestockAvailability(l)} className="p-1.5 text-gray-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg"><RefreshCw size={14} /></button>
                        <button onClick={() => deleteLivestock(l.id)} disabled={deletingLivestock === l.id} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg"><Trash2 size={14} /></button>
                      </div>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1.5 text-[11px]">
                      {l.price_per_kg > 0 && <span className="bg-gray-100 rounded px-1.5 py-0.5">KG {fmt(l.price_per_kg)}</span>}
                      {l.price_per_portion ? <span className="bg-gray-100 rounded px-1.5 py-0.5">Portion {fmt(l.price_per_portion)}</span> : null}
                      {l.price_full ? <span className="bg-gray-100 rounded px-1.5 py-0.5">Full {fmt(l.price_full)}</span> : null}
                      {l.price_half ? <span className="bg-gray-100 rounded px-1.5 py-0.5">Half {fmt(l.price_half)}</span> : null}
                      {l.price_quarter ? <span className="bg-gray-100 rounded px-1.5 py-0.5">Qtr {fmt(l.price_quarter)}</span> : null}
                    </div>
                    {Object.keys(l.preparation_prices ?? {}).length > 0 && <p className="mt-2 text-[11px] text-gray-500">Prep: {Object.keys(l.preparation_prices).join(', ')}</p>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* CARTS (abandoned) */}
        {tab === 'carts' && (
          <div className="space-y-3">
            <h2 className="text-lg font-bold text-gray-900">Active / Abandoned Carts</h2>
            {abandonedCarts.length === 0 ? <p className="text-sm text-gray-400 text-center py-10">No active carts.</p> : abandonedCarts.map((c) => (
              <div key={c.id} className="bg-white rounded-2xl border border-gray-100 p-4 flex items-center justify-between">
                <div>
                  <p className="font-semibold text-gray-900 text-sm">{c.user_name || c.user_email || 'Customer'}</p>
                  <p className="text-xs text-gray-500">{(c.items?.length ?? 0)} item(s) · {fmt(c.total || 0)} · updated {new Date(c.updated_at).toLocaleString()}</p>
                </div>
                <button onClick={() => remindCart(c)} className="flex items-center gap-1.5 bg-blue-700 hover:bg-blue-800 text-white px-3 py-2 rounded-lg text-xs font-semibold"><Bell size={13} />Send Reminder</button>
              </div>
            ))}
          </div>
        )}

        {/* CUSTOMERS */}
        {tab === 'customers' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-900">Customer Directory</h2>
              <button onClick={() => { setEditingCustomer(null); setCustomerForm({ name: '', phone: '', email: '', whatsapp: '', notes: '' }); setShowCustomerForm(true); }} className="flex items-center gap-2 bg-blue-700 hover:bg-blue-800 text-white px-4 py-2.5 rounded-xl text-sm font-semibold"><Plus size={16} />Add Customer</button>
            </div>
            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input type="text" placeholder="Search customers..." value={customerSearch} onChange={(e) => setCustomerSearch(e.target.value)} className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-blue-400" />
            </div>
            {showCustomerForm && (
              <div className="bg-white rounded-2xl border border-gray-100 p-5">
                <div className="grid grid-cols-2 gap-3">
                  <input type="text" value={customerForm.name} onChange={(e) => setCustomerForm((f) => ({ ...f, name: e.target.value }))} placeholder="Name" className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-blue-400" />
                  <input type="tel" value={customerForm.phone} onChange={(e) => setCustomerForm((f) => ({ ...f, phone: e.target.value }))} placeholder="Phone" className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-blue-400" />
                  <input type="email" value={customerForm.email} onChange={(e) => setCustomerForm((f) => ({ ...f, email: e.target.value }))} placeholder="Email" className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-blue-400" />
                  <input type="tel" value={customerForm.whatsapp} onChange={(e) => setCustomerForm((f) => ({ ...f, whatsapp: e.target.value }))} placeholder="WhatsApp" className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-blue-400" />
                </div>
                <div className="flex gap-3 mt-3">
                  <button onClick={() => setShowCustomerForm(false)} className="flex-1 py-2 border-2 border-gray-200 rounded-xl text-sm font-semibold text-gray-600">Cancel</button>
                  <button onClick={saveCustomer} disabled={!customerForm.phone} className="flex-1 bg-blue-700 hover:bg-blue-800 disabled:bg-gray-300 text-white py-2 rounded-xl text-sm font-semibold">Save</button>
                </div>
              </div>
            )}
            <div className="space-y-2">
              {filteredCustomers.map((c) => (
                <div key={c.id} className="bg-white rounded-xl border border-gray-100 p-4 flex items-center justify-between">
                  <div>
                    <p className="font-bold text-gray-900 text-sm">{c.name || 'Unnamed'} <span className="text-xs text-gray-500 font-normal">{c.phone}</span></p>
                    <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">{c.email && <span className="flex items-center gap-1"><Mail size={10} />{c.email}</span>}{c.whatsapp && <span className="flex items-center gap-1"><MessageCircle size={10} />{c.whatsapp}</span>}</div>
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => { setEditingCustomer(c); setCustomerForm({ name: c.name, phone: c.phone, email: c.email, whatsapp: c.whatsapp ?? '', notes: c.notes ?? '' }); setShowCustomerForm(true); }} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg"><Pencil size={14} /></button>
                    <button onClick={() => deleteCustomer(c.id)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg"><Trash2 size={14} /></button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* CHAT */}
        {tab === 'chat' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 h-[600px]">
            <div className="bg-white rounded-2xl border border-gray-100 overflow-y-auto">
              <div className="px-4 py-3 border-b border-gray-100"><p className="text-sm font-bold text-gray-900">Conversations</p></div>
              {threads.length === 0 ? <p className="text-sm text-gray-400 text-center py-8">No conversations.</p> : threads.map((t) => (
                <button key={t.user_id} onClick={() => openThread(t.user_id)} className={`w-full text-left px-4 py-3 border-b border-gray-50 hover:bg-gray-50 ${activeThread === t.user_id ? 'bg-blue-50' : ''}`}>
                  <div className="flex items-center justify-between"><span className="text-sm font-semibold text-gray-900">{t.name || 'Customer'}</span>{t.unread > 0 && <span className="bg-red-500 text-white text-[10px] rounded-full px-1.5">{t.unread}</span>}</div>
                  <p className="text-xs text-gray-500 truncate mt-0.5">{t.last}</p>
                </button>
              ))}
            </div>
            <div className="md:col-span-2 bg-white rounded-2xl border border-gray-100 flex flex-col">
              {activeThread ? (
                <>
                  <div className="flex-1 overflow-y-auto p-4 space-y-3">
                    {threadMessages.map((m) => (
                      <div key={m.id} className={`flex ${m.sender === 'admin' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[75%] rounded-2xl px-4 py-2 text-sm ${m.sender === 'admin' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-800'}`}>{m.body}<div className={`text-[10px] mt-1 ${m.sender === 'admin' ? 'text-blue-100' : 'text-gray-400'}`}>{new Date(m.created_at).toLocaleString()}</div></div>
                      </div>
                    ))}
                  </div>
                  <div className="border-t border-gray-100 p-3 flex gap-2">
                    <input value={chatInput} onChange={(e) => setChatInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && sendAdminMessage()} placeholder="Reply..." className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400" />
                    <button onClick={sendAdminMessage} className="bg-blue-700 hover:bg-blue-800 text-white px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-1"><Send size={14} />Send</button>
                  </div>
                </>
              ) : <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">Select a conversation</div>}
            </div>
          </div>
        )}

        {/* LOGISTICS: delivery locations + slots */}
        {tab === 'logistics' && (
          <div className="space-y-8">
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2"><MapPin size={18} />Delivery Locations & Fees</h2>
              </div>
              <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-3">
                <div className="flex gap-2">
                  <input type="text" placeholder="Location name" value={locForm.name} onChange={(e) => setLocForm((f) => ({ ...f, name: e.target.value }))} className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-blue-400" />
                  <input type="number" placeholder="Fee" value={locForm.fee} onChange={(e) => setLocForm((f) => ({ ...f, fee: e.target.value }))} className="w-32 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-blue-400" />
                  <button onClick={saveLocation} className="bg-blue-700 hover:bg-blue-800 text-white px-4 py-2 rounded-lg text-sm font-semibold">{editingLoc ? 'Update' : 'Add'}</button>
                </div>
                {deliveryLocations.map((loc) => (
                  <div key={loc.id} className="flex items-center justify-between border border-gray-100 rounded-lg px-3 py-2">
                    <span className="text-sm text-gray-900">{loc.name} <span className="text-gray-500">· {fmt(loc.fee)}</span></span>
                    <div className="flex items-center gap-1">
                      <button onClick={() => { setEditingLoc(loc); setLocForm({ name: loc.name, fee: String(loc.fee) }); }} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg"><Pencil size={13} /></button>
                      <button onClick={() => deleteLocation(loc.id)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg"><Trash2 size={13} /></button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2"><Calendar size={18} />Delivery Slots</h2>
                <button onClick={() => { setSlotForm({ slot_date: '', slot_label: 'Morning (8am - 12pm)', max_orders: '10' }); setShowSlotForm(true); }} className="flex items-center gap-2 bg-blue-700 hover:bg-blue-800 text-white px-4 py-2 rounded-xl text-sm font-semibold"><Plus size={16} />Add Slot</button>
              </div>
              {showSlotForm && (
                <div className="bg-white rounded-2xl border border-gray-100 p-5 mb-4 grid grid-cols-3 gap-3">
                  <input type="date" value={slotForm.slot_date} onChange={(e) => setSlotForm((f) => ({ ...f, slot_date: e.target.value }))} min={new Date().toISOString().split('T')[0]} className="px-3 py-2 border border-gray-200 rounded-lg text-sm" />
                  <select value={slotForm.slot_label} onChange={(e) => setSlotForm((f) => ({ ...f, slot_label: e.target.value }))} className="px-3 py-2 border border-gray-200 rounded-lg text-sm"><option>Morning (8am - 12pm)</option><option>Afternoon (12pm - 5pm)</option><option>Evening (5pm - 9pm)</option></select>
                  <div className="flex gap-2"><input type="number" value={slotForm.max_orders} onChange={(e) => setSlotForm((f) => ({ ...f, max_orders: e.target.value }))} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" /><button onClick={saveSlot} disabled={!slotForm.slot_date} className="bg-blue-700 text-white px-3 rounded-lg text-sm font-semibold">Add</button></div>
                </div>
              )}
              <div className="space-y-2">
                {deliverySlots.map((s) => (
                  <div key={s.id} className="bg-white rounded-xl border border-gray-100 p-3 flex items-center justify-between">
                    <div><p className="text-sm font-semibold text-gray-900">{new Date(s.slot_date + 'T12:00:00').toLocaleDateString('en-NG', { weekday: 'short', month: 'short', day: 'numeric' })}</p><p className="text-xs text-gray-500">{s.slot_label}</p></div>
                    <div className="flex items-center gap-3"><span className="text-xs text-gray-500">{s.current_orders}/{s.max_orders}</span><button onClick={() => deleteSlot(s.id)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg"><Trash2 size={14} /></button></div>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2"><Building2 size={18} />Bank Accounts</h2>
                <button onClick={() => { setEditingBank(null); setBankForm({ bank_name: '', account_name: '', account_number: '', sort_code: '' }); setShowBankForm(true); }} className="flex items-center gap-2 bg-blue-700 hover:bg-blue-800 text-white px-4 py-2 rounded-xl text-sm font-semibold"><Plus size={16} />Add</button>
              </div>
              {showBankForm && (
                <div className="bg-white rounded-2xl border border-gray-100 p-5 mb-4 grid grid-cols-2 gap-3">
                  <input type="text" value={bankForm.bank_name} onChange={(e) => setBankForm((f) => ({ ...f, bank_name: e.target.value }))} placeholder="Bank Name" className="px-3 py-2 border border-gray-200 rounded-lg text-sm" />
                  <input type="text" value={bankForm.account_name} onChange={(e) => setBankForm((f) => ({ ...f, account_name: e.target.value }))} placeholder="Account Name" className="px-3 py-2 border border-gray-200 rounded-lg text-sm" />
                  <input type="text" value={bankForm.account_number} onChange={(e) => setBankForm((f) => ({ ...f, account_number: e.target.value }))} placeholder="Account Number" className="px-3 py-2 border border-gray-200 rounded-lg text-sm" />
                  <input type="text" value={bankForm.sort_code} onChange={(e) => setBankForm((f) => ({ ...f, sort_code: e.target.value }))} placeholder="Sort Code" className="px-3 py-2 border border-gray-200 rounded-lg text-sm" />
                  <div className="col-span-2 flex gap-3"><button onClick={() => setShowBankForm(false)} className="flex-1 py-2 border-2 border-gray-200 rounded-xl text-sm font-semibold text-gray-600">Cancel</button><button onClick={saveBank} disabled={!bankForm.bank_name || !bankForm.account_number} className="flex-1 bg-blue-700 hover:bg-blue-800 disabled:bg-gray-300 text-white py-2 rounded-xl text-sm font-semibold">Save</button></div>
                </div>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {bankAccounts.map((b) => (
                  <div key={b.id} className="bg-white rounded-2xl border border-gray-100 p-4 flex items-start justify-between">
                    <div><p className="text-xs font-bold text-gray-500 uppercase">{b.bank_name}</p><p className="font-semibold text-gray-900 mt-1">{b.account_name}</p><p className="text-lg font-bold text-gray-900 tracking-widest">{b.account_number}</p></div>
                    <button onClick={() => deleteBank(b.id)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg"><Trash2 size={14} /></button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* BLAST + REPORT */}
        {tab === 'blast' && (
          <div className="space-y-6 max-w-2xl">
            <div className="bg-white rounded-2xl border border-gray-100 p-6">
              <h3 className="font-bold text-gray-900 mb-1">Send Blast / Batch Message</h3>
              <p className="text-sm text-gray-500 mb-4">Sends an in-app notification (and optional email) to customers in the selected segment.</p>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Audience</label>
              <select value={blastAudience} onChange={(e) => setBlastAudience(e.target.value)} className="w-full mb-3 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-blue-400">
                <option value="all_active">All active orders</option>
                <option value="all">All customers with orders</option>
                {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>Status: {v}</option>)}
              </select>
              <textarea value={blastMessage} onChange={(e) => setBlastMessage(e.target.value)} rows={4} placeholder="Your announcement..." className="w-full border-2 border-gray-200 rounded-xl p-3 text-sm focus:outline-none focus:border-blue-400 resize-none" />
              <label className="flex items-center gap-2 mt-3 text-sm text-gray-600"><input type="checkbox" checked={blastEmail} onChange={(e) => setBlastEmail(e.target.checked)} className="accent-blue-700" />Also send email (requires RESEND_API_KEY)</label>
              <button onClick={sendBlast} disabled={blasting || !blastMessage.trim()} className="mt-3 flex items-center gap-2 bg-blue-700 hover:bg-blue-800 disabled:bg-gray-300 text-white px-5 py-2.5 rounded-xl text-sm font-semibold">
                {blasting ? <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> : <Bell size={15} />}Send Blast
              </button>
            </div>

            <div className="bg-white rounded-2xl border border-gray-100 p-6">
              <h3 className="font-bold text-gray-900 mb-3 flex items-center gap-2"><FileText size={16} />Blast Report</h3>
              {blastLog.length === 0 ? <p className="text-sm text-gray-400">No blasts sent yet.</p> : (
                <div className="space-y-2">
                  {blastLog.map((b) => (
                    <div key={b.id} className="border border-gray-100 rounded-lg p-3">
                      <div className="flex items-center justify-between"><span className="text-xs font-semibold text-gray-700">{b.channel} · {b.audience}</span><span className="text-xs text-gray-400">{new Date(b.created_at).toLocaleString()}</span></div>
                      <p className="text-sm text-gray-800 mt-1">{b.message}</p>
                      <p className="text-xs text-blue-600 mt-1">Sent to {b.recipient_count} recipient(s)</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* SETTINGS */}
        {tab === 'settings' && (
          <div className="space-y-6 max-w-2xl">
            <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-4">
              <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2"><Settings size={18} />Order Form</h2>
              <div className="flex items-center justify-between">
                <div><p className="text-sm font-semibold text-gray-900">Customer Comment Field</p><p className="text-xs text-gray-500">Show the optional comment field</p></div>
                <button onClick={() => setCommentFieldEnabled(!commentFieldEnabled)}>{commentFieldEnabled ? <ToggleRight size={32} className="text-green-600" /> : <ToggleLeft size={32} className="text-gray-300" />}</button>
              </div>
              {commentFieldEnabled && <input type="text" value={commentFieldLabel} onChange={(e) => setCommentFieldLabel(e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-blue-400" />}
            </div>

            <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-3">
              <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2"><Phone size={18} />Customer Care</h2>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-xs font-semibold text-gray-600 mb-1">Phone</label><input type="tel" value={customerCarePhone} onChange={(e) => setCustomerCarePhone(e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-blue-400" /></div>
                <div><label className="block text-xs font-semibold text-gray-600 mb-1">Email</label><input type="email" value={customerCareEmail} onChange={(e) => setCustomerCareEmail(e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-blue-400" /></div>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-3">
              <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2"><Award size={18} />Rewards & Pickup</h2>
              <div><label className="block text-xs font-semibold text-gray-600 mb-1">Points earned per ₦1,000 spent</label><input type="number" value={pointsPer1000} onChange={(e) => setPointsPer1000(e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-blue-400" /></div>
              <div><label className="block text-xs font-semibold text-gray-600 mb-1">Pickup times (one per line)</label><textarea value={pickupTimesText} onChange={(e) => setPickupTimesText(e.target.value)} rows={3} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-blue-400 resize-none" /></div>
              <div><label className="block text-xs font-semibold text-gray-600 mb-1">Late pickup disclaimer</label><textarea value={lateDisclaimer} onChange={(e) => setLateDisclaimer(e.target.value)} rows={2} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-blue-400 resize-none" /></div>
            </div>

            <button onClick={saveSettings} disabled={savingSettings} className="flex items-center gap-2 bg-blue-700 hover:bg-blue-800 disabled:bg-gray-300 text-white px-5 py-2.5 rounded-xl text-sm font-semibold">
              {savingSettings ? <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> : <CheckCircle2 size={16} />}Save All Settings
            </button>
          </div>
        )}

        {/* PASSWORD */}
        {tab === 'password' && <PasswordManager onPasswordChange={() => {}} />}
      </div>
    </div>
  );
}
