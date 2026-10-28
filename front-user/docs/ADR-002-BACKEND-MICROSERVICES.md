# ADR-002 — Backend real: microservicios Spring Boot; Supabase fuera del camino crítico

- **Estado:** Aceptada
- **Fecha:** 2026-10-27
- **Ámbito:** `front-user` + `Backend/` + `Arq-Infra/`
- **Sustituye en alcance a:** [ADR-001](./ADR-001-BACKEND-SPRING.md) (se conserva como decisión histórica)
- **Relacionados:** [BACKEND.md](./BACKEND.md), [AUTHENTICATION.md](./AUTHENTICATION.md), [DATA_MODEL.md](./DATA_MODEL.md), [PLAN-LOGIN-MS-AUTH.md](./PLAN-LOGIN-MS-AUTH.md), [ARCHITECTURE.md](./ARCHITECTURE.md), [ROADMAP.md](./ROADMAP.md)

## Contexto

ADR-001 (2026-10-19) fijó Spring Boot en Docker como gateway final y Supabase como puente congelado. En ese momento el backend se describía como un monolito que se integraría después en el entorno local.

El equipo hizo pull del backend real. La arquitectura ya no es un monolito en preparación: hay **siete microservicios Spring Boot WebFlux** en `Backend/`, orquestados con Docker Compose, Traefik, PostgreSQL/PostGIS y Redis:

| Servicio | Base path | Responsabilidad |
|---|---|---|
| `ms-auth` | `/ms-auth` | Login, registro, logout, sesiones, introspección de sesión, parámetros del sistema |
| `ms-users` | `/ms-users` | Perfil, direcciones, recuperación/cambio de contraseña, estado de usuarios |
| `ms-companies` | `/ms-companies` | Empresas/tiendas y búsqueda por ubicación |
| `ms-products` | `/ms-products` | Catálogo de productos |
| `ms-categories` | `/ms-categories` | Categorías del catálogo |
| `ms-orders` | `/ms-orders` | Carrito, órdenes, tracking y SSE |
| `ms-manage-payment` | `/ms-manage-payment` | Pagos y webhooks de pasarela |

La base de datos canónica ya no es el esquema inglés de Supabase: es el esquema `repu` definido en `Arq-Infra/Repo-DB-2.sql`, con tablas en español, FKs físicas, PostGIS, soft delete y auditoría. La autenticación real usa un **token opaco** guardado como hash en PostgreSQL y cacheado en Redis; no es un JWT de Supabase.

Mantener la narrativa de ADR-001 (“Spring es futuro, Supabase es el backend actual”) induciría a construir sobre un puente que ya fue reemplazado. El riesgo ahora es documental y de integración, no de diseño.

## Decisión

1. **El backend real es la fuente de verdad.** `Backend/` + `Arq-Infra/Repo-DB-2.sql` + `Arq-Infra/Repu.postman_collection.json` definen el contrato vigente. No se documentan endpoints ni esquemas inventados.
2. **Supabase queda fuera del camino crítico.** No se añaden features nuevas sobre Supabase Auth, Realtime, Storage ni cambios de esquema. Su código en `front-user/src/services/` es **legado transitorio** hasta completar el corte por dominio.
3. **`ms-auth` es la autoridad de sesión.** Emite y revoca tokens opacos, valida sesiones y expone introspección servicio-a-servicio. Ningún otro servicio emite sesiones.
4. **`ms-users` es la fuente del perfil.** El login de `ms-auth` no devuelve nombre ni email; el front completa el `User` con `GET /ms-users/api/users/profile`.
5. **El navegador usa cookie `httpOnly`.** El `accessToken` del body se ignora en web; queda para clientes nativos/Postman. La cookie es `__Host-repu_session` en producción y `repu_session_dev` solo en perfiles `local`/`dev` sobre HTTP.
6. **Same-origin.** En producción Traefik sirve front y microservicios bajo el mismo host (`/`, `/ms-auth`, `/ms-users`, …). En desarrollo se replica con `rewrites` de Next.js para evitar CORS y problemas de cookie.
7. **Corte por dominio, empezando por auth.** El orden es auth → catálogo → pedidos → tracking. Se invierte el orden de ADR-001 de forma deliberada y justificada: `ms-auth` ya está implementado y el catálogo actual de Supabase es de lectura anónima, por lo que el corte de auth no bloquea el catálogo. **No hay escrituras duales ni dos fuentes de verdad.**
8. **Zero-Coupling se mantiene.** La UI y los stores de Zustand no cambian por el corte; solo `src/services/`, `src/types/` y variables de entorno.
9. **Contrato pendiente de formalizar.** El backend aún no publica OpenAPI. Mientras tanto, la fuente es el código de los microservicios, la colección Postman y `BACKEND.md`; el OpenAPI 3.1 sigue siendo un entregable del backend.

## Consecuencias

### Positivas

- El front deja de depender de un proveedor BaaS para auth y sesión.
- La sesión queda en cookie `httpOnly`, fuera de `localStorage`; se elimina el riesgo de XSS sobre el token.
- El backend ya valida sesión en varios microservicios, por lo que el corte de auth habilita el resto de dominios.
- El esquema `repu` es portable y propiedad del backend; no hay RLS ni triggers de Supabase en el camino nuevo.
- La colección Postman permite verificar el contrato antes de escribir código.

### Costes y riesgos

- **HTTPS bloqueante en producción:** Traefik expone HTTP y la cookie `Secure` se descarta fuera de `localhost`. Sin TLS, el login responde 200 pero no hay sesión persistente.
- **Convivencia temporal:** el catálogo seguirá leyendo Supabase hasta su corte; auth ya no. Hay que evitar que una sesión de `ms-auth` se use para datos de Supabase y viceversa.
- **Sin refresh:** no hay endpoint de refresh. La sesión se renueva de forma deslizante en servidor cuando quedan menos de 30 minutos, pero la cookie del navegador no extiende su `Max-Age`. Al expirar, el primer 401 debe limpiar la UI.
- **Introspección de sesión:** `GET /ms-auth/api/auth/session` exige `X-Auth-Service-Token` y la credencial del usuario; no es un endpoint público de “me”. El front debe usar `ms-users/profile`.
- **Roles:** el backend usa MAYÚSCULAS (`COMPRADOR`, `DISTRIBUIDOR`, `DOMICILIARIO`, `ANALISTA`, `ADMIN`); el front usa minúsculas y aún no tiene `analista`.
- **Esquema en español vs tipos del front:** `usuarios`, `sesiones_usuario`, `ordenes`, `detalles_orden` no coinciden con `User`, `Order` ni `CartItem`. Los adaptadores viven solo en `src/services/`.
- **Estados de orden distintos:** el backend usa `estado_orden` (`CREADA`, `CONFIRMADA`, `EN_PROCESO`, `EN_CAMINO`, `COMPLETADA`, `CANCELADA`) y `estado_pago/estado_comercio/estado_envio`; el front usa `OrderStatus` de 9 valores. El corte de pedidos exigirá un mapeo explícito.
- **Login con 401 genérico:** credenciales inválidas, usuario inactivo y fallos de infraestructura comparten 401; el front no puede distinguirlos por texto.
- **`accessToken` en el body:** el backend lo devuelve; el web debe ignorarlo. Si se persiste, se pierde la protección de la cookie `httpOnly`.
- **Sin rate limit/lockout documentado** en login; riesgo de fuerza bruta.
- **Sin OpenAPI:** el contrato se deduce del código/Postman y puede cambiar sin aviso.

## Criterios de salida del corte de auth

- [x] `src/services/authService.ts` no importa `@supabase/supabase-js`; usa `httpClient` con `credentials: 'include'`.
- [x] `login` = `POST /ms-auth/api/auth/login` + `GET /ms-users/api/users/profile`; construye `User` con `firstName + lastName`.
- [x] `logout` llama a `POST /ms-auth/api/auth/logout` y limpia el estado local aunque falle la red.
- [x] `getCurrentUser`/`initialize` usan `GET /ms-users/api/users/profile`; sin sesión → `null`.
- [x] `subscribeToAuthChanges` usa `BroadcastChannel` + evento `unauthorized` + `visibilitychange`; no hay polling.
- [x] `UserRole` incluye `analista`; el mapeo MAYÚSCULAS → minúsculas es explícito y tolerante a roles desconocidos.
- [x] El `accessToken` no aparece en `localStorage`, `sessionStorage`, URLs ni logs.
- [x] El guard `MainLayoutShell` redirige a `/login` ante `401`, logout y expiración.
- [x] `pnpm test`, `pnpm type-check` y `pnpm build` verdes; tests de `httpClient` y `authService` ejecutados (68/68; 2026-10-28).
- [x] Smoke de auth en entorno de pruebas: registro, login OK/KO, perfil, logout y `401` posterior.
- [ ] Repetir el smoke de auth en el servidor desplegado.
- [x] Documentación actualizada (`AUTHENTICATION.md`, `CHANGELOG.md`, `ROADMAP.md`, `TESTING.md`).
- [x] Supabase Auth deja de ser necesario para el front (el catálogo puede seguir en Supabase hasta su corte).

## Plan de corte (auth primero)

1. **Verificar backend con Postman:** login → profile → logout contra la instancia real, con un usuario de la BD `repu`. Confirmar cookie y 401.
2. **Preparar transporte:** `next.config.js` con `rewrites` dev-only hacia `AUTH_API_ORIGIN` y `USERS_API_ORIGIN`; `.env.example` con esas variables de servidor.
3. **Crear `src/services/httpClient.ts`:** `fetch` relativo, `credentials: 'include'`, `X-Request-ID`, parseo de `{message}`, errores tipados y emisor `onUnauthorized`.
4. **Tipos:** añadir `analista` a `UserRole`; documentar el mapeo de roles.
5. **Reescribir `authService`:** mismas siete exportaciones públicas; `login`, `logout`, `getCurrentUser`, `verifyToken`, `register`, `requestPasswordReset`, `subscribeToAuthChanges`.
6. **Store y guard:** mantener el contrato de `authStore`; `initialize()` revalida contra `profile`; `MainLayoutShell` reacciona a `401`/logout.
7. **LoginForm:** reemplazar los chips demo de Supabase por usuarios de la BD Spring o retirarlos.
8. **Tests:** `httpClient` (200/401/5xx/red) y `authService` (login+profile, 401, logout, subscribe, roles).
9. **Documentación y limpieza:** actualizar docs y retirar imports de Supabase Auth; `supabaseClient.ts` se conserva solo para el catálogo hasta el corte de catálogo.
10. **Opcional:** `src/proxy.ts` para un guard optimista sin cookie; no valida sesión, solo evita el flash.

## Alternativas consideradas

- **Mantener Supabase Auth y validar sus JWT en Spring:** rechazada; mantiene la identidad atada al proveedor y duplica la autoridad de sesión.
- **Construir un BFF que oculte `ms-auth`:** rechazada para el MVP; añade un servicio y un secreto más. Same-origin con Traefik/rewrites cubre el caso.
- **Usar `accessToken` en `localStorage`:** rechazada; anula la cookie `httpOnly` y reintroduce el riesgo de XSS.
- **Cortar catálogo antes que auth (orden ADR-001):** rechazada en este momento; `ms-auth` ya está listo y el catálogo Supabase no exige sesión. Se documenta la desviación y se evita la escritura dual.

## Notas operativas

- `ms-auth` y `ms-users` comparten la cookie; `ms-orders`, `ms-companies`, `ms-products` y `ms-categories` validan la sesión contra `ms-auth` con `X-Auth-Service-Token`.
- `ms-users` valida la sesión directamente contra `sesiones_usuario` en PostgreSQL (no llama a `ms-auth`); es una excepción consciente que debe vigilarse ante desincronización Redis/DB.
- `ms-manage-payment` no usa `AUTH_SERVICE_TOKEN` en el Compose actual; su contrato de autenticación debe revisarse antes de integrarlo.
- La guía de sesiones del backend está en `Arq-Infra/Guia-Integracion-Sesiones-Ms-Auth.md`.
- El DDL canónico está en `Arq-Infra/Repo-DB-2.sql`; el modelo Supabase anterior se conserva en `docs/legacy/DATA_MODEL-SUPABASE.md`.
