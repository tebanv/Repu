# Flujos de datos

Cómo viajan los datos entre UI, stores y servicios. Las responsabilidades y reglas de cada pieza están en [ARCHITECTURE.md](./ARCHITECTURE.md).

## 1. Tiendas: carga y filtrado híbrido

La red trae todas las tiendas de la zona; las categorías se filtran en memoria.

```text
locationStore ─► MapContainer ─► storesStore.fetchStores ─► api.fetchNearbyStores
                      ▲                    │
                      │                    ├─ masterStores (zona completa)
filterStore ──────────┘                    └─ stores (filtradas) ─► StoresLayer
       └─ cambio de filtro ─► storesStore.applyFilters (sin red)
```

1. `locationStore` obtiene la ubicación o usa `DEFAULT_LOCATION`.
2. `MapContainer` llama a `fetchStores` en tres casos: carga inicial, `moveend` y botón de ubicación. En `moveend` aplica debounce de 600 ms y solo pide datos si el centro se movió 120 m o más.
3. `fetchNearbyStores` consulta un radio de 5000 m, que se envía como `radiusKm=5` a `ms-companies`. Las categorías llegan como `categoryId` y se traducen con una consulta a `ms-categories` cacheada por sesión ([PLAN-CATALOGO.md](./PLAN-CATALOGO.md) §3).
4. `storesStore` guarda `masterStores` y `stores` en una sola actualización.
5. Al cambiar un filtro, `applyFilters` recalcula `stores` sin tráfico de red.

Si la red falla, `masterStores` se conserva y se puede seguir filtrando la zona ya cargada.

**Selección:** `StoresLayer` y `StoresList` llaman a `selectStore(id)`. La tarjeta muestra la tienda seleccionada y navega a `/store/[slug]`.

## 2. Carrito

**Rehidratación**
1. `cartStore` lee `cart-storage` y sanea forma, items y versión.
2. Si el carrito expiró, lo vacía antes de exponerlo y publica `cartNotice`.
3. `MainLayoutShell` convierte el aviso en un toast.
4. `hasHydrated` indica cuándo el estado ya es consistente.
5. `enableCrossTabSync` rehidrata cuando otra pestaña cambia la clave.

**Agregar producto**
1. La UI llama a `addItem(product, quantity)`.
2. El store normaliza el producto. Si el carrito está vacío, fija el contexto de tienda.
3. Si el producto es de otra tienda, devuelve `STORE_CONFLICT` y `StoreView` abre el diálogo.
4. Si ya existe, suma cantidades respetando los límites.
5. Recalcula `itemCount`, `subtotal` y `lastUpdatedAt`.

## 3. Pedidos (simulación local)

```text
/checkout ─ createOrder ─► orderStore.orders[]
                               ├─ useActiveOrdersCount ─► AppHeader (badge)
                               └─ useActiveOrders ─► ActiveOrdersDrawer ─► /order/[id]
```

1. `createOrder` genera un id `REP-YYYY-XXXX` y antepone el pedido a `orders`, con un máximo de 20. Luego se ejecuta `clearCart()`.
2. Con `wompi`, el pedido nace `PAGADO`/`PAID`; con otro método, `CREADO`/`PENDING`.
3. `/order/[id]` resuelve el pedido con `orders.find` sobre la URL.
4. `OrderTimeline` avanza con `updateOrderStatus`, que agrega una entrada a `stateHistory`.
5. `OrderTrackingMap` ubica al repartidor por interpolación estática según `status` y `driverCoordinates`. No hay stream, polling ni animación continua.
6. Al llegar a `ENTREGADO`, `OrderRatingModal` se abre a los 1200 ms si no hay calificación.

Los pedidos persisten en `order-storage` y se sincronizan entre pestañas.

## 4. Autenticación

El flujo de login, logout, restauración y multi-tab está en [AUTHENTICATION.md](./AUTHENTICATION.md) §7.
