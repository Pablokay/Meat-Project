import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useQueryState } from 'nuqs';
import { CircleCheck as CheckCircle2, X, RotateCcw, ExternalLink, RefreshCw } from 'lucide-react';
import { supabase, type Order } from '../../lib/supabase';
import { useAdminOrders, useAdminSetting } from '../../hooks/adminQueries';

const PAYMENT_LABELS: Record<string, string> = { pending: 'Pending', confirmed: 'Confirmed', failed: 'Failed' };
const PAYMENT_COLORS: Record<string, string> = { pending: 'bg-amber-100 text-amber-800', confirmed: 'bg-green-100 text-green-800', failed: 'bg-red-100 text-red-800' };

function fmt(n: number) {
  return new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 }).format(n);
}

export default function PaymentsSection() {
  const qc = useQueryClient();
  const { data: orders = [], isLoading, refetch } = useAdminOrders();
  const { data: pointsPer1000 = '1' } = useAdminSetting('points_per_1000', '1');

  const [filter, setFilter] = useQueryState('status', { defaultValue: 'all' });
  const [updating, setUpdating] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulking, setBulking] = useState(false);

  const invalidate = () => qc.invalidateQueries({ queryKey: ['admin'] });
  const list = orders.filter((o) => filter === 'all' || o.payment_status === filter);
  const pending = orders.filter((o) => o.payment_status === 'pending');

  async function notifyUser(order: Order, title: string, body: string) {
    if (!order.user_id) return;
    await supabase.from('notifications').insert({ recipient_type: 'user', user_id: order.user_id, title, body, type: 'payment', order_id: order.id });
  }
  async function awardPoints(order: Order) {
    if (!order.user_id || order.points_earned > 0) return;
    const pts = Math.floor((order.total_amount / 1000) * (parseFloat(pointsPer1000) || 1));
    if (pts <= 0) return;
    await supabase.from('orders').update({ points_earned: pts }).eq('id', order.id);
    const { data: prof } = await supabase.from('profiles').select('points').eq('id', order.user_id).maybeSingle();
    await supabase.from('profiles').update({ points: (prof?.points ?? 0) + pts }).eq('id', order.user_id);
  }

  async function confirmPayment(order: Order, s: 'confirmed' | 'failed') {
    setUpdating(order.id);
    await supabase.from('orders').update({ payment_status: s, updated_at: new Date().toISOString() }).eq('id', order.id);
    const label = s === 'confirmed' ? 'confirmed' : 'declined';
    await supabase.from('order_updates').insert({ order_id: order.id, status: order.order_status, message: `Payment for order #${order.order_number} has been ${label}.`, created_by: 'admin' });
    await notifyUser(order, 'Payment ' + label, `Payment for order #${order.order_number} has been ${label}.`);
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
    await notifyUser(order, 'Payment reversed', `Payment for order #${order.order_number} has been reversed.`);
    setUpdating(null); invalidate();
  }
  async function bulkConfirm() {
    setBulking(true);
    for (const id of selected) {
      const o = orders.find((x) => x.id === id);
      if (o && o.payment_status !== 'confirmed') await confirmPayment(o, 'confirmed');
    }
    setSelected(new Set()); setBulking(false);
  }
  const toggle = (id: string) => setSelected((p) => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Payments</h1>
          <p className="text-sm text-gray-500">{pending.length} awaiting confirmation</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => refetch()} className="w-10 h-10 flex items-center justify-center rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50" aria-label="Refresh"><RefreshCw size={16} /></button>
          {pending.length > 0 && <button onClick={() => setSelected(new Set(pending.map((o) => o.id)))} className="text-xs font-semibold text-emerald-700 hover:underline">Select all pending</button>}
          <select value={filter ?? 'all'} onChange={(e) => setFilter(e.target.value === 'all' ? null : e.target.value)} className="border border-gray-200 rounded-lg py-2 px-3 text-sm focus:outline-none focus:border-emerald-500">
            <option value="all">All payments</option>
            {Object.entries(PAYMENT_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
      </div>

      {selected.size > 0 && (
        <div className="sticky top-2 z-10 bg-emerald-600 text-white rounded-lg px-4 py-3 flex items-center justify-between mb-4">
          <span className="text-sm font-semibold">{selected.size} selected</span>
          <div className="flex items-center gap-2">
            <button onClick={() => setSelected(new Set())} className="text-sm px-3 py-1.5 rounded-lg hover:bg-white/10">Clear</button>
            <button onClick={bulkConfirm} disabled={bulking} className="flex items-center gap-2 bg-white text-emerald-700 px-4 py-1.5 rounded-lg text-sm font-bold">{bulking ? <div className="w-4 h-4 border-2 border-emerald-400 border-t-transparent rounded-full animate-spin" /> : <CheckCircle2 size={15} />}Confirm {selected.size}</button>
          </div>
        </div>
      )}

      {isLoading ? <div className="text-center py-16 text-gray-400">Loading…</div> : list.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 text-center py-16 text-gray-400">No payments to show.</div>
      ) : (
        <div className="space-y-3">
          {list.map((order) => (
            <div key={order.id} className={`bg-white rounded-lg border p-4 ${selected.has(order.id) ? 'border-emerald-400 ring-1 ring-emerald-300' : order.payment_status === 'pending' ? 'border-amber-200' : order.payment_status === 'confirmed' ? 'border-green-200' : 'border-red-200'}`}>
              <div className="flex items-center gap-2 flex-wrap mb-1">
                {order.payment_status === 'pending' && <input type="checkbox" checked={selected.has(order.id)} onChange={() => toggle(order.id)} className="accent-emerald-600 w-4 h-4" />}
                <span className="font-bold text-gray-900 text-sm">{order.order_number}</span>
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${PAYMENT_COLORS[order.payment_status]}`}>{PAYMENT_LABELS[order.payment_status]}</span>
              </div>
              <p className="text-xs text-gray-500">{order.customer_name} · {order.customer_phone} · {fmt(order.total_amount)} · Ref: {order.payment_reference || '—'}</p>
              {order.payment_proof_url && <a href={order.payment_proof_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 mt-2 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-1.5 text-xs font-medium text-emerald-700"><ExternalLink size={12} />Proof</a>}
              <div className="mt-3 pt-3 border-t border-gray-100 flex items-center gap-3">
                {order.payment_status !== 'confirmed' && <button onClick={() => confirmPayment(order, 'confirmed')} disabled={updating === order.id} className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-300 text-white px-4 py-2 rounded-lg text-sm font-semibold"><CheckCircle2 size={16} />Confirm</button>}
                {order.payment_status === 'pending' && <button onClick={() => confirmPayment(order, 'failed')} disabled={updating === order.id} className="flex items-center gap-2 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 px-4 py-2 rounded-lg text-sm font-semibold"><X size={16} />Decline</button>}
                {order.payment_status === 'confirmed' && <button onClick={() => reversePayment(order)} disabled={updating === order.id} className="flex items-center gap-2 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 px-4 py-2 rounded-lg text-sm font-semibold"><RotateCcw size={16} />Reverse Payment</button>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
