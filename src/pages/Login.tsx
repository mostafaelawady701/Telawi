import React, { useState } from 'react';
import { loginWithUsername, loginAnonymously } from '../firebase';
import { BookOpen, LogIn, Users, User } from 'lucide-react';

export default function Login() {
  const [username, setUsername] = useState('');

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (username.trim()) {
      loginWithUsername(username);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white rounded-3xl p-8 border border-slate-200 shadow-2xl">
        <div className="flex flex-col items-center mb-8">
          <div className="w-20 h-20 bg-emerald-100 rounded-2xl flex items-center justify-center mb-4 transition-transform hover:rotate-12">
            <BookOpen className="w-10 h-10 text-emerald-600" />
          </div>
          <h1 className="text-3xl font-bold text-slate-900">مسابقات تلاوة</h1>
          <p className="text-slate-500 text-center mt-2">نظام تلاوة محلي - لا حاجة لحساب جوجل</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium text-slate-700 mr-1">اسم المستخدم</label>
            <div className="relative">
              <User className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input
                type="text"
                placeholder="أدخل اسمك هنا..."
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full pr-12 pl-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
                required
              />
            </div>
          </div>

          <button
            type="submit"
            className="w-full flex items-center justify-center gap-3 bg-emerald-600 text-white py-3.5 px-4 rounded-xl font-bold hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-200"
          >
            <LogIn className="w-5 h-5" />
            دخول للموقع
          </button>

          <div className="relative py-2">
            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-100"></div></div>
            <div className="relative flex justify-center text-xs uppercase"><span className="bg-white px-2 text-slate-400">أو</span></div>
          </div>

          <button
            type="button"
            onClick={() => loginAnonymously()}
            className="w-full flex items-center justify-center gap-3 bg-white text-slate-600 border border-slate-200 py-3 px-4 rounded-xl font-medium hover:bg-slate-50 transition-colors"
          >
            <Users className="w-5 h-5" />
            الدخول كضيف
          </button>
        </form>

        <p className="text-[10px] text-slate-400 text-center mt-8">
          يتم حفظ بياناتك محلياً في هذا المتصفح فقط.
        </p>
      </div>
    </div>
  );
}
