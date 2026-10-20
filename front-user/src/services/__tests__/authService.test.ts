import { beforeEach, describe, expect, it, vi } from 'vitest';

// Cliente Supabase fake: solo cubre los métodos que usa `authService.ts`.
// Zero-Coupling en tests: se mockea el singleton, nunca el SDK real.
const { mockAuth, mockClient } = vi.hoisted(() => {
  const mockAuth = {
    signInWithPassword: vi.fn(),
    signOut: vi.fn(),
    getSession: vi.fn(),
    signUp: vi.fn(),
    resetPasswordForEmail: vi.fn(),
    onAuthStateChange: vi.fn(),
  };
  const mockClient = { auth: mockAuth, from: vi.fn() };
  return { mockAuth, mockClient };
});

vi.mock('@/services/supabaseClient', () => ({
  getSupabase: () => mockClient,
  isSupabaseConfigured: () => true,
}));

import {
  login,
  logout,
  getCurrentUser,
  verifyToken,
  register,
  requestPasswordReset,
  subscribeToAuthChanges,
} from '../authService';

// Configura la cadena `from().select().eq().maybeSingle()` con el resultado dado.
function mockProfile(data: unknown, error: unknown = null): void {
  const maybeSingle = vi.fn(() => Promise.resolve({ data, error }));
  const eq = vi.fn(() => ({ maybeSingle }));
  const select = vi.fn(() => ({ eq }));
  mockClient.from.mockReturnValue({ select });
}

const PROFILE = {
  id: 'uuid-1',
  email: 'usuario@demo.com',
  name: 'Usuario Test',
  phone: null,
  avatar_url: null,
  role: 'comprador',
};

beforeEach(() => {
  vi.clearAllMocks();
  mockAuth.onAuthStateChange.mockReturnValue({
    data: { subscription: { unsubscribe: vi.fn() } },
  });
});

describe('authService — Supabase real (cliente mockeado)', () => {
  it('login ok retorna User con rol real directo y email normalizado', async () => {
    mockAuth.signInWithPassword.mockResolvedValue({
      data: { user: { id: 'uuid-1' } },
      error: null,
    });
    mockProfile(PROFILE);

    const user = await login('  Usuario@Demo.com ', 'secret');

    expect(mockAuth.signInWithPassword).toHaveBeenCalledWith({
      email: 'usuario@demo.com',
      password: 'secret',
    });
    expect(user).toEqual({
      id: 'uuid-1',
      email: 'usuario@demo.com',
      name: 'Usuario Test',
      role: 'comprador',
      avatar: null,
    });
    expect(user).not.toHaveProperty('password');
  });

  it('login degrada rol desconocido a comprador en vez de romper', async () => {
    mockAuth.signInWithPassword.mockResolvedValue({
      data: { user: { id: 'uuid-1' } },
      error: null,
    });
    mockProfile({ ...PROFILE, role: 'superadmin' });

    const user = await login('usuario@demo.com', 'secret');
    expect(user.role).toBe('comprador');
  });

  it('login sin credenciales exige campos sin llamar a red', async () => {
    await expect(login('', '')).rejects.toThrow('Email y contraseña son requeridos');
    expect(mockAuth.signInWithPassword).not.toHaveBeenCalled();
  });

  it('login inválido normaliza a Credenciales inválidas', async () => {
    mockAuth.signInWithPassword.mockResolvedValue({
      data: { user: null },
      error: { message: 'Invalid login credentials' },
    });

    await expect(login('a@a.com', 'mala')).rejects.toThrow('Credenciales inválidas');
  });

  it('logout delega en signOut', async () => {
    mockAuth.signOut.mockResolvedValue({ error: null });
    await logout();
    expect(mockAuth.signOut).toHaveBeenCalled();
  });

  it('getCurrentUser sin sesión retorna null', async () => {
    mockAuth.getSession.mockResolvedValue({ data: { session: null } });
    await expect(getCurrentUser()).resolves.toBeNull();
    expect(mockClient.from).not.toHaveBeenCalled();
  });

  it('getCurrentUser con sesión retorna el perfil', async () => {
    mockAuth.getSession.mockResolvedValue({
      data: { session: { user: { id: 'uuid-1' } } },
    });
    mockProfile({ ...PROFILE, role: 'admin' });

    const user = await getCurrentUser();
    expect(user?.role).toBe('admin');
  });

  it('verifyToken refleja la sesión vigente', async () => {
    mockAuth.getSession.mockResolvedValue({ data: { session: { user: { id: 'x' } } } });
    await expect(verifyToken()).resolves.toBe(true);
    mockAuth.getSession.mockResolvedValue({ data: { session: null } });
    await expect(verifyToken()).resolves.toBe(false);
  });

  it('requestPasswordReset normaliza email y retorna true', async () => {
    mockAuth.resetPasswordForEmail.mockResolvedValue({ error: null });

    await expect(requestPasswordReset('  USER@demo.COM ')).resolves.toBe(true);
    expect(mockAuth.resetPasswordForEmail).toHaveBeenCalledWith('user@demo.com');
  });

  it('register crea en Auth con name para el trigger 0010 y retorna perfil', async () => {
    mockAuth.signUp.mockResolvedValue({
      data: { user: { id: 'uuid-9' } },
      error: null,
    });
    mockProfile({ ...PROFILE, id: 'uuid-9' });

    const user = await register({
      email: 'nuevo@demo.com',
      password: 'secret123',
      name: 'Nuevo',
    });

    expect(mockAuth.signUp).toHaveBeenCalledWith({
      email: 'nuevo@demo.com',
      password: 'secret123',
      options: { data: { name: 'Nuevo' } },
    });
    expect(user.id).toBe('uuid-9');
  });

  it('subscribeToAuthChanges propaga SIGNED_OUT como null', async () => {
    let cb: (event: string, session: unknown) => void = () => {};
    mockAuth.onAuthStateChange.mockImplementation((fn: typeof cb) => {
      cb = fn;
      return { data: { subscription: { unsubscribe: vi.fn() } } };
    });
    const listener = vi.fn();
    const unsub = subscribeToAuthChanges(listener);

    cb('SIGNED_OUT', null);
    await new Promise((r) => setTimeout(r, 0));

    expect(listener).toHaveBeenCalledWith(null);
    expect(typeof unsub).toBe('function');
  });

  it('subscribeToAuthChanges resuelve perfil en SIGNED_IN', async () => {
    let cb: (event: string, session: unknown) => void = () => {};
    mockAuth.onAuthStateChange.mockImplementation((fn: typeof cb) => {
      cb = fn;
      return { data: { subscription: { unsubscribe: vi.fn() } } };
    });
    mockProfile(PROFILE);
    const listener = vi.fn();
    subscribeToAuthChanges(listener);

    cb('SIGNED_IN', { user: { id: 'uuid-1' } });
    await new Promise((r) => setTimeout(r, 0));

    expect(listener).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'uuid-1', role: 'comprador' }),
    );
  });
});
