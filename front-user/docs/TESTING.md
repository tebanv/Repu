# Pruebas

Cómo se prueba el front y qué falta cubrir.

**Última ejecución (2026-11-05):** `pnpm test` 140/140 en 14 archivos, `pnpm type-check` sin errores, `pnpm build` correcto. `pnpm lint` falla ([§4](#4-deuda)).

## 1. Comandos y configuración

```bash
pnpm test            # vitest run
pnpm test:watch      # vitest en modo watch
pnpm test:coverage   # cobertura v8 de src/store y src/lib; no incluye src/services
pnpm type-check      # tsc --noEmit
pnpm build           # build de producción
```

`vitest.config.mts` usa `environment: 'node'`, el alias `@`, `include: src/**/*.test.ts` y el setup `src/test/setup.ts`, que aporta un `localStorage` en memoria. `jsdom` está instalado, pero la suite no lo usa; por eso no hay tests de componentes.

## 2. Convenciones

- Los tests viven en `src/**/__tests__/*.test.ts`, junto a su dominio.
- Importan las acciones reales del store; no reimplementan reglas.
- Los códigos de resultado se asertan de forma explícita (`ITEM_ADDED`, `STORE_CONFLICT`, etc.).
- Entre tests: `localStorage.clear()` y reset del store.
- El TTL se prueba con aritmética real de `Date`, sin fake timers.
- Los servicios se prueban con `fetch` mockeado.

## 3. Cobertura

| Archivo | Tests | Cubre |
|---|---|---|
| `store/__tests__/cartStore.test.ts` | 26 | Altas y merge, una tienda por carrito, límites, redondeo, TTL (y vaciado pendiente en el servidor), rehidratación, descarte de v1, migración v2 → v3 (pendientes) y selectores puros. `cartService` simulado |
| `store/__tests__/orderStore.test.ts` | 9 | Creación, tope de 20, historial, cancelación, calificación y coordenadas |
| `store/__tests__/cartStoreSync.test.ts` | 11 | Sincronización con `ms-orders`: una ráfaga = una petición con la cantidad final, precio del servidor, vaciar al quitar el último, cambio de tienda en orden, `resetAfterCheckout` sin vaciar el servidor, red caída (pendiente y reintento), producto/tienda no disponible, arranque (gana el servidor salvo lo pendiente) y lectura compartida |
| `store/__tests__/authStore.test.ts` | 7 | Login, logout e `initialize` con y sin sesión |
| `store/__tests__/storesStore.test.ts` | 5 | Filtrado híbrido, error de red y selección |
| `services/__tests__/api.test.ts` | 13 | Adaptadores de tienda y producto, radio, categorías por palabra clave y su caché, inactivos, agotado, oferta, envío sin definir, slug 404/400 y 401 sin cierre de sesión |
| `services/__tests__/cartService.test.ts` | 15 | Adaptador y redondeo, `CART_NOT_FOUND`, cantidad absoluta sobre la API actual (subir con diferencia, bajar con `DELETE` + `POST`, `0`, sin cambios), relectura tras error de red (no duplica), `CART_ITEM_NOT_FOUND` con reintento, vaciar y clasificación de errores |
| `services/__tests__/addressService.test.ts` | 5 | Adaptador de `ms-users`, coordenadas incompletas, dirección por defecto, listar y crear |
| `services/__tests__/authService.test.ts` | 11 | Login + perfil, roles, registro, recuperación, logout y `401` global |
| `services/__tests__/httpClient.test.ts` | 13 | Estados HTTP, errores y `code`, `X-Request-ID` (UUID v4, fijado por el llamador, respaldo sin `randomUUID`), `PUT`, credenciales y evento `unauthorized` |
| `__tests__/proxy.test.ts` | 12 | Redirect sin cookie, ambas cookies de sesión, cookie vacía y `matcher` (rutas protegidas sí; `/login`, `/ms-*` y estáticos no) |
| `lib/__tests__/syncQueue.test.ts` | 8 | Coalescing por clave, ejecución en serie, `flush`, cambio durante la ejecución, `cancel`, tarea que falla y notificación de actividad |
| `lib/__tests__/storageSync.test.ts` | 3 | Sincronización entre pestañas de `cart-storage` |
| `lib/__tests__/analytics.test.ts` | 2 | Telemetría |

### Sin cobertura automatizada

- `locationStore`: permisos, `clearWatch` y escucha pasiva.
- `toastStore` y `filterStore`.
- `subscribeToAuthChanges`: `BroadcastChannel` y `storage`. Solo está probado el `401` global.
- Selectores `useActiveOrders`, `useActiveOrdersCount` y `useCompletedOrders`.
- Persistencia de `order-storage` y su sincronización entre pestañas.
- Componentes y flujos de UI; no hay runner E2E. Conviene Playwright para checkout y tracking cuando haya backend real.

### QA manual

**Verificado en servidor (2026-10-31):** login correcto e incorrecto, perfil, logout, `401` posterior, redirect a `/`, `auth-storage` sin `accessToken`, sesión compartida entre pestañas y logout propagado.

**Pendiente:**
- Auth: ver [AUTHENTICATION.md](./AUTHENTICATION.md) §9.
- Safari iOS, Chrome iOS y desktop: agregar un producto y hacer scroll; el CTA `Ver carrito` no debe mostrar bloque de color ni moverse ([ARCHITECTURE.md](./ARCHITECTURE.md) §7).
- Carrito en dos pestañas reales.
- Sin GPS: al denegar el permiso, el mapa sigue navegable en `DEFAULT_LOCATION` y la cápsula de ubicación queda visible.
- Autofill de Chrome en login: label flotado al cargar y centrado al vaciar y salir del campo.
- Flujo completo de compra: `ProductModal` → `CartButton` → `CartDrawer` → `/checkout` → `/order/[id]` → calificación.
- Conflicto multi-tienda: "Vaciar y continuar" reemplaza el carrito; cancelar lo conserva.

Para depurar, revisar en DevTools → Application → Local Storage las claves `auth-storage`, `cart-storage` y `order-storage`.

## 4. Deuda

- **`stock: 0` en `cartStore`:** el carrito todavía lo trata como "sin límite". Desde el corte de catálogo no llega a ocurrir, porque el adaptador marca esos productos como no disponibles y el carrito los rechaza.
- **`pnpm lint`:** falla al cargar la configuración porque `eslint-config-next@15.2.2` usa una versión de `typescript-eslint` que no soporta TypeScript 7. Hay que subir `eslint-config-next` o fijar una versión de TypeScript compatible.
- **Al conectar más microservicios:** agregar tests de adaptadores con red mockeada.
