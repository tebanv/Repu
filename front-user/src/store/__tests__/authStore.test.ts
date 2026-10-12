import { beforeEach, describe, expect, it } from 'vitest';
import useAuthStore from '../authStore';

// Aísla sesión + storage entre tests.
function resetAuth(): void {
  localStorage.clear();
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

describe('authStore — login mock', () => {
  it('login válido autentica sin exponer password', async () => {
    const ok = await useAuthStore
      .getState()
      .login({ email: 'admin@mallvirtual.com', password: 'admin123' });

    expect(ok).toBe(true);
    const state = useAuthStore.getState();
    expect(state.isAuthenticated).toBe(true);
    expect(state.user?.email).toBe('admin@mallvirtual.com');
    expect(state.user).not.toHaveProperty('password');
    expect(state.error).toBeNull();
  });

  it('login con credencial inválida falla con error', async () => {
    const ok = await useAuthStore
      .getState()
      .login({ email: 'admin@mallvirtual.com', password: 'mala' });

    expect(ok).toBe(false);
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
    expect(useAuthStore.getState().error).toBe('Credenciales inválidas');
  });

  it('login vacío exige campos', async () => {
    const ok = await useAuthStore.getState().login({ email: '', password: '' });

    expect(ok).toBe(false);
    expect(useAuthStore.getState().error).toBe('Email y contraseña son requeridos');
  });

  it('logout limpia sesión', async () => {
    await useAuthStore
      .getState()
      .login({ email: 'demo@demo.com', password: 'demo' });
    useAuthStore.getState().logout();

    const state = useAuthStore.getState();
    expect(state.user).toBeNull();
    expect(state.isAuthenticated).toBe(false);
  });

  it('clearError resetea el mensaje', async () => {
    await useAuthStore.getState().login({ email: 'x@x.com', password: 'x' });
    useAuthStore.getState().clearError();
    expect(useAuthStore.getState().error).toBeNull();
  });
});
