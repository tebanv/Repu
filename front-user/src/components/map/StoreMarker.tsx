'use client';

import React from 'react';
import type { Store } from '@/types';

// Estilos base del marcador
const baseStyles = {
  container: `
    relative flex items-center justify-center
    w-10 h-10 sm:w-11 sm:h-11
    rounded-full cursor-pointer
    transition-all duration-300 ease-out
    group
  `,
  outerRing: `
    absolute inset-0 rounded-full
    bg-accent/20 border border-accent/50
    animate-ping
  `,
  innerCircle: `
    relative flex items-center justify-center
    w-full h-full rounded-full
    bg-gradient-to-br from-gray-900 via-gray-800 to-black
    border-2 border-accent/60
    shadow-[0_0_12px_2px_var(--color-accent)]
    group-hover:shadow-[0_0_20px_6px_var(--color-accent)]
    group-hover:scale-110 group-hover:border-accent
    transition-all duration-300
  `,
  icon: `
    text-accent group-hover:text-white
    transition-colors duration-300
  `,
  selectedContainer: `
    scale-110 z-10
  `,
  selectedInner: `
    border-accent shadow-[0_0_24px_8px_var(--color-accent)]
  `,
  selectedIcon: `
    text-white
  `,
};

export interface StoreMarkerProps {
  store?: Store | null;
  selected?: boolean;
  onClick?: () => void;
}

export default function StoreMarker({
  store,
  selected = false,
  onClick,
}: StoreMarkerProps) {
  return (
    <div
      className={`
        ${baseStyles.container}
        ${selected ? baseStyles.selectedContainer : ''}
      `}
      onClick={onClick}
      title={store?.name || 'Tienda'}
      role="button"
      aria-label={`Ver tienda ${store?.name || ''}`}
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick?.();
        }
      }}
    >
      {/* Anillo pulsante exterior - solo visible cuando está seleccionado */}
      {selected && (
        <span
          className={baseStyles.outerRing}
          style={{ animationDuration: '1.5s' }}
        />
      )}

      {/* Círculo interior principal */}
      <div
        className={`
          ${baseStyles.innerCircle}
          ${selected ? baseStyles.selectedInner : ''}
        `}
      >
        {/* Icono de tienda animado */}
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`
            ${baseStyles.icon}
            ${selected ? baseStyles.selectedIcon : ''}
          `}
        >
          <g className={selected ? 'is-active' : ''}>
            {/* Base del local */}
            <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />

            {/* Puerta */}
            <path
              className="store-door"
              d="M15 22v-4a2 2 0 0 0-2-2h-2a2 2 0 0 0-2 2v4"
            />

            {/* Toldo */}
            <path
              className="store-roof"
              d="m2 7 4.41-4.41A2 2 0 0 1 7.83 2h8.34a2 2 0 0 1 1.42.59L22 7"
            />
            <path
              className="store-roof"
              d="M2 9.782a2 2 0 0 0 2 2.218h16a2 2 0 0 0 2-2.218l-1.468-6.191A2 2 0 0 0 18.602 2H5.398a2 2 0 0 0-1.93 1.591Z"
            />
          </g>
        </svg>
      </div>

      {/* Punto de pulso sutil cuando NO está seleccionado */}
      {!selected && (
        <span
          className="absolute inset-0 rounded-full bg-accent/30 animate-pulse"
          style={{ animationDuration: '2s' }}
        />
      )}
    </div>
  );
}
