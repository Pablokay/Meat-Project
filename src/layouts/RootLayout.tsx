import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import Header from '../components/Header';
import Footer from '../components/Footer';
import BottomNav from '../components/BottomNav';
import CartDrawer from '../components/CartDrawer';
import CheckoutModal from '../components/CheckoutModal';
import OrderSuccess from '../components/OrderSuccess';
import { useApp } from '../providers/AppProvider';

export default function RootLayout() {
  const app = useApp();
  const nav = useNavigate();
  const loc = useLocation();

  const onNavigate = (p: 'shop' | 'track' | 'admin' | 'user' | 'cart') => {
    if (p === 'shop') nav('/shop');
    else if (p === 'track') nav('/track');
    else if (p === 'cart') app.setCartOpen(true);
    else if (p === 'user') nav(app.session ? '/account' : '/login');
    else if (p === 'admin') nav('/admin');
  };

  const currentPage = loc.pathname.startsWith('/track') ? 'track' : 'shop';

  return (
    <div className="min-h-screen flex flex-col pb-16 md:pb-0">
      <Header
        currentPage={currentPage}
        onNavigate={onNavigate}
        onOpenCart={() => app.setCartOpen(true)}
        profile={app.profile}
        cartCount={app.cartCount}
        notifications={app.notifications}
        onOpenNotifications={app.markNotificationsRead}
        onLogout={() => { nav('/login', { replace: true }); app.logout(); }}
      />
      <main className="flex-1"><Outlet /></main>
      <Footer />

      <BottomNav currentPage={currentPage} onNavigate={onNavigate} onOpenCart={() => app.setCartOpen(true)} cartCount={app.cartCount} isLoggedIn={!!app.profile} />

      <CartDrawer
        open={app.cartOpen}
        items={app.cartItems}
        onClose={() => app.setCartOpen(false)}
        onUpdateQuantity={app.updateCartQuantity}
        onRemoveItem={app.removeCartItem}
        onCheckout={() => { app.setCartOpen(false); app.setCheckingOut(true); }}
        onContinueShopping={() => { app.setCartOpen(false); nav('/shop'); }}
      />

      {app.checkingOut && (
        <CheckoutModal
          items={app.cartItems}
          profile={app.profile}
          userType={app.profile ? 'registered' : 'guest'}
          onClose={() => app.setCheckingOut(false)}
          onSuccess={(orderNumber, accessToken, requiresConfirmation) => {
            app.setCheckingOut(false);
            app.clearCart();
            app.refreshNotifications();
            app.setSuccessOrder({ orderNumber, accessToken, requiresConfirmation });
          }}
        />
      )}

      {app.successOrder && (
        <OrderSuccess
          orderNumber={app.successOrder.orderNumber}
          accessToken={app.successOrder.accessToken}
          requiresConfirmation={app.successOrder.requiresConfirmation}
          onTrackOrder={() => { app.setSuccessOrder(null); nav('/track'); }}
          onClose={() => { app.setSuccessOrder(null); nav('/shop'); }}
        />
      )}
    </div>
  );
}
