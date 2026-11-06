import type { CartItem } from './cart';
import type { Coordinates } from './common';

export type PaymentMethod =
  | 'cash'
  | 'card_delivery'
  | 'wompi'
  | 'nequi'
  | 'transfer';

export type OrderStatus =
  | 'CREADO'
  | 'PAGADO'
  | 'ACEPTADO'
  | 'PREPARANDO'
  | 'LISTO'
  | 'RECOGIDO'
  | 'EN_CAMINO'
  | 'ENTREGADO'
  | 'CANCELADO';

export interface DeliveryAddress {
  street: string;
  details?: string;
  city: string;
  notes?: string;
  coordinates?: Coordinates;
}

export interface OrderBreakdown {
  subtotal: number;
  /** `null` = costo de envío por confirmar; no se suma a `total`. */
  deliveryFee: number | null;
  serviceFee: number;
  total: number;
}

export interface DriverInfo {
  name: string;
  phone: string;
  vehicleType: string;
  vehiclePlate: string;
  rating: number;
  avatar?: string | null;
}

export interface OrderStateHistoryItem {
  status: OrderStatus;
  timestamp: string;
  note?: string;
}

export interface OrderRating {
  storeRating: number;
  driverRating: number;
  comments?: string;
  submittedAt: string;
}

export interface Order {
  /** UUID de `ms-orders` (pedidos reales) o `REP-YYYY-XXXX` (pedidos mock previos al corte). */
  id: string;
  /** Número legible del servidor, se muestra como `#123`. `null` en pedidos mock. */
  number?: number | null;
  storeId: string;
  storeName: string;
  storeSlug: string;
  storeCoordinates?: Coordinates;
  items: CartItem[];
  deliveryAddress: DeliveryAddress;
  paymentMethod: PaymentMethod;
  paymentStatus: 'PENDING' | 'PAID';
  breakdown: OrderBreakdown;
  status: OrderStatus;
  stateHistory: OrderStateHistoryItem[];
  driver?: DriverInfo | null;
  driverCoordinates?: Coordinates;
  rating?: OrderRating | null;
  createdAt: string;
  estimatedDeliveryMinutes: number;
}

/**
 * Datos para crear un pedido real (docs/PLAN-PEDIDOS.md §2.4 y §2.5).
 * Ítems, dirección y totales los define el servidor a partir de su carrito;
 * aquí solo va lo que el checkout necesita y el contexto de presentación.
 */
export interface CreateOrderPayload {
  storeId: string;
  storeName: string;
  storeSlug: string;
  storeCoordinates?: Coordinates;
  /** Dirección guardada en `ms-users`. */
  addressId: string;
  customerNotes?: string | null;
  /** UUID del intento de compra (`X-Request-ID`). */
  idempotencyKey: string;
  paymentMethod: PaymentMethod;
  estimatedDeliveryMinutes?: number;
  /** Solo presentación: imágenes del carrito local, que el servidor no guarda. */
  cartItems?: CartItem[];
}
