'use client';

import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { enableCrossTabSync } from '@/lib/storageSync';
import { cancelServerOrder, checkoutOrder } from '@/services/orderService';
import type {
  Order,
  OrderStatus,
  CreateOrderPayload,
  OrderStateHistoryItem,
  Coordinates,
  OrderRating,
} from '@/types';

export const ORDER_STORAGE_KEY = 'order-storage';

export interface OrderStoreState {
  orders: Order[];
  isLoading: boolean;
  error: string | null;

  createOrder: (payload: CreateOrderPayload) => Promise<Order>;
  getOrderById: (id: string) => Order | undefined;
  updateOrderStatus: (id: string, status: OrderStatus, note?: string) => void;
  updateDriverCoordinates: (id: string, coords: Coordinates) => void;
  rateOrder: (id: string, rating: OrderRating) => void;
  /**
   * Cancela el pedido. Si es un pedido real, primero en `ms-orders` (libera
   * la reserva de inventario); si el servidor lo rechaza, no cambia nada local.
   */
  cancelOrder: (id: string, reason?: string) => Promise<boolean>;
  clearOrders: () => void;
}

// Pedido real + capa de seguimiento simulada (docs/PLAN-PEDIDOS.md §2.5):
// id, número, ítems, dirección y totales vienen de `ms-orders`; estado,
// repartidor, avance y calificación siguen simulados hasta los cortes de
// tracking y pagos. El estado de pago también es simulado: el backend aún no
// integra pagos y todo pedido real nace `PENDIENTE` allá.
const SIMULATED_DRIVER = {
  name: 'Carlos Andrés Rodríguez',
  phone: '+57 312 456 7890',
  vehicleType: 'Motocicleta Yamaha FZ 2.0',
  vehiclePlate: 'REP-45F',
  rating: 4.9,
};

export const useOrderStore = create<OrderStoreState>()(
  persist(
    (set, get) => ({
      orders: [],
      isLoading: false,
      error: null,

      createOrder: async (payload: CreateOrderPayload): Promise<Order> => {
        set({ isLoading: true, error: null });

        try {
          const placed = await checkoutOrder({
            storeId: payload.storeId,
            addressId: payload.addressId,
            customerNotes: payload.customerNotes,
            idempotencyKey: payload.idempotencyKey,
          });

          // Coordenadas por defecto solo para la simulación del mapa.
          const storeCoords: Coordinates = payload.storeCoordinates || {
            lat: 6.2087,
            lng: -75.5678,
          };
          const deliveryCoords: Coordinates = placed.deliveryAddress.coordinates || {
            lat: 6.2232,
            lng: -75.6016,
          };
          // El servidor no guarda imágenes: se toman del carrito local.
          const images = new Map(
            (payload.cartItems ?? []).map((item) => [item.productId, item.image] as const)
          );
          const isSimulatedPaid = payload.paymentMethod === 'wompi';
          const initialStatus: OrderStatus = isSimulatedPaid ? 'PAGADO' : 'CREADO';
          const initialHistory: OrderStateHistoryItem[] = [
            {
              status: 'CREADO',
              timestamp: placed.createdAt,
              note: 'Pedido registrado en la plataforma',
            },
          ];

          const newOrder: Order = {
            id: placed.id,
            number: placed.number,
            storeId: placed.storeId,
            storeName: payload.storeName,
            storeSlug: payload.storeSlug,
            storeCoordinates: storeCoords,
            items: placed.items.map((item) => ({
              ...item,
              image: images.get(item.productId) ?? null,
            })),
            deliveryAddress: { ...placed.deliveryAddress, coordinates: deliveryCoords },
            paymentMethod: payload.paymentMethod,
            paymentStatus: isSimulatedPaid ? 'PAID' : placed.paymentStatus,
            breakdown: placed.breakdown,
            status: initialStatus,
            stateHistory: initialHistory,
            driver: SIMULATED_DRIVER,
            driverCoordinates: storeCoords,
            rating: null,
            createdAt: placed.createdAt,
            estimatedDeliveryMinutes: payload.estimatedDeliveryMinutes || 25,
          };

          set((state) => ({
            // Un reintento idempotente devuelve el mismo pedido: no duplicarlo.
            orders: [newOrder, ...state.orders.filter((order) => order.id !== newOrder.id)].slice(0, 20),
            isLoading: false,
            error: null,
          }));

          return newOrder;
        } catch (error) {
          const message =
            error instanceof Error ? error.message : 'Error al procesar el pedido';
          set({ error: message, isLoading: false });
          throw error;
        }
      },

      getOrderById: (id: string) => {
        return get().orders.find((order) => order.id === id);
      },

      updateOrderStatus: (id: string, status: OrderStatus, note?: string) => {
        set((state) => ({
          orders: state.orders.map((order) => {
            if (order.id !== id) return order;

            const newHistoryItem: OrderStateHistoryItem = {
              status,
              timestamp: new Date().toISOString(),
              note: note || `Estado actualizado a ${status}`,
            };

            return {
              ...order,
              status,
              stateHistory: [...order.stateHistory, newHistoryItem],
            };
          }),
        }));
      },

      updateDriverCoordinates: (id: string, coords: Coordinates) => {
        set((state) => ({
          orders: state.orders.map((order) => {
            if (order.id !== id) return order;
            return {
              ...order,
              driverCoordinates: coords,
            };
          }),
        }));
      },

      rateOrder: (id: string, rating: OrderRating) => {
        set((state) => ({
          orders: state.orders.map((order) => {
            if (order.id !== id) return order;
            return {
              ...order,
              rating,
            };
          }),
        }));
      },

      cancelOrder: async (id: string, reason = 'Cancelado por el cliente'): Promise<boolean> => {
        const order = get().orders.find((o) => o.id === id);
        if (!order || order.status === 'EN_CAMINO' || order.status === 'ENTREGADO') {
          return false;
        }

        // Pedido real: el servidor decide (solo cancela antes de que la tienda
        // lo acepte) y libera el inventario reservado en el checkout.
        if (order.number != null) {
          try {
            await cancelServerOrder(id, reason);
          } catch (error) {
            set({ error: error instanceof Error ? error.message : 'No se pudo cancelar el pedido' });
            return false;
          }
        }

        get().updateOrderStatus(id, 'CANCELADO', reason);
        return true;
      },

      clearOrders: () => {
        set({ orders: [] });
      },
    }),
    {
      name: ORDER_STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        orders: state.orders,
      }),
    }
  )
);

import { useShallow } from 'zustand/react/shallow';

/**
 * Sincronización multi-tab: pedidos creados en otra pestaña aparecen aquí.
 */
enableCrossTabSync(ORDER_STORAGE_KEY, () => {
  void useOrderStore.persist.rehydrate();
});

// ========================================
// SELECTORES DEDICADOS Y MEMOIZADOS (SHALLOW)
// ========================================

/**
 * Retorna todos los pedidos activos (que no han sido entregados ni cancelados).
 * Utiliza useShallow para comparar el arreglo y cachear la referencia en React 19 / getSnapshot.
 */
export const useActiveOrders = () =>
  useOrderStore(
    useShallow((state) =>
      state.orders.filter((o) => o.status !== 'ENTREGADO' && o.status !== 'CANCELADO')
    )
  );

/**
 * Retorna el número de pedidos activos en formato primitivo (number)
 * para suscripciones atómicas sin re-renders innecesarios.
 */
export const useActiveOrdersCount = () =>
  useOrderStore(
    (state) =>
      state.orders.filter((o) => o.status !== 'ENTREGADO' && o.status !== 'CANCELADO').length
  );

/**
 * Retorna el historial de pedidos finalizados en la sesión (ENTREGADO o CANCELADO).
 * Utiliza useShallow para estabilidad referencial en useSyncExternalStore.
 */
export const useCompletedOrders = () =>
  useOrderStore(
    useShallow((state) =>
      state.orders.filter((o) => o.status === 'ENTREGADO' || o.status === 'CANCELADO')
    )
  );

export default useOrderStore;

