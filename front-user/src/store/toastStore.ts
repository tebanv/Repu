'use client';

import { create } from 'zustand';
import type { Toast, ToastPayload, ToastVariant } from '@/types';

const DEFAULT_TOAST_DURATION = 4000;
const MAX_TOAST_DURATION = 10000;
const TOAST_VARIANTS = new Set<ToastVariant>(['success', 'info', 'warning', 'error']);

let fallbackToastId = 0;

function createToastId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  fallbackToastId += 1;
  return `toast-${fallbackToastId}`;
}

function normalizeToastDuration(value?: unknown): number {
  const parsedValue = Number(value);

  if (!Number.isFinite(parsedValue) || parsedValue <= 0) {
    return DEFAULT_TOAST_DURATION;
  }

  return Math.min(Math.round(parsedValue), MAX_TOAST_DURATION);
}

function normalizeToastPayload(toast?: ToastPayload | null): Toast | null {
  if (!toast || typeof toast !== 'object') {
    return null;
  }

  const message = typeof toast.message === 'string' ? toast.message.trim() : '';

  if (!message) {
    return null;
  }

  const title = typeof toast.title === 'string' ? toast.title.trim() : '';
  const variant: ToastVariant = toast.variant && TOAST_VARIANTS.has(toast.variant)
    ? toast.variant
    : 'info';

  return {
    id: createToastId(),
    title: title || null,
    message,
    variant,
    duration: normalizeToastDuration(toast.duration),
  };
}

export interface ToastStoreState {
  toasts: Toast[];
  pushToast: (toast: ToastPayload) => string | null;
  dismissToast: (toastId: string) => void;
  clearToasts: () => void;
}

const useToastStore = create<ToastStoreState>((set) => ({
  toasts: [],

  pushToast: (toast) => {
    const nextToast = normalizeToastPayload(toast);

    if (!nextToast) {
      return null;
    }

    set((state) => ({
      toasts: [...state.toasts, nextToast].slice(-4),
    }));

    return nextToast.id;
  },

  dismissToast: (toastId) => {
    set((state) => ({
      toasts: state.toasts.filter((toast) => toast.id !== toastId),
    }));
  },

  clearToasts: () => {
    set({ toasts: [] });
  },
}));

export default useToastStore;
