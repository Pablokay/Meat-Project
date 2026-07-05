import { useState, useEffect, useRef } from 'react';
import { X, Copy, Upload, Building2, CircleCheck as CheckCircle2 } from 'lucide-react';
import { supabase, type Order, type BankAccount } from '../lib/supabase';
import { useToast } from './Toast';

type PayNowModalProps = {
  order: Order;
  onClose: () => void;
  onPaid: () => void;
};

function fmt(n: number) {
  return new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 }).format(n);
}

export default function PayNowModal({ order, onClose, onPaid }: PayNowModalProps) {
  const toast = useToast();
  const [banks, setBanks] = useState<BankAccount[]>([]);
  const [reference, setReference] = useState(order.payment_reference || '');
  const [proofUrl, setProofUrl] = useState(order.payment_proof_url || '');
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [copied, setCopied] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    supabase.from('bank_accounts').select('*').eq('is_active', true).then(({ data }) => setBanks(data ?? []));
  }, []);

  async function uploadProof(file: File) {
    setUploading(true);
    const ext = file.name.split('.').pop();
    const path = `proofs/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
    const { error } = await supabase.storage.from('order-proof').upload(path, file);
    if (!error) {
      const { data } = supabase.storage.from('order-proof').getPublicUrl(path);
      setProofUrl(data.publicUrl);
    }
    setUploading(false);
  }

  function copyText(text: string, id: string) {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(''), 2000);
  }

  async function submit() {
    setSubmitting(true);
    await supabase.from('orders').update({
      payment_reference: reference,
      payment_proof_url: proofUrl,
      updated_at: new Date().toISOString(),
    }).eq('id', order.id);
    await supabase.from('order_updates').insert({
      order_id: order.id, status: order.order_status,
      message: `Customer submitted payment${reference ? ` (ref: ${reference})` : ''}. Awaiting confirmation.`,
      created_by: 'customer',
    });
    await supabase.from('notifications').insert({
      recipient_type: 'admin', title: 'Payment submitted',
      body: `Order #${order.order_number} — customer marked as paid${reference ? ` (ref ${reference})` : ''}.`,
      type: 'payment', order_id: order.id,
    });
    setSubmitting(false);
    toast('Payment submitted — we\'ll confirm shortly');
    onPaid();
    onClose();
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-forest-900/50" onClick={onClose} />
      <div className="relative bg-paper rounded-lg w-full sm:max-w-md max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-paper border-b border-forest-700/10 p-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-forest-900">Complete Payment</h2>
          <button onClick={onClose} className="text-forest-800/40 hover:text-forest-800"><X size={20} /></button>
        </div>
        <div className="p-5 space-y-4">
          <div className="bg-cream rounded-lg p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-forest-800/50">Order #{order.order_number}</p>
              <p className="text-sm text-forest-800/70">Amount due</p>
            </div>
            <p className="text-2xl font-bold text-forest-900">{fmt(order.total_amount)}</p>
          </div>

          <div>
            <p className="text-sm font-semibold text-forest-800 mb-2 flex items-center gap-1.5"><Building2 size={15} />Transfer to any account</p>
            <div className="space-y-2">
              {banks.map((b) => (
                <div key={b.id} className="bg-cream rounded-lg p-3 border border-forest-700/10">
                  <p className="text-xs text-forest-800/50">{b.bank_name}</p>
                  <div className="flex items-center justify-between">
                    <p className="text-base font-bold text-forest-900 tracking-wider">{b.account_number}</p>
                    <button onClick={() => copyText(b.account_number, b.id)} className="text-xs text-forest-700 font-semibold flex items-center gap-1"><Copy size={12} />{copied === b.id ? 'Copied!' : 'Copy'}</button>
                  </div>
                  <p className="text-xs text-forest-800/60">{b.account_name}</p>
                </div>
              ))}
              {banks.length === 0 && <p className="text-xs text-forest-800/50">Bank details will be shared by our team.</p>}
            </div>
          </div>

          <div>
            <label className="block text-sm font-semibold text-forest-800 mb-1">Payment Reference <span className="font-normal text-forest-800/50">(optional)</span></label>
            <input type="text" value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Transaction reference" className="w-full px-4 py-2.5 border-2 border-forest-700/15 rounded-lg text-sm focus:outline-none focus:border-forest-500 bg-cream" />
          </div>
          <div>
            <label className="block text-sm font-semibold text-forest-800 mb-1">Upload Proof <span className="font-normal text-forest-800/50">(optional)</span></label>
            <input ref={fileRef} type="file" accept="image/*,.pdf" className="hidden" onChange={(e) => e.target.files?.[0] && uploadProof(e.target.files[0])} />
            <button onClick={() => fileRef.current?.click()} disabled={uploading} className="w-full flex items-center justify-center gap-2 border-2 border-dashed border-forest-700/15 rounded-lg py-3.5 text-sm text-forest-800/60 hover:border-forest-400 hover:text-forest-700 transition-colors">
              {uploading ? <div className="w-4 h-4 border-2 border-forest-400 border-t-transparent rounded-full animate-spin" /> : <Upload size={16} />}
              {proofUrl ? 'Proof uploaded' : 'Click to upload'}
            </button>
          </div>

          <button onClick={submit} disabled={submitting} className="btn-primary w-full">
            {submitting ? <div className="w-5 h-5 border-2 border-cream/40 border-t-cream rounded-full animate-spin" /> : <CheckCircle2 size={18} />}I've Made Payment
          </button>
          <p className="text-xs text-forest-800/50 text-center">Our team will confirm your payment and update your order.</p>
        </div>
      </div>
    </div>
  );
}
