# Flujo de Datos e Interacción (Mapa + Carrito)

Este documento describe el flujo de datos actualizado para reflejar la implementación de la **estrategia híbrida de filtrado** del mapa y la nueva base del **carrito persistente**.

El cambio principal es la introducción de una **Lista Maestra (`masterStores`)**: La API descarga todas las tiendas cercanas por ubicación, y el filtrado por categoría ocurre **en el cliente** (memoria) para una experiencia de usuario instantánea.

La API filtra **solo por radio** (distancia Haversine aproximada en `src/services/api.ts`); las categorías se filtran en memoria vía `filterStores()` sobre `masterStores` (sin HTTP).

## 1. Flujo de Inicialización y Carga de Datos (API)

1.  **Inicialización de Stores**: Se inicializan `locationStore`, `storesStore` (con `masterStores: []`, además de `stores`, `selectedStoreId`, `isLoading`, `error`, `setSelectedStore`/`clearSelection`/`getStoreById`) y `filterStore`.
2.  **Solicitud de Ubicación**: `locationStore` obtiene la ubicación del usuario vía `requestPermission()` (`userCoordinates` + `permissionStatus`), con fallback a `DEFAULT_LOCATION` y modal de permiso.
3.  **Orquestación de Carga (MapContainer)**:
    * Los filtros viajan por `filtersRef` (ref sincronizada con `activeFilters`).
    * Hay 3 disparadores de `fetchStores`: carga inicial, evento `moveend` del mapa y botón de ubicación.
    * Un `useEffect` separado reacciona a cambios de `activeFilters` y llama a la acción síncrona `applyFilters` (sin HTTP).
    * El `useEffect` de carga detecta una nueva ubicación válida (o un movimiento significativo del mapa) y llama a la acción `storesStore.fetchStores({ location, filters })`.
4.  **Llamada a la API (Sin Filtrar)**:
    * La acción llama a `fetchNearbyStores({ lat, lng, radius = 5000 })` en `src/services/api.ts` (Supabase real: RPC `get_nearby_stores` con `user_lat/user_lng/radius_m`; `location` EWKB → `lat/lng` en el adaptador).
    * **Diferencia Clave:** la BD devuelve **TODAS** las tiendas en el radio, independientemente de la categoría. No filtra nada.
5.  **Procesamiento en el Store (Atómico)**:
    * `storesStore` recibe los datos crudos.
    * **Paso 1:** Guarda los datos crudos en `masterStores`.
    * **Paso 2:** Ejecuta inmediatamente la lógica de filtrado local usando los filtros activos actuales.
    * **Paso 3:** Guarda el resultado filtrado en `stores` (la lista visible).
    * Todo esto ocurre en una sola actualización de estado para evitar re-renderizados dobles.
6.  **Visualización**: `StoresLayer` se suscribe a `stores` y renderiza los marcadores.

## 2. Flujo de Interacción

### Escenario A: El usuario selecciona un filtro (Filtrado Cliente)
*Este flujo es instantáneo y NO consume API.*

1.  El usuario hace clic en un filtro (ej. "Llantas") en el `FilterBanner`.
2.  `filterStore` actualiza `activeFilters` (un `Set<StoreCategory>` con `'battery' | 'tire' | 'spare' | 'shop'`).
3.  **Reacción Local (MapContainer)**:
    * Un `useEffect` específico en `MapContainer` detecta el cambio en `activeFilters`.
    * Llama a la acción síncrona `storesStore.applyFilters(activeFilters)`.
4.  **Filtrado en Memoria**:
    * El store toma la lista existente `masterStores`.
    * Aplica el filtro de categorías vía el helper `filterStores(masterStores)` y publica con `set({ stores })`.
    * Actualiza solo la lista `stores`.
5.  **Renderizado**: `StoresLayer` se actualiza instantáneamente.

### Escenario B: El usuario se mueve en el mapa (Recarga API)

1.  `MapContainer` detecta el evento `moveend`.
2.  Tras el *debounce* de 600ms, valida si el desplazamiento del centro supera el umbral `MIN_FETCH_DISTANCE_METERS = 120` (vía `getDistanceMeters` contra `lastRequestedCenterRef`).
3.  Solo si el movimiento es significativo, llama a `storesStore.fetchStores` con el nuevo centro.
4.  Se repite el **Flujo de Carga de Datos** (Paso 1):
    * Se traen todas las tiendas de la nueva zona a `masterStores`.
    * Se aplican los filtros actuales automáticamente antes de mostrar.

> Nota de performance (Febrero 2026): `MapContainer` incluye deduplicación de fetch por distancia mínima entre centros consecutivos para evitar recargas redundantes en movimientos muy cortos del mapa.

### Escenario C: Selección de Tienda

1.  `StoreMarker` es presentacional (recibe `onClick` por props); quienes llaman a `storesStore.selectStore(id)` son `StoresLayer` y `StoresList`.
2.  `InfoPanel` lee `selectedStoreId` + `stores` y muestra la `StoreCard`, o el `AdCarousel` si no hay selección; la tarjeta navega a `/store/[slug]`.

## 3. Estructura de Datos en el Store

Para soportar este flujo, `storesStore` mantiene dos listas:

| Estado | Descripción | Propósito |
| :--- | :--- | :--- |
| **`masterStores`** | Copia completa de la respuesta de la API para la zona actual. | Fuente de verdad local. Permite cambiar filtros sin volver a llamar a la API. |
| **`stores`** | Subconjunto de `masterStores` que cumple con los filtros activos. | Es lo que lee la UI (`StoresLayer`) para renderizar los pines. |

El store mantiene además los campos hermanos `selectedStoreId`, `isLoading` y `error`; `getStoreById` busca primero en `masterStores`.

## 4. Ventajas de la Arquitectura Híbrida

- **Filtrado Instantáneo**: El usuario percibe cero latencia al cambiar entre "Baterías" y "Llantas".
- **Eficiencia de Red**: Solo se llama a la API cuando el usuario se desplaza geográficamente, no cuando interactúa con la UI.
- **Resiliencia**: Si la red falla momentáneamente, el usuario puede seguir filtrando y explorando las tiendas que ya se cargaron (solo vale para la zona ya cargada: cada `fetchStores` reemplaza `masterStores` por zona).

## 5. Nota de Renderizado

- El ciclo de anuncios (`AdCarousel`) ya no usa actualizaciones de estado cada 50ms para la barra de progreso.
- El cambio de slide ocurre por intervalo (`SLIDE_DURATION = 4000` con `setInterval`); la barra de progreso es una animación declarativa de framer-motion (`width` 0→100%), sin `setState` por frame, reduciendo commits de React y evitando ruido en el perfilado de componentes del mapa.

---

## 6. Flujo del carrito persistente

El carrito sigue un flujo separado del mapa, pero con la misma filosofía: **fuente única de verdad en Zustand + UI reactiva por selectores**.

### 6.1 Inicialización y rehidratación

1. La app monta y `cartStore` se rehidrata desde `localStorage` (stack real: Zustand `persist` + `immer` + `createJSONStorage(localStorage)`, `CART_STATE_VERSION = 1`, `CART_STORAGE_KEY = 'cart-storage'`).
2. El estado persistido se sanea para validar shape mínima, items válidos y versión.
3. Si hay items persistidos, se evalúa `lastUpdatedAt`.
4. Si el carrito excedió el TTL configurado (`CART_TTL_MS` = 24h), se limpia automáticamente antes de quedar disponible para la UI.
5. Si hubo expiración automática, el store expone un aviso reactivo (`cartNotice`, código `EXPIRED_CART`) con el mensaje exacto `'Tu carrito ha expirado por cambios en inventario. Por favor, selecciona tus productos nuevamente.'` que la UI debe mostrar al usuario (vía `MainLayoutShell`).
6. El flag `hasHydrated` marca cuándo terminó la rehidratación y permite que la UI espere a un estado consistente antes de mostrar avisos o CTA.
7. Persistencia multi-tab: `enableCrossTabSync` sobre `cart-storage` rehidrata cuando otra pestaña actualiza la key (ver también claves hermanas `auth-storage` y `order-storage`).

### 6.2 Agregar productos desde catálogo

1. La UI del catálogo dispara `addItem(product, quantity)`.
2. El store normaliza el producto a un item persistible (`productId`, `name`, `price`, `image`, `quantity`, `stockSnapshot`, `maxPerOrder`).
3. Si el carrito está vacío, se fija el contexto de tienda (`storeId`, `storeSlug`, `storeName`).
4. Si el producto pertenece a otra tienda, el store responde con `STORE_CONFLICT` y la UI decide el siguiente paso.
5. Si el producto ya existe, las cantidades se mergean de forma atómica y respetando límites (clamp `QUANTITY_CLAMPED` / aviso `ITEM_UPDATED`).
6. Se recalculan `itemCount`, `subtotal` y `lastUpdatedAt`.

### 6.3 Lectura desde React

- Los componentes no deben usar getters imperativos internos del store.
- La lectura debe hacerse mediante selectores/hooks reactivos, por ejemplo:
    - resumen del carrito
    - item puntual por `productId`
    - compatibilidad de tienda
    - aviso de expiración (`useCartNotice`)
    - estado de rehidratación (`useCartHasHydrated`)

### 6.4 Estado actual del carrito
- Ya implementado: persistencia, saneo de shape, TTL de 24h, aviso reactivo por expiración (`EXPIRED_CART` vía `MainLayoutShell`) y `CartDrawer` con eliminación swipe móvil (drag-x con `SWIPE_DELETE`).

---

## 7. Flujo de Datos Multi-Pedido y Simulación Local de Seguimiento

> Estado real: no hay telemetría en tiempo real. Sin WebSocket/SWR/TanStack, sin Supabase Realtime, sin stream GPS y sin backend PostgreSQL en el front (`createOrder` es mock). El estado vive en Zustand `persist` (`order-storage`) + sync multi-tab; la posición del repartidor solo cambia vía `updateDriverCoordinates` manual y el mapa la interpola de forma estática según `status`. Realtime/SWR/WebSocket/streaming quedan como trabajo futuro.

```text
[Checkout / API] ──(createOrder)──▶ [orderStore: orders[]]
                                            │
               ┌────────────────────────────┴────────────────────────────┐
               ▼                                                         ▼
    useActiveOrdersCount()                                      useActiveOrders()
               │                                                         │
               ▼                                                         ▼
        [AppHeader.tsx]                                        [ActiveOrdersDrawer.tsx]
      (Badge numérico puro)                                  (Tarjetas en Curso + Historial)
               │                                                         │
               └──────────(Click: Abre Drawer)───────────────────────────┘
                                                                         │
                                                       (Click en tarjeta de pedido)
                                                                         │
                                                                         ▼
                                                                /order/[id] (Tracking)
                                                                         │
                                                       ┌─────────────────┴─────────────────┐
                                                       ▼                                   ▼
                                              [OrderTrackingMap]                  [Estado de Negocio]
                                           (Interpolación estática              (Simulación local por
                                            según status +                       avance manual de estado
                                            driverCoordinates)                   CREADO ➔ … ➔ ENTREGADO)
```

### 7.1 Creación y Concurrencia de Pedidos
1. Al confirmar una compra en `/checkout`, se crea un nuevo objeto `Order` (id `REP-YYYY-XXXX`, delay mock 600ms) y se prepende al arreglo `orders` en `orderStore` (tope de 20: `[newOrder, ...state.orders].slice(0, 20)`).
2. `paymentStatus` es `PAID` si el método es `wompi`, si no `CREADO`/`PENDING`; el estado inicial del pedido es `CREADO` y se ejecuta `clearCart()` tras la compra.
3. El selector atómico `useActiveOrdersCount()` en `AppHeader` incrementa el contador inmediatamente (retorna un primitivo `number`) sin re-evaluar las propiedades internas de las demás órdenes.
4. Si el usuario realiza una segunda compra en otra tienda diferente, ambas órdenes coexisten en `orders: Order[]` con sus propios estados, repartidores y tiempos estimados independientes.

### 7.2 Navegación no Intrusiva desde `ActiveOrdersDrawer`
1. El usuario puede pulsar el botón del Header en cualquier momento mientras navega por el mapa.
2. `ActiveOrdersDrawer` se despliega mostrando las órdenes activas en la pestaña *"En Curso"* y las finalizadas en *"Historial"*.
3. Al seleccionar una orden, el drawer se cierra y enruta a `/order/[id]`, donde la URL provee el ID de la orden activa en pantalla. La página resuelve con `orders.find` + guard `hasMounted` (no usa `getOrderById`).

### 7.3 Simulación local: mapa y estado de negocio
1. **Mapa (estático):** `OrderTrackingMap` no tiene `requestAnimationFrame`/`easeTo` ni stream (el único `rAF` del repo está en `MagneticBackground`); posiciona al repartidor por interpolación estática según `status` + `driverCoordinates`, que solo cambia vía `updateDriverCoordinates` manual (sin polling ni intervalos de 15-30s).
2. **Estado de negocio (manual):** los hitos (`CREADO`, `PAGADO`, `ACEPTADO`, `PREPARANDO`, `LISTO`, `RECOGIDO`, `EN_CAMINO`, `ENTREGADO`, `CANCELADO`) avanzan por acción del usuario/store; no hay snapshots periódicos ni backend que los emita.
3. **Cierre de Ciclo:** al pasar a `ENTREGADO`, el `OrderRatingModal` se abre a los 1200ms si el pedido no tiene rating, permitiendo calificar tienda y repartidor (`OrderRating`: `storeRating` + `driverRating` anidados) antes de transicionar a la pestaña de historial.

### 7.4 Contratos de datos (ver `src/types/order.ts`)
- `OrderStatus` (9 estados): `CREADO | PAGADO | ACEPTADO | PREPARANDO | LISTO | RECOGIDO | EN_CAMINO | ENTREGADO | CANCELADO` (sin `RECHAZADO`/`REEMBOLSADO`/`ALISTAMIENTO`).
- `paymentStatus`: `PENDING | PAID` (sin `FAILED`/`REFUNDED` en el front).
- `OrderBreakdown`: `subtotal`, `deliveryFee`, `serviceFee`, `total` (sin `discount`).
- `DriverInfo`: sin `id` ni coordenadas (las coords viven en `driverCoordinates` del pedido).
- No existe el hook `useOrderById`; el store expone el método `getOrderById` (vía `useOrderStore.getState().getOrderById`), que la página de tracking no utiliza.

### 7.5 Rutas reales del flujo
`(auth)/login`, `(main)/` (mapa), `(main)/store/[slug]` (catálogo), `(main)/checkout`, `(main)/order/[id]` (tracking). Producto = modal, carrito = drawer; no existen `/orders` ni `/profile`.

