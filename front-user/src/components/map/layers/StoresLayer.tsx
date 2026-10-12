'use client';

import { useEffect, useRef, memo } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import mapboxgl from 'mapbox-gl';
import useStoresStore from '@/store/storesStore';
import StoreMarker from '@/components/map/StoreMarker';
import type { Store } from '@/types';

interface MarkerData {
  storeId: string;
  marker: mapboxgl.Marker;
  root: Root;
  store: Store;
}

export interface StoresLayerProps {
  map: React.RefObject<mapboxgl.Map | null>;
}

function StoresLayer({ map }: StoresLayerProps) {
  const stores = useStoresStore((state) => state.stores);
  const selectedStoreId = useStoresStore((state) => state.selectedStoreId);
  const selectStore = useStoresStore((state) => state.selectStore);

  const markersDataRef = useRef<MarkerData[]>([]);

  // Efecto 1: Recrear marcadores en Mapbox cuando cambia la lista de tiendas
  useEffect(() => {
    const mapInstance = map?.current;
    if (!mapInstance) return;

    // Limpieza de marcadores previos
    const previousData = [...markersDataRef.current];
    previousData.forEach(({ marker }) => marker.remove());
    queueMicrotask(() => {
      previousData.forEach(({ root }) => {
        try {
          root.unmount();
        } catch {
          // Ignorar si ya fue desmontado
        }
      });
    });
    markersDataRef.current = [];

    // Crear un nuevo marcador de Mapbox para cada tienda
    const newMarkersData: MarkerData[] = [];

    stores.forEach((store) => {
      const el = document.createElement('div');
      el.className = 'store-marker-container';

      const root = createRoot(el);
      const isSelected = store.id === selectedStoreId;

      root.render(
        <StoreMarker
          store={store}
          selected={isSelected}
          onClick={() => selectStore(store.id)}
        />
      );

      const marker = new mapboxgl.Marker({
        element: el,
        anchor: 'center',
      })
        .setLngLat([store.lng, store.lat])
        .addTo(mapInstance);

      newMarkersData.push({
        storeId: store.id,
        marker,
        root,
        store,
      });
    });

    markersDataRef.current = newMarkersData;

    return () => {
      const cleanupData = [...markersDataRef.current];
      cleanupData.forEach(({ marker }) => marker.remove());
      queueMicrotask(() => {
        cleanupData.forEach(({ root }) => {
          try {
            root.unmount();
          } catch {
            // Ignorar si ya fue desmontado
          }
        });
      });
      markersDataRef.current = [];
    };
  }, [stores, map]);

  // Efecto 2: Actualizar solo el estado de selección sin destruir los marcadores
  useEffect(() => {
    if (markersDataRef.current.length === 0) return;

    markersDataRef.current.forEach(({ storeId, root, store }) => {
      const isSelected = storeId === selectedStoreId;
      root.render(
        <StoreMarker
          store={store}
          selected={isSelected}
          onClick={() => selectStore(store.id)}
        />
      );
    });
  }, [selectedStoreId, selectStore]);

  return null;
}

export default memo(StoresLayer);
