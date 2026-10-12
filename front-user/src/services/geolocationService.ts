import type { Coordinates } from '@/types';

export interface GeolocationCustomOptions extends PositionOptions {}

export interface GeolocationErrorPayload {
  code: string;
  message: string;
}

/**
 * Obtiene la ubicación actual del usuario usando la API de geolocalización del navegador.
 */
export function getCurrentPosition(
  options: GeolocationCustomOptions = {
    enableHighAccuracy: true,
    timeout: 10000,
    maximumAge: 0,
  }
): Promise<Coordinates> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || !navigator.geolocation) {
      reject({ code: 'UNAVAILABLE', message: 'Geolocation API not available' });
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
      },
      (err) => {
        reject(err);
      },
      options
    );
  });
}
