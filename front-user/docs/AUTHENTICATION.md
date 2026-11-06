# Autenticación y sesiones

Documento dueño de todo lo relacionado con sesión: contrato de `ms-auth`, cookie, roles, implementación del front y pendientes. La decisión está en [ADR-002](./ADR-002-BACKEND-MICROSERVICES.md); la topología, en [BACKEND.md](./BACKEND.md).

**Estado:** el front usa `ms-auth` y `ms-users` y no importa Supabase para auth. Se verificó en un entorno de pruebas (2026-10-28) y en el servidor desplegado (2026-10-31), por HTTP y con la cookie de desarrollo.

## 1. Principios

- `ms-auth` es la única autoridad de sesión; `ms-users` es la fuente del perfil.
- La credencial del navegador es una cookie `HttpOnly`. El `accessToken` del body se ignora: nunca se lee ni se guarda en `localStorage`, `sessionStorage`, URLs o logs.
- `auth-storage` es solo caché de UI (`user` + `isAuthenticated`).
- La UI y el store no conocen `fetch` ni cookies; todo pasa por `src/services/`.
- El navegador usa rutas relativas: Traefik en producción y `rewrites` de Next en desarrollo.

## 2. Arquitectura

```text
LoginForm ─► authStore ─► authService ─► httpClient ─► POST /ms-auth/api/auth/login
                              │                              │ 200 + Set-Cookie
                              │                              ▼
                              │                        GET /ms-users/api/users/profile
                              ▼                              │
                     User { id, name, email, role, avatar } ◄┘
```

## 3. Contrato del backend

| Método | Ruta | Acceso | Respuesta |
|---|---|---|---|
| `POST` | `/ms-auth/api/auth/login` | Público | `200 { authenticated, userId, role, activeCompanyId, accessToken, expiresInSeconds }` + `Set-Cookie`. Cualquier fallo → `401 { message }` |
| `POST` | `/ms-auth/api/auth/register` | Público | `201 { id, name, email, role, status, createdAt }`; `400` validación; `500` interno. **No crea sesión** |
| `POST` | `/ms-auth/api/auth/logout` | Sesión | `204` + cookie expirada. Sin sesión válida → `401` y no limpia la cookie |
| `POST` | `/ms-auth/api/auth/logout-all` | Sesión | `204`; revoca todas las sesiones del usuario |
| `GET` | `/ms-auth/api/auth/sessions` | Sesión | Sesiones activas (`sessionId`, `deviceInfo`, `ipAddress`, `lastAccess`, `expiresAt`) |
| `GET` | `/ms-auth/api/auth/session` | Servicio + sesión | Introspección con `X-Auth-Service-Token`. **El front nunca la llama** |
| `GET`, `POST` | `/ms-auth/api/system/parameters`, `GET /key/{key}` | Sesión | Parámetros del sistema |
| `GET` | `/ms-users/api/users/profile` | Sesión | `{ id, email, role, firstName, lastName, phone, profileAttributes }`; `401` sin sesión |
| `POST` | `/ms-users/api/users/password-recovery` | Público | `202 { message }` genérico |
| `POST` | `/ms-users/api/users/password-reset` | Público | `204`; body `{ email, code, newPassword }` |

Detalles:

- El login no devuelve nombre ni email; por eso se pide el perfil después.
- `activeCompanyId` hoy se emite `null`.
- Body de registro: `{ firstName, lastName, email, password, phone, role, profileAttributes? }`.
- Contraseña: mínimo 8 caracteres, con mayúscula, minúscula, número y especial (`@#$%^&+-;:=*.!`).

## 4. Sesión y cookie

| Aspecto | Valor |
|---|---|
| Token | Opaco de 128 hex; el servidor guarda su SHA-256 (ver [DATA_MODEL.md](./DATA_MODEL.md) §3) |
| TTL | 8 h para `ADMIN`/`ANALISTA`; 7 días para el resto |
| Renovación | Deslizante en servidor con menos de 30 min restantes. No hay endpoint de refresh y la cookie no extiende su `Max-Age` |
| Cookie en producción | `__Host-repu_session`: `HttpOnly; Secure; SameSite=Lax; Path=/` |
| Cookie en desarrollo HTTP | `repu_session_dev`, con `SESSION_COOKIE_SECURE=false`, `SESSION_COOKIE_ALLOW_INSECURE_HTTP=true` y perfil `local`/`dev` en **todos** los servicios |

`SessionCookieSettings` impide arrancar con cookies inseguras fuera de `local`/`dev` y prohíbe `__Host-` sin `Secure`.

> **Bloqueante de producción:** sin HTTPS, el navegador descarta la cookie `Secure`: el login responde `200` pero no queda sesión.

`Set-Cookie` no es legible desde JavaScript. Para verificarla, usar DevTools → Cookies o `curl -i`.

## 5. Roles

| Backend | Front (`UserRole`) | Autorregistro |
|---|---|---|
| `COMPRADOR` | `comprador` | Sí (por defecto) |
| `DISTRIBUIDOR` | `distribuidor` | Sí |
| `DOMICILIARIO` | `domiciliario` | Sí |
| `ANALISTA` | `analista` | No |
| `ADMIN` | `admin` | No |

`authService` mapea con una tabla explícita. Un rol desconocido degrada a `comprador`, con `console.warn` fuera de producción. `'demo'` no es un rol.

## 6. Implementación del front

**`httpClient.ts`:** `fetch` relativo con `credentials: 'include'`, `cache: 'no-store'` y `X-Request-ID` (UUID v4; el llamador puede fijarlo con `requestId` cuando el backend lo usa como clave de idempotencia). Lanza `HttpError` con `status`, el `message` o `error` del body y, si viene, su `code`. Un `401` notifica a `onUnauthorized`, salvo con `skipUnauthorizedNotification` (login, registro y recuperación).

**`authService.ts`**

| Export | Comportamiento |
|---|---|
| `login(email, password)` | Login + perfil → `User`. `401` → "Credenciales inválidas"; `400` → mensaje del backend; otro error → "Servicio no disponible" |
| `logout()` | `POST logout` y notifica a otras pestañas aunque falle |
| `getCurrentUser()` | Perfil → `User`; `401` → `null`; otros errores se propagan |
| `verifyToken()` | `Boolean(await getCurrentUser())`; el argumento legacy se ignora |
| `register(userData)` | Valida rol de autorregistro y crea la cuenta; no inicia sesión |
| `requestPasswordReset(email)` | `POST password-recovery` |
| `subscribeToAuthChanges(listener)` | Ver §7, multi-tab |

`register` y `requestPasswordReset` aún no tienen pantalla.

**`authStore.ts`:** acciones `login`, `logout`, `clearError`, `setHasHydrated` e `initialize`. `initialize()` es idempotente y revalida contra el perfil. Cualquier error, incluido uno de red, deja al usuario como no autenticado.

**`src/proxy.ts`:** guard optimista. En `/`, `/store/*`, `/checkout` y `/order/*`, si no existe la cookie `__Host-repu_session` ni `repu_session_dev`, responde `307 → /login` antes de renderizar. No valida la cookie ni llama al backend (guía de Next: en `proxy` solo se leen cookies). Una ruta autenticada nueva debe agregarse a su `matcher`.

**`MainLayoutShell.tsx`:** guard de cliente y fuente real de la sesión. Espera `hasHydrated` y `!isLoading`; sin sesión válida (cookie vencida o revocada), redirige a `/login`.

## 7. Flujos

**Login:** `LoginForm` valida y llama a `authStore.login()`. La cookie queda guardada por el navegador, el perfil construye el `User` (`name = firstName + lastName`, o el email si faltan) y se navega a `/`.

**Logout:** `AppHeader` llama a `authStore.logout()` y navega a `/login`. El estado local se limpia aunque falle la red.

**Restauración y expiración**
1. `authStore` rehidrata `auth-storage`, que puede estar desactualizado.
2. `initialize()` consulta el perfil y corrige el estado.
3. Cualquier `401` de un endpoint autenticado emite `unauthorized`: el store limpia y el guard redirige.

**Multi-tab** (`subscribeToAuthChanges`, sin polling)
- `BroadcastChannel('repu-auth')`: `logout` y `unauthorized` limpian; `login` revalida.
- `visibilitychange`: revalida al volver a la pestaña, como máximo una vez por minuto.
- Evento `storage` sobre `auth-storage`: revalida.

Riesgo conocido: en las revalidaciones por `visibilitychange`, `storage` y `login`, un error transitorio de red también deja al usuario como no autenticado.

## 8. Entornos

- **Desarrollo:** `next.config.js` define `rewrites` hacia `AUTH_API_ORIGIN` y `USERS_API_ORIGIN`, solo fuera de producción. Front y APIs deben compartir host, porque `SameSite=Lax` no envía la cookie de `localhost` a una IP distinta. Safari no acepta `Secure` en HTTP: usar la cookie de desarrollo.
- **Producción:** Traefik sirve todo en el mismo host con HTTPS y `__Host-repu_session`. CORS solo si se rompe el same-origin, con orígenes exactos; nunca `*` con credenciales.

## 9. Pendientes

- [ ] **Chips demo de `LoginForm`:** apuntan a seeds de Supabase que no existen en `repu.usuarios`, así que hoy no funcionan. Decidir entre usuarios reales o retirarlos; requiere aprobación porque cambia la UI.
- [ ] **HTTPS en Traefik** y validación con `__Host-repu_session`.
- [ ] **QA manual:** borrar la cookie a mano → `/login`; `ANALISTA` → `analista` en UI; usuario inactivo → `401`.
- [ ] **Limpieza:** eliminar el usuario de prueba creado en el servidor (`prueba.auth.01@repu.test`).

Lo que debe resolver el backend está en [BACKEND.md](./BACKEND.md) §7; la cobertura de pruebas, en [TESTING.md](./TESTING.md).
