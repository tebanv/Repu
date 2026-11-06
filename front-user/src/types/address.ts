// Direcciones guardadas del usuario (fuente: `ms-users`).
// El checkout de `ms-orders` exige el `id` de una de estas direcciones
// (docs/PLAN-PEDIDOS.md §2.3).

import type { Coordinates } from './common';

export interface SavedAddress {
  id: string;
  /** Etiqueta corta elegida por el usuario ("Casa", "Taller"). */
  name: string;
  fullAddress: string;
  city: string;
  postalCode: string | null;
  isPrimary: boolean;
  deliveryNotes: string | null;
  /** `null` si el backend no envía coordenadas válidas. */
  coordinates: Coordinates | null;
}

export interface NewAddressInput {
  name: string;
  fullAddress: string;
  city: string;
  /** Obligatorias en `ms-users`: sin ellas no se puede crear la dirección. */
  coordinates: Coordinates;
  postalCode?: string | null;
  deliveryNotes?: string | null;
  isPrimary?: boolean;
}
