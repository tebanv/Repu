'use client';

import React, { useState } from 'react';
import { Phone, MessageSquare, Star, ShieldCheck, UserCheck, Check } from 'lucide-react';
import { motion } from 'framer-motion';
import type { DriverInfo } from '@/types';

export interface DriverCardProps {
  driver?: DriverInfo | null;
  storeName: string;
}

export default function DriverCard({ driver, storeName }: DriverCardProps) {
  const [showCopiedPhone, setShowCopiedPhone] = useState(false);
  const [chatOpened, setChatOpened] = useState(false);

  if (!driver) return null;

  const handleCall = () => {
    window.location.href = `tel:${driver.phone.replace(/\s+/g, '')}`;
  };

  const handleChat = () => {
    setChatOpened(true);
    setTimeout(() => setChatOpened(false), 3000);
  };

  const handleCopyPhone = () => {
    navigator.clipboard.writeText(driver.phone);
    setShowCopiedPhone(true);
    setTimeout(() => setShowCopiedPhone(false), 2000);
  };

  return (
    <div className="bg-gradient-to-br from-gray-900 via-gray-900/90 to-gray-950 border border-white/10 rounded-2xl p-5 shadow-xl">
      <div className="flex items-center justify-between gap-3 mb-4">
        <div className="flex items-center gap-3">
          {/* Avatar con aura cian */}
          <div className="relative w-12 h-12 rounded-2xl bg-gradient-to-br from-cyan-400 to-blue-600 p-0.5 shadow-[0_0_15px_rgba(34,211,238,0.3)] flex-shrink-0">
            <div className="w-full h-full rounded-[14px] bg-gray-900 flex items-center justify-center text-cyan-300 font-bold text-base">
              {driver.name
                .split(' ')
                .map((n) => n[0])
                .slice(0, 2)
                .join('')}
            </div>
            <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-emerald-500 border-2 border-gray-900 flex items-center justify-center text-black">
              <UserCheck size={11} strokeWidth={3} />
            </div>
          </div>

          {/* Info del Conductor */}
          <div>
            <div className="flex items-center gap-2">
              <h4 className="text-sm font-bold text-white tracking-wide">
                {driver.name}
              </h4>
              <div className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-500/10 border border-amber-500/20 text-amber-300 text-[10px] font-bold">
                <Star size={11} className="fill-amber-400 text-amber-400" />
                <span>{driver.rating.toFixed(1)}</span>
              </div>
            </div>
            <p className="text-xs text-gray-400 mt-0.5">
              {driver.vehicleType} · <strong className="text-cyan-400 font-mono">{driver.vehiclePlate}</strong>
            </p>
          </div>
        </div>
      </div>

      {/* Botones de acción rápida */}
      <div className="grid grid-cols-2 gap-2.5">
        <motion.button
          type="button"
          onClick={handleCall}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className="flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 text-cyan-300 text-xs font-semibold transition-all cursor-pointer shadow-[0_0_10px_rgba(34,211,238,0.1)]"
        >
          <Phone size={14} />
          <span>Llamar ({driver.phone})</span>
        </motion.button>

        <motion.button
          type="button"
          onClick={handleChat}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className="flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 text-white text-xs font-semibold transition-all cursor-pointer"
        >
          {chatOpened ? (
            <>
              <Check size={14} className="text-emerald-400" />
              <span className="text-emerald-300">Conectado</span>
            </>
          ) : (
            <>
              <MessageSquare size={14} className="text-gray-300" />
              <span>Mensaje al Repartidor</span>
            </>
          )}
        </motion.button>
      </div>

      {/* Nota de garantía de transporte de repuestos */}
      <div className="mt-3.5 pt-3 border-t border-white/[0.06] flex items-center justify-between text-[11px] text-gray-500">
        <div className="flex items-center gap-1.5">
          <ShieldCheck size={13} className="text-emerald-400" />
          <span>Repartidor certificado para carga segura de autopartes</span>
        </div>
        <button
          type="button"
          onClick={handleCopyPhone}
          className="text-gray-400 hover:text-cyan-400 transition-colors text-[10px] cursor-pointer"
        >
          {showCopiedPhone ? '¡Copiado!' : 'Copiar cel'}
        </button>
      </div>
    </div>
  );
}
