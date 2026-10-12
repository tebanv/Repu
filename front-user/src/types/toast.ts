// Modelos del sistema global de notificaciones (Toasts)

export type ToastVariant = 'success' | 'info' | 'warning' | 'error';

export interface Toast {
  id: string;
  title: string | null;
  message: string;
  variant: ToastVariant;
  duration: number;
}

export interface ToastPayload {
  title?: string | null;
  message: string;
  variant?: ToastVariant;
  duration?: number;
}
