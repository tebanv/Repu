import { describe, expect, it } from 'vitest';
import { createSyncQueue } from '../syncQueue';

// Cola de sincronización del carrito (docs/PLAN-PEDIDOS.md §2.2).

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe('syncQueue', () => {
  it('agrupa una ráfaga sobre la misma clave en una sola ejecución (la última)', async () => {
    const queue = createSyncQueue({ delayMs: 20 });
    const runs: number[] = [];

    for (let value = 1; value <= 10; value += 1) {
      queue.schedule('p1', async () => {
        runs.push(value);
      });
    }
    await sleep(60);

    expect(runs).toEqual([10]);
    expect(queue.isIdle()).toBe(true);
  });

  it('ejecuta en serie: nunca dos tareas a la vez', async () => {
    const queue = createSyncQueue({ delayMs: 0 });
    let active = 0;
    let maxActive = 0;
    const task = async () => {
      active += 1;
      maxActive = Math.max(maxActive, active);
      await sleep(5);
      active -= 1;
    };

    queue.schedule('a', task);
    queue.schedule('b', task);
    queue.schedule('c', task);
    await queue.flush();

    expect(maxActive).toBe(1);
  });

  it('flush vence lo pendiente sin esperar el delay y resuelve al quedar vacía', async () => {
    const queue = createSyncQueue({ delayMs: 10_000 });
    const runs: string[] = [];
    queue.schedule('a', async () => {
      runs.push('a');
    });
    queue.schedule('b', async () => {
      runs.push('b');
    });

    await queue.flush();

    expect(runs).toEqual(['a', 'b']);
    expect(queue.pendingKeys()).toEqual([]);
  });

  it('un cambio durante la ejecución de su clave se vuelve a enviar después', async () => {
    const queue = createSyncQueue({ delayMs: 0 });
    let value = 1;
    const sent: number[] = [];
    const task = async () => {
      const snapshot = value; // la tarea lee el valor al ejecutarse
      await sleep(10);
      sent.push(snapshot);
    };

    queue.schedule('p1', task);
    await sleep(2); // ya corriendo con value = 1
    value = 2;
    queue.schedule('p1', task);
    await queue.flush();

    expect(sent).toEqual([1, 2]);
  });

  it('cancel descarta lo pendiente de las claves indicadas', async () => {
    const queue = createSyncQueue({ delayMs: 10_000 });
    const runs: string[] = [];
    queue.schedule('s1|a', async () => {
      runs.push('a');
    });
    queue.schedule('s2|b', async () => {
      runs.push('b');
    });

    queue.cancel((key) => key.startsWith('s1|'));
    await queue.flush();

    expect(runs).toEqual(['b']);
  });

  it('una tarea que lanza no detiene la cola', async () => {
    const queue = createSyncQueue({ delayMs: 0 });
    const runs: string[] = [];
    queue.schedule('a', async () => {
      throw new Error('boom');
    });
    queue.schedule('b', async () => {
      runs.push('b');
    });

    await queue.flush();

    expect(runs).toEqual(['b']);
  });

  it('notifica actividad al empezar y al quedar vacía', async () => {
    const queue = createSyncQueue({ delayMs: 0 });
    const events: boolean[] = [];
    queue.onActivityChange((busy) => events.push(busy));

    queue.schedule('a', async () => {});
    await queue.flush();

    expect(events).toEqual([true, false]);
  });

  it('al notificar "ocupada", isIdle() ya es false', () => {
    const queue = createSyncQueue({ delayMs: 50 });
    let idleSeenByListener: boolean | null = null;
    queue.onActivityChange((busy) => {
      if (busy) idleSeenByListener = queue.isIdle();
    });

    queue.schedule('a', async () => {});

    expect(idleSeenByListener).toBe(false);
    queue.cancel(() => true);
  });
});
