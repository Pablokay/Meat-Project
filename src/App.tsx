import { useState, useEffect, useCallback } from 'react';
import type { Session } from '@supabase/supabase-js';
import Header from './components/Header';
import Footer from './components/Footer';
import Shop from './pages/Shop';
import TrackOrder from './pages/TrackOrder';
import AdminLogin from './pages/AdminLogin';
import Admin from './pages/Admin';
import UserLogin from './pages/UserLogin';
import UserDashboard from './pages/UserDashboard';
import Cart from './pages/Cart';
import CheckoutModal from './components/CheckoutModal';
import { supabase, getProfile, signOutUser, type CartItem, type Profile, type Notification } from './lib/supabase';

type Page = 'shop' | 'track' | 'admin' | 'admin-login' | 'user-login' | 'user-dashboard' | 'cart';
type UserType = 'guest' | 'registered' | null;

const CART_KEY = 'koyan_cart';
const LOGIN_AT_KEY = 'koyan_login_at';
const MAX_SESSION_MS = 24 * 60 * 60 * 1000; // 24 hours

function loadCart(): CartItem[] {
  try {
    return JSON.parse(localStorage.getItem(CART_KEY) || '[]');
  } catch {
    return [];
  }
}

export default function App() {
  const [page, setPage] = useState<Page>('shop');
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [userType, setUserType] = useState<UserType>(null);
  const [cartItems, setCartItems] = useState<CartItem[]>(loadCart);
  const [checkingOut, setCheckingOut] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);

  const isAdmin = !!profile?.is_admin;

  // ---- Session / auth ----------------------------------------------------
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setAuthReady(true);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s);
      if (event === 'SIGNED_IN' && s) {
        if (!localStorage.getItem(LOGIN_AT_KEY)) {
          localStorage.setItem(LOGIN_AT_KEY, String(Date.now()));
        }
        setUserType('registered');
      }
      if (event === 'SIGNED_OUT') {
        localStorage.removeItem(LOGIN_AT_KEY);
        setProfile(null);
      }
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  // Load profile whenever the session's user changes.
  useEffect(() => {
    if (session?.user) {
      if (!localStorage.getItem(LOGIN_AT_KEY)) localStorage.setItem(LOGIN_AT_KEY, String(Date.now()));
      getProfile(session.user.id).then(setProfile);
      setUserType('registered');
    } else {
      setProfile(null);
    }
  }, [session?.user?.id]);

  // Enforce a hard 24h session cap regardless of token refresh.
  useEffect(() => {
    if (!session) return;
    const check = () => {
      const loginAt = Number(localStorage.getItem(LOGIN_AT_KEY) || 0);
      if (loginAt && Date.now() - loginAt > MAX_SESSION_MS) {
        signOutUser();
        localStorage.removeItem(LOGIN_AT_KEY);
      }
    };
    check();
    const id = setInterval(check, 60 * 1000);
    return () => clearInterval(id);
  }, [session]);

  // ---- Notifications (in-app bell) --------------------------------------
  const refreshNotifications = useCallback(async () => {
    if (isAdmin) {
      const { data } = await supabase
        .from('notifications')
        .select('*')
        .eq('recipient_type', 'admin')
        .order('created_at', { ascending: false })
        .limit(50);
      setNotifications(data ?? []);
    } else if (session?.user) {
      const { data } = await supabase
        .from('notifications')
        .select('*')
        .eq('recipient_type', 'user')
        .eq('user_id', session.user.id)
        .order('created_at', { ascending: false })
        .limit(50);
      setNotifications(data ?? []);
    } else {
      setNotifications([]);
    }
  }, [isAdmin, session?.user?.id]);

  useEffect(() => {
    refreshNotifications();
    const id = setInterval(refreshNotifications, 30 * 1000);
    return () => clearInterval(id);
  }, [refreshNotifications]);

  async function markNotificationsRead() {
    const unread = notifications.filter((n) => !n.is_read).map((n) => n.id);
    if (unread.length === 0) return;
    await supabase.from('notifications').update({ is_read: true }).in('id', unread);
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
  }

  // ---- Cart --------------------------------------------------------------
  useEffect(() => {
    localStorage.setItem(CART_KEY, JSON.stringify(cartItems));
    // Mirror to server for logged-in users (powers admin abandoned-cart view).
    if (session?.user && cartItems.length >= 0) {
      const total = cartItems.reduce((s, i) => s + i.subtotal, 0);
      supabase.from('carts').upsert(
        {
          user_id: session.user.id,
          user_name: profile?.full_name ?? '',
          user_email: profile?.email ?? session.user.email ?? '',
          user_phone: profile?.phone ?? '',
          items: cartItems,
          total,
          status: cartItems.length > 0 ? 'active' : 'checked_out',
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' }
      ).then(() => {});
    }
  }, [cartItems, session?.user?.id]);

  function addToCart(item: CartItem) {
    setCartItems((prev) => [...prev, item]);
  }
  function updateCartQuantity(id: string, quantity: number) {
    setCartItems((prev) =>
      prev.map((i) => (i.id === id ? { ...i, quantity, subtotal: i.unit_price * quantity } : i))
    );
  }
  function removeCartItem(id: string) {
    setCartItems((prev) => prev.filter((i) => i.id !== id));
  }
  function clearCart() {
    setCartItems([]);
  }

  // ---- Routing -----------------------------------------------------------
  const applyHash = useCallback(
    (h: string) => {
      if (h === 'admin') setPage(isAdmin ? 'admin' : 'admin-login');
      else if (h === 'track') setPage('track');
      else if (h === 'cart') setPage('cart');
      else if (h === 'user') setPage(session?.user ? 'user-dashboard' : 'user-login');
      else setPage('shop');
    },
    [isAdmin, session?.user?.id]
  );

  useEffect(() => {
    if (!authReady) return;
    applyHash(window.location.hash.replace('#', ''));
    const onHash = () => applyHash(window.location.hash.replace('#', ''));
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, [authReady, applyHash]);

  const navigate = (p: 'shop' | 'track' | 'admin' | 'user' | 'cart') => {
    window.location.hash = p === 'shop' ? '' : p;
    if (p === 'admin') setPage(isAdmin ? 'admin' : 'admin-login');
    else if (p === 'user') setPage(session?.user ? 'user-dashboard' : 'user-login');
    else setPage(p);
  };

  const handleAdminLogin = async () => {
    if (session?.user) setProfile(await getProfile(session.user.id));
    setPage('admin');
    window.location.hash = 'admin';
  };

  const handleUserLogin = async () => {
    if (session?.user) setProfile(await getProfile(session.user.id));
    setUserType('registered');
    setPage('shop');
    window.location.hash = '';
  };

  const handleGuestCheckout = () => {
    setUserType('guest');
    setPage('shop');
    window.location.hash = '';
  };

  const handleLogout = async () => {
    await signOutUser();
    setProfile(null);
    setUserType(null);
    setPage('shop');
    window.location.hash = '';
  };

  if (!authReady) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="w-8 h-8 border-3 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
      </div>
    );
  }

  if (page === 'admin-login') return <AdminLogin onLogin={handleAdminLogin} />;
  if (page === 'admin' && isAdmin) return <Admin onLogout={handleLogout} onNotify={refreshNotifications} />;
  if (page === 'admin' && !isAdmin) return <AdminLogin onLogin={handleAdminLogin} />;
  if (page === 'user-login') return <UserLogin onLogin={handleUserLogin} onGuestCheckout={handleGuestCheckout} />;
  if (page === 'user-dashboard' && profile) {
    return <UserDashboard profile={profile} onLogout={handleLogout} onShop={() => navigate('shop')} onRefreshProfile={async () => session?.user && setProfile(await getProfile(session.user.id))} />;
  }

  const cartCount = cartItems.length;

  return (
    <div className="min-h-screen flex flex-col">
      <Header
        currentPage={page === 'track' ? 'track' : page === 'cart' ? 'cart' : 'shop'}
        onNavigate={navigate}
        profile={profile}
        userType={userType}
        cartCount={cartCount}
        notifications={notifications}
        onOpenNotifications={markNotificationsRead}
        onLogout={handleLogout}
      />
      <main className="flex-1">
        {page === 'track' ? (
          <TrackOrder />
        ) : page === 'cart' ? (
          <Cart
            items={cartItems}
            onUpdateQuantity={updateCartQuantity}
            onRemoveItem={removeCartItem}
            onCheckout={() => setCheckingOut(true)}
            onContinueShopping={() => navigate('shop')}
          />
        ) : (
          <Shop onNavigateToTrack={() => navigate('track')} onAddToCart={addToCart} onGoToCart={() => navigate('cart')} />
        )}
      </main>
      <Footer />

      {checkingOut && (
        <CheckoutModal
          items={cartItems}
          profile={profile}
          userType={userType}
          onClose={() => setCheckingOut(false)}
          onSuccess={() => { setCheckingOut(false); clearCart(); refreshNotifications(); navigate('track'); }}
        />
      )}
    </div>
  );
}
