import { useState, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useQueryState } from 'nuqs';
import { Plus, Pencil, Trash2, RefreshCw, Upload, X, Search, CircleCheck as CheckCircle2 } from 'lucide-react';
import { supabase, type Livestock } from '../../lib/supabase';
import { useAdminLivestock, useAdminSetting } from '../../hooks/adminQueries';

const LIVESTOCK_TYPES = ['Cow', 'Ram', 'Goat', 'Chicken', 'Turkey', 'Pig', 'Other'];

type PrepPrice = { name: string; price: string };
type LForm = {
  name: string; type: string; description: string; price_per_kg: string; price_per_portion: string;
  price_full: string; price_half: string; price_quarter: string; available_kg: string; available_portions: string;
  unit_options: string[]; image_url: string; logo_url: string; prep: PrepPrice[];
};
const empty: LForm = { name: '', type: 'Cow', description: '', price_per_kg: '', price_per_portion: '', price_full: '', price_half: '', price_quarter: '', available_kg: '0', available_portions: '0', unit_options: ['kg', 'portion'], image_url: '', logo_url: '', prep: [] };

function fmt(n: number) {
  return new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 }).format(n);
}

export default function LivestockSection() {
  const qc = useQueryClient();
  const { data: livestock = [], refetch } = useAdminLivestock();
  const { data: threshold = '10' } = useAdminSetting('low_stock_threshold', '10');
  const low = parseInt(threshold) || 10;
  const invalidate = () => qc.invalidateQueries({ queryKey: ['admin'] });

  const [q, setQ] = useQueryState('q', { defaultValue: '' });
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Livestock | null>(null);
  const [form, setForm] = useState<LForm>(empty);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [restockId, setRestockId] = useState<string | null>(null);
  const [rKg, setRKg] = useState('');
  const [rP, setRP] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const filtered = livestock.filter((l) => !q || l.name.toLowerCase().includes(q.toLowerCase()) || l.type.toLowerCase().includes(q.toLowerCase()));

  async function upload(file: File) {
    setUploading(true);
    const ext = file.name.split('.').pop();
    const path = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const { error } = await supabase.storage.from('livestock-images').upload(path, file, { cacheControl: '3600', upsert: false });
    if (error) { alert('Upload failed: ' + error.message); setUploading(false); return; }
    const { data } = supabase.storage.from('livestock-images').getPublicUrl(path);
    setForm((f) => ({ ...f, image_url: data.publicUrl }));
    setUploading(false);
  }

  function openAdd() { setEditing(null); setForm(empty); setShowForm(true); }
  function openEdit(l: Livestock) {
    setEditing(l);
    setForm({
      name: l.name, type: l.type, description: l.description,
      price_per_kg: String(l.price_per_kg), price_per_portion: l.price_per_portion ? String(l.price_per_portion) : '',
      price_full: l.price_full ? String(l.price_full) : '', price_half: l.price_half ? String(l.price_half) : '', price_quarter: l.price_quarter ? String(l.price_quarter) : '',
      available_kg: String(l.available_kg), available_portions: String(l.available_portions),
      unit_options: l.unit_options ?? ['kg', 'portion'], image_url: l.image_url, logo_url: l.logo_url ?? '',
      prep: Object.entries(l.preparation_prices ?? {}).map(([name, price]) => ({ name, price: String(price) })),
    });
    setShowForm(true);
  }
  async function save() {
    setSaving(true);
    const prepObj: Record<string, number> = {};
    for (const p of form.prep) if (p.name.trim()) prepObj[p.name.trim()] = parseFloat(p.price) || 0;
    const payload = {
      name: form.name, type: form.type, description: form.description,
      price_per_kg: parseFloat(form.price_per_kg) || 0,
      price_per_portion: form.price_per_portion ? parseFloat(form.price_per_portion) : null,
      price_full: form.price_full ? parseFloat(form.price_full) : null,
      price_half: form.price_half ? parseFloat(form.price_half) : null,
      price_quarter: form.price_quarter ? parseFloat(form.price_quarter) : null,
      available_kg: parseFloat(form.available_kg) || 0, available_portions: parseInt(form.available_portions) || 0,
      unit_options: form.unit_options, image_url: form.image_url, logo_url: form.logo_url || null, preparation_prices: prepObj, is_available: true,
    };
    if (editing) await supabase.from('livestock').update(payload).eq('id', editing.id);
    else await supabase.from('livestock').insert(payload);
    setSaving(false); setShowForm(false); invalidate();
  }
  async function remove(id: string) { if (confirm('Remove this livestock?')) { await supabase.from('livestock').update({ is_available: false }).eq('id', id); invalidate(); } }
  async function toggle(l: Livestock) { await supabase.from('livestock').update({ is_available: !l.is_available }).eq('id', l.id); invalidate(); }
  async function saveRestock(l: Livestock) {
    await supabase.from('livestock').update({ available_kg: rKg === '' ? l.available_kg : parseFloat(rKg), available_portions: rP === '' ? l.available_portions : parseInt(rP) }).eq('id', l.id);
    setRestockId(null); setRKg(''); setRP(''); invalidate();
  }

  const input = 'w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-emerald-500';

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Livestock</h1>
          <p className="text-sm text-gray-500">{filtered.length} items · {livestock.filter((l) => l.is_available && (l.available_kg <= low || l.available_portions <= low)).length} low on stock</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input value={q ?? ''} onChange={(e) => setQ(e.target.value || null)} placeholder="Search…" className="pl-8 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-emerald-500" />
          </div>
          <button onClick={() => refetch()} className="w-10 h-10 flex items-center justify-center rounded-lg border border-gray-200 text-gray-500 hover:bg-gray-50" aria-label="Refresh"><RefreshCw size={16} /></button>
          <button onClick={openAdd} className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-2 rounded-lg text-sm font-semibold"><Plus size={15} />Add</button>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((l) => {
          const isLow = l.available_kg <= low || l.available_portions <= low;
          return (
            <div key={l.id} className={`bg-white rounded-lg border overflow-hidden ${l.is_available ? 'border-gray-200' : 'border-gray-200 opacity-60'}`}>
              <div className="relative h-36 overflow-hidden bg-gray-100">
                <img src={l.image_url || 'https://images.pexels.com/photos/735968/pexels-photo-735968.jpeg'} alt={l.name} className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).src = 'https://images.pexels.com/photos/735968/pexels-photo-735968.jpeg'; }} />
                <span className={`absolute top-2 right-2 text-xs px-2 py-1 rounded-full font-medium ${l.is_available ? 'bg-green-500 text-white' : 'bg-gray-500 text-white'}`}>{l.is_available ? 'Active' : 'Inactive'}</span>
              </div>
              <div className="p-4">
                <div className="flex items-start justify-between">
                  <div><h3 className="font-bold text-gray-900">{l.name}</h3><p className="text-xs text-gray-500">{l.type}</p></div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => openEdit(l)} className="p-1.5 text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg"><Pencil size={14} /></button>
                    <button onClick={() => toggle(l)} className="p-1.5 text-gray-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg"><RefreshCw size={14} /></button>
                    <button onClick={() => remove(l.id)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg"><Trash2 size={14} /></button>
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
                <div className="mt-2 flex items-center gap-2 text-xs">
                  <span className={`font-semibold ${isLow ? 'text-amber-700' : 'text-gray-500'}`}>{l.available_kg}kg · {l.available_portions} portions</span>
                  {isLow && <span className="bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full text-[10px] font-semibold">Low</span>}
                  <button onClick={() => { setRestockId(restockId === l.id ? null : l.id); setRKg(String(l.available_kg)); setRP(String(l.available_portions)); }} className="ml-auto text-emerald-700 font-semibold hover:underline">Restock</button>
                </div>
                {restockId === l.id && (
                  <div className="mt-2 flex items-center gap-2">
                    <input type="number" value={rKg} onChange={(e) => setRKg(e.target.value)} placeholder="kg" className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-xs" />
                    <input type="number" value={rP} onChange={(e) => setRP(e.target.value)} placeholder="portions" className="w-full px-2 py-1.5 border border-gray-200 rounded-lg text-xs" />
                    <button onClick={() => saveRestock(l)} className="bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 rounded-lg text-xs font-semibold">Save</button>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowForm(false)} />
          <div className="relative bg-white rounded-lg max-w-lg w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b border-gray-100 px-5 py-4 flex items-center justify-between z-10">
              <h3 className="text-lg font-bold text-gray-900">{editing ? 'Edit Livestock' : 'Add Livestock'}</h3>
              <button onClick={() => setShowForm(false)} className="p-2 text-gray-400 hover:bg-gray-100 rounded-lg"><X size={18} /></button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Image</label>
                {form.image_url ? (
                  <div className="relative rounded-lg overflow-hidden">
                    <img src={form.image_url} alt="" className="w-full h-44 object-cover" />
                    <button onClick={() => setForm((f) => ({ ...f, image_url: '' }))} className="absolute top-2 right-2 bg-white text-gray-900 px-3 py-1.5 rounded-lg text-sm font-medium"><X size={14} className="inline" /> Remove</button>
                  </div>
                ) : (
                  <div onClick={() => fileRef.current?.click()} className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center cursor-pointer hover:border-emerald-400">
                    {uploading ? <div className="flex flex-col items-center gap-2"><div className="w-8 h-8 border-3 border-emerald-400 border-t-transparent rounded-full animate-spin" /><p className="text-sm text-gray-500">Uploading…</p></div> : <><Upload size={30} className="mx-auto text-gray-300 mb-2" /><p className="text-sm font-medium text-gray-600">Click to upload</p></>}
                  </div>
                )}
                <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) upload(f); }} />
                <input type="text" placeholder="Or paste image URL" value={form.image_url} onChange={(e) => setForm((f) => ({ ...f, image_url: e.target.value }))} className={`${input} mt-2`} />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-sm font-semibold text-gray-700 mb-1">Name</label><input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} className={input} /></div>
                <div><label className="block text-sm font-semibold text-gray-700 mb-1">Type</label><select value={form.type} onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))} className={input}>{LIVESTOCK_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}</select></div>
              </div>
              <div><label className="block text-sm font-semibold text-gray-700 mb-1">Description</label><textarea value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} rows={2} className={`${input} resize-none`} /></div>
              <div>
                <p className="text-sm font-semibold text-gray-700 mb-2">Unit prices (blank disables a unit)</p>
                <div className="grid grid-cols-3 gap-3">
                  {[{ k: 'price_per_kg', label: 'Per KG' }, { k: 'price_per_portion', label: 'Per Portion' }, { k: 'price_full', label: 'Full' }, { k: 'price_half', label: 'Half' }, { k: 'price_quarter', label: 'Quarter' }].map(({ k, label }) => (
                    <div key={k}><label className="block text-xs font-semibold text-gray-600 mb-1">{label}</label><input type="number" value={(form as any)[k]} onChange={(e) => setForm((f) => ({ ...f, [k]: e.target.value }))} className={input} /></div>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-sm font-semibold text-gray-700 mb-1">Available KG</label><input type="number" value={form.available_kg} onChange={(e) => setForm((f) => ({ ...f, available_kg: e.target.value }))} className={input} /></div>
                <div><label className="block text-sm font-semibold text-gray-700 mb-1">Available Portions</label><input type="number" value={form.available_portions} onChange={(e) => setForm((f) => ({ ...f, available_portions: e.target.value }))} className={input} /></div>
              </div>
              <div>
                <div className="flex items-center justify-between mb-2"><label className="text-sm font-semibold text-gray-700">Preparation types & prices</label><button onClick={() => setForm((f) => ({ ...f, prep: [...f.prep, { name: '', price: '' }] }))} className="text-xs text-emerald-600 font-semibold flex items-center gap-1"><Plus size={12} />Add</button></div>
                <div className="space-y-2">
                  {form.prep.map((p, i) => (
                    <div key={i} className="flex gap-2">
                      <input placeholder="e.g. Roasted" value={p.name} onChange={(e) => setForm((f) => ({ ...f, prep: f.prep.map((x, j) => j === i ? { ...x, name: e.target.value } : x) }))} className={`${input} flex-1`} />
                      <input type="number" placeholder="Surcharge" value={p.price} onChange={(e) => setForm((f) => ({ ...f, prep: f.prep.map((x, j) => j === i ? { ...x, price: e.target.value } : x) }))} className={`${input} w-28`} />
                      <button onClick={() => setForm((f) => ({ ...f, prep: f.prep.filter((_, j) => j !== i) }))} className="p-2 text-gray-400 hover:text-red-600"><Trash2 size={14} /></button>
                    </div>
                  ))}
                  {form.prep.length === 0 && <p className="text-xs text-gray-400">Add e.g. Fresh (0), Roasted (5000).</p>}
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button onClick={() => setShowForm(false)} className="flex-1 py-2.5 border-2 border-gray-200 rounded-lg text-sm font-semibold text-gray-600">Cancel</button>
                <button onClick={save} disabled={saving || !form.name || !form.price_per_kg} className="flex-1 flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-300 text-white py-2.5 rounded-lg text-sm font-semibold">{saving ? <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> : <CheckCircle2 size={16} />}{editing ? 'Save' : 'Add'}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
