import { useState, useEffect, useRef } from 'react';
import { X, ChevronRight, ChevronLeft, Truck, Store, User, Phone, Mail, MessageCircle, MapPin, Building2, Smartphone, CircleCheck as CheckCircle2, Copy, Upload, Clock, Info } from 'lucide-react';
import { supabase, UNIT_LABELS, type BankAccount, type DeliveryLocation, type CartItem, type Profile, type Unit, type AdminSetting } from '../lib/supabase';

type CheckoutModalProps = {
  items: CartItem[];
  profile: Profile | null;
  userType: 'guest' | 'registered' | null;
  onClose: () => void;
  onSuccess: (orderNumber: string, accessToken: string) => void;
};

type Step = 'info' | 'fulfillment' | 'payment' | 'review';

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
  const [pickupTime, setPickupTime] = useState('');
  const [lateDisclaimer, setLateDisclaimer] = useState('');
  const [banks, setBanks] = useState<BankAccount[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<'bank_transfer' | 'virtual'>('bank_transfer');
  const [paymentRef, setPaymentRef] = useState('');
  const [paymentProofUrl, setPaymentProofUrl] = useState('');
  const [uploadingProof, setUploadingProof] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [copied, setCopied] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const proofInputRef = useRef<HTMLInputElement>(null);

  // Delivery OR guest requires admin confirmation before payment.
  const requiresConfirmation = fulfillment === 'delivery' || !isRegistered;

  const subtotal = items.reduce((s, i) => s + i.subtotal, 0);
  const deliveryFee = fulfillment === 'delivery' ? (selectedLocation?.fee ?? 0) : 0;
  const total = subtotal + deliveryFee;

  const steps: Step[] = requiresConfirmation ? ['info', 'fulfillment', 'review'] : ['info', 'fulfillment', 'payment', 'review'];
  const stepIdx = steps.indexOf(step);

  useEffect(() => {
    supabase.from('bank_accounts').select('*').eq('is_active', true).then(({ data }) => setBanks(data ?? []));
    supabase.from('delivery_locations').select('*').eq('is_active', true).order('fee').then(({ data }) => setLocations(data ?? []));
    supabase.from('admin_settings').select('*').in('key', ['pickup_times', 'late_pickup_disclaimer']).then(({ data }) => {
      if (!data) return;
      const pt = data.find((s: AdminSetting) => s.key === 'pickup_times');
      const ld = data.find((s: AdminSetting) => s.key === 'late_pickup_disclaimer');
      if (pt) { try { setPickupTimes(JSON.parse(pt.value)); } catch { /* ignore */ } }
      if (ld) setLateDisclaimer(ld.value);
    });
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

  async function submitOrder() {
    setSubmitting(true);
    const firstItem = items[0];
    const orderStatus = requiresConfirmation ? 'awaiting_confirmation' : 'pending';

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
        total_amount: total,
        fulfillment_type: fulfillment,
        delivery_address: fulfillment === 'delivery' ? form.address : '',
        delivery_location_id: selectedLocation?.id ?? null,
        delivery_location_name: selectedLocation?.name ?? '',
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

    setSubmitting(false);
    onSuccess(data.order_number, data.access_token);
  }

  const inputCls = (err?: string) =>
    `w-full pl-9 pr-4 py-2.5 border-2 rounded-xl text-sm focus:outline-none ${err ? 'border-red-400 focus:border-red-500' : 'border-gray-200 focus:border-blue-400'}`;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white z-10 border-b border-gray-100 p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-bold text-gray-900">Checkout ({items.length} item{items.length > 1 ? 's' : ''})</h2>
            <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600"><X size={20} /></button>
          </div>
          <div className="flex items-center gap-1">
            {steps.map((s, i) => (
              <div key={s} className={`flex-1 h-1.5 rounded-full transition-colors ${i <= stepIdx ? 'bg-blue-600' : 'bg-gray-200'}`} />
            ))}
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
                  <button onClick={() => setFulfillment('pickup')} className={`p-4 rounded-xl border-2 flex flex-col items-center gap-2 transition-all ${fulfillment === 'pickup' ? 'border-blue-600 bg-blue-50' : 'border-gray-200 hover:border-gray-300'}`}>
                    <Store size={20} className={fulfillment === 'pickup' ? 'text-blue-600' : 'text-gray-400'} />
                    <span className={`text-sm font-bold ${fulfillment === 'pickup' ? 'text-blue-700' : 'text-gray-600'}`}>Pickup</span>
                    <span className="text-xs text-gray-500">Free</span>
                  </button>
                  <button onClick={() => setFulfillment('delivery')} className={`p-4 rounded-xl border-2 flex flex-col items-center gap-2 transition-all ${fulfillment === 'delivery' ? 'border-blue-600 bg-blue-50' : 'border-gray-200 hover:border-gray-300'}`}>
                    <Truck size={20} className={fulfillment === 'delivery' ? 'text-blue-600' : 'text-gray-400'} />
                    <span className={`text-sm font-bold ${fulfillment === 'delivery' ? 'text-blue-700' : 'text-gray-600'}`}>Delivery</span>
                    <span className="text-xs text-gray-500">Location fee</span>
                  </button>
                </div>
              </div>

              {fulfillment === 'delivery' ? (
                <>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Delivery Location *</label>
                    {errors.location && <p className="text-xs text-red-500 mb-1">{errors.location}</p>}
                    <div className="grid grid-cols-1 gap-2">
                      {locations.map((loc) => (
                        <button key={loc.id} onClick={() => setSelectedLocation(loc)} className={`flex items-center justify-between p-3 rounded-xl border-2 transition-all text-left ${selectedLocation?.id === loc.id ? 'border-blue-600 bg-blue-50' : 'border-gray-200 hover:border-gray-300'}`}>
                          <span className="text-sm font-medium text-gray-900">{loc.name}</span>
                          <span className="text-sm font-bold text-blue-700">{fmt(loc.fee)}</span>
                        </button>
                      ))}
                      {locations.length === 0 && <p className="text-xs text-gray-400">No delivery locations configured yet.</p>}
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Delivery Address *</label>
                    <div className="relative">
                      <MapPin size={16} className="absolute left-3 top-3 text-gray-400" />
                      <textarea value={form.address} onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))} rows={2} placeholder="Enter your delivery address..." className={`w-full pl-9 pr-4 py-2.5 border-2 rounded-xl text-sm focus:outline-none resize-none ${errors.address ? 'border-red-400' : 'border-gray-200 focus:border-blue-400'}`} />
                    </div>
                    {errors.address && <p className="text-xs text-red-500 mt-1">{errors.address}</p>}
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center gap-1"><Clock size={14} />Preferred Pickup Time</label>
                    <div className="grid grid-cols-1 gap-2">
                      {pickupTimes.map((t) => (
                        <button key={t} onClick={() => setPickupTime(t)} className={`p-3 rounded-xl border-2 text-left text-sm font-medium transition-all ${pickupTime === t ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}>{t}</button>
                      ))}
                      {pickupTimes.length === 0 && <p className="text-xs text-gray-400">Pickup times will be confirmed by our team.</p>}
                    </div>
                  </div>
                  {lateDisclaimer && (
                    <div className="flex gap-2 bg-amber-50 border border-amber-200 rounded-xl p-3">
                      <Info size={16} className="text-amber-600 flex-shrink-0 mt-0.5" />
                      <p className="text-xs text-amber-700">{lateDisclaimer}</p>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {step === 'payment' && (
            <div className="space-y-5">
              <div className="bg-blue-50 rounded-xl p-4 space-y-1">
                <div className="flex justify-between text-sm"><span className="text-gray-600">Subtotal</span><span className="font-semibold">{fmt(subtotal)}</span></div>
                {deliveryFee > 0 && <div className="flex justify-between text-sm"><span className="text-gray-600">Delivery Fee</span><span className="font-semibold">{fmt(deliveryFee)}</span></div>}
                <div className="flex justify-between text-sm font-bold border-t border-blue-200 pt-1"><span>Total</span><span className="text-blue-700 text-lg">{fmt(total)}</span></div>
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-700 mb-2">Payment Method</p>
                <div className="grid grid-cols-2 gap-3">
                  <button onClick={() => setPaymentMethod('bank_transfer')} className={`p-3 rounded-xl border-2 flex flex-col items-center gap-1 transition-all ${paymentMethod === 'bank_transfer' ? 'border-blue-600 bg-blue-50' : 'border-gray-200'}`}>
                    <Building2 size={18} className={paymentMethod === 'bank_transfer' ? 'text-blue-600' : 'text-gray-400'} />
                    <span className={`text-xs font-bold ${paymentMethod === 'bank_transfer' ? 'text-blue-700' : 'text-gray-600'}`}>Bank Transfer</span>
                  </button>
                  <button onClick={() => setPaymentMethod('virtual')} className={`p-3 rounded-xl border-2 flex flex-col items-center gap-1 transition-all ${paymentMethod === 'virtual' ? 'border-blue-600 bg-blue-50' : 'border-gray-200'}`}>
                    <Smartphone size={18} className={paymentMethod === 'virtual' ? 'text-blue-600' : 'text-gray-400'} />
                    <span className={`text-xs font-bold ${paymentMethod === 'virtual' ? 'text-blue-700' : 'text-gray-600'}`}>Virtual Account</span>
                  </button>
                </div>
              </div>
              {paymentMethod === 'bank_transfer' && banks.length > 0 && (
                <div className="space-y-3">
                  <p className="text-sm font-semibold text-gray-700">Transfer to any of these accounts:</p>
                  {banks.map((b) => (
                    <div key={b.id} className="bg-gray-50 rounded-xl p-4 space-y-1">
                      <p className="text-xs text-gray-500">{b.bank_name}</p>
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-bold text-gray-900">{b.account_number}</p>
                        <button onClick={() => copyText(b.account_number, b.id)} className="text-xs text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1"><Copy size={11} />{copied === b.id ? 'Copied!' : 'Copy'}</button>
                      </div>
                      <p className="text-xs text-gray-600">{b.account_name}</p>
                    </div>
                  ))}
                </div>
              )}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Payment Reference <span className="font-normal text-gray-400">(optional)</span></label>
                <input type="text" value={paymentRef} onChange={(e) => setPaymentRef(e.target.value)} placeholder="Transaction reference" className="w-full px-4 py-2.5 border-2 border-gray-200 rounded-xl text-sm focus:outline-none focus:border-blue-400" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Upload Payment Proof <span className="font-normal text-gray-400">(optional)</span></label>
                <input ref={proofInputRef} type="file" accept="image/*,.pdf" className="hidden" onChange={(e) => e.target.files?.[0] && uploadProof(e.target.files[0])} />
                <button onClick={() => proofInputRef.current?.click()} disabled={uploadingProof} className="w-full flex items-center justify-center gap-2 border-2 border-dashed border-gray-200 rounded-xl py-4 text-sm text-gray-500 hover:border-blue-300 hover:text-blue-600 transition-colors">
                  {uploadingProof ? <div className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" /> : <Upload size={16} />}
                  {paymentProofUrl ? 'Proof uploaded' : 'Click to upload'}
                </button>
              </div>
            </div>
          )}

          {step === 'review' && (
            <div className="space-y-4">
              {requiresConfirmation && (
                <div className="flex gap-2 bg-amber-50 border border-amber-200 rounded-xl p-3">
                  <Info size={16} className="text-amber-600 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-amber-700">This order needs admin confirmation before payment. We'll notify you when it's confirmed so you can pay.</p>
                </div>
              )}
              <div className="bg-gray-50 rounded-xl p-4 space-y-2">
                <h3 className="text-sm font-bold text-gray-700">Items</h3>
                {items.map((i) => (
                  <div key={i.id} className="flex justify-between text-sm">
                    <span className="text-gray-600">{i.livestock_name} · {i.quantity} {UNIT_LABELS[i.unit as Unit] ?? i.unit}{i.preparation_types.length ? ` · ${i.preparation_types.join(', ')}` : ''}</span>
                    <span className="font-semibold">{fmt(i.subtotal)}</span>
                  </div>
                ))}
              </div>
              <div className="bg-blue-50 rounded-xl p-4 space-y-1">
                <div className="flex justify-between text-sm"><span className="text-gray-600">Subtotal</span><span className="font-semibold">{fmt(subtotal)}</span></div>
                <div className="flex justify-between text-sm"><span className="text-gray-600">Fulfillment</span><span className="font-semibold capitalize">{fulfillment}{fulfillment === 'delivery' && selectedLocation ? ` · ${selectedLocation.name}` : ''}</span></div>
                {deliveryFee > 0 && <div className="flex justify-between text-sm"><span className="text-gray-600">Delivery Fee</span><span className="font-semibold">{fmt(deliveryFee)}</span></div>}
                <div className="flex justify-between text-sm font-bold border-t border-blue-200 pt-1"><span>Total</span><span className="text-blue-700">{fmt(total)}</span></div>
              </div>
              {fulfillment === 'delivery' && (
                <div className="bg-gray-50 rounded-xl p-4">
                  <h3 className="text-sm font-bold text-gray-700 mb-1 flex items-center gap-1"><MapPin size={14} />Delivery Address</h3>
                  <p className="text-sm text-gray-600">{form.address || '—'}</p>
                </div>
              )}
              {fulfillment === 'pickup' && pickupTime && (
                <div className="bg-gray-50 rounded-xl p-4">
                  <h3 className="text-sm font-bold text-gray-700 mb-1 flex items-center gap-1"><Clock size={14} />Pickup Time</h3>
                  <p className="text-sm text-gray-600">{pickupTime}</p>
                </div>
              )}
              <div className="bg-gray-50 rounded-xl p-4 space-y-1">
                <h3 className="text-sm font-bold text-gray-700">Contact</h3>
                <p className="text-sm text-gray-600">{form.name}</p>
                {form.email && <p className="text-sm text-gray-600">{form.email}</p>}
                <p className="text-sm text-gray-600">{form.phone}</p>
              </div>
              {errors.submit && <p className="text-sm text-red-500">{errors.submit}</p>}
              <button onClick={submitOrder} disabled={submitting} className="w-full flex items-center justify-center gap-2 bg-blue-700 hover:bg-blue-800 disabled:bg-gray-300 text-white font-semibold py-3 rounded-xl transition-colors">
                {submitting ? <div className="w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin" /> : <CheckCircle2 size={18} />}
                {requiresConfirmation ? 'Place Order (await confirmation)' : 'Confirm & Place Order'}
              </button>
            </div>
          )}
        </div>

        <div className="sticky bottom-0 bg-white border-t border-gray-100 p-4 flex items-center justify-between">
          {stepIdx > 0 ? (
            <button onClick={prev} className="flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900 font-medium"><ChevronLeft size={16} />Back</button>
          ) : <div />}
          {stepIdx < steps.length - 1 && (
            <button onClick={next} className="flex items-center gap-1 bg-blue-700 hover:bg-blue-800 text-white px-5 py-2.5 rounded-xl text-sm font-semibold transition-colors">
              Continue <ChevronRight size={16} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
