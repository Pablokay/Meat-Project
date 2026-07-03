import { useState } from 'react';
import { Lock, Eye, EyeOff, ShoppingBag, CircleCheck as CheckCircle2, CircleAlert as AlertCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';

type ResetPasswordProps = {
  onDone: () => void;
};

export default function ResetPassword({ onDone }: ResetPasswordProps) {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (password.length < 8) { setError('Password must be at least 8 characters'); return; }
    if (password !== confirm) { setError('Passwords do not match'); return; }
    setLoading(true);
    const { error: err } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (err) { setError(err.message || 'Could not update password'); return; }
    setSuccess(true);
    setTimeout(onDone, 1800);
  }

  return (
    <div className="min-h-screen bg-cream flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-forest-700 rounded-2xl mb-4 shadow-lg">
            <ShoppingBag size={26} className="text-cream" />
          </div>
          <h1 className="text-3xl font-bold text-forest-900">Set a new <span className="accent text-forest-600">password</span></h1>
          <p className="text-forest-800/60 text-sm mt-1">Choose a strong password for your account.</p>
        </div>

        <div className="surface p-8">
          {success ? (
            <div className="text-center py-6">
              <CheckCircle2 size={40} className="text-forest-700 mx-auto" />
              <p className="text-forest-900 font-semibold mt-3">Password updated!</p>
              <p className="text-forest-800/60 text-sm mt-1">Taking you back...</p>
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-forest-800 mb-1.5">New Password</label>
                <div className="relative">
                  <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-forest-800/40" />
                  <input type={show ? 'text' : 'password'} value={password} onChange={(e) => { setPassword(e.target.value); setError(''); }} className="w-full pl-9 pr-10 py-2.5 border-2 border-forest-700/15 rounded-lg text-sm focus:outline-none focus:border-forest-500 bg-cream" placeholder="Min 8 characters" />
                  <button type="button" onClick={() => setShow(!show)} className="absolute right-3 top-1/2 -translate-y-1/2 text-forest-800/40 hover:text-forest-800">{show ? <EyeOff size={16} /> : <Eye size={16} />}</button>
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-forest-800 mb-1.5">Confirm Password</label>
                <div className="relative">
                  <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-forest-800/40" />
                  <input type={show ? 'text' : 'password'} value={confirm} onChange={(e) => { setConfirm(e.target.value); setError(''); }} className="w-full pl-9 pr-4 py-2.5 border-2 border-forest-700/15 rounded-lg text-sm focus:outline-none focus:border-forest-500 bg-cream" placeholder="Re-enter password" />
                </div>
              </div>
              {error && (
                <div className="bg-clay/10 border border-clay/20 rounded-lg px-3 py-2.5 flex items-center gap-2">
                  <AlertCircle size={16} className="text-clay flex-shrink-0" /><p className="text-sm text-clay">{error}</p>
                </div>
              )}
              <button type="submit" disabled={loading} className="btn-primary w-full">{loading ? 'Updating...' : 'Update Password'}</button>
              <button type="button" onClick={onDone} className="w-full text-sm text-forest-800/60 hover:text-forest-800 py-1">Cancel</button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
