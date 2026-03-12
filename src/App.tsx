import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { onAuthStateChanged, auth } from './firebase';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import RoomView from './pages/RoomView';
import { ToastProvider } from './components/Toast';

export default function App() {
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser: any) => {
      setUser(currentUser);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#020617] flex items-center justify-center relative overflow-hidden">
        {/* Background Decor */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[60vmin] h-[60vmin] bg-emerald-600/10 blur-[150px] rounded-full animate-pulse-glow" />
        
        <div className="text-center space-y-6 relative z-10">
          <div className="relative">
            <div className="w-20 h-20 border-2 border-emerald-500/20 border-t-emerald-400 rounded-full animate-spin mx-auto" />
            <div className="absolute inset-0 w-20 h-20 mx-auto bg-emerald-500/10 rounded-full blur-xl" />
          </div>
          <h1 className="text-2xl font-black font-ruqaa text-gradient-emerald">تلاوة</h1>
          <p className="text-slate-500 text-xs font-bold uppercase tracking-[0.3em]">Noble Sessions</p>
        </div>
      </div>
    );
  }

  return (
    <ToastProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={user ? <Navigate to="/dashboard" /> : <Login />} />
          <Route path="/dashboard" element={user ? <Dashboard user={user} /> : <Navigate to="/" />} />
          <Route path="/room/:roomId" element={user ? <RoomView user={user} /> : <Navigate to="/" />} />
        </Routes>
      </BrowserRouter>
    </ToastProvider>
  );
}
