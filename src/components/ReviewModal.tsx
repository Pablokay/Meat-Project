import { useState, useEffect } from 'react';
import { X, Star, CircleCheck as CheckCircle2 } from 'lucide-react';
import { supabase, type Order, type OrderItem } from '../lib/supabase';
import { useToast } from './Toast';

type ReviewModalProps = {
  order: Order;
  onClose: () => void;
  onDone: () => void;
};

type Entry = { livestock_id: string; name: string; rating: number; comment: string };

export default function ReviewModal({ order, onClose, onDone }: ReviewModalProps) {
  const toast = useToast();
  const [entries, setEntries] = useState<Entry[]>([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    supabase.from('order_items').select('*').eq('order_id', order.id).then(({ data }) => {
      const seen = new Map<string, string>();
      for (const it of (data ?? []) as OrderItem[]) if (it.livestock_id && !seen.has(it.livestock_id)) seen.set(it.livestock_id, it.livestock_name);
      // fall back to the order header if there are no line items
      if (seen.size === 0 && order.livestock_id) seen.set(order.livestock_id, order.livestock_name);
      setEntries([...seen.entries()].map(([id, name]) => ({ livestock_id: id, name, rating: 5, comment: '' })));
    });
  }, [order.id]);

  function setEntry(id: string, patch: Partial<Entry>) {
    setEntries((prev) => prev.map((e) => (e.livestock_id === id ? { ...e, ...patch } : e)));
  }

  async function submit() {
    setSubmitting(true);
    let anyError = '';
    for (const e of entries) {
      const { error } = await supabase.rpc('submit_review', { p_livestock_id: e.livestock_id, p_order_id: order.id, p_rating: e.rating, p_comment: e.comment });
      if (error) anyError = error.message;
    }
    setSubmitting(false);
    if (anyError) { toast(anyError, 'error'); return; }
    toast('Thanks for your review!');
    onDone();
    onClose();
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center">
      <div className="absolute inset-0 bg-forest-900/50" onClick={onClose} />
      <div className="relative bg-paper rounded-lg w-full sm:max-w-md max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-paper border-b border-forest-700/10 p-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-forest-900">Rate your order</h2>
          <button onClick={onClose} className="text-forest-800/40 hover:text-forest-800"><X size={20} /></button>
        </div>
        <div className="p-5 space-y-5">
          {entries.length === 0 ? <p className="text-sm text-gray-400 text-center py-6">Loading items...</p> : entries.map((e) => (
            <div key={e.livestock_id} className="border border-forest-700/10 rounded-lg p-4">
              <p className="text-sm font-semibold text-forest-900 mb-2">{e.name}</p>
              <div className="flex items-center gap-1 mb-3">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button key={n} onClick={() => setEntry(e.livestock_id, { rating: n })} aria-label={`${n} star`}>
                    <Star size={26} className={n <= e.rating ? 'fill-sage-400 text-sage-400' : 'text-forest-800/20'} />
                  </button>
                ))}
              </div>
              <textarea value={e.comment} onChange={(ev) => setEntry(e.livestock_id, { comment: ev.target.value })} rows={2} placeholder="Share a few words (optional)" className="w-full px-3 py-2 border-2 border-forest-700/15 rounded-lg text-sm focus:outline-none focus:border-forest-500 resize-none bg-cream" />
            </div>
          ))}
          <button onClick={submit} disabled={submitting || entries.length === 0} className="btn-primary w-full">
            {submitting ? <div className="w-5 h-5 border-2 border-cream/40 border-t-cream rounded-full animate-spin" /> : <CheckCircle2 size={18} />}Submit Review
          </button>
        </div>
      </div>
    </div>
  );
}
