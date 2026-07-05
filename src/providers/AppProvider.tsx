import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase, getProfile, signOutUser, type CartItem, type Profile, type Notification } from '../lib/supabase';

const CART_KEY = 'koyan_cart';
const LOGIN_AT_KEY = 'koyan_login_at';

function loadCart(): CartItem[] {
  try { return JSON.parse(localStorage.getItem(CART_KEY) || '[]'); } catch { return []; }
}

type AppContextValue = {
  session: Session | null;
  profile: Profile | null;
  isAdmin: boolean;
  authReady: boolean;
  profileReady: boolean;
  refreshProfile: () => Promise<void>;
  logout: () => Promise<void>;
  // cart
  cartItems: CartItem[];
  cartCount: number;
  addToCart: (item: CartItem) => void;
  updateCartQuantity: (id: string, quantity: number) => void;
  removeCartItem: (id: string) => void;
  clearCart: () => void;
  cartOpen: boolean;
  setCartOpen: (v: boolean) => void;
  // checkout
  checkingOut: boolean;
  setCheckingOut: (v: boolean) => void;
  successOrder: { orderNumber: string; accessToken: string; requiresConfirmation: boolean } | null;
  setSuccessOrder: (v: AppContextValue['successOrder']) => void;
  // notifications
  notifications: Notification[];
  refreshNotifications: () => Promise<void>;
  markNotificationsRead: () => Promise<void>;
  // password recovery
  recovery: boolean;
  setRecovery: (v: boolean) => void;
};

const AppContext = createContext<AppContextValue | null>(null);

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}

export function AppProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [authReady, setAuthReady] = useState(false);
  // The uid the currently-loaded `profile` belongs to (null = none loaded).
  const [profileUid, setProfileUid] = useState<string | null>(null);
  const [cartItems, setCartItems] = useState<CartItem[]>(loadCart);
  const [cartOpen, setCartOpen] = useState(false);
  const [checkingOut, setCheckingOut] = useState(false);
  const [successOrder, setSuccessOrder] = useState<AppContextValue['successOrder']>(null);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [recovery, setRecovery] = useState(false);

  const isAdmin = !!profile?.is_admin;
  // Derived, not lagging state: when a session exists the profile is only
  // "ready" once the loaded profile actually matches that session's user.
  // This closes the refresh-race where a restored session briefly rendered
  // routes with a stale/empty profile and bounced admins to the home page.
  const profileReady = !session?.user ? true : profileUid === session.user.id;

  // Session
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); setAuthReady(true); });
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s);
      if (event === 'PASSWORD_RECOVERY') setRecovery(true);
      if (event === 'SIGNED_IN' && s && !localStorage.getItem(LOGIN_AT_KEY)) localStorage.setItem(LOGIN_AT_KEY, String(Date.now()));
      if (event === 'SIGNED_OUT') { localStorage.removeItem(LOGIN_AT_KEY); setProfile(null); setProfileUid(null); }
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    let cancelled = false;
    const uid = session?.user?.id;
    if (!uid) { setProfile(null); setProfileUid(null); return; }
    (async () => {
      // On a hard refresh the restored token may not be attached yet, so an
      // early read can return null — retry a few times before deciding.
      let p = null;
      for (let i = 0; i < 5 && !cancelled; i++) {
        p = await getProfile(uid);
        if (p) break;
        await new Promise((r) => setTimeout(r, 400));
      }
      if (cancelled) return;
      setProfile(p);
      setProfileUid(uid); // marks profileReady=true for this session
    })();
    return () => { cancelled = true; };
  }, [session?.user?.id]);


  const refreshNotifications = useCallback(async () => {
    if (isAdmin) {
      const { data } = await supabase.from('notifications').select('*').eq('recipient_type', 'admin').order('created_at', { ascending: false }).limit(50);
      setNotifications(data ?? []);
    } else if (session?.user) {
      const { data } = await supabase.from('notifications').select('*').eq('recipient_type', 'user').eq('user_id', session.user.id).order('created_at', { ascending: false }).limit(50);
      setNotifications(data ?? []);
    } else setNotifications([]);
  }, [isAdmin, session?.user?.id]);

  useEffect(() => {
    refreshNotifications();
    const id = setInterval(refreshNotifications, 30 * 1000);
    return () => clearInterval(id);
  }, [refreshNotifications]);

  async function markNotificationsRead() {
    const unread = notifications.filter((n) => !n.is_read).map((n) => n.id);
    if (!unread.length) return;
    await supabase.from('notifications').update({ is_read: true }).in('id', unread);
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
  }

  // Cart persistence + server mirror
  useEffect(() => {
    localStorage.setItem(CART_KEY, JSON.stringify(cartItems));
    if (session?.user) {
      const total = cartItems.reduce((s, i) => s + i.subtotal, 0);
      supabase.from('carts').upsert({
        user_id: session.user.id, user_name: profile?.full_name ?? '', user_email: profile?.email ?? session.user.email ?? '',
        user_phone: profile?.phone ?? '', items: cartItems, total, status: cartItems.length > 0 ? 'active' : 'checked_out', updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' }).then(() => {});
    }
  }, [cartItems, session?.user?.id]);

  const addToCart = (item: CartItem) => setCartItems((p) => [...p, item]);
  const updateCartQuantity = (id: string, quantity: number) => setCartItems((p) => p.map((i) => (i.id === id ? { ...i, quantity, subtotal: i.unit_price * quantity } : i)));
  const removeCartItem = (id: string) => setCartItems((p) => p.filter((i) => i.id !== id));
  const clearCart = () => setCartItems([]);

  const refreshProfile = useCallback(async () => { if (session?.user) setProfile(await getProfile(session.user.id)); }, [session?.user?.id]);

  async function logout() {
    await signOutUser();
    setProfile(null);
  }

  const value: AppContextValue = {
    session, profile, isAdmin, authReady, profileReady, refreshProfile, logout,
    cartItems, cartCount: cartItems.length, addToCart, updateCartQuantity, removeCartItem, clearCart, cartOpen, setCartOpen,
    checkingOut, setCheckingOut, successOrder, setSuccessOrder,
    notifications, refreshNotifications, markNotificationsRead, recovery, setRecovery,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}
