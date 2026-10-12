'use client';

import React, { useState } from 'react';
import { Star, Store, UserCheck, CheckCircle2, MessageSquare, X, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import type { OrderRating } from '@/types';

export interface OrderRatingModalProps {
  isOpen: boolean;
  storeName: string;
  driverName?: string;
  onClose: () => void;
  onSkip?: () => void;
  onSubmitRating: (rating: OrderRating) => void;
}

export default function OrderRatingModal({
  isOpen,
  storeName,
  driverName = 'Carlos Rodríguez',
  onClose,
  onSkip,
  onSubmitRating,
}: OrderRatingModalProps) {
  const [storeStars, setStoreStars] = useState(5);
  const [driverStars, setDriverStars] = useState(5);
  const [comments, setComments] = useState('');
  const [isSubmitted, setIsSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitted(true);

    setTimeout(() => {
      setIsSubmitted(false);
      onSubmitRating({
        storeRating: storeStars,
        driverRating: driverStars,
        comments: comments.trim() || undefined,
        submittedAt: new Date().toISOString(),
      });
    }, 1200);
  };

  const handleSkip = () => {
    if (onSkip) {
      onSkip();
    } else {
      onClose();
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="rating-modal-root"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
        >
          {/* Backdrop blur */}
          <div
            onClick={onClose}
            className="fixed inset-0 bg-black/80 backdrop-blur-md"
          />

          {/* Modal Container */}
          <motion.div
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            transition={{ duration: 0.25 }}
            className="relative w-full max-w-md bg-gradient-to-br from-gray-900 via-gray-900/95 to-gray-950 border border-cyan-500/30 rounded-3xl p-6 shadow-[0_0_50px_rgba(34,211,238,0.2)] z-10"
          >
            {/* Botón cerrar */}
            <button
              type="button"
              onClick={onClose}
              className="absolute top-4 right-4 text-gray-400 hover:text-white p-1 rounded-lg hover:bg-white/5 transition-colors cursor-pointer"
              aria-label="Cerrar modal"
            >
              <X size={18} />
            </button>

            {isSubmitted ? (
              <div className="py-8 text-center space-y-3">
                <div className="w-16 h-16 rounded-full bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center mx-auto text-emerald-400 shadow-[0_0_25px_rgba(16,185,129,0.4)]">
                  <CheckCircle2 size={36} />
                </div>
                <h3 className="text-xl font-bold text-white">¡Muchas Gracias!</h3>
                <p className="text-gray-400 text-xs">
                  Tu calificación nos ayuda a mantener la mejor calidad en repuestos y logística.
                </p>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-5">
                {/* Header */}
                <div className="text-center">
                  <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center mx-auto mb-2 text-cyan-400">
                    <Sparkles size={22} />
                  </div>
                  <h3 className="text-lg font-bold text-white tracking-tight">
                    ¿Cómo fue tu experiencia?
                  </h3>
                  <p className="text-xs text-gray-400 mt-0.5">
                    Tus repuestos ya fueron entregados. Califica el servicio:
                  </p>
                </div>

                {/* Calificación de la Tienda de Repuestos */}
                <div className="p-3.5 rounded-2xl bg-black/40 border border-white/5 space-y-2">
                  <div className="flex items-center gap-2">
                    <Store size={16} className="text-cyan-400" />
                    <div>
                      <span className="text-xs font-bold text-white block">
                        {storeName}
                      </span>
                      <span className="text-[10px] text-gray-400">
                        Calidad de repuestos y empaque
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-center gap-2 pt-1">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        type="button"
                        onClick={() => setStoreStars(star)}
                        className="p-1 transition-transform hover:scale-125 cursor-pointer"
                      >
                        <Star
                          size={24}
                          className={`transition-colors ${
                            star <= storeStars
                              ? 'fill-amber-400 text-amber-400 drop-shadow-[0_0_8px_rgba(251,191,36,0.5)]'
                              : 'text-gray-600'
                          }`}
                        />
                      </button>
                    ))}
                  </div>
                </div>

                {/* Calificación del Domiciliario */}
                <div className="p-3.5 rounded-2xl bg-black/40 border border-white/5 space-y-2">
                  <div className="flex items-center gap-2">
                    <UserCheck size={16} className="text-emerald-400" />
                    <div>
                      <span className="text-xs font-bold text-white block">
                        {driverName}
                      </span>
                      <span className="text-[10px] text-gray-400">
                        Puntualidad y entrega segura
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-center gap-2 pt-1">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        type="button"
                        onClick={() => setDriverStars(star)}
                        className="p-1 transition-transform hover:scale-125 cursor-pointer"
                      >
                        <Star
                          size={24}
                          className={`transition-colors ${
                            star <= driverStars
                              ? 'fill-amber-400 text-amber-400 drop-shadow-[0_0_8px_rgba(251,191,36,0.5)]'
                              : 'text-gray-600'
                          }`}
                        />
                      </button>
                    ))}
                  </div>
                </div>

                {/* Comentarios opcionales */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-semibold text-gray-400 flex items-center gap-1.5">
                    <MessageSquare size={13} />
                    <span>Comentarios adicionales (opcional)</span>
                  </label>
                  <textarea
                    value={comments}
                    onChange={(e) => setComments(e.target.value)}
                    rows={2}
                    placeholder="¿Los repuestos llegaron en perfecto estado? Déjanos saber..."
                    className="w-full bg-black/40 border border-white/10 rounded-xl p-2.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 transition-all resize-none"
                  />
                </div>

                {/* Botones de acción */}
                <div className="flex gap-2.5 pt-1">
                  <button
                    type="button"
                    onClick={handleSkip}
                    className="flex-1 py-2.5 px-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 text-xs font-semibold transition-colors cursor-pointer"
                  >
                    Omitir
                  </button>

                  <button
                    type="submit"
                    className="flex-1 py-2.5 px-3 rounded-xl bg-gradient-to-r from-cyan-400 to-blue-500 hover:from-cyan-300 hover:to-blue-400 text-black text-xs font-bold shadow-[0_0_20px_rgba(34,211,238,0.3)] transition-all cursor-pointer"
                  >
                    Enviar Calificación
                  </button>
                </div>
              </form>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
