import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { Code2, KeyRound, AlertTriangle } from 'lucide-react';
import toast from 'react-hot-toast';

export default function Login() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      setError('Please fill in all fields');
      return;
    }

    setIsSubmitting(true);
    setError('');

    const res = await login(username.trim(), password.trim());
    if (res.success) {
      toast.success('Welcome back!');
      navigate('/');
    } else {
      setError(res.error || 'Authentication failed');
      toast.error(res.error || 'Authentication failed');
      setIsSubmitting(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-black px-4 text-slate-100">
      {/* Background Decorative Glows */}
      <div className="absolute -top-40 -left-40 h-[600px] w-[600px] rounded-full bg-cyan-600/10 blur-[120px] pointer-events-none"></div>
      <div className="absolute -bottom-40 -right-40 h-[600px] w-[600px] rounded-full bg-blue-600/10 blur-[120px] pointer-events-none"></div>

      {/* Main Glassmorphic Login Container */}
      <div className="w-full max-w-md rounded-2xl border border-slate-900 bg-slate-950/80 p-8 backdrop-blur-xl shadow-2xl">
        <div className="flex flex-col items-center mb-8">
          <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-400 shadow-[0_0_15px_rgba(6,182,212,0.15)]">
            <Code2 size={28} className="animate-pulse" />
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-cyan-400 to-blue-300 bg-clip-text text-transparent">
            DebugLab
          </h1>
          <p className="mt-1 text-sm text-slate-400">Participant Portal</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="flex items-center gap-3 rounded-lg border border-red-500/20 bg-red-500/10 p-3.5 text-sm text-red-400">
              <AlertTriangle size={18} className="shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Participant ID
            </label>
            <div className="relative">
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="e.g. USER-101"
                className="w-full rounded-lg border border-slate-900 bg-black/60 py-3 pl-11 pr-4 text-sm text-slate-100 placeholder-slate-600 transition-all duration-300 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 focus:outline-none"
              />
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-600">
                <Code2 size={18} />
              </span>
            </div>
          </div>

          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Password
            </label>
            <div className="relative">
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full rounded-lg border border-slate-900 bg-black/60 py-3 pl-11 pr-4 text-sm text-slate-100 placeholder-slate-600 transition-all duration-300 focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 focus:outline-none"
              />
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-600">
                <KeyRound size={18} />
              </span>
            </div>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="relative w-full overflow-hidden rounded-lg bg-gradient-to-r from-cyan-600 to-blue-600 py-3 text-sm font-semibold text-white transition-all duration-300 hover:from-cyan-500 hover:to-blue-500 active:scale-[0.98] disabled:opacity-60 disabled:pointer-events-none"
          >
            {isSubmitting ? (
              <span className="flex items-center justify-center gap-2">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/20 border-t-white"></span>
                Logging in...
              </span>
            ) : (
              'Sign In to Contest'
            )}
          </button>
        </form>

        <div className="mt-8 text-center text-xs text-slate-600 border-t border-slate-900 pt-6">
          Authorized participants only. Running entirely on local LAN.
        </div>
      </div>
    </div>
  );
}
