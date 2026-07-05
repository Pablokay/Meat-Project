import { useEffect } from 'react';
import { X, Trash2, ShoppingBag, ChevronRight } from 'lucide-react';
import { UNIT_LABELS, type CartItem, type Unit } from '../lib/supabase';

type CartDrawerProps = {
  open: boolean;
  items: CartItem[];
  onClose: () => void;
  onUpdateQuantity: (itemId: string, quantity: number) => void;
  onRemoveItem: (itemId: string) => void;
  onCheckout: () => void;
  onContinueShopping: () => void;
};

function fmt(n: number) {
  return new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 0 }).format(n);
}

export default function CartDrawer({ open, items, onClose, onUpdateQuantity, onRemoveItem, onCheckout, onContinueShopping }: CartDrawerProps) {
  const subtotal = items.reduce((s, i) => s + i.subtotal, 0);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  return (
    <div className={`fixed inset-0 z-[55] ${open ? '' : 'pointer-events-none'}`} aria-hidden={!open}>
      <div className={`absolute inset-0 bg-forest-900/40 transition-opacity duration-300 ${open ? 'opacity-100' : 'opacity-0'}`} onClick={onClose} />
      <aside
        role="dialog"
        aria-label="Shopping cart"
        className={`absolute right-0 top-0 h-full w-full sm:w-[420px] bg-cream flex flex-col transition-transform duration-300 ${open ? 'translate-x-0' : 'translate-x-full'}`}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-forest-700/10">
          <h2 className="text-lg font-bold text-forest-900 flex items-center gap-2"><ShoppingBag size={18} />Your Cart <span className="text-forest-800/40 font-normal">({items.length})</span></h2>
          <button onClick={onClose} className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-forest-50 text-forest-800/60" aria-label="Close cart"><X size={20} /></button>
        </div>

        {items.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center px-6">
            <div className="w-16 h-16 rounded-full bg-sage-100 flex items-center justify-center mb-4"><ShoppingBag size={28} className="text-forest-700" /></div>
            <p className="text-forest-900 font-semibold">Your cart is empty</p>
            <p className="text-forest-800/50 text-sm mt-1 mb-5">Add some fresh picks to get started.</p>
            <button onClick={onContinueShopping} className="btn-primary">Browse shop <ChevronRight size={16} /></button>
          </div>
        ) : (
          <>
            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
              {items.map((item) => (
                <div key={item.id} className="bg-paper rounded-lg border border-forest-700/10 p-3 flex gap-3">
                  <div className="w-16 h-16 flex-shrink-0 rounded-lg overflow-hidden bg-sand">
                    <img src={item.livestock_image} alt={item.livestock_name} className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-bold text-forest-900 truncate">{item.livestock_name}</p>
                      <button onClick={() => onRemoveItem(item.id)} className="text-forest-800/30 hover:text-red-600" aria-label="Remove item"><Trash2 size={15} /></button>
                    </div>
                    <p className="text-xs text-forest-800/50">{UNIT_LABELS[item.unit as Unit] ?? item.unit}{item.preparation_types?.length ? ` · ${item.preparation_types.join(', ')}` : ''}</p>
                    <div className="mt-2 flex items-center justify-between">
                      <div className="flex items-center border border-forest-700/15 rounded-lg">
                        <button onClick={() => onUpdateQuantity(item.id, Math.max(1, item.quantity - 1))} className="w-7 h-7 flex items-center justify-center text-forest-800/70 hover:bg-forest-50 rounded-l-lg">−</button>
                        <span className="w-7 text-center text-sm font-semibold">{item.quantity}</span>
                        <button onClick={() => onUpdateQuantity(item.id, item.quantity + 1)} className="w-7 h-7 flex items-center justify-center text-forest-800/70 hover:bg-forest-50 rounded-r-lg">+</button>
                      </div>
                      <span className="text-sm font-bold text-forest-900">{fmt(item.subtotal)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="border-t border-forest-700/10 p-5 space-y-3 bg-cream">
              <div className="flex justify-between text-sm text-forest-800/70"><span>Subtotal</span><span className="font-bold text-forest-900">{fmt(subtotal)}</span></div>
              <p className="text-xs text-forest-800/40">Delivery fee is calculated at checkout.</p>
              <button onClick={onCheckout} className="btn-primary w-full">Checkout <ChevronRight size={16} /></button>
              <button onClick={onContinueShopping} className="btn-outline w-full">Continue shopping</button>
            </div>
          </>
        )}
      </aside>
    </div>
  );
}
