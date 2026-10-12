'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Loader2, AlertCircle, ArrowLeft, Home, Sparkles } from 'lucide-react';
import useToastStore from '@/store/toastStore';
import useOrderStore from '@/store/orderStore';
import OrderTrackingHeader from '@/components/tracking/OrderTrackingHeader';
import OrderTrackingMap from '@/components/tracking/OrderTrackingMap';
import OrderTimeline from '@/components/tracking/OrderTimeline';
import DriverCard from '@/components/tracking/DriverCard';
import OrderDetailsAccordion from '@/components/tracking/OrderDetailsAccordion';
import OrderRatingModal from '@/components/tracking/OrderRatingModal';
import type { OrderStatus, OrderRating } from '@/types';

export default function OrderTrackingPage() {
  const params = useParams();
  const router = useRouter();
  const rawId = params?.id;
  const orderId = Array.isArray(rawId) ? rawId[0] : (rawId as string);

  const { orders, updateOrderStatus, rateOrder } = useOrderStore();
  const { pushToast } = useToastStore();
  const [hasMounted, setHasMounted] = useState(false);
  const [isRatingModalOpen, setIsRatingModalOpen] = useState(false);

  useEffect(() => {
    setHasMounted(true);
  }, []);

  const order = orders.find((o) => o.id === orderId);

  // Abrir modal de calificación automáticamente cuando la orden pasa a ENTREGADO
  useEffect(() => {
    if (order && order.status === 'ENTREGADO' && !order.rating) {
      const timer = setTimeout(() => {
        setIsRatingModalOpen(true);
      }, 1200);
      return () => clearTimeout(timer);
    }
  }, [order?.status, order?.rating]);

  if (!hasMounted) {
    return (
      <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center text-white">
        <Loader2 className="w-8 h-8 text-cyan-400 animate-spin mb-3" />
        <p className="text-gray-400 text-sm">Cargando seguimiento de tu pedido...</p>
      </div>
    );
  }

  // Estado: Pedido no encontrado
  if (!order) {
    return (
      <div className="min-h-screen bg-gray-950 text-white flex flex-col justify-between">
        <header className="px-4 py-4 border-b border-white/10 flex items-center justify-between">
          <Link
            href="/"
            className="flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors"
          >
            <ArrowLeft size={16} />
            <span>Volver a Tiendas</span>
          </Link>
          <span className="font-mono text-xs text-gray-500">{orderId}</span>
        </header>

        <main className="max-w-md mx-auto px-4 py-12 text-center">
          <div className="w-16 h-16 rounded-3xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center mx-auto mb-4 text-rose-400 shadow-[0_0_25px_rgba(244,63,94,0.2)]">
            <AlertCircle size={32} />
          </div>
          <h2 className="text-xl font-bold text-white mb-2">Pedido no Encontrado</h2>
          <p className="text-xs text-gray-400 mb-6 leading-relaxed">
            No encontramos ningún pedido activo con el código <strong className="text-white font-mono">{orderId}</strong> en tu dispositivo.
          </p>

          <button
            type="button"
            onClick={() => router.push('/')}
            className="w-full py-3 px-4 rounded-xl bg-gradient-to-r from-cyan-400 to-blue-500 hover:from-cyan-300 hover:to-blue-400 text-black font-bold text-xs flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(34,211,238,0.3)] transition-all cursor-pointer"
          >
            <Home size={16} />
            <span>Ir al Mapa Principal</span>
          </button>
        </main>

        <footer className="py-4 text-center text-[11px] text-gray-600 border-t border-white/5">
          Repu Delivery · Sistema de Logística de Repuestos
        </footer>
      </div>
    );
  }

  const handleAdvanceStatus = (nextStatus: OrderStatus) => {
    updateOrderStatus(order.id, nextStatus);
  };

  const handleRatingSubmit = (rating: OrderRating) => {
    rateOrder(order.id, rating);
    setIsRatingModalOpen(false);
    pushToast({
      variant: 'success',
      title: '¡Gracias por calificar!',
      message: 'Tu opinión nos ayuda a mantener la mejor calidad en repuestos y entrega.',
    });
    router.push('/');
  };

  const handleSkipRating = () => {
    setIsRatingModalOpen(false);
    pushToast({
      variant: 'info',
      title: '¡Pedido finalizado!',
      message: 'Gracias por comprar en Repu. ¡Esperamos verte pronto!',
    });
    router.push('/');
  };

  const handleCloseModal = () => {
    setIsRatingModalOpen(false);
    router.push('/');
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col">
      {/* Header Fijo */}
      <OrderTrackingHeader
        orderId={order.id}
        storeName={order.storeName}
        status={order.status}
        estimatedMinutes={order.estimatedDeliveryMinutes}
      />

      {/* Contenido Principal */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-3 sm:px-4 py-4 sm:py-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 sm:gap-6 items-start">
          {/* Columna Izquierda: Línea de tiempo, Domiciliario y Acordeón */}
          <div className="lg:col-span-5 space-y-4 order-2 lg:order-1">
            {/* Línea de Tiempo Reactiva */}
            <OrderTimeline
              order={order}
              onAdvanceStatus={handleAdvanceStatus}
              showDevControls={true}
            />

            {/* Tarjeta del Domiciliario */}
            {order.driver && (
              <DriverCard
                driver={order.driver}
                storeName={order.storeName}
              />
            )}

            {/* Acordeón de Repuestos y Pago */}
            <OrderDetailsAccordion order={order} />

            {/* Banner si ya fue calificado */}
            {order.rating && (
              <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/25 flex items-center justify-between text-xs text-emerald-300">
                <div className="flex items-center gap-2">
                  <Sparkles size={16} className="text-emerald-400" />
                  <span>Pedido calificado ({order.rating.storeRating}★ tienda / {order.rating.driverRating}★ repartidor)</span>
                </div>
                <button
                  type="button"
                  onClick={() => setIsRatingModalOpen(true)}
                  className="text-emerald-400 hover:underline text-[11px] font-semibold cursor-pointer"
                >
                  Editar
                </button>
              </div>
            )}
          </div>

          {/* Columna Derecha: Mapa de Tracking en Tiempo Real */}
          <div className="lg:col-span-7 order-1 lg:order-2 lg:sticky lg:top-20">
            <OrderTrackingMap
              storeCoordinates={order.storeCoordinates}
              deliveryCoordinates={order.deliveryAddress.coordinates}
              driverCoordinates={order.driverCoordinates}
              storeName={order.storeName}
              destinationStreet={order.deliveryAddress.street}
              status={order.status}
              className="h-[360px] sm:h-[420px] lg:h-[580px]"
            />
          </div>
        </div>
      </main>

      {/* Modal de Calificación Post-Venta con redirección al inicio */}
      <OrderRatingModal
        isOpen={isRatingModalOpen}
        storeName={order.storeName}
        driverName={order.driver?.name}
        onClose={handleCloseModal}
        onSkip={handleSkipRating}
        onSubmitRating={handleRatingSubmit}
      />
    </div>
  );
}
