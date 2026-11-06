import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createAddress, listAddresses, pickDefaultAddress, toSavedAddress } from '../addressService';

// Adaptador de direcciones de `ms-users` (docs/PLAN-PEDIDOS.md §2.3).

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: new Headers({ 'content-type': 'application/json' }),
    json: async () => body,
    text: async () => JSON.stringify(body),
  } as unknown as Response;
}

const RAW = {
  id: 'a1',
  name: 'Casa',
  fullAddress: 'Calle 10 # 43E-12',
  city: 'Medellín',
  postalCode: null,
  isPrimary: true,
  deliveryNotes: '  ',
  location: { latitude: 6.21, longitude: -75.57 },
};

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('addressService', () => {
  it('adapta la respuesta de ms-users a SavedAddress', () => {
    expect(toSavedAddress(RAW)).toEqual({
      id: 'a1',
      name: 'Casa',
      fullAddress: 'Calle 10 # 43E-12',
      city: 'Medellín',
      postalCode: null,
      isPrimary: true,
      deliveryNotes: null,
      coordinates: { lat: 6.21, lng: -75.57 },
    });
  });

  it('sin coordenadas completas deja coordinates en null (no 0,0)', () => {
    expect(toSavedAddress({ ...RAW, location: { latitude: 6.2, longitude: null } }).coordinates).toBeNull();
    expect(toSavedAddress({ ...RAW, location: null }).coordinates).toBeNull();
  });

  it('pickDefaultAddress prefiere la principal y si no, la primera', () => {
    const a = toSavedAddress({ ...RAW, id: 'a', isPrimary: false });
    const b = toSavedAddress({ ...RAW, id: 'b', isPrimary: true });
    expect(pickDefaultAddress([a, b])?.id).toBe('b');
    expect(pickDefaultAddress([a])?.id).toBe('a');
    expect(pickDefaultAddress([])).toBeNull();
  });

  it('listAddresses consulta ms-users con sesión', async () => {
    fetchMock.mockResolvedValue(jsonResponse([RAW]));

    const addresses = await listAddresses();

    expect(addresses).toHaveLength(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/ms-users/api/users/addresses');
    expect(init.credentials).toBe('include');
  });

  it('createAddress envía location { latitude, longitude } y devuelve el id', async () => {
    fetchMock.mockResolvedValue(jsonResponse({ ...RAW, id: 'nueva' }, 201));

    const created = await createAddress({
      name: 'Taller',
      fullAddress: ' Cra 43A # 1-50 ',
      city: 'Medellín',
      coordinates: { lat: 6.2, lng: -75.56 },
      deliveryNotes: '',
    });

    expect(created.id).toBe('nueva');
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body as string)).toEqual({
      name: 'Taller',
      fullAddress: 'Cra 43A # 1-50',
      city: 'Medellín',
      postalCode: null,
      deliveryNotes: null,
      isPrimary: false,
      location: { latitude: 6.2, longitude: -75.56 },
    });
  });
});
