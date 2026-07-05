import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight, SlidersHorizontal, Search, X, LayoutGrid, List } from 'lucide-react';
import { useQueryState } from 'nuqs';
import { availableUnits, priceForUnit, type Livestock } from '../lib/supabase';
import { useLivestock, useReviews, ratingFor, badgeFor } from '../hooks/queries';
import { useFavorites } from '../hooks/useFavorites';
import { useApp } from '../providers/AppProvider';
import LivestockCard from '../components/LivestockCard';

const TYPES = ['Cow', 'Ram', 'Goat', 'Chicken', 'Turkey', 'Pig'];

export default function ShopPage() {
  const { data: livestock = [], isLoading } = useLivestock();
  const { data: reviews = [] } = useReviews();
  const { favorites, toggleFavorite, canFavorite } = useFavorites();
  const { addToCart } = useApp();

  const [category, setCategory] = useQueryState('category', { defaultValue: 'All' });
  const [q, setQ] = useQueryState('q', { defaultValue: '' });
  const [sort, setSort] = useQueryState('sort', { defaultValue: 'featured' });
  const [stock, setStock] = useQueryState('stock', { defaultValue: '' });
  const [min, setMin] = useQueryState('min', { defaultValue: '' });
  const [max, setMax] = useQueryState('max', { defaultValue: '' });
  const [view, setView] = useQueryState('view', { defaultValue: 'grid' });
  const [page, setPage] = useQueryState('page', { defaultValue: '1' });
  const [filtersOpen, setFiltersOpen] = useState(false);
  const isList = view === 'list';

  const priceOf = (l: Livestock) => { const u = availableUnits(l)[0]; return u ? priceForUnit(l, u) : l.price_per_kg; };
  const inStock = (l: Livestock) => (l.available_kg ?? 0) > 0 || (l.available_portions ?? 0) > 0;
  const inStockOnly = stock === '1';
  const minN = min ? Number(min) : 0;
  const maxN = max ? Number(max) : Infinity;

  const counts: Record<string, number> = { All: livestock.length };
  for (const t of TYPES) counts[t] = livestock.filter((l) => l.type === t).length;

  const prices = livestock.map(priceOf).filter((p) => p > 0);
  const priceCeiling = prices.length ? Math.ceil(Math.max(...prices) / 1000) * 1000 : 100000;
  const hist = Array.from({ length: 18 }, (_, i) => { const lo = (priceCeiling / 18) * i, hi = lo + priceCeiling / 18; return prices.filter((p) => p >= lo && p < hi).length; });
  const histMax = Math.max(1, ...hist);

  const filtered = livestock
    .filter((l) => {
      const p = priceOf(l);
      return ((category || 'All') === 'All' || l.type === category)
        && (!q || l.name.toLowerCase().includes(q.toLowerCase()) || l.type.toLowerCase().includes(q.toLowerCase()))
        && (!inStockOnly || inStock(l))
        && p >= minN && p <= maxN;
    })
    .sort((a, b) => sort === 'price_asc' ? priceOf(a) - priceOf(b) : sort === 'price_desc' ? priceOf(b) - priceOf(a) : 0);

  // Pagination — keeps the grid manageable as the catalog grows.
  const PAGE_SIZE = 12;
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(Math.max(1, parseInt(page || '1', 10) || 1), totalPages);
  const pageItems = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);
  const goToPage = (p: number) => { setPage(p <= 1 ? null : String(p)); window.scrollTo({ top: 0, behavior: 'smooth' }); };

  // Reset to page 1 whenever the filter/sort criteria change (skip first render
  // so a shared /shop?page=N deep link is preserved).
  const firstRun = useRef(true);
  useEffect(() => {
    if (firstRun.current) { firstRun.current = false; return; }
    setPage(null);
  }, [category, q, sort, stock, min, max]);

  const clearAll = () => { setCategory(null); setQ(null); setStock(null); setMin(null); setMax(null); };

  const Sidebar = (
    <div className="bg-paper rounded-lg border border-forest-700/10 p-5 space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="font-bold text-forest-900 flex items-center gap-2"><SlidersHorizontal size={16} />Filter</h3>
        <button onClick={clearAll} className="text-xs font-semibold text-forest-600 hover:underline">Clear all</button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-forest-800/40" />
        <input type="text" placeholder="Search..." value={q ?? ''} onChange={(e) => setQ(e.target.value || null)} className="w-full pl-9 pr-3 py-2 bg-cream border border-forest-700/10 rounded-lg text-sm focus:outline-none focus:border-forest-400" />
      </div>

      {/* Category */}
      <div>
        <p className="text-sm font-semibold text-forest-800 mb-2">Category</p>
        <div className="space-y-1">
          {['All', ...TYPES].map((t) => (
            <button key={t} onClick={() => setCategory(t === 'All' ? null : t)} className={`w-full flex items-center justify-between px-2 py-1.5 rounded-lg text-sm transition-colors ${(category || 'All') === t ? 'bg-forest-50 text-forest-800 font-semibold' : 'text-forest-800/70 hover:bg-forest-50/60'}`}>
              <span>{t}</span>
              <span className="text-xs text-forest-800/40">{counts[t] ?? 0}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Price */}
      <div>
        <p className="text-sm font-semibold text-forest-800 mb-2">Price (₦)</p>
        <div className="flex items-end gap-0.5 h-12 mb-1">
          {hist.map((h, i) => <div key={i} className="flex-1 bg-forest-200 rounded-t" style={{ height: `${(h / histMax) * 100}%`, minHeight: 2 }} />)}
        </div>
        <input type="range" min={0} max={priceCeiling} step={1000} value={max ? Number(max) : priceCeiling} onChange={(e) => setMax(Number(e.target.value) >= priceCeiling ? null : e.target.value)} className="w-full accent-forest-700" />
        <div className="flex items-center gap-2 mt-2">
          <input type="number" placeholder="Min" value={min ?? ''} onChange={(e) => setMin(e.target.value || null)} className="w-full px-2.5 py-2 bg-cream border border-forest-700/10 rounded-lg text-sm focus:outline-none focus:border-forest-400" />
          <span className="text-forest-800/30">—</span>
          <input type="number" placeholder="Max" value={max ?? ''} onChange={(e) => setMax(e.target.value || null)} className="w-full px-2.5 py-2 bg-cream border border-forest-700/10 rounded-lg text-sm focus:outline-none focus:border-forest-400" />
        </div>
      </div>

      {/* Availability */}
      <div>
        <p className="text-sm font-semibold text-forest-800 mb-2">Availability</p>
        <label className="flex items-center gap-2 text-sm text-forest-800/70 cursor-pointer">
          <input type="checkbox" checked={inStockOnly} onChange={(e) => setStock(e.target.checked ? '1' : null)} className="accent-forest-700 w-4 h-4" />
          In stock only
        </label>
      </div>
    </div>
  );

  return (
    <div className="bg-cream min-h-screen">
      <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <nav className="flex items-center gap-1.5 text-sm text-forest-800/50 mb-1">
          <Link to="/" className="hover:text-forest-700">Home</Link><ChevronRight size={13} /><span className="text-forest-800">Shop</span>
        </nav>
        <h1 className="text-2xl font-bold text-forest-900"><span className="accent text-forest-600">{filtered.length}</span> results for livestock</h1>

        <div className="mt-6 grid lg:grid-cols-[260px_1fr] gap-6 lg:gap-8">
          {/* Sidebar (desktop) */}
          <aside className="hidden lg:block"><div className="sticky top-24">{Sidebar}</div></aside>

          <div>
            {/* Top bar */}
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-2">
                <button onClick={() => setFiltersOpen(true)} className="lg:hidden flex items-center gap-2 px-4 py-2 bg-paper border border-forest-700/10 rounded-full text-sm font-semibold text-forest-800"><SlidersHorizontal size={15} />Filters</button>
                <div className="hidden sm:flex items-center gap-1 bg-paper border border-forest-700/10 rounded-full p-1">
                  <button onClick={() => setView('list')} aria-label="List view" className={`w-8 h-8 flex items-center justify-center rounded-full ${isList ? 'bg-forest-700 text-cream' : 'text-forest-800/50 hover:text-forest-800'}`}><List size={16} /></button>
                  <button onClick={() => setView(null)} aria-label="Grid view" className={`w-8 h-8 flex items-center justify-center rounded-full ${!isList ? 'bg-forest-700 text-cream' : 'text-forest-800/50 hover:text-forest-800'}`}><LayoutGrid size={16} /></button>
                </div>
              </div>
              <div className="flex items-center gap-2 bg-paper border border-forest-700/10 rounded-full px-3 py-1.5">
                <span className="text-sm text-forest-800/50">Sort by:</span>
                <select value={sort ?? 'featured'} onChange={(e) => setSort(e.target.value === 'featured' ? null : e.target.value)} className="text-sm font-semibold text-forest-800 bg-transparent focus:outline-none">
                  <option value="featured">Popular</option>
                  <option value="price_asc">Price: Low to High</option>
                  <option value="price_desc">Price: High to Low</option>
                </select>
              </div>
            </div>

            {isLoading ? (
              <div className="grid grid-cols-2 lg:grid-cols-3 gap-x-5 gap-y-8">
                {[...Array(6)].map((_, i) => <div key={i} className="animate-pulse"><div className="aspect-[4/3] bg-sand rounded-lg" /><div className="pt-3 space-y-2"><div className="h-3 bg-sand rounded-sm w-1/3" /><div className="h-4 bg-sand rounded-sm w-3/4" /></div></div>)}
              </div>
            ) : filtered.length === 0 ? (
              <div className="text-center py-20 bg-paper rounded-lg border border-forest-700/10">
                <p className="text-forest-800/50 text-lg">No livestock match your filters.</p>
                <button onClick={clearAll} className="mt-3 text-forest-700 font-semibold">Clear filters</button>
              </div>
            ) : (
              <>
              <div className={isList ? 'space-y-4' : 'grid grid-cols-2 lg:grid-cols-3 gap-x-5 gap-y-8'}>
                {pageItems.map((l) => { const r = ratingFor(reviews, l.id); return <LivestockCard key={l.id} livestock={l} layout={isList ? 'list' : 'grid'} onQuickAdd={addToCart} isFavorite={favorites.has(l.id)} canFavorite={canFavorite} onToggleFavorite={toggleFavorite} avgRating={r.avg} reviewCount={r.count} badge={badgeFor(l, r.count, r.avg)} />; })}
              </div>
              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-1.5 mt-10">
                  <button onClick={() => goToPage(currentPage - 1)} disabled={currentPage === 1} className="px-3 h-9 flex items-center rounded-full text-sm font-semibold text-forest-800 disabled:opacity-30 hover:bg-paper">Prev</button>
                  {Array.from({ length: totalPages }, (_, i) => i + 1)
                    .filter((p) => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 1)
                    .map((p, idx, arr) => (
                      <span key={p} className="flex items-center">
                        {idx > 0 && p - arr[idx - 1] > 1 && <span className="px-1 text-forest-800/40">…</span>}
                        <button onClick={() => goToPage(p)} className={`w-9 h-9 rounded-full text-sm font-semibold ${p === currentPage ? 'bg-forest-700 text-cream' : 'text-forest-800 hover:bg-paper'}`}>{p}</button>
                      </span>
                    ))}
                  <button onClick={() => goToPage(currentPage + 1)} disabled={currentPage === totalPages} className="px-3 h-9 flex items-center rounded-full text-sm font-semibold text-forest-800 disabled:opacity-30 hover:bg-paper">Next</button>
                </div>
              )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Mobile filter drawer */}
      {filtersOpen && (
        <div className="lg:hidden fixed inset-0 z-50">
          <div className="absolute inset-0 bg-forest-900/40" onClick={() => setFiltersOpen(false)} />
          <div className="absolute left-0 top-0 h-full w-[85%] max-w-sm bg-cream overflow-y-auto p-4">
            <div className="flex justify-end mb-2"><button onClick={() => setFiltersOpen(false)} className="w-9 h-9 flex items-center justify-center rounded-full bg-paper text-forest-800/60"><X size={20} /></button></div>
            {Sidebar}
            <button onClick={() => setFiltersOpen(false)} className="btn-primary w-full mt-4">Show {filtered.length} results</button>
          </div>
        </div>
      )}
    </div>
  );
}
