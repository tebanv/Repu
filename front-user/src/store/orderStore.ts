'use client';

import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { enableCrossTabSync } from '@/lib/storageSync';
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
  cancelOrder: (id: string) => boolean;
  clearOrders: () => void;
}

function generateOrderId(): string {
  const year = new Date().getFullYear();
  const randomCode = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `REP-${year}-${randomCode}`;
}

export const useOrderStore = create<OrderStoreState>()(
  persist(
    (set, get) => ({
      orders: [],
      isLoading: false,
      error: null,

      createOrder: async (payload: CreateOrderPayload): Promise<Order> => {
        set({ isLoading: true, error: null });

        try {
          // Simulación breve de llamada a API backend
          await new Promise((resolve) => setTimeout(resolve, 600));

          const orderId = generateOrderId();
          const now = new Date().toISOString();

          const initialHistory: OrderStateHistoryItem[] = [
            {
              status: 'CREADO',
              timestamp: now,
              note: 'Pedido registrado en la plataforma',
            },
          ];

          // Coordenadas por defecto si no vienen especificadas
          const storeCoords: Coordinates = payload.storeCoordinates || {
            lat: 6.2087,
            lng: -75.5678,
          };

          const deliveryCoords: Coordinates = payload.deliveryAddress.coordinates || {
            lat: 6.2232,
            lng: -75.6016,
          };

          const newOrder: Order = {
            id: orderId,
            storeId: payload.storeId,
            storeName: payload.storeName,
            storeSlug: payload.storeSlug,
            storeCoordinates: storeCoords,
            items: payload.items,
            deliveryAddress: {
              ...payload.deliveryAddress,
              coordinates: deliveryCoords,
            },
            paymentMethod: payload.paymentMethod,
            paymentStatus: payload.paymentMethod === 'wompi' ? 'PAID' : 'PENDING',
            breakdown: payload.breakdown,
            status: payload.paymentMethod === 'wompi' ? 'PAGADO' : 'CREADO',
            stateHistory: initialHistory,
            driver: {
              name: 'Carlos Andrés Rodríguez',
              phone: '+57 312 456 7890',
              vehicleType: 'Motocicleta Yamaha FZ 2.0',
              vehiclePlate: 'REP-45F',
              rating: 4.9,
            },
            driverCoordinates: storeCoords,
            rating: null,
            createdAt: now,
            estimatedDeliveryMinutes: payload.estimatedDeliveryMinutes || 25,
          };

          set((state) => ({
            orders: [newOrder, ...state.orders].slice(0, 20),
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

      cancelOrder: (id: string): boolean => {
        const order = get().orders.find((o) => o.id === id);
        if (!order || order.status === 'EN_CAMINO' || order.status === 'ENTREGADO') {
          return false;
        }

        get().updateOrderStatus(id, 'CANCELADO', 'Pedido cancelado por el cliente');
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

