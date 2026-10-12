'use client';

/**
 * StoreCard: Tarjeta holográfica para mostrar información de una tienda.
 * Diseño futurista con capas de efectos visuales:
 * - Ruido estático de fondo
 * - Gradiente animado rotando
 * - Glassmorphism con backdrop-blur
 * - Borde luminoso animado
 *
 * Props:
 * - store: objeto con datos de la tienda
 * - onNavigate: callback al presionar el botón de acción
 * - onBack: callback para volver a la lista (solo desktop)
 * - showBackButton: mostrar botón de volver (default: false)
 */

import { motion } from 'framer-motion';
import { Store as StoreIcon, Star, ChevronRight, ArrowLeft } from 'lucide-react';

import type { Store, StoreCategory } from '@/types';

const CATEGORY_LABELS: Record<StoreCategory, string> = {
  battery: 'Baterías',
  tire: 'Llantas',
  spare: 'Repuestos',
  shop: 'Tienda',
};

export interface StoreCardProps {
  store: Store | null;
  onNavigate?: (store: Store) => void;
  onBack?: () => void;
  showBackButton?: boolean;
}

export default function StoreCard({
  store,
  onNavigate,
  onBack,
  showBackButton = false,
}: StoreCardProps) {
  if (!store) return null;

  const categoryText =
    store.categories
      ?.map((cat) => CATEGORY_LABELS[cat])
      .filter(Boolean)
      .join(' • ') || 'Tienda';

  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 10, scale: 0.98 }}
      transition={{ duration: 0.4, ease: [0.23, 1, 0.32, 1] }}
      className="holo-card group relative w-full h-full rounded-xl overflow-hidden"
    >
      {/* CAPA 1: Ruido estático */}
      <div className="absolute inset-0 holo-noise opacity-[0.03]" />

      {/* CAPA 2: Gradiente animado de fondo */}
      <div className="absolute inset-0 holo-gradient opacity-30" />

      {/* CAPA 3: Glassmorphism base */}
      <div className="absolute inset-0 backdrop-blur-xl bg-black/40" />

      {/* CAPA 4: Borde luminoso animado */}
      <div className="absolute inset-0 rounded-xl holo-border" />

      {/* CAPA 5: Contenido */}
      <div className="relative z-10 h-full flex flex-col p-4">
        {/* Botón volver (solo en desktop cuando showBackButton=true) */}
        {showBackButton && onBack && (
          <motion.button
            onClick={onBack}
            whileHover={{ x: -2 }}
            whileTap={{ scale: 0.95 }}
            className="flex items-center gap-1.5 text-gray-400 hover:text-white text-xs mb-3 w-fit transition-colors"
          >
            <ArrowLeft size={14} />
            <span>Volver a la lista</span>
          </motion.button>
        )}

        {/* Header: Icono + Info + Rating */}
        <div className="flex items-start gap-3 mb-auto">
          {/* Icono de categoría con glow */}
          <div className="relative flex-shrink-0">
            <div className="absolute inset-0 bg-accent/40 blur-lg rounded-lg" />
            <div className="relative w-11 h-11 rounded-lg bg-accent/20 border border-accent/50 flex items-center justify-center">
              <StoreIcon size={20} className="text-accent" strokeWidth={2} />
            </div>
          </div>

          {/* Nombre y categorías */}
          <div className="flex-1 min-w-0 pt-0.5">
            <h3 className="font-bold text-white text-sm leading-tight truncate drop-shadow-[0_0_10px_rgba(255,255,255,0.3)]">
              {store.name}
            </h3>
            <p className="text-xs text-gray-400 mt-0.5 truncate">
              {categoryText}
            </p>
          </div>

          {/* Rating */}
          <div className="flex items-center gap-1 flex-shrink-0 bg-black/30 px-2 py-1 rounded-md">
            <Star size={12} className="text-yellow-400 fill-yellow-400" />
            <span className="text-yellow-400 text-xs font-semibold">
              {store.rating?.toFixed(1) || '—'}
            </span>
          </div>
        </div>

        {/* Ciudad (opcional) */}
        {store.city && (
          <p className="text-xs text-gray-500 mb-3">
            📍 {store.city}
          </p>
        )}

        {/* Botón de acción holográfico */}
        <motion.button
          onClick={() => onNavigate?.(store)}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className="
            relative w-full py-2.5 rounded-lg overflow-hidden
            bg-gradient-to-r from-accent/80 via-accent to-accent/80
            text-black font-bold text-sm
            flex items-center justify-center gap-2
            transition-all duration-300
            hover:shadow-[0_0_25px_var(--color-accent),0_0_50px_var(--color-accent-dim)]
            focus:outline-none focus:ring-2 focus:ring-accent/50
            group/btn
          "
        >
          {/* Shimmer effect en hover */}
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent -translate-x-full group-hover/btn:translate-x-full transition-transform duration-700" />

          <span className="relative z-10">Ir a la tienda</span>
          <ChevronRight size={16} className="relative z-10 group-hover/btn:translate-x-1 transition-transform" />
        </motion.button>
      </div>

      {/* Scanlines sutiles (efecto CRT) */}
      <div className="absolute inset-0 pointer-events-none holo-scanlines opacity-[0.02]" />
    </motion.div>
  );
}
