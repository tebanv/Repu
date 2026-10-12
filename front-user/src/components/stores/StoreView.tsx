'use client';

/**
 * StoreView: Vista de cliente para la página de tienda individual.
 * Muestra el catálogo de productos con header holográfico.
 */

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';

import StoreHeader from '@/components/stores/StoreHeader';
import ProductGrid from '@/components/stores/ProductGrid';
import ProductModal from '@/components/stores/ProductModal';
import CartButton from '@/components/stores/CartButton';
import CartDrawer from '@/components/stores/CartDrawer';
import StoreConflictDialog from '@/components/stores/StoreConflictDialog';
import { fetchStoreBySlug, fetchProductsByStore } from '@/services/api';
import useCartStore, { useCartSummary } from '@/store/cartStore';
import useToastStore from '@/store/toastStore';
import type {
  Store,
  Product,
  CartActionResult,
  CartProductInput,
  ToastPayload,
} from '@/types';

interface StoreConflictState {
  product: CartProductInput;
  quantity: number;
  source: 'catalog' | 'grid' | 'modal';
  incomingStoreName: string;
}

export interface StoreViewProps {
  slug: string;
}

function buildCartProduct(product: Product, store: Store): CartProductInput {
  return {
    ...product,
    storeId: store.id,
    storeSlug: store.slug,
    storeName: store.name,
  };
}

function getCartFeedbackToast(
  result: CartActionResult,
  productName: string
): ToastPayload | null {
  switch (result.code) {
    case 'ITEM_ADDED':
      return {
        variant: 'success',
        title: 'Producto agregado',
        message: `${productName} se agregó al carrito.`,
      };
    case 'ITEM_UPDATED':
      return {
        variant: 'success',
        title: 'Carrito actualizado',
        message: `Actualizamos la cantidad de ${productName} en tu carrito.`,
      };
    case 'QUANTITY_CLAMPED':
      return {
        variant: 'warning',
        title: 'Cantidad ajustada',
        message: `Agregamos la cantidad máxima disponible de ${productName}.`,
      };
    case 'INVALID_PRODUCT':
    case 'MISSING_STORE_CONTEXT':
      return {
        variant: 'error',
        title: 'No se pudo agregar',
        message:
          result.message ||
          'El producto no tiene datos válidos para agregarse al carrito.',
      };
    default:
      return null;
  }
}

export default function StoreView({ slug }: StoreViewProps) {
  const router = useRouter();
  const cartSummary = useCartSummary();
  const addItem = useCartStore((state) => state.addItem);
  const clearCart = useCartStore((state) => state.clearCart);
  const pushToast = useToastStore((state) => state.pushToast);

  const [store, setStore] = useState<Store | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Estado del modal de producto
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [storeConflict, setStoreConflict] = useState<StoreConflictState | null>(null);

  useEffect(() => {
    async function loadData() {
      if (!slug) return;

      setIsLoading(true);
      setError(null);

      try {
        const storeData = await fetchStoreBySlug(slug);

        if (!storeData) {
          setError('Tienda no encontrada');
          setIsLoading(false);
          return;
        }

        setStore(storeData);

        const productsData = await fetchProductsByStore(storeData.id);
        setProducts(productsData);
      } catch (err) {
        console.error('Error loading store:', err);
        setError('Error al cargar la tienda');
      } finally {
        setIsLoading(false);
      }
    }

    loadData();
  }, [slug]);

  const handleSelectProduct = (product: Product) => {
    setSelectedProduct(product);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setTimeout(() => setSelectedProduct(null), 300);
  };

  const handleAddToCart = useCallback(
    (
      product: Product,
      quantity = 1,
      options: { source?: 'catalog' | 'grid' | 'modal' } = {}
    ): CartActionResult => {
      if (!store) {
        pushToast({
          variant: 'error',
          title: 'No se pudo agregar',
          message: 'La tienda aún no está lista para agregar productos al carrito.',
        });

        return {
          ok: false,
          code: 'STORE_NOT_READY',
          shouldCloseModal: false,
        };
      }

      const cartProduct = buildCartProduct(product, store);
      const result = addItem(cartProduct, quantity);

      if (result.code === 'STORE_CONFLICT') {
        setStoreConflict({
          product: cartProduct,
          quantity,
          source: options.source || 'catalog',
          incomingStoreName: store.name,
        });

        return {
          ...result,
          shouldCloseModal: false,
        };
      }

      const nextToast = getCartFeedbackToast(result, cartProduct.name || 'Producto');

      if (nextToast) {
        pushToast(nextToast);
      }

      if (!result.ok && !nextToast) {
        pushToast({
          variant: 'error',
          title: 'No se pudo agregar',
          message:
            result.message || 'Ocurrió un error inesperado al actualizar el carrito.',
        });
      }

      return {
        ...result,
        shouldCloseModal: Boolean(result.ok),
      };
    },
    [addItem, pushToast, store]
  );

  const handleGridAddToCart = useCallback(
    (product: Product) => {
      return handleAddToCart(product, 1, { source: 'grid' });
    },
    [handleAddToCart]
  );

  const handleModalAddToCart = useCallback(
    (product: Product, quantity = 1) => {
      return handleAddToCart(product, quantity, { source: 'modal' });
    },
    [handleAddToCart]
  );

  const handleCancelStoreConflict = useCallback(() => {
    setStoreConflict(null);
  }, []);

  const handleConfirmStoreConflict = useCallback(() => {
    if (!storeConflict) {
      return;
    }

    clearCart();

    const retryResult = addItem(storeConflict.product, storeConflict.quantity);

    if (retryResult.ok) {
      pushToast({
        variant: 'warning',
        title: 'Carrito actualizado',
        message:
          retryResult.code === 'QUANTITY_CLAMPED'
            ? `Vaciamos tu carrito anterior y agregamos la cantidad máxima disponible de ${storeConflict.product.name}.`
            : `Vaciamos tu carrito anterior y agregamos ${storeConflict.product.name}.`,
      });

      if (storeConflict.source === 'modal') {
        handleCloseModal();
      }
    } else {
      pushToast({
        variant: 'error',
        title: 'No se pudo actualizar',
        message:
          retryResult.message ||
          'No fue posible reemplazar el carrito con el nuevo producto.',
      });
    }

    setStoreConflict(null);
  }, [addItem, clearCart, pushToast, storeConflict]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center">
        <Loader2 className="w-8 h-8 text-accent animate-spin mb-4" />
        <p className="text-gray-400 text-sm">Cargando tienda...</p>
      </div>
    );
  }

  if (error || !store) {
    return (
      <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center p-4">
        <div className="w-16 h-16 rounded-full bg-red-500/10 border border-red-500/30 flex items-center justify-center mb-4">
          <span className="text-2xl">⚠️</span>
        </div>
        <h1 className="text-xl font-bold text-white mb-2">
          {error || 'Tienda no encontrada'}
        </h1>
        <p className="text-gray-400 text-sm text-center mb-6 max-w-md">
          No pudimos encontrar la tienda que buscas. Es posible que haya cambiado de dirección o no esté disponible.
        </p>
        <Link
          href="/"
          className="px-6 py-3 bg-accent text-black font-bold rounded-lg hover:bg-accent/90 transition-colors"
        >
          Volver al mapa
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen min-h-[100dvh] bg-gray-950 text-white overflow-x-hidden mobile-safe-area-screen">
      <StoreHeader store={store} />

      <main className="max-w-7xl mx-auto py-6">
        <div className="px-4 mb-4">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <span>Catálogo de productos</span>
            <span className="text-xs font-normal text-gray-500">
              ({products.length} {products.length === 1 ? 'producto' : 'productos'})
            </span>
          </h2>
        </div>

        <ProductGrid
          products={products}
          onSelectProduct={handleSelectProduct}
          onAddToCart={handleGridAddToCart}
        />
      </main>

      <ProductModal
        product={selectedProduct}
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        onAddToCart={handleModalAddToCart}
      />

      <StoreConflictDialog
        isOpen={Boolean(storeConflict)}
        currentStoreName={cartSummary.storeName}
        incomingStoreName={storeConflict?.incomingStoreName}
        onCancel={handleCancelStoreConflict}
        onConfirm={handleConfirmStoreConflict}
      />

      <CartButton onClick={() => setIsCartOpen(true)} />

      <CartDrawer
        isOpen={isCartOpen}
        onClose={() => setIsCartOpen(false)}
        onCheckout={() => {
          setIsCartOpen(false);
          router.push('/checkout');
        }}
      />
    </div>
  );
}
