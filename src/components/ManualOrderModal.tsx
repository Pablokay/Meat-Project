import { useState, useEffect } from 'react';
import { X, Plus, Trash2, CircleCheck as CheckCircle2 } from 'lucide-react';
import { supabase, availableUnits, priceForUnit, UNIT_LABELS, type Livestock, type DeliveryLocation, type Order, type Unit } from '../lib/supabase';

type Line = { key: string; livestock_id: string; unit: Unit; quantity: number; prepTypes: string[] };

type ManualOrderModalProps = {
  mode: 'create' | 'edit';
  order?: Order | null;
  livestock: Livestock[];
  locations: DeliveryLocation[];
  onClose: () => void;
  onSaved: () => void;
};

const STATUSES = ['pending', 'awaiting_confirmation', 'awaiting_payment', 'confirmed', 'processing', 'ready', 'in_transit', 'delivered', 'cancelled'];
const PAY_STATUSES = ['pending', 'confirmed', 'failed'];

function fmt(n: number) {
  return new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 }).format(n);
}

export default function ManualOrderModal({ mode, order, livestock, locations, onClose, onSaved }: ManualOrderModalProps) {
  const avail = livestock.filter((l) => l.is_available || (order && l.id === order.livestock_id));
  const [name, setName] = useState(order?.customer_name ?? '');
  const [phone, setPhone] = useState(order?.customer_phone ?? '');
  const [email, setEmail] = useState(order?.customer_email ?? '');
  const [whatsapp, setWhatsapp] = useState(order?.customer_whatsapp ?? '');
  const [fulfillment, setFulfillment] = useState<'pickup' | 'delivery'>((order?.fulfillment_type as any) ?? 'pickup');
  const [locationId, setLocationId] = useState(order?.delivery_location_id ?? '');
  const [address, setAddress] = useState(order?.delivery_address ?? '');
  const [pickupTime, setPickupTime] = useState(order?.pickup_time ?? '');
  const [paymentMethod, setPaymentMethod] = useState(order?.payment_method ?? 'bank_transfer');
  const [paymentStatus, setPaymentStatus] = useState(order?.payment_status ?? 'pending');
  const [orderStatus, setOrderStatus] = useState(order?.order_status ?? 'pending');
  const [notes, setNotes] = useState(order?.notes ?? '');
  const [lines, setLines] = useState<Line[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (mode === 'edit' && order) {
      supabase.from('order_items').select('*').eq('order_id', order.id).then(({ data }) => {
        const rows = (data ?? []).map((it) => ({ key: it.id, livestock_id: it.livestock_id ?? '', unit: it.unit as Unit, quantity: Number(it.quantity), prepTypes: it.preparation_types ?? [] }));
        setLines(rows.length ? rows : [newLine()]);
      });
    } else {
      setLines([newLine()]);
    }
  }, []);

  function newLine(): Line {
    const first = avail[0];
    const unit = first ? (availableUnits(first)[0] ?? 'kg') : 'kg';
    return { key: `l_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`, livestock_id: first?.id ?? '', unit, quantity: 1, prepTypes: [] };
  }

  function lineCalc(l: Line) {
    const lv = livestock.find((x) => x.id === l.livestock_id);
    if (!lv) return { lv: null as Livestock | null, unitPrice: 0, subtotal: 0, name: '', image: '' };
    const base = priceForUnit(lv, l.unit);
    const surcharge = l.prepTypes.reduce((s, p) => s + (Number(lv.preparation_prices?.[p]) || 0), 0);
    const unitPrice = base + surcharge;
    return { lv, unitPrice, subtotal: unitPrice * l.quantity, name: lv.name, image: lv.image_url };
  }

  const subtotal = lines.reduce((s, l) => s + lineCalc(l).subtotal, 0);
  const location = locations.find((x) => x.id === locationId) ?? null;
  const deliveryFee = fulfillment === 'delivery' ? (location?.fee ?? 0) : 0;
  const total = subtotal + deliveryFee;

  function updateLine(key: string, patch: Partial<Line>) {
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  }

  async function save() {
    if (!name.trim() || !phone.trim()) { setError('Name and phone are required'); return; }
    if (lines.length === 0 || lines.some((l) => !l.livestock_id)) { setError('Add at least one valid item'); return; }
    setSaving(true);
    const first = lines[0];
    const firstCalc = lineCalc(first);
    const header = {
      customer_name: name, customer_email: email || '', customer_phone: phone, customer_whatsapp: whatsapp || phone,
      livestock_id: first.livestock_id || null,
      livestock_name: lines.length === 1 ? firstCalc.name : `${firstCalc.name} + ${lines.length - 1} more`,
      quantity: lines.reduce((s, l) => s + l.quantity, 0),
      unit: lines.length === 1 ? first.unit : 'mixed',
      unit_price: firstCalc.unitPrice,
      subtotal, delivery_fee: deliveryFee, total_amount: total,
      fulfillment_type: fulfillment,
      delivery_address: fulfillment === 'delivery' ? address : '',
      delivery_location_id: locationId || null, delivery_location_name: location?.name ?? '',
      pickup_time: fulfillment === 'pickup' ? pickupTime : '',
      payment_method: paymentMethod, payment_status: paymentStatus, order_status: orderStatus,
      customer_type: 'guest', notes,
      preparation_type: first.prepTypes.join(', '),
      updated_at: new Date().toISOString(),
    };

    let orderId = order?.id;
    if (mode === 'edit' && order) {
      await supabase.from('orders').update(header).eq('id', order.id);
      await supabase.from('order_items').delete().eq('order_id', order.id);
    } else {
      const { data, error: err } = await supabase.from('orders').insert(header).select('id, order_number').single();
      if (err || !data) { setError(err?.message ?? 'Could not save'); setSaving(false); return; }
      orderId = data.id;
      await supabase.from('order_updates').insert({ order_id: data.id, status: orderStatus, message: `Order created by admin (${data.order_number}).`, created_by: 'admin' });
    }

    await supabase.from('order_items').insert(lines.map((l) => {
      const c = lineCalc(l);
      return { order_id: orderId, livestock_id: l.livestock_id || null, livestock_name: c.name, livestock_image: c.image, unit: l.unit, unit_price: c.unitPrice, quantity: l.quantity, preparation_types: l.prepTypes, portion_size: ['full', 'half', 'quarter'].includes(l.unit) ? l.unit : '', subtotal: c.subtotal };
    }));

    setSaving(false);
    onSaved();
    onClose();
  }

  const inputCls = 'w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-emerald-500';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-white rounded-lg max-w-2xl w-full mx-4 max-h-[92vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-100 px-5 py-4 flex items-center justify-between z-10">
          <h3 className="text-lg font-bold text-gray-900">{mode === 'edit' ? `Edit Order ${order?.order_number ?? ''}` : 'New Manual Order'}</h3>
          <button onClick={onClose} className="p-2 text-gray-400 hover:bg-gray-100 rounded-lg"><X size={18} /></button>
        </div>
        <div className="p-5 space-y-5">
          {/* Customer */}
          <div className="grid grid-cols-2 gap-3">
            <div><label className="block text-xs font-semibold text-gray-600 mb-1">Name *</label><input value={name} onChange={(e) => setName(e.target.value)} className={inputCls} /></div>
            <div><label className="block text-xs font-semibold text-gray-600 mb-1">Phone *</label><input value={phone} onChange={(e) => setPhone(e.target.value)} className={inputCls} /></div>
            <div><label className="block text-xs font-semibold text-gray-600 mb-1">Email</label><input value={email} onChange={(e) => setEmail(e.target.value)} className={inputCls} /></div>
            <div><label className="block text-xs font-semibold text-gray-600 mb-1">WhatsApp</label><input value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} className={inputCls} /></div>
          </div>

          {/* Items */}
          <div>
            <div className="flex items-center justify-between mb-2"><label className="text-sm font-semibold text-gray-700">Items</label><button onClick={() => setLines((p) => [...p, newLine()])} className="text-xs text-emerald-700 font-semibold flex items-center gap-1"><Plus size={12} />Add item</button></div>
            <div className="space-y-2">
              {lines.map((l) => {
                const lv = livestock.find((x) => x.id === l.livestock_id);
                const units = lv ? availableUnits(lv) : [];
                const prepNames = Object.keys(lv?.preparation_prices ?? {});
                const c = lineCalc(l);
                return (
                  <div key={l.key} className="border border-gray-100 rounded-lg p-3 space-y-2">
                    <div className="flex gap-2">
                      <select value={l.livestock_id} onChange={(e) => { const nlv = livestock.find((x) => x.id === e.target.value); updateLine(l.key, { livestock_id: e.target.value, unit: nlv ? (availableUnits(nlv)[0] ?? 'kg') : 'kg', prepTypes: [] }); }} className={`${inputCls} flex-1`}>
                        {avail.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
                      </select>
                      <select value={l.unit} onChange={(e) => updateLine(l.key, { unit: e.target.value as Unit })} className={`${inputCls} w-28`}>
                        {units.map((u) => <option key={u} value={u}>{UNIT_LABELS[u]}</option>)}
                      </select>
                      <input type="number" min={1} value={l.quantity} onChange={(e) => updateLine(l.key, { quantity: Math.max(1, parseInt(e.target.value) || 1) })} className={`${inputCls} w-20`} />
                      <button onClick={() => setLines((p) => p.filter((x) => x.key !== l.key))} className="p-2 text-gray-400 hover:text-red-600"><Trash2 size={15} /></button>
                    </div>
                    {prepNames.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {prepNames.map((p) => {
                          const on = l.prepTypes.includes(p);
                          return <button key={p} onClick={() => updateLine(l.key, { prepTypes: on ? l.prepTypes.filter((x) => x !== p) : [...l.prepTypes, p] })} className={`text-xs px-2 py-1 rounded-full border ${on ? 'bg-emerald-600 text-white border-emerald-600' : 'border-gray-200 text-gray-600'}`}>{p}{Number(lv?.preparation_prices?.[p]) > 0 ? ` +${fmt(Number(lv?.preparation_prices?.[p]))}` : ''}</button>;
                        })}
                      </div>
                    )}
                    <p className="text-xs text-gray-500 text-right">{fmt(c.unitPrice)} × {l.quantity} = <span className="font-semibold text-gray-800">{fmt(c.subtotal)}</span></p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Fulfillment */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-600 mb-1">Fulfillment</label>
              <select value={fulfillment} onChange={(e) => setFulfillment(e.target.value as any)} className={inputCls}><option value="pickup">Pickup</option><option value="delivery">Delivery</option></select>
            </div>
            {fulfillment === 'delivery' ? (
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Location</label>
                <select value={locationId} onChange={(e) => setLocationId(e.target.value)} className={inputCls}><option value="">None</option>{locations.map((x) => <option key={x.id} value={x.id}>{x.name} ({fmt(x.fee)})</option>)}</select>
              </div>
            ) : (
              <div><label className="block text-xs font-semibold text-gray-600 mb-1">Pickup time</label><input value={pickupTime} onChange={(e) => setPickupTime(e.target.value)} className={inputCls} /></div>
            )}
          </div>
          {fulfillment === 'delivery' && (
            <div><label className="block text-xs font-semibold text-gray-600 mb-1">Delivery address</label><textarea value={address} onChange={(e) => setAddress(e.target.value)} rows={2} className={`${inputCls} resize-none`} /></div>
          )}

          {/* Status */}
          <div className="grid grid-cols-3 gap-3">
            <div><label className="block text-xs font-semibold text-gray-600 mb-1">Order status</label><select value={orderStatus} onChange={(e) => setOrderStatus(e.target.value)} className={inputCls}>{STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}</select></div>
            <div><label className="block text-xs font-semibold text-gray-600 mb-1">Payment</label><select value={paymentStatus} onChange={(e) => setPaymentStatus(e.target.value)} className={inputCls}>{PAY_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}</select></div>
            <div><label className="block text-xs font-semibold text-gray-600 mb-1">Method</label><select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} className={inputCls}><option value="bank_transfer">Bank transfer</option><option value="virtual">Virtual</option><option value="cash">Cash</option></select></div>
          </div>
          <div><label className="block text-xs font-semibold text-gray-600 mb-1">Notes</label><textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className={`${inputCls} resize-none`} /></div>

          <div className="bg-gray-50 rounded-lg p-4 flex items-center justify-between">
            <span className="text-sm text-gray-600">Total{deliveryFee > 0 ? ` (incl. ${fmt(deliveryFee)} delivery)` : ''}</span>
            <span className="text-xl font-bold text-gray-900">{fmt(total)}</span>
          </div>
          {error && <p className="text-sm text-red-500">{error}</p>}
          <div className="flex gap-3">
            <button onClick={onClose} className="flex-1 py-2.5 border-2 border-gray-200 rounded-lg text-sm font-semibold text-gray-600">Cancel</button>
            <button onClick={save} disabled={saving} className="flex-1 flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-300 text-white py-2.5 rounded-lg text-sm font-semibold">
              {saving ? <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> : <CheckCircle2 size={16} />}{mode === 'edit' ? 'Save Changes' : 'Create Order'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
