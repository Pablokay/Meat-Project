import { useState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Settings, Phone, Award, CreditCard, Shield, ToggleLeft, ToggleRight, CircleCheck as CheckCircle2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAdminSettings, useAdminProfiles } from '../../hooks/adminQueries';

export default function SettingsSection() {
  const qc = useQueryClient();
  const { data: settings } = useAdminSettings();
  const { data: profilesList = [] } = useAdminProfiles();

  const [commentFieldEnabled, setCommentFieldEnabled] = useState(true);
  const [commentFieldLabel, setCommentFieldLabel] = useState('Additional Comments');
  const [customerCarePhone, setCustomerCarePhone] = useState('');
  const [customerCareEmail, setCustomerCareEmail] = useState('');
  const [pickupTimesText, setPickupTimesText] = useState('');
  const [lateDisclaimer, setLateDisclaimer] = useState('');
  const [pointsPer1000, setPointsPer1000] = useState('1');
  const [lowStockThreshold, setLowStockThreshold] = useState('10');
  const [heroSlidesText, setHeroSlidesText] = useState('');
  const [paystackEnabled, setPaystackEnabled] = useState(false);
  const [paystackPublicKey, setPaystackPublicKey] = useState('');
  const [savingSettings, setSavingSettings] = useState(false);

  // Hydrate local form state once the settings map loads.
  useEffect(() => {
    if (!settings) return;
    if (settings.comment_field_enabled != null) setCommentFieldEnabled(settings.comment_field_enabled === 'true');
    if (settings.comment_field_label) setCommentFieldLabel(settings.comment_field_label || 'Additional Comments');
    if (settings.customer_care_phone) setCustomerCarePhone(settings.customer_care_phone);
    if (settings.customer_care_email) setCustomerCareEmail(settings.customer_care_email);
    if (settings.points_per_1000) setPointsPer1000(settings.points_per_1000 || '1');
    if (settings.paystack_enabled != null) setPaystackEnabled(settings.paystack_enabled === 'true');
    if (settings.paystack_public_key) setPaystackPublicKey(settings.paystack_public_key);
    if (settings.late_pickup_disclaimer) setLateDisclaimer(settings.late_pickup_disclaimer);
    if (settings.low_stock_threshold) setLowStockThreshold(settings.low_stock_threshold || '10');
    if (settings.pickup_times) { try { setPickupTimesText((JSON.parse(settings.pickup_times) as string[]).join('\n')); } catch { /* */ } }
    if (settings.hero_slides) { try { setHeroSlidesText((JSON.parse(settings.hero_slides) as { img: string; word: string }[]).map((h) => `${h.img} | ${h.word}`).join('\n')); } catch { /* */ } }
  }, [settings]);

  async function saveSettings() {
    setSavingSettings(true);
    const pickupTimes = pickupTimesText.split('\n').map((t) => t.trim()).filter(Boolean);
    const heroSlides = heroSlidesText.split('\n').map((line) => {
      const [img, word] = line.split('|').map((s) => s.trim());
      return img ? { img, word: word || '' } : null;
    }).filter(Boolean);
    await supabase.from('admin_settings').upsert([
      { key: 'hero_slides', value: JSON.stringify(heroSlides) },
      { key: 'comment_field_enabled', value: String(commentFieldEnabled) },
      { key: 'comment_field_label', value: commentFieldLabel },
      { key: 'customer_care_phone', value: customerCarePhone },
      { key: 'customer_care_email', value: customerCareEmail },
      { key: 'points_per_1000', value: pointsPer1000 },
      { key: 'pickup_times', value: JSON.stringify(pickupTimes) },
      { key: 'late_pickup_disclaimer', value: lateDisclaimer },
      { key: 'low_stock_threshold', value: lowStockThreshold },
      { key: 'paystack_enabled', value: String(paystackEnabled) },
      { key: 'paystack_public_key', value: paystackPublicKey },
    ], { onConflict: 'key' });
    setSavingSettings(false);
    qc.invalidateQueries({ queryKey: ['admin', 'settings'] });
    qc.invalidateQueries({ queryKey: ['hero_slides'] });
  }

  async function toggleAdmin(userId: string, makeAdmin: boolean) {
    await supabase.from('profiles').update({ is_admin: makeAdmin }).eq('id', userId);
    qc.invalidateQueries({ queryKey: ['admin', 'profiles'] });
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-5">Settings</h1>
      <div className="space-y-6 max-w-2xl">
        <div className="bg-white rounded-lg border border-gray-100 p-5 space-y-4">
          <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2"><Settings size={18} />Order Form</h2>
          <div className="flex items-center justify-between">
            <div><p className="text-sm font-semibold text-gray-900">Customer Comment Field</p><p className="text-xs text-gray-500">Show the optional comment field</p></div>
            <button onClick={() => setCommentFieldEnabled(!commentFieldEnabled)}>{commentFieldEnabled ? <ToggleRight size={32} className="text-green-600" /> : <ToggleLeft size={32} className="text-gray-300" />}</button>
          </div>
          {commentFieldEnabled && <input type="text" value={commentFieldLabel} onChange={(e) => setCommentFieldLabel(e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-emerald-500" />}
        </div>

        <div className="bg-white rounded-lg border border-gray-100 p-5 space-y-3">
          <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2"><Phone size={18} />Customer Care</h2>
          <div className="grid grid-cols-2 gap-4">
            <div><label className="block text-xs font-semibold text-gray-600 mb-1">Phone</label><input type="tel" value={customerCarePhone} onChange={(e) => setCustomerCarePhone(e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-emerald-500" /></div>
            <div><label className="block text-xs font-semibold text-gray-600 mb-1">Email</label><input type="email" value={customerCareEmail} onChange={(e) => setCustomerCareEmail(e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-emerald-500" /></div>
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-100 p-5 space-y-3">
          <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2"><Award size={18} />Rewards & Pickup</h2>
          <div><label className="block text-xs font-semibold text-gray-600 mb-1">Points earned per ₦1,000 spent</label><input type="number" value={pointsPer1000} onChange={(e) => setPointsPer1000(e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-emerald-500" /></div>
          <div><label className="block text-xs font-semibold text-gray-600 mb-1">Time windows — pickup &amp; delivery (one per line)</label><textarea value={pickupTimesText} onChange={(e) => setPickupTimesText(e.target.value)} rows={3} placeholder={'Morning (9am - 12pm)\nAfternoon (12pm - 4pm)\nEvening (4pm - 7pm)'} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-emerald-500 resize-none" /></div>
          <div><label className="block text-xs font-semibold text-gray-600 mb-1">Late pickup disclaimer</label><textarea value={lateDisclaimer} onChange={(e) => setLateDisclaimer(e.target.value)} rows={2} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-emerald-500 resize-none" /></div>
          <div><label className="block text-xs font-semibold text-gray-600 mb-1">Low-stock alert threshold</label><input type="number" value={lowStockThreshold} onChange={(e) => setLowStockThreshold(e.target.value)} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-emerald-500" /></div>
        </div>

        <div className="bg-white rounded-lg border border-gray-100 p-5 space-y-3">
          <p className="text-sm font-bold text-gray-800">Homepage hero</p>
          <p className="text-xs text-gray-500">One slide per line as <code className="bg-gray-100 px-1 rounded">image URL | headline word</code>. The word shows in large italic on the hero. Leave empty to use the built-in defaults.</p>
          <textarea value={heroSlidesText} onChange={(e) => setHeroSlidesText(e.target.value)} rows={5} placeholder={'https://.../beef.jpg | Difference\nhttps://.../fresh.jpg | Freshness'} className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm font-mono focus:outline-none focus:border-emerald-500 resize-none" />
          {heroSlidesText.trim() && (
            <div className="flex gap-2 overflow-x-auto pb-1">
              {heroSlidesText.split('\n').map((l) => l.split('|')[0].trim()).filter(Boolean).map((u, i) => (
                <img key={i} src={u} alt="" className="h-16 w-24 object-cover rounded-lg flex-shrink-0 border border-gray-200" onError={(e) => { (e.target as HTMLImageElement).style.opacity = '0.3'; }} />
              ))}
            </div>
          )}
        </div>

        <div className="bg-white rounded-lg border border-gray-100 p-5 space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2"><CreditCard size={18} />Online Payment (Paystack)</h2>
              <p className="text-xs text-gray-500 mt-0.5">Let customers pay instantly at checkout. Off by default.</p>
            </div>
            <button onClick={() => setPaystackEnabled((v) => !v)}>{paystackEnabled ? <ToggleRight size={32} className="text-emerald-600" /> : <ToggleLeft size={32} className="text-gray-300" />}</button>
          </div>
          {paystackEnabled && (
            <div><label className="block text-xs font-semibold text-gray-600 mb-1">Paystack Public Key</label><input value={paystackPublicKey} onChange={(e) => setPaystackPublicKey(e.target.value)} placeholder="pk_test_..." className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-emerald-500" /><p className="text-[11px] text-gray-400 mt-1">Secret key goes in the verify-paystack edge function (PAYSTACK_SECRET_KEY), never here.</p></div>
          )}
        </div>

        <button onClick={saveSettings} disabled={savingSettings} className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-300 text-white px-5 py-2.5 rounded-lg text-sm font-semibold">
          {savingSettings ? <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> : <CheckCircle2 size={16} />}Save All Settings
        </button>

        <div className="bg-white rounded-lg border border-gray-100 p-5 space-y-3">
          <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2"><Shield size={18} />Team & Admin Access</h2>
          <p className="text-xs text-gray-500">Grant or revoke admin (Staff Console) access. Registered users appear here.</p>
          <div className="divide-y divide-gray-50">
            {profilesList.map((p) => (
              <div key={p.id} className="flex items-center justify-between py-2.5">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-gray-800 truncate">{p.full_name || p.email || p.phone || 'User'}</p>
                  <p className="text-xs text-gray-400 truncate">{p.email || p.phone}</p>
                </div>
                <button onClick={() => toggleAdmin(p.id, !p.is_admin)} className={`text-xs font-semibold px-3 py-1.5 rounded-lg ${p.is_admin ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200' : 'border border-gray-200 text-gray-600 hover:bg-gray-50'}`}>
                  {p.is_admin ? 'Admin ✓' : 'Make admin'}
                </button>
              </div>
            ))}
            {profilesList.length === 0 && <p className="text-sm text-gray-400 py-3">No registered users yet.</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
