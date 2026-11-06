'use client';

// Zustand store para gestionar el carrito global de la aplicación.
// Implementa persistencia, contexto de tienda único y mutaciones seguras con immer.
//
// Fuente de verdad: el carrito del servidor (`ms-orders`). Este store es su
// caché optimista (docs/PLAN-PEDIDOS.md §2.2):
// - Las acciones siguen siendo síncronas y aplican las reglas locales al
//   instante; la UI no espera a la red.
// - Cada cambio marca el producto como pendiente (`pendingSync`) y programa
//   su envío en `cartSyncQueue`: 400 ms sin cambios por producto, en serie y
//   con la cantidad absoluta leída al ejecutar (una ráfaga = una petición).
// - Cada respuesta trae el carrito completo y se reconcilia: gana el servidor,
//   salvo en productos con cambios locales aún pendientes.
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import { useShallow } from 'zustand/react/shallow';
import { track } from '@/lib/analytics';
import { enableCrossTabSync } from '@/lib/storageSync';
import { createSyncQueue } from '@/lib/syncQueue';
import {
  classifyCartSyncError,
  clearServerCart,
  getServerCart,
  markServerCartConverted,
  setServerItemQuantity,
  type ServerCart,
} from '@/services/cartService';
import type {
  CartItem,
  CartSummary,
  CartNotice,
  CartActionResult,
  CartStoreContext,
  CartProductInput,
  CartSyncResult,
  CartSyncStatus,
} from '@/types';

export const CART_STORAGE_KEY = 'cart-storage';
// v2 (corte de catálogo): los carritos v1 guardan ids de Supabase que no existen
// en el backend `repu`; `migrate` los descarta.
// v3 (carrito del servidor): agrega `pendingSync` y `pendingClearStoreIds`. Los
// carritos v2 ya tienen ids reales: se conservan y se marcan pendientes para
// subirlos al servidor en el primer `syncWithServer`.
export const CART_STATE_VERSION = 3;
export const CART_TTL_MS = 24 * 60 * 60 * 1000;
/** Espera sin cambios sobre un producto antes de enviarlo al servidor. */
export const CART_SYNC_DELAY_MS = 400;

type NoticeTemplate = { code: string; title?: string; message: string };

const EXPIRED_CART_NOTICE: NoticeTemplate = {
  code: 'EXPIRED_CART',
  title: 'Carrito expirado',
  message: 'Tu carrito ha expirado por cambios en inventario. Por favor, selecciona tus productos nuevamente.',
};

const STORE_UNAVAILABLE_NOTICE: NoticeTemplate = {
  code: 'STORE_UNAVAILABLE',
  title: 'Tienda no disponible',
  message: 'La tienda de tu carrito ya no está disponible, así que lo vaciamos.',
};

/**
 * Normaliza strings opcionales para evitar persistir valores vacíos o inválidos.
 */
function normalizeOptionalString(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const normalizedValue = value.trim();
  return normalizedValue.length > 0 ? normalizedValue : null;
}

/**
 * Convierte un valor monetario a entero seguro en COP para evitar drift en subtotales.
 */
function normalizeMoney(value: unknown): number {
  const parsedValue = Number(value);

  if (!Number.isFinite(parsedValue)) {
    return 0;
  }

  return Math.max(0, Math.round(parsedValue));
}

/**
 * Convierte una cantidad a entero positivo mínimo de 1.
 */
function normalizeQuantity(value: unknown): number {
  const parsedValue = Number(value);

  if (!Number.isFinite(parsedValue)) {
    return 1;
  }

  return Math.max(1, Math.floor(parsedValue));
}

/**
 * Normaliza límites opcionales de cantidad como stock o maxPerOrder.
 */
function normalizeOptionalLimit(value: unknown): number | null {
  const parsedValue = Number(value);

  if (!Number.isFinite(parsedValue) || parsedValue <= 0) {
    return null;
  }

  return Math.floor(parsedValue);
}

/**
 * Calcula el máximo permitido para un item combinando stock y maxPerOrder.
 */
function getMaxAllowedQuantity(item: {
  stockSnapshot: number | null;
  maxPerOrder?: number | null;
}): number {
  const candidateLimits = [item.stockSnapshot, item.maxPerOrder]
    .map(normalizeOptionalLimit)
    .filter((limit): limit is number => limit !== null);

  if (candidateLimits.length === 0) {
    return Number.POSITIVE_INFINITY;
  }

  return Math.min(...candidateLimits);
}

/**
 * Ajusta una cantidad al rango válido del item.
 */
function clampQuantityForItem(
  item: { stockSnapshot: number | null; maxPerOrder?: number | null },
  quantity: unknown
): number {
  const normalizedQuantity = normalizeQuantity(quantity);
  const maxAllowedQuantity = getMaxAllowedQuantity(item);

  if (!Number.isFinite(maxAllowedQuantity)) {
    return normalizedQuantity;
  }

  return Math.min(normalizedQuantity, maxAllowedQuantity);
}

/**
 * Genera un timestamp ISO consistente para trazabilidad básica del carrito.
 */
function createTimestamp(): string {
  return new Date().toISOString();
}

/**
 * Crea un aviso transitorio para que la UI pueda informar eventos relevantes del carrito.
 */
function createCartNotice(notice: NoticeTemplate): CartNotice {
  return {
    ...notice,
    createdAt: createTimestamp(),
  };
}

/**
 * Convierte un timestamp ISO a milisegundos. Si es inválido, retorna null.
 */
function parseTimestampMs(value?: string | null): number | null {
  if (!value) {
    return null;
  }

  const parsedValue = Date.parse(value);
  return Number.isFinite(parsedValue) ? parsedValue : null;
}

/**
 * Determina si un carrito persistido debe considerarse expirado por antigüedad.
 */
export function isCartExpired(
  state?: { items?: CartItem[]; lastUpdatedAt?: string | null },
  now = Date.now()
): boolean {
  const hasItems = Array.isArray(state?.items) && state.items.length > 0;

  if (!hasItems) {
    return false;
  }

  const lastUpdatedAtMs = parseTimestampMs(state?.lastUpdatedAt);

  if (lastUpdatedAtMs === null) {
    return true;
  }

  return now - lastUpdatedAtMs > CART_TTL_MS;
}

export interface CartStoreState extends CartSummary {
  cartNotice: CartNotice | null;
  hasHydrated: boolean;
  /** Productos (de `storeId`) con cambios locales aún no confirmados por el servidor. */
  pendingSync: string[];
  /** Tiendas cuyo carrito de servidor hay que vaciar (carrito vaciado o expirado). */
  pendingClearStoreIds: string[];
  syncStatus: CartSyncStatus;

  setHasHydrated: (value: boolean) => void;
  addItem: (product: CartProductInput, quantity?: number) => CartActionResult;
  removeItem: (productId: string) => CartActionResult;
  updateQuantity: (productId: string, quantity: number) => CartActionResult;
  clearCart: () => void;
  clearCartNotice: () => void;
  replaceStoreContext: (store: CartProductInput | CartStoreContext) => CartActionResult;
  /**
   * Reconciliación inicial con el servidor (y subida de cambios pendientes).
   * La llama `MainLayoutShell` con la sesión confirmada. Idempotente.
   */
  syncWithServer: () => Promise<void>;
  /** Envía ya todo lo pendiente y espera la confirmación (antes del checkout). */
  flushSync: () => Promise<CartSyncResult>;
  /**
   * Vacía el carrito local después de un checkout exitoso. No toca el servidor:
   * `ms-orders` ya marcó su carrito como `CONVERTIDO`.
   */
  resetAfterCheckout: () => void;
}

type CartDataState = Omit<
  CartStoreState,
  | 'setHasHydrated'
  | 'addItem'
  | 'removeItem'
  | 'updateQuantity'
  | 'clearCart'
  | 'clearCartNotice'
  | 'replaceStoreContext'
  | 'syncWithServer'
  | 'flushSync'
  | 'resetAfterCheckout'
>;

/**
 * Estado vacío reutilizable del carrito.
 */
function createEmptyCartState(): CartDataState {
  return {
    storeId: null,
    storeSlug: null,
    storeName: null,
    items: [],
    itemCount: 0,
    subtotal: 0,
    lastUpdatedAt: null,
    version: CART_STATE_VERSION,
    cartNotice: null,
    hasHydrated: false,
    pendingSync: [],
    pendingClearStoreIds: [],
    syncStatus: 'idle',
  };
}

/** Normaliza una lista persistida de ids (sin vacíos ni duplicados). */
function sanitizeIdList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  const ids = value
    .map((id) => normalizeOptionalString(id))
    .filter((id): id is string => id !== null);
  return [...new Set(ids)];
}

function addUnique(list: string[], id: string): void {
  if (!list.includes(id)) list.push(id);
}

/**
 * Recalcula los derivados del carrito y limpia contexto cuando queda vacío.
 */
function syncCartDerivedState(
  state: CartStoreState,
  options: { touch?: boolean } = {}
): void {
  const normalizedItems = state.items
    .map((item) => sanitizeCartItem(item))
    .filter((item): item is CartItem => item !== null);

  state.items = normalizedItems;
  state.itemCount = normalizedItems.reduce(
    (accumulator, item) => accumulator + item.quantity,
    0
  );
  state.subtotal = normalizedItems.reduce(
    (accumulator, item) => accumulator + item.price * item.quantity,
    0
  );
  state.version = CART_STATE_VERSION;

  if (normalizedItems.length === 0) {
    state.storeId = null;
    state.storeSlug = null;
    state.storeName = null;
  }

  if (options.touch) {
    state.lastUpdatedAt = createTimestamp();
    state.cartNotice = null;
  }
}

/**
 * Normaliza el contexto de tienda que vive a nivel de carrito.
 * Acepta tanto formas `{ storeId, storeSlug, storeName }` como objetos
 * de tienda `{ id, slug, name }` (ej. `replaceStoreContext(store)`).
 */
function sanitizeStoreContext(store?: unknown): CartStoreContext {
  const source = store && typeof store === 'object' ? (store as Record<string, unknown>) : {};

  return {
    storeId: normalizeOptionalString(source.storeId ?? source.id),
    storeSlug: normalizeOptionalString(source.storeSlug ?? source.slug),
    storeName: normalizeOptionalString(source.storeName ?? source.name),
  };
}

/**
 * Normaliza el contexto de tienda de un producto de catálogo de forma estricta.
 * Solo lee `storeId/storeSlug/storeName` explícitos: el `id` del producto NO es
 * un fallback válido (colisionaría y volvería inalcanzable `MISSING_STORE_CONTEXT`).
 * El fallback a `id/slug/name` queda reservado a objetos de tienda en
 * `sanitizeStoreContext` / `replaceStoreContext`.
 */
function sanitizeProductStoreContext(product?: unknown): CartStoreContext {
  const source =
    product && typeof product === 'object' ? (product as Record<string, unknown>) : {};

  return {
    storeId: normalizeOptionalString(source.storeId),
    storeSlug: normalizeOptionalString(source.storeSlug),
    storeName: normalizeOptionalString(source.storeName),
  };
}

/**
 * Convierte un producto de catálogo en la versión persistible del item de carrito.
 */
function createCartItemFromProduct(
  product: unknown,
  quantity: unknown
): CartItem | null {
  if (!product || typeof product !== 'object') {
    return null;
  }

  const p = product as Record<string, unknown>;
  const productId = normalizeOptionalString(p.id ?? p.productId);
  const productName = normalizeOptionalString(p.name);

  if (!productId || !productName) {
    return null;
  }

  const isAvailable = p.isAvailable !== false;
  const stockSnapshot = normalizeOptionalLimit(p.stock ?? p.stockSnapshot);
  const maxPerOrder = normalizeOptionalLimit(p.maxPerOrder);
  const images = Array.isArray(p.images) ? (p.images as string[]) : [];

  const cartItem: CartItem = {
    productId,
    name: productName,
    price: normalizeMoney(p.price),
    image: normalizeOptionalString(p.image ?? images[0] ?? null),
    quantity: 1,
    stockSnapshot,
    maxPerOrder,
  };

  if (!isAvailable || getMaxAllowedQuantity(cartItem) <= 0) {
    return null;
  }

  cartItem.quantity = clampQuantityForItem(cartItem, quantity);
  return cartItem;
}

/**
 * Sanea un item persistido para rehidratación segura.
 */
function sanitizeCartItem(item: unknown): CartItem | null {
  if (!item || typeof item !== 'object') {
    return null;
  }

  const it = item as Record<string, unknown>;
  const productId = normalizeOptionalString(it.productId);
  const name = normalizeOptionalString(it.name);

  if (!productId || !name) {
    return null;
  }

  const normalizedItem: CartItem = {
    productId,
    name,
    price: normalizeMoney(it.price),
    image: normalizeOptionalString(it.image),
    quantity: 1,
    stockSnapshot: normalizeOptionalLimit(it.stockSnapshot),
    maxPerOrder: normalizeOptionalLimit(it.maxPerOrder),
  };

  if (getMaxAllowedQuantity(normalizedItem) <= 0) {
    return null;
  }

  normalizedItem.quantity = clampQuantityForItem(normalizedItem, it.quantity);
  return normalizedItem;
}

/**
 * Sanea el estado persistido para tolerar corrupción o cambios de shape.
 */
function sanitizePersistedCartState(persistedState: unknown): CartDataState {
  const fallbackState = createEmptyCartState();

  if (!persistedState || typeof persistedState !== 'object') {
    return fallbackState;
  }

  const ps = persistedState as Record<string, unknown>;
  // Los vaciados pendientes sobreviven aunque el carrito local esté vacío.
  fallbackState.pendingClearStoreIds = sanitizeIdList(ps.pendingClearStoreIds);
  const items = Array.isArray(ps.items)
    ? ps.items
        .map((item) => sanitizeCartItem(item))
        .filter((item): item is CartItem => item !== null)
    : [];

  const sanitizedState = {
    ...fallbackState,
    ...sanitizeStoreContext(persistedState),
    items,
    lastUpdatedAt: normalizeOptionalString(ps.lastUpdatedAt),
    version: CART_STATE_VERSION,
    // No se filtra por `items`: un producto quitado localmente sigue pendiente
    // hasta que el servidor confirme que salió del carrito.
    pendingSync: sanitizeIdList(ps.pendingSync),
  };

  sanitizedState.itemCount = sanitizedState.items.reduce(
    (accumulator, item) => accumulator + item.quantity,
    0
  );
  sanitizedState.subtotal = sanitizedState.items.reduce(
    (accumulator, item) => accumulator + item.price * item.quantity,
    0
  );

  if (sanitizedState.items.length === 0) {
    return fallbackState;
  }

  return sanitizedState;
}

/**
 * Construye un snapshot estable del carrito a partir del estado actual.
 */
function buildCartSummaryFromState(state: CartStoreState): CartSummary {
  return {
    storeId: state.storeId,
    storeSlug: state.storeSlug,
    storeName: state.storeName,
    items: state.items,
    itemCount: state.itemCount,
    subtotal: state.subtotal,
    lastUpdatedAt: state.lastUpdatedAt,
    version: state.version,
  };
}

/**
 * Aplica un contexto de tienda saneado sobre el estado actual.
 */
function applyStoreContext(state: CartStoreState, store: unknown): void {
  const nextStoreContext = sanitizeStoreContext(store);

  state.storeId = nextStoreContext.storeId;
  state.storeSlug = nextStoreContext.storeSlug;
  state.storeName = nextStoreContext.storeName;
}

/**
 * Selector base para obtener un resumen reactivo y estable del carrito.
 */
export function selectCartSummary(state: CartStoreState): CartSummary {
  return buildCartSummaryFromState(state);
}

/**
 * Selector puro para obtener un item por productId desde un estado de carrito.
 */
export function selectCartItemByProductId(
  state: CartStoreState,
  productId?: string | null
): CartItem | null {
  const normalizedProductId = normalizeOptionalString(productId);

  if (!normalizedProductId) {
    return null;
  }

  return state.items.find((item) => item.productId === normalizedProductId) || null;
}

/**
 * Selector puro para validar compatibilidad de tienda con el carrito actual.
 */
export function selectIsSameStore(
  state: CartStoreState,
  storeId?: string | null
): boolean {
  const normalizedStoreId = normalizeOptionalString(storeId);

  if (!state.storeId) {
    return true;
  }

  return state.storeId === normalizedStoreId;
}

/**
 * Selector para el aviso transitorio del carrito.
 */
export function selectCartNotice(state: CartStoreState): CartNotice | null {
  return state.cartNotice;
}

/**
 * Selector para conocer si la rehidratación del store ya finalizó.
 */
export function selectCartHasHydrated(state: CartStoreState): boolean {
  return state.hasHydrated;
}

type CartPersistedSlice = Pick<
  CartStoreState,
  | 'storeId'
  | 'storeSlug'
  | 'storeName'
  | 'items'
  | 'itemCount'
  | 'subtotal'
  | 'lastUpdatedAt'
  | 'version'
  | 'pendingSync'
  | 'pendingClearStoreIds'
>;

// ========================================
// SINCRONIZACIÓN CON EL CARRITO DEL SERVIDOR
// ========================================

const cartSyncQueue = createSyncQueue({ delayMs: CART_SYNC_DELAY_MS });

const itemKey = (storeId: string, productId: string) => `item:${storeId}:${productId}`;
const clearKey = (storeId: string) => `clear:${storeId}`;
const storeItemKeyPrefix = (storeId: string) => `item:${storeId}:`;

/** ¿Hay un envío programado (aún no ejecutado) para este producto? */
function hasQueuedItemSync(storeId: string, productId: string): boolean {
  return cartSyncQueue.pendingKeys().includes(itemKey(storeId, productId));
}

/**
 * Reconciliación servidor → local. Gana el servidor salvo en los productos con
 * cambios locales pendientes, que se respetan hasta que su envío confirme.
 */
export function reconcileWithServerCart(
  state: CartStoreState,
  cart: ServerCart | null,
  protectedProductIds: Set<string>
): void {
  const serverItems = new Map((cart?.items ?? []).map((item) => [item.productId, item]));

  state.items = state.items.filter((item) => {
    if (protectedProductIds.has(item.productId)) return true;
    const serverItem = serverItems.get(item.productId);
    if (!serverItem || serverItem.quantity <= 0) return false;
    item.price = serverItem.unitPrice;
    item.name = serverItem.name ?? item.name;
    item.quantity = serverItem.quantity;
    return true;
  });

  // Productos que el servidor tiene y el local no (otro dispositivo o pestaña).
  // El servidor no envía imagen ni stock: quedan en `null` hasta que la vista
  // de tienda vuelva a agregarlos con el catálogo.
  for (const serverItem of serverItems.values()) {
    const alreadyLocal = state.items.some((item) => item.productId === serverItem.productId);
    if (alreadyLocal || protectedProductIds.has(serverItem.productId) || serverItem.quantity <= 0) {
      continue;
    }
    state.items.push({
      productId: serverItem.productId,
      name: serverItem.name ?? 'Producto',
      price: serverItem.unitPrice,
      image: null,
      quantity: serverItem.quantity,
      stockSnapshot: null,
      maxPerOrder: null,
    });
  }

  syncCartDerivedState(state);
}

const useCartStore = create<CartStoreState>()(
  persist(
    immer((set, get) => ({
      ...createEmptyCartState(),

      setHasHydrated: (value: boolean) => {
        set((state) => {
          state.hasHydrated = Boolean(value);
        });
      },

      addItem: (product: CartProductInput, quantity = 1): CartActionResult => {
        let actionResult: CartActionResult = {
          ok: false,
          code: 'UNKNOWN_ERROR',
          message: 'No fue posible agregar el producto al carrito.',
        };

        set((state) => {
          const incomingItem = createCartItemFromProduct(product, quantity);

          if (!incomingItem) {
            actionResult = {
              ok: false,
              code: 'INVALID_PRODUCT',
              message: 'El producto no tiene datos válidos para agregarse al carrito.',
            };
            return;
          }

          const incomingStoreContext = sanitizeProductStoreContext(product);
          const incomingStoreId = incomingStoreContext.storeId;

          if (!incomingStoreId) {
            actionResult = {
              ok: false,
              code: 'MISSING_STORE_CONTEXT',
              message: 'El producto no tiene una tienda asociada válida.',
            };
            return;
          }

          if (state.storeId && state.storeId !== incomingStoreId) {
            actionResult = {
              ok: false,
              code: 'STORE_CONFLICT',
              message: 'El carrito ya contiene productos de otra tienda.',
              currentStoreId: state.storeId,
              incomingStoreId,
            };
            return;
          }

          if (!state.storeId) {
            applyStoreContext(state, incomingStoreContext);
          }

          const existingItem = state.items.find(
            (item) => item.productId === incomingItem.productId
          );

          if (existingItem) {
            existingItem.price = incomingItem.price;
            existingItem.image = incomingItem.image;
            existingItem.name = incomingItem.name;
            existingItem.stockSnapshot = incomingItem.stockSnapshot;
            existingItem.maxPerOrder = incomingItem.maxPerOrder;

            const requestedQuantity = existingItem.quantity + incomingItem.quantity;
            const nextQuantity = clampQuantityForItem(existingItem, requestedQuantity);
            const wasClamped = nextQuantity !== requestedQuantity;

            existingItem.quantity = nextQuantity;
            addUnique(state.pendingSync, existingItem.productId);

            syncCartDerivedState(state, { touch: true });

            actionResult = {
              ok: true,
              code: wasClamped ? 'QUANTITY_CLAMPED' : 'ITEM_UPDATED',
              item: { ...existingItem },
              cartSummary: buildCartSummaryFromState(state),
            };
            return;
          }

          state.items.push(incomingItem);
          addUnique(state.pendingSync, incomingItem.productId);
          syncCartDerivedState(state, { touch: true });

          const storedItem =
            state.items.find((item) => item.productId === incomingItem.productId) ||
            incomingItem;

          actionResult = {
            ok: true,
            code: 'ITEM_ADDED',
            item: { ...storedItem },
            cartSummary: buildCartSummaryFromState(state),
          };
        });

        if (actionResult.ok && actionResult.item) {
          scheduleItemSync(get().storeId, actionResult.item.productId);
        }

        return actionResult;
      },

      removeItem: (productId: string): CartActionResult => {
        const normalizedProductId = normalizeOptionalString(productId);

        if (!normalizedProductId) {
          return {
            ok: false,
            code: 'INVALID_PRODUCT_ID',
          };
        }

        let actionResult: CartActionResult = {
          ok: false,
          code: 'ITEM_NOT_FOUND',
        };
        const storeIdBefore = get().storeId;

        set((state) => {
          const nextItems = state.items.filter(
            (item) => item.productId !== normalizedProductId
          );

          if (nextItems.length === state.items.length) {
            actionResult = {
              ok: false,
              code: 'ITEM_NOT_FOUND',
            };
            return;
          }

          state.items = nextItems;
          if (nextItems.length > 0) {
            addUnique(state.pendingSync, normalizedProductId);
          } else if (storeIdBefore) {
            // Era el último producto: equivale a vaciar el carrito de esa
            // tienda (y evita que un pendiente quede asociado a otra tienda).
            state.pendingSync = [];
            addUnique(state.pendingClearStoreIds, storeIdBefore);
          }
          syncCartDerivedState(state, { touch: true });

          actionResult = {
            ok: true,
            code: 'ITEM_REMOVED',
            cartSummary: buildCartSummaryFromState(state),
          };
        });

        if (actionResult.ok && storeIdBefore) {
          if (get().items.length > 0) {
            scheduleItemSync(storeIdBefore, normalizedProductId);
          } else {
            scheduleServerClear(storeIdBefore);
          }
        }

        return actionResult;
      },

      updateQuantity: (productId: string, quantity: number): CartActionResult => {
        const normalizedProductId = normalizeOptionalString(productId);

        if (!normalizedProductId) {
          return {
            ok: false,
            code: 'INVALID_PRODUCT_ID',
          };
        }

        let actionResult: CartActionResult = {
          ok: false,
          code: 'ITEM_NOT_FOUND',
        };

        set((state) => {
          const existingItem = state.items.find(
            (item) => item.productId === normalizedProductId
          );

          if (!existingItem) {
            actionResult = {
              ok: false,
              code: 'ITEM_NOT_FOUND',
            };
            return;
          }

          const nextQuantity = clampQuantityForItem(existingItem, quantity);
          const wasClamped = nextQuantity !== Number(quantity);

          existingItem.quantity = nextQuantity;
          addUnique(state.pendingSync, existingItem.productId);
          syncCartDerivedState(state, { touch: true });

          actionResult = {
            ok: true,
            code: wasClamped ? 'QUANTITY_CLAMPED' : 'QUANTITY_UPDATED',
            item: { ...existingItem },
            cartSummary: buildCartSummaryFromState(state),
          };
        });

        if (actionResult.ok) {
          scheduleItemSync(get().storeId, normalizedProductId);
        }

        return actionResult;
      },

      clearCart: () => {
        const storeIdBefore = get().storeId;

        set((state) => {
          const pendingClearStoreIds = [...state.pendingClearStoreIds];
          if (storeIdBefore) addUnique(pendingClearStoreIds, storeIdBefore);
          Object.assign(state, createEmptyCartState(), {
            lastUpdatedAt: createTimestamp(),
            hasHydrated: state.hasHydrated,
            syncStatus: state.syncStatus,
            pendingClearStoreIds,
          });
        });

        if (storeIdBefore) scheduleServerClear(storeIdBefore);
      },

      clearCartNotice: () => {
        set((state) => {
          state.cartNotice = null;
        });
      },

      replaceStoreContext: (store: CartProductInput | CartStoreContext): CartActionResult => {
        const nextStoreContext = sanitizeStoreContext(store);

        if (!nextStoreContext.storeId) {
          return {
            ok: false,
            code: 'INVALID_STORE_CONTEXT',
          };
        }

        const { itemCount, storeId } = get();

        if (itemCount > 0 && storeId && storeId !== nextStoreContext.storeId) {
          return {
            ok: false,
            code: 'STORE_CONFLICT',
            currentStoreId: storeId,
            incomingStoreId: nextStoreContext.storeId,
          };
        }

        set((state) => {
          applyStoreContext(state, nextStoreContext);
          state.version = CART_STATE_VERSION;
          state.lastUpdatedAt = createTimestamp();
        });

        return {
          ok: true,
          code: 'STORE_CONTEXT_REPLACED',
        };
      },

      syncWithServer: () => {
        // Llamadas concurrentes (re-montajes, StrictMode) comparten el vuelo.
        bootstrapInFlight ??= runBootstrap().finally(() => {
          bootstrapInFlight = null;
        });
        return bootstrapInFlight;
      },

      flushSync: async (): Promise<CartSyncResult> => {
        resumePendingSync();
        await cartSyncQueue.flush();
        const { pendingSync } = get();
        return { ok: pendingSync.length === 0, pendingCount: pendingSync.length };
      },

      resetAfterCheckout: () => {
        const { storeId } = get();
        if (storeId) {
          cartSyncQueue.cancel((key) => key.startsWith(storeItemKeyPrefix(storeId)));
          markServerCartConverted(storeId);
        }
        set((state) => {
          Object.assign(state, createEmptyCartState(), {
            lastUpdatedAt: createTimestamp(),
            hasHydrated: state.hasHydrated,
            pendingClearStoreIds: state.pendingClearStoreIds,
          });
        });
        refreshSyncStatus();
      },
    })),
    {
      name: CART_STORAGE_KEY,
      version: CART_STATE_VERSION,
      storage: createJSONStorage(() => localStorage),
      partialize: (state): CartPersistedSlice => ({
        storeId: state.storeId,
        storeSlug: state.storeSlug,
        storeName: state.storeName,
        items: state.items,
        itemCount: state.itemCount,
        subtotal: state.subtotal,
        lastUpdatedAt: state.lastUpdatedAt,
        version: state.version,
        pendingSync: state.pendingSync,
        pendingClearStoreIds: state.pendingClearStoreIds,
      }),
      migrate: (persistedState: unknown, persistedVersion: number) => {
        if (persistedVersion === 2) {
          // Ids reales de `repu`, nunca enviados al servidor: subirlos todos.
          const migrated = sanitizePersistedCartState(persistedState);
          migrated.pendingSync = migrated.items.map((item) => item.productId);
          return migrated;
        }

        if (persistedVersion !== CART_STATE_VERSION) {
          return createEmptyCartState();
        }

        return sanitizePersistedCartState(persistedState);
      },
      merge: (persistedState: unknown, currentState: CartStoreState) => {
        const sanitizedState = sanitizePersistedCartState(persistedState);
        // Estado transitorio de esta pestaña: no viene del storage.
        const transient = { syncStatus: currentState.syncStatus };

        if (isCartExpired(sanitizedState)) {
          // Telemetría A2: la razón se conoce aquí (antes de reemplazar).
          track('cart_expired', {
            reason: sanitizedState.lastUpdatedAt ? 'ttl_exceeded' : 'missing_timestamp',
          });
          // El carrito del servidor de esa tienda también se vacía, para que
          // no reaparezca en la próxima reconciliación.
          const pendingClearStoreIds = [...sanitizedState.pendingClearStoreIds];
          if (sanitizedState.storeId) addUnique(pendingClearStoreIds, sanitizedState.storeId);
          return {
            ...currentState,
            ...createEmptyCartState(),
            ...transient,
            pendingClearStoreIds,
            cartNotice: createCartNotice(EXPIRED_CART_NOTICE),
          };
        }

        return {
          ...currentState,
          ...sanitizedState,
          ...transient,
        };
      },
      onRehydrateStorage: () => (state, error) => {
        state?.setHasHydrated?.(true);

        if (error) {
          return;
        }
      },
    }
  )
);

// ========================================
// TAREAS DE SINCRONIZACIÓN (usan el store ya creado)
// ========================================

let bootstrapInFlight: Promise<void> | null = null;

function refreshSyncStatus(): void {
  const { pendingSync, pendingClearStoreIds, syncStatus } = useCartStore.getState();
  const next: CartSyncStatus = !cartSyncQueue.isIdle()
    ? 'syncing'
    : pendingSync.length > 0 || pendingClearStoreIds.length > 0
      ? 'error'
      : 'idle';
  if (next !== syncStatus) {
    useCartStore.setState((state) => {
      state.syncStatus = next;
    });
  }
}

cartSyncQueue.onActivityChange(() => refreshSyncStatus());

function removePending(state: CartStoreState, storeId: string, productId: string): void {
  // Si llegó un cambio más nuevo mientras viajaba la petición, sigue pendiente.
  if (hasQueuedItemSync(storeId, productId)) return;
  state.pendingSync = state.pendingSync.filter((id) => id !== productId);
}

/** Aplica la respuesta del servidor si sigue siendo el carrito de esa tienda. */
function applyServerCart(storeId: string, cart: ServerCart | null): void {
  useCartStore.setState((state) => {
    if (state.storeId !== storeId) return;
    const protectedIds = new Set(state.pendingSync);
    reconcileWithServerCart(state, cart, protectedIds);
  });
}

function scheduleItemSync(storeId: string | null, productId: string): void {
  if (!storeId) return;
  cartSyncQueue.schedule(itemKey(storeId, productId), () => runItemSync(storeId, productId));
}

function scheduleServerClear(storeId: string): void {
  // Los envíos pendientes de esa tienda ya no importan: se vacía entera.
  cartSyncQueue.cancel((key) => key.startsWith(storeItemKeyPrefix(storeId)));
  cartSyncQueue.schedule(clearKey(storeId), () => runServerClear(storeId));
}

async function runItemSync(storeId: string, productId: string): Promise<void> {
  // Se lee al ejecutar: siempre se envía la última cantidad local.
  const state = useCartStore.getState();
  const localItem =
    state.storeId === storeId ? state.items.find((item) => item.productId === productId) : undefined;
  const targetQuantity = localItem?.quantity ?? 0;

  try {
    const cart = await setServerItemQuantity(storeId, productId, targetQuantity);
    useCartStore.setState((draft) => removePending(draft, storeId, productId));
    applyServerCart(storeId, cart);
  } catch (error) {
    await handleItemSyncError(storeId, productId, error);
  }
}

async function handleItemSyncError(storeId: string, productId: string, error: unknown): Promise<void> {
  const kind = classifyCartSyncError(error);

  if (kind === 'product_unavailable') {
    useCartStore.setState((state) => {
      removePending(state, storeId, productId);
      if (state.storeId !== storeId || hasQueuedItemSync(storeId, productId)) return;
      const item = state.items.find((it) => it.productId === productId);
      state.items = state.items.filter((it) => it.productId !== productId);
      syncCartDerivedState(state);
      state.cartNotice = createCartNotice({
        code: 'PRODUCT_UNAVAILABLE',
        title: 'Producto no disponible',
        message: `${item?.name ?? 'Un producto'} ya no está disponible y lo quitamos de tu carrito.`,
      });
    });
    return;
  }

  if (kind === 'store_unavailable') {
    cartSyncQueue.cancel((key) => key.startsWith(storeItemKeyPrefix(storeId)));
    useCartStore.setState((state) => {
      if (state.storeId !== storeId) return;
      Object.assign(state, createEmptyCartState(), {
        lastUpdatedAt: createTimestamp(),
        hasHydrated: state.hasHydrated,
        syncStatus: state.syncStatus,
        pendingClearStoreIds: state.pendingClearStoreIds,
        cartNotice: createCartNotice(STORE_UNAVAILABLE_NOTICE),
      });
    });
    return;
  }

  if (kind === 'rejected') {
    // El servidor no aceptó el cambio: se descarta y se vuelve a su estado.
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[cartStore] el servidor rechazó un cambio del carrito', error);
    }
    useCartStore.setState((state) => removePending(state, storeId, productId));
    try {
      applyServerCart(storeId, await getServerCart(storeId));
    } catch {
      // Sin red: se reconcilia en la próxima sincronización.
    }
  }

  // `retryable` y `unauthorized`: el cambio queda en `pendingSync` y se
  // reintenta con el siguiente cambio, al volver la conexión o en `flushSync`.
}

async function runServerClear(storeId: string): Promise<void> {
  try {
    await clearServerCart(storeId);
    useCartStore.setState((state) => {
      state.pendingClearStoreIds = state.pendingClearStoreIds.filter((id) => id !== storeId);
    });
  } catch (error) {
    const kind = classifyCartSyncError(error);
    if (kind !== 'retryable' && kind !== 'unauthorized') {
      // Tienda inexistente u otro rechazo: no hay nada que vaciar.
      useCartStore.setState((state) => {
        state.pendingClearStoreIds = state.pendingClearStoreIds.filter((id) => id !== storeId);
      });
    }
  }
}

/** Vuelve a programar todo lo que quedó pendiente (tras reload, error o reconexión). */
function resumePendingSync(): void {
  const { storeId, pendingSync, pendingClearStoreIds } = useCartStore.getState();
  pendingClearStoreIds.forEach((id) => {
    if (!cartSyncQueue.pendingKeys().includes(clearKey(id))) scheduleServerClear(id);
  });
  pendingSync.forEach((productId) => {
    if (!hasQueuedItemSync(storeId ?? '', productId)) scheduleItemSync(storeId, productId);
  });
  refreshSyncStatus();
}

async function runBootstrap(): Promise<void> {
  const { storeId } = useCartStore.getState();
  // Sin tienda local no se puede descubrir el carrito del servidor hasta que
  // exista `GET /api/cart` sin `companyId` (C2, docs/BACKEND.md §7).
  if (storeId) {
    try {
      applyServerCart(storeId, await getServerCart(storeId));
    } catch {
      // Red o sesión: se conserva el caché local y se reintenta después.
    }
  }
  resumePendingSync();
}

if (typeof window !== 'undefined') {
  // Reintento sin polling: al recuperar la conexión (heurística B).
  window.addEventListener('online', () => resumePendingSync());
}

/** Solo pruebas: descarta la cola sin enviar nada. */
export function resetCartSyncForTests(): void {
  cartSyncQueue.cancel(() => true);
  bootstrapInFlight = null;
}

/**
 * Sincronización multi-tab (regla 7.2): si otra pestaña modifica
 * `cart-storage`, rehidratamos para no divergir. No-op en SSR.
 */
enableCrossTabSync(CART_STORAGE_KEY, () => {
  void useCartStore.persist.rehydrate();
});

/**
 * Hook reactivo para consumir el resumen del carrito.
 */
export function useCartSummary(): CartSummary {
  return useCartStore(useShallow((state) => selectCartSummary(state)));
}

/**
 * Hook reactivo para obtener un item puntual del carrito por productId.
 */
export function useCartItem(productId?: string | null): CartItem | null {
  return useCartStore((state) => selectCartItemByProductId(state, productId));
}

/**
 * Hook reactivo para validar si la tienda consultada coincide con el carrito activo.
 */
export function useIsSameCartStore(storeId?: string | null): boolean {
  return useCartStore((state) => selectIsSameStore(state, storeId));
}

/**
 * Hook reactivo para leer avisos transitorios disparados por la rehidratación o reglas del carrito.
 */
export function useCartNotice(): CartNotice | null {
  return useCartStore((state) => selectCartNotice(state));
}

/**
 * Hook reactivo del estado de sincronización con el servidor (p. ej. para
 * deshabilitar "Confirmar pedido" mientras hay cambios sin confirmar).
 */
export function useCartSyncStatus(): CartSyncStatus {
  return useCartStore((state) => state.syncStatus);
}

/**
 * Hook reactivo para saber cuándo el carrito terminó de rehidratarse desde persistencia.
 */
export function useCartHasHydrated(): boolean {
  return useCartStore((state) => selectCartHasHydrated(state));
}

export default useCartStore;
