// src/services/geocodingService.ts
// Geocodificación con Mapbox (Search API v6) para crear direcciones en el
// checkout (docs/PLAN-PEDIDOS.md §2.3).
//
// Heurística B (costos): solo se llama por una acción explícita del usuario
// ("Usar mi ubicación" o confirmar una dirección escrita sin GPS), nunca por
// movimiento del mapa ni por tecla. `ms-users` exige coordenadas para guardar
// una dirección; esto permite crearla también sin permiso de ubicación.

import type { Coordinates } from '@/types';

const MAPBOX_GEOCODE = 'https://api.mapbox.com/search/geocode/v6';

export interface GeocodedAddress {
  /** Calle y número ("Calle 10 # 43E-12"). */
  street: string;
  city: string;
  coordinates: Coordinates;
}

interface MapboxFeature {
  geometry?: { coordinates?: [number, number] };
  properties?: {
    name?: string;
    full_address?: string;
    context?: { place?: { name?: string }; locality?: { name?: string } };
  };
}

function token(): string | null {
  return process.env.NEXT_PUBLIC_MAPBOX_TOKEN || null;
}

function toGeocoded(feature: MapboxFeature | undefined, fallback?: Coordinates): GeocodedAddress | null {
  const [lng, lat] = feature?.geometry?.coordinates ?? [];
  const coordinates =
    Number.isFinite(lat) && Number.isFinite(lng) ? { lat: lat as number, lng: lng as number } : fallback;
  const props = feature?.properties;
  if (!coordinates || !props) return null;
  return {
    street: props.name?.trim() || props.full_address?.split(',')[0]?.trim() || '',
    city: props.context?.place?.name?.trim() || props.context?.locality?.name?.trim() || '',
    coordinates,
  };
}

async function query(url: URL): Promise<MapboxFeature[]> {
  // `credentials: 'omit'`: es un servicio externo; la cookie de sesión no debe viajar.
  const response = await fetch(url, { credentials: 'omit', cache: 'no-store' });
  if (!response.ok) throw new Error(`Geocodificación no disponible (${response.status})`);
  const body = (await response.json()) as { features?: MapboxFeature[] };
  return body.features ?? [];
}

/** Coordenadas → dirección legible. Conserva las coordenadas del GPS. */
export async function reverseGeocode(coordinates: Coordinates): Promise<GeocodedAddress | null> {
  const accessToken = token();
  if (!accessToken) return null;
  const url = new URL(`${MAPBOX_GEOCODE}/reverse`);
  url.searchParams.set('longitude', String(coordinates.lng));
  url.searchParams.set('latitude', String(coordinates.lat));
  url.searchParams.set('types', 'address');
  url.searchParams.set('language', 'es');
  url.searchParams.set('limit', '1');
  url.searchParams.set('access_token', accessToken);
  const [feature] = await query(url);
  // Se devuelven las coordenadas del GPS, no las del punto geocodificado.
  const result = toGeocoded(feature, coordinates);
  return result ? { ...result, coordinates } : null;
}

/** Dirección escrita → coordenadas (Colombia, sesgado cerca del usuario). */
export async function forwardGeocode(
  text: string,
  proximity?: Coordinates | null,
): Promise<GeocodedAddress | null> {
  const accessToken = token();
  if (!accessToken || !text.trim()) return null;
  const url = new URL(`${MAPBOX_GEOCODE}/forward`);
  url.searchParams.set('q', text.trim());
  url.searchParams.set('country', 'co');
  url.searchParams.set('types', 'address,street');
  url.searchParams.set('language', 'es');
  url.searchParams.set('limit', '1');
  if (proximity) url.searchParams.set('proximity', `${proximity.lng},${proximity.lat}`);
  url.searchParams.set('access_token', accessToken);
  const [feature] = await query(url);
  return toGeocoded(feature);
}
