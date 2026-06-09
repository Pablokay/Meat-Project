import { Beef, Search, Menu, X, Phone, Mail } from 'lucide-react';
import { useState, useEffect } from 'react';
import { supabase, type AdminSetting } from '../lib/supabase';

type HeaderProps = {
  currentPage: 'shop' | 'track';
  onNavigate: (page: 'shop' | 'track' | 'admin') => void;
};

export default function Header({ currentPage, onNavigate }: HeaderProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [carePhone, setCarePhone] = useState('');
  const [careEmail, setCareEmail] = useState('');

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

  return (
    <>
      {(carePhone || careEmail) && (
        <div className="bg-blue-800 text-white text-xs">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-1.5 flex items-center justify-between">
            <div className="flex items-center gap-4">
              {carePhone && (
                <a href={`tel:${carePhone}`} className="flex items-center gap-1.5 hover:text-blue-200 transition-colors">
                  <Phone size={11} />
                  <span>{carePhone}</span>
                </a>
              )}
              {careEmail && (
                <a href={`mailto:${careEmail}`} className="hidden sm:flex items-center gap-1.5 hover:text-blue-200 transition-colors">
                  <Mail size={11} />
                  <span>{careEmail}</span>
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
              <div className="bg-blue-700 p-2 rounded-lg">
                <Beef size={22} className="text-white" />
              </div>
              <div className="text-left">
                <p className="text-lg font-bold text-gray-900 leading-none">Koyan FreshLivestock</p>
                <p className="text-xs text-blue-600 font-medium">Farm to Table</p>
              </div>
            </button>

            <nav className="hidden md:flex items-center gap-1">
              <button
                onClick={() => onNavigate('shop')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  currentPage === 'shop' ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                }`}
              >
                Our Livestock
              </button>
              <button
                onClick={() => onNavigate('track')}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  currentPage === 'track' ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                }`}
              >
                Track Order
              </button>
            </nav>

            <div className="flex items-center gap-2 md:hidden">
              <button
                onClick={() => onNavigate('track')}
                className="flex items-center gap-1.5 bg-blue-700 hover:bg-blue-800 text-white px-3 py-2 rounded-lg text-sm font-medium transition-colors"
              >
                <Search size={14} />
                Track
              </button>
              <button className="p-2 text-gray-600" onClick={() => setMenuOpen(!menuOpen)}>
                {menuOpen ? <X size={22} /> : <Menu size={22} />}
              </button>
            </div>
          </div>
        </div>

        {menuOpen && (
          <div className="md:hidden border-t border-gray-100 bg-white px-4 py-3 space-y-1">
            <button
              onClick={() => { onNavigate('shop'); setMenuOpen(false); }}
              className={`block w-full text-left px-4 py-2.5 rounded-lg text-sm font-medium ${currentPage === 'shop' ? 'bg-blue-50 text-blue-700' : 'text-gray-600'}`}
            >
              Our Livestock
            </button>
            <button
              onClick={() => { onNavigate('track'); setMenuOpen(false); }}
              className={`block w-full text-left px-4 py-2.5 rounded-lg text-sm font-medium ${currentPage === 'track' ? 'bg-blue-50 text-blue-700' : 'text-gray-600'}`}
            >
              Track Order
            </button>
            {carePhone && (
              <a href={`tel:${carePhone}`} className="block px-4 py-2.5 rounded-lg text-sm font-medium text-blue-600 hover:bg-blue-50">
                <Phone size={12} className="inline mr-2" />Call: {carePhone}
              </a>
            )}
          </div>
        )}
      </header>
    </>
  );
}
