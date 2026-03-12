import { useState, useEffect, useRef, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { db, doc, onSnapshot, updateDoc, deleteDoc, collection, addDoc, query, orderBy, arrayUnion, arrayRemove, syncUserScore } from '../firebase';
import { Room, Round, Recording, User } from '../types';
import { Mic, Square, Play, Download, Users, Settings, Loader2, Trophy, Clock, Sparkles, X, Heart, Volume2, Star, Share2, Check, BookOpen, Radio } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import Waveform from '../components/Waveform';
import RatingModal from '../components/RatingModal';
import RecordingsCarousel from '../components/RecordingsCarousel';
import confetti from 'canvas-confetti';

import { useLiveAudio } from '../hooks/useLiveAudio';

export default function RoomView({ user }: { user: any }) {
  const { roomId } = useParams<{ roomId: string }>();
  const navigate = useNavigate();
  const [room, setRoom] = useState<Room | null>(null);
  const [participants, setParticipants] = useState<User[]>([]);

  const isHost = room?.hostId === user.uid;
  const { isLive, startLive, stopLive, joinLive, remoteStreams, activeUsers, updatePresence } = useLiveAudio(roomId, user, isHost);

  const [round, setRound] = useState<Round | null>(null);
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const latestRoomRef = useRef<Room | null>(null);

  useEffect(() => {
    latestRoomRef.current = room;
  }, [room]);

  const [isReadyLocal, setIsReadyLocal] = useState(false);
  const [loading, setLoading] = useState(true);

  // Audio Recording State
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Fetch Room Data
  useEffect(() => {
    if (!roomId) return;
    const roomRef = doc(db, 'rooms', roomId);

    const syncProfile = async () => {
      try {
        await updateDoc(doc(db, 'users', user.uid), {
          displayName: user.displayName || 'ضيف',
          photoURL: user.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.uid}`,
          lastSeen: new Date().toISOString()
        }).catch(async (err) => {
           // Firestore error codes are different, but generic catch works
        });
      } catch (error) {
        console.error("Error syncing profile:", error);
      }
    };
    syncProfile();

    const unsubscribe = onSnapshot(roomRef, (docSnap) => {
      if (docSnap.exists()) {
        setRoom({ id: docSnap.id, ...docSnap.data() } as Room);
      } else {
        navigate('/dashboard');
      }
      setLoading(false);
    }, (error) => {
      console.error("Error listening to room:", error);
    });

    return () => {
      unsubscribe();
      if (activeUsers.length <= 1 && isHost) {
        deleteDoc(roomRef).catch(console.error);
      }
    };
  }, [roomId, user.uid, navigate, isHost, activeUsers.length]);

  useEffect(() => {
    setParticipants(activeUsers.map(u => ({
      uid: u.uid,
      displayName: u.name,
      photoURL: u.photoURL,
      isHost: u.isHost
    })));
  }, [activeUsers]);

  // Fetch Round Data
  useEffect(() => {
    if (!room?.currentRoundId || !roomId) {
      setRound(null);
      return;
    }
    const roundRef = doc(db, 'rooms', roomId, 'rounds', room.currentRoundId);
    return onSnapshot(roundRef, (docSnap) => {
      if (docSnap.exists()) {
        setRound({ id: docSnap.id, ...docSnap.data() } as Round);
      }
    });
  }, [room?.currentRoundId, roomId]);

  // Fetch Recordings Data
  useEffect(() => {
    if (!room?.currentRoundId || !roomId) {
      setRecordings([]);
      return;
    }
    const recsRef = collection(db, 'rooms', roomId, 'recordings');
    const q = query(recsRef, orderBy('createdAt', 'desc'));
    return onSnapshot(q, (snapshot) => {
      const recs = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() } as Recording))
        .filter(r => r.roundId === room.currentRoundId);
      setRecordings(recs);
    });
  }, [room?.currentRoundId, roomId]);

  // UI State
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isRatingModalOpen, setIsRatingModalOpen] = useState(false);
  const [activeRecordingId, setActiveRecordingId] = useState<string | null>(null);
  const [editMaxParticipants, setEditMaxParticipants] = useState(10);
  const [editRecordingDuration, setEditRecordingDuration] = useState(60);
  const [editThemeColor, setEditThemeColor] = useState('emerald');
  const [copied, setCopied] = useState(false);
  const [sortBy, setSortBy] = useState<'time' | 'likes' | 'score'>('time');
  const [verseSelectionMode, setVerseSelectionMode] = useState<'random' | 'manual'>('random');
  const [manualSurah, setManualSurah] = useState(1);
  const [manualAyah, setManualAyah] = useState(1);
  const [isStartingRound, setIsStartingRound] = useState(false);
  const [echoEnabled, setEchoEnabled] = useState(true);

  // Visualizer
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>();
  const analyserRef = useRef<AnalyserNode | null>(null);

  useEffect(() => {
    if (room) {
      setEditMaxParticipants(room.maxParticipants || 10);
      setEditRecordingDuration(room.recordingDuration || 60);
      setEditThemeColor(room.theme?.color || 'emerald');
    }
  }, [room, isSettingsOpen]);

  const saveSettings = async () => {
    if (!roomId) return;
    try {
      await updateDoc(doc(db, 'rooms', roomId), {
        maxParticipants: editMaxParticipants,
        recordingDuration: editRecordingDuration,
        theme: { color: editThemeColor }
      });
      setIsSettingsOpen(false);
    } catch (error) {
      console.error("Error saving settings:", error);
    }
  };

  const getColorClasses = (color: string) => {
    switch (color) {
      case 'blue': return { text: 'text-blue-500', bg: 'bg-blue-600', lightBg: 'bg-blue-500/20', glow: 'shadow-blue-900/20' };
      case 'purple': return { text: 'text-purple-500', bg: 'bg-purple-600', lightBg: 'bg-purple-500/20', glow: 'shadow-purple-900/20' };
      case 'rose': return { text: 'text-rose-500', bg: 'bg-rose-600', lightBg: 'bg-rose-500/20', glow: 'shadow-rose-900/20' };
      case 'amber': return { text: 'text-amber-500', bg: 'bg-amber-600', lightBg: 'bg-amber-500/20', glow: 'shadow-amber-900/20' };
      default: return { text: 'text-emerald-500', bg: 'bg-emerald-600', lightBg: 'bg-emerald-500/20', glow: 'shadow-emerald-900/20' };
    }
  };

  const theme = getColorClasses(room?.theme?.color || 'emerald');

  const handleShare = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {}
  };

  const handleLike = async (recording: Recording) => {
    if (!roomId) return;
    try {
      const recRef = doc(db, 'rooms', roomId, 'recordings', recording.id);
      const hasLiked = recording.likes?.includes(user.uid);
      await updateDoc(recRef, {
        likes: hasLiked ? arrayRemove(user.uid) : arrayUnion(user.uid)
      });
    } catch (error) {}
  };

  const handleScore = async (recording: Recording, score: number) => {
    if (!roomId || !isHost) return;
    try {
      await updateDoc(doc(db, 'rooms', roomId, 'recordings', recording.id), { score });
      // Trigger score sync for the user
      await syncUserScore(recording.userId);
    } catch (error) {}
  };

  const handleSubmitRating = async (rating: number) => {
    if (!roomId || !activeRecordingId) return;
    try {
      await updateDoc(doc(db, 'rooms', roomId, 'recordings', activeRecordingId), { rating });
      setIsRatingModalOpen(false);
      setActiveRecordingId(null);
    } catch (error) {}
  };

  const leaderboard = useMemo(() => {
    const scores: Record<string, { name: string, totalScore: number, recCount: number }> = {};
    recordings.forEach(rec => {
      if (rec.score !== undefined) {
        if (!scores[rec.userId]) scores[rec.userId] = { name: rec.userName, totalScore: 0, recCount: 0 };
        scores[rec.userId].totalScore += rec.score;
        scores[rec.userId].recCount += 1;
      }
    });
    return Object.values(scores).sort((a, b) => b.totalScore - a.totalScore).slice(0, 5);
  }, [recordings]);

  const finishRound = async () => {
    if (!roomId || !room?.currentRoundId || !isHost) return;
    await updateDoc(doc(db, 'rooms', roomId, 'rounds', room.currentRoundId), { status: 'finished' });
  };

  useEffect(() => {
    if (round?.status === 'finished') {
      confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 } });
    }
  }, [round?.status]);

  const handleReady = async () => {
    try {
      const newState = !isReadyLocal;
      setIsReadyLocal(newState);
      await updatePresence({ isReady: newState });
    } catch (error) {}
  };

  const startNewRound = async () => {
    if (!roomId || !isHost) return;
    setIsStartingRound(true);
    try {
      let verses = [];
      let surahName = '';
      let ayahNumber = 0;

      if (verseSelectionMode === 'random') {
        const randomAyah = Math.floor(Math.random() * 6236) + 1;
        const res = await fetch(`https://api.alquran.cloud/v1/ayah/${randomAyah}/quran-uthmani`);
        const data = await res.json();
        verses.push(data.data.text);
        surahName = data.data.surah.name;
        ayahNumber = data.data.numberInSurah;
      } else {
        const res = await fetch(`https://api.alquran.cloud/v1/ayah/${manualSurah}:${manualAyah}/quran-uthmani`);
        const data = await res.json();
        if (data.code !== 200) throw new Error("آية غير موجودة");
        verses.push(data.data.text);
        surahName = data.data.surah.name;
        ayahNumber = data.data.numberInSurah;
      }

      const roundRef = await addDoc(collection(db, 'rooms', roomId, 'rounds'), {
        roomId,
        verseText: verses.join(' '),
        surahName,
        ayahNumber,
        status: 'countdown',
        countdownStartTime: Date.now() + 5000,
        createdAt: Date.now()
      });

      await updateDoc(doc(db, 'rooms', roomId), {
        status: 'playing',
        currentRoundId: roundRef.id
      });
    } catch (error: any) {
      alert(error.message);
    } finally {
      setIsStartingRound(false);
    }
  };

  const [localCountdown, setLocalCountdown] = useState<number | null>(null);
  useEffect(() => {
    if (round?.status === 'countdown' && round.countdownStartTime) {
      const interval = setInterval(async () => {
        const remaining = Math.max(0, Math.ceil((round.countdownStartTime! - Date.now()) / 1000));
        setLocalCountdown(remaining);
        if (remaining === 0 && isHost) {
          clearInterval(interval);
          await updateDoc(doc(db, 'rooms', roomId!, 'rounds', round.id), { status: 'recording' });
        }
      }, 500);
      return () => clearInterval(interval);
    }
  }, [round?.status, round?.countdownStartTime, isHost, roomId, round?.id]);

  const claimRecording = async () => {
    if (!roomId || !round || round.status !== 'recording' || round.activeRecorderId) return;
    await updateDoc(doc(db, 'rooms', roomId, 'rounds', round.id), { activeRecorderId: user.uid });
    startRecording();
  };

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      let finalStream = stream;
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const source = audioCtx.createMediaStreamSource(stream);
      const analyser = audioCtx.createAnalyser();
      analyserRef.current = analyser;

      if (echoEnabled) {
         const destination = audioCtx.createMediaStreamDestination();
         const convolver = audioCtx.createConvolver();
         const duration = 2.0;
         const sampleRate = audioCtx.sampleRate;
         const length = sampleRate * duration;
         const impulse = audioCtx.createBuffer(2, length, sampleRate);
         for (let i = 0; i < length; i++) {
           impulse.getChannelData(0)[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, 2);
           impulse.getChannelData(1)[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, 2);
         }
         convolver.buffer = impulse;
         const wetGain = audioCtx.createGain(); wetGain.gain.value = 0.3;
         const dryGain = audioCtx.createGain(); dryGain.gain.value = 1.0;
         source.connect(dryGain); dryGain.connect(destination);
         source.connect(convolver); convolver.connect(wetGain); wetGain.connect(destination);
         destination.connect(analyser);
         finalStream = destination.stream;
      } else {
         source.connect(analyser);
      }

      const mediaRecorder = new MediaRecorder(finalStream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];
      mediaRecorder.ondataavailable = (e) => audioChunksRef.current.push(e.data);
      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const reader = new FileReader();
        reader.readAsDataURL(audioBlob);
        reader.onloadend = async () => {
          const base64Audio = reader.result as string;
          if (roomId && round) {
            const docRef = await addDoc(collection(db, 'rooms', roomId, 'recordings'), {
              roomId, roundId: round.id, userId: user.uid, userName: user.displayName || 'ضيف',
              audioData: base64Audio, duration: recordingTime, likes: [], createdAt: Date.now()
            });
            setActiveRecordingId(docRef.id);
            setIsRatingModalOpen(true);
          }
          stream.getTracks().forEach(t => t.stop());
          audioCtx.close();
        };
      };

      mediaRecorder.start();
      setIsRecording(true);
      setRecordingTime(0);
      timerRef.current = setInterval(() => setRecordingTime(p => p + 1), 1000);
    } catch (e) {
      alert("تعذر الوصول للميكروفون");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerRef.current) clearInterval(timerRef.current);
    }
  };

  if (loading || !room) return <div className="min-h-screen bg-slate-950 flex items-center justify-center text-emerald-500"><Loader2 className="w-8 h-8 animate-spin" /></div>;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col relative selection:bg-emerald-500/30 overflow-x-hidden">
      {/* Background Decor */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-emerald-600/10 blur-[150px] rounded-full" />
      </div>

      <div className="relative z-10 flex flex-col flex-1">
        <header className="sticky top-0 z-50 glass border-b border-white/10 h-20 px-6">
          <div className="max-w-7xl mx-auto h-full flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className={`w-10 h-10 rounded-xl ${theme.bg} flex items-center justify-center shadow-lg`}>
                <Radio className="text-white w-6 h-6 animate-pulse" />
              </div>
              <div>
                <h1 className="text-xl font-bold bg-gradient-to-l from-white to-slate-400 bg-clip-text text-transparent">{room.name}</h1>
                <div className="flex items-center gap-2 text-xs text-slate-400">
                  <Users className="w-3 h-3" />
                  <span>متصل {activeUsers.length}</span>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button onClick={isHost ? (isLive ? stopLive : startLive) : joinLive} className={`flex items-center gap-2 px-4 py-2 rounded-xl border transition-all ${isLive ? 'bg-rose-500/10 text-rose-400 border-rose-500/20' : 'bg-white/5 border-white/10'}`}>
                <Radio className="w-4 h-4" />
                <span className="text-xs font-bold">{isLive ? 'مباشر' : 'بث'}</span>
              </button>
              <button onClick={handleShare} className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 transition-all">
                {copied ? <Check className="w-5 h-5 text-emerald-400" /> : <Share2 className="w-5 h-5" />}
              </button>
              {isHost && <button onClick={() => setIsSettingsOpen(true)} className="p-2.5 rounded-xl bg-white/5"><Settings className="w-5 h-5" /></button>}
              <button onClick={() => navigate('/dashboard')} className="px-4 py-2 rounded-xl bg-white/5 text-sm font-medium">خروج</button>
            </div>
          </div>
        </header>

        <main className="max-w-[1600px] mx-auto w-full px-6 py-8 grid grid-cols-1 lg:grid-cols-12 gap-8 flex-1">
          {/* Sidebar */}
          <div className="lg:col-span-3 space-y-6">
            <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="glass-dark rounded-[2.5rem] p-6 border border-white/5">
              <h3 className="text-xl font-black text-amber-400 flex items-center gap-3 mb-6"><Users /> الحضور</h3>
              <div className="space-y-3">
                {activeUsers.map(p => (
                  <div key={p.uid} className={`flex items-center gap-3 p-3 rounded-2xl border ${p.isReady ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-white/5 border-transparent'}`}>
                    <img src={p.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${p.uid}`} className="w-10 h-10 rounded-xl" alt="" />
                    <span className="flex-1 text-sm font-bold truncate">{p.name || 'قارئ'}</span>
                    {p.isReady && <Check className="w-4 h-4 text-emerald-400" />}
                  </div>
                ))}
              </div>
              {room?.status === 'waiting' && (
                <button onClick={handleReady} className={`w-full mt-6 py-4 rounded-2xl font-black transition-all ${isReadyLocal ? 'bg-emerald-500 text-white shadow-emerald-500/20' : 'bg-white/5 text-slate-400 hover:bg-white/10'}`}>
                  {isReadyLocal ? 'أنا مستعد' : 'تأكيد الاستعداد'}
                </button>
              )}
            </motion.div>

            {leaderboard.length > 0 && (
              <div className="glass-dark rounded-[2.5rem] p-6 border border-white/5">
                <h3 className="text-xl font-black text-amber-400 flex items-center gap-3 mb-6"><Trophy /> الصدارة</h3>
                <div className="space-y-3">
                  {leaderboard.map((u, i) => (
                    <div key={i} className="flex items-center justify-between p-3 glass rounded-2xl">
                       <span className="font-bold text-sm">{u.name}</span>
                       <span className="text-amber-400 font-black">{u.totalScore}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Main Stage */}
          <div className="lg:col-span-6 flex flex-col gap-6">
            <motion.div layout className="glass-dark rounded-[3rem] p-10 min-h-[500px] flex flex-col items-center justify-center relative border border-white/10 shadow-2xl">
              {room.status === 'waiting' ? (
                <div className="text-center space-y-8 w-full max-w-md">
                   <div className={`w-32 h-32 mx-auto rounded-[3rem] ${theme.lightBg} flex items-center justify-center shadow-2xl`}>
                     <Users className={`w-14 h-14 ${theme.text}`} />
                   </div>
                   <h2 className="text-4xl font-black">المجلس منعقد</h2>
                   <p className="text-slate-400">بانتظار اكتمال القراء وبدء الجولة من المضيف</p>
                   {isHost && (
                     <div className="space-y-6 pt-6">
                       <div className="flex gap-2 p-1.5 bg-black/40 rounded-2xl">
                         <button onClick={() => setVerseSelectionMode('random')} className={`flex-1 py-3 rounded-xl text-xs font-bold ${verseSelectionMode === 'random' ? 'bg-emerald-500 text-white' : 'text-slate-500'}`}>آلي</button>
                         <button onClick={() => setVerseSelectionMode('manual')} className={`flex-1 py-3 rounded-xl text-xs font-bold ${verseSelectionMode === 'manual' ? 'bg-emerald-500 text-white' : 'text-slate-500'}`}>يدوي</button>
                       </div>
                       <button onClick={startNewRound} disabled={isStartingRound} className="w-full py-6 rounded-[2rem] bg-emerald-600 text-white font-black text-2xl shadow-xl hover:scale-[1.02] transition-all">إطلاق الجولة</button>
                     </div>
                   )}
                </div>
              ) : round ? (
                <div className="w-full text-center space-y-12">
                   <div className="inline-flex items-center gap-4 px-8 py-3 bg-white/5 rounded-full border border-white/10">
                     <BookOpen className="w-5 h-5 text-emerald-400" />
                     <span className="font-bold text-slate-300">سورة {round.surahName} آية {round.ayahNumber}</span>
                   </div>
                   <h2 className="text-5xl md:text-7xl font-arabic leading-[1.8] text-white drop-shadow-2xl" dir="rtl">{round.verseText}</h2>

                   <div className="pt-10 flex flex-col items-center">
                     {round.status === 'countdown' && <div className="text-9xl font-black animate-bounce">{localCountdown}</div>}
                     {round.status === 'recording' && (
                       <div className="w-full flex flex-col items-center gap-8">
                         {!round.activeRecorderId ? (
                           <button onClick={claimRecording} className="px-16 py-8 rounded-[3rem] bg-emerald-500 text-white font-black text-3xl shadow-2xl hover:scale-105 transition-all flex items-center gap-4"><Mic className="w-10 h-10" /> ترتيل</button>
                         ) : (
                           <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="w-full space-y-8">
                             <div className="flex items-center gap-6 justify-center">
                               <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${round.activeRecorderId}`} className="w-20 h-20 rounded-2xl border-2 border-emerald-500" alt="" />
                               <div className="text-right"><p className="text-emerald-400 text-xs font-bold">يتلو الآن</p><h4 className="text-2xl font-black">{activeUsers.find(u => u.uid === round.activeRecorderId)?.name || 'قارئ'}</h4></div>
                             </div>
                             {round.activeRecorderId === user.uid && (
                               <div className="space-y-6">
                                 <div className="text-5xl font-mono font-black text-rose-500">{Math.floor(recordingTime/60)}:{(recordingTime%60).toString().padStart(2,'0')}</div>
                                 <button onClick={stopRecording} className="px-12 py-5 rounded-2xl bg-rose-600 font-black text-xl flex items-center gap-3 mx-auto"><Square /> إنهاء</button>
                               </div>
                             )}
                           </motion.div>
                         )}
                       </div>
                     )}
                     {round.status === 'reviewing' && (
                       <div className="space-y-6">
                         <Star className="w-16 h-16 text-amber-400 mx-auto animate-pulse" />
                         <h3 className="text-3xl font-black">مرحلة المراجعة</h3>
                         {isHost && <button onClick={finishRound} className="px-10 py-4 bg-emerald-600 rounded-2xl font-bold">تثبيت النتائج</button>}
                       </div>
                     )}
                     {round.status === 'finished' && (
                       <div className="space-y-8">
                         <Trophy className="w-20 h-20 text-amber-400 mx-auto" />
                         <h2 className="text-4xl font-black">انتهت الجولة</h2>
                         {isHost && <button onClick={startNewRound} className="px-12 py-5 bg-emerald-600 rounded-3xl font-black">جولة جديدة</button>}
                       </div>
                     )}
                   </div>
                </div>
              ) : <Loader2 className="w-12 h-12 animate-spin text-slate-500" />}
            </motion.div>
          </div>

          {/* Recordings Feed */}
          <div className="lg:col-span-3 space-y-6 overflow-y-auto no-scrollbar max-h-[calc(100vh-160px)]">
             <div className="flex items-center justify-between px-2">
               <h3 className="text-lg font-black flex items-center gap-2"><Volume2 /> الأصوات</h3>
               <div className="flex bg-white/5 rounded-xl p-1">
                 {['time', 'score'].map(s => <button key={s} onClick={() => setSortBy(s as any)} className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase ${sortBy === s ? 'bg-white/10 text-white' : 'text-slate-500'}`}>{s === 'time' ? 'الأحدث' : 'التقييم'}</button>)}
               </div>
             </div>
             <AnimatePresence>
               {recordings.map(rec => (
                 <motion.div key={rec.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="glass-dark p-5 rounded-3xl border border-white/5 space-y-4">
                    <div className="flex items-center justify-between">
                       <span className="text-sm font-bold">{rec.userName}</span>
                       {rec.score !== undefined && <span className="px-2 py-1 bg-amber-500/10 text-amber-400 text-xs font-black rounded-lg">{rec.score}</span>}
                    </div>
                    <audio src={rec.audioData} className="w-full h-8 opacity-70" controls />
                    <div className="flex items-center justify-between pt-2">
                       <button onClick={() => handleLike(rec)} className={`flex items-center gap-2 text-xs font-bold ${rec.likes?.includes(user.uid) ? 'text-rose-400' : 'text-slate-500'}`}><Heart className="w-4 h-4" /> {rec.likes?.length || 0}</button>
                       {isHost && round?.status === 'reviewing' && (
                         <div className="flex items-center gap-1">
                           {[1,2,3,4,5].map(i => <button key={i} onClick={() => handleScore(rec, i*20)} className={`p-1 ${ (rec.score || 0) >= i*20 ? 'text-amber-400' : 'text-slate-700' }`}><Star className="w-4 h-4 fill-current" /></button>)}
                         </div>
                       )}
                    </div>
                 </motion.div>
               ))}
             </AnimatePresence>
          </div>
        </main>
      </div>

      {/* Modals & Audio */}
      <AnimatePresence>
        {isSettingsOpen && (
          <div className="fixed inset-0 bg-black/90 backdrop-blur-xl z-[100] flex items-center justify-center p-6">
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="bg-slate-900 border border-white/10 rounded-[3rem] p-10 max-w-lg w-full shadow-2xl space-y-8">
               <div className="flex justify-between items-center"><h2 className="text-3xl font-black">الإعدادات</h2><button onClick={() => setIsSettingsOpen(false)}><X /></button></div>
               <div className="space-y-6">
                 <div><p className="text-sm font-bold mb-4">صدى المسجد</p><button onClick={() => setEchoEnabled(!echoEnabled)} className={`w-full py-4 rounded-2xl flex items-center justify-center gap-3 transition-all ${echoEnabled ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40' : 'bg-white/5 border border-white/10 text-slate-500'}`}>{echoEnabled ? <Volume2 /> : <Mic />} {echoEnabled ? 'مفعل' : 'معطل'}</button></div>
                 <div><p className="text-sm font-bold mb-4">لون السمة</p><div className="flex gap-4">{['emerald', 'blue', 'purple', 'rose'].map(c => <button key={c} onClick={() => setEditThemeColor(c)} className={`w-10 h-10 rounded-full ${c === 'emerald' ? 'bg-emerald-500' : c === 'blue' ? 'bg-blue-500' : c === 'purple' ? 'bg-purple-500' : 'bg-rose-500'} ${editThemeColor === c ? 'ring-4 ring-white' : ''}`} />)}</div></div>
               </div>
               <button onClick={saveSettings} className="w-full py-5 rounded-2xl bg-emerald-600 font-black text-xl">حفظ</button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <div className="hidden">
        {(Array.from(remoteStreams.keys()) as string[]).map((uid) => (
          <RemoteAudio key={uid} stream={remoteStreams.get(uid)!} />
        ))}
      </div>
      <RatingModal isOpen={isRatingModalOpen} onClose={() => setIsRatingModalOpen(false)} onSubmit={handleSubmitRating} />
    </div>
  );
}

function RemoteAudio({ stream }: { stream: MediaStream; key?: string }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  useEffect(() => {
    if (audioRef.current && stream) {
      audioRef.current.srcObject = stream;
    }
  }, [stream]);
  return <audio ref={audioRef} autoPlay />;
}
