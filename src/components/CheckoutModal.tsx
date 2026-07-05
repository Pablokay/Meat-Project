import { useState, useEffect, useRef } from 'react';
import { X, ChevronRight, ChevronLeft, Truck, Store, User, Phone, Mail, MessageCircle, MapPin, Building2, Smartphone, CircleCheck as CheckCircle2, Copy, Upload, Clock, Info } from 'lucide-react';
import { supabase, UNIT_LABELS, type BankAccount, type DeliveryLocation, type CartItem, type Profile, type Unit, type AdminSetting, type SavedAddress } from '../lib/supabase';

type CheckoutModalProps = {
  items: CartItem[];
  profile: Profile | null;
  userType: 'guest' | 'registered' | null;
  onClose: () => void;
  onSuccess: (orderNumber: string, accessToken: string, requiresConfirmation: boolean) => void;
};

type Step = 'info' | 'fulfillment' | 'payment' | 'review';

const STEP_LABELS: Record<Step, string> = { info: 'Details', fulfillment: 'Delivery', payment: 'Payment', review: 'Review' };

function fmt(n: number) {
  return new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 }).format(n);
}

export default function CheckoutModal({ items, profile, userType, onClose, onSuccess }: CheckoutModalProps) {
  const isRegistered = !!profile && userType === 'registered';

  const [step, setStep] = useState<Step>('info');
  const [form, setForm] = useState({
    name: profile?.full_name ?? '',
    email: profile?.email ?? '',
    phone: profile?.phone ?? '',
    whatsapp: '',
    address: '',
  });
  const [fulfillment, setFulfillment] = useState<'delivery' | 'pickup'>('pickup');
  const [locations, setLocations] = useState<DeliveryLocation[]>([]);
  const [selectedLocation, setSelectedLocation] = useState<DeliveryLocation | null>(null);
  const [pickupTimes, setPickupTimes] = useState<string[]>([]);
  const [pickupTime, setPickupTime] = useState(''); // selected time window (pickup or delivery)
  const [scheduleDate, setScheduleDate] = useState('');
  const [lateDisclaimer, setLateDisclaimer] = useState('');
  const [banks, setBanks] = useState<BankAccount[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<'bank_transfer' | 'virtual' | 'paystack'>('bank_transfer');
  const [paymentRef, setPaymentRef] = useState('');
  const [paymentProofUrl, setPaymentProofUrl] = useState('');
  const [uploadingProof, setUploadingProof] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [copied, setCopied] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pointValue, setPointValue] = useState(10);
  const [applyPoints, setApplyPoints] = useState(false);
  const [paystackEnabled, setPaystackEnabled] = useState(false);
  const [paystackKey, setPaystackKey] = useState('');
  const [savedAddresses, setSavedAddresses] = useState<SavedAddress[]>([]);
  const [saveAddress, setSaveAddress] = useState(false);
  const proofInputRef = useRef<HTMLInputElement>(null);

  // All orders now pay at checkout (delivery included). The confirm-first gate
  // has been removed so the account/payment step always shows.
  const requiresConfirmation = false;

  const subtotal = items.reduce((s, i) => s + i.subtotal, 0);
  const deliveryFee = fulfillment === 'delivery' ? (selectedLocation?.fee ?? 0) : 0;

  // Points redemption (registered users only).
  const availablePoints = isRegistered ? (profile?.points ?? 0) : 0;
  const maxRedeemablePoints = Math.min(availablePoints, Math.floor(subtotal / pointValue));
  const pointsUsed = applyPoints ? maxRedeemablePoints : 0;
  const discount = pointsUsed * pointValue;
  const total = Math.max(0, subtotal + deliveryFee - discount);

  const steps: Step[] = requiresConfirmation ? ['info', 'fulfillment', 'review'] : ['info', 'fulfillment', 'payment', 'review'];
  const stepIdx = steps.indexOf(step);

  useEffect(() => {
    supabase.from('bank_accounts').select('*').eq('is_active', true).then(({ data }) => setBanks(data ?? []));
    supabase.from('delivery_locations').select('*').eq('is_active', true).order('fee').then(({ data }) => setLocations(data ?? []));
    supabase.from('admin_settings').select('*').in('key', ['pickup_times', 'late_pickup_disclaimer', 'point_value_naira', 'paystack_enabled', 'paystack_public_key']).then(({ data }) => {
      if (!data) return;
      const g = (k: string) => data.find((s: AdminSetting) => s.key === k);
      if (g('pickup_times')) { try { setPickupTimes(JSON.parse(g('pickup_times')!.value)); } catch { /* ignore */ } }
      if (g('late_pickup_disclaimer')) setLateDisclaimer(g('late_pickup_disclaimer')!.value);
      if (g('point_value_naira') && Number(g('point_value_naira')!.value) > 0) setPointValue(Number(g('point_value_naira')!.value));
      if (g('paystack_enabled')) setPaystackEnabled(g('paystack_enabled')!.value === 'true');
      if (g('paystack_public_key')) setPaystackKey(g('paystack_public_key')!.value);
    });
    if (profile?.id) {
      supabase.from('saved_addresses').select('*').eq('user_id', profile.id).order('is_default', { ascending: false }).then(({ data }) => {
        setSavedAddresses(data ?? []);
        const def = (data ?? []).find((a) => a.is_default) ?? (data ?? [])[0];
        if (def) setForm((f) => ({ ...f, address: def.address, phone: f.phone || def.phone }));
      });
    }
  }, []);

  async function uploadProof(file: File) {
    setUploadingProof(true);
    const ext = file.name.split('.').pop();
    const path = `proofs/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const { error } = await supabase.storage.from('order-proof').upload(path, file);
    if (!error) {
      const { data } = supabase.storage.from('order-proof').getPublicUrl(path);
      setPaymentProofUrl(data.publicUrl);
    }
    setUploadingProof(false);
  }

  function validate(s: Step): boolean {
    const e: Record<string, string> = {};
    if (s === 'info') {
      if (!form.name.trim()) e.name = 'Required';
      if (!form.phone.trim()) e.phone = 'Required';
      // email intentionally optional
    }
    if (s === 'fulfillment' && fulfillment === 'delivery') {
      if (!form.address.trim()) e.address = 'Required';
      if (!selectedLocation) e.location = 'Select your location';
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function next() {
    if (!validate(step)) return;
    if (stepIdx < steps.length - 1) setStep(steps[stepIdx + 1]);
  }
  function prev() {
    if (stepIdx > 0) setStep(steps[stepIdx - 1]);
  }

  function copyText(text: string, label: string) {
    navigator.clipboard.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied(''), 2000);
  }

  function loadPaystack(): Promise<boolean> {
    return new Promise((resolve) => {
      if ((window as any).PaystackPop) return resolve(true);
      const s = document.createElement('script');
      s.src = 'https://js.paystack.co/v1/inline.js';
      s.onload = () => resolve(true);
      s.onerror = () => resolve(false);
      document.body.appendChild(s);
    });
  }
  async function payWithPaystack(orderId: string, orderNumber: string, amount: number): Promise<boolean> {
    const ready = await loadPaystack();
    const PaystackPop = (window as any).PaystackPop;
    if (!ready || !PaystackPop) return false;
    return new Promise<boolean>((resolve) => {
      const handler = PaystackPop.setup({
        key: paystackKey,
        email: form.email || `${form.phone.replace(/\D/g, '')}@koyanfresh.pay`,
        amount: Math.round(amount * 100),
        currency: 'NGN',
        ref: `${orderNumber}-${Date.now()}`,
        callback: (resp: any) => { supabase.functions.invoke('verify-paystack', { body: { reference: resp.reference, orderId } }).finally(() => resolve(true)); },
        onClose: () => resolve(false),
      });
      handler.openIframe();
    });
  }

  async function submitOrder() {
    setSubmitting(true);
    const firstItem = items[0];
    const orderStatus = requiresConfirmation ? 'awaiting_confirmation' : 'pending';

    // Redeem points first so we only apply what actually deducted.
    let redeemed = 0;
    if (pointsUsed > 0 && profile?.id) {
      const { data: r } = await supabase.rpc('redeem_points', { p_user_id: profile.id, p_points: pointsUsed });
      redeemed = Number(r) || 0;
    }
    const appliedDiscount = redeemed * pointValue;
    const finalTotal = Math.max(0, subtotal + deliveryFee - appliedDiscount);

    const { data, error } = await supabase
      .from('orders')
      .insert({
        user_id: profile?.id ?? null,
        customer_type: isRegistered ? 'registered' : 'guest',
        customer_name: form.name,
        customer_email: form.email || '',
        customer_phone: form.phone,
        customer_whatsapp: form.whatsapp || form.phone,
        livestock_id: firstItem?.livestock_id ?? null,
        livestock_name: items.length === 1 ? firstItem.livestock_name : `${firstItem.livestock_name} + ${items.length - 1} more`,
        quantity: items.reduce((s, i) => s + i.quantity, 0),
        unit: items.length === 1 ? firstItem.unit : 'mixed',
        unit_price: firstItem?.unit_price ?? 0,
        subtotal,
        delivery_fee: deliveryFee,
        discount_amount: appliedDiscount,
        points_redeemed: redeemed,
        total_amount: finalTotal,
        fulfillment_type: fulfillment,
        delivery_address: fulfillment === 'delivery' ? form.address : '',
        delivery_location_id: selectedLocation?.id ?? null,
        delivery_location_name: selectedLocation?.name ?? '',
        delivery_date: scheduleDate || null,
        delivery_slot_label: fulfillment === 'delivery' ? pickupTime : '',
        pickup_time: fulfillment === 'pickup' ? pickupTime : '',
        payment_method: paymentMethod,
        payment_reference: paymentRef,
        payment_proof_url: paymentProofUrl,
        payment_status: 'pending',
        order_status: orderStatus,
        requires_confirmation: requiresConfirmation,
        preparation_type: firstItem?.preparation_types?.join(', ') ?? '',
        portion_size: firstItem?.portion_size ?? '',
      })
      .select('id, order_number, access_token')
      .single();

    // Save the address for next time if requested.
    if (!error && data && saveAddress && fulfillment === 'delivery' && form.address.trim() && profile?.id) {
      await supabase.from('saved_addresses').insert({ user_id: profile.id, label: 'Saved', address: form.address.trim(), phone: form.phone, is_default: savedAddresses.length === 0 });
    }

    if (error || !data) {
      setSubmitting(false);
      setErrors({ submit: error?.message ?? 'Could not place order' });
      return;
    }

    // Line items
    await supabase.from('order_items').insert(
      items.map((i) => ({
        order_id: data.id,
        livestock_id: i.livestock_id,
        livestock_name: i.livestock_name,
        livestock_image: i.livestock_image,
        unit: i.unit,
        unit_price: i.unit_price,
        quantity: i.quantity,
        preparation_types: i.preparation_types ?? [],
        portion_size: i.portion_size ?? '',
        subtotal: i.subtotal,
      }))
    );

    // Timeline + admin notification
    const initialMsg = requiresConfirmation
      ? 'Order received and awaiting admin confirmation before payment.'
      : 'Order received and awaiting payment confirmation.';
    await supabase.from('order_updates').insert({ order_id: data.id, status: orderStatus, message: initialMsg, created_by: 'system' });
    await supabase.from('notifications').insert({
      recipient_type: 'admin',
      title: 'New order placed',
      body: `Order #${data.order_number} from ${form.name} — ${fmt(total)} (${fulfillment}).`,
      type: 'order',
      order_id: data.id,
    });

    // Best-effort email via edge function (no-op if RESEND_API_KEY unset)
    try {
      await supabase.functions.invoke('send-order-notification', {
        body: {
          orderNumber: data.order_number,
          customerName: form.name,
          customerEmail: form.email,
          customerWhatsapp: form.whatsapp || form.phone,
          livestockName: items.length === 1 ? firstItem.livestock_name : `${items.length} items`,
          quantity: items.reduce((s, i) => s + i.quantity, 0),
          unit: items.length === 1 ? firstItem.unit : 'mixed',
          totalAmount: total,
          fulfillmentType: fulfillment,
          deliveryDate: '',
          deliverySlotLabel: '',
          paymentMethod,
          notifyAdmin: true,
        },
      });
    } catch { /* ignore email failure */ }

    // Decrement stock per line item (kg vs portion-like units).
    for (const i of items) {
      if (!i.livestock_id) continue;
      const kg = i.unit === 'kg' ? i.quantity : 0;
      const portions = i.unit === 'kg' ? 0 : i.quantity;
      try { await supabase.rpc('decrement_stock', { p_livestock_id: i.livestock_id, p_kg: kg, p_portions: portions }); } catch { /* ignore */ }
    }

    // Instant online payment via Paystack (immediate-pay flow only).
    if (paymentMethod === 'paystack' && paystackEnabled && paystackKey && !requiresConfirmation) {
      await payWithPaystack(data.id, data.order_number, finalTotal);
    }

    setSubmitting(false);
    onSuccess(data.order_number, data.access_token, requiresConfirmation);
  }

  const inputCls = (err?: string) =>
    `w-full pl-9 pr-4 py-2.5 border-2 rounded-lg text-sm focus:outline-none ${err ? 'border-red-400 focus:border-red-500' : 'border-gray-200 focus:border-forest-600'}`;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-paper rounded-t-lg sm:rounded-lg w-full sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-paper z-10 border-b border-gray-100 p-4">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-bold text-forest-900">Checkout</h2>
              <p className="text-xs text-gray-500">{items.length} item{items.length > 1 ? 's' : ''} · <span className="font-semibold text-forest-700">{fmt(total)}</span></p>
            </div>
            <button onClick={onClose} className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-400" aria-label="Close"><X size={20} /></button>
          </div>
          <div className="flex items-center">
            {steps.map((s, i) => {
              const label = STEP_LABELS[s];
              const done = i < stepIdx;
              const active = i === stepIdx;
              return (
                <div key={s} className="flex items-center flex-1 last:flex-none">
                  <div className="flex flex-col items-center gap-1">
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${done ? 'bg-forest-700 text-cream' : active ? 'bg-forest-700 text-cream ring-4 ring-forest-100' : 'bg-gray-100 text-gray-400'}`}>
                      {done ? <CheckCircle2 size={15} /> : i + 1}
                    </div>
                    <span className={`text-[10px] font-medium ${active || done ? 'text-forest-800' : 'text-gray-400'}`}>{label}</span>
                  </div>
                  {i < steps.length - 1 && <div className={`flex-1 h-0.5 mx-1 -mt-4 ${done ? 'bg-forest-700' : 'bg-gray-200'}`} />}
                </div>
              );
            })}
          </div>
        </div>

        <div className="p-5">
          {step === 'info' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Full Name *</label>
                <div className="relative">
                  <User size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input type="text" value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} placeholder="John Doe" className={inputCls(errors.name)} />
                </div>
                {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name}</p>}
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Email <span className="font-normal text-gray-400">(optional)</span></label>
                <div className="relative">
                  <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input type="email" value={form.email} onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))} placeholder="you@example.com" className={inputCls()} />
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Phone Number *</label>
                <div className="relative">
                  <Phone size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input type="tel" value={form.phone} onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))} placeholder="0801 234 5678" className={inputCls(errors.phone)} />
                </div>
                {errors.phone && <p className="text-xs text-red-500 mt-1">{errors.phone}</p>}
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">WhatsApp Number <span className="font-normal text-gray-400">(optional)</span></label>
                <div className="relative">
                  <MessageCircle size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input type="tel" value={form.whatsapp} onChange={(e) => setForm((f) => ({ ...f, whatsapp: e.target.value }))} placeholder="Same as phone if empty" className={inputCls()} />
                </div>
              </div>
            </div>
          )}

          {step === 'fulfillment' && (
            <div className="space-y-5">
              <div>
                <p className="text-sm font-semibold text-gray-700 mb-2">Fulfillment Method</p>
                <div className="grid grid-cols-2 gap-3">
                  <button onClick={() => setFulfillment('pickup')} className={`p-4 rounded-lg border-2 flex flex-col items-center gap-2 transition-all ${fulfillment === 'pickup' ? 'border-forest-600 bg-forest-50' : 'border-gray-200 hover:border-gray-300'}`}>
                    <Store size={20} className={fulfillment === 'pickup' ? 'text-forest-700' : 'text-gray-400'} />
                    <span className={`text-sm font-bold ${fulfillment === 'pickup' ? 'text-forest-700' : 'text-gray-600'}`}>Pickup</span>
                    <span className="text-xs text-gray-500">Free</span>
                  </button>
                  <button onClick={() => setFulfillment('delivery')} className={`p-4 rounded-lg border-2 flex flex-col items-center gap-2 transition-all ${fulfillment === 'delivery' ? 'border-forest-600 bg-forest-50' : 'border-gray-200 hover:border-gray-300'}`}>
                    <Truck size={20} className={fulfillment === 'delivery' ? 'text-forest-700' : 'text-gray-400'} />
                    <span className={`text-sm font-bold ${fulfillment === 'delivery' ? 'text-forest-700' : 'text-gray-600'}`}>Delivery</span>
                    <span className="text-xs text-gray-500">Location fee</span>
                  </button>
                </div>
              </div>

              {/* Unified schedule: date + time window for both pickup & delivery */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1 flex items-center gap-1"><Clock size={14} />Preferred date</label>
                  <input type="date" value={scheduleDate} min={new Date().toISOString().split('T')[0]} onChange={(e) => setScheduleDate(e.target.value)} className="w-full px-3 py-2.5 border-2 border-gray-200 rounded-lg text-sm focus:outline-none focus:border-forest-600" />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">Time window</label>
                  {pickupTimes.length > 0 ? (
                    <select value={pickupTime} onChange={(e) => setPickupTime(e.target.value)} className="w-full px-3 py-2.5 border-2 border-gray-200 rounded-lg text-sm focus:outline-none focus:border-forest-600">
                      <option value="">Any time</option>
                      {pickupTimes.map((t) => <option key={t} value={t}>{t}</option>)}
                    </select>
                  ) : <p className="text-xs text-gray-400 pt-2">We'll confirm timing with you.</p>}
                </div>
              </div>

              {fulfillment === 'delivery' ? (
                <>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Delivery Location *</label>
                    {errors.location && <p className="text-xs text-red-500 mb-1">{errors.location}</p>}
                    <div className="grid grid-cols-1 gap-2">
                      {locations.map((loc) => (
                        <button key={loc.id} onClick={() => setSelectedLocation(loc)} className={`flex items-center justify-between p-3 rounded-lg border-2 transition-all text-left ${selectedLocation?.id === loc.id ? 'border-forest-600 bg-forest-50' : 'border-gray-200 hover:border-gray-300'}`}>
                          <span className="text-sm font-medium text-gray-900">{loc.name}</span>
                          <span className="text-sm font-bold text-forest-700">{fmt(loc.fee)}</span>
                        </button>
                      ))}
                      {locations.length === 0 && <p className="text-xs text-gray-400">No delivery locations configured yet.</p>}
                    </div>
                  </div>
                  {savedAddresses.length > 0 && (
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-1">Saved Addresses</label>
                      <div className="flex flex-wrap gap-2">
                        {savedAddresses.map((a) => (
                          <button key={a.id} onClick={() => setForm((f) => ({ ...f, address: a.address, phone: f.phone || a.phone }))} className={`px-3 py-2 rounded-lg border-2 text-left text-xs max-w-[220px] transition-all ${form.address === a.address ? 'border-forest-600 bg-forest-50' : 'border-gray-200 hover:border-gray-300'}`}>
                            <span className="font-semibold text-gray-800">{a.label}</span>
                            <span className="block text-gray-500 truncate">{a.address}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Delivery Address *</label>
                    <div className="relative">
                      <MapPin size={16} className="absolute left-3 top-3 text-gray-400" />
                      <textarea value={form.address} onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))} rows={2} placeholder="Enter your delivery address..." className={`w-full pl-9 pr-4 py-2.5 border-2 rounded-lg text-sm focus:outline-none resize-none ${errors.address ? 'border-red-400' : 'border-gray-200 focus:border-forest-600'}`} />
                    </div>
                    {errors.address && <p className="text-xs text-red-500 mt-1">{errors.address}</p>}
                    {isRegistered && (
                      <label className="flex items-center gap-2 mt-2 text-xs text-gray-600"><input type="checkbox" checked={saveAddress} onChange={(e) => setSaveAddress(e.target.checked)} className="accent-forest-700" />Save this address for next time</label>
                    )}
                  </div>
                </>
              ) : (
                lateDisclaimer && (
                  <div className="flex gap-2 bg-amber-50 border border-amber-200 rounded-lg p-3">
                    <Info size={16} className="text-amber-600 flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-amber-700">{lateDisclaimer}</p>
                  </div>
                )
              )}
            </div>
          )}

          {step === 'payment' && (
            <div className="space-y-5">
              <div className="bg-forest-50 rounded-lg p-4 space-y-1">
                <div className="flex justify-between text-sm"><span className="text-gray-600">Subtotal</span><span className="font-semibold">{fmt(subtotal)}</span></div>
                {deliveryFee > 0 && <div className="flex justify-between text-sm"><span className="text-gray-600">Delivery Fee</span><span className="font-semibold">{fmt(deliveryFee)}</span></div>}
                <div className="flex justify-between text-sm font-bold border-t border-forest-700/15 pt-1"><span>Total</span><span className="text-forest-700 text-lg">{fmt(total)}</span></div>
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-700 mb-2">Payment Method</p>
                <div className="grid grid-cols-2 gap-3">
                  {paystackEnabled && paystackKey && (
                    <button onClick={() => setPaymentMethod('paystack')} className={`col-span-2 p-3 rounded-lg border-2 flex items-center justify-center gap-2 transition-all ${paymentMethod === 'paystack' ? 'border-forest-600 bg-forest-50' : 'border-gray-200'}`}>
                      <Smartphone size={18} className={paymentMethod === 'paystack' ? 'text-forest-700' : 'text-gray-400'} />
                      <span className={`text-sm font-bold ${paymentMethod === 'paystack' ? 'text-forest-700' : 'text-gray-600'}`}>Pay instantly with card / Paystack</span>
                    </button>
                  )}
                  <button onClick={() => setPaymentMethod('bank_transfer')} className={`p-3 rounded-lg border-2 flex flex-col items-center gap-1 transition-all ${paymentMethod === 'bank_transfer' ? 'border-forest-600 bg-forest-50' : 'border-gray-200'}`}>
                    <Building2 size={18} className={paymentMethod === 'bank_transfer' ? 'text-forest-700' : 'text-gray-400'} />
                    <span className={`text-xs font-bold ${paymentMethod === 'bank_transfer' ? 'text-forest-700' : 'text-gray-600'}`}>Bank Transfer</span>
                  </button>
                  <button onClick={() => setPaymentMethod('virtual')} className={`p-3 rounded-lg border-2 flex flex-col items-center gap-1 transition-all ${paymentMethod === 'virtual' ? 'border-forest-600 bg-forest-50' : 'border-gray-200'}`}>
                    <Smartphone size={18} className={paymentMethod === 'virtual' ? 'text-forest-700' : 'text-gray-400'} />
                    <span className={`text-xs font-bold ${paymentMethod === 'virtual' ? 'text-forest-700' : 'text-gray-600'}`}>Virtual Account</span>
                  </button>
                </div>
              </div>
              {paymentMethod === 'bank_transfer' && banks.length > 0 && (
                <div className="space-y-3">
                  <p className="text-sm font-semibold text-gray-700">Transfer to any of these accounts:</p>
                  {banks.map((b) => (
                    <div key={b.id} className="bg-cream rounded-lg p-4 space-y-1">
                      <p className="text-xs text-gray-500">{b.bank_name}</p>
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-bold text-gray-900">{b.account_number}</p>
                        <button onClick={() => copyText(b.account_number, b.id)} className="text-xs text-forest-700 hover:text-forest-700 font-medium flex items-center gap-1"><Copy size={11} />{copied === b.id ? 'Copied!' : 'Copy'}</button>
                      </div>
                      <p className="text-xs text-gray-600">{b.account_name}</p>
                    </div>
                  ))}
                </div>
              )}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Payment Reference <span className="font-normal text-gray-400">(optional)</span></label>
                <input type="text" value={paymentRef} onChange={(e) => setPaymentRef(e.target.value)} placeholder="Transaction reference" className="w-full px-4 py-2.5 border-2 border-gray-200 rounded-lg text-sm focus:outline-none focus:border-forest-600" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Upload Payment Proof <span className="font-normal text-gray-400">(optional)</span></label>
                <input ref={proofInputRef} type="file" accept="image/*,.pdf" className="hidden" onChange={(e) => e.target.files?.[0] && uploadProof(e.target.files[0])} />
                <button onClick={() => proofInputRef.current?.click()} disabled={uploadingProof} className="w-full flex items-center justify-center gap-2 border-2 border-dashed border-gray-200 rounded-lg py-4 text-sm text-gray-500 hover:border-forest-300 hover:text-forest-700 transition-colors">
                  {uploadingProof ? <div className="w-4 h-4 border-2 border-forest-600 border-t-transparent rounded-full animate-spin" /> : <Upload size={16} />}
                  {paymentProofUrl ? 'Proof uploaded' : 'Click to upload'}
                </button>
              </div>
            </div>
          )}

          {step === 'review' && (
            <div className="space-y-4">
              {requiresConfirmation && (
                <div className="flex gap-2 bg-amber-50 border border-amber-200 rounded-lg p-3">
                  <Info size={16} className="text-amber-600 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-amber-700">This order needs admin confirmation before payment. We'll notify you when it's confirmed so you can pay.</p>
                </div>
              )}
              <div className="bg-cream rounded-lg p-4 space-y-2">
                <h3 className="text-sm font-bold text-gray-700">Items</h3>
                {items.map((i) => (
                  <div key={i.id} className="flex justify-between text-sm">
                    <span className="text-gray-600">{i.livestock_name} · {i.quantity} {UNIT_LABELS[i.unit as Unit] ?? i.unit}{i.preparation_types.length ? ` · ${i.preparation_types.join(', ')}` : ''}</span>
                    <span className="font-semibold">{fmt(i.subtotal)}</span>
                  </div>
                ))}
              </div>
              {isRegistered && availablePoints > 0 && maxRedeemablePoints > 0 && (
                <label className="flex items-center justify-between gap-3 bg-paper border border-forest-700/15 rounded-lg p-3 cursor-pointer">
                  <div className="flex items-center gap-2">
                    <input type="checkbox" checked={applyPoints} onChange={(e) => setApplyPoints(e.target.checked)} className="accent-forest-700 w-4 h-4" />
                    <div>
                      <p className="text-sm font-semibold text-forest-800">Use {maxRedeemablePoints} reward points</p>
                      <p className="text-xs text-gray-500">You have {availablePoints} pts · 1 pt = {fmt(pointValue)}</p>
                    </div>
                  </div>
                  <span className="text-sm font-bold text-forest-700">−{fmt(maxRedeemablePoints * pointValue)}</span>
                </label>
              )}
              <div className="bg-forest-50 rounded-lg p-4 space-y-1">
                <div className="flex justify-between text-sm"><span className="text-gray-600">Subtotal</span><span className="font-semibold">{fmt(subtotal)}</span></div>
                <div className="flex justify-between text-sm"><span className="text-gray-600">Fulfillment</span><span className="font-semibold capitalize">{fulfillment}{fulfillment === 'delivery' && selectedLocation ? ` · ${selectedLocation.name}` : ''}</span></div>
                {deliveryFee > 0 && <div className="flex justify-between text-sm"><span className="text-gray-600">Delivery Fee</span><span className="font-semibold">{fmt(deliveryFee)}</span></div>}
                {discount > 0 && <div className="flex justify-between text-sm"><span className="text-gray-600">Points discount</span><span className="font-semibold text-forest-700">−{fmt(discount)}</span></div>}
                <div className="flex justify-between text-sm font-bold border-t border-forest-700/15 pt-1"><span>Total</span><span className="text-forest-700">{fmt(total)}</span></div>
              </div>
              {fulfillment === 'delivery' && (
                <div className="bg-cream rounded-lg p-4">
                  <h3 className="text-sm font-bold text-gray-700 mb-1 flex items-center gap-1"><MapPin size={14} />Delivery Address</h3>
                  <p className="text-sm text-gray-600">{form.address || '—'}</p>
                </div>
              )}
              {fulfillment === 'pickup' && pickupTime && (
                <div className="bg-cream rounded-lg p-4">
                  <h3 className="text-sm font-bold text-gray-700 mb-1 flex items-center gap-1"><Clock size={14} />Pickup Time</h3>
                  <p className="text-sm text-gray-600">{pickupTime}</p>
                </div>
              )}
              <div className="bg-cream rounded-lg p-4 space-y-1">
                <h3 className="text-sm font-bold text-gray-700">Contact</h3>
                <p className="text-sm text-gray-600">{form.name}</p>
                {form.email && <p className="text-sm text-gray-600">{form.email}</p>}
                <p className="text-sm text-gray-600">{form.phone}</p>
              </div>
              {errors.submit && <p className="text-sm text-red-500">{errors.submit}</p>}
              <button onClick={submitOrder} disabled={submitting} className="w-full flex items-center justify-center gap-2 bg-forest-700 hover:bg-forest-800 disabled:bg-gray-300 text-white font-semibold py-3 rounded-lg transition-colors">
                {submitting ? <div className="w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin" /> : <CheckCircle2 size={18} />}
                {requiresConfirmation ? 'Place Order (await confirmation)' : 'Confirm & Place Order'}
              </button>
            </div>
          )}
        </div>

        {stepIdx < steps.length - 1 && (
          <div className="sticky bottom-0 bg-paper border-t border-gray-100 p-4 flex items-center justify-between gap-3">
            {stepIdx > 0 ? (
              <button onClick={prev} className="flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900 font-medium"><ChevronLeft size={16} />Back</button>
            ) : <div className="text-left"><p className="text-[11px] text-gray-400">Total</p><p className="text-base font-bold text-forest-900">{fmt(total)}</p></div>}
            <button onClick={next} className="flex-1 max-w-[220px] flex items-center justify-center gap-1 bg-forest-700 hover:bg-forest-800 text-cream px-5 py-3 rounded-lg text-sm font-semibold transition-colors">
              Continue <ChevronRight size={16} />
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
