// Modelos de autenticación y sesión

// Rol real del backend (`usuarios.rol_sistema` en el schema `repu`).
// El backend usa MAYÚSCULAS; `authService` normaliza a este vocabulario.
// 'demo' no es un rol, es un atajo UX del LoginForm contra usuarios seed.
export type UserRole = 'comprador' | 'distribuidor' | 'domiciliario' | 'analista' | 'admin';

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

