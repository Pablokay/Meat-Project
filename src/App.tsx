import type { ReactElement } from 'react';
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import RootLayout from './layouts/RootLayout';
import AdminLayout from './layouts/AdminLayout';
import HomePage from './pages/HomePage';
import ShopPage from './pages/ShopPage';
import ProductPage from './pages/ProductPage';
import TrackOrder from './pages/TrackOrder';
import UserDashboard from './pages/UserDashboard';
import UserLogin from './pages/UserLogin';
import OverviewSection from './pages/admin/OverviewSection';
import OrdersSection from './pages/admin/OrdersSection';
import PaymentsSection from './pages/admin/PaymentsSection';
import LivestockSection from './pages/admin/LivestockSection';
import CustomersSection from './pages/admin/CustomersSection';
import CartsSection from './pages/admin/CartsSection';
import ChatSection from './pages/admin/ChatSection';
import LogisticsSection from './pages/admin/LogisticsSection';
import BlastSection from './pages/admin/BlastSection';
import SettingsSection from './pages/admin/SettingsSection';
import PasswordSection from './pages/admin/PasswordSection';
import ResetPassword from './pages/ResetPassword';
import ScrollToTop from './components/ScrollToTop';
import { useApp } from './providers/AppProvider';

function Spinner() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-cream">
      <div className="w-8 h-8 border-[3px] border-forest-100 border-t-forest-700 rounded-full animate-spin" />
    </div>
  );
}

function RequireAuth({ children }: { children: ReactElement }) {
  const { session } = useApp();
  return session ? children : <Navigate to="/login" replace />;
}

function RequireAdmin({ children }: { children: ReactElement }) {
  const { isAdmin, session } = useApp();
  if (isAdmin) return children;
  return <Navigate to={session ? '/' : '/login'} replace />;
}

function LoginRoute() {
  const nav = useNavigate();
  const { session, profile, profileReady } = useApp();
  // Once authenticated and the profile is resolved, redirect declaratively.
  // The App-level Spinner covers the profile-loading window, so there is no
  // flash of the home page between sign-in and landing on the right view.
  if (session && profileReady) return <Navigate to={profile?.is_admin ? '/admin' : '/'} replace />;
  return <UserLogin onLogin={() => {}} onGuestCheckout={() => nav('/shop')} />;
}

function AccountPage() {
  const app = useApp();
  const nav = useNavigate();
  if (!app.profile) return <Spinner />;
  return (
    <UserDashboard
      profile={app.profile}
      onLogout={() => { nav('/login', { replace: true }); app.logout(); }}
      onShop={() => nav('/shop')}
      onRefreshProfile={app.refreshProfile}
      onReorder={(items) => { items.forEach(app.addToCart); app.setCartOpen(true); }}
    />
  );
}

export default function App() {
  const { authReady, profileReady, session, recovery, setRecovery } = useApp();
  const nav = useNavigate();

  if (!authReady || (session?.user && !profileReady)) return <Spinner />;
  if (recovery) return <ResetPassword onDone={() => { setRecovery(false); nav('/'); }} />;

  return (
    <>
    <ScrollToTop />
    <Routes>
      <Route element={<RootLayout />}>
        <Route index element={<HomePage />} />
        <Route path="shop" element={<ShopPage />} />
        <Route path="product/:id" element={<ProductPage />} />
        <Route path="track" element={<TrackOrder />} />
        <Route path="account" element={<RequireAuth><AccountPage /></RequireAuth>} />
      </Route>
      <Route path="login" element={<LoginRoute />} />
      <Route path="admin" element={<RequireAdmin><AdminLayout /></RequireAdmin>}>
        <Route index element={<Navigate to="/admin/overview" replace />} />
        <Route path="overview" element={<OverviewSection />} />
        <Route path="orders" element={<OrdersSection />} />
        <Route path="payments" element={<PaymentsSection />} />
        <Route path="livestock" element={<LivestockSection />} />
        <Route path="customers" element={<CustomersSection />} />
        <Route path="carts" element={<CartsSection />} />
        <Route path="chat" element={<ChatSection />} />
        <Route path="logistics" element={<LogisticsSection />} />
        <Route path="blast" element={<BlastSection />} />
        <Route path="settings" element={<SettingsSection />} />
        <Route path="password" element={<PasswordSection />} />
        <Route path="*" element={<Navigate to="/admin/overview" replace />} />
      </Route>
      <Route path="reset-password" element={<ResetPassword onDone={() => nav('/')} />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
    </>
  );
}
