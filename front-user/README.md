# Repu — front-user

Frontend cliente de **Repu**, una app de delivery de repuestos automotrices construida con **Next.js App Router**, **React**, **Zustand**, **Tailwind CSS** y **Mapbox GL JS**.

Este README es el **punto de encuentro principal** de la documentación del proyecto: sirve para ubicar rápidamente cualquier tema y saber en qué archivo profundizar después.

---

## 1. Qué es este proyecto

`front-user` es la aplicación del cliente final.

Permite actualmente:

- autenticación con persistencia de sesión
- exploración de tiendas en mapa
- filtrado de tiendas por categoría
- navegación hacia la página de una tienda
- visualización de catálogo de productos
- carrito global persistente integrado al catálogo con Zustand

Estado actual del producto:

- **Mapa y descubrimiento:** funcional
- **Catálogo de tienda:** funcional a nivel base
- **Carrito global:** integrado en la UI del catálogo
- **Checkout:** pendiente
- **Tracking en tiempo real:** pendiente

Para la visión funcional completa revisa [docs/APP_FLOW.md](docs/APP_FLOW.md).

---

## 2. Inicio rápido

### Requisitos

- Node.js 20+
- pnpm (la versión exacta está fijada en `packageManager` dentro de `package.json`; pnpm la usa automáticamente)

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

Para decisiones técnicas y organización general revisa [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

---

## 4. Estado actual de las áreas clave

### Autenticación

- login persistente con Zustand
- protección de rutas mediante route groups
- usuarios mock para desarrollo

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
- pendiente el checkout real y la sincronización multi-tab

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
| Modelo de datos (contrato Supabase/PostGIS) | [docs/DATA_MODEL.md](docs/DATA_MODEL.md) |
| Historial reciente de cambios | [docs/CHANGELOG.md](docs/CHANGELOG.md) |
| Reglas para asistentes IA y contribuidores | [docs/AI_GUIDELINES.md](docs/AI_GUIDELINES.md) |
| Guía humana del proyecto (arquitectura, componentes, fases y opinión) | [docs/PROJECT_GUIDE.md](docs/PROJECT_GUIDE.md) |

---

## 6. Mapa rápido del código

### Rutas principales

- `src/app/(auth)/login/page.js`
- `src/app/(main)/page.js`
- `src/app/(main)/store/[slug]/page.js`

### Stores principales

- `src/store/authStore.js`
- `src/store/locationStore.js`
- `src/store/filterStore.js`
- `src/store/storesStore.js`
- `src/store/cartStore.js`
- `src/store/toastStore.js`

### Componentes clave

- mapa: `src/components/map/*`
- layout: `src/components/layout/*`
- tienda/catálogo: `src/components/stores/*`

Para el detalle completo revisa [docs/FOLDER_STRUCTURE.md](docs/FOLDER_STRUCTURE.md).

---

## 7. Credenciales de prueba

- `admin@mallvirtual.com` / `admin123`
- `usuario@test.com` / `user123`
- `demo@demo.com` / `demo`

Detalle de pruebas en [docs/TESTING.md](docs/TESTING.md).

---

## 8. Convenciones importantes

- Antes de cambiar código, revisar la documentación de `docs/`
- Reutilizar stores, servicios y utilidades existentes
- No introducir una segunda fuente de verdad para carrito, auth o tiendas
- No modificar diseño sin aprobación explícita
- Documentar cambios relevantes cuando afecten arquitectura o flujos

Ver reglas completas en [docs/AI_GUIDELINES.md](docs/AI_GUIDELINES.md).

---

## 9. Lectura sugerida para ponerse al día rápido

Orden recomendado para entender el proyecto:

1. [docs/PROJECT_GUIDE.md](docs/PROJECT_GUIDE.md) — visión general, arquitectura y rumbo
2. [docs/APP_FLOW.md](docs/APP_FLOW.md)
3. [docs/FOLDER_STRUCTURE.md](docs/FOLDER_STRUCTURE.md)
4. [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
5. [docs/DATAFLOW.md](docs/DATAFLOW.md)
6. [docs/ROADMAP.md](docs/ROADMAP.md)

---

## 10. Estado documental

Este README resume el proyecto y centraliza accesos.

Cuando se necesite detalle, la fuente de verdad debe estar en los documentos específicos dentro de [docs](docs).
