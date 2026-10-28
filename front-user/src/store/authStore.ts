import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import {
  login as loginService,
  logout as logoutService,
  getCurrentUser,
  subscribeToAuthChanges,
} from '@/services/authService';
import type { User, LoginCredentials } from '@/types';

export interface AuthStoreState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  hasHydrated: boolean;
  setHasHydrated: (hasHydrated: boolean) => void;
  login: (credentials: LoginCredentials) => Promise<boolean>;
  logout: () => Promise<void>;
  clearError: () => void;
  // Reconcilia la sesión del backend con el estado local. Idempotente:
  // llamadas concurrentes comparten la misma promesa en vuelo.
  initialize: () => Promise<void>;
}

// Guarda la suscripción a cambios de sesión (una sola vez por ciclo de vida
// del módulo; evita duplicados bajo StrictMode) y la promesa en vuelo.
let authSubscriptionStarted = false;
let initializeInFlight: Promise<void> | null = null;

const useAuthStore = create<AuthStoreState>()(
  persist(
    (set) => ({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,
      hasHydrated: false,

      setHasHydrated: (hasHydrated: boolean) => set({ hasHydrated }),

      login: async (credentials: LoginCredentials) => {
        set({ isLoading: true, error: null });

        try {
          const user = await loginService(credentials.email, credentials.password);
          set({
            user,
            isAuthenticated: true,
            isLoading: false,
            error: null,
          });
          return true;
        } catch (error) {
          const message =
            error instanceof Error
              ? error.message
              : 'Error al iniciar sesión. Intenta de nuevo.';
          set({
            error: message,
            isLoading: false,
            isAuthenticated: false,
          });
          return false;
        }
      },

      logout: async () => {
        try {
          await logoutService();
        } catch {
          // Red caída o sesión ya inválida: la limpieza local ocurre igual.
          // La cookie la expira el backend; si no, el próximo 401 la invalida.
        }
        set({
          user: null,
          isAuthenticated: false,
          error: null,
        });
      },

      clearError: () => set({ error: null }),

      initialize: async () => {
        if (initializeInFlight) return initializeInFlight;
        initializeInFlight = (async () => {
          // Si persist ya rehidrató sesión local, se revalida contra el backend:
          // la sesión vigente manda sobre `auth-storage` (fuente: servidor).
          set({ isLoading: true });
          try {
            const user = await getCurrentUser();
            set({
              user,
              isAuthenticated: Boolean(user),
              error: null,
              isLoading: false,
              hasHydrated: true,
            });
          } catch {
            // Sin red o sesión expirada: se cae a estado no autenticado en
            // vez de conservar una sesión local potencialmente rancia.
            set({
              user: null,
              isAuthenticated: false,
              isLoading: false,
              hasHydrated: true,
            });
          } finally {
            initializeInFlight = null;
          }
          // Suscripción única: propaga login/logout en otra pestaña,
          // expiración de sesión y 401 sin polling.
          if (!authSubscriptionStarted && typeof window !== 'undefined') {
            authSubscriptionStarted = true;
            try {
              subscribeToAuthChanges((user) => {
                useAuthStore.setState({
                  user,
                  isAuthenticated: Boolean(user),
                  isLoading: false,
                });
              });
            } catch {
              authSubscriptionStarted = false;
            }
          }
        })();
        return initializeInFlight;
      },
    }),
    {
      name: 'auth-storage',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        user: state.user,
        isAuthenticated: state.isAuthenticated,
      }),
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    }
  )
);

/**
 * Hook reactivo para saber cuándo el store de auth completó la rehidratación desde localStorage.
 */
export function useAuthHasHydrated(): boolean {
  return useAuthStore((state) => state.hasHydrated);
}

export default useAuthStore;
