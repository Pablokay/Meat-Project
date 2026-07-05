import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Bell, FileText } from 'lucide-react';
import { supabase, type Order } from '../../lib/supabase';
import { useAdminOrders, useAdminBlastLog } from '../../hooks/adminQueries';

const STATUS_LABELS: Record<string, string> = {
  pending: 'Pending', awaiting_confirmation: 'Awaiting Confirmation', awaiting_payment: 'Awaiting Payment',
  confirmed: 'Confirmed', processing: 'Processing', ready: 'Ready', in_transit: 'In Transit',
  delivered: 'Delivered', cancelled: 'Cancelled',
};

export default function BlastSection() {
  const qc = useQueryClient();
  const { data: orders = [] } = useAdminOrders();
  const { data: blastLog = [] } = useAdminBlastLog();

  const [blastMessage, setBlastMessage] = useState('');
  const [blastAudience, setBlastAudience] = useState('all_active');
  const [blastEmail, setBlastEmail] = useState(false);
  const [blastSms, setBlastSms] = useState(false);
  const [blastWhatsapp, setBlastWhatsapp] = useState(false);
  const [blasting, setBlasting] = useState(false);

  function audienceUserIds(): string[] {
    let src = orders;
    if (blastAudience === 'all_active') src = orders.filter((o) => !['delivered', 'cancelled'].includes(o.order_status));
    else if (blastAudience !== 'all') src = orders.filter((o) => o.order_status === blastAudience);
    const ids = new Set<string>();
    for (const o of src) if (o.user_id) ids.add(o.user_id);
    return [...ids];
  }

  async function sendBlast() {
    if (!blastMessage.trim()) return;
    setBlasting(true);
    const ids = audienceUserIds();
    if (ids.length) {
      await supabase.from('notifications').insert(ids.map((uid) => ({
        recipient_type: 'user' as const, user_id: uid, title: 'Announcement', body: blastMessage.trim(), type: 'blast',
      })));
    }
    const inAudience = (o: Order) => blastAudience === 'all' ? true : blastAudience === 'all_active' ? !['delivered', 'cancelled'].includes(o.order_status) : o.order_status === blastAudience;
    const channels = [blastEmail && 'email', blastSms && 'sms', blastWhatsapp && 'whatsapp'].filter(Boolean).join(',') || 'in_app';
    await supabase.from('blast_log').insert({ channel: channels, audience: blastAudience, message: blastMessage.trim(), recipient_count: ids.length });

    if (blastEmail) {
      const emails = [...new Set(orders.filter((o) => inAudience(o) && o.customer_email).map((o) => o.customer_email))];
      try { await supabase.functions.invoke('send-order-notification', { body: { blast: true, emails, message: blastMessage.trim() } }); } catch { /* */ }
    }
    if (blastSms || blastWhatsapp) {
      const phones = [...new Set(orders.filter((o) => inAudience(o) && o.customer_phone).map((o) => o.customer_phone))];
      if (blastSms) { try { await supabase.functions.invoke('send-termii', { body: { channel: 'sms', to: phones, message: blastMessage.trim() } }); } catch { /* */ } }
      if (blastWhatsapp) { try { await supabase.functions.invoke('send-termii', { body: { channel: 'whatsapp', to: phones, message: blastMessage.trim() } }); } catch { /* */ } }
    }
    setBlastMessage('');
    setBlasting(false);
    qc.invalidateQueries({ queryKey: ['admin'] });
    alert(`Blast sent to ${ids.length} user(s).`);
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-5">Blast & Announcements</h1>
      <div className="space-y-6 max-w-2xl">
        <div className="bg-white rounded-lg border border-gray-100 p-6">
          <h3 className="font-bold text-gray-900 mb-1">Send Blast / Batch Message</h3>
          <p className="text-sm text-gray-500 mb-4">Sends an in-app notification (and optional email) to customers in the selected segment.</p>
          <label className="block text-xs font-semibold text-gray-600 mb-1">Audience</label>
          <select value={blastAudience} onChange={(e) => setBlastAudience(e.target.value)} className="w-full mb-3 px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-emerald-500">
            <option value="all_active">All active orders</option>
            <option value="all">All customers with orders</option>
            {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>Status: {v}</option>)}
          </select>
          <textarea value={blastMessage} onChange={(e) => setBlastMessage(e.target.value)} rows={4} placeholder="Your announcement..." className="w-full border-2 border-gray-200 rounded-lg p-3 text-sm focus:outline-none focus:border-emerald-500 resize-none" />
          <div className="mt-3 space-y-1.5">
            <label className="flex items-center gap-2 text-sm text-gray-600"><input type="checkbox" checked={blastEmail} onChange={(e) => setBlastEmail(e.target.checked)} className="accent-emerald-600" />Also send email <span className="text-xs text-gray-400">(Resend)</span></label>
            <label className="flex items-center gap-2 text-sm text-gray-600"><input type="checkbox" checked={blastSms} onChange={(e) => setBlastSms(e.target.checked)} className="accent-emerald-600" />Also send SMS <span className="text-xs text-gray-400">(Termii)</span></label>
            <label className="flex items-center gap-2 text-sm text-gray-600"><input type="checkbox" checked={blastWhatsapp} onChange={(e) => setBlastWhatsapp(e.target.checked)} className="accent-emerald-600" />Also send WhatsApp <span className="text-xs text-gray-400">(Termii)</span></label>
          </div>
          <button onClick={sendBlast} disabled={blasting || !blastMessage.trim()} className="mt-3 flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-300 text-white px-5 py-2.5 rounded-lg text-sm font-semibold">
            {blasting ? <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" /> : <Bell size={15} />}Send Blast
          </button>
        </div>

        <div className="bg-white rounded-lg border border-gray-100 p-6">
          <h3 className="font-bold text-gray-900 mb-3 flex items-center gap-2"><FileText size={16} />Blast Report</h3>
          {blastLog.length === 0 ? <p className="text-sm text-gray-400">No blasts sent yet.</p> : (
            <div className="space-y-2">
              {blastLog.map((b) => (
                <div key={b.id} className="border border-gray-100 rounded-lg p-3">
                  <div className="flex items-center justify-between"><span className="text-xs font-semibold text-gray-700">{b.channel} · {b.audience}</span><span className="text-xs text-gray-400">{new Date(b.created_at).toLocaleString()}</span></div>
                  <p className="text-sm text-gray-800 mt-1">{b.message}</p>
                  <p className="text-xs text-blue-600 mt-1">Sent to {b.recipient_count} recipient(s)</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
