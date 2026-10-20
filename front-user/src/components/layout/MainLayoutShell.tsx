'use client';

import React, { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import useAuthStore, { useAuthHasHydrated } from '@/store/authStore';
import useCartStore, { useCartHasHydrated, useCartNotice } from '@/store/cartStore';
import useToastStore from '@/store/toastStore';
import ToastViewport from '@/components/ui/ToastViewport';

export default function MainLayoutShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const isAuthLoading = useAuthStore((state) => state.isLoading);
  const initializeAuth = useAuthStore((state) => state.initialize);
  const authHasHydrated = useAuthHasHydrated();
  const cartHasHydrated = useCartHasHydrated();
  const cartNotice = useCartNotice();
  const clearCartNotice = useCartStore((state) => state.clearCartNotice);
  const pushToast = useToastStore((state) => state.pushToast);
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    // Revalida la sesión local contra Supabase una vez por montaje del
    // grupo protegido. Idempotente: llamadas concurrentes comparten vuelo.
    void initializeAuth();
  }, [initializeAuth]);

  useEffect(() => {
    // Esperar rehidratación + validación contra el servidor antes de decidir:
    // con solo `auth-storage` local se colaría sesión rancia tras expiración.
    if (!authHasHydrated || isAuthLoading) {
      return;
    }

    if (!isAuthenticated) {
      router.push('/login');
    } else {
      setIsChecking(false);
    }
  }, [authHasHydrated, isAuthLoading, isAuthenticated, router, pathname]);

  useEffect(() => {
    if (!cartHasHydrated || !cartNotice) {
      return;
    }

    pushToast({
      variant: 'warning',
      title: 'Carrito expirado',
      message: cartNotice.message,
      duration: 6000,
    });
    clearCartNotice();
  }, [cartNotice, clearCartNotice, cartHasHydrated, pushToast]);

  if (isChecking || isAuthLoading || !authHasHydrated) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-atomic-cyan-400 mb-4" />
          <p className="text-gray-400">Verificando credenciales...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      {children}
      <ToastViewport />
    </>
  );
}
