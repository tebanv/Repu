import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock de la capa de servicios: los stores jamás deben llamar red real en tests.
vi.mock('@/services/api', () => ({
  fetchNearbyStores: vi.fn(),
}));

import { fetchNearbyStores } from '@/services/api';
import useStoresStore from '../storesStore';
import type { Store } from '@/types';

const mockedFetch = vi.mocked(fetchNearbyStores);

// Tiendas sintéticas con categorías disjuntas.
function makeStore(id: string, categories: Store['categories']): Store {
  return {
    id,
    slug: id,
    name: `Tienda ${id}`,
    description: 'mock',
    lat: 6.2,
    lng: -75.5,
    categories,
    rating: 4.5,
    totalReviews: 10,
    city: 'Medellín',
    schedule: {},
    deliveryInfo: { fee: 8000, avgPrepTime: 20 },
  };
}

const AREA = [makeStore('a', ['battery']), makeStore('b', ['tire']), makeStore('c', ['spare'])];

function resetStores(): void {
  localStorage.clear();
  useStoresStore.setState({
    masterStores: [],
    stores: [],
    selectedStoreId: null,
    isLoading: false,
    error: null,
  });
  vi.clearAllMocks();
}

beforeEach(() => {
  resetStores();
});

describe('storesStore — estrategia híbrida', () => {
  it('fetchStores guarda master completa y visible filtrada en una pasada', async () => {
    mockedFetch.mockResolvedValue(AREA);

    const visible = await useStoresStore.getState().fetchStores({
      location: { lat: 6.2, lng: -75.5 },
      filters: new Set(['battery']),
    });

    expect(mockedFetch).toHaveBeenCalledTimes(1);
    expect(useStoresStore.getState().masterStores).toHaveLength(3);
    expect(visible).toHaveLength(1);
    expect(useStoresStore.getState().stores.map((s) => s.id)).toEqual(['a']);
  });

  it('applyFilters re-filtra en memoria sin red', async () => {
    mockedFetch.mockResolvedValue(AREA);
    await useStoresStore.getState().fetchStores({
      location: { lat: 6.2, lng: -75.5 },
    });
    expect(useStoresStore.getState().stores).toHaveLength(3);

    useStoresStore.getState().applyFilters(new Set(['tire']));
    expect(mockedFetch).toHaveBeenCalledTimes(1);
    expect(useStoresStore.getState().stores.map((s) => s.id)).toEqual(['b']);
    // master intacta para seguir filtrando
    expect(useStoresStore.getState().masterStores).toHaveLength(3);
  });

  it('filtro vacío muestra todo', async () => {
    mockedFetch.mockResolvedValue(AREA);
    await useStoresStore.getState().fetchStores({
      location: { lat: 6.2, lng: -75.5 },
      filters: new Set(['battery']),
    });

    useStoresStore.getState().applyFilters(new Set());
    expect(useStoresStore.getState().stores).toHaveLength(3);
  });

  it('error de red conserva master previa', async () => {
    mockedFetch.mockResolvedValue(AREA);
    await useStoresStore.getState().fetchStores({
      location: { lat: 6.2, lng: -75.5 },
    });

    mockedFetch.mockRejectedValueOnce(new Error('sin red'));
    const visible = await useStoresStore
      .getState()
      .fetchStores({ location: { lat: 6.3, lng: -75.6 } });

    expect(visible).toEqual([]);
    expect(useStoresStore.getState().error).toBeTruthy();
    expect(useStoresStore.getState().masterStores).toHaveLength(3);
  });

  it('selectStore/clearSelection no tocan listas', async () => {
    mockedFetch.mockResolvedValue(AREA);
    await useStoresStore.getState().fetchStores({
      location: { lat: 6.2, lng: -75.5 },
    });

    useStoresStore.getState().selectStore('b');
    expect(useStoresStore.getState().selectedStoreId).toBe('b');
    expect(useStoresStore.getState().stores).toHaveLength(3);
    useStoresStore.getState().clearSelection();
    expect(useStoresStore.getState().selectedStoreId).toBeNull();
  });
});
