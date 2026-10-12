'use client';

import { motion } from 'framer-motion';
import useStoresStore from '@/store/storesStore';
import type { StoreCategory } from '@/types';

function getStars(rating: number): string {
  const full = Math.floor(rating);
  const half = rating % 1 >= 0.5;
  return '★'.repeat(full) + (half ? '½' : '') + '☆'.repeat(5 - full - (half ? 1 : 0));
}

const CATEGORY_LABELS: Record<StoreCategory, string> = {
  battery: 'Baterías',
  tire: 'Llantas',
  spare: 'Repuestos',
  shop: 'Tienda automotriz',
};

export default function StoresList() {
  const stores = useStoresStore((state) => state.stores);
  const selectStore = useStoresStore((state) => state.selectStore);

  if (stores.length === 0) {
    return (
      <div className="flex items-center justify-center h-full text-gray-400">
        <p>No hay tiendas disponibles</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 pr-2">
      {stores.map((store, index) => (
        <motion.div
          key={store.id}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: index * 0.05 }}
          onClick={() => selectStore(store.id)}
          className="bg-gradient-to-br from-gray-800 via-gray-750 to-gray-900 border border-accent/20 rounded-lg p-3 cursor-pointer hover:border-accent/50 transition-all hover:shadow-[0_0_15px_rgba(0,255,255,0.1)]"
        >
          <div className="flex items-start justify-between gap-2 mb-2">
            <div className="flex-1 min-w-0">
              <h3 className="font-bold text-white text-sm truncate">{store.name}</h3>
              <p className="text-xs text-gray-400 truncate">
                {store.categories.map((cat: StoreCategory) => CATEGORY_LABELS[cat]).join(', ')}
              </p>
            </div>
            <div className="flex-shrink-0 text-right">
              <div className="text-yellow-400 text-xs">{getStars(store.rating)}</div>
              <p className="text-xs text-gray-500">{store.rating.toFixed(1)}</p>
            </div>
          </div>

          <p className="text-xs text-gray-500">{store.city}</p>
        </motion.div>
      ))}
    </div>
  );
}
