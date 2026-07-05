import { useState, useRef, useEffect } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import {
  Shield, LogOut, BarChart3, Package, CreditCard, Image as ImageIcon, ShoppingCart,
  Users, MessageCircle, Truck, Bell, Settings, Lock,
} from 'lucide-react';
import { useApp } from '../providers/AppProvider';
import { useAdminCounts } from '../hooks/adminQueries';

function AdminBell() {
  const { notifications, markNotificationsRead } = useApp();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const unread = notifications.filter((n) => !n.is_read).length;

  useEffect(() => {
    function onClick(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); }
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  function toggle() {
    const next = !open;
    setOpen(next);
    if (next) markNotificationsRead();
  }

  return (
    <div className="relative" ref={ref}>
      <button onClick={toggle} className="relative w-10 h-10 flex items-center justify-center rounded-lg text-slate-300 hover:text-white hover:bg-white/5" aria-label="Notifications">
        <Bell size={18} />
        {unread > 0 && <span className="absolute top-1 right-1 bg-emerald-500 text-white text-[10px] font-bold rounded-full min-w-[16px] h-4 flex items-center justify-center px-1">{unread > 9 ? '9+' : unread}</span>}
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-80 bg-white rounded-lg border border-gray-200 max-h-96 overflow-y-auto z-50">
          <div className="px-4 py-3 border-b border-gray-100"><p className="text-sm font-bold text-gray-900">Notifications</p></div>
          {notifications.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">No notifications yet.</p>
          ) : notifications.map((n) => (
            <div key={n.id} className={`px-4 py-3 border-b border-gray-50 ${n.is_read ? '' : 'bg-emerald-50'}`}>
              <p className="text-sm font-semibold text-gray-900">{n.title}</p>
              <p className="text-xs text-gray-600 mt-0.5">{n.body}</p>
              <p className="text-[10px] text-gray-400 mt-1">{new Date(n.created_at).toLocaleString()}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const NAV = [
  { key: 'overview', label: 'Overview', icon: BarChart3 },
  { key: 'orders', label: 'Orders', icon: Package },
  { key: 'payments', label: 'Payments', icon: CreditCard },
  { key: 'livestock', label: 'Livestock', icon: ImageIcon },
  { key: 'carts', label: 'Carts', icon: ShoppingCart },
  { key: 'customers', label: 'Customers', icon: Users },
  { key: 'chat', label: 'Chat', icon: MessageCircle },
  { key: 'logistics', label: 'Logistics', icon: Truck },
  { key: 'blast', label: 'Blast', icon: Bell },
  { key: 'settings', label: 'Settings', icon: Settings },
  { key: 'password', label: 'Password', icon: Lock },
];

export default function AdminLayout() {
  const app = useApp();
  const nav = useNavigate();
  const loc = useLocation();
  const section = loc.pathname.split('/admin/')[1]?.split('/')[0] ?? 'overview';
  const { data: counts } = useAdminCounts();
  const countFor = (key: string): number => key === 'payments' ? (counts?.pendingPayments ?? 0) : key === 'carts' ? (counts?.abandonedCarts ?? 0) : key === 'livestock' ? (counts?.lowStock ?? 0) : 0;

  return (
    <div className="min-h-screen bg-slate-100 lg:flex">
      <aside className="hidden lg:flex flex-col w-64 bg-slate-900 text-slate-300 fixed inset-y-0 left-0 z-30">
        <div className="px-5 py-5 flex items-center gap-3 border-b border-white/5">
          <div className="bg-emerald-600 p-2 rounded-lg"><Shield size={20} className="text-white" /></div>
          <div>
            <p className="text-white font-bold leading-none">Staff Console</p>
            <p className="text-[11px] text-slate-500 mt-1">Koyan Fresh</p>
          </div>
        </div>
        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
          {NAV.map(({ key, label, icon: Icon }) => {
            const c = countFor(key);
            return (
              <button key={key} onClick={() => nav(`/admin/${key}`)} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${section === key ? 'bg-emerald-600 text-white' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}>
                <Icon size={17} /><span className="flex-1 text-left">{label}</span>
                {c > 0 && <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${key === 'livestock' ? 'bg-amber-500 text-white' : section === key ? 'bg-white/25 text-white' : 'bg-slate-700 text-slate-200'}`}>{key === 'livestock' ? `${c} low` : c}</span>}
              </button>
            );
          })}
        </nav>
        <div className="p-3 border-t border-white/5">
          <button onClick={() => { nav('/login', { replace: true }); app.logout(); }} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-400 hover:text-white hover:bg-white/5"><LogOut size={17} />Logout</button>
        </div>
      </aside>

      <div className="flex-1 min-w-0 lg:ml-64">
        {/* Top bar */}
        <div className="sticky top-0 z-20 bg-slate-900 text-white flex items-center justify-between px-4 lg:px-6 h-14 border-b border-white/5">
          <p className="text-sm font-semibold capitalize">{NAV.find((n) => n.key === section)?.label ?? section}</p>
          <AdminBell />
        </div>
        {/* Mobile nav */}
        <div className="lg:hidden sticky top-14 z-20 bg-slate-900 text-slate-300 flex gap-1 overflow-x-auto scrollbar-hide px-3 py-2 border-b border-white/5">
          {NAV.map(({ key, label, icon: Icon }) => {
            const c = countFor(key);
            return (
              <button key={key} onClick={() => nav(`/admin/${key}`)} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap flex-shrink-0 ${section === key ? 'bg-emerald-600 text-white' : 'text-slate-400'}`}>
                <Icon size={13} />{label}{c > 0 && <span className="bg-white/25 rounded-full px-1">{c}</span>}
              </button>
            );
          })}
        </div>
        <Outlet />
      </div>
    </div>
  );
}
