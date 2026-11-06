'use client';

// Checkout contra `ms-orders` (docs/PLAN-PEDIDOS.md §2.3–§2.6).
//
// Flujo de "Confirmar pedido":
// 1. `flushSync()`: el carrito del servidor queda igual al local (el checkout
//    convierte el carrito del servidor, no el local).
// 2. Dirección: la guardada seleccionada o, si es nueva, se crea en `ms-users`
//    (con coordenadas del GPS o geocodificadas) y se recuerda para reintentos.
// 3. Clave de idempotencia por intento (`sessionStorage`): un reintento tras
//    un fallo de red no duplica el pedido.
// 4. `createOrder` → `ms-orders`; con `201` se limpia solo el carrito local.

import React, { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, CheckCircle2, MapPin, Clock, ArrowRight, Home } from 'lucide-react';
import { motion } from 'framer-motion';

import CheckoutHeader from '@/components/checkout/CheckoutHeader';
import DeliveryAddressCard, {
  type AddressDraft,
  type AddressLoadStatus,
  type AddressMode,
} from '@/components/checkout/DeliveryAddressCard';
import PaymentMethodSelector from '@/components/checkout/PaymentMethodSelector';
import OrderSummaryCard from '@/components/checkout/OrderSummaryCard';
import useCartStore, { useCartHasHydrated, useCartSummary } from '@/store/cartStore';
import useLocationStore from '@/store/locationStore';
import useOrderStore from '@/store/orderStore';
import useToastStore from '@/store/toastStore';
import { fetchStoreBySlug } from '@/services/api';
import {
  createAddress,
  invalidateAddresses,
  loadAddresses,
  pickDefaultAddress,
} from '@/services/addressService';
import { forwardGeocode, reverseGeocode } from '@/services/geocodingService';
import { describeCheckoutError } from '@/services/orderService';
import {
  checkoutFingerprint,
  clearCheckoutAttempt,
  getCheckoutAttemptKey,
} from '@/lib/checkoutAttempt';
import { formatOrderNumber } from '@/lib/orderFormat';
import type { OrderBreakdown, Order, PaymentMethod, SavedAddress, Store } from '@/types';

const EMPTY_DRAFT: AddressDraft = { name: '', street: '', details: '', city: '', coordinates: null };

export default function CheckoutPage() {
  const router = useRouter();
  const hasHydrated = useCartHasHydrated();
  const cartSummary = useCartSummary();
  const flushCartSync = useCartStore((state) => state.flushSync);
  const syncCartWithServer = useCartStore((state) => state.syncWithServer);
  const resetCartAfterCheckout = useCartStore((state) => state.resetAfterCheckout);
  const userCoordinates = useLocationStore((state) => state.userCoordinates);
  const requestLocation = useLocationStore((state) => state.requestPermission);
  const createOrder = useOrderStore((state) => state.createOrder);
  const pushToast = useToastStore((state) => state.pushToast);

  const [store, setStore] = useState<Store | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [confirmedOrder, setConfirmedOrder] = useState<Order | null>(null);

  // Direcciones de `ms-users`
  const [addresses, setAddresses] = useState<SavedAddress[]>([]);
  const [addressStatus, setAddressStatus] = useState<AddressLoadStatus>('loading');
  const [addressMode, setAddressMode] = useState<AddressMode>('saved');
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null);
  const [draft, setDraft] = useState<AddressDraft>(EMPTY_DRAFT);
  const [notes, setNotes] = useState('');
  const [isLocating, setIsLocating] = useState(false);

  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('wompi');

  // Redirección si el carrito está vacío y ya rehidrató
  useEffect(() => {
    if (hasHydrated && cartSummary.itemCount === 0 && !confirmedOrder) {
      router.replace('/');
    }
  }, [hasHydrated, cartSummary.itemCount, confirmedOrder, router]);

  // Tienda (por el slug del carrito): ubicación y tiempo de preparación.
  useEffect(() => {
    async function loadStore() {
      if (!cartSummary.storeSlug) return;
      try {
        const storeData = await fetchStoreBySlug(cartSummary.storeSlug);
        if (storeData) {
          setStore(storeData);
        }
      } catch (err) {
        console.error('Error al cargar tienda en checkout:', err);
      }
    }

    loadStore();
  }, [cartSummary.storeSlug]);

  // Direcciones guardadas, en paralelo con la tienda. `loadAddresses`
  // reutiliza la precarga hecha al abrir el carrito.
  const refreshAddresses = useCallback(async (preferId?: string | null) => {
    setAddressStatus('loading');
    try {
      const list = await loadAddresses();
      setAddresses(list);
      setAddressStatus('ready');
      const preferred = list.find((address) => address.id === preferId) ?? pickDefaultAddress(list);
      setSelectedAddressId(preferred?.id ?? null);
      setAddressMode(list.length > 0 ? 'saved' : 'new');
    } catch (err) {
      console.error('Error al cargar direcciones:', err);
      setAddressStatus('error');
    }
  }, []);

  useEffect(() => {
    void refreshAddresses();
  }, [refreshAddresses]);

  // Sin direcciones guardadas: el GPS ya concedido precarga las coordenadas.
  useEffect(() => {
    if (userCoordinates && addressMode === 'new' && !draft.coordinates) {
      setDraft((current) => ({ ...current, coordinates: userCoordinates }));
    }
  }, [userCoordinates, addressMode, draft.coordinates]);

  /** "Usar mi ubicación": GPS + una geocodificación inversa (solo por esta acción). */
  const handleUseMyLocation = useCallback(async () => {
    setIsLocating(true);
    try {
      let coordinates = useLocationStore.getState().userCoordinates;
      if (!coordinates) {
        await requestLocation();
        coordinates = useLocationStore.getState().userCoordinates;
      }
      if (!coordinates) {
        pushToast({
          variant: 'warning',
          title: 'Ubicación no disponible',
          message: 'Activa el permiso de ubicación o escribe tu dirección.',
        });
        return;
      }
      const found = await reverseGeocode(coordinates).catch(() => null);
      setDraft((current) => ({
        ...current,
        coordinates,
        street: found?.street || current.street,
        city: found?.city || current.city,
      }));
    } finally {
      setIsLocating(false);
    }
  }, [pushToast, requestLocation]);

  // El costo de envío lo calculará el backend (K2): hasta entonces queda
  // "por confirmar" y no se suma, para que lo mostrado sea lo cobrado.
  const breakdown: OrderBreakdown = {
    subtotal: cartSummary.subtotal,
    deliveryFee: null,
    serviceFee: 0,
    total: cartSummary.subtotal,
  };

  /** Devuelve el id de la dirección a usar, creándola si es nueva. */
  const resolveAddressId = async (): Promise<string | null> => {
    if (addressMode === 'saved' && selectedAddressId) return selectedAddressId;

    const street = draft.street.trim();
    const city = draft.city.trim();
    if (street.length < 3 || !city) {
      pushToast({
        variant: 'warning',
        title: 'Dirección requerida',
        message: 'Escribe la dirección y la ciudad de entrega.',
      });
      return null;
    }

    // `ms-users` exige coordenadas: GPS o, si no hay, la dirección escrita.
    const coordinates =
      draft.coordinates ??
      (await forwardGeocode(`${street}, ${city}`, userCoordinates).catch(() => null))?.coordinates ??
      null;
    if (!coordinates) {
      pushToast({
        variant: 'warning',
        title: 'No encontramos la dirección',
        message: 'Revisa la dirección o usa tu ubicación actual.',
      });
      return null;
    }

    const created = await createAddress({
      name: draft.name.trim() || draft.details.trim() || 'Mi dirección',
      fullAddress: [street, draft.details.trim()].filter(Boolean).join(', '),
      city,
      coordinates,
      isPrimary: addresses.length === 0,
    });
    // Se recuerda y se selecciona: un reintento no vuelve a crearla.
    setAddresses((current) => [created, ...current]);
    setSelectedAddressId(created.id);
    setAddressMode('saved');
    setDraft(EMPTY_DRAFT);
    return created.id;
  };

  const handleConfirmOrder = async () => {
    const storeId = cartSummary.storeId;
    if (!storeId || isSubmitting) return;
    if (addressStatus !== 'ready') {
      pushToast({
        variant: 'warning',
        title: 'Dirección pendiente',
        message:
          addressStatus === 'loading'
            ? 'Estamos cargando tus direcciones; inténtalo en un momento.'
            : 'No pudimos cargar tus direcciones. Pulsa "Reintentar".',
      });
      return;
    }

    setIsSubmitting(true);
    try {
      // 1. El servidor debe tener exactamente el carrito que ve el usuario.
      const sync = await flushCartSync();
      if (!sync.ok) {
        pushToast({
          variant: 'error',
          title: 'Carrito sin sincronizar',
          message: 'No pudimos guardar los últimos cambios de tu carrito. Revisa tu conexión e inténtalo de nuevo.',
        });
        return;
      }
      const cartAfterSync = useCartStore.getState();
      if (cartAfterSync.itemCount === 0 || cartAfterSync.storeId !== storeId) return;

      // 2. Dirección
      const addressId = await resolveAddressId();
      if (!addressId) return;

      // 3. Clave del intento (reutilizada si nada cambió desde el último fallo)
      const customerNotes = notes.trim() || null;
      const idempotencyKey = getCheckoutAttemptKey(
        checkoutFingerprint({ storeId, addressId, customerNotes })
      );

      const storeCoords =
        store?.lat !== undefined && store?.lng !== undefined
          ? { lat: store.lat, lng: store.lng }
          : undefined;

      // 4. Pedido real
      const newOrder = await createOrder({
        storeId,
        storeName: cartSummary.storeName || 'Tienda de Repuestos',
        storeSlug: cartSummary.storeSlug || '',
        storeCoordinates: storeCoords,
        addressId,
        customerNotes,
        idempotencyKey,
        paymentMethod,
        estimatedDeliveryMinutes: store?.deliveryInfo?.avgPrepTime ? store.deliveryInfo.avgPrepTime + 15 : 25,
        cartItems: cartAfterSync.items,
      });

      clearCheckoutAttempt();
      // Primero la confirmación: así vaciar el carrito no dispara el redirect.
      setConfirmedOrder(newOrder);
      resetCartAfterCheckout();

      pushToast({
        variant: 'success',
        title: '¡Pedido Confirmado!',
        message: `Tu pedido ${formatOrderNumber(newOrder)} ha sido enviado a la tienda.`,
      });
    } catch (err) {
      const info = describeCheckoutError(err);
      if (info.recovery !== 'session') {
        pushToast({ variant: 'error', title: info.title, message: info.message });
      }
      if (info.recovery === 'refresh_cart') {
        void syncCartWithServer();
      } else if (info.recovery === 'refresh_addresses') {
        invalidateAddresses();
        void refreshAddresses();
      } else if (info.recovery === 'new_attempt') {
        clearCheckoutAttempt();
      }
      // `retry`: se conserva la clave; el siguiente intento no duplica.
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
              {formatOrderNumber(confirmedOrder)}
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
              addresses={addresses}
              status={addressStatus}
              onRetry={() => {
                invalidateAddresses();
                void refreshAddresses(selectedAddressId);
              }}
              mode={addressMode}
              onModeChange={setAddressMode}
              selectedId={selectedAddressId}
              onSelect={setSelectedAddressId}
              draft={draft}
              onDraftChange={setDraft}
              onUseMyLocation={() => void handleUseMyLocation()}
              isLocating={isLocating}
              notes={notes}
              onNotesChange={setNotes}
              disabled={isSubmitting}
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
