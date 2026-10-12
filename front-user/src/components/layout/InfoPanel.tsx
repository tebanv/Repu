'use client';

import { useRouter } from 'next/navigation';
import { AnimatePresence } from 'framer-motion';
import useStoresStore from '@/store/storesStore';
import AdCarousel from '@/components/ui/AdCarousel';
import StoreCard from '@/components/stores/StoreCard';
import type { Store } from '@/types';

export default function InfoPanel() {
  const router = useRouter();

  const stores = useStoresStore((state) => state.stores);
  const selectedStoreId = useStoresStore((state) => state.selectedStoreId);

  const store = stores.find((s) => s.id === selectedStoreId);

  const handleNavigate = (navStore: Store) => {
    router.push(`/store/${navStore.slug}`);
  };

  return (
    <div className="w-full h-full">
      <AnimatePresence mode="wait">
        {store ? (
          <StoreCard
            key={store.id}
            store={store}
            onNavigate={handleNavigate}
          />
        ) : (
          <AdCarousel key="ad-carousel" />
        )}
      </AnimatePresence>
    </div>
  );
}
