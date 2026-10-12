'use client';

/**
 * ProductCard: Tarjeta de producto para el catálogo de la tienda.
 * Muestra ícono, nombre, precio y botón de agregar al carrito.
 */

import { motion } from 'framer-motion';
import { Plus } from 'lucide-react';
import ProductIcon from './ProductIcon';
import type { Product } from '@/types';

function formatCurrency(value?: number | null): string {
  if (value === undefined || value === null) return '$ 0';
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

export interface ProductCardProps {
  product: Product;
  onSelect?: (product: Product) => void;
  onAddToCart?: (product: Product) => void;
}

export default function ProductCard({ product, onSelect, onAddToCart }: ProductCardProps) {
  if (!product) return null;

  const hasDiscount = Boolean(product.comparePrice && product.comparePrice > product.price);
  const discountPercent =
    hasDiscount && product.comparePrice
      ? Math.round((1 - product.price / product.comparePrice) * 100)
      : 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -2 }}
      className="group relative bg-white/5 backdrop-blur-sm rounded-xl border border-white/10 overflow-hidden hover:border-accent/30 transition-colors cursor-pointer"
      onClick={() => onSelect?.(product)}
    >
      {/* Ícono del producto */}
      <div className="p-3 pb-0">
        <div className="relative aspect-square bg-black/20 overflow-hidden rounded-lg">
          <ProductIcon
            className="h-full w-full text-cyan-400"
            containerClassName="h-full w-full border-0 rounded-none bg-transparent"
          />

          {/* Badge de descuento */}
          {hasDiscount && (
            <div className="absolute top-2 left-2 px-2 py-0.5 bg-red-500 text-white text-[10px] font-bold rounded">
              -{discountPercent}%
            </div>
          )}

          {/* Badge sin stock */}
          {!product.isAvailable && (
            <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
              <span className="text-white text-xs font-medium bg-red-500/80 px-2 py-1 rounded">
                Agotado
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Info del producto */}
      <div className="p-3 pt-2">
        {/* Marca */}
        {product.brand && (
          <p className="text-xs text-accent font-medium mb-0.5">
            {product.brand}
          </p>
        )}

        {/* Nombre */}
        <h3 className="text-sm font-medium text-white line-clamp-2 leading-tight min-h-[2.5rem]">
          {product.name}
        </h3>

        {/* Precios */}
        <div className="flex items-baseline gap-2 mt-2">
          <span className="text-base font-bold text-white">
            {formatCurrency(product.price)}
          </span>
          {hasDiscount && (
            <span className="text-xs text-gray-500 line-through">
              {formatCurrency(product.comparePrice)}
            </span>
          )}
        </div>

        {/* Botón agregar */}
        <motion.button
          onClick={(e) => {
            e.stopPropagation();
            onAddToCart?.(product);
          }}
          disabled={!product.isAvailable}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className="
            w-full mt-3 py-2 rounded-lg
            flex items-center justify-center gap-2
            text-sm font-medium
            bg-accent/20 text-accent border border-accent/30
            hover:bg-accent hover:text-black
            disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-accent/20 disabled:hover:text-accent
            transition-all duration-200
          "
        >
          <Plus size={16} />
          <span>Agregar</span>
        </motion.button>
      </div>
    </motion.div>
  );
}
