import { useQueryState } from 'nuqs';
import { RefreshCw } from 'lucide-react';
import { useAdminOrders, useAdminLivestock, useAdminOrderItems, useAdminSetting } from '../../hooks/adminQueries';

function fmt(n: number) {
  return new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 }).format(n);
}

export default function OverviewSection() {
  const { data: orders = [], isLoading, refetch } = useAdminOrders();
  const { data: livestock = [] } = useAdminLivestock();
  const { data: items = [] } = useAdminOrderItems();
  const { data: lowStockThreshold = '10' } = useAdminSetting('low_stock_threshold', '10');

  const [rangeStr, setRange] = useQueryState('range', { defaultValue: '30' });
  const rangeDays = Number(rangeStr) || 30;

  const lowThreshold = parseInt(lowStockThreshold) || 10;
  const lowStock = livestock.filter((l) => l.is_available && (l.available_kg <= lowThreshold || l.available_portions <= lowThreshold));
  const rangeStart = Date.now() - rangeDays * 24 * 60 * 60 * 1000;
  const rangeOrders = orders.filter((o) => new Date(o.created_at).getTime() >= rangeStart);
  const confirmedInRange = rangeOrders.filter((o) => o.payment_status === 'confirmed');
  const rangeRevenue = confirmedInRange.reduce((s, o) => s + o.total_amount, 0);
  const avgOrder = confirmedInRange.length ? rangeRevenue / confirmedInRange.length : 0;

  const dailyRevenue: { label: string; value: number }[] = (() => {
    const days = Math.min(rangeDays, 30);
    const arr: { label: string; value: number }[] = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - i);
      const next = d.getTime() + 24 * 60 * 60 * 1000;
      const val = orders.filter((o) => o.payment_status === 'confirmed' && new Date(o.created_at).getTime() >= d.getTime() && new Date(o.created_at).getTime() < next).reduce((s, o) => s + o.total_amount, 0);
      arr.push({ label: d.toLocaleDateString('en-NG', { day: 'numeric', month: 'short' }), value: val });
    }
    return arr;
  })();
  const maxDaily = Math.max(1, ...dailyRevenue.map((d) => d.value));

  const topProducts = (() => {
    const map = new Map<string, { name: string; qty: number; revenue: number }>();
    for (const it of items) {
      const e = map.get(it.livestock_name) ?? { name: it.livestock_name, qty: 0, revenue: 0 };
      e.qty += Number(it.quantity); e.revenue += Number(it.subtotal);
      map.set(it.livestock_name, e);
    }
    return [...map.values()].sort((a, b) => b.revenue - a.revenue).slice(0, 6);
  })();

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Overview</h1>
          <p className="text-sm text-gray-500">{isLoading ? 'Loading…' : `${rangeOrders.length} orders in range`}</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => refetch()} className="w-10 h-10 flex items-center justify-center rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50" aria-label="Refresh"><RefreshCw size={16} /></button>
          <select value={rangeStr} onChange={(e) => setRange(e.target.value === '30' ? null : e.target.value)} className="border border-gray-200 rounded-lg py-2 px-3 text-sm focus:outline-none focus:border-emerald-500">
            <option value="7">Last 7 days</option>
            <option value="30">Last 30 days</option>
            <option value="90">Last 90 days</option>
            <option value="3650">All time</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
        {[
          { label: 'Revenue', value: fmt(rangeRevenue) },
          { label: 'Orders', value: rangeOrders.length },
          { label: 'Avg order', value: fmt(avgOrder || 0) },
          { label: 'Low stock', value: lowStock.length },
        ].map(({ label, value }) => (
          <div key={label} className="bg-white rounded-lg border border-gray-100 p-4"><p className="text-xs text-gray-500">{label}</p><p className="text-xl font-bold mt-1 text-gray-900">{value}</p></div>
        ))}
      </div>

      <div className="bg-white rounded-lg border border-gray-100 p-5 mb-5">
        <p className="text-sm font-bold text-gray-900 mb-4">Revenue trend</p>
        <div className="flex items-end gap-1 h-40">
          {dailyRevenue.map((d, i) => (
            <div key={i} className="flex-1 flex flex-col items-center justify-end group" title={`${d.label}: ${fmt(d.value)}`}>
              <div className="w-full bg-emerald-500/80 hover:bg-emerald-600 rounded-t transition-all" style={{ height: `${(d.value / maxDaily) * 100}%`, minHeight: d.value > 0 ? 4 : 0 }} />
            </div>
          ))}
        </div>
        <div className="flex justify-between text-[10px] text-gray-400 mt-2"><span>{dailyRevenue[0]?.label}</span><span>{dailyRevenue[dailyRevenue.length - 1]?.label}</span></div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="bg-white rounded-lg border border-gray-100 p-5">
          <p className="text-sm font-bold text-gray-900 mb-3">Top products</p>
          {topProducts.length === 0 ? <p className="text-sm text-gray-400">No sales yet.</p> : topProducts.map((p) => (
            <div key={p.name} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
              <span className="text-sm text-gray-800">{p.name} <span className="text-gray-400">· {p.qty} sold</span></span>
              <span className="text-sm font-semibold text-gray-900">{fmt(p.revenue)}</span>
            </div>
          ))}
        </div>

        <div className="bg-white rounded-lg border border-gray-100 p-5">
          <p className="text-sm font-bold text-gray-900 mb-3 flex items-center gap-2">Low stock <span className="text-xs font-normal text-gray-400">(≤ {lowThreshold})</span></p>
          {lowStock.length === 0 ? <p className="text-sm text-gray-400">All items well stocked.</p> : lowStock.map((l) => (
            <div key={l.id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
              <span className="text-sm text-gray-800">{l.name}</span>
              <span className="text-xs text-amber-700 font-semibold">{l.available_kg}kg · {l.available_portions} portions</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
