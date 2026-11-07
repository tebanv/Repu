# REPU — Contexto técnico del backend

> **Propósito:** documento de handoff para incorporar desarrolladores y asistentes de IA al backend de REPU. Resume contexto de negocio, arquitectura, responsabilidades, contratos observados, datos, seguridad, integraciones, configuración y brechas conocidas. Debe actualizarse junto con cambios de arquitectura o de contrato.
>
> **Corte de información:** 7 de noviembre de 2026. Describe el código y los archivos de arquitectura disponibles en el repositorio en esa fecha; no significa que todos los cambios locales estén desplegados o liberados.

## 1. Cómo leer y mantener este documento

### Fuentes de verdad

Al implementar o revisar una funcionalidad, contrastar en este orden:

1. **Código ejecutable del microservicio:** rutas en `RouterRest`, reglas de seguridad, handlers, casos de uso, puertos y adaptadores. Describe el comportamiento que se intenta ejecutar hoy.
2. **Contrato publicado:** [`Apis_Mall_Virtual_V2.yaml`](Apis_Mall_Virtual_V2.yaml). Describe el contrato acordado, pero puede estar adelantado o desfasado respecto del router.
3. **Modelo relacional:** [`Repo-DB-2.sql`](Repo-DB-2.sql). Define tablas, columnas, restricciones e índices esperados. No se encontraron migraciones de esquema dentro de los módulos de los micros.
4. **Despliegue/configuración:** `docker-compose-apps.yaml`, `docker-compose-infra.yaml`, variables de entorno y perfiles. Determinan el prefijo HTTP, los servicios conectados y la infraestructura efectiva.
5. **Este documento y READMEs:** material de contexto; no prevalece sobre una diferencia comprobada en código, contrato o DDL.

Cuando haya discrepancias, documentarlas como tales y acordar cuál archivo se corrige. No inferir que una operación existe porque figure en OpenAPI o SQL.

### Convenciones para futuras actualizaciones

- Agregar una entrada con fecha, microservicio, decisión, archivos/contrato afectados, pruebas ejecutadas y trabajo pendiente.
- Registrar explícitamente el comportamiento existente y el deseado, evitando convertir una propuesta de negocio en “funcionalidad implementada”.
- No incluir secretos, tokens de sesión, contraseñas, cadenas de conexión ni valores reales sensibles. Documentar nombres de variables, nunca su valor.
- Actualizar simultáneamente router, contrato OpenAPI, pruebas y configuración cuando una ruta o payload cambie.

## 2. Contexto de aplicación y negocio

REPU es una plataforma de comercio electrónico multi-tenant con catálogo por empresa, compra, despacho y pago. Los roles del sistema definidos por el esquema son:

| Rol | Responsabilidad general |
|---|---|
| `COMPRADOR` | Consulta catálogo, administra perfil/direcciones y crea/consulta compras propias. |
| `DISTRIBUIDOR` | Administra una o más empresas y su catálogo; atiende las órdenes de sus tiendas. |
| `DOMICILIARIO` | Rol previsto para entrega; el esquema contempla despacho y telemetría, pero no se identificó un microservicio independiente de logística en el conjunto desplegado. |
| `ANALISTA` | Rol interno para funciones administrativas/operativas seleccionadas. |
| `ADMIN` | Administración global. |

El tenant principal de catálogo es la **empresa** (`empresas.id_empresa`). Cada producto pertenece a una empresa y las órdenes se separan por empresa. La identidad de sesión identifica al usuario; no se debe confiar en `companyId`, `userId` o rol enviados en el body/query/header por el cliente para decidir autorización. Los handlers/casos de uso deben derivar el actor de la sesión validada y comprobar propiedad del recurso en backend.

Una empresa tiene `id_usuario_propietario` y `configuracion_operativa` JSONB. Un producto tiene empresa, categoría, SKU, marca, precio, stock, características JSONB e imágenes JSONB. La compra conserva snapshots para no cambiar retroactivamente si el comercio edita el producto o la dirección.

## 3. Arquitectura del backend

### Stack y forma de los servicios

- Java, Gradle multi-project y Spring WebFlux/Reactor; programación reactiva con `Mono`/`Flux`.
- PostgreSQL con R2DBC. `ms-companies` utiliza PostGIS para consultas de cercanía. JSONB se usa para atributos variables del catálogo y configuración.
- Redis se utiliza en `ms-auth` para sesiones, control de intentos y desafíos temporales de MFA.
- SMTP se usa en `ms-users` para recuperación de contraseña y en `ms-auth` para MFA administrativo.
- Integración de pago externa con Wompi en `ms-manage-payment`.
- Patrón dominante: `domain/model` define entidades y gateways/puertos; `domain/usecase` contiene reglas; `infrastructure/entry-points/reactive-web` expone handlers y routers; `infrastructure/driven-adapters` integra PostgreSQL, Redis o servicios HTTP; `applications/app-service` ensambla dependencias y configuración.
- La mayoría de servicios declara `spring.webflux.base-path: /${APPLICATION_NAME}`. Las rutas que se listan abajo son rutas de router; el prefijo desplegado se agrega en runtime. Revisar cada configuración/label antes de construir una URL pública.

### Componentes desplegados

El Compose de aplicaciones incluye el frontend y siete servicios backend:

| Servicio | Frontera funcional | Persistencia/integraciones principales |
|---|---|---|
| `ms-auth` | Autenticación, sesiones, parámetros globales | PostgreSQL, Redis, SMTP |
| `ms-users` | Perfil, direcciones y recuperación de contraseña | PostgreSQL/PostGIS, SMTP, validación de sesión |
| `ms-companies` | Empresas/tiendas, propiedad y búsqueda geográfica | PostgreSQL/PostGIS, sesión de `ms-auth` |
| `ms-categories` | Catálogo jerárquico de categorías | PostgreSQL, sesión de `ms-auth` para escritura |
| `ms-products` | Productos e inventario de catálogo | PostgreSQL, sesión de `ms-auth`, consulta de propiedad empresarial |
| `ms-orders` | Carrito, checkout, órdenes, reservas y tracking expuesto | PostgreSQL, sesión de `ms-auth`, bus de eventos local |
| `ms-manage-payment` | Checkout Wompi, transacciones y webhook | PostgreSQL, API Wompi |

El DDL contiene además tablas de envíos, telemetría, reseñas, disputas/mensajes y auditoría. Su presencia en base de datos no implica que el servicio o endpoint correspondiente esté implementado en estos siete micros.

## 4. Microservicios y contratos observados

Las rutas de esta sección se transcriben de los routers/código actuales. El prefijo de aplicación (`/${APPLICATION_NAME}`), el host y los prefijos de Traefik pueden anteponerse. Verificar el `RouterRest` de cada servicio al cambiar una URL.

### 4.1 `ms-auth`

**Responsabilidad:** autoridad de login y sesión. Emite un token opaco aleatorio, almacena su hash SHA-256 en `sesiones_usuario` y mantiene un índice/metadata temporal en Redis. No es un JWT y los otros servicios no deben decodificarlo.

**Rutas actuales:**

| Método y ruta de router | Comportamiento |
|---|---|
| `POST /api/auth/login` | Valida credenciales, estado de usuario y protección de intentos. Para `ADMIN`/`ANALISTA`, inicia un desafío por email y responde `202`; para otros roles crea sesión y responde `200`. |
| `POST /api/auth/mfa/verify` | Valida `challengeId` y código de un solo uso; solo entonces crea sesión administrativa. |
| `POST /api/auth/register` | Autorregistro limitado a `COMPRADOR`, `DISTRIBUIDOR` y `DOMICILIARIO`; valida política de contraseña. |
| `POST /api/auth/logout` | Revoca la sesión que corresponda al token bearer o cookie presentado. Intenta expirar la cookie incluso si el token ya no es válido. |
| `POST /api/auth/logout-all` | Revoca todas las sesiones del usuario autenticado. |
| `GET /api/auth/session` | Introspección usuario/rol para integración entre servicios; requiere credencial de servicio además de credencial de usuario válida. |
| `GET /api/auth/sessions` | Lista las sesiones activas del principal autenticado; no debe usarse para validar la sesión de una solicitud. |
| `GET /api/system/parameters` | Lista parámetros globales activos. |
| `GET /api/system/parameters/key/{key}` | Consulta un parámetro por clave. |
| `POST /api/system/parameters` | Crea un parámetro global. |

**MFA y anti-fuerza bruta en el estado del código:** Redis aplica máximo configurable de 20 intentos/IP por minuto y cinco fallos por cuenta en una ventana de 15 minutos, con bloqueo de cuenta por 15 minutos. El challenge MFA es UUID, código de seis dígitos, TTL por defecto de cinco minutos, máximo de cinco verificaciones y un límite de envío por cuenta. El secreto HMAC protege el código persistido en Redis; el código no se almacena en claro allí. SMTP entrega el código.

El usuario decidió conservar tanto la cookie como `accessToken` en JSON por compatibilidad móvil. El token queda expuesto a cualquier cliente que lea el body; la web debe preferir la cookie HttpOnly y no persistir el bearer en `localStorage`/`sessionStorage`.

**Sesiones:** idle timeout de ocho horas para `ADMIN`/`ANALISTA` y siete días para otros roles; límites absolutos de 24 horas y 30 días, respectivamente. La autenticación renueva el vencimiento cuando queda poco tiempo, sujeto al límite absoluto. En solicitudes autenticadas por cookie se renueva también `Set-Cookie`. El vencimiento absoluto se deriva de la fecha de creación y se adjunta como metadata de Redis; sesiones antiguas pueden hidratarse desde el rol de usuario.

**Persistencia y archivos de referencia:** `usuarios`, `sesiones_usuario`, `parametros_sistema`; `AuthUseCase`, `RedisSessionSecurityAdapter`, `RedisLoginProtectionAdapter`, `EmailMfaAdapter`, `SessionAuthenticationWebFilter`, `SessionCookieSettings`.

**Punto a confirmar:** las rutas de `/api/system/parameters` deben comprobar explícitamente autorización `ADMIN` en el control efectivo; no asumir que estar autenticado es suficiente. Revisar el filtro y SecurityConfig en conjunto al modificar rutas, ya que el `SecurityWebFilterChain` permite el intercambio y el filtro custom implementa autenticación.

### 4.2 `ms-users`

**Responsabilidad:** datos propios del usuario, direcciones de entrega y restablecimiento de contraseña.

| Método y ruta de router | Comportamiento |
|---|---|
| `GET /api/users/profile` | Obtiene perfil del principal. |
| `PATCH /api/users/profile` | Actualiza campos de perfil admitidos; no cambia correo ni rol en el caso de uso observado. |
| `GET /api/users/addresses` | Lista direcciones activas del usuario autenticado. |
| `POST /api/users/addresses` | Crea dirección propia y valida coordenadas. |
| `PATCH /api/users/addresses/{addressId}` | Modifica dirección propia. |
| `DELETE /api/users/addresses/{addressId}` | Desactiva lógicamente dirección propia. |
| `POST /api/users/password-recovery` | Solicita recuperación; la respuesta no debe confirmar si un correo existe. |
| `POST /api/users/password-reset` | Valida código y cambia contraseña. Consume el token y desactiva sesiones del usuario en la misma operación de base de datos. |
| `PATCH /api/users/{userId}/status` | Cambia estado de usuario; el control de acceso de router requiere `ADMIN`. |

**Persistencia:** usuario, atributos de perfil, `direcciones_usuario`, tokens de recuperación; R2DBC y operaciones PostGIS para geolocalización. La autenticación propia consulta la sesión guardada en PostgreSQL a partir del hash del token; no debe suponerse que `ms-users` usa la validación central HTTP de `ms-auth`.

**Regla de seguridad:** perfil y direcciones se derivan del principal; los IDs de dirección deben comprobar pertenencia antes de modificar o desactivar. El cambio de estado de otro usuario es operación administrativa. El reset de contraseña revoca las sesiones en DB; un token presente en Redis no debe aceptarse si la fila de sesión ya se marcó inactiva.

### 4.3 `ms-companies`

**Responsabilidad:** alta y administración de tiendas, datos comerciales, slug, configuración operativa y descubrimiento geográfico.

| Método y ruta de router | Comportamiento |
|---|---|
| `GET /api/companies` | Lista empresas; puede recibir `lat`, `lng`, `radiusKm`. Coordenadas deben venir en pareja y validar rango; la búsqueda utiliza geografía PostGIS. |
| `GET /api/companies/{slug}` | Consulta tienda por slug sujeta a visibilidad. |
| `POST /api/companies` | Crea empresa asignando el usuario autenticado como propietario, no un propietario arbitrario del body. |
| `PATCH /api/companies/{companyId}` | Actualiza datos permitidos solo para propietario o `ADMIN`. |
| `PATCH /api/companies/{companyId}/status` | Activa/desactiva empresa bajo autorización. |

**Visibilidad:** las consultas filtran empresas inactivas en SQL; visitante ve activas, propietario distribuidor puede ver las propias aunque estén inactivas y `ADMIN` puede consultar todas. La respuesta pública omite `taxId` y `ownerUserId`; los datos completos se reservan a respuestas de escritura/administración según el handler.

**Persistencia:** `empresas`, relación lógica `id_usuario_propietario`; coordenadas `GEOGRAPHY(Point,4326)` y `configuracion_operativa` JSONB. Rutas de cercanía utilizan PostGIS. Propiedad y rol deben validarse en el caso de uso/adaptador, no solo en el frontend.

### 4.4 `ms-categories`

**Responsabilidad:** mantener categorías jerárquicas utilizadas por empresas/productos; `parentId` expresa la jerarquía y el cliente puede construir el árbol desde el listado.

| Método y ruta de router | Comportamiento |
|---|---|
| `GET /api/catalog/categories` | Lista categorías. |
| `POST /api/catalog/categories` | Crea; comprueba el padre si se proporciona. Solo roles internos configurados en seguridad. |
| `PATCH /api/catalog/categories/{categoryId}` | Actualiza nombre, descripción, icono o padre; valida padre existente y no permite self-parent. |
| `PATCH /api/catalog/categories/{categoryId}/status` | Activa/desactiva categoría. |

No se observaron rutas de lectura individual ni de borrado. La validación de jerarquía no debe confundirse con detección completa de ciclos de varios niveles. El listado observado usa `findAll()`; validar si categorías inactivas deben filtrarse para clientes públicos y hacerlo en DB si corresponde.

### 4.5 `ms-products`

**Responsabilidad:** catálogo multi-tenant por empresa, con marca, SKU, precio, oferta, inventario, atributos técnicos e imágenes.

| Método y ruta de router | Comportamiento |
|---|---|
| `GET /api/catalog/products?companyId=…` | Lista productos de una empresa; acepta filtros opcionales de categoría y atributos. `companyId` es requerido en el flujo observado. |
| `POST /api/catalog/products` | Crea producto. El actor autenticado debe ser distribuidor propietario de la empresa o administrador. |
| `PATCH /api/catalog/products/{productId}` | Actualiza producto solo si el actor tiene permiso sobre su empresa. |
| `PATCH /api/catalog/products/{productId}/status` | Activa/desactiva producto bajo la misma autorización; el update debe comprobar filas afectadas y devolver el estado persistido. |

**Modelo:** SKU es texto y debe permanecer como tal, incluso con ceros iniciales o caracteres alfanuméricos. `brand` tiene columna propia de base de datos, además de que el objeto `attributes` puede guardar características técnicas. No duplicar `brand` dentro de `attributes` como sustituto del campo formal.

**Aislamiento/visibilidad:** POST/PATCH se limitan a `ADMIN` y `DISTRIBUIDOR`; el actor se deriva de la sesión. El backend comprueba la empresa propietaria en SQL, no confía en `companyId` del body para establecer identidad. Listado público excluye productos inactivos y productos de empresas inactivas. Propietario y administrador pueden ver registros inactivos dentro de su alcance.

**Persistencia:** tabla `productos`, campos `marca`, `sku_referencia`, `inventario_disponible`, `inventario_reservado`, `caracteristicas_tecnicas` JSONB e `imagenes_urls` JSONB. Los atributos JSONB se usan para filtros por contención.

**Puntos de verificación:** al cambiar estado, comprobar `{"active": false}`, URL/ruta correcta, usuario y empresa dueños, respuesta posterior y columna `activo` en la misma base/esquema (`repu`). Respuesta `200` por sí sola no prueba persistencia. El endpoint de lista es público y oculta inactivos; una lista sin el producto puede significar filtrado, no borrado.

### 4.6 `ms-orders`

**Responsabilidad:** carrito, checkout transaccional, órdenes y estados comerciales/logísticos, reservas de inventario, consulta activa, streaming de cambios y tracking.

Las rutas actualmente registradas contienen una mezcla de prefijos:

| Método y ruta de router | Comportamiento |
|---|---|
| `GET /cart?companyId=…` | Lee el carrito en contexto de empresa. |
| `POST /cart/items` | Agrega producto al carrito. |
| `DELETE /cart/items/{itemId}` | Elimina un ítem del carrito. |
| `GET /orders/active` | Lista órdenes activas del principal. |
| `GET /api/orders?status=&page=&size=` | Lista órdenes accesibles con paginación. |
| `POST /api/orders/checkout` | Checkout idempotente, transaccional y con reserva de inventario. Requiere `X-Request-ID`. |
| `GET /api/orders/{orderId}` | Consulta orden aplicando ownership. |
| `POST /api/orders/{orderId}/cancel` | Cancela orden propia conforme al estado permitido. |
| `GET /api/orders/{orderId}/live-stream` | SSE de cambios de orden. |
| `POST /api/companies/{companyId}/orders/{orderId}/accept` | Acepta orden de empresa autorizada. |
| `POST /companies/{companyId}/orders/{orderId}/reject` | Rechaza orden de empresa autorizada. |
| `POST /companies/{companyId}/orders/{orderId}/ready` | Marca pedido listo. |
| `GET /tracking/order/{orderId}` | Consulta tracking de orden con autorización correspondiente. |

Las mutaciones requieren identidad autenticada. El adapter de órdenes limita acceso por comprador/propietario de empresa y checkout coordina stock, reserva, snapshots y clave de idempotencia. Los eventos SSE se conservan en un `Sinks` local con replay acotado: no es una cola durable ni comparte eventos entre réplicas.

**Persistencia:** `carritos_compras`, `items_carrito`, `ordenes`, `detalles_orden`, `historial_estados_orden`, `reservas_inventario`, `idempotencias_checkout`; el esquema define además pagos, envíos y ubicación.

**Estado real frente a evolución propuesta:** el código observado no tiene `PUT /api/cart/items/{productId}` para fijar cantidades ni `DELETE /api/cart` para vaciar todo el carrito. El `GET /cart` exige `companyId` en la ruta observada; no se debe anunciar “carrito único por usuario sin empresa” como existente. Hace falta alinear ruta, atomicidad, idempotencia y restricción de un carrito activo por usuario con el esquema antes de implementar el flujo nuevo.

### 4.7 `ms-manage-payment`

**Responsabilidad:** integración directa con Wompi para tokenización/pago, preparación de checkout, consulta y manejo de webhook.

| Método y ruta de router | Comportamiento |
|---|---|
| `GET /payments/id/{id}` | Consulta transacción. |
| `GET /payments/reference/{reference}` | Consulta por referencia. |
| `GET /payments/status/{status}` | Consulta por estado. |
| `PUT /payments/{id}/status/{status}` | Actualiza estado recibido en ruta. |
| `POST /wompi/tokenize` | Tokeniza instrumento según integración. |
| `POST /wompi/payments` | Solicita pago a Wompi y registra resultado. |
| `GET /wompi/payments/{wompiId}` | Consulta transacción remota. |
| `POST /wompi/checkout/prepare` | Genera referencia/firma y prepara checkout `PENDING`. |
| `POST /wompi/webhook` | Valida checksum y actualiza la transacción asociada. |

**Integración/seguridad:** HTTP con `WebClient`; claves y URL de Wompi vienen de variables de entorno. Implementa firma/checksum, pero el código inspeccionado registra en log datos del webhook y una cadena de firma que incluye el secreto de integridad; eliminar esos logs antes de exponerlo. No se encontró autorización de sesión aplicada a las rutas de pagos en los entry points revisados. El webhook debe usar verificación de firma, idempotencia, controles de frescura y respuestas que no conviertan todo error en éxito.

**Modelo/persistencia:** el adaptador inspeccionado persiste `pago_transaccion`; el DDL oficial define `intentos_pago` y `reembolsos`, no `pago_transaccion`. Resolver esa incompatibilidad explícitamente antes de desplegar/migrar.

## 5. Datos e invariantes importantes

### Entidades del DDL (`Arq-Infra/Repo-DB-2.sql`)

- **Identidad:** `usuarios`, `sesiones_usuario`, `parametros_sistema`, `tokens_recuperacion_contrasena`.
- **Directorio/comercio:** `direcciones_usuario`, `empresas`, `categorias`, `productos`.
- **Compra:** `carritos_compras`, `items_carrito`, `ordenes`, `detalles_orden`, `historial_estados_orden`, `reservas_inventario`, `idempotencias_checkout`.
- **Pago:** `intentos_pago`, `reembolsos`.
- **Logística/telemetría:** `envios`, `historial_ubicacion_envio` particionada por fecha, `posiciones_actuales_envio`.
- **Postventa/auditoría:** `resenas`, `tickets_disputas`, `mensajes_ticket`, `auditoria_global`.

### Invariantes de datos a respetar

- Producto pertenece a una empresa; la propiedad del tenant se resuelve desde `empresas.id_usuario_propietario`.
- El precio y stock usados en checkout deben leerse/validarse en backend, no aceptarse del cliente como fuente de verdad.
- La reserva de inventario y los cambios asociados deben ocurrir en la misma transacción; estados de reserva permitidos: `ACTIVA`, `CONSUMIDA`, `LIBERADA`, `EXPIRADA`.
- Checkout usa `X-Request-ID` como clave idempotente; un mismo UUID no puede aceptar payload distinto (el hash de solicitud existe para detectar ese caso).
- Detalles de orden conservan snapshots del nombre/SKU/precio/características y opciones.
- La suma de `subtotal + costo_envio + costo_servicio + impuestos - descuentos` debe ser igual a `total_final`.
- Soft delete/estado (`activo`) es diferente de borrado físico; endpoints públicos filtran inactivos en consultas SQL.
- Los campos JSONB (`configuracion_operativa`, características, imágenes y snapshots) requieren contrato por servicio/versionado para evitar divergencias silenciosas.
- El DDL contiene varios vínculos lógicos y no todas las FK explícitas entre dominios; una relación lógica no garantiza integridad referencial en DB.

## 6. Autenticación, autorización y controles transversales

### Flujo de sesión

1. El cliente inicia login con `ms-auth`.
2. El usuario regular recibe sesión; roles administrativos completan el desafío MFA por correo.
3. Web recibe cookie HttpOnly/Secure/SameSite y, por decisión de compatibilidad vigente, JSON con `accessToken`. Aplicaciones nativas pueden usar `Authorization: Bearer <token>` y guardarlo en keystore del sistema.
4. El microservicio valida el token mediante el mecanismo local/de servicio implementado (introspección de sesión o consulta central) y luego aplica autorización del recurso. Un `401` significa sesión inválida; error de infraestructura de `ms-auth` no debe transformarse en identidad válida.
5. Logout revoca una sesión; logout-all revoca las sesiones del principal.

Guía de integración adicional: [`Guia-Integracion-Sesiones-Ms-Auth.md`](Guia-Integracion-Sesiones-Ms-Auth.md). Esa guía debe revisarse para reflejar MFA y la expiración absoluta descritos aquí: conserva referencias previas a login sin desafío y a renovación sin límite absoluto.

### CSRF/Origin y CORS (estado de trabajo)

- Los servicios que aceptan cookie usan orígenes explícitos y permiten credenciales; no usar `*` con credenciales.
- `CORS_ALLOWED_ORIGINS_MS_*` define allowlist por servicio; `CORS_PUBLIC_ORIGINS` se agrega desde Compose y tiene como valores públicos por defecto `https://app.repu.com,https://repu.com`. Los orígenes locales existentes se mantienen configurables.
- Los filtros de Origin añadidos a auth, users, companies, categories, products y orders bloquean métodos de escritura con origen no permitido; también requieren `Origin` en mutaciones que usan cookie. Un bearer explícito permite llamadas máquina/nativas sin Origin, pero cualquier Origin explícito no permitido se rechaza.
- `ms-manage-payment` tiene CORS separado y no recibió el filtro de Origin de cookie; revisar por separado su superficie y webhook.
- Los valores actuales de Traefik en `docker-compose-infra.yaml` exponen entrada HTTP en puerto 80. `Secure` cookie y dominios HTTPS requieren terminación TLS real en Traefik o proxy externo.
- La cookie `__Host-` es host-only, requiere `Secure`, `Path=/` y no acepta `Domain`. No se comparte automáticamente entre `app.repu.com` y `repu.com`.

### Controles multi-tenant

- Toda mutación de empresa/producto/orden debe recibir actor del principal autenticado.
- Para distribuidores, comprobar ownership con el ID de usuario autenticado y relación DB empresa-producto; no aceptar `ownerUserId`, `companyId` o rol del body como autorización.
- El listado público puede filtrar recursos inactivos, pero las excepciones de administrador/propietario se evalúan en backend y deben limitarse a sus empresas.
- Respuestas públicas de empresas no deben incluir `taxId` ni `ownerUserId`.
- Validar que la introspección de sesión usada por un servicio está autenticada internamente (`X-Auth-Service-Token` u otro canal de servicio); nunca confiar en encabezados de identidad enviados por Internet.

## 7. Configuración de despliegue (nombres, no valores secretos)

### Infraestructura común

`docker-compose-infra.yaml` declara Traefik, PostgreSQL/PostGIS y Redis. `docker-compose-apps.yaml` declara los servicios, redes `internal-net`/`proxy-net`, health/labels y rutas por `PathPrefix`. La DB y Redis no deben ser públicamente accesibles salvo decisión explícita de operación.

Variables compartidas usuales: `APPLICATION_NAME_MS_*`, `SERVER_PORT_MS_*`, `SPRING_PROFILES_ACTIVE_MS_*`, `POSTGRES_URL`, `POSTGRES_PORT`, `POSTGRES_DB`, `POSTGRES_SCHEMA`, `POSTGRES_USER`, `POSTGRES_PASSWORD`, `REDIS_URL`, `REDIS_PORT`, `REDIS_PASSWORD`, `REDIS_TIMEOUT`, `AUTH_SERVICE_TOKEN`, `SESSION_COOKIE_NAME`, `SESSION_COOKIE_SECURE`, `CORS_ALLOWED_ORIGINS_MS_*`, niveles de log y variables de Actuator.

### Variables y dependencias particulares

| Servicio | Variables/consideraciones |
|---|---|
| `ms-auth` | `AUTH_SERVICE_TOKEN`, `MFA_HMAC_SECRET`, `MFA_CODE_TTL_SECONDS`, `MFA_MAX_ATTEMPTS`, `AUTH_LOGIN_IP_MAX_ATTEMPTS`, `AUTH_LOGIN_ACCOUNT_MAX_FAILURES`, `AUTH_TRUST_PROXY_HEADERS`, `MAIL_HOST`, `MAIL_PORT`, `MAIL_USERNAME`, `MAIL_PASSWORD`, `MAIL_SMTP_AUTH`, `MAIL_SMTP_STARTTLS`, `MAIL_FROM`, Redis y PostgreSQL. Mantener el secreto MFA independiente del token de servicio en producción. |
| `ms-users` | PostgreSQL, SMTP para recovery, configuración de sesión/cookie y autenticación usada por el servicio. |
| `ms-companies` | PostgreSQL/PostGIS, CORS, variables de sesión/servicio y auth remota. |
| `ms-categories` | PostgreSQL, CORS y URL/credencial de introspección a `ms-auth`. |
| `ms-products` | PostgreSQL, CORS y configuración de auth/servicio. |
| `ms-orders` | PostgreSQL, `ORDER_RESERVATION_TTL`, `AUTH_SESSION_BASE_URL`, timeouts, `AUTH_SERVICE_TOKEN`, flags de HTTP local solo para desarrollo, CORS. |
| `ms-manage-payment` | PostgreSQL, `WOMPI_BASE_URL`, `WOMPI_PUBLIC_KEY`, `WOMPI_PRIVATE_KEY`, `WOMPI_INTEGRITY_SECRET`, `WOMPI_EVENT_SECRET`; no imprimirlos en logs. |

Los `application.yaml` de `applications/app-service/src/main/resources` están ignorados por Git en este repositorio. Validar los valores efectivos de cada entorno desde configuración segura; no asumir que un valor local es parte de una release.

## 8. Brechas y desalineaciones conocidas

Priorizar estos puntos antes de ampliar funcionalidades; “observado” describe el código revisado, no una severidad formal:

1. **Contrato de carrito:** falta en router el `PUT` idempotente de cantidad y `DELETE /cart` descritos en el backlog/contrato; el endpoint actual exige contexto de empresa y las operaciones de ítem son distintas.
2. **Rutas de órdenes:** el handler de checkout construye una URL `Location` que no coincide con la ruta de detalle; router mezcla rutas con `/api` y sin `/api`. Alinear también `APPLICATION_NAME`/Traefik y contrato.
3. **Pagos:** rutas Wompi del router difieren de OpenAPI (`/wompi/checkout/prepare`, `/wompi/webhook` frente a rutas bajo `/payments/...`); modelo persistido `pago_transaccion` difiere del DDL `intentos_pago`. Verificar ownership/tenant y autenticación de pagos; evitar logs de secretos/datos crudos; webhook requiere idempotencia, frescura y política de reintentos.
4. **Expiración de reservas:** existe caso de uso, pero en el código inspeccionado no se encontró scheduler que lo invoque. Una reserva vencida no se libera solo porque exista `expira_en`.
5. **Eventos de órdenes:** SSE usa bus local de proceso, no broker persistente ni fan-out multi-réplica.
6. **Finanzas de checkout:** el código inspeccionado inicializa algunos componentes de monto (envío, comisión/servicio, impuestos/descuentos) en cero; definir reglas reales y asegurar consistencia con constraints del DDL.
7. **Autorización global de `ms-auth`:** asegurar que parámetros del sistema sean solo `ADMIN` y auditar cambios; no basta con que el endpoint pida sesión.
8. **Visibilidad de categorías:** confirmar política de categorías inactivas y filtrar en DB en lectura pública si deben ocultarse.
9. **Dominio de logística/postventa:** hay tablas de envío, tracking histórico, reseñas, disputas y auditoría en DDL, pero no se identificó microservicio dedicado para todas esas capacidades en Compose. Definir frontera antes de crear endpoints.
10. **Autenticación heterogénea:** `ms-users` valida sesiones directamente en DB; otros servicios usan adaptadores/introspección. Documentar y probar consistencia de revocación para cada camino.
11. **Trazas y secretos:** revisar logs de todos los servicios para evitar tokens, cookies, códigos MFA, payloads sensibles y secretos Wompi. Añadir auditoría de cambios privilegiados donde se requiera.
12. **Versiones de plataforma:** los servicios declaran versiones distintas de Spring Boot (en lo revisado: ms-companies 3.2.5, ms-auth/ms-manage-payment 3.5.7, ms-products/ms-users/ms-categories 4.0.1 y ms-orders 4.1.1). Evaluar compatibilidad CVE, soporte y estrategia de actualización con builds por servicio.
13. **Esquema/migraciones:** el DDL fuente está bajo `Arq-Infra`; no se hallaron migraciones versionadas por microservicio. Automatizar migraciones reversibles y probarlas contra una DB limpia.

## 9. Pruebas y forma de validar cambios

- Ejecutar primero pruebas de `domain/usecase` y `r2dbc-postgresql` del servicio afectado; después pruebas de `reactive-web` y compilación del `app-service`.
- Las tareas Gradle dependen del nombre declarado en `settings.gradle`; en varios servicios los módulos se llaman `:reactive-web`, `:r2dbc-postgresql`, `:usecase`, `:app-service` (no necesariamente `:infrastructure:...`).
- Para comportamiento multi-tenant, cubrir: sin sesión, rol incorrecto, propietario correcto, distribuidor ajeno, admin, recurso inactivo y empresa inactiva.
- Para writes, comprobar filas afectadas y releer estado desde persistencia; prueba de handler `200` no sustituye prueba de repositorio/DB.
- Para checkout, cubrir atomicidad de stock/reserva, concurrencia, idempotencia con payload repetido y rechazo de misma clave con payload diferente.
- Para autenticación, cubrir cookie y bearer, token inválido/expirado, revocación/logout, MFA consumible una sola vez, límites por IP/cuenta y error de Redis/SMTP.
- Existe una nota previa de compatibilidad de BlockHound/Byte Buddy bajo JDK más nuevo que el target Java 17; si falla antes de ejecutar aserciones, verificar JDK y usar solo init script temporal de pruebas. No conservar archivos temporales ni cambiar el target de Java del proyecto para sortearlo.
- Ejecutar YAML lint/parse sobre OpenAPI y Compose cuando se alteren contratos o despliegue. Docker puede no estar instalado en el entorno local; si no está disponible, informar que solo se validó sintaxis YAML.

## 10. Checklist de incorporación para una nueva funcionalidad

1. Identificar propietario funcional, consumidor, tenant y actor autorizado.
2. Leer router, Handler, caso de uso, gateway/adapter, entity/mapper, tests y config del servicio.
3. Comparar payload/status code con OpenAPI y columnas/restricciones con DDL.
4. Definir explícitamente comportamiento de inactivos, errores, idempotencia, concurrencia y datos sensibles.
5. Implementar la autorización cerca del caso de uso y la restricción tenant también en la consulta/operación SQL cuando aplique.
6. Mantener el flujo reactivo; no bloquear event loop. Ejecutar operaciones SMTP/bloqueantes en scheduler apropiado.
7. Añadir tests unitarios del caso de uso y adapter/handler para los casos positivos y negativos.
8. Actualizar contrato, configuración y este documento/bitácora en la misma entrega.
9. Verificar migración/SQL, compilar y ejecutar tests focalizados; reportar limitaciones de entorno separadas de fallos de código.
10. Revisar logs, métricas, privacidad, rate limits, CORS/Origin, ownership y revocación antes de cerrar.

## 11. Bitácora inicial

| Fecha | Área | Contexto registrado |
|---|---|---|
| 2026-11-07 | `ms-products` | SKU debe ser texto de extremo a extremo; `brand` requiere mapeo formal; revisar siempre persistencia del PATCH de estado, ownership y filtros de producto/empresa inactivos. |
| 2026-11-07 | `ms-companies` | Actualizaciones requieren propietario o `ADMIN`; vistas públicas deben filtrar inactivas y omitir `taxId`/`ownerUserId`. |
| 2026-11-07 | `ms-auth` | Protección de login Redis: 20 intentos/IP/min y 5 fallos/cuenta/15 min; bloqueo 15 min; MFA email para `ADMIN`/`ANALISTA`; códigos 5 min/5 intentos; sesión idle + límite absoluto. |
| 2026-11-07 | `ms-users` | Recovery de contraseña consume código y debe invalidar sesiones en la misma operación atómica. |
| 2026-11-07 | CORS/Origin | Allowlist parametrizable incluye orígenes locales y dominios `app.repu.com`/`repu.com`; las mutaciones con cookie deben validar Origin. |
| 2026-11-07 | Estado de repositorio | Hay modificaciones locales pendientes en múltiples microservicios y archivos de infraestructura/contrato. Antes de asumir que una capacidad está liberada, revisar `git status`, diff y despliegue efectivo. |

### Decisiones aún por cerrar

- Incorporar rate limit adicional en gateway para IP real y protección distribuida contra ataques volumétricos; `AUTH_TRUST_PROXY_HEADERS` solo puede habilitarse si `ms-auth` recibe tráfico desde proxy confiable que sobrescribe `X-Forwarded-For`.
- Resolver si el bearer se debe retirar del JSON para clientes web con una señal explícita de cliente, manteniendo compatibilidad móvil.
- Definir catálogo de orígenes por ambiente y cómo compartir sesión entre `app.repu.com`, `repu.com` y futuros subdominios, respetando la cookie host-only `__Host-`.
- Acordar contrato final de carrito, prefijo uniforme `/api`, errores y unicidad de carrito activo.
- Acordar esquema de pagos definitivo (`pago_transaccion` vs. `intentos_pago`) y ciclo de reembolsos.
- Definir propiedad, lifecycle, broker y retención para envíos, SSE, reviews, disputas y auditoría.
