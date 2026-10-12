# Arquitectura de Frontend (Mapa + Catálogo + Carrito + Checkout + Tracking/Multi-pedido)

Este documento describe la arquitectura general del frontend actual, incluyendo el módulo de geolocalización, la página de tienda, la base del carrito persistente, el checkout (`app/(main)/checkout` + `components/checkout/*`) y el seguimiento de pedidos (`components/tracking/*` + `order/[id]`).

## 1. Resumen de la Arquitectura

El diseño se centra en un **flujo de datos unidireccional y reactivo**, gestionado por stores de Zustand y orquestado por componentes contenedores. La UI renderiza estado derivado; la lógica de negocio vive en stores y servicios.

- **Frontend:** Next.js (App Router), React, Zustand para estado global (+ `persist` + `immer`), Mapbox GL JS para mapas, Tailwind CSS, framer-motion. Mocks locales sin backend.
- **Componentes Principales:**
    - **`MapContainer` (Orquestador):** Componente crucial que inicializa el mapa. Al montar hace `fetchStores`; en `moveend` aplica debounce 600ms + umbral 120m (`MIN_FETCH_DISTANCE`, MapContainer.tsx:78-96). Los cambios de filtro no disparan refetch: van por `applyFilters` en memoria (filtros en cliente).
    - `FilterBanner`: Muestra los filtros de categorías. Su única responsabilidad es notificar al `filterStore` cuando el usuario cambia una selección.
    - `InfoPanel`: Panel lateral que muestra información contextual (anuncios o detalles de la tienda seleccionada). Solo móvil; en desktop `PageLayout` usa `StoreCard`/`StoresList` + `AdCarousel` (PageLayout.tsx:84-88).
    - `StoresLayer`: Componente "tonto" (presentacional) que recibe una lista de tiendas y las renderiza en el mapa. **No contiene lógica de filtrado**.
    - `app/(main)/store/[slug]/page.tsx`: contenedor de la página de tienda (Server Component → `StoreView` client). Carga tienda/productos con `fetchStoreBySlug`/`fetchProductsByStore` de `services/api.ts` y delega la lógica de carrito al `cartStore` (`useCartSummary`/`addItem` + toasts + `StoreConflictDialog`): delegación cumplida.
    - `ProductModal` y `CartButton`: componentes de UI del catálogo que consumen estado reactivo del carrito mediante selectores reactivos (`CartButton` usa `useCartSummary`; `StoreView`/`ProductModal`/`CartDrawer` usan hooks del store) sin segunda fuente de verdad local.
- **Stores de Zustand (Gestores de Estado):**
    - `locationStore`: Gestiona el estado de la ubicación del usuario y los permisos, con `startTracking`/`stopTracking`, `watchId` e `isTracking`.
    - `storesStore`: Almacena la lista de tiendas, el estado de carga (`isLoading`), y la tienda actualmente seleccionada. Filtra en cliente en memoria (`masterStores` → `stores` vía `applyFilters`); la API solo filtra por radio.
    - `filterStore`: Mantiene el estado de los filtros activos (ej. qué categorías están seleccionadas). **No contiene lógica de aplicación de filtros**.
    - `authStore`: Gestiona sesión mock persistida (key `auth-storage`); el guard es client-only en `MainLayoutShell.tsx`, sin middleware. Login mock con `MOCK_USERS` en `authService`; cero `@supabase` en `src/`.
    - `cartStore`: Gestiona el carrito persistente como **fuente única de verdad**. Mantiene contexto de tienda, items, derivados (`itemCount`, `subtotal`), metadatos de persistencia (`lastUpdatedAt`, `version`, persist key `cart-storage`, TTL 24h, cross-tab sync vía `storageSync`) y estado auxiliar de UX (`cartNotice`, `hasHydrated`).
    - `orderStore`: Gestiona pedidos mock (`orders`, `createOrder` mock, `getOrderById`, `updateOrderStatus`/`cancelOrder`/`rateOrder`, selectores `useActiveOrders`/`useActiveOrdersCount`/`useCompletedOrders`, persist `order-storage`). Base de estado de checkout + tracking.
    - `toastStore`: Gestiona feedback transitorio de UI (toasts) para eventos no bloqueantes como agregado al carrito, clamps de cantidad y avisos de expiración.
- **Capa de Servicios/API:**
    - `services/supabaseClient.ts`: singleton diferido del cliente Supabase (único importador de `@supabase/supabase-js`; Zero-Coupling).
    - `services/api.ts`: catálogo real sobre Supabase. `fetchNearbyStores({lat,lng,radius})` llama al RPC `get_nearby_stores` (filtra por radio y ordena por distancia PostGIS, SIN filtrar por categoría); el filtrado por categoría lo aplica `storesStore` en cliente. `location` llega como EWKB hex y el adaptador lo proyecta a `lat/lng`.

## 1.1 Principio clave del carrito

- El carrito debe modelarse con **datos + acciones** dentro del store.
- Los componentes React no deben depender de getters imperativos internos; deben consumir **selectores/hooks reactivos** exportados desde `cartStore`.
- La expiración por antigüedad (TTL) se resuelve durante la rehidratación del store para evitar carritos persistidos con precio o inventario potencialmente desactualizados.

## 2. Diagrama de Flujo de Datos (Conceptual)

```text
[locationStore] -----+                                  +-----> [masterStores]
                      |                                  |           |
                      v                                  |           v
                (lee estado)                             |     (applyFilters
                      |                                  |      en memoria)
[filterStore] ------> [MapContainer] --(dispara fetch)--> (api.ts) ---+
     ^                    (Orquestador)                 (solo radio)  |
     |                                                               v
(actualiza)                                                      [storesStore]
     |                                                           (derivados
     +---------------- [FilterBanner]                            filtrados)
```

## 3. Flujo de Interacción y Sincronización

1.  **Inicio**: `locationStore` obtiene la ubicación del usuario.
2.  **Orquestación**: `MapContainer` llama a `storesStore.fetchStores({location,filters})` con debounce 600ms / umbral 120m.
3.  **Capa de Datos**: La acción llama a la API (`fetchNearbyStores`), que filtra las tiendas solo por radio.
4.  **Actualización de Estado**: `storesStore` guarda `masterStores` y deriva `stores` ya filtrados vía `applyFilters`.
5.  **Renderizado**: `StoresLayer` detecta el cambio en `storesStore` y renderiza los nuevos marcadores.
6.  **Cambio de Filtro**: Si el usuario interactúa con `FilterBanner`, `filterStore` se actualiza y el cambio se resuelve con `applyFilters` en memoria, sin HTTP.

## 4. Ventajas de esta Arquitectura

- **Separación de Responsabilidades Clara**: Los componentes renderizan, los stores almacenan estado, y los servicios manejan la lógica de negocio y el acceso a datos.
- **Predecible**: El flujo de datos es más fácil de seguir, con `MapContainer` como el punto de partida claro para la carga de datos.
- **Eficiente**: El filtrado por categoría se realiza en cliente en memoria, y los componentes de UI solo se re-renderizan con los datos que necesitan mostrar.
- **Persistencia Segura del Carrito**: la rehidratación sanea shape, versión y antigüedad del carrito antes de exponerlo a la UI.
- **Consistencia de Producto**: el carrito impide mezcla de tiendas (`STORE_CONFLICT`); el checkout ya está implementado (página + 4 componentes).

## 5. Optimizaciones de Render (Febrero 2026)

- **`MapSection` memoizado**: se exporta con `React.memo` para evitar re-renders por propagación desde el layout cuando cambian componentes no relacionados (por ejemplo, el carrusel).
- **Montaje condicional de `InfoPanel` en desktop**: el panel móvil ya no se mantiene montado de forma oculta en escritorio. Matiz: `AdCarousel` de desktop sigue siempre montado (`PageLayout` L73-75); lo condicional es el `InfoPanel` móvil.
- **Suscripciones selectivas a Zustand**: se reemplazaron suscripciones globales (`useStore()`) por selectores puntuales en componentes clave (`MapContainer`, `LocationControlProvider`, `FilterBanner`, `StoresList`, `AppHeader`).

---

## 6. Estado actual del carrito (Abril 2026)

- Ya existe `cartStore` con Zustand + `persist` + `immer`.
- Ya existe expiración automática por TTL de 24 horas usando `lastUpdatedAt`.
- Ya existe `cartNotice` para avisar expiración automática tras reabrir la app.
- Ya conectado: `ProductModal`, agregado rápido, `CartButton` y `cartNotice` usan el store/reactividad esperada.
- Ya existe un `CartDrawer` pre-checkout con lista editable, subtotal reactivo y CTA de continuidad.
- El drawer usa `AnimatePresence` para altas/bajas visuales y gesto móvil de swipe-left para eliminación rápida.

---

## 7. Gestión Multi-Pedido Concurrente y Panel Lateral (Agosto 2026)

Para soportar la realidad de un marketplace de autopartes donde un usuario puede tener **múltiples compras activas en diferentes tiendas al mismo tiempo** (ej. baterías en Tienda A y llantas en Tienda B):

1. **Eliminación del Singleton `activeOrderId` (Enfoque B Puro):**
   - El estado no modela un único ID activo global; las órdenes activas son un subconjunto derivado del arreglo `orders: Order[]`.
   - La orden visualizada en pantalla se determina de forma pura mediante la URL (`/order/[id]`).
2. **Selectores Atómicos Memoizados:**
   - `useActiveOrders()`: Retorna la lista de pedidos en curso (`status !== 'ENTREGADO' && status !== 'CANCELADO'`).
   - `useActiveOrdersCount()`: Retorna un entero primitivo (`number`) para que el botón del `AppHeader` no sufra re-renders por cambios en las propiedades internas de los pedidos.
   - `useCompletedOrders()`: Retorna los pedidos archivados de la sesión.
    - `getOrderById(id)`: Acceso directo indexado para la vista de seguimiento (método del store, vía `useOrderStore.getState().getOrderById`).
3. **Panel Lateral de Navegación (`ActiveOrdersDrawer.tsx`):**
   - Panel Cyberpunk montado en `AppHeader` con pestañas *En Curso (N)* e *Historial (N)*.
   - Permite consultar tiempos estimados (ETA), estado de despacho y acceder al tracking en el mapa de cualquier pedido activo sin perder el contexto de navegación principal.

---

## 8. Principios de Ingeniería para Producción a Gran Escala

Diseñado para operar a gran escala minimizando consumo de batería en móviles, eliminando re-renders innecesarios y previniendo sobrecostos en APIs de mapas y bases de datos:

### 8.1 Telemetría GPS en Tiempo Real (1Hz) vs Estado de Negocio Relacional (futuro, no implementado)
- **El Stream GPS NO es Estado de Negocio:** Las actualizaciones de coordenadas del domiciliario a 1Hz (1 por segundo) **no deben mutar el store relacional de órdenes** 60 veces por minuto, ya que forzaría re-renderizados innecesarios en toda la aplicación.
- **Canal de Renderizado Dedicado:** La telemetría en vivo viaja directamente a una capa de renderizado WebGL/Canvas (`requestAnimationFrame` / `easeTo` en Mapbox) o un store liviano transitorio.
- **Persistencia Periódica:** El `orderStore` y la base de datos PostgreSQL solo registran la última posición conocida en intervalos discretos (cada 15-30s) o en cambios de estado (`RECOGIDO`, `EN_CAMINO`, `ENTREGADO`).

### 8.2 Resiliencia de Hardware Móvil y Ahorro de Batería
- **Apagado Inmediato de Sensores:** Ante denegación de permisos (`PERMISSION_DENIED`), se invoca de inmediato `navigator.geolocation.clearWatch()` para apagar la antena GPS del dispositivo.
- **Modo Pasivo en Zonas de Sombra (Sótanos/Túneles):** Ante pérdida temporal de satélites (`POSITION_UNAVAILABLE` / `TIMEOUT`), se preservan las últimas coordenadas válidas y el sensor permanece en escucha pasiva, reconectando automáticamente en cuanto el usuario sale a la intemperie.
- **Guarda Anti Re-renders:** Filtrado de eventos repetitivos para que Zustand no emita actualizaciones de estado cada 10s mientras el usuario permanezca sin cobertura (`locationStore.ts`: `clearWatch` ante `DENIED`, watcher persistente y guarda anti re-renders ante `POSITION_UNAVAILABLE`/`TIMEOUT`, timeout 10s).

### 8.3 Control de Costes y Rendimiento en Mapas (Mapbox / Google Maps)
- **Instancias Únicas de Mapa:** Se evita la recreación de instancias de mapas en cada ciclo de render (instancia única con cleanup).
- **Deduplicación y Debounce de Viewport:** Los eventos `moveend` aplican debounce 600ms + umbral 120m para evitar peticiones HTTP redundantes a la API de tiendas en movimientos milimétricos.
- **Tiles Vectoriales Cacheados:** Uso de estilos optimizados (`dark-v11`); el cacheo de tiles es comportamiento del navegador/Mapbox, no configuración del repo.

### 8.4 Separación de Client State vs Server Cache (futuro, no implementado)
- **Zustand (Client Session State):** Gestiona el estado interactivo de la sesión en memoria (carrito activo, órdenes en curso, filtros).
- **TanStack Query / SWR (Server Cache, futuro):** No implementado — cero TanStack/SWR en `src/`; no existe `GET /orders?status=completed`. El historial es filtrado en memoria (`useCompletedOrders`) sobre persist local `order-storage`.

---

Este documento sirve como referencia principal para entender la arquitectura del frontend actual. Para detalles del flujo paso a paso, consulta `DATAFLOW.md`.

