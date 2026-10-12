// Sincronización multi-tab vía StorageEvent (Fase A2, regla 7.2).
// Cuando otra pestaña escribe la misma storage key, rehidratamos el store
// local para evitar estados divergentes del carrito/pedidos.
// Sin loops: rehydrate solo lee de localStorage, nunca escribe.

/**
 * Suscribe la rehidratación del store a cambios de otra pestaña.
 * Retorna cleanup (útil en tests/HMR). No-op en SSR (sin window).
 */
export function enableCrossTabSync(
  storageKey: string,
  rehydrate: () => void
): () => void {
  if (typeof window === 'undefined' || typeof window.addEventListener !== 'function') {
    return () => undefined;
  }

  // Guarda HMR: el módulo puede re-evaluarse en dev sin duplicar listeners.
  const flagKey = `__sync_${storageKey}`;
  const scope = window as unknown as Record<string, unknown>;
  if (scope[flagKey]) {
    return () => undefined;
  }
  scope[flagKey] = true;

  const handler = (event: StorageEvent): void => {
    // key null = localStorage.clear() en otra pestaña: también rehidratar.
    if (event.key !== null && event.key !== storageKey) {
      return;
    }
    rehydrate();
  };

  window.addEventListener('storage', handler);
  return () => window.removeEventListener('storage', handler);
}
