# Hoja de Ruta Detallada — Plataforma de Delivery (Geolocalización + Catálogo + Carrito + Checkout + Tracking) con Zustand

Filosofía: Mantenemos el enfoque progresivo: base → datos → interacción → pulido. Integramos pruebas, manejo de errores robusto y optimizaciones desde las primeras etapas, usando Zustand para un estado global eficiente.

---

## Fase 1: Fundación y Estructura Base

*Esta fase se considera completada.*

- **Setup del Proyecto Next.js**
- **Estructura de Carpetas Inicial**
- **Layout y Componentes Placeholder**

---

## Fase 2: Ubicación, Mapa Base y Gestión de Estado

*Esta fase se considera completada.*

- **Utilidades y Constantes**
- **Store de Ubicación (`src/store/locationStore.ts`)**
- **UI para Permiso de Ubicación**
- **Integración de Mapbox (`src/components/map/MapContainer.tsx`)**

---

## Fase 3: Obtención y Visualización de Tiendas

*Esta fase se considera completada.*

- **Servicio de API (`src/services/api.ts`)**
- **Store de Tiendas (`src/store/storesStore.ts`)**
- **Capa de Tiendas (`src/components/map/layers/StoresLayer.tsx`)**
- **Actualización de `MapContainer.tsx` para la carga inicial**

---

## Fase 4: Implementación de Filtros

*Esta fase se considera completada.*

### Datos de Categorías (`src/types/store.ts` + datos en `src/services/api.ts`)
- **Acción:** Definir categorías (ID, nombre, icono).

### Store de Filtros (`src/store/filterStore.ts`)
- **Acción:** Crear store con Zustand. Estado (`activeFilters` - ej. un Set de IDs). Acciones (`toggleFilter`, `clearFilters`).
- **Propósito:** Gestionar el estado de los filtros activos, sin contener lógica de aplicación de filtros.

### Componentes de UI para Filtros (integrados en `FilterBanner.tsx`)
- **Acción:** Crear la UI que permita al usuario interactuar y actualizar el `filterStore`.

### Integración en el Banner (`src/components/layout/FilterBanner.tsx`)
- **Acción:** Integrar la lista de filtros en la UI principal.

---

## Fase 4.5: Refactorización del Flujo de Datos [COMPLETADO]

Esta fase crucial se introdujo para mejorar la arquitectura antes de añadir más complejidad.

- **[HECHO] Adoptar Estrategia Híbrida de Carga + Filtrado en Cliente:**
    - **Acción:** `src/services/api.ts` (`fetchNearbyStores`) devuelve tiendas cercanas por ubicación/radio **sin filtrar por categoría**.
    - **Propósito:** reducir llamadas de red al cambiar filtros y habilitar respuesta instantánea en UI.

- **[HECHO] Estructura Híbrida en `storesStore`:**
    - **Acción:** `src/store/storesStore.ts` mantiene `masterStores` (respuesta completa de API para el área) y `stores` (subset visible filtrado en memoria).
    - **Propósito:** preservar una fuente local de datos para re-filtrar sin refetch.

- **[HECHO] Centralizar la Orquestación de Datos en `MapContainer.tsx`:**
    - **Acción:** `MapContainer.tsx` hace `fetchStores` al cargar y en `moveend` (con debounce), y ejecuta `applyFilters(activeFilters)` cuando cambian los filtros.
    - **Propósito:** separar claramente eventos de red (movimiento geográfico) de eventos de UI (filtros).

- **[HECHO] Eliminar Lógica de Filtrado de la Capa de Visualización:**
    - **Acción:** Se refactorizó `StoresLayer.tsx` para que sea un componente puramente presentacional. Ya no se suscribe a `filterStore` ni realiza ningún tipo de filtrado.
    - **Propósito:** Mejorar la separación de responsabilidades. `StoresLayer.tsx` ahora solo se preocupa de renderizar lo que se le da.

---

## Fase 5: Interacción con Tiendas y Panel de Información

*Esta fase está parcialmente completada.*

### Estabilización de Rendimiento [COMPLETADO - Febrero 2026]

- **[HECHO] Reducir renders no deseados del mapa:**
    - **Acción:** `MapSection` fue memoizado para evitar re-render por actualizaciones del layout no relacionadas con el mapa.
    - **Propósito:** mantener estable el costo de render del módulo de mapa durante cambios de UI periférica.

- **[HECHO] Optimizar ciclo de anuncios (`AdCarousel`):**
    - **Acción:** se eliminó el estado de progreso con actualizaciones de alta frecuencia y se dejó transición por duración de slide.
    - **Propósito:** reducir commits de React y ruido en perfilado de componentes.

- **[HECHO] Evitar recargas redundantes en `moveend`:**
    - **Acción:** `MapContainer` ahora aplica umbral mínimo de desplazamiento del centro antes de ejecutar `fetchStores`.
    - **Propósito:** disminuir llamadas de red y trabajo de render cuando el usuario realiza desplazamientos cortos.

- **[HECHO] Suscripciones selectivas de Zustand en componentes críticos:**
    - **Acción:** reemplazo de suscripciones amplias por selectores específicos.
    - **Propósito:** reducir re-renderizados por cambios de estado no utilizados por cada componente.

### Componente Marcador (`src/components/map/StoreMarker.tsx`) [HECHO]
- **Acción:** Marcador individual. Manejar `onClick` para llamar a la acción `selectStore(storeId)` de `storesStore`.

### Actualizar Capa Tiendas (`src/components/map/layers/StoresLayer.tsx`) [HECHO]
- **Acción:** Usar `StoreMarker` para cada tienda.

### Tarjeta de Información de la Tienda (`src/components/stores/StoreCard.tsx`) [HECHO]
- **Acción:** Mostrar detalles de la tienda seleccionada.

### Actualizar Panel de Información (`src/components/layout/InfoPanel.tsx`) [HECHO]
- **Acción:** Suscribirse a `storesStore.selectedStoreId` para renderizar condicionalmente `StoreCard` o un contenido por defecto (ej. `AdCarousel`).

---

## Fase 6: Página de Detalle de Tienda (Catálogo) [COMPLETADO - Marzo 2026]

Esta fase transforma la aplicación de un mapa de localización a un catálogo navegable de productos, permitiendo al usuario explorar la oferta de cada tienda.

### Routing y Estructura de Página (`src/app/(main)/store/[slug]/page.tsx` + `StoreView.tsx`) [HECHO]
- **Acción:** Implementar la lógica dinámica para capturar el `slug`.
- **Manejo de estados:** Crear vistas para "Cargando", "Tienda no encontrada" y "Tienda cerrada".
- **Integración actual:** cargar datos desde `src/services/api.ts` con fetch por `slug` e ID de tienda.

### Servicios de Datos (`src/services/api.ts`) [HECHO]
- **Acción:** Extender la API mock para soportar productos.
    - `fetchStoreBySlug(slug)`: Recuperar detalles completos de la tienda.
    - `fetchStoreById(storeId)`: Recuperar una tienda por ID.
    - `fetchProductsByStore(storeId)`: Recuperar inventario por tienda.
    - `fetchProductById(productId)`: Recuperar un producto por ID.
- **Propósito:** Proveer datos estructurados para renderizar el grid de productos.

### UI de Tienda [HECHO]
- **Header (`components/stores/StoreHeader.tsx`):** Mostrar brand, rating, tiempos de entrega y costos de envío.
- **Grid de Productos (`components/stores/ProductGrid.tsx`):** Rejilla responsiva para listar productos.
- **Tarjeta de Producto (`components/stores/ProductCard.tsx`):** Componente individual con iconografía de producto, precio, nombre y botón rápido de acción.
- **Modal de Producto (`components/stores/ProductModal.tsx`):** Modal con detalle, especificaciones, compatibilidad vehicular y selector de cantidad.
- **Medios de producto [PENDIENTE POSTERIOR]:** incorporar fotos reales de producto en catálogo, modal y carrito cuando exista ese activo en backend/contenido.

### Estabilidad Safari iOS (CTA carrito) [COMPLETADO - Marzo 2026]

- **[HECHO] Resolver artefacto visual en barra inferior de Safari iOS:**
    - **Acción:** patrón en dos capas para `CartButton`: contenedor externo `fixed` estático (posición y safe-area) + contenedor interno animado para transición visual.
    - **Propósito:** evitar sangrado/bloque de color en el área inferior cuando aparece el CTA flotante.

- **[HECHO] Safe-area desacoplado del color del CTA:**
    - **Acción:** utilidades CSS dedicadas para padding inferior (`mobile-safe-area-screen`, `safe-bottom-pad`) separadas de la cápsula visual del botón.
    - **Propósito:** prevenir que el color del botón “pinte” detrás de la barra dinámica de Safari.

- **[HECHO] Viewport dinámico en vista tienda móvil:**
    - **Acción:** uso de `min-h-screen` + `min-h-[100dvh]` en estados principales de la página de tienda.
    - **Propósito:** mejorar estabilidad frente a cambios de altura por barras dinámicas del navegador móvil.

- **Guardrail de implementación:**
    - No animar con `transform` el mismo nodo que tiene `position: fixed` para CTAs inferiores en iOS Safari.

- **Checklist QA rápido (carrito móvil):**
    - Safari iOS: agregar producto, verificar aparición de `Ver carrito` sin bloque/footers de color debajo.
    - Safari iOS: abrir/cerrar barra inferior (scroll suave) y confirmar que el CTA mantiene posición correcta.
    - Chrome iOS: repetir flujo y validar consistencia visual.
    - Desktop: confirmar que layout y posición del CTA no cambian respecto al comportamiento esperado.

---

## Fase 7: Gestión de Carrito y Lógica de Compra [COMPLETADO - Abril 2026]

Implementación de la persistencia de la elección del usuario y reglas de negocio para la compra.

### Objetivo de Producto (MVP sólido)
- Un carrito **persistente, consistente y auditable** que soporte el flujo real de compra sin perder estado entre navegación, recargas o cierres de sesión.
- El carrito debe ser la **fuente única de verdad** para cantidades, subtotales y reglas de tienda.

### Alcance funcional (orden de implementación)
1. **Persistencia y modelo de estado del carrito [HECHO]**
2. **Integración UI catálogo → carrito [HECHO]**
3. **Vista de carrito editable (pre-checkout) [HECHO]**
4. **Hardening y migración a TypeScript [HECHO]**

### 7.1 Store de Carrito (`store/cartStore.ts`) [COMPLETADO - Abril 2026]
- **Estado actual [HECHO]:** se creó la base del store con Zustand + `persist` en `localStorage` + `immer`, respetando el patrón de **datos + acciones** y moviendo los selectores reactivos fuera del estado interno del store.
- **Estado actual [HECHO]:** el store ya persiste `storeId`, `storeSlug`, `storeName`, `items`, `itemCount`, `subtotal`, `lastUpdatedAt` y `version`.
- **Estado actual [HECHO]:** ya existen las acciones base `addItem`, `removeItem`, `updateQuantity`, `clearCart` y `replaceStoreContext`.
- **Estado actual [HECHO]:** ya existe saneo de estado persistido y estrategia de rehidratación segura con `version`.
- **Estado actual [HECHO]:** se implementó prevención de carritos “zombies” con TTL de 24 horas usando `lastUpdatedAt`; si el carrito persistido expiró, se vacía automáticamente al rehidratar.
- **Estado actual [HECHO]:** se agregó un aviso reactivo (`cartNotice`) para que la UI pueda informar expiración automática del carrito tras abrir la app.
- **Motivación técnica:** reducir complejidad accidental y errores por manipulación manual de arrays/objetos con múltiples `spread`, manteniendo legibilidad en reglas de negocio críticas.
- **Estructura mínima recomendada / ya cubierta en la base actual:**
    - `storeId`, `storeSlug`, `storeName` (contexto de tienda activa del carrito)
    - `items[]` con `productId`, `name`, `price`, `image`, `quantity`, `stockSnapshot`, `maxPerOrder?`
    - derivados: `itemCount`, `subtotal`
    - flags: `lastUpdatedAt`, `version`
- **Acciones base ya disponibles:**
    - `addItem(product, quantity)`
    - `removeItem(productId)`
    - `updateQuantity(productId, quantity)`
    - `clearCart()`
    - `replaceStoreContext(store)` (solo cuando el carrito está vacío o con confirmación explícita)
- **Selectores/hooks reactivos ya disponibles:**
    - resumen reactivo del carrito (`useCartSummary` / selector derivado)
    - item puntual por producto (`useCartItem` / selector derivado)
    - compatibilidad de tienda (`useIsSameCartStore` / selector derivado)
    - aviso reactivo de eventos del carrito (`useCartNotice`)
    - estado de rehidratación (`useCartHasHydrated`)
- **Integraciones cerradas:**
    - conexión de `cartNotice` mediante `toastStore` para mostrar automáticamente el mensaje de expiración al rehidratar
    - sincronización de estado persistido y versionado (`CART_STATE_VERSION = 1`)

### 7.1.1 Patrones de implementación (estado robusto)
- **Estado actual [HECHO]:** `persist` + `immer` ya están aplicados en conjunto en la base del store.
- `persist` + `immer` deben aplicarse en conjunto para asegurar:
    - escritura legible y mantenible de mutaciones de carrito,
    - serialización estable para rehidratación,
    - menor riesgo de regressions al añadir reglas de negocio complejas.
- **Estado actual [HECHO]:** el estado persistido ya incluye `version` y estrategia de migración/reset para cambios de shape.
- **Pendiente:** evaluar si el TTL debe ser configurable por entorno cuando se conecte con backend real o reglas por categoría de producto.

### 7.2 Reglas de negocio (obligatorias para producción)
- **Regla de una tienda por pedido [HECHO]:** bloquear mezcla de tiendas por defecto; si entra producto de otra tienda, disparar flujo de confirmación para vaciar carrito o cancelar acción.
- **Integridad de cantidades [HECHO]:** mínimo 1, máximo por stock disponible y/o `maxPerOrder`.
- **Regla de capacidad logística (contexto Repu) [PENDIENTE]:** bloquear combinaciones de carrito que superen límites operativos de reparto (peso/volumen/capacidad del vehículo de última milla). Ejemplo: no permitir un total de baterías que exceda la carga máxima definida para entrega en moto.
- **Idempotencia UX [HECHO]:** múltiples taps rápidos en “Agregar” no deben generar estado corrupto (actualización atómica en store).
- **Rehidratación segura [HECHO]:** al montar app, validar shape/version del estado persistido y resetear si está corrupto o desactualizado.
- **Redondeo monetario [HECHO]:** todas las operaciones en enteros (COP sin decimales) o estrategia consistente para evitar drift de totales.
- **Sincronización multi-tab (web) [HECHO - Septiembre 2026]:** `enableCrossTabSync` (`src/lib/storageSync.ts`) rehidrata `cart-storage`/`order-storage` ante `storage` event de otra pestaña. Tests en `src/lib/__tests__/storageSync.test.ts`. Detalle en `docs/TESTING.md §5`.

### 7.3 Integración de UI (catálogo y CTA) [COMPLETADO - Abril 2026]
- **`ProductModal` [HECHO]**
    - Ya usa acciones del `cartStore` a través del contenedor de la página.
    - Solo se cierra en altas válidas; los errores bloqueantes ya no aparentan éxito.
- **`CartButton` [HECHO]**
    - Ya consume `itemCount` y `subtotal` desde selectores reactivos del store.
    - Mantiene el patrón iOS Safari estabilizado (wrapper `fixed` estático + capa interna animada).
- **Página de tienda (`app/(main)/store/[slug]/page.tsx`) [HECHO]**
    - Se eliminó el `useState` local del carrito para evitar doble fuente de verdad.
    - Conserva solo estado de UI (modal abierto/cerrado, selección de producto, confirmación de conflicto).
- **Feedback UX [HECHO]**
    - Se añadió un sistema mínimo de toasts reactivos para agregado, actualización, clamp de cantidad y expiración por TTL.
    - El conflicto multi-tienda ahora usa confirmación explícita antes de vaciar y reemplazar el carrito.

### 7.4 Vista de carrito (pre-checkout) [COMPLETADO - Abril 2026]
- **Drawer pre-checkout [HECHO]:**
    - listado editable de items desde `cartStore`
    - controles `+/-` y botón visible de eliminar
    - subtotal reactivo con transición suave
    - CTA “Continuar a checkout” listo para enlazar la Fase 8
- **Estados obligatorios [HECHO]:**
    - cargando durante rehidratación (`hasHydrated`)
    - vacío
    - cargado
    - error de sincronización local
- **Accesibilidad mínima [HECHO]:**
    - foco inicial en el botón de cierre
    - cierre con `Escape`
    - botones con `aria-label`
    - navegación por teclado
- **Interacción móvil adicional [HECHO]:**
    - gesto swipe-left con Framer Motion para eliminar items
    - animación de colapso (`AnimatePresence`) al remover productos
    - subtítulo con `storeName` para claridad logística inmediata

### 7.5 Resiliencia, métricas y trazabilidad
- **Manejo de errores de negocio:** mensajes claros para stock insuficiente, cambio de tienda y producto no disponible.
- **Eventos de analítica (mínimo) [PENDIENTE]:** `cart_item_added`, `cart_item_removed`, `cart_quantity_updated`, `cart_cleared`, `cart_store_conflict`.
- **Observabilidad de desarrollo:** logs de depuración solo en entorno dev, sin exponer datos sensibles.
- **Nota de integridad de inventario:** `stockSnapshot` local es referencial para UX rápida; nunca se considera fuente de verdad transaccional al momento de pagar.
- **Estado actual [HECHO parcial]:** ya existe base para expiración automática por antigüedad (`TTL`) usando `lastUpdatedAt`.
- **[HECHO - Septiembre 2026]:** telemetría `cart_expired` con razón (`ttl_exceeded`/`missing_timestamp`) vía `src/lib/analytics.ts` (sink dev-only, no-op en prod) + log dev controlado. Suite Vitest: 47 tests (`cartStore`, `orderStore`, `authStore`, `storesStore`, `storageSync`, `analytics`). Detalle en `docs/TESTING.md`.
- **Pendientes:**
- QUIRK conocido: `stock: 0` se trata como ilimitado (igual que `null`); decidir regla de agotado antes del backend real.

### 7.6 Pruebas y criterios de salida (Definition of Done)
> Detalle y matriz en `docs/TESTING.md §3.3-§3.6` y `§4-§5`. Aquí solo el puntero por fase.
- **Unitarias (store):** `addItem` mergea, `updateQuantity` respeta límites, multi-tienda bloquea, persistencia/rehidratación, TTL + `cartNotice`.
- **Integración (UI):** `ProductModal`→`CartButton`, recarga conserva, vaciar limpia, expirado avisa, drawer sincroniza subtotal/CTA.
- **DoD Fase 7:**
    - carrito persistente activo en toda la app
    - sin duplicidad de estado local/global
    - expiración por TTL resuelta y comunicada en UI
    - base estable para iniciar Fase 8 (checkout)

---

## Fase 7.7: Migración Completa a TypeScript y Tipado de Contratos [COMPLETADO - Agosto 2026]

Migración total del frontend cliente (`front-user`) de JavaScript a **TypeScript con tipado estricto**. Esta fase blinda las reglas de negocio del carrito, formaliza los modelos de datos compartidos con el backend (OpenAPI) y sienta las bases para implementar Checkout (Fase 8) y Tracking en vivo (Fase 9) con cero fricción de tipos.

### Alcance e Inventario de Archivos (37 archivos)

#### 1. Subfase 7.7.1: Configuración del Entorno y Tooling
- **Acción:**
  - Instalar dependencias con pnpm: `typescript`, `@types/react`, `@types/react-dom`, `@types/node`, `@types/mapbox-gl`.
  - Configurar `tsconfig.json` con `strict: true`, path alias `@/*` y soporte de Next.js App Router.
  - Añadir script `"type-check": "tsc --noEmit"` en `package.json`.
- **Archivos a crear/modificar:**
  - `tsconfig.json`
  - `next-env.d.ts`
  - `package.json`

#### 2. Subfase 7.7.2: Definición de Contratos y Modelos Centrales (`src/types/`)
- **Acción:** Crear definiciones de tipos TypeScript para todo el dominio de la app.
- **Archivos a crear:**
  - `src/types/common.ts`: Coordenadas (`Coordinates`, `GeoBoundingBox`), respuestas estándar de acción (`ActionResult<T>`).
  - `src/types/auth.ts`: Modelos de usuario (`User`), sesión y credenciales de login.
  - `src/types/store.ts`: Estructura de tienda (`Store`), horarios (`StoreSchedule`), info de entrega (`StoreDeliveryInfo`), categorías (`StoreCategory`).
  - `src/types/product.ts`: Modelo de producto (`Product`), especificaciones técnicas (`ProductSpecs`), compatibilidad de vehículos.
  - `src/types/cart.ts`: Items de carrito (`CartItem`), contexto de tienda, resumen (`CartSummary`), avisos (`CartNotice`), uniones discriminadas de resultados (`CartActionResult`).
  - `src/types/toast.ts`: Estructura de toast (`Toast`), variantes (`ToastVariant`), payload de inserción (`ToastPayload`).
  - `src/types/index.ts`: Barrel file para re-exportar tipos del dominio.

#### 3. Subfase 7.7.3: Capa Pura (Utilidades, Datos Mock y Servicios)
- **Acción:** Migrar lógica independiente de React a `.ts` con tipado estricto de parámetros y retornos.
- **Archivos a migrar:**
  - `src/lib/constants.js` $\rightarrow$ `src/lib/constants.ts`
  - `src/lib/geoUtils.js` $\rightarrow$ `src/lib/geoUtils.ts`
  - `src/data/products.js` $\rightarrow$ `src/data/products.ts`
  - `src/services/geolocationService.js` $\rightarrow$ `src/services/geolocationService.ts`
  - `src/services/authService.js` $\rightarrow$ `src/services/authService.ts`
  - `src/services/api.js` $\rightarrow$ `src/services/api.ts`

#### 4. Subfase 7.7.4: Estado Global (Stores de Zustand)
- **Acción:** Migrar los 6 stores de Zustand usando tipado formal de State, Actions y selectores exportados.
- **Archivos a migrar:**
  - `src/store/toastStore.js` $\rightarrow$ `src/store/toastStore.ts`
  - `src/store/filterStore.js` $\rightarrow$ `src/store/filterStore.ts`
  - `src/store/locationStore.js` $\rightarrow$ `src/store/locationStore.ts`
  - `src/store/storesStore.js` $\rightarrow$ `src/store/storesStore.ts`
  - `src/store/authStore.js` $\rightarrow$ `src/store/authStore.ts`
  - `src/store/cartStore.js` $\rightarrow$ `src/store/cartStore.ts` (Tipado estricto de mutaciones immer, persist middleware y hooks)

#### 5. Subfase 7.7.5: Componentes UI
- **Acción:** Migrar componentes presentacionales y contenedores a `.tsx` con interfaces de props bien definidas.
- **Lotes de migración:**
  - **Lote A (UI Genéricos y Auth):**
    - `src/components/ui/LoadingIndicator.js` $\rightarrow$ `.tsx`
    - `src/components/ui/ToastViewport.js` $\rightarrow$ `.tsx`
    - `src/components/ui/AdCarousel.js` $\rightarrow$ `.tsx`
    - `src/components/auth/LoginForm.js` $\rightarrow$ `.tsx`
    - Limpieza: Eliminar `src/components/ui/LocationControlProvider.js` (archivo duplicado legacy).
  - **Lote B (Módulo de Mapa):**
    - `src/components/map/controls/LocationButton.js` $\rightarrow$ `.tsx`
    - `src/components/map/controls/ZoomControl.js` $\rightarrow$ `.tsx`
    - `src/components/map/StoreMarker.js` $\rightarrow$ `.tsx`
    - `src/components/map/layers/StoresLayer.js` $\rightarrow$ `.tsx`
    - `src/components/map/LocationControlProvider.js` $\rightarrow$ `.tsx`
    - `src/components/map/LocationPermissionModal.js` $\rightarrow$ `.tsx`
    - `src/components/map/MapContainer.js` $\rightarrow$ `.tsx`
  - **Lote C (Módulo de Tiendas y Carrito):**
    - `src/components/stores/ProductIcon.js` $\rightarrow$ `.tsx`
    - `src/components/stores/ProductCard.js` $\rightarrow$ `.tsx`
    - `src/components/stores/ProductGrid.js` $\rightarrow$ `.tsx`
    - `src/components/stores/ProductModal.js` $\rightarrow$ `.tsx`
    - `src/components/stores/StoreCard.js` $\rightarrow$ `.tsx`
    - `src/components/stores/StoreHeader.js` $\rightarrow$ `.tsx`
    - `src/components/stores/StoreConflictDialog.js` $\rightarrow$ `.tsx`
    - `src/components/stores/CartButton.js` $\rightarrow$ `.tsx`
    - `src/components/stores/CartDrawer.js` $\rightarrow$ `.tsx`
  - **Lote D (Layout de Página Principal):**
    - `src/components/layout/AppHeader.js` $\rightarrow$ `.tsx`
    - `src/components/layout/FilterBanner.js` $\rightarrow$ `.tsx`
    - `src/components/layout/StoresList.js` $\rightarrow$ `.tsx`
    - `src/components/layout/InfoPanel.js` $\rightarrow$ `.tsx`
    - `src/components/layout/MapSection.js` $\rightarrow$ `.tsx`
    - `src/components/layout/PageLayout.js` $\rightarrow$ `.tsx`

#### 6. Subfase 7.7.6: Rutas y Layouts (Next.js App Router)
- **Acción:** Migrar páginas y layouts a `.tsx` con tipado de PageProps y Params.
- **Archivos a migrar:**
  - `src/app/layout.js` $\rightarrow$ `src/app/layout.tsx`
  - `src/app/(auth)/layout.js` $\rightarrow$ `src/app/(auth)/layout.tsx`
  - `src/app/(auth)/login/page.js` $\rightarrow$ `src/app/(auth)/login/page.tsx`
  - `src/app/(main)/layout.js` $\rightarrow$ `src/app/(main)/layout.tsx`
  - `src/app/(main)/page.js` $\rightarrow$ `src/app/(main)/page.tsx`
  - `src/app/(main)/store/[slug]/page.js` $\rightarrow$ `src/app/(main)/store/[slug]/page.tsx`

#### 7. Subfase 7.7.7: Verificación, Linters y Cierre
- **Criterios de salida (Definition of Done):**
  - `pnpm type-check` pasa con **0 errores de TypeScript**.
  - `pnpm build` compila con éxito la aplicación en modo producción.
  - Cero archivos `.js` o `.jsx` residuales dentro de `src/`.
  - Actualizar `docs/FOLDER_STRUCTURE.md` y `docs/PROJECT_GUIDE.md` reflejando la estructura `.ts`/`.tsx`.

---

## Fase 8: Checkout y Simulación de Pedido [COMPLETADO - Agosto 2026]

Cierre del ciclo de compra.

- **[HECHO] Validación de Carrito y Contexto:** Resguardo contra carritos vacíos con redirección automática y cálculo financiero por tienda.
- **[HECHO] Vista de Checkout (`src/app/(main)/checkout/page.tsx`):** Resumen final de costos (Productos + Envío de la tienda + Servicio transparente = Total a pagar).
- **[HECHO] Formulario de Entrega Inteligente (`DeliveryAddressCard.tsx`):** Sugerencia de dirección por GPS desde `locationStore`, edición libre y notas para el domiciliario (apto, taller, referencias).
- **[HECHO] Métodos de Pago Colombianos (`PaymentMethodSelector.tsx`):** Efectivo al recibir, Datáfono contra entrega, Transferencia QR Nequi/Bancolombia y Wompi en línea.
- **[HECHO] Store de Pedidos Persistente (`orderStore.ts`):** Creación de pedido con ID único (`REP-2026-XXXX`), vaciado del carrito (`clearCart`), feedback visual y pantalla de confirmación exitosa.
- **[HECHO] Acceso Global al Carrito desde el Header (`AppHeader.tsx`):**
  - Botón de carrito con badge reactivo (`itemCount`) en la barra de navegación superior.
  - Integración del `CartDrawer` global para consulta, edición rápida de cantidades y acceso directo a `/checkout` desde la página principal del mapa (`/`).
  - Animación cyberpunk con indicador de estado vacío vs. con productos agregados.
- **Tests Fase 8:** ver `docs/TESTING.md §3.4` (createOrder, cap 20, cancel/rate, `REP-XXXX`) y `§4` (checkout vacío redirige, confirmar vacía carrito y enlaza `/order/[id]`).

---

## Fase 9: Tracking en Tiempo Real y Post-Venta [HECHO]

La experiencia "Uber / Rappi" especializada en logística de autopartes y repuestos automotrices (baterías, llantas, lubricantes, componentes mecánicos y eléctricos).

### 9.1 Routing y Página de Tracking (`src/app/(main)/order/[id]/page.tsx`)
- Captura del identificador dinámico de pedido (`REP-2026-XXXX`) y sincronización con `orderStore.ts`.
- Conexión fluida desde la pantalla de confirmación de `/checkout` (navegación directa al pulsar *"Seguir Pedido"*).
- Manejo defensivo de estados de carga, pedido no encontrado y recarga de página conservando estado en `localStorage`.

### 9.2 Línea de Tiempo Reactiva de Estados de Entrega
Visualizador de progreso interactivo y animado adaptado a la cadena de suministro de autopartes:
- **`CREADO / PAGADO`:** Orden registrada en plataforma y pago confirmado vía Wompi.
- **`ACEPTADO`:** La tienda de autopartes confirma stock y disponibilidad del pedido.
- **`PREPARANDO`:** La tienda de autopartes alista los repuestos/baterías en almacén.
- **`LISTO / RECOGIDO`:** El repartidor asignado llega a la tienda y carga las piezas en su vehículo.
- **`EN_CAMINO`:** Domiciliario en ruta hacia la dirección del cliente (taller, domicilio o asistencia vial).
- **`ENTREGADO`:** Repuestos recibidos y verificados con éxito por el comprador.
- **`CANCELADO`:** Gestión de pedidos anulados o con novedad logística.
- Barra de progreso con micro-animaciones (Framer Motion), tiempos estimados dinámicos y notas de estado.

### 9.3 Mapa de Seguimiento en Vivo (`src/components/tracking/OrderTrackingMap.tsx`)
- Instancia dedicada de Mapbox GL JS enfocada en el trayecto del pedido:
  - **Pin de Origen:** Tienda de autopartes (`storeLocation`).
  - **Pin de Destino:** Coordenadas de entrega del cliente (`deliveryAddress.coordinates`).
  - **Ruta Neón:** Trazado de ruta entre tienda, repartidor y cliente con estilo cyberpunk cian/azul.
  - **Pin del Repartidor en Tiempo Real:** Marcador interactivo de motocicleta/vehículo con pulso de energía, interpolación de movimiento y actualización de coordenadas.
  - Modo solo lectura con controles de zoom y recentrado sobre el repartidor.

### 9.4 Tarjeta de Conductor, Desglose y Contacto Rápido
- **Perfil del Domiciliario:** Nombre, avatar, modelo y placa del vehículo (ej. *Motocicleta Yamaha FZ 2.0 / REP-45F*), calificación acumulada.
- **Canales de Contacto:** Botones de acción directa para llamada telefónica y chat/asistencia rápida.
- **Resumen Colapsable del Pedido:** Acceso rápido a la lista de repuestos comprados, cantidades, tienda de origen y total pagado.

### 9.5 Sistema de Calificación Post-Venta (`src/components/tracking/OrderRatingModal.tsx`)
- Detección automática del estado `ENTREGADO` para desplegar el modal de feedback.
- Calificación por estrellas (1 a 5) independiente para:
  - **Calidad de los repuestos y atención de la tienda.**
  - **Puntualidad y servicio del repartidor.**
- Comentarios opcionales de experiencia y retorno automatizado a la página principal (`/`) tanto al enviar la reseña como al omitir.
- **Tests Fase 9:** ver `docs/TESTING.md §3.4` (timeline, `useActiveOrders*`, rating) y `§4` (tracking por URL, `ENTREGADO` abre rating).

---

## Fase 9.6: Blindaje de Ciclo de Vida, Resiliencia GPS y Optimización de Stores [HECHO]

- **Resiliencia de Geolocalización y Control de Batería (`src/store/locationStore.ts`):**
  - Manejo diferencial de errores de señal vs. permisos: apagado forzoso de hardware (`clearWatch`) y liberación de identificadores ante `PERMISSION_DENIED` para evitar drenado de batería.
  - Modo pasivo con reconexión automática instantánea al salir de sótanos o zonas sin cobertura (`POSITION_UNAVAILABLE` / `TIMEOUT`).
  - Guarda anti re-renders periódicos para no saturar Zustand cada 10s ante pérdidas de señal prolongadas.
  - Desbloqueo de reintento manual mediante el botón *"Mi Ubicación"*.
- **Higiene de Stores y Capacidad Visual (`src/store/orderStore.ts` y `src/store/toastStore.ts`):**
  - Límite de retención en memoria a 20 órdenes recientes en modo mock para mantener liviano el almacenamiento.
  - Cota máxima de 4 notificaciones simultáneas en pantalla con auto-evicción para evitar saturación de la UI.
- **Transiciones Limpias en Framer Motion:**
  - Corrección de ciclo de vida en `StoreConflictDialog.tsx`, `ProductModal.tsx` y `OrderRatingModal.tsx` eliminando fragmentos y wrappers rígidos para garantizar desvanecimientos fluidos al cerrar.
- **Limpieza de Recursos en Controles de Mapa (`src/components/map/controls/ZoomControl.tsx`):**
  - Limpieza de listeners globales de arrastre en `window` y temporizadores de hover en el ciclo de desmontaje.
- **Gestión Multi-Pedido Concurrente y Panel Lateral (`ActiveOrdersDrawer.tsx`):**
  - Refactorización de `orderStore.ts` con el Enfoque B puro: eliminación de `activeOrderId` como singleton, derivando los pedidos activos del array de sesión `orders`.
  - Creación de `ActiveOrdersDrawer.tsx` con pestañas *En Curso* e *Historial*, tarjetas de estado con radar neón, ETA, resumen de autopartes y navegación rápida.
  - Integración en `AppHeader.tsx` mediante `useActiveOrdersCount()` para suscripción atómica al contador y apertura del drawer sin recargar la página.
- **Tests Fase 9.6:** ver `docs/TESTING.md §3.5-§3.6` (GPS diferencial, anti re-renders, cap 20/4 toasts) y `§5` (QA Safari iOS, multi-tab).

---

## Estrategia de Integración Backend: Supabase (PostgreSQL + PostGIS) ➔ Spring Boot (AWS Docker)

Esta estrategia permite validar de forma inmediata y a bajo costo el producto con **datos reales de repuestos (Excel)**, consultas espaciales reales por proximidad (PostGIS) y WebSockets para tracking en vivo, entregando un paquete listo y probado para el posterior desarrollo en Spring Boot / AWS.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           FRONTEND (Next.js 16.3.1-canary.20 App Router)                 │
│                                                                             │
│   [ UI Components ] ──▶ [ Zustand Stores ] ──▶ [ src/services/ (ABSTRACCIÓN) ]
└───────────────────────────────────────────────────────────────┬─────────────┘
                                                                │
                    ┌───────────────────────────────────────────┴───────────────────────────────────────────┐
                    ▼                                                                                       ▼
         [ ETAPA 1: VALIDACIÓN RÁPIDA ]                                                          [ ETAPA 2: PRODUCCIÓN FINAL ]
               Supabase BaaS                                                                           Spring Boot REST API
         - PostgreSQL Relacional Estándar                                                        - Microservicio Java / Spring Boot
         - PostGIS Nativo (ST_DWithin, ST_Distance)                                              - Amazon RDS / Aurora PostgreSQL
         - Importación masiva de Excel/CSV                                                       - Docker containerizado en AWS ECS/EKS
         - Supabase Realtime (Tracking F9)                                                       - Hibernate Spatial (mismo PostGIS)
```

---

### 🌟 REGLA DE ORO DE ABSTRACCIÓN EN EL FRONTEND (Zero-Coupling Contract)

Para garantizar que la migración futura a Spring Boot requiera **cero modificaciones en los componentes de interfaz de usuario y stores de Zustand**, se establece como norma arquitectónica estricta:

1. **Aislamiento Total de la UI:**
   - Ningún componente React (`src/components/...`) ni página (`src/app/...`) puede importar o interactuar directamente con SDKs de backend (como `@supabase/supabase-js`, Firebase, Axios directos o llamadas no tipadas).
2. **Capa Centralizada de Servicios (`src/services/`):**
   - Todas las llamadas de red se gestionan única y exclusivamente a través de funciones exportadas en `src/services/` (ej. `api.ts`, `storeService.ts`, `orderService.ts`).
3. **Contratos Tipados de Dominio (`src/types/`):**
   - Las funciones de servicio siempre reciben y devuelven tipos de dominio estricto definidos en `src/types/` (`Store`, `Product`, `Order`, `DeliveryAddress`, etc.).
4. **Intercambio Transparente (Plug & Play):**
   - Al pasar de Supabase a Spring Boot, el cambio se limita a modificar la implementación interna de los adaptadores en `src/services/` y las variables de entorno (`.env.local`). La UI y Zustand permanecen 100% intactos.

---

### Fases del Plan de Integración con Supabase

#### 1. Modelado Relacional y PostGIS en PostgreSQL
> Contrato vigente: `docs/DATA_MODEL.md` (supersede al legado `arquitectura/` y a los
> nombres en español de abajo). Convenciones: EN snake_case, UUID, BIGINT COP,
> `geography(Point,4326)`, ENUM único de estados, RLS.
- Creación de tablas vía migraciones `supabase/migrations/0001→0009` generadas desde el contrato:
  - `stores` (+ `location`, `schedule` JSONB, `delivery_fee`, `slug` único, RPC `get_nearby_stores`).
  - `products` (+ `specs` JSONB, `compatible_vehicles text[]`, búsqueda pg_trgm).
  - `profiles` (Supabase Auth), `addresses`, `orders` (+ `order_number REP-…`, historial, `driver_positions` latest-upsert).
- Función RPC para búsqueda espacial de tiendas cercanas por radio:
  ```sql
  CREATE OR REPLACE FUNCTION get_nearby_stores(user_lat float, user_lng float, radius_m float DEFAULT 10000)
  RETURNS SETOF stores AS $$
    SELECT * FROM stores
    WHERE ST_DWithin(location, ST_SetSRID(ST_MakePoint(user_lng, user_lat), 4326)::geography, radius_m)
      AND is_active
    ORDER BY ST_Distance(location, ST_SetSRID(ST_MakePoint(user_lng, user_lat), 4326)::geography) ASC;
  $$ LANGUAGE sql STABLE;
  ```

#### 2. Seed de Desarrollo (sin Excel: DB desde cero)
- Seed mínimo en migración `0009_seed_dev`: 3–5 tiendas (Medellín) + productos por tienda con `specs`/compatibilidad.
- Carga masiva real queda para cuando exista catálogo (CSV Import o script), contra este mismo esquema.
- Validación de consultas de búsqueda por nombre, referencia, marca y compatibilidad de modelo.

#### 3. Conexión con la Capa de Servicios del Frontend
- Implementación del cliente en `src/services/supabaseClient.ts`.
- Adaptadores en `src/services/api.ts` para resolver:
  - `fetchStores({ location, filters })` $\rightarrow$ consulta PostGIS en Supabase.
  - `fetchProductsByStore(storeId)` $\rightarrow$ consulta relacional indexada.
  - `createOrder(orderData)` $\rightarrow$ inserción transaccional de pedido.
  - `subscribeToOrderTracking(orderId)` $\rightarrow$ canal WebSocket con Supabase Realtime para la Fase 9.

#### 4. Paquete de Traspaso para el Desarrollador Backend (Spring Boot)
Al contratar al desarrollador backend, se le entrega un paquete completo que reduce el tiempo de desarrollo en más de un 60%:
- **DDL SQL Export:** Esquema completo de tablas, índices y funciones PostGIS extraído de PostgreSQL.
- **Datos de prueba reales:** Seed SQL con el catálogo de tiendas y repuestos.
- **Contratos OpenAPI actualizados:** Especificación Swagger/OpenAPI 3.0 basada exactamente en los tipos probados en `src/types/`.
- **Colección Postman / Insomnia:** Endpoints y casos de prueba ya validados contra el frontend.


