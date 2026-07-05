import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { MapPin, Calendar, Building2, Plus, Pencil, Trash2 } from 'lucide-react';
import { supabase, type DeliveryLocation, type BankAccount } from '../../lib/supabase';
import { useAdminLocations, useAdminSlots, useAdminBanks } from '../../hooks/adminQueries';

function fmt(n: number) {
  return new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 }).format(n);
}

export default function LogisticsSection() {
  const qc = useQueryClient();
  const invalidate = () => qc.invalidateQueries({ queryKey: ['admin'] });
  const { data: deliveryLocations = [] } = useAdminLocations();
  const { data: deliverySlots = [] } = useAdminSlots();
  const { data: bankAccounts = [] } = useAdminBanks();

  const [locForm, setLocForm] = useState({ name: '', fee: '' });
  const [editingLoc, setEditingLoc] = useState<DeliveryLocation | null>(null);
  const [showSlotForm, setShowSlotForm] = useState(false);
  const [slotForm, setSlotForm] = useState({ slot_date: '', slot_label: 'Morning (8am - 12pm)', max_orders: '10' });
  const [showBankForm, setShowBankForm] = useState(false);
  const [editingBank, setEditingBank] = useState<BankAccount | null>(null);
  const [bankForm, setBankForm] = useState({ bank_name: '', account_name: '', account_number: '', sort_code: '' });

  async function saveLocation() {
    if (!locForm.name.trim()) return;
    const payload = { name: locForm.name.trim(), fee: parseFloat(locForm.fee) || 0, is_active: true };
    if (editingLoc) await supabase.from('delivery_locations').update(payload).eq('id', editingLoc.id);
    else await supabase.from('delivery_locations').insert(payload);
    setLocForm({ name: '', fee: '' }); setEditingLoc(null); invalidate();
  }
  async function deleteLocation(id: string) { if (confirm('Remove location?')) { await supabase.from('delivery_locations').delete().eq('id', id); invalidate(); } }

  async function saveSlot() {
    await supabase.from('delivery_slots').insert({ slot_date: slotForm.slot_date, slot_label: slotForm.slot_label, max_orders: parseInt(slotForm.max_orders) || 10 });
    setShowSlotForm(false); invalidate();
  }
  async function deleteSlot(id: string) { if (confirm('Remove slot?')) { await supabase.from('delivery_slots').delete().eq('id', id); invalidate(); } }

  async function saveBank() {
    const payload = { ...bankForm, is_active: true };
    if (editingBank) await supabase.from('bank_accounts').update(payload).eq('id', editingBank.id);
    else await supabase.from('bank_accounts').insert(payload);
    setShowBankForm(false); invalidate();
  }
  async function deleteBank(id: string) { if (confirm('Remove account?')) { await supabase.from('bank_accounts').delete().eq('id', id); invalidate(); } }

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-8">
      <h1 className="text-2xl font-bold text-gray-900">Logistics</h1>

      {/* Delivery locations */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2"><MapPin size={18} />Delivery Locations & Fees</h2>
        </div>
        <div className="bg-white rounded-lg border border-gray-100 p-5 space-y-3">
          <div className="flex gap-2">
            <input type="text" placeholder="Location name" value={locForm.name} onChange={(e) => setLocForm((f) => ({ ...f, name: e.target.value }))} className="flex-1 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-emerald-500" />
            <input type="number" placeholder="Fee" value={locForm.fee} onChange={(e) => setLocForm((f) => ({ ...f, fee: e.target.value }))} className="w-32 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-emerald-500" />
            <button onClick={saveLocation} className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-sm font-semibold">{editingLoc ? 'Update' : 'Add'}</button>
          </div>
          {deliveryLocations.map((loc) => (
            <div key={loc.id} className="flex items-center justify-between border border-gray-100 rounded-lg px-3 py-2">
              <span className="text-sm text-gray-900">{loc.name} <span className="text-gray-500">· {fmt(loc.fee)}</span></span>
              <div className="flex items-center gap-1">
                <button onClick={() => { setEditingLoc(loc); setLocForm({ name: loc.name, fee: String(loc.fee) }); }} className="p-1.5 text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg"><Pencil size={13} /></button>
                <button onClick={() => deleteLocation(loc.id)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg"><Trash2 size={13} /></button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Delivery slots */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2"><Calendar size={18} />Delivery Slots</h2>
          <button onClick={() => { setSlotForm({ slot_date: '', slot_label: 'Morning (8am - 12pm)', max_orders: '10' }); setShowSlotForm(true); }} className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-sm font-semibold"><Plus size={16} />Add Slot</button>
        </div>
        {showSlotForm && (
          <div className="bg-white rounded-lg border border-gray-100 p-5 mb-4 grid grid-cols-3 gap-3">
            <input type="date" value={slotForm.slot_date} onChange={(e) => setSlotForm((f) => ({ ...f, slot_date: e.target.value }))} min={new Date().toISOString().split('T')[0]} className="px-3 py-2 border border-gray-200 rounded-lg text-sm" />
            <select value={slotForm.slot_label} onChange={(e) => setSlotForm((f) => ({ ...f, slot_label: e.target.value }))} className="px-3 py-2 border border-gray-200 rounded-lg text-sm"><option>Morning (8am - 12pm)</option><option>Afternoon (12pm - 5pm)</option><option>Evening (5pm - 9pm)</option></select>
            <div className="flex gap-2"><input type="number" value={slotForm.max_orders} onChange={(e) => setSlotForm((f) => ({ ...f, max_orders: e.target.value }))} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm" /><button onClick={saveSlot} disabled={!slotForm.slot_date} className="bg-emerald-600 text-white px-3 rounded-lg text-sm font-semibold">Add</button></div>
          </div>
        )}
        <div className="space-y-2">
          {deliverySlots.map((s) => (
            <div key={s.id} className="bg-white rounded-lg border border-gray-100 p-3 flex items-center justify-between">
              <div><p className="text-sm font-semibold text-gray-900">{new Date(s.slot_date + 'T12:00:00').toLocaleDateString('en-NG', { weekday: 'short', month: 'short', day: 'numeric' })}</p><p className="text-xs text-gray-500">{s.slot_label}</p></div>
              <div className="flex items-center gap-3"><span className="text-xs text-gray-500">{s.current_orders}/{s.max_orders}</span><button onClick={() => deleteSlot(s.id)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg"><Trash2 size={14} /></button></div>
            </div>
          ))}
        </div>
      </div>

      {/* Bank accounts */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2"><Building2 size={18} />Bank Accounts</h2>
          <button onClick={() => { setEditingBank(null); setBankForm({ bank_name: '', account_name: '', account_number: '', sort_code: '' }); setShowBankForm(true); }} className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-sm font-semibold"><Plus size={16} />Add</button>
        </div>
        {showBankForm && (
          <div className="bg-white rounded-lg border border-gray-100 p-5 mb-4 grid grid-cols-2 gap-3">
            <input type="text" value={bankForm.bank_name} onChange={(e) => setBankForm((f) => ({ ...f, bank_name: e.target.value }))} placeholder="Bank Name" className="px-3 py-2 border border-gray-200 rounded-lg text-sm" />
            <input type="text" value={bankForm.account_name} onChange={(e) => setBankForm((f) => ({ ...f, account_name: e.target.value }))} placeholder="Account Name" className="px-3 py-2 border border-gray-200 rounded-lg text-sm" />
            <input type="text" value={bankForm.account_number} onChange={(e) => setBankForm((f) => ({ ...f, account_number: e.target.value }))} placeholder="Account Number" className="px-3 py-2 border border-gray-200 rounded-lg text-sm" />
            <input type="text" value={bankForm.sort_code} onChange={(e) => setBankForm((f) => ({ ...f, sort_code: e.target.value }))} placeholder="Sort Code" className="px-3 py-2 border border-gray-200 rounded-lg text-sm" />
            <div className="col-span-2 flex gap-3"><button onClick={() => setShowBankForm(false)} className="flex-1 py-2 border-2 border-gray-200 rounded-lg text-sm font-semibold text-gray-600">Cancel</button><button onClick={saveBank} disabled={!bankForm.bank_name || !bankForm.account_number} className="flex-1 bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-300 text-white py-2 rounded-lg text-sm font-semibold">Save</button></div>
          </div>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {bankAccounts.map((b) => (
            <div key={b.id} className="bg-white rounded-lg border border-gray-100 p-4 flex items-start justify-between">
              <div><p className="text-xs font-bold text-gray-500 uppercase">{b.bank_name}</p><p className="font-semibold text-gray-900 mt-1">{b.account_name}</p><p className="text-lg font-bold text-gray-900 tracking-widest">{b.account_number}</p></div>
              <button onClick={() => deleteBank(b.id)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg"><Trash2 size={14} /></button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
