import { useState, useEffect } from 'react';
import Header from './components/Header';
import Footer from './components/Footer';
import Shop from './pages/Shop';
import TrackOrder from './pages/TrackOrder';
import AdminLogin from './pages/AdminLogin';
import Admin from './pages/Admin';

type Page = 'shop' | 'track' | 'admin' | 'admin-login';

export default function App() {
  const [page, setPage] = useState<Page>('shop');
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    const hash = window.location.hash.replace('#', '');
    if (hash === 'admin') {
      if (isAdmin) setPage('admin');
      else setPage('admin-login');
    } else if (hash === 'track') setPage('track');
    else setPage('shop');

    const onHash = () => {
      const h = window.location.hash.replace('#', '');
      if (h === 'admin') {
        if (isAdmin) setPage('admin');
        else setPage('admin-login');
      } else if (h === 'track') setPage('track');
      else setPage('shop');
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, [isAdmin]);

  const navigate = (p: 'shop' | 'track' | 'admin') => {
    window.location.hash = p;
    if (p === 'admin') {
      if (isAdmin) setPage('admin');
      else setPage('admin-login');
    } else setPage(p);
  };

  const handleAdminLogin = () => {
    setIsAdmin(true);
    setPage('admin');
    window.location.hash = 'admin';
  };

  const handleAdminLogout = () => {
    setIsAdmin(false);
    setPage('shop');
    window.location.hash = '';
  };

  if (page === 'admin-login') {
    return <AdminLogin onLogin={handleAdminLogin} />;
  }

  if (page === 'admin') {
    return <Admin onLogout={handleAdminLogout} />;
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Header currentPage={page === 'track' ? 'track' : 'shop'} onNavigate={navigate} />
      <main className="flex-1">
        {page === 'track' ? <TrackOrder /> : <Shop onNavigateToTrack={() => navigate('track')} />}
      </main>
      <Footer />
    </div>
  );
}
