// Modelos de autenticación y sesión

export type UserRole = 'admin' | 'user' | 'demo';

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

