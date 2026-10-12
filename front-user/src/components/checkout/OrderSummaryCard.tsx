'use client';

import React, { useState } from 'react';
import { ShoppingBag, ChevronDown, ChevronUp, Clock, PackageCheck, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import ProductIcon from '@/components/stores/ProductIcon';
import type { CartItem, OrderBreakdown } from '@/types';

function formatCurrency(value?: number | null): string {
  if (value === undefined || value === null) return '$ 0';
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

export interface OrderSummaryCardProps {
  items: CartItem[];
  storeName?: string | null;
  breakdown: OrderBreakdown;
  isSubmitting?: boolean;
  onSubmit: () => void;
}

export default function OrderSummaryCard({
  items,
  storeName,
  breakdown,
  isSubmitting = false,
  onSubmit,
}: OrderSummaryCardProps) {
  const [isExpanded, setIsExpanded] = useState(true);

  return (
    <div className="bg-gradient-to-br from-gray-900 via-gray-900/90 to-gray-950 border border-white/10 rounded-2xl p-5 shadow-2xl sticky top-20">
      <div className="flex items-center justify-between pb-3 border-b border-white/10">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
            <ShoppingBag size={18} />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white">Resumen del Pedido</h3>
            <p className="text-[11px] text-gray-400">
              {items.length} {items.length === 1 ? 'producto' : 'productos'} {storeName ? `de ${storeName}` : ''}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setIsExpanded(!isExpanded)}
          className="text-gray-400 hover:text-white p-1 rounded-lg hover:bg-white/5 transition-colors"
          aria-label={isExpanded ? 'Ocultar items' : 'Ver items'}
        >
          {isExpanded ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
        </button>
      </div>

      {/* Lista de productos colapsable */}
      <AnimatePresence initial={false}>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <ul className="py-3 space-y-2.5 max-h-56 overflow-y-auto pr-1">
              {items.map((item) => (
                <li
                  key={item.productId}
                  className="flex items-center justify-between gap-3 text-xs"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-9 h-9 rounded-lg bg-black/40 border border-cyan-500/20 flex-shrink-0 flex items-center justify-center overflow-hidden">
                      <ProductIcon
                        className="h-full w-full text-cyan-400"
                        containerClassName="h-full w-full border-0 rounded-none bg-transparent"
                        iconWrapperClassName="h-3/5 w-3/5"
                      />
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-white truncate max-w-[170px] sm:max-w-[200px]">
                        {item.name}
                      </p>
                      <p className="text-[10px] text-gray-400">
                        {item.quantity} x {formatCurrency(item.price)}
                      </p>
                    </div>
                  </div>

                  <span className="font-semibold text-white tabular-nums flex-shrink-0">
                    {formatCurrency(item.price * item.quantity)}
                  </span>
                </li>
              ))}
            </ul>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Desglose financiero */}
      <div className="pt-4 border-t border-white/10 space-y-2 text-xs">
        <div className="flex items-center justify-between text-gray-300">
          <span>Subtotal repuestos</span>
          <span className="tabular-nums font-medium text-white">
            {formatCurrency(breakdown.subtotal)}
          </span>
        </div>

        <div className="flex items-center justify-between text-gray-300">
          <span>Costo de domicilio</span>
          <span className="tabular-nums font-medium">
            {breakdown.deliveryFee === 0 ? (
              <span className="text-emerald-400">Gratis</span>
            ) : (
              <span className="text-white">{formatCurrency(breakdown.deliveryFee)}</span>
            )}
          </span>
        </div>

        {breakdown.serviceFee > 0 && (
          <div className="flex items-center justify-between text-gray-300">
            <span>Tarifa de servicio</span>
            <span className="tabular-nums font-medium text-white">
              {formatCurrency(breakdown.serviceFee)}
            </span>
          </div>
        )}

        <div className="pt-3 border-t border-white/15 flex items-baseline justify-between text-sm">
          <div>
            <span className="font-bold text-white text-base">Total a pagar</span>
            <p className="text-[10px] text-gray-500">Impuestos incluidos</p>
          </div>
          <span className="text-xl font-bold text-cyan-300 tabular-nums drop-shadow-[0_0_12px_rgba(34,211,238,0.4)]">
            {formatCurrency(breakdown.total)}
          </span>
        </div>
      </div>

      {/* Tiempos de entrega estimados */}
      <div className="mt-4 flex items-center gap-2 p-2.5 rounded-xl bg-cyan-500/5 border border-cyan-500/15 text-[11px] text-cyan-300">
        <Clock size={15} className="flex-shrink-0 text-cyan-400" />
        <span>Tiempo estimado de entrega: <strong>20 - 30 minutos</strong></span>
      </div>

      {/* Botón de Confirmación de Pedido */}
      <motion.button
        type="button"
        onClick={onSubmit}
        disabled={isSubmitting || items.length === 0}
        whileHover={{ scale: 1.01 }}
        whileTap={{ scale: 0.99 }}
        className="
          w-full mt-4 py-3 px-4 rounded-xl font-bold text-sm
          bg-gradient-to-r from-cyan-400 to-blue-500 hover:from-cyan-300 hover:to-blue-400 text-black
          shadow-[0_0_25px_rgba(34,211,238,0.35)]
          disabled:opacity-50 disabled:cursor-not-allowed
          flex items-center justify-center gap-2 transition-all
        "
      >
        {isSubmitting ? (
          <>
            <Loader2 size={18} className="animate-spin" />
            <span>Confirmando tu pedido...</span>
          </>
        ) : (
          <>
            <PackageCheck size={18} />
            <span>Confirmar Pedido · {formatCurrency(breakdown.total)}</span>
          </>
        )}
      </motion.button>
    </div>
  );
}
