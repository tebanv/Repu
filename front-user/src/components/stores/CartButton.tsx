'use client';

/**
 * CartButton: CTA flotante conectado al resumen reactivo del carrito.
 */

import { motion, AnimatePresence } from 'framer-motion';
import { ShoppingCart } from 'lucide-react';
import { useCartSummary } from '@/store/cartStore';

export interface CartButtonProps {
  onClick?: () => void;
}

export default function CartButton({ onClick }: CartButtonProps) {
  const { itemCount, subtotal } = useCartSummary();

  // No mostrar si no hay items
  if (itemCount === 0) return null;

  const formattedTotal = new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(subtotal);

  return (
    <AnimatePresence>
      <div
        className="
          fixed inset-x-0 bottom-0 z-40
          px-4 safe-bottom-pad
          pointer-events-none
        "
      >
        <motion.div
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          className="pointer-events-auto"
        >
          <div className="relative mb-6 overflow-hidden rounded-[1.6rem] border border-white/[0.08] bg-[linear-gradient(180deg,rgba(8,13,24,0.82),rgba(3,7,18,0.96)_26%,rgba(2,6,14,0.99))] p-[0.32rem] shadow-[0_20px_60px_rgba(0,0,0,0.42),inset_0_1px_0_rgba(255,255,255,0.05)]">
            <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-white/[0.07]" />
            <div className="pointer-events-none absolute inset-x-10 -top-4 h-10 rounded-full bg-cyan-300/10 blur-2xl" />

            <div className="relative">
              <div className="pointer-events-none absolute inset-x-8 inset-y-2 rounded-full bg-cyan-300/18 blur-2xl" />

              <motion.button
                whileHover={{ scale: 1.01 }}
                whileTap={{ scale: 0.985 }}
                onClick={onClick}
                aria-label={`Ver carrito con ${itemCount} ${itemCount === 1 ? 'producto' : 'productos'}`}
                className="relative flex w-full items-center justify-between gap-4 rounded-[1.35rem] border border-cyan-200/45 bg-[linear-gradient(135deg,rgba(170,255,255,0.98),rgba(34,211,238,0.96)_48%,rgba(8,145,178,0.92))] px-5 py-4 text-slate-950 shadow-[0_0_0_1px_rgba(255,255,255,0.08),0_18px_44px_rgba(34,211,238,0.22),0_0_24px_rgba(34,211,238,0.12)] transition-transform transition-shadow hover:shadow-[0_0_0_1px_rgba(255,255,255,0.12),0_22px_52px_rgba(34,211,238,0.28),0_0_28px_rgba(34,211,238,0.16)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-100/70 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
              >
                <span className="pointer-events-none absolute inset-x-5 top-0 h-px bg-white/80 opacity-70" />

                <div className="flex min-w-0 items-center gap-3">
                  <div className="relative flex h-12 w-12 items-center justify-center rounded-2xl border border-slate-950/12 bg-slate-950/10 shadow-[inset_0_1px_0_rgba(255,255,255,0.28)]">
                    <ShoppingCart size={22} strokeWidth={2.1} />
                    <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-slate-950 px-1.5 text-[10px] font-semibold text-cyan-300 shadow-[0_0_0_1px_rgba(255,255,255,0.06)]">
                      {itemCount}
                    </span>
                  </div>

                  <div className="min-w-0 text-left">
                    <p className="text-[0.68rem] font-medium uppercase tracking-[0.2em] text-slate-950/62">
                      Tu pedido
                    </p>
                    <p className="truncate text-[1.02rem] font-semibold tracking-[-0.015em] text-slate-950">
                      Ver carrito
                    </p>
                  </div>
                </div>

                <div className="text-right">
                  <p className="text-[0.68rem] font-medium uppercase tracking-[0.18em] text-slate-950/62">
                    Subtotal
                  </p>
                  <span className="text-[1.02rem] font-semibold tracking-[-0.02em] tabular-nums text-slate-950">
                    {formattedTotal}
                  </span>
                </div>
              </motion.button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
