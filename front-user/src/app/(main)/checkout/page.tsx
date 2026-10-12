'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, CheckCircle2, MapPin, Clock, ArrowRight, Home } from 'lucide-react';
import { motion } from 'framer-motion';

import CheckoutHeader from '@/components/checkout/CheckoutHeader';
import DeliveryAddressCard from '@/components/checkout/DeliveryAddressCard';
import PaymentMethodSelector from '@/components/checkout/PaymentMethodSelector';
import OrderSummaryCard from '@/components/checkout/OrderSummaryCard';
import useCartStore, { useCartHasHydrated, useCartSummary } from '@/store/cartStore';
import useLocationStore from '@/store/locationStore';
import useOrderStore from '@/store/orderStore';
import useToastStore from '@/store/toastStore';
import { fetchStoreById } from '@/services/api';
import type {
  DeliveryAddress,
  PaymentMethod,
  OrderBreakdown,
  Order,
  Store,
} from '@/types';

export default function CheckoutPage() {
  const router = useRouter();
  const hasHydrated = useCartHasHydrated();
  const cartSummary = useCartSummary();
  const clearCart = useCartStore((state) => state.clearCart);
  const userCoordinates = useLocationStore((state) => state.userCoordinates);
  const createOrder = useOrderStore((state) => state.createOrder);
  const pushToast = useToastStore((state) => state.pushToast);

  const [store, setStore] = useState<Store | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [confirmedOrder, setConfirmedOrder] = useState<Order | null>(null);

  const [address, setAddress] = useState<DeliveryAddress>({
    street: userCoordinates ? 'Ubicación actual detectada por GPS' : 'Calle 10 # 43E-12, El Poblado',
    details: '',
    city: 'Medellín',
    notes: '',
    coordinates: userCoordinates || undefined,
  });

  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('wompi');

  // Redirección si el carrito está vacío y ya rehidrató
  useEffect(() => {
    if (hasHydrated && cartSummary.itemCount === 0 && !confirmedOrder) {
      router.replace('/');
    }
  }, [hasHydrated, cartSummary.itemCount, confirmedOrder, router]);

  // Cargar detalles de la tienda para conocer el costo de envío exacto
  useEffect(() => {
    async function loadStore() {
      if (!cartSummary.storeId) return;
      try {
        const storeData = await fetchStoreById(cartSummary.storeId);
        if (storeData) {
          setStore(storeData);
        }
      } catch (err) {
        console.error('Error al cargar tienda en checkout:', err);
      }
    }

    loadStore();
  }, [cartSummary.storeId]);

  const deliveryFee = store?.deliveryInfo?.fee ?? (cartSummary.subtotal > 80000 ? 0 : 6000);
  const serviceFee = 0; // Sin costos ocultos de plataforma
  const total = cartSummary.subtotal + deliveryFee + serviceFee;

  const breakdown: OrderBreakdown = {
    subtotal: cartSummary.subtotal,
    deliveryFee,
    serviceFee,
    total,
  };

  const handleConfirmOrder = async () => {
    if (!address.street || address.street.trim().length < 3) {
      pushToast({
        variant: 'warning',
        title: 'Dirección requerida',
        message: 'Por favor ingresa una dirección válida para la entrega.',
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const storeCoords =
        store?.lat !== undefined && store?.lng !== undefined
          ? { lat: store.lat, lng: store.lng }
          : undefined;

      const newOrder = await createOrder({
        storeId: cartSummary.storeId || 'store-generic',
        storeName: cartSummary.storeName || 'Tienda de Repuestos',
        storeSlug: cartSummary.storeSlug || 'tienda',
        storeCoordinates: storeCoords,
        items: cartSummary.items,
        deliveryAddress: address,
        paymentMethod,
        breakdown,
        estimatedDeliveryMinutes: store?.deliveryInfo?.avgPrepTime ? store.deliveryInfo.avgPrepTime + 15 : 25,
      });

      // Vaciar carrito
      clearCart();
      setConfirmedOrder(newOrder);

      pushToast({
        variant: 'success',
        title: '¡Pedido Confirmado!',
        message: `Tu pedido ${newOrder.id} ha sido enviado a la tienda.`,
      });
    } catch (err) {
      console.error('Error al crear pedido:', err);
      pushToast({
        variant: 'error',
        title: 'Error al procesar pedido',
        message: 'No pudimos registrar tu orden. Intenta nuevamente.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!hasHydrated) {
    return (
      <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center text-white">
        <Loader2 className="w-8 h-8 text-cyan-400 animate-spin mb-3" />
        <p className="text-gray-400 text-sm">Cargando detalles de tu pedido...</p>
      </div>
    );
  }

  // Vista de Éxito / Confirmación de Pedido
  if (confirmedOrder) {
    return (
      <div className="min-h-screen bg-gray-950 text-white flex flex-col justify-between">
        <CheckoutHeader storeName={confirmedOrder.storeName} />

        <main className="max-w-xl mx-auto px-4 py-12 flex-1 flex flex-col justify-center">
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.35 }}
            className="bg-gradient-to-br from-gray-900 via-gray-900/90 to-gray-950 border border-cyan-500/30 rounded-3xl p-6 sm:p-8 shadow-[0_0_50px_rgba(34,211,238,0.15)] text-center relative overflow-hidden"
          >
            <div className="w-16 h-16 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center mx-auto mb-4 text-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.3)]">
              <CheckCircle2 size={36} />
            </div>

            <span className="px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 font-mono text-xs font-bold">
              {confirmedOrder.id}
            </span>

            <h2 className="text-2xl font-bold text-white mt-3 mb-1">
              ¡Pedido Registrado con Éxito!
            </h2>
            <p className="text-gray-400 text-sm mb-6">
              La tienda <strong className="text-white">{confirmedOrder.storeName}</strong> ya recibió tu pedido y está preparando tus repuestos.
            </p>

            <div className="bg-black/40 rounded-2xl p-4 border border-white/10 text-left space-y-3 mb-6 text-xs">
              <div className="flex items-start gap-2.5">
                <MapPin size={16} className="text-cyan-400 flex-shrink-0 mt-0.5" />
                <div>
                  <span className="text-gray-400 block font-medium">Entrega en:</span>
                  <span className="text-white font-semibold">{confirmedOrder.deliveryAddress.street}</span>
                  {confirmedOrder.deliveryAddress.details && (
                    <span className="text-gray-400 block">{confirmedOrder.deliveryAddress.details}</span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-2.5 pt-2 border-t border-white/10">
                <Clock size={16} className="text-cyan-400 flex-shrink-0" />
                <div>
                  <span className="text-gray-400">Tiempo estimado: </span>
                  <span className="text-emerald-400 font-bold">
                    {confirmedOrder.estimatedDeliveryMinutes} minutos
                  </span>
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3">
              <button
                type="button"
                onClick={() => router.push('/')}
                className="flex-1 py-3 px-4 rounded-xl bg-white/10 hover:bg-white/15 border border-white/15 text-white font-medium text-sm flex items-center justify-center gap-2 transition-colors cursor-pointer"
              >
                <Home size={16} />
                <span>Volver al inicio</span>
              </button>

              <button
                type="button"
                onClick={() => router.push(`/order/${confirmedOrder.id}`)}
                className="flex-1 py-3 px-4 rounded-xl bg-gradient-to-r from-cyan-400 to-blue-500 hover:from-cyan-300 hover:to-blue-400 text-black font-bold text-sm flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(34,211,238,0.3)] transition-all cursor-pointer"
              >
                <span>Seguir Pedido</span>
                <ArrowRight size={16} />
              </button>
            </div>
          </motion.div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white pb-20">
      <CheckoutHeader storeName={cartSummary.storeName || undefined} />

      <main className="max-w-5xl mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Columna Izquierda: Formulario de Entrega y Pago (7 cols) */}
          <div className="lg:col-span-7 space-y-6">
            <DeliveryAddressCard
              address={address}
              onChange={setAddress}
            />

            <PaymentMethodSelector
              selectedMethod={paymentMethod}
              onSelect={setPaymentMethod}
            />
          </div>

          {/* Columna Derecha: Resumen de Orden y CTA (5 cols) */}
          <div className="lg:col-span-5">
            <OrderSummaryCard
              items={cartSummary.items}
              storeName={cartSummary.storeName}
              breakdown={breakdown}
              isSubmitting={isSubmitting}
              onSubmit={handleConfirmOrder}
            />
          </div>
        </div>
      </main>
    </div>
  );
}
