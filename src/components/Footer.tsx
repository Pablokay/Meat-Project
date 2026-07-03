import { useEffect, useState } from 'react';
import { Leaf, Phone, Mail, MessageCircle, MapPin } from 'lucide-react';
import { supabase, type AdminSetting } from '../lib/supabase';

export default function Footer() {
  const [carePhone, setCarePhone] = useState('+234 800 000 0000');
  const [careEmail, setCareEmail] = useState('support@koyanfresh.com');

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

  const link = 'text-cream/60 hover:text-cream transition-colors';

  return (
    <footer className="bg-forest-900 text-cream/80 mt-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10">
          <div>
            <div className="flex items-center gap-2.5 mb-4">
              <div className="bg-forest-700 p-2 rounded-full"><Leaf size={18} className="text-cream" strokeWidth={1.75} /></div>
              <div>
                <p className="text-lg font-bold text-cream leading-none">Koyan<span className="accent text-sage-300"> Fresh</span></p>
                <p className="text-[11px] text-sage-400 font-medium">Farm to Table</p>
              </div>
            </div>
            <p className="text-sm text-cream/55 leading-relaxed">
              Premium livestock delivered fresh to your doorstep. Order by kilogram or portion, with humane sourcing and convenient delivery.
            </p>
          </div>

          <div>
            <h4 className="text-sm font-bold text-cream mb-4">Quick Links</h4>
            <ul className="space-y-2.5 text-sm">
              <li><a href="#shop" className={link}>Shop Livestock</a></li>
              <li><a href="#track" className={link}>Track Your Order</a></li>
              <li><a href="#gallery" className={link}>Gallery</a></li>
            </ul>
          </div>

          <div>
            <h4 className="text-sm font-bold text-cream mb-4">Contact</h4>
            <ul className="space-y-3 text-sm">
              <li className="flex items-center gap-2.5"><Phone size={14} className="text-sage-300 flex-shrink-0" /><a href={`tel:${carePhone}`} className={link}>{carePhone}</a></li>
              <li className="flex items-center gap-2.5"><Mail size={14} className="text-sage-300 flex-shrink-0" /><a href={`mailto:${careEmail}`} className={link}>{careEmail}</a></li>
              <li className="flex items-center gap-2.5"><MessageCircle size={14} className="text-sage-300 flex-shrink-0" /><span className="text-cream/55">WhatsApp: {carePhone}</span></li>
              <li className="flex items-start gap-2.5"><MapPin size={14} className="text-sage-300 flex-shrink-0 mt-0.5" /><span className="text-cream/55">Lagos, Nigeria</span></li>
            </ul>
          </div>

          <div>
            <h4 className="text-sm font-bold text-cream mb-4">How It Works</h4>
            <ol className="space-y-2.5 text-sm text-cream/55">
              {['Browse and select your livestock', 'Choose quantity, prep & delivery', 'Pay and get confirmation', 'Receive your fresh order'].map((step, i) => (
                <li key={i} className="flex gap-2.5"><span className="w-5 h-5 bg-forest-700 text-cream rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0">{i + 1}</span><span>{step}</span></li>
              ))}
            </ol>
          </div>
        </div>

        <div className="mt-12 pt-6 border-t border-cream/10 flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-xs text-cream/40">&copy; {new Date().getFullYear()} Koyan Fresh. All rights reserved.</p>
          <p className="text-xs text-cream/40 accent">Fresh livestock, guaranteed quality.</p>
        </div>
      </div>
    </footer>
  );
}
