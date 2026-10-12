'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { AlertTriangle } from 'lucide-react';

export interface StoreConflictDialogProps {
  isOpen: boolean;
  currentStoreName?: string | null;
  incomingStoreName?: string | null;
  onCancel: () => void;
  onConfirm: () => void;
}

export default function StoreConflictDialog({
  isOpen,
  currentStoreName,
  incomingStoreName,
  onCancel,
  onConfirm,
}: StoreConflictDialogProps) {
  const currentStoreLabel = currentStoreName || 'otra tienda';
  const incomingStoreLabel = incomingStoreName || 'esta tienda';

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="store-conflict-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[70] flex items-center justify-center bg-black/85 px-4 backdrop-blur-sm"
        >
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 12 }}
          className="w-full max-w-md rounded-2xl border border-white/10 bg-gray-950 p-6 shadow-2xl"
          role="alertdialog"
          aria-modal="true"
          aria-labelledby="store-conflict-title"
          aria-describedby="store-conflict-description"
        >
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-amber-500/10 text-amber-300">
            <AlertTriangle size={22} />
          </div>

          <h2 id="store-conflict-title" className="text-xl font-bold text-white">
            Cambiar de tienda
          </h2>

          <p id="store-conflict-description" className="mt-3 text-sm leading-relaxed text-gray-300">
            Tu carrito ya tiene productos de <span className="font-semibold text-white">{currentStoreLabel}</span>.
            Si continúas con <span className="font-semibold text-white">{incomingStoreLabel}</span>, vaciaremos el
            carrito actual para agregar el nuevo producto.
          </p>

          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={onCancel}
              className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-white/10"
            >
              Cancelar
            </button>

            <button
              type="button"
              onClick={onConfirm}
              className="rounded-xl bg-accent px-4 py-3 text-sm font-bold text-black transition-opacity hover:opacity-90"
            >
              Vaciar y continuar
            </button>
          </div>
        </motion.div>
      </motion.div>
      )}
    </AnimatePresence>
  );
}
