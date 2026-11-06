# Plan: corte del catálogo a `ms-companies` / `ms-products` / `ms-categories`

- **Estado:** pasos 1 a 6 hechos (2026-11-04). Faltan el smoke en navegador (paso 7), el retiro de Supabase (paso 8) y las docs finales (paso 9).
- **Objetivo:** que tiendas y productos dejen de leerse desde Supabase, sin cambiar la UI ni la interfaz pública de los stores ([ADR-002](./ADR-002-BACKEND-MICROSERVICES.md), Zero-Coupling).
- **Contrato:** [BACKEND.md](./BACKEND.md) §3 (rutas) y §7 (gaps), verificado contra el código el 2026-11-04.
- Al terminar se archiva en `legacy/`, y lo que quede pendiente pasa a [ROADMAP.md](./ROADMAP.md).

## 1. Qué cambia

| Función actual (`api.ts`) | Consumidor | Después del corte |
|---|---|---|
| `fetchNearbyStores({ lat, lng, radius })` | `storesStore` | `GET /ms-companies/api/companies?lat&lng&radiusKm` |
| `fetchStoreBySlug(slug)` | `StoreView`; checkout (paso 4) | `GET /ms-companies/api/companies/{slug}` |
| `fetchProductsByStore(storeId)` | `StoreView` | `GET /ms-products/api/catalog/products?companyId` |
| `fetchStoreById(id)` | Checkout | **Se elimina.** El checkout usa `fetchStoreBySlug` con el `storeSlug` del carrito |
| `fetchProductById(id)` | Ninguno | **Se elimina** |

Además, `GET /ms-categories/api/catalog/categories` se consulta una vez por sesión para traducir `categoryId` a `StoreCategory`.

Las firmas que se conservan no cambian, así que `storesStore`, `StoreView` y los componentes no se tocan. El checkout solo cambia la función que importa.

## 2. Decisiones

1. **Categoría de la tienda:** el front traduce `categoryId` buscando una palabra clave en el nombre de la categoría (§3). No se espera una columna `codigo` del backend. Las categorías se piden una sola vez por sesión. Si una categoría no está en la tabla o la petición falla, la tienda queda sin categorías: sigue visible en el mapa, pero solo sin filtro.
   - **Acordar con backend:** que los nombres de categoría de autopartes incluyan una de las palabras clave.
   - **Limitación:** `empresas.id_categoria` admite una sola categoría por tienda, así que una tienda de baterías y llantas aparece en un solo filtro.
2. **Registros inactivos:** el adaptador descarta `active === false` en tiendas y productos, mientras el backend no los filtre ([BACKEND.md](./BACKEND.md) §7). Es una protección, no reemplaza el filtro de servidor.
3. **Agotado:** `isAvailable = active !== false && stock > 0`. La UI ya muestra "Agotado" y el carrito rechaza productos no disponibles, así que la regla actual (`stock: 0` = "sin límite") deja de aplicarse sin tocar `cartStore`.
4. **Costo de envío:** sale de `operationalConfig.delivery.fee` si la tienda lo define. Si no, queda `null` ("por confirmar") y **no se suma al total**. La regla de prueba anterior (gratis sobre $80.000, $6.000 en otro caso) se retiró. `StoreHeader`, `OrderSummaryCard`, `CartDrawer` y `OrderDetailsAccordion` muestran "por confirmar" (aprobado el 2026-11-04). El costo real queda pendiente en [ROADMAP.md](./ROADMAP.md) §4.
5. **Carritos guardados:** se sube `CART_STATE_VERSION` de 1 a 2. Los carritos en `localStorage` tienen ids de Supabase que no existen en `repu`, y la migración actual los descarta al cambiar la versión.
6. **Sin doble fuente:** el corte es un único cambio, sin bandera para alternar con Supabase; si falla, se revierte el commit. Supabase se retira en un commit aparte, después del smoke (paso 8).
7. **Lecturas públicas:** se llaman con `skipUnauthorizedNotification`. Un `401` inesperado del catálogo no debe cerrar la sesión del usuario.

## 3. Adaptadores

**Empresa → `Store`**

| `Store` | Origen | Si falta |
|---|---|---|
| `id`, `slug` | `id`, `slug` | — |
| `name` | `businessName` | — |
| `description` | `description` | `''` |
| `lat`, `lng` | `location.latitude`, `location.longitude` | La tienda se descarta (no se puede ubicar) |
| `categories` | `categoryId` → nombre en `ms-categories` → tabla | `[]` |
| `rating`, `totalReviews` | `rating`, `reviewCount` | `0` |
| `city` | Sin origen | `''` (`StoreCard` ya la oculta si está vacía) |
| `logo` | `logoUrl` | `null` |
| `banner` | `bannerUrl` o `operationalConfig.branding.bannerUrl` | `null` |
| `schedule` | `operationalConfig.schedule` (misma forma) | `{}` |
| `deliveryInfo.avgPrepTime` | `operationalConfig.preparationTime` | `20` |
| `deliveryInfo.fee` | `operationalConfig.delivery.fee` | Sin valor (decisión 4) |

Categorías: el nombre se normaliza (minúsculas, sin tildes) y se busca la primera palabra clave que contenga. Así funcionan nombres descriptivos como "Baterías para vehículos", que ya existen en el servidor.

| El nombre contiene | `StoreCategory` |
|---|---|
| `bateria` | `battery` |
| `llanta` | `tire` |
| `repuesto` | `spare` |
| `taller` | `shop` |

**Producto → `Product`**

| `Product` | Origen | Regla |
|---|---|---|
| `id`, `name` | `id`, `name` | — |
| `storeId` | `companyId` | — |
| `description` | `description` | `''` si falta |
| `price` | `priceOffer ?? price` | Entero COP con `Math.round` |
| `comparePrice` | `price`, solo si hay `priceOffer` menor | `null` en otro caso |
| `category` | `categoryId` | Ningún componente lo muestra |
| `brand`, `reference` | `brand`, `sku` | `''` / `undefined` si faltan |
| `stock` | `stock` | `0` si falta |
| `isAvailable` | `active`, `stock` | Decisión 3 |
| `images`, `image` | `images`, primera imagen | `[]` / `null` |
| `specs`, `specifications` | `attributes` | `{}` |
| `compatibleVehicles` | `attributes.compatibleVehicles`, si es lista de texto | `[]`; **clave pendiente de acordar con backend** |

Los productos se ordenan por nombre en el adaptador, como hacía la consulta de Supabase.

**Radio:** `radiusKm = Math.max(1, Math.ceil(radius / 1000))`; con el valor por defecto, 5000 m pasan a 5 km.

**Errores:** en `fetchStoreBySlug`, `404` y `400` devuelven `null` (la página muestra "tienda no encontrada"). Cualquier otro error se lanza, igual que hoy.

## 4. Pasos

| # | Archivos | Cambio | Hecho cuando |
|---|---|---|---|
| 1 | `next.config.js`, `.env.example` | `rewrites` de desarrollo para `/ms-companies`, `/ms-products` y `/ms-categories`, con `COMPANIES_API_ORIGIN`, `PRODUCTS_API_ORIGIN` y `CATEGORIES_API_ORIGIN` (solo servidor), siguiendo el patrón actual | Con `pnpm dev`, `curl localhost:3000/ms-companies/api/companies` responde |
| 2 | `src/services/api.ts` | Reescribir sobre `httpClient` con los adaptadores de §3; caché de categorías por sesión; eliminar `fetchStoreById` y `fetchProductById`; quitar el import de `supabaseClient` | `api.ts` no importa Supabase |
| 3 | `src/types/store.ts`, `src/types/order.ts` y la UI de §2.4 | `fee` y `OrderBreakdown.deliveryFee` admiten `null` (decisión 4) | `pnpm type-check` sin errores |
| 4 | `src/app/(main)/checkout/page.tsx` | Cargar la tienda con `fetchStoreBySlug(cartSummary.storeSlug)`; sin cambios visuales | El checkout muestra el envío de la tienda o "por confirmar" |
| 5 | `src/store/cartStore.ts` | `CART_STATE_VERSION = 2` (decisión 5) | Un carrito con versión 1 se descarta al rehidratar |
| 6 | `src/services/__tests__/api.test.ts` (nuevo) | Pruebas con `fetch` mockeado: mapeo de tienda y producto, radio, filtro de inactivos, `stock: 0`, oferta, slug `404` → `null`, categorías que fallan, tienda sin ubicación | `pnpm test`, `pnpm type-check` y `pnpm build` sin errores |
| 7 | — | Smoke en servidor con el seed: mapa y filtros, página de tienda, modal, carrito, checkout con envío correcto y pedido mock | Flujo completo sin errores en consola |
| 8 | `package.json`, `src/services/supabaseClient.ts`, `.env.example`, `Dockerfile`, `docker-compose.yml`, `../docker-compose-apps.yaml` | Retirar `@supabase/supabase-js`, el cliente y `NEXT_PUBLIC_SUPABASE_*`. Avisar a backend, porque el Compose raíz es compartido | `grep -ri supabase src` no devuelve nada |
| 9 | Docs | `ARCHITECTURE`, `DATAFLOW`, `DATA_MODEL` §6, `TESTING`, `ROADMAP`, `CHANGELOG`, `README`; archivar este plan | Ningún documento vigente presenta el catálogo como Supabase |

Orden: los pasos 1 a 6 van juntos en un commit; después vienen el 7, el 8 y el 9. El paso 7 depende del seed de backend.

## 5. Pendiente con backend

Necesario para el smoke:
- Seed de categorías con los nombres de §3, y tiendas y productos de autopartes con ubicación, slug, horario y stock.

Recomendado:
- Filtro `activo` en el servidor.
- Definir `operationalConfig.delivery.fee` y la clave de vehículos compatibles.
- Quitar `taxId` y `ownerUserId` de las respuestas públicas.
- Seguridad de escritura en `ms-products`.

El detalle de cada punto está en [BACKEND.md](./BACKEND.md) §7.
