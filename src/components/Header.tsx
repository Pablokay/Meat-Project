import { Beef, Search, Menu, X, Phone, Mail, LogOut, User, ShoppingCart, Bell } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import { supabase, type AdminSetting, type Profile, type Notification } from '../lib/supabase';

type HeaderProps = {
  currentPage: 'shop' | 'track' | 'cart';
  onNavigate: (page: 'shop' | 'track' | 'admin' | 'user' | 'cart') => void;
  profile?: Profile | null;
  userType?: 'guest' | 'registered' | null;
  cartCount?: number;
  notifications?: Notification[];
  onOpenNotifications?: () => void;
  onLogout?: () => void;
};

export default function Header({ currentPage, onNavigate, profile, userType, cartCount = 0, notifications = [], onOpenNotifications, onLogout }: HeaderProps) {
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

  return (
    <>
      {(carePhone || careEmail) && (
        <div className="bg-blue-800 text-white text-xs">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-1.5 flex items-center justify-between">
            <div className="flex items-center gap-4">
              {carePhone && (
                <a href={`tel:${carePhone}`} className="flex items-center gap-1.5 hover:text-blue-200 transition-colors">
                  <Phone size={11} /><span>{carePhone}</span>
                </a>
              )}
              {careEmail && (
                <a href={`mailto:${careEmail}`} className="hidden sm:flex items-center gap-1.5 hover:text-blue-200 transition-colors">
                  <Mail size={11} /><span>{careEmail}</span>
                </a>
              )}
            </div>
            <span className="text-blue-200">Need help? Contact us</span>
          </div>
        </div>
      )}

      <header className="bg-white shadow-sm sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <button onClick={() => onNavigate('shop')} className="flex items-center gap-2">
              <div className="bg-blue-700 p-2 rounded-lg"><Beef size={22} className="text-white" /></div>
              <div className="text-left">
                <p className="text-lg font-bold text-gray-900 leading-none">Koyan FreshLivestock</p>
                <p className="text-xs text-blue-600 font-medium">Farm to Table</p>
              </div>
            </button>

            <nav className="hidden md:flex items-center gap-1">
              <button onClick={() => onNavigate('shop')} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${currentPage === 'shop' ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'}`}>Our Livestock</button>
              <button onClick={() => onNavigate('track')} className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${currentPage === 'track' ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'}`}>Track Order</button>
            </nav>

            <div className="flex items-center gap-2">
              {/* Notifications bell (logged-in users) */}
              {profile && (
                <div className="relative" ref={bellRef}>
                  <button onClick={toggleBell} className="relative p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
                    <Bell size={20} />
                    {unread > 0 && <span className="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-[10px] font-bold rounded-full min-w-[16px] h-4 flex items-center justify-center px-1">{unread > 9 ? '9+' : unread}</span>}
                  </button>
                  {bellOpen && (
                    <div className="absolute right-0 mt-2 w-80 bg-white rounded-xl shadow-2xl border border-gray-100 max-h-96 overflow-y-auto z-50">
                      <div className="px-4 py-3 border-b border-gray-100"><p className="text-sm font-bold text-gray-900">Notifications</p></div>
                      {notifications.length === 0 ? (
                        <p className="text-sm text-gray-400 text-center py-8">No notifications yet.</p>
                      ) : (
                        notifications.map((n) => (
                          <div key={n.id} className={`px-4 py-3 border-b border-gray-50 ${n.is_read ? '' : 'bg-blue-50/50'}`}>
                            <p className="text-sm font-semibold text-gray-900">{n.title}</p>
                            <p className="text-xs text-gray-600 mt-0.5">{n.body}</p>
                            <p className="text-[10px] text-gray-400 mt-1">{new Date(n.created_at).toLocaleString()}</p>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Cart */}
              <button onClick={() => onNavigate('cart')} className="relative p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
                <ShoppingCart size={20} />
                {cartCount > 0 && <span className="absolute -top-0.5 -right-0.5 bg-blue-600 text-white text-[10px] font-bold rounded-full min-w-[16px] h-4 flex items-center justify-center px-1">{cartCount}</span>}
              </button>

              {userType === 'guest' && !profile ? (
                <div className="hidden md:flex items-center gap-2">
                  <button onClick={() => { onLogout?.(); setMenuOpen(false); }} className="flex items-center gap-2 px-4 py-2 bg-amber-50 text-amber-700 hover:bg-amber-100 rounded-lg text-sm font-medium transition-colors">
                    <User size={16} />Guest
                  </button>
                </div>
              ) : profile ? (
                <div className="hidden md:flex items-center gap-2">
                  <button onClick={() => onNavigate('user')} className="flex items-center gap-2 px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg text-sm font-medium transition-colors">
                    <User size={16} />{profile.full_name || 'My Account'}
                  </button>
                  <button onClick={() => { onLogout?.(); setMenuOpen(false); }} className="flex items-center gap-2 px-4 py-2 bg-red-50 text-red-700 hover:bg-red-100 rounded-lg text-sm font-medium transition-colors">
                    <LogOut size={16} />Logout
                  </button>
                </div>
              ) : (
                <button onClick={() => onNavigate('user')} className="hidden md:flex items-center gap-2 bg-blue-700 hover:bg-blue-800 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
                  <User size={16} />Sign In
                </button>
              )}

              <div className="flex md:hidden gap-1">
                <button onClick={() => onNavigate('track')} className="flex items-center gap-1.5 bg-blue-700 hover:bg-blue-800 text-white px-3 py-2 rounded-lg text-sm font-medium transition-colors">
                  <Search size={14} />Track
                </button>
                <button className="p-2 text-gray-600" onClick={() => setMenuOpen(!menuOpen)}>{menuOpen ? <X size={22} /> : <Menu size={22} />}</button>
              </div>
            </div>
          </div>
        </div>

        {menuOpen && (
          <div className="md:hidden border-t border-gray-100 bg-white px-4 py-3 space-y-1">
            <button onClick={() => { onNavigate('shop'); setMenuOpen(false); }} className={`block w-full text-left px-4 py-2.5 rounded-lg text-sm font-medium ${currentPage === 'shop' ? 'bg-blue-50 text-blue-700' : 'text-gray-600'}`}>Our Livestock</button>
            <button onClick={() => { onNavigate('track'); setMenuOpen(false); }} className={`block w-full text-left px-4 py-2.5 rounded-lg text-sm font-medium ${currentPage === 'track' ? 'bg-blue-50 text-blue-700' : 'text-gray-600'}`}>Track Order</button>
            <button onClick={() => { onNavigate('cart'); setMenuOpen(false); }} className={`block w-full text-left px-4 py-2.5 rounded-lg text-sm font-medium ${currentPage === 'cart' ? 'bg-blue-50 text-blue-700' : 'text-gray-600'}`}>Cart ({cartCount})</button>
            {profile ? (
              <>
                <button onClick={() => { onNavigate('user'); setMenuOpen(false); }} className="block w-full text-left px-4 py-2.5 rounded-lg text-sm font-medium text-gray-600"><User size={14} className="inline mr-2" />My Account</button>
                <button onClick={() => { onLogout?.(); setMenuOpen(false); }} className="block w-full text-left px-4 py-2.5 rounded-lg text-sm font-medium text-red-600 hover:bg-red-50"><LogOut size={14} className="inline mr-2" />Logout</button>
              </>
            ) : userType === 'guest' ? (
              <button onClick={() => { onLogout?.(); setMenuOpen(false); }} className="block w-full text-left px-4 py-2.5 rounded-lg text-sm font-medium text-amber-600 hover:bg-amber-50"><User size={14} className="inline mr-2" />End Guest Session</button>
            ) : (
              <button onClick={() => { onNavigate('user'); setMenuOpen(false); }} className="block w-full text-left px-4 py-2.5 rounded-lg text-sm font-medium text-blue-600 hover:bg-blue-50"><User size={14} className="inline mr-2" />Sign In</button>
            )}
            {carePhone && <a href={`tel:${carePhone}`} className="block px-4 py-2.5 rounded-lg text-sm font-medium text-blue-600 hover:bg-blue-50"><Phone size={12} className="inline mr-2" />Call: {carePhone}</a>}
          </div>
        )}
      </header>
    </>
  );
}
