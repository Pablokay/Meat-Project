import { useState } from 'react';
import { Bell, RefreshCw } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAdminCarts } from '../../hooks/adminQueries';

function fmt(n: number) {
  return new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 }).format(n);
}

export default function CartsSection() {
  const { data: carts = [], isLoading, refetch } = useAdminCarts();
  const [sending, setSending] = useState<string | null>(null);

  const abandonedCarts = carts.filter((c) => (c.items?.length ?? 0) > 0 && c.status !== 'checked_out');

  async function remindCart(cart: any) {
    if (!cart.user_id) return;
    setSending(cart.id);
    await supabase.from('notifications').insert({
      recipient_type: 'user', user_id: cart.user_id, title: 'Items in your cart',
      body: `You still have ${(cart.items?.length ?? 0)} item(s) waiting in your cart (${fmt(cart.total || 0)}). Complete your order today!`, type: 'reminder',
    });
    setSending(null);
    alert('Reminder sent.');
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Active / Abandoned Carts</h1>
          <p className="text-sm text-gray-500">{abandonedCarts.length} cart(s) with items awaiting checkout</p>
        </div>
        <button onClick={() => refetch()} className="w-10 h-10 flex items-center justify-center rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50" aria-label="Refresh"><RefreshCw size={16} /></button>
      </div>

      {isLoading ? <div className="text-center py-16 text-gray-400">Loading…</div> : abandonedCarts.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 text-center py-16 text-gray-400">No active carts.</div>
      ) : (
        <div className="space-y-3">
          {abandonedCarts.map((c) => (
            <div key={c.id} className="bg-white rounded-lg border border-gray-100 p-4 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="font-semibold text-gray-900 text-sm">{c.user_name || c.user_email || 'Customer'}</p>
                <p className="text-xs text-gray-500">{(c.items?.length ?? 0)} item(s) · {fmt(c.total || 0)} · updated {new Date(c.updated_at).toLocaleString()}</p>
              </div>
              <button onClick={() => remindCart(c)} disabled={!c.user_id || sending === c.id} className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-300 text-white px-3 py-2 rounded-lg text-xs font-semibold flex-shrink-0"><Bell size={13} />{sending === c.id ? 'Sending…' : 'Send Reminder'}</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
