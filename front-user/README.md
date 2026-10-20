# Repu — front-user

Frontend cliente de **Repu**, una app de delivery de repuestos automotrices construida con **Next.js App Router**, **React**, **TypeScript**, **Zustand**, **Tailwind CSS** y **Mapbox GL JS**.

Este README es el **punto de encuentro principal** de la documentación del proyecto: sirve para ubicar rápidamente cualquier tema y saber en qué archivo profundizar después.

---

## 1. Qué es este proyecto

`front-user` es la aplicación del cliente final.

Permite actualmente:

- autenticación real contra Supabase (puente congelado) con sesión persistida
- exploración de tiendas en mapa
- filtrado de tiendas por categoría
- navegación hacia la página de una tienda
- visualización de catálogo de productos
- carrito global persistente integrado al catálogo con Zustand
- checkout mock con pago Wompi simulado
- seguimiento de pedido con timeline y mapa (simulación local)
- multi-pedido concurrente y panel de pedidos activos

Estado actual del producto:

- **Mapa y descubrimiento:** funcional
- **Catálogo de tienda:** funcional contra Supabase (puente congelado)
- **Carrito global:** persistente e integrado en la UI del catálogo
- **Checkout:** funcional en modo mock (pago Wompi simulado)
- **Tracking:** funcional en modo mock (simulación local, sin realtime)
- **Backend final:** Spring Boot en Docker ([ADR-001](docs/ADR-001-BACKEND-SPRING.md)); Supabase se congela como puente

Para la visión funcional completa revisa [docs/APP_FLOW.md](docs/APP_FLOW.md).

---

## 2. Inicio rápido

### Requisitos

- Node.js 20.9+
- pnpm (la versión exacta está fijada en `packageManager` dentro de `package.json`; pnpm la usa automáticamente)

### Variables de entorno

```bash
cp .env.example .env.local
# PowerShell: Copy-Item .env.example .env.local
```

Completar en `.env.local`:

```env
NEXT_PUBLIC_MAPBOX_TOKEN=
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
```

> Las variables `NEXT_PUBLIC_SUPABASE_*` son transitorias: el backend final Spring Boot usará su propia URL de API. Nunca commitear `.env.local` ni valores reales.

### Desarrollo

```bash
pnpm install
pnpm dev
```

Abrir en navegador:

- http://localhost:3000

> Nota: pnpm solo ejecuta scripts de instalación de dependencias explícitamente
> aprobadas en `pnpm-workspace.yaml` (`allowBuilds`) como defensa de supply chain.

---

## 3. Stack principal

- **Framework:** Next.js
- **Gestor de paquetes:** pnpm
- **UI:** React
- **Estado global:** Zustand
- **Persistencia local:** `localStorage` vía middleware `persist`
- **Mutaciones seguras:** `immer`
- **Mapas:** Mapbox GL JS
- **Estilos:** Tailwind CSS
- **Animaciones:** Framer Motion
- **Backend actual (puente congelado):** Supabase (PostgreSQL/PostGIS + Auth)
- **Backend final:** Spring Boot en Docker ([ADR-001](docs/ADR-001-BACKEND-SPRING.md))

Para decisiones técnicas y organización general revisa [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

---

## 4. Estado actual de las áreas clave

### Autenticación

- login real contra Supabase Auth (puente congelado; destino Spring Security)
- protección de rutas con guard client-side en `MainLayoutShell` y gate de rehidratación
- usuarios seed de desarrollo (ver §7)

Ver:

- [docs/AUTHENTICATION.md](docs/AUTHENTICATION.md)
- [docs/TESTING.md](docs/TESTING.md)

### Mapa y descubrimiento

- geolocalización de usuario
- mapa interactivo con tiendas cercanas
- filtros por categoría
- arquitectura híbrida de datos para tiendas

Ver:

- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
- [docs/DATAFLOW.md](docs/DATAFLOW.md)
- [docs/PROJECT_GUIDE.md](docs/PROJECT_GUIDE.md)

### Catálogo y carrito

- página de tienda disponible por `slug`
- catálogo con `ProductGrid`, `ProductCard` y `ProductModal`
- `cartStore` global ya conectado como fuente única de verdad
- persistencia de carrito ya implementada
- TTL de 24 horas para evitar carritos “zombie”
- por ahora el catálogo usa iconografía SVG reutilizable para representar productos
- las fotos reales de producto quedan para una fase posterior
- `ProductModal` y el agregado rápido ya actualizan el carrito global
- `CartButton` ya consume `itemCount` y `subtotal` desde el store reactivo
- toasts para eventos del carrito y confirmación explícita al cambiar de tienda
- drawer pre-checkout ya implementado con controles `+/-`, eliminar y subtotal reactivo
- checkout mock implementado; pedidos y tracking persisten en Zustand
- sincronización multi-tab implementada (`lib/storageSync.ts`)
- pendiente el backend real (Spring Boot) y el tracking en vivo

Ver:

- [docs/ROADMAP.md](docs/ROADMAP.md)
- [docs/PROJECT_GUIDE.md](docs/PROJECT_GUIDE.md)
- [docs/APP_FLOW.md](docs/APP_FLOW.md)

### Safari iOS / CTA del carrito

- ya existe fix estable para el CTA flotante inferior en Safari iOS
- debe mantenerse el patrón de wrapper externo `fixed` + capa interna animada

Ver:

- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
- [docs/ROADMAP.md](docs/ROADMAP.md)
- [docs/CHANGELOG.md](docs/CHANGELOG.md)

---

## 5. Dónde leer según el tema

| Si quieres ver... | Revisa primero |
|---|---|
| Visión general del producto y flujo del usuario | [docs/APP_FLOW.md](docs/APP_FLOW.md) |
| Guía completa, arquitectura explicada y estado del proyecto | [docs/PROJECT_GUIDE.md](docs/PROJECT_GUIDE.md) |
| Arquitectura frontend y responsabilidades | [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) |
| Flujo de datos entre stores, UI y servicios | [docs/DATAFLOW.md](docs/DATAFLOW.md) |
| Estructura de carpetas y ubicación de archivos | [docs/FOLDER_STRUCTURE.md](docs/FOLDER_STRUCTURE.md) |
| Roadmap por fases y estado de implementación | [docs/ROADMAP.md](docs/ROADMAP.md) |
| Sistema de autenticación | [docs/AUTHENTICATION.md](docs/AUTHENTICATION.md) |
| Pruebas (matriz unitaria, integración y QA) | [docs/TESTING.md](docs/TESTING.md) |
| Modelo de datos (contrato PostgreSQL/PostGIS; Supabase como puente) | [docs/DATA_MODEL.md](docs/DATA_MODEL.md) |
| Decisión de backend (Supabase congelado → Spring Boot) | [docs/ADR-001-BACKEND-SPRING.md](docs/ADR-001-BACKEND-SPRING.md) |
| Historial reciente de cambios | [docs/CHANGELOG.md](docs/CHANGELOG.md) |
| Reglas para asistentes IA y contribuidores | [docs/AI_GUIDELINES.md](docs/AI_GUIDELINES.md) |

---

## 6. Mapa rápido del código

### Rutas principales

- `src/app/(auth)/login/page.tsx`
- `src/app/(main)/page.tsx`
- `src/app/(main)/store/[slug]/page.tsx`
- `src/app/(main)/checkout/page.tsx`
- `src/app/(main)/order/[id]/page.tsx`

### Stores principales

- `src/store/authStore.ts`
- `src/store/locationStore.ts`
- `src/store/filterStore.ts`
- `src/store/storesStore.ts`
- `src/store/cartStore.ts`
- `src/store/orderStore.ts`
- `src/store/toastStore.ts`

### Componentes clave

- auth: `src/components/auth/*`
- mapa: `src/components/map/*`
- layout: `src/components/layout/*`
- tienda/catálogo: `src/components/stores/*`
- checkout: `src/components/checkout/*`
- tracking: `src/components/tracking/*`
- UI genérica: `src/components/ui/*`
- servicios/adaptadores: `src/services/*` (único punto de intercambio Supabase → Spring)

Para el detalle completo revisa [docs/FOLDER_STRUCTURE.md](docs/FOLDER_STRUCTURE.md).

---

## 7. Credenciales de prueba (seed Supabase)

- `admin@mallvirtual.com` / `admin123` (rol `admin`)
- `usuario@demo.com` / `user123` (rol `comprador`)
- `demo@demo.com` / `demo123` (rol `comprador`)

> Seeds del puente Supabase; al cortar a Spring se reemplazan por usuarios del backend. Detalle en [docs/TESTING.md](docs/TESTING.md).

---

## 8. Convenciones importantes

- Antes de cambiar código, revisar la documentación de `docs/`
- Usar **solo `pnpm`** (nunca `npm` ni `yarn`)
- Respetar **Zero-Coupling**: UI y stores no importan SDKs; todo acceso pasa por `src/services/`
- No introducir una segunda fuente de verdad para carrito, auth, tiendas o pedidos
- No añadir features nuevas sobre Supabase (puente congelado; ver ADR-001)
- No modificar diseño sin aprobación explícita
- Documentar cambios relevantes cuando afecten arquitectura o flujos

Ver reglas completas en [docs/AI_GUIDELINES.md](docs/AI_GUIDELINES.md).

---

## 9. Lectura sugerida para ponerse al día rápido

Orden recomendado para entender el proyecto:

1. [docs/PROJECT_GUIDE.md](docs/PROJECT_GUIDE.md) — visión general, arquitectura y rumbo
2. [docs/APP_FLOW.md](docs/APP_FLOW.md)
3. [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
4. [docs/FOLDER_STRUCTURE.md](docs/FOLDER_STRUCTURE.md)
5. [docs/DATAFLOW.md](docs/DATAFLOW.md)
6. [docs/DATA_MODEL.md](docs/DATA_MODEL.md)
7. [docs/AUTHENTICATION.md](docs/AUTHENTICATION.md)
8. [docs/ROADMAP.md](docs/ROADMAP.md)
9. [docs/ADR-001-BACKEND-SPRING.md](docs/ADR-001-BACKEND-SPRING.md) — decisión Supabase congelado → Spring Boot
10. [docs/TESTING.md](docs/TESTING.md)

---

## 10. Estado documental

Este README resume el proyecto y centraliza accesos.

- **Última actualización:** 2026-10-19 (decisión de backend [ADR-001](docs/ADR-001-BACKEND-SPRING.md)).
- Cuando se necesite detalle, la fuente de verdad debe estar en los documentos específicos dentro de [docs](docs).
