# Roadmap

Único documento de estado y pendientes del proyecto. El detalle de lo ya hecho está en [CHANGELOG.md](./CHANGELOG.md); la decisión de orden, en [ADR-002](./ADR-002-BACKEND-MICROSERVICES.md).

Última revisión contra el código: 2026-11-04.

## 1. Estado por dominio

| Dominio | Backend | Front | Estado |
|---|---|---|---|
| Mapa, geolocalización y filtros | — | `MapContainer`, `locationStore`, `storesStore`, `filterStore` | Funcional |
| Auth | `ms-auth`, `ms-users` | `authService`, `httpClient` | Migrado y verificado en servidor por HTTP; falta TLS |
| Catálogo | `ms-companies`, `ms-products`, `ms-categories` | `api.ts` sobre Supabase | **Siguiente corte**; backend ya expone slug, SKU, marca y roles; faltan activos, categorías y datos |
| Carrito | `ms-orders` | `cartStore` local persistente | Funcional en local; sin validación de servidor |
| Checkout y pedidos | `ms-orders` | `orderStore` mock | Mock |
| Pagos | `ms-manage-payment` | Wompi simulado | Mock |
| Tracking | `ms-orders` (SSE) | Avance manual local | Mock |
| Perfil y direcciones | `ms-users` | Sin UI | Pendiente |

## 2. Corte al backend real

El orden es **auth → catálogo → pedidos → tracking**, sin escrituras duales. Cada corte cambia `src/services/`, `src/types/` y variables de entorno; no cambia la UI ni la interfaz pública de los stores.

### 2.1 Auth

Lo pendiente está en [AUTHENTICATION.md](./AUTHENTICATION.md) §9.

### 2.2 Catálogo

- [ ] Cerrar los bloqueantes de catálogo de [BACKEND.md](./BACKEND.md) §7:
  - [x] Tienda por slug: `GET /api/companies/{slug}` público.
  - [x] `sku` como texto y `marca` expuesta en `ms-products`.
  - [x] Roles de `ms-products` alineados con `rol_sistema` (`DISTRIBUIDOR`/`COMPRADOR`).
  - [ ] Categorías por tienda: el backend expone `categoryId`, pero falta nombre/lista y mapeo a `StoreCategory`.
  - [ ] Filtro de activos en `ms-companies` y `ms-products`.
  - [ ] Datos de prueba de catálogo en `Repo-DB-2.sql`.
- [ ] Eliminar `fetchProductById` (sin consumidores) y hacer que el checkout cargue la tienda con el `storeSlug` del carrito en lugar de `fetchStoreById`.
- [ ] Reimplementar las funciones restantes de `api.ts` con `httpClient` y adaptadores de `empresas`/`productos` a `Store`/`Product` ([DATA_MODEL.md](./DATA_MODEL.md) §6).
- [ ] Añadir `rewrites` de desarrollo para `/ms-companies`, `/ms-products` y `/ms-categories` (hoy solo existen los de auth y users).
- [ ] Convertir el radio: el front usa metros y `ms-companies` espera `radiusKm` entero.
- [ ] Cambiar la regla de agotado: hoy `stock: 0` significa "sin límite" ([TESTING.md](./TESTING.md) §4), y en `productos` el inventario vale 0 por defecto.
- [ ] Retirar `@supabase/supabase-js`, `supabaseClient.ts` y las variables `NEXT_PUBLIC_SUPABASE_*`, también de `Dockerfile` y de los archivos Compose.

### 2.3 Pedidos y pagos

- [ ] Cerrar el mapeo de estados y dinero ([DATA_MODEL.md](./DATA_MODEL.md) §6).
- [ ] Crear `orderService` contra `ms-orders` con idempotencia de checkout; `orderStore` deja de ser la fuente transaccional.
- [ ] Definir la relación entre `cartStore` y el carrito de servidor, sin dos fuentes de verdad.
- [ ] Integrar `ms-manage-payment` después de resolver su autenticación ([BACKEND.md](./BACKEND.md) §7).

### 2.4 Tracking

- [ ] Crear `subscribeToOrderTracking` en `src/services/` sobre el SSE de `ms-orders`, respetando las reglas de telemetría de [AI_GUIDELINES.md](./AI_GUIDELINES.md) (heurística A).

### 2.5 Salida de Supabase

- [ ] Apagar Supabase o dejarlo como archivo.
- [ ] Marcar como cumplidos los criterios de salida de [ADR-001](./ADR-001-BACKEND-SPRING.md) que sigan aplicando.

## 3. Transversal

- [ ] **Seguridad:** rotar las claves de Mapbox y Supabase y la contraseña de base de datos que circuló por chat. El detalle está al inicio de [CHANGELOG.md](./CHANGELOG.md).
- [ ] **HTTPS en Traefik:** bloquea el login estable en producción.
- [ ] **OpenAPI 3.1 del backend:** hoy el contrato se deduce del código y de Postman.
- [ ] **`pnpm lint`:** roto porque `eslint-config-next@15.2.2` no soporta TypeScript 7.
- [ ] **Código sin uso:** retirar `src/data/products.ts`, que ya no tiene consumidores.
- [ ] **Limpieza del repositorio:** decidir si `front-user/roster-backups/` (55 archivos) y los gitlinks de `front-user/worktrees/` deben seguir versionados.

## 4. Producto (después de los cortes)

- [ ] Pantallas `/orders` (historial) y `/profile` (datos y direcciones).
- [ ] UI de registro y de recuperación de contraseña; el servicio ya existe, pero no hay pantallas.
- [ ] Búsqueda dentro del catálogo de una tienda.
- [ ] Fotos reales de producto en catálogo, modal y carrito.
- [ ] Regla de capacidad logística: limitar el carrito por peso, volumen o vehículo de reparto.
- [ ] Eventos de analítica del carrito: `cart_item_added`, `cart_item_removed`, `cart_quantity_updated`, `cart_cleared`, `cart_store_conflict`. Hoy solo existe `cart_expired`.
- [ ] Métodos de pago reales; el tipo admite cinco y la UI solo ofrece Wompi.
- [ ] Notificaciones push y SMS/WhatsApp.
- [ ] Frentes `front-store`, `front-driver` y `front-admin`.
