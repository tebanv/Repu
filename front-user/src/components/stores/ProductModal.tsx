'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Minus, Plus, Check, ChevronRight } from 'lucide-react';
import ProductIcon from './ProductIcon';
import type { Product, CartActionResult } from '@/types';

function formatCurrency(value?: number | null): string {
  if (value === undefined || value === null) return '$ 0';
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

export interface ProductModalProps {
  product: Product | null;
  isOpen: boolean;
  onClose: () => void;
  onAddToCart?: (
    product: Product,
    quantity: number
  ) => CartActionResult | void | Promise<CartActionResult | void>;
}

export default function ProductModal({
  product,
  isOpen,
  onClose,
  onAddToCart,
}: ProductModalProps) {
  const [quantity, setQuantity] = useState(1);

  // --- BODY SCROLL LOCK (Esto ya funciona bien) ---
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  useEffect(() => {
    setQuantity(1);
  }, [product]);

  if (!product) return null;

  const hasDiscount = Boolean(product.comparePrice && product.comparePrice > product.price);
  const discountPercent =
    hasDiscount && product.comparePrice
      ? Math.round((1 - product.price / product.comparePrice) * 100)
      : 0;
  
  const totalPrice = product.price * quantity;

  const handleAddToCart = async () => {
    const result = await Promise.resolve(onAddToCart?.(product, quantity));

    if (result?.shouldCloseModal) {
      setQuantity(1);
      onClose();
    }
  };

  const incrementQuantity = () => {
    if (quantity < (product.stock || 99)) {
      setQuantity(q => q + 1);
    }
  };

  const decrementQuantity = () => {
    if (quantity > 1) {
      setQuantity(q => q - 1);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          key="product-modal-root"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-end justify-center md:items-center"
        >
          {/* Backdrop blur */}
          <div
            onClick={onClose}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm"
          />

          {/* Modal Card */}
          <motion.div
            key="product-modal-card"
            initial={{ y: '100%', opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: '100%', opacity: 0 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="relative z-10 flex min-h-0 max-h-[90dvh] w-full flex-col overflow-hidden rounded-t-[1.75rem] border-t border-white/[0.08] bg-[linear-gradient(180deg,rgba(4,8,18,0.98),rgba(2,6,14,0.99))] shadow-[0_28px_80px_rgba(0,0,0,0.55),inset_0_1px_0_rgba(255,255,255,0.04)] md:max-h-none md:max-w-4xl md:rounded-2xl md:border md:border-white/10 md:bg-gray-900 md:shadow-2xl md:h-[85vh]"
          >
              
              {/* HEADER */}
              <div className="relative flex-shrink-0 z-20">
                <div className="flex justify-center pt-3 pb-2 md:hidden">
                  <div className="w-10 h-1 rounded-full bg-white/20" />
                </div>
                
                <button
                  onClick={onClose}
                  className="absolute right-4 top-4 rounded-2xl border border-white/[0.08] bg-white/[0.04] p-2 text-white transition-colors hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-100/50"
                  aria-label="Cerrar producto"
                >
                  <X size={20} />
                </button>
              </div>

              {/* BODY: ÁREA DE CONTENIDO */}
              {/* CAMBIO CLAVE 1: overflow-y-auto en móvil, md:overflow-hidden en escritorio.
                  Esto permite que en el celular scrollee toda el área central (imagen + texto) */}
              <div className="flex-1 flex flex-col relative overflow-y-auto md:overflow-hidden">
                <div className="flex flex-col md:flex-row h-auto md:h-full">
                  
                  {/* COLUMNA IZQUIERDA: ÍCONO */}
                  <div className="relative flex-shrink-0 p-4 md:flex md:w-1/2 md:items-center md:justify-center md:bg-black/20">
                    <div className="relative flex aspect-video w-full items-center justify-center overflow-hidden rounded-[1.35rem] border border-white/[0.06] bg-[linear-gradient(180deg,rgba(16,24,38,0.86),rgba(10,16,28,0.98))] shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] md:aspect-square md:rounded-xl md:bg-black/40">
                      <ProductIcon
                        className="h-full w-full text-cyan-400"
                        containerClassName="h-full w-full border-0 rounded-none bg-transparent"
                        iconWrapperClassName="h-28 w-28 md:h-36 md:w-36"
                        ambientGlowClassName="bg-cyan-500/10 blur-2xl"
                        iconShadow="drop-shadow(0 0 6px rgba(34, 211, 238, 0.28))"
                        floatDistance={2}
                        floatDuration={4.5}
                      />
                      
                      {hasDiscount && (
                        <div className="absolute left-3 top-3 rounded-xl border border-red-300/15 bg-red-500/90 px-3 py-1 text-sm font-bold text-white shadow-lg">
                          -{discountPercent}% OFF
                        </div>
                      )}
                    </div>
                  </div>

                  {/* COLUMNA DERECHA: INFO */}
                  {/* CAMBIO CLAVE 2: Quitamos el scroll forzado en móvil (overflow-visible) 
                      y lo dejamos solo para escritorio (md:overflow-y-auto) */}
                  <div className="px-4 pb-4 md:p-8 md:w-1/2 flex flex-col h-auto md:h-full overflow-visible md:overflow-y-auto scrollbar-thin scrollbar-thumb-white/20 scrollbar-track-transparent">
                    
                    <div className="flex-shrink-0">
                      <div className="flex items-center gap-2 mb-2">
                        {product.brand && (
                          <span className="text-sm text-accent font-medium uppercase tracking-wide">
                            {product.brand}
                          </span>
                        )}
                        {product.reference && (
                          <span className="text-xs text-gray-500">
                            Ref: {product.reference}
                          </span>
                        )}
                      </div>

                      <h2 className="text-xl md:text-2xl font-bold text-white mb-4 leading-tight">
                        {product.name}
                      </h2>

                      <div className="mb-4 flex w-fit items-baseline gap-3 rounded-xl border border-white/[0.06] bg-white/[0.04] p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
                        <span className="text-2xl md:text-3xl font-bold text-white">
                          {formatCurrency(product.price)}
                        </span>
                        {hasDiscount && (
                          <span className="text-base text-gray-500 line-through">
                            {formatCurrency(product.comparePrice)}
                          </span>
                        )}
                      </div>

                      <div className="mb-6">
                        {product.isAvailable ? (
                          <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-green-500/10 border border-green-500/20 text-green-400 text-sm font-medium">
                            <Check size={14} />
                            Disponible ({product.stock} unds)
                          </span>
                        ) : (
                          <span className="text-red-400 text-sm font-medium bg-red-500/10 px-2 py-1 rounded-md">
                            Agotado
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="space-y-6 pb-6">
                      
                      {product.description && (
                        <div>
                          <h3 className="text-sm font-medium text-gray-400 mb-2 uppercase tracking-wider">
                            Descripción
                          </h3>
                          <p className="text-sm text-gray-300 leading-relaxed">
                            {product.description}
                          </p>
                        </div>
                      )}

                      {product.specifications && Object.keys(product.specifications).length > 0 && (
                        <div>
                          <h3 className="text-sm font-medium text-gray-400 mb-3 uppercase tracking-wider">
                            Especificaciones
                          </h3>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {Object.entries(product.specifications).map(([key, value]) => (
                              <div key={key} className="bg-white/5 rounded-lg px-3 py-2 border border-white/5">
                                <p className="text-xs text-gray-500 capitalize mb-0.5">
                                  {key.replace(/([A-Z])/g, ' $1').trim()}
                                </p>
                                <p className="text-sm text-white font-medium">
                                  {String(value)}
                                </p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {Boolean(product.compatibleVehicles && product.compatibleVehicles.length > 0) && (
                        <div>
                          <h3 className="text-sm font-medium text-gray-400 mb-2 uppercase tracking-wider">
                            Compatibilidad
                          </h3>
                          <div className="bg-white/5 rounded-xl p-1">
                            {product.compatibleVehicles?.map((vehicle, index) => (
                              <div 
                                key={index} 
                                className="flex items-center gap-3 p-2 text-sm text-gray-300 border-b border-white/5 last:border-0"
                              >
                                <ChevronRight size={14} className="text-accent flex-shrink-0" />
                                <span>{vehicle}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* FOOTER */}
              <div className="relative z-20 flex-shrink-0 overflow-hidden border-t border-white/[0.06] bg-[linear-gradient(180deg,rgba(8,13,24,0.78),rgba(3,7,18,0.94)_24%,rgba(2,6,14,0.99))] px-4 pt-4 supports-[backdrop-filter]:backdrop-blur-xl md:flex md:items-center md:gap-4 md:bg-gray-900 md:px-8 md:py-4">
                <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-white/[0.06]" />
                <div className="pointer-events-none absolute inset-x-8 -top-5 h-10 rounded-full bg-cyan-400/8 blur-2xl" />
                <div className="pointer-events-none absolute inset-x-0 top-0 h-12 bg-gradient-to-b from-white/[0.03] via-cyan-300/[0.02] to-transparent" />

                <div className="relative flex flex-col gap-3 md:w-full md:flex-row md:items-center md:gap-4">
                  <div className="flex items-center justify-between gap-3 md:justify-start">
                    <div className="min-w-0 md:hidden">
                      <p className="text-[0.68rem] font-medium uppercase tracking-[0.18em] text-gray-500">
                        Cantidad
                      </p>
                      <p className="mt-1 text-sm font-medium text-white/80">
                        Total {formatCurrency(totalPrice)}
                      </p>
                    </div>

                    <div className="flex items-center gap-1 rounded-2xl border border-white/[0.07] bg-white/[0.04] p-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] md:rounded-xl md:border-white/10 md:bg-white/5">
                  <button
                    onClick={decrementQuantity}
                    disabled={quantity <= 1}
                    className="flex h-10 w-10 items-center justify-center rounded-xl text-white transition-colors hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-30"
                    aria-label="Disminuir cantidad"
                  >
                    <Minus size={18} />
                  </button>

                  <span className="w-8 text-center text-lg font-semibold tabular-nums text-white">
                    {quantity}
                  </span>

                  <button
                    onClick={incrementQuantity}
                    disabled={quantity >= (product.stock || 99)}
                    className="flex h-10 w-10 items-center justify-center rounded-xl text-white transition-colors hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/40"
                    aria-label="Aumentar cantidad"
                  >
                    <Plus size={18} />
                  </button>
                </div>
                  </div>

                  <div className="safe-bottom-pad pb-5 md:w-full md:pb-0">
                    <div className="relative">
                      <div className="pointer-events-none absolute inset-x-8 inset-y-2 rounded-full bg-cyan-300/18 blur-2xl" />

                      <motion.button
                        onClick={handleAddToCart}
                        disabled={!product.isAvailable}
                        whileHover={{ scale: 1.01 }}
                        whileTap={{ scale: 0.985 }}
                        className="relative flex w-full items-center justify-between gap-3 rounded-[1.35rem] border border-cyan-200/45 bg-[linear-gradient(135deg,rgba(170,255,255,0.98),rgba(34,211,238,0.96)_48%,rgba(8,145,178,0.92))] px-4 py-4 text-slate-950 shadow-[0_0_0_1px_rgba(255,255,255,0.08),0_18px_44px_rgba(34,211,238,0.22),0_0_24px_rgba(34,211,238,0.12)] transition-transform transition-shadow hover:shadow-[0_0_0_1px_rgba(255,255,255,0.12),0_22px_52px_rgba(34,211,238,0.28),0_0_28px_rgba(34,211,238,0.16)] disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:shadow-[0_0_0_1px_rgba(255,255,255,0.08),0_18px_44px_rgba(34,211,238,0.22),0_0_24px_rgba(34,211,238,0.12)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-100/70 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
                      >
                        <span className="pointer-events-none absolute inset-x-5 top-0 h-px bg-white/80 opacity-70" />

                        <div className="min-w-0 text-left">
                          <p className="text-[0.68rem] font-medium uppercase tracking-[0.2em] text-slate-950/62">
                            Pedido
                          </p>
                          <p className="truncate text-[1rem] font-semibold tracking-[-0.015em] text-slate-950">
                            Agregar al carrito
                          </p>
                        </div>

                        <span className="rounded-xl border border-slate-950/12 bg-slate-950/10 px-3 py-1.5 text-sm font-semibold tabular-nums text-slate-950 shadow-[inset_0_1px_0_rgba(255,255,255,0.28)]">
                          {formatCurrency(totalPrice)}
                        </span>
                      </motion.button>
                    </div>
                  </div>
                </div>
              </div>
              
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
  );
}
