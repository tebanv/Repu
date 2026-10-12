# Flujo de la Aplicación - Repu

## Visión General

**Repu** es una plataforma de delivery en tiempo real especializada en repuestos automotrices. Conecta a conductores con tiendas de autopartes cercanas, permitiéndoles ordenar baterías, llantas y repuestos con entrega rápida y seguimiento en vivo del pedido hasta su ubicación.

### Propuesta de Valor

- **Para el usuario**: Obtener el repuesto que necesita sin moverse, con certeza de disponibilidad y tracking en tiempo real
- **Para las tiendas**: Canal de ventas digital con alcance geolocalizado y logística de última milla resuelta
- **Para los repartidores**: Oportunidad de ingresos con entregas especializadas en el sector automotriz

---

## Actores del Sistema

| Actor | Descripción | Aplicación |
|-------|-------------|------------|
| **Cliente** | Persona que busca y ordena repuestos | `front-user` (actual) |
| **Tienda** | Negocio que vende repuestos y gestiona inventario | `front-store` (futuro) |
| **Repartidor** | Persona que recoge y entrega los pedidos | `front-driver` (futuro) |
| **Administrador** | Gestiona la plataforma, métricas, soporte | `front-admin` (futuro) |

---

## Flujo Principal del Cliente

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           FASE 1: DESCUBRIMIENTO                            │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  1. Cliente abre la app (`app/(main)/page.tsx` → ruta pública `/`, grupo `(main)`):│
│     - Concede GPS: El mapa se centra en sus coordenadas exactas.            │
│     - Minimiza/Deniega: Navega con ubicación por defecto y puede activar    │
│       el GPS en cualquier momento con la cápsula superior flotante.         │
│          ↓                                                                  │
│  2. Ve mapa interactivo con tiendas cercanas y marcadores interactivos     │
│          ↓                                                                  │
│  3. Filtra por tipo de repuesto (baterías, llantas, autopartes)             │
│          ↓                                                                  │
│  4. Explora tiendas en el mapa o lista lateral                              │
│          ↓                                                                  │
│  5. Selecciona una tienda → Ve tarjeta con rating e info                    │
│          ↓                                                                  │
│  6. Toca "Ir a la tienda" → Accede al catálogo                              │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                      ↓
┌─────────────────────────────────────────────────────────────────────────────┐
│                           FASE 2: SELECCIÓN                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  7. Cliente navega el catálogo de la tienda                                 │
│          ↓                                                                  │
│  8. Busca por nombre, referencia o categoría                                │
│          ↓                                                                  │
│  9. Ve detalle del producto en modal `ProductModal` (no es ruta)          │
│          ↓                                                                  │
│  10. Agrega productos al carrito                                            │
│          ↓                                                                  │
│  11. Solo una tienda por pedido: conflicto abre `StoreConflictDialog`       │
│      (`StoreView` + `clearCart` al cambiar de tienda)                        │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                      ↓
┌─────────────────────────────────────────────────────────────────────────────┐
│                           FASE 3: CHECKOUT ✅ IMPLEMENTADO                 │
│                (`app/(main)/checkout/page.tsx` + 4 componentes)            │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  12. Cliente revisa carrito y cantidades (redirect a `/` si vacío)          │
│          ↓                                                                  │
│  13. Confirma dirección de entrega (GPS por defecto o manual)               │
│          ↓                                                                  │
│  14. Envío = `store.deliveryInfo.fee ?? (subtotal > 80000 ? 0 : 6000)`      │
│      (no es cálculo por distancia puro)                                     │
│          ↓                                                                  │
│  15. UI solo ofrece Wompi en línea (1 `PAYMENT_OPTION`; el tipo admite 5)   │
│          ↓                                                                  │
│  16. Revisa resumen final (subtotal + deliveryFee + serviceFee=0 + total,   │
│      sin `discount`)                                                        │
│          ↓                                                                  │
│  17. Confirma pedido (pago SIMULADO: `createOrder` ~600ms;                  │
│      wompi → PAGADO/PAID, resto → CREADO/PENDING)                            │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
                                      ↓
┌─────────────────────────────────────────────────────────────────────────────┐
│              FASE 4: SEGUIMIENTO ✅ IMPLEMENTADO (SIMULACIÓN LOCAL;         │
│              sin backend/realtime/push/notificaciones)                      │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  18. Pedido creado en `orderStore` (mock local, sin notificar a tienda)      │
│          ↓                                                                  │
│  19. Avance manual con "Simular avance al siguiente estado"                 │
│      (`OrderTimeline` → `updateOrderStatus`)                                 │
│          ↓                                                                  │
│  20. Repartidor mock fijo (Carlos Andrés Rodríguez, sin asignación real)    │
│          ↓                                                                  │
│  21. Repartidor recoge en tienda                                            │
│          ↓                                                                  │
│  22. Cliente ve mapa con ubicación del repartidor en vivo                   │
│          ↓                                                                  │
│  23. Cliente recibe notificaciones de estado                                │
│          ↓                                                                  │
│  24. Repartidor llega → Cliente confirma entrega                            │
│          ↓                                                                  │
│  25. Al llegar a ENTREGADO se auto-abre `OrderRatingModal` (tienda+driver)  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Estados del Pedido (reales, `src/types/order.ts`)

```
CREADO ─→ PAGADO ─→ ACEPTADO ─→ PREPARANDO ─→ LISTO ─→ RECOGIDO ─→ EN_CAMINO ─→ ENTREGADO
   │         │           │            │             │           │            │
   └─────────┴───────────┴────────────┴─────────────┴───────────┴────────────┴──→ CANCELADO
```

Transiciones manuales reales (`OrderTimeline`): `PAGADO→PREPARANDO`, `ACEPTADO→PREPARANDO`, `PREPARANDO→RECOGIDO`, `LISTO→RECOGIDO`, `RECOGIDO→EN_CAMINO`, `EN_CAMINO→ENTREGADO`. `cancelOrder` bloquea `EN_CAMINO`/`ENTREGADO`.

| Estado | Descripción | Responsable | Notificación al Cliente |
|--------|-------------|-------------|-------------------------|
| `CREADO` | Pedido iniciado, pago pendiente | Sistema | — |
| `PAGADO` | Pago confirmado exitosamente | Pasarela (simulada) | "Tu pago fue confirmado" |
| `ACEPTADO` | Tienda aceptó el pedido | Tienda | "La tienda está preparando tu pedido" |
| `PREPARANDO` | Productos siendo empacados | Tienda | — |
| `LISTO` | Pedido listo para recoger | Tienda | "Tu pedido está listo" |
| `RECOGIDO` | Repartidor tiene el pedido | Repartidor | "El repartidor recogió tu pedido" |
| `EN_CAMINO` | Repartidor en ruta al cliente | Repartidor | "Tu pedido está en camino" + mapa |
| `ENTREGADO` | Cliente recibió el pedido | Repartidor | "¡Pedido entregado! Califica tu experiencia" |
| `CANCELADO` | Pedido cancelado (no en `EN_CAMINO`/`ENTREGADO`) | Cliente/Sistema | "Tu pedido fue cancelado" |

---

## Pantallas de la Aplicación (front-user)

### Implementadas ✅

| Pantalla | Ruta | Descripción |
|----------|------|-------------|
| Login | `/login` (`app/(auth)/login`) | Autenticación de usuarios |
| Mapa Principal | `/` (`app/(main)/page.tsx`) | Mapa con tiendas, filtros, lista lateral |
| Tienda | `/store/[slug]` (`app/(main)/store/[slug]`) | Catálogo de productos de una tienda con CTA flotante de carrito |
| Checkout | `/checkout` (`app/(main)/checkout/page.tsx` + 4 componentes) | Dirección, pago (solo Wompi simulado), confirmación |
| Seguimiento | `/order/[id]` (`app/(main)/order/[id]/page.tsx` + 7 componentes tracking) | Tracking simulado local + rating auto en `ENTREGADO` |

> Notas: `/product/[id]` no es ruta (es `ProductModal`); `/cart` no es ruta (es `CartDrawer` global en `StoreView` y `AppHeader`); no existe ruta `/orders` (solo `ActiveOrdersDrawer` + hooks `useActiveOrders`/`useCompletedOrders`).

### Por Implementar 🚧

| Pantalla | Ruta | Descripción |
|----------|------|-------------|
| Mis Pedidos | `/orders` | Historial de pedidos |
| Perfil | `/profile` | Datos, direcciones, métodos de pago |

---

## Modelo de Datos Principal

> Nota: modelo objetivo simplificado; el implementado está en `src/types/order.ts` (pedido sin `orderNumber`/`userId`/`driverId` — el `id` con formato `REP-YYYY-XXXX` hace de número —, `items: CartItem[]`, `breakdown` sin `discount`, `stateHistory` en vez de `timeline`, `rating { storeRating, driverRating, comments?, submittedAt }`, `estimatedDeliveryMinutes: number`, `deliveryLocation` dentro de `deliveryAddress.coordinates`; `DriverInfo { name, phone, vehicleType, vehiclePlate, rating, avatar? }` sin `id`/`isOnline`/coords — las coords van en `driverCoordinates`).

### Cliente
```typescript
{
  id: string,
  email: string,
  name: string,
  phone: string,
  avatar: string | null,
  addresses: Address[],
  defaultAddressId: string | null,
  createdAt: timestamp
}
```

### Tienda
```typescript
{
  id: string,
  name: string,
  slug: string,
  description: string,
  lat: number,
  lng: number,
  address: string,
  city: string,
  phone: string,
  categories: ['battery', 'tire', 'spare', 'shop'],
  rating: number,
  totalReviews: number,
  schedule: {
    monday: { open: '08:00', close: '18:00' },
    // ...
  },
  isOpen: boolean,
  logo: string,
  banner: string,
  deliveryRadius: number,  // metros
  minOrderAmount: number,
  avgPrepTime: number,     // minutos
}
```

### Producto
```typescript
{
  id: string,
  storeId: string,
  name: string,
  description: string,
  price: number,
  comparePrice: number | null,  // precio tachado
  category: string,
  subcategory: string,
  brand: string,
  reference: string,           // código del fabricante
  images: string[],
  stock: number,
  isAvailable: boolean,
  specifications: {
    // varía por categoría
    voltage: '12V',
    amperage: '60Ah',
    // ...
  },
  compatibleVehicles: string[],  // ['Chevrolet Spark 2015-2020', ...]
}
```

### Pedido
```typescript
{
  id: string,
  orderNumber: string,         // REP-2026-00001
  userId: string,
  storeId: string,
  driverId: string | null,
  status: OrderStatus,
  items: [{
    productId: string,
    name: string,
    price: number,
    quantity: number,
  }],
  subtotal: number,
  deliveryFee: number,
  serviceFee: number,   // checkout fija serviceFee = 0; sin `discount`
  total: number,
  deliveryAddress: Address,
  deliveryLocation: { lat, lng },
  paymentMethod: PaymentMethod,   // UI solo ofrece Wompi en línea (1 opción)
  paymentStatus: 'PENDING' | 'PAID',   // mayúsculas reales (`src/types/order.ts`)
  notes: string,               // instrucciones especiales
  estimatedDelivery: timestamp,
  actualDelivery: timestamp | null,
  rating: {
    store: number | null,
    driver: number | null,
    comment: string | null,
  },
  timeline: [{
    status: string,
    timestamp: timestamp,
    note: string,
  }],
  createdAt: timestamp,
  updatedAt: timestamp,
}
```

### Repartidor
```typescript
{
  id: string,
  name: string,
  phone: string,
  avatar: string,
  vehicleType: 'motorcycle' | 'car',
  vehiclePlate: string,
  rating: number,
  totalDeliveries: number,
  isOnline: boolean,
  currentLocation: { lat, lng },
  currentOrderId: string | null,
}
```

---

## Integraciones Requeridas

| Servicio | Propósito | Estado real |
|----------|-----------|-----------|
| **Mapbox** | Mapas, geocoding, rutas | ✅ Implementado |
| **Supabase** | Base de datos, auth, realtime | No integrado en `src/` (persistencia local Zustand) |
| **Pasarela de pago** | Wompi en línea (simulado en UI, sin PSE/tarjetas/Nequi reales) | Simulado |
| **Push Notifications** | Alertas de estado del pedido | Pendiente (futuro) |
| **SMS/WhatsApp** | Notificaciones críticas | Pendiente (futuro) |
| **Analytics** | Métricas de uso y conversión | Pendiente (futuro) |

---

## Arquitectura de Tiempo Real

Estado real: persistencia local Zustand (`persist`: `auth-storage`, `cart-storage`, `order-storage`) + sincronización cross-tab (`lib/storageSync.ts`); coordenadas del repartidor solo vía `updateDriverCoordinates` manual. Realtime Supabase/WebSocket es futuro (no implementado).

```
┌─────────────┐     persist + cross-tab sync      ┌─────────────┐
│   Tiendas / │ ────────────────────────────────→ │   Cliente   │
│  Repartidor │   (mock local; sin GPS 5-10 s)    │  (mapa +    │
│   (mock)    │                                   │   timeline) │
└─────────────┘                                   └─────────────┘
```

---

## Componentes Implementados vs Pendientes

### ✅ Implementados (Fase Actual)
- Sistema de autenticación con persistencia
- Mapa interactivo con Mapbox
- Geolocalización del usuario
- Stores Zustand (location, stores, filter, auth, cart, order)
- Filtros por categoría de tienda
- Lista de tiendas (desktop)
- StoreCard holográfico
- Marcadores personalizados con selección
- Diseño responsive móvil/desktop
- Arquitectura híbrida de filtrado (cliente/API)
- Página de tienda con catálogo por `slug` (`StoreView` conectada al `cartStore` como fuente única)
- Base del carrito global con Zustand + `persist` + `immer`
- Persistencia del carrito con contexto de tienda
- TTL de carrito con expiración automática al rehidratar
- Aviso reactivo (`cartNotice`/`EXPIRED_CART` + toast en `MainLayoutShell`)
- `ProductModal` conectado al store reactivo
- `CartButton` conectado a `itemCount` y `subtotal` del store
- Drawer/vista de carrito pre-checkout (`CartDrawer` global en `StoreView` y `AppHeader`)
- Sincronización multi-tab del carrito y pedidos (`lib/storageSync.ts`)
- Checkout completo (mock): `app/(main)/checkout/page.tsx` + 4 componentes
- Sistema de pedidos (mock): `orderStore` + persistencia `order-storage`
- Tracking base (simulación local): `app/(main)/order/[id]/page.tsx` + 7 componentes tracking
- `StoreConflictDialog` mono-tienda + `ActiveOrdersDrawer` + `OrderRatingModal`

### 📋 Fases Posteriores
- Pagos reales (Wompi productivo, PSE/tarjetas/Nequi)
- Realtime Supabase + repartidor vivo
- Notificaciones (push/SMS)
- Historial `/orders` y perfil `/profile`

---

## Decisiones Técnicas

| Decisión | Elección | Razón |
|----------|----------|-------|
| Framework | Next.js 16 (canary 16.3.1; App Router) | SSR, routing, optimización |
| Estado global | Zustand | Simplicidad, performance, persistencia |
| Mapas | Mapbox GL JS | Personalización, rendimiento |
| Estilos | Tailwind CSS | Rapidez, consistencia |
| Animaciones | Framer Motion | Declarativo, performante |
| Base de datos | Supabase (futuro) | Realtime, auth, PostgreSQL |
| Tiempo real | Supabase Realtime | Integrado con DB |

---

*Documento de contexto para desarrollo - Repu 2026*
