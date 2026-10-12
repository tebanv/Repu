import type { User, UserRole } from '@/types';

interface MockUser extends User {
  password?: string;
}

// Usuarios mockeados para desarrollo y testing
const MOCK_USERS: MockUser[] = [
  {
    id: '1',
    email: 'admin@mallvirtual.com',
    password: 'admin123',
    name: 'Administrador',
    role: 'admin' as UserRole,
    avatar: null,
  },
  {
    id: '2',
    email: 'usuario@test.com',
    password: 'user123',
    name: 'Usuario Test',
    role: 'user' as UserRole,
    avatar: null,
  },
  {
    id: '3',
    email: 'demo@demo.com',
    password: 'demo',
    name: 'Usuario Demo',
    role: 'user' as UserRole,
    avatar: null,
  },
];

/**
 * Simula un delay de red
 */
const delay = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Inicia sesión con email y password (versión mockeada)
 */
export const login = async (email?: string, password?: string): Promise<User> => {
  await delay(800);

  if (!email || !password) {
    throw new Error('Email y contraseña son requeridos');
  }

  const user = MOCK_USERS.find(
    (u) => u.email.toLowerCase() === email.toLowerCase() && u.password === password
  );

  if (!user) {
    throw new Error('Credenciales inválidas');
  }

  const { password: _, ...userWithoutPassword } = user;
  return userWithoutPassword;
};

/**
 * Cierra la sesión actual
 */
export const logout = (): void => {
  console.log('Sesión cerrada');
};

/**
 * Verifica si un token es válido (para implementación futura)
 */
export const verifyToken = async (token?: string | null): Promise<boolean> => {
  await delay(300);
  return Boolean(token);
};

/**
 * Obtiene los datos del usuario actual usando un token
 */
export const getCurrentUser = async (token?: string | null): Promise<User | null> => {
  await delay(300);
  if (!token) return null;
  const { password: _, ...user } = MOCK_USERS[0];
  return user;
};

/**
 * Registra un nuevo usuario (para implementación futura)
 */
export const register = async (userData: Partial<User>): Promise<User> => {
  await delay(1000);
  throw new Error('Función de registro no implementada aún');
};

/**
 * Solicita recuperación de contraseña (para implementación futura)
 */
export const requestPasswordReset = async (email: string): Promise<boolean> => {
  await delay(800);
  console.log(`Email de recuperación enviado a: ${email}`);
  return true;
};
