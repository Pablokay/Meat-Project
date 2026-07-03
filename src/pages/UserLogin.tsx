import { useState } from 'react';
import { Mail, Lock, Eye, EyeOff, User, ShoppingBag, AlertCircle, CheckCircle, AtSign } from 'lucide-react';
import { signInUser, signUpUser, sendPasswordReset } from '../lib/supabase';

type UserLoginProps = {
  onLogin: () => void;
  onGuestCheckout?: () => void;
};

export default function UserLogin({ onLogin, onGuestCheckout }: UserLoginProps) {
  const [mode, setMode] = useState<'login' | 'signup' | 'forgot'>('login');
  const [identifier, setIdentifier] = useState(''); // email or phone
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [name, setName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  function reset() {
    setError('');
    setSuccess('');
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    reset();
    if (!identifier || !password) {
      setError('Please enter your email/phone and password');
      return;
    }
    setLoading(true);
    const { error: err } = await signInUser(identifier, password);
    setLoading(false);
    if (err) {
      setError(err.message || 'Invalid credentials');
      return;
    }
    onLogin();
  }

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    reset();
    if (!name || !identifier || !password || !confirmPassword) {
      setError('Please fill in all fields');
      return;
    }
    if (name.trim().length < 2) {
      setError('Name must be at least 2 characters');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    setLoading(true);
    const { data, error: err } = await signUpUser({ identifier, password, fullName: name.trim() });
    setLoading(false);
    if (err) {
      setError(err.message || 'Signup failed');
      return;
    }
    // If email confirmation is required there is no active session yet.
    if (data.session) {
      onLogin();
    } else {
      setSuccess('Account created! Check your email/phone to confirm, then sign in.');
      setMode('login');
    }
  }

  async function handleForgot(e: React.FormEvent) {
    e.preventDefault();
    reset();
    if (!email) {
      setError('Enter the email associated with your account');
      return;
    }
    setLoading(true);
    const { error: err } = await sendPasswordReset(email);
    setLoading(false);
    if (err) {
      setError(err.message || 'Could not send reset email');
      return;
    }
    setSuccess('Password reset link sent. Check your email.');
  }

  const inputCls =
    'w-full pl-9 pr-10 py-2.5 border-2 border-gray-200 rounded-lg text-sm focus:outline-none focus:border-blue-500 transition-colors';

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 bg-blue-700 rounded-2xl mb-4 shadow-lg">
            <ShoppingBag size={28} className="text-white" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900">Koyan Fresh</h1>
          <p className="text-gray-600 text-sm mt-1">Premium Livestock Delivery</p>
        </div>

        <div className="bg-white rounded-2xl shadow-xl p-8">
          {mode !== 'forgot' && (
            <div className="flex gap-2 mb-6">
              <button
                onClick={() => { setMode('login'); reset(); }}
                className={`flex-1 py-2.5 rounded-lg font-semibold transition-colors ${mode === 'login' ? 'bg-blue-700 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
              >
                Sign In
              </button>
              <button
                onClick={() => { setMode('signup'); reset(); }}
                className={`flex-1 py-2.5 rounded-lg font-semibold transition-colors ${mode === 'signup' ? 'bg-blue-700 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'}`}
              >
                Create Account
              </button>
            </div>
          )}

          <button
            onClick={onGuestCheckout}
            className="w-full py-2.5 rounded-lg font-semibold transition-colors bg-gray-100 text-gray-700 hover:bg-gray-200 mb-4 text-sm"
          >
            Continue as Guest
          </button>

          {mode === 'login' && (
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Email or Phone</label>
                <div className="relative">
                  <AtSign size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    value={identifier}
                    onChange={(e) => { setIdentifier(e.target.value); reset(); }}
                    className={inputCls}
                    placeholder="you@example.com or 0801 234 5678"
                    autoComplete="username"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Password</label>
                <div className="relative">
                  <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => { setPassword(e.target.value); reset(); }}
                    className={inputCls}
                    placeholder="Enter password"
                    autoComplete="current-password"
                  />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                <button type="button" onClick={() => { setMode('forgot'); reset(); }} className="text-xs text-blue-600 hover:text-blue-700 font-medium mt-1.5">
                  Forgot password?
                </button>
              </div>

              {error && <ErrorBox msg={error} />}
              {success && <SuccessBox msg={success} />}

              <button type="submit" disabled={loading} className="w-full bg-blue-700 hover:bg-blue-800 disabled:bg-gray-400 text-white font-semibold py-2.5 rounded-lg transition-colors text-sm active:scale-[0.98]">
                {loading ? 'Signing In...' : 'Sign In'}
              </button>
            </form>
          )}

          {mode === 'signup' && (
            <form onSubmit={handleSignup} className="space-y-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Full Name</label>
                <div className="relative">
                  <User size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input type="text" value={name} onChange={(e) => { setName(e.target.value); reset(); }} className={inputCls} placeholder="John Doe" autoComplete="name" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Email or Phone</label>
                <div className="relative">
                  <AtSign size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input type="text" value={identifier} onChange={(e) => { setIdentifier(e.target.value); reset(); }} className={inputCls} placeholder="you@example.com or 0801 234 5678" autoComplete="username" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Password</label>
                <div className="relative">
                  <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input type={showPassword ? 'text' : 'password'} value={password} onChange={(e) => { setPassword(e.target.value); reset(); }} className={inputCls} placeholder="Min 8 characters" autoComplete="new-password" />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Confirm Password</label>
                <div className="relative">
                  <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input type={showPassword ? 'text' : 'password'} value={confirmPassword} onChange={(e) => { setConfirmPassword(e.target.value); reset(); }} className={inputCls} placeholder="Re-enter password" autoComplete="new-password" />
                </div>
              </div>

              {error && <ErrorBox msg={error} />}
              {success && <SuccessBox msg={success} />}

              <button type="submit" disabled={loading} className="w-full bg-blue-700 hover:bg-blue-800 disabled:bg-gray-400 text-white font-semibold py-2.5 rounded-lg transition-colors text-sm active:scale-[0.98]">
                {loading ? 'Creating Account...' : 'Create Account'}
              </button>
            </form>
          )}

          {mode === 'forgot' && (
            <form onSubmit={handleForgot} className="space-y-4">
              <p className="text-sm text-gray-600">Enter your account email and we'll send a reset link.</p>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Email Address</label>
                <div className="relative">
                  <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input type="email" value={email} onChange={(e) => { setEmail(e.target.value); reset(); }} className={inputCls} placeholder="you@example.com" />
                </div>
              </div>
              {error && <ErrorBox msg={error} />}
              {success && <SuccessBox msg={success} />}
              <button type="submit" disabled={loading} className="w-full bg-blue-700 hover:bg-blue-800 disabled:bg-gray-400 text-white font-semibold py-2.5 rounded-lg transition-colors text-sm">
                {loading ? 'Sending...' : 'Send Reset Link'}
              </button>
              <button type="button" onClick={() => { setMode('login'); reset(); }} className="w-full text-sm text-gray-600 hover:text-gray-800 font-medium">
                Back to sign in
              </button>
            </form>
          )}

          <p className="text-xs text-gray-600 text-center mt-4">Your data is secure and encrypted</p>
        </div>
      </div>
    </div>
  );
}

function ErrorBox({ msg }: { msg: string }) {
  return (
    <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2.5 flex items-center gap-2">
      <AlertCircle size={16} className="text-red-600 flex-shrink-0" />
      <p className="text-sm text-red-600">{msg}</p>
    </div>
  );
}

function SuccessBox({ msg }: { msg: string }) {
  return (
    <div className="bg-green-50 border border-green-200 rounded-lg px-3 py-2.5 flex items-center gap-2">
      <CheckCircle size={16} className="text-green-600 flex-shrink-0" />
      <p className="text-sm text-green-600">{msg}</p>
    </div>
  );
}
