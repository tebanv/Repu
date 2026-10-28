# Repu — front-user

Frontend cliente de **Repu**, una app de delivery de repuestos automotrices construida con **Next.js App Router**, **React**, **TypeScript**, **Zustand**, **Tailwind CSS** y **Mapbox GL JS**.

Este README es el punto de encuentro de la documentación del front. El backend real ya está en el repositorio (`Backend/`): siete microservicios Spring Boot en Docker. El front ya migró **auth** a `ms-auth`/`ms-users`; el catálogo sigue en Supabase como legado transitorio hasta su corte.

---

## 1. Qué es este proyecto

`front-user` es la aplicación del cliente final. Permite actualmente:

- autenticación contra `ms-auth`/`ms-users` con cookie `HttpOnly` y sesión persistida (smoke verificado en entorno de pruebas; servidor pendiente)
- exploración de tiendas en mapa
- filtrado de tiendas por categoría
- navegación al catálogo de una tienda
- carrito global persistente con Zustand
- checkout mock con pago Wompi simulado
- seguimiento de pedido con timeline y mapa (simulación local)
- multi-pedido concurrente y panel de pedidos activos

Estado actual del producto:

| Área | Estado |
|---|---|
| Mapa y descubrimiento | Funcional |
| Catálogo | Funcional contra Supabase (legado transitorio) |
| Carrito global | Persistente e integrado |
| Checkout | Mock (Wompi simulado) |
| Tracking | Mock local, sin realtime |
| Auth | Migrado a `ms-auth`/`ms-users` y verificado en entorno de pruebas; smoke en servidor pendiente |
| Backend | Microservicios Spring Boot reales (`Backend/`), ver [BACKEND.md](docs/BACKEND.md) |

Para la visión funcional completa revisa [docs/APP_FLOW.md](docs/APP_FLOW.md).

---

## 2. Inicio rápido

### Requisitos

- Node.js 20.9+
- pnpm (versión fijada en `packageManager`; no usar npm/yarn)
- Docker + Docker Compose para el backend real

### Variables de entorno

```bash
cp .env.example .env.local
```

Completar en `.env.local`:

```env
NEXT_PUBLIC_MAPBOX_TOKEN=

# Corte de auth (propuestas; server-only, no NEXT_PUBLIC)
AUTH_API_ORIGIN=http://localhost:8081
USERS_API_ORIGIN=http://localhost:8082

# LEGADO transitorio: solo catálogo hasta su corte.
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

> `AUTH_API_ORIGIN`/`USERS_API_ORIGIN` ya están en `.env.example` y alimentan los `rewrites` dev de `next.config.js`. Las variables `NEXT_PUBLIC_SUPABASE_*` son legado y desaparecen al cortar catálogo. Nunca commitear `.env.local`.

### Desarrollo

```bash
pnpm install
pnpm dev
```

Abrir http://localhost:3000. Para auth con cookie, el front y los micros deben compartir host (Traefik) o usar los `rewrites` dev-only de Next.

### Backend

```bash
docker compose -f docker-compose-infra.yaml up -d --build
docker compose -f docker-compose-apps.yaml up -d --build
```

Detalle de servicios, rutas, variables y smoke tests: [docs/BACKEND.md](docs/BACKEND.md).

---

## 3. Stack principal

- **Framework:** Next.js 16 (App Router)
- **Gestor de paquetes:** pnpm
- **UI:** React 19
- **Estado global:** Zustand (+ `persist`, `immer`)
- **Mapas:** Mapbox GL JS
- **Estilos:** Tailwind CSS v4
- **Animaciones:** Framer Motion
- **Backend real:** 7 microservicios Spring Boot WebFlux + Traefik + PostgreSQL/PostGIS + Redis
- **Auth:** `ms-auth` (token opaco en cookie `httpOnly`) + `ms-users` (perfil)
- **Legado:** Supabase (solo catálogo hasta su corte)

Para decisiones técnicas y organización general revisa [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) y [docs/ADR-002-BACKEND-MICROSERVICES.md](docs/ADR-002-BACKEND-MICROSERVICES.md).

---

## 4. Estado de las áreas clave

### Autenticación

- backend implementado: `ms-auth` (login/logout/sesiones) + `ms-users` (perfil); smoke verificado en entorno de pruebas; servidor pendiente
- front migrado: `httpClient` + `authService` contra `ms-auth`/`ms-users`; tests ejecutados (68/68), `type-check` y `build` correctos
- cookie `__Host-repu_session` (`HttpOnly/Secure/SameSite=Lax`); el web ignora `accessToken`
- chips demo aún apuntan a seeds de Supabase: reemplazar por usuarios Spring o retirar (decisión pendiente)
- guard client-side en `MainLayoutShell` con gate de rehidratación
- **bloqueante de producción:** HTTPS en Traefik para que la cookie `Secure` persista

Ver [docs/AUTHENTICATION.md](docs/AUTHENTICATION.md).

### Mapa y descubrimiento

- geolocalización de usuario
- mapa interactivo con tiendas cercanas
- filtros por categoría
- arquitectura híbrida de datos para tiendas

Ver [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md), [docs/DATAFLOW.md](docs/DATAFLOW.md), [docs/PROJECT_GUIDE.md](docs/PROJECT_GUIDE.md).

### Catálogo y carrito

- página de tienda por `slug`
- `ProductGrid`, `ProductCard`, `ProductModal`
- `cartStore` global como fuente única de verdad
- persistencia + TTL 24 h + multi-tab
- drawer pre-checkout con `+/-`, eliminar y subtotal reactivo
- iconografía SVG; fotos reales quedan para después
- catálogo aún en Supabase (legado); carrito local

Ver [docs/ROADMAP.md](docs/ROADMAP.md), [docs/PROJECT_GUIDE.md](docs/PROJECT_GUIDE.md), [docs/APP_FLOW.md](docs/APP_FLOW.md).

### Backend

- `ms-auth`, `ms-users`, `ms-companies`, `ms-products`, `ms-categories`, `ms-orders`, `ms-manage-payment`
- Traefik same-origin; PostgreSQL schema `repu`; Redis
- contrato verificado en [docs/BACKEND.md](docs/BACKEND.md)
- falta OpenAPI publicado; la colección Postman es la referencia ejecutable

---

## 5. Dónde leer según el tema

| Si quieres ver... | Revisa primero |
|---|---|
| Visión general del producto y flujo del usuario | [docs/APP_FLOW.md](docs/APP_FLOW.md) |
| Guía completa, arquitectura explicada y estado | [docs/PROJECT_GUIDE.md](docs/PROJECT_GUIDE.md) |
| Arquitectura frontend y responsabilidades | [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) |
| Flujo de datos entre stores, UI y servicios | [docs/DATAFLOW.md](docs/DATAFLOW.md) |
| Estructura de carpetas | [docs/FOLDER_STRUCTURE.md](docs/FOLDER_STRUCTURE.md) |
| Roadmap por fases | [docs/ROADMAP.md](docs/ROADMAP.md) |
| Autenticación y migración a `ms-auth` | [docs/AUTHENTICATION.md](docs/AUTHENTICATION.md), [docs/PLAN-LOGIN-MS-AUTH.md](docs/PLAN-LOGIN-MS-AUTH.md) |
| Backend real: servicios, rutas y contratos | [docs/BACKEND.md](docs/BACKEND.md) |
| Decisión de backend por microservicios | [docs/ADR-002-BACKEND-MICROSERVICES.md](docs/ADR-002-BACKEND-MICROSERVICES.md) |
| Decisión histórica Supabase → Spring | [docs/ADR-001-BACKEND-SPRING.md](docs/ADR-001-BACKEND-SPRING.md) |
| Modelo de datos real (`repu`) | [docs/DATA_MODEL.md](docs/DATA_MODEL.md) |
| Modelo Supabase histórico | [docs/legacy/DATA_MODEL-SUPABASE.md](docs/legacy/DATA_MODEL-SUPABASE.md) |
| Pruebas | [docs/TESTING.md](docs/TESTING.md) |
| Historial de cambios | [docs/CHANGELOG.md](docs/CHANGELOG.md) |
| Reglas para asistentes IA | [docs/AI_GUIDELINES.md](docs/AI_GUIDELINES.md) |

---

## 6. Mapa rápido del código

### Rutas principales

- `src/app/(auth)/login/page.tsx`
- `src/app/(main)/page.tsx`
- `src/app/(main)/store/[slug]/page.tsx`
- `src/app/(main)/checkout/page.tsx`
- `src/app/(main)/order/[id]/page.tsx`

### Stores principales

- `src/store/authStore.ts`
- `src/store/locationStore.ts`
- `src/store/filterStore.ts`
- `src/store/storesStore.ts`
- `src/store/cartStore.ts`
- `src/store/orderStore.ts`
- `src/store/toastStore.ts`

### Servicios / adaptadores

- `src/services/api.ts` (catálogo, legado Supabase)
- `src/services/authService.ts` (auth contra `ms-auth`/`ms-users`)
- `src/services/httpClient.ts` (transporte HTTP común)
- `src/services/geolocationService.ts`
- `src/services/supabaseClient.ts` (solo catálogo legado)

### Backend

- `Backend/ms-auth`
- `Backend/ms-users`
- `Backend/ms-orders`
- `Arq-Infra/Repo-DB-2.sql`
- `Arq-Infra/Repu.postman_collection.json`
- `docker-compose-apps.yaml`, `docker-compose-infra.yaml`

Para el detalle completo revisa [docs/FOLDER_STRUCTURE.md](docs/FOLDER_STRUCTURE.md).

---

## 7. Credenciales de prueba

Los chips demo actuales del `LoginForm` apuntan a seeds de Supabase:

- `admin@mallvirtual.com` / `admin123`
- `usuario@demo.com` / `user123`
- `demo@demo.com` / `demo123`

> **No sirven para `ms-auth`**: `Arq-Infra/Repo-DB-2.sql` no incluye seed de usuarios. Antes del corte hay que crear usuarios reales en la BD `repu` (incluido un `ANALISTA` y uno inactivo) y actualizar o retirar los chips. Detalle en [docs/PLAN-LOGIN-MS-AUTH.md](docs/PLAN-LOGIN-MS-AUTH.md) §5.

---

## 8. Convenciones importantes

- Antes de cambiar código, revisar la documentación de `docs/`.
- Usar **solo `pnpm`**.
- Respetar **Zero-Coupling**: UI y stores no importan SDKs; todo acceso pasa por `src/services/`.
- Una sola fuente de verdad por dominio (carrito, auth, tiendas, pedidos).
- No añadir features nuevas sobre Supabase; es legado transitorio.
- `ms-auth` es la única autoridad de sesión; el web no lee ni guarda `accessToken`.
- No modificar diseño sin aprobación explícita.
- Documentar cambios relevantes en `CHANGELOG.md` y docs afectados.

Ver reglas completas en [docs/AI_GUIDELINES.md](docs/AI_GUIDELINES.md).

---

## 9. Lectura sugerida para ponerse al día

1. [docs/PROJECT_GUIDE.md](docs/PROJECT_GUIDE.md)
2. [docs/APP_FLOW.md](docs/APP_FLOW.md)
3. [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
4. [docs/BACKEND.md](docs/BACKEND.md)
5. [docs/ADR-002-BACKEND-MICROSERVICES.md](docs/ADR-002-BACKEND-MICROSERVICES.md)
6. [docs/AUTHENTICATION.md](docs/AUTHENTICATION.md)
7. [docs/PLAN-LOGIN-MS-AUTH.md](docs/PLAN-LOGIN-MS-AUTH.md)
8. [docs/DATA_MODEL.md](docs/DATA_MODEL.md)
9. [docs/FOLDER_STRUCTURE.md](docs/FOLDER_STRUCTURE.md)
10. [docs/DATAFLOW.md](docs/DATAFLOW.md)
11. [docs/ROADMAP.md](docs/ROADMAP.md)
12. [docs/TESTING.md](docs/TESTING.md)

---

## 10. Estado documental

- **Última actualización:** 2026-10-28 (verificación de auth, suite ejecutada y estado real del backend).
- **Fuentes de verdad:** código de `Backend/`, `Arq-Infra/Repo-DB-2.sql`, `Arq-Infra/Repu.postman_collection.json`.
- **Pendiente:** OpenAPI 3.1 del backend, TLS en Traefik, smoke de auth en servidor, chips demo y cortes de catálogo/pedidos/tracking.
