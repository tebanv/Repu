import { afterEach, describe, expect, it, vi } from 'vitest';
import { track } from '../analytics';

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe('track', () => {
  it('fuera de development es no-op silencioso', () => {
    vi.stubEnv('NODE_ENV', 'test');
    const debug = vi.spyOn(console, 'debug').mockImplementation(() => undefined);

    expect(() => track('cart_expired', { reason: 'ttl_exceeded' })).not.toThrow();
    expect(debug).not.toHaveBeenCalled();
  });

  it('en development emite log controlado', () => {
    vi.stubEnv('NODE_ENV', 'development');
    const debug = vi.spyOn(console, 'debug').mockImplementation(() => undefined);

    track('cart_expired', { reason: 'missing_timestamp' });
    expect(debug).toHaveBeenCalledTimes(1);
    expect(debug).toHaveBeenCalledWith(
      '[analytics] cart_expired',
      { reason: 'missing_timestamp' }
    );
  });
});
