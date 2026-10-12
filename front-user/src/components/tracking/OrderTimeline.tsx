'use client';

import React from 'react';
import {
  CreditCard,
  Warehouse,
  PackageCheck,
  Bike,
  CheckCircle2,
  AlertCircle,
  Play,
  FastForward,
} from 'lucide-react';
import { motion } from 'framer-motion';
import type { Order, OrderStatus } from '@/types';

export interface OrderTimelineProps {
  order: Order;
  onAdvanceStatus?: (nextStatus: OrderStatus) => void;
  showDevControls?: boolean;
}

interface StepDefinition {
  status: OrderStatus;
  title: string;
  description: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
}

const TIMELINE_STEPS: StepDefinition[] = [
  {
    status: 'CREADO',
    title: 'Pedido Confirmado',
    description: 'Pago recibido y orden transmitida a la tienda.',
    icon: CreditCard,
  },
  {
    status: 'PREPARANDO',
    title: 'Alistando Repuestos en Bodega',
    description: 'Verificación de referencias, empaque y protección de piezas.',
    icon: Warehouse,
  },
  {
    status: 'RECOGIDO',
    title: 'Repartidor Recogió el Pedido',
    description: 'Piezas cargadas en el vehículo para transporte seguro.',
    icon: PackageCheck,
  },
  {
    status: 'EN_CAMINO',
    title: 'En Ruta a tu Ubicación',
    description: 'El repartidor va en camino a tu domicilio o taller.',
    icon: Bike,
  },
  {
    status: 'ENTREGADO',
    title: 'Entregado y Verificado',
    description: 'Repuestos recibidos e inspeccionados por el cliente.',
    icon: CheckCircle2,
  },
];

const STATUS_PROGRESS_INDEX: Record<OrderStatus, number> = {
  CREADO: 0,
  PAGADO: 0,
  ACEPTADO: 1,
  PREPARANDO: 1,
  LISTO: 2,
  RECOGIDO: 2,
  EN_CAMINO: 3,
  ENTREGADO: 4,
  CANCELADO: -1,
};

const NEXT_STATUS_MAP: Record<OrderStatus, OrderStatus | null> = {
  CREADO: 'PREPARANDO',
  PAGADO: 'PREPARANDO',
  ACEPTADO: 'PREPARANDO',
  PREPARANDO: 'RECOGIDO',
  LISTO: 'RECOGIDO',
  RECOGIDO: 'EN_CAMINO',
  EN_CAMINO: 'ENTREGADO',
  ENTREGADO: null,
  CANCELADO: null,
};

export default function OrderTimeline({
  order,
  onAdvanceStatus,
  showDevControls = true,
}: OrderTimelineProps) {
  const currentStepIndex = STATUS_PROGRESS_INDEX[order.status] ?? 0;
  const isCancelled = order.status === 'CANCELADO';
  const nextStatus = NEXT_STATUS_MAP[order.status];

  // Helper para buscar timestamp de un estado en el historial
  const getTimestampForStatus = (status: OrderStatus): string | undefined => {
    const historyItem = order.stateHistory.find((h) => {
      if (status === 'CREADO') return h.status === 'CREADO' || h.status === 'PAGADO';
      if (status === 'PREPARANDO') return h.status === 'PREPARANDO' || h.status === 'ACEPTADO';
      if (status === 'RECOGIDO') return h.status === 'RECOGIDO' || h.status === 'LISTO';
      return h.status === status;
    });

    if (!historyItem) return undefined;
    try {
      const date = new Date(historyItem.timestamp);
      return date.toLocaleTimeString('es-CO', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true,
      });
    } catch {
      return undefined;
    }
  };

  return (
    <div className="bg-gradient-to-br from-gray-900 via-gray-900/90 to-gray-950 border border-white/10 rounded-2xl p-5 shadow-xl">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-bold text-white tracking-wide">
            Estado de Entrega
          </h3>
          <p className="text-[11px] text-gray-400">
            Seguimiento de la cadena logística de tus autopartes
          </p>
        </div>

        {/* Control interactivo de simulación (Modo demostración) */}
        {showDevControls && nextStatus && onAdvanceStatus && (
          <button
            type="button"
            onClick={() => onAdvanceStatus(nextStatus)}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 text-cyan-300 text-[11px] font-semibold transition-colors cursor-pointer shadow-[0_0_10px_rgba(34,211,238,0.15)]"
            title="Simular avance al siguiente estado"
          >
            <FastForward size={13} />
            <span>Avanzar Estado</span>
          </button>
        )}
      </div>

      {isCancelled ? (
        <div className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-center gap-3 text-rose-300">
          <AlertCircle size={24} className="flex-shrink-0 text-rose-400" />
          <div>
            <h4 className="font-bold text-sm text-rose-200">Pedido Cancelado</h4>
            <p className="text-xs text-rose-300/80 mt-0.5">
              Este pedido fue cancelado. Si tienes dudas, contáctanos a soporte.
            </p>
          </div>
        </div>
      ) : (
        <div className="relative pl-2">
          {TIMELINE_STEPS.map((step, idx) => {
            const isCompleted = idx < currentStepIndex;
            const isCurrent = idx === currentStepIndex;
            const isPending = idx > currentStepIndex;
            const Icon = step.icon;
            const timestamp = getTimestampForStatus(step.status);

            return (
              <div key={step.status} className="relative flex items-start gap-3.5 pb-6 last:pb-1">
                {/* Línea conectora */}
                {idx < TIMELINE_STEPS.length - 1 && (
                  <div className="absolute left-4 top-8 -bottom-1 w-0.5 bg-white/10 overflow-hidden">
                    <motion.div
                      className="w-full bg-gradient-to-b from-cyan-400 to-sky-400"
                      initial={{ height: 0 }}
                      animate={{
                        height: isCompleted ? '100%' : isCurrent ? '50%' : '0%',
                      }}
                      transition={{ duration: 0.4 }}
                    />
                  </div>
                )}

                {/* Ícono de Estado */}
                <div
                  className={`
                    relative z-10 w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 transition-all duration-300
                    ${
                      isCompleted
                        ? 'bg-cyan-500 text-black shadow-[0_0_12px_rgba(34,211,238,0.4)]'
                        : isCurrent
                        ? 'bg-cyan-400 text-black ring-4 ring-cyan-400/20 shadow-[0_0_18px_rgba(34,211,238,0.6)] animate-pulse'
                        : 'bg-white/5 border border-white/10 text-gray-500'
                    }
                  `}
                >
                  <Icon size={16} />
                </div>

                {/* Contenido del paso */}
                <div className="flex-1 min-w-0 pt-0.5">
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={`text-xs font-semibold tracking-wide ${
                        isCurrent
                          ? 'text-cyan-300 font-bold'
                          : isCompleted
                          ? 'text-white'
                          : 'text-gray-500'
                      }`}
                    >
                      {step.title}
                    </span>

                    {timestamp && (
                      <span className="text-[10px] font-mono text-gray-400 tabular-nums">
                        {timestamp}
                      </span>
                    )}
                  </div>

                  <p
                    className={`text-[11px] mt-0.5 leading-relaxed ${
                      isCurrent
                        ? 'text-gray-300'
                        : isCompleted
                        ? 'text-gray-400'
                        : 'text-gray-600'
                    }`}
                  >
                    {step.description}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
