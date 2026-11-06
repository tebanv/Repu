// src/services/orderService.ts
// Pedidos en `ms-orders`: checkout y cancelación (docs/PLAN-PEDIDOS.md §2.4,
// §2.5 y §3). La UI y los stores reciben tipos de dominio; la forma del
// backend (`OrderResponse`, BigDecimal, snapshots) solo vive aquí.
//
// Alcance actual: crear el pedido real y cancelarlo. Estados en vivo,
// repartidor y pago siguen simulados en `orderStore` hasta los cortes de
// tracking y pagos.

import { HttpError, httpClient } from './httpClient';
import type { CartItem, DeliveryAddress, OrderBreakdown } from '@/types';

const ORDERS_BASE = '/ms-orders/api/orders';

// --- Respuesta cruda de `ms-orders` ---

interface OrderItemResponse {
  itemId: string;
  productId: string;
  nameSnapshot?: string | null;
  skuSnapshot?: string | null;
  unitPriceSnapshot?: number | string | null;
  quantity: number;
  lineTotal?: number | string | null;
}

interface OrderResponse {
  id: string;
  humanReadableId: number;
  companyId: string;
  orderStatus: string;
  paymentStatus: string;
  subtotal?: number | string | null;
  shippingCost?: number | string | null;
  serviceFee?: number | string | null;
  finalTotal?: number | string | null;
  deliveryAddressSnapshot?: Record<string, unknown> | null;
  items?: OrderItemResponse[] | null;
  createdAt: string;
}

// --- Modelo de dominio que consume `orderStore` ---

/** Lo que el servidor confirma de un pedido recién creado. */
export interface PlacedOrder {
  id: string;
  /** Número legible (`numero_orden_legible`), se muestra como `#123`. */
  number: number;
  storeId: string;
  items: CartItem[];
  deliveryAddress: DeliveryAddress;
  breakdown: OrderBreakdown;
  paymentStatus: 'PENDING' | 'PAID';
  createdAt: string;
}

export interface CheckoutParams {
  storeId: string;
  addressId: string;
  customerNotes?: string | null;
  /** UUID del intento de compra; un reintento debe reutilizarlo. */
  idempotencyKey: string;
}

function toCop(value: unknown): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, Math.round(parsed)) : 0;
}

function text(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

/** Adaptador `OrderResponse` → `PlacedOrder`. Exportado para pruebas. */
export function toPlacedOrder(raw: OrderResponse): PlacedOrder {
  const snapshot = raw.deliveryAddressSnapshot ?? {};
  const lat = Number(snapshot.lat);
  const lng = Number(snapshot.lng);
  const shippingCost = toCop(raw.shippingCost);
  const subtotal = toCop(raw.subtotal);

  return {
    id: raw.id,
    number: raw.humanReadableId,
    storeId: raw.companyId,
    items: (raw.items ?? []).map((item) => ({
      productId: item.productId,
      name: text(item.nameSnapshot) ?? 'Producto',
      price: toCop(item.unitPriceSnapshot),
      image: null,
      quantity: item.quantity,
      stockSnapshot: null,
      maxPerOrder: null,
    })),
    deliveryAddress: {
      street: text(snapshot.fullAddress) ?? '',
      details: text(snapshot.name),
      city: text(snapshot.city) ?? '',
      notes: text(snapshot.deliveryNotes),
      coordinates:
        snapshot.lat != null && snapshot.lng != null && Number.isFinite(lat) && Number.isFinite(lng)
          ? { lat, lng }
          : undefined,
    },
    breakdown: {
      subtotal,
      // El backend aún fija el envío en 0 (K2): mientras sea 0 se muestra
      // "por confirmar" y no se suma (PLAN-PEDIDOS §2.6).
      deliveryFee: shippingCost > 0 ? shippingCost : null,
      serviceFee: toCop(raw.serviceFee),
      total: toCop(raw.finalTotal),
    },
    paymentStatus: raw.paymentStatus === 'PAGADO' ? 'PAID' : 'PENDING',
    createdAt: raw.createdAt,
  };
}

/**
 * Crea el pedido a partir del carrito **del servidor** de esa tienda.
 * Con el mismo `idempotencyKey` y los mismos datos, el backend devuelve el
 * pedido ya creado en lugar de duplicarlo.
 */
export async function checkoutOrder(params: CheckoutParams): Promise<PlacedOrder> {
  const raw = await httpClient.post<OrderResponse>(
    `${ORDERS_BASE}/checkout`,
    {
      companyId: params.storeId,
      addressId: params.addressId,
      customerNotes: params.customerNotes?.trim() || null,
    },
    { requestId: params.idempotencyKey },
  );
  return toPlacedOrder(raw);
}

/** Cancela en el servidor (libera la reserva de inventario). */
export async function cancelServerOrder(orderId: string, reason: string): Promise<void> {
  await httpClient.post(`${ORDERS_BASE}/${encodeURIComponent(orderId)}/cancel`, { reason });
}

// --- Errores del checkout ---

/** Qué debe hacer la pantalla ante un error del checkout. */
export type CheckoutRecovery =
  /** El carrito del servidor cambió: releerlo y reconciliar. */
  | 'refresh_cart'
  /** La dirección ya no es válida: releer direcciones. */
  | 'refresh_addresses'
  /** La clave de idempotencia ya se usó con otros datos: generar otra. */
  | 'new_attempt'
  /** Fallo transitorio: reintentar con la **misma** clave. */
  | 'retry'
  /** Sesión vencida: el flujo global de auth redirige. */
  | 'session';

export interface CheckoutErrorInfo {
  recovery: CheckoutRecovery;
  title: string;
  message: string;
}

export function describeCheckoutError(error: unknown): CheckoutErrorInfo {
  if (!(error instanceof HttpError)) {
    return {
      recovery: 'retry',
      title: 'Sin conexión',
      message: 'No pudimos confirmar tu pedido. Revisa tu conexión e inténtalo de nuevo; no se duplicará.',
    };
  }
  if (error.status === 401) {
    return { recovery: 'session', title: 'Sesión vencida', message: 'Inicia sesión de nuevo para continuar.' };
  }
  switch (error.code) {
    case 'INSUFFICIENT_STOCK':
      return {
        recovery: 'refresh_cart',
        title: 'Stock insuficiente',
        message: 'Uno de tus productos ya no tiene las unidades que pediste. Revisa tu carrito.',
      };
    case 'PRODUCT_NOT_AVAILABLE':
      return {
        recovery: 'refresh_cart',
        title: 'Producto no disponible',
        message: 'Uno de tus productos ya no está disponible. Revisa tu carrito.',
      };
    case 'CART_EMPTY':
    case 'CART_NOT_FOUND':
      return {
        recovery: 'refresh_cart',
        title: 'Carrito vacío',
        message: 'Tu carrito cambió y ya no tiene productos.',
      };
    case 'ADDRESS_NOT_FOUND':
      return {
        recovery: 'refresh_addresses',
        title: 'Dirección no válida',
        message: 'La dirección seleccionada ya no está disponible. Elige otra.',
      };
    case 'COMPANY_NOT_FOUND':
      return {
        recovery: 'refresh_cart',
        title: 'Tienda no disponible',
        message: 'La tienda no está recibiendo pedidos en este momento.',
      };
    case 'IDEMPOTENCY_CONFLICT':
      return {
        recovery: 'new_attempt',
        title: 'Pedido modificado',
        message: 'Tus datos cambiaron desde el último intento. Confirma de nuevo.',
      };
    default:
      return error.status >= 500
        ? {
            recovery: 'retry',
            title: 'Servicio no disponible',
            message: 'No pudimos confirmar tu pedido. Inténtalo de nuevo en unos segundos; no se duplicará.',
          }
        : {
            recovery: 'refresh_cart',
            title: 'No pudimos crear el pedido',
            message: error.message || 'Revisa tu carrito e inténtalo de nuevo.',
          };
  }
}
