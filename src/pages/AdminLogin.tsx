import { useState } from 'react';
import { Lock, User, Beef, Shield, Eye, EyeOff, AlertCircle, CheckCircle, X } from 'lucide-react';

type AdminLoginProps = {
  onLogin: () => void;
};

const ADMIN_USER = 'admin';

export default function AdminLogin({ onLogin }: AdminLoginProps) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotPasswordStep, setForgotPasswordStep] = useState<'verify' | 'reset'>('verify');
  const [forgotUsername, setForgotUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPass, setShowNewPass] = useState(false);
  const [showConfirmPass, setShowConfirmPass] = useState(false);
  const [forgotError, setForgotError] = useState('');
  const [forgotSuccess, setForgotSuccess] = useState('');
  const [resettingPassword, setResettingPassword] = useState(false);

  function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    const storedPassword = localStorage.getItem('admin_password') || 'freshlivestock2024';
    if (username === ADMIN_USER && password === storedPassword) {
      sessionStorage.setItem('admin_auth', '1');
      onLogin();
    } else {
      setError('Invalid username or password');
    }
  }

  function handleVerifyUsername(e: React.FormEvent) {
    e.preventDefault();
    setForgotError('');
    if (forgotUsername !== ADMIN_USER) {
      setForgotError('Username not found');
      return;
    }
    setForgotPasswordStep('reset');
  }

  function handleResetPassword(e: React.FormEvent) {
    e.preventDefault();
    setForgotError('');
    setForgotSuccess('');

    if (!newPassword || newPassword.length < 8) {
      setForgotError('New password must be at least 8 characters');
      return;
    }
    if (newPassword !== confirmPassword) {
      setForgotError('Passwords do not match');
      return;
    }

    setResettingPassword(true);
    try {
      localStorage.setItem('admin_password', newPassword);
      setForgotSuccess('Password reset successfully! You can now login with your new password.');
      setTimeout(() => {
        setShowForgotPassword(false);
        setForgotPasswordStep('verify');
        setForgotUsername('');
        setNewPassword('');
        setConfirmPassword('');
        setForgotSuccess('');
      }, 2000);
    } catch (err) {
      setForgotError('Failed to reset password');
    } finally {
      setResettingPassword(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center px-4 relative overflow-hidden">
      <div className="absolute inset-0 opacity-5">
        <div className="absolute inset-0" style={{ backgroundImage: `radial-gradient(circle at 1px 1px, white 1px, transparent 0)`, backgroundSize: '40px 40px' }} />
      </div>

      <div className="relative w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-700 rounded-2xl mb-4 shadow-lg shadow-blue-700/20">
            <Beef size={32} className="text-white" />
          </div>
          <h1 className="text-2xl font-bold text-white">Admin Portal</h1>
          <p className="text-gray-400 text-sm mt-1">Koyan FreshLivestock Management</p>
        </div>

        <div className="bg-white rounded-2xl shadow-2xl p-6">
          <div className="flex items-center gap-2 mb-5 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
            <Shield size={16} className="text-amber-600 flex-shrink-0" />
            <p className="text-xs text-amber-700 font-medium">Authorized personnel only</p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Username</label>
              <div className="relative">
                <User size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input type="text" value={username} onChange={e => { setUsername(e.target.value); setError(''); }} className="w-full pl-9 pr-4 py-2.5 border-2 border-gray-200 rounded-xl text-sm focus:outline-none focus:border-blue-400 transition-colors" placeholder="Enter username" autoComplete="username" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">Password</label>
              <div className="relative">
                <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input type={showPassword ? 'text' : 'password'} value={password} onChange={e => { setPassword(e.target.value); setError(''); }} className="w-full pl-9 pr-10 py-2.5 border-2 border-gray-200 rounded-xl text-sm focus:outline-none focus:border-blue-400 transition-colors" placeholder="Enter password" autoComplete="current-password" />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
            {error && <div className="bg-red-50 border border-red-200 rounded-xl px-3 py-2 flex items-center gap-2"><div className="w-1 h-1 rounded-full bg-red-500" /><p className="text-xs text-red-600 font-medium">{error}</p></div>}
            <button type="submit" className="w-full bg-blue-700 hover:bg-blue-800 text-white font-semibold py-2.5 rounded-xl transition-colors text-sm active:scale-[0.98]">Sign In</button>
          </form>

          <div className="mt-4 text-center">
            <button onClick={() => setShowForgotPassword(true)} className="text-sm text-blue-700 hover:text-blue-800 font-medium">
              Forgot Password?
            </button>
          </div>
        </div>

        <p className="text-center text-xs text-gray-600 mt-6">Koyan FreshLivestock Admin v1.0</p>
      </div>

      {/* Forgot Password Modal */}
      {showForgotPassword && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setShowForgotPassword(false)} />
          <div className="relative bg-white rounded-2xl shadow-2xl max-w-sm w-full mx-4">
            <div className="flex items-center justify-between p-5 border-b border-gray-100">
              <h3 className="text-lg font-bold text-gray-900">Reset Password</h3>
              <button onClick={() => { setShowForgotPassword(false); setForgotPasswordStep('verify'); setForgotUsername(''); setNewPassword(''); setConfirmPassword(''); setForgotError(''); setForgotSuccess(''); }} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg">
                <X size={18} />
              </button>
            </div>

            <div className="p-5">
              {forgotPasswordStep === 'verify' ? (
                <form onSubmit={handleVerifyUsername} className="space-y-4">
                  <p className="text-sm text-gray-600 mb-4">Enter your admin username to reset your password</p>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">Username</label>
                    <div className="relative">
                      <User size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                      <input
                        type="text"
                        value={forgotUsername}
                        onChange={(e) => {
                          setForgotUsername(e.target.value);
                          setForgotError('');
                        }}
                        className="w-full pl-9 pr-4 py-2.5 border-2 border-gray-200 rounded-xl text-sm focus:outline-none focus:border-blue-400 transition-colors"
                        placeholder="Enter username"
                      />
                    </div>
                  </div>
                  {forgotError && (
                    <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 flex items-center gap-2">
                      <AlertCircle size={16} className="text-red-600 flex-shrink-0" />
                      <p className="text-sm text-red-600">{forgotError}</p>
                    </div>
                  )}
                  <div className="flex gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => setShowForgotPassword(false)}
                      className="flex-1 py-2.5 border-2 border-gray-200 rounded-lg text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="flex-1 bg-blue-700 hover:bg-blue-800 text-white py-2.5 rounded-lg text-sm font-semibold transition-colors"
                    >
                      Continue
                    </button>
                  </div>
                </form>
              ) : (
                <form onSubmit={handleResetPassword} className="space-y-4">
                  <p className="text-sm text-gray-600 mb-4">Set a new password for your admin account</p>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">New Password</label>
                    <div className="relative">
                      <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                      <input
                        type={showNewPass ? 'text' : 'password'}
                        value={newPassword}
                        onChange={(e) => {
                          setNewPassword(e.target.value);
                          setForgotError('');
                        }}
                        className="w-full pl-9 pr-10 py-2.5 border-2 border-gray-200 rounded-xl text-sm focus:outline-none focus:border-blue-400 transition-colors"
                        placeholder="Min 8 characters"
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewPass(!showNewPass)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      >
                        {showNewPass ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                    {newPassword && newPassword.length < 8 && (
                      <p className="text-xs text-amber-600 mt-1">Must be at least 8 characters</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1.5">Confirm Password</label>
                    <div className="relative">
                      <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                      <input
                        type={showConfirmPass ? 'text' : 'password'}
                        value={confirmPassword}
                        onChange={(e) => {
                          setConfirmPassword(e.target.value);
                          setForgotError('');
                        }}
                        className="w-full pl-9 pr-10 py-2.5 border-2 border-gray-200 rounded-xl text-sm focus:outline-none focus:border-blue-400 transition-colors"
                        placeholder="Re-enter password"
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPass(!showConfirmPass)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                      >
                        {showConfirmPass ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>

                  {forgotError && (
                    <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 flex items-center gap-2">
                      <AlertCircle size={16} className="text-red-600 flex-shrink-0" />
                      <p className="text-sm text-red-600">{forgotError}</p>
                    </div>
                  )}

                  {forgotSuccess && (
                    <div className="bg-green-50 border border-green-200 rounded-lg px-3 py-2 flex items-center gap-2">
                      <CheckCircle size={16} className="text-green-600 flex-shrink-0" />
                      <p className="text-sm text-green-600">{forgotSuccess}</p>
                    </div>
                  )}

                  <div className="flex gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => {
                        setForgotPasswordStep('verify');
                        setNewPassword('');
                        setConfirmPassword('');
                        setForgotError('');
                      }}
                      className="flex-1 py-2.5 border-2 border-gray-200 rounded-lg text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors"
                      disabled={resettingPassword}
                    >
                      Back
                    </button>
                    <button
                      type="submit"
                      disabled={resettingPassword || !newPassword || !confirmPassword}
                      className="flex-1 bg-blue-700 hover:bg-blue-800 disabled:bg-gray-400 text-white py-2.5 rounded-lg text-sm font-semibold transition-colors"
                    >
                      {resettingPassword ? 'Resetting...' : 'Reset Password'}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
