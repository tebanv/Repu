import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Guard optimista de rutas autenticadas (docs/PLAN-PEDIDOS.md §2.1).
 *
 * Solo comprueba que exista la cookie de sesión de `ms-auth`; no la valida ni
 * llama al backend. La guía de Next (authentication → "Optimistic checks with
 * Proxy") pide evitar consultas en `proxy` porque corre en cada navegación,
 * incluidos los prefetch.
 *
 * Qué aporta: sin cookie, el navegador recibe un redirect antes de descargar e
 * hidratar la página (adiós al *flash* del guard de cliente).
 * Qué NO hace: autorizar. Una cookie vencida pasa este filtro; la fuente real
 * sigue siendo `MainLayoutShell` + `authStore.initialize()` (perfil de
 * `ms-users`) y cada microservicio valida la sesión por su cuenta.
 */

/**
 * Nombres que emite `ms-auth` (docs/AUTHENTICATION.md §4):
 * - `__Host-repu_session`: producción (HTTPS).
 * - `repu_session_dev`: perfiles `local`/`dev` sobre HTTP.
 */
export const SESSION_COOKIE_NAMES = ['__Host-repu_session', 'repu_session_dev'] as const;

export function hasSessionCookie(request: NextRequest): boolean {
  return SESSION_COOKIE_NAMES.some((name) => Boolean(request.cookies.get(name)?.value));
}

export function proxy(request: NextRequest) {
  if (hasSessionCookie(request)) {
    return NextResponse.next();
  }
  return NextResponse.redirect(new URL('/login', request.url));
}

export const config = {
  /*
   * Lista positiva de las rutas del grupo `(main)`. Así `proxy` no corre en
   * `/login`, en los assets ni en los rewrites `/ms-*` hacia el backend.
   * Debe ser constante (Next la analiza en build). Al crear una ruta
   * autenticada nueva, agregarla aquí.
   */
  matcher: ['/', '/store/:path*', '/checkout', '/order/:path*'],
};
