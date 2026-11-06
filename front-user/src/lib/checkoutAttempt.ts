/**
 * Clave de idempotencia del intento de compra (docs/PLAN-PEDIDOS.md §2.4).
 *
 * `ms-orders` usa el `X-Request-ID` del checkout como clave: el mismo UUID con
 * los mismos datos devuelve el pedido ya creado. Se guarda en `sessionStorage`
 * para que sobreviva a una recarga tras un fallo de red (la pestaña sigue
 * siendo el mismo intento), junto con una huella de los datos enviados: si la
 * huella cambia, se genera otra clave (el backend respondería 409).
 */

import { createRequestId } from '@/services/httpClient';

const STORAGE_KEY = 'checkout-attempt';

interface StoredAttempt {
  key: string;
  fingerprint: string;
}

function readAttempt(): StoredAttempt | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as Partial<StoredAttempt>) : null;
    return parsed?.key && parsed.fingerprint ? { key: parsed.key, fingerprint: parsed.fingerprint } : null;
  } catch {
    return null;
  }
}

/** Huella estable de lo que se envía al checkout. */
export function checkoutFingerprint(parts: {
  storeId: string;
  addressId: string;
  customerNotes?: string | null;
}): string {
  return JSON.stringify([parts.storeId, parts.addressId, parts.customerNotes?.trim() ?? '']);
}

/** Reutiliza la clave si la huella coincide; si no, crea y guarda una nueva. */
export function getCheckoutAttemptKey(fingerprint: string): string {
  const stored = readAttempt();
  if (stored?.fingerprint === fingerprint) return stored.key;
  const key = createRequestId();
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ key, fingerprint }));
  } catch {
    // Sin storage (modo privado estricto): la clave vive solo en memoria.
  }
  return key;
}

/** Tras un `201`, o si el backend la rechaza por conflicto. */
export function clearCheckoutAttempt(): void {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // Nada que limpiar.
  }
}
