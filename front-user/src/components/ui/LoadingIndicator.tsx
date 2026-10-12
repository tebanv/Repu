// Componente reutilizable para mostrar un indicador de carga
'use client';

import React from 'react';
import { motion, type Variants } from 'framer-motion';
import { Zap } from 'lucide-react';

export interface LoadingIndicatorProps {
  fullScreen?: boolean;
  message?: string;
}

export default function LoadingIndicator({
  fullScreen = false,
  message = 'Cargando...',
}: LoadingIndicatorProps) {
  // Animación de las barras (Onda de frecuencia)
  const barVariants: Variants = {
    initial: { height: '20%', opacity: 0.5 },
    animate: (i: number) => ({
      height: ['20%', '100%', '20%'],
      opacity: [0.5, 1, 0.5],
      transition: {
        repeat: Infinity,
        duration: 0.8,
        ease: 'easeInOut',
        delay: i * 0.1,
      },
    }),
  };

  // Contenido interno modular
  const Content = ({ showText }: { showText: boolean }) => (
    <div className="flex items-center gap-3">
      {/* Icono decorativo */}
      <Zap size={18} className="text-fuchsia-400 fill-fuchsia-500/20 animate-pulse" />

      {/* Mensaje */}
      {showText && (
        <span className="text-fuchsia-100 text-sm font-mono tracking-wider font-bold uppercase drop-shadow-sm">
          {message}
        </span>
      )}

      {/* Onda de 5 barras */}
      <div className="flex items-center gap-[3px] h-5 ml-1">
        {[0, 1, 2, 3, 4].map((i) => (
          <motion.div
            key={i}
            custom={i}
            variants={barVariants}
            initial="initial"
            animate="animate"
            className="w-1 bg-fuchsia-500 rounded-full shadow-[0_0_8px_rgba(217,70,239,0.8)]"
          />
        ))}
      </div>
    </div>
  );

  // --- RENDERIZADO CONDICIONAL ---
  if (fullScreen) {
    return (
      <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/90 backdrop-blur-sm">
        <div className="bg-zinc-900/80 border border-fuchsia-500/30 p-8 rounded-2xl shadow-[0_0_30px_rgba(217,70,239,0.15)]">
          <Content showText={true} />
        </div>
      </div>
    );
  }

  return (
    <div className="absolute top-6 left-1/2 -translate-x-1/2 z-30 pointer-events-none">
      <motion.div
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: -20, opacity: 0 }}
        className="
          px-4 py-2 rounded-full
          bg-black/80 backdrop-blur-md
          border border-fuchsia-500/40
          shadow-[0_0_15px_rgba(217,70,239,0.25)]
          flex items-center justify-center
        "
      >
        <Content showText={false} />
      </motion.div>
    </div>
  );
}
