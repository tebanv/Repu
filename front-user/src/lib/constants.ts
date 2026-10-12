import type { Coordinates } from '@/types';

export const DEFAULT_LOCATION: Coordinates = {
  lat: 6.2232,
  lng: -75.6016,
};

export const DEFAULT_ZOOM = 13; // Zoom level for city view

/* Estados de permisos de ubicación */
export const LOCATION_PERMISSION_STATUS = {
  IDLE: 'idle',
  PENDING: 'pending',
  GRANTED: 'granted',
  DENIED: 'denied',
} as const;

export type LocationPermissionStatus =
  (typeof LOCATION_PERMISSION_STATUS)[keyof typeof LOCATION_PERMISSION_STATUS];

/* Mensajes de error comunes */
export const ERROR_MESSAGES = {
  LOCATION_DENIED: 'Permiso de ubicación denegado, recargue la página para intentarlo de nuevo.',
  LOCATION_UNAVAILABLE: 'No se pudo obtener la ubicación.',
  API_ERROR: 'Error al consultar la API de tiendas.',
} as const;
