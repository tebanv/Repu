/**
 * Cola de sincronización con *coalescing* por clave y ejecución en serie.
 *
 * Pensada para enviar al backend el estado de un recurso editado muchas veces
 * seguidas (cantidades del carrito). Garantías:
 *
 * - **Coalescing:** `schedule(key, task)` reemplaza la tarea pendiente de esa
 *   clave y reinicia su espera (`delayMs`). Una ráfaga de cambios sobre la
 *   misma clave termina en **una** ejecución.
 * - **Serie:** como mucho una tarea corre a la vez, en orden FIFO de
 *   vencimiento. Así las respuestas nunca llegan desordenadas y la última
 *   respuesta siempre refleja el estado más reciente del servidor.
 * - **`flush()`:** vence de inmediato todo lo pendiente y espera a que la cola
 *   quede vacía (p. ej. antes del checkout).
 *
 * Las tareas deben leer el valor a enviar **al ejecutarse** (no capturarlo al
 * programarse) para mandar siempre el último. La cola no reintenta: cada
 * tarea maneja sus errores; si lanza, la cola lo registra y sigue.
 *
 * Sin dependencias de React ni de red: se prueba con temporizadores reales.
 */

export type SyncTask = () => Promise<void>;

export interface SyncQueue {
  schedule: (key: string, task: SyncTask) => void;
  /** Descarta tareas pendientes (no la que está corriendo) cuyas claves cumplan el predicado. */
  cancel: (predicate: (key: string) => boolean) => void;
  flush: () => Promise<void>;
  /** Claves programadas o listas para correr (no incluye la que está corriendo). */
  pendingKeys: () => string[];
  isIdle: () => boolean;
  /** Notifica cambios de actividad: `true` al empezar a trabajar, `false` al quedar vacía. */
  onActivityChange: (listener: (busy: boolean) => void) => () => void;
}

export function createSyncQueue({ delayMs }: { delayMs: number }): SyncQueue {
  const tasks = new Map<string, SyncTask>();
  const timers = new Map<string, ReturnType<typeof setTimeout>>();
  const ready: string[] = [];
  const listeners = new Set<(busy: boolean) => void>();
  let running = false;
  let busy = false;
  let idleWaiters: Array<() => void> = [];

  const setBusy = (next: boolean) => {
    if (busy === next) return;
    busy = next;
    for (const listener of listeners) {
      try {
        listener(next);
      } catch {
        // Un listener defectuoso no debe detener la cola.
      }
    }
  };

  const hasWork = () => running || ready.length > 0 || timers.size > 0;

  const settleIfIdle = () => {
    if (hasWork()) return;
    setBusy(false);
    const waiters = idleWaiters;
    idleWaiters = [];
    waiters.forEach((resolve) => resolve());
  };

  const markReady = (key: string) => {
    timers.delete(key);
    if (!ready.includes(key)) ready.push(key);
    void drain();
  };

  async function drain(): Promise<void> {
    if (running) return;
    running = true;
    try {
      while (ready.length > 0) {
        const key = ready.shift() as string;
        const task = tasks.get(key);
        tasks.delete(key);
        if (!task) continue;
        try {
          await task();
        } catch (error) {
          if (process.env.NODE_ENV !== 'production') {
            console.warn(`[syncQueue] la tarea "${key}" falló sin manejar su error`, error);
          }
        }
      }
    } finally {
      running = false;
      settleIfIdle();
    }
  }

  return {
    schedule(key, task) {
      tasks.set(key, task);
      // Si ya está lista para correr, conserva su turno y solo cambia la tarea.
      if (!ready.includes(key)) {
        const previous = timers.get(key);
        if (previous) clearTimeout(previous);
        timers.set(
          key,
          setTimeout(() => markReady(key), delayMs),
        );
      }
      // Se notifica después de registrar el trabajo, para que los listeners
      // que consultan `isIdle()` vean la cola ocupada.
      setBusy(true);
    },

    cancel(predicate) {
      for (const [key, timer] of timers) {
        if (predicate(key)) {
          clearTimeout(timer);
          timers.delete(key);
          tasks.delete(key);
        }
      }
      for (let i = ready.length - 1; i >= 0; i -= 1) {
        if (predicate(ready[i])) {
          tasks.delete(ready[i]);
          ready.splice(i, 1);
        }
      }
      settleIfIdle();
    },

    flush() {
      for (const [key, timer] of timers) {
        clearTimeout(timer);
        timers.delete(key);
        if (!ready.includes(key)) ready.push(key);
      }
      const idle = new Promise<void>((resolve) => {
        idleWaiters.push(resolve);
      });
      void drain();
      settleIfIdle();
      return idle;
    },

    pendingKeys() {
      return [...new Set([...timers.keys(), ...ready])];
    },

    isIdle() {
      return !hasWork();
    },

    onActivityChange(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
