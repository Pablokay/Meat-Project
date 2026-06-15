import { useState, useEffect } from 'react';
import Header from './components/Header';
import Footer from './components/Footer';
import Shop from './pages/Shop';
import TrackOrder from './pages/TrackOrder';
import AdminLogin from './pages/AdminLogin';
import Admin from './pages/Admin';
import UserLogin from './pages/UserLogin';
import UserDashboard from './pages/UserDashboard';

type Page = 'shop' | 'track' | 'admin' | 'admin-login' | 'user-login' | 'user-dashboard';
type UserData = { id: string; email: string; name: string } | null;

export default function App() {
  const [page, setPage] = useState<Page>('shop');
  const [isAdmin, setIsAdmin] = useState(false);
  const [userData, setUserData] = useState<UserData>(null);

  useEffect(() => {
    // Check for existing user session
    const userSession = sessionStorage.getItem('user_auth');
    if (userSession) {
      setUserData(JSON.parse(userSession));
    }

    const hash = window.location.hash.replace('#', '');
    if (hash === 'admin') {
      if (isAdmin) setPage('admin');
      else setPage('admin-login');
    } else if (hash === 'track') setPage('track');
    else if (hash === 'user' && userData) setPage('user-dashboard');
    else if (hash === 'user' && !userData) setPage('user-login');
    else setPage('shop');

    const onHash = () => {
      const h = window.location.hash.replace('#', '');
      if (h === 'admin') {
        if (isAdmin) setPage('admin');
        else setPage('admin-login');
      } else if (h === 'track') setPage('track');
      else if (h === 'user' && userData) setPage('user-dashboard');
      else if (h === 'user' && !userData) setPage('user-login');
      else setPage('shop');
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, [isAdmin, userData]);

  const navigate = (p: 'shop' | 'track' | 'admin' | 'user') => {
    window.location.hash = p;
    if (p === 'admin') {
      if (isAdmin) setPage('admin');
      else setPage('admin-login');
    } else if (p === 'user') {
      if (userData) setPage('user-dashboard');
      else setPage('user-login');
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

  const handleUserLogin = (data: UserData) => {
    setUserData(data);
    setPage('user-dashboard');
    window.location.hash = 'user';
  };

  const handleUserLogout = () => {
    sessionStorage.removeItem('user_auth');
    setUserData(null);
    setPage('shop');
    window.location.hash = '';
  };

  if (page === 'admin-login') {
    return <AdminLogin onLogin={handleAdminLogin} />;
  }

  if (page === 'admin') {
    return <Admin onLogout={handleAdminLogout} />;
  }

  if (page === 'user-login') {
    return <UserLogin onLogin={handleUserLogin} />;
  }

  if (page === 'user-dashboard' && userData) {
    return <UserDashboard userData={userData} onLogout={handleUserLogout} />;
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Header currentPage={page === 'track' ? 'track' : 'shop'} onNavigate={navigate} userData={userData} onUserLogout={handleUserLogout} />
      <main className="flex-1">
        {page === 'track' ? <TrackOrder /> : <Shop onNavigateToTrack={() => navigate('track')} />}
      </main>
      <Footer />
    </div>
  );
}
