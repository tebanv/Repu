import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { HttpError, httpClient, onUnauthorized, request } from '../httpClient';

function fakeResponse(
  body: unknown,
  status = 200,
  contentType: string | null = 'application/json',
): Response {
  const headers = new Headers();
  if (contentType) headers.set('content-type', contentType);

  return {
    ok: status >= 200 && status < 300,
    status,
    headers,
    json: async () => body,
    text: async () => (typeof body === 'string' ? body : JSON.stringify(body)),
  } as unknown as Response;
}

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('httpClient — contrato de transporte', () => {
  it('GET usa ruta relativa, credentials include y X-Request-ID', async () => {
    fetchMock.mockResolvedValue(fakeResponse({ ok: true }));

    const data = await httpClient.get<{ ok: boolean }>('/ms-users/api/users/profile');

    expect(data).toEqual({ ok: true });
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/ms-users/api/users/profile');
    expect(init.method).toBe('GET');
    expect(init.credentials).toBe('include');
    expect(init.cache).toBe('no-store');
    expect((init.headers as Headers).get('x-request-id')).toBeTruthy();
  });

  it('POST serializa JSON y agrega Content-Type', async () => {
    fetchMock.mockResolvedValue(fakeResponse({ id: '1' }, 201));

    await httpClient.post('/ms-auth/api/auth/login', {
      email: 'user@example.com',
      password: 'secret',
    });

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(init.method).toBe('POST');
    expect(init.body).toBe(
      JSON.stringify({ email: 'user@example.com', password: 'secret' }),
    );
    expect((init.headers as Headers).get('content-type')).toContain('application/json');
  });

  it('401 emite unauthorized y lanza HttpError con el mensaje del backend', async () => {
    const listener = vi.fn();
    const unsubscribe = onUnauthorized(listener);
    fetchMock.mockResolvedValue(fakeResponse({ message: 'Sesión inválida' }, 401));

    await expect(request('/ms-users/api/users/profile')).rejects.toMatchObject({
      status: 401,
      message: 'Sesión inválida',
    });
    expect(listener).toHaveBeenCalledTimes(1);

    unsubscribe();
  });

  it('login puede optar por no emitir unauthorized en 401', async () => {
    const listener = vi.fn();
    const unsubscribe = onUnauthorized(listener);
    fetchMock.mockResolvedValue(fakeResponse({ message: 'Credenciales inválidas' }, 401));

    await expect(
      request('/ms-auth/api/auth/login', {
        method: 'POST',
        skipUnauthorizedNotification: true,
      }),
    ).rejects.toBeInstanceOf(HttpError);

    expect(listener).not.toHaveBeenCalled();
    unsubscribe();
  });

  it('acepta el shape { error } de ms-users', async () => {
    fetchMock.mockResolvedValue(fakeResponse({ error: 'Dirección no encontrada' }, 404));

    await expect(request('/ms-users/api/users/addresses/1')).rejects.toThrow(
      'Dirección no encontrada',
    );
  });

  it('5xx lanza HttpError y conserva el mensaje del servidor', async () => {
    fetchMock.mockResolvedValue(fakeResponse({ message: 'Servicio caído' }, 503));

    await expect(request('/x')).rejects.toMatchObject({
      status: 503,
      message: 'Servicio caído',
    });
  });

  it('204 no intenta parsear body', async () => {
    fetchMock.mockResolvedValue(fakeResponse(undefined, 204, null));

    await expect(httpClient.delete('/ms-auth/api/auth/logout')).resolves.toBeUndefined();
  });

  it('propaga errores de red sin convertirlos en HttpError', async () => {
    fetchMock.mockRejectedValue(new TypeError('Failed to fetch'));

    await expect(request('/x')).rejects.toThrow('Failed to fetch');
  });
});
