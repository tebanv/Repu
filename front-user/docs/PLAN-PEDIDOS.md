# Plan: carrito y checkout contra `ms-orders`

- **Estado:** pasos 1 a 6 hechos (2026-11-05). Siguen los pasos 7 a 9 (checkout); el 9 necesita la aprobación visual de §2.3.
- **Alcance:** del carrito hasta crear el pedido real en `ms-orders`. **Fuera de alcance:** pagos reales (`ms-manage-payment`) y tracking real. El seguimiento simulado (repartidor, mapa, "Simular avance", calificación) se conserva tal como está, ahora sobre el pedido real.
- **Contrato:** código de `../Backend/ms-orders` (verificado el 2026-11-05, `d93e012` = `origin/main`) y direcciones de `ms-users`. Lo que el backend debe ajustar está en [BACKEND.md](./BACKEND.md) §7, bloque *Pedidos*, con el argumento de cada pedido.
- **Next.js:** 16.3 / React 19.2. Las decisiones de §2.1 se tomaron sobre las guías incluidas en `node_modules/next/dist/docs/` (`server-actions.md`, `16-proxy.md`, `authentication.md`, `interactive-apps.md`).
- Al terminar se archiva en `legacy/`, y lo que quede pendiente pasa a [ROADMAP.md](./ROADMAP.md).

## 1. Objetivo y métricas

Que el pedido que ve el usuario sea exactamente el que cobra el backend, sin que comprar se sienta más lento que hoy.

| Interacción | Hoy (mock) | Objetivo |
|---|---|---|
| Agregar producto o cambiar cantidad | 0 ms, solo local | 0 ms percibidos (optimista) y **1 petición por ráfaga** de clics por producto |
| Abrir `/checkout` | Waterfall cliente: tienda | Datos en paralelo: carrito + direcciones (+ tienda en caché) en **1 RTT** tras hidratar; precargados al abrir el drawer |
| Confirmar pedido | 600 ms falsos | **1 petición** (2 si hay que crear la dirección); reintento sin duplicar |
| Total mostrado vs. cobrado | Puede diferir | Siempre el del servidor |

## 2. Decisiones

### 2.1 Cómo se reparte el trabajo entre Next.js y el backend

| Necesidad | Mecanismo | Por qué |
|---|---|---|
| Mutaciones del carrito | `fetch` desde el cliente, mismo origen, Traefik → `ms-orders` (`src/services/`) | Un solo salto de red. Las Server Actions agregan un salto (navegador → Next → microservicio) y **Next las despacha de a una por cliente**: tres clics rápidos serían tres viajes en serie. |
| Confirmar pedido | `fetch` desde el cliente con clave de idempotencia; estado pendiente con `useTransition` | Igual que arriba. Una Server Action no aporta *progressive enhancement* útil aquí: el checkout ya depende de JS (GPS, mapa, stores). |
| Lectura de datos del checkout | Cliente, en paralelo, con precarga | Leer el carrito en un Server Component crearía una segunda fuente del carrito (RSC + `cartStore`) y exigiría reenviar la cookie desde Next. Se reevalúa en un ADR si el shell autenticado pasa a RSC. |
| Guard de rutas | **`src/proxy.ts`** optimista: solo comprueba que exista la cookie de sesión y redirige a `/login` | La guía de Next recomienda leer solo la cookie en `proxy`, sin llamar al backend. Evita descargar e hidratar `/checkout` sin sesión y el *flash* actual. `MainLayoutShell` sigue validando el perfil (fuente real). |
| Navegación a checkout | `router.prefetch('/checkout')` y precarga de direcciones al abrir `CartDrawer` | El usuario tarda segundos en pulsar "Ir a pagar": ese tiempo cubre la descarga de la ruta y la lectura. |
| Optimismo | En `cartStore` (Zustand), no con `useOptimistic` | El carrito lo leen el header, el drawer, la tienda y el checkout; `useOptimistic` es por componente. El store ya es la fuente única en el cliente. |
| Caché de datos por usuario | Ninguna caché de Next (`cache: 'no-store'`, ya en `httpClient`) | Carrito y direcciones son privados y cambian; no deben pasar por cachés compartidas. |

### 2.2 El carrito del servidor es la fuente de verdad; `cartStore` es su caché optimista

El checkout de `ms-orders` convierte el carrito **del servidor**. Si el front mantuviera su carrito solo en local y lo copiara al confirmar, el momento más crítico pagaría `1 GET + k DELETE + n POST` en serie, sin atomicidad: un fallo a mitad deja un carrito mezclado. Además, el stock y los precios se validarían solo al final.

Diseño:

1. **Interfaz del store intacta.** `addItem`, `updateQuantity`, `removeItem`, `clearCart` y `replaceStoreContext` siguen siendo síncronas y devuelven `CartActionResult` con las reglas locales (una tienda, límites, redondeo). La UI no cambia.
2. **Sincronización en segundo plano** (`src/services/cartService.ts` + cola en `src/lib/`):
   - Cada mutación marca el producto como pendiente. Se envía tras **400 ms sin cambios** sobre ese producto (coalescing): diez toques en "+" son una petición.
   - Se envía la **cantidad absoluta**, no el delta. Así el envío es idempotente: reintentar, o que dos pestañas manden lo mismo, no duplica.
   - Hay como mucho una petición en vuelo por producto; si llega un cambio nuevo, se encola el último valor.
3. **Reconciliación:** la respuesta trae el carrito completo con precios actuales. Se aplica salvo en productos con cambios locales más nuevos (número de secuencia), para evitar parpadeos.
4. **Errores:**
   - Stock insuficiente → se ajusta a lo disponible y se avisa por `cartNotice`.
   - Producto no disponible → se quita y se avisa.
   - Red → queda pendiente y se reintenta con la siguiente mutación o con el evento `online`.
   - `401` → manejo global de sesión.
5. **Arranque:** se pinta desde `cart-storage` (instantáneo) y luego `GET` del carrito: gana el servidor, salvo cambios pendientes. Si el servidor está vacío y el local tiene productos (carritos previos al corte), se suben en una sola petición.
6. **Antes del checkout:** se espera a que la cola termine; el botón muestra el estado de sincronización.
7. **Sin bloquear al front:** con la API actual, "fijar cantidad" se implementa como `DELETE` + `POST` en serie, y "vaciar" como un `DELETE` por ítem. Cuando backend publique las rutas C1–C3 ([BACKEND.md](./BACKEND.md) §7) solo cambia `cartService.ts`.

### 2.3 Dirección de entrega desde `ms-users`

El checkout exige un `addressId`. Se reemplaza la dirección de texto libre por:
- La dirección principal guardada (`isPrimary`), o la primera, precargada.
- Si no hay ninguna, el formulario actual crea una (`POST /ms-users/api/users/addresses`) con las coordenadas del GPS. El texto se puede prellenar con **geocodificación inversa de Mapbox, una sola vez y solo cuando el usuario pulsa "usar mi ubicación"** (heurística B: nada por movimiento).
- Sin coordenadas (GPS denegado y sin dirección guardada), se pide activar la ubicación o escribir la dirección.

**Requiere aprobación visual:** selector de direcciones guardadas en `DeliveryAddressCard` (lista simple más "nueva dirección", con el estilo actual).

### 2.4 Idempotencia del checkout

- Cada intento de compra usa un UUID como `X-Request-ID`. Se guarda en `sessionStorage` junto con una huella `(companyId, addressId, notas)`: si la red falla o se recarga la página, el reintento reutiliza la misma clave y el backend devuelve el mismo pedido, sin duplicarlo.
- Si la huella cambia, se genera una clave nueva (si no, el backend respondería `409 IDEMPOTENCY_CONFLICT`).
- Tras el `201`, la clave se borra.
- `httpClient` hoy pisa siempre `X-Request-ID`. Se cambia para respetar el del llamador, con un *fallback* que siempre sea UUID v4 válido. También se agrega `HttpError.code`, leído del body `{ code, message }`.

### 2.5 Después del `201`

- **Pedido local:** `orderStore.createOrder` deja de inventar el pedido. Se arma con la respuesta del servidor:
  - `id` = UUID real, y `number` = `humanReadableId`, que se muestra como `#123`.
  - Ítems, totales y snapshot de dirección, tal como los devuelve el servidor.
  - Encima, la **simulación de seguimiento actual** (repartidor mock, avance manual, calificación), marcada como capa simulada.
  - Cuando llegue el corte de tracking, esa capa se reemplaza sin cambiar rutas ni ids.
- **Cancelar:** también llama a `POST /api/orders/{id}/cancel`. Motivo: el checkout **reserva inventario** y hoy las reservas no expiran (P2). Un pedido cancelado solo en local dejaría stock bloqueado en el servidor. Si el backend responde `409 ORDER_NOT_CANCELLABLE`, se informa y no se cancela en local.
- **Carrito:** se resetea solo en local; el servidor ya lo marcó `CONVERTIDO`.

### 2.6 Dinero y costo de envío

- `BigDecimal` → enteros COP con `Math.round`.
- El total que se muestra en el checkout es el del carrito del servidor.
- El envío sigue "por confirmar" hasta que backend lo calcule (K2). No se calcula en el front, para que lo mostrado y lo cobrado salgan de un mismo lugar.

## 3. Adaptadores

**`CartResponse` → reconciliación de `cartStore`:** `items[].productId`, `quantity`, `unitPrice` (redondeado) y `subtotal`; el `id` de ítem se guarda solo en `cartService` (lo necesita la API actual para `DELETE`). Cuando backend envíe disponibilidad por ítem (C4), alimenta `stockSnapshot`.

**`OrderResponse` → `Order`:**

| `Order` | Origen | Regla |
|---|---|---|
| `id` | `id` | UUID |
| `number` (nuevo) | `humanReadableId` | — |
| `storeId` | `companyId` | — |
| `storeName`, `storeSlug`, `storeCoordinates` | Contexto del carrito al confirmar; luego `company` en la respuesta (K1) | — |
| `items` | `items[]`: `productId`, `nameSnapshot`, `unitPriceSnapshot`, `quantity` | Dinero redondeado |
| `deliveryAddress` | `deliveryAddressSnapshot`: `fullAddress`, `city`, `deliveryNotes`, `lat`, `lng` | `street = fullAddress` |
| `breakdown` | `subtotal`, `shippingCost`, `serviceFee`, `finalTotal` | `deliveryFee = null` mientras backend no calcule envío |
| `paymentStatus` | `paymentStatus` | `PAGADO` → `PAID`; resto → `PENDING` |
| `status`, `stateHistory`, `driver`, `rating` | Simulación local (§2.5) | Igual que hoy |

**Errores del checkout:**

| Código | Respuesta |
|---|---|
| `INSUFFICIENT_STOCK`, `PRODUCT_NOT_AVAILABLE`, `CART_EMPTY` | Releer el carrito, reconciliar y avisar |
| `ADDRESS_NOT_FOUND` | Releer las direcciones |
| `IDEMPOTENCY_CONFLICT` | Clave nueva y un reintento |
| Red o `5xx` | Misma clave; el usuario puede reintentar |

## 4. Pasos

| # | Archivos | Cambio | Depende de backend | Hecho cuando |
|---|---|---|---|---|
| 1 | `next.config.js`, `.env.example`, `README.md` | `rewrite` de desarrollo `/ms-orders` con `ORDERS_API_ORIGIN` | No | `curl localhost:3000/ms-orders/actuator/health` responde |
| 2 | `src/services/httpClient.ts` | `X-Request-ID` del llamador, *fallback* UUID v4 y `HttpError.code` | No | Tests de `httpClient` en verde |
| 3 | `src/proxy.ts` | Guard optimista por cookie (`__Host-repu_session` o `repu_session_dev`); ver `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/proxy.md` | No | Sin sesión, `/checkout` redirige sin descargar la página |
| 4 | `src/services/addressService.ts` (nuevo) | `listAddresses`, `createAddress` | No | Tests con `fetch` mockeado |
| 5 | `src/services/cartService.ts` (nuevo), `src/lib/` (cola) | API actual con el *shim* de §2.2.7, adaptador y cola por producto | No (mejora con C1–C5) | Tests: coalescing, cantidad absoluta, reconciliación, errores |
| 6 | `src/store/cartStore.ts` | Sincronización, reconciliación, arranque y `flush()`; `CART_STATE_VERSION` 3 | No | Tests del store en verde, con la interfaz pública intacta |
| 7 | `src/services/orderService.ts` (nuevo), `src/types/order.ts` | `checkout()` con idempotencia, `cancelOrder()` y adaptador | No | `pnpm type-check` sin errores |
| 8 | `src/store/orderStore.ts` | `createOrder` sobre el servidor y simulación encima; `cancelOrder` llama al servidor | No | Tests del store en verde |
| 9 | `checkout/page.tsx`, `DeliveryAddressCard`, `CartDrawer` | Dirección de `ms-users`, prefetch, flush, errores por código y número `#123` | No (**aprobación visual** en §2.3) | Pedido real creado desde el navegador |
| 10 | — | Smoke en servidor: agregar, cambiar cantidades, recargar, abrir en otra pestaña, checkout, reintento sin duplicar y cancelar | Sí: datos de catálogo | Un pedido en BD por compra y stock liberado al cancelar |
| 11 | Docs | `ARCHITECTURE`, `DATAFLOW`, `APP_FLOW`, `AUTHENTICATION` §9 (proxy), `TESTING`, `ROADMAP`, `CHANGELOG`; archivar este plan | — | Ningún documento presenta el carrito o el checkout como locales |

Orden de commits: 1–3 (transporte y guard), 4–6 (carrito), 7–9 (checkout), luego 10 y 11. Ningún paso del front espera al backend: cuando lleguen C1–C5 y K1–K2, el cambio queda dentro de `src/services/`.

## 5. Pedidos al backend

Están priorizados y argumentados en [BACKEND.md](./BACKEND.md) §7, bloque *Pedidos*. Resumen:

- **Antes del smoke:** P2 (expiración de reservas). Sin ella, cada prueba de checkout bloquea stock para siempre.
- **Rendimiento y robustez del carrito:** C1 (cantidad absoluta e idempotente), C2 (carrito activo sin `companyId`), C3 (vaciar), C4 (disponibilidad por ítem), C5 (reemplazo en lote).
- **Checkout:** K1 (tienda en la respuesta), K2 (cotización con envío calculado en el servidor), K3 (rol `COMPRADOR`), K4 (`Location` y prefijos `/api`).
