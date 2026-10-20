import { getSupabase } from './supabaseClient';
import type { User, UserRole } from '@/types';

// Fila cruda de `profiles` (snake_case, solo capa services).
// Contrato DB: docs/DATA_MODEL.md §3.1 + migración 0002_profiles.sql.
interface ProfileRow {
  id: string;
  email: string;
  name: string;
  phone: string | null;
  avatar_url: string | null;
  role: string | null;
}

// Vocabulario único front↔DB (sin traducción). Si la DB trajera un rol
// desconocido (migración futura), se degrada a 'comprador' en vez de romper UI.
const VALID_ROLES: readonly UserRole[] = [
  'comprador',
  'distribuidor',
  'domiciliario',
  'admin',
];

// Fila `profiles` → `User`. Asignación directa: mismo vocabulario, sin mapeo.
function mapProfileRow(row: ProfileRow): User {
  const role: UserRole = VALID_ROLES.includes(row.role as UserRole)
    ? (row.role as UserRole)
    : 'comprador';
  return {
    id: String(row.id),
    email: row.email,
    name: row.name,
    role,
    avatar: row.avatar_url ?? null,
  };
}

// Lee el perfil del usuario autenticado. Requiere la policy
// `profiles_owner` (0007_rls.sql) y el trigger 0010 (auto-creación al signUp).
async function fetchProfile(userId: string): Promise<User> {
  const { data, error } = await getSupabase()
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle();
  if (error) throw new Error(`Perfil no disponible: ${error.message}`);
  if (!data) {
    throw new Error(
      'Perfil no encontrado. Si acabas de registrarte, falta aplicar la migración 0010_handle_new_user.',
    );
  }
  return mapProfileRow(data as ProfileRow);
}

/**
 * Inicia sesión con email y password contra Supabase Auth.
 * Normaliza errores a mensajes de UI sin filtrar si el email existe.
 */
export const login = async (email?: string, password?: string): Promise<User> => {
  if (!email || !password) {
    throw new Error('Email y contraseña son requeridos');
  }
  const { data, error } = await getSupabase().auth.signInWithPassword({
    email: email.trim().toLowerCase(),
    password,
  });
  if (error || !data.user) {
    throw new Error('Credenciales inválidas');
  }
  return fetchProfile(data.user.id);
};

/**
 * Cierra la sesión en Supabase (limpia su token). El store limpia además
 * `user/isAuthenticated`; la key `auth-storage` permanece (no se borra).
 */
export const logout = async (): Promise<void> => {
  await getSupabase().auth.signOut();
};

/**
 * Indica si hay sesión Supabase vigente. El argumento legacy se ignora:
 * la validez la determina el cliente (JWT custodiado por supabase-js,
 * nunca en `auth-storage` ni en `User`).
 */
export const verifyToken = async (_token?: string | null): Promise<boolean> => {
  const { data } = await getSupabase().auth.getSession();
  return Boolean(data.session);
};

/**
 * Retorna el usuario actual desde la sesión vigente, o `null` sin sesión.
 * El argumento legacy se ignora (compat con firmas mock anteriores).
 */
export const getCurrentUser = async (_token?: string | null): Promise<User | null> => {
  const { data } = await getSupabase().auth.getSession();
  const userId = data.session?.user.id;
  if (!userId) return null;
  return fetchProfile(userId);
};

/**
 * Registra un usuario en Supabase Auth. El trigger 0010 crea su fila en
 * `profiles` con rol 'comprador'. Requiere `email` + `password`; `name`
 * viaja en `options.data` para el trigger.
 */
export const register = async (
  userData: Partial<User> & { email: string; password: string },
): Promise<User> => {
  const { data, error } = await getSupabase().auth.signUp({
    email: userData.email.trim().toLowerCase(),
    password: userData.password,
    options: { data: { name: userData.name ?? userData.email.split('@')[0] } },
  });
  if (error || !data.user) {
    throw new Error(error?.message ?? 'No se pudo registrar el usuario');
  }
  return fetchProfile(data.user.id);
};

/**
 * Suscribe al store a los cambios de sesión Supabase (login/logout en otra
 * pestaña, expiración/refresh de token). Zero-Coupling: el store no importa
 * `@supabase/supabase-js`; solo recibe `User | null` de dominio.
 * Retorna función para desuscribirse.
 */
export const subscribeToAuthChanges = (
  listener: (user: User | null) => void,
): (() => void) => {
  const { data } = getSupabase().auth.onAuthStateChange(async (event, session) => {
    if (event === 'SIGNED_OUT' || !session?.user) {
      listener(null);
      return;
    }
    try {
      listener(await fetchProfile(session.user.id));
    } catch {
      listener(null);
    }
  });
  return () => data.subscription.unsubscribe();
};

/**
 * Envía el email de recuperación vía Supabase Auth. Mensaje genérico
 * para no revelar si el email existe (anti-enumeración).
 */
export const requestPasswordReset = async (email: string): Promise<boolean> => {
  const { error } = await getSupabase().auth.resetPasswordForEmail(email.trim().toLowerCase());
  if (error) throw new Error('No se pudo solicitar la recuperación');
  return true;
};
