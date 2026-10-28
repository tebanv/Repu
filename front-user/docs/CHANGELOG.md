# Changelog

## ⚠️ PENDIENTE POST-PRUEBAS — Rotar claves y sacar `.env.local` del historial
- El commit `dad7e6e` (`test(front-user)`) subió `front-user/.env.local` a `echava` SOLO para pruebas en servidor.
- Al terminar las pruebas, hacer SÍ o SÍ:
  1. Rotar `NEXT_PUBLIC_MAPBOX_TOKEN` (Mapbox) y `NEXT_PUBLIC_SUPABASE_ANON_KEY` (Supabase).
  2. `git rm --cached front-user/.env.local` y reescribir/excluir el archivo del historial (o nuevo commit + `git filter-repo` si ya se mergeó).
  3. Verificar que `.env.local` vuelve a estar ignorado (`git check-ignore front-user/.env.local`).
- No cerrar este pendiente sin completar los 3 pasos.

## 2026-10-28 — Verificación de auth, suite ejecutada y estado real del backend

### Contexto
- El código de auth ya estaba migrado a `ms-auth`/`ms-users`, pero la documentación seguía marcando la ejecución de tests y el smoke de auth como pendientes.
- Se levantó una instancia de pruebas con contenedores reales (`ms-auth`, `ms-users`, PostgreSQL/PostGIS y Redis) y se aplicó el DDL `Arq-Infra/Repo-DB-2.sql`.

### Verificación ejecutada
- `pnpm test`: **68/68 tests en 8 archivos**.
- `pnpm type-check`: **0 errores**.
- `pnpm build`: **correcto**.
- Smoke de auth contra la instancia de pruebas: registro `201`; login correcto `200` + cookie de sesión (perfil dev: `repu_session_dev`); login incorrecto `401`; perfil `200`; logout `204`; perfil después del logout `401`.
- Esquema `repu` aplicado y consultado: **27 tablas**. `Repo-DB-2.sql` sigue sin seed de usuarios.

### Pendiente
- Repetir el smoke de auth en el servidor desplegado.
- Reemplazar o retirar los chips demo del `LoginForm` (siguen apuntando a seeds de Supabase).
- HTTPS/TLS en Traefik para la cookie `Secure` en producción.
- Cortes de catálogo, pedidos y tracking; OpenAPI del backend.
- QA manual de UI/multi-tab y smoke en servidor.

### Sin cambios de código
- No se tocó `src/` ni `Backend/`; esta entrada registra verificación y actualización documental.

### Archivos impactados
- `docs/CHANGELOG.md`, `docs/AUTHENTICATION.md`, `docs/PLAN-LOGIN-MS-AUTH.md`, `docs/TESTING.md`, `docs/BACKEND.md`, `docs/ROADMAP.md`, `docs/ADR-002-BACKEND-MICROSERVICES.md`, `docs/ARCHITECTURE.md`, `docs/PROJECT_GUIDE.md`, `docs/APP_FLOW.md`, `docs/DATAFLOW.md`, `docs/FOLDER_STRUCTURE.md`, `README.md`.

## 2026-10-27 — Corte de auth del front a `ms-auth`/`ms-users`

### Contexto
- El backend real ya estaba en `Backend/` y la documentación se alineó en el mismo día (ADR-002).
- Faltaba ejecutar el primer corte: reemplazar Supabase Auth en el front por `ms-auth` (sesión) + `ms-users` (perfil).

### Cambios implementados
1. **`src/services/httpClient.ts` (nuevo):** `fetch` relativo con `credentials: 'include'`, `X-Request-ID`, `cache: 'no-store'`, parseo de `{message}`/`{error}`, `HttpError` tipado por status y emisor global `onUnauthorized`. Los endpoints públicos pueden optar por no emitir el evento (`skipUnauthorizedNotification`).
2. **`src/services/authService.ts` (reescrito):** mismas 7 exportaciones; `login` = `POST /ms-auth/api/auth/login` + `GET /ms-users/api/users/profile`; `logout`, `getCurrentUser`, `verifyToken`, `register` (sin iniciar sesión), `requestPasswordReset` (`ms-users`) y `subscribeToAuthChanges` (`BroadcastChannel` + `onUnauthorized` + `visibilitychange` + fallback `storage`). Sin imports de Supabase.
3. **`src/types/auth.ts`:** `UserRole` incluye `analista`; el servicio mapea MAYÚSCULAS del backend → minúsculas y degrada roles desconocidos a `comprador` con warn en dev.
4. **`src/store/authStore.ts`:** comentarios actualizados y el listener de auth ahora también pone `isLoading=false` al recibir `null`; el contrato público (`login`, `logout`, `initialize`, `partialize`) no cambia.
5. **`next.config.js` + `.env.example`:** `rewrites` dev-only de `/ms-auth` y `/ms-users` hacia `AUTH_API_ORIGIN`/`USERS_API_ORIGIN` (vars de servidor); en producción Traefik mantiene same-origin.
6. **Tests:** `httpClient.test.ts` nuevo (8) y `authService.test.ts` reescrito (11) contra `fetch` mockeado. Total escrito: 68 tests en 8 archivos. `authStore.test.ts` conserva sus aserciones.

### Pendiente / limitaciones
- **No se ejecutaron** `pnpm test`, `pnpm type-check`, `pnpm build` ni el smoke de Postman: el entorno de esta sesión no tiene Node/pnpm ni Docker.
- **Chips demo del `LoginForm`** siguen apuntando a seeds de Supabase; deben reemplazarse por usuarios de `repu.usuarios` o retirarse con aprobación.
- **HTTPS en producción** sigue siendo bloqueante para la cookie `Secure`.
- `supabaseClient.ts` se conserva solo para el catálogo (`api.ts`).

### Archivos impactados
- `src/services/httpClient.ts` (nuevo), `src/services/authService.ts`, `src/services/__tests__/httpClient.test.ts` (nuevo), `src/services/__tests__/authService.test.ts`
- `src/types/auth.ts`, `src/store/authStore.ts`, `src/store/__tests__/authStore.test.ts`
- `src/components/layout/MainLayoutShell.tsx`, `src/components/auth/LoginForm.tsx` (comentarios)
- `next.config.js`, `.env.example`
- `docs/AUTHENTICATION.md`, `docs/PLAN-LOGIN-MS-AUTH.md`, `docs/ADR-002-BACKEND-MICROSERVICES.md`, `docs/BACKEND.md`, `docs/ARCHITECTURE.md`, `docs/DATAFLOW.md`, `docs/APP_FLOW.md`, `docs/PROJECT_GUIDE.md`, `docs/ROADMAP.md`, `docs/TESTING.md`, `docs/AI_GUIDELINES.md`, `docs/CHANGELOG.md`, `README.md`, `AGENTS.md`

## 2026-10-27 — Documentación alineada al backend real: microservicios Spring y corte de auth a `ms-auth`

### Contexto
- Se hizo pull del backend real (`Backend/`): siete microservicios Spring Boot WebFlux + Traefik + PostgreSQL/PostGIS + Redis.
- ADR-001 describía Spring como monolito futuro y Supabase como puente vigente; esa narrativa ya no refleja el repositorio y podía inducir a construir sobre Supabase.

### Decisión
- Nuevo `ADR-002-BACKEND-MICROSERVICES.md`: el backend real es el gateway; Supabase queda fuera del camino crítico y su código es legado transitorio solo para catálogo.
- El corte por dominio pasa a **auth → catálogo → pedidos → tracking**. Auth primero se justifica porque `ms-auth` ya está implementado y el catálogo Supabase es de lectura anónima.
- `ms-auth` es la única autoridad de sesión (token opaco, cookie `HttpOnly`); `ms-users` es la fuente del perfil. El web nunca lee/persiste el `accessToken`.
- Se documenta el bloqueante de producción: Traefik del compose solo expone HTTP y la cookie `Secure` no persiste sin TLS.

### Cambios documentales
- Nuevos: `docs/ADR-002-BACKEND-MICROSERVICES.md`, `docs/BACKEND.md`.
- Reescritos: `docs/AUTHENTICATION.md`, `docs/DATA_MODEL.md`, `docs/PLAN-LOGIN-MS-AUTH.md`.
- Actualizados: `docs/ADR-001-BACKEND-SPRING.md` (marcado histórico), `docs/ARCHITECTURE.md`, `docs/APP_FLOW.md`, `docs/DATAFLOW.md`, `docs/FOLDER_STRUCTURE.md`, `docs/PROJECT_GUIDE.md`, `docs/ROADMAP.md` (Fase 10), `docs/TESTING.md`, `docs/AI_GUIDELINES.md`, `README.md`, `AGENTS.md`.
- Nuevo histórico: `docs/legacy/DATA_MODEL-SUPABASE.md` (modelo inglés anterior, preservado).
- `docs/DATA_MODEL.md` pasa a documentar el esquema real `repu` de `Arq-Infra/Repo-DB-2.sql` (tablas en español, FKs, `NUMERIC(15,2)`, roles en MAYÚSCULAS).

### Sin cambios de código
- No se tocó `src/` ni `Backend/`; el front sigue operando con Supabase Auth/catálogo hasta ejecutar `PLAN-LOGIN-MS-AUTH.md`.
- Tests actuales al momento de esta entrada: 61/61; el corte de auth se registra en la entrada siguiente (68 tests escritos).

### Riesgos registrados
- HTTPS en producción (cookie `Secure`) es bloqueante.
- Falta OpenAPI del backend.
- Roles, dinero y estados de orden difieren entre backend y front; los adaptadores viven en `src/services/`.
- No hay seed de usuarios en `Repo-DB-2.sql`; los chips demo actuales no funcionan contra `ms-auth`.

## 2026-10-19 — Decisión de backend: Supabase congelado como puente y Spring Boot como gateway final

### Contexto
- Supabase se adoptó para desbloquear el front sin backend. El desarrollador backend ya está en el equipo y el backend real (Spring Boot, Docker) se integrará en el entorno local; la copia actual de `arquitectura/` está desactualizada.
- Sin una decisión explícita, el “paso intermedio” podía volverse permanente y duplicar trabajo en auth, pedidos y realtime.

### Decisión ([ADR-001](./ADR-001-BACKEND-SPRING.md))
1. Spring Boot en Docker es el gateway final y único; Supabase se congela en el punto actual (PostgreSQL/PostGIS + Auth como puente).
2. No se añaden features nuevas sobre Supabase Auth, Realtime, Edge Functions o Storage, ni cambios de esquema que solo existan en Supabase.
3. El contrato objetivo es OpenAPI 3.1 derivado de `src/types/` + `DATA_MODEL.md`; `arquitectura/Apis_Mall_Virtual_V1.yaml` queda como checklist de alcance.
4. `createOrder` sigue mock hasta los endpoints de pedidos en Spring; el tracking usará SSE/STOMP, no Supabase Realtime.
5. Flyway será el dueño del esquema. `0010`/`0011` y las policies RLS dependientes de `auth.uid()` se retiran o adaptan al cortar la auth.
6. Auth destino: Spring Security/JWT, preferible cookie `httpOnly` + refresh y proxy same-origin. El contrato de `authService`/`authStore` se mantiene.

### Cambios documentales
- Nuevo `docs/ADR-001-BACKEND-SPRING.md`.
- Actualizados `ARCHITECTURE.md`, `ROADMAP.md`, `PROJECT_GUIDE.md`, `APP_FLOW.md`, `DATAFLOW.md`, `DATA_MODEL.md`, `AUTHENTICATION.md`, `TESTING.md`, `FOLDER_STRUCTURE.md`, `AI_GUIDELINES.md`, `README.md`.
- `README.md` y `AGENTS.md` revisados: variables de entorno, convenciones (pnpm/Zero-Coupling/Supabase congelado), mapa de componentes y referencia al ADR.
- Correcciones de estado: catálogo/auth son Supabase real (no mocks); checkout/tracking son mock local; el contrato de datos apunta a Spring.

### Sin cambios de código
- No se tocó `src/`; el front sigue operando igual. El corte se hará por dominio (catálogo → auth → pedidos → realtime) cuando el backend Spring esté disponible en local.

## 2026-10-12 — P1 Auth real Supabase (fin del mock, roles reales, migración 0010)

### Contexto
- `authService.ts` era el último mock de acceso (3 usuarios en memoria); el catálogo ya leía Supabase desde 2026-09-24. La sesión local (`auth-storage`) podía quedar rancia tras expirar el JWT.

### Cambios implementados
1. **Roles reales (sin adaptador):** `UserRole` front = enum DB `comprador|distribuidor|domiciliario|admin` (`src/types/auth.ts`); `'demo'` deja de ser rol (es atajo UX del login contra seeds con rol `comprador`). `mapProfileRow` es asignación directa.
2. **`src/services/authService.ts` real:** `login` vía `signInWithPassword` + fetch `profiles`, `logout` con `signOut` (limpieza local garantizada aun sin red), `getCurrentUser`/`verifyToken` por `getSession`, `register` por `signUp`, `requestPasswordReset` por `resetPasswordForEmail`, nuevo `subscribeToAuthChanges` (Zero-Coupling: el store recibe `User|null`, nunca el SDK).
3. **`src/store/authStore.ts`:** nueva acción idempotente `initialize()` (la sesión vigente manda sobre `auth-storage`; sin sesión se descarta la local) + suscripción única a `onAuthStateChange` (multi-tab, expiración/refresh sin polling). `logout` ahora `async` (fire-and-forget en `AppHeader`, sin cambio visual).
4. **Guard:** `MainLayoutShell` llama a `initialize()` y espera `hasHydrated + !isLoading` antes de decidir (cierra el flash de sesión rancia); `LoginForm` también revalida al entrar a `/login`.
5. **Migración `0010_handle_new_user`:** trigger `on_auth_user_created` crea la fila `profiles` (rol `comprador`) en cada `signUp`. Sin ella el login falla en el fetch (RLS `profiles_owner`).
6. **Tests:** suite 47 → 61 verdes. `authStore.test.ts` reescrito contra servicio mockeado (incl. `initialize` con/sin sesión); nuevo `src/services/__tests__/authService.test.ts` (12: mapeo directo, degradación de rol desconocido a `comprador`, normalización de email, register con `name` para el trigger, subscribe SIGNED_OUT/SIGNED_IN). `type-check` 0 errores en `src/` (persisten los 5 pre-existentes en `worktrees/`).
- Estado operativo (2026-10-12, verificado contra cloud `qewsgjdnuarsyvpnngsn`): `0010` + `0011_handle_new_user_search_path` aplicadas vía `db push` (pooler IPv4) y trigger `on_auth_user_created` confirmado en `auth.users`; 3 seeds verificados de punta a punta (`signIn` + perfil: admin rol `admin`, usuario/demo rol `comprador`); `front-user/.env.local` fuera del índice (`e35a446`, `ignored=True`). Hallazgos del seed: `usuario@test.com` es dominio bloqueado por Supabase y el password mínimo es 6 → seeds finales `usuario@demo.com/user123`, `demo@demo.com/demo123` (actualizados en código/docs/LoginForm); la `0010` inicial abortaba signUps por `search_path` no fijado (corregido en `0011`).
- Resta (rotación, cuando digas): Mapbox + Supabase `anon key` en dashboards + DB password (circuló por chat) + decidir `filter-repo` + force-push sobre `echava`.

### Archivos impactados
- `supabase/migrations/0010_handle_new_user.sql` (nuevo, a nivel de repo)
- `src/types/auth.ts`, `src/services/authService.ts`, `src/store/authStore.ts`
- `src/components/layout/MainLayoutShell.tsx`, `src/components/auth/LoginForm.tsx`
- `src/store/__tests__/authStore.test.ts`, `src/services/__tests__/authService.test.ts` (nuevo)
- `docs/CHANGELOG.md`, `docs/AUTHENTICATION.md`, `docs/DATA_MODEL.md`, `docs/TESTING.md`, `docs/ROADMAP.md`, `docs/PROJECT_GUIDE.md`, `docs/FOLDER_STRUCTURE.md`

## 2026-10-12 — Compose para desplegar el front en servidor

### Cambios implementados
1. **`docker-compose.yml` (nuevo):** servicio `front` (build con `args NEXT_PUBLIC_*` desde `.env`, `image repu-front:latest`, puerto `${PORT:-3000}:3000`, `restart: unless-stopped`, `healthcheck` wget a `/`).
2. **`Dockerfile`:** comentario con flujo Compose recomendado.
- Uso en servidor: `cp .env.example .env` → completar valores → `docker compose up -d --build`.

## 2026-10-12 — Dockerfile de producción para el front (`standalone` + pnpm)

### Contexto
- Sin artefacto de despliegue: el front (Next.js 16.3.1-canary.20 + pnpm 11.22.0) no tenía imagen Docker para servidor.

### Cambios implementados
1. **`next.config.js`:** `output: 'standalone'` para generar `.next/standalone/server.js` autocontenido.
2. **`Dockerfile` (nuevo, multi-stage):** `base` (node:22-alpine + pnpm 11.22.0 vía corepack) → `deps` (`pnpm install --frozen-lockfile`) → `builder` (`ARG NEXT_PUBLIC_MAPBOX_TOKEN/SUPABASE_URL/SUPABASE_ANON_KEY` + `pnpm build`) → `runner` mínimo no-root (`nextjs:nodejs`, solo `standalone` + `public` + `.next/static`, `PORT 3000`, `CMD node server.js`).
3. **`.dockerignore` (nuevo):** excluye `node_modules`, `.next`, `worktrees/`, `.env*` (menos `.env.example`), docs y secretos del contexto.
- Nota: `pnpm build` local falla solo por `TS2300` pre-existente en `worktrees/*` (ajeno a `src/`); en Docker no afecta porque `worktrees/` está excluido del contexto.

### Archivos impactados
- `next.config.js`, `Dockerfile` (nuevo), `.dockerignore` (nuevo)
- `docs/CHANGELOG.md`

## 2026-09-24 — Front lee la BD real: `api.ts` sobre Supabase (fin del mock de catálogo)

### Contexto
- `src/services/api.ts` era mock en memoria (`allStoresData` + `setTimeout`); ahora consulta Supabase cloud (`qewsgjdnuarsyvpnngsn`). Firmas intactas: cero cambios en UI/stores (Zero-Coupling).

### Cambios implementados
1. **Dep + env:** `pnpm add @supabase/supabase-js@2.117.0`; `.env.local` suma `NEXT_PUBLIC_SUPABASE_URL` + `NEXT_PUBLIC_SUPABASE_ANON_KEY`; nuevo `.env.example` (cierra el pendiente de `AI_GUIDELINES §7`).
2. **Nuevo `src/services/supabaseClient.ts`:** singleton diferido + `isSupabaseConfigured()`; único importador de la lib.
3. **`api.ts` real:** `fetchNearbyStores → rpc('get_nearby_stores')`, `fetchStoreBySlug/ById` y `fetchProductsByStore/ById → from('stores'/'products')` con filtros `is_active`/`is_available`.
4. **Adaptadores DB→dominio (solo `services/`):** `location` EWKB hex → `lat/lng` (PostgREST no devuelve GeoJSON aquí; parser con `DataView`, verificado contra el seed); `delivery_fee → deliveryInfo`, `specs → specs+specifications`, `logo_url/banner_url → logo/banner`. Gaps: `stats.totalOrders` omitido (DB no lo tiene; `StoreHeader` oculta el badge), sin `maxPerOrder/discount/compat` estructurada.
5. **Verificación:** `pnpm test` 47/47; `pnpm type-check` sin errores en `src/` (los 5 errores restantes son pre-existentes en `worktrees/` ajenos); lectura anónima vía REST + RPC verificados contra cloud (4 tiendas + 8 productos).
- Pendiente (fases siguientes): `authService` mock → Supabase Auth, `createOrder` transaccional, Realtime.

### Archivos impactados
- `src/services/api.ts`, `src/services/supabaseClient.ts` (nuevo)
- `package.json`, `pnpm-lock.yaml`, `.env.local`, `.env.example` (nuevo)
- `docs/CHANGELOG.md`, `docs/FOLDER_STRUCTURE.md`, `docs/PROJECT_GUIDE.md`, `docs/ARCHITECTURE.md`, `docs/DATAFLOW.md`

## 2026-09-24 — Validación de migraciones `0001→0009` contra Supabase cloud

### Contexto
- Cierra el pendiente del `CHANGELOG 2026-09-16` ("Validación pendiente: `supabase db push` contra proyecto real").
- Proyecto cloud `qewsgjdnuarsyvpnngsn` (us-east-1), CLI `supabase 2.117.0` vía `pnpm dlx` (sin instalación global).

### Cambios implementados
- `supabase db push --db-url` (Session pooler `:5432`, usuario `postgres.<ref>`): 9/9 migraciones aplicadas en orden.
- Nota operativa: el host directo `db.<ref>.supabase.co` solo resolvía IPv6 en esta red; el Session pooler (IPv4) sí conecta y admite DDL.
- Verificado con `supabase db query`: 4 tiendas seed (Medellín) + 8 productos; `get_nearby_stores(6.2442, -75.5812, 10000)` retorna las 4 ordenadas por distancia.
- Sin cambios de esquema ni de código: validación pura, credenciales fuera del repo.

### Archivos impactados
- `docs/CHANGELOG.md`

## 2026-09-16 — Migraciones Supabase `0001→0009` desde `DATA_MODEL.md`

### Contexto
- DB desde cero (sin Excel). Serie generada 1:1 del contrato: enums, profiles, stores PostGIS, products trigram, addresses, orders, RLS, RPC, seed dev.

### Cambios implementados
- `<raíz>/supabase/migrations/` (a nivel de repo, no bajo `front-user/`): 9 archivos idempotentes (`IF NOT EXISTS` / `ON CONFLICT DO NOTHING` / `DROP POLICY IF EXISTS`).
- Revisión propia: RLS permite alta transaccional del pedido (policies `*_owner_write` con `EXISTS` sobre la orden de la misma transacción); posiciones solo lectura comprador (escritura `service_role`).
- Seed dev: 4 tiendas Medellín + 8 productos con `specs`/compatibilidad. Sin usuarios/pedidos seed (exigen `auth.users` por sign-up).
- Validación pendiente: `supabase db push` contra proyecto real (sin tooling PG local).

### Archivos impactados
- `supabase/migrations/0001_enums.sql` … `0009_seed_dev.sql` (nuevos)
- `docs/CHANGELOG.md`

## 2026-09-16 — Contrato de datos: `docs/DATA_MODEL.md` + auditoría del legado

### Contexto
- Sin Excel: DB desde cero. Antes de migraciones, fijar el contrato.
- Auditoría de `arquitectura/` (backend externo no revisado): cobertura de alcance útil pero DDL no apto (sin PostGIS, telemetría 1Hz relacional, carrito server sin regla una-tienda, dinero decimal, 3 vocabularios de estados, `schema.sql` inexistente en compose, secretos de ejemplo).

### Cambios implementados
- Nuevo `docs/DATA_MODEL.md`: convenciones (EN snake_case, UUID, BIGINT COP, timestamptz, geography, ENUM único), ER slice cliente (profiles/stores/products/addresses/orders/items/historial/posiciones), tabla de mapeo front↔DB para adaptadores, RLS esqueleto, fuera-de-alcance registrado, plan de migraciones `0001→0009`.

### Archivos impactados
- `docs/DATA_MODEL.md` (nuevo)
- `docs/ROADMAP.md`, `README.md`, `docs/CHANGELOG.md`

## 2026-09-16 — Fase A: suite Vitest (47 tests), multi-tab sync y telemetría `cart_expired`

### Contexto
- El carrito —la lógica con más reglas— no tenía un solo test (DoD 7.6 pendiente) y faltaban multi-tab sync (7.2) y telemetría `cart_expired` (7.5).

### Cambios implementados
1. **Setup Vitest (A1.1, `pnpm` exclusivo):** `vitest@5 + @vitest/coverage-v8 + jsdom`, `vitest.config.mts` (ESM, alias `@`, setup `src/test/setup.ts` con localStorage en memoria), scripts `test/test:watch/test:coverage`.
2. **Tests (A1.2/A1.3, 47/47 verdes):** `cartStore` (23: merge, `STORE_CONFLICT`, clamps, `MISSING_STORE_CONTEXT`, redondeo COP, TTL, saneo), `orderStore` (10: `REP-XXXX`, cap 20, cancel/rate, coords), `authStore` (5), `storesStore` híbrido con api mockeada (5), `storageSync` + `analytics` (4).
3. **Fix latente hallado por los tests:** `addItem` usaba `sanitizeStoreContext` genérico y el `id` del producto colisionaba como `storeId`, volviendo inalcanzable `MISSING_STORE_CONTEXT`. Nuevo `sanitizeProductStoreContext` estricto (solo `storeId/slug/name` explícitos); `replaceStoreContext` conserva fallback para objetos tienda. Sin impacto en producción (los callers siempre pasan `storeId`).
4. **QUIRK documentado (no cambiado):** `stock: 0` se normaliza a “sin límite” igual que `null`. Test lo fija como comportamiento actual; regla de agotado pendiente antes del backend.
5. **A2 multi-tab:** `src/lib/storageSync.ts` (`storage` event → `rehydrate`, guarda HMR, no-op SSR) cableado en `cartStore` y `orderStore`.
6. **A2 telemetría:** `src/lib/analytics.ts` (`track('cart_expired', {reason})` en `merge`, dev-only debug, no-op prod).

### Verificación
- `pnpm test` 47/47, `pnpm type-check` 0 errores, `pnpm build` ok.
- `pnpm lint` falla a nivel entorno (pre-existente, no de Fase A): `eslint-config-next@15.2.2` no soporta TS 7.0.

### Archivos impactados
- `vitest.config.mts`, `package.json`, `src/test/setup.ts` (nuevos)
- `src/store/__tests__/{cartStore,orderStore,authStore,storesStore}.test.ts` (nuevos)
- `src/lib/__tests__/{storageSync,analytics}.test.ts` (nuevos)
- `src/lib/analytics.ts`, `src/lib/storageSync.ts` (nuevos)
- `src/store/cartStore.ts`, `src/store/orderStore.ts`
- `docs/TESTING.md`, `docs/ROADMAP.md`, `docs/FOLDER_STRUCTURE.md`, `docs/CHANGELOG.md`

## 2026-09-16 — Consolidación de pruebas en `docs/TESTING.md` y retiro de `TEST_LOGIN.md`

### Contexto
- La matriz de pruebas vivía dispersa entre `ROADMAP §7.6` y el legacy `TEST_LOGIN.md` (rutas `.js`, branding viejo).
- Se crea fuente única de testing con comandos `pnpm`, convenciones Vitest y cobertura para el código actual (auth, híbrido de tiendas, carrito, pedidos, ubicación, toasts, integración UI y QA Safari iOS/multi-tab).

### Cambios implementados
- Nuevo `docs/TESTING.md` (§1 comandos, §2 convenciones, §3 matriz unitaria, §4 integración, §5 QA manual, §6 legado migrado, §7 deuda).
- Eliminado `docs/TEST_LOGIN.md`; lo útil migrado (credenciales mock, `auth-storage`, debugging localStorage).
- `docs/ROADMAP.md`: §7.6 y Fases 8/9/9.6 ahora solo apuntan a `TESTING.md` por fase.
- `README.md`: punteros a `TESTING.md`.

### Archivos impactados
- `docs/TESTING.md` (nuevo)
- `docs/TEST_LOGIN.md` (eliminado)
- `docs/ROADMAP.md`
- `README.md`
- `docs/CHANGELOG.md`

## 2026-08-24 — Fix: label flotante con valores precargados por el navegador (login)

### Contexto
- Con credenciales guardadas, Chrome autocompleta los inputs del login antes de hidratar React; el estado controlado permanece vacío en la ventana inicial y el label nacía centrado sobrepuesto al valor. El submit no se ve afectado (React sincroniza al primer gesto), pero el estado inicial es visualmente incorrecto.

### Causa raíz y guardrail (anti-regresión)
- **Overrides de autofill viven FUERA de `@layer`.** Tailwind v4 usa cascade layers nativas: entre capas gana el orden de declaración (`utilities` > `base`) sin importar la especificidad; el CSS unlayered gana a todas las capas. La regla `input:-webkit-autofill:not(:focus) ~ label` estaba en `@layer base` y perdía contra `top-1/2`/`-translate-y-1/2`/`text-sm` aunque su selector fuera más específico. **Regla de proyecto: cualquier override que compita con utilidades de Tailwind (top, transform, font-size, color...) debe vivir unlayered en `globals.css`, nunca dentro de `@layer base`.**
- Selectores con cobertura webkit + estándar (`:-webkit-autofill` y `:autofill` para Firefox 86+), acotados con `:not(:placeholder-shown)`: Chrome retiene el pseudo-estado de autofill aunque el usuario vacíe el campo, así que sin esta guarda el label quedaría flotado sobre un input vacío. Eliminado el detector por animación (llegaba pre-hidratación y era código muerto).
- Nota estratégica pendiente: si aparece lógica gateada por `email !== ''` (submit deshabilitado, validación reactiva), sincronizar el estado React con `ref.current.value` en montaje; hoy no es necesario porque el envío ya funciona.

### Archivos impactados
- `src/app/globals.css`
- `docs/CHANGELOG.md`

### QA
- Carga fresca con autofill sin interacción → label flotado desde el inicio
- Focus en campo autocompletado → label se mantiene con acento (cian/magenta)
- Vaciar campo y blur → label regresa al centro

## 2026-08-24 — Rediseño del Login: Formulario "Ignición" acoplado al campo magnético

### Contexto
- Transformación visual completa del formulario de login bajo el concepto "Ignición" (el login como arranque de motor): el formulario y el fondo magnético funcionan como un solo instrumento, con coreografía bidireccional formulario↔campo.

### Cambios implementados
1. **Puente form↔campo (`AuthFieldContext.tsx`, nuevo):**
   - Context client que expone `MagneticFieldApi` vía hook `useAuthField()`; `MagneticBackground` provee el valor cuando el motor está activo. Degradación graceful a null (reduced-motion / fallback estático).
2. **Tipografía de sistema:** se añade **Chakra Petch** (display técnico cyberpunk) vía `next/font` en el root layout, mapeada a la utilidad `font-display` en `globals.css`. Inter permanece para cuerpo.
3. **`LoginForm.tsx` refactorizado:**
   - Marca nueva: monograma SVG pin+rayo que se dibuja al cargar (pathLength animado) + wordmark REPU con tracking animado.
   - Campos de línea (sin caja) con label flotante controlado por React y barrido de energía cian/magenta al enfocar.
   - CTA "switch de ignición": borde energizado, barra indeterminada `.animate-ignition` durante carga, línea de éxito animada, estados "Verificando…/Acceso concedido".
   - Coreografía con el campo: focus→`setMood(email|password)`, cada tecla→`pulse()` desde la posición del input, blur→idle, error→turbulencia roja, éxito→onda de alineación + navegación diferida 900ms.
   - Error con shake accesible (`role="alert"`, AnimatePresence), indicador de Caps Lock (keydown `getModifierState`), chips de acceso demo.
4. **Card refinada (`AuthBackground.tsx`):** vidrio más preciso (`bg-[#10162b]/55 backdrop-blur-xl border-white/10 rounded-2xl`) + línea de energía superior en gradiente cian.
5. **Accesibilidad:** labels asociados, `aria-label` en toggles, focus-visible ring en CTA, respeto a reduced-motion para la barra de ignición, contraste verificado sobre el vidrio.

### Archivos impactados
- `src/components/auth/AuthFieldContext.tsx` (nuevo)
- `src/components/auth/LoginForm.tsx` (refactor completo)
- `src/components/auth/MagneticBackground.tsx` (provee contexto)
- `src/components/auth/AuthBackground.tsx`
- `src/app/layout.tsx` (fuentes), `src/app/globals.css` (utilidades)
- `docs/CHANGELOG.md`

## 2026-08-24 — Fondo de Login Interactivo: Campo Magnético de Limaduras (`MagneticBackground`)

### Contexto
- Rediseño del fondo del login para maximizar impacto visual en usuarios jóvenes con un concepto propio y no trillado: un campo magnético de ~2000 limaduras de hierro que se orientan en tiempo real alrededor de un dipolo invisible que sigue al puntero/dedo. Reemplaza al prototipo de simulación de fluidos WebGL (mismo día, nunca liberado) por ser una técnica reconocible como demo genérico; el nuevo concepto se acopla semánticamente a un formulario "vivo".

### Cambios implementados
1. **Nuevo motor `src/components/auth/MagneticBackground.tsx` (Canvas 2D, sin dependencias):**
   - Rejilla orgánica de limaduras con física de muelle angular amortiguado (inercia y retraso natural); dipolo con seguimiento suave del puntero y deriva ambiental tipo Lissajous cuando no hay interacción.
   - Vórtice en el núcleo cercano al dipolo + oscilación ambiental + estrellas tenues titilantes sobre gradiente espacial profundo.
   - Inversión de polaridad por toque sobre el fondo vacío, propagada en **cascada radial** (cada limadura voltea cuando el frente de onda la alcanza según su distancia).
   - Pulso de onda expansiva con patada angular y boost de brillo al paso del frente.
2. **API semántica para el formulario (`MagneticFieldApi`):** `setMood(idle|email|password|error|loading|success)`, `pulse(x, y)` y `flipPolarity()`. Estados transitorios (error/success) auto-retornan a idle. El acento de color transiciona suavemente entre estados (cian/magenta/púrpura/rojo).
3. **Rendimiento (Heurística A):**
   - Batching de trazado por 4 cubos de tensión (4 strokes por frame para ~2000 líneas); halo extra solo para el cubo más caliente.
   - Render pausado con `visibilitychange`, clamp de `dt`, DPR con cap 2x, rejilla adaptativa táctil/desktop.
4. **Fallbacks y accesibilidad:** `prefers-reduced-motion` → fondo estático; Canvas 2D no disponible → fallback graceful; limpieza estricta de listeners/RAF sin operaciones destructivas de contexto (compatible con remontaje de StrictMode).
5. **Adaptación de `AuthBackground.tsx`:** nuevas props opcionales `overlay` y `showEffects` (retrocompatibles).
6. **Integración:** `(auth)/layout.tsx` monta `MagneticBackground`; card glassmorphism y formulario actual intactos — la conexión form→campo queda lista vía prop `onApi`.

### Archivos impactados
- `src/components/auth/MagneticBackground.tsx` (nuevo)
- `src/components/auth/AuthBackground.tsx`
- `src/app/(auth)/layout.tsx`
- `docs/CHANGELOG.md`
- `src/components/auth/FluidBackground.tsx` (eliminado; prototipo sustituido)

## 2026-08-23 — Soporte Multi-Pedido Concurrente y Panel Lateral `ActiveOrdersDrawer`

### Contexto
- Rediseño arquitectónico de la gestión de pedidos para soportar múltiples órdenes activas concurrentes (ej. compra simultánea en tienda de baterías y tienda de llantas), eliminando el puntero singleton `activeOrderId` y dotando a la interfaz de un panel de navegación lateral interactivo.

### Cambios implementados
1. **Refactorización de `orderStore.ts` (Enfoque B Puro):**
   - Eliminación del puntero `activeOrderId` como fuente de desincronización; las órdenes activas se derivan reactivamente del array de sesión `orders`.
   - Implementación de selectores puros memoizados con `useShallow` de `zustand/react/shallow` (`useActiveOrders`, `useCompletedOrders`), garantizando estabilidad referencial en `getSnapshot` de React 19 y previniendo bucles de re-render.
   - `useActiveOrdersCount()` para suscripción atómica del Header sin re-renders por cambios en coordenadas o detalles.
    - `getOrderById(id)`: Consulta unitaria indexada (acción del store, vía `useOrderStore.getState().getOrderById`).
2. **Creación del Panel Lateral `ActiveOrdersDrawer.tsx`:**
   - Componente drawer Cyberpunk/Dark Neón con Framer Motion.
   - Optimización de ciclo de vida: listener de tecla `Escape` con guarda `if (!isOpen) return undefined` para no registrar listeners globales ociosos en `window` cuando el drawer está cerrado.
   - Sincronización controlada de pestaña activa (*En Curso* e *Historial*).
   - Tarjetas interactivas con radar neón, ETA, resumen de autopartes y navegación rápida.
3. **Punto de Entrada en `AppHeader.tsx`:**
   - Botón *"Pedidos en curso"* con badge dinámico según la cantidad de pedidos activos (`count > 0`).
   - Al pulsar, despliega `ActiveOrdersDrawer` para que el usuario seleccione qué orden inspeccionar sin recargar la página.

### Archivos impactados
- `src/store/orderStore.ts`
- `src/components/tracking/ActiveOrdersDrawer.tsx`
- `src/components/layout/AppHeader.tsx`
- `docs/ROADMAP.md`
- `docs/CHANGELOG.md`

## 2026-08-21 — Blindaje de Ciclo de Vida, Resiliencia de Geolocalización y Optimización de Stores

### Contexto
- Auditoría profunda de ciclo de vida de componentes, gestión de recursos de hardware en dispositivos móviles (GPS) y optimización de renderizado en React 19 / Framer Motion / Zustand.

### Cambios implementados
1. **Resiliencia de Geolocalización y Control de Batería (`src/store/locationStore.ts`):**
   - **Apagado selectivo de hardware:** Ante denegación explícita de permisos (`PERMISSION_DENIED` - Código 1), se cancela de inmediato la escucha con `navigator.geolocation.clearWatch(watchId)` y se libera el identificador para evitar drenado de batería en segundo plano.
   - **Reconexión automática en zonas de sombra (sótanos/túneles):** Ante errores de señal (`POSITION_UNAVAILABLE` o `TIMEOUT`), se preservan las últimas coordenadas válidas y el sensor permanece en escucha pasiva, reactualizando automáticamente el mapa en cuanto el dispositivo recupera satélites al salir al exterior.
   - **Guarda Anti Re-renders:** Filtrado de eventos repetitivos para que Zustand no emita actualizaciones cada 10s mientras el usuario permanezca sin cobertura.
   - **Desbloqueo de reintentos:** Si el usuario reactiva permisos en el candado 🔒 de la barra de direcciones, el botón *"Mi Ubicación"* permite rearmar el rastreo sin bloqueos por estados residuales.
2. **Higiene de Stores y Capacidad Visual (`src/store/orderStore.ts` & `src/store/toastStore.ts`):**
   - Límite de retención en memoria para el historial de órdenes en modo prototipo (`.slice(0, 20)`), garantizando un consumo mínimo de almacenamiento.
   - Cota máxima de 4 notificaciones simultáneas en pantalla (`.slice(-4)`) en `toastStore` con auto-evicción para no saturar la interfaz.
3. **Corrección de Ciclo de Vida de Animaciones en Framer Motion:**
   - `StoreConflictDialog.tsx`: Estructuración con `<AnimatePresence>` envolviendo la condición de visibilidad para permitir la ejecución limpia de la animación de salida (`exit={{ opacity: 0 }}`).
   - `ProductModal.tsx`: Eliminado el uso de `<React.Fragment>` como hijo directo de `<AnimatePresence>`, asignando `motion.div` con `key` explícitas para un desvanecimiento suave al cerrar.
   - `OrderRatingModal.tsx`: Contenedor raíz adaptado a `motion.div` para transiciones fluidas al enviar calificación o pulsar omitir.
4. **Limpieza de Recursos en Controles del Mapa (`src/components/map/controls/ZoomControl.tsx`):**
   - Implementado hook de limpieza en `useEffect` que cancela temporizadores de hover (`hideTimeoutRef`) y elimina listeners globales de arrastre (`mousemove`, `mouseup`, `touchmove`, `touchend`) en caso de desmontaje durante la interacción.
5. **Punto de Re-ingreso al Seguimiento desde Header (`src/components/layout/AppHeader.tsx`):**
   - Botón discreto *"Pedido en curso"* con ícono de motocicleta y pulso reactivo junto al carrito de compras, permitiendo volver a la pantalla `/order/[id]` en cualquier momento manteniendo el mapa principal despejado.

### Archivos impactados
- `src/store/locationStore.ts`
- `src/store/orderStore.ts`
- `src/store/toastStore.ts`
- `src/components/stores/StoreConflictDialog.tsx`
- `src/components/stores/ProductModal.tsx`
- `src/components/tracking/OrderRatingModal.tsx`
- `src/components/map/controls/ZoomControl.tsx`
- `src/components/layout/AppHeader.tsx`
- `docs/ROADMAP.md`
- `docs/CHANGELOG.md`

## 2026-08-19 — Implementación de Fase 9: Tracking en Tiempo Real y Post-Venta (`/order/[id]`)

### Contexto
- Implementación completa de la experiencia de seguimiento en tiempo real y post-venta para la cadena logística de autopartes y repuestos automotrices (Fase 9).

### Cambios implementados
1. **Modelos de Dominio y Tipos (`src/types/order.ts`):**
   - Extensión de `Order` y `CreateOrderPayload` con `storeCoordinates`, `driverCoordinates` y `OrderRating`.
   - Definición de la interfaz `OrderRating` con evaluación independiente de tienda y repartidor (1 a 5 estrellas) y comentarios.
2. **Store de Pedidos (`src/store/orderStore.ts`):**
   - Añadidas acciones `rateOrder` y `updateDriverCoordinates`.
   - Inicialización automática de coordenadas de origen (tienda) y destino (cliente) para un renderizado inmediato y fluido del mapa.
3. **Componentes Modulares de Tracking (`src/components/tracking/`):**
   - `OrderTrackingHeader.tsx`: Cabecera con ID de pedido con copiado rápido, badge de estado reactivo con pulsación neón y tiempo estimado (ETA).
   - `OrderTrackingMap.tsx`: Instancia de Mapbox GL JS (`dark-v11`) con trazado de ruta neón cian/azul, marcadores interactivos para tienda (origen), cliente (destino) y repartidor (moto) con interpolación de desplazamiento y controles flotantes.
   - `OrderTimeline.tsx`: Línea de tiempo interactiva adaptada al ciclo de vida de repuestos (`CREADO` $\rightarrow$ `PREPARANDO` $\rightarrow$ `RECOGIDO` $\rightarrow$ `EN_CAMINO` $\rightarrow$ `ENTREGADO`) con barra de progreso animada (Framer Motion) y simulador rápido de estados.
   - `DriverCard.tsx`: Tarjeta de conductor con nombre, avatar, placa y modelo de la motocicleta, calificación y accesos rápidos para llamada y chat.
   - `OrderDetailsAccordion.tsx`: Acordeón colapsable con desglose completo de piezas compradas, tienda de autopartes, dirección y desglose financiero.
   - `OrderRatingModal.tsx`: Modal post-venta que se despliega automáticamente al pasar a `ENTREGADO` para calificar tienda y domiciliario.
4. **Página Dinámica de Seguimiento (`src/app/(main)/order/[id]/page.tsx`):**
   - Captura del `orderId` con `useParams()`, orquestación de mapa, timeline y cards con layout responsivo optimizado para móvil y desktop.
5. **Conexión de Checkout:**
   - Botón *"Seguir Pedido"* en `checkout/page.tsx` conectado directamente a `/order/[id]`.

### Archivos impactados
- `src/types/order.ts`
- `src/store/orderStore.ts`
- `src/components/tracking/OrderTrackingHeader.tsx`
- `src/components/tracking/OrderTrackingMap.tsx`
- `src/components/tracking/OrderTimeline.tsx`
- `src/components/tracking/DriverCard.tsx`
- `src/components/tracking/OrderDetailsAccordion.tsx`
- `src/components/tracking/OrderRatingModal.tsx`
- `src/app/(main)/order/[id]/page.tsx`
- `src/app/(main)/checkout/page.tsx`
- `docs/ROADMAP.md`
- `docs/CHANGELOG.md`

## 2026-08-19 — Acceso Global al Carrito desde el AppHeader (`AppHeader.tsx`)

### Contexto
- Se habilitó el punto de acceso directo al carrito persistente desde la barra superior de navegación (`AppHeader.tsx`) en todas las vistas protegidas, incluyendo la vista principal del mapa (`/`).

### Cambios implementados
1. **Botón de Carrito con Contador Reactivo en `AppHeader.tsx`:**
   - Icono `ShoppingCart` con badge animado que muestra `itemCount` en tiempo real desde `useCartSummary()`.
   - Visualización opcional del subtotal formateado en COP en pantallas medianas y grandes (`md:`).
   - Estilo cyberpunk con halo cian y compatibilidad con `useCartHasHydrated()` para evitar parpadeos durante la rehidratación.
2. **Montaje e Integración del `CartDrawer.tsx` Global y Rediseño Visual:**
   - Al pulsar el botón del carrito desde el Header se despliega el `CartDrawer`.
   - **Reemplazo de placeholders por `ProductIcon`**: todos los ítems del carrito ahora renderizan el ícono holográfico animado `ProductIcon` con brillo cian, eliminando placeholders rotos.
   - **Optimización de distribución de espacio**: tarjeta con jerarquía clara (título y botón de eliminación en fila superior, controles de cantidad táctiles y subtotal destacado en fila inferior).
   - **Cabecera y Footer mejorados**: indicador de número de ítems, tienda con ícono, desglose de subtotal y CTA con gradiente y flecha `ArrowRight`.
   - **Estado vacío enriquecido**: ilustración holográfica y botón para explorar tiendas.
3. **Actualización de Documentación:**
   - Registro en `docs/ROADMAP.md` y `docs/CHANGELOG.md`.

### Archivos impactados
- `src/components/layout/AppHeader.tsx`
- `src/components/stores/CartDrawer.tsx`
- `src/components/checkout/OrderSummaryCard.tsx`
- `docs/ROADMAP.md`
- `docs/CHANGELOG.md`

## 2026-08-18 — Implementación de Fase 8: Checkout y Simulación de Pedido

### Contexto
- Implementación completa del flujo de compra y cierre de ciclo de pedido (Fase 8).
- Conexión del `CartDrawer` con la nueva vista `/checkout`, captura inteligente de dirección de entrega, selección de métodos de pago y persistencia de pedidos.

### Cambios implementados
1. **Modelos de Dominio y Tipos (`src/types/order.ts`):**
   - Definición de interfaces para `Order`, `PaymentMethod` (efectivo, datáfono, Nequi, Wompi), `DeliveryAddress`, `OrderBreakdown`, `OrderStatus` e `historialEstados`.
2. **Store de Pedidos Persistente (`src/store/orderStore.ts`):**
   - Implementación de Zustand + `persist` en `order-storage` con acciones `createOrder`, `getOrderById`, `cancelOrder` y actualización de estados.
3. **Componentes Modulares de Checkout (`src/components/checkout/`):**
   - `CheckoutHeader.tsx`: Cabecera con navegación de retorno y sello de compra segura.
   - `DeliveryAddressCard.tsx`: Formulario de dirección con sugerencia de geolocalización automática por GPS desde `locationStore`, notas para el repartidor y edición flexible.
   - `PaymentMethodSelector.tsx`: Selector interactivo de medios de pago con diseño neón/cyberpunk (Efectivo al recibir, Datáfono, Transferencia QR Nequi/Bancolombia, Wompi en línea).
   - `OrderSummaryCard.tsx`: Resumen detallado de productos con desglose financiero transparente (Subtotal, Costo de domicilio de la tienda, Tarifa de servicio, Total a pagar) y botón de confirmación.
4. **Página Principal de Checkout (`src/app/(main)/checkout/page.tsx`):**
   - Protección de ruta ante carrito vacío con redirección a `/`.
   - Flujo de creación de orden con vaciado del carrito (`clearCart`), feedback por toasts y pantalla de confirmación exitosa con número de pedido e instrucciones.
5. **Conexión de Flujo en Catálogo (`src/components/stores/StoreView.tsx`):**
   - El botón *"Continuar a checkout"* del `CartDrawer` ahora redirige directamente a `/checkout`.

### Archivos impactados
- `src/types/order.ts`
- `src/types/index.ts`
- `src/store/orderStore.ts`
- `src/components/checkout/CheckoutHeader.tsx`
- `src/components/checkout/DeliveryAddressCard.tsx`
- `src/components/checkout/PaymentMethodSelector.tsx`
- `src/components/checkout/OrderSummaryCard.tsx`
- `src/app/(main)/checkout/page.tsx`
- `src/components/stores/StoreView.tsx`
- `docs/ROADMAP.md`
- `docs/CHANGELOG.md`

## 2026-08-18 — Correcciones Post-Migración TypeScript y Flujo de Ubicación No Bloqueante

### Contexto
- Tras la migración completa a TypeScript, se identificaron errores en el ciclo de hidratación SSR, pérdida de sesión en recarga y desconexión en el renderizado de tiendas en Mapbox.
- Además, el modal de solicitud de permisos de geolocalización bloqueaba permanentemente el mapa en caso de denegación o en dispositivos corporativos.

### Cambios implementados
1. **Resolución de Hydration Mismatch en SSR (`AuthBackground.tsx`):**
   - Se reemplazó la generación aleatoria en tiempo de render por una configuración estática determinista de partículas con soporte táctil (`touchstart`, `touchmove`, `touchend`) y de cursor.
2. **Persistencia de sesión y rehidratación asíncrona (`authStore.ts`, `MainLayoutShell.tsx`, `LoginForm.tsx`):**
   - Se añadió `hasHydrated` y `onRehydrateStorage` en `authStore` para evitar falsos negativos en el AuthGuard.
   - `MainLayoutShell` espera a que termine la rehidratación antes de redirigir a `/login`.
   - `LoginForm` redirige automáticamente a `/` si el usuario ya cuenta con sesión activa.
3. **Flujo de Ubicación Minimizable y No Bloqueante (`LocationPermissionModal.tsx`, `MapContainer.tsx`):**
   - Se añadieron controles de minimización (`X` y botón *"Navegar con ubicación por defecto"*).
   - Se implementó una cápsula flotante persistente en la parte superior del mapa `[ 📍 Permitir ubicación ]` para reactivación inmediata del GPS con 1 solo toque.
   - La navegación en el mapa por defecto y la carga de tiendas se mantienen 100% interactivas.
4. **Restauración de Marcadores Mapbox y Filtrado Híbrido (`StoresLayer.tsx`, `storesStore.ts`, `MapContainer.tsx`):**
   - `StoresLayer.tsx` ahora crea e inserta correctamente las instancias `mapboxgl.Marker` usando `createRoot` para los componentes `StoreMarker`.
   - Se restauró la arquitectura de `masterStores` y `applyFilters` en `storesStore.ts` para filtrado en memoria sin peticiones de red adicionales.
   - `MapContainer.tsx` pasa la referencia `map={map}` y sincroniza eventos `moveend` con umbral de 120m y debounce de 600ms.

### Archivos impactados
- `src/components/auth/AuthBackground.tsx`
- `src/types/auth.ts`
- `src/store/authStore.ts`
- `src/components/layout/MainLayoutShell.tsx`
- `src/components/auth/LoginForm.tsx`
- `src/components/map/LocationPermissionModal.tsx`
- `src/components/map/MapContainer.tsx`
- `src/store/storesStore.ts`
- `src/components/map/layers/StoresLayer.tsx`
- `docs/AI_GUIDELINES.md`
- `docs/APP_FLOW.md`
- `docs/CHANGELOG.md`

## 2026-08-18 — Estrategia de transición Supabase → Spring Boot + regla de abstracción (`b29e5d6`)

### Contexto
- El backend pasará de Supabase a Spring Boot; el front debe sobrevivir al cambio sin reescribir la UI.
- Se fija la regla de oro: el frontend solo consume abstracciones (`src/services/`, stores Zustand); ningún componente habla con el backend directamente.

### Cambios implementados
- `docs/ROADMAP.md`: sección de estrategia de transición por etapas.
- `docs/AI_GUIDELINES.md`: regla de abstracción para futuros cambios.

### Archivos impactados
- `docs/ROADMAP.md`
- `docs/AI_GUIDELINES.md`

## 2026-08-17 — Migración total a TypeScript con tipado estricto, Fase 7.7 (`f6172f6`)

### Contexto
- Decenas de archivos `.js` bajo `src/` impedían un `type-check` estricto y contradecían la documentación.

### Cambios implementados
1. Migración completa `.js` → `.tsx`/`.ts` (páginas, layouts, componentes, stores, lib, data).
2. Eliminado `jsconfig.json`; tipado estricto vigente.
3. Nuevos `src/app/error.tsx`, `src/app/global-error.tsx`, `src/app/not-found.tsx`.

### Archivos impactados
- `src/**/*` (`.js` → `.tsx`/`.ts`)
- `jsconfig.json` (eliminado)
- `src/app/error.tsx`, `src/app/global-error.tsx`, `src/app/not-found.tsx` (nuevos)

## 2026-08-17 — Unificación pnpm + consolidación docs + plan Fase 7.7 (`70079af`)

### Contexto
- Tooling mixto npm/pnpm y documentación dispersa; la migración TS necesitaba plan previo.

### Cambios implementados
1. `pnpm` como gestor único (`pnpm-lock.yaml`, `pnpm-workspace.yaml`; `package.json` actualizado).
2. Consolidación de `docs/` (`AI_GUIDELINES.md`, `PROJECT_GUIDE.md`, `ROADMAP.md`, `CONTEXT.md`) y `README.md`.
3. Plan de la Fase 7.7 de TypeScript registrado en el roadmap.

### Archivos impactados
- `package.json`, `pnpm-lock.yaml`, `pnpm-workspace.yaml`
- `docs/AI_GUIDELINES.md`, `docs/PROJECT_GUIDE.md`, `docs/ROADMAP.md`, `docs/CONTEXT.md`
- `README.md`

> **Nota histórica:** las entradas del 2026-04-07 hacia atrás listan rutas `.js` porque son pre-migración Fase 7.7 (`f6172f6`); el código actual es `.tsx`/`.ts` (cero `.js` bajo `src/`).

## 2026-04-07 — Iconografía de producto en lugar de fotos temporales

### Contexto
- La UI del catálogo y del carrito no tendrá fotos reales de producto por ahora.
- El placeholder visual anterior seguía sugiriendo una imagen faltante cuando en realidad el producto debe representarse mediante iconografía.

### Cambios implementados
- Se reemplazó el enfoque de placeholder de imagen por un componente reutilizable `ProductIcon`.
- `ProductCard`, `ProductModal` y `CartDrawer` ahora representan el producto con un SVG animado consistente.
- Se documentó que las fotos reales de producto quedan planeadas para una fase posterior.

### Archivos impactados
- `src/components/stores/ProductIcon.js`
- `src/components/stores/ProductCard.js`
- `src/components/stores/ProductModal.js`
- `src/components/stores/CartDrawer.js`
- `README.md`
- `docs/CONTEXT.md`
- `docs/FOLDER_STRUCTURE.md`
- `docs/ROADMAP.md`
- `docs/CHANGELOG.md`

## 2026-04-06 — Drawer pre-checkout del carrito (Fase 7.4)

### Contexto
- Tras cerrar la Fase 7.3, el carrito ya era la fuente única de verdad del catálogo, pero todavía faltaba una vista editable previa al checkout.
- El roadmap pedía listado de items, controles de cantidad, eliminación, subtotal y CTA, además de estados de vacío/carga/error y accesibilidad mínima.

### Cambios implementados
- Se añadió `src/components/stores/CartDrawer.js` como drawer reactivo del carrito.
- El drawer consume `items`, `subtotal`, `storeName` y `hasHydrated` desde `cartStore`.
- Se conectó `CartButton` para abrir el drawer en lugar del placeholder previo.
- Cada item del drawer permite:
  - aumentar/disminuir cantidad
  - eliminar con botón explícito
  - eliminar con gesto swipe-left en móvil usando Framer Motion
- La lista usa `AnimatePresence` para colapsar visualmente los items al eliminarlos.
- El subtotal ahora se actualiza con transición numérica suave.
- Se añadió estado de error de sincronización local dentro del drawer para fallos de `updateQuantity` o `removeItem`.

### Estado posterior al cambio
- El usuario ya puede revisar y editar el carrito antes del checkout sin salir de la página de tienda.
- La siguiente etapa natural es conectar el CTA del drawer a un flujo real de checkout (Fase 8).

### Archivos impactados
- `src/app/(main)/store/[slug]/page.js`
- `src/components/stores/CartButton.js`
- `src/components/stores/CartDrawer.js`
- `README.md`
- `docs/ARCHITECTURE.md`
- `docs/CHANGELOG.md`
- `docs/CONTEXT.md`
- `docs/FOLDER_STRUCTURE.md`
- `docs/ROADMAP.md`

## 2026-04-03 — Integración UI del carrito persistente (Fase 7.3)

### Contexto
- La base del carrito persistente ya existía en `cartStore`, pero la página de tienda seguía usando un carrito local temporal.
- Faltaba cerrar la fuente única de verdad del catálogo y conectar el feedback de UX para reglas del carrito y expiración por TTL.

### Cambios implementados
- Se eliminó el estado local del carrito en `src/app/(main)/store/[slug]/page.js`.
- La página de tienda ahora enriquece los productos con contexto de tienda y delega las mutaciones a `cartStore`.
- `ProductModal` y el agregado rápido del catálogo ya operan sobre resultados estructurados del store global.
- `CartButton` pasó a consumir `itemCount` y `subtotal` desde selectores reactivos del carrito.
- Se añadió `src/store/toastStore.js` y `src/components/ui/ToastViewport.js` para feedback no bloqueante del carrito.
- Se conectó `cartNotice` al `layout` protegido para mostrar automáticamente el aviso de expiración tras la rehidratación.
- Se añadió `StoreConflictDialog` para confirmar explícitamente el vaciado del carrito cuando el usuario cambia de tienda.

### Estado posterior al cambio
- La UI principal del catálogo ya usa `cartStore` como fuente única de verdad.
- El usuario recibe feedback visible para agregado, actualización, clamp de cantidad, expiración del carrito y conflicto multi-tienda.
- La siguiente etapa natural es la vista editable/drawer del carrito (Fase 7.4).

### Archivos impactados
- `src/app/(main)/layout.js`
- `src/app/(main)/store/[slug]/page.js`
- `src/components/stores/CartButton.js`
- `src/components/stores/ProductModal.js`
- `src/components/stores/StoreConflictDialog.js`
- `src/components/ui/ToastViewport.js`
- `src/store/toastStore.js`
- `README.md`
- `docs/CONTEXT.md`
- `docs/FOLDER_STRUCTURE.md`
- `docs/ROADMAP.md`

## 2026-03-09 — Base del carrito persistente (Fase 7.1)

### Contexto
- Se cerró la etapa de prueba visual donde el carrito vivía solo como estado local temporal en la página de tienda.
- El proyecto necesitaba pasar a una implementación real y persistente, alineada con la Fase 7.1 del roadmap.

### Cambios implementados
- Se creó `src/store/cartStore.js` como store global de carrito con Zustand.
- Se añadió persistencia en `localStorage` con middleware `persist`.
- Se integró `immer` para mutaciones seguras y legibles sobre estructuras anidadas.
- Se implementó contexto de tienda único para bloquear mezcla de tiendas por defecto.
- Se agregaron derivados persistidos del carrito (`itemCount`, `subtotal`) y metadatos (`lastUpdatedAt`, `version`).
- Se migró el patrón de lectura a selectores/hooks reactivos en lugar de getters imperativos dentro del store.

### Hardening del estado
- Se añadió saneo de shape y migración defensiva del estado rehidratado.
- Se implementó expiración automática de carrito por TTL de 24 horas para evitar carritos “zombie”.
- Se añadió `cartNotice` para que la UI pueda avisar al usuario cuando el carrito expire automáticamente.
- Se añadió `hasHydrated` para controlar en la UI cuándo finaliza la rehidratación del store.

### Estado posterior al cambio
- La base del carrito persistente ya existe y está documentada.
- Aún falta conectar la UI de catálogo (`ProductModal`, `CartButton` y página de tienda) al `cartStore` como fuente única de verdad.
- También queda pendiente mostrar automáticamente el aviso de expiración al volver a abrir la app.

### Archivos impactados
- `src/store/cartStore.js`
- `package.json`
- `package-lock.json`
- `docs/ROADMAP.md`
- `docs/CONTEXT.md`
- `docs/FOLDER_STRUCTURE.md`

## 2026-03-06 — Fix definitivo Safari iOS (CTA "Ver carrito")

### Contexto
- Se reabrió una regresión en móvil iOS Safari: al mostrar el botón flotante de carrito aparecía un bloque/"footer" azul debajo del CTA.
- El problema era crítico en Safari por la barra inferior translúcida/dinámica y el comportamiento de capas con elementos `fixed` animados.

### Causa raíz
- Animar con `transform` el mismo nodo que estaba en `position: fixed` provocaba artefactos de composición en Safari iOS.
- Además, era necesario separar visualmente el bloque del CTA del padding de safe-area inferior.

### Cambios implementados
- `CartButton` refactorizado con patrón en dos capas:
	- contenedor externo estático `fixed` (posición + safe-area)
	- contenedor interno animado (solo transición visual)
- Safe-area inferior desacoplado del color del CTA.
- Soporte de viewport dinámico en la página de tienda con `min-h-screen` + `min-h-[100dvh]`.
- Fallback defensivo de safe-area para iOS legacy con `constant(...)` y `env(...)`.

### Limpieza y hardening
- Se validó que no quedaran workarounds globales que degradaran UX:
	- no se aplicó `overscroll-none` global
	- no se dejaron alturas forzadas en el carrito (ej. `h-[120px]`)
- Se removió un archivo accidental no relacionado (`.vscode/settings.json` en la raíz del workspace).

### Archivos impactados
- `src/components/stores/CartButton.js`
- `src/app/(main)/store/[slug]/page.js`
- `src/app/globals.css`
- `docs/CONTEXT.md`
- `docs/ROADMAP.md`

### Validación
- Confirmado por QA manual en dispositivo real: estable en Safari iOS (incluyendo iOS 26.3), sin bloque azul inferior.
- Comportamiento de desktop preservado.

### Guardrails (anti-regresión)
- No animar con `transform` el mismo nodo que tenga `position: fixed` para CTAs inferiores en iOS Safari.
- Mantener separado el padding de safe-area del bloque visual del botón.
- Evitar hacks globales de scroll para resolver problemas locales de composición.
