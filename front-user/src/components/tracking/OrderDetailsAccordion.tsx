'use client';

import React, { useState } from 'react';
import { ChevronDown, ChevronUp, Package, MapPin, CreditCard, ShieldCheck } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import ProductIcon from '@/components/stores/ProductIcon';
import type { Order } from '@/types';

function formatCurrency(value?: number | null): string {
  if (value === undefined || value === null) return '$ 0';
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

export interface OrderDetailsAccordionProps {
  order: Order;
}

export default function OrderDetailsAccordion({ order }: OrderDetailsAccordionProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="bg-gradient-to-br from-gray-900 via-gray-900/90 to-gray-950 border border-white/10 rounded-2xl overflow-hidden shadow-xl">
      {/* Botón de acordeón */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full p-4 flex items-center justify-between gap-3 text-left hover:bg-white/[0.02] transition-colors cursor-pointer"
        aria-expanded={isOpen}
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
            <Package size={16} />
          </div>
          <div>
            <h4 className="text-xs sm:text-sm font-bold text-white">
              Detalles del Pedido ({order.items.length} {order.items.length === 1 ? 'repuesto' : 'repuestos'})
            </h4>
            <p className="text-[11px] text-gray-400">
              Total pagado: <strong className="text-cyan-300 font-mono">{formatCurrency(order.breakdown.total)}</strong>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-gray-400">
          <span className="text-[11px] hidden sm:inline">
            {isOpen ? 'Ocultar' : 'Ver detalle'}
          </span>
          {isOpen ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
        </div>
      </button>

      {/* Contenido colapsable */}
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="border-t border-white/10 px-4 pb-4 pt-3 space-y-4 text-xs"
          >
            {/* Lista de productos */}
            <div>
              <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider block mb-2">
                Repuestos Comprados
              </span>
              <div className="space-y-2.5 max-h-48 overflow-y-auto pr-1">
                {order.items.map((item) => (
                  <div
                    key={item.productId}
                    className="flex items-center justify-between gap-3 p-2 rounded-xl bg-black/30 border border-white/5"
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
                        <p className="font-semibold text-white truncate max-w-[180px] sm:max-w-[220px]">
                          {item.name}
                        </p>
                        <p className="text-[10px] text-gray-400">
                          {item.quantity} un. x {formatCurrency(item.price)}
                        </p>
                      </div>
                    </div>

                    <span className="font-bold text-white tabular-nums flex-shrink-0">
                      {formatCurrency(item.price * item.quantity)}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Dirección de Entrega */}
            <div className="p-3 rounded-xl bg-black/30 border border-white/5 space-y-1.5">
              <div className="flex items-start gap-2">
                <MapPin size={14} className="text-cyan-400 flex-shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold text-white block">
                    {order.deliveryAddress.street}
                  </span>
                  {order.deliveryAddress.details && (
                    <span className="text-gray-400 block text-[11px]">
                      {order.deliveryAddress.details}
                    </span>
                  )}
                  {order.deliveryAddress.notes && (
                    <span className="text-amber-400/90 block text-[10px] mt-0.5">
                      Nota: {order.deliveryAddress.notes}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Método de Pago */}
            <div className="flex items-center justify-between p-3 rounded-xl bg-black/30 border border-white/5">
              <div className="flex items-center gap-2">
                <CreditCard size={14} className="text-emerald-400" />
                <span className="text-gray-300">Método de Pago:</span>
                <span className="font-semibold text-white">
                  {order.paymentMethod === 'wompi' ? 'Wompi en línea' : 'Tarjeta contra entrega'}
                </span>
              </div>
              <span className="px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-[10px] font-bold">
                {order.paymentStatus === 'PAID' ? 'PAGADO' : 'PENDIENTE'}
              </span>
            </div>

            {/* Desglose Financiero */}
            <div className="pt-2 border-t border-white/10 space-y-1.5 text-[11px]">
              <div className="flex justify-between text-gray-400">
                <span>Subtotal repuestos</span>
                <span className="tabular-nums font-medium text-white">
                  {formatCurrency(order.breakdown.subtotal)}
                </span>
              </div>
              <div className="flex justify-between text-gray-400">
                <span>Costo de envío</span>
                <span className="tabular-nums font-medium text-white">
                  {order.breakdown.deliveryFee === 0
                    ? 'Gratis'
                    : formatCurrency(order.breakdown.deliveryFee)}
                </span>
              </div>
              {order.breakdown.serviceFee > 0 && (
                <div className="flex justify-between text-gray-400">
                  <span>Tarifa de servicio</span>
                  <span className="tabular-nums font-medium text-white">
                    {formatCurrency(order.breakdown.serviceFee)}
                  </span>
                </div>
              )}
              <div className="flex justify-between text-sm font-bold pt-1.5 border-t border-white/10 text-white">
                <span>Total pagado</span>
                <span className="text-cyan-300 font-mono">
                  {formatCurrency(order.breakdown.total)}
                </span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
