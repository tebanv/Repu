import type { Order } from '@/types';

/**
 * Identificador visible de un pedido: `#123` para pedidos reales de
 * `ms-orders`; el id `REP-YYYY-XXXX` para pedidos mock previos al corte.
 */
export function formatOrderNumber(order: Pick<Order, 'id' | 'number'>): string {
  return order.number != null ? `#${order.number}` : order.id;
}
