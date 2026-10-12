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
  deliveryFee: number;
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
  id: string;
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

export interface CreateOrderPayload {
  storeId: string;
  storeName: string;
  storeSlug: string;
  storeCoordinates?: Coordinates;
  items: CartItem[];
  deliveryAddress: DeliveryAddress;
  paymentMethod: PaymentMethod;
  breakdown: OrderBreakdown;
  estimatedDeliveryMinutes?: number;
  driverCoordinates?: Coordinates;
}

