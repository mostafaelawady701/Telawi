import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { db, logout, collection, addDoc, onSnapshot, query, orderBy, limit, updateDoc, doc, arrayUnion, getDocs, deleteDoc, getUserStats, getGlobalLeaderboard, updateUserProfile, supabase } from '../firebase';
import { Plus, LogOut, Users, Mic, Shuffle, Sparkles, Radio, Trophy, Search, BookOpen, Settings, X, Loader2, Copy, Check, MessageSquare, Heart, Star, Crown, TrendingUp, Award, User as UserIcon, Camera } from 'lucide-react';
import { Room } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { useToast } from '../components/Toast';

const THEME_COLORS: Record<string, { ring: string; bg: string; text: string; glow: string }> = {
  emerald: { ring: 'ring-emerald-500', bg: 'bg-emerald-500', text: 'text-emerald-400', glow: 'rgba(16,185,129,0.3)' },
  blue:    { ring: 'ring-blue-500',    bg: 'bg-blue-500',    text: 'text-blue-400',    glow: 'rgba(59,130,246,0.3)' },
  purple:  { ring: 'ring-purple-500',  bg: 'bg-purple-500',  text: 'text-purple-400',  glow: 'rgba(168,85,247,0.3)' },
  rose:    { ring: 'ring-rose-500',    bg: 'bg-rose-500',    text: 'text-rose-400',    glow: 'rgba(244,63,94,0.3)' },
  amber:   { ring: 'ring-amber-500',   bg: 'bg-amber-500',   text: 'text-amber-400',   glow: 'rgba(245,158,11,0.3)' },
};

export default function Dashboard({ user }: { user: any }) {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const [newRoomName, setNewRoomName] = useState('');
  const [newMaxParticipants, setNewMaxParticipants] = useState(10);
  const [newRecordingDuration, setNewRecordingDuration] = useState(60);
  const [newThemeColor, setNewThemeColor] = useState('emerald');

  const [searchQuery, setSearchQuery] = useState('');
  const [stats, setStats] = useState({ totalScore: 0, count: 0, average: 0 });
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [editName, setEditName] = useState(user.displayName || '');
  const [isUpdatingProfile, setIsUpdatingProfile] = useState(false);
  const [filterType, setFilterType] = useState('الكل');
  const navigate = useNavigate();
  const { addToast } = useToast();

  const themePresets = [
    { id: 'emerald', name: 'زمردي',   color: 'bg-emerald-500' },
    { id: 'blue',    name: 'ياقوتي',  color: 'bg-blue-500'    },
    { id: 'purple',  name: 'بنفسجي', color: 'bg-purple-500'   },
    { id: 'rose',    name: 'وردي',    color: 'bg-rose-500'     },
    { id: 'amber',   name: 'ذهبي',    color: 'bg-amber-500'    },
  ];

  useEffect(() => {
    const q = collection(db, 'rooms');
    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (snapshot.docs) {
        setRooms(snapshot.docs.map((d: any) => ({ id: d.id, ...d.data() })));
      }
    });
    const fetchStats = async () => {
      if (user?.uid) {
        const s = await getUserStats(user.uid);
        setStats(s);
      }
      const lb = await getGlobalLeaderboard(5);
      setLeaderboard(lb);
    };
    fetchStats();
    return unsubscribe;
  }, []);

  const handleCreateRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRoomName.trim()) return;
    setIsCreating(true);
    try {
      const roomRef = await addDoc(collection(db, 'rooms'), {
        name: newRoomName,
        hostId: user.uid,
        status: 'waiting',
        participants: [user.uid],
        maxParticipants: newMaxParticipants,
        recordingDuration: newRecordingDuration,
        createdAt: Date.now(),
        theme: { color: newThemeColor },
      });
      navigate(`/room/${roomRef.id}`);
    } catch {
      addToast('فشل إنشاء الغرفة.', 'error');
    } finally {
      setIsCreating(false);
    }
  };

  const handleJoinRoom = async (roomId: string) => {
    try {
      await updateDoc(doc(db, 'rooms', roomId), { participants: arrayUnion(user.uid) });
      navigate(`/room/${roomId}`);
    } catch {}
  };

  const filteredRooms = rooms.filter(room => {
    const matchesSearch = room.name.toLowerCase().includes(searchQuery.toLowerCase());
    let matchesFilter = true;
    if (filterType === 'نشط')      matchesFilter = room.status === 'playing';
    else if (filterType === 'بانتظار') matchesFilter = room.status === 'waiting';
    else if (filterType === 'خاص')  matchesFilter = room.hostId === user.uid;
    return matchesSearch && matchesFilter;
  });

  const handleCopyLink = (e: React.MouseEvent, roomId: string) => {
    e.stopPropagation();
    navigator.clipboard.writeText(`${window.location.origin}/room/${roomId}`);
    setCopiedId(roomId);
    addToast('تم نسخ رابط المجلس!', 'success');
    setTimeout(() => setCopiedId(null), 2000);
  };

  const rankLabel = stats.totalScore > 5000 ? 'حافظ' : stats.totalScore > 1000 ? 'مرتل' : 'مبتدئ';

  return (
    <div className="min-h-screen page-bg text-slate-100 selection:bg-emerald-500/30 overflow-x-hidden pb-24">
      {/* Fixed background orbs */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute top-[-25%] right-[-15%] w-[70%] h-[70%] bg-emerald-600/8 blur-[180px] rounded-full animate-float-slow" />
        <div className="absolute bottom-[-20%] left-[-10%] w-[55%] h-[55%] bg-amber-600/5 blur-[150px] rounded-full animate-float-slow" style={{ animationDelay: '4s' }} />
        <div className="absolute inset-0 islamic-pattern opacity-100" />
      </div>

      {/* ── Header ── */}
      <header className="sticky top-0 z-50 glass-dark border-b border-white/6 py-3">
        <div className="max-w-7xl mx-auto px-6 flex items-center justify-between gap-4">
          <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="flex items-center gap-3.5">
            <div className="relative">
              <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-emerald-400 to-teal-600 flex items-center justify-center shadow-[0_0_20px_rgba(16,185,129,0.3)]">
                <Mic className="text-white w-5 h-5 animate-pulse-glow" />
              </div>
              <div className="absolute -inset-0.5 rounded-2xl bg-gradient-to-br from-emerald-400/30 to-teal-600/30 blur-sm -z-10" />
            </div>
            <div>
              <h1 className="text-xl font-black font-ruqaa text-gradient-emerald tracking-wide leading-none">تلاوة</h1>
              <p className="text-[9px] text-slate-600 font-black uppercase tracking-[0.35em] mt-0.5">Noble Sessions</p>
            </div>
          </motion.div>

          <div className="flex items-center gap-3">
            {/* User profile chip */}
            <motion.button
              initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}
              onClick={() => setIsProfileModalOpen(true)}
              className="flex items-center gap-3 px-3 py-2 rounded-2xl glass border border-white/8 hover:border-emerald-500/30 transition-all duration-300 group"
            >
              <div className="text-right hidden sm:block">
                <p className="text-xs font-bold text-white flex items-center gap-2">
                  {user.displayName || 'قارئ'}
                  <span className="px-2 py-0.5 bg-amber-400/10 text-amber-300 text-[8px] rounded-full border border-amber-400/20 uppercase tracking-tight">
                    {rankLabel}
                  </span>
                </p>
                <p className="text-[10px] text-emerald-400/80 flex items-center justify-end gap-1 mt-0.5">
                  <TrendingUp className="w-2.5 h-2.5" />
                  {stats.totalScore.toLocaleString()} نقطة
                </p>
              </div>
              <img
                src={user.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.uid}`}
                alt="Profile"
                className="w-9 h-9 rounded-xl border-2 border-emerald-500/20 group-hover:border-emerald-500/50 transition-all object-cover"
              />
            </motion.button>

            <button
              onClick={logout}
              className="p-2.5 text-slate-500 hover:text-rose-400 glass rounded-xl transition-all border border-white/6 hover:border-rose-500/25 hover:bg-rose-500/8"
              title="تسجيل الخروج"
            >
              <LogOut className="w-4.5 h-4.5 w-[18px] h-[18px]" />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 mt-14 relative z-10">
        {/* ── Hero Section ── */}
        <section className="mb-20">
          <div className="grid lg:grid-cols-5 gap-10 items-center">
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.7 }}
              className="lg:col-span-3"
            >
              {/* Badge */}
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass border border-emerald-500/20 text-emerald-400 text-xs font-bold mb-6">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                {rooms.filter(r => r.status === 'playing').length} مجلس نشط الآن
              </div>

              <h2 className="text-5xl xl:text-6xl font-black text-white leading-[1.15] mb-6 font-ruqaa">
                اجتمعوا على{' '}
                <span className="text-gradient-emerald">كلام الله</span>
                <br />
                <span className="text-4xl xl:text-5xl text-slate-300 font-black">في مجالس النور</span>
              </h2>

              <p className="text-slate-400 text-lg mb-8 max-w-lg leading-relaxed">
                منصة رقمية فاخرة لتنظيم جولات التلاوة، التقييم، والارتقاء بالأداء الصوتي في بيئة تنافسية إيمانية.
              </p>

              <div className="flex flex-wrap gap-4">
                <motion.button
                  whileHover={{ scale: 1.03, y: -2 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => setIsCreateModalOpen(true)}
                  className="relative overflow-hidden px-8 py-4 rounded-2xl text-white font-black text-base flex items-center gap-3 shadow-[0_16px_48px_rgba(16,185,129,0.3)] hover:shadow-[0_24px_64px_rgba(16,185,129,0.45)] transition-shadow duration-300"
                  style={{ background: 'linear-gradient(135deg, #059669, #10b981, #34d399)' }}
                >
                  <div className="absolute inset-0 animate-shimmer opacity-50" />
                  <div className="absolute inset-x-0 top-0 h-px bg-white/30" />
                  <Plus className="w-5 h-5 relative" />
                  <span className="relative">إنشاء مجلس جديد</span>
                </motion.button>

                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => {
                    const available = rooms.filter(r => (r.participants?.length || 0) < (r.maxParticipants || 10));
                    if (available.length > 0) handleJoinRoom(available[Math.floor(Math.random() * available.length)].id);
                    else addToast('لا توجد مجالس متاحة حالياً', 'error');
                  }}
                  className="px-8 py-4 glass rounded-2xl font-black text-slate-300 hover:text-white flex items-center gap-3 border border-white/10 hover:border-emerald-500/30 transition-all duration-300"
                >
                  <Shuffle className="w-5 h-5 text-emerald-400" />
                  دخول عشوائي
                </motion.button>
              </div>
            </motion.div>

            {/* Leaderboard Card */}
            <motion.div
              initial={{ opacity: 0, x: 40 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.7, delay: 0.1 }}
              className="lg:col-span-2 hidden lg:block"
            >
              <div className="glass-emerald rounded-[2.5rem] p-7 card-glow-emerald relative overflow-hidden">
                {/* Header glow line */}
                <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-emerald-400/40 to-transparent" />

                <h3 className="text-xl font-black text-white mb-6 flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-amber-500/15 border border-amber-500/20 flex items-center justify-center">
                    <Trophy className="w-5 h-5 text-amber-400 animate-pulse-gold" />
                  </div>
                  مجلس المتصدرين
                </h3>

                <div className="space-y-3">
                  {leaderboard.length > 0 ? leaderboard.map((u, i) => (
                    <motion.div
                      key={u.id}
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.07 }}
                      className="flex items-center gap-3 p-3 glass rounded-2xl border border-white/5 hover:border-white/10 transition-colors"
                    >
                      <span className={`text-sm font-black w-6 text-center ${i === 0 ? 'text-amber-400' : i === 1 ? 'text-slate-400' : i === 2 ? 'text-amber-600/80' : 'text-slate-600'}`}>
                        {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i+1}`}
                      </span>
                      <img src={u.photoURL} alt="" className="w-8 h-8 rounded-xl border border-white/10 object-cover" />
                      <span className="font-bold text-white text-sm flex-1 truncate">{u.displayName}</span>
                      {i === 0 && <Crown className="w-4 h-4 text-amber-400 shrink-0" />}
                    </motion.div>
                  )) : (
                    <div className="text-center py-6 text-slate-500/80 text-sm">
                      <Trophy className="w-10 h-10 text-slate-700 mx-auto mb-3" />
                      لا يوجد متصدرين حالياً
                    </div>
                  )}
                </div>

                <div className="mt-6 pt-6 border-t border-white/6 grid grid-cols-3 gap-4">
                  {[
                    { label: 'جولاتك', value: stats.count.toString(), color: 'text-emerald-400' },
                    { label: 'نقاطك', value: stats.totalScore.toLocaleString(), color: 'text-amber-400' },
                    { label: 'رتبتك', value: rankLabel, color: 'text-slate-300' },
                  ].map(({ label, value, color }) => (
                    <div key={label} className="text-center">
                      <p className="text-[9px] text-slate-600 uppercase font-black tracking-widest mb-1">{label}</p>
                      <p className={`text-xl font-black ${color}`}>{value}</p>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          </div>
        </section>

        {/* ── Search & Filters ── */}
        <section className="mb-10 flex flex-col sm:flex-row items-center justify-between gap-5">
          <div className="relative w-full sm:max-w-sm group">
            <Search className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-600 w-4.5 h-4.5 group-focus-within:text-emerald-400 transition-colors w-[18px] h-[18px]" />
            <input
              type="text"
              placeholder="ابحث عن مجلس..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pr-12 pl-5 py-3.5 glass-dark border border-white/8 rounded-2xl text-white placeholder-slate-700 outline-none focus:border-emerald-500/40 focus:ring-2 focus:ring-emerald-500/10 transition-all"
            />
          </div>

          <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar w-full sm:w-auto">
            <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest whitespace-nowrap shrink-0">فرز:</span>
            {['الكل', 'نشط', 'بانتظار', 'خاص'].map(tag => (
              <button
                key={tag}
                onClick={() => setFilterType(tag)}
                className={`px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap border transition-all duration-200 ${
                  filterType === tag
                    ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30 shadow-[0_0_12px_rgba(16,185,129,0.2)]'
                    : 'glass border-white/6 text-slate-500 hover:text-slate-300 hover:bg-white/6'
                }`}
              >
                {tag}
              </button>
            ))}
          </div>
        </section>

        {/* ── Rooms Grid ── */}
        <section className="pb-8">
          {filteredRooms.length === 0 ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.97 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex flex-col items-center justify-center py-28 glass-dark rounded-[3rem] border border-dashed border-white/8"
            >
              <div className="w-20 h-20 bg-emerald-500/8 rounded-full flex items-center justify-center mb-5 border border-emerald-500/10">
                <Users className="w-9 h-9 text-emerald-500/30" />
              </div>
              <p className="text-slate-500 font-bold text-xl mb-2">لا توجد مجالس مفتوحة حالياً</p>
              <p className="text-slate-700 text-sm">كن أنت المستفتح وأطلق أول مجلس!</p>
            </motion.div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <AnimatePresence mode="popLayout">
                {filteredRooms.map((room, idx) => {
                  const tc = THEME_COLORS[room.theme?.color || 'emerald'];
                  const occupancy = ((room.participants?.length || 0) / (room.maxParticipants || 10)) * 100;
                  return (
                    <motion.div
                      key={room.id}
                      layout
                      initial={{ opacity: 0, y: 24 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.94 }}
                      transition={{ delay: idx * 0.04 }}
                      onClick={() => handleJoinRoom(room.id)}
                      className="group relative cursor-pointer"
                    >
                      {/* Card glow */}
                      <div
                        className="absolute -inset-px rounded-[2rem] opacity-0 group-hover:opacity-100 transition-opacity duration-500 -z-10"
                        style={{ background: `radial-gradient(ellipse at 50% 0%, ${tc.glow} 0%, transparent 70%)` }}
                      />
                      <div className="glass-dark border border-white/6 rounded-[2rem] p-6 hover:border-white/15 transition-all duration-400 group-hover:shadow-[0_24px_60px_rgba(0,0,0,0.5)] group-hover:-translate-y-2 h-full flex flex-col">
                        {/* Top row */}
                        <div className="flex justify-between items-start mb-5">
                          <div className="w-12 h-12 rounded-2xl bg-white/5 flex items-center justify-center border border-white/8 group-hover:bg-emerald-500/10 group-hover:border-emerald-500/20 transition-all duration-300 overflow-hidden">
                            {room.theme?.backgroundImage ? (
                              <img src={room.theme.backgroundImage} className="w-full h-full object-cover opacity-60" alt="" />
                            ) : (
                              <Sparkles className={`w-6 h-6 ${tc.text} opacity-60`} />
                            )}
                          </div>

                          <div className="flex flex-col items-end gap-2">
                            <span className={room.status === 'playing' ? 'status-live' : 'status-waiting'}>
                              {room.status === 'playing' ? '● تلاوة مباشرة' : '◌ بانتظار البدء'}
                            </span>
                            <div className="flex items-center gap-1">
                              <button
                                onClick={(e) => handleCopyLink(e, room.id)}
                                className="p-1.5 glass rounded-lg hover:bg-emerald-500/15 hover:text-emerald-400 transition-all text-slate-500 border border-white/6"
                                title="نسخ رابط المجلس"
                              >
                                {copiedId === room.id
                                  ? <Check className="w-3.5 h-3.5 text-emerald-400" />
                                  : <Copy className="w-3.5 h-3.5" />
                                }
                              </button>
                              {room.hostId === user.uid && (
                                <button
                                  onClick={(e) => { e.stopPropagation(); deleteDoc(doc(db, 'rooms', room.id)); }}
                                  className="p-1.5 glass rounded-lg hover:bg-rose-500/15 hover:text-rose-400 transition-all text-slate-500 border border-white/6"
                                  title="حذف المجلس"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Room name */}
                        <h3 className="text-lg font-black text-white mb-1 group-hover:text-emerald-300 transition-colors duration-300 leading-snug flex-1">
                          {room.name}
                        </h3>

                        {/* Divider */}
                        <div className="h-px bg-white/5 my-4" />

                        {/* Stats */}
                        <div className="space-y-3">
                          <div className="flex items-center justify-between text-xs font-medium">
                            <div className="flex items-center gap-1.5 text-slate-500">
                              <Users className="w-3.5 h-3.5" />
                              <span>المشاركون</span>
                            </div>
                            <span className="text-white font-bold">
                              {room.participants?.length || 0}
                              <span className="text-slate-600"> / {room.maxParticipants}</span>
                            </span>
                          </div>

                          <div className="progress-bar">
                            <motion.div
                              className="progress-fill"
                              initial={{ width: 0 }}
                              animate={{ width: `${occupancy}%` }}
                              transition={{ duration: 0.8, ease: 'easeOut' }}
                            />
                          </div>

                          <div className="flex items-center justify-between pt-1">
                            <div className="flex -space-x-1.5 rtl:space-x-reverse">
                              {room.participants?.slice(0, 4).map((pid) => (
                                <img
                                  key={pid}
                                  src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${pid}`}
                                  className="w-6 h-6 rounded-lg border border-[#0f172a] bg-slate-800"
                                  alt=""
                                />
                              ))}
                              {(room.participants?.length || 0) > 4 && (
                                <div className="w-6 h-6 rounded-lg bg-emerald-950 border border-[#0f172a] flex items-center justify-center text-[9px] font-black text-emerald-400">
                                  +{(room.participants?.length || 0) - 4}
                                </div>
                              )}
                            </div>
                            <span className="text-[11px] font-black text-emerald-400 uppercase tracking-widest flex items-center gap-1.5 group-hover:gap-2.5 transition-all">
                              انضمام
                              <Mic className="w-3 h-3" />
                            </span>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          )}
        </section>
      </main>

      {/* FAB (Mobile) */}
      <motion.button
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setIsCreateModalOpen(true)}
        className="fixed bottom-8 left-8 w-14 h-14 rounded-2xl flex lg:hidden items-center justify-center shadow-[0_10px_30px_rgba(16,185,129,0.4)] z-50 text-white"
        style={{ background: 'linear-gradient(135deg, #059669, #10b981)' }}
      >
        <Plus className="w-7 h-7" />
      </motion.button>

      {/* ── Create Room Modal ── */}
      <AnimatePresence>
        {isCreateModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setIsCreateModalOpen(false)}
              className="absolute inset-0 bg-black/70 backdrop-blur-md"
            />
            <motion.div
              initial={{ scale: 0.92, opacity: 0, y: 30 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.92, opacity: 0, y: 20 }}
              transition={{ type: 'spring', stiffness: 260, damping: 28 }}
              className="max-w-lg w-full glass-premium rounded-[2.5rem] p-10 relative shadow-[0_60px_120px_rgba(0,0,0,0.8)]"
            >
              <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-emerald-400/40 to-transparent rounded-t-[2.5rem]" />

              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="absolute top-7 left-7 p-2.5 glass rounded-xl hover:bg-rose-500/15 hover:text-rose-400 transition-all border border-white/8"
              >
                <X className="w-4 h-4" />
              </button>

              <div className="mb-8">
                <h2 className="text-3xl font-black text-white font-ruqaa mb-1.5">تأسيس مجلس نور</h2>
                <p className="text-slate-500 text-sm">اضبط إعدادات الغرفة وادعُ أصدقاءك</p>
              </div>

              <form onSubmit={handleCreateRoom} className="space-y-7">
                <div className="space-y-2.5">
                  <label className="text-xs font-black text-slate-500 uppercase tracking-widest">اسم المجلس</label>
                  <input
                    type="text"
                    placeholder="مثل: ختمة الفجر، تدبر سورة الكهف..."
                    value={newRoomName}
                    onChange={(e) => setNewRoomName(e.target.value)}
                    className="w-full px-5 py-4 glass border border-white/10 rounded-2xl text-white placeholder-slate-700 outline-none focus:border-emerald-500/50 focus:ring-2 focus:ring-emerald-500/15 transition-all text-base"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-5">
                  <div className="space-y-2.5">
                    <label className="text-xs font-black text-slate-500 uppercase tracking-widest">السعة القصوى</label>
                    <select
                      value={newMaxParticipants}
                      onChange={(e) => setNewMaxParticipants(Number(e.target.value))}
                      className="w-full px-5 py-4 glass border border-white/10 rounded-2xl text-white outline-none focus:border-emerald-500/50 transition-all appearance-none cursor-pointer"
                    >
                      {[5, 10, 20, 50].map(n => <option key={n} value={n} className="bg-[#0f172a]">{n} مشارك</option>)}
                    </select>
                  </div>
                  <div className="space-y-2.5">
                    <label className="text-xs font-black text-slate-500 uppercase tracking-widest">مدة التلاوة</label>
                    <select
                      value={newRecordingDuration}
                      onChange={(e) => setNewRecordingDuration(Number(e.target.value))}
                      className="w-full px-5 py-4 glass border border-white/10 rounded-2xl text-white outline-none focus:border-emerald-500/50 transition-all appearance-none cursor-pointer"
                    >
                      {[30, 60, 120, 300].map(s => <option key={s} value={s} className="bg-[#0f172a]">{s} ثانية</option>)}
                    </select>
                  </div>
                </div>

                {/* Theme picker */}
                <div className="space-y-3">
                  <label className="text-xs font-black text-slate-500 uppercase tracking-widest">لون المجلس</label>
                  <div className="flex gap-3">
                    {themePresets.map(t => (
                      <button
                        key={t.id} type="button"
                        onClick={() => setNewThemeColor(t.id)}
                        className={`relative w-10 h-10 ${t.color} rounded-full transition-all ${newThemeColor === t.id ? 'ring-2 ring-white ring-offset-2 ring-offset-[#0f172a] scale-110' : 'opacity-60 hover:opacity-90'}`}
                        title={t.name}
                      />
                    ))}
                  </div>
                </div>

                <motion.button
                  type="submit"
                  disabled={isCreating}
                  whileHover={{ scale: 1.02, y: -1 }}
                  whileTap={{ scale: 0.98 }}
                  className="relative w-full py-5 rounded-[1.5rem] font-black text-xl text-white overflow-hidden shadow-[0_16px_40px_rgba(16,185,129,0.35)] disabled:opacity-50"
                  style={{ background: 'linear-gradient(135deg, #059669, #10b981, #34d399)' }}
                >
                  <div className="absolute inset-0 animate-shimmer opacity-40" />
                  <div className="absolute inset-x-0 top-0 h-px bg-white/25" />
                  <span className="relative flex items-center justify-center gap-3">
                    {isCreating ? <Loader2 className="w-6 h-6 animate-spin" /> : <Sparkles className="w-6 h-6" />}
                    تأسيس المجلس الآن
                  </span>
                </motion.button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── Profile Modal ── */}
      <AnimatePresence>
        {isProfileModalOpen && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-2xl z-[100] flex items-center justify-center p-6">
            <motion.div
              initial={{ scale: 0.92, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.92, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 260, damping: 28 }}
              className="glass-premium border border-white/10 rounded-[2.5rem] p-10 max-w-md w-full shadow-[0_0_120px_rgba(0,0,0,0.8)] relative"
            >
              <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/15 to-transparent rounded-t-[2.5rem]" />

              <button
                onClick={() => setIsProfileModalOpen(false)}
                className="absolute top-7 left-7 p-2.5 hover:bg-white/8 rounded-xl transition-all"
              >
                <X className="w-5 h-5 text-slate-400" />
              </button>

              <div className="flex flex-col items-center mb-8">
                <div className="relative group mb-5 cursor-pointer">
                  <img
                    src={user.photoURL}
                    className="w-28 h-28 rounded-[2rem] border-4 border-white/10 shadow-2xl group-hover:scale-105 transition-transform duration-500 object-cover"
                    alt=""
                  />
                  <div className="absolute inset-0 bg-black/50 rounded-[2rem] opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                    <Camera className="w-7 h-7 text-white" />
                  </div>
                  <div className="absolute -inset-1 rounded-[2.2rem] bg-gradient-to-br from-emerald-500/20 to-transparent opacity-0 group-hover:opacity-100 blur-md transition-opacity -z-10" />
                </div>
                <h2 className="text-2xl font-black text-white font-ruqaa mb-1">إعدادات الحساب</h2>
                <p className="text-slate-600 text-xs font-black uppercase tracking-widest">تعديل الملف الشخصي</p>
              </div>

              <div className="space-y-6">
                <div className="space-y-2.5">
                  <label className="text-xs font-black text-slate-500 uppercase tracking-widest">الاسم الكريم</label>
                  <div className="relative">
                    <UserIcon className="absolute right-4 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-emerald-400 w-[18px] h-[18px]" />
                    <input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="w-full pr-12 pl-5 py-4 glass border border-white/10 rounded-2xl text-white outline-none focus:border-emerald-500/50 focus:ring-2 focus:ring-emerald-500/15 transition-all font-bold"
                      placeholder="أدخل اسمك..."
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 glass rounded-2xl text-center border border-white/6">
                    <p className="text-[9px] text-slate-600 uppercase font-black tracking-widest mb-1.5">النقاط</p>
                    <p className="text-2xl font-black text-amber-400">{stats.totalScore.toLocaleString()}</p>
                  </div>
                  <div className="p-4 glass rounded-2xl text-center border border-white/6">
                    <p className="text-[9px] text-slate-600 uppercase font-black tracking-widest mb-1.5">الجولات</p>
                    <p className="text-2xl font-black text-emerald-400">{stats.count}</p>
                  </div>
                </div>

                <motion.button
                  disabled={isUpdatingProfile}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={async () => {
                    setIsUpdatingProfile(true);
                    try {
                      const { error } = await supabase.auth.updateUser({ data: { display_name: editName } });
                      if (error) throw error;
                      await updateUserProfile(user.uid, { displayName: editName });
                      setIsProfileModalOpen(false);
                      window.location.reload();
                    } catch (err) {
                      addToast('فشل تحديث البيانات.', 'error');
                    } finally {
                      setIsUpdatingProfile(false);
                    }
                  }}
                  className="relative w-full py-4 rounded-2xl font-black text-lg text-white overflow-hidden shadow-[0_10px_30px_rgba(16,185,129,0.25)] disabled:opacity-50"
                  style={{ background: 'linear-gradient(135deg, #059669, #10b981)' }}
                >
                  <div className="absolute inset-x-0 top-0 h-px bg-white/25" />
                  <span className="relative flex items-center justify-center gap-3">
                    {isUpdatingProfile ? <Loader2 className="w-5 h-5 animate-spin" /> : <Check className="w-5 h-5" />}
                    حفظ التغييرات
                  </span>
                </motion.button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
