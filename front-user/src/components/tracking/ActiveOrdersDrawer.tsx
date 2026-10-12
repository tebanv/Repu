'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  Bike,
  Clock,
  Warehouse,
  PackageCheck,
  CheckCircle2,
  XCircle,
  ArrowRight,
  Store,
  ChevronRight,
  Receipt,
  Star,
} from 'lucide-react';
import { useActiveOrders, useCompletedOrders } from '@/store/orderStore';
import type { Order, OrderStatus } from '@/types';

export interface ActiveOrdersDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

const STATUS_CONFIG: Record<
  OrderStatus,
  { label: string; color: string; bg: string; border: string; icon: React.ComponentType<{ size?: number; className?: string }> }
> = {
  CREADO: {
    label: 'Pedido registrado',
    color: 'text-cyan-400',
    bg: 'bg-cyan-500/10',
    border: 'border-cyan-500/30',
    icon: Clock,
  },
  PAGADO: {
    label: 'Pago confirmado',
    color: 'text-emerald-400',
    bg: 'bg-emerald-500/10',
    border: 'border-emerald-500/30',
    icon: Clock,
  },
  ACEPTADO: {
    label: 'Aceptado por tienda',
    color: 'text-cyan-400',
    bg: 'bg-cyan-500/10',
    border: 'border-cyan-500/30',
    icon: Warehouse,
  },
  PREPARANDO: {
    label: 'Alistando repuestos',
    color: 'text-amber-400',
    bg: 'bg-amber-500/10',
    border: 'border-amber-500/30',
    icon: Warehouse,
  },
  LISTO: {
    label: 'Listo para despacho',
    color: 'text-cyan-300',
    bg: 'bg-cyan-500/10',
    border: 'border-cyan-500/30',
    icon: PackageCheck,
  },
  RECOGIDO: {
    label: 'Repartidor en tienda',
    color: 'text-purple-400',
    bg: 'bg-purple-500/10',
    border: 'border-purple-500/30',
    icon: PackageCheck,
  },
  EN_CAMINO: {
    label: 'Repartidor en camino',
    color: 'text-cyan-300',
    bg: 'bg-cyan-500/15',
    border: 'border-cyan-400/50',
    icon: Bike,
  },
  ENTREGADO: {
    label: 'Entregado',
    color: 'text-emerald-400',
    bg: 'bg-emerald-500/10',
    border: 'border-emerald-500/30',
    icon: CheckCircle2,
  },
  CANCELADO: {
    label: 'Cancelado',
    color: 'text-rose-400',
    bg: 'bg-rose-500/10',
    border: 'border-rose-500/30',
    icon: XCircle,
  },
};

function formatCurrency(value?: number | null): string {
  if (value === undefined || value === null) return '$ 0';
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

export default function ActiveOrdersDrawer({ isOpen, onClose }: ActiveOrdersDrawerProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'active' | 'history'>('active');

  const activeOrders = useActiveOrders();
  const completedOrders = useCompletedOrders();

  // Cerrar con tecla Escape (solo activo cuando el drawer está abierto)
  useEffect(() => {
    if (!isOpen) return undefined;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Si al abrir no hay pedidos activos pero sí completados, mostrar historial
  useEffect(() => {
    if (isOpen) {
      if (activeOrders.length === 0 && completedOrders.length > 0) {
        setActiveTab('history');
      } else {
        setActiveTab('active');
      }
    }
  }, [isOpen, activeOrders.length, completedOrders.length]);

  const handleNavigateToOrder = (orderId: string) => {
    onClose();
    router.push(`/order/${orderId}`);
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 overflow-hidden flex justify-end">
          {/* Backdrop Blur */}
          <motion.div
            key="orders-drawer-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/75 backdrop-blur-sm"
          />

          {/* Panel Lateral Drawer */}
          <motion.div
            key="orders-drawer-panel"
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 300 }}
            className="
              relative z-10 w-full max-w-md h-full
              bg-gradient-to-b from-gray-950 via-gray-900 to-gray-950
              border-l border-white/10 shadow-[0_0_50px_rgba(0,0,0,0.8)]
              flex flex-col text-white
            "
          >
            {/* CABECERA */}
            <div className="p-4 sm:p-5 border-b border-white/10 flex items-center justify-between flex-shrink-0 bg-gray-900/50 backdrop-blur-md">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-cyan-500/15 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shadow-[0_0_12px_rgba(34,211,238,0.3)]">
                  <Bike size={18} />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-white tracking-wide">Mis Pedidos</h2>
                  <p className="text-xs text-gray-400">
                    {activeOrders.length === 1
                      ? '1 pedido en curso'
                      : `${activeOrders.length} pedidos en curso`}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={onClose}
                className="w-8 h-8 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 flex items-center justify-center text-gray-400 hover:text-white transition-colors cursor-pointer"
                aria-label="Cerrar panel de pedidos"
              >
                <X size={18} />
              </button>
            </div>

            {/* SELECTOR DE PESTAÑAS (En Curso / Historial) */}
            <div className="px-4 pt-3 flex-shrink-0">
              <div className="flex rounded-xl bg-black/40 p-1 border border-white/10 text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => setActiveTab('active')}
                  className={`
                    flex-1 py-2 rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer
                    ${
                      activeTab === 'active'
                        ? 'bg-gradient-to-r from-cyan-500/20 to-blue-500/20 border border-cyan-500/40 text-cyan-300 shadow-[0_0_12px_rgba(34,211,238,0.2)]'
                        : 'text-gray-400 hover:text-white'
                    }
                  `}
                >
                  <Bike size={14} />
                  <span>En Curso</span>
                  {activeOrders.length > 0 && (
                    <span className="ml-1 px-1.5 py-0.2 text-[10px] rounded-full bg-cyan-400 text-black font-extrabold">
                      {activeOrders.length}
                    </span>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('history')}
                  className={`
                    flex-1 py-2 rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer
                    ${
                      activeTab === 'history'
                        ? 'bg-gradient-to-r from-cyan-500/20 to-blue-500/20 border border-cyan-500/40 text-cyan-300 shadow-[0_0_12px_rgba(34,211,238,0.2)]'
                        : 'text-gray-400 hover:text-white'
                    }
                  `}
                >
                  <Receipt size={14} />
                  <span>Historial</span>
                  {completedOrders.length > 0 && (
                    <span className="ml-1 px-1.5 py-0.2 text-[10px] rounded-full bg-white/15 text-gray-200">
                      {completedOrders.length}
                    </span>
                  )}
                </button>
              </div>
            </div>

            {/* CONTENIDO SCROLLEABLE */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 min-h-0">
              {activeTab === 'active' ? (
                /* LISTA DE PEDIDOS EN CURSO */
                activeOrders.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-4">
                    <div className="w-16 h-16 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-gray-500">
                      <Bike size={32} />
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-white">No tienes pedidos en curso</h3>
                      <p className="text-xs text-gray-400 mt-1 max-w-xs leading-relaxed">
                        Cuando compres repuestos en cualquier tienda, podrás seguir el despacho y la ruta del domiciliario aquí en tiempo real.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={onClose}
                      className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-cyan-400 to-blue-500 text-black font-bold text-xs shadow-[0_0_15px_rgba(34,211,238,0.3)] hover:scale-105 transition-all cursor-pointer"
                    >
                      Explorar Tiendas
                    </button>
                  </div>
                ) : (
                  activeOrders.map((order) => {
                    const statusInfo = STATUS_CONFIG[order.status] || STATUS_CONFIG.CREADO;
                    const StatusIcon = statusInfo.icon;
                    const totalUnits = order.items.reduce((acc, it) => acc + it.quantity, 0);

                    return (
                      <motion.div
                        key={order.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        onClick={() => handleNavigateToOrder(order.id)}
                        className="
                          group relative p-4 rounded-2xl
                          bg-gradient-to-br from-gray-900/95 via-gray-900/80 to-gray-950
                          border border-cyan-500/25 hover:border-cyan-400/60
                          shadow-[0_0_20px_rgba(0,0,0,0.4)] hover:shadow-[0_0_25px_rgba(34,211,238,0.2)]
                          transition-all duration-200 cursor-pointer
                        "
                      >
                        {/* Cabecera de la tarjeta: Tienda + ID */}
                        <div className="flex items-start justify-between gap-2 mb-2.5">
                          <div className="flex items-center gap-2 min-w-0">
                            <div className="w-7 h-7 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 flex-shrink-0">
                              <Store size={14} />
                            </div>
                            <h3 className="font-bold text-white text-sm truncate group-hover:text-cyan-300 transition-colors">
                              {order.storeName}
                            </h3>
                          </div>
                          <span className="px-2 py-0.5 rounded-md bg-white/10 text-gray-300 font-mono text-[10px] flex-shrink-0">
                            {order.id}
                          </span>
                        </div>

                        {/* Badge de Estado con Pulso */}
                        <div className="flex items-center justify-between gap-2 mb-3">
                          <div
                            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${statusInfo.bg} ${statusInfo.border} ${statusInfo.color} border`}
                          >
                            <StatusIcon size={13} className="animate-pulse" />
                            <span>{statusInfo.label}</span>
                            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping" />
                          </div>

                          <div className="flex items-center gap-1 text-xs text-gray-400">
                            <Clock size={13} className="text-cyan-400" />
                            <span className="text-emerald-400 font-bold">
                              ~{order.estimatedDeliveryMinutes} min
                            </span>
                          </div>
                        </div>

                        {/* Resumen de Repuestos */}
                        <div className="bg-black/30 rounded-xl p-2.5 border border-white/5 text-xs text-gray-300 space-y-1 mb-3">
                          <p className="text-[11px] text-gray-400 font-medium">
                            {totalUnits} {totalUnits === 1 ? 'repuesto' : 'repuestos'}:
                          </p>
                          <p className="truncate text-white font-medium text-[11px]">
                            {order.items.map((i) => `${i.quantity}x ${i.name}`).join(', ')}
                          </p>
                        </div>

                        {/* Footer de Tarjeta con CTA */}
                        <div className="flex items-center justify-between pt-2 border-t border-white/10 text-xs">
                          <div>
                            <span className="text-gray-400 block text-[10px]">Total</span>
                            <span className="font-bold text-white tabular-nums">
                              {formatCurrency(order.breakdown.total)}
                            </span>
                          </div>

                          <div className="flex items-center gap-1.5 text-cyan-400 group-hover:text-cyan-300 font-semibold text-xs">
                            <span>Ver Seguimiento</span>
                            <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
                          </div>
                        </div>
                      </motion.div>
                    );
                  })
                )
              ) : (
                /* PESTAÑA HISTORIAL */
                completedOrders.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center p-6 space-y-3">
                    <div className="w-14 h-14 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-gray-500">
                      <Receipt size={28} />
                    </div>
                    <p className="text-sm font-semibold text-white">No hay compras finalizadas</p>
                    <p className="text-xs text-gray-400 max-w-xs">
                      Aquí se archivarán los pedidos entregados o cancelados durante tu sesión.
                    </p>
                  </div>
                ) : (
                  completedOrders.map((order) => {
                    const isDelivered = order.status === 'ENTREGADO';

                    return (
                      <div
                        key={order.id}
                        onClick={() => handleNavigateToOrder(order.id)}
                        className="
                          p-3.5 rounded-2xl bg-white/[0.03] border border-white/10 hover:border-white/20
                          transition-all cursor-pointer text-xs space-y-2 group
                        "
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-bold text-white truncate">{order.storeName}</span>
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border ${
                              isDelivered
                                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400'
                                : 'bg-rose-500/10 border-rose-500/30 text-rose-400'
                            }`}
                          >
                            {isDelivered ? 'Entregado' : 'Cancelado'}
                          </span>
                        </div>

                        <p className="text-[11px] text-gray-400 truncate">
                          {order.items.map((i) => `${i.quantity}x ${i.name}`).join(', ')}
                        </p>

                        <div className="flex items-center justify-between pt-1 border-t border-white/5 text-[11px]">
                          <span className="text-gray-400">
                            {new Date(order.createdAt).toLocaleDateString('es-CO', {
                              day: '2-digit',
                              month: 'short',
                            })}
                          </span>

                          <div className="flex items-center gap-2">
                            {order.rating && (
                              <div className="flex items-center gap-0.5 text-amber-400">
                                <Star size={11} fill="currentColor" />
                                <span className="font-semibold text-[10px]">
                                  {order.rating.storeRating}★
                                </span>
                              </div>
                            )}
                            <span className="font-bold text-white">
                              {formatCurrency(order.breakdown.total)}
                            </span>
                            <ChevronRight size={13} className="text-gray-400 group-hover:translate-x-0.5 transition-transform" />
                          </div>
                        </div>
                      </div>
                    );
                  })
                )
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
