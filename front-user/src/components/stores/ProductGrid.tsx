'use client';

/**
 * ProductGrid: Grid de productos con filtros por categoría.
 */

import { motion } from 'framer-motion';
import ProductCard from './ProductCard';
import type { Product } from '@/types';

export interface ProductGridProps {
  products: Product[];
  onSelectProduct?: (product: Product) => void;
  onAddToCart?: (product: Product) => void;
}

export default function ProductGrid({
  products,
  onSelectProduct,
  onAddToCart,
}: ProductGridProps) {
  if (!products?.length) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-4">
        <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mb-4">
          <span className="text-3xl">📦</span>
        </div>
        <p className="text-gray-400 text-center">
          Esta tienda aún no tiene productos disponibles
        </p>
      </div>
    );
  }

  return (
    <div className="px-4 pb-24">
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
        {products.map((product, index) => (
          <motion.div
            key={product.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
          >
            <ProductCard
              product={product}
              onSelect={onSelectProduct}
              onAddToCart={onAddToCart}
            />
          </motion.div>
        ))}
      </div>
    </div>
  );
}
