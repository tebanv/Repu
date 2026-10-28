import { beforeEach, describe, expect, it, vi } from 'vitest';
import useAuthStore from '../authStore';
import {
  login as loginService,
  logout as logoutService,
  getCurrentUser,
} from '@/services/authService';

// El store no habla con el backend directamente: se mockea el servicio de
// dominio (contrato con `authService.ts`), no el transporte HTTP.
vi.mock('@/services/authService', () => ({
  login: vi.fn(),
  logout: vi.fn(),
  getCurrentUser: vi.fn(),
  subscribeToAuthChanges: vi.fn(() => () => {}),
}));

const mockLogin = vi.mocked(loginService);
const mockLogout = vi.mocked(logoutService);
const mockGetCurrentUser = vi.mocked(getCurrentUser);

// Aísla sesión + storage entre tests.
function resetAuth(): void {
  localStorage.clear();
  vi.clearAllMocks();
  useAuthStore.setState({
    user: null,
    isAuthenticated: false,
    isLoading: false,
    error: null,
    hasHydrated: true,
  });
}

beforeEach(() => {
  resetAuth();
});

describe('authStore — sesión del backend (servicio mockeado)', () => {
  it('login válido autentica con rol real sin exponer password', async () => {
    mockLogin.mockResolvedValue({
      id: 'uuid-1',
      email: 'admin@mallvirtual.com',
      name: 'Administrador',
      role: 'admin',
      avatar: null,
    });

    const ok = await useAuthStore
      .getState()
      .login({ email: 'admin@mallvirtual.com', password: 'admin123' });

    expect(ok).toBe(true);
    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(true);
    expect(state.user?.email).toBe('admin@mallvirtual.com');
    expect(state.user?.role).toBe('admin');
    expect(state.user).not.toHaveProperty('password');
    expect(state.error).toBeNull();
  });

  it('login con credencial inválida falla con error', async () => {
    mockLogin.mockRejectedValue(new Error('Credenciales inválidas'));

    const ok = await useAuthStore
      .getState()
      .login({ email: 'admin@mallvirtual.com', password: 'mala' });

    expect(ok).toBe(false);
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
    expect(useAuthStore.getState().error).toBe('Credenciales inválidas');
  });

  it('login vacío exige campos', async () => {
    mockLogin.mockRejectedValue(new Error('Email y contraseña son requeridos'));

    const ok = await useAuthStore.getState().login({ email: '', password: '' });

    expect(ok).toBe(false);
    expect(useAuthStore.getState().error).toBe('Email y contraseña son requeridos');
  });

  it('logout limpia sesión aunque el signOut falle', async () => {
    mockLogin.mockResolvedValue({
      id: 'uuid-2',
      email: 'demo@demo.com',
      name: 'Usuario Demo',
      role: 'comprador',
      avatar: null,
    });
    mockLogout.mockRejectedValue(new Error('network'));
    await useAuthStore.getState().login({ email: 'demo@demo.com', password: 'demo123' });

    await useAuthStore.getState().logout();

    const state = useAuthStore.getState();
    expect(state.user).toBeNull();
    expect(state.isAuthenticated).toBe(false);
  });

  it('clearError resetea el mensaje', async () => {
    mockLogin.mockRejectedValue(new Error('Credenciales inválidas'));
    await useAuthStore.getState().login({ email: 'x@x.com', password: 'x' });
    useAuthStore.getState().clearError();
    expect(useAuthStore.getState().error).toBeNull();
  });

  it('initialize con sesión vigente hidrata como autenticado', async () => {
    mockGetCurrentUser.mockResolvedValue({
      id: 'uuid-3',
      email: 'usuario@demo.com',
      name: 'Usuario Test',
      role: 'comprador',
      avatar: null,
    });
    useAuthStore.setState({ hasHydrated: false });

    await useAuthStore.getState().initialize();

    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(true);
    expect(state.user?.role).toBe('comprador');
    expect(state.hasHydrated).toBe(true);
    expect(state.isLoading).toBe(false);
  });

  it('initialize sin sesión cae a no autenticado (no conserva sesión rancia)', async () => {
    mockGetCurrentUser.mockResolvedValue(null);
    useAuthStore.setState({
      user: { id: 'stale', email: 'x@x.com', name: 'Rancio', role: 'comprador' },
      isAuthenticated: true,
      hasHydrated: false,
    });

    await useAuthStore.getState().initialize();

    const state = useAuthStore.getState();
    expect(state.user).toBeNull();
    expect(state.isAuthenticated).toBe(false);
    expect(state.hasHydrated).toBe(true);
  });
});
