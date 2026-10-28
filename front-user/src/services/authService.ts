import { httpClient, HttpError, onUnauthorized } from './httpClient';
import type { User, UserRole } from '@/types';

/**
 * Servicio de autenticación del front contra el backend real.
 *
 * Contrato:
 * - `ms-auth` emite/revoca la sesión (cookie HttpOnly `__Host-repu_session`).
 * - `ms-users` entrega el perfil del usuario autenticado.
 *
 * La UI y el store nunca ven cookies, tokens ni detalles de red: solo `User`
 * y errores de dominio. El `accessToken` del body se ignora deliberadamente.
 */

interface LoginResponse {
  authenticated: boolean;
  userId: string;
  role: string;
  activeCompanyId?: string | null;
  accessToken?: string;
  expiresInSeconds?: number;
}

interface ProfileResponse {
  id: string;
  email: string;
  role?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  phone?: string | null;
  profileAttributes?: Record<string, unknown> | null;
}

interface RegisterResponse {
  id: string;
  name?: string | null;
  email: string;
  role?: string | null;
  status?: boolean;
  createdAt?: string;
}

export interface RegisterUserInput {
  email: string;
  password: string;
  name?: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  role?: UserRole;
  profileAttributes?: Record<string, unknown>;
}

const ROLE_MAP: Record<string, UserRole> = {
  COMPRADOR: 'comprador',
  DISTRIBUIDOR: 'distribuidor',
  DOMICILIARIO: 'domiciliario',
  ANALISTA: 'analista',
  ADMIN: 'admin',
};

const SELF_REGISTRATION_ROLES = new Set<UserRole>([
  'comprador',
  'distribuidor',
  'domiciliario',
]);

/** Mapea el rol MAYÚSCULAS del backend al vocabulario del front. */
function mapRole(raw: string | null | undefined): UserRole {
  const key = (raw ?? '').trim().toUpperCase();
  const role = ROLE_MAP[key];
  if (role) return role;

  if (process.env.NODE_ENV !== 'production') {
    console.warn(`[authService] Rol desconocido "${raw ?? ''}"; se degrada a comprador.`);
  }
  return 'comprador';
}

function displayName(profile: ProfileResponse): string {
  const fullName = [profile.firstName, profile.lastName]
    .filter((part): part is string => Boolean(part && part.trim()))
    .join(' ')
    .trim();
  return fullName || profile.email;
}

function avatarFrom(profile: ProfileResponse): string | null {
  const avatar = profile.profileAttributes?.avatar;
  return typeof avatar === 'string' && avatar.trim() ? avatar : null;
}

function toUser(profile: ProfileResponse): User {
  return {
    id: String(profile.id),
    email: profile.email,
    name: displayName(profile),
    role: mapRole(profile.role),
    avatar: avatarFrom(profile),
  };
}

async function fetchProfile(): Promise<User> {
  const profile = await httpClient.get<ProfileResponse>('/ms-users/api/users/profile');
  return toUser(profile);
}

/** Notifica a otras pestañas sin exponer detalles de sesión. */
function broadcastAuthEvent(type: 'login' | 'logout' | 'unauthorized'): void {
  if (typeof window === 'undefined' || !('BroadcastChannel' in window)) return;
  try {
    const channel = new BroadcastChannel('repu-auth');
    channel.postMessage({ type });
    channel.close();
  } catch {
    // BroadcastChannel puede fallar en navegadores antiguos; el fallback
    // `storage` de `subscribeToAuthChanges` cubre ese caso.
  }
}

/**
 * Inicia sesión contra `ms-auth` y completa el `User` con `ms-users/profile`.
 * Errores normalizados: 401 → credenciales inválidas; resto → servicio no disponible.
 */
export const login = async (email?: string, password?: string): Promise<User> => {
  if (!email?.trim() || !password) {
    throw new Error('Email y contraseña son requeridos');
  }

  try {
    const session = await httpClient.post<LoginResponse>(
      '/ms-auth/api/auth/login',
      { email: email.trim().toLowerCase(), password },
      { skipUnauthorizedNotification: true },
    );

    if (!session.authenticated) {
      throw new Error('Credenciales inválidas');
    }

    const user = await fetchProfile();
    broadcastAuthEvent('login');
    return user;
  } catch (error) {
    if (error instanceof HttpError) {
      if (error.status === 401) {
        throw new Error('Credenciales inválidas');
      }
      if (error.status === 400 && error.message) {
        throw new Error(error.message);
      }
    }
    if (error instanceof Error && error.message === 'Credenciales inválidas') {
      throw error;
    }
    throw new Error('Servicio no disponible');
  }
};

/**
 * Cierra la sesión en el servidor y notifica a otras pestañas.
 * El store limpia su estado local aunque esta llamada falle.
 */
export const logout = async (): Promise<void> => {
  try {
    await httpClient.post<void>('/ms-auth/api/auth/logout');
  } finally {
    broadcastAuthEvent('logout');
  }
};

/**
 * `true` si hay una sesión vigente. El argumento legacy se ignora: la
 * validez la determina el perfil resuelto contra el backend.
 */
export const verifyToken = async (_token?: string | null): Promise<boolean> => {
  void _token;
  return Boolean(await getCurrentUser());
};

/** Retorna el usuario autenticado o `null` si no hay sesión válida. */
export const getCurrentUser = async (_token?: string | null): Promise<User | null> => {
  void _token;
  try {
    return await fetchProfile();
  } catch (error) {
    if (error instanceof HttpError && error.status === 401) {
      return null;
    }
    throw error;
  }
};

/**
 * Registra una cuenta en `ms-auth`.
 * No inicia sesión: el backend responde 201 sin cookie. El llamador debe
 * hacer `login` después si quiere dejar al usuario autenticado.
 */
export const register = async (userData: RegisterUserInput): Promise<User> => {
  const email = userData.email?.trim().toLowerCase();
  if (!email || !userData.password) {
    throw new Error('Email y contraseña son requeridos');
  }

  const firstName = (userData.firstName ?? userData.name ?? email.split('@')[0]).trim();
  const lastName = (userData.lastName ?? '').trim();
  const role = (userData.role ?? 'comprador') as UserRole;

  if (!SELF_REGISTRATION_ROLES.has(role)) {
    throw new Error('Rol no permitido para autorregistro');
  }

  try {
    const response = await httpClient.post<RegisterResponse>(
      '/ms-auth/api/auth/register',
      {
        firstName,
        lastName,
        email,
        password: userData.password,
        phone: userData.phone,
        role: role.toUpperCase(),
        profileAttributes: userData.profileAttributes,
      },
      { skipUnauthorizedNotification: true },
    );

    const nameFromResponse = response.name?.trim();
    const fullName = [firstName, lastName].filter(Boolean).join(' ').trim();

    return {
      id: String(response.id),
      email: response.email,
      name: fullName || nameFromResponse || email,
      role: mapRole(response.role),
      avatar: null,
    };
  } catch (error) {
    if (error instanceof HttpError) {
      throw new Error(error.message || 'No se pudo registrar el usuario');
    }
    throw new Error('Servicio no disponible');
  }
};

/**
 * Solicita recuperación de contraseña en `ms-users`.
 * La respuesta es siempre genérica para no revelar si el correo existe.
 */
export const requestPasswordReset = async (email: string): Promise<boolean> => {
  const normalizedEmail = email?.trim().toLowerCase();
  if (!normalizedEmail) {
    throw new Error('El correo es obligatorio');
  }

  try {
    await httpClient.post(
      '/ms-users/api/users/password-recovery',
      { email: normalizedEmail },
      { skipUnauthorizedNotification: true },
    );
    return true;
  } catch {
    throw new Error('No se pudo solicitar la recuperación');
  }
};

/**
 * Mantiene la UI sincronizada sin polling:
 * - `BroadcastChannel('repu-auth')` para login/logout en otras pestañas.
 * - `onUnauthorized` para 401 de cualquier endpoint autenticado.
 * - `visibilitychange` para revalidar al volver a la pestaña (máx. 1/min).
 * - `storage` como fallback si no hay BroadcastChannel.
 *
 * Retorna la función de limpieza; el store la usa una sola vez.
 */
export const subscribeToAuthChanges = (
  listener: (user: User | null) => void,
): (() => void) => {
  let closed = false;
  let lastVisibilityCheck = 0;
  let channel: BroadcastChannel | null = null;

  const emit = (user: User | null) => {
    if (!closed) listener(user);
  };

  const refresh = async () => {
    try {
      emit(await getCurrentUser());
    } catch {
      emit(null);
    }
  };

  const unsubscribeUnauthorized = onUnauthorized(() => {
    emit(null);
    broadcastAuthEvent('unauthorized');
  });

  if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
    try {
      channel = new BroadcastChannel('repu-auth');
      channel.onmessage = (event: MessageEvent) => {
        const type = (event.data as { type?: string } | null)?.type;
        if (type === 'logout' || type === 'unauthorized') {
          emit(null);
          return;
        }
        if (type === 'login') {
          void refresh();
        }
      };
    } catch {
      channel = null;
    }
  }

  const onVisibilityChange = () => {
    if (typeof document === 'undefined' || document.visibilityState !== 'visible') return;
    const now = Date.now();
    if (now - lastVisibilityCheck < 60_000) return;
    lastVisibilityCheck = now;
    void refresh();
  };

  const onStorage = (event: StorageEvent) => {
    if (event.key === 'auth-storage') {
      void refresh();
    }
  };

  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', onVisibilityChange);
  }
  if (typeof window !== 'undefined') {
    window.addEventListener('storage', onStorage);
  }

  return () => {
    closed = true;
    unsubscribeUnauthorized();
    channel?.close();
    if (typeof document !== 'undefined') {
      document.removeEventListener('visibilitychange', onVisibilityChange);
    }
    if (typeof window !== 'undefined') {
      window.removeEventListener('storage', onStorage);
    }
  };
};
