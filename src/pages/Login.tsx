import React, { useState } from 'react';
import { loginWithUsername, loginAnonymously } from '../firebase';
import { BookOpen, LogIn, Users, User, Sparkles } from 'lucide-react';
import { motion } from 'motion/react';

export default function Login() {
  const [username, setUsername] = useState('');

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (username.trim()) {
      loginWithUsername(username);
    }
  };

  return (
    <div className="min-h-screen top-background relative flex items-center justify-center p-4 overflow-hidden">
      {/* Dynamic Background Elements */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-emerald-600/20 rounded-full blur-[120px] mix-blend-screen animate-float"></div>
      <div className="absolute bottom-1/4 right-1/4 w-[30rem] h-[30rem] bg-amber-600/10 rounded-full blur-[150px] mix-blend-screen animate-float" style={{ animationDelay: '2s' }}></div>
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full bg-[url('https://www.transparenttextures.com/patterns/stardust.png')] opacity-10 pointer-events-none"></div>

      <motion.div 
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        className="max-w-md w-full glass-dark rounded-[2.5rem] p-10 border border-white/10 shadow-[0_0_50px_rgba(0,0,0,0.5)] relative z-10"
      >
        <div className="absolute -top-12 left-1/2 -translate-x-1/2 w-24 h-24 bg-gradient-to-br from-emerald-400 to-emerald-700 rounded-3xl p-1 shadow-[0_0_30px_rgba(16,185,129,0.3)] rotate-12 hover:rotate-0 transition-all duration-500">
          <div className="w-full h-full bg-[#0f172a] rounded-[1.4rem] flex items-center justify-center">
            <BookOpen className="w-10 h-10 text-emerald-400 drop-shadow-[0_0_15px_rgba(52,211,153,0.5)]" />
          </div>
        </div>

        <div className="mt-10 mb-10 flex flex-col items-center">
          <h1 className="text-4xl font-black text-gradient-gold mb-3 font-ruqaa text-center leading-tight">مجالس النور</h1>
          <p className="text-slate-400 text-center font-medium opacity-80 flex items-center justify-center gap-2">
            <Sparkles className="w-4 h-4 text-emerald-400" />
            ارتقِ بتلاوتك في بيئة نقية
            <Sparkles className="w-4 h-4 text-emerald-400" />
          </p>
        </div>

        <form onSubmit={handleLogin} className="space-y-6">
          <div className="space-y-3">
            <label className="text-sm font-semibold text-slate-300 mr-2 opacity-80">اسم القارئ</label>
            <div className="relative group">
              <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/20 to-teal-500/20 rounded-2xl blur-md opacity-0 group-focus-within:opacity-100 transition-opacity duration-500"></div>
              <User className="absolute right-5 top-1/2 -translate-y-1/2 w-5 h-5 text-emerald-400/70 z-10" />
              <input
                type="text"
                placeholder="أدخل اسمك الكريم..."
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full pr-14 pl-5 py-4 bg-white/5 border border-white/10 rounded-2xl text-white placeholder-slate-500 focus:border-emerald-500/50 focus:bg-white/10 outline-none transition-all duration-300 relative z-10 shadow-inner"
                required
              />
            </div>
          </div>

          <button
            type="submit"
            className="group relative w-full overflow-hidden rounded-2xl shadow-[0_0_20px_rgba(16,185,129,0.2)] hover:shadow-[0_0_30px_rgba(16,185,129,0.4)] transition-all duration-300"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-emerald-500 to-teal-600 transition-transform duration-500 group-hover:scale-[1.05]"></div>
            <div className="relative w-full flex items-center justify-center gap-3 py-4 px-6 font-bold text-white text-lg">
              <LogIn className="w-6 h-6 animate-pulse-glow" />
              دخول المجلس
            </div>
          </button>

          <div className="relative py-4 flex items-center justify-center">
            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-white/10"></div></div>
            <div className="relative flex justify-center text-xs font-bold uppercase tracking-widest px-4 glass-dark rounded-full text-slate-500 shadow-md">
              أو
            </div>
          </div>

          <button
            type="button"
            onClick={() => loginAnonymously()}
            className="w-full flex items-center justify-center gap-3 bg-white/5 text-slate-300 border border-white/10 py-4 px-6 rounded-2xl font-semibold hover:bg-white/10 hover:text-white transition-all duration-300 hover:border-emerald-500/30"
          >
            <Users className="w-5 h-5 text-slate-400 group-hover:text-emerald-400 transition-colors" />
            الدخول كزائر
          </button>
        </form>

        <p className="text-xs text-slate-500 text-center mt-10 opacity-70 flex flex-col items-center gap-1">
          <span>يتم حفظ بيانات الجلسة بأمان تام.</span>
          <span className="font-sans text-[10px] tracking-widest text-slate-600">v2.0 PRO</span>
        </p>
      </motion.div>
    </div>
  );
}
