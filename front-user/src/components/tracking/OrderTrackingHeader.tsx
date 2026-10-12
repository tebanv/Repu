'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Copy, Check, Clock, Radio } from 'lucide-react';
import type { OrderStatus } from '@/types';

export interface OrderTrackingHeaderProps {
  orderId: string;
  storeName: string;
  status: OrderStatus;
  estimatedMinutes?: number;
}

const STATUS_CONFIG: Record<
  OrderStatus,
  { label: string; bg: string; border: string; text: string; dot: string }
> = {
  CREADO: {
    label: 'Pedido Registrado',
    bg: 'bg-blue-500/10',
    border: 'border-blue-500/30',
    text: 'text-blue-400',
    dot: 'bg-blue-400',
  },
  PAGADO: {
    label: 'Pago Confirmado',
    bg: 'bg-emerald-500/10',
    border: 'border-emerald-500/30',
    text: 'text-emerald-400',
    dot: 'bg-emerald-400',
  },
  ACEPTADO: {
    label: 'Aceptado por Tienda',
    bg: 'bg-cyan-500/10',
    border: 'border-cyan-500/30',
    text: 'text-cyan-400',
    dot: 'bg-cyan-400',
  },
  PREPARANDO: {
    label: 'Alistando Repuestos',
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/30',
    text: 'text-amber-400',
    dot: 'bg-amber-400',
  },
  LISTO: {
    label: 'Listo en Bodega',
    bg: 'bg-cyan-500/10',
    border: 'border-cyan-500/30',
    text: 'text-cyan-400',
    dot: 'bg-cyan-400',
  },
  RECOGIDO: {
    label: 'Repartidor en Tienda',
    bg: 'bg-purple-500/10',
    border: 'border-purple-500/30',
    text: 'text-purple-400',
    dot: 'bg-purple-400',
  },
  EN_CAMINO: {
    label: 'En Camino a tu Ubicación',
    bg: 'bg-cyan-500/15',
    border: 'border-cyan-400/50',
    text: 'text-cyan-300',
    dot: 'bg-cyan-400',
  },
  ENTREGADO: {
    label: 'Entregado y Verificado',
    bg: 'bg-emerald-500/15',
    border: 'border-emerald-500/40',
    text: 'text-emerald-400',
    dot: 'bg-emerald-400',
  },
  CANCELADO: {
    label: 'Pedido Cancelado',
    bg: 'bg-rose-500/15',
    border: 'border-rose-500/40',
    text: 'text-rose-400',
    dot: 'bg-rose-400',
  },
};

export default function OrderTrackingHeader({
  orderId,
  storeName,
  status,
  estimatedMinutes = 20,
}: OrderTrackingHeaderProps) {
  const [copied, setCopied] = useState(false);
  const statusCfg = STATUS_CONFIG[status] || STATUS_CONFIG.CREADO;

  const handleCopyId = async () => {
    try {
      await navigator.clipboard.writeText(orderId);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Ignore clipboard fallback
    }
  };

  return (
    <header className="sticky top-0 z-30 bg-gray-950/80 backdrop-blur-md border-b border-white/10 px-4 py-3">
      <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
        {/* Lado izquierdo: Botón volver + Info de orden */}
        <div className="flex items-center gap-3 min-w-0">
          <Link
            href="/"
            className="w-9 h-9 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-gray-300 hover:text-white hover:bg-white/10 hover:border-white/20 transition-all flex-shrink-0"
            aria-label="Volver al inicio"
          >
            <ArrowLeft size={18} />
          </Link>

          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-mono text-xs sm:text-sm font-bold text-white tracking-wider truncate">
                {orderId}
              </span>
              <button
                type="button"
                onClick={handleCopyId}
                className="text-gray-400 hover:text-cyan-400 transition-colors p-0.5 rounded cursor-pointer"
                title="Copiar ID de pedido"
              >
                {copied ? (
                  <Check size={14} className="text-emerald-400" />
                ) : (
                  <Copy size={14} />
                )}
              </button>
            </div>
            <p className="text-[11px] text-gray-400 truncate">
              Tienda: <strong className="text-gray-200">{storeName}</strong>
            </p>
          </div>
        </div>

        {/* Lado derecho: Estado en vivo + ETA */}
        <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
          {status !== 'ENTREGADO' && status !== 'CANCELADO' && (
            <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-black/40 border border-white/10 text-xs text-gray-300">
              <Clock size={13} className="text-cyan-400" />
              <span>
                ETA: <strong className="text-white">{estimatedMinutes} min</strong>
              </span>
            </div>
          )}

          {/* Badge de Estado en Vivo */}
          <div
            className={`
              flex items-center gap-1.5 px-3 py-1 rounded-full border text-xs font-semibold
              ${statusCfg.bg} ${statusCfg.border} ${statusCfg.text}
              shadow-[0_0_15px_rgba(0,0,0,0.4)]
            `}
          >
            {status === 'EN_CAMINO' ? (
              <Radio size={13} className="animate-pulse text-cyan-400" />
            ) : (
              <span className={`w-2 h-2 rounded-full ${statusCfg.dot} animate-ping`} />
            )}
            <span className="truncate max-w-[130px] sm:max-w-none">
              {statusCfg.label}
            </span>
          </div>
        </div>
      </div>
    </header>
  );
}
