import React, { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { Star, X } from 'lucide-react';
import confetti from 'canvas-confetti';

interface RatingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (rating: number) => void;
}

const RATING_LABELS: Record<number, { text: string; color: string; emoji: string }> = {
  0: { text: 'اختر تقييمك', color: 'text-slate-600', emoji: '✨' },
  1: { text: 'ضعيف', color: 'text-rose-400', emoji: '😔' },
  2: { text: 'مقبول', color: 'text-orange-400', emoji: '🙂' },
  3: { text: 'جيد', color: 'text-yellow-400', emoji: '😊' },
  4: { text: 'جيد جداً', color: 'text-emerald-400', emoji: '😍' },
  5: { text: 'ممتاز', color: 'text-amber-300', emoji: '🌟' },
};

export default function RatingModal({ isOpen, onClose, onSubmit }: RatingModalProps) {
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);

  const active = hover || rating;
  const label = RATING_LABELS[active] ?? RATING_LABELS[0];

  const handleSubmit = () => {
    if (rating === 0) return;
    if (rating >= 4) {
      confetti({
        particleCount: 120,
        spread: 80,
        origin: { y: 0.6 },
        colors: ['#10b981', '#34d399', '#fbbf24', '#ffffff'],
        disableForReducedMotion: true,
      });
    }
    onSubmit(rating);
    setRating(0);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[150] flex items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="absolute inset-0 bg-black/80 backdrop-blur-xl"
          onClick={onClose}
        />

        {/* Modal */}
        <motion.div
          initial={{ opacity: 0, scale: 0.85, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.88, y: 10 }}
          transition={{ type: 'spring', stiffness: 300, damping: 30 }}
          className="relative glass-premium rounded-[2.5rem] p-8 max-w-sm w-full text-center shadow-[0_40px_80px_rgba(0,0,0,0.8)]"
        >
          {/* Top accent */}
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-amber-400/40 to-transparent rounded-t-[2.5rem]" />

          {/* Close */}
          <button
            onClick={onClose}
            className="absolute top-5 left-5 p-2 hover:bg-white/8 rounded-xl transition-all text-slate-500 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>

          {/* Emoji */}
          <motion.div
            key={active}
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="text-4xl mb-4 mt-2"
          >
            {label.emoji}
          </motion.div>

          <h2 className="text-2xl font-black text-white mb-1 font-ruqaa">قيّم التلاوة</h2>
          <p className={`text-sm font-bold mb-7 min-h-[20px] transition-colors duration-200 ${label.color}`}>
            {label.text}
          </p>

          {/* Stars */}
          <div className="flex justify-center gap-3 mb-8">
            {[1, 2, 3, 4, 5].map((star) => {
              const isActive = star <= active;
              return (
                <motion.button
                  key={star}
                  onClick={() => setRating(star)}
                  onMouseEnter={() => setHover(star)}
                  onMouseLeave={() => setHover(0)}
                  whileHover={{ scale: 1.25, y: -4 }}
                  whileTap={{ scale: 0.9 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 20 }}
                  className="focus:outline-none relative"
                >
                  <Star
                    className={`w-10 h-10 transition-all duration-200 ${
                      isActive
                        ? 'text-amber-400 fill-amber-400 drop-shadow-[0_0_8px_rgba(251,191,36,0.6)]'
                        : 'text-slate-700 hover:text-slate-500'
                    }`}
                  />
                </motion.button>
              );
            })}
          </div>

          {/* Submit */}
          <motion.button
            onClick={handleSubmit}
            disabled={rating === 0}
            whileHover={rating > 0 ? { scale: 1.03, y: -1 } : {}}
            whileTap={rating > 0 ? { scale: 0.97 } : {}}
            className="relative w-full overflow-hidden rounded-2xl py-4 font-black text-white text-lg disabled:opacity-40 shadow-[0_8px_24px_rgba(16,185,129,0.3)] hover:shadow-[0_12px_36px_rgba(16,185,129,0.45)] transition-shadow duration-300 disabled:cursor-not-allowed"
            style={{ background: rating > 0 ? 'linear-gradient(135deg, #059669, #10b981)' : '#1e293b' }}
          >
            {rating > 0 && <div className="absolute inset-0 animate-shimmer opacity-50" />}
            <div className="absolute inset-x-0 top-0 h-px bg-white/20" />
            <span className="relative">إرسال التقييم</span>
          </motion.button>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
