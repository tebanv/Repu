# AI & Contributor Guidelines — Marco Mental, Reglas y Estándares

Estas instrucciones deben ser leídas y aplicadas rigurosamente por cualquier asistente de código (IA) o desarrollador humano antes de sugerir, diseñar, implementar o aprobar cambios en este repositorio.

---

## 0. Meta-Reglas para Actualizar Este Documento (Instrucciones para la IA/Agente)

Cuando un agente de IA o desarrollador sea instruido para actualizar, complementar o refinar este archivo (`AI_GUIDELINES.md`), debe acatar obligatoriamente las siguientes **tres meta-reglas**:

1. **Principio de Aditividad y No Regresión (NUNCA borrar directrices existentes):**
   - Al incorporar nuevas instrucciones o conceptos solicitados por el usuario, **está estrictamente prohibido eliminar, compactar destructivamente o sobrescribir reglas existentes** (como la revisión de archivos `.md`, el respeto a diseños aprobados, la regla de abstracción, el gestor `pnpm`, o la capacidad de challenge técnico).
   - Cualquier modificación debe ser **aditiva, enriquecedora y preservativa**.
2. **Propósito Cognitivo vs Documentación Técnica:**
   - Este documento define **cómo pensar, cómo evaluar compensaciones de ingeniería (trade-offs) y qué estándares aplicar**.
   - **No debe saturarse con especificaciones de bajo nivel** (como fragmentos de código específicos de una sola vista o configuraciones puntuales), las cuales pertenecen a [`ARCHITECTURE.md`](./ARCHITECTURE.md) o [`DATAFLOW.md`](./DATAFLOW.md).
3. **Consistencia de Alto Nivel:**
   - Toda nueva directriz debe alinearse con la visión de producción masiva en PostgreSQL/PostGIS, la protección de hardware/batería móvil y el rigor técnico.

---

## 1. Reglas Generales de Desarrollo y Buenas Prácticas

1. **Revisar Siempre los Archivos de Contexto `.md`:**
   - Antes de responder, sugerir código o implementar cambios, consulta obligatoriamente los archivos de documentación clave: `PROJECT_GUIDE.md`, `FOLDER_STRUCTURE.md`, `ARCHITECTURE.md`, `DATAFLOW.md`, `ROADMAP.md`, `APP_FLOW.md`, `BACKEND.md`, `ADR-002-BACKEND-MICROSERVICES.md`, `AUTHENTICATION.md`, etc.
   - Sigue la estructura de carpetas, convenciones de nomenclatura y decisiones arquitectónicas ya documentadas.
   - Si tienes dudas sobre un requerimiento o flujo, consulta primero los archivos de documentación antes de asumir o preguntar al usuario.

2. **No Duplicar Lógica ni Ignorar Servicios Existentes:**
   - Si una función, servicio, helper o store ya existe, **reutilízalo en vez de crear uno nuevo**.
   - Centraliza la lógica de negocio y el acceso a APIs en los servicios correspondientes (`src/services/`, ej. `api.ts`, `authService.ts`, `geolocationService.ts`).
   - Usa las constantes y utilidades definidas en `src/lib/` y módulos comunes.

3. **No Modificar el Diseño Visual sin Autorización Explícita:**
   - Al corregir bugs, refactorizar o ajustar funcionalidades, **no alteres los estilos, clases CSS, colores ni el diseño visual de los componentes existentes**.
   - Si identificas una oportunidad de mejora visual o estética, **debes proponer el cambio y obtener la aprobación explícita del usuario antes de implementarlo**.

4. **Hacer Challenge Técnico y No Dar la Razón a Ciegas:**
   - La IA **no debe ser complaciente ni dar la razón por defecto**.
   - Si una propuesta del usuario o una implementación previa contiene puntos ciegos (fugas de memoria, re-renders innecesarios, drenado de batería, violaciones de la Única Fuente de Verdad o sobrecostos de APIs externas), la IA **tiene la obligación de desafiar la idea con argumentos técnicos sólidos y proponer la alternativa correcta**.

5. **Documentar y Comentar el Código de Forma Relevante:**
   - **Siempre agrega comentarios útiles y descriptivos en el código que generes o modifiques**, explicando la intención de cada bloque, función o sección relevante.
   - Explica las decisiones no triviales tanto en los comentarios de código como en la documentación.

6. **Mantenimiento Obligatorio de la Documentación:**
   - **Si creas nuevos componentes, servicios o stores, documenta su propósito y ubicación en los archivos `.md` correspondientes.**
   - Mantén actualizados los archivos de documentación y enlaza los cambios relevantes en el `README.md`.
   - Cada cambio relevante debe registrarse en `docs/CHANGELOG.md` y actualizar el estado de las fases en `docs/ROADMAP.md`. Si se altera la arquitectura, el backend o el flujo de datos, sincronizar `docs/ARCHITECTURE.md`, `docs/BACKEND.md`, `docs/AUTHENTICATION.md` y `docs/DATAFLOW.md`.

7. **Seguridad y Secretos:**
   - Nunca subas tokens, contraseñas, claves privadas ni datos sensibles. Utiliza variables de entorno (`.env.local`) y mantén al día `.env.example` (primera entrada `NEXT_PUBLIC_MAPBOX_TOKEN=`; `AUTH_API_ORIGIN` y `USERS_API_ORIGIN` son variables de servidor, no `NEXT_PUBLIC`).

8. **Facilitar el Testing y la Extensibilidad:**
   - Prefiere servicios y hooks reutilizables para lógica compleja. Escribe código modular, fácil de testear y con bajo acoplamiento.

9. **Gestor de Paquetes Exclusivo: `pnpm`:**
   - Este proyecto utiliza **exclusivamente `pnpm`** (`pnpm dev`, `pnpm build`, `pnpm type-check`, `pnpm lint`, `pnpm add`, `pnpm install`).
   - **Nunca utilices `npm` ni `yarn`.**

---

## 2. Regla de Oro de Abstracción en Frontend (Zero-Coupling Contract)

1. **Aislamiento Total de la UI:**
   - Los componentes visuales de React (`src/components/`) y páginas (`src/app/`) **NUNCA** deben importar clientes o SDKs de base de datos directamente (como `@supabase/supabase-js`, Firebase, Prisma o clientes Axios directos).
2. **Acceso Único por Servicios (`src/services/`):**
   - Todo acceso a datos, llamadas HTTP y conexiones WebSockets debe encapsularse exclusivamente en módulos dentro de `src/services/` (ej. `api.ts`, `authService.ts`, `geolocationService.ts`).
3. **Retorno Tipado Estricto:**
   - Toda función en `src/services/` debe recibir y retornar tipos e interfaces de dominio estrictamente definidos en `src/types/` (`Store`, `Product`, `Order`, etc.).
4. **Independencia del Proveedor:**
   - El frontend debe poder cambiar entre mocks locales en memoria, Supabase legado o los microservicios Spring reales modificando únicamente la capa `src/services/` y variables de entorno, sin alterar componentes de UI ni stores de Zustand. (Estado actual: auth ya usa `ms-auth`/`ms-users`; catálogo todavía en Supabase; pedidos/carrito locales. El corte es obligatorio, no opcional.)
5. **Backend real de microservicios (ADR-002, 2026-10-27):**
   - El backend real son siete microservicios Spring Boot en Docker (`ms-auth`, `ms-users`, `ms-companies`, `ms-products`, `ms-categories`, `ms-orders`, `ms-manage-payment`) detrás de Traefik. Supabase queda **fuera del camino crítico**: no añadir features nuevas sobre Supabase Auth, Realtime, Edge Functions, Storage ni cambios de esquema. Auth ya está migrado a `ms-auth`; el catálogo sigue en Supabase como legado transitorio hasta su corte.
   - Todo acceso a datos pasa por `src/services/`; el contrato se deriva del código de `Backend/` + `Arq-Infra/Repo-DB-2.sql` + `Arq-Infra/Repu.postman_collection.json`, no del legacy `arquitectura/`.
   - El corte es por dominio, **auth → catálogo → pedidos → tracking**, sin escrituras duales. Ver `docs/ADR-002-BACKEND-MICROSERVICES.md` y `docs/BACKEND.md`.
6. **Sesión y contrato de auth (verificado):**
   - `ms-auth` es la única autoridad de sesión. El web usa la cookie `HttpOnly` `__Host-repu_session`; **nunca** lee, persiste ni registra el `accessToken` del body.
   - El perfil se obtiene de `GET /ms-users/api/users/profile`; `/ms-auth/api/auth/session` es introspección servicio-a-servicio y exige `X-Auth-Service-Token`.
   - El esquema `repu` está en español y usa `NUMERIC(15,2)`; los adaptadores de `src/services/` traducen a `Store`/`Product`/`Order` y al dinero entero COP del front. No mover esa traducción a UI/stores.
   - Los estados de orden del backend están dimensionados (`estado_orden`, `estado_pago`, `estado_comercio`, `estado_envio`) y no coinciden aún con `OrderStatus`; el mapeo se cierra antes del corte de pedidos.

---

## 3. Flujo de Permisos y Resiliencia de Geolocalización

1. **Desacoplamiento de la UI:**
   - La lógica de permisos de ubicación reside en `locationStore.ts` y `geolocationService.ts`, no en los componentes visuales.
2. **Modal Minimizable y No Bloqueante:**
   - `LocationPermissionModal` permite al usuario explorar el mapa en la ubicación por defecto (`DEFAULT_LOCATION`).
   - Si el modal se minimiza o el permiso no ha sido otorgado, debe permanecer visible la cápsula flotante `[ 📍 Permitir ubicación ]` sobre el mapa para reactivar la solicitud con 1 solo toque.
3. **Navegación sin Bloqueos:**
   - La exploración en el mapa y la carga dinámica de tiendas (`StoresLayer.tsx`) nunca deben bloquearse si el usuario deniega o pospone el permiso.

---

## 4. Marco Mental de Ingeniería para Producción a Gran Escala

Todo desarrollo debe evaluarse bajo cuatro heurísticas fundamentales de arquitectura:

---

### Heurística A: Protección de CPU, Batería y Hardware Móvil
> **Pregunta clave:** *¿Esta operación consume ciclos de CPU o hardware que impacten la fluidez (60 FPS) o la batería del usuario?*

* **Streams Continuos de Alta Frecuencia vs Estado de Negocio:**
   - Si un dato cambia continuamente (ej. telemetría GPS a 1Hz de repartidores, animaciones, gestos de arrastre), debe tratarse como un **stream de renderizado visual** (manejado en capas WebGL/Canvas de Mapbox con `requestAnimationFrame` / `easeTo` o referencias directas).
   - **Nunca mutar el store de estado global (Zustand) ni enviar escrituras a la base de datos a alta frecuencia** (ej. 60 mutaciones por minuto) por datos que solo necesita la animación de la pantalla actual. El store de negocio y PostgreSQL solo registran hitos discretos de estado y snapshots periódicos (cada 15-30s).
   - (Las cifras anteriores — 1Hz, 60 mutaciones/min, 15-30s — son criterios orientativos de diseño, no comportamiento implementado: el front aún no consume el tracking de `ms-orders`; el backend ya expone SSE y `posiciones_actuales_envio`.)
* **Ciclo de Vida y Liberación de Sensores de Hardware:**
  - Ante denegación de permisos (`PERMISSION_DENIED`), invocar inmediatamente `navigator.geolocation.clearWatch()` para apagar la antena GPS.
  - En zonas de sombra (sótanos/túneles), preservar las últimas coordenadas conocidas y pasar a escucha pasiva con guardas anti-re-renders para no saturar el CPU con ráfagas de errores repetitivos.

---

### Heurística B: Eficiencia de Red y Control de Costes de Infraestructura
> **Pregunta clave:** *¿Esta consulta a la base de datos o API de mapas es estrictamente necesaria en este instante, o genera sobrecostos y tráfico redundante?*

* **Prevención de Tráfico y Consultas Masivas:**
   - Prohibido el *polling* descontrolado por HTTP; preferir eventos reactivos bajo demanda. El backend ya expone SSE en `ms-orders` (tracking); el front aún no lo consume. Mientras no exista integración, no introducir polling como sustituto.
   - Al interactuar con el mapa o catálogo, aplicar *debounce* y validar umbrales mínimos de desplazamiento geográfico (*thresholds*) antes de disparar peticiones a la API.
   - Reutilizar instancias de mapas y capas vectoriales cacheadas (`dark-v11`).
* **Separación de Responsabilidades en Datos:**
   - **Client Session State (Zustand):** Para el estado interactivo y caliente de la sesión en memoria (carrito activo, pedidos vivos, filtros).
   - **Server Cache (Fetch bajo demanda; si se introduce TanStack Query / SWR, con TTL *staleTime*):** Para consultas paginadas o datos históricos fríos (ej. historial de compras finalizadas), usando TTL para evitar peticiones repetitivas en cada cambio de vista sin saturar el store de sesión. (Hoy TanStack/SWR no están en `package.json`; el historial sale del store en memoria.)

---

### Heurística C: Modelado de Estado y Cardinalidad (Anti-Singleton)
> **Pregunta clave:** *¿Este concepto puede existir más de una vez simultáneamente en el mundo real?*

* **Prohibido Modelar Colecciones con Punteros Únicos:**
  - En sistemas donde el usuario puede realizar múltiples acciones concurrentes (ej. múltiples compras simultáneas en distintas tiendas de autopartes), **nunca crear identificadores singulares en el store como `activeOrderId: string`**.
  - Los estados activos son propiedades intrínsecas de cada entidad y deben derivarse reactivamente de la colección de sesión mediante selectores atómicos memoizados (`useActiveOrdersCount()`).
* **La URL como Fuente de Verdad:**
  - La entidad que el usuario está viendo en detalle en la pantalla la determina la ruta (`/order/[id]`, `/store/[slug]`), evitando sincronizaciones redundantes en el store global.

---

### Heurística D: Diseño Visual, Animaciones y Micro-Interacciones
1. **Estética Cyberpunk / Dark Neón Consistente:**
   - Mantener la paleta oscura premium (grises Tailwind `gray-950`/`gray-900` ≈ `#030712`/`#0b0f19`), acentos cian neón (`#22d3ee`), efectos de glassmorphism con backdrop blur y scrollbars ultra finos traslúcidos.
2. **Fluidez de Animaciones (Framer Motion):**
   - Garantizar ciclos de vida limpios con `<AnimatePresence>` envolviendo condiciones booleanas directas en `motion.div` con `key` explícitas para transiciones suaves de entrada y salida (`exit={{ opacity: 0 }}`) sin saltos bruscos.
