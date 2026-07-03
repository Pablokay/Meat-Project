import { Home, Search, ShoppingBag, User } from 'lucide-react';

type BottomNavProps = {
  currentPage: 'shop' | 'track' | 'cart';
  onNavigate: (page: 'shop' | 'track' | 'admin' | 'user' | 'cart') => void;
  cartCount?: number;
  isLoggedIn?: boolean;
};

export default function BottomNav({ currentPage, onNavigate, cartCount = 0, isLoggedIn }: BottomNavProps) {
  const items = [
    { key: 'shop' as const, label: 'Shop', icon: Home, active: currentPage === 'shop' },
    { key: 'track' as const, label: 'Track', icon: Search, active: currentPage === 'track' },
    { key: 'cart' as const, label: 'Cart', icon: ShoppingBag, active: currentPage === 'cart', badge: cartCount },
    { key: 'user' as const, label: isLoggedIn ? 'Account' : 'Sign In', icon: User, active: false },
  ];

  return (
    <nav className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-cream/90 backdrop-blur border-t border-forest-700/10">
      <div className="grid grid-cols-4">
        {items.map(({ key, label, icon: Icon, active, badge }) => (
          <button key={key} onClick={() => onNavigate(key)} className={`relative flex flex-col items-center justify-center gap-0.5 py-2.5 ${active ? 'text-forest-700' : 'text-forest-800/50'}`}>
            <div className="relative">
              <Icon size={20} strokeWidth={active ? 2.2 : 1.75} />
              {badge && badge > 0 ? <span className="absolute -top-1.5 -right-2 bg-forest-700 text-cream text-[9px] font-bold rounded-full min-w-[15px] h-[15px] flex items-center justify-center px-1">{badge}</span> : null}
            </div>
            <span className="text-[10px] font-semibold">{label}</span>
          </button>
        ))}
      </div>
    </nav>
  );
}
