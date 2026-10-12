'use client';

import { create } from 'zustand';
import type { StoreCategory } from '@/types';

export interface FilterState {
  activeFilters: Set<StoreCategory>;
  toggleFilter: (categoryId: StoreCategory) => void;
  clearFilters: () => void;
}

/**
 * Zustand store para gestionar el estado de los filtros de categorías.
 */
const useFilterStore = create<FilterState>((set) => ({
  activeFilters: new Set<StoreCategory>(),

  toggleFilter: (categoryId) =>
    set((state) => {
      const newActiveFilters = new Set(state.activeFilters);
      if (newActiveFilters.has(categoryId)) {
        newActiveFilters.delete(categoryId);
      } else {
        newActiveFilters.add(categoryId);
      }
      return { activeFilters: newActiveFilters };
    }),

  clearFilters: () => set({ activeFilters: new Set<StoreCategory>() }),
}));

export default useFilterStore;
