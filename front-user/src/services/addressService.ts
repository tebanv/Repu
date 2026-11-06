// src/services/addressService.ts
// Direcciones del usuario en `ms-users` (docs/BACKEND.md §3, `ms-users`).
// La UI y los stores reciben `SavedAddress`; la forma del backend
// (`location { latitude, longitude }`) solo vive aquí.

import { httpClient } from './httpClient';
import type { Coordinates, NewAddressInput, SavedAddress } from '@/types';

const ADDRESSES_PATH = '/ms-users/api/users/addresses';

// --- Respuesta cruda de `ms-users` ---

interface AddressResponse {
  id: string;
  name?: string | null;
  fullAddress?: string | null;
  city?: string | null;
  postalCode?: string | null;
  isPrimary?: boolean | null;
  deliveryNotes?: string | null;
  location?: { latitude?: number | null; longitude?: number | null } | null;
}

function toCoordinates(location: AddressResponse['location']): Coordinates | null {
  const lat = Number(location?.latitude);
  const lng = Number(location?.longitude);
  // `Number(null)` es 0: se exige que ambos valores vengan y sean finitos.
  if (location?.latitude == null || location?.longitude == null) return null;
  return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
}

function emptyToNull(value?: string | null): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

/** Adaptador `AddressResponse` → `SavedAddress`. Exportado para pruebas. */
export function toSavedAddress(raw: AddressResponse): SavedAddress {
  return {
    id: raw.id,
    name: emptyToNull(raw.name) ?? 'Dirección',
    fullAddress: raw.fullAddress?.trim() ?? '',
    city: raw.city?.trim() ?? '',
    postalCode: emptyToNull(raw.postalCode),
    isPrimary: raw.isPrimary === true,
    deliveryNotes: emptyToNull(raw.deliveryNotes),
    coordinates: toCoordinates(raw.location),
  };
}

/**
 * Elige la dirección a precargar en el checkout: la principal o, si ninguna
 * lo es, la primera. `null` si el usuario no tiene direcciones.
 */
export function pickDefaultAddress(addresses: SavedAddress[]): SavedAddress | null {
  return addresses.find((address) => address.isPrimary) ?? addresses[0] ?? null;
}

/** Direcciones activas del usuario autenticado. */
export async function listAddresses(signal?: AbortSignal): Promise<SavedAddress[]> {
  const raw = await httpClient.get<AddressResponse[] | null>(ADDRESSES_PATH, { signal });
  return Array.isArray(raw) ? raw.map(toSavedAddress) : [];
}

// --- Precarga (docs/PLAN-PEDIDOS.md §2.1) ---
// Abrir el carrito precarga las direcciones; el checkout reutiliza esa misma
// petición si es reciente. Así la lectura ocurre mientras el usuario decide,
// no después de navegar. Caché corta y solo en memoria: son datos privados.

const ADDRESSES_CACHE_MS = 30_000;
let cachedAddresses: { at: number; promise: Promise<SavedAddress[]> } | null = null;

/** Lista de direcciones reutilizando una lectura de hace menos de 30 s. */
export function loadAddresses(): Promise<SavedAddress[]> {
  if (cachedAddresses && Date.now() - cachedAddresses.at < ADDRESSES_CACHE_MS) {
    return cachedAddresses.promise;
  }
  const promise = listAddresses();
  cachedAddresses = { at: Date.now(), promise };
  // Un fallo no se cachea: el siguiente intento vuelve a pedir.
  promise.catch(() => {
    if (cachedAddresses?.promise === promise) cachedAddresses = null;
  });
  return promise;
}

/** Calienta la caché sin esperar ni propagar errores. */
export function prefetchAddresses(): void {
  void loadAddresses().catch(() => undefined);
}

/** Descarta la caché (tras crear una dirección o un `ADDRESS_NOT_FOUND`). */
export function invalidateAddresses(): void {
  cachedAddresses = null;
}

/** Crea una dirección y la devuelve con su `id` (necesario para el checkout). */
export async function createAddress(input: NewAddressInput): Promise<SavedAddress> {
  const raw = await httpClient.post<AddressResponse>(ADDRESSES_PATH, {
    name: input.name.trim(),
    fullAddress: input.fullAddress.trim(),
    city: input.city.trim(),
    postalCode: emptyToNull(input.postalCode),
    deliveryNotes: emptyToNull(input.deliveryNotes),
    isPrimary: input.isPrimary ?? false,
    location: { latitude: input.coordinates.lat, longitude: input.coordinates.lng },
  });
  invalidateAddresses();
  return toSavedAddress(raw);
}
