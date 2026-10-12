'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AnimatePresence } from 'framer-motion';
import useStoresStore from '@/store/storesStore';
import AppHeader from '@/components/layout/AppHeader';
import FilterBanner from '@/components/layout/FilterBanner';
import MapSection from '@/components/layout/MapSection';
import InfoPanel from '@/components/layout/InfoPanel';
import StoresList from '@/components/layout/StoresList';
import AdCarousel from '@/components/ui/AdCarousel';
import StoreCard from '@/components/stores/StoreCard';
import type { Store } from '@/types';

export default function PageLayout() {
  const router = useRouter();
  const [isMobileViewport, setIsMobileViewport] = useState(false);

  const selectedStoreId = useStoresStore((state) => state.selectedStoreId);
  const stores = useStoresStore((state) => state.stores);
  const clearSelection = useStoresStore((state) => state.clearSelection);

  const selectedStore = stores.find((s) => s.id === selectedStoreId);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const mediaQuery = window.matchMedia('(max-width: 1023px)');

    const syncViewport = () => {
      setIsMobileViewport(mediaQuery.matches);
    };

    syncViewport();
    mediaQuery.addEventListener('change', syncViewport);

    return () => {
      mediaQuery.removeEventListener('change', syncViewport);
    };
  }, []);

  const handleNavigate = (navStore: Store) => {
    router.push(`/store/${navStore.slug}`);
  };

  return (
    <div className="w-full h-screen flex flex-col overflow-hidden">
      <AppHeader />

      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden gap-0 lg:gap-4 lg:p-4 min-h-0">
        <div className="w-full lg:w-1/3 lg:flex lg:flex-col lg:min-w-0 lg:overflow-hidden">
          <FilterBanner />

          <div className="hidden lg:flex lg:flex-col lg:flex-1 lg:min-h-0 lg:overflow-hidden">
            <AnimatePresence mode="wait">
              {selectedStore ? (
                <div key="store-card-container" className="flex-1 min-h-0 pl-3 pt-3 flex flex-col">
                  <StoreCard
                    store={selectedStore}
                    onNavigate={handleNavigate}
                    onBack={clearSelection}
                    showBackButton
                  />
                </div>
              ) : (
                <div key="stores-list-container" className="flex-1 min-h-0 overflow-y-auto pl-3 pr-2 pt-4">
                  <StoresList />
                </div>
              )}
            </AnimatePresence>

            <div className="h-[180px] flex-shrink-0 pl-3 pt-3">
              <AdCarousel />
            </div>
          </div>
        </div>

        <div className="flex-1 flex flex-col lg:flex-col max-w-[900px] lg:max-w-none w-full lg:w-2/3 px-4 sm:px-6 md:px-8 lg:px-0 overflow-hidden">
          <div className="flex-1 py-4 lg:py-0 min-h-0">
            <MapSection />
          </div>

          {isMobileViewport && (
            <div className="pb-4 lg:hidden" style={{ height: '200px' }}>
              <InfoPanel />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
