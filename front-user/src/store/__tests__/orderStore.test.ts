import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { CreateOrderPayload, Order } from '@/types';

// El pedido real lo crea `ms-orders` (orderService simulado aquí); el store
// agrega la capa de seguimiento simulada (docs/PLAN-PEDIDOS.md §2.5).
vi.mock('@/services/orderService', () => ({
  checkoutOrder: vi.fn(),
  cancelServerOrder: vi.fn(),
}));

import * as orderService from '@/services/orderService';
import type { PlacedOrder } from '@/services/orderService';
import { useOrderStore } from '../orderStore';

const service = vi.mocked(orderService);
let serverSequence = 0;

/** Respuesta del servidor: un pedido nuevo por clave de idempotencia. */
function placedOrder(idempotencyKey: string): PlacedOrder {
  serverSequence += 1;
  return {
    id: `uuid-${idempotencyKey}`,
    number: 100 + serverSequence,
    storeId: 's1',
    items: [
      { productId: 'p1', name: 'Batería', price: 250000, image: null, quantity: 1, stockSnapshot: null, maxPerOrder: null },
    ],
    deliveryAddress: { street: 'Calle 10 #20-30', city: 'Medellín', coordinates: { lat: 6.2232, lng: -75.6016 } },
    breakdown: { subtotal: 250000, deliveryFee: null, serviceFee: 0, total: 250000 },
    paymentStatus: 'PENDING',
    createdAt: new Date().toISOString(),
  };
}

let keySequence = 0;
// Payload mínimo válido; cada llamada usa una clave de idempotencia nueva.
function makePayload(overrides: Partial<CreateOrderPayload> = {}): CreateOrderPayload {
  keySequence += 1;
  return {
    storeId: 's1',
    storeName: 'Tienda 1',
    storeSlug: 'tienda-1',
    addressId: 'addr-1',
    idempotencyKey: `key-${keySequence}`,
    paymentMethod: 'cash',
    ...overrides,
  };
}

// Orden sintética para poblar el store sin pagar el delay de createOrder.
function makeOrder(id: string, status: Order['status'] = 'CREADO'): Order {
  return {
    id,
    storeId: 's1',
    storeName: 'Tienda 1',
    storeSlug: 'tienda-1',
    items: [],
    deliveryAddress: { street: 'Calle 10', city: 'Medellín' },
    paymentMethod: 'cash',
    paymentStatus: 'PENDING',
    breakdown: { subtotal: 0, deliveryFee: 0, serviceFee: 0, total: 0 },
    status,
    stateHistory: [{ status, timestamp: new Date().toISOString() }],
    driver: null,
    rating: null,
    createdAt: new Date().toISOString(),
    estimatedDeliveryMinutes: 25,
  };
}

function resetOrders(): void {
  localStorage.clear();
  useOrderStore.setState({ orders: [], isLoading: false, error: null });
}

beforeEach(() => {
  resetOrders();
  vi.clearAllMocks();
  service.checkoutOrder.mockImplementation(async (params) => placedOrder(params.idempotencyKey));
  service.cancelServerOrder.mockResolvedValue(undefined);
});

describe('orderStore — creación', () => {
  it('createOrder usa el pedido del servidor (UUID, número, totales) y estado CREADO en efectivo', async () => {
    const order = await useOrderStore.getState().createOrder(makePayload({ customerNotes: 'Llamar' }));

    expect(service.checkoutOrder).toHaveBeenCalledWith({
      storeId: 's1',
      addressId: 'addr-1',
      customerNotes: 'Llamar',
      idempotencyKey: expect.stringMatching(/^key-/),
    });
    expect(order.id).toMatch(/^uuid-key-/);
    expect(order.number).toBeGreaterThan(100);
    expect(order.breakdown.total).toBe(250000);
    expect(order.status).toBe('CREADO');
    expect(order.paymentStatus).toBe('PENDING');
    expect(order.stateHistory).toHaveLength(1);
    expect(useOrderStore.getState().orders[0].id).toBe(order.id);
  });

  it('un reintento idempotente (mismo pedido) no lo duplica', async () => {
    const payload = makePayload();
    await useOrderStore.getState().createOrder(payload);
    await useOrderStore.getState().createOrder(payload);

    expect(useOrderStore.getState().orders).toHaveLength(1);
  });

  it('toma las imágenes del carrito local, que el servidor no guarda', async () => {
    const order = await useOrderStore.getState().createOrder(
      makePayload({
        cartItems: [
          { productId: 'p1', name: 'Batería', price: 1, image: 'https://img/p1.png', quantity: 1, stockSnapshot: null, maxPerOrder: null },
        ],
      })
    );

    expect(order.items[0].image).toBe('https://img/p1.png');
  });

  it('si el servidor falla, no crea nada local y propaga el error', async () => {
    service.checkoutOrder.mockRejectedValueOnce(new Error('Sin stock'));

    await expect(useOrderStore.getState().createOrder(makePayload())).rejects.toThrow('Sin stock');
    expect(useOrderStore.getState().orders).toEqual([]);
    expect(useOrderStore.getState().error).toBe('Sin stock');
  });

  it('createOrder con wompi nace PAGADO', async () => {
    const order = await useOrderStore.getState().createOrder(
      makePayload({ paymentMethod: 'wompi' })
    );

    expect(order.status).toBe('PAGADO');
    expect(order.paymentStatus).toBe('PAID');
  });

  it('createOrder hace prepend y retiene máximo 20', async () => {
    useOrderStore.setState({
      orders: Array.from({ length: 20 }, (_, i) => makeOrder(`OLD-${i}`)),
    });

    const order = await useOrderStore.getState().createOrder(makePayload());
    const { orders } = useOrderStore.getState();

    expect(orders).toHaveLength(20);
    expect(orders[0].id).toBe(order.id);
  });

  it('driverCoordinates inicia en la tienda', async () => {
    const storeCoordinates = { lat: 6.2, lng: -75.5 };
    const order = await useOrderStore
      .getState()
      .createOrder(makePayload({ storeCoordinates }));

    expect(order.driverCoordinates).toEqual(storeCoordinates);
  });
});

describe('orderStore — ciclo de vida', () => {
  it('getOrderById resuelve indexado', async () => {
    const order = await useOrderStore.getState().createOrder(makePayload());
    expect(useOrderStore.getState().getOrderById(order.id)?.id).toBe(order.id);
    expect(useOrderStore.getState().getOrderById('nope')).toBeUndefined();
  });

  it('updateOrderStatus apendea historial', async () => {
    const order = await useOrderStore.getState().createOrder(makePayload());
    useOrderStore.getState().updateOrderStatus(order.id, 'EN_CAMINO', 'Va en camino');

    const updated = useOrderStore.getState().getOrderById(order.id);
    expect(updated?.status).toBe('EN_CAMINO');
    expect(updated?.stateHistory).toHaveLength(2);
    expect(updated?.stateHistory[1].note).toBe('Va en camino');
  });

  it('cancelOrder bloquea EN_CAMINO/ENTREGADO', async () => {
    useOrderStore.setState({
      orders: [makeOrder('A', 'EN_CAMINO'), makeOrder('B', 'ENTREGADO'), makeOrder('C')],
    });

    expect(await useOrderStore.getState().cancelOrder('A')).toBe(false);
    expect(await useOrderStore.getState().cancelOrder('B')).toBe(false);
    expect(await useOrderStore.getState().cancelOrder('C')).toBe(true);
    expect(useOrderStore.getState().getOrderById('C')?.status).toBe('CANCELADO');
    // Pedido mock (sin número de servidor): no se llama a ms-orders.
    expect(service.cancelServerOrder).not.toHaveBeenCalled();
  });

  it('cancelOrder de un pedido real cancela primero en ms-orders', async () => {
    const order = await useOrderStore.getState().createOrder(makePayload());

    expect(await useOrderStore.getState().cancelOrder(order.id, 'Me equivoqué')).toBe(true);
    expect(service.cancelServerOrder).toHaveBeenCalledWith(order.id, 'Me equivoqué');
    expect(useOrderStore.getState().getOrderById(order.id)?.status).toBe('CANCELADO');
  });

  it('si ms-orders rechaza la cancelación, el pedido local no cambia', async () => {
    const order = await useOrderStore.getState().createOrder(makePayload());
    service.cancelServerOrder.mockRejectedValueOnce(new Error('La orden ya avanzó'));

    expect(await useOrderStore.getState().cancelOrder(order.id)).toBe(false);
    expect(useOrderStore.getState().getOrderById(order.id)?.status).toBe('CREADO');
    expect(useOrderStore.getState().error).toBe('La orden ya avanzó');
  });

  it('rateOrder guarda ambas calificaciones', async () => {
    const order = await useOrderStore.getState().createOrder(makePayload());
    useOrderStore.getState().updateOrderStatus(order.id, 'ENTREGADO');
    useOrderStore.getState().rateOrder(order.id, {
      storeRating: 5,
      driverRating: 4,
      submittedAt: new Date().toISOString(),
    });

    const rated = useOrderStore.getState().getOrderById(order.id);
    expect(rated?.rating?.storeRating).toBe(5);
    expect(rated?.rating?.driverRating).toBe(4);
  });

  it('updateDriverCoordinates mueve solo el pedido indicado', async () => {
    const o1 = await useOrderStore.getState().createOrder(makePayload());
    const o2 = await useOrderStore.getState().createOrder(makePayload());
    useOrderStore.getState().updateDriverCoordinates(o1.id, { lat: 1, lng: 2 });

    expect(useOrderStore.getState().getOrderById(o1.id)?.driverCoordinates).toEqual({
      lat: 1,
      lng: 2,
    });
    expect(useOrderStore.getState().getOrderById(o2.id)?.driverCoordinates).not.toEqual({
      lat: 1,
      lng: 2,
    });
  });
});
