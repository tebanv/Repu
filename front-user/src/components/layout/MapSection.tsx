'use client';

import { memo } from 'react';
import dynamic from 'next/dynamic';
import LoadingIndicator from '@/components/ui/LoadingIndicator';

const MapContainer = dynamic(() => import('@/components/map/MapContainer'), {
  ssr: false,
  loading: () => (
    <div className="relative w-full h-full min-h-[300px] rounded-2xl overflow-hidden border border-gray-800 shadow-2xl bg-gray-950 flex items-center justify-center">
      <LoadingIndicator />
    </div>
  ),
});

function MapSection() {
  return (
    <div className="w-full h-full">
      <MapContainer />
    </div>
  );
}

export default memo(MapSection);
