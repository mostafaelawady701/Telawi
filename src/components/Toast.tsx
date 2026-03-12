import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { AlertCircle, CheckCircle, Info, X } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'info';

export interface ToastMessage {
  id: string;
  message: string;
  type: ToastType;
}

interface ToastContextType {
  addToast: (message: string, type: ToastType) => void;
  removeToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const addToast = useCallback((message: string, type: ToastType) => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, message, type }]);
    
    // Auto remove after 5 seconds
    setTimeout(() => {
      removeToast(id);
    }, 5000);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ addToast, removeToast }}>
      {children}
      <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[200] flex flex-col gap-2 w-full max-w-sm px-4 pointer-events-none">
        <AnimatePresence>
          {toasts.map((toast) => (
             <ToastItem key={toast.id} toast={toast} onRemove={() => removeToast(toast.id)} />
          ))}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

const ToastItem: React.FC<{ toast: ToastMessage; onRemove: () => void }> = ({ toast, onRemove }) => {
  const isError = toast.type === 'error';
  const isSuccess = toast.type === 'success';

  return (
    <motion.div
      initial={{ opacity: 0, y: -20, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
      className={`pointer-events-auto flex items-center gap-3 p-4 rounded-2xl border shadow-[0_20px_40px_rgba(0,0,0,0.5)] backdrop-blur-2xl ${
        isError 
          ? 'bg-[#0f172a]/80 border-rose-500/30 text-rose-200' 
          : isSuccess 
            ? 'glass-premium border-emerald-500/30 text-emerald-100'
            : 'glass-dark border-blue-500/30 text-blue-100'
      } relative overflow-hidden`}
    >
      {/* Subtle glow layer behind the toast */}
      <div className={`absolute -inset-1 opacity-20 blur-md -z-10 ${isError ? 'bg-rose-500' : isSuccess ? 'bg-emerald-500' : 'bg-blue-500'}`} />

      <div className="flex-shrink-0 relative">
        <div className={`absolute inset-0 opacity-40 blur-sm rounded-full ${isError ? 'bg-rose-500' : isSuccess ? 'bg-emerald-500' : 'bg-blue-500'}`} />
        {isError && <AlertCircle className="w-5 h-5 text-rose-400 relative z-10" />}
        {isSuccess && <CheckCircle className="w-5 h-5 text-emerald-400 relative z-10" />}
        {!isError && !isSuccess && <Info className="w-5 h-5 text-blue-400 relative z-10" />}
      </div>
      <p className="flex-1 text-sm font-bold">{toast.message}</p>
      <button 
        onClick={onRemove}
        className="flex-shrink-0 p-1.5 rounded-lg hover:bg-white/10 transition-colors text-white/50 hover:text-white"
      >
        <X className="w-4 h-4" />
      </button>
    </motion.div>
  );
}
