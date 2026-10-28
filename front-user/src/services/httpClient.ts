/**
 * Transporte HTTP único del front para el backend Spring.
 *
 * Reglas:
 * - Rutas relativas (`/ms-auth/...`, `/ms-users/...`) para aprovechar el
 *   same-origin de Traefik en producción y los `rewrites` de Next en dev.
 * - `credentials: 'include'`: la sesión viaja en la cookie HttpOnly, nunca
 *   en un token leído por JavaScript.
 * - `X-Request-ID` en cada solicitud para trazabilidad del backend.
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
}

export class HttpError extends Error {
  readonly status: number;
  readonly payload?: unknown;

  constructor(status: number, message: string, payload?: unknown) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
    this.payload = payload;
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

function createRequestId(): string {
  if (typeof globalThis.crypto?.randomUUID === 'function') {
    return globalThis.crypto.randomUUID();
  }
  return `req-${Date.now()}-${Math.random().toString(16).slice(2)}`;
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
  headers.set('X-Request-ID', createRequestId());

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
    throw new HttpError(response.status, message, payload);
  }

  return payload as T;
}

export const httpClient = {
  get: <T>(path: string, options?: Omit<RequestOptions, 'method' | 'body'>) =>
    request<T>(path, { ...options, method: 'GET' }),

  post: <T>(path: string, body?: unknown, options?: Omit<RequestOptions, 'method' | 'body'>) =>
    request<T>(path, { ...options, method: 'POST', body }),

  patch: <T>(path: string, body?: unknown, options?: Omit<RequestOptions, 'method' | 'body'>) =>
    request<T>(path, { ...options, method: 'PATCH', body }),

  delete: <T>(path: string, options?: Omit<RequestOptions, 'method' | 'body'>) =>
    request<T>(path, { ...options, method: 'DELETE' }),
};
