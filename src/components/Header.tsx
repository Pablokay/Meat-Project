import { Leaf, Menu, X, Phone, Mail, LogOut, User, ShoppingBag, Bell, Shield } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { supabase, type AdminSetting, type Profile, type Notification } from '../lib/supabase';

type HeaderProps = {
  currentPage: 'shop' | 'track' | 'cart';
  onNavigate: (page: 'shop' | 'track' | 'admin' | 'user' | 'cart') => void;
  onOpenCart?: () => void;
  profile?: Profile | null;
  userType?: 'guest' | 'registered' | null;
  cartCount?: number;
  notifications?: Notification[];
  onOpenNotifications?: () => void;
  onLogout?: () => void;
};

export default function Header({ currentPage, onNavigate, onOpenCart, profile, cartCount = 0, notifications = [], onOpenNotifications, onLogout }: HeaderProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [bellOpen, setBellOpen] = useState(false);
  const [carePhone, setCarePhone] = useState('');
  const [careEmail, setCareEmail] = useState('');
  const bellRef = useRef<HTMLDivElement>(null);

  const unread = notifications.filter((n) => !n.is_read).length;

  useEffect(() => {
    supabase.from('admin_settings').select('*').in('key', ['customer_care_phone', 'customer_care_email']).then(({ data }) => {
      if (data) {
        const phone = data.find((s: AdminSetting) => s.key === 'customer_care_phone');
        const email = data.find((s: AdminSetting) => s.key === 'customer_care_email');
        if (phone?.value) setCarePhone(phone.value);
        if (email?.value) setCareEmail(email.value);
      }
    });
  }, []);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (bellRef.current && !bellRef.current.contains(e.target as Node)) setBellOpen(false);
    }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  function toggleBell() {
    const next = !bellOpen;
    setBellOpen(next);
    if (next) onOpenNotifications?.();
  }

  const navLink = (active: boolean) =>
    `text-sm font-medium transition-colors ${active ? 'text-forest-800' : 'text-forest-800/60 hover:text-forest-800'}`;
  const iconBtn = 'relative w-10 h-10 flex items-center justify-center rounded-full bg-paper border border-forest-700/10 text-forest-800 hover:bg-forest-50 transition-colors';

  return (
    <>
      {(carePhone || careEmail) && (
        <div className="bg-forest-800 text-cream/90 text-xs">
          <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8 py-2 flex items-center justify-between">
            <div className="flex items-center gap-4">
              {carePhone && <a href={`tel:${carePhone}`} className="flex items-center gap-1.5 hover:text-cream transition-colors"><Phone size={12} /><span>{carePhone}</span></a>}
              {careEmail && <a href={`mailto:${careEmail}`} className="hidden sm:flex items-center gap-1.5 hover:text-cream transition-colors"><Mail size={12} /><span>{careEmail}</span></a>}
            </div>
            <span className="text-cream/60">Farm-fresh, delivered with care</span>
          </div>
        </div>
      )}

      <header className="bg-cream/80 sticky top-0 z-40 border-b border-forest-700/10">
        <div className="max-w-screen-2xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-[70px] gap-4">
            <Link to="/" className="flex items-center gap-2.5">
              <div className="bg-forest-700 p-2 rounded-full"><Leaf size={20} className="text-cream" strokeWidth={1.75} /></div>
              <div className="text-left leading-none">
                <p className="text-xl font-bold text-forest-900">Koyan<span className="accent text-forest-600"> Fresh</span></p>
                <p className="text-[11px] text-sage-600 font-medium tracking-wide">Farm to Table</p>
              </div>
            </Link>

            <nav className="hidden md:flex items-center gap-7">
              <button onClick={() => onNavigate('shop')} className={navLink(currentPage === 'shop')}>Shop</button>
              <button onClick={() => onNavigate('track')} className={navLink(currentPage === 'track')}>Track Order</button>
            </nav>

            <div className="flex items-center gap-2">
              {profile && (
                <div className="relative" ref={bellRef}>
                  <button onClick={toggleBell} className={iconBtn} aria-label="Notifications">
                    <Bell size={18} strokeWidth={1.75} />
                    {unread > 0 && <span className="absolute -top-1 -right-1 bg-clay text-cream text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">{unread > 9 ? '9+' : unread}</span>}
                  </button>
                  {bellOpen && (
                    <div className="absolute right-0 mt-2 w-80 surface max-h-96 overflow-y-auto z-50">
                      <div className="px-4 py-3 border-b border-forest-700/10"><p className="text-sm font-bold text-forest-900">Notifications</p></div>
                      {notifications.length === 0 ? (
                        <p className="text-sm text-forest-800/50 text-center py-8">No notifications yet.</p>
                      ) : notifications.map((n) => (
                        <div key={n.id} className={`px-4 py-3 border-b border-forest-700/5 ${n.is_read ? '' : 'bg-sage-50'}`}>
                          <p className="text-sm font-semibold text-forest-900">{n.title}</p>
                          <p className="text-xs text-forest-800/70 mt-0.5">{n.body}</p>
                          <p className="text-[10px] text-forest-800/40 mt-1">{new Date(n.created_at).toLocaleString()}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <button onClick={() => (onOpenCart ? onOpenCart() : onNavigate('cart'))} className={iconBtn} aria-label="Cart">
                <ShoppingBag size={18} strokeWidth={1.75} />
                {cartCount > 0 && <span className="absolute -top-1 -right-1 bg-forest-700 text-cream text-[10px] font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">{cartCount}</span>}
              </button>

              {profile ? (
                <div className="hidden md:flex items-center gap-2">
                  {profile.is_admin && (
                    <button onClick={() => onNavigate('admin')} className="flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-forest-800 text-cream text-sm font-semibold hover:bg-forest-900 transition-colors"><Shield size={15} strokeWidth={1.75} />Admin</button>
                  )}
                  <button onClick={() => onNavigate('user')} className="flex items-center gap-1.5 px-3.5 py-2 rounded-full border border-forest-700/15 text-forest-800 text-sm font-semibold hover:bg-forest-50 transition-colors"><User size={15} strokeWidth={1.75} />{profile.full_name?.split(' ')[0] || 'Account'}</button>
                  <button onClick={() => { onLogout?.(); setMenuOpen(false); }} className={iconBtn} aria-label="Logout"><LogOut size={17} strokeWidth={1.75} /></button>
                </div>
              ) : (
                <button onClick={() => onNavigate('user')} className="hidden md:flex btn-primary py-2.5 px-5 text-sm"><User size={16} strokeWidth={1.75} />Sign In</button>
              )}

              <div className="flex md:hidden">
                <button className={iconBtn} onClick={() => setMenuOpen(!menuOpen)} aria-label="Menu">{menuOpen ? <X size={18} /> : <Menu size={18} />}</button>
              </div>
            </div>
          </div>
        </div>

        {menuOpen && (
          <div className="md:hidden border-t border-forest-700/10 bg-cream px-4 py-3 space-y-1">
            <button onClick={() => { onNavigate('shop'); setMenuOpen(false); }} className="block w-full text-left px-4 py-2.5 rounded-lg text-sm font-medium text-forest-800 hover:bg-forest-50">Shop</button>
            <button onClick={() => { onNavigate('track'); setMenuOpen(false); }} className="block w-full text-left px-4 py-2.5 rounded-lg text-sm font-medium text-forest-800 hover:bg-forest-50">Track Order</button>
            <button onClick={() => { (onOpenCart ? onOpenCart() : onNavigate('cart')); setMenuOpen(false); }} className="block w-full text-left px-4 py-2.5 rounded-lg text-sm font-medium text-forest-800 hover:bg-forest-50">Cart ({cartCount})</button>
            {profile ? (
              <>
                {profile.is_admin && <button onClick={() => { onNavigate('admin'); setMenuOpen(false); }} className="block w-full text-left px-4 py-2.5 rounded-lg text-sm font-medium text-forest-800 hover:bg-forest-50"><Shield size={14} className="inline mr-2" />Admin Dashboard</button>}
                <button onClick={() => { onNavigate('user'); setMenuOpen(false); }} className="block w-full text-left px-4 py-2.5 rounded-lg text-sm font-medium text-forest-800 hover:bg-forest-50"><User size={14} className="inline mr-2" />My Account</button>
                <button onClick={() => { onLogout?.(); setMenuOpen(false); }} className="block w-full text-left px-4 py-2.5 rounded-lg text-sm font-medium text-clay hover:bg-clay/5"><LogOut size={14} className="inline mr-2" />Logout</button>
              </>
            ) : (
              <button onClick={() => { onNavigate('user'); setMenuOpen(false); }} className="block w-full text-left px-4 py-2.5 rounded-lg text-sm font-medium text-forest-700 hover:bg-forest-50"><User size={14} className="inline mr-2" />Sign In</button>
            )}
          </div>
        )}
      </header>
    </>
  );
}
