import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { forwardGeocode, reverseGeocode } from '../geocodingService';

// Geocodificación Mapbox para crear direcciones (docs/PLAN-PEDIDOS.md §2.3).

function jsonResponse(body: unknown, status = 200): Response {
  return { ok: status < 400, status, json: async () => body } as unknown as Response;
}

const FEATURE = {
  geometry: { coordinates: [-75.57, 6.21] },
  properties: {
    name: 'Calle 10 # 43E-12',
    full_address: 'Calle 10 # 43E-12, El Poblado, Medellín, Antioquia, Colombia',
    context: { place: { name: 'Medellín' } },
  },
};

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
  vi.stubEnv('NEXT_PUBLIC_MAPBOX_TOKEN', 'pk.test');
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe('geocodingService', () => {
  it('reverse: conserva las coordenadas del GPS y no envía cookies', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ features: [FEATURE] }));
    const gps = { lat: 6.2101, lng: -75.5702 };

    const result = await reverseGeocode(gps);

    expect(result).toEqual({ street: 'Calle 10 # 43E-12', city: 'Medellín', coordinates: gps });
    const [url, init] = fetchMock.mock.calls[0] as [URL, RequestInit];
    expect(url.pathname).toBe('/search/geocode/v6/reverse');
    expect(url.searchParams.get('latitude')).toBe('6.2101');
    expect(init.credentials).toBe('omit');
  });

  it('forward: limita a Colombia y sesga cerca del usuario', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ features: [FEATURE] }));

    const result = await forwardGeocode('Calle 10 # 43E-12, Medellín', { lat: 6.2, lng: -75.5 });

    expect(result?.coordinates).toEqual({ lat: 6.21, lng: -75.57 });
    const [url] = fetchMock.mock.calls[0] as [URL];
    expect(url.searchParams.get('country')).toBe('co');
    expect(url.searchParams.get('proximity')).toBe('-75.5,6.2');
  });

  it('sin resultados o sin token devuelve null sin llamar', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ features: [] }));
    expect(await forwardGeocode('xyz')).toBeNull();

    vi.stubEnv('NEXT_PUBLIC_MAPBOX_TOKEN', '');
    fetchMock.mockClear();
    expect(await reverseGeocode({ lat: 1, lng: 1 })).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
