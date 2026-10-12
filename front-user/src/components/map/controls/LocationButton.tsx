'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Crosshair } from 'lucide-react';

export interface LocationButtonProps {
  onClick?: () => void;
  isLocating?: boolean;
}

export default function LocationButton({ onClick, isLocating = false }: LocationButtonProps) {
  const [isZap, setIsZap] = useState(false);

  const handleClick = () => {
    if (isLocating) return;

    // 1. Activamos el efecto eléctrico
    setIsZap(true);

    // 2. Ejecutamos la acción
    if (onClick) onClick();

    // 3. Apagamos el efecto al segundo
    setTimeout(() => setIsZap(false), 1000);
  };

  return (
    <motion.button
      onClick={handleClick}
      disabled={isLocating}
      whileHover={{ scale: 1.1 }}
      whileTap={{ scale: 0.95 }}
      // Animación de 'Vibración Eléctrica'
      animate={
        isZap
          ? {
              x: [0, -2, 2, -1, 1, 0],
              borderColor: ['rgba(217,70,239,0.5)', '#ffffff', 'rgba(217,70,239,0.5)'],
              boxShadow: [
                '0 0 20px rgba(217,70,239,0.2)',
                '0 0 40px rgba(217,70,239,0.9)',
                '0 0 20px rgba(217,70,239,0.2)',
              ],
            }
          : {}
      }
      transition={{ duration: 0.2 }}
      className="
        absolute bottom-6 right-4 z-20 
        bg-black/80 backdrop-blur-sm
        border border-fuchsia-500/50 
        text-fuchsia-400
        rounded-xl p-3 
        shadow-[0_0_20px_rgba(217,70,239,0.2)]
        hover:border-fuchsia-400 hover:shadow-[0_0_25px_rgba(217,70,239,0.4)] hover:text-fuchsia-300
        disabled:opacity-50 disabled:cursor-not-allowed 
        transition-colors duration-300
      "
      aria-label="Centrar en mi ubicación"
    >
      {/* EFECTO DE ONDA EXPANSIVA (RIPPLE) */}
      <AnimatePresence>
        {isZap && (
          <motion.div
            className="absolute inset-0 rounded-xl border border-fuchsia-400"
            initial={{ scale: 1, opacity: 0.8 }}
            animate={{ scale: 1.8, opacity: 0 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1, ease: 'easeOut' }}
          />
        )}
      </AnimatePresence>

      {/* ICONO ESTÁTICO */}
      <Crosshair
        className={`w-6 h-6 ${isZap ? 'text-white' : ''} transition-colors duration-100`}
        strokeWidth={2.5}
      />

      <span className="sr-only">Centrar en mi ubicación</span>
    </motion.button>
  );
}
