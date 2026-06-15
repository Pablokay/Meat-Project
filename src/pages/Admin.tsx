import { useState, useEffect, useRef } from 'react';
import { supabase, type Order, type OrderUpdate, type Livestock, type BankAccount, type DeliverySlot, type Customer, type AdminSetting } from '../lib/supabase';
import PasswordManager from '../components/PasswordManager';
import { Package, CircleCheck as CheckCircle2, RefreshCw, ChevronDown, ChevronUp, Send, Bell, Search, ListFilter as Filter, LogOut, Plus, Pencil, Trash2, Upload, X, Image as ImageIcon, CreditCard, Eye, CircleCheck as CheckCircle, Circle as XCircle, Building2, Calendar, ExternalLink, FileText, Users, Settings, ToggleLeft, ToggleRight, Phone, Mail, MessageCircle, Lock } from 'lucide-react';

const STATUS_LABELS: Record<string, string> = {
  pending: 'Pending', confirmed: 'Confirmed', processing: 'Processing',
  ready: 'Ready', delivered: 'Delivered', cancelled: 'Cancelled'
};
const PAYMENT_LABELS: Record<string, string> = { pending: 'Pending', confirmed: 'Confirmed', failed: 'Failed' };
const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-800', confirmed: 'bg-blue-100 text-blue-800',
  processing: 'bg-orange-100 text-orange-800', ready: 'bg-teal-100 text-teal-800',
  delivered: 'bg-green-100 text-green-800', cancelled: 'bg-red-100 text-red-800',
};
const PAYMENT_COLORS: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-800', confirmed: 'bg-green-100 text-green-800', failed: 'bg-red-100 text-red-800',
};

function fmt(n: number) {
  return new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 }).format(n);
}

type AdminProps = { onLogout: () => void };

type LivestockForm = {
  name: string; type: string; description: string; price_per_kg: string;
  price_per_portion: string; price_full: string; price_half: string; price_quarter: string;
  available_kg: string; available_portions: string;
  unit_options: string[]; image_url: string; logo_url: string;
};

const emptyLivestockForm: LivestockForm = {
  name: '', type: 'Cow', description: '', price_per_kg: '', price_per_portion: '',
  price_full: '', price_half: '', price_quarter: '',
  available_kg: '0', available_portions: '0', unit_options: ['kg', 'portion'], image_url: '', logo_url: '',
};

const LIVESTOCK_TYPES = ['Cow', 'Ram', 'Goat', 'Chicken', 'Turkey', 'Pig', 'Other'];

export default function Admin({ onLogout }: AdminProps) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [livestock, setLivestock] = useState<Livestock[]>([]);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [deliverySlots, setDeliverySlots] = useState<DeliverySlot[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedOrder, setExpandedOrder] = useState<string | null>(null);
  const [updatingOrder, setUpdatingOrder] = useState<string | null>(null);
  const [updateMessage, setUpdateMessage] = useState('');
  const [blastMessage, setBlastMessage] = useState('');
  const [blasting, setBlasting] = useState(false);
  const [statusFilter, setStatusFilter] = useState('all');
  const [paymentFilter, setPaymentFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState<'orders' | 'payments' | 'livestock' | 'customers' | 'settings' | 'blast' | 'password'>('orders');
  const [orderUpdates, setOrderUpdates] = useState<Record<string, OrderUpdate[]>>({});

  // Livestock form state
  const [showLivestockForm, setShowLivestockForm] = useState(false);
  const [editingLivestock, setEditingLivestock] = useState<Livestock | null>(null);
  const [livestockForm, setLivestockForm] = useState<LivestockForm>(emptyLivestockForm);
  const [uploading, setUploading] = useState(false);
  const [savingLivestock, setSavingLivestock] = useState(false);
  const [deletingLivestock, setDeletingLivestock] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Bank account form
  const [showBankForm, setShowBankForm] = useState(false);
  const [bankForm, setBankForm] = useState({ bank_name: '', account_name: '', account_number: '', sort_code: '' });
  const [editingBank, setEditingBank] = useState<BankAccount | null>(null);
  const [savingBank, setSavingBank] = useState(false);

  // Delivery slot form
  const [showSlotForm, setShowSlotForm] = useState(false);
  const [slotForm, setSlotForm] = useState({ slot_date: '', slot_label: 'Morning (8am - 12pm)', max_orders: '10' });
  const [savingSlot, setSavingSlot] = useState(false);

  // Customer form
  const [showCustomerForm, setShowCustomerForm] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [customerForm, setCustomerForm] = useState({ name: '', phone: '', email: '', whatsapp: '', notes: '' });
  const [savingCustomer, setSavingCustomer] = useState(false);
  const [customerSearch, setCustomerSearch] = useState('');

  // Admin settings
  const [commentFieldEnabled, setCommentFieldEnabled] = useState(true);
  const [commentFieldLabel, setCommentFieldLabel] = useState('Additional Comments');
  const [customerCarePhone, setCustomerCarePhone] = useState('');
  const [customerCareEmail, setCustomerCareEmail] = useState('');
  const [preparationTypes, setPreparationTypes] = useState<string[]>(['Fresh', 'Roasted']);
  const [newPreparationType, setNewPreparationType] = useState('');
  const [savingSettings, setSavingSettings] = useState(false);

  useEffect(() => { fetchAll(); }, []);

  async function fetchAll() {
    setLoading(true);
    const [ordersRes, livestockRes, banksRes, slotsRes, customersRes, settingsRes] = await Promise.all([
      supabase.from('orders').select('*').order('created_at', { ascending: false }),
      supabase.from('livestock').select('*').order('created_at'),
      supabase.from('bank_accounts').select('*').order('created_at'),
      supabase.from('delivery_slots').select('*').order('slot_date'),
      supabase.from('customers').select('*').order('created_at', { ascending: false }),
      supabase.from('admin_settings').select('*'),
    ]);
    setOrders(ordersRes.data ?? []);
    setLivestock(livestockRes.data ?? []);
    setBankAccounts(banksRes.data ?? []);
    setDeliverySlots(slotsRes.data ?? []);
    setCustomers(customersRes.data ?? []);

    const settings = settingsRes.data ?? [];
    const commentSetting = settings.find((s: AdminSetting) => s.key === 'comment_field_enabled');
    const labelSetting = settings.find((s: AdminSetting) => s.key === 'comment_field_label');
    const phoneSetting = settings.find((s: AdminSetting) => s.key === 'customer_care_phone');
    const emailSetting = settings.find((s: AdminSetting) => s.key === 'customer_care_email');
    const prepSetting = settings.find((s: AdminSetting) => s.key === 'preparation_types');
    if (commentSetting) setCommentFieldEnabled(commentSetting.value === 'true');
    if (labelSetting) setCommentFieldLabel(labelSetting.value || 'Additional Comments');
    if (phoneSetting) setCustomerCarePhone(phoneSetting.value);
    if (emailSetting) setCustomerCareEmail(emailSetting.value);
    if (prepSetting) {
      try {
        setPreparationTypes(JSON.parse(prepSetting.value));
      } catch {
        setPreparationTypes(['Fresh', 'Roasted']);
      }
    }

    setLoading(false);
  }

  async function loadUpdates(orderId: string) {
    if (orderUpdates[orderId]) return;
    const { data } = await supabase.from('order_updates').select('*').eq('order_id', orderId).order('created_at', { ascending: false });
    setOrderUpdates(prev => ({ ...prev, [orderId]: data ?? [] }));
  }

  async function updateOrderStatus(order: Order, newStatus: string) {
    setUpdatingOrder(order.id);
    await supabase.from('orders').update({ order_status: newStatus, updated_at: new Date().toISOString() }).eq('id', order.id);
    const msg = `Your order #${order.order_number} status has been updated to: ${STATUS_LABELS[newStatus]}.`;
    await supabase.from('order_updates').insert({ order_id: order.id, status: newStatus, message: msg, created_by: 'admin' });
    setUpdatingOrder(null);
    fetchAll();
  }

  async function confirmPayment(order: Order, status: 'confirmed' | 'failed') {
    setUpdatingOrder(order.id);
    await supabase.from('orders').update({ payment_status: status, updated_at: new Date().toISOString() }).eq('id', order.id);
    const label = status === 'confirmed' ? 'confirmed' : 'declined';
    const msg = `Payment for order #${order.order_number} has been ${label}. ${status === 'confirmed' ? 'Your order will be processed shortly.' : 'Please check your payment and try again or contact us.'}`;
    await supabase.from('order_updates').insert({ order_id: order.id, status: order.order_status, message: msg, created_by: 'admin' });
    if (status === 'confirmed') {
      await supabase.from('orders').update({ order_status: 'confirmed', updated_at: new Date().toISOString() }).eq('id', order.id);
    }
    setUpdatingOrder(null);
    fetchAll();
  }

  async function sendCustomMessage(order: Order) {
    if (!updateMessage.trim()) return;
    setUpdatingOrder(order.id);
    await supabase.from('order_updates').insert({ order_id: order.id, status: order.order_status, message: updateMessage.trim(), created_by: 'admin' });
    setUpdateMessage('');
    setUpdatingOrder(null);
    setOrderUpdates(prev => ({ ...prev, [order.id]: [] }));
    loadUpdates(order.id);
  }

  async function sendBlastNotification() {
    if (!blastMessage.trim()) return;
    setBlasting(true);
    const targetOrders = orders.filter(o => o.order_status !== 'cancelled' && o.order_status !== 'delivered');
    for (const order of targetOrders) {
      await supabase.from('order_updates').insert({ order_id: order.id, status: order.order_status, message: blastMessage.trim(), created_by: 'admin' });
    }
    setBlastMessage('');
    setBlasting(false);
    alert(`Blast sent to ${targetOrders.length} active orders!`);
  }

  // Image upload
  async function handleImageUpload(file: File) {
    setUploading(true);
    const ext = file.name.split('.').pop();
    const path = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const { error } = await supabase.storage.from('livestock-images').upload(path, file, { cacheControl: '3600', upsert: false });
    if (error) { alert('Upload failed: ' + error.message); setUploading(false); return; }
    const { data: urlData } = supabase.storage.from('livestock-images').getPublicUrl(path);
    setLivestockForm(f => ({ ...f, image_url: urlData.publicUrl }));
    setUploading(false);
  }

  // Livestock CRUD
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
      price_full: l.price_full ? String(l.price_full) : '',
      price_half: l.price_half ? String(l.price_half) : '',
      price_quarter: l.price_quarter ? String(l.price_quarter) : '',
      available_kg: String(l.available_kg), available_portions: String(l.available_portions),
      unit_options: l.unit_options ?? ['kg', 'portion'], image_url: l.image_url, logo_url: l.logo_url ?? '',
    });
    setShowLivestockForm(true);
  }

  async function saveLivestock() {
    setSavingLivestock(true);
    const payload = {
      name: livestockForm.name, type: livestockForm.type, description: livestockForm.description,
      price_per_kg: parseFloat(livestockForm.price_per_kg) || 0,
      price_per_portion: livestockForm.price_per_portion ? parseFloat(livestockForm.price_per_portion) : null,
      price_full: livestockForm.price_full ? parseFloat(livestockForm.price_full) : null,
      price_half: livestockForm.price_half ? parseFloat(livestockForm.price_half) : null,
      price_quarter: livestockForm.price_quarter ? parseFloat(livestockForm.price_quarter) : null,
      available_kg: parseFloat(livestockForm.available_kg) || 0,
      available_portions: parseInt(livestockForm.available_portions) || 0,
      unit_options: livestockForm.unit_options,
      image_url: livestockForm.image_url,
      logo_url: livestockForm.logo_url || null,
      is_available: true,
    };
    if (editingLivestock) {
      await supabase.from('livestock').update(payload).eq('id', editingLivestock.id);
    } else {
      await supabase.from('livestock').insert(payload);
    }
    setSavingLivestock(false);
    setShowLivestockForm(false);
    fetchAll();
  }

  async function deleteLivestock(id: string) {
    if (!confirm('Are you sure you want to remove this livestock?')) return;
    setDeletingLivestock(id);
    await supabase.from('livestock').update({ is_available: false }).eq('id', id);
    setDeletingLivestock(null);
    fetchAll();
  }

  async function toggleLivestockAvailability(l: Livestock) {
    await supabase.from('livestock').update({ is_available: !l.is_available }).eq('id', l.id);
    fetchAll();
  }

  // Bank Account CRUD
  function openAddBank() {
    setEditingBank(null);
    setBankForm({ bank_name: '', account_name: '', account_number: '', sort_code: '' });
    setShowBankForm(true);
  }

  function openEditBank(b: BankAccount) {
    setEditingBank(b);
    setBankForm({ bank_name: b.bank_name, account_name: b.account_name, account_number: b.account_number, sort_code: b.sort_code });
    setShowBankForm(true);
  }

  async function saveBank() {
    setSavingBank(true);
    const payload = { bank_name: bankForm.bank_name, account_name: bankForm.account_name, account_number: bankForm.account_number, sort_code: bankForm.sort_code, is_active: true };
    if (editingBank) {
      await supabase.from('bank_accounts').update(payload).eq('id', editingBank.id);
    } else {
      await supabase.from('bank_accounts').insert(payload);
    }
    setSavingBank(false);
    setShowBankForm(false);
    fetchAll();
  }

  async function deleteBank(id: string) {
    if (!confirm('Remove this bank account?')) return;
    await supabase.from('bank_accounts').update({ is_active: false }).eq('id', id);
    fetchAll();
  }

  // Delivery Slot CRUD
  async function saveSlot() {
    setSavingSlot(true);
    await supabase.from('delivery_slots').insert({
      slot_date: slotForm.slot_date,
      slot_label: slotForm.slot_label,
      max_orders: parseInt(slotForm.max_orders) || 10,
    });
    setSavingSlot(false);
    setShowSlotForm(false);
    fetchAll();
  }

  async function deleteSlot(id: string) {
    if (!confirm('Remove this delivery slot?')) return;
    await supabase.from('delivery_slots').delete().eq('id', id);
    fetchAll();
  }

  // Customer CRUD
  function openAddCustomer() {
    setEditingCustomer(null);
    setCustomerForm({ name: '', phone: '', email: '', whatsapp: '', notes: '' });
    setShowCustomerForm(true);
  }

  function openEditCustomer(c: Customer) {
    setEditingCustomer(c);
    setCustomerForm({ name: c.name, phone: c.phone, email: c.email, whatsapp: c.whatsapp ?? '', notes: c.notes ?? '' });
    setShowCustomerForm(true);
  }

  async function saveCustomer() {
    setSavingCustomer(true);
    const payload = { name: customerForm.name, phone: customerForm.phone, email: customerForm.email, whatsapp: customerForm.whatsapp, notes: customerForm.notes };
    if (editingCustomer) {
      await supabase.from('customers').update(payload).eq('id', editingCustomer.id);
    } else {
      await supabase.from('customers').insert(payload);
    }
    setSavingCustomer(false);
    setShowCustomerForm(false);
    fetchAll();
  }

  async function deleteCustomer(id: string) {
    if (!confirm('Remove this customer?')) return;
    await supabase.from('customers').delete().eq('id', id);
    fetchAll();
  }

  // Admin settings
  async function saveSettings() {
    setSavingSettings(true);
    await supabase.from('admin_settings').upsert([
      { key: 'comment_field_enabled', value: String(commentFieldEnabled) },
      { key: 'comment_field_label', value: commentFieldLabel },
      { key: 'customer_care_phone', value: customerCarePhone },
      { key: 'customer_care_email', value: customerCareEmail },
      { key: 'preparation_types', value: JSON.stringify(preparationTypes) },
    ], { onConflict: 'key' });
    setSavingSettings(false);
  }

  const filteredOrders = orders.filter(o => {
    const matchStatus = statusFilter === 'all' || o.order_status === statusFilter;
    const matchPayment = paymentFilter === 'all' || o.payment_status === paymentFilter;
    const matchSearch = !search || o.order_number.includes(search.toUpperCase()) || o.customer_name.toLowerCase().includes(search.toLowerCase()) || o.customer_phone.includes(search);
    return matchStatus && matchPayment && matchSearch;
  });

  const filteredCustomers = customers.filter(c => {
    if (!customerSearch) return true;
    const q = customerSearch.toLowerCase();
    return c.name.toLowerCase().includes(q) || c.phone.includes(q) || c.email.toLowerCase().includes(q);
  });

  const pendingPayments = orders.filter(o => o.payment_status === 'pending');
  const stats = {
    total: orders.length,
    pending: orders.filter(o => o.order_status === 'pending').length,
    active: orders.filter(o => ['confirmed', 'processing', 'ready'].includes(o.order_status)).length,
    delivered: orders.filter(o => o.order_status === 'delivered').length,
    revenue: orders.filter(o => o.payment_status === 'confirmed').reduce((s, o) => s + o.total_amount, 0),
    pendingPayments: pendingPayments.length,
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Top bar */}
      <div className="bg-gray-900 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold">Admin Dashboard</h1>
            <p className="text-gray-400 text-sm">Koyan FreshLivestock - Manage orders, payments & livestock</p>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={fetchAll} className="p-2 bg-white/10 hover:bg-white/20 rounded-lg transition-colors"><RefreshCw size={16} /></button>
            <button onClick={onLogout} className="flex items-center gap-1.5 px-3 py-2 bg-white/10 hover:bg-white/20 rounded-lg transition-colors text-sm"><LogOut size={14} />Logout</button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Stats */}
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

        {/* Tabs */}
        <div className="flex gap-2 mb-5 overflow-x-auto pb-1">
          {([
            { key: 'orders' as const, label: 'Orders', icon: Package },
            { key: 'payments' as const, label: `Payments (${stats.pendingPayments})`, icon: CreditCard },
            { key: 'livestock' as const, label: 'Livestock', icon: ImageIcon },
            { key: 'customers' as const, label: 'Customers', icon: Users },
            { key: 'settings' as const, label: 'Settings', icon: Settings },
            { key: 'password' as const, label: 'Password', icon: Lock },
            { key: 'blast' as const, label: 'Blast', icon: Bell },
          ]).map(({ key, label, icon: Icon }) => (
            <button key={key} onClick={() => setTab(key)} className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-colors flex-shrink-0 ${tab === key ? 'bg-blue-700 text-white' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'}`}>
              <Icon size={14} />{label}
            </button>
          ))}
        </div>

        {/* ===== ORDERS TAB ===== */}
        {tab === 'orders' && (
          <>
            <div className="bg-white rounded-2xl border border-gray-100 p-4 mb-4 flex flex-wrap items-center gap-3">
              <div className="relative flex-1 min-w-48">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input type="text" placeholder="Search by order #, name, phone..." value={search} onChange={e => setSearch(e.target.value)} className="w-full pl-8 pr-4 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-blue-400" />
              </div>
              <div className="flex items-center gap-2">
                <Filter size={14} className="text-gray-400" />
                <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="border border-gray-200 rounded-xl py-2 px-3 text-sm focus:outline-none focus:border-blue-400">
                  <option value="all">All Status</option>
                  {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
            </div>

            {loading ? <div className="text-center py-10 text-gray-400">Loading...</div> : filteredOrders.length === 0 ? <div className="text-center py-10 text-gray-400">No orders found.</div> : (
              <div className="space-y-3">
                {filteredOrders.map(order => (
                  <div key={order.id} className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                    <div className="p-4 flex items-center justify-between cursor-pointer hover:bg-gray-50 transition-colors" onClick={() => { setExpandedOrder(expandedOrder === order.id ? null : order.id); loadUpdates(order.id); }}>
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
                            { label: 'Email', value: order.customer_email },
                            { label: 'Phone', value: order.customer_phone },
                            { label: 'WhatsApp', value: order.customer_whatsapp },
                            { label: 'Item', value: `${order.livestock_name} x ${order.quantity} ${order.unit}` },
                            { label: 'Preparation', value: order.preparation_type === 'roasted' ? 'Roasted' : 'Fresh' },
                            { label: 'Portion', value: order.portion_size.charAt(0).toUpperCase() + order.portion_size.slice(1) },
                            { label: 'Fulfillment', value: order.fulfillment_type === 'delivery' ? 'Delivery' : 'Pickup' },
                            { label: 'Slot', value: order.delivery_date ? `${order.delivery_date} ${order.delivery_slot_label}` : 'Not set' },
                            { label: 'Payment Ref', value: order.payment_reference || '—' },
                            { label: 'Total', value: fmt(order.total_amount) },
                            ...(order.customer_comment ? [{ label: 'Comment', value: order.customer_comment }] : []),
                          ].map(({ label, value }) => (
                            <div key={label}><p className="text-gray-400 mb-0.5">{label}</p><p className="font-semibold text-gray-800">{value}</p></div>
                          ))}
                          {order.fulfillment_type === 'delivery' && order.delivery_address && (
                            <div className="col-span-2"><p className="text-gray-400 mb-0.5">Address</p><p className="font-semibold text-gray-800">{order.delivery_address}</p></div>
                          )}
                          {order.customer_confirmed && (
                            <div className="col-span-2"><p className="text-gray-400 mb-0.5">Customer Confirmed</p><p className="font-semibold text-green-700">Yes — {order.customer_confirmed_at ? new Date(order.customer_confirmed_at).toLocaleString() : ''}</p></div>
                          )}
                        </div>

                        {/* Payment Proof */}
                        {order.payment_proof_url && (
                          <div className="pt-2 border-t border-gray-100">
                            <p className="text-xs font-semibold text-gray-500 mb-2 flex items-center gap-1"><FileText size={12} />Payment Proof</p>
                            <a href={order.payment_proof_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-xl px-3 py-2 text-xs font-medium text-blue-700 hover:bg-blue-100 transition-colors">
                              <ExternalLink size={12} />View Payment Proof
                            </a>
                          </div>
                        )}

                        <div className="flex flex-wrap gap-2 pt-2 border-t border-gray-100">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold text-gray-500">Order:</span>
                            <select value={order.order_status} onChange={e => updateOrderStatus(order, e.target.value)} disabled={updatingOrder === order.id} className="text-xs border border-gray-200 rounded-lg py-1 px-2 focus:outline-none focus:border-blue-400">
                              {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                            </select>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold text-gray-500">Payment:</span>
                            <select value={order.payment_status} onChange={e => confirmPayment(order, e.target.value as 'confirmed' | 'failed')} disabled={updatingOrder === order.id} className="text-xs border border-gray-200 rounded-lg py-1 px-2 focus:outline-none focus:border-blue-400">
                              {Object.entries(PAYMENT_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                            </select>
                          </div>
                        </div>
                        <div className="flex gap-2 pt-2 border-t border-gray-100">
                          <input type="text" placeholder="Send a custom update message..." value={updateMessage} onChange={e => setUpdateMessage(e.target.value)} onKeyDown={e => e.key === 'Enter' && sendCustomMessage(order)} className="flex-1 text-xs border border-gray-200 rounded-lg py-2 px-3 focus:outline-none focus:border-blue-400" />
                          <button onClick={() => sendCustomMessage(order)} disabled={updatingOrder === order.id || !updateMessage.trim()} className="flex items-center gap-1 bg-blue-700 hover:bg-blue-800 disabled:bg-gray-300 text-white px-3 py-2 rounded-lg text-xs font-semibold transition-colors"><Send size={12} />Send</button>
                        </div>
                        {(orderUpdates[order.id] ?? []).length > 0 && (
                          <div className="pt-2 border-t border-gray-100">
                            <p className="text-xs font-semibold text-gray-500 mb-2">Recent Updates</p>
                            <div className="space-y-2 max-h-32 overflow-y-auto">
                              {(orderUpdates[order.id] ?? []).map(upd => (
                                <div key={upd.id} className="flex gap-2">
                                  <div className={`w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0 ${upd.created_by === 'customer' ? 'bg-blue-400' : 'bg-green-400'}`} />
                                  <div>
                                    <p className="text-xs text-gray-700">{upd.message}</p>
                                    <p className="text-[10px] text-gray-400">{new Date(upd.created_at).toLocaleString()} {upd.created_by === 'customer' && <span className="text-blue-500">(customer)</span>}</p>
                                  </div>
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

        {/* ===== PAYMENTS TAB ===== */}
        {tab === 'payments' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-900">Payment Confirmation</h2>
              <select value={paymentFilter} onChange={e => setPaymentFilter(e.target.value)} className="border border-gray-200 rounded-xl py-2 px-3 text-sm focus:outline-none focus:border-blue-400">
                <option value="all">All Payments</option>
                {Object.entries(PAYMENT_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>

            {orders.filter(o => paymentFilter === 'all' || o.payment_status === paymentFilter).length === 0 ? (
              <div className="text-center py-10 text-gray-400">No payments to display.</div>
            ) : (
              <div className="space-y-3">
                {orders.filter(o => paymentFilter === 'all' || o.payment_status === paymentFilter).map(order => (
                  <div key={order.id} className={`bg-white rounded-2xl border overflow-hidden ${order.payment_status === 'pending' ? 'border-amber-200' : order.payment_status === 'confirmed' ? 'border-green-200' : 'border-red-200'}`}>
                    <div className="p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <span className="font-bold text-gray-900 text-sm">{order.order_number}</span>
                            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${PAYMENT_COLORS[order.payment_status]}`}>
                              {PAYMENT_LABELS[order.payment_status]}
                            </span>
                            {order.payment_status === 'pending' && (
                              <span className="text-xs px-2 py-0.5 rounded-full bg-amber-50 text-amber-600 font-medium animate-pulse">Needs Review</span>
                            )}
                          </div>
                          <p className="text-xs text-gray-500">{order.customer_name} · {order.customer_phone}</p>
                          <p className="text-xs text-gray-500 mt-0.5">{order.livestock_name} x {order.quantity} {order.unit}</p>
                          <div className="mt-2 grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                            <div><p className="text-gray-400">Amount</p><p className="font-bold text-gray-900">{fmt(order.total_amount)}</p></div>
                            <div><p className="text-gray-400">Method</p><p className="font-semibold text-gray-800">{order.payment_method === 'bank_transfer' ? 'Bank Transfer' : 'Virtual'}</p></div>
                            <div><p className="text-gray-400">Reference</p><p className="font-semibold text-gray-800">{order.payment_reference || '—'}</p></div>
                            <div><p className="text-gray-400">Date</p><p className="font-semibold text-gray-800">{new Date(order.created_at).toLocaleDateString()}</p></div>
                          </div>

                          {order.payment_proof_url && (
                            <div className="mt-3">
                              <a href={order.payment_proof_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-xl px-3 py-2 text-xs font-medium text-blue-700 hover:bg-blue-100 transition-colors">
                                <ExternalLink size={12} />View Payment Proof
                              </a>
                            </div>
                          )}
                        </div>
                      </div>

                      {order.payment_status === 'pending' && (
                        <div className="mt-4 pt-3 border-t border-gray-100 flex items-center gap-3">
                          <button onClick={() => confirmPayment(order, 'confirmed')} disabled={updatingOrder === order.id} className="flex items-center gap-2 bg-blue-700 hover:bg-blue-800 disabled:bg-gray-300 text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors">
                            <CheckCircle size={16} />Confirm Payment
                          </button>
                          <button onClick={() => confirmPayment(order, 'failed')} disabled={updatingOrder === order.id} className="flex items-center gap-2 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors">
                            <XCircle size={16} />Decline
                          </button>
                          {updatingOrder === order.id && <div className="w-4 h-4 border-2 border-green-400 border-t-transparent rounded-full animate-spin" />}
                        </div>
                      )}

                      {order.payment_status === 'confirmed' && (
                        <div className="mt-3 pt-3 border-t border-gray-100 flex items-center gap-2 text-green-600 text-xs font-medium">
                          <CheckCircle size={14} />Payment confirmed — order is being processed
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ===== LIVESTOCK TAB ===== */}
        {tab === 'livestock' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-900">Manage Livestock</h2>
              <button onClick={openAddLivestock} className="flex items-center gap-2 bg-blue-700 hover:bg-blue-800 text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors">
                <Plus size={16} /> Add Livestock
              </button>
            </div>

            {/* Livestock Form Modal */}
            {showLivestockForm && (
              <div className="fixed inset-0 z-50 flex items-center justify-center">
                <div className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-fade-in" onClick={() => setShowLivestockForm(false)} />
                <div className="relative bg-white rounded-2xl shadow-2xl max-w-lg w-full mx-4 max-h-[90vh] overflow-y-auto animate-scale-in">
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
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                            <button onClick={() => setLivestockForm(f => ({ ...f, image_url: '' }))} className="bg-white text-gray-900 px-3 py-1.5 rounded-lg text-sm font-medium flex items-center gap-1"><X size={14} />Remove</button>
                          </div>
                        </div>
                      ) : (
                        <div onClick={() => fileInputRef.current?.click()} className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center cursor-pointer hover:border-green-400 hover:bg-green-50/50 transition-colors">
                          {uploading ? (
                            <div className="flex flex-col items-center gap-2"><div className="w-8 h-8 border-3 border-green-400 border-t-transparent rounded-full animate-spin" /><p className="text-sm text-gray-500">Uploading...</p></div>
                          ) : (<><Upload size={32} className="mx-auto text-gray-300 mb-2" /><p className="text-sm font-medium text-gray-600">Click to upload image</p><p className="text-xs text-gray-400 mt-1">JPG, PNG up to 5MB</p></>)}
                        </div>
                      )}
                      <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleImageUpload(f); }} />
                      <div className="mt-2">
                        <p className="text-xs text-gray-400 mb-1">Or paste an image URL:</p>
                        <input type="text" placeholder="https://..." value={livestockForm.image_url} onChange={e => setLivestockForm(f => ({ ...f, image_url: e.target.value }))} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-blue-400" />
                      </div>
                      <div className="mt-2">
                        <p className="text-xs text-gray-400 mb-1">Logo URL (shown on card):</p>
                        <input type="text" placeholder="https://..." value={livestockForm.logo_url} onChange={e => setLivestockForm(f => ({ ...f, logo_url: e.target.value }))} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-blue-400" />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div><label className="block text-sm font-semibold text-gray-700 mb-1">Name</label><input type="text" value={livestockForm.name} onChange={e => setLivestockForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Full Cow" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-blue-400" /></div>
                      <div><label className="block text-sm font-semibold text-gray-700 mb-1">Type</label><select value={livestockForm.type} onChange={e => setLivestockForm(f => ({ ...f, type: e.target.value }))} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-blue-400">{LIVESTOCK_TYPES.map(t => <option key={t} value={t}>{t}</option>)}</select></div>
                    </div>
                    <div><label className="block text-sm font-semibold text-gray-700 mb-1">Description</label><textarea value={livestockForm.description} onChange={e => setLivestockForm(f => ({ ...f, description: e.target.value }))} placeholder="Describe the livestock..." rows={2} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-blue-400 resize-none" /></div>
                    <div className="grid grid-cols-2 gap-4">
                      <div><label className="block text-sm font-semibold text-gray-700 mb-1">Price per KG</label><input type="number" value={livestockForm.price_per_kg} onChange={e => setLivestockForm(f => ({ ...f, price_per_kg: e.target.value }))} placeholder="3500" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-blue-400" /></div>
                      <div><label className="block text-sm font-semibold text-gray-700 mb-1">Price per Portion</label><input type="number" value={livestockForm.price_per_portion} onChange={e => setLivestockForm(f => ({ ...f, price_per_portion: e.target.value }))} placeholder="8000" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-blue-400" /></div>
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-700 mb-2">Portion Pricing</p>
                      <div className="grid grid-cols-3 gap-3">
                        <div><label className="block text-xs font-semibold text-gray-600 mb-1">Full Price</label><input type="number" value={livestockForm.price_full} onChange={e => setLivestockForm(f => ({ ...f, price_full: e.target.value }))} placeholder="8000" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-blue-400" /></div>
                        <div><label className="block text-xs font-semibold text-gray-600 mb-1">Half Price</label><input type="number" value={livestockForm.price_half} onChange={e => setLivestockForm(f => ({ ...f, price_half: e.target.value }))} placeholder="4500" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-blue-400" /></div>
                        <div><label className="block text-xs font-semibold text-gray-600 mb-1">Quarter Price</label><input type="number" value={livestockForm.price_quarter} onChange={e => setLivestockForm(f => ({ ...f, price_quarter: e.target.value }))} placeholder="2500" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-blue-400" /></div>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div><label className="block text-sm font-semibold text-gray-700 mb-1">Available KG</label><input type="number" value={livestockForm.available_kg} onChange={e => setLivestockForm(f => ({ ...f, available_kg: e.target.value }))} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-blue-400" /></div>
                      <div><label className="block text-sm font-semibold text-gray-700 mb-1">Available Portions</label><input type="number" value={livestockForm.available_portions} onChange={e => setLivestockForm(f => ({ ...f, available_portions: e.target.value }))} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-blue-400" /></div>
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">Unit Options</label>
                      <div className="flex gap-3">
                        {['kg', 'portion'].map(u => (
                          <label key={u} className={`flex items-center gap-2 px-4 py-2 rounded-xl border-2 cursor-pointer transition-all ${livestockForm.unit_options.includes(u) ? 'border-green-500 bg-green-50' : 'border-gray-200'}`}>
                            <input type="checkbox" checked={livestockForm.unit_options.includes(u)} onChange={e => {
                              if (e.target.checked) setLivestockForm(f => ({ ...f, unit_options: [...f.unit_options, u] }));
                              else setLivestockForm(f => ({ ...f, unit_options: f.unit_options.filter(x => x !== u) }));
                            }} className="accent-blue-700" />
                            <span className="text-sm font-medium capitalize">{u}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                    <div className="flex gap-3 pt-2">
                      <button onClick={() => setShowLivestockForm(false)} className="flex-1 py-2.5 border-2 border-gray-200 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors">Cancel</button>
                      <button onClick={saveLivestock} disabled={savingLivestock || !livestockForm.name || !livestockForm.price_per_kg} className="flex-1 flex items-center justify-center gap-2 bg-blue-700 hover:bg-blue-800 disabled:bg-gray-300 text-white py-2.5 rounded-xl text-sm font-semibold transition-colors">
                        {savingLivestock ? <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> : <CheckCircle2 size={16} />}
                        {editingLivestock ? 'Save Changes' : 'Add Livestock'}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {livestock.length === 0 ? (
              <div className="text-center py-10 text-gray-400">No livestock yet. Add your first one!</div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {livestock.map(l => (
                  <div key={l.id} className={`bg-white rounded-2xl border overflow-hidden transition-all ${l.is_available ? 'border-gray-100 hover:shadow-md' : 'border-gray-200 opacity-60'}`}>
                    <div className="relative h-40 overflow-hidden">
                      <img src={l.image_url || 'https://images.pexels.com/photos/735968/pexels-photo-735968.jpeg'} alt={l.name} className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).src = 'https://images.pexels.com/photos/735968/pexels-photo-735968.jpeg'; }} />
                      <div className="absolute top-2 right-2">
                        <span className={`text-xs px-2 py-1 rounded-full font-medium ${l.is_available ? 'bg-green-500 text-white' : 'bg-gray-500 text-white'}`}>
                          {l.is_available ? 'Active' : 'Inactive'}
                        </span>
                      </div>
                    </div>
                    <div className="p-4">
                      <div className="flex items-start justify-between">
                        <div><h3 className="font-bold text-gray-900">{l.name}</h3><p className="text-xs text-gray-500">{l.type}</p></div>
                        <div className="flex items-center gap-1">
                          <button onClick={() => openEditLivestock(l)} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"><Pencil size={14} /></button>
                          <button onClick={() => toggleLivestockAvailability(l)} className="p-1.5 text-gray-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"><Eye size={14} /></button>
                          <button onClick={() => deleteLivestock(l.id)} disabled={deletingLivestock === l.id} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"><Trash2 size={14} /></button>
                        </div>
                      </div>
                      <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                        <div className="bg-gray-50 rounded-lg p-2 text-center"><p className="text-gray-400">Per KG</p><p className="font-bold text-gray-900">{fmt(l.price_per_kg)}</p></div>
                        {l.price_per_portion && <div className="bg-green-50 rounded-lg p-2 text-center"><p className="text-green-600">Per Portion</p><p className="font-bold text-green-700">{fmt(l.price_per_portion)}</p></div>}
                      </div>
                      {(l.price_full || l.price_half || l.price_quarter) && (
                        <div className="mt-2 grid grid-cols-3 gap-2 text-xs">
                          {l.price_full && <div className="bg-blue-50 rounded-lg p-2 text-center"><p className="text-blue-600">Full</p><p className="font-bold text-blue-700">{fmt(l.price_full)}</p></div>}
                          {l.price_half && <div className="bg-amber-50 rounded-lg p-2 text-center"><p className="text-amber-600">Half</p><p className="font-bold text-amber-700">{fmt(l.price_half)}</p></div>}
                          {l.price_quarter && <div className="bg-teal-50 rounded-lg p-2 text-center"><p className="text-teal-600">Quarter</p><p className="font-bold text-teal-700">{fmt(l.price_quarter)}</p></div>}
                        </div>
                      )}
                      <div className="mt-2 flex items-center gap-3 text-xs text-gray-500"><span>{l.available_kg}kg avail</span><span>{l.available_portions} portions</span></div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ===== CUSTOMERS TAB ===== */}
        {tab === 'customers' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-gray-900">Customer Directory</h2>
              <button onClick={openAddCustomer} className="flex items-center gap-2 bg-blue-700 hover:bg-blue-800 text-white px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors">
                <Plus size={16} /> Add Customer
              </button>
            </div>

            <div className="relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input type="text" placeholder="Search customers by name, phone, email..." value={customerSearch} onChange={e => setCustomerSearch(e.target.value)} className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:border-blue-400" />
            </div>

            {/* Customer Form */}
            {showCustomerForm && (
              <div className="bg-white rounded-2xl border border-gray-100 p-5 animate-scale-in">
                <h3 className="text-sm font-bold text-gray-900 mb-3">{editingCustomer ? 'Edit Customer' : 'Add Customer'}</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div><label className="block text-xs font-semibold text-gray-600 mb-1">Name</label><input type="text" value={customerForm.name} onChange={e => setCustomerForm(f => ({ ...f, name: e.target.value }))} placeholder="John Doe" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-blue-400" /></div>
                  <div><label className="block text-xs font-semibold text-gray-600 mb-1">Phone</label><input type="tel" value={customerForm.phone} onChange={e => setCustomerForm(f => ({ ...f, phone: e.target.value }))} placeholder="+234 800 000 0000" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-blue-400" /></div>
                  <div><label className="block text-xs font-semibold text-gray-600 mb-1">Email</label><input type="email" value={customerForm.email} onChange={e => setCustomerForm(f => ({ ...f, email: e.target.value }))} placeholder="john@email.com" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-blue-400" /></div>
                  <div><label className="block text-xs font-semibold text-gray-600 mb-1">WhatsApp</label><input type="tel" value={customerForm.whatsapp} onChange={e => setCustomerForm(f => ({ ...f, whatsapp: e.target.value }))} placeholder="+234 800 000 0000" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-blue-400" /></div>
                </div>
                <div className="mt-3"><label className="block text-xs font-semibold text-gray-600 mb-1">Notes</label><textarea value={customerForm.notes} onChange={e => setCustomerForm(f => ({ ...f, notes: e.target.value }))} placeholder="Any notes about this customer..." rows={2} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-blue-400 resize-none" /></div>
                <div className="flex gap-3 mt-4">
                  <button onClick={() => setShowCustomerForm(false)} className="flex-1 py-2 border-2 border-gray-200 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors">Cancel</button>
                  <button onClick={saveCustomer} disabled={savingCustomer || !customerForm.phone} className="flex-1 flex items-center justify-center gap-2 bg-blue-700 hover:bg-blue-800 disabled:bg-gray-300 text-white py-2 rounded-xl text-sm font-semibold transition-colors">
                    {savingCustomer ? <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> : <CheckCircle2 size={14} />}
                    {editingCustomer ? 'Save' : 'Add Customer'}
                  </button>
                </div>
              </div>
            )}

            {filteredCustomers.length === 0 ? (
              <div className="text-center py-10 text-gray-400">No customers found. Add your first customer!</div>
            ) : (
              <div className="space-y-2">
                {filteredCustomers.map(c => (
                  <div key={c.id} className="bg-white rounded-xl border border-gray-100 p-4 flex items-center justify-between">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-gray-900 text-sm">{c.name || 'Unnamed'}</span>
                        {c.phone && <span className="text-xs text-gray-500">{c.phone}</span>}
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                        {c.email && <span className="flex items-center gap-1"><Mail size={10} />{c.email}</span>}
                        {c.whatsapp && <span className="flex items-center gap-1"><MessageCircle size={10} />{c.whatsapp}</span>}
                      </div>
                      {c.notes && <p className="text-xs text-gray-400 mt-1 truncate">{c.notes}</p>}
                    </div>
                    <div className="flex items-center gap-1 flex-shrink-0 ml-3">
                      <button onClick={() => openEditCustomer(c)} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"><Pencil size={14} /></button>
                      <button onClick={() => deleteCustomer(c.id)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"><Trash2 size={14} /></button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ===== SETTINGS TAB (Bank Accounts + Delivery Slots + Comment Control) ===== */}
        {tab === 'settings' && (
          <div className="space-y-8">
            {/* Comment Field Control */}
            <div>
              <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2 mb-4"><Settings size={18} />Order Form Settings</h2>
              <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-semibold text-gray-900">Customer Comment Field</p>
                    <p className="text-xs text-gray-500 mt-0.5">Show or hide the optional comment field on the order form</p>
                  </div>
                  <button onClick={() => setCommentFieldEnabled(!commentFieldEnabled)} className="flex items-center gap-2">
                    {commentFieldEnabled ? (
                      <ToggleRight size={32} className="text-green-600" />
                    ) : (
                      <ToggleLeft size={32} className="text-gray-300" />
                    )}
                    <span className={`text-sm font-medium ${commentFieldEnabled ? 'text-green-700' : 'text-gray-400'}`}>
                      {commentFieldEnabled ? 'Enabled' : 'Disabled'}
                    </span>
                  </button>
                </div>
                {commentFieldEnabled && (
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">Comment Field Label</label>
                    <input type="text" value={commentFieldLabel} onChange={e => setCommentFieldLabel(e.target.value)} placeholder="Additional Comments" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-blue-400" />
                  </div>
                )}
              </div>
            </div>

            {/* Customer Care Contact */}
            <div>
              <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2 mb-4"><Phone size={18} />Customer Care Contact</h2>
              <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-4">
                <p className="text-xs text-gray-500">These details will be shown to customers on the shop and tracking pages.</p>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">Customer Care Phone</label>
                    <input type="tel" value={customerCarePhone} onChange={e => setCustomerCarePhone(e.target.value)} placeholder="+234 800 000 0000" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-blue-400" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">Customer Care Email</label>
                    <input type="email" value={customerCareEmail} onChange={e => setCustomerCareEmail(e.target.value)} placeholder="support@freshlivestock.com" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-blue-400" />
                  </div>
                </div>
                <button onClick={saveSettings} disabled={savingSettings} className="flex items-center gap-2 bg-blue-700 hover:bg-blue-800 disabled:bg-gray-300 text-white px-4 py-2 rounded-xl text-sm font-semibold transition-colors">
                  {savingSettings ? <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> : <CheckCircle2 size={14} />}
                  Save All Settings
                </button>
              </div>
            </div>

            {/* Preparation Types */}
            <div>
              <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2 mb-4"><Settings size={18} />Preparation Types</h2>
              <div className="bg-white rounded-2xl border border-gray-100 p-5 space-y-4">
                <p className="text-xs text-gray-500">Manage the available preparation options customers can choose from when ordering.</p>
                
                {/* Add New Preparation Type */}
                <div className="flex gap-2">
                  <input 
                    type="text" 
                    value={newPreparationType} 
                    onChange={e => setNewPreparationType(e.target.value)} 
                    onKeyDown={e => {
                      if (e.key === 'Enter' && newPreparationType.trim() && !preparationTypes.includes(newPreparationType.trim())) {
                        setPreparationTypes([...preparationTypes, newPreparationType.trim()]);
                        setNewPreparationType('');
                      }
                    }}
                    placeholder="Add new preparation type (e.g., Fry, Smoked, etc.)" 
                    className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-blue-400" 
                  />
                  <button 
                    onClick={() => {
                      if (newPreparationType.trim() && !preparationTypes.includes(newPreparationType.trim())) {
                        setPreparationTypes([...preparationTypes, newPreparationType.trim()]);
                        setNewPreparationType('');
                      }
                    }}
                    className="bg-blue-700 hover:bg-blue-800 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors"
                  >
                    <Plus size={14} className="inline" />
                  </button>
                </div>

                {/* List of Preparation Types */}
                <div className="flex flex-wrap gap-2">
                  {preparationTypes.map(type => (
                    <div key={type} className="flex items-center gap-2 bg-blue-50 border border-blue-200 rounded-lg px-3 py-2">
                      <span className="text-sm font-semibold text-blue-700">{type}</span>
                      <button
                        onClick={() => setPreparationTypes(preparationTypes.filter(t => t !== type))}
                        className="text-blue-400 hover:text-red-600 transition-colors"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ))}
                </div>

                {preparationTypes.length === 0 && (
                  <p className="text-sm text-gray-400 text-center py-4">No preparation types added yet.</p>
                )}

                <button onClick={saveSettings} disabled={savingSettings} className="flex items-center gap-2 bg-blue-700 hover:bg-blue-800 disabled:bg-gray-300 text-white px-4 py-2 rounded-xl text-sm font-semibold transition-colors w-full">
                  {savingSettings ? <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> : <CheckCircle2 size={14} />}
                  Save All Settings
                </button>
              </div>
            </div>

            {/* Bank Accounts */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2"><Building2 size={18} />Bank Accounts</h2>
                <button onClick={openAddBank} className="flex items-center gap-2 bg-blue-700 hover:bg-blue-800 text-white px-4 py-2 rounded-xl text-sm font-semibold transition-colors"><Plus size={16} />Add Account</button>
              </div>

              {showBankForm && (
                <div className="bg-white rounded-2xl border border-gray-100 p-5 mb-4 animate-scale-in">
                  <h3 className="text-sm font-bold text-gray-900 mb-3">{editingBank ? 'Edit Bank Account' : 'Add Bank Account'}</h3>
                  <div className="grid grid-cols-2 gap-3">
                    <div><label className="block text-xs font-semibold text-gray-600 mb-1">Bank Name</label><input type="text" value={bankForm.bank_name} onChange={e => setBankForm(f => ({ ...f, bank_name: e.target.value }))} placeholder="First Bank" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-blue-400" /></div>
                    <div><label className="block text-xs font-semibold text-gray-600 mb-1">Account Name</label><input type="text" value={bankForm.account_name} onChange={e => setBankForm(f => ({ ...f, account_name: e.target.value }))} placeholder="FreshLivestock Ltd" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-blue-400" /></div>
                    <div><label className="block text-xs font-semibold text-gray-600 mb-1">Account Number</label><input type="text" value={bankForm.account_number} onChange={e => setBankForm(f => ({ ...f, account_number: e.target.value }))} placeholder="3012345678" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-blue-400" /></div>
                    <div><label className="block text-xs font-semibold text-gray-600 mb-1">Sort Code</label><input type="text" value={bankForm.sort_code} onChange={e => setBankForm(f => ({ ...f, sort_code: e.target.value }))} placeholder="011" className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-blue-400" /></div>
                  </div>
                  <div className="flex gap-3 mt-4">
                    <button onClick={() => setShowBankForm(false)} className="flex-1 py-2 border-2 border-gray-200 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors">Cancel</button>
                    <button onClick={saveBank} disabled={savingBank || !bankForm.bank_name || !bankForm.account_number} className="flex-1 flex items-center justify-center gap-2 bg-blue-700 hover:bg-blue-800 disabled:bg-gray-300 text-white py-2 rounded-xl text-sm font-semibold transition-colors">
                      {savingBank ? <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> : <CheckCircle2 size={14} />}
                      {editingBank ? 'Save' : 'Add Account'}
                    </button>
                  </div>
                </div>
              )}

              {bankAccounts.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-4">No bank accounts yet.</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {bankAccounts.map(b => (
                    <div key={b.id} className="bg-white rounded-2xl border border-gray-100 p-4">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">{b.bank_name}</p>
                          <p className="font-semibold text-gray-900 mt-1">{b.account_name}</p>
                          <p className="text-lg font-bold text-gray-900 tracking-widest mt-0.5">{b.account_number}</p>
                          {b.sort_code && <p className="text-xs text-gray-400">Sort: {b.sort_code}</p>}
                        </div>
                        <div className="flex items-center gap-1">
                          <button onClick={() => openEditBank(b)} className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"><Pencil size={14} /></button>
                          <button onClick={() => deleteBank(b.id)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"><Trash2 size={14} /></button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Delivery Slots */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2"><Calendar size={18} />Delivery Slots</h2>
                <button onClick={() => { setSlotForm({ slot_date: '', slot_label: 'Morning (8am - 12pm)', max_orders: '10' }); setShowSlotForm(true); }} className="flex items-center gap-2 bg-blue-700 hover:bg-blue-800 text-white px-4 py-2 rounded-xl text-sm font-semibold transition-colors"><Plus size={16} />Add Slot</button>
              </div>

              {showSlotForm && (
                <div className="bg-white rounded-2xl border border-gray-100 p-5 mb-4 animate-scale-in">
                  <h3 className="text-sm font-bold text-gray-900 mb-3">Add Delivery Slot</h3>
                  <div className="grid grid-cols-3 gap-3">
                    <div><label className="block text-xs font-semibold text-gray-600 mb-1">Date</label><input type="date" value={slotForm.slot_date} onChange={e => setSlotForm(f => ({ ...f, slot_date: e.target.value }))} min={new Date().toISOString().split('T')[0]} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-blue-400" /></div>
                    <div><label className="block text-xs font-semibold text-gray-600 mb-1">Time Slot</label><select value={slotForm.slot_label} onChange={e => setSlotForm(f => ({ ...f, slot_label: e.target.value }))} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-blue-400">
                      <option>Morning (8am - 12pm)</option>
                      <option>Afternoon (12pm - 5pm)</option>
                      <option>Evening (5pm - 9pm)</option>
                    </select></div>
                    <div><label className="block text-xs font-semibold text-gray-600 mb-1">Max Orders</label><input type="number" value={slotForm.max_orders} onChange={e => setSlotForm(f => ({ ...f, max_orders: e.target.value }))} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-blue-400" /></div>
                  </div>
                  <div className="flex gap-3 mt-4">
                    <button onClick={() => setShowSlotForm(false)} className="flex-1 py-2 border-2 border-gray-200 rounded-xl text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors">Cancel</button>
                    <button onClick={saveSlot} disabled={savingSlot || !slotForm.slot_date} className="flex-1 flex items-center justify-center gap-2 bg-blue-700 hover:bg-blue-800 disabled:bg-gray-300 text-white py-2 rounded-xl text-sm font-semibold transition-colors">
                      {savingSlot ? <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> : <CheckCircle2 size={14} />}
                      Add Slot
                    </button>
                  </div>
                </div>
              )}

              {deliverySlots.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-4">No delivery slots yet.</p>
              ) : (
                <div className="space-y-2">
                  {deliverySlots.map(s => (
                    <div key={s.id} className="bg-white rounded-xl border border-gray-100 p-3 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="bg-green-50 p-2 rounded-lg"><Calendar size={16} className="text-green-600" /></div>
                        <div>
                          <p className="text-sm font-semibold text-gray-900">{new Date(s.slot_date + 'T12:00:00').toLocaleDateString('en-NG', { weekday: 'short', month: 'short', day: 'numeric' })}</p>
                          <p className="text-xs text-gray-500">{s.slot_label}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-xs text-gray-500">{s.current_orders}/{s.max_orders} booked</span>
                        <button onClick={() => deleteSlot(s.id)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"><Trash2 size={14} /></button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ===== BLAST TAB ===== */}
        {tab === 'blast' && (
          <div className="bg-white rounded-2xl border border-gray-100 p-6 max-w-2xl">
            <h3 className="font-bold text-gray-900 mb-1">Send Blast Message</h3>
            <p className="text-sm text-gray-500 mb-4">This message will be added to all active (non-cancelled/delivered) orders timeline.</p>
            <textarea value={blastMessage} onChange={e => setBlastMessage(e.target.value)} placeholder="e.g. We are experiencing high demand today. Your order may be delayed by 1-2 hours." rows={4} className="w-full border-2 border-gray-200 rounded-xl p-3 text-sm focus:outline-none focus:border-blue-400 resize-none" />
            <button onClick={sendBlastNotification} disabled={blasting || !blastMessage.trim()} className="mt-3 flex items-center gap-2 bg-blue-700 hover:bg-blue-800 disabled:bg-gray-300 text-white px-5 py-2.5 rounded-xl text-sm font-semibold transition-colors">
              {blasting ? <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> : <Bell size={15} />}
              Send to All Active Orders
            </button>
          </div>
        )}

        {/* ===== PASSWORD TAB ===== */}
        {tab === 'password' && (
          <PasswordManager onPasswordChange={() => {
            // Optional: Show success feedback
          }} />
        )}
      </div>
    </div>
  );
}
