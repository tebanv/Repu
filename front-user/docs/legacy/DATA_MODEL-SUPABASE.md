# Modelo de Datos — Supabase (histórico)

> **Documento histórico (2026-10-27).** Este fue el contrato de la etapa Supabase. Ya **no es vigente**: el backend real usa el esquema `repu` de `Arq-Infra/Repo-DB-2.sql` y el modelo actual está en [../DATA_MODEL.md](../DATA_MODEL.md). Se conserva para trazabilidad y para entender los adaptadores legacy. No se añaden features ni cambios de esquema sobre este modelo.

Fuente histórica del esquema para PostgreSQL/PostGIS. Supabase fue el **puente congelado** ([ADR-001](../ADR-001-BACKEND-SPRING.md)); el backend real Spring Boot es ahora el dueño del esquema.
Supersede a `arquitectura/BD_Mall_Virtual.sql` y `Apis_Mall_Virtual_V1.yaml` en el
scope cliente: esos archivos quedan como **referencia de alcance** (checklist para
`front-store`/`front-driver`/`front-admin` futuros), no como DDL vigente.

> Alcance Etapa 1 (slice cliente): `profiles`, `stores`, `products`, `addresses`,
> `orders` (+ items, historial, posiciones del repartidor). Fuera: gateway de pagos,
> carrito server, logs, parámetros, quejas, admin. Ver §7.

## 1. Convenciones (ratificadas una vez, sin excepción)

| Aspecto | Decisión | Razón |
|---|---|---|
| Idioma | Inglés `snake_case` en tablas/columnas | Mapeo 1:1 con `src/types/`; elimina la capa de traducción ES↔EN que causó el riesgo de §13 de `PROJECT_GUIDE` |
| PKs | `id UUID PRIMARY KEY DEFAULT gen_random_uuid()` | Todas las entidades; coincide con el front (`string`) |
| FKs | `*_id UUID REFERENCES` con `ON DELETE` explícito | `RESTRICT` en catálogo (no borrar producto con historial), `CASCADE` en hijos dependientes (items → order) |
| Dinero | `BIGINT` en COP enteros, sin decimales | Igual que `cartStore` (`Math.round`); nada de `NUMERIC(10,2)` ni `float` en JSON |
| Tiempo | `TIMESTAMPTZ DEFAULT now()`; `created_at` + `updated_at` (trigger) en tablas mutables (`profiles`, `stores`, `products`, `addresses`, `orders`); `order_status_history` y `driver_positions` no lo llevan por diseño (append-only / latest-upsert) | Trazabilidad + TTL del carrito + ETAs |
| Geo | `geography(Point,4326)` + índice GiST; **nunca** `lat/lng NUMERIC` sueltos | Búsqueda por proximidad con `ST_DWithin`/`ST_Distance` |
| Estados | Tipos `ENUM` PG (no `VARCHAR` libre) | Un solo vocabulario con el front (§2) |
| Nulos | `NOT NULL` por defecto; nulables reales en DDL: `orders.driver_id`, `products.compare_price`/`sku`/`description`, `stores.description`/`phone`/`logo_url`/`banner_url`, `addresses.details`/`notes`/`location` (`NULL` = sin GPS), `orders.delivery_location`/`notes`/`ratings`, `order_status_history.note`/`created_by` | El DDL deja `NULL` en opcionales de catálogo/dirección/notas; el resto falla rápido en seed, no en producción |
| RLS | `ENABLE ROW LEVEL SECURITY` en todas; policies por tabla (§6) | Supabase expone la DB; sin RLS no hay Etapa 1 |

Vocabulario único de pedido (`order_status`, alineado a `src/types/order.ts` + `APP_FLOW`):

```
CREADO → PAGADO → ACEPTADO → PREPARANDO → LISTO → RECOGIDO → EN_CAMINO → ENTREGADO
                 ↘ RECHAZADO → REEMBOLSADO
                                        ↘ CANCELADO (desde CREADO/PAGADO/ACEPTADO/PREPARANDO)
```

> El front hoy no modela `RECHAZADO/REEMBOLSADO` (`src/types/order.ts` llega a
> `CANCELADO`): al cablear Etapa 1 se extiende `OrderStatus` con esos dos valores
> y exige UI + selectores + tests (`OrderTimeline.tsx`, `ActiveOrdersDrawer`,
> `OrderTrackingHeader`, `orderStore.ts` hoy solo ramifican `ENTREGADO/CANCELADO`).

## 2. Diagrama ER (slice cliente)

```text
auth.users (Supabase Auth, gestionado)
    │ 1:1
    ▼
profiles ──< addresses
    │            ▲ snapshot (JSONB + geography) en orders.delivery_*
    │ 1:N        │
     │         orders ──< order_items >── products ──< stores
     │            │                          │           │
     │            │                          │        (stores.categories TEXT[] battery|tire|spare|shop)
     │            ├──< order_status_history  │
     │            ├──< driver_positions (1:1 latest por order_id, sin driver_id)
     │            └── profiles vía orders.driver_id (nullable: se asigna en ruta)
    └── stores.owner_id (nullable: punto de extensión front-store)
```

## 3. Tablas

### 3.1 `profiles` — perfil ligado a Supabase Auth
```sql
id          UUID PK → auth.users.id (ON DELETE CASCADE)
email       TEXT NOT NULL UNIQUE
name        TEXT NOT NULL
phone       TEXT
avatar_url  TEXT
role        user_role NOT NULL DEFAULT 'comprador'  -- comprador|distribuidor|domiciliario|admin
created_at / updated_at
```
> Roles existen desde día uno como columna (no tabla `roles` con `SERIAL`): los tres
> fronts futuros filtran por ella. Sin tabla de roles separada.
> Gap cerrado en P1 (2026-10-12): `UserRole` del front (`src/types/auth.ts`) es
> idéntico al enum DB (`comprador|distribuidor|domiciliario|admin`), sin capa de
> traducción; `'demo'` no es rol (atajo UX del login contra seeds `comprador`).
> El trigger `0010_handle_new_user` crea el perfil con rol `comprador` en cada signUp.

### 3.2 `stores` — tiendas de autopartes
```sql
id               UUID PK
owner_id         UUID NULL → profiles.id        -- extensión front-store; NULL en Etapa 1
slug             TEXT NOT NULL UNIQUE           -- routing /store/[slug]
name             TEXT NOT NULL
description      TEXT
address          TEXT NOT NULL
city             TEXT NOT NULL DEFAULT 'Medellín'
phone            TEXT
location         geography(Point,4326) NOT NULL -- GiST index
categories       TEXT[] NOT NULL DEFAULT '{}'   -- CHECK ⊆ {battery,tire,spare,shop}
rating           NUMERIC(2,1) NOT NULL DEFAULT 0
total_reviews    INT NOT NULL DEFAULT 0
schedule         JSONB NOT NULL DEFAULT '{}'    -- {monday:{open,close},...}
delivery_fee     BIGINT NOT NULL DEFAULT 0      -- COP enteros
avg_prep_minutes INT NOT NULL DEFAULT 20
logo_url / banner_url  TEXT
is_active        BOOLEAN NOT NULL DEFAULT TRUE
created_at / updated_at
```
Índices: `UNIQUE(slug)`, `GiST(location)`, índice parcial en activas; `GIN(categories)` pendiente (no creado en `0003`, futuro).
RPC Etapa 1: `get_nearby_stores(user_lat, user_lng, radius_m)` → `SETOF stores`
ordenado por `ST_Distance` (ver `ROADMAP`, estrategia Supabase).

### 3.3 `products` — catálogo por tienda
```sql
id                  UUID PK
store_id            UUID NOT NULL → stores.id ON DELETE RESTRICT
sku                 TEXT UNIQUE
name                TEXT NOT NULL
description         TEXT
price               BIGINT NOT NULL CHECK (price >= 0)   -- COP
compare_price       BIGINT NULL CHECK (compare_price >= 0)
brand / reference / category / subcategory  TEXT
stock               INT NOT NULL DEFAULT 0 CHECK (stock >= 0)
is_available        BOOLEAN NOT NULL DEFAULT TRUE
images              TEXT[] NOT NULL DEFAULT '{}'
specs               JSONB NOT NULL DEFAULT '{}'          -- {voltage, amperage, ...}
compatible_vehicles TEXT[] NOT NULL DEFAULT '{}'
created_at / updated_at
```
Índices: `(store_id)`, `(store_id, is_available)`, GIN trgm en `name/reference/brand`
para búsqueda (pg_trgm, Etapa 1).
> Agotado = `is_available=false OR stock=0` como convención de lectura (sin `CHECK`
> que la imponga, no garantía DDL). Cierra el QUIRK de `TESTING §7`:
> el backend nunca vende `stock=0`; el front mantiene su clamp como UX rápida.
> Gap: DB no tiene `maxPerOrder`, `discount`/`originalPrice`, `image` singular,
> `specifications` (alias de `specs`) ni compatibilidad estructurada
> (`makes/models/years`); solo `compatible_vehicles TEXT[]`. Ver §4 (mapeo parcial).

### 3.4 `addresses` — direcciones reutilizables del comprador
```sql
id           UUID PK
user_id      UUID NOT NULL → profiles.id ON DELETE CASCADE
label        TEXT NOT NULL              -- Casa, Taller, ...
street       TEXT NOT NULL
details      TEXT                       -- apto, referencias
city         TEXT NOT NULL
notes        TEXT                       -- notas al domiciliario
location     geography(Point,4326) NULL -- NULL = sin GPS
is_default   BOOLEAN NOT NULL DEFAULT FALSE
created_at / updated_at
```
Índice: `(user_id)`. Regla implementada por trigger `ensure_single_default_address` en `0005` (función + `TRIGGER AFTER INSERT OR UPDATE`): un solo `is_default` por usuario.
Gap: `DeliveryAddress` del front (`order.ts`) no tiene `label`/`is_default`; el adaptador debe definirlos.

### 3.5 `orders` — pedido (desnormalización deliberada)
```sql
id               UUID PK
order_number     TEXT NOT NULL UNIQUE               -- REP-2026-XXXX (humano; Order.id del front ↔ orders.order_number; orders.id UUID interno sin equivalente en el front)
user_id          UUID NOT NULL → profiles.id
store_id         UUID NOT NULL → stores.id ON DELETE RESTRICT
driver_id        UUID NULL → profiles.id            -- se asigna en ruta
status           order_status NOT NULL DEFAULT 'CREADO'
payment_method   payment_method NOT NULL            -- cash|card_delivery|wompi|nequi|transfer (= front, verdadero)
payment_status   payment_status NOT NULL DEFAULT 'PENDING'  -- PENDING|PAID|FAILED|REFUNDED en DB; el front hoy solo PENDING|PAID (FAILED/REFUNDED = extensión Etapa 1 pendiente)
subtotal / delivery_fee / service_fee / discount / total  BIGINT NOT NULL  -- breakdown parcial: el front (OrderBreakdown) no tiene discount (DB discount DEFAULT 0); checkout fija serviceFee=0
delivery_address JSONB NOT NULL                     -- snapshot {street,details,city,notes}
delivery_location geography(Point,4326) NULL
notes            TEXT
store_rating / driver_rating SMALLINT NULL CHECK (1..5)
rating_comment   TEXT NULL
estimated_delivery_minutes INT NOT NULL DEFAULT 25
created_at / updated_at
```
Índices: `UNIQUE(order_number)`, `(user_id, created_at DESC)`, `(store_id, status)`,
`(driver_id, status)` (futuro front-driver).

### 3.6 `order_items` — snapshot transaccional (nunca FK viva a precio/stock)
```sql
id          UUID PK
order_id    UUID NOT NULL → orders.id ON DELETE CASCADE
product_id  UUID NOT NULL → products.id ON DELETE RESTRICT
name        TEXT NOT NULL        -- snapshot al comprar
price       BIGINT NOT NULL      -- snapshot al comprar (COP)
quantity    INT NOT NULL CHECK (quantity >= 1)
```
> Precio/nombre copiados, no referenciados: el historial sobrevive a cambios de catálogo.
> `CartItem.image`/`stockSnapshot`/`maxPerOrder` se descartan al crear el pedido.

### 3.7 `order_status_history` — trazabilidad (= `stateHistory` del front)
```sql
id          BIGSERIAL PK
order_id    UUID NOT NULL → orders.id ON DELETE CASCADE
status      order_status NOT NULL
note        TEXT
created_by  UUID NULL → profiles.id   -- tienda/sistema; NULL = sistema
created_at  TIMESTAMPTZ DEFAULT now()
```
Índice: `(order_id, created_at)`. Cada `updateOrderStatus` inserta aquí en la misma
transacción que actualiza `orders.status`. `created_by NULL` = sistema (ya en DDL);
ningún código del front la escribe aún (`orderStore` es mock en memoria): pendiente de cableado.

### 3.8 `driver_positions` — última posición conocida (Heurística A)
```sql
order_id    UUID PK → orders.id ON DELETE CASCADE
location    geography(Point,4326) NOT NULL
updated_at  TIMESTAMPTZ DEFAULT now()
```
Upsert por `order_id` cada 15–30s. **Sin historial 1Hz en relacional**: el stream vivo
va por Supabase Realtime (canal efímero); tabla de historial particionada con
retención de 30 días solo como nota futura (fuera de Etapa 1).

## 4. Mapeo front (`src/types/`) ↔ DB — spec de adaptadores

| Front | DB | Notas |
|---|---|---|
| `Store.id/slug/name` | `stores.id/slug/name` | Directo |
| `Store.lat/lng` | `ST_Y(location)/ST_X(location)` | El adaptador proyecta; la UI jamás ve `geography` |
| `Store.categories` | `stores.categories` | Mismo vocabulario `battery/tire/spare/shop` |
| `Store.deliveryInfo {fee, avgPrepTime}` | `stores.delivery_fee/avg_prep_minutes` | Nuevo (hoy mock) |
| `Store.schedule` | `stores.schedule` JSONB | Mismo shape |
| `Product.*` | `products.*` parcial | `price/compare/stock/images/specs/compatibleVehicles`; gaps §3.3 (sin `maxPerOrder`/`discount`/`image`/`specifications`/compat estructurada) |
| `CartItem {productId,name,price,quantity}` | `order_items` al crear pedido | Snapshots, no FK viva; `image`/`stockSnapshot`/`maxPerOrder` se descartan |
| `Order.id` | `orders.order_number` | `orders.id` (UUID) es interno sin equivalente; el front sigue viendo `REP-…` |
| `Order.status/breakdown/payment*` | parcial, mismos nombres | Faltan `RECHAZADO/REEMBOLSADO`, `FAILED/REFUNDED`, `discount` (ver §3.5) |
| `Order.stateHistory` | `order_status_history` | `status/timestamp/note`; `created_by NULL` = sistema |
| `Order.driver/driverCoordinates` | `profiles(driver_id)` + `driver_positions` | Hoy mock embebido; en Etapa 1, join — insuficiente para `DriverInfo` (`vehicleType`/`vehiclePlate`/rating/avatar): requiere extensión del perfil conductor o tabla `driver` |
| `DeliveryAddress` | `addresses` + snapshot en `orders` | `coordinates ↔ location`; gaps `label`/`is_default` (ver §3.4) |
| `Store.id/slug/name` (+ gaps) | `stores.id/slug/name` | El front no tiene `address`/`phone`/`is_active`; `logo/banner` vs `logo_url`/`banner_url`; `stats.totalOrders` vs `total_reviews` |
| `authStore.user` (+ roles) | `profiles` vía Supabase Auth | `authService` real (P1); JWT custodiado por `supabase-js` fuera de `localStorage`; roles directos sin traducción (ver §3.1) |

Regla Zero-Coupling intacta: este mapeo vive **solo** en `src/services/`; cambiar una
columna no toca componentes ni stores.

## 5. Decisiones tomadas (vs legado)

1. **Carrito local + validación server** (`POST /cart/validate` antes de pagar), no
   `carritos/elementos_carrito` en DB. El `cartStore` probado (47 tests) sigue vigente;
   el server valida stock/precios y corrige. Sin carrito de invitados en DB ni TTL duplicada.
2. **PostGIS desde día uno** (columna `geography` + GiST + RPC), no `NUMERIC` sueltos.
3. **Telemetría fuera de la tabla transaccional** (latest-upsert + Realtime), no INSERT 1Hz.
4. **Dinero entero COP** en DB y API (nada de `NUMERIC(10,2)`/`float`).
5. **Un enum de estados** compartido front↔DB como objetivo Etapa 1 (finiquita los 3 vocabularios del legado; hoy el front está incompleto: faltan `RECHAZADO/REEMBOLSADO`, `FAILED/REFUNDED` y los roles difieren — ver §3.1/§3.5).
6. **Rating embebido en `orders`** (como el front) en vez de tabla de reviews; tabla real post-product-market-fit.
7. **`order_number` humano único** además del UUID interno (trazabilidad telefónica/tienda).

## 6. RLS (esqueleto Etapa 1; SQL completo en migraciones)

- `stores`, `products`: lectura pública (`SELECT` con `is_active`/`is_available`); escrituras de catálogo por `service_role` (futura `front-store` con policies por `owner_id`).
- `profiles`: el usuario lee/actualiza solo su fila (`auth.uid() = id`).
- `addresses`, `orders`, `order_items`, `order_status_history`: dueño (`user_id = auth.uid()`) + lectura de tienda/driver por venir (policies por `store.owner_id`/`driver_id`, fuera de Etapa 1); el dueño puede dar de alta pedido + items + historial en la misma transacción (`order_items_owner_write`, `order_history_owner_write` en `0007`).
- `driver_positions`: lectura del comprador del pedido (`buyer-read` en `0007`); escritura `service_role` (driver/service por venir); Realtime con misma policy.

## 7. Fuera de Etapa 1 (registrado, no olvidado)

`pagos` gateway (webhooks Wompi), historial GPS, `reviews`, `logs`, `parámetros`,
`quejas/soporte`, gestión `owner_id`/roles admin, multi-tienda en un pedido (el front
y el modelo exigen **una tienda por pedido**). Todo con punto de extensión anotado arriba.

## 8. Siguiente paso

Migraciones SQL numeradas (`supabase/migrations/`) generadas **desde este documento**:
`0001_enums → 0002_profiles → 0003_stores → 0004_products →
0005_addresses → 0006_orders → 0007_rls → 0008_rpc_nearby → 0009_seed_dev →
0010_handle_new_user` (trigger auto-creación de perfil al signUp, P1) →
`0011_handle_new_user_search_path` (fix: `SECURITY DEFINER` + `search_path = public` y tabla calificada; sin esto el signUp abortaba con "Database error saving new user").
Ningún SQL vive fuera de migraciones; ningún cambio de esquema sin actualizar este doc.
`0009` es solo seed de catálogo Medellín/Envigado, idempotente, sin usuarios ni pedidos.

> **Nota 2026-10-28:** el directorio `supabase/migrations/` ya no está presente en el workspace (tampoco figura en el índice de git). Esta serie se conserva solo como referencia histórica; el DDL canónico vigente es `Arq-Infra/Repo-DB-2.sql`.

## 9. Auditoría del legado (2026-09-16, preservada como justificación)

Revisión de `arquitectura/` (backend externo, sin mirar desde su entrega) contra la
magnitud Repu (marketplace 4 frentes + tracking vivo). Veredicto: **reconstruir el DDL
del slice cliente; legado como checklist de alcance, no como base.**

- Rescatable: cobertura 4 roles, UUIDs + `timestamptz`, `pagos.detalle_respuesta_ext JSONB`, `historial_estados_pedido` (≈ `stateHistory`), endpoints por actor en OpenAPI.
- Crítico: sin PostGIS (lat/lng `NUMERIC` sueltos, sin GiST/RPC); telemetría 1Hz como INSERT relacional sin índice ni retención; carrito 100% server sin regla una-tienda ni TTL; dinero `NUMERIC/float`; **3 vocabularios de estados** (SQL vs OpenAPI vs front); IDs `SERIAL` mezclados con UUID; faltan `slug`, `rating`, `schedule` estructurado, `delivery_fee`, `specs/compatibilidad`, `breakdown` con `service_fee`.
- Roto: `podman-compose.yml` monta `./schema.sql` inexistente; tablas sin esquema `marketplace`; credenciales default + token de ejemplo en el diagrama; diagrama solo cubre front/Vercel (`lat default 89.0` errónea); OpenAPI sin endpoint de tiendas por radio, sin `cart/validate`, sin webhooks, `security` con sintaxis inválida.

## 10. Vigencia y traspaso a Spring Boot (2026-10-19)

Decisión histórica [ADR-001](../ADR-001-BACKEND-SPRING.md): Supabase se congela como puente; Spring Boot en Docker es el gateway final y el dueño del esquema. Ver [ADR-002](../ADR-002-BACKEND-MICROSERVICES.md) para el alcance vigente.

- **Esquema canónico:** este documento sigue siendo la fuente única. El backend Spring lo implementará con **Flyway**.
- **Migraciones portables:** `0001`–`0009` son referencia directa para Flyway. `0010_handle_new_user` y `0011_handle_new_user_search_path` son específicas de Supabase Auth y se retiran al migrar a Spring Security/JWT.
- **RLS:** las policies de `0007` dependen de `auth.uid()` y solo tienen sentido mientras Supabase exponga PostgREST. Si Spring es el único gateway, la seguridad se mueve a la capa de servicio y RLS se retira o se adapta a roles de DB.
- **Sin cambios solo-Supabase:** no se añaden tablas, columnas, RPC ni triggers que no estén reflejados aquí y que no puedan implementarse en Spring.
- **Datos existentes:** planificar export/import de Supabase al PostgreSQL del backend antes del apagado.
- **Gaps a cerrar antes del contrato:** `RECHAZADO/REEMBOLSADO`, `payment_status FAILED/REFUNDED`, `discount`, `addresses.label/is_default`, datos de vehículo del conductor, `maxPerOrder`, regla de `stock: 0`, `order_number` vs UUID e idempotencia.
- **Legacy:** `arquitectura/BD_Mall_Virtual.sql` y `Apis_Mall_Virtual_V1.yaml` no son DDL/contrato vigentes; solo checklist de alcance.
