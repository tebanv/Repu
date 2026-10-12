import { beforeEach, describe, expect, it } from 'vitest';
import { useOrderStore } from '../orderStore';
import type { CreateOrderPayload, Order } from '@/types';

// Payload mínimo válido para crear pedidos en tests.
function makePayload(overrides: Partial<CreateOrderPayload> = {}): CreateOrderPayload {
  return {
    storeId: 's1',
    storeName: 'Tienda 1',
    storeSlug: 'tienda-1',
    items: [
      {
        productId: 'p1',
        name: 'Batería',
        price: 250000,
        image: null,
        quantity: 1,
        stockSnapshot: 10,
        maxPerOrder: null,
      },
    ],
    deliveryAddress: {
      street: 'Calle 10 #20-30',
      city: 'Medellín',
      coordinates: { lat: 6.2232, lng: -75.6016 },
    },
    paymentMethod: 'cash',
    breakdown: { subtotal: 250000, deliveryFee: 8000, serviceFee: 2000, total: 260000 },
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
});

describe('orderStore — creación', () => {
  it('createOrder genera id REP-YYYY y estado CREADO en efectivo', async () => {
    const order = await useOrderStore.getState().createOrder(makePayload());
    const year = new Date().getFullYear();

    expect(order.id).toMatch(new RegExp(`^REP-${year}-`));
    expect(order.status).toBe('CREADO');
    expect(order.paymentStatus).toBe('PENDING');
    expect(order.stateHistory).toHaveLength(1);
    expect(useOrderStore.getState().orders[0].id).toBe(order.id);
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

  it('cancelOrder bloquea EN_CAMINO/ENTREGADO', () => {
    useOrderStore.setState({
      orders: [makeOrder('A', 'EN_CAMINO'), makeOrder('B', 'ENTREGADO'), makeOrder('C')],
    });

    expect(useOrderStore.getState().cancelOrder('A')).toBe(false);
    expect(useOrderStore.getState().cancelOrder('B')).toBe(false);
    expect(useOrderStore.getState().cancelOrder('C')).toBe(true);
    expect(useOrderStore.getState().getOrderById('C')?.status).toBe('CANCELADO');
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
