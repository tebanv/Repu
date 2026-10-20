// Modelos de autenticación y sesión

// Rol real compartido con la DB (`user_role` en 0001_enums.sql).
// Sin capa de traducción: el front usa el mismo vocabulario que
// `profiles.role` (DATA_MODEL.md §3.1). 'demo' no es un rol, es un
// atajo UX del LoginForm contra usuarios seed con rol 'comprador'.
export type UserRole = 'comprador' | 'distribuidor' | 'domiciliario' | 'admin';

export interface User {
  id: string;
  name: string;
  email: string;
  role?: UserRole;
  avatar?: string | null;
}

export interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  hasHydrated?: boolean;
}

export interface LoginCredentials {
  email: string;
  password?: string;
}

