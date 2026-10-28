import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getCurrentUser,
  login,
  logout,
  register,
  requestPasswordReset,
  subscribeToAuthChanges,
  verifyToken,
} from '../authService';

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

const LOGIN_OK = {
  authenticated: true,
  userId: 'uuid-1',
  role: 'COMPRADOR',
  activeCompanyId: null,
  accessToken: 'opaque-token',
  expiresInSeconds: 604800,
};

const PROFILE = {
  id: 'uuid-1',
  email: 'usuario@demo.com',
  role: 'COMPRADOR',
  firstName: 'Usuario',
  lastName: 'Test',
  phone: null,
  profileAttributes: {},
};

let fetchMock: ReturnType<typeof vi.fn>;

beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('authService — backend Spring (fetch mockeado)', () => {
  it('login hace POST a ms-auth y completa el User con ms-users/profile', async () => {
    fetchMock
      .mockResolvedValueOnce(fakeResponse(LOGIN_OK))
      .mockResolvedValueOnce(fakeResponse(PROFILE));

    const user = await login('  Usuario@Demo.com ', 'secret');

    expect(fetchMock).toHaveBeenCalledTimes(2);
    const [loginUrl, loginInit] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(loginUrl).toBe('/ms-auth/api/auth/login');
    expect(JSON.parse(String(loginInit.body))).toEqual({
      email: 'usuario@demo.com',
      password: 'secret',
    });

    const [profileUrl, profileInit] = fetchMock.mock.calls[1] as [string, RequestInit];
    expect(profileUrl).toBe('/ms-users/api/users/profile');
    expect(profileInit.credentials).toBe('include');

    expect(user).toEqual({
      id: 'uuid-1',
      email: 'usuario@demo.com',
      name: 'Usuario Test',
      role: 'comprador',
      avatar: null,
    });
    expect(user).not.toHaveProperty('password');
    expect(user).not.toHaveProperty('accessToken');
  });

  it('mapea ANALISTA a analista y rol desconocido a comprador', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    fetchMock
      .mockResolvedValueOnce(fakeResponse({ ...LOGIN_OK, role: 'ANALISTA' }))
      .mockResolvedValueOnce(fakeResponse({ ...PROFILE, role: 'ANALISTA' }));

    await expect(login('analista@repu.com', 'secret')).resolves.toMatchObject({
      role: 'analista',
    });

    fetchMock
      .mockResolvedValueOnce(fakeResponse(LOGIN_OK))
      .mockResolvedValueOnce(fakeResponse({ ...PROFILE, role: 'SUPERADMIN' }));

    await expect(login('raro@repu.com', 'secret')).resolves.toMatchObject({
      role: 'comprador',
    });
    expect(warn).toHaveBeenCalled();
  });

  it('login sin credenciales falla sin llamar a red', async () => {
    await expect(login('', '')).rejects.toThrow('Email y contraseña son requeridos');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('login 401 normaliza a Credenciales inválidas', async () => {
    fetchMock.mockResolvedValue(fakeResponse({ message: 'Usuario inactivo' }, 401));

    await expect(login('a@a.com', 'mala')).rejects.toThrow('Credenciales inválidas');
  });

  it('logout hace POST a ms-auth', async () => {
    fetchMock.mockResolvedValue(fakeResponse(undefined, 204, null));

    await logout();

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/ms-auth/api/auth/logout');
    expect(init.method).toBe('POST');
  });

  it('getCurrentUser devuelve null en 401 y el perfil en 200', async () => {
    fetchMock.mockResolvedValueOnce(fakeResponse({ message: 'Sesión inválida' }, 401));
    await expect(getCurrentUser()).resolves.toBeNull();

    fetchMock.mockResolvedValueOnce(fakeResponse(PROFILE));
    await expect(getCurrentUser()).resolves.toMatchObject({
      id: 'uuid-1',
      email: 'usuario@demo.com',
      role: 'comprador',
    });
  });

  it('verifyToken refleja la sesión vigente', async () => {
    fetchMock.mockResolvedValueOnce(fakeResponse(PROFILE));
    await expect(verifyToken()).resolves.toBe(true);

    fetchMock.mockResolvedValueOnce(fakeResponse({ message: 'Sesión inválida' }, 401));
    await expect(verifyToken()).resolves.toBe(false);
  });

  it('register envía firstName/lastName/role y no inicia sesión', async () => {
    fetchMock.mockResolvedValue(
      fakeResponse(
        {
          id: 'uuid-9',
          name: 'Nuevo',
          email: 'nuevo@demo.com',
          role: 'COMPRADOR',
          status: true,
        },
        201,
      ),
    );

    const user = await register({
      email: 'Nuevo@Demo.com',
      password: 'Secret123*',
      name: 'Nuevo',
      lastName: 'Usuario',
      phone: '+573100000000',
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/ms-auth/api/auth/register');
    expect(JSON.parse(String(init.body))).toMatchObject({
      firstName: 'Nuevo',
      lastName: 'Usuario',
      email: 'nuevo@demo.com',
      phone: '+573100000000',
      role: 'COMPRADOR',
    });
    expect(user).toEqual({
      id: 'uuid-9',
      email: 'nuevo@demo.com',
      name: 'Nuevo Usuario',
      role: 'comprador',
      avatar: null,
    });
  });

  it('register rechaza roles que no son de autorregistro', async () => {
    await expect(
      register({
        email: 'admin@repu.com',
        password: 'Secret123*',
        role: 'admin',
      }),
    ).rejects.toThrow('Rol no permitido para autorregistro');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('requestPasswordReset llama a ms-users y retorna true', async () => {
    fetchMock.mockResolvedValue(fakeResponse({ message: 'Si existe...' }, 202));

    await expect(requestPasswordReset('  USER@demo.COM ')).resolves.toBe(true);

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('/ms-users/api/users/password-recovery');
    expect(JSON.parse(String(init.body))).toEqual({ email: 'user@demo.com' });
  });

  it('subscribeToAuthChanges emite null ante un 401 global', async () => {
    const listener = vi.fn();
    const unsubscribe = subscribeToAuthChanges(listener);

    fetchMock.mockResolvedValue(fakeResponse({ message: 'Sesión inválida' }, 401));
    await getCurrentUser();

    expect(listener).toHaveBeenCalledWith(null);
    unsubscribe();
  });
});
