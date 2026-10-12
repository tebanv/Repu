# Guía del Proyecto — Repu (front-user)

Documento pensado para **humanos**: explica cómo está construido el frontend, qué hace cada pieza, cómo se orquestan, cuáles son las fases siguientes y una opinión honesta del estado actual. Complementa (no reemplaza) los documentos técnicos de `docs/`.

---

## 1. Qué es esto

**Repu** es una plataforma de delivery de repuestos automotrices: el cliente ve tiendas de autopartes cercanas en un mapa, entra al catálogo de una tienda, arma un carrito y (en el futuro) paga y sigue su pedido en tiempo real.

Este repositorio (`front-user`) es **la aplicación del cliente final**. Según el diseño de producto, habrá además `front-store` (tienda), `front-driver` (repartidor) y `front-admin` — aún no existen.

**Estado actual resumido:**

| Área | Estado |
|---|---|
| Login con persistencia de sesión | Funcional (mock) |
| Mapa + geolocalización + filtros | Funcional |
| Página de tienda / catálogo | Funcional |
| Carrito global persistente | Funcional e integrado en la UI |
| Checkout | Funcional (mock): `app/(main)/checkout/page.tsx` + 4 componentes `components/checkout/` + `orderStore.createOrder`; el CTA del drawer navega a `/checkout` |
| Pedidos y tracking | Funcional (mock, sin realtime): `app/(main)/order/[id]/page.tsx` + 7 componentes `components/tracking/` + `orderStore` (`createOrder`/`getOrderById`, máx. 20 órdenes) |
| Backend real | Pendiente (todo es mock local) |

---

## 2. Stack y por qué

| Tecnología | Rol |
|---|---|
| Next.js (App Router) | Framework, rutas, layouts — versión fijada `16.3.1-canary.20` |
| TypeScript | Tipado estricto en toda la aplicación y contratos de dominio — `7.0` |
| pnpm | Gestor de paquetes `11.22.0` (versión fijada en `packageManager`; scripts de build aprobados explícitamente en `pnpm-workspace.yaml`) |
| React 19 | UI |
| Zustand | Estado global (simple, reactivo, con persistencia) |
| Tailwind CSS | Estilos `v4` (tema oscuro cyberpunk/neón) |
| Framer Motion | Animaciones |
| Mapbox GL JS | Mapa interactivo |
| Immer | Mutaciones seguras del carrito |

Datos reales de catálogo vía `src/services/api.ts` (Supabase); mocks restantes en `src/services/authService.ts` y `src/data/products.ts` (este último ya sin consumidores tras la migración de `api.ts`). En la raíz del workspace (`arquitectura/`) ya existe el contrato del backend futuro: OpenAPI (`Apis_Mall_Virtual_V1.yaml`, Spring Boot + JWT) y esquema PostgreSQL (`BD_Mall_Virtual.sql`).

---

## 3. Estructura de carpetas

```
src/
├── app/                    # Rutas (Next.js App Router)
│   ├── (auth)/login/       # Login (grupo público)
│   ├── (main)/             # Grupo protegido (requiere sesión)
│   │   ├── page.tsx        # Página principal: el mapa
│   │   ├── checkout/       # Checkout (page.tsx + flujo de pago mock)
│   │   └── store/[slug]/   # Catálogo de una tienda
│   │   └── order/[id]/     # Tracking del pedido (page.tsx)
│   ├── layout.tsx          # Layout raíz (fuentes, metadata, viewport)
│   └── globals.css         # Estilos y utilidades globales
├── components/
│   ├── auth/               # LoginForm.tsx, AuthBackground, MagneticBackground, AuthFieldContext
│   ├── layout/             # Estructura de la página principal (header, mapa, panel) + MainLayoutShell.tsx
│   ├── map/                # Mapbox: MapContainer, marcadores, capas, controles
│   ├── stores/             # Catálogo y carrito: ProductCard, CartDrawer, etc. + StoreView.tsx
│   ├── checkout/           # CheckoutHeader, DeliveryAddressCard, PaymentMethodSelector, OrderSummaryCard
│   ├── tracking/           # Header, Map, Timeline, DriverCard, DetailsAccordion, RatingModal, ActiveOrdersDrawer
│   └── ui/                 # Genéricos: AdCarousel, LoadingIndicator, ToastViewport
├── store/                  # Stores Zustand (el "cerebro" de la app), incl. orderStore.ts + __tests__
├── services/               # Acceso a datos externos (hoy mock)
├── lib/                    # Constantes y utilidades puras, incl. analytics.ts + storageSync.ts (+ __tests__)
├── types/                  # Contratos de dominio (8 ficheros, incl. order.ts)
└── data/                   # Catálogo mock de productos
```

---

## 4. Arquitectura en tres capas

El principio central es el **flujo de datos unidireccional y reactivo**:

```
UI (componentes) ── lee estado con selectores ──► Stores Zustand
      │                                                  ▲
      │ dispara acciones                                 │ actualiza
      ▼                                                  │
Stores ── llaman ──► Servicios (api, auth, geolocalización)
```

Reglas de oro:

1. **Los componentes renderizan; no deciden lógica de negocio.** La lógica vive en los stores y servicios.
2. **Una sola fuente de verdad por dominio.** Ejemplo: el carrito vive solo en `cartStore`; los componentes lo consumen con selectores/hooks reactivos, nunca con estado local duplicado.
3. **Selectores específicos.** Cada componente se suscribe solo a lo que usa para evitar re-renders.
4. **Resultados estructurados.** Las acciones del carrito devuelven `{ ok, code, message?, ... }` para que la UI decida qué feedback mostrar.

---

## 5. Rutas y autenticación

- **`(auth)`** y **`(main)`** son route groups de Next.js: no afectan la URL, solo organizan layouts.
- `src/app/(main)/layout.tsx` monta el **guard de sesión real en `components/layout/MainLayoutShell.tsx`** (doble capa): espera la rehidratación, si no hay sesión redirige a `/login`; mientras verifica muestra un spinner ("Verificando credenciales..."). Este shell también monta el `ToastViewport` global y escucha `cartNotice` para avisar automáticamente si el carrito expiró al reabrir la app.
- **`authStore`** (Zustand + `persist`, key `auth-storage`): guarda `user` e `isAuthenticated` en localStorage. `login()` delega en `authService` (mock con 3 usuarios: `admin@mallvirtual.com/admin123`, `usuario@test.com/user123`, `demo@demo.com/demo`, password `demo`). Acciones reales: `login`, `logout`, `clearError`, `setHasHydrated` (+ `useAuthHasHydrated`); no existe `updateUser`. En `authService` los stubs preparados son `verifyToken`/`getCurrentUser`/`register`/`requestPasswordReset`.

> Nota de producción: la sesión en localStorage y el guard client-side son aceptables para prototipo, pero el diseño final debería usar JWT (idealmente en cookie httpOnly) y verificación server-side.

---

## 6. Stores Zustand (el cerebro)

| Store | Estado | Acciones | Quién lo consume |
|---|---|---|---|
| `authStore` | `user`, `isAuthenticated`, `isLoading`, `error` | `login`, `logout`, `clearError`, `setHasHydrated` | Layout `(main)` vía `MainLayoutShell`, `LoginForm`, `AppHeader` |
| `locationStore` | `userCoordinates`, `permissionStatus`, `isLocating`, `error` | `requestPermission`, `setUserCoordinates`/`setUserLocation`, setters | `MapContainer`, `LocationControlProvider` |
| `storesStore` | `masterStores` (todas), `stores` (filtradas), `selectedStoreId`, `isLoading`, `error` | `fetchStores`, `applyFilters`, `selectStore`, `clearSelection` | Mapa, listas, paneles |
| `filterStore` | `activeFilters` (Set de categorías) | `toggleFilter`, `clearFilters` | `FilterBanner`, `MapContainer` |
| `cartStore` | Ver sección 9 | Ver sección 9 | `StoreView`, página de tienda, checkout, `ProductModal`, `CartButton`, `CartDrawer` |
| `toastStore` | `toasts[]` | `pushToast`, `dismissToast`, `clearToasts` | Todos los flujos de feedback |
| `orderStore` | Pedidos mock (máx. 20), `createOrder`/`getOrderById` | `createOrder`, `getOrderById`, `useActiveOrdersCount` | Checkout, `order/[id]`, `AppHeader` |

### 6.1 El patrón híbrido de `storesStore` (importante)

- `fetchStores({ location, filters })` pide a la API **todas** las tiendas del área y las guarda en `masterStores`; en la misma operación aplica los filtros y guarda el resultado visible en `stores`.
- `applyFilters(filters)` **no llama a la API**: re-filtra `masterStores` en memoria. Cambiar de filtro es instantáneo.
- Ventaja: la red solo se usa cuando el usuario se mueve geográficamente; los filtros son pura lógica cliente.

---

## 7. Módulo de mapa: orquestación

Piezas y responsabilidades:

- **`PageLayout`** (`components/layout/`): arma la pantalla principal. Desktop: columna izquierda (filtros + lista de tiendas + anuncios) y mapa a la derecha; móvil: filtros arriba, mapa, y panel inferior de 200px con `StoreCard` o `AdCarousel`.
- **`MapSection`**: wrapper memoizado de `MapContainer` (aisla el mapa de re-renders del layout).
- **`MapContainer`** (`components/map/MapContainer.tsx`): **el orquestador**. Hace cuatro cosas:
  1. **Inicializa Mapbox una sola vez** (import dinámico, estilo `dark-v11`, token de `NEXT_PUBLIC_MAPBOX_TOKEN`) y limpia la instancia al desmontar.
  2. **Centra el mapa** cuando llega la ubicación del usuario (`flyTo`, zoom 15).
  3. **Carga datos por movimiento**: escucha `moveend` con debounce de 600ms y un umbral de 120m entre centros — si el usuario apenas se desplaza, no refetch. Al disparar, llama `fetchStores` con el centro y los filtros vigentes (vía ref).
  4. **Reacciona a filtros**: cuando cambia `activeFilters`, llama `applyFilters` (sin red).
- **`StoresLayer`**: componente "tonto". Recibe `stores` del store y crea marcadores Mapbox con contenido React (`StoreMarker`) usando `createRoot`. Separa dos efectos: recrear marcadores solo cuando cambia la lista, y re-renderizar solo la selección cuando cambia `selectedStoreId` (optimización deliberada).
- **`StoreMarker`**: pin neón con animación; accesible por teclado (`role="button"`, `aria-label`, Enter/Espacio).
- **`LocationControlProvider` + `LocationButton`**: patrón render-prop: el provider centraliza permisos (`locationStore` + `geolocationService`) y el botón es presentación pura. El `LocationPermissionModal` está ACTIVO (`showPermissionPrompt` + `dismiss` + botón persistente "Permitir ubicación").
- **`FilterBanner`**: botones de categorías (`battery`, `tire`, `spare`) con iconos SVG animados; solo llama `toggleFilter`.
- **`StoresList` / `InfoPanel` / `StoreCard`**: vista alternativa en lista (desktop) y tarjeta de detalle al seleccionar un pin. `StoreCard` navega a `/store/[slug]`.

Flujo completo:

```
permiso ubicación → locationStore.userLocation
        ↓
MapContainer centra el mapa → flyTo
        ↓
moveend (debounce + umbral) → storesStore.fetchStores(centro, filtros)
        ↓
api.fetchNearbyStores → masterStores + stores (ya filtradas)
        ↓
StoresLayer renderiza pins → clic → selectStore(id)
        ↓
InfoPanel/PageLayout muestran StoreCard → "Ir a la tienda" → /store/[slug]
```

---

## 8. Módulo de tienda / catálogo

Ruta: `src/app/(main)/store/[slug]/page.tsx` (wrapper que delega en `components/stores/StoreView.tsx`, contenedor real del flujo carrito: `handleGridAddToCart`/`handleModalAddToCart`, `onCheckout` → `router.push('/checkout')`).

- La página carga tienda (`fetchStoreBySlug`) y productos (`fetchProductsByStore`) con estados de loading, error y "tienda no encontrada".
- **`StoreHeader`**: banner holográfico, logo, rating, estado abierto/cerrado (calculado del `schedule`), costo de envío y tiempo de preparación.
- **`ProductGrid` → `ProductCard`**: grid responsivo; la tarjeta muestra iconografía SVG (`ProductIcon`, porque las fotos reales quedan diferidas), precio, descuento y botón "Agregar" (agregado rápido).
- **`ProductModal`**: detalle con specs, compatibilidad y selector de cantidad; al confirmar llama `onAddToCart` de la página y solo se cierra si la acción resultó exitosa.
- **`StoreConflictDialog`**: si el carrito tiene productos de otra tienda, `addItem` responde `STORE_CONFLICT` y la página muestra este diálogo: "Vaciar y continuar" o cancelar.

La página es el **contenedor** del flujo de carrito: traduce los resultados del store a toasts y orquesta modal/drawer/diálogo. El estado del carrito no vive en ella.

---

## 9. Módulo de carrito (la pieza más madura)

`src/store/cartStore.ts` — Zustand + `persist` (localStorage, key `cart-storage`) + `immer`.

### 9.1 Modelo de estado

```
storeId, storeSlug, storeName     ← contexto de tienda única
items[]                           ← { productId, name, price, image,
                                     quantity, stockSnapshot, maxPerOrder }
itemCount, subtotal               ← derivados persistidos
lastUpdatedAt, version            ← metadatos (TTL, migraciones)
cartNotice, hasHydrated           ← estado auxiliar NO persistido (UX)
```

### 9.2 Reglas de negocio implementadas

- **Una tienda por carrito**: si llega un producto de otra tienda → resultado `STORE_CONFLICT` (la UI decide; hoy muestra confirmación para vaciar y reemplazar).
- **Integridad de cantidades**: mínimo 1, máximo según `stockSnapshot` y `maxPerOrder`; si excede, devuelve `QUANTITY_CLAMPED` y la UI avisa.
- **Saneo de persistencia**: al rehidratar se valida shape, se desechan items corruptos y se recalculan derivados; si la versión no coincide, reseteo limpio.
- **TTL anti "carritos zombie"**: si `lastUpdatedAt` supera 24h (o no existe y hay items), el carrito se vacía automáticamente y se expone `cartNotice`; el layout `(main)` lo convierte en toast de advertencia.
- **Redondeo monetario**: precios y subtotal como enteros COP (`Math.round`) para evitar drift.
- **Idempotencia**: las mutaciones son atómicas dentro de `set` con immer.

### 9.3 Lectura desde React (solo hooks, nunca getters)

```
useCartSummary()          → { storeId, items, itemCount, subtotal, ... }
useCartItem(productId)    → item puntual
useIsSameCartStore(id)    → compatibilidad de tienda
useCartNotice()           → aviso de expiración
useCartHasHydrated()      → fin de rehidratación
```

### 9.4 UI conectada

- **`CartButton`**: CTA flotante inferior; aparece solo si `itemCount > 0`; muestra contador y subtotal. Implementa el **guardrail iOS Safari**: wrapper externo `fixed` estático (posición + safe-area) y capa interna animada — no animar `transform` sobre el nodo `fixed`.
- **`CartDrawer`**: drawer pre-checkout. Estados: cargando (rehidratación), vacío, cargado y error de sincronización. Controles `+/-`, eliminar por botón y por gesto swipe-left en móvil (Framer Motion), subtotal animado con spring, cierre por `Escape`, foco inicial en el botón de cerrar, `aria-live` para anuncios. El CTA "Continuar a checkout" ya navega a `/checkout` (no es placeholder).
- **`ToastViewport`**: notificaciones globales (`success/info/warning/error`) montadas en el layout `(main)`.

---

## 10. Datos y servicios (todo mock, por diseño)

| Servicio | Qué hace hoy | Futuro |
|---|---|---|
| `services/api.ts` | Supabase real: `fetchNearbyStores` por RPC `get_nearby_stores`, resto por tablas `stores`/`products` (adaptadores EWKB→lat/lng) | `createOrder` transaccional + Realtime (contrato en `arquitectura/Apis_Mall_Virtual_V1.yaml`) |
| `services/authService.ts` | Login contra 3 usuarios mock; `verifyToken`, `getCurrentUser`, `register` preparados | JWT real contra Spring Boot |
| `services/geolocationService.ts` | Wrapper de `navigator.geolocation` (promise) | Sin cambios |
| `data/products.ts` | ~20 productos con specs, compatibilidad y stock | Reemplazar por datos del backend |
| `lib/constants.ts`, `lib/geoUtils.ts` | Constantes (defaults, permisos, errores) y geo-math | Crecer |
| `lib/analytics.ts`, `lib/storageSync.ts` | Telemetría (`track('cart_expired')`) y sincronización multi-tab | Crecer |

**Decisiones técnicas documentadas:** filtrado híbrido (cliente/API), mapa con estilo oscuro, iconografía SVG en vez de fotos (fase posterior), toasts en lugar de feedback acoplado a modales.

---

## 11. Rendimiento y guardrails (no romper)

- `MapSection` memoizado; suscripciones selectivas en componentes críticos.
- `moveend` con debounce + umbral de 120m para no refetchear por desplazamientos cortos.
- `StoresLayer` separa recreación de marcadores de actualización de selección.
- `AdCarousel` sin ticks de alta frecuencia (solo cambia slide por intervalo).
- **iOS Safari**: CTA inferior = wrapper `fixed` estático + capa animada; safe-area desacoplado del color del botón (`mobile-safe-area-screen`, `safe-bottom-pad`); vista de tienda con `min-h-screen` + `min-h-[100dvh]`. No reintroducir hacks globales de scroll.
- **Proceso**: no modificar diseño sin aprobación explícita; no duplicar fuentes de verdad; documentar cambios (ver `docs/AI_GUIDELINES.md`).

---

## 12. Siguientes fases (según `docs/ROADMAP.md`)

1. **Cierre de Fase 7 (carrito) — completado**:
   - Sincronización multi-tab YA hecha (`lib/storageSync.ts` + `__tests__`).
   - Telemetría YA hecha (`lib/analytics.ts` con `track('cart_expired')` + test).
2. **Fase 7.7 — Migración Completa a TypeScript — COMPLETADA**:
   - `tsconfig.json`, modelos centrales en `src/types/` y stores/servicios/componentes en `.ts`/`.tsx` migrados; suite Vitest creada.
3. **Fase 8 — Checkout — YA EXISTE (base mock)**:
   - Vista de resumen, dirección con `locationStore`, pago wompi/efectivo, `createOrder`; el CTA del drawer navega a `/checkout`. Redefinir la fase como validación server-side `POST /cart/validate` pendiente + realtime.
4. **Fase 9 — Pedidos y tracking — YA EXISTE base mock**:
   - `order/[id]`, mapa/header/timeline/DriverCard/RatingModal de seguimiento, sin Supabase Realtime. Redefinir como realtime + repartidor vivo.
5. **Otras pantallas del diseño**: `/product/[id]`, `/cart`, `/orders`, `/profile` — siguen inexistentes (no hay pages), mantener.
6. **Fotos reales de producto** en catálogo, modal y carrito.
7. **Backend real**: migrar `api.ts`/`authService.ts` al contrato OpenAPI existente.

---

## 13. Opinión sincera (estado del proyecto y rumbo)

### Lo que está muy bien

- **La disciplina de estado es de nivel producción.** `cartStore` es la mejor pieza del código: saneo de rehidratación, TTL, resultados estructurados (`ok/code/message`), límites de cantidad, redondeo monetario y selectores reactivos son exactamente los patrones correctos para un carrito de e-commerce. Muchos proyectos reales no llegan a esto.
- **La documentación es excelente** y además es *normativa* (AI_GUIDELINES obliga a seguirla). El mapa mental del proyecto se reconstruye en minutos.
- **Las decisiones de rendimiento están documentadas y justificadas** (memo, selectores, umbrales), y hay guardrails anti-regresión (Safari iOS) con checklist de QA.
- **El contrato de backend ya existe** (OpenAPI + SQL en `arquitectura/`), así que el norte técnico está definido.

### Lo que me preocupa

1. **Los mocks siguen siendo el riesgo principal, pero ya hay pruebas.** Existe suite Vitest (cart/auth/stores/order/analytics/storageSync; 47 tests de referencia): ampliar cobertura, no montarla desde cero. Cada cambio al carrito —la lógica con más reglas— ya tiene red de protección básica; seguir extendiéndola es lo primero.
2. **El riesgo de "UI sobre supuestos".** Catálogo, precios, stock y auth son datos inventados. Al conectar el backend real, es probable que el shape de datos cambie (el YAML usa `productoId`, `distribuidorId`, UUIDs; el front usa `id`, `storeId`, strings). Cuanto más se construya sobre el mock, más cara la migración.
3. **Auth de prototipo**: localStorage + guard client-side. Para producción hay que mover el token fuera del localStorage y verificar en servidor. Está previsto en los docs, pero conviene no dejarlo para el final.
4. **Multi-tab ya resuelto**: `lib/storageSync.ts` sincroniza el carrito entre pestañas; quitarlo de preocupaciones.
5. **Orquestación concentrada en `MapContainer`**: funciona, pero mezcla init de Mapbox, debounce, umbrales y refs. Cuando llegue búsqueda por dirección, clustering o tracking en vivo, ese archivo va a pedir refactor a hooks/testeables.
6. **Detalles de pulido**: branding acotado (header y metadata ya dicen "Repu"; "Mall Virtual" solo sobrevive en emails mock y nombres de `arquitectura/*.sql`), tildes faltantes en textos del drawer; el CTA de checkout ya navega.

### ¿Daría un giro? El rumbo que yo seguiría

No daría un giro radical: **la arquitectura está bien orientada y el problema no es de diseño sino de orden de prioridades**. Mi orden sería:

1. **Tests antes que nuevas features**: la suite Vitest ya existe (cubrir `cartStore`: agregar/mergear, conflicto de tienda, límites, TTL, rehidratación corrupta, y extender a checkout/tracking). Después, cualquier cambio al carrito queda protegido.
2. **Fijar los contratos de datos con el backend** (el YAML ya existe): si el backend no está listo, al menos crear una capa de adaptadores (`api.ts` real vs mock) que respete los shapes del OpenAPI para que el switch no rompa UI.
3. **Checkout (Fase 8) con validación server-side como requisito de entrada** — sin esto, el carrito local "se miente" sobre stock y precios.
4. **Auth seria** al momento de conectar backend (JWT en cookie httpOnly, refresh, guard server-side).
5. **Fase 9 (tracking en vivo)**: es el diferenciador real del producto ("Uber de repuestos"); todo lo anterior es infraestructura para llegar aquí.

En una frase: **el proyecto está sanamente construido para la etapa en la que está; el siguiente salto de calidad no viene de más UI sino de tests, contratos de datos reales y el backend conectado.**
