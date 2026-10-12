import { beforeEach, describe, expect, it } from 'vitest';
import useCartStore, {
  CART_STORAGE_KEY,
  CART_TTL_MS,
  isCartExpired,
  selectCartItemByProductId,
  selectIsSameStore,
} from '../cartStore';
import type { CartProductInput } from '@/types';

// Helpers para construir inputs de producto con contexto de tienda.
function makeProduct(overrides: Partial<CartProductInput> = {}): CartProductInput {
  return {
    id: 'p1',
    name: 'Batería 12V 60Ah',
    price: 250000,
    stock: 10,
    storeId: 's1',
    storeSlug: 'tienda-1',
    storeName: 'Tienda 1',
    ...overrides,
  };
}

// Resetea store + storage entre tests para aislamiento total.
function resetCart(): void {
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
  });
}

beforeEach(() => {
  resetCart();
});

describe('cartStore — altas y merge', () => {
  it('addItem nuevo fija contexto y derivados', () => {
    const result = useCartStore.getState().addItem(makeProduct(), 2);

    expect(result.ok).toBe(true);
    expect(result.code).toBe('ITEM_ADDED');
    const state = useCartStore.getState();
    expect(state.storeId).toBe('s1');
    expect(state.itemCount).toBe(2);
    expect(state.subtotal).toBe(500000);
    expect(state.items).toHaveLength(1);
  });

  it('addItem existente mergea cantidades', () => {
    const { addItem } = useCartStore.getState();
    addItem(makeProduct(), 1);
    const result = useCartStore.getState().addItem(makeProduct(), 2);

    expect(result.ok).toBe(true);
    expect(result.code).toBe('ITEM_UPDATED');
    expect(useCartStore.getState().itemCount).toBe(3);
    expect(useCartStore.getState().subtotal).toBe(750000);
  });

  it('doble addItem rápido es idempotente (suma atómica)', () => {
    const { addItem } = useCartStore.getState();
    addItem(makeProduct(), 1);
    addItem(makeProduct(), 1);

    expect(useCartStore.getState().itemCount).toBe(2);
    expect(useCartStore.getState().items).toHaveLength(1);
  });
});

describe('cartStore — regla una tienda por carrito', () => {
  it('bloquea producto de otra tienda sin mutar', () => {
    useCartStore.getState().addItem(makeProduct(), 1);
    const result = useCartStore
      .getState()
      .addItem(makeProduct({ id: 'p2', name: 'Llanta', storeId: 's2' }), 1);

    expect(result.ok).toBe(false);
    expect(result.code).toBe('STORE_CONFLICT');
    expect(result.currentStoreId).toBe('s1');
    expect(result.incomingStoreId).toBe('s2');
    expect(useCartStore.getState().items).toHaveLength(1);
    expect(useCartStore.getState().storeId).toBe('s1');
  });

  it('replaceStoreContext bloquea con items de otra tienda', () => {
    useCartStore.getState().addItem(makeProduct(), 1);
    const result = useCartStore
      .getState()
      .replaceStoreContext({ storeId: 's2', storeSlug: 't2', storeName: 'T2' });

    expect(result.ok).toBe(false);
    expect(result.code).toBe('STORE_CONFLICT');
  });

  it('replaceStoreContext permite con carrito vacío', () => {
    const result = useCartStore
      .getState()
      .replaceStoreContext({ storeId: 's9', storeSlug: 't9', storeName: 'T9' });

    expect(result.ok).toBe(true);
    expect(result.code).toBe('STORE_CONTEXT_REPLACED');
    expect(useCartStore.getState().storeId).toBe('s9');
  });
});

describe('cartStore — validación y límites', () => {
  it('rechaza producto inválido', () => {
    const result = useCartStore.getState().addItem({ price: 10 } as CartProductInput, 1);
    expect(result.ok).toBe(false);
    expect(result.code).toBe('INVALID_PRODUCT');
  });

  it('rechaza no disponible', () => {
    expect(
      useCartStore.getState().addItem(makeProduct({ isAvailable: false }), 1).code
    ).toBe('INVALID_PRODUCT');
  });

  // QUIRK documentado: stock 0 hoy se normaliza a "sin límite" (igual que null)
  // en vez de agotado. No se cambia la regla en Fase A; queda en deuda de TESTING §7.
  it('QUIRK: stock 0 se trata como ilimitado (pendiente regla de agotado)', () => {
    const result = useCartStore.getState().addItem(makeProduct({ stock: 0 }), 1);
    expect(result.ok).toBe(true);
    expect(result.code).toBe('ITEM_ADDED');
  });

  it('exige contexto de tienda y no adopta el id del producto', () => {
    const { storeId: _omit, ...withoutStore } = makeProduct();
    const result = useCartStore.getState().addItem(withoutStore, 1);
    expect(result.ok).toBe(false);
    expect(result.code).toBe('MISSING_STORE_CONTEXT');
    // Regresión: el id del producto (p1) jamás debe quedar como storeId.
    expect(useCartStore.getState().storeId).toBeNull();
    expect(useCartStore.getState().items).toHaveLength(0);
  });

  it('updateQuantity clamp por stock', () => {
    useCartStore.getState().addItem(makeProduct({ stock: 3 }), 1);
    const result = useCartStore.getState().updateQuantity('p1', 10);

    expect(result.ok).toBe(true);
    expect(result.code).toBe('QUANTITY_CLAMPED');
    expect(useCartStore.getState().items[0].quantity).toBe(3);
  });

  it('updateQuantity clamp por maxPerOrder', () => {
    useCartStore.getState().addItem(makeProduct({ stock: 10, maxPerOrder: 2 }), 1);
    const result = useCartStore.getState().updateQuantity('p1', 5);

    expect(result.code).toBe('QUANTITY_CLAMPED');
    expect(useCartStore.getState().items[0].quantity).toBe(2);
  });

  it('updateQuantity válida actualiza', () => {
    useCartStore.getState().addItem(makeProduct(), 1);
    const result = useCartStore.getState().updateQuantity('p1', 4);

    expect(result.code).toBe('QUANTITY_UPDATED');
    expect(useCartStore.getState().subtotal).toBe(1000000);
  });

  it('removeItem inexistente no muta', () => {
    useCartStore.getState().addItem(makeProduct(), 1);
    const result = useCartStore.getState().removeItem('nope');
    expect(result.ok).toBe(false);
    expect(result.code).toBe('ITEM_NOT_FOUND');
    expect(useCartStore.getState().items).toHaveLength(1);
  });

  it('removeItem último limpia contexto de tienda', () => {
    useCartStore.getState().addItem(makeProduct(), 1);
    const result = useCartStore.getState().removeItem('p1');

    expect(result.code).toBe('ITEM_REMOVED');
    const state = useCartStore.getState();
    expect(state.items).toHaveLength(0);
    expect(state.storeId).toBeNull();
    expect(state.itemCount).toBe(0);
    expect(state.subtotal).toBe(0);
  });

  it('redondea dinero a enteros COP sin drift', () => {
    useCartStore.getState().addItem(makeProduct({ price: 9999.6 }), 3);
    // 9999.6 -> 10000 * 3 = 30000 exactos
    expect(useCartStore.getState().subtotal).toBe(30000);
  });
});

describe('cartStore — expiración TTL', () => {
  it('sin items nunca expira', () => {
    expect(isCartExpired({ items: [], lastUpdatedAt: null })).toBe(false);
  });

  it('con items y timestamp viejo expira', () => {
    const old = new Date(Date.now() - CART_TTL_MS - 1000).toISOString();
    expect(
      isCartExpired({ items: [{ productId: 'p1' } as never], lastUpdatedAt: old })
    ).toBe(true);
  });

  it('con items sin timestamp expira (zombie)', () => {
    expect(
      isCartExpired({ items: [{ productId: 'p1' } as never], lastUpdatedAt: null })
    ).toBe(true);
  });

  it('con items recientes no expira', () => {
    const now = new Date().toISOString();
    expect(
      isCartExpired({ items: [{ productId: 'p1' } as never], lastUpdatedAt: now })
    ).toBe(false);
  });

  it('rehidratar expirado vacía y expone EXPIRED_CART', async () => {
    const old = new Date(Date.now() - CART_TTL_MS - 5000).toISOString();
    localStorage.setItem(
      CART_STORAGE_KEY,
      JSON.stringify({
        state: {
          storeId: 's1',
          storeSlug: 't1',
          storeName: 'T1',
          items: [
            {
              productId: 'p1',
              name: 'N',
              price: 100,
              image: null,
              quantity: 2,
              stockSnapshot: 10,
              maxPerOrder: null,
            },
          ],
          itemCount: 2,
          subtotal: 200,
          lastUpdatedAt: old,
          version: 1,
        },
        version: 1,
      })
    );

    await useCartStore.persist.rehydrate();
    const state = useCartStore.getState();
    expect(state.items).toHaveLength(0);
    expect(state.cartNotice?.code).toBe('EXPIRED_CART');
  });

  it('rehidratar corrupto sanea items inválidos', async () => {
    const now = new Date().toISOString();
    localStorage.setItem(
      CART_STORAGE_KEY,
      JSON.stringify({
        state: {
          storeId: 's1',
          storeSlug: 't1',
          storeName: 'T1',
          items: [
            { productId: null, name: null, price: 'x', quantity: 99 },
            {
              productId: 'p-ok',
              name: 'OK',
              price: 50,
              image: null,
              quantity: 1,
              stockSnapshot: 5,
              maxPerOrder: null,
            },
          ],
          itemCount: 100,
          subtotal: 999999,
          lastUpdatedAt: now,
          version: 1,
        },
        version: 1,
      })
    );

    await useCartStore.persist.rehydrate();
    const state = useCartStore.getState();
    expect(state.items).toHaveLength(1);
    expect(state.items[0].productId).toBe('p-ok');
    // Derivados recalculados, no los persistidos corruptos
    expect(state.itemCount).toBe(1);
    expect(state.subtotal).toBe(50);
  });
});

describe('cartStore — selectores puros', () => {
  it('selectCartItemByProductId y selectIsSameStore', () => {
    useCartStore.getState().addItem(makeProduct(), 1);
    const state = useCartStore.getState();

    expect(selectCartItemByProductId(state, 'p1')?.name).toContain('Batería');
    expect(selectCartItemByProductId(state, 'nope')).toBeNull();
    expect(selectIsSameStore(state, 's1')).toBe(true);
    expect(selectIsSameStore(state, 's2')).toBe(false);
    // Carrito vacío es compatible con cualquier tienda
    resetCart();
    expect(selectIsSameStore(useCartStore.getState(), 's2')).toBe(true);
  });
});
