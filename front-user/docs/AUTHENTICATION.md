# Autenticación y sesiones — `front-user` ↔ `ms-auth` / `ms-users`

Documento normativo del sistema de autenticación del cliente. Describe el contrato real del backend Spring y la implementación del front. El front ya usa `ms-auth`/`ms-users` para login y perfil; el smoke se verificó en un entorno de pruebas con contenedores reales y queda pendiente repetirlo en el servidor desplegado. La limpieza de los chips demo sigue pendiente. `authService` ya no importa Supabase.

- **Backend revisado:** `Backend/ms-auth`, `Backend/ms-users` (contrato leído del código y Postman; smoke verificado contra contenedores reales, 2026-10-28; servidor pendiente)
- **Plan de ejecución:** [PLAN-LOGIN-MS-AUTH.md](./PLAN-LOGIN-MS-AUTH.md)
- **Referencia operativa:** [BACKEND.md](./BACKEND.md)

## 1. Estado actual

| Pieza | Estado |
|---|---|
| `ms-auth` (login, registro, logout, sesiones) | **Implementado en el backend**; smoke verificado en entorno de pruebas; servidor pendiente |
| `ms-users` (perfil, direcciones, recuperación) | **Implementado en el backend**; smoke verificado en entorno de pruebas; servidor pendiente |
| Cookie `__Host-repu_session` | Implementada; requiere HTTPS en producción |
| `authService.ts` del front | **Migrado a `ms-auth`/`ms-users`** mediante `httpClient`; smoke verificado en entorno de pruebas; servidor pendiente |
| `authStore` / `MainLayoutShell` | Contrato reutilizado; conectado a `ms-auth` sin cambios funcionales |
| Migración de login | **Implementada y verificada en entorno de pruebas**; servidor pendiente |
| Supabase Auth | **Sin uso en auth**; el paquete se retira cuando también se corte el catálogo |

> El código de auth ya apunta al backend Spring y el flujo se verificó contra contenedores reales. Lo que falta es repetir el smoke en el servidor desplegado, reemplazar los chips demo y completar el QA de UI/multi-tab. El catálogo todavía usa Supabase hasta su corte.

## 2. Arquitectura

```text
LoginForm
   │ login(email, password)
   ▼
authStore (Zustand + persist `auth-storage`)
   │
   ▼
authService ──► httpClient ──► POST /ms-auth/api/auth/login
   │                              │ 200 + Set-Cookie HttpOnly
   │                              ▼
   │                         GET /ms-users/api/users/profile
   │                              │ { id,email,role,firstName,lastName,phone,profileAttributes }
   ▼                              ▼
User { id, name, email, role, avatar } + isAuthenticated
```

- **Zero-Coupling:** la UI y el store no conocen `fetch`, cookies ni microservicios. Todo pasa por `src/services/`.
- **Fuente de verdad:** la sesión del servidor. `auth-storage` es solo caché de UI (`user` + `isAuthenticated`), revalidada al montar.
- **Same-origin:** el navegador llama rutas relativas (`/ms-auth/...`, `/ms-users/...`). En producción Traefik enruta; en desarrollo lo hacen los `rewrites` de Next.js.
- **Sin token en JavaScript:** la cookie `httpOnly` viaja automáticamente. El `accessToken` del body se ignora en web.

## 3. Contrato del backend

### 3.1 Login

`POST /ms-auth/api/auth/login` (público)

```json
{ "email": "user@example.com", "password": "P@ssw0rd2026!" }
```

`200`:

```json
{
  "authenticated": true,
  "userId": "uuid",
  "role": "COMPRADOR",
  "activeCompanyId": null,
  "accessToken": "<token opaco>",
  "expiresInSeconds": 604800
}
```

Además: `Set-Cookie: __Host-repu_session=<token>; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=...`.

- Cualquier fallo (credenciales, usuario inactivo, Redis/DB) → `401 { "message": "..." }`. No se distingue por texto.
- `activeCompanyId` está en el contrato pero hoy se emite `null`.
- El login **no devuelve** `firstName`, `lastName` ni `email`; hay que pedir el perfil.

### 3.2 Perfil

`GET /ms-users/api/users/profile` (cookie/Bearer)

```json
{
  "id": "uuid",
  "email": "user@example.com",
  "role": "COMPRADOR",
  "firstName": "Esteban",
  "lastName": "Velez",
  "phone": "+573100000000",
  "profileAttributes": {}
}
```

`401` si no hay sesión válida. Es la fuente para `getCurrentUser()` y `initialize()`.

### 3.3 Logout

`POST /ms-auth/api/auth/logout` (sesión)

- `204` + cookie expirada.
- Sin sesión válida → `401` y **no** limpia la cookie; el front debe limpiar su estado local igualmente.
- Revoca la sesión actual en PostgreSQL y Redis.

`POST /ms-auth/api/auth/logout-all` revoca todas las sesiones del usuario.

### 3.4 Sesiones

`GET /ms-auth/api/auth/sessions` (sesión) devuelve las sesiones activas: `sessionId`, `deviceInfo`, `ipAddress`, `lastAccess`, `expiresAt`.

`GET /ms-auth/api/auth/session` **no es para el navegador**: exige `X-Auth-Service-Token` y la credencial del usuario. Es introspección servicio-a-servicio y responde `{ userId, role }`. El front nunca lo llama.

### 3.5 Registro

`POST /ms-auth/api/auth/register` (público)

```json
{
  "firstName": "Esteban",
  "lastName": "Velez",
  "email": "user@example.com",
  "password": "P@ssw0rd2026!",
  "phone": "+573100000000",
  "role": "COMPRADOR",
  "profileAttributes": {}
}
```

- `201` con `{ id, name, email, role, status, createdAt }`.
- Roles de autorregistro: `COMPRADOR`, `DISTRIBUIDOR`, `DOMICILIARIO`.
- Contraseña: mínimo 8 caracteres, una mayúscula, una minúscula, un número y un especial (`@#$%^&+-;:=*.!`).
- **No emite cookie ni sesión.** El flujo debe hacer login después o pedir al usuario que inicie sesión.
- `400` para correo ya registrado, rol no permitido o contraseña débil; `500` para fallos internos.

### 3.6 Recuperación de contraseña

- `POST /ms-users/api/users/password-recovery` (público) → `202 { message }` genérico.
- `POST /ms-users/api/users/password-reset` (público) → `204`; body `{ email, code, newPassword }`.
- La UI de recuperación/reset aún no existe en el front. El servicio actual solo solicita el correo.

## 4. Sesión, cookie y expiración

| Aspecto | Valor |
|---|---|
| Token | Opaco, 128 hex; el servidor guarda SHA-256 |
| Persistencia | `sesiones_usuario` (PostgreSQL) + referencia en Redis |
| TTL | 8 h `ADMIN`/`ANALISTA`; 7 días resto |
| Renovación | Deslizante en servidor cuando quedan < 30 min; **sin refresh endpoint** |
| Cookie prod | `__Host-repu_session`, `HttpOnly; Secure; SameSite=Lax; Path=/` |
| Cookie dev HTTP | `repu_session_dev`; `SESSION_COOKIE_SECURE=false`, `SESSION_COOKIE_ALLOW_INSECURE_HTTP=true`, perfil `local`/`dev` |
| Logout | `204` + cookie expirada; el estado local se limpia siempre |
| Expiración | El primer request autenticado devuelve `401`; el front limpia sesión y redirige |

> **Bloqueante de producción:** Traefik del compose solo expone HTTP. Sin TLS, el navegador descarta la cookie `Secure` y el login “funciona” sin sesión persistente. La única salida es HTTPS (dominio + certificado) o aceptar que producción no tenga login estable.

## 5. Roles

| Backend | Front (`UserRole`) | Notas |
|---|---|---|
| `COMPRADOR` | `comprador` | Rol por defecto del autorregistro |
| `DISTRIBUIDOR` | `distribuidor` | Dueño de tienda |
| `DOMICILIARIO` | `domiciliario` | Repartidor |
| `ANALISTA` | `analista` | Implementado en `src/types/auth.ts` |
| `ADMIN` | `admin` | Gestión |

- El mapeo es `role.toLowerCase()` con una tabla explícita; un rol desconocido degrada a `comprador` y emite `console.warn` en desarrollo.
- `'demo'` no es un rol; los chips del login son solo un atajo de credenciales.
- `ANALISTA` no existe en el backend de Supabase antiguo; no se migra Supabase, se añade al front.

## 6. Diseño objetivo del front

### 6.1 `src/services/httpClient.ts` (implementado)

- `fetch` relativo, `credentials: 'include'`.
- `X-Request-ID` con `crypto.randomUUID()`.
- Parseo de `{ message }` / `{ error }` según endpoint.
- Errores tipados por status (`401`, `400`, `5xx`, red).
- Emisor `onUnauthorized` para que `authService`/`authStore` limpien la sesión ante cualquier 401.
- Sin lógica de negocio ni imports de SDKs.

### 6.2 `src/services/authService.ts` (migrado)

Mantiene las mismas siete exportaciones públicas; cambia la implementación:

| Export | Comportamiento objetivo |
|---|---|
| `login(email, password)` | `POST login` → `GET profile` → `User`; 401 → “Credenciales inválidas”; red/5xx → “Servicio no disponible” |
| `logout()` | `POST logout`; limpia local aunque falle |
| `verifyToken()` | `Boolean(await getCurrentUser())`; el argumento legacy se ignora |
| `getCurrentUser()` | `GET profile`; 401 → `null` |
| `register(userData)` | `POST register`; devuelve `User`; no hay sesión hasta login |
| `requestPasswordReset(email)` | `POST /ms-users/api/users/password-recovery`; mensaje genérico |
| `subscribeToAuthChanges(listener)` | `BroadcastChannel('repu-auth')` + `onUnauthorized` + `visibilitychange`; entrega `User | null` |

### 6.3 `src/store/authStore.ts`

- Estado: `user`, `isAuthenticated`, `isLoading`, `error`, `hasHydrated`.
- Acciones: `login`, `logout`, `clearError`, `setHasHydrated`, `initialize`.
- `persist` key `auth-storage`; `partialize` solo `user` + `isAuthenticated`; **nunca el token**.
- `initialize()` idempotente: revalida contra el perfil; sin sesión descarta el estado local rancio.
- `logout()` async: limpia `user`/`isAuthenticated` aunque la red falle; la key `auth-storage` permanece.
- El listener de `subscribeToAuthChanges` con `null` también pone `isLoading=false`.

### 6.4 `MainLayoutShell` y `LoginForm`

- `MainLayoutShell` espera `hasHydrated + !isLoading`; si `!isAuthenticated`, `router.push('/login')`. Ya reacciona a `401` y logout multi-tab; no requiere cambio funcional.
- `LoginForm`: mismas fases `idle/loading/success`, validación, CapsLock, toggle de password y shake de error. **No cambiar estilos sin aprobación.**
- Los chips “Acceso demo” deben apuntar a usuarios reales de la BD Spring o retirarse; los seeds de Supabase no existen en `repu.usuarios`.

## 7. Flujos

### Login

1. `LoginForm` valida email/password y llama `authStore.login()`.
2. `authService.login()` → `POST /ms-auth/api/auth/login` con `credentials: 'include'`.
3. La cookie se guarda sola; el front ignora `accessToken`.
4. `GET /ms-users/api/users/profile` construye `User` (`name = firstName + lastName`).
5. El store persiste `user` + `isAuthenticated` y navega a `/`.

### Logout

1. `AppHeader` llama `authStore.logout()` + `router.push('/login')`.
2. `POST /ms-auth/api/auth/logout`; si falla, el estado local se limpia igual.
3. `BroadcastChannel` notifica a otras pestañas; el guard redirige.

### Restauración / expiración

1. Al montar, `authStore` rehidrata `auth-storage` (puede estar rancio).
2. `initialize()` llama `getCurrentUser()`; sin sesión → `null` y limpieza.
3. `MainLayoutShell` espera `hasHydrated + !isLoading` antes de decidir.
4. Cualquier `401` de un endpoint autenticado emite `unauthorized`; el store limpia y el guard redirige.
5. Al volver a la pestaña (`visibilitychange`), se revalida el perfil como máximo cada 60 s. Sin polling.

### Multi-tab

- La cookie es compartida por el navegador.
- `BroadcastChannel('repu-auth')` sincroniza `login`/`logout`/`unauthorized`.
- Fallback: evento `storage` sobre `auth-storage` si no hay `BroadcastChannel`.

## 8. Entornos

### Desarrollo

- Front `pnpm dev` en `:3000`.
- `next.config.js` con `rewrites` solo fuera de producción:

```js
async rewrites() {
  if (process.env.NODE_ENV === 'production') return [];
  return [
    { source: '/ms-auth/:path*', destination: `${process.env.AUTH_API_ORIGIN}/ms-auth/:path*` },
    { source: '/ms-users/:path*', destination: `${process.env.USERS_API_ORIGIN}/ms-users/:path*` },
  ];
}
```

- Variables de servidor (no `NEXT_PUBLIC_*`): `AUTH_API_ORIGIN`, `USERS_API_ORIGIN`.
- Para probar con cookie en navegador, front y APIs deben compartir host; `SameSite=Lax` no envía la cookie de `localhost` a una IP distinta.
- Safari no acepta `Secure` en HTTP: usar perfil `dev` con `SESSION_COOKIE_NAME=repu_session_dev`, `SESSION_COOKIE_SECURE=false`, `SESSION_COOKIE_ALLOW_INSECURE_HTTP=true` en todos los micros a la vez.

### Producción

- Traefik sirve front y micros en el mismo host (`/`, `/ms-auth`, `/ms-users`, …).
- HTTPS obligatorio; cookie `__Host-repu_session`.
- CORS solo si se rompe el same-origin; orígenes exactos con `credentials: 'include'`. Nunca `*` con credenciales.

## 9. Testing

La suite se ejecutó el **2026-10-28**: **68/68 tests en 8 archivos** (61 previos − 12 de auth Supabase + 11 de auth Spring + 8 de `httpClient`), con `pnpm type-check` sin errores y `pnpm build` correcto. El smoke de API se verificó contra contenedores reales; el QA de UI/multi-tab y el smoke en el servidor desplegado siguen pendientes.

- **`httpClient.test.ts` (nuevo):** 200, 401, 5xx, 204, `{message}`/`{error}`, `X-Request-ID`, `credentials: include`, `skipUnauthorizedNotification`, error de red.
- **`authService.test.ts` (reescrito):** login+profile, 401, logout, perfil `null`, `ANALISTA`/rol desconocido, registro sin sesión, recuperación y `unauthorized`.
- **`authStore.test.ts`:** se conserva; solo cambian comentarios/nombres, no las aserciones públicas.
- **API verificada en entorno de pruebas:** registro `201`, login correcto `200` + cookie, login incorrecto `401`, perfil `200`, logout `204` y perfil posterior `401`.
- **Manual pendiente:** login OK/KO en UI, recarga conserva sesión, logout limpia cookie, dos pestañas propagan logout, borrar cookie a mano → `/login`, `ANALISTA` se ve como `analista`, `accessToken` no aparece en `localStorage`.
- **Servidor pendiente:** repetir el smoke de login/perfil/logout contra el despliegue real.

## 10. Checklist de migración

- [x] Verificar login → profile → logout → 401 contra una instancia real (hecho con `curl` en entorno de pruebas; servidor pendiente).
- [x] `rewrites` + `.env.example` (`AUTH_API_ORIGIN`, `USERS_API_ORIGIN`).
- [x] `httpClient.ts` + tests escritos y ejecutados.
- [x] `UserRole` con `analista` + mapeo de roles.
- [x] `authService.ts` contra Spring; sin imports de Supabase.
- [x] `authStore`/`MainLayoutShell` sin cambios de contrato; comentarios actualizados.
- [ ] `LoginForm` con usuarios reales o chips retirados.
- [x] Tests de servicio/transporte reescritos y ejecutados (68/68; `type-check` y `build` correctos).
- [x] Docs y CHANGELOG actualizados.
- [x] `supabaseClient.ts` se conserva solo para catálogo hasta su corte.
- [ ] HTTPS en producción antes de declarar auth listo.
- [ ] Repetir el smoke de auth en el servidor desplegado.

## 11. Legado Supabase

El código anterior usaba `supabase-js` (`signInWithPassword`, `signUp`, `resetPasswordForEmail`, `onAuthStateChange`) y `profiles` con roles en minúsculas. Ese código **ya no está en `authService.ts`**. Se conserva como referencia histórica en:

- `docs/legacy/DATA_MODEL-SUPABASE.md`
- `docs/PLAN-LOGIN-MS-AUTH.md` §0 (contrato comparado)

No se añaden features nuevas sobre Supabase Auth. El paquete `@supabase/supabase-js` y `supabaseClient.ts` permanecen **solo** para el catálogo (`api.ts`) hasta su corte.

## 12. Seguridad

- Nunca guardar el token en `localStorage`, `sessionStorage`, URLs ni logs.
- Nunca leer `accessToken` en web; la cookie `httpOnly` es la credencial.
- No filtrar si un email existe (anti-enumeración).
- Errores de login: mapear por status, no por texto.
- HTTPS obligatorio; `Secure` + `__Host-` no se relajan en producción.
- `X-Auth-Service-Token` es secreto de servicio; jamás llega al navegador.
- Rate limit/lockout y refresh son deuda del backend, no del front.
