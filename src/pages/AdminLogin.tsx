import { useState } from 'react';
import { Lock, Shield, Eye, EyeOff, AlertCircle, Mail } from 'lucide-react';
import { signInUser, sendPasswordReset, getProfile, signOutUser } from '../lib/supabase';

type AdminLoginProps = {
  onLogin: () => void;
};

export default function AdminLogin({ onLogin }: AdminLoginProps) {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showForgot, setShowForgot] = useState(false);
  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotMsg, setForgotMsg] = useState('');

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!identifier || !password) {
      setError('Enter your email/phone and password');
      return;
    }
    setLoading(true);
    const { data, error: err } = await signInUser(identifier, password);
    if (err || !data.user) {
      setLoading(false);
      setError(err?.message || 'Invalid credentials');
      return;
    }
    const profile = await getProfile(data.user.id);
    setLoading(false);
    if (!profile?.is_admin) {
      await signOutUser();
      setError('This account does not have admin access.');
      return;
    }
    onLogin();
  }

  async function handleForgot(e: React.FormEvent) {
    e.preventDefault();
    setForgotMsg('');
    if (!forgotEmail) { setForgotMsg('Enter your admin email'); return; }
    const { error: err } = await sendPasswordReset(forgotEmail);
    setForgotMsg(err ? (err.message || 'Failed to send') : 'Reset link sent. Check your email.');
  }

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center px-4 relative overflow-hidden">
      <div className="absolute inset-0 opacity-5">
        <div className="absolute inset-0" style={{ backgroundImage: `radial-gradient(circle at 1px 1px, white 1px, transparent 0)`, backgroundSize: '40px 40px' }} />
      </div>

      <div className="relative w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-emerald-600 rounded-2xl mb-4 shadow-lg shadow-emerald-600/30">
            <Shield size={32} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white">Staff Console</h1>
          <p className="text-gray-400 text-sm mt-1">Koyan FreshLivestock Management</p>
        </div>

        <div className="bg-white rounded-2xl shadow-2xl p-6">
          <div className="flex items-center gap-2 mb-5 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
            <Shield size={16} className="text-amber-600 flex-shrink-0" />
            <p className="text-xs text-amber-700 font-medium">Authorized personnel only</p>
          </div>

          {!showForgot ? (
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Email or Phone</label>
                <div className="relative">
                  <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    value={identifier}
                    onChange={(e) => { setIdentifier(e.target.value); setError(''); }}
                    className="w-full pl-9 pr-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="admin@koyanfresh.com"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Password</label>
                <div className="relative">
                  <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => { setPassword(e.target.value); setError(''); }}
                    className="w-full pl-9 pr-10 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Enter password"
                  />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2.5 flex items-center gap-2">
                  <AlertCircle size={16} className="text-red-600 flex-shrink-0" />
                  <p className="text-sm text-red-600">{error}</p>
                </div>
              )}

              <button type="submit" disabled={loading} className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:bg-gray-400 text-white font-semibold py-2.5 rounded-lg transition-colors text-sm">
                {loading ? 'Signing In...' : 'Sign In'}
              </button>
              <button type="button" onClick={() => { setShowForgot(true); setForgotMsg(''); }} className="w-full text-xs text-gray-500 hover:text-gray-700 font-medium">
                Forgot password?
              </button>
            </form>
          ) : (
            <form onSubmit={handleForgot} className="space-y-4">
              <p className="text-sm text-gray-600">Enter your admin email to receive a reset link.</p>
              <div className="relative">
                <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input type="email" value={forgotEmail} onChange={(e) => setForgotEmail(e.target.value)} className="w-full pl-9 pr-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" placeholder="admin@koyanfresh.com" />
              </div>
              {forgotMsg && <p className="text-sm text-blue-600">{forgotMsg}</p>}
              <button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-2.5 rounded-lg text-sm">Send Reset Link</button>
              <button type="button" onClick={() => setShowForgot(false)} className="w-full text-xs text-gray-500 hover:text-gray-700 font-medium">Back to sign in</button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
