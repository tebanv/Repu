// src/services/cartService.ts
// Carrito del servidor en `ms-orders` (docs/PLAN-PEDIDOS.md §2.2 y §3).
//
// Expone una API de **cantidad absoluta** (`setServerItemQuantity`): el store
// dice "este producto debe quedar en N" y el servicio decide cómo lograrlo.
// La cantidad absoluta permite que el store agrupe ráfagas de clics y
// reintente sin duplicar unidades.
//
// Shim temporal: la API actual de `ms-orders` solo tiene `POST /cart/items`
// (suma la cantidad, no es idempotente) y `DELETE /cart/items/{itemId}`.
// Para fijar N se compara con el último carrito conocido y se envía la
// diferencia (o `DELETE` + `POST` para bajar). Cuando backend publique
// `PUT /api/cart/items/{productId}` (C1), `DELETE /api/cart` (C3) y
// `GET /api/cart` sin `companyId` (C2) en docs/BACKEND.md §7, solo cambian las
// funciones de este archivo.
//
// Como `POST` suma, después de cualquier error de red no se sabe si el cambio
// se aplicó: el carrito conocido de esa tienda se marca obsoleto y la siguiente
// operación lo relee antes de calcular la diferencia.

import { HttpError, httpClient } from './httpClient';

const ORDERS_BASE = '/ms-orders';

// --- Respuesta cruda de `ms-orders` ---

interface CartItemResponse {
  id: string;
  productId: string;
  productName?: string | null;
  unitPrice?: number | string | null;
  quantity: number;
  subtotal?: number | string | null;
}

interface CartResponse {
  id: string;
  companyId: string;
  items?: CartItemResponse[] | null;
  total?: number | string | null;
}

// --- Modelo que consume el store ---

export interface ServerCartItem {
  /** Id del ítem en el servidor; solo lo necesita la API actual para `DELETE`. */
  itemId: string;
  productId: string;
  name: string | null;
  /** Precio actual en COP enteros (`COALESCE(oferta, base)` del servidor). */
  unitPrice: number;
  quantity: number;
}

export interface ServerCart {
  id: string;
  storeId: string;
  items: ServerCartItem[];
  /** Total del servidor en COP enteros. */
  total: number;
}

/** Cómo debe reaccionar el store ante un error de sincronización. */
export type CartSyncErrorKind =
  /** El producto ya no está disponible para esa tienda: quitarlo del carrito. */
  | 'product_unavailable'
  /** La tienda no existe o está inactiva: vaciar el carrito. */
  | 'store_unavailable'
  /** Sesión vencida: lo maneja el flujo global de auth. */
  | 'unauthorized'
  /** Red o 5xx: conservar el cambio pendiente y reintentar. */
  | 'retryable'
  /** Otro 4xx: el servidor rechazó el cambio; volver al estado del servidor. */
  | 'rejected';

function toCop(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, Math.round(parsed)) : 0;
}

/** Adaptador `CartResponse` → `ServerCart`. Exportado para pruebas. */
export function toServerCart(raw: CartResponse): ServerCart {
  const items = (raw.items ?? []).map((item) => ({
    itemId: item.id,
    productId: item.productId,
    name: item.productName?.trim() || null,
    unitPrice: toCop(item.unitPrice),
    quantity: Math.max(0, Math.floor(Number(item.quantity) || 0)),
  }));
  return { id: raw.id, storeId: raw.companyId, items, total: toCop(raw.total) };
}

export function classifyCartSyncError(error: unknown): CartSyncErrorKind {
  if (!(error instanceof HttpError)) return 'retryable';
  if (error.status === 401) return 'unauthorized';
  if (error.code === 'PRODUCT_NOT_AVAILABLE') return 'product_unavailable';
  if (error.code === 'COMPANY_NOT_FOUND') return 'store_unavailable';
  if (error.status >= 500 || error.status === 408 || error.status === 429) return 'retryable';
  return 'rejected';
}

// --- Último carrito conocido por tienda (lo exige el shim) ---

/** `null` = se sabe que no hay carrito activo para esa tienda. */
const knownCarts = new Map<string, ServerCart | null>();
const staleStores = new Set<string>();

function remember(storeId: string, cart: ServerCart | null): ServerCart | null {
  knownCarts.set(storeId, cart);
  staleStores.delete(storeId);
  return cart;
}

function isTransientFailure(error: unknown): boolean {
  return classifyCartSyncError(error) === 'retryable';
}

/** Lee el carrito activo de una tienda. `null` si no existe (`404 CART_NOT_FOUND`). */
export async function getServerCart(storeId: string): Promise<ServerCart | null> {
  try {
    const raw = await httpClient.get<CartResponse>(
      `${ORDERS_BASE}/cart?companyId=${encodeURIComponent(storeId)}`,
    );
    return remember(storeId, toServerCart(raw));
  } catch (error) {
    if (error instanceof HttpError && error.code === 'CART_NOT_FOUND') {
      return remember(storeId, null);
    }
    throw error;
  }
}

async function currentCart(storeId: string): Promise<ServerCart | null> {
  if (!knownCarts.has(storeId) || staleStores.has(storeId)) {
    return getServerCart(storeId);
  }
  return knownCarts.get(storeId) ?? null;
}

async function postItem(storeId: string, productId: string, quantity: number): Promise<ServerCart> {
  const raw = await httpClient.post<CartResponse>(`${ORDERS_BASE}/cart/items`, {
    companyId: storeId,
    productId,
    quantity,
  });
  return remember(storeId, toServerCart(raw)) as ServerCart;
}

async function deleteItem(storeId: string, itemId: string): Promise<ServerCart> {
  const raw = await httpClient.delete<CartResponse>(
    `${ORDERS_BASE}/cart/items/${encodeURIComponent(itemId)}`,
  );
  return remember(storeId, toServerCart(raw)) as ServerCart;
}

async function applyQuantity(
  storeId: string,
  productId: string,
  quantity: number,
): Promise<ServerCart | null> {
  let cart = await currentCart(storeId);
  const existing = cart?.items.find((item) => item.productId === productId);
  const currentQuantity = existing?.quantity ?? 0;

  if (quantity === currentQuantity) return cart;

  // Bajar (o quitar): la API actual no permite restar; se borra y se vuelve a
  // agregar la cantidad final.
  if (existing && quantity < currentQuantity) {
    cart = await deleteItem(storeId, existing.itemId);
  }
  const base = cart?.items.find((item) => item.productId === productId)?.quantity ?? 0;
  if (quantity > base) {
    cart = await postItem(storeId, productId, quantity - base);
  }
  return cart;
}

/**
 * Deja `productId` con exactamente `quantity` unidades en el carrito de la
 * tienda (`0` lo quita) y devuelve el carrito resultante del servidor.
 */
export async function setServerItemQuantity(
  storeId: string,
  productId: string,
  quantity: number,
): Promise<ServerCart | null> {
  const target = Math.max(0, Math.floor(quantity));
  try {
    return await applyQuantity(storeId, productId, target);
  } catch (error) {
    if (error instanceof HttpError && error.code === 'CART_ITEM_NOT_FOUND') {
      // El carrito cambió en otra pestaña o dispositivo: releer y reintentar una vez.
      staleStores.add(storeId);
      return applyQuantity(storeId, productId, target);
    }
    if (isTransientFailure(error)) staleStores.add(storeId);
    throw error;
  }
}

/** Vacía el carrito de una tienda en el servidor. */
export async function clearServerCart(storeId: string): Promise<void> {
  try {
    let cart = await currentCart(storeId);
    // Shim: un `DELETE` por ítem, en serie, hasta que exista `DELETE /api/cart` (C3).
    for (const item of cart?.items ?? []) {
      cart = await deleteItem(storeId, item.itemId);
    }
  } catch (error) {
    if (error instanceof HttpError && error.code === 'CART_NOT_FOUND') {
      remember(storeId, null);
      return;
    }
    staleStores.add(storeId);
    throw error;
  }
}

/**
 * Tras un checkout exitoso el servidor marca el carrito como `CONVERTIDO`;
 * la próxima alta crea uno nuevo.
 */
export function markServerCartConverted(storeId: string): void {
  remember(storeId, null);
}

export function resetCartServiceForTests(): void {
  knownCarts.clear();
  staleStores.clear();
}
