'use client';

import { create } from 'zustand';
import { fetchNearbyStores } from '@/services/api';
import type { Store, StoreCategory, Coordinates } from '@/types';

/**
 * Filtra una lista de tiendas en memoria según el conjunto de categorías activas.
 */
function filterStores(stores: Store[], filters?: Set<StoreCategory> | null): Store[] {
  if (!filters || filters.size === 0) {
    return stores;
  }
  return stores.filter((store) =>
    store.categories.some((category) => filters.has(category))
  );
}

export interface FetchStoresParams {
  location: Coordinates;
  filters?: Set<StoreCategory> | null;
  radius?: number;
}

export interface StoresStoreState {
  masterStores: Store[];
  stores: Store[];
  selectedStoreId: string | null;
  isLoading: boolean;
  error: string | null;
  setStores: (stores: Store[]) => void;
  selectStore: (storeId: string | null) => void;
  setSelectedStore: (storeId: string | null) => void;
  clearSelection: () => void;
  fetchStores: (params: FetchStoresParams) => Promise<Store[]>;
  applyFilters: (filters: Set<StoreCategory>) => void;
  getStoreById: (id: string) => Store | undefined;
}

const useStoresStore = create<StoresStoreState>((set, get) => ({
  masterStores: [],
  stores: [],
  selectedStoreId: null,
  isLoading: false,
  error: null,

  setStores: (stores) =>
    set({
      masterStores: stores,
      stores,
    }),

  selectStore: (storeId) => set({ selectedStoreId: storeId }),
  setSelectedStore: (storeId) => set({ selectedStoreId: storeId }),
  clearSelection: () => set({ selectedStoreId: null }),

  fetchStores: async ({ location, filters, radius = 5000 }: FetchStoresParams) => {
    set({ isLoading: true, error: null });

    try {
      // 1. Obtener todas las tiendas del área geográfica sin filtrar por categoría
      const storesData = await fetchNearbyStores({
        lat: location.lat,
        lng: location.lng,
        radius,
      });

      // 2. Filtrar inmediatamente con los filtros activos vigentes
      const filteredStores = filterStores(storesData, filters);

      // 3. Actualizar masterStores y stores en una sola operación atómica
      set({
        masterStores: storesData,
        stores: filteredStores,
        isLoading: false,
        error: null,
      });

      return filteredStores;
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Error al cargar las tiendas cercanas';
      set({ error: message, isLoading: false });
      return [];
    }
  },

  applyFilters: (filters: Set<StoreCategory>) => {
    const masterList = get().masterStores;
    const filteredStores = filterStores(masterList, filters);
    set({ stores: filteredStores });
  },

  getStoreById: (id: string) => {
    return (
      get().masterStores.find((store) => store.id === id) ||
      get().stores.find((store) => store.id === id)
    );
  },
}));

export default useStoresStore;
