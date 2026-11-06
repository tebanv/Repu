import { beforeEach, describe, expect, it } from 'vitest';
import { checkoutFingerprint, clearCheckoutAttempt, getCheckoutAttemptKey } from '../checkoutAttempt';
import { formatOrderNumber } from '../orderFormat';

// Clave de idempotencia por intento de compra (docs/PLAN-PEDIDOS.md §2.4).

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

beforeEach(() => {
  sessionStorage.clear();
});

describe('checkoutAttempt', () => {
  it('reutiliza la clave mientras los datos no cambien (reintento sin duplicar)', () => {
    const fingerprint = checkoutFingerprint({ storeId: 's1', addressId: 'a1', customerNotes: 'x' });
    const first = getCheckoutAttemptKey(fingerprint);

    expect(first).toMatch(UUID_V4);
    expect(getCheckoutAttemptKey(fingerprint)).toBe(first);
  });

  it('genera otra clave si cambian dirección o notas', () => {
    const a = getCheckoutAttemptKey(checkoutFingerprint({ storeId: 's1', addressId: 'a1' }));
    const b = getCheckoutAttemptKey(checkoutFingerprint({ storeId: 's1', addressId: 'a2' }));
    expect(b).not.toBe(a);
  });

  it('las notas se normalizan (espacios no cambian la huella)', () => {
    expect(checkoutFingerprint({ storeId: 's1', addressId: 'a1', customerNotes: ' hola ' })).toBe(
      checkoutFingerprint({ storeId: 's1', addressId: 'a1', customerNotes: 'hola' }),
    );
  });

  it('tras limpiar, el siguiente intento usa una clave nueva', () => {
    const fingerprint = checkoutFingerprint({ storeId: 's1', addressId: 'a1' });
    const first = getCheckoutAttemptKey(fingerprint);
    clearCheckoutAttempt();
    expect(getCheckoutAttemptKey(fingerprint)).not.toBe(first);
  });
});

describe('formatOrderNumber', () => {
  it('#número para pedidos reales; id para mocks', () => {
    expect(formatOrderNumber({ id: 'uuid', number: 42 })).toBe('#42');
    expect(formatOrderNumber({ id: 'REP-2026-AB12', number: null })).toBe('REP-2026-AB12');
  });
});
