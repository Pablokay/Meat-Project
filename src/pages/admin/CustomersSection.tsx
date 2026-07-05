import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useQueryState } from 'nuqs';
import { Search, Download, Plus, RefreshCw } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAdminOrders, useAdminCustomers } from '../../hooks/adminQueries';

function fmt(n: number) {
  return new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 }).format(n);
}

type Derived = { key: string; name: string; phone: string; email: string; whatsapp: string; type: 'registered' | 'guest' | 'manual'; orders: number; total: number; last: string };

export default function CustomersSection() {
  const qc = useQueryClient();
  const { data: orders = [], refetch } = useAdminOrders();
  const { data: customers = [] } = useAdminCustomers();
  const invalidate = () => qc.invalidateQueries({ queryKey: ['admin'] });

  const [type, setType] = useQueryState('type', { defaultValue: 'all' });
  const [q, setQ] = useQueryState('q', { defaultValue: '' });
  const [showForm, setShowForm] = useState(false);
  const [f, setF] = useState({ name: '', phone: '', email: '', whatsapp: '' });

  const derived: Derived[] = (() => {
    const map = new Map<string, Derived>();
    for (const o of orders) {
      const key = (o.customer_phone || o.customer_email || o.id).toLowerCase();
      const t: Derived['type'] = o.user_id ? 'registered' : 'guest';
      const ex = map.get(key);
      if (ex) { ex.orders++; ex.total += o.total_amount; if (o.created_at > ex.last) ex.last = o.created_at; if (t === 'registered') ex.type = 'registered'; if (!ex.email && o.customer_email) ex.email = o.customer_email; }
      else map.set(key, { key, name: o.customer_name, phone: o.customer_phone, email: o.customer_email, whatsapp: o.customer_whatsapp, type: t, orders: 1, total: o.total_amount, last: o.created_at });
    }
    for (const c of customers) { const key = (c.phone || c.email || c.id).toLowerCase(); if (!map.has(key)) map.set(key, { key, name: c.name, phone: c.phone, email: c.email, whatsapp: c.whatsapp ?? '', type: 'manual', orders: 0, total: 0, last: c.created_at }); }
    return [...map.values()].sort((a, b) => (a.last < b.last ? 1 : -1));
  })();

  const shown = derived.filter((c) => {
    const matchType = (type ?? 'all') === 'all' || ((type === 'registered') ? c.type === 'registered' : c.type !== 'registered');
    const s = (q ?? '').toLowerCase();
    return matchType && (!s || c.name.toLowerCase().includes(s) || c.phone.includes(s) || c.email.toLowerCase().includes(s));
  });

  function exportCSV() {
    const cols = ['Name', 'Phone', 'Email', 'WhatsApp', 'Type', 'Orders', 'Total Spent', 'Last Order'];
    const rows = shown.map((c) => [c.name, c.phone, c.email, c.whatsapp, c.type, c.orders, c.total, new Date(c.last).toLocaleDateString()]);
    const esc = (v: any) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const csv = [cols.map(esc).join(','), ...rows.map((r) => r.map(esc).join(','))].join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    const a = document.createElement('a'); a.href = url; a.download = `koyan-customers-${new Date().toISOString().slice(0, 10)}.csv`; a.click(); URL.revokeObjectURL(url);
  }
  async function addCustomer() {
    if (!f.phone) return;
    await supabase.from('customers').insert(f);
    setF({ name: '', phone: '', email: '', whatsapp: '' }); setShowForm(false); invalidate();
  }

  const input = 'px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-emerald-500';

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div><h1 className="text-2xl font-bold text-gray-900">Customers</h1><p className="text-sm text-gray-500">{shown.length} customers</p></div>
        <div className="flex items-center gap-2">
          <button onClick={() => refetch()} className="w-10 h-10 flex items-center justify-center rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50" aria-label="Refresh"><RefreshCw size={16} /></button>
          <button onClick={exportCSV} className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-2 rounded-lg text-sm font-semibold"><Download size={14} />Export Excel</button>
          <button onClick={() => setShowForm((v) => !v)} className="flex items-center gap-1.5 border border-gray-200 text-gray-700 hover:bg-gray-50 px-3 py-2 rounded-lg text-sm font-semibold"><Plus size={14} />Add</button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3 mb-4">
        <div className="flex gap-1.5 p-1 bg-gray-100 rounded-full">
          {(['all', 'registered', 'guest'] as const).map((t) => (
            <button key={t} onClick={() => setType(t === 'all' ? null : t)} className={`px-3.5 py-1.5 rounded-full text-xs font-semibold capitalize ${(type ?? 'all') === t ? 'bg-emerald-600 text-white' : 'text-gray-600'}`}>{t}</button>
          ))}
        </div>
        <div className="relative flex-1 min-w-48">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input value={q ?? ''} onChange={(e) => setQ(e.target.value || null)} placeholder="Search name, phone, email…" className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-emerald-500" />
        </div>
      </div>

      {showForm && (
        <div className="bg-white rounded-lg border border-gray-200 p-5 mb-4">
          <div className="grid grid-cols-2 gap-3">
            <input value={f.name} onChange={(e) => setF((x) => ({ ...x, name: e.target.value }))} placeholder="Name" className={input} />
            <input value={f.phone} onChange={(e) => setF((x) => ({ ...x, phone: e.target.value }))} placeholder="Phone" className={input} />
            <input value={f.email} onChange={(e) => setF((x) => ({ ...x, email: e.target.value }))} placeholder="Email" className={input} />
            <input value={f.whatsapp} onChange={(e) => setF((x) => ({ ...x, whatsapp: e.target.value }))} placeholder="WhatsApp" className={input} />
          </div>
          <div className="flex gap-3 mt-3"><button onClick={() => setShowForm(false)} className="flex-1 py-2 border-2 border-gray-200 rounded-lg text-sm font-semibold text-gray-600">Cancel</button><button onClick={addCustomer} disabled={!f.phone} className="flex-1 bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-300 text-white py-2 rounded-lg text-sm font-semibold">Save</button></div>
        </div>
      )}

      <div className="bg-white rounded-lg border border-gray-200 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-500 text-xs">
            <tr>{['Customer', 'Phone', 'Email', 'Type', 'Orders', 'Total Spent'].map((h) => <th key={h} className="text-left px-4 py-2.5 font-semibold whitespace-nowrap">{h}</th>)}</tr>
          </thead>
          <tbody>
            {shown.length === 0 ? <tr><td colSpan={6} className="text-center text-gray-400 py-10">No customers yet.</td></tr> : shown.map((c) => (
              <tr key={c.key} className="border-t border-gray-50">
                <td className="px-4 py-2.5 font-semibold text-gray-900 whitespace-nowrap">{c.name || 'Unnamed'}</td>
                <td className="px-4 py-2.5 whitespace-nowrap">{c.phone || '—'}</td>
                <td className="px-4 py-2.5 whitespace-nowrap">{c.email || '—'}</td>
                <td className="px-4 py-2.5"><span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${c.type === 'registered' ? 'bg-emerald-100 text-emerald-700' : c.type === 'guest' ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-600'}`}>{c.type}</span></td>
                <td className="px-4 py-2.5">{c.orders}</td>
                <td className="px-4 py-2.5 font-semibold whitespace-nowrap">{fmt(c.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
