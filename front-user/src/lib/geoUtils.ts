import type { Coordinates } from '@/types';

/**
 * Calcula la distancia aproximada en metros entre dos coordenadas geográficas.
 */
export function getDistanceMeters(
  firstLocation: Coordinates,
  secondLocation: Coordinates
): number {
  const dLat = (secondLocation.lat - firstLocation.lat) * 111320;
  const avgLat = ((firstLocation.lat + secondLocation.lat) / 2) * (Math.PI / 180);
  const dLng = (secondLocation.lng - firstLocation.lng) * 111320 * Math.cos(avgLat);
  return Math.sqrt(dLat * dLat + dLng * dLng);
}
