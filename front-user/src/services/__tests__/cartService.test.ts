import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HttpError } from '../httpClient';
import {
  classifyCartSyncError,
  clearServerCart,
  getServerCart,
  resetCartServiceForTests,
  setServerItemQuantity,
} from '../cartService';

// Carrito de `ms-orders` con el shim de cantidad absoluta (docs/PLAN-PEDIDOS.md §2.2).

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers({ 'content-type': 'application/json' }),
    json: async () => body,
    text: async () => JSON.stringify(body),
  } as unknown as Response;
}

function cart(items: Array<{ id: string; productId: string; quantity: number; unitPrice?: number }>) {
  return {
    id: 'cart-1',
    companyId: 's1',
    items: items.map((item) => ({
      productName: `Producto ${item.productId}`,
      unitPrice: 1000.4,
      subtotal: 0,
      ...item,
    })),
    total: 5000.6,
  };
}

const notFound = (code: string) => jsonResponse({ code, message: code, details: {} }, 404);

let fetchMock: ReturnType<typeof vi.fn>;
const calls = () =>
  fetchMock.mock.calls.map(([url, init]) => {
    const body = (init as RequestInit).body;
    return `${(init as RequestInit).method} ${url}${body ? ` ${body}` : ''}`;
  });

beforeEach(() => {
  resetCartServiceForTests();
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('cartService — lectura y adaptador', () => {
  it('adapta el carrito y redondea el dinero a COP', async () => {
    fetchMock.mockResolvedValue(jsonResponse(cart([{ id: 'i1', productId: 'p1', quantity: 2 }])));

    const result = await getServerCart('s1');

    expect(result).toEqual({
      id: 'cart-1',
      storeId: 's1',
      items: [{ itemId: 'i1', productId: 'p1', name: 'Producto p1', unitPrice: 1000, quantity: 2 }],
      total: 5001,
    });
    expect(calls()[0]).toBe('GET /ms-orders/cart?companyId=s1');
  });

  it('CART_NOT_FOUND → null', async () => {
    fetchMock.mockResolvedValue(notFound('CART_NOT_FOUND'));
    await expect(getServerCart('s1')).resolves.toBeNull();
  });
});

describe('cartService — cantidad absoluta sobre la API actual', () => {
  it('primera alta: lee el carrito (no existe) y agrega la cantidad completa', async () => {
    fetchMock
      .mockResolvedValueOnce(notFound('CART_NOT_FOUND'))
      .mockResolvedValueOnce(jsonResponse(cart([{ id: 'i1', productId: 'p1', quantity: 3 }])));

    await setServerItemQuantity('s1', 'p1', 3);

    expect(calls()).toEqual([
      'GET /ms-orders/cart?companyId=s1',
      'POST /ms-orders/cart/items {"companyId":"s1","productId":"p1","quantity":3}',
    ]);
  });

  it('subir: envía solo la diferencia, sin releer el carrito ya conocido', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(cart([{ id: 'i1', productId: 'p1', quantity: 2 }])))
      .mockResolvedValueOnce(jsonResponse(cart([{ id: 'i1', productId: 'p1', quantity: 5 }])));
    await getServerCart('s1');

    await setServerItemQuantity('s1', 'p1', 5);

    expect(calls()[1]).toBe('POST /ms-orders/cart/items {"companyId":"s1","productId":"p1","quantity":3}');
    expect(calls()).toHaveLength(2);
  });

  it('bajar: borra el ítem y agrega la cantidad final', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(cart([{ id: 'i1', productId: 'p1', quantity: 5 }])))
      .mockResolvedValueOnce(jsonResponse(cart([])))
      .mockResolvedValueOnce(jsonResponse(cart([{ id: 'i2', productId: 'p1', quantity: 2 }])));
    await getServerCart('s1');

    const result = await setServerItemQuantity('s1', 'p1', 2);

    expect(calls().slice(1)).toEqual([
      'DELETE /ms-orders/cart/items/i1',
      'POST /ms-orders/cart/items {"companyId":"s1","productId":"p1","quantity":2}',
    ]);
    expect(result?.items[0].quantity).toBe(2);
  });

  it('cantidad 0 solo borra; igual a la actual no hace nada', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(cart([{ id: 'i1', productId: 'p1', quantity: 2 }])))
      .mockResolvedValueOnce(jsonResponse(cart([])));
    await getServerCart('s1');

    await setServerItemQuantity('s1', 'p1', 2);
    await setServerItemQuantity('s1', 'p1', 0);

    expect(calls().slice(1)).toEqual(['DELETE /ms-orders/cart/items/i1']);
  });

  it('tras un error de red relee el carrito antes de calcular la diferencia (no duplica)', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(cart([{ id: 'i1', productId: 'p1', quantity: 1 }])))
      .mockRejectedValueOnce(new TypeError('Failed to fetch')) // el POST pudo aplicarse
      .mockResolvedValueOnce(jsonResponse(cart([{ id: 'i1', productId: 'p1', quantity: 3 }])));
    await getServerCart('s1');

    await expect(setServerItemQuantity('s1', 'p1', 3)).rejects.toThrow('Failed to fetch');
    await setServerItemQuantity('s1', 'p1', 3);

    // El reintento lee que ya hay 3 y no vuelve a sumar.
    expect(calls().slice(2)).toEqual(['GET /ms-orders/cart?companyId=s1']);
  });

  it('CART_ITEM_NOT_FOUND: relee y reintenta una vez', async () => {
    fetchMock
      .mockResolvedValueOnce(jsonResponse(cart([{ id: 'viejo', productId: 'p1', quantity: 4 }])))
      .mockResolvedValueOnce(notFound('CART_ITEM_NOT_FOUND'))
      .mockResolvedValueOnce(jsonResponse(cart([{ id: 'i9', productId: 'p1', quantity: 4 }])))
      .mockResolvedValueOnce(jsonResponse(cart([])))
      .mockResolvedValueOnce(jsonResponse(cart([{ id: 'i10', productId: 'p1', quantity: 1 }])));
    await getServerCart('s1');

    const result = await setServerItemQuantity('s1', 'p1', 1);

    expect(calls().slice(1)).toEqual([
      'DELETE /ms-orders/cart/items/viejo',
      'GET /ms-orders/cart?companyId=s1',
      'DELETE /ms-orders/cart/items/i9',
      'POST /ms-orders/cart/items {"companyId":"s1","productId":"p1","quantity":1}',
    ]);
    expect(result?.items[0].quantity).toBe(1);
  });

  it('clearServerCart borra cada ítem conocido', async () => {
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse(
          cart([
            { id: 'i1', productId: 'p1', quantity: 1 },
            { id: 'i2', productId: 'p2', quantity: 1 },
          ]),
        ),
      )
      .mockResolvedValueOnce(jsonResponse(cart([{ id: 'i2', productId: 'p2', quantity: 1 }])))
      .mockResolvedValueOnce(jsonResponse(cart([])));

    await clearServerCart('s1');

    expect(calls()).toEqual([
      'GET /ms-orders/cart?companyId=s1',
      'DELETE /ms-orders/cart/items/i1',
      'DELETE /ms-orders/cart/items/i2',
    ]);
  });
});

describe('cartService — clasificación de errores', () => {
  it.each([
    [new HttpError(404, 'x', undefined, 'PRODUCT_NOT_AVAILABLE'), 'product_unavailable'],
    [new HttpError(404, 'x', undefined, 'COMPANY_NOT_FOUND'), 'store_unavailable'],
    [new HttpError(401, 'x'), 'unauthorized'],
    [new HttpError(503, 'x'), 'retryable'],
    [new TypeError('Failed to fetch'), 'retryable'],
    [new HttpError(400, 'x', undefined, 'INVALID_REQUEST'), 'rejected'],
  ])('%s → %s', (error, kind) => {
    expect(classifyCartSyncError(error)).toBe(kind);
  });
});
