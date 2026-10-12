// Modelos y contratos del carrito persistente

export interface CartItem {
  productId: string;
  name: string;
  price: number;
  image: string | null;
  quantity: number;
  stockSnapshot: number | null;
  maxPerOrder: number | null;
}

export interface CartStoreContext {
  storeId: string | null;
  storeSlug: string | null;
  storeName: string | null;
}

export interface CartSummary extends CartStoreContext {
  items: CartItem[];
  itemCount: number;
  subtotal: number;
  lastUpdatedAt: string | null;
  version: number;
}

export interface CartNotice {
  code: string;
  message: string;
  createdAt: string;
}

export type CartActionCode =
  | 'ITEM_ADDED'
  | 'ITEM_UPDATED'
  | 'ITEM_REMOVED'
  | 'QUANTITY_CLAMPED'
  | 'QUANTITY_UPDATED'
  | 'STORE_CONFLICT'
  | 'INVALID_PRODUCT'
  | 'INVALID_PRODUCT_ID'
  | 'ITEM_NOT_FOUND'
  | 'MISSING_STORE_CONTEXT'
  | 'INVALID_STORE_CONTEXT'
  | 'STORE_CONTEXT_REPLACED'
  | 'STORE_NOT_READY'
  | 'EXPIRED_CART'
  | 'UNKNOWN_ERROR';

export interface CartActionResult {
  ok: boolean;
  code: CartActionCode;
  message?: string;
  item?: CartItem;
  cartSummary?: CartSummary;
  currentStoreId?: string;
  incomingStoreId?: string;
  shouldCloseModal?: boolean;
}

export interface CartProductInput {
  id?: string;
  productId?: string;
  name?: string;
  price?: number;
  image?: string | null;
  images?: string[];
  stock?: number | null;
  stockSnapshot?: number | null;
  maxPerOrder?: number | null;
  isAvailable?: boolean;
  storeId?: string | null;
  storeSlug?: string | null;
  storeName?: string | null;
}
