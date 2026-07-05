import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useQueryState } from 'nuqs';
import {
  Search, Filter, Download, Plus, RefreshCw, ChevronDown, ChevronUp, Send, Truck,
  RotateCcw, Pencil, CircleCheck as CheckCircle2, ExternalLink, LayoutGrid, List,
} from 'lucide-react';
import { supabase, type Order, type OrderUpdate, type OrderItem } from '../../lib/supabase';
import { useAdminOrders, useAdminLivestock, useAdminLocations, useAdminSetting } from '../../hooks/adminQueries';
import ManualOrderModal from '../../components/ManualOrderModal';

const STATUS_LABELS: Record<string, string> = {
  pending: 'Pending', awaiting_confirmation: 'Awaiting Confirmation', awaiting_payment: 'Awaiting Payment',
  confirmed: 'Confirmed', processing: 'Processing', ready: 'Ready', in_transit: 'In Transit', delivered: 'Delivered', cancelled: 'Cancelled',
};
const PAYMENT_LABELS: Record<string, string> = { pending: 'Pending', confirmed: 'Confirmed', failed: 'Failed' };
const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-800', awaiting_confirmation: 'bg-purple-100 text-purple-800', awaiting_payment: 'bg-amber-100 text-amber-800',
  confirmed: 'bg-blue-100 text-blue-800', processing: 'bg-orange-100 text-orange-800', ready: 'bg-teal-100 text-teal-800',
  in_transit: 'bg-indigo-100 text-indigo-800', delivered: 'bg-green-100 text-green-800', cancelled: 'bg-red-100 text-red-800',
};
const PAYMENT_COLORS: Record<string, string> = { pending: 'bg-amber-100 text-amber-800', confirmed: 'bg-green-100 text-green-800', failed: 'bg-red-100 text-red-800' };

function fmt(n: number) {
  return new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 }).format(n);
}

export default function OrdersSection() {
  const qc = useQueryClient();
  const { data: orders = [], isLoading, refetch } = useAdminOrders();
  const { data: livestock = [] } = useAdminLivestock();
  const { data: locations = [] } = useAdminLocations();
  const { data: pointsPer1000 = '1' } = useAdminSetting('points_per_1000', '1');

  const [q, setQ] = useQueryState('q', { defaultValue: '' });
  const [status, setStatus] = useQueryState('status', { defaultValue: 'all' });
  const [view, setView] = useQueryState('view', { defaultValue: 'cards' });
  const isTable = view === 'table';

  const [expanded, setExpanded] = useState<string | null>(null);
  const [updating, setUpdating] = useState<string | null>(null);
  const [updateMessage, setUpdateMessage] = useState('');
  const [orderUpdates, setOrderUpdates] = useState<Record<string, OrderUpdate[]>>({});
  const [orderItems, setOrderItems] = useState<Record<string, OrderItem[]>>({});
  const [manualOrder, setManualOrder] = useState<{ mode: 'create' | 'edit'; order: Order | null } | null>(null);

  const invalidate = () => qc.invalidateQueries({ queryKey: ['admin'] });

  const filtered = orders.filter((o) => {
    const matchStatus = status === 'all' || o.order_status === status;
    const s = (q ?? '').toLowerCase();
    const matchSearch = !s || o.order_number.toLowerCase().includes(s) || o.customer_name.toLowerCase().includes(s) || o.customer_phone.includes(s);
    return matchStatus && matchSearch;
  });

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
    await supabase.from('profiles').update({ points: (prof?.points ?? 0) + pts }).eq('id', order.user_id);
  }

  async function loadDetail(order: Order) {
    const [{ data: ups }, { data: its }] = await Promise.all([
      supabase.from('order_updates').select('*').eq('order_id', order.id).order('created_at', { ascending: false }),
      supabase.from('order_items').select('*').eq('order_id', order.id),
    ]);
    setOrderUpdates((p) => ({ ...p, [order.id]: ups ?? [] }));
    setOrderItems((p) => ({ ...p, [order.id]: its ?? [] }));
  }

  async function updateStatus(order: Order, s: string) {
    setUpdating(order.id);
    await supabase.from('orders').update({ order_status: s, updated_at: new Date().toISOString() }).eq('id', order.id);
    const msg = s === 'in_transit' ? `Your order #${order.order_number} is now in transit.` : `Your order #${order.order_number} status is now: ${STATUS_LABELS[s]}.`;
    await supabase.from('order_updates').insert({ order_id: order.id, status: s, message: msg, created_by: 'admin' });
    await notifyUser(order, 'Order update', msg);
    setUpdating(null); invalidate();
  }
  async function confirmOrder(order: Order) {
    setUpdating(order.id);
    await supabase.from('orders').update({ order_status: 'awaiting_payment', updated_at: new Date().toISOString() }).eq('id', order.id);
    const msg = `Your order #${order.order_number} has been confirmed. You can now proceed to payment.`;
    await supabase.from('order_updates').insert({ order_id: order.id, status: 'awaiting_payment', message: msg, created_by: 'admin' });
    await notifyUser(order, 'Order confirmed — pay now', msg, 'payment');
    setUpdating(null); invalidate();
  }
  async function confirmPayment(order: Order, s: 'confirmed' | 'failed') {
    setUpdating(order.id);
    await supabase.from('orders').update({ payment_status: s, updated_at: new Date().toISOString() }).eq('id', order.id);
    const label = s === 'confirmed' ? 'confirmed' : 'declined';
    await supabase.from('order_updates').insert({ order_id: order.id, status: order.order_status, message: `Payment for order #${order.order_number} has been ${label}.`, created_by: 'admin' });
    await notifyUser(order, 'Payment ' + label, `Payment for order #${order.order_number} has been ${label}.`, 'payment');
    if (s === 'confirmed') {
      if (['pending', 'awaiting_confirmation', 'awaiting_payment'].includes(order.order_status)) await supabase.from('orders').update({ order_status: 'confirmed', updated_at: new Date().toISOString() }).eq('id', order.id);
      await awardPoints(order);
    }
    setUpdating(null); invalidate();
  }
  async function reversePayment(order: Order) {
    if (!confirm(`Reverse payment for #${order.order_number}?`)) return;
    setUpdating(order.id);
    await supabase.from('orders').update({ payment_status: 'pending', updated_at: new Date().toISOString() }).eq('id', order.id);
    await supabase.from('order_updates').insert({ order_id: order.id, status: order.order_status, message: `Payment for order #${order.order_number} has been reversed.`, created_by: 'admin' });
    await notifyUser(order, 'Payment reversed', `Payment for order #${order.order_number} has been reversed.`, 'payment');
    setUpdating(null); invalidate();
  }
  async function sendCustomMessage(order: Order) {
    if (!updateMessage.trim()) return;
    setUpdating(order.id);
    await supabase.from('order_updates').insert({ order_id: order.id, status: order.order_status, message: updateMessage.trim(), created_by: 'admin' });
    await notifyUser(order, 'Message about your order', updateMessage.trim(), 'message');
    setUpdateMessage(''); setUpdating(null); loadDetail(order);
  }

  function exportCSV() {
    const cols = ['Order', 'Date', 'Status', 'Payment', 'Customer', 'Phone', 'Email', 'Fulfillment', 'Location', 'Address', 'Pickup Time', 'Item', 'Preparation', 'Total'];
    const rows = filtered.map((o) => [o.order_number, new Date(o.created_at).toLocaleString(), STATUS_LABELS[o.order_status] ?? o.order_status, PAYMENT_LABELS[o.payment_status] ?? o.payment_status, o.customer_name, o.customer_phone, o.customer_email, o.fulfillment_type, o.delivery_location_name, o.delivery_address, o.pickup_time, o.livestock_name, o.preparation_type, o.total_amount]);
    const esc = (v: any) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const csv = [cols.map(esc).join(','), ...rows.map((r) => r.map(esc).join(','))].join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    const a = document.createElement('a'); a.href = url; a.download = `koyan-orders-${new Date().toISOString().slice(0, 10)}.csv`; a.click(); URL.revokeObjectURL(url);
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      {/* Section header */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Orders</h1>
          <p className="text-sm text-gray-500">{filtered.length} of {orders.length} orders</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => refetch()} className="w-10 h-10 flex items-center justify-center rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50" aria-label="Refresh"><RefreshCw size={16} /></button>
          <button onClick={exportCSV} className="flex items-center gap-1.5 border border-gray-200 text-gray-700 hover:bg-gray-50 rounded-lg py-2 px-3 text-sm font-semibold"><Download size={14} />Export</button>
          <button onClick={() => setManualOrder({ mode: 'create', order: null })} className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg py-2 px-3 text-sm font-semibold"><Plus size={14} />New Order</button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg border border-gray-200 p-3 mb-4 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-48">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={q ?? ''} onChange={(e) => setQ(e.target.value || null)} placeholder="Search order #, name, phone…" className="w-full pl-8 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-emerald-500" />
        </div>
        <div className="flex items-center gap-2">
          <Filter size={14} className="text-gray-400" />
          <select value={status ?? 'all'} onChange={(e) => setStatus(e.target.value === 'all' ? null : e.target.value)} className="border border-gray-200 rounded-lg py-2 px-3 text-sm focus:outline-none focus:border-emerald-500">
            <option value="all">All statuses</option>
            {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
        <div className="flex items-center gap-1 border border-gray-200 rounded-lg p-1">
          <button onClick={() => setView('cards')} className={`w-8 h-8 flex items-center justify-center rounded ${!isTable ? 'bg-emerald-600 text-white' : 'text-gray-400'}`} aria-label="Cards"><LayoutGrid size={15} /></button>
          <button onClick={() => setView('table')} className={`w-8 h-8 flex items-center justify-center rounded ${isTable ? 'bg-emerald-600 text-white' : 'text-gray-400'}`} aria-label="Table"><List size={15} /></button>
        </div>
      </div>

      {isLoading ? (
        <div className="text-center py-16 text-gray-400">Loading orders…</div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 text-center py-16 text-gray-400">No orders found.</div>
      ) : isTable ? (
        <div className="bg-white rounded-lg border border-gray-200 overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-gray-50 text-gray-500">
              <tr>{['Order', 'Customer', 'Phone', 'Fulfillment', 'Status', 'Payment', 'Total', ''].map((h) => <th key={h} className="text-left px-3 py-2.5 font-semibold whitespace-nowrap">{h}</th>)}</tr>
            </thead>
            <tbody>
              {filtered.map((o) => (
                <tr key={o.id} className="border-t border-gray-50 hover:bg-gray-50/60">
                  <td className="px-3 py-2.5 font-semibold text-gray-900 whitespace-nowrap">{o.order_number}</td>
                  <td className="px-3 py-2.5 whitespace-nowrap">{o.customer_name}</td>
                  <td className="px-3 py-2.5 whitespace-nowrap">{o.customer_phone}</td>
                  <td className="px-3 py-2.5 capitalize">{o.fulfillment_type}</td>
                  <td className="px-3 py-2.5"><span className={`px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[o.order_status]}`}>{STATUS_LABELS[o.order_status]}</span></td>
                  <td className="px-3 py-2.5"><span className={`px-2 py-0.5 rounded-full font-medium ${PAYMENT_COLORS[o.payment_status]}`}>{PAYMENT_LABELS[o.payment_status]}</span></td>
                  <td className="px-3 py-2.5 font-semibold whitespace-nowrap">{fmt(o.total_amount)}</td>
                  <td className="px-3 py-2.5"><button onClick={() => setManualOrder({ mode: 'edit', order: o })} className="text-emerald-700 font-semibold">Edit</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((order) => (
            <div key={order.id} className="bg-white rounded-lg border border-gray-200 overflow-hidden">
              <div className="p-4 flex items-center justify-between cursor-pointer hover:bg-gray-50" onClick={() => { const open = expanded === order.id; setExpanded(open ? null : order.id); if (!open) loadDetail(order); }}>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-gray-900 text-sm">{order.order_number}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[order.order_status]}`}>{STATUS_LABELS[order.order_status]}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${PAYMENT_COLORS[order.payment_status]}`}>Pay: {PAYMENT_LABELS[order.payment_status]}</span>
                    {order.customer_confirmed && <span className="text-xs px-2 py-0.5 rounded-full bg-green-50 text-green-700 font-medium">Received</span>}
                  </div>
                  <p className="text-xs text-gray-500 mt-0.5 truncate">{order.customer_name} · {order.livestock_name} · {fmt(order.total_amount)}</p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                  <span className="text-xs text-gray-400 hidden sm:block">{new Date(order.created_at).toLocaleDateString()}</span>
                  {expanded === order.id ? <ChevronUp size={16} className="text-gray-400" /> : <ChevronDown size={16} className="text-gray-400" />}
                </div>
              </div>

              {expanded === order.id && (
                <div className="border-t border-gray-100 p-4 space-y-4">
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                    {[
                      { label: 'Customer', value: order.customer_name },
                      { label: 'Email', value: order.customer_email || '—' },
                      { label: 'Phone', value: order.customer_phone },
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
                    <a href={order.payment_proof_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2 text-xs font-medium text-emerald-700"><ExternalLink size={12} />View Payment Proof</a>
                  )}

                  <div className="flex flex-wrap gap-2 pt-2 border-t border-gray-100 items-center">
                    {order.order_status === 'awaiting_confirmation' && <button onClick={() => confirmOrder(order)} disabled={updating === order.id} className="flex items-center gap-1 bg-purple-600 hover:bg-purple-700 text-white px-3 py-1.5 rounded-lg text-xs font-semibold"><CheckCircle2 size={12} />Confirm Order</button>}
                    {order.order_status === 'ready' && <button onClick={() => updateStatus(order, 'in_transit')} disabled={updating === order.id} className="flex items-center gap-1 bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded-lg text-xs font-semibold"><Truck size={12} />Mark In Transit</button>}
                    <button onClick={() => setManualOrder({ mode: 'edit', order })} className="flex items-center gap-1 border border-gray-200 text-gray-600 hover:bg-gray-50 px-3 py-1.5 rounded-lg text-xs font-semibold"><Pencil size={12} />Edit</button>
                    <div className="flex items-center gap-2"><span className="text-xs font-semibold text-gray-500">Status:</span>
                      <select value={order.order_status} onChange={(e) => updateStatus(order, e.target.value)} disabled={updating === order.id} className="text-xs border border-gray-200 rounded-lg py-1 px-2 focus:outline-none focus:border-emerald-500">{Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
                    </div>
                    <div className="flex items-center gap-2"><span className="text-xs font-semibold text-gray-500">Payment:</span>
                      <select value={order.payment_status} onChange={(e) => confirmPayment(order, e.target.value as any)} disabled={updating === order.id} className="text-xs border border-gray-200 rounded-lg py-1 px-2 focus:outline-none focus:border-emerald-500">{Object.entries(PAYMENT_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
                      {order.payment_status === 'confirmed' && <button onClick={() => reversePayment(order)} className="flex items-center gap-1 text-xs text-red-600 hover:bg-red-50 border border-red-200 rounded-lg px-2 py-1"><RotateCcw size={11} />Reverse</button>}
                    </div>
                  </div>

                  <div className="flex gap-2 pt-2 border-t border-gray-100">
                    <input value={updateMessage} onChange={(e) => setUpdateMessage(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && sendCustomMessage(order)} placeholder="Send a custom update…" className="flex-1 text-xs border border-gray-200 rounded-lg py-2 px-3 focus:outline-none focus:border-emerald-500" />
                    <button onClick={() => sendCustomMessage(order)} disabled={updating === order.id || !updateMessage.trim()} className="flex items-center gap-1 bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-300 text-white px-3 py-2 rounded-lg text-xs font-semibold"><Send size={12} />Send</button>
                  </div>

                  {(orderUpdates[order.id] ?? []).length > 0 && (
                    <div className="pt-2 border-t border-gray-100">
                      <p className="text-xs font-semibold text-gray-500 mb-2">Recent updates</p>
                      <div className="space-y-2 max-h-32 overflow-y-auto">
                        {(orderUpdates[order.id] ?? []).map((u) => (
                          <div key={u.id} className="flex gap-2"><div className={`w-1.5 h-1.5 rounded-full mt-1.5 flex-shrink-0 ${u.created_by === 'customer' ? 'bg-blue-400' : 'bg-emerald-400'}`} /><div><p className="text-xs text-gray-700">{u.message}</p><p className="text-[10px] text-gray-400">{new Date(u.created_at).toLocaleString()}</p></div></div>
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

      {manualOrder && (
        <ManualOrderModal mode={manualOrder.mode} order={manualOrder.order} livestock={livestock} locations={locations} onClose={() => setManualOrder(null)} onSaved={invalidate} />
      )}
    </div>
  );
}
