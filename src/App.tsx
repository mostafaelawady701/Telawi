import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { onAuthStateChanged, auth } from './firebase';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import RoomView from './pages/RoomView';

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
    return <div className="min-h-screen bg-slate-50 flex items-center justify-center text-emerald-600">جاري التحميل...</div>;
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={user ? <Navigate to="/dashboard" /> : <Login />} />
        <Route path="/dashboard" element={user ? <Dashboard user={user} /> : <Navigate to="/" />} />
        <Route path="/room/:roomId" element={user ? <RoomView user={user} /> : <Navigate to="/" />} />
      </Routes>
    </BrowserRouter>
  );
}
