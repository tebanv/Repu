# ADR-001 — Backend final Spring Boot; Supabase congelado como puente

> **Actualización 2026-10-27:** esta decisión se conserva como **histórica**. El backend real ya está en `Backend/` como siete microservicios Spring Boot y Supabase quedó fuera del camino crítico. El alcance vigente lo fija [ADR-002](./ADR-002-BACKEND-MICROSERVICES.md); este documento mantiene el contexto de por qué se congeló Supabase y qué criterios de salida siguen siendo válidos. Las referencias a `arquitectura/` corresponden al material que hoy vive en `Arq-Infra/` (`Repo-DB-2.sql`, `Apis_Mall_Virtual_V2.yaml`).

- **Estado:** Aceptada; sustituida en alcance por [ADR-002](./ADR-002-BACKEND-MICROSERVICES.md) (2026-10-27)
- **Fecha:** 2026-10-19
- **Ámbito:** `front-user` + contrato de backend
- **Relacionados:** [ARCHITECTURE.md](./ARCHITECTURE.md), [ROADMAP.md](./ROADMAP.md), [DATA_MODEL.md](./DATA_MODEL.md), [AUTHENTICATION.md](./AUTHENTICATION.md), [DATAFLOW.md](./DATAFLOW.md)

## Contexto

Supabase se adoptó para desbloquear el frontend cuando no había desarrollador backend disponible. Hoy cubre tres responsabilidades:

1. PostgreSQL + PostGIS administrado.
2. Supabase Auth (`supabase-js`, `auth.users`, trigger `0010`, RLS con `auth.uid()`).
3. Acceso a datos vía PostgREST/RPC (`get_nearby_stores`, tablas `stores`/`products`).

El desarrollador backend ya está en el equipo y el backend real —Spring Boot contenerizado con Docker— se integrará en el entorno local. La copia actual de `arquitectura/` está desactualizada y no representa ese backend.

Mantener Supabase como destino final tendría dos costes evitables: acoplamiento al proveedor (auth, realtime, storage) y duplicación de trabajo si después se migra todo a Spring. El riesgo real es que el “paso intermedio” se vuelva permanente por inercia.

## Decisión

1. **Spring Boot en Docker es el gateway final y único** para el frontend. Toda llamada de red del cliente pasará por `src/services/` hacia la API Spring.
2. **Supabase se congela en el punto actual.** No se añaden funcionalidades nuevas que dependan de Supabase Auth, Realtime, Edge Functions o Storage, ni cambios de esquema que solo existan en Supabase. El catálogo y el auth actuales siguen operativos como puente hasta el corte.
3. **Contrato primero.** El contrato objetivo es OpenAPI 3.1 derivado de `src/types/` + `docs/DATA_MODEL.md`. `arquitectura/Apis_Mall_Virtual_V1.yaml` queda como checklist de alcance, no como contrato vigente.
4. **Pedidos fuera de Supabase.** `createOrder` sigue mock local hasta que Spring exponga los endpoints de pedidos. No se implementa un `createOrder` transitorio sobre PostgREST.
5. **Realtime fuera de Supabase.** El tracking usará SSE o STOMP/WebSocket desde Spring. `subscribeToOrderTracking` vivirá en `src/services/`; ni la UI ni los stores conocen el transporte.
6. **Auth destino: Spring Security + JWT.** Preferencia: access token corto + refresh en cookie `httpOnly` y proxy same-origin para evitar CORS/CSRF complejos. El contrato de `authService`/`authStore` se mantiene; solo cambia su implementación interna.
7. **Migraciones propiedad de Spring.** Flyway será la fuente única del esquema. Las migraciones `0001`–`0009` sirven como referencia portable; `0010`/`0011` (trigger de Supabase Auth) y las policies RLS son específicas de Supabase y se retiran o adaptan al cortar la auth.
8. **Corte por dominio, no big bang:** catálogo → auth → pedidos → realtime. Sin escrituras duales ni dos fuentes de verdad.

## Consecuencias

### Positivas

- Se evita construir dos veces auth, pedidos y realtime.
- El front conserva su arquitectura: Zero-Coupling, stores y tipos no se reescriben.
- El esquema PostgreSQL/PostGIS es portable; el conocimiento queda en migraciones y documentación.
- La seguridad puede endurecerse con sesión server-side y guard en Next.js.
- El equipo backend tiene un contrato estable y testeado desde el día uno.

### Costes y riesgos

- Convivencia temporal de dos stacks (Supabase actual + Spring en integración).
- La migración de auth no es solo cambiar `fetch`: cambia la semántica de sesión (refresh, cookies, CSRF, expiración, multi-tab).
- RLS, triggers de `auth.users` y `auth.uid()` no son portables tal cual.
- Hay que decidir y migrar datos existentes de Supabase al PostgreSQL del backend.
- CORS y cookies entre front y API requieren proxy inverso o configuración explícita.
- El contrato legacy en español puede inducir al backend a reimplementar un modelo distinto; debe marcarse como referencia histórica.

## Criterios de salida (Definition of Done)

- [ ] Spring expone catálogo, auth, pedidos y tracking con contrato OpenAPI 3.1 acordado.
- [ ] El front consume únicamente `src/services/`; no quedan imports de `@supabase/supabase-js` ni variables `NEXT_PUBLIC_SUPABASE_*` (salvo flag transitorio documentado).
- [ ] Login/logout/refresh funcionan contra Spring; guard server-side o cookie `httpOnly` verificado.
- [ ] Pedidos persistidos en PostgreSQL; `orderStore` deja de ser la fuente transaccional.
- [ ] Tracking funciona con SSE/STOMP desde Spring; sin Supabase Realtime.
- [ ] Flyway es el único dueño del esquema; migraciones Supabase archivadas.
- [ ] `pnpm test`, `pnpm type-check` y `pnpm build` verdes; smoke test de los flujos críticos.
- [ ] Supabase apagado o reducido a solo lectura/archivo.

## Plan de corte

1. **Congelar y contratar:** cerrar OpenAPI 3.1 y los gaps de dominio (`RECHAZADO/REEMBOLSADO`, `FAILED/REFUNDED`, `discount`, `addresses.label/is_default`, conductor, `stock: 0`, idempotencia).
2. **Esqueleto Spring en Docker:** PostgreSQL/PostGIS, Flyway, Spring Security, springdoc, healthchecks y Compose.
3. **Catálogo:** `fetchNearbyStores`, `fetchStoreBySlug`, `fetchProductsByStore` contra REST; adaptadores conservan `Store`/`Product`.
4. **Auth:** reescribir solo `authService`; decidir cookie `httpOnly` vs bearer; migrar `profiles` y eliminar dependencia de `auth.users`.
5. **Pedidos:** `orderService` + endpoints; reemplazar el mock local; definir idempotencia y paginación.
6. **Realtime:** SSE/STOMP y `subscribeToOrderTracking`.
7. **Retirar Supabase:** limpiar claves, migraciones y documentación transitoria.

## Alternativas consideradas

- **Mantener Supabase Auth y validar sus JWT en Spring (JWKS):** acelera el corte, pero mantiene la identidad atada al proveedor y complica el autoalojamiento. Válida solo si la prioridad absoluta es velocidad.
- **Construir pedidos/realtime en Supabase y migrar todo después:** rechazada; duplica trabajo y alarga la vida del puente.
- **Supabase autoalojado como destino final:** rechazada; el objetivo es un backend Spring propio en Docker.

## Notas operativas

- Supabase **no se apaga hoy**: el front sigue funcionando con el puente actual.
- El merge del backend real se hace en el entorno local del equipo, fuera de este repositorio; este ADR fija el contrato, no la ubicación del código backend.
- El pendiente de seguridad de `CHANGELOG.md` (rotar Mapbox/Supabase y sacar `.env.local` del historial) sigue vigente hasta completarse.
