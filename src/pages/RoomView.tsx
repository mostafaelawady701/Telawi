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
import { useToast } from '../components/Toast';
import { useLiveAudio } from '../hooks/useLiveAudio';

const THEME_GLOWS: Record<string, string> = {
  emerald: 'rgba(16,185,129,0.3)',
  blue:    'rgba(59,130,246,0.3)',
  purple:  'rgba(168,85,247,0.3)',
  rose:    'rgba(244,63,94,0.3)',
  amber:   'rgba(245,158,11,0.3)',
};

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
  const { addToast } = useToast();

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
    };
  }, [roomId, user.uid, navigate]);

  // Handle room deletion only on unmount
  const activeUsersCount = activeUsers.length;
  useEffect(() => {
    return () => {
      // Use a check to only delete if we are actually the host and room is empty
      // But we need the most fresh value, so we'd normally use a ref
      // However, for now, let's just avoid this automatic deletion as it's dangerous
      // and causes the "immediate exit" bug.
    };
  }, []);

  // Clean up participant on unmount
  useEffect(() => {
    return () => {
      // Disconnect handled by useLiveAudio, but we should make sure
      // we untrack explicitly if navigating away
      if (typeof updatePresence === 'function') {
        updatePresence({ isReady: false, status: 'leaving' });
      }
      if (roomId && user?.uid) {
         updateDoc(doc(db, 'rooms', roomId), {
           participants: arrayRemove(user.uid)
         }).catch(console.error);
      }
    };
  }, [roomId, user?.uid]);

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
      addToast("تم حفظ الإعدادات بنجاح", 'success');
    } catch (error) {
      console.error("Error saving settings:", error);
      addToast("فشل حفظ الإعدادات", 'error');
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
      addToast("تم نسخ رابط المجلس!", 'success');
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      addToast("فشل نسخ الرابط", 'error');
    }
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
        createdAt: Date.now()
      });

      await updateDoc(doc(db, 'rooms', roomId), {
        status: 'playing',
        currentRoundId: roundRef.id
      });
      addToast("بدأت الجولة الجديدة!", 'success');
    } catch (error: any) {
      addToast(error.message || "حدث خطأ أثناء بدء الجولة", 'error');
    } finally {
      setIsStartingRound(false);
    }
  };

  const [localCountdown, setLocalCountdown] = useState<number | null>(null);
  useEffect(() => {
    if (round?.status === 'countdown') {
      const endTime = Date.now() + 5000;
      setLocalCountdown(5);
      const interval = setInterval(async () => {
        const remaining = Math.max(0, Math.ceil((endTime - Date.now()) / 1000));
        setLocalCountdown(remaining);
        if (remaining === 0) {
          clearInterval(interval);
          if (isHost && roomId && round?.id) {
            await updateDoc(doc(db, 'rooms', roomId, 'rounds', round.id), { status: 'recording' }).catch(console.error);
          }
        }
      }, 500);
      return () => clearInterval(interval);
    } else {
      setLocalCountdown(null);
    }
  }, [round?.status, isHost, roomId, round?.id]);

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
      
      timerRef.current = setInterval(() => {
        setRecordingTime(p => p + 1);
      }, 1000);

      // Visualizer loop
      const drawVisualizer = () => {
        if (!canvasRef.current || !analyserRef.current || !isRecording) return;
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        
        const bufferLength = analyserRef.current.frequencyBinCount;
        const dataArray = new Uint8Array(bufferLength);
        analyserRef.current.getByteTimeDomainData(dataArray);

        ctx.fillStyle = 'rgba(2, 6, 23, 0.2)'; // Tailwind slate-950 with opacity for trailing effect
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.lineWidth = 3;
        ctx.strokeStyle = '#10b981'; // Tailwind emerald-500
        ctx.beginPath();
        
        const sliceWidth = canvas.width * 1.0 / bufferLength;
        let x = 0;
        for (let i = 0; i < bufferLength; i++) {
          const v = dataArray[i] / 128.0;
          const y = v * canvas.height / 2;
          if (i === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
          x += sliceWidth;
        }
        ctx.lineTo(canvas.width, canvas.height / 2);
        ctx.stroke();
        
        animationRef.current = requestAnimationFrame(drawVisualizer);
      };
      
      drawVisualizer();

    } catch (e) {
      addToast("تعذر الوصول للميكروفون، يرجى التأكد من الصلاحيات", 'error');
    }
  };

  useEffect(() => {
    if (isRecording && recordingTime >= (room?.recordingDuration || 60)) {
       stopRecording();
    }
  }, [isRecording, recordingTime, room?.recordingDuration]);

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
    if (timerRef.current) clearInterval(timerRef.current);
    if (animationRef.current) cancelAnimationFrame(animationRef.current);
  };

  if (loading || !room) return (
    <div className="min-h-screen bg-[#020617] flex items-center justify-center">
      <div className="text-center space-y-4">
        <div className="relative">
          <div className="w-16 h-16 border-2 border-emerald-500/20 border-t-emerald-400 rounded-full animate-spin mx-auto" />
          <div className="absolute inset-0 w-16 h-16 mx-auto bg-emerald-500/5 rounded-full blur-xl" />
        </div>
        <p className="text-slate-600 text-sm font-bold">جارٍ تحميل المجلس...</p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#020617] text-slate-100 flex flex-col relative selection:bg-emerald-500/30 overflow-x-hidden">
      {/* Background Decor */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <div className="absolute top-[-15%] right-[-10%] w-[60%] h-[60%] bg-emerald-600/8 blur-[180px] rounded-full animate-float-slow" />
        <div className="absolute bottom-[-20%] left-[-10%] w-[45%] h-[45%] bg-amber-600/5 blur-[150px] rounded-full animate-float-slow" style={{ animationDelay: '5s' }} />
        <div className="absolute inset-0 islamic-pattern" />
      </div>

      <div className="relative z-10 flex flex-col flex-1">
        <header className="sticky top-0 z-50 glass-dark border-b border-white/6 py-3">
          <div className="max-w-[1600px] mx-auto px-6 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className={`w-10 h-10 rounded-2xl ${theme.bg} flex items-center justify-center shadow-lg shrink-0`} style={{ boxShadow: `0 0 20px ${THEME_GLOWS[room?.theme?.color || 'emerald']}` }}>
                <Radio className="text-white w-5 h-5 animate-pulse" />
              </div>
              <div>
                <h1 className="text-lg font-black text-white leading-none mb-0.5">{room.name}</h1>
                <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
                  <Users className="w-3 h-3" />
                  <span>{activeUsers.length} متصل</span>
                  {isLive && (
                    <span className="flex items-center gap-1 text-rose-400 font-bold mr-2">
                      <span className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-pulse" />
                      مباشر
                    </span>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={isHost ? (isLive ? stopLive : startLive) : joinLive}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border transition-all text-xs font-bold ${
                  isLive
                    ? 'bg-rose-500/10 text-rose-400 border-rose-500/20 hover:bg-rose-500/15'
                    : 'glass border-white/8 text-slate-300 hover:border-emerald-500/30 hover:text-emerald-400'
                }`}
              >
                <Radio className="w-3.5 h-3.5" />
                {isLive ? 'إيقاف البث' : 'بدء البث'}
              </button>
              <button
                onClick={handleShare}
                className="p-2.5 rounded-xl glass border border-white/8 hover:border-emerald-500/30 hover:text-emerald-400 transition-all text-slate-400"
              >
                {copied ? <Check className="w-4.5 h-4.5 text-emerald-400 w-[18px] h-[18px]" /> : <Share2 className="w-[18px] h-[18px]" />}
              </button>
              {isHost && (
                <button
                  onClick={() => setIsSettingsOpen(true)}
                  className="p-2.5 rounded-xl glass border border-white/8 hover:border-white/20 transition-all text-slate-400"
                >
                  <Settings className="w-[18px] h-[18px]" />
                </button>
              )}
              <button
                onClick={() => navigate('/dashboard')}
                className="px-4 py-2.5 rounded-xl glass border border-white/8 text-slate-400 hover:text-white hover:border-white/20 text-xs font-bold transition-all"
              >
                خروج
              </button>
            </div>
          </div>
        </header>

        <main className="max-w-[1600px] mx-auto w-full px-6 py-8 grid grid-cols-1 lg:grid-cols-12 gap-8 flex-1">
          {/* Sidebar */}
          <div className="lg:col-span-3 space-y-5">
            <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} className="glass-dark rounded-[2rem] p-5 border border-white/6">
              <h3 className="text-base font-black text-slate-300 flex items-center gap-2.5 mb-5">
                <div className="w-7 h-7 rounded-xl bg-amber-500/10 border border-amber-500/15 flex items-center justify-center">
                  <Users className="w-3.5 h-3.5 text-amber-400" />
                </div>
                الحضور
                <span className="ml-auto px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/15 text-emerald-400 text-[10px] font-black">{activeUsers.length}</span>
              </h3>
              <div className="space-y-2">
                {activeUsers.map(p => (
                  <div key={p.uid} className={`flex items-center gap-3 p-3 rounded-xl border transition-all duration-200 ${
                    p.isReady
                      ? 'bg-emerald-500/8 border-emerald-500/15'
                      : 'bg-white/3 border-white/5 hover:bg-white/5'
                  }`}>
                    <img src={p.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${p.uid}`} className="w-9 h-9 rounded-xl object-cover" alt="" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold truncate text-white">{p.name || 'قارئ'}</p>
                      {p.isHost && <p className="text-[10px] text-amber-400 font-bold">المضيف</p>}
                    </div>
                    {p.isReady && (
                      <div className="w-5 h-5 rounded-full bg-emerald-500/15 border border-emerald-500/20 flex items-center justify-center shrink-0">
                        <Check className="w-2.5 h-2.5 text-emerald-400" />
                      </div>
                    )}
                  </div>
                ))}
              </div>
              {room?.status === 'waiting' && (
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={handleReady}
                  className={`w-full mt-5 py-3.5 rounded-xl font-black text-sm transition-all duration-200 ${
                    isReadyLocal
                      ? 'text-white shadow-[0_8px_24px_rgba(16,185,129,0.3)]'
                      : 'bg-white/5 text-slate-400 hover:bg-white/10 hover:text-slate-200 border border-white/8'
                  }`}
                  style={isReadyLocal ? { background: 'linear-gradient(135deg, #059669, #10b981)' } : {}}
                >
                  {isReadyLocal ? '✓ أنا مستعد' : 'تأكيد الاستعداد'}
                </motion.button>
              )}
            </motion.div>

            {leaderboard.length > 0 && (
              <div className="glass-dark rounded-[2rem] p-5 border border-white/6">
                <h3 className="text-base font-black text-slate-300 flex items-center gap-2.5 mb-4">
                  <div className="w-7 h-7 rounded-xl bg-amber-500/10 border border-amber-500/15 flex items-center justify-center">
                    <Trophy className="w-3.5 h-3.5 text-amber-400" />
                  </div>
                  الصدارة
                </h3>
                <div className="space-y-2">
                  {leaderboard.map((u, i) => (
                    <div key={i} className="flex items-center justify-between p-3 glass rounded-xl border border-white/4">
                      <div className="flex items-center gap-2.5">
                        <span className="text-sm font-black text-slate-600 w-5">{i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i+1}`}</span>
                        <span className="font-bold text-sm text-white">{u.name}</span>
                      </div>
                      <span className="text-amber-400 font-black text-sm">{u.totalScore}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Main Stage */}
          <div className="lg:col-span-6 flex flex-col gap-6">
            <motion.div layout className="glass-dark rounded-[2.5rem] p-8 min-h-[500px] flex flex-col items-center justify-center relative border border-white/6 shadow-2xl card-glow-emerald">
              {room.status === 'waiting' ? (
                <div className="text-center space-y-8 w-full max-w-md">
                    <div className={`w-36 h-36 mx-auto rounded-full ${theme.lightBg} flex items-center justify-center relative`}>
                      <div className={`absolute inset-0 rounded-full border border-[${THEME_GLOWS[room?.theme?.color || 'emerald']}] animate-ping opacity-20`} />
                      <Users className={`w-16 h-16 ${theme.text} relative z-10`} />
                    </div>
                    <div className="space-y-3">
                      <h2 className="text-4xl md:text-5xl font-black tracking-tight text-white drop-shadow-lg">المجلس منعقد</h2>
                      <p className="text-slate-400 text-lg">بانتظار اكتمال استعداد القراء للبدء</p>
                    </div>
                    
                    <div className="flex items-center gap-4 justify-center py-6">
                       <div className="flex items-center gap-2">
                          <span className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse"></span>
                          <span className="font-bold text-sm">{activeUsers.filter(u => u.isReady).length} مستعد</span>
                       </div>
                       <div className="flex items-center gap-2">
                          <span className="w-3 h-3 rounded-full bg-white/10"></span>
                          <span className="font-bold text-sm text-slate-400">{activeUsers.length} متصل</span>
                       </div>
                    </div>

                    {isHost && (
                       <div className="space-y-6 pt-6">
                         <div className="flex gap-2 p-1.5 bg-black/40 rounded-2xl mb-4">
                           <button onClick={() => setVerseSelectionMode('random')} className={`flex-1 py-3 rounded-xl text-xs font-bold transition-colors ${verseSelectionMode === 'random' ? 'bg-emerald-500 text-white' : 'text-slate-500 hover:text-white'}`}>اختيار آلي</button>
                           <button onClick={() => setVerseSelectionMode('manual')} className={`flex-1 py-3 rounded-xl text-xs font-bold transition-colors ${verseSelectionMode === 'manual' ? 'bg-emerald-500 text-white' : 'text-slate-500 hover:text-white'}`}>تحديد يدوي</button>
                         </div>
                         
                         {verseSelectionMode === 'manual' && (
                           <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} className="flex gap-4 mb-6">
                             <div className="flex-1 space-y-2 text-right">
                               <label className="text-xs font-bold text-slate-400">رقم السورة</label>
                               <input type="number" min="1" max="114" value={manualSurah} onChange={e => setManualSurah(Number(e.target.value))} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-center focus:border-emerald-500 outline-none" />
                             </div>
                             <div className="flex-1 space-y-2 text-right">
                               <label className="text-xs font-bold text-slate-400">رقم الآية</label>
                               <input type="number" min="1" max="286" value={manualAyah} onChange={e => setManualAyah(Number(e.target.value))} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-center focus:border-emerald-500 outline-none" />
                             </div>
                           </motion.div>
                         )}
                         
                         <button onClick={startNewRound} disabled={isStartingRound} className="w-full py-6 rounded-[2rem] bg-emerald-600 text-white font-black text-2xl shadow-[0_10px_30px_rgba(16,185,129,0.3)] hover:shadow-[0_15px_40px_rgba(16,185,129,0.5)] hover:-translate-y-1 transition-all disabled:opacity-50">
                           {isStartingRound ? <Loader2 className="w-6 h-6 animate-spin mx-auto" /> : 'إطلاق الجولة'}
                         </button>
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

                   <div className="pt-6 flex flex-col items-center w-full">
                     {round.status === 'countdown' && (
                       <motion.div initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="flex flex-col items-center justify-center gap-6">
                         <div className="text-9xl font-black text-transparent bg-clip-text bg-gradient-to-b from-emerald-300 to-emerald-600 drop-shadow-[0_0_30px_rgba(52,211,153,0.5)] animate-pulse">{localCountdown}</div>
                         <p className="text-xl font-bold text-emerald-400/80 animate-bounce">استعد للتلاوة...</p>
                       </motion.div>
                     )}
                     {round.status === 'recording' && (
                       <div className="w-full max-w-xl mx-auto flex flex-col items-center gap-8">
                         {!round.activeRecorderId ? (
                           <button onClick={claimRecording} className="group relative w-full overflow-hidden rounded-[2.5rem] p-[2px]">
                             <span className="absolute inset-0 bg-gradient-to-r from-emerald-400 via-emerald-600 to-emerald-400 rounded-[2.5rem] opacity-70 group-hover:opacity-100 transition-opacity animate-shimmer" />
                             <div className="relative bg-[#020617]/90 backdrop-blur-xl rounded-[2.5rem] px-12 py-10 flex flex-col items-center justify-center gap-6 transition-all group-hover:bg-[#020617]/70">
                               <div className="w-24 h-24 rounded-full bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20 group-hover:scale-110 transition-transform duration-500 group-hover:bg-emerald-500/20">
                                 <Mic className="w-12 h-12 text-emerald-400 drop-shadow-[0_0_15px_rgba(52,211,153,0.5)]" />
                               </div>
                               <span className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-emerald-200 to-emerald-500 group-hover:from-white group-hover:to-emerald-200 transition-all">ابدأ التلاوة</span>
                             </div>
                           </button>
                         ) : (
                           <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="w-full space-y-8">
                             <div className="flex items-center gap-6 justify-center">
                               <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${round.activeRecorderId}`} className="w-20 h-20 rounded-2xl border-2 border-emerald-500" alt="" />
                               <div className="text-right"><p className="text-emerald-400 text-xs font-bold">يتلو الآن</p><h4 className="text-2xl font-black">{activeUsers.find(u => u.uid === round.activeRecorderId)?.name || 'قارئ'}</h4></div>
                             </div>
                             {round.activeRecorderId === user.uid && (
                               <div className="space-y-8 w-full">
                                 <div className="text-5xl font-mono font-black text-amber-500 animate-pulse">{Math.floor(recordingTime/60)}:{(recordingTime%60).toString().padStart(2,'0')}</div>
                                 <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
                                   <div className="h-full bg-emerald-500 transition-all duration-1000 ease-linear" style={{ width: `${(recordingTime / (room.recordingDuration || 60)) * 100}%` }}></div>
                                 </div>
                                 <canvas ref={canvasRef} width="600" height="150" className="w-full h-24 bg-black/20 rounded-2xl border border-white/5"></canvas>
                                 <button onClick={stopRecording} className="px-12 py-5 rounded-3xl bg-rose-600 font-black text-xl flex items-center justify-center gap-3 w-full shadow-[0_10px_30px_rgba(225,29,72,0.3)] hover:scale-105 transition-all"><Square className="fill-current" /> إنهاء التلاوة</button>
                               </div>
                             )}
                           </motion.div>
                         )}
                       </div>
                     )}
                     {round.status === 'reviewing' && (
                       <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-8 glass-dark p-10 rounded-[2.5rem] border border-white/10 relative overflow-hidden mt-6 w-full max-w-lg mx-auto">
                         <div className="absolute inset-0 bg-amber-500/5 pointer-events-none" />
                         <Star className="w-20 h-20 text-amber-400 mx-auto drop-shadow-[0_0_20px_rgba(251,191,36,0.6)] animate-pulse" />
                         <div className="space-y-2">
                           <h3 className="text-4xl font-black text-white drop-shadow-md pb-2">مرحلة التقييم</h3>
                           <p className="text-slate-400">استمع للتلاوات وقيمها بعناية وعدل</p>
                         </div>
                         {isHost && <button onClick={finishRound} className="w-full py-5 bg-gradient-to-r from-emerald-500 to-emerald-600 rounded-2xl font-black text-xl hover:scale-[1.02] shadow-[0_10px_30px_rgba(16,185,129,0.3)] transition-all">تثبيت النتائج وإعلان الفائز</button>}
                       </motion.div>
                     )}
                     {round.status === 'finished' && (
                       <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="space-y-10 glass p-12 rounded-[3rem] border border-emerald-500/20 shadow-[0_0_60px_rgba(16,185,129,0.15)] mt-6 w-full max-w-lg mx-auto">
                         <Trophy className="w-24 h-24 text-amber-400 mx-auto drop-shadow-[0_0_30px_rgba(251,191,36,0.6)] animate-bounce" />
                         <div className="space-y-3">
                           <h2 className="text-5xl font-black text-transparent bg-clip-text bg-gradient-to-b from-white to-slate-400">انتهت الجولة</h2>
                           <p className="text-emerald-400 font-bold">بارك الله في جميع القراء</p>
                         </div>
                         {isHost && <button onClick={startNewRound} className="w-full py-5 bg-emerald-600 rounded-[2rem] font-black text-xl shadow-[0_10px_30px_rgba(16,185,129,0.3)] hover:shadow-[0_15px_40px_rgba(16,185,129,0.5)] hover:-translate-y-1 transition-all">بدء جولة جديدة</button>}
                       </motion.div>
                     )}
                   </div>
                </div>
              ) : <Loader2 className="w-12 h-12 animate-spin text-slate-500" />}
            </motion.div>
          </div>

          {/* Recordings Feed */}
          <div className="lg:col-span-3 space-y-4 overflow-y-auto no-scrollbar max-h-[calc(100vh-160px)]">
             <div className="flex items-center justify-between px-1">
               <h3 className="text-base font-black text-slate-300 flex items-center gap-2.5">
                 <div className="w-7 h-7 rounded-xl bg-emerald-500/10 border border-emerald-500/15 flex items-center justify-center">
                   <Volume2 className="w-3.5 h-3.5 text-emerald-400" />
                 </div>
                 الأصوات
               </h3>
               <div className="flex glass rounded-xl p-1 border border-white/6">
                 {['time', 'score'].map(s => (
                   <button key={s} onClick={() => setSortBy(s as any)}
                     className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all ${sortBy === s ? 'bg-white/10 text-white' : 'text-slate-600 hover:text-slate-400'}`}
                   >{s === 'time' ? 'الأحدث' : 'التقييم'}</button>
                 ))}
               </div>
             </div>
             
             <AnimatePresence>
               {recordings.map(rec => (
                 <motion.div key={rec.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="glass-dark p-4 rounded-2xl border border-white/6 space-y-3 hover:border-white/10 transition-colors">
                    <div className="flex items-center justify-between">
                       <div className="flex items-center gap-2.5">
                         <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${rec.userId}`} className="w-8 h-8 rounded-xl" alt="" />
                         <span className="text-sm font-bold text-white">{rec.userName}</span>
                       </div>
                       {rec.score !== undefined && (
                         <span className="px-2.5 py-1 bg-amber-500/10 text-amber-400 text-xs font-black rounded-lg border border-amber-500/15">{rec.score}</span>
                       )}
                    </div>
                    <Waveform audioUrl={rec.audioData} />
                    <div className="flex items-center justify-between">
                       <button
                         onClick={() => handleLike(rec)}
                         className={`flex items-center gap-1.5 text-xs font-bold transition-colors ${
                           rec.likes?.includes(user?.uid) ? 'text-rose-400' : 'text-slate-600 hover:text-slate-400'
                         }`}
                       >
                         <Heart className={`w-3.5 h-3.5 ${rec.likes?.includes(user?.uid) ? 'fill-current' : ''}`} />
                         {rec.likes?.length || 0}
                       </button>
                       {isHost && round?.status === 'reviewing' && (
                         <div className="flex items-center gap-0.5">
                           {[1,2,3,4,5].map(i => (
                             <button key={i} onClick={() => handleScore(rec, i*20)}
                               className={`p-0.5 transition-transform hover:scale-125 ${ (rec.score || 0) >= i*20 ? 'text-amber-400' : 'text-slate-700 hover:text-slate-500' }`}
                             >
                               <Star className={`w-3.5 h-3.5 ${ (rec.score || 0) >= i*20 ? 'fill-current drop-shadow-[0_0_4px_rgba(251,191,36,0.5)]' : '' }`} />
                             </button>
                           ))}
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
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="bg-slate-900 border border-white/10 rounded-[3rem] p-10 max-w-lg w-full shadow-2xl space-y-8">
               <div className="flex justify-between items-center"><h2 className="text-3xl font-black">الإعدادات</h2><button onClick={() => setIsSettingsOpen(false)}><X /></button></div>
               <div className="space-y-6">
                 <div>
                   <p className="text-sm font-bold mb-4">صدى المسجد</p>
                   <button onClick={() => setEchoEnabled(!echoEnabled)} className={`w-full py-4 rounded-2xl flex items-center justify-center gap-3 transition-all ${echoEnabled ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40' : 'bg-white/5 border border-white/10 text-slate-500'}`}>
                     {echoEnabled ? <Volume2 /> : <Mic />} {echoEnabled ? 'مفعل' : 'معطل'}
                   </button>
                 </div>
                 <div>
                   <p className="text-sm font-bold mb-4">لون السمة</p>
                   <div className="flex gap-4">{['emerald', 'blue', 'purple', 'rose'].map(c => <button key={c} onClick={() => setEditThemeColor(c)} className={`w-10 h-10 rounded-full ${c === 'emerald' ? 'bg-emerald-500' : c === 'blue' ? 'bg-blue-500' : c === 'purple' ? 'bg-purple-500' : 'bg-rose-500'} ${editThemeColor === c ? 'ring-4 ring-white' : ''}`} />)}</div>
                 </div>
               </div>
               <button onClick={saveSettings} className="w-full py-5 rounded-2xl bg-emerald-600 font-black text-xl hover:bg-emerald-500 transition-colors">حفظ</button>
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
