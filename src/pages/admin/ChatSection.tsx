import { useState, useEffect, useCallback } from 'react';
import { Send } from 'lucide-react';
import { supabase, type Message } from '../../lib/supabase';

type Thread = { user_id: string; name: string; last: string; unread: number };

export default function ChatSection() {
  const [threads, setThreads] = useState<Thread[]>([]);
  const [activeThread, setActiveThread] = useState<string | null>(null);
  const [threadMessages, setThreadMessages] = useState<Message[]>([]);
  const [chatInput, setChatInput] = useState('');

  const loadThreads = useCallback(async () => {
    const { data } = await supabase.from('messages').select('*').order('created_at', { ascending: false });
    const map = new Map<string, Thread>();
    for (const m of (data ?? []) as Message[]) {
      if (!map.has(m.user_id)) map.set(m.user_id, { user_id: m.user_id, name: '', last: m.body, unread: 0 });
      if (m.sender === 'user' && !m.is_read) map.get(m.user_id)!.unread++;
    }
    const ids = [...map.keys()];
    if (ids.length) {
      const { data: profs } = await supabase.from('profiles').select('id, full_name, email').in('id', ids);
      for (const p of profs ?? []) { const t = map.get(p.id); if (t) t.name = p.full_name || p.email; }
    }
    setThreads([...map.values()]);
  }, []);

  useEffect(() => { loadThreads(); }, [loadThreads]);

  async function openThread(userId: string) {
    setActiveThread(userId);
    const { data } = await supabase.from('messages').select('*').eq('user_id', userId).order('created_at');
    setThreadMessages(data ?? []);
    await supabase.from('messages').update({ is_read: true }).eq('user_id', userId).eq('sender', 'user');
    loadThreads();
  }

  async function sendAdminMessage() {
    if (!chatInput.trim() || !activeThread) return;
    const body = chatInput.trim();
    setChatInput('');
    await supabase.from('messages').insert({ user_id: activeThread, sender: 'admin', body });
    await supabase.from('notifications').insert({ recipient_type: 'user', user_id: activeThread, title: 'New message from Koyan', body, type: 'message' });
    openThread(activeThread);
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <h1 className="text-2xl font-bold text-gray-900 mb-5">Chat</h1>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 h-[600px]">
        <div className="bg-white rounded-lg border border-gray-100 overflow-y-auto">
          <div className="px-4 py-3 border-b border-gray-100"><p className="text-sm font-bold text-gray-900">Conversations</p></div>
          {threads.length === 0 ? <p className="text-sm text-gray-400 text-center py-8">No conversations.</p> : threads.map((t) => (
            <button key={t.user_id} onClick={() => openThread(t.user_id)} className={`w-full text-left px-4 py-3 border-b border-gray-50 hover:bg-gray-50 ${activeThread === t.user_id ? 'bg-blue-50' : ''}`}>
              <div className="flex items-center justify-between"><span className="text-sm font-semibold text-gray-900">{t.name || 'Customer'}</span>{t.unread > 0 && <span className="bg-red-500 text-white text-[10px] rounded-full px-1.5">{t.unread}</span>}</div>
              <p className="text-xs text-gray-500 truncate mt-0.5">{t.last}</p>
            </button>
          ))}
        </div>
        <div className="md:col-span-2 bg-white rounded-lg border border-gray-100 flex flex-col">
          {activeThread ? (
            <>
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {threadMessages.map((m) => (
                  <div key={m.id} className={`flex ${m.sender === 'admin' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[75%] rounded-lg px-4 py-2 text-sm ${m.sender === 'admin' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-800'}`}>{m.body}<div className={`text-[10px] mt-1 ${m.sender === 'admin' ? 'text-blue-100' : 'text-gray-400'}`}>{new Date(m.created_at).toLocaleString()}</div></div>
                  </div>
                ))}
              </div>
              <div className="border-t border-gray-100 p-3 flex gap-2">
                <input value={chatInput} onChange={(e) => setChatInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && sendAdminMessage()} placeholder="Reply..." className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-emerald-500" />
                <button onClick={sendAdminMessage} className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-1"><Send size={14} />Send</button>
              </div>
            </>
          ) : <div className="flex-1 flex items-center justify-center text-gray-400 text-sm">Select a conversation</div>}
        </div>
      </div>
    </div>
  );
}
