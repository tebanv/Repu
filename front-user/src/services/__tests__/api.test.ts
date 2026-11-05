import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  fetchNearbyStores,
  fetchProductsByStore,
  fetchStoreBySlug,
  resetCatalogCacheForTests,
  toRadiusKm,
} from '../api';

// Pruebas del adaptador de catálogo contra `fetch` mockeado: validan la
// traducción backend → dominio descrita en docs/PLAN-CATALOGO.md §3.

function jsonResponse(body: unknown, status = 200): Response {
  const headers = new Headers({ 'content-type': 'application/json' });
  return {
    ok: status >= 200 && status < 300,
    status,
    headers,
    json: async () => body,
    text: async () => JSON.stringify(body),
  } as unknown as Response;
}

const CATEGORIES = [
  { id: 'cat-bat', name: 'Baterías para vehículos', active: true },
  { id: 'cat-rep', name: 'Repuestos para carros y motos', active: true },
  { id: 'cat-otra', name: 'Restaurantes', active: true },
];

function company(overrides: Record<string, unknown> = {}) {
  return {
    id: 'c1',
    businessName: 'Baterías El Poblado',
    description: 'Baterías para todo vehículo',
    logoUrl: null,
    bannerUrl: null,
    location: { latitude: 6.2, longitude: -75.58 },
    operationalConfig: {
      schedule: { monday: { open: '08:00', close: '18:00' } },
      preparationTime: 25,
    },
    rating: 4.5,
    reviewCount: 12,
    active: true,
    slug: 'baterias-el-poblado',
    categoryId: 'cat-bat',
    ...overrides,
  };
}

function product(overrides: Record<string, unknown> = {}) {
  return {
    id: 'p1',
    companyId: 'c1',
    categoryId: 'cat-bat',
    name: 'Batería 12V 60Ah',
    brand: 'MAC',
    sku: 'BAT-12V-60',
    description: 'Libre de mantenimiento',
    price: 420000.5,
    priceOffer: null,
    stock: 4,
    attributes: { voltaje: '12V', amperaje: 60, compatibleVehicles: ['Mazda 3 2018'] },
    images: ['https://img/bat.png'],
    active: true,
    ...overrides,
  };
}

let fetchMock: ReturnType<typeof vi.fn>;

/** Responde según la ruta pedida, como lo haría Traefik con cada micro. */
function routeFetch(routes: Record<string, () => Response>) {
  fetchMock.mockImplementation(async (input: RequestInfo | URL) => {
    const url = String(input);
    const match = Object.keys(routes).find((prefix) => url.startsWith(prefix));
    if (!match) throw new Error(`Ruta no mockeada: ${url}`);
    return routes[match]();
  });
}

beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
  resetCatalogCacheForTests();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('api — radio', () => {
  it('convierte metros a km enteros redondeando hacia arriba', () => {
    expect(toRadiusKm(5000)).toBe(5);
    expect(toRadiusKm(5200)).toBe(6);
    expect(toRadiusKm(300)).toBe(1);
  });
});

describe('api — tiendas', () => {
  it('fetchNearbyStores traduce la empresa y envía radiusKm', async () => {
    routeFetch({
      '/ms-companies/api/companies?': () => jsonResponse([company()]),
      '/ms-categories/': () => jsonResponse(CATEGORIES),
    });

    const stores = await fetchNearbyStores({ lat: 6.2, lng: -75.58, radius: 5000 });

    const companiesUrl = String(fetchMock.mock.calls.find(([u]) => String(u).includes('companies'))?.[0]);
    expect(companiesUrl).toContain('radiusKm=5');
    expect(stores).toHaveLength(1);
    expect(stores[0]).toMatchObject({
      id: 'c1',
      slug: 'baterias-el-poblado',
      name: 'Baterías El Poblado',
      lat: 6.2,
      lng: -75.58,
      categories: ['battery'],
      rating: 4.5,
      totalReviews: 12,
      city: '',
      schedule: { monday: { open: '08:00', close: '18:00' } },
      deliveryInfo: { fee: null, avgPrepTime: 25 },
    });
  });

  it('traduce categorías por palabra clave del nombre', async () => {
    routeFetch({
      '/ms-companies/api/companies?': () =>
        jsonResponse([company({ id: 'rep', categoryId: 'cat-rep' }), company({ id: 'rest', categoryId: 'cat-otra' })]),
      '/ms-categories/': () => jsonResponse(CATEGORIES),
    });

    const stores = await fetchNearbyStores({ lat: 6.2, lng: -75.58 });
    expect(stores.map((s) => s.categories)).toEqual([['spare'], []]);
  });

  it('descarta tiendas inactivas o sin ubicación', async () => {
    routeFetch({
      '/ms-companies/api/companies?': () =>
        jsonResponse([
          company({ id: 'inactiva', active: false }),
          company({ id: 'sin-ubicacion', location: null }),
          company({ id: 'ok' }),
        ]),
      '/ms-categories/': () => jsonResponse(CATEGORIES),
    });

    const stores = await fetchNearbyStores({ lat: 6.2, lng: -75.58 });
    expect(stores.map((s) => s.id)).toEqual(['ok']);
  });

  it('categoría desconocida o caída de ms-categories deja la tienda sin categorías', async () => {
    routeFetch({
      '/ms-companies/api/companies?': () =>
        jsonResponse([company({ id: 'otra', categoryId: 'cat-otra' }), company({ id: 'bat' })]),
      '/ms-categories/': () => jsonResponse({ message: 'caído' }, 503),
    });

    const stores = await fetchNearbyStores({ lat: 6.2, lng: -75.58 });
    expect(stores).toHaveLength(2);
    expect(stores.every((s) => s.categories.length === 0)).toBe(true);
  });

  it('lee el costo de envío solo si la tienda lo define', async () => {
    routeFetch({
      '/ms-companies/api/companies/con-envio': () =>
        jsonResponse(company({ operationalConfig: { delivery: { fee: 5999.6 } } })),
      '/ms-categories/': () => jsonResponse(CATEGORIES),
    });

    const store = await fetchStoreBySlug('con-envio');
    expect(store?.deliveryInfo).toEqual({ fee: 6000, avgPrepTime: 20 });
  });

  it('fetchStoreBySlug devuelve null ante 404 o 400', async () => {
    routeFetch({
      '/ms-companies/api/companies/no-existe': () => jsonResponse(null, 404),
      '/ms-companies/api/companies/mal': () => jsonResponse({ error: 'Invalid company slug.' }, 400),
      '/ms-categories/': () => jsonResponse(CATEGORIES),
    });

    await expect(fetchStoreBySlug('no-existe')).resolves.toBeNull();
    await expect(fetchStoreBySlug('mal')).resolves.toBeNull();
  });

  it('fetchStoreBySlug propaga errores de servidor', async () => {
    routeFetch({
      '/ms-companies/api/companies/x': () => jsonResponse({ message: 'boom' }, 500),
      '/ms-categories/': () => jsonResponse(CATEGORIES),
    });

    await expect(fetchStoreBySlug('x')).rejects.toThrow('boom');
  });

  it('pide las categorías una sola vez por sesión', async () => {
    routeFetch({
      '/ms-companies/api/companies?': () => jsonResponse([company()]),
      '/ms-categories/': () => jsonResponse(CATEGORIES),
    });

    await fetchNearbyStores({ lat: 6.2, lng: -75.58 });
    await fetchNearbyStores({ lat: 6.3, lng: -75.5 });

    const categoryCalls = fetchMock.mock.calls.filter(([u]) => String(u).includes('ms-categories'));
    expect(categoryCalls).toHaveLength(1);
  });
});

describe('api — productos', () => {
  it('traduce el producto con precio entero, marca, referencia y specs', async () => {
    routeFetch({ '/ms-products/': () => jsonResponse([product()]) });

    const [item] = await fetchProductsByStore('c1');

    const url = String(fetchMock.mock.calls[0][0]);
    expect(url).toBe('/ms-products/api/catalog/products?companyId=c1');
    expect(item).toMatchObject({
      id: 'p1',
      storeId: 'c1',
      price: 420001,
      comparePrice: null,
      brand: 'MAC',
      reference: 'BAT-12V-60',
      stock: 4,
      isAvailable: true,
      image: 'https://img/bat.png',
      specifications: { voltaje: '12V', amperaje: 60 },
      compatibleVehicles: ['Mazda 3 2018'],
    });
  });

  it('con oferta menor usa el precio de oferta y tacha el base', async () => {
    routeFetch({ '/ms-products/': () => jsonResponse([product({ price: 500000, priceOffer: 450000 })]) });

    const [item] = await fetchProductsByStore('c1');
    expect(item.price).toBe(450000);
    expect(item.comparePrice).toBe(500000);
  });

  it('stock 0 queda agotado y los inactivos se descartan', async () => {
    routeFetch({
      '/ms-products/': () =>
        jsonResponse([
          product({ id: 'agotado', name: 'B', stock: 0 }),
          product({ id: 'inactivo', name: 'C', active: false }),
          product({ id: 'ok', name: 'A' }),
        ]),
    });

    const items = await fetchProductsByStore('c1');
    expect(items.map((p) => p.id)).toEqual(['ok', 'agotado']);
    expect(items[1].isAvailable).toBe(false);
  });

  it('las lecturas públicas no disparan el cierre de sesión ante 401', async () => {
    routeFetch({ '/ms-products/': () => jsonResponse({ message: 'no' }, 401) });
    const { onUnauthorized } = await import('../httpClient');
    const listener = vi.fn();
    const unsubscribe = onUnauthorized(listener);

    await expect(fetchProductsByStore('c1')).rejects.toThrow();
    expect(listener).not.toHaveBeenCalled();
    unsubscribe();
  });
});
