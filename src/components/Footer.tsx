import { useEffect, useState } from 'react';
import { Beef, Phone, Mail, MessageCircle, MapPin } from 'lucide-react';
import { supabase, type AdminSetting } from '../lib/supabase';

export default function Footer() {
  const [carePhone, setCarePhone] = useState('+234 800 000 0000');
  const [careEmail, setCareEmail] = useState('orders@freshlivestock.com');

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
    <footer className="bg-gray-900 text-gray-300">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="bg-blue-700 p-2 rounded-lg">
                <Beef size={20} className="text-white" />
              </div>
              <div>
                <p className="text-lg font-bold text-white leading-none">Koyan FreshLivestock</p>
                <p className="text-xs text-blue-400 font-medium">Farm to Table</p>
              </div>
            </div>
            <p className="text-sm text-gray-400 leading-relaxed">
              Premium livestock delivered fresh to your doorstep. Order by kilogram or portion with convenient delivery and pickup options.
            </p>
          </div>

          <div>
            <h4 className="text-sm font-bold text-white mb-3 uppercase tracking-wider">Quick Links</h4>
            <ul className="space-y-2 text-sm">
              <li><a href="#shop" className="hover:text-blue-400 transition-colors">Our Livestock</a></li>
              <li><a href="#track" className="hover:text-blue-400 transition-colors">Track Your Order</a></li>
              <li><a href="#" className="hover:text-blue-400 transition-colors">How It Works</a></li>
              <li><a href="#" className="hover:text-blue-400 transition-colors">FAQ</a></li>
            </ul>
          </div>

          <div>
            <h4 className="text-sm font-bold text-white mb-3 uppercase tracking-wider">Contact Us</h4>
            <ul className="space-y-2.5 text-sm">
              <li className="flex items-center gap-2">
                <Phone size={14} className="text-blue-400 flex-shrink-0" />
                <a href={`tel:${carePhone}`} className="hover:text-blue-400 transition-colors">{carePhone}</a>
              </li>
              <li className="flex items-center gap-2">
                <Mail size={14} className="text-blue-400 flex-shrink-0" />
                <a href={`mailto:${careEmail}`} className="hover:text-blue-400 transition-colors">{careEmail}</a>
              </li>
              <li className="flex items-center gap-2">
                <MessageCircle size={14} className="text-blue-400 flex-shrink-0" />
                <span>WhatsApp: {carePhone}</span>
              </li>
              <li className="flex items-start gap-2">
                <MapPin size={14} className="text-blue-400 flex-shrink-0 mt-0.5" />
                <span>Lagos, Nigeria</span>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="text-sm font-bold text-white mb-3 uppercase tracking-wider">How It Works</h4>
            <ol className="space-y-2 text-sm text-gray-400">
              <li className="flex gap-2">
                <span className="w-5 h-5 bg-blue-700 text-white rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">1</span>
                <span>Browse and select your livestock</span>
              </li>
              <li className="flex gap-2">
                <span className="w-5 h-5 bg-blue-700 text-white rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">2</span>
                <span>Choose quantity and delivery option</span>
              </li>
              <li className="flex gap-2">
                <span className="w-5 h-5 bg-blue-700 text-white rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">3</span>
                <span>Make payment and get confirmation</span>
              </li>
              <li className="flex gap-2">
                <span className="w-5 h-5 bg-blue-700 text-white rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">4</span>
                <span>Receive your fresh order!</span>
              </li>
            </ol>
          </div>
        </div>

        <div className="mt-10 pt-6 border-t border-gray-800 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-xs text-gray-500">&copy; {new Date().getFullYear()} Koyan FreshLivestock. All rights reserved.</p>
          <p className="text-xs text-gray-500">Fresh livestock, guaranteed quality.</p>
        </div>
      </div>
    </footer>
  );
}
