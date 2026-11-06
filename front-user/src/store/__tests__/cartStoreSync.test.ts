import { beforeEach, describe, expect, it, vi } from 'vitest';
import { HttpError } from '@/services/httpClient';
import type { ServerCart } from '@/services/cartService';
import type { CartProductInput } from '@/types';

// Sincronización `cartStore` ↔ carrito del servidor (docs/PLAN-PEDIDOS.md §2.2).
// Se simulan las funciones de red de cartService; la clasificación de errores
// es la real.
vi.mock('@/services/cartService', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/services/cartService')>();
  return {
    ...actual,
    getServerCart: vi.fn(),
    setServerItemQuantity: vi.fn(),
    clearServerCart: vi.fn(),
    markServerCartConverted: vi.fn(),
  };
});

import * as cartService from '@/services/cartService';
import useCartStore, { reconcileWithServerCart, resetCartSyncForTests } from '../cartStore';

const service = vi.mocked(cartService);

function product(overrides: Partial<CartProductInput> = {}): CartProductInput {
  return { id: 'p1', name: 'Batería', price: 100, stock: 20, storeId: 's1', storeSlug: 't1', storeName: 'T1', ...overrides };
}

function serverCart(storeId: string, items: Array<[string, number, number?]>): ServerCart {
  return {
    id: 'cart',
    storeId,
    total: 0,
    items: items.map(([productId, quantity, unitPrice = 100]) => ({
      itemId: `i-${productId}`,
      productId,
      name: `Server ${productId}`,
      unitPrice,
      quantity,
    })),
  };
}

/** Simula un servidor que guarda exactamente lo que se le envía. */
function echoServer() {
  const carts = new Map<string, Map<string, number>>();
  service.setServerItemQuantity.mockImplementation(async (storeId, productId, quantity) => {
    const cart = carts.get(storeId) ?? new Map<string, number>();
    if (quantity > 0) cart.set(productId, quantity);
    else cart.delete(productId);
    carts.set(storeId, cart);
    return serverCart(storeId, [...cart.entries()]);
  });
  return carts;
}

beforeEach(() => {
  resetCartSyncForTests();
  vi.clearAllMocks();
  service.getServerCart.mockResolvedValue(null);
  service.clearServerCart.mockResolvedValue(undefined);
  localStorage.clear();
  useCartStore.setState({
    storeId: null,
    storeSlug: null,
    storeName: null,
    items: [],
    itemCount: 0,
    subtotal: 0,
    lastUpdatedAt: null,
    cartNotice: null,
    hasHydrated: true,
    pendingSync: [],
    pendingClearStoreIds: [],
    syncStatus: 'idle',
  });
});

describe('cartStore ↔ ms-orders — envío', () => {
  it('una ráfaga de cambios sobre un producto es una sola petición con la cantidad final', async () => {
    echoServer();
    const store = useCartStore.getState();
    store.addItem(product(), 1);
    for (let quantity = 2; quantity <= 6; quantity += 1) {
      useCartStore.getState().updateQuantity('p1', quantity);
    }

    expect(useCartStore.getState().syncStatus).toBe('syncing');
    const result = await useCartStore.getState().flushSync();

    expect(service.setServerItemQuantity).toHaveBeenCalledTimes(1);
    expect(service.setServerItemQuantity).toHaveBeenCalledWith('s1', 'p1', 6);
    expect(result).toEqual({ ok: true, pendingCount: 0 });
    expect(useCartStore.getState().pendingSync).toEqual([]);
    expect(useCartStore.getState().syncStatus).toBe('idle');
  });

  it('la respuesta actualiza el precio con el del servidor', async () => {
    service.setServerItemQuantity.mockResolvedValue(serverCart('s1', [['p1', 2, 90]]));
    useCartStore.getState().addItem(product(), 2);

    await useCartStore.getState().flushSync();

    expect(useCartStore.getState().items[0].price).toBe(90);
    expect(useCartStore.getState().subtotal).toBe(180);
  });

  it('quitar el último producto vacía el carrito del servidor en lugar de enviar cantidad 0', async () => {
    echoServer();
    useCartStore.getState().addItem(product(), 1);
    useCartStore.getState().removeItem('p1');

    await useCartStore.getState().flushSync();

    expect(service.setServerItemQuantity).not.toHaveBeenCalled();
    expect(service.clearServerCart).toHaveBeenCalledWith('s1');
    expect(useCartStore.getState().pendingClearStoreIds).toEqual([]);
  });

  it('vaciar y cambiar de tienda: vacía la tienda anterior y luego agrega en la nueva', async () => {
    echoServer();
    useCartStore.getState().addItem(product(), 1);
    await useCartStore.getState().flushSync();

    useCartStore.getState().clearCart();
    useCartStore.getState().addItem(product({ id: 'p9', storeId: 's2' }), 1);
    await useCartStore.getState().flushSync();

    expect(service.clearServerCart).toHaveBeenCalledWith('s1');
    expect(service.setServerItemQuantity).toHaveBeenLastCalledWith('s2', 'p9', 1);
    expect(service.clearServerCart.mock.invocationCallOrder[0]).toBeLessThan(
      service.setServerItemQuantity.mock.invocationCallOrder.at(-1) as number,
    );
  });

  it('resetAfterCheckout no vacía el servidor (el carrito ya quedó CONVERTIDO)', async () => {
    echoServer();
    useCartStore.getState().addItem(product(), 1);
    await useCartStore.getState().flushSync();

    useCartStore.getState().resetAfterCheckout();
    await useCartStore.getState().flushSync();

    expect(service.clearServerCart).not.toHaveBeenCalled();
    expect(service.markServerCartConverted).toHaveBeenCalledWith('s1');
    expect(useCartStore.getState().items).toEqual([]);
  });
});

describe('cartStore ↔ ms-orders — errores', () => {
  it('error de red: el cambio queda pendiente y se reintenta en el siguiente flush', async () => {
    service.setServerItemQuantity
      .mockRejectedValueOnce(new TypeError('Failed to fetch'))
      .mockResolvedValueOnce(serverCart('s1', [['p1', 2]]));
    useCartStore.getState().addItem(product(), 2);

    const first = await useCartStore.getState().flushSync();
    expect(first).toEqual({ ok: false, pendingCount: 1 });
    expect(useCartStore.getState().syncStatus).toBe('error');
    expect(useCartStore.getState().items[0].quantity).toBe(2); // no se pierde el cambio local

    const second = await useCartStore.getState().flushSync();
    expect(second.ok).toBe(true);
    expect(useCartStore.getState().syncStatus).toBe('idle');
  });

  it('producto no disponible: se quita y se avisa', async () => {
    service.setServerItemQuantity.mockRejectedValue(
      new HttpError(404, 'x', undefined, 'PRODUCT_NOT_AVAILABLE'),
    );
    useCartStore.getState().addItem(product(), 1);

    await useCartStore.getState().flushSync();

    const state = useCartStore.getState();
    expect(state.items).toEqual([]);
    expect(state.cartNotice?.code).toBe('PRODUCT_UNAVAILABLE');
    expect(state.cartNotice?.message).toContain('Batería');
    expect(state.pendingSync).toEqual([]);
  });

  it('tienda no disponible: se vacía el carrito y se avisa', async () => {
    service.setServerItemQuantity.mockRejectedValue(
      new HttpError(404, 'x', undefined, 'COMPANY_NOT_FOUND'),
    );
    useCartStore.getState().addItem(product(), 1);

    await useCartStore.getState().flushSync();

    expect(useCartStore.getState().items).toEqual([]);
    expect(useCartStore.getState().cartNotice?.code).toBe('STORE_UNAVAILABLE');
  });
});

describe('cartStore ↔ ms-orders — arranque y reconciliación', () => {
  it('syncWithServer: gana el servidor en lo no pendiente y sube lo pendiente', async () => {
    echoServer().set('s1', new Map([['otro-dispositivo', 2]]));
    useCartStore.setState({
      storeId: 's1',
      items: [
        { productId: 'viejo', name: 'Ya comprado', price: 100, image: null, quantity: 1, stockSnapshot: null, maxPerOrder: null },
        { productId: 'nuevo', name: 'Sin subir', price: 100, image: null, quantity: 3, stockSnapshot: null, maxPerOrder: null },
      ],
      pendingSync: ['nuevo'],
    });
    service.getServerCart.mockResolvedValue(serverCart('s1', [['otro-dispositivo', 2, 50]]));

    await useCartStore.getState().syncWithServer();
    await useCartStore.getState().flushSync();

    const ids = useCartStore.getState().items.map((item) => item.productId).sort();
    expect(ids).toEqual(['nuevo', 'otro-dispositivo']);
    expect(service.setServerItemQuantity).toHaveBeenCalledWith('s1', 'nuevo', 3);
  });

  it('syncWithServer concurrente comparte una sola lectura', async () => {
    useCartStore.setState({ storeId: 's1' });
    await Promise.all([
      useCartStore.getState().syncWithServer(),
      useCartStore.getState().syncWithServer(),
    ]);
    expect(service.getServerCart).toHaveBeenCalledTimes(1);
  });

  it('reconcileWithServerCart respeta los productos protegidos', () => {
    useCartStore.setState({
      storeId: 's1',
      items: [{ productId: 'p1', name: 'Local', price: 100, image: null, quantity: 5, stockSnapshot: null, maxPerOrder: null }],
    });
    useCartStore.setState((state) => {
      reconcileWithServerCart(state, serverCart('s1', [['p1', 1, 80]]), new Set(['p1']));
    });

    expect(useCartStore.getState().items[0]).toMatchObject({ quantity: 5, price: 100 });
  });
});
