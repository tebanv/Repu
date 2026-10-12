import { afterEach, describe, expect, it, vi } from 'vitest';
import { enableCrossTabSync } from '../storageSync';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('enableCrossTabSync', () => {
  it('sin window es no-op y no falla (SSR)', () => {
    const rehydrate = vi.fn();
    const cleanup = enableCrossTabSync('k', rehydrate);
    expect(() => cleanup()).not.toThrow();
    expect(rehydrate).not.toHaveBeenCalled();
  });

  it('rehidrata solo ante la key propia o clear()', () => {
    const handlers = new Map<string, (e: StorageEvent) => void>();
    vi.stubGlobal('window', {
      addEventListener: vi.fn((type: string, fn: (e: StorageEvent) => void) => {
        handlers.set(type, fn);
      }),
      removeEventListener: vi.fn(),
    });

    const rehydrate = vi.fn();
    enableCrossTabSync('cart-storage', rehydrate);
    const handler = handlers.get('storage');
    expect(handler).toBeDefined();

    handler?.({ key: 'otra-key' } as StorageEvent);
    expect(rehydrate).not.toHaveBeenCalled();

    handler?.({ key: 'cart-storage' } as StorageEvent);
    expect(rehydrate).toHaveBeenCalledTimes(1);

    handler?.({ key: null } as StorageEvent);
    expect(rehydrate).toHaveBeenCalledTimes(2);
  });

  it('no duplica listeners ante re-evaluación (HMR)', () => {
    const addEventListener = vi.fn();
    vi.stubGlobal('window', {
      addEventListener,
      removeEventListener: vi.fn(),
    });

    const rehydrate = vi.fn();
    enableCrossTabSync('cart-storage', rehydrate);
    enableCrossTabSync('cart-storage', rehydrate);
    expect(addEventListener).toHaveBeenCalledTimes(1);
  });
});
