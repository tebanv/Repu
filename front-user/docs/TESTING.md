# Testing — front-user

Fuente única para pruebas del cliente. `ROADMAP.md` solo resume el DoD por fase y apunta aquí para el detalle.

> Estado: runner instalado (Vitest 5 + jsdom). Comandos con `pnpm` exclusivo (nunca `npm`/`yarn`). Suite actual: 61 tests en 7 archivos, todos verdes (P1 Auth real, 2026-10-12; antes 47/6). La suite valida el puente Supabase actual; al cortar a Spring Boot ([ADR-001](./ADR-001-BACKEND-SPRING.md)) se reescriben los tests de adaptadores, no los de stores.

## 1. Comandos

```bash
pnpm test            # vitest run (CI) — 61 tests
pnpm test:watch      # vitest (watch en local)
pnpm test:coverage   # vitest run --coverage (v8, stores + lib)
pnpm type-check    # tsc --noEmit (0 errores en `src/`; 5 pre-existentes en `worktrees/` ajenos, ver CHANGELOG 2026-10-12)
pnpm build         # Next producción
```

Config: `vitest.config.mts` (extensión `.mts` para carga ESM sin warnings) con `environment: 'node'`, alias `@ -> ./src`, `include: src/**/*.test.ts`, setup `src/test/setup.ts` (localStorage en memoria). Tests de stores puros no necesitan jsdom salvo que toquen `window` (el setup mockea `localStorage`; `geolocation` no se mockea en ningún test actual).

## 2. Convenciones

- Ubicación: `src/**/__tests__/*.test.ts` junto al dominio (`store/__tests__/cartStore.test.ts`).
- Lógica pura primero: `cartStore`, `orderStore`, `authStore`, `storesStore`, `filterStores`, `isCartExpired`, `sanitize`.
- No duplicar fuentes: los tests importan acciones reales del store, no reimplementan reglas.
- Dinero en enteros COP (`Math.round`); cantidades mínimo 1.
- Códigos de resultado (`CartActionResult.code`) se asertan explícitos: `ITEM_ADDED`, `QUANTITY_CLAMPED`, `STORE_CONFLICT`, etc. (nota: `EXPIRED_CART` es `CartNotice`, no `CartActionResult.code`).
- Aislamiento: `localStorage.clear()` + reset de store entre tests; TTL con aritmética real de `Date` (sin `vi.useFakeTimers`).

## 3. Matriz unitaria — código actual

> Cobertura Fase A (2026-09-16) + P1 (2026-10-12): §3.1 auth, §3.2 híbrido, §3.3 carrito y §3.4 pedidos implementados en `src/store/__tests__/` + `src/services/__tests__/authService.test.ts` (61 tests). §3.5 ubicación y §3.6 toasts pendientes (sin cambios recientes, riesgo bajo).

### 3.1 Auth (`authStore.ts` + `authService.ts` real Supabase, P1)
Hereda lo útil de `TEST_LOGIN.md` (eliminado, ver §6); el servicio mockeado en tests de store, cliente Supabase mockeado en tests de servicio:
- [x] `login` ok con rol real (`comprador`/`admin`) → `isAuthenticated=true`, `user` sin `password` (email normalizado a minúsculas/trim).
- [x] `login` con credencial inválida → `false`, `error='Credenciales inválidas'`, `isAuthenticated=false`.
- [x] `login` con email/contraseña vacíos → `false`, `error='Email y contraseña son requeridos'` (sin llamada de red).
- [x] Rol DB desconocido → degrada a `comprador` sin romper (test de servicio).
- [x] `clearError` resetea el mensaje de error.
- [x] `logout` limpia `user`/`isAuthenticated` incluso si `signOut` falla (key `auth-storage` en localStorage).
- [x] `initialize()`: con sesión vigente hidrata autenticado; sin sesión descarta la local rancia; `hasHydrated=true` al terminar.
- [x] `subscribeToAuthChanges`: `SIGNED_OUT` → `null`, `SIGNED_IN` → perfil (cobertura en `authService.test.ts`).
- [ ] Rehidratación: `MainLayoutShell` espera `hasHydrated + !isLoading` antes de decidir (sin test, solo código).
- [ ] `LoginForm`: si hay sesión activa redirige a `/` (sin test, solo código).

### 3.2 Tiendas híbrido (`storesStore.ts` + `filterStore.ts` + `api.ts`)
- [ ] `fetchStores({location, filters})` guarda `masterStores` completa y `stores` ya filtrada en una sola actualización.
- [ ] `applyFilters` re-filtra en memoria sin llamar a API (mockear `fetchNearbyStores` y contar llamadas).
- [ ] Filtro vacío → `stores === masterStores`; filtro `battery/tire/spare` → solo intersección por `store.categories`.
- [ ] `selectStore/clearSelection` actualiza `selectedStoreId` sin tocar listas.
- [ ] Error de red → `error` seteado, `isLoading=false`, conserva `masterStores` previa (resiliencia).

### 3.3 Carrito (`cartStore.ts`, DoD 7.6 — prioridad máxima)
- [ ] `addItem` nuevo → `ITEM_ADDED`, fija contexto `storeId/slug/name`, `itemCount/subtotal` recalculados.
- [ ] `addItem` existente → mergea cantidades, `ITEM_UPDATED`, actualiza `price/image/name/snapshots`.
- [ ] `addItem` otra tienda → `STORE_CONFLICT` con `currentStoreId/incomingStoreId`, no muta items.
- [ ] `addItem` inválido (sin `id`/`name`, `isAvailable=false`) → `INVALID_PRODUCT`. Nota: `stock: 0` se normaliza a “sin límite” (ver §7 QUIRK) e inserta `ITEM_ADDED`, no `INVALID_PRODUCT`.
- [ ] Sin `storeId` en producto → `MISSING_STORE_CONTEXT`. Otros códigos reales: `INVALID_PRODUCT_ID`, `INVALID_STORE_CONTEXT`, `ITEM_UPDATED`, `UNKNOWN_ERROR` (+ `QUANTITY_UPDATED`, `ITEM_REMOVED`, `STORE_CONTEXT_REPLACED`).
- [ ] `updateQuantity` respeta `min(stockSnapshot, maxPerOrder)` → `QUANTITY_CLAMPED` si excede, `QUANTITY_UPDATED` si ok (clamps separados de stock vs `maxPerOrder`).
- [ ] `removeItem` inexistente → `ITEM_NOT_FOUND`; existente → `ITEM_REMOVED` y si queda vacío limpia contexto de tienda.
- [ ] `replaceStoreContext` con carrito no vacío de otra tienda → `STORE_CONFLICT`; vacío o misma tienda → `STORE_CONTEXT_REPLACED`.
- [ ] Redondeo: precios decimales → enteros COP sin drift (`price*qty` suma exacta).
- [ ] Persistencia: `sanitize` descarta items corruptos; `migrate` con `version!==1` → estado vacío; `partialize` solo persiste slice definido.
- [ ] TTL (`isCartExpired`): con items + `lastUpdatedAt` >24h → expirado; sin items → no expirado; con items sin `lastUpdatedAt` → expirado; `merge` expirado → vacío + `cartNotice EXPIRED_CART`.
- [ ] Idempotencia: doble `addItem` rápido no corrompe (resultado atómico).
- [ ] Selectores `selectCartItemByProductId` / `selectIsSameStore` (cobertura con tests).

### 3.4 Pedidos (`orderStore.ts`, Fase 8/9 mock)
- [ ] `createOrder` genera `id REP-YYYY-XXXX`, `status CREADO` (o `PAGADO` si `wompi`), `paymentStatus PENDING/PAID`, prepend + cap 20 órdenes.
- [ ] `getOrderById` retorno indexado.
- [ ] `updateOrderStatus` apendea `stateHistory` con `timestamp/note`.
- [ ] `cancelOrder` retorna `false` en `EN_CAMINO/ENTREGADO`, `true` + `CANCELADO` en resto.
- [ ] `rateOrder` guarda objeto anidado `rating: OrderRating` sin validación de rango (el test solo aserta `storeRating`).
- [ ] `driverCoordinates` inicial + `updateDriverCoordinates` (cobertura con tests).
- [ ] Selectores (sin test): `useActiveOrders` excluye `ENTREGADO/CANCELADO`; `useActiveOrdersCount` retorna `number` primitivo; `useCompletedOrders` solo finalizados.
- [ ] Persistencia `order-storage` conserva `orders` tras recarga (solo `orders`, no `isLoading/error`).

### 3.5 Ubicación (`locationStore.ts`, Fase 9.6) — especificación sin test
- [ ] `requestPermission` ok → `GRANTED` + `userCoordinates`; `code===1` → `DENIED` + `clearWatch` invocado.
- [ ] `POSITION_UNAVAILABLE/TIMEOUT` → preserva últimas coords, escucha pasiva, sin ráfaga de sets (guarda anti re-render).
- [ ] `startTracking` no duplica `watchId` si ya rastrea; `stopTracking` limpia y libera.
- [ ] Reintento vía botón “Mi Ubicación” rearma tras `DENIED` resuelto.

### 3.6 Toasts (`toastStore.ts`) — especificación sin test
- [ ] `pushToast` cota máx 4 visibles con auto-evicción (`.slice(-4)`).
- [ ] `cartNotice` → toast `warning` automático en `(main)/layout` al rehidratar expirado.

## 4. Integración UI (sin runner E2E aún, checklist con Vitest + QA manual)

- [ ] Agregar desde `ProductModal` actualiza `CartButton` (`itemCount/subtotal` reactivos).
- [ ] Recarga conserva carrito (`cart-storage`) y sesión (`auth-storage`).
- [ ] Vaciar carrito limpia UI + `CartDrawer` muestra estado vacío.
- [ ] Conflicto multi-tienda abre `StoreConflictDialog`; “Vaciar y continuar” reemplaza, cancelar preserva.
- [ ] `CartDrawer`: `+/-`, eliminar botón + swipe-left móvil, subtotal animado, `Escape` cierra, foco inicial en cerrar.
- [ ] Checkout: carrito vacío redirige a `/`; confirmar crea orden + `clearCart` + toast + pantalla `REP-XXXX` con botón “Seguir Pedido” → `/order/[id]`.
- [ ] Tracking: `/order/[id]` resuelve por URL (sin singleton), timeline `CREADO→ENTREGADO`, `ENTREGADO` abre `OrderRatingModal`.
- [ ] Header: badge carrito + botón “Pedidos en curso” con `useActiveOrdersCount`, abre `ActiveOrdersDrawer` sin recarga.

## 5. QA manual (no automatizable barato)

- [ ] Safari iOS: agregar producto → CTA `Ver carrito` sin bloque azul; scroll con barra dinámica mantiene posición (guardrail: no animar `transform` en nodo `fixed`).
- [ ] Chrome iOS + desktop: mismo flujo, layout intacto.
- [x] Multi-tab: `enableCrossTabSync` (`src/lib/storageSync.ts`) rehidrata `cart-storage` ante `storage` event — verificado con tests para `cart-storage`; `order-storage` usa el mismo helper (suscripción en `orderStore`) sin test directo. Pendiente QA en 2 pestañas reales.
- [x] Carrito expirado: `merge` vacía + `cartNotice EXPIRED_CART` + `track('cart_expired', {reason})` — cubierto en `cartStore.test.ts` (TTL + rehidratación corrupta).
- [ ] Sin GPS: denegar permiso → mapa navegable en `DEFAULT_LOCATION` + cápsula `[ 📍 Permitir ubicación ]` visible; modal minimizable no bloquea `StoresLayer`.
- [ ] Login autofill (Chrome): carga fresca con credenciales guardadas → label flotado; vaciar+blur → label al centro.
- [ ] Debugging (heredado de `TEST_LOGIN.md`): DevTools → Application → Local Storage → keys `auth-storage`, `cart-storage`, `order-storage`; limpiar con `localStorage.clear(); location.reload()`.

## 6. Legado `TEST_LOGIN.md` (eliminado)

Se migró lo útil y se eliminó el archivo para evitar doble fuente:
 - Conservado: credenciales seed (§3.1, ahora en Supabase Auth, nunca prod), persistencia `auth-storage` + recarga, flujo logout, debugging localStorage.
- Descartado: estructura de carpetas `.js` (ya es `.tsx`), capturas “Mall Virtual” (branding hoy `Repu`), pasos que asumían `layout.js/page.js`.
 - Credenciales dev (seed Supabase Auth, nunca prod): `admin@mallvirtual.com/admin123`, `usuario@demo.com/user123`, `demo@demo.com/demo123`.

## 7. Deuda y siguientes

- [x] Instalar runner (A1) y dejar `pnpm test` verde — 47/47, `type-check` 0 errores, `build` ok (verificado 2026-09-16).
- [x] Multi-tab sync + evento `cart_expired` (A2) — `storageSync.ts` + `analytics.ts`, con tests.
- [ ] QUIRK conocido: `stock: 0` se normaliza a “sin límite” (igual que `null`) en vez de agotado. Test lo documenta (`cartStore.test.ts`). Decidir regla de agotado antes del backend real (ver §3.3: `stock 0` → `ITEM_ADDED`, no `INVALID_PRODUCT`).
- [ ] `pnpm lint` roto a nivel entorno (pre-existente, no de Fase A): `eslint-config-next@15.2.2` no soporta TS 7.0 (`typescript-eslint does not support TS 7.0`).Resolver al margen: subir eslint-config-next o fijar TS soportado.
- [ ] Al conectar Spring Boot (ADR-001): tests de adaptadores REST (`api.ts`, `authService.ts`, futuro `orderService.ts`) con mocks de red; UI/stores no se tocan (Zero-Coupling). No se planifican tests de Supabase Realtime: el tracking va por SSE/STOMP.
- [ ] Futuro E2E (Playwright) solo para checkout→tracking cuando haya backend real.
