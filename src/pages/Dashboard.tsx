import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { db, logout, collection, addDoc, onSnapshot, query, orderBy, limit, updateDoc, doc, arrayUnion, getDocs, deleteDoc } from '../firebase';
import { Plus, LogOut, Users, Mic, Shuffle, Sparkles, Radio, Trophy, Search, BookOpen, Settings, X, Loader2, Copy, Check, MessageSquare, Heart, Star, Crown } from 'lucide-react';
import { Room } from '../types';
import { motion, AnimatePresence } from 'motion/react';

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
  const navigate = useNavigate();

  const themePresets = [
    { id: 'emerald', name: 'زمردي', color: 'bg-emerald-500', glow: 'shadow-emerald-500/20' },
    { id: 'blue', name: 'ياقوتي', color: 'bg-blue-500', glow: 'shadow-blue-500/20' },
    { id: 'purple', name: 'بنفسجي', color: 'bg-purple-500', glow: 'shadow-purple-500/20' },
    { id: 'rose', name: 'وردي', color: 'bg-rose-500', glow: 'shadow-rose-500/20' },
    { id: 'amber', name: 'ذهبي', color: 'bg-amber-500', glow: 'shadow-amber-500/20' },
  ];



  useEffect(() => {
    // Simplified query for Supabase Bridge
    const q = collection(db, 'rooms');
    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (snapshot.docs) {
        setRooms(snapshot.docs.map((d: any) => ({ id: d.id, ...d.data() })));
      }
    });
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
        theme: {
          color: newThemeColor
        }
      });
      navigate(`/room/${roomRef.id}`);
    } catch (error) {
      console.error("Error creating room:", error);
      alert("فشل إنشاء الغرفة.");
    } finally {
      setIsCreating(false);
    }
  };

  const handleJoinRoom = async (roomId: string) => {
    try {
      const roomRef = doc(db, 'rooms', roomId);
      await updateDoc(roomRef, {
        participants: arrayUnion(user.uid)
      });
      navigate(`/room/${roomId}`);
    } catch (error) {
      console.error("Error joining room:", error);
    }
  };

  const filteredRooms = rooms.filter(room =>
    room.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-transparent text-slate-100 selection:bg-emerald-500/30 overflow-x-hidden pb-20">
      {/* Background Effects */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute top-[-20%] right-[-10%] w-[60%] h-[60%] bg-emerald-600/10 blur-[150px] rounded-full animate-float"></div>
        <div className="absolute bottom-[-20%] left-[-10%] w-[50%] h-[50%] bg-amber-600/5 blur-[120px] rounded-full" style={{ animationDelay: '3s' }}></div>
      </div>

      <header className="sticky top-0 z-50 glass-dark border-b border-white/5 py-4">
        <div className="max-w-7xl mx-auto px-6 flex items-center justify-between">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex items-center gap-4"
          >
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-emerald-400 to-emerald-700 p-0.5 shadow-[0_0_20px_rgba(16,185,129,0.2)]">
               <div className="w-full h-full bg-[#020617] rounded-[0.9rem] flex items-center justify-center">
                  <Mic className="text-emerald-400 w-6 h-6 animate-pulse-glow" />
               </div>
            </div>
            <div>
              <h1 className="text-2xl font-black font-ruqaa text-gradient-emerald tracking-wide">تلاوة</h1>
              <p className="text-[10px] text-slate-500 font-bold uppercase tracking-[0.3em]">Noble Sessions</p>
            </div>
          </motion.div>

          <div className="flex items-center gap-6">
            <div className="hidden lg:flex items-center gap-4 bg-white/5 px-4 py-2 rounded-2xl border border-white/10 group hover:border-emerald-500/30 transition-all duration-300">
               <div className="text-right">
                <p className="text-xs font-bold text-white">{user.displayName || 'قارئ'}</p>
                <p className="text-[10px] text-emerald-400 font-medium">متصل الآن</p>
              </div>
              <img
                src={user.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.uid}`}
                alt="Profile"
                className="w-10 h-10 rounded-xl border-2 border-emerald-500/20 group-hover:border-emerald-500/50 transition-all"
              />
            </div>
            <button
              onClick={logout}
              className="p-3 text-slate-400 hover:text-rose-400 glass rounded-xl transition-all border border-white/5 hover:border-rose-500/20"
              title="تسجيل الخروج"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 mt-12 relative z-10">
        {/* Hero Section */}
        <section className="mb-16">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.8 }}
            >
              <h2 className="text-5xl font-black text-white leading-tight mb-6 font-ruqaa">
                اجتمعوا على <span className="text-gradient-emerald underline decoration-emerald-500/30">كلام الله</span> <br /> 
                في مجالس النور
              </h2>
              <p className="text-slate-400 text-lg mb-8 max-w-lg">
                منصة رقمية فاخرة لتنظيم جولات التلاوة، التقييم، والارتقاء بالأداء الصوتي في بيئة تنافسية إيمانية.
              </p>
              
              <div className="flex flex-wrap gap-4">
                <button
                  onClick={() => setIsCreateModalOpen(true)}
                  className="px-8 py-4 bg-emerald-600 text-white rounded-2xl font-bold flex items-center gap-3 shadow-[0_20px_40px_rgba(16,185,129,0.2)] hover:shadow-[0_20px_50px_rgba(16,185,129,0.4)] hover:-translate-y-1 transition-all duration-300"
                >
                  <Plus className="w-6 h-6" />
                  إنشاء مجلس جديد
                </button>
                <button 
                  onClick={() => {
                    const available = rooms.filter(r => (r.participants?.length || 0) < (r.maxParticipants || 10));
                    if (available.length > 0) handleJoinRoom(available[Math.floor(Math.random() * available.length)].id);
                  }}
                  className="px-8 py-4 glass text-white rounded-2xl font-bold flex items-center gap-3 hover:bg-white/10 border border-white/10 transition-all duration-300"
                >
                  <Shuffle className="w-5 h-5 text-emerald-400" />
                  دخول عشوائي
                </button>
              </div>
            </motion.div>

            <motion.div 
              initial={{ opacity: 0, x: 50 }}
              animate={{ opacity: 1, x: 0 }}
              className="relative hidden lg:block"
            >
               <div className="aspect-square w-full max-w-md mx-auto glass-emerald rounded-[3rem] p-1 rotate-3 shadow-[0_0_100px_rgba(16,185,129,0.1)]">
                 <div className="w-full h-full bg-emerald-500/10 flex items-center justify-center">
                    <Sparkles className="w-32 h-32 text-emerald-500/20" />
                 </div>
                 <div className="absolute inset-0 flex items-center justify-center">
                    <div className="p-8 glass-dark rounded-3xl border border-white/10 animate-float translate-x-12">
                       <Radio className="w-12 h-12 text-emerald-400 mb-4 animate-pulse" />
                       <p className="text-white font-black text-xl">بث مباشر</p>
                       <p className="text-slate-400 text-xs mt-1">12 قارئ متصل الآن</p>
                    </div>
                 </div>
               </div>
            </motion.div>
          </div>
        </section>

        {/* Search & Filters */}
        <section className="mb-10 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="relative w-full md:max-w-md group">
            <Search className="absolute right-5 top-1/2 -translate-y-1/2 text-slate-500 w-5 h-5 group-focus-within:text-emerald-400 transition-colors" />
            <input
              type="text"
              placeholder="ابحث عن مجلس..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pr-14 pl-6 py-4 glass-dark border border-white/10 rounded-2xl text-white outline-none focus:border-emerald-500/50 transition-all shadow-inner"
            />
          </div>
          
          <div className="flex items-center gap-3 overflow-x-auto pb-2 no-scrollbar w-full md:w-auto">
             <span className="text-xs font-black text-slate-500 uppercase tracking-widest ml-2 whitespace-nowrap">فرز حسب:</span>
             {['الكل', 'نشط', 'بانتظار', 'خاص'].map(tag => (
               <button key={tag} className="px-4 py-2 glass rounded-xl text-xs font-bold whitespace-nowrap border border-white/5 hover:bg-white/10 transition-all">
                  {tag}
               </button>
             ))}
          </div>
        </section>

        {/* Rooms Grid */}
        <section>
          {filteredRooms.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 glass-dark rounded-[3rem] border border-dashed border-white/10">
              <div className="w-20 h-20 bg-emerald-500/10 rounded-full flex items-center justify-center mb-6">
                 <Users className="w-10 h-10 text-emerald-500 opacity-20" />
              </div>
              <p className="text-slate-500 font-bold text-xl">لا توجد مجالس مفتوحة حالياً</p>
              <p className="text-slate-600 mt-2">كن أنت المستفتح وأطلق أول مجلس!</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              <AnimatePresence mode='popLayout'>
                {filteredRooms.map((room) => (
                  <motion.div
                    key={room.id}
                    layout
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    onClick={() => handleJoinRoom(room.id)}
                    className="group relative cursor-pointer"
                  >
                    <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-transparent rounded-[2rem] -z-10 transition-all group-hover:from-emerald-500/20"></div>
                    <div className="glass-dark border border-white/5 rounded-[2rem] p-6 hover:border-emerald-500/30 transition-all duration-500 group-hover:shadow-[0_20px_50px_rgba(0,0,0,0.4)] group-hover:-translate-y-2">
                      <div className="flex justify-between items-start mb-6">
                        <div className="w-14 h-14 rounded-2xl bg-white/5 flex items-center justify-center overflow-hidden border border-white/10 group-hover:bg-emerald-500/10 group-hover:border-emerald-500/20 transition-all">
                          {room.theme?.backgroundImage ? (
                             <img src={room.theme.backgroundImage} className="w-full h-full object-cover opacity-60" alt="" />
                          ) : (
                             <Sparkles className="w-7 h-7 text-emerald-500/50" />
                          )}
                        </div>
                        <div className="flex flex-col items-end gap-2">
                            <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${
                            room.status === 'playing' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/20' : 'bg-amber-500/10 text-amber-400 border border-amber-500/10'
                            }`}>
                            {room.status === 'playing' ? 'جاري التلاوة' : 'بانتظار البدء'}
                            </span>
                            {room.hostId === user.uid && (
                              <button 
                                onClick={(e) => { e.stopPropagation(); deleteDoc(doc(db, 'rooms', room.id)); }}
                                className="p-2 glass rounded-lg hover:bg-rose-500/20 hover:text-rose-400 transition-all"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            )}
                        </div>
                      </div>

                      <h3 className="text-xl font-bold text-white mb-2 group-hover:text-emerald-300 transition-colors uppercase tracking-tight">{room.name}</h3>
                      
                      <div className="space-y-4">
                        <div className="flex items-center justify-between text-xs font-medium">
                          <div className="flex items-center gap-2 text-slate-400">
                             <Users className="w-3.5 h-3.5" />
                             <span>المشاركين</span>
                          </div>
                          <span className="text-white font-bold">{room.participants?.length || 0} / {room.maxParticipants}</span>
                        </div>
                        
                        <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden">
                           <motion.div 
                              initial={{ width: 0 }}
                              animate={{ width: `${((room.participants?.length || 0) / (room.maxParticipants || 10)) * 100}%` }}
                              className="h-full bg-gradient-to-r from-emerald-600 to-emerald-400 shadow-[0_0_10px_rgba(16,185,129,0.5)]"
                           />
                        </div>

                        <div className="flex items-center justify-between pt-2">
                           <div className="flex -space-x-2 rtl:space-x-reverse">
                              {room.participants?.slice(0, 4).map((pid, idx) => (
                                <img 
                                  key={pid} 
                                  src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${pid}`} 
                                  className="w-7 h-7 rounded-lg border-2 border-[#0f172a] bg-slate-800"
                                  alt=""
                                />
                              ))}
                              {(room.participants?.length || 0) > 4 && (
                                <div className="w-7 h-7 rounded-lg bg-emerald-950 border-2 border-[#0f172a] flex items-center justify-center text-[10px] font-bold text-emerald-400">
                                  +{(room.participants?.length || 0) - 4}
                                </div>
                              )}
                           </div>
                           <button className="text-[11px] font-black text-emerald-400 uppercase tracking-widest flex items-center gap-2 group-hover:gap-3 transition-all">
                              الانضمام
                              <Mic className="w-3 h-3" />
                           </button>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}
        </section>
      </main>

      {/* FAB for Mobile */}
      <button 
        onClick={() => setIsCreateModalOpen(true)}
        className="fixed bottom-8 left-8 w-16 h-16 bg-emerald-500 rounded-full flex lg:hidden items-center justify-center shadow-[0_10px_30px_rgba(16,185,129,0.4)] animate-bounce relative z-50 text-white"
      >
        <Plus className="w-8 h-8" />
      </button>

      {/* Create Modal */}
      <AnimatePresence>
        {isCreateModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsCreateModalOpen(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="max-w-xl w-full glass-dark rounded-[3rem] p-10 border border-white/10 relative shadow-[0_50px_100px_rgba(0,0,0,0.8)]"
            >
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="absolute top-8 left-8 p-3 glass rounded-2xl hover:bg-rose-500/20 hover:text-rose-400 transition-all border border-white/10"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="mb-10">
                 <h2 className="text-3xl font-black text-white font-ruqaa mb-2">تأسيس مجلس نور</h2>
                 <p className="text-slate-500 text-sm">اضبط إعدادات الغرفة وادعُ أصدقاءك</p>
              </div>

              <form onSubmit={handleCreateRoom} className="space-y-8">
                <div className="space-y-3">
                  <label className="text-xs font-black text-slate-400 uppercase tracking-widest mr-2">اسم المجلس</label>
                  <input
                    type="text"
                    placeholder="مثل: ختمة الفجر، تدبر سورة الكهف..."
                    value={newRoomName}
                    onChange={(e) => setNewRoomName(e.target.value)}
                    className="w-full px-6 py-4 glass-dark border border-white/10 rounded-2xl text-white outline-none focus:border-emerald-500/50 transition-all text-lg"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-3">
                    <label className="text-xs font-black text-slate-400 uppercase tracking-widest mr-2">السعة القصوى</label>
                    <select
                      value={newMaxParticipants}
                      onChange={(e) => setNewMaxParticipants(Number(e.target.value))}
                      className="w-full px-6 py-4 glass-dark border border-white/10 rounded-2xl text-white outline-none focus:border-emerald-500/50 transition-all appearance-none cursor-pointer"
                    >
                      {[5, 10, 20, 50].map(n => <option key={n} value={n} className="bg-[#0f172a]">{n} مشارك</option>)}
                    </select>
                  </div>
                  <div className="space-y-3">
                     <label className="text-xs font-black text-slate-400 uppercase tracking-widest mr-2">مدة التلاوة</label>
                     <select 
                        value={newRecordingDuration}
                        onChange={(e) => setNewRecordingDuration(Number(e.target.value))}
                        className="w-full px-6 py-4 glass-dark border border-white/10 rounded-2xl text-white outline-none focus:border-emerald-500/50 transition-all appearance-none cursor-pointer"
                     >
                        {[30, 60, 120, 300].map(s => <option key={s} value={s} className="bg-[#0f172a]">{s} ثانية</option>)}
                     </select>
                  </div>
                </div>



                <button
                  type="submit"
                  disabled={isCreating}
                  className="w-full py-5 bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-[2rem] font-bold text-xl shadow-[0_20px_40px_rgba(16,185,129,0.3)] hover:shadow-[0_20px_60px_rgba(16,185,129,0.5)] transition-all flex items-center justify-center gap-3 disabled:opacity-50"
                >
                  {isCreating ? <Loader2 className="w-7 h-7 animate-spin" /> : <Sparkles className="w-7 h-7 animate-pulse-glow" />}
                  تأسيس المجلس الآن
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
