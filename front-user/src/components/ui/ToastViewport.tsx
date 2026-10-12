'use client';

import { useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { AlertTriangle, CheckCircle2, Info, X, XCircle, type LucideIcon } from 'lucide-react';
import useToastStore from '@/store/toastStore';
import type { Toast, ToastVariant } from '@/types';

interface ToastVariantConfig {
  icon: LucideIcon;
  iconClassName: string;
  containerClassName: string;
}

const TOAST_VARIANTS: Record<ToastVariant, ToastVariantConfig> = {
  success: {
    icon: CheckCircle2,
    iconClassName: 'text-emerald-300',
    containerClassName: 'border-emerald-400/20 bg-emerald-500/10 text-emerald-50',
  },
  info: {
    icon: Info,
    iconClassName: 'text-cyan-300',
    containerClassName: 'border-cyan-400/20 bg-cyan-500/10 text-cyan-50',
  },
  warning: {
    icon: AlertTriangle,
    iconClassName: 'text-amber-300',
    containerClassName: 'border-amber-400/20 bg-amber-500/10 text-amber-50',
  },
  error: {
    icon: XCircle,
    iconClassName: 'text-red-300',
    containerClassName: 'border-red-400/20 bg-red-500/10 text-red-50',
  },
};

interface ToastItemProps {
  toast: Toast;
  onDismiss: (id: string) => void;
}

function ToastItem({ toast, onDismiss }: ToastItemProps) {
  const variant = TOAST_VARIANTS[toast.variant] || TOAST_VARIANTS.info;
  const Icon = variant.icon;

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      onDismiss(toast.id);
    }, toast.duration);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [toast.duration, toast.id, onDismiss]);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -16, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      className={`pointer-events-auto flex items-start gap-3 rounded-2xl border px-4 py-3 shadow-xl backdrop-blur-sm ${variant.containerClassName}`}
      role={toast.variant === 'error' ? 'alert' : 'status'}
    >
      <div className={`mt-0.5 flex-shrink-0 ${variant.iconClassName}`}>
        <Icon size={18} />
      </div>

      <div className="min-w-0 flex-1">
        {toast.title ? (
          <p className="text-sm font-semibold text-white">
            {toast.title}
          </p>
        ) : null}

        <p className="text-sm leading-relaxed text-white/90">
          {toast.message}
        </p>
      </div>

      <button
        type="button"
        onClick={() => onDismiss(toast.id)}
        className="rounded-lg bg-black/10 p-2 text-white/70 transition-colors hover:bg-black/20 hover:text-white"
        aria-label="Cerrar notificación"
      >
        <X size={16} />
      </button>
    </motion.div>
  );
}

export default function ToastViewport() {
  const toasts = useToastStore((state) => state.toasts);
  const dismissToast = useToastStore((state) => state.dismissToast);

  if (!toasts.length) {
    return null;
  }

  return (
    <div
      className="pointer-events-none fixed inset-x-0 top-0 z-[80] flex justify-center px-4"
      style={{ paddingTop: 'max(1rem, env(safe-area-inset-top))' }}
    >
      <div className="flex w-full max-w-md flex-col gap-3">
        <AnimatePresence initial={false}>
          {toasts.map((toast) => (
            <ToastItem key={toast.id} toast={toast} onDismiss={dismissToast} />
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
