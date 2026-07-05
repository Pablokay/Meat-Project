import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Mail, Lock, Eye, EyeOff, User, AlertCircle, CheckCircle, AtSign, Leaf, ArrowLeft } from 'lucide-react';
import { signInUser, signUpUser, sendPasswordReset } from '../lib/supabase';

type UserLoginProps = {
  onLogin: () => void;
  onGuestCheckout?: () => void;
};

export default function UserLogin({ onLogin, onGuestCheckout }: UserLoginProps) {
  const [mode, setMode] = useState<'login' | 'signup' | 'forgot'>('login');
  const [identifier, setIdentifier] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [name, setName] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const reset = () => { setError(''); setSuccess(''); };

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault(); reset();
    if (!identifier || !password) { setError('Please enter your email/phone and password'); return; }
    setLoading(true);
    const { error: err } = await signInUser(identifier, password);
    setLoading(false);
    if (err) { setError(err.message || 'Invalid credentials'); return; }
    onLogin();
  }

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault(); reset();
    if (!name || !identifier || !password || !confirmPassword) { setError('Please fill in all fields'); return; }
    if (name.trim().length < 2) { setError('Name must be at least 2 characters'); return; }
    if (password.length < 8) { setError('Password must be at least 8 characters'); return; }
    if (password !== confirmPassword) { setError('Passwords do not match'); return; }
    setLoading(true);
    const { data, error: err } = await signUpUser({ identifier, password, fullName: name.trim() });
    setLoading(false);
    if (err) { setError(err.message || 'Signup failed'); return; }
    if (data.session) onLogin();
    else { setSuccess('Account created! Check your email/phone to confirm, then sign in.'); setMode('login'); }
  }

  async function handleForgot(e: React.FormEvent) {
    e.preventDefault(); reset();
    if (!email) { setError('Enter the email associated with your account'); return; }
    setLoading(true);
    const { error: err } = await sendPasswordReset(email);
    setLoading(false);
    if (err) { setError(err.message || 'Could not send reset email'); return; }
    setSuccess('Password reset link sent. Check your email.');
  }

  const inputCls = 'w-full pl-10 pr-10 py-3 bg-paper border border-forest-700/15 rounded-lg text-sm focus:outline-none focus:border-forest-500 transition-colors';

  return (
    <div className="min-h-screen bg-cream lg:grid lg:grid-cols-2">
      {/* Left image panel */}
      <div className="relative hidden lg:block overflow-hidden">
        <img src="https://images.pexels.com/photos/735968/pexels-photo-735968.jpeg" alt="Farm" className="absolute inset-0 w-full h-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-forest-900/85 via-forest-900/40 to-forest-900/50" />
        <div className="relative h-full flex flex-col justify-between p-12 text-cream">
          <Link to="/" className="inline-flex items-center gap-2.5 w-fit">
            <div className="bg-forest-700 p-2 rounded-full"><Leaf size={20} className="text-cream" strokeWidth={1.75} /></div>
            <span className="text-xl font-bold">Koyan<span className="accent"> Fresh</span></span>
          </Link>
          <div>
            <h2 className="font-serif text-5xl leading-[1.05]">Fresh from the <span className="italic">farm</span>,<br />to your table.</h2>
            <p className="text-cream/70 mt-4 max-w-sm">Create an account to track orders, save addresses, earn reward points, and reorder in a tap.</p>
          </div>
          <p className="text-cream/50 text-sm">Trusted by families & kitchens across Nigeria.</p>
        </div>
      </div>

      {/* Right form */}
      <div className="flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-md">
          <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-forest-800/50 hover:text-forest-800 font-medium mb-6"><ArrowLeft size={15} />Back to shop</Link>

          {mode !== 'forgot' && (
            <div className="flex gap-2 mb-6 bg-sand/60 p-1 rounded-full">
              <button onClick={() => { setMode('login'); reset(); }} className={`flex-1 py-2.5 rounded-full text-sm font-semibold transition-colors ${mode === 'login' ? 'bg-forest-700 text-cream' : 'text-forest-800/60'}`}>Sign In</button>
              <button onClick={() => { setMode('signup'); reset(); }} className={`flex-1 py-2.5 rounded-full text-sm font-semibold transition-colors ${mode === 'signup' ? 'bg-forest-700 text-cream' : 'text-forest-800/60'}`}>Create Account</button>
            </div>
          )}

          <h1 className="text-3xl font-bold text-forest-900">
            {mode === 'login' ? <>Welcome <span className="accent text-forest-600">back</span></> : mode === 'signup' ? <>Create your <span className="accent text-forest-600">account</span></> : <>Reset <span className="accent text-forest-600">password</span></>}
          </h1>
          <p className="text-forest-800/50 text-sm mt-1 mb-6">{mode === 'login' ? 'Sign in to continue your order.' : mode === 'signup' ? 'Join for points, faster checkout & tracking.' : 'We\'ll email you a reset link.'}</p>

          {mode === 'login' && (
            <form onSubmit={handleLogin} className="space-y-4">
              <Field icon={<AtSign size={16} />}><input type="text" value={identifier} onChange={(e) => { setIdentifier(e.target.value); reset(); }} className={inputCls} placeholder="Email or phone" autoComplete="username" /></Field>
              <Field icon={<Lock size={16} />} trailing={<button type="button" onClick={() => setShowPassword(!showPassword)} className="text-forest-800/40 hover:text-forest-800">{showPassword ? <EyeOff size={16} /> : <Eye size={16} />}</button>}>
                <input type={showPassword ? 'text' : 'password'} value={password} onChange={(e) => { setPassword(e.target.value); reset(); }} className={inputCls} placeholder="Password" autoComplete="current-password" />
              </Field>
              <button type="button" onClick={() => { setMode('forgot'); reset(); }} className="text-xs text-forest-600 hover:underline font-medium">Forgot password?</button>
              {error && <ErrorBox msg={error} />}{success && <SuccessBox msg={success} />}
              <button type="submit" disabled={loading} className="btn-primary w-full">{loading ? 'Signing In...' : 'Sign In'}</button>
            </form>
          )}

          {mode === 'signup' && (
            <form onSubmit={handleSignup} className="space-y-4">
              <Field icon={<User size={16} />}><input type="text" value={name} onChange={(e) => { setName(e.target.value); reset(); }} className={inputCls} placeholder="Full name" autoComplete="name" /></Field>
              <Field icon={<AtSign size={16} />}><input type="text" value={identifier} onChange={(e) => { setIdentifier(e.target.value); reset(); }} className={inputCls} placeholder="Email or phone" autoComplete="username" /></Field>
              <Field icon={<Lock size={16} />} trailing={<button type="button" onClick={() => setShowPassword(!showPassword)} className="text-forest-800/40 hover:text-forest-800">{showPassword ? <EyeOff size={16} /> : <Eye size={16} />}</button>}>
                <input type={showPassword ? 'text' : 'password'} value={password} onChange={(e) => { setPassword(e.target.value); reset(); }} className={inputCls} placeholder="Password (min 8)" autoComplete="new-password" />
              </Field>
              <Field icon={<Lock size={16} />}><input type={showPassword ? 'text' : 'password'} value={confirmPassword} onChange={(e) => { setConfirmPassword(e.target.value); reset(); }} className={inputCls} placeholder="Confirm password" autoComplete="new-password" /></Field>
              {error && <ErrorBox msg={error} />}{success && <SuccessBox msg={success} />}
              <button type="submit" disabled={loading} className="btn-primary w-full">{loading ? 'Creating...' : 'Create Account'}</button>
            </form>
          )}

          {mode === 'forgot' && (
            <form onSubmit={handleForgot} className="space-y-4">
              <Field icon={<Mail size={16} />}><input type="email" value={email} onChange={(e) => { setEmail(e.target.value); reset(); }} className={inputCls} placeholder="you@example.com" /></Field>
              {error && <ErrorBox msg={error} />}{success && <SuccessBox msg={success} />}
              <button type="submit" disabled={loading} className="btn-primary w-full">{loading ? 'Sending...' : 'Send Reset Link'}</button>
              <button type="button" onClick={() => { setMode('login'); reset(); }} className="w-full text-sm text-forest-800/60 hover:text-forest-800 font-medium">Back to sign in</button>
            </form>
          )}

          {mode !== 'forgot' && (
            <>
              <div className="flex items-center gap-3 my-5"><div className="flex-1 h-px bg-forest-700/10" /><span className="text-xs text-forest-800/40">or</span><div className="flex-1 h-px bg-forest-700/10" /></div>
              <button onClick={onGuestCheckout} className="btn-outline w-full">Continue as Guest</button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Field({ icon, trailing, children }: { icon: React.ReactNode; trailing?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="relative">
      <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-forest-800/40">{icon}</span>
      {children}
      {trailing && <span className="absolute right-3.5 top-1/2 -translate-y-1/2">{trailing}</span>}
    </div>
  );
}

function ErrorBox({ msg }: { msg: string }) {
  return <div className="bg-clay/10 border border-clay/20 rounded-lg px-3 py-2.5 flex items-center gap-2"><AlertCircle size={16} className="text-clay flex-shrink-0" /><p className="text-sm text-clay">{msg}</p></div>;
}
function SuccessBox({ msg }: { msg: string }) {
  return <div className="bg-forest-50 border border-forest-700/15 rounded-lg px-3 py-2.5 flex items-center gap-2"><CheckCircle size={16} className="text-forest-700 flex-shrink-0" /><p className="text-sm text-forest-700">{msg}</p></div>;
}
