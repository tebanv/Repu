import { describe, expect, it } from 'vitest';
import { NextRequest } from 'next/server';
// La doc de Next 16 nombra `unstable_doesProxyMatch`, pero este canary solo
// exporta el nombre previo `unstable_doesMiddlewareMatch` (misma función).
import { getRedirectUrl, unstable_doesMiddlewareMatch } from 'next/experimental/testing/server';
import { config, proxy } from '../proxy';

function requestWithCookie(path: string, cookie?: string): NextRequest {
  const headers = new Headers();
  if (cookie) headers.set('cookie', cookie);
  return new NextRequest(`http://localhost:3000${path}`, { headers });
}

describe('proxy — guard optimista por cookie', () => {
  it('redirige a /login sin cookie de sesión', () => {
    const response = proxy(requestWithCookie('/checkout'));
    expect(getRedirectUrl(response)).toBe('http://localhost:3000/login');
  });

  it.each(['__Host-repu_session=abc', 'repu_session_dev=abc'])('deja pasar con %s', (cookie) => {
    const response = proxy(requestWithCookie('/checkout', cookie));
    expect(getRedirectUrl(response)).toBeNull();
  });

  it('una cookie vacía no cuenta como sesión', () => {
    const response = proxy(requestWithCookie('/', 'repu_session_dev='));
    expect(getRedirectUrl(response)).toBe('http://localhost:3000/login');
  });

  it.each([
    ['/', true],
    ['/checkout', true],
    ['/store/baterias-la-42', true],
    ['/order/7f1c2a9e-3b4d-4e5f-8a6b-1c2d3e4f5a6b', true],
    ['/login', false],
    ['/ms-orders/api/orders/checkout', false],
    ['/ms-auth/api/auth/login', false],
    ['/_next/static/chunks/main.js', false],
  ])('matcher %s → %s', (url, expected) => {
    expect(unstable_doesMiddlewareMatch({ config, url })).toBe(expected);
  });
});
