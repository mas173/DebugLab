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
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-gradient-to-br from-slate-950 via-slate-900 to-zinc-950 px-4 text-slate-200">
      {/* Premium Ambient Light Leaks */}
      <div className="absolute top-1/4 left-1/4 h-[500px] w-[500px] rounded-full bg-cyan-500/10 blur-[130px] mix-blend-screen pointer-events-none animate-pulse duration-[8000ms]"></div>
      <div className="absolute bottom-1/4 right-1/4 h-[500px] w-[500px] rounded-full bg-indigo-500/10 blur-[130px] mix-blend-screen pointer-events-none animate-pulse duration-[12000ms]"></div>

      {/* Subtle Grid Accent */}
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#0f172a_1px,transparent_1px),linear-gradient(to_bottom,#0f172a_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)] opacity-30 pointer-events-none"></div>

      {/* Main Glassmorphic Card */}
      <div className="relative w-full max-w-md rounded-2xl border border-white/[0.08] bg-slate-900/40 p-8 backdrop-blur-2xl shadow-[0_25px_60px_-15px_rgba(0,0,0,0.7)]">
        <div className="flex flex-col items-center mb-8">
          {/* Logo container with double border glow */}
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-cyan-500/10 to-blue-500/10 border border-cyan-500/20 shadow-[0_0_30px_rgba(6,182,212,0.15)] relative group overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-r from-cyan-500/20 to-blue-500/20 opacity-0 group-hover:opacity-100 transition-opacity duration-500"></div>
            <Code2 size={30} className="text-cyan-400 drop-shadow-[0_0_8px_rgba(34,211,238,0.5)] animate-pulse" />
          </div>
          <h1 className="text-4xl font-black tracking-tight bg-gradient-to-r from-white via-slate-100 to-cyan-400 bg-clip-text text-transparent">
            DebugLab
          </h1>
          <p className="mt-1.5 text-xs font-semibold uppercase tracking-wider text-slate-400">Participant Workspace</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {error && (
            <div className="flex items-center gap-3 rounded-xl border border-red-500/20 bg-red-500/5 p-4 text-xs text-red-400">
              <AlertTriangle size={16} className="shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Participant ID
            </label>
            <div className="relative">
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="e.g. USER-101"
                className="w-full rounded-xl border border-white/[0.08] bg-white/[0.03] py-3.5 pl-11 pr-4 text-sm text-slate-100 placeholder-slate-600 transition-all duration-300 focus:border-cyan-500/80 focus:bg-white/[0.06] focus:ring-1 focus:ring-cyan-500/50 focus:outline-none"
              />
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500">
                <Code2 size={16} />
              </span>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
              Password
            </label>
            <div className="relative">
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full rounded-xl border border-white/[0.08] bg-white/[0.03] py-3.5 pl-11 pr-4 text-sm text-slate-100 placeholder-slate-600 transition-all duration-300 focus:border-cyan-500/80 focus:bg-white/[0.06] focus:ring-1 focus:ring-cyan-500/50 focus:outline-none"
              />
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500">
                <KeyRound size={16} />
              </span>
            </div>
          </div>

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full cursor-pointer overflow-hidden rounded-xl bg-gradient-to-r from-cyan-500 to-blue-500 py-3.5 text-sm font-bold text-white shadow-[0_4px_20px_rgba(6,182,212,0.15)] hover:shadow-[0_4px_25px_rgba(6,182,212,0.3)] transition-all duration-300 hover:scale-[1.01] active:scale-[0.99] disabled:opacity-60 disabled:pointer-events-none" 
          >
            {isSubmitting ? (
              <span className="flex items-center justify-center gap-2">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/20 border-t-white"></span>
                Connecting to Contest...
              </span>
            ) : (
              'Enter Workspace'
            )}
          </button>
        </form>

        <div className="mt-8 text-center text-[10px] uppercase tracking-wider text-slate-600 border-t border-white/[0.05] pt-6 font-mono">
          Authorized participants only • Local LAN session
        </div>
      </div>
    </div>
  );
}
