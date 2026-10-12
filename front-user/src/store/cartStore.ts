'use client';

// Zustand store para gestionar el carrito global de la aplicación.
// Implementa persistencia, contexto de tienda único y mutaciones seguras con immer.
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import { useShallow } from 'zustand/react/shallow';
import { track } from '@/lib/analytics';
import { enableCrossTabSync } from '@/lib/storageSync';
import type {
  CartItem,
  CartSummary,
  CartNotice,
  CartActionResult,
  CartStoreContext,
  CartProductInput,
} from '@/types';

export const CART_STORAGE_KEY = 'cart-storage';
export const CART_STATE_VERSION = 1;
export const CART_TTL_MS = 24 * 60 * 60 * 1000;

const EXPIRED_CART_NOTICE: { code: string; message: string } = {
  code: 'EXPIRED_CART',
  message: 'Tu carrito ha expirado por cambios en inventario. Por favor, selecciona tus productos nuevamente.',
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
function createCartNotice(notice: { code: string; message: string }): CartNotice {
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

  setHasHydrated: (value: boolean) => void;
  addItem: (product: CartProductInput, quantity?: number) => CartActionResult;
  removeItem: (productId: string) => CartActionResult;
  updateQuantity: (productId: string, quantity: number) => CartActionResult;
  clearCart: () => void;
  clearCartNotice: () => void;
  replaceStoreContext: (store: CartProductInput | CartStoreContext) => CartActionResult;
}

/**
 * Estado vacío reutilizable del carrito.
 */
function createEmptyCartState(): Omit<
  CartStoreState,
  'setHasHydrated' | 'addItem' | 'removeItem' | 'updateQuantity' | 'clearCart' | 'clearCartNotice' | 'replaceStoreContext'
> {
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
  };
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
function sanitizePersistedCartState(
  persistedState: unknown
): ReturnType<typeof createEmptyCartState> {
  const fallbackState = createEmptyCartState();

  if (!persistedState || typeof persistedState !== 'object') {
    return fallbackState;
  }

  const ps = persistedState as Record<string, unknown>;
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
>;

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
          syncCartDerivedState(state, { touch: true });

          actionResult = {
            ok: true,
            code: 'ITEM_REMOVED',
            cartSummary: buildCartSummaryFromState(state),
          };
        });

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
          syncCartDerivedState(state, { touch: true });

          actionResult = {
            ok: true,
            code: wasClamped ? 'QUANTITY_CLAMPED' : 'QUANTITY_UPDATED',
            item: { ...existingItem },
            cartSummary: buildCartSummaryFromState(state),
          };
        });

        return actionResult;
      },

      clearCart: () => {
        set((state) => {
          Object.assign(state, createEmptyCartState(), {
            lastUpdatedAt: createTimestamp(),
            hasHydrated: state.hasHydrated,
          });
        });
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
      }),
      migrate: (persistedState: unknown, persistedVersion: number) => {
        if (persistedVersion !== CART_STATE_VERSION) {
          return createEmptyCartState();
        }

        return sanitizePersistedCartState(persistedState);
      },
      merge: (persistedState: unknown, currentState: CartStoreState) => {
        const sanitizedState = sanitizePersistedCartState(persistedState);

        if (isCartExpired(sanitizedState)) {
          // Telemetría A2: la razón se conoce aquí (antes de reemplazar).
          track('cart_expired', {
            reason: sanitizedState.lastUpdatedAt ? 'ttl_exceeded' : 'missing_timestamp',
          });
          return {
            ...currentState,
            ...createEmptyCartState(),
            cartNotice: createCartNotice(EXPIRED_CART_NOTICE),
          };
        }

        return {
          ...currentState,
          ...sanitizedState,
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
 * Hook reactivo para saber cuándo el carrito terminó de rehidratarse desde persistencia.
 */
export function useCartHasHydrated(): boolean {
  return useCartStore((state) => selectCartHasHydrated(state));
}

export default useCartStore;
