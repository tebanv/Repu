/**
 * Transporte HTTP único del front para el backend Spring.
 *
 * Reglas:
 * - Rutas relativas (`/ms-auth/...`, `/ms-users/...`) para aprovechar el
 *   same-origin de Traefik en producción y los `rewrites` de Next en dev.
 * - `credentials: 'include'`: la sesión viaja en la cookie HttpOnly, nunca
 *   en un token leído por JavaScript.
 * - `X-Request-ID` (UUID v4) en cada solicitud para trazabilidad del backend.
 *   El llamador puede fijarlo con `requestId`: el checkout de `ms-orders` lo
 *   usa como clave de idempotencia, así que un reintento debe reutilizarlo
 *   (docs/PLAN-PEDIDOS.md §2.4).
 * - Los 401 de endpoints autenticados notifican a `onUnauthorized`; el store
 *   limpia la sesión y el guard redirige. Login/registro pueden optar por no
 *   notificar (un 401 ahí es credencial inválida, no una sesión vencida).
 */

export type HttpMethod = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';

export interface RequestOptions {
  method?: HttpMethod;
  body?: unknown;
  headers?: HeadersInit;
  signal?: AbortSignal;
  /** Evita el evento global de sesión vencida en endpoints públicos (login/registro). */
  skipUnauthorizedNotification?: boolean;
  /**
   * `X-Request-ID` explícito (UUID). Si se omite, se genera uno nuevo por
   * solicitud. Usarlo solo cuando el backend lo trate como clave de
   * idempotencia y el reintento deba enviarse con el mismo valor.
   */
  requestId?: string;
}

export class HttpError extends Error {
  readonly status: number;
  readonly payload?: unknown;
  /**
   * Código de negocio del backend (`{ code, message }`), p. ej.
   * `INSUFFICIENT_STOCK`. Permite decidir sin depender del texto del mensaje.
   */
  readonly code?: string;

  constructor(status: number, message: string, payload?: unknown, code?: string) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    this.payload = payload;
    this.code = code;
  }
}

type UnauthorizedListener = () => void;
const unauthorizedListeners = new Set<UnauthorizedListener>();

/** Suscribe un listener al evento global de 401 en endpoints autenticados. */
export function onUnauthorized(listener: UnauthorizedListener): () => void {
  unauthorizedListeners.add(listener);
  return () => {
    unauthorizedListeners.delete(listener);
  };
}

function notifyUnauthorized(): void {
  for (const listener of unauthorizedListeners) {
    try {
      listener();
    } catch {
      // Un listener defectuoso no debe romper el resto de la app.
    }
  }
}

/**
 * UUID v4. `ms-orders` rechaza con 400 un `X-Request-ID` que no sea UUID,
 * así que el respaldo (navegadores sin `randomUUID`, p. ej. contextos HTTP no
 * seguros) también debe producir un UUID válido.
 */
export function createRequestId(): string {
  const cryptoApi = globalThis.crypto;
  if (typeof cryptoApi?.randomUUID === 'function') {
    return cryptoApi.randomUUID();
  }

  const bytes = new Uint8Array(16);
  if (typeof cryptoApi?.getRandomValues === 'function') {
    cryptoApi.getRandomValues(bytes);
  } else {
    for (let i = 0; i < bytes.length; i += 1) bytes[i] = Math.floor(Math.random() * 256);
  }
  // Bits de versión (4) y variante (10xx) según RFC 9562.
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;

  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function extractCode(payload: unknown): string | undefined {
  if (payload && typeof payload === 'object') {
    const code = (payload as Record<string, unknown>).code;
    if (typeof code === 'string' && code.trim()) return code;
  }
  return undefined;
}

function extractMessage(payload: unknown, fallback: string): string {
  if (payload && typeof payload === 'object') {
    const record = payload as Record<string, unknown>;
    if (typeof record.message === 'string' && record.message.trim()) {
      return record.message;
    }
    if (typeof record.error === 'string' && record.error.trim()) {
      return record.error;
    }
  }
  return fallback;
}

async function parseResponseBody(response: Response): Promise<unknown> {
  if (response.status === 204) return undefined;

  const contentType = response.headers.get('content-type') ?? '';
  const isJson = contentType.includes('application/json');

  if (isJson) {
    try {
      return await response.json();
    } catch {
      return undefined;
    }
  }

  try {
    const text = await response.text();
    return text || undefined;
  } catch {
    return undefined;
  }
}

/**
 * Ejecuta una solicitud y devuelve el body parseado.
 * - 204/202 sin JSON → `undefined`.
 * - 4xx/5xx → `HttpError` con `status`, `message` y `payload`.
 */
export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const method = options.method ?? 'GET';
  const headers = new Headers(options.headers);
  headers.set('X-Request-ID', options.requestId ?? createRequestId());

  let body: BodyInit | undefined;
  if (options.body !== undefined) {
    if (!headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json');
    }
    body = JSON.stringify(options.body);
  }

  const response = await fetch(path, {
    method,
    headers,
    body,
    credentials: 'include',
    signal: options.signal,
    cache: 'no-store',
  });

  const payload = await parseResponseBody(response);

  if (!response.ok) {
    if (response.status === 401 && !options.skipUnauthorizedNotification) {
      notifyUnauthorized();
    }
    const message = extractMessage(payload, `Error HTTP ${response.status}`);
    throw new HttpError(response.status, message, payload, extractCode(payload));
  }

  return payload as T;
}

export const httpClient = {
  get: <T>(path: string, options?: Omit<RequestOptions, 'method' | 'body'>) =>
    request<T>(path, { ...options, method: 'GET' }),

  post: <T>(path: string, body?: unknown, options?: Omit<RequestOptions, 'method' | 'body'>) =>
    request<T>(path, { ...options, method: 'POST', body }),

  put: <T>(path: string, body?: unknown, options?: Omit<RequestOptions, 'method' | 'body'>) =>
    request<T>(path, { ...options, method: 'PUT', body }),

  patch: <T>(path: string, body?: unknown, options?: Omit<RequestOptions, 'method' | 'body'>) =>
    request<T>(path, { ...options, method: 'PATCH', body }),

  delete: <T>(path: string, options?: Omit<RequestOptions, 'method' | 'body'>) =>
    request<T>(path, { ...options, method: 'DELETE' }),
};
