# Arquitectura del frontend

Cómo está organizado el front y qué reglas no se deben romper. Los flujos paso a paso están en [DATAFLOW.md](./DATAFLOW.md), la ubicación de los archivos en [FOLDER_STRUCTURE.md](./FOLDER_STRUCTURE.md) y el backend en [BACKEND.md](./BACKEND.md).

## 1. Capas

```text
UI (componentes) ── lee con selectores ──► Stores Zustand
      │                                         ▲
      │ dispara acciones                        │ actualiza
      ▼                                         │
    Stores ───────── llaman ──────► Servicios (src/services/) ──► red
```

- Los componentes renderizan; la lógica de negocio vive en stores y servicios.
- Cada dominio tiene una sola fuente de verdad, y los componentes se suscriben con selectores específicos.
- La UI y los stores no conocen SDKs ni detalles de red. Solo usan tipos de `src/types/`.
- La traducción entre backend y dominio vive solo en `src/services/`.

## 2. Stores

| Store | Responsabilidad | Persistencia |
|---|---|---|
| `authStore` | Caché de UI de la sesión ([AUTHENTICATION.md](./AUTHENTICATION.md) §6) | `auth-storage` |
| `locationStore` | Coordenadas, permisos y ciclo de vida del GPS | — |
| `filterStore` | Categorías activas, sin lógica de filtrado | — |
| `storesStore` | `masterStores` (zona cargada), `stores` (filtradas) y selección | — |
| `cartStore` | Carrito | `cart-storage`, con TTL de 24 h |
| `orderStore` | Pedidos mock, máximo 20 | `order-storage` |
| `toastStore` | Notificaciones, máximo 4 visibles | — |

## 3. Servicios

| Servicio | Backend | Estado |
|---|---|---|
| `httpClient.ts` | Transporte común hacia los microservicios | Vigente |
| `authService.ts` | `ms-auth` + `ms-users` | Vigente |
| `api.ts` | `ms-companies`, `ms-products`, `ms-categories` (lecturas públicas); adaptadores en [PLAN-CATALOGO.md](./PLAN-CATALOGO.md) §3 | Vigente |
| `supabaseClient.ts` | Sin consumidores | Se retira en el paso 8 del plan |
| `geolocationService.ts` | `navigator.geolocation` | Vigente |

## 4. Módulo de mapa

- **`MapContainer`** es el orquestador. Inicializa Mapbox una sola vez (`dark-v11`), centra el mapa con la ubicación y decide cuándo pedir tiendas.
- **`StoresLayer`** es presentacional. Separa dos efectos: recrear marcadores cuando cambia la lista y actualizar solo la selección cuando cambia `selectedStoreId`.
- **`LocationControlProvider`** centraliza los permisos; `LocationButton` y `LocationPermissionModal` solo presentan.
- **`PageLayout`** muestra lista y anuncios en desktop, y `InfoPanel` (tarjeta de tienda o anuncios) en móvil.

Riesgo conocido: `MapContainer` concentra inicialización, debounce y umbrales. Conviene extraerlos a hooks cuando lleguen el clustering o el tracking en vivo.

## 5. Módulo de carrito

Reglas implementadas en `cartStore`:

- **Una tienda por carrito:** un producto de otra tienda devuelve `STORE_CONFLICT` sin mutar nada, y la UI pide confirmación.
- **Cantidades:** mínimo 1; el máximo sale de `stockSnapshot` y `maxPerOrder`. Si se excede, devuelve `QUANTITY_CLAMPED`.
- **Dinero:** enteros COP con `Math.round`.
- **Rehidratación:** valida forma y versión (`CART_STATE_VERSION`) y descarta lo corrupto.
- **TTL:** con más de 24 h, o con items sin timestamp, el carrito se vacía y se expone `cartNotice` (`EXPIRED_CART`).
- **Resultados:** las acciones devuelven `{ ok, code, message? }` y la UI decide el feedback.
- **Lectura:** solo con hooks reactivos (`useCartSummary`, `useCartItem`, `useIsSameCartStore`, `useCartNotice`, `useCartHasHydrated`), nunca con getters.

`stockSnapshot` es referencial; nunca es fuente de verdad al pagar.

## 6. Pedidos

- No existe `activeOrderId`: los pedidos activos se derivan de `orders[]` con `useActiveOrders`, `useActiveOrdersCount` y `useCompletedOrders`.
- La URL decide qué pedido se ve (`/order/[id]`).
- Todo es local; `orderStore` no habla con el backend. Repartidor, teléfono y chat son simulados.

## 7. Guardrails

**Rendimiento**
- `MapSection` está memoizado y el mapa no se recrea por renders del layout.
- `moveend` aplica debounce de 600 ms y umbral de 120 m. Cambiar filtros no genera tráfico de red.
- `AdCarousel` cambia de slide por intervalo; su barra de progreso es una animación declarativa, sin `setState` por frame.
- `InfoPanel` es solo móvil: no se monta en desktop.

**GPS y batería** (`locationStore`)
- `PERMISSION_DENIED` llama a `clearWatch` de inmediato.
- `POSITION_UNAVAILABLE` y `TIMEOUT` conservan las últimas coordenadas, mantienen la escucha y evitan re-renders repetidos.

**Safari iOS** (CTA inferior del carrito)
- No animar `transform` sobre un nodo `fixed`: usar un wrapper `fixed` estático y una capa interna animada.
- Mantener el safe-area separado del color del botón (`mobile-safe-area-screen`, `safe-bottom-pad`) y usar `min-h-screen` + `min-h-[100dvh]` en la vista de tienda.
- No reintroducir hacks globales de scroll.

Los criterios generales para evaluar cambios están en [AI_GUIDELINES.md](./AI_GUIDELINES.md) §4.
