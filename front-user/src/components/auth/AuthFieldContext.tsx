'use client';

/**
 * AuthFieldContext — Puente entre el fondo magnético y el formulario de login.
 *
 * Permite que `LoginForm` (y cualquier componente del grupo auth) emita eventos
 * al motor del campo (moods, pulsos, polaridad) sin acoplarlos directamente al
 * canvas. Si el motor no está disponible (fallback estático / reduced-motion),
 * el contexto expone null y los consumidores degradan gracefully.
 */

import { createContext, useContext } from 'react';
import type { MagneticFieldApi } from './MagneticBackground';

export const AuthFieldContext = createContext<MagneticFieldApi | null>(null);

/**
 * Hook de consumo: devuelve la API del campo o null si no hay motor activo.
 * Los consumidores deben guard-clausear antes de emitir eventos.
 */
export function useAuthField(): MagneticFieldApi | null {
  return useContext(AuthFieldContext);
}
