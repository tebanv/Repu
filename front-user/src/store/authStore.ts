import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { login as loginService, logout as logoutService } from '@/services/authService';
import type { User, LoginCredentials } from '@/types';

export interface AuthStoreState {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  hasHydrated: boolean;
  setHasHydrated: (hasHydrated: boolean) => void;
  login: (credentials: LoginCredentials) => Promise<boolean>;
  logout: () => void;
  clearError: () => void;
}

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

      logout: () => {
        logoutService();
        set({
          user: null,
          isAuthenticated: false,
          error: null,
        });
      },

      clearError: () => set({ error: null }),
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
