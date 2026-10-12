'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  AnimatePresence,
  animate,
  motion,
  useMotionValue,
  useMotionValueEvent,
  useSpring,
  type PanInfo,
} from 'framer-motion';
import {
  AlertTriangle,
  ArrowRight,
  Loader2,
  Minus,
  Plus,
  ShoppingCart,
  Store,
  Trash2,
  X,
} from 'lucide-react';

import useCartStore, { useCartHasHydrated, useCartSummary } from '@/store/cartStore';
import useToastStore from '@/store/toastStore';
import ProductIcon from './ProductIcon';
import type { CartItem } from '@/types';

const MOBILE_BREAKPOINT_QUERY = '(max-width: 767px)';
const SWIPE_REVEAL_PX = 104;
const SWIPE_DELETE_DISTANCE_PX = 88;
const SWIPE_DELETE_VELOCITY_PX = -720;

function formatCurrency(value?: number | null): string {
  if (value === undefined || value === null) return '$ 0';
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

function useIsMobileDrawer(): boolean {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
      return undefined;
    }

    const mediaQuery = window.matchMedia(MOBILE_BREAKPOINT_QUERY);
    const handleChange = () => {
      setIsMobile(mediaQuery.matches);
    };

    handleChange();

    if (typeof mediaQuery.addEventListener === 'function') {
      mediaQuery.addEventListener('change', handleChange);

      return () => {
        mediaQuery.removeEventListener('change', handleChange);
      };
    }

    mediaQuery.addListener(handleChange);

    return () => {
      mediaQuery.removeListener(handleChange);
    };
  }, []);

  return isMobile;
}

interface AnimatedCurrencyValueProps {
  value: number;
  className?: string;
}

function AnimatedCurrencyValue({ value, className }: AnimatedCurrencyValueProps) {
  const springValue = useSpring(value, {
    stiffness: 220,
    damping: 28,
    mass: 0.9,
  });
  const [displayValue, setDisplayValue] = useState(value);

  useEffect(() => {
    springValue.set(value);
  }, [springValue, value]);

  useMotionValueEvent(springValue, 'change', (latestValue) => {
    setDisplayValue(Math.round(Number(latestValue)));
  });

  return (
    <span className={className}>
      {formatCurrency(displayValue)}
    </span>
  );
}

interface CartDrawerItemProps {
  item: CartItem;
  canSwipe: boolean;
  onDecrease: (item: CartItem) => void;
  onIncrease: (item: CartItem) => void;
  onRemove: (item: CartItem, reason?: string) => void;
}

function CartDrawerItem({
  item,
  canSwipe,
  onDecrease,
  onIncrease,
  onRemove,
}: CartDrawerItemProps) {
  const dragX = useMotionValue(0);

  useEffect(() => {
    if (!canSwipe) {
      dragX.set(0);
    }
  }, [canSwipe, dragX]);

  const resetPosition = useCallback(() => {
    animate(dragX, 0, {
      type: 'spring',
      stiffness: 420,
      damping: 34,
    });
  }, [dragX]);

  const handleRemoveClick = useCallback(
    (reason = 'button') => {
      resetPosition();
      onRemove(item, reason);
    },
    [item, onRemove, resetPosition]
  );

  const handleDragEnd = useCallback(
    (_: unknown, info: PanInfo) => {
      if (!canSwipe) {
        return;
      }

      const draggedFarEnough = info.offset.x <= -SWIPE_DELETE_DISTANCE_PX;
      const draggedFastEnough = info.velocity.x <= SWIPE_DELETE_VELOCITY_PX;

      if (draggedFarEnough || draggedFastEnough) {
        handleRemoveClick('swipe');
        return;
      }

      if (info.offset.x < -SWIPE_REVEAL_PX / 2) {
        animate(dragX, -SWIPE_REVEAL_PX, {
          type: 'spring',
          stiffness: 400,
          damping: 32,
        });
        return;
      }

      resetPosition();
    },
    [canSwipe, dragX, handleRemoveClick, resetPosition]
  );

  const itemSubtotal = item.price * item.quantity;
  const isMaxReached =
    typeof item.stockSnapshot === 'number' && item.quantity >= item.stockSnapshot;

  return (
    <motion.li
      layout
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{
        opacity: 0,
        height: 0,
        marginBottom: 0,
        paddingTop: 0,
        paddingBottom: 0,
        transition: {
          height: { duration: 0.24, ease: 'easeInOut' },
          opacity: { duration: 0.16 },
        },
      }}
      transition={{ duration: 0.2 }}
      className="relative list-none overflow-hidden rounded-2xl"
    >
      {/* Botón de eliminación swipe detrás del card (móvil) */}
      <div className="absolute inset-y-0 right-0 flex w-[104px] items-stretch justify-end pl-2">
        <button
          type="button"
          onClick={() => handleRemoveClick('swipe')}
          className="flex w-full items-center justify-center rounded-2xl bg-red-500/20 text-red-400 transition-colors hover:bg-red-500/30 hover:text-red-200 cursor-pointer"
          aria-label={`Eliminar ${item.name} del pedido`}
        >
          <div className="flex flex-col items-center gap-1">
            <Trash2 size={18} />
            <span className="text-[11px] font-semibold">Eliminar</span>
          </div>
        </button>
      </div>

      {/* Contenido principal arrastrable */}
      <motion.div
        style={{ x: dragX }}
        drag={canSwipe ? 'x' : false}
        dragConstraints={{ left: -SWIPE_REVEAL_PX, right: 0 }}
        dragElastic={0.12}
        onDragEnd={handleDragEnd}
        className="relative flex items-center gap-3.5 rounded-2xl border border-white/[0.08] bg-gradient-to-r from-gray-900/95 via-gray-900/90 to-gray-950/95 p-3.5 sm:p-4 shadow-md backdrop-blur-md transition-all hover:border-cyan-500/30"
      >
        {/* Holographic ProductIcon Container */}
        <div className="relative h-16 w-16 sm:h-20 sm:w-20 flex-shrink-0 overflow-hidden rounded-xl bg-black/40 border border-cyan-500/20 shadow-[0_0_15px_rgba(34,211,238,0.08)]">
          <ProductIcon
            className="h-full w-full text-cyan-400"
            containerClassName="h-full w-full border-0 rounded-none bg-transparent"
            iconWrapperClassName="h-3/5 w-3/5"
            ambientGlowClassName="bg-cyan-500/10 blur-md"
          />
        </div>

        {/* Info y Controles */}
        <div className="min-w-0 flex-1 flex flex-col justify-between self-stretch">
          {/* Fila Superior: Título + Botón de eliminar */}
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <h4 className="font-medium text-sm text-white line-clamp-2 leading-snug">
                {item.name}
              </h4>
              <p className="mt-0.5 text-xs text-gray-400">
                {formatCurrency(item.price)} <span className="text-gray-500">c/u</span>
              </p>
            </div>

            <button
              type="button"
              onClick={() => handleRemoveClick('button')}
              className="rounded-lg p-1.5 text-gray-400 transition-colors hover:bg-red-500/15 hover:text-red-400 cursor-pointer flex-shrink-0"
              title={`Eliminar ${item.name}`}
              aria-label={`Eliminar ${item.name}`}
            >
              <Trash2 size={16} />
            </button>
          </div>

          {/* Fila Inferior: Selector de cantidad + Subtotal */}
          <div className="mt-2.5 flex items-center justify-between gap-3 pt-1 border-t border-white/[0.04]">
            {/* Controles de cantidad táctiles */}
            <div className="flex items-center rounded-xl border border-white/10 bg-black/40 p-0.5 shadow-inner">
              <button
                type="button"
                onClick={() => onDecrease(item)}
                className="flex h-7 w-7 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-white/10 hover:text-white cursor-pointer"
                aria-label={`Disminuir cantidad de ${item.name}`}
              >
                <Minus size={13} />
              </button>

              <span className="min-w-[28px] text-center text-xs font-bold tabular-nums text-white">
                {item.quantity}
              </span>

              <button
                type="button"
                onClick={() => onIncrease(item)}
                disabled={isMaxReached}
                className="flex h-7 w-7 items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-white/10 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                aria-label={`Aumentar cantidad de ${item.name}`}
              >
                <Plus size={13} />
              </button>
            </div>

            {/* Subtotal del item */}
            <div className="text-right">
              <span className="text-[11px] text-gray-500 block font-normal leading-none mb-0.5">Total</span>
              <span className="text-sm sm:text-base font-bold tabular-nums text-cyan-300">
                {formatCurrency(itemSubtotal)}
              </span>
            </div>
          </div>
        </div>
      </motion.div>
    </motion.li>
  );
}

export interface CartDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onCheckout?: () => void;
}

export default function CartDrawer({ isOpen, onClose, onCheckout }: CartDrawerProps) {
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const isMobileDrawer = useIsMobileDrawer();
  const hasHydrated = useCartHasHydrated();
  const { items, itemCount, subtotal, storeName } = useCartSummary();
  const removeItem = useCartStore((state) => state.removeItem);
  const updateQuantity = useCartStore((state) => state.updateQuantity);
  const pushToast = useToastStore((state) => state.pushToast);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [liveMessage, setLiveMessage] = useState('');
  const isHydrationPending = !hasHydrated && itemCount === 0 && items.length === 0;
  const isEmptyState = !isHydrationPending && itemCount === 0;
  const shouldCenterMobileDrawer = isMobileDrawer && isEmptyState;

  const drawerStyle = isMobileDrawer
    ? shouldCenterMobileDrawer
      ? {
        maxHeight: 'min(72dvh, 680px)',
        height: 'min(72dvh, 680px)',
      }
      : {
        maxHeight: 'min(calc(100dvh - env(safe-area-inset-top) - 12px), 880px)',
        height: 'min(calc(100dvh - env(safe-area-inset-top) - 12px), 880px)',
      }
    : {
      maxHeight: 'min(88vh, 880px)',
    };

  useEffect(() => {
    if (!isOpen) {
      setSyncError(null);
      setLiveMessage('');
      return undefined;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }

    const focusTimer = window.setTimeout(() => {
      closeButtonRef.current?.focus();
    }, 120);

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleEscape);

    return () => {
      window.clearTimeout(focusTimer);
      window.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen, onClose]);

  const reportSyncError = useCallback(
    (message: string) => {
      setSyncError(message);
      setLiveMessage(message);
      pushToast({
        variant: 'error',
        title: 'Error del carrito',
        message,
      });
    },
    [pushToast]
  );

  const handleIncrease = useCallback(
    (item: CartItem) => {
      const result = updateQuantity(item.productId, item.quantity + 1);

      if (!result.ok) {
        reportSyncError('No pudimos sincronizar el aumento de cantidad. Intenta nuevamente.');
        return;
      }

      setSyncError(null);

      if (result.code === 'QUANTITY_CLAMPED') {
        const warningMessage = `La cantidad de ${item.name} se ajustó al máximo disponible.`;

        setLiveMessage(warningMessage);
        pushToast({
          variant: 'warning',
          title: 'Cantidad ajustada',
          message: warningMessage,
        });
        return;
      }

      if (result.item) {
        setLiveMessage(`Cantidad de ${item.name} actualizada a ${result.item.quantity}.`);
      }
    },
    [pushToast, reportSyncError, updateQuantity]
  );

  const handleDecrease = useCallback(
    (item: CartItem) => {
      const result = updateQuantity(item.productId, item.quantity - 1);

      if (!result.ok) {
        reportSyncError('No pudimos sincronizar la reducción de cantidad. Intenta nuevamente.');
        return;
      }

      setSyncError(null);
      if (result.item) {
        setLiveMessage(`Cantidad de ${item.name} actualizada a ${result.item.quantity}.`);
      }
    },
    [reportSyncError, updateQuantity]
  );

  const handleRemove = useCallback(
    (item: CartItem, reason = 'button') => {
      const result = removeItem(item.productId);

      if (!result.ok) {
        reportSyncError('No pudimos eliminar el producto del carrito. Intenta nuevamente.');
        return;
      }

      setSyncError(null);
      setLiveMessage(`${item.name} se eliminó del carrito.`);

      if (reason === 'swipe') {
        pushToast({
          variant: 'info',
          title: 'Producto eliminado',
          message: `${item.name} fue removido del carrito.`,
        });
      }
    },
    [pushToast, reportSyncError, removeItem]
  );

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center md:items-center">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/80 backdrop-blur-sm"
          />

          {/* Live region para accesibilidad de cambios dinámicos */}
          <span className="sr-only" role="status" aria-live="polite">
            {liveMessage}
          </span>

          {/* Contenedor del Drawer */}
          <motion.div
            initial={isMobileDrawer ? { y: '100%' } : { scale: 0.95, opacity: 0 }}
            animate={isMobileDrawer ? { y: 0 } : { scale: 1, opacity: 1 }}
            exit={isMobileDrawer ? { y: '100%' } : { scale: 0.95, opacity: 0 }}
            transition={{ type: 'spring', damping: 28, stiffness: 300 }}
            style={drawerStyle}
            className="relative z-10 flex w-full max-w-lg flex-col overflow-hidden rounded-t-[2rem] md:rounded-[2rem] border border-white/10 bg-gray-950 shadow-2xl"
          >
            {/* Header del Drawer */}
            <div className="flex items-center justify-between border-b border-white/[0.08] px-5 sm:px-6 py-4 bg-gray-900/60 backdrop-blur-md">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-300 shadow-[0_0_12px_rgba(34,211,238,0.15)]">
                  <ShoppingCart size={20} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-bold text-base text-white">Tu Pedido</h3>
                    {itemCount > 0 && (
                      <span className="px-2 py-0.5 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 text-[11px] font-bold">
                        {itemCount} {itemCount === 1 ? 'ítem' : 'ítems'}
                      </span>
                    )}
                  </div>
                  {storeName ? (
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <Store size={12} className="text-emerald-400 flex-shrink-0" />
                      <p className="text-xs text-gray-400 truncate max-w-[220px] sm:max-w-[280px]">
                        {storeName}
                      </p>
                    </div>
                  ) : (
                    <p className="text-xs text-gray-500">Repuestos automotrices</p>
                  )}
                </div>
              </div>

              <button
                ref={closeButtonRef}
                type="button"
                onClick={onClose}
                className="rounded-xl p-2 text-gray-400 transition-colors hover:bg-white/10 hover:text-white cursor-pointer"
                aria-label="Cerrar carrito"
              >
                <X size={20} />
              </button>
            </div>

            {/* Error de sincronización si ocurre */}
            {syncError && (
              <div className="flex items-center gap-2 border-b border-red-500/20 bg-red-500/10 px-6 py-2.5 text-xs font-medium text-red-300">
                <AlertTriangle size={15} />
                <span>{syncError}</span>
              </div>
            )}

            {/* Contenido / Lista de productos */}
            <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-4">
              {isHydrationPending ? (
                <div className="flex h-full flex-col items-center justify-center gap-3 py-16 text-gray-400">
                  <Loader2 size={28} className="animate-spin text-cyan-400" />
                  <p className="text-sm">Cargando tu carrito...</p>
                </div>
              ) : isEmptyState ? (
                <div className="flex h-full flex-col items-center justify-center gap-4 py-16 text-center px-4">
                  <div className="relative flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-b from-cyan-500/10 to-transparent border border-cyan-500/20 shadow-[0_0_25px_rgba(34,211,238,0.15)]">
                    <ProductIcon
                      className="h-12 w-12 text-cyan-400"
                      containerClassName="border-0 bg-transparent"
                    />
                  </div>
                  <div>
                    <h4 className="font-bold text-lg text-white">Tu carrito está vacío</h4>
                    <p className="max-w-xs text-xs text-gray-400 mt-1">
                      Explora las tiendas en el mapa y agrega los repuestos o baterías que necesitas.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={onClose}
                    className="mt-2 px-5 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 border border-white/10 text-white font-medium text-xs transition-colors cursor-pointer"
                  >
                    Explorar tiendas
                  </button>
                </div>
              ) : (
                <ul className="flex flex-col gap-3">
                  <AnimatePresence initial={false}>
                    {items.map((item) => (
                      <CartDrawerItem
                        key={item.productId}
                        item={item}
                        canSwipe={isMobileDrawer}
                        onDecrease={handleDecrease}
                        onIncrease={handleIncrease}
                        onRemove={handleRemove}
                      />
                    ))}
                  </AnimatePresence>
                </ul>
              )}
            </div>

            {/* Footer con subtotal y CTA */}
            {!isEmptyState && !isHydrationPending && (
              <div className="border-t border-white/[0.08] bg-gray-950/95 backdrop-blur-md px-5 sm:px-6 py-4 safe-bottom-pad">
                <div className="space-y-2 mb-4">
                  <div className="flex items-center justify-between text-xs text-gray-400">
                    <span>Subtotal productos ({itemCount} {itemCount === 1 ? 'ítem' : 'ítems'})</span>
                    <AnimatedCurrencyValue
                      value={subtotal}
                      className="font-medium text-gray-300 tabular-nums"
                    />
                  </div>

                  <div className="flex items-center justify-between text-xs text-gray-400">
                    <span>Costo de envío</span>
                    <span className="text-emerald-400 font-medium">Calculado en checkout</span>
                  </div>

                  <div className="pt-2 border-t border-white/[0.06] flex items-baseline justify-between">
                    <span className="text-sm font-semibold text-white">Total Estimado</span>
                    <AnimatedCurrencyValue
                      value={subtotal}
                      className="text-xl font-bold tabular-nums text-white text-cyan-300"
                    />
                  </div>
                </div>

                <button
                  type="button"
                  onClick={onCheckout}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-400 to-blue-500 hover:from-cyan-300 hover:to-blue-400 px-5 py-3.5 text-sm font-bold text-black shadow-[0_0_25px_rgba(34,211,238,0.35)] transition-all active:scale-[0.99] cursor-pointer"
                >
                  <span>Continuar a checkout</span>
                  <ArrowRight size={18} />
                </button>
              </div>
            )}
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
