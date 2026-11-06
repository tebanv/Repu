import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HttpError } from '../httpClient';
import { cancelServerOrder, checkoutOrder, describeCheckoutError, toPlacedOrder } from '../orderService';

// Checkout de `ms-orders` (docs/PLAN-PEDIDOS.md §2.4 y §3).

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers({ 'content-type': 'application/json' }),
    json: async () => body,
    text: async () => JSON.stringify(body),
  } as unknown as Response;
}

const ORDER = {
  id: '0b6f3c9a-1d2e-4f50-9a7b-8c9d0e1f2a3b',
  humanReadableId: 123,
  buyerUserId: 'u1',
  companyId: 's1',
  version: 0,
  orderStatus: 'CREADA',
  paymentStatus: 'PENDIENTE',
  merchantStatus: 'PENDIENTE_CONFIRMACION',
  deliveryStatus: 'NO_ASIGNADO',
  subtotal: 500000.4,
  shippingCost: 0,
  discounts: 0,
  taxes: 0,
  finalTotal: 500000.4,
  serviceFee: 0,
  deliveryAddressSnapshot: {
    name: 'Taller',
    fullAddress: 'Cra 43A # 1-50',
    city: 'Medellín',
    deliveryNotes: 'Portería',
    lat: 6.2,
    lng: -75.56,
  },
  items: [
    {
      itemId: 'd1',
      productId: 'p1',
      nameSnapshot: 'Batería 12V',
      skuSnapshot: 'BAT-1',
      unitPriceSnapshot: 250000.2,
      quantity: 2,
      lineTotal: 500000.4,
      selectedOptionsSnapshot: {},
    },
  ],
  createdAt: '2026-11-05T21:00:00Z',
};

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('orderService — adaptador', () => {
  it('traduce OrderResponse a dominio con dinero entero COP', () => {
    expect(toPlacedOrder(ORDER)).toEqual({
      id: ORDER.id,
      number: 123,
      storeId: 's1',
      items: [
        { productId: 'p1', name: 'Batería 12V', price: 250000, image: null, quantity: 2, stockSnapshot: null, maxPerOrder: null },
      ],
      deliveryAddress: {
        street: 'Cra 43A # 1-50',
        details: 'Taller',
        city: 'Medellín',
        notes: 'Portería',
        coordinates: { lat: 6.2, lng: -75.56 },
      },
      breakdown: { subtotal: 500000, deliveryFee: null, serviceFee: 0, total: 500000 },
      paymentStatus: 'PENDING',
      createdAt: '2026-11-05T21:00:00Z',
    });
  });

  it('envío > 0 se muestra; PAGADO → PAID', () => {
    const placed = toPlacedOrder({ ...ORDER, shippingCost: 6000, paymentStatus: 'PAGADO' });
    expect(placed.breakdown.deliveryFee).toBe(6000);
    expect(placed.paymentStatus).toBe('PAID');
  });
});

describe('orderService — checkout', () => {
  it('envía companyId/addressId/notas y usa la clave como X-Request-ID', async () => {
    fetchMock.mockResolvedValue(jsonResponse(ORDER, 201));
    const key = '7f1c2a9e-3b4d-4e5f-8a6b-1c2d3e4f5a6b';

    const placed = await checkoutOrder({ storeId: 's1', addressId: 'a1', customerNotes: '  ', idempotencyKey: key });

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/ms-orders/api/orders/checkout');
    expect(JSON.parse(init.body as string)).toEqual({ companyId: 's1', addressId: 'a1', customerNotes: null });
    expect((init.headers as Headers).get('x-request-id')).toBe(key);
    expect(placed.number).toBe(123);
  });

  it('cancelServerOrder envía el motivo', async () => {
    fetchMock.mockResolvedValue(jsonResponse(ORDER));
    await cancelServerOrder('o-1', 'Me equivoqué');

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/ms-orders/api/orders/o-1/cancel');
    expect(JSON.parse(init.body as string)).toEqual({ reason: 'Me equivoqué' });
  });
});

describe('orderService — errores del checkout', () => {
  it.each([
    [new HttpError(409, 'x', undefined, 'INSUFFICIENT_STOCK'), 'refresh_cart'],
    [new HttpError(404, 'x', undefined, 'PRODUCT_NOT_AVAILABLE'), 'refresh_cart'],
    [new HttpError(400, 'x', undefined, 'CART_EMPTY'), 'refresh_cart'],
    [new HttpError(404, 'x', undefined, 'ADDRESS_NOT_FOUND'), 'refresh_addresses'],
    [new HttpError(409, 'x', undefined, 'IDEMPOTENCY_CONFLICT'), 'new_attempt'],
    [new HttpError(401, 'x'), 'session'],
    [new HttpError(503, 'x'), 'retry'],
    [new TypeError('Failed to fetch'), 'retry'],
  ])('%s → %s', (error, recovery) => {
    expect(describeCheckoutError(error).recovery).toBe(recovery);
  });
});
