# Plan — Integración de auth `front-user` ↔ `ms-auth` / `ms-users`

- **Estado:** Implementación de código completa; smoke verificado en entorno de pruebas (2026-10-28); smoke en servidor y chips demo pendientes
- **Base:** [ADR-002](./ADR-002-BACKEND-MICROSERVICES.md) (Decisión, Consecuencias y Plan de corte), [AUTHENTICATION.md](./AUTHENTICATION.md), [BACKEND.md](./BACKEND.md)
- **Contrato:** verificado contra el código de `Backend/ms-auth` + `Backend/ms-users` y `Arq-Infra/Repu.postman_collection.json` (no hay OpenAPI)

## 0. Contrato real del backend

| Pieza | Comportamiento verificado |
|---|---|
| Base path | `/{APPLICATION_NAME}/...`; con `ms-auth`/`ms-users`: `/ms-auth/api/auth/*`, `/ms-users/api/users/*`. En prod Traefik sirve front y micros en el mismo host (same-origin) |
| `POST /ms-auth/api/auth/login` | Body `{email,password}`. `200 {authenticated,userId,role,activeCompanyId,accessToken,expiresInSeconds}` + `Set-Cookie: __Host-repu_session=<opaco>; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age`. Cualquier error → `401 {message}` (credenciales, usuario inactivo, Redis/DB). **No devuelve `name` ni `email`** |
| Token | Opaco de 128 hex; el servidor guarda SHA-256 en `sesiones_usuario` y cachea en Redis. TTL 8 h para `ADMIN`/`ANALISTA`, 7 días resto. Renovación deslizante en servidor cuando quedan < 30 min; **sin refresh endpoint**; la cookie no extiende su `Max-Age` |
| `POST /ms-auth/api/auth/logout` | Requiere sesión (cookie o Bearer). `204` + cookie expirada. Sin sesión válida → `401` y **no** limpia la cookie |
| `POST /ms-auth/api/auth/logout-all` | Requiere sesión. Revoca todas las sesiones del usuario |
| `GET /ms-auth/api/auth/session` | **No es para el navegador**: exige `X-Auth-Service-Token` y la credencial del usuario. Devuelve `{userId,role}`; `403/503` sin token de servicio. Es introspección servicio-a-servicio |
| `GET /ms-auth/api/auth/sessions` | Requiere sesión. Lista sesiones activas (dispositivo, IP, último acceso, expiración) |
| `POST /ms-auth/api/auth/register` | Público. Body `{firstName,lastName,email,password,phone,role,profileAttributes?}`. `201` con usuario; roles `COMPRADOR`/`DISTRIBUIDOR`/`DOMICILIARIO`; password mínimo 8, mayúscula, minúscula, número y especial. **No emite sesión** |
| `GET /ms-users/api/users/profile` | Cookie/Bearer. `200 {id,email,role,firstName,lastName,phone,profileAttributes}`; `401` sin sesión. Es el “me” del front |
| `POST /ms-users/api/users/password-recovery` | Público. `202 {message}` genérico |
| `POST /ms-users/api/users/password-reset` | Público. Body `{email,code,newPassword}`; `204` |
| Roles | MAYÚSCULAS: `COMPRADOR`, `DISTRIBUIDOR`, `DOMICILIARIO`, `ANALISTA`, `ADMIN` |
| Cookie dev | `SessionCookieSettings` prohíbe `__Host-` sin `Secure` y cookies inseguras fuera de perfiles `local`/`dev` |
| CORS | Orígenes exactos por env (`split(",")` sin `trim`); CSRF deshabilitado; preferir same-origin |

### 0.1 Correcciones respecto a la versión anterior de este plan

- `activeCompanyId` está en el contrato pero el login actual lo emite `null`.
- `GET /api/auth/session` **sí** exige `X-Auth-Service-Token`; no es un “me” público.
- `ms-users` valida la sesión directamente en PostgreSQL (`sesiones_usuario`), no llamando a `ms-auth`.
- La renovación deslizante existe en servidor; no hay refresh de cookie ni endpoint de refresh.
- `logout` con sesión inválida devuelve `401` y no limpia la cookie; el front limpia localmente.
- `register` no crea sesión: después hay que hacer login o pedir al usuario que lo haga.

## 1. Gaps contrato ↔ front

> **Estado 2026-10-28:** los gaps de implementación de esta tabla ya se resolvieron en el corte de auth (§2.1). Se conservan como diagnóstico histórico; los pendientes reales son el smoke en servidor y los chips demo.

| Endpoint / campo / flujo | Incompatibilidad | Sev. |
|---|---|---|
| `authService.*` | Todo va contra Supabase (`signInWithPassword`, `profiles`, `onAuthStateChange`). Hay que reescribir la implementación entera | Alta |
| Shape de login | El login no devuelve `name`/`email`; hace falta `GET /users/profile` después | Alta |
| `getCurrentUser` / `initialize` | Hoy usa `getSession()` local de Supabase; la fuente válida es `/ms-users/api/users/profile` | Alta |
| Transporte | No existe `httpClient` con `credentials: 'include'`, base relativa ni `X-Request-ID` | Alta |
| Cookie `__Host-` + `Secure` en prod | Traefik del compose solo expone HTTP; el navegador descarta la cookie `Secure` fuera de localhost | **Bloqueante prod** |
| `subscribeToAuthChanges` | No hay `onAuthStateChange`; sin evento de expiración, multi-tab ni logout remoto | Alta |
| Expiración | Sin refresh; al vencer, el primer request da `401` y nada lo escucha → UI “logueada” con sesión muerta hasta recargar | Media |
| `UserRole` | Front en minúsculas y sin `analista`; backend en MAYÚSCULAS con 5 roles | Media |
| `User.name` | Backend usa `firstName` + `lastName`; front usa `name`; `avatar` no es campo del perfil (puede venir en `profileAttributes`) | Baja |
| Mensajes de error | `401` de login mezcla credenciales, usuario inactivo e infraestructura caída; mapear por status, no por texto | Media |
| `accessToken` en el body | Si el web lo lee/persiste, la cookie `httpOnly` deja de proteger contra XSS. Ignorarlo siempre | Media |
| `register` / `requestPasswordReset` | Siguen en Supabase. Destino: `POST /ms-auth/api/auth/register` y `POST /ms-users/api/users/password-recovery`; el registro no inicia sesión | Alta |
| Usuarios seed | Los chips demo apuntan a Supabase; no hay seed de usuarios en `Repo-DB-2.sql` | Media |
| Orden del ADR | ADR-001 fijaba catálogo → auth; ADR-002 autoriza auth primero porque `ms-auth` está listo y el catálogo Supabase es lectura anónima | Resuelto |
| Guard | `MainLayoutShell` es solo cliente; no hay guard server-side (`src/proxy.ts` en Next 16) | Baja |

## 2. Decisiones

1. **Cookie `httpOnly` en vez de Bearer en web.** Ya es lo que emite el backend y lo que pide ADR-002. El web **nunca** lee ni guarda `accessToken`; Bearer queda para móvil/Postman. Pedir al backend que omita `accessToken` en el body para clientes web (flag o header `X-Client: web`).
2. **`getCurrentUser` = `GET /ms-users/api/users/profile`.** No exponer `/api/auth/session` ni meter `AUTH_SERVICE_TOKEN` en el front, ni siquiera en un BFF. Same-origin en prod por Traefik; en dev con `rewrites` de Next (`/ms-auth/*` → `:8081`, `/ms-users/*` → `:8082`).
3. **Expiración sin refresh → reaccionar al 401 + revalidar al volver a la pestaña.** Un único `httpClient` emite `unauthorized`; el store limpia y el guard redirige. Revalidar con `getCurrentUser()` en `visibilitychange`, como mucho cada 60 s. Sin polling ni timers.
4. **Multi-tab sin `onAuthStateChange` → `BroadcastChannel('repu-auth')`.** `login`/`logout`/`unauthorized` publican `{type}`; `subscribeToAuthChanges` escucha el canal, el 401 y el foco. Fallback al evento `storage` de `auth-storage`.
5. **Roles → `toLowerCase()` + añadir `analista`.** Único cambio de tipos estrictamente necesario. Rol desconocido → `comprador` + `console.warn` en dev. Documentarlo en `DATA_MODEL.md`.
6. **`__Host-` + `Secure` en localhost → mantenerlos.** Chrome/Firefox aceptan cookies `Secure` en `http://localhost`. Safari no: perfil `dev` con `SESSION_COOKIE_NAME=repu_session_dev`, `SECURE=false`, `ALLOW_INSECURE_HTTP=true` **en todos los micros a la vez**. En prod, HTTPS obligatorio; no relajar `Secure`.
7. **CORS con credentials → evitarlo con same-origin.** Si se necesita cross-origin en dev, `CORS_ALLOWED_ORIGINS_*` debe tener el origen exacto (`http://localhost:3000`), sin espacios, y el fetch debe usar `credentials: 'include'`.
8. **Registro sin sesión.** `register` crea la cuenta; el flujo debe hacer login inmediatamente después (o mostrar “cuenta creada, inicia sesión”). No inventar una cookie en registro.

## 2.1 Estado de ejecución (2026-10-28)

| Paso | Estado |
|---|---|
| 0. Smoke test de auth | Hecho en entorno de pruebas con contenedores reales (login OK/KO, profile, logout, 401); servidor pendiente |
| 1. `rewrites` + `.env.example` | Hecho |
| 2. `httpClient.ts` | Hecho + tests escritos y ejecutados |
| 3. `UserRole` + `analista` | Hecho |
| 4. `authService.ts` | Hecho (login/logout/profile/register/reset/subscribe) |
| 5. `authStore` | Hecho (comentarios + `isLoading=false` en listener) |
| 6. `MainLayoutShell` | Sin cambios funcionales; comentario actualizado |
| 7. `LoginForm` chips demo | **Pendiente de decisión** (seeds Spring o retirar) |
| 8. `src/proxy.ts` | No iniciado (opcional) |
| 9. Docs | Hecho |
| 10. Limpieza | Hecho en auth; `supabaseClient.ts` queda solo para catálogo |
| Tests | Ejecutados: 68/68; `type-check` y `build` correctos |

## 3. Plan por pasos

| # | Archivo(s) | Cambio | Hecho cuando |
|---|---|---|---|
| 0 | — | Verificar login → profile → logout → 401 con un usuario real de la BD `repu`. Hecho en entorno de pruebas con `curl`; confirmar también en el servidor desplegado | Smoke verde en entorno de pruebas; servidor pendiente |
| 1 | `next.config.js`, `.env.example` | `rewrites` dev-only hacia `AUTH_API_ORIGIN`/`USERS_API_ORIGIN` (vars de servidor, no `NEXT_PUBLIC`). Documentar las vars | `curl localhost:3000/ms-auth/api/auth/login` responde y reenvía `Set-Cookie` |
| 2 | `src/services/httpClient.ts` (nuevo) | `fetch` relativo con `credentials: 'include'`, `X-Request-ID` (`crypto.randomUUID`), parseo de `{message}`, errores tipados por status y emisor `onUnauthorized` | Tests unitarios con `fetch` mockeado (200/401/5xx/red) |
| 3 | `src/types/auth.ts` | Añadir `'analista'` a `UserRole`. Nada más | `pnpm type-check` verde |
| 4 | `src/services/authService.ts` | Reescribir internamente con las mismas 7 exportaciones. `login` = POST login → GET profile → `User` (mapper `firstName+lastName`, rol minúsculas). 401 → “Credenciales inválidas”; otro → “Servicio no disponible”. `logout` = POST logout (limpia aunque falle). `getCurrentUser` = profile (401 → `null`). `verifyToken` = `!!getCurrentUser()`. `register`/`requestPasswordReset` → Spring. `subscribeToAuthChanges` = BroadcastChannel + `onUnauthorized` + `visibilitychange`. Sin imports de Supabase | `authService.test.ts` reescrito y ejecutado (mock de `httpClient`, no del SDK) |
| 5 | `src/store/authStore.ts` | Sin cambios de contrato. Solo comentarios (“Supabase” → “sesión servidor”) y la regla de que el listener con `null` también pone `isLoading=false`. `partialize` no cambia (sin token) | `authStore.test.ts` verde sin tocar sus aserciones públicas |
| 6 | `MainLayoutShell.tsx` | Sin cambios funcionales, solo el comentario. Ya redirige cuando `isAuthenticated` pasa a `false` (cubre 401 y multi-tab) | Al expirar o hacer logout en otra pestaña, redirige a `/login` |
| 7 | `LoginForm.tsx` | Chips demo → credenciales seed de Spring o quitarlos tras confirmarlo con el usuario. Sin tocar estilos | Login demo funciona contra Spring |
| 8 | `src/proxy.ts` (opcional, fase 2) | Guard optimista: sin cookie de sesión, `(main)` → `/login`. No valida, solo evita el flash | Sin cookie no se renderiza el shell |
| 9 | Docs | `AUTHENTICATION.md`, `BACKEND.md`, `DATAFLOW.md`, `DATA_MODEL.md` (roles), `ROADMAP.md`, `CHANGELOG.md`, `ADR-002` | Docs sin referencias a Supabase Auth como vigente |
| 10 | Limpieza | Retirar imports de `@supabase/supabase-js` en auth; `supabaseClient.ts` se conserva solo para `api.ts` hasta el corte de catálogo | `grep` de Supabase Auth sin resultados en `src/services/authService.ts` |

**Orden:** 0 → 1 → 2 → 3 → 4 → 5/6 → 7 → 9; el 8 es independiente. **Un solo corte** para login, logout, register y reset (sin escrituras duales). `supabaseClient.ts` se queda solo para `api.ts`.

## 4. Tests finales

**Ejecutado el 2026-10-28:** `pnpm test` 68/68, `pnpm type-check` sin errores y `pnpm build` correcto.

**Smoke de API verificado en entorno de pruebas:** registro `201`, login correcto `200` + cookie, login incorrecto `401`, perfil `200`, logout `204` y perfil posterior `401`. En el servidor desplegado sigue pendiente.

**QA manual pendiente en navegador:**

- login OK y KO en la UI;
- recarga conserva la sesión;
- logout limpia la cookie (DevTools);
- dos pestañas: el logout se propaga;
- borrar la cookie a mano → siguiente acción → `/login`;
- usuario `ANALISTA` → rol `analista`;
- comprobar que el `accessToken` no aparece en `localStorage`;
- registro crea cuenta y el login posterior funciona;
- recuperación de contraseña responde `202` genérico.

## 5. Riesgos y prerequisitos del backend

**Riesgos:**

- Prod por HTTP rompe la sesión (bloqueante).
- `401` genérico en login oculta caídas de Redis/DB.
- Sin rate-limit ni lockout en login (fuerza bruta).
- CSRF deshabilitado: hoy lo cubren `SameSite=Lax` + JSON con preflight; añadir check de `Origin` si aparecen formularios cross-site.
- `ms-auth` valida sesión en Redis; `ms-users` en DB: tras logout la revocación es inmediata en ambos (DB desactivada), pero vigilar desincronización.
- Las 7 días de sesión sin revocación por cambio de contraseña.
- Catálogo aún en Supabase (desviación consciente del orden de ADR-001).
- No hay OpenAPI; el contrato puede cambiar sin aviso.

**El backend debe entregar antes de empezar:**

1. HTTPS en Traefik (dominio + certificado), o aceptar que prod no tendrá login hasta tenerlo.
2. Usuarios seed en la BD Spring (incluye un `ANALISTA` y uno inactivo) y la decisión sobre migrar usuarios de Supabase.
3. Códigos diferenciados en login: `400` body inválido, `401` credenciales/inactivo (mismo mensaje, anti-enumeración), `5xx` infraestructura.
4. Omitir `accessToken` en el body para web, o confirmar que el front lo ignora.
5. Limpiar la cookie (`Max-Age=0`) cuando el filtro rechaza una sesión inválida.
6. Confirmar valores de env para dev (`APPLICATION_NAME_*`, puertos, `CORS_ALLOWED_ORIGINS_*`, perfil `dev`) y publicar el contrato (OpenAPI o la colección Postman como fuente acordada).
7. A futuro: refresh/sliding session y `logout` que limpie la cookie aunque la sesión ya no exista.
