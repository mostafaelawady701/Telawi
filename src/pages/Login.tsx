import React, { useState, useEffect } from 'react';
import { loginWithUsername, loginAnonymously } from '../firebase';
import { LogIn, Users, User, Sparkles, Loader2, BookOpen } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useToast } from '../components/Toast';

// Decorative floating shape
function FloatingShape({ className, style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <div
      className={`absolute rounded-full pointer-events-none ${className}`}
      style={style}
    />
  );
}

export default function Login() {
  const [username, setUsername] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [shake, setShake] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const { addToast } = useToast();

  const [particles, setParticles] = useState<Array<{
    id: number; x: number; y: number; size: number;
    duration: number; delay: number; type: 'emerald' | 'gold';
  }>>([]);

  useEffect(() => {
    const newParticles = Array.from({ length: 24 }).map((_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: Math.random() * 3 + 1.5,
      duration: Math.random() * 12 + 10,
      delay: Math.random() * 8,
      type: Math.random() > 0.7 ? 'gold' : 'emerald' as 'emerald' | 'gold',
    }));
    setParticles(newParticles);
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim()) {
      setShake(true);
      setTimeout(() => setShake(false), 400);
      addToast('يرجى إدخال اسمك الكريم', 'error');
      return;
    }
    if (!isLoading) {
      setIsLoading(true);
      try {
        await loginWithUsername(username);
        addToast(`مرحباً بك، ${username}!`, 'success');
        setIsSuccess(true);
      } catch (error) {
        addToast('فشل تسجيل الدخول. يرجى المحاولة مرة أخرى.', 'error');
        setIsLoading(false);
      }
    }
  };

  const handleGuestLogin = async () => {
    if (isLoading) return;
    setIsLoading(true);
    try {
      await loginAnonymously();
      addToast('تم الدخول كزائر بنجاح', 'success');
      setIsSuccess(true);
    } catch (error) {
      addToast('فشل دخول الزائر.', 'error');
      setIsLoading(false);
    }
  };

  if (isSuccess) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#020617]">
        <motion.div
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 200, damping: 20 }}
          className="flex flex-col items-center gap-8 text-center"
        >
          <div className="relative">
            <div className="w-28 h-28 bg-gradient-to-br from-emerald-400 to-emerald-700 rounded-3xl flex items-center justify-center shadow-[0_0_80px_rgba(16,185,129,0.6)] rotate-12">
              <Sparkles className="w-12 h-12 text-white" />
            </div>
            <div className="absolute -inset-4 bg-emerald-500/10 rounded-full blur-2xl animate-pulse" />
          </div>
          <div>
            <h2 className="text-4xl font-black font-ruqaa text-gradient-emerald mb-2">أهلاً وسهلاً</h2>
            <p className="text-slate-400">جارٍ الدخول إلى مجالس النور...</p>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen relative flex items-center justify-center p-4 overflow-hidden bg-[#020617]">
      {/* Rich Background */}
      <div className="absolute inset-0 pointer-events-none">
        {/* Primary emerald glow */}
        <div className="absolute top-[-15%] left-[20%] w-[60vw] h-[60vw] max-w-[700px] max-h-[700px]"
          style={{ background: 'radial-gradient(ellipse, rgba(16,185,129,0.15) 0%, transparent 70%)', filter: 'blur(1px)' }}
        />
        {/* Gold accent glow */}
        <div className="absolute bottom-[-10%] right-[-5%] w-[50vw] h-[50vw] max-w-[600px] max-h-[600px]"
          style={{ background: 'radial-gradient(ellipse, rgba(217,119,6,0.1) 0%, transparent 70%)', filter: 'blur(1px)' }}
          className="animate-float-slow"
        />
        {/* Islamic geometric pattern overlay */}
        <div className="absolute inset-0 islamic-pattern opacity-100" />
        {/* Star field */}
        <div className="absolute inset-0 star-field opacity-70" />
      </div>

      {/* Floating Particles */}
      <div className="particles-container">
        {particles.map(p => (
          <motion.div
            key={p.id}
            className={`particle ${p.type === 'gold' ? 'particle-gold' : 'particle-emerald'}`}
            initial={{ y: `${p.y}vh`, x: `${p.x}vw`, opacity: 0 }}
            animate={{
              y: '-15vh',
              opacity: [0, 0.6, 0.6, 0],
            }}
            transition={{
              duration: p.duration,
              repeat: Infinity,
              delay: p.delay,
              ease: 'linear',
              times: [0, 0.1, 0.9, 1],
            }}
            style={{ width: p.size, height: p.size }}
          />
        ))}
      </div>

      {/* Main Card */}
      <motion.div
        initial={{ opacity: 0, y: 40, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        className={`relative z-10 w-full max-w-md ${shake ? 'animate-shake' : ''}`}
      >
        {/* Card glow aura */}
        <div className="absolute -inset-4 bg-gradient-to-b from-emerald-500/10 to-transparent rounded-[3.5rem] blur-2xl pointer-events-none" />

        <div className="glass-premium rounded-[2.5rem] overflow-hidden">
          {/* Top accent bar */}
          <div className="h-1 bg-gradient-to-r from-transparent via-emerald-400/60 to-transparent" />

          <div className="p-10">
            {/* Logo Area */}
            <div className="flex flex-col items-center mb-10">
              {/* Floating Icon */}
              <motion.div
                animate={{ y: [0, -8, 0] }}
                transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
                className="relative mb-8"
              >
                <div className="w-20 h-20 bg-gradient-to-br from-emerald-400 via-emerald-500 to-teal-600 rounded-3xl flex items-center justify-center shadow-[0_0_40px_rgba(16,185,129,0.4),0_20px_40px_rgba(0,0,0,0.4)] rotate-6 hover:rotate-0 transition-transform duration-500">
                  <BookOpen className="w-9 h-9 text-white drop-shadow" />
                </div>
                {/* Orbital ring decoration */}
                <div className="absolute -inset-3 rounded-full border border-emerald-500/20 animate-breathe" />
                <div className="absolute -inset-6 rounded-full border border-emerald-500/10 animate-breathe" style={{ animationDelay: '1s' }} />
              </motion.div>

              {/* Title */}
              <h1 className="text-5xl font-black font-ruqaa text-gradient-gold text-center leading-tight mb-3">
                مجالس النور
              </h1>
              <p className="text-slate-400 text-center flex items-center gap-2.5 text-sm font-medium">
                <Sparkles className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>ارتقِ بتلاوتك في بيئة نقية وإيمانية</span>
                <Sparkles className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
              </p>
            </div>

            {/* Form */}
            <form onSubmit={handleLogin} className="space-y-5">
              {/* Name Input */}
              <div className="space-y-2.5">
                <label className="block text-xs font-bold text-slate-400 uppercase tracking-widest px-1">
                  اسم القارئ
                </label>
                <div className="relative group">
                  {/* Focus glow */}
                  <div className="absolute -inset-0.5 bg-gradient-to-r from-emerald-500/30 to-teal-500/20 rounded-2xl blur-md opacity-0 group-focus-within:opacity-100 transition-all duration-500" />
                  <div className="relative">
                    <User className="absolute right-4 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-emerald-400/60 z-10 group-focus-within:text-emerald-400 transition-colors w-[18px] h-[18px]" />
                    <input
                      type="text"
                      placeholder="أدخل اسمك الكريم..."
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      disabled={isLoading}
                      className="w-full pr-12 pl-5 py-4 bg-white/5 border border-white/10 rounded-2xl text-white placeholder-slate-600 focus:border-emerald-500/50 focus:ring-2 focus:ring-emerald-500/15 focus:bg-white/8 outline-none transition-all duration-300 relative z-10 disabled:opacity-50 text-base"
                    />
                  </div>
                </div>
              </div>

              {/* Login Button */}
              <motion.button
                type="submit"
                disabled={isLoading}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="relative w-full overflow-hidden rounded-2xl py-4 font-black text-white text-lg disabled:opacity-60 shadow-[0_10px_30px_rgba(16,185,129,0.3)] hover:shadow-[0_16px_48px_rgba(16,185,129,0.5)] transition-shadow duration-300"
                style={{ background: 'linear-gradient(135deg, #059669 0%, #10b981 50%, #34d399 100%)' }}
              >
                {/* Shimmer overlay */}
                <div className="absolute inset-0 animate-shimmer opacity-60" />
                {/* Inner shadow top */}
                <div className="absolute inset-x-0 top-0 h-px bg-white/30" />
                <span className="relative flex items-center justify-center gap-3">
                  {isLoading ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <LogIn className="w-5 h-5" />
                  )}
                  دخول المجلس
                </span>
              </motion.button>

              {/* Divider */}
              <div className="divider py-2">
                <span className="text-xs font-bold text-slate-600 tracking-widest uppercase">أو</span>
              </div>

              {/* Guest Button */}
              <motion.button
                type="button"
                onClick={handleGuestLogin}
                disabled={isLoading}
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.99 }}
                className="w-full flex items-center justify-center gap-3 py-4 px-6 rounded-2xl font-semibold text-slate-300 border border-white/10 bg-white/4 hover:bg-white/8 hover:border-white/20 hover:text-white transition-all duration-300 disabled:opacity-50"
              >
                {isLoading ? (
                  <Loader2 className="w-4.5 h-4.5 animate-spin w-[18px] h-[18px]" />
                ) : (
                  <Users className="w-[18px] h-[18px] text-slate-500" />
                )}
                <span>الدخول كزائر</span>
              </motion.button>
            </form>

            {/* Footer */}
            <p className="text-[11px] text-slate-600 text-center mt-8 flex flex-col items-center gap-1.5">
              <span>يتم حفظ بيانات الجلسة بأمان تام في السحابة</span>
              <span className="flex items-center gap-2">
                <span className="w-4 h-px bg-slate-700" />
                <span className="text-emerald-700 font-bold tracking-widest text-[9px] uppercase">تلاوة · Telawa</span>
                <span className="w-4 h-px bg-slate-700" />
              </span>
            </p>
          </div>

          {/* Bottom accent bar */}
          <div className="h-px bg-gradient-to-r from-transparent via-white/5 to-transparent" />
        </div>
      </motion.div>
    </div>
  );
}
