import { useState, useEffect, useRef } from 'react';
import { X, ChevronRight, ChevronLeft, Scale, Package, Truck, Store, User, Phone, Mail, MessageCircle, MapPin, Building2, Smartphone, CircleCheck as CheckCircle2, Copy, Upload, Flame, Snowflake, ShoppingBag } from 'lucide-react';
import { supabase, type Livestock, type DeliverySlot, type BankAccount, type AdminSetting } from '../lib/supabase';

const DELIVERY_FEE = 2500;

type OrderModalProps = {
  livestock: Livestock;
  onClose: () => void;
  onSuccess: (orderNumber: string, accessToken: string) => void;
  onAddToCart?: (item: any) => void;
};

type Step = 'quantity' | 'options' | 'customer' | 'delivery' | 'payment' | 'confirm';

function fmt(n: number) {
  return new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 }).format(n);
}

const steps: { key: Step; label: string }[] = [
  { key: 'quantity', label: 'Quantity' },
  { key: 'options', label: 'Options' },
  { key: 'customer', label: 'Your Info' },
  { key: 'delivery', label: 'Delivery' },
  { key: 'payment', label: 'Payment' },
  { key: 'confirm', label: 'Review' },
];

export default function OrderModal({ livestock, onClose, onSuccess, onAddToCart }: OrderModalProps) {
  const [step, setStep] = useState<Step>('quantity');
  const [unit, setUnit] = useState<'kg' | 'portion'>(livestock.unit_options.includes('kg') ? 'kg' : 'portion');
  const [quantity, setQuantity] = useState(1);
  const [preparationType, setPreparationType] = useState<string>('Fresh');
  const [availablePreparationTypes, setAvailablePreparationTypes] = useState<string[]>(['Fresh', 'Roasted']);
  const [portionSize, setPortionSize] = useState<'full' | 'half' | 'quarter'>('full');
  const [customerComment, setCustomerComment] = useState('');
  const [commentEnabled, setCommentEnabled] = useState(true);
  const [commentLabel, setCommentLabel] = useState('Additional Comments');
  const [fulfillment, setFulfillment] = useState<'delivery' | 'pickup'>('pickup');
  const [selectedSlot, setSelectedSlot] = useState<DeliverySlot | null>(null);
  const [slots, setSlots] = useState<DeliverySlot[]>([]);
  const [banks, setBanks] = useState<BankAccount[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<'bank_transfer' | 'virtual'>('bank_transfer');
  const [paymentRef, setPaymentRef] = useState('');
  const [paymentProofUrl, setPaymentProofUrl] = useState('');
  const [uploadingProof, setUploadingProof] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [copied, setCopied] = useState('');
  const [form, setForm] = useState({
    name: '', email: '', phone: '', whatsapp: '', address: '', notes: ''
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const proofInputRef = useRef<HTMLInputElement>(null);

  function getPortionPrice(): number {
    if (portionSize === 'full' && livestock.price_full) return livestock.price_full;
    if (portionSize === 'half' && livestock.price_half) return livestock.price_half;
    if (portionSize === 'quarter' && livestock.price_quarter) return livestock.price_quarter;
    return livestock.price_per_portion ?? livestock.price_per_kg;
  }

  const unitPrice = unit === 'kg' ? livestock.price_per_kg : getPortionPrice();
  const subtotal = unitPrice * quantity;
  const deliveryFee = fulfillment === 'delivery' ? DELIVERY_FEE : 0;
  const total = subtotal + deliveryFee;

  useEffect(() => {
    supabase.from('delivery_slots').select('*').gte('slot_date', new Date().toISOString().split('T')[0]).eq('is_active', true).order('slot_date').then(({ data }) => setSlots(data ?? []));
    supabase.from('bank_accounts').select('*').eq('is_active', true).then(({ data }) => setBanks(data ?? []));
    supabase.from('admin_settings').select('*').in('key', ['comment_field_enabled', 'comment_field_label', 'preparation_types']).then(({ data }) => {
      if (data) {
        const ce = data.find((s: AdminSetting) => s.key === 'comment_field_enabled');
        const cl = data.find((s: AdminSetting) => s.key === 'comment_field_label');
        const ps = data.find((s: AdminSetting) => s.key === 'preparation_types');
        if (ce) setCommentEnabled(ce.value === 'true');
        if (cl) setCommentLabel(cl.value || 'Additional Comments');
        if (ps) {
          try {
            const types = JSON.parse(ps.value);
            setAvailablePreparationTypes(types);
            setPreparationType(types[0] || 'Fresh');
          } catch {
            setAvailablePreparationTypes(['Fresh', 'Roasted']);
          }
        }
      }
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

  function validate(step: Step): boolean {
    const e: Record<string, string> = {};
    if (step === 'customer') {
      if (!form.name.trim()) e.name = 'Required';
      if (!form.email.trim()) e.email = 'Required';
      else if (!/\S+@\S+\.\S+/.test(form.email)) e.email = 'Invalid email';
      if (!form.phone.trim()) e.phone = 'Required';
    }
    if (step === 'delivery' && fulfillment === 'delivery') {
      if (!form.address.trim()) e.address = 'Required';
      if (!selectedSlot) e.slot = 'Select a slot';
    }
    if (step === 'payment') {
      if (!paymentRef.trim()) e.ref = 'Enter payment reference';
    }
    setErrors(e);
    return Object.keys(e).length === 0;
  }

  function next() {
    const idx = steps.findIndex(s => s.key === step);
    if (idx < steps.length - 1) {
      if (!validate(step)) return;
      setStep(steps[idx + 1].key);
    }
  }

  function prev() {
    const idx = steps.findIndex(s => s.key === step);
    if (idx > 0) setStep(steps[idx - 1].key);
  }

  async function submitOrder() {
    setSubmitting(true);
    const { data, error } = await supabase.from('orders').insert({
      customer_name: form.name,
      customer_email: form.email,
      customer_phone: form.phone,
      customer_whatsapp: form.whatsapp || form.phone,
      livestock_id: livestock.id,
      livestock_name: livestock.name,
      quantity,
      unit,
      unit_price: unitPrice,
      subtotal,
      delivery_fee: deliveryFee,
      total_amount: total,
      fulfillment_type: fulfillment,
      delivery_address: fulfillment === 'delivery' ? form.address : '',
      delivery_slot_id: selectedSlot?.id ?? null,
      delivery_date: selectedSlot?.slot_date ?? null,
      delivery_slot_label: selectedSlot?.slot_label ?? '',
      payment_method: paymentMethod,
      payment_reference: paymentRef,
      payment_proof_url: paymentProofUrl,
      payment_status: 'pending',
      order_status: 'pending',
      preparation_type: preparationType,
      portion_size: portionSize,
      customer_comment: customerComment,
      notes: form.notes,
    }).select('order_number, access_token').single();

    if (!error && data) {
      if (selectedSlot) {
        await supabase.from('delivery_slots').update({ current_orders: selectedSlot.current_orders + 1 }).eq('id', selectedSlot.id);
      }
      await supabase.from('order_updates').insert({ order_id: data.order_number, status: 'pending', message: 'Order received and awaiting confirmation.', created_by: 'system' });
      onSuccess(data.order_number, data.access_token);
    }
    setSubmitting(false);
  }

  const stepIdx = steps.findIndex(s => s.key === step);

  function copyText(text: string, label: string) {
    navigator.clipboard.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied(''), 2000);
  }

  const slotsByDate: Record<string, DeliverySlot[]> = {};
  slots.forEach(s => {
    if (!slotsByDate[s.slot_date]) slotsByDate[s.slot_date] = [];
    slotsByDate[s.slot_date].push(s);
  });

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl w-full sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white z-10 border-b border-gray-100 p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-bold text-gray-900">Order: {livestock.name}</h2>
            <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600"><X size={20} /></button>
          </div>
          <div className="flex items-center gap-1">
            {steps.map((s, i) => (
              <div key={s.key} className="flex-1 flex items-center gap-1">
                <div className={`flex-1 h-1.5 rounded-full transition-colors ${i <= stepIdx ? 'bg-blue-600' : 'bg-gray-200'}`} />
              </div>
            ))}
          </div>
          <p className="text-xs text-gray-500 mt-2">{steps[stepIdx].label} (Step {stepIdx + 1} of {steps.length})</p>
        </div>

        <div className="p-5">
          {step === 'quantity' && (
            <div className="space-y-5">
              <div>
                <p className="text-sm font-semibold text-gray-700 mb-2">Unit</p>
                <div className="grid grid-cols-2 gap-3">
                  {livestock.unit_options.includes('kg') && (
                    <button onClick={() => setUnit('kg')} className={`p-4 rounded-xl border-2 flex flex-col items-center gap-1 transition-all ${unit === 'kg' ? 'border-blue-600 bg-blue-50' : 'border-gray-200 hover:border-gray-300'}`}>
                      <Scale size={20} className={unit === 'kg' ? 'text-blue-600' : 'text-gray-400'} />
                      <span className={`text-sm font-bold ${unit === 'kg' ? 'text-blue-700' : 'text-gray-600'}`}>Per KG</span>
                      <span className="text-xs text-gray-500">{fmt(livestock.price_per_kg)}</span>
                    </button>
                  )}
                  {livestock.unit_options.includes('portion') && (
                    <button onClick={() => setUnit('portion')} className={`p-4 rounded-xl border-2 flex flex-col items-center gap-1 transition-all ${unit === 'portion' ? 'border-blue-600 bg-blue-50' : 'border-gray-200 hover:border-gray-300'}`}>
                      <Package size={20} className={unit === 'portion' ? 'text-blue-600' : 'text-gray-400'} />
                      <span className={`text-sm font-bold ${unit === 'portion' ? 'text-blue-700' : 'text-gray-600'}`}>Per Portion</span>
                      <span className="text-xs text-gray-500">{fmt(livestock.price_per_portion ?? livestock.price_per_kg)}</span>
                    </button>
                  )}
                </div>
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-700 mb-2">Quantity ({unit})</p>
                <div className="flex items-center gap-4">
                  <button onClick={() => setQuantity(Math.max(1, quantity - 1))} className="w-10 h-10 rounded-xl border border-gray-200 flex items-center justify-center text-gray-600 hover:bg-gray-50 text-lg font-bold">-</button>
                  <span className="text-2xl font-bold text-gray-900 w-12 text-center">{quantity}</span>
                  <button onClick={() => setQuantity(quantity + 1)} className="w-10 h-10 rounded-xl border border-gray-200 flex items-center justify-center text-gray-600 hover:bg-gray-50 text-lg font-bold">+</button>
                </div>
              </div>
              <div className="bg-blue-50 rounded-xl p-4 space-y-1">
                <div className="flex justify-between text-sm"><span className="text-gray-600">Unit Price</span><span className="font-semibold">{fmt(unitPrice)}</span></div>
                <div className="flex justify-between text-sm"><span className="text-gray-600">Quantity</span><span className="font-semibold">{quantity} {unit}{quantity > 1 ? 's' : ''}</span></div>
                <div className="flex justify-between text-sm font-bold border-t border-blue-200 pt-1"><span>Subtotal</span><span className="text-blue-700">{fmt(subtotal)}</span></div>
              </div>
            </div>
          )}

          {step === 'options' && (
            <div className="space-y-5">
              {unit === 'portion' && (
                <div>
                  <p className="text-sm font-semibold text-gray-700 mb-2">Portion Size</p>
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { key: 'full' as const, label: 'Full', desc: 'Whole animal', price: livestock.price_full },
                      { key: 'half' as const, label: 'Half', desc: 'Half portion', price: livestock.price_half },
                      { key: 'quarter' as const, label: 'Quarter', desc: 'Quarter portion', price: livestock.price_quarter },
                    ].map(({ key, label, desc, price }) => (
                      <button key={key} onClick={() => setPortionSize(key)} className={`p-3 rounded-xl border-2 flex flex-col items-center gap-1 transition-all ${portionSize === key ? 'border-blue-600 bg-blue-50' : 'border-gray-200 hover:border-gray-300'}`}>
                        <span className={`text-sm font-bold ${portionSize === key ? 'text-blue-700' : 'text-gray-600'}`}>{label}</span>
                        <span className="text-[10px] text-gray-500">{desc}</span>
                        {price && <span className={`text-xs font-bold mt-0.5 ${portionSize === key ? 'text-blue-700' : 'text-gray-500'}`}>{fmt(price)}</span>}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <div>
                <p className="text-sm font-semibold text-gray-700 mb-2">Preparation Type</p>
                <div className={`grid gap-3 ${availablePreparationTypes.length === 2 ? 'grid-cols-2' : availablePreparationTypes.length === 1 ? 'grid-cols-1' : 'grid-cols-2 sm:grid-cols-3'}`}>
                  {availablePreparationTypes.map((type) => {
                    const getIcon = () => {
                      if (type.toLowerCase() === 'fresh') return <Snowflake size={20} />;
                      if (type.toLowerCase() === 'roasted') return <Flame size={20} />;
                      return <span className="text-lg">🍖</span>;
                    };
                    const isSelected = preparationType === type;
                    return (
                      <button 
                        key={type}
                        onClick={() => setPreparationType(type)} 
                        className={`p-4 rounded-xl border-2 flex flex-col items-center gap-2 transition-all ${isSelected ? 'border-blue-600 bg-blue-50' : 'border-gray-200 hover:border-gray-300'}`}
                      >
                        <div className={isSelected ? 'text-blue-600' : 'text-gray-400'}>
                          {getIcon()}
                        </div>
                        <span className={`text-sm font-bold ${isSelected ? 'text-blue-700' : 'text-gray-600'}`}>{type}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
              {commentEnabled && (
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1">{commentLabel} (optional)</label>
                  <textarea placeholder="Any special instructions or requests..." value={customerComment} onChange={e => setCustomerComment(e.target.value)} rows={3} className="w-full px-4 py-2.5 border-2 border-gray-200 rounded-xl text-sm focus:outline-none focus:border-blue-400 resize-none" />
                </div>
              )}
            </div>
          )}

          {step === 'customer' && (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Full Name *</label>
                <div className="relative">
                  <User size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input type="text" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="John Doe" className={`w-full pl-9 pr-4 py-2.5 border-2 rounded-xl text-sm focus:outline-none ${errors.name ? 'border-red-400 focus:border-red-500' : 'border-gray-200 focus:border-blue-400'}`} />
                </div>
                {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name}</p>}
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Email *</label>
                <div className="relative">
                  <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="you@example.com" className={`w-full pl-9 pr-4 py-2.5 border-2 rounded-xl text-sm focus:outline-none ${errors.email ? 'border-red-400 focus:border-red-500' : 'border-gray-200 focus:border-blue-400'}`} />
                </div>
                {errors.email && <p className="text-xs text-red-500 mt-1">{errors.email}</p>}
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Phone Number *</label>
                <div className="relative">
                  <Phone size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input type="tel" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} placeholder="+234 800 000 0000" className={`w-full pl-9 pr-4 py-2.5 border-2 rounded-xl text-sm focus:outline-none ${errors.phone ? 'border-red-400 focus:border-red-500' : 'border-gray-200 focus:border-blue-400'}`} />
                </div>
                {errors.phone && <p className="text-xs text-red-500 mt-1">{errors.phone}</p>}
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">WhatsApp Number</label>
                <div className="relative">
                  <MessageCircle size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input type="tel" value={form.whatsapp} onChange={e => setForm(f => ({ ...f, whatsapp: e.target.value }))} placeholder="Same as phone if empty" className="w-full pl-9 pr-4 py-2.5 border-2 border-gray-200 rounded-xl text-sm focus:outline-none focus:border-blue-400" />
                </div>
              </div>
            </div>
          )}

          {step === 'delivery' && (
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
                    <span className="text-xs text-gray-500">{fmt(DELIVERY_FEE)}</span>
                  </button>
                </div>
              </div>
              {fulfillment === 'delivery' && (
                <>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1">Delivery Address *</label>
                    <div className="relative">
                      <MapPin size={16} className="absolute left-3 top-3 text-gray-400" />
                      <textarea value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} placeholder="Enter your delivery address..." rows={2} className={`w-full pl-9 pr-4 py-2.5 border-2 rounded-xl text-sm focus:outline-none resize-none ${errors.address ? 'border-red-400' : 'border-gray-200 focus:border-blue-400'}`} />
                    </div>
                    {errors.address && <p className="text-xs text-red-500 mt-1">{errors.address}</p>}
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Select Delivery Slot *</label>
                    {errors.slot && <p className="text-xs text-red-500 mb-2">{errors.slot}</p>}
                    <div className="space-y-3 max-h-60 overflow-y-auto">
                      {Object.entries(slotsByDate).map(([date, dateSlots]) => (
                        <div key={date}>
                          <p className="text-xs font-semibold text-gray-500 mb-1.5">
                            {new Date(date + 'T12:00:00').toLocaleDateString('en-NG', { weekday: 'long', month: 'long', day: 'numeric' })}
                          </p>
                          <div className="space-y-1.5">
                            {dateSlots.map(slot => {
                              const remaining = slot.max_orders - slot.current_orders;
                              const isFull = remaining <= 0;
                              return (
                                <button key={slot.id} onClick={() => !isFull && setSelectedSlot(slot)} disabled={isFull} className={`w-full flex items-center justify-between p-3 rounded-xl border-2 transition-all text-left ${selectedSlot?.id === slot.id ? 'border-blue-600 bg-blue-50' : isFull ? 'border-gray-100 bg-gray-50 opacity-50 cursor-not-allowed' : 'border-gray-200 hover:border-gray-300'}`}>
                                  <div>
                                    <p className="text-sm font-medium text-gray-900">{slot.slot_label}</p>
                                  </div>
                                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${isFull ? 'bg-red-100 text-red-600' : remaining <= 2 ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'}`}>
                                    {isFull ? 'Full' : `${remaining} left`}
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
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
                  {banks.map(b => (
                    <div key={b.id} className="bg-gray-50 rounded-xl p-4 space-y-1">
                      <p className="text-xs text-gray-500">{b.bank_name}</p>
                      <div className="flex items-center justify-between">
                        <p className="text-sm font-bold text-gray-900">{b.account_number}</p>
                        <button onClick={() => copyText(b.account_number, b.id)} className="text-xs text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1">
                          <Copy size={11} />{copied === b.id ? 'Copied!' : 'Copy'}
                        </button>
                      </div>
                      <p className="text-xs text-gray-600">{b.account_name}</p>
                      {b.sort_code && <p className="text-xs text-gray-400">Sort: {b.sort_code}</p>}
                    </div>
                  ))}
                </div>
              )}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Payment Reference *</label>
                <input type="text" value={paymentRef} onChange={e => setPaymentRef(e.target.value)} placeholder="Enter your payment reference" className={`w-full px-4 py-2.5 border-2 rounded-xl text-sm focus:outline-none ${errors.ref ? 'border-red-400' : 'border-gray-200 focus:border-blue-400'}`} />
                {errors.ref && <p className="text-xs text-red-500 mt-1">{errors.ref}</p>}
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Upload Payment Proof (optional)</label>
                <input ref={proofInputRef} type="file" accept="image/*,.pdf" className="hidden" onChange={e => e.target.files?.[0] && uploadProof(e.target.files[0])} />
                <button onClick={() => proofInputRef.current?.click()} disabled={uploadingProof} className="w-full flex items-center justify-center gap-2 border-2 border-dashed border-gray-200 rounded-xl py-4 text-sm text-gray-500 hover:border-blue-300 hover:text-blue-600 transition-colors">
                  {uploadingProof ? <div className="w-4 h-4 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" /> : <Upload size={16} />}
                  {paymentProofUrl ? 'Proof uploaded' : 'Click to upload'}
                </button>
              </div>
            </div>
          )}

          {step === 'confirm' && (
            <div className="space-y-4">
              <div className="bg-blue-50 rounded-xl p-4 space-y-2">
                <h3 className="text-sm font-bold text-blue-700">Order Summary</h3>
                <div className="flex justify-between text-sm"><span className="text-gray-600">Item</span><span className="font-semibold">{livestock.name}</span></div>
                <div className="flex justify-between text-sm"><span className="text-gray-600">Quantity</span><span className="font-semibold">{quantity} {unit}{quantity > 1 ? 's' : ''}</span></div>
                {unit === 'portion' && <div className="flex justify-between text-sm"><span className="text-gray-600">Portion</span><span className="font-semibold capitalize">{portionSize}</span></div>}
                <div className="flex justify-between text-sm"><span className="text-gray-600">Preparation</span><span className="font-semibold capitalize">{preparationType}</span></div>
                <div className="flex justify-between text-sm"><span className="text-gray-600">Fulfillment</span><span className="font-semibold capitalize">{fulfillment}</span></div>
                {fulfillment === 'delivery' && selectedSlot && <div className="flex justify-between text-sm"><span className="text-gray-600">Slot</span><span className="font-semibold">{selectedSlot.slot_label}</span></div>}
                <div className="flex justify-between text-sm font-bold border-t border-blue-200 pt-2"><span>Total</span><span className="text-blue-700">{fmt(total)}</span></div>
              </div>
              <div className="bg-gray-50 rounded-xl p-4 space-y-1.5">
                <h3 className="text-sm font-bold text-gray-700">Customer Details</h3>
                <p className="text-sm text-gray-600">{form.name}</p>
                <p className="text-sm text-gray-600">{form.email}</p>
                <p className="text-sm text-gray-600">{form.phone}</p>
              </div>
              <button onClick={submitOrder} disabled={submitting} className="flex-1 flex items-center justify-center gap-2 bg-blue-700 hover:bg-blue-800 disabled:bg-gray-300 text-white font-semibold py-3 rounded-xl transition-colors">
                {submitting ? <div className="w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin" /> : <CheckCircle2 size={18} />}
                Confirm & Place Order
              </button>
              {onAddToCart && (
                <button 
                  onClick={() => {
                    const cartItem = {
                      id: `cart_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                      livestock_id: livestock.id,
                      livestock_name: livestock.name,
                      livestock_image: livestock.image_url,
                      livestock_type: livestock.type,
                      quantity,
                      unit,
                      unit_price: unitPrice,
                      preparation_type: preparationType,
                      portion_size: unit === 'portion' ? portionSize : undefined,
                      subtotal,
                      added_at: new Date().toISOString(),
                    };
                    onAddToCart(cartItem);
                    onClose();
                  }}
                  disabled={submitting}
                  className="flex-1 flex items-center justify-center gap-2 border-2 border-blue-700 text-blue-700 hover:bg-blue-50 disabled:opacity-50 font-semibold py-3 rounded-xl transition-colors"
                >
                  <ShoppingBag size={18} />
                  Add to Cart
                </button>
              )}
            </div>
          )}
        </div>

        <div className="sticky bottom-0 bg-white border-t border-gray-100 p-4 flex items-center justify-between">
          {stepIdx > 0 ? (
            <button onClick={prev} className="flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900 font-medium">
              <ChevronLeft size={16} /> Back
            </button>
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
