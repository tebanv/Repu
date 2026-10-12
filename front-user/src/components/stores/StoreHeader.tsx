'use client';

/**
 * StoreHeader: Cabecera de la página de tienda con banner y logo holográficos.
 * Cuando no hay imagen, muestra un placeholder con efecto holográfico animado.
 */

import React from 'react';
import { motion } from 'framer-motion';
import { Store as StoreIcon, Star, Clock, Truck, ArrowLeft, Package } from 'lucide-react';
import { useRouter } from 'next/navigation';
import type { Store, StoreSchedule } from '@/types';

function formatCurrency(value?: number | null): string {
  if (value === undefined || value === null) return '$ 0';
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

function isStoreOpen(schedule?: StoreSchedule | null): boolean | null {
  if (!schedule) return null;

  const days: (keyof StoreSchedule)[] = [
    'sunday',
    'monday',
    'tuesday',
    'wednesday',
    'thursday',
    'friday',
    'saturday',
  ];
  const now = new Date();
  const dayName = days[now.getDay()];
  const todaySchedule = schedule[dayName];

  if (!todaySchedule) return false;

  const currentTime = now.getHours() * 60 + now.getMinutes();
  const [openH, openM] = todaySchedule.open.split(':').map(Number);
  const [closeH, closeM] = todaySchedule.close.split(':').map(Number);
  const openMinutes = openH * 60 + openM;
  const closeMinutes = closeH * 60 + closeM;

  return currentTime >= openMinutes && currentTime < closeMinutes;
}

function getScheduleText(schedule?: StoreSchedule | null): string {
  if (!schedule) return 'Horario no disponible';

  const days: (keyof StoreSchedule)[] = [
    'sunday',
    'monday',
    'tuesday',
    'wednesday',
    'thursday',
    'friday',
    'saturday',
  ];
  const now = new Date();
  const dayName = days[now.getDay()];
  const todaySchedule = schedule[dayName];

  if (!todaySchedule) return 'Cerrado hoy';
  return `${todaySchedule.open} - ${todaySchedule.close}`;
}

export interface StoreHeaderProps {
  store: Store | null;
}

export default function StoreHeader({ store }: StoreHeaderProps) {
  const router = useRouter();

  if (!store) return null;

  const isOpen = isStoreOpen(store.schedule);
  const scheduleText = getScheduleText(store.schedule);
  const deliveryFee = store.deliveryInfo?.fee || 0;
  const prepTime = store.deliveryInfo?.avgPrepTime || 0;

  return (
    <div className="relative">
      {/* Banner holográfico */}
      <div className="relative h-40 sm:h-48 md:h-56 overflow-hidden">
        {store.banner ? (
          <img
            src={store.banner}
            alt={`Banner de ${store.name}`}
            className="w-full h-full object-cover"
          />
        ) : (
          /* Placeholder holográfico */
          <div
            className="absolute inset-0"
            style={
              {
                '--holo-purple': '#0ea5e9',
                '--holo-magenta': '#0284c7',
              } as React.CSSProperties
            }
          >
            {/* Capa 1: Ruido */}
            <div className="absolute inset-0 holo-noise opacity-[0.04]" />

            {/* Capa 2: Gradiente animado */}
            <div className="absolute inset-0 holo-gradient opacity-40" />

            {/* Capa 3: Base oscura */}
            <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-black/40 to-black/80" />

            {/* Patrón geométrico sutil */}
            <div
              className="absolute inset-0 opacity-5"
              style={{
                backgroundImage: `
                  linear-gradient(30deg, var(--color-accent) 12%, transparent 12.5%, transparent 87%, var(--color-accent) 87.5%, var(--color-accent)),
                  linear-gradient(150deg, var(--color-accent) 12%, transparent 12.5%, transparent 87%, var(--color-accent) 87.5%, var(--color-accent)),
                  linear-gradient(30deg, var(--color-accent) 12%, transparent 12.5%, transparent 87%, var(--color-accent) 87.5%, var(--color-accent)),
                  linear-gradient(150deg, var(--color-accent) 12%, transparent 12.5%, transparent 87%, var(--color-accent) 87.5%, var(--color-accent))
                `,
                backgroundSize: '40px 70px',
                backgroundPosition: '0 0, 0 0, 20px 35px, 20px 35px',
              }}
            />

            {/* Scanlines */}
            <div className="absolute inset-0 holo-scanlines opacity-[0.03]" />
          </div>
        )}

        {/* Overlay gradiente inferior */}
        <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-black to-transparent" />

        {/* Botón volver */}
        <motion.button
          onClick={() => router.back()}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          className="absolute top-4 left-4 z-20 p-2.5 rounded-full bg-black/50 backdrop-blur-md border border-white/10 text-white hover:bg-black/70 transition-colors"
        >
          <ArrowLeft size={20} />
        </motion.button>
      </div>

      {/* Contenedor del logo y info */}
      <div className="relative px-4 -mt-12">
        <div className="flex items-end gap-4">
          {/* Logo holográfico */}
          <div className="relative flex-shrink-0">
            {store.logo ? (
              <img
                src={store.logo}
                alt={`Logo de ${store.name}`}
                className="w-20 h-20 sm:w-24 sm:h-24 rounded-xl object-cover border-2 border-white/20 shadow-lg"
              />
            ) : (
              /* Placeholder logo holográfico */
              <div
                className="relative w-20 h-20 sm:w-24 sm:h-24 rounded-xl overflow-hidden border-2 border-accent/30 shadow-lg shadow-accent/20"
                style={
                  {
                    '--holo-purple': '#0ea5e9',
                    '--holo-magenta': '#0284c7',
                  } as React.CSSProperties
                }
              >
                {/* Ruido */}
                <div className="absolute inset-0 holo-noise opacity-[0.05]" />

                {/* Gradiente */}
                <div className="absolute inset-0 holo-gradient opacity-50" />

                {/* Base */}
                <div className="absolute inset-0 backdrop-blur-sm bg-black/60" />

                {/* Borde luminoso */}
                <div className="absolute inset-0 rounded-xl holo-border" />

                {/* Icono */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <StoreIcon size={32} className="text-accent drop-shadow-[0_0_10px_var(--color-accent)]" />
                </div>
              </div>
            )}
          </div>

          {/* Info principal */}
          <div className="flex-1 min-w-0 pb-1">
            <h1 className="text-xl sm:text-2xl font-bold text-white truncate drop-shadow-lg">
              {store.name}
            </h1>

            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1">
              {/* Rating */}
              <div className="flex items-center gap-1">
                <Star size={14} className="text-yellow-400 fill-yellow-400" />
                <span className="text-yellow-400 text-sm font-semibold">
                  {store.rating?.toFixed(1)}
                </span>
                {store.totalReviews && (
                  <span className="text-gray-400 text-xs">
                    ({store.totalReviews})
                  </span>
                )}
              </div>

              {/* Estado abierto/cerrado */}
              <div className="flex items-center gap-1">
                <Clock size={12} className={isOpen ? 'text-green-400' : 'text-red-400'} />
                <span className={`text-xs font-medium ${isOpen ? 'text-green-400' : 'text-red-400'}`}>
                  {isOpen ? 'Abierto' : 'Cerrado'}
                </span>
                <span className="text-gray-500 text-xs hidden sm:inline">
                  • {scheduleText}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Descripción */}
        {store.description && (
          <p className="text-gray-400 text-sm mt-3 line-clamp-2">
            {store.description}
          </p>
        )}

        {/* Info de delivery */}
        <div className="flex flex-wrap items-center gap-4 mt-4 py-3 border-t border-white/10">
          <div className="flex items-center gap-2">
            <Truck size={16} className="text-accent" />
            <span className="text-sm text-white">
              {deliveryFee === 0 ? (
                <span className="text-green-400 font-medium">Envío gratis</span>
              ) : (
                <span>{formatCurrency(deliveryFee)}</span>
              )}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <Clock size={16} className="text-accent" />
            <span className="text-sm text-white">
              {prepTime} min prep
            </span>
          </div>

          {store.stats?.totalOrders && (
            <div className="flex items-center gap-2">
              <Package size={16} className="text-accent" />
              <span className="text-sm text-gray-400">
                +{store.stats.totalOrders.toLocaleString()} pedidos
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
