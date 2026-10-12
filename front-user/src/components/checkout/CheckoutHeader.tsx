'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, ShieldCheck } from 'lucide-react';
import { motion } from 'framer-motion';

export interface CheckoutHeaderProps {
  storeName?: string;
}

export default function CheckoutHeader({ storeName }: CheckoutHeaderProps) {
  const router = useRouter();

  return (
    <header className="w-full bg-gray-950/80 backdrop-blur-md border-b border-white/10 sticky top-0 z-30">
      <div className="max-w-5xl mx-auto px-4 h-16 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <motion.button
            type="button"
            onClick={() => router.back()}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="p-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white transition-colors"
            aria-label="Volver atrás"
          >
            <ArrowLeft size={18} />
          </motion.button>

          <div>
            <h1 className="text-base sm:text-lg font-bold text-white leading-tight">
              Finalizar Pedido
            </h1>
            {storeName && (
              <p className="text-xs text-cyan-400 truncate max-w-[200px] sm:max-w-xs">
                {storeName}
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-medium">
          <ShieldCheck size={14} />
          <span className="hidden sm:inline">Compra protegida</span>
        </div>
      </div>
    </header>
  );
}
