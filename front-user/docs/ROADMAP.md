# Roadmap

Único documento de estado y pendientes del proyecto. El detalle de lo ya hecho está en [CHANGELOG.md](./CHANGELOG.md); la decisión de orden, en [ADR-002](./ADR-002-BACKEND-MICROSERVICES.md).

Última revisión contra el código: 2026-11-04.

## 1. Estado por dominio

| Dominio | Backend | Front | Estado |
|---|---|---|---|
| Mapa, geolocalización y filtros | — | `MapContainer`, `locationStore`, `storesStore`, `filterStore` | Funcional |
| Auth | `ms-auth`, `ms-users` | `authService`, `httpClient` | Migrado y verificado en servidor por HTTP; falta TLS |
| Catálogo | `ms-companies`, `ms-products`, `ms-categories` | `api.ts` sobre los microservicios | Front cortado (2026-11-04); falta el smoke en navegador y retirar Supabase. Backend: faltan filtro de activos, categorías de autopartes y datos ([§2.2](#22-catálogo)) |
| Carrito | `ms-orders` | `cartService` + `cartStore` (caché optimista) | Sincronizado con el servidor en código y pruebas (2026-11-05); falta el smoke. Backend: C1–C5 mejoran el rendimiento ([PLAN-PEDIDOS.md](./PLAN-PEDIDOS.md)) |
| Checkout y pedidos | `ms-orders` | `orderStore` mock | Mock |
| Pagos | `ms-manage-payment` | Wompi simulado | Mock |
| Tracking | `ms-orders` (SSE) | Avance manual local | Mock |
| Perfil y direcciones | `ms-users` | Sin UI | Pendiente |

## 2. Corte al backend real

El orden es **auth → catálogo → pedidos → tracking**, sin escrituras duales. Cada corte cambia `src/services/`, `src/types/` y variables de entorno; no cambia la UI ni la interfaz pública de los stores.

### 2.1 Auth

Lo pendiente está en [AUTHENTICATION.md](./AUTHENTICATION.md) §9.

### 2.2 Catálogo

El plan de ejecución está en [PLAN-CATALOGO.md](./PLAN-CATALOGO.md).

- [x] Backend: tienda por slug, `sku` como texto, `marca` expuesta y `categoryId` en empresas (2026-11-04).
- [ ] Backend: catálogo de autopartes real. Hoy el servidor tiene 7 empresas de prueba, casi todas de comida, y una de baterías con productos ([BACKEND.md](./BACKEND.md) §7).
- [x] Front: pasos 1 a 6 del plan (transporte, adaptadores, checkout por slug, reset de carritos y pruebas) (2026-11-04).
- [ ] Smoke en servidor.
- [ ] Retirar Supabase del front.

### 2.3 Pedidos y pagos

Carrito y checkout: plan en [PLAN-PEDIDOS.md](./PLAN-PEDIDOS.md) (pasos 1–6 hechos, 2026-11-05). Pagos y tracking siguen simulados.

- [ ] Cerrar el mapeo de estados y dinero ([DATA_MODEL.md](./DATA_MODEL.md) §6).
- [ ] Crear `orderService` contra `ms-orders` con idempotencia de checkout; `orderStore` deja de ser la fuente transaccional.
- [x] Relación entre `cartStore` y el carrito del servidor: el servidor es la fuente y el store su caché optimista (2026-11-05).
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
- [ ] **Limpieza del repositorio:** decidir si `front-user/roster-backups/` (55 archivos) y los gitlinks de `front-user/worktrees/` deben seguir versionados.

## 4. Producto (después de los cortes)

- [ ] Pantallas `/orders` (historial) y `/profile` (datos y direcciones).
- [ ] UI de registro y de recuperación de contraseña; el servicio ya existe, pero no hay pantallas.
- [ ] Búsqueda dentro del catálogo de una tienda.
- [ ] Fotos reales de producto en catálogo, modal y carrito. El backend ya envía `images`; falta mostrarlas, y es un cambio visual.
- [ ] **Costo de envío real:** hoy no se conoce y se muestra "por confirmar" sin sumarlo al total. Requiere definir con backend dónde vive (`operationalConfig.delivery.fee` u otra regla, como distancia o zona) y cobrarlo en el checkout de `ms-orders`.
- [ ] Regla de capacidad logística: limitar el carrito por peso, volumen o vehículo de reparto.
- [ ] Eventos de analítica del carrito: `cart_item_added`, `cart_item_removed`, `cart_quantity_updated`, `cart_cleared`, `cart_store_conflict`. Hoy solo existe `cart_expired`.
- [ ] Métodos de pago reales; el tipo admite cinco y la UI solo ofrece Wompi.
- [ ] Notificaciones push y SMS/WhatsApp.
- [ ] Frentes `front-store`, `front-driver` y `front-admin`.
