# Modelo de datos — backend real (`repu`)

- **Fuente canónica:** `Arq-Infra/Repo-DB-2.sql` (DDL PostgreSQL 15+ / PostGIS)
- **Esquema:** `repu`
- **Dueño:** backend Spring Boot (microservicios); el front nunca accede a la base de datos
- **Estado:** contrato real del backend ya presente en el repositorio (2026-10-27)
- **Modelo Supabase anterior:** conservado como histórico en [legacy/DATA_MODEL-SUPABASE.md](./legacy/DATA_MODEL-SUPABASE.md)

> Este documento reemplaza el contrato inglés de Supabase que se usó durante la etapa sin backend. La fuente de verdad del esquema es el DDL de `Arq-Infra/Repo-DB-2.sql`; si hay divergencia entre este resumen y el DDL, manda el DDL.

## 1. Convenciones

| Aspecto | Decisión |
|---|---|
| Idioma | Tablas y columnas en **español snake_case**; API Java y código en inglés |
| PK | `UUID PRIMARY KEY DEFAULT gen_random_uuid()` |
| FKs | Físicas, declaradas al final del DDL, con `ON DELETE` explícito (`CASCADE` en hijos, `RESTRICT` en catálogo/orden) |
| Dinero | `NUMERIC(15,2)` en PostgreSQL; el front usa enteros COP (`Math.round`). El adaptador define la conversión y el redondeo |
| Tiempo | `TIMESTAMPTZ`; `fecha_creacion`/`fecha_actualizacion` con trigger en tablas mutables |
| Geo | `GEOGRAPHY(Point,4326)` + índices GiST; nunca lat/lng sueltos |
| Soft delete | `activo`, `esta_activa`, `usado` según la tabla |
| Concurrencia | `version` en direcciones y órdenes para control optimista |
| Seguridad | **Sin RLS**: la autorización vive en los microservicios; el front no tiene credenciales de DB |
| Auditoría | `auditoria_global` + `historial_estados_orden` + particiones de tracking |

## 2. Inventario de tablas

| Dominio | Tablas | Propósito |
|---|---|---|
| Configuración | `parametros_sistema` | Parámetros globales (`MONEDA_DEFECTO`, radios, etc.) |
| Identidad | `usuarios`, `sesiones_usuario`, `tokens_recuperacion_contrasena` | Cuentas, sesiones opacas y recuperación de contraseña |
| Perfil | `direcciones_usuario` | Direcciones reutilizables del comprador |
| Empresas | `empresas` | Tiendas/distribuidores, ubicación y horarios |
| Catálogo | `categorias`, `productos` | Categorías jerárquicas y productos con `JSONB` de características |
| Carrito | `carritos_compras`, `items_carrito` | Carrito server-side por usuario/empresa |
| Órdenes | `ordenes`, `detalles_orden`, `historial_estados_orden` | Orden, snapshot de líneas y trazabilidad de estados |
| Inventario | `reservas_inventario` | Reserva de stock durante checkout |
| Checkout | `idempotencias_checkout` | Idempotencia de creación de orden |
| Pagos | `intentos_pago`, `reembolsos` | Intentos de pasarela y reembolsos |
| Logística | `envios`, `historial_ubicacion_envio`, `posiciones_actuales_envio` | Envío, historial particionado y última posición |
| Postventa | `resenas`, `tickets_disputas`, `mensajes_ticket` | Reseñas, PQR/garantías y mensajes |
| Auditoría | `auditoria_global` | Log transaccional de acciones |

Las tablas de tracking (`historial_ubicacion_envio`) están particionadas por mes; `posiciones_actuales_envio` es un upsert de última posición, no un histórico 1Hz.

## 3. Rebanada de autenticación (la que se integra primero)

### 3.1 `usuarios`

```sql
id_usuario          UUID PK DEFAULT gen_random_uuid()
correo_electronico  VARCHAR(150) NOT NULL
hash_contrasena     VARCHAR(255) NOT NULL
rol_sistema         VARCHAR(50) NOT NULL
nombres             VARCHAR(100) NOT NULL
apellidos           VARCHAR(100) NOT NULL
telefono_movil      VARCHAR(20)
atributos_perfil    JSONB DEFAULT '{}' NOT NULL
ultimo_login        TIMESTAMPTZ
activo              BOOLEAN DEFAULT TRUE NOT NULL
fecha_creacion      TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL
fecha_actualizacion TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL
```

- `CHECK (rol_sistema IN ('COMPRADOR','DISTRIBUIDOR','DOMICILIARIO','ANALISTA','ADMIN'))`.
- Índice único parcial de correo activo: `idx_usuarios_correo`.
- `activo=false` es soft delete; un usuario inactivo no puede iniciar sesión.

### 3.2 `sesiones_usuario`

```sql
id_sesion          UUID PK DEFAULT gen_random_uuid()
id_usuario         UUID NOT NULL → usuarios(id_usuario) ON DELETE CASCADE
token_sesion_hash  VARCHAR(64) NOT NULL UNIQUE
id_empresa_activa  UUID NULL → empresas(id_empresa) ON DELETE SET NULL
direccion_ip       VARCHAR(45)
agente_usuario     TEXT
dispositivo_info   VARCHAR(100)
esta_activa        BOOLEAN DEFAULT TRUE NOT NULL
expira_en          TIMESTAMPTZ NOT NULL
fecha_creacion     TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL
ultimo_acceso      TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP NOT NULL
```

- El token en claro **nunca** se guarda: solo SHA-256 en `token_sesion_hash` (64 hex).
- `ms-auth` cachea la referencia en Redis (`repu:auth:session:<hash>`) y valida contra PostgreSQL si no está en caché.
- TTL 8 h para `ADMIN`/`ANALISTA`; 7 días para el resto. Renovación deslizante en servidor cuando quedan < 30 min.
- `id_empresa_activa` existe para el futuro flujo de distribuidor; hoy el login lo emite `null`.

### 3.3 `tokens_recuperacion_contrasena`

```sql
id_token           UUID PK
id_usuario         UUID NOT NULL → usuarios(id_usuario) ON DELETE CASCADE
codigo_hash        VARCHAR(64) NOT NULL
expira_en          TIMESTAMPTZ NOT NULL
intentos_fallidos  INTEGER DEFAULT 0 NOT NULL
max_intentos       INTEGER DEFAULT 5 NOT NULL
usado              BOOLEAN DEFAULT FALSE NOT NULL
usado_en           TIMESTAMPTZ
direccion_ip       VARCHAR(45)
agente_usuario     TEXT
fecha_creacion / fecha_actualizacion
```

- Solo un token activo por usuario (índice único parcial `usado = FALSE`).
- El código se envía por correo y se guarda como hash; nunca en claro.

### 3.4 `direcciones_usuario`

```sql
id_direccion       UUID PK
id_usuario         UUID NOT NULL → usuarios(id_usuario) ON DELETE CASCADE
nombre_direccion   VARCHAR(100) NOT NULL
direccion_completa TEXT NOT NULL
ciudad             VARCHAR(100) NOT NULL
codigo_postal      VARCHAR(20)
es_principal       BOOLEAN DEFAULT FALSE NOT NULL
ubicacion          GEOGRAPHY(Point,4326) NOT NULL
notas_entrega      TEXT
activo             BOOLEAN DEFAULT TRUE NOT NULL
version            INTEGER DEFAULT 0 NOT NULL
fecha_creacion / fecha_actualizacion
```

- `ms-users` expone CRUD; `es_principal` define la dirección por defecto.
- `DeliveryAddress` del front (`order.ts`) tiene `street`, `details`, `city`, `notes`, `coordinates`; el adaptador debe mapear `direccion_completa`/`nombre_direccion`/`ubicacion`.

### 3.5 `parametros_sistema`

```sql
id_parametro        UUID PK
codigo_clave        VARCHAR(50) NOT NULL UNIQUE
valor_configuracion JSONB NOT NULL
descripcion         TEXT
activo              BOOLEAN DEFAULT TRUE NOT NULL
fecha_creacion / fecha_actualizacion
```

`ms-auth` expone lectura/creación; la autorización por rol aún no está granularizada (hoy basta con sesión).

## 4. Roles

| Backend `rol_sistema` | Front `UserRole` | Autorregistro |
|---|---|---|
| `COMPRADOR` | `comprador` | Sí |
| `DISTRIBUIDOR` | `distribuidor` | Sí |
| `DOMICILIARIO` | `domiciliario` | Sí |
| `ANALISTA` | `analista` | No |
| `ADMIN` | `admin` | No |

El front debe añadir `analista` a `src/types/auth.ts`. `'demo'` no es un rol.

## 5. Mapeo auth front ↔ backend

| Front (`src/types/auth.ts`) | Backend | Regla |
|---|---|---|
| `User.id` | `usuarios.id_usuario` / `profile.id` | String UUID |
| `User.email` | `usuarios.correo_electronico` / `profile.email` | Directo |
| `User.name` | `profile.firstName` + `profile.lastName` | `trim()`; el login no lo devuelve |
| `User.role` | `profile.role` | MAYÚSCULAS → minúsculas; desconocido → `comprador` + warn |
| `User.avatar` | `profile.profileAttributes.avatar` (si existe) | Hoy el backend no lo expone como campo; `null` por defecto |
| Sesión | Cookie `__Host-repu_session` | No se modela en `User` ni en `auth-storage` |

`auth-storage` solo persiste `user` + `isAuthenticated`; el token queda en la cookie.

## 6. Brecha de pedidos (para el corte posterior)

El modelo de pedidos del backend **no coincide** con `src/types/order.ts`:

| Backend | Front hoy | Implicación |
|---|---|---|
| `ordenes.estado_orden`: `CREADA`, `CONFIRMADA`, `EN_PROCESO`, `EN_CAMINO`, `COMPLETADA`, `CANCELADA` | `OrderStatus`: `CREADO`, `PAGADO`, `ACEPTADO`, `PREPARANDO`, `LISTO`, `RECOGIDO`, `EN_CAMINO`, `ENTREGADO`, `CANCELADO` | Mapeo explícito; el front tiene más hitos que el macro-estado |
| `estado_pago`: `PENDIENTE`, `AUTORIZADO`, `PAGADO`, `RECHAZADO`, `REEMBOLSADO` | `paymentStatus`: `PENDING`, `PAID` | El front no modela `AUTORIZADO`/`RECHAZADO`/`REEMBOLSADO` |
| `estado_comercio`: `PENDIENTE_CONFIRMACION`, `ACEPTADO`, `EN_PREPARACION`, `LISTO_PARA_RECOGIDA`, `RECHAZADO` | `status`/timeline | Se usa para la timeline de tienda |
| `estado_envio`: `NO_ASIGNADO`, `ASIGNANDO`, `ASIGNADO`, `EN_TIENDA`, `RECOGIDO`, `EN_RUTA`, `ENTREGADO`, `FALLIDO` | `status`/timeline | Se usa para tracking/repartidor |
| `numero_orden_legible BIGSERIAL` | `id` `REP-YYYY-XXXX` | El front usa un número legible; el backend tiene UUID + bigserial |
| `subtotal`, `costo_envio`, `descuentos`, `impuestos`, `total_final` `NUMERIC(15,2)` | `subtotal`, `deliveryFee`, `serviceFee`, `total` enteros COP | Adaptador monetario obligatorio |
| `detalles_orden` con snapshots `JSONB` | `OrderItem` simple | Mapear nombre/precio/cantidad y conservar snapshots |

> Esta tabla es un **diagnóstico**, no un contrato aprobado. El mapeo definitivo se cerrará antes de reemplazar `orderStore` y debe documentarse en `DATAFLOW.md`/`AUTHENTICATION.md` solo cuando exista.

## 7. Acceso a datos y seguridad

- No hay RLS ni exposición directa de PostgreSQL al navegador. La autorización se aplica en cada microservicio.
- `ms-auth` es la autoridad de sesión; `ms-users` valida la cookie contra `sesiones_usuario`; `ms-orders`/`ms-companies`/`ms-products`/`ms-categories` usan introspección contra `ms-auth` con `X-Auth-Service-Token`.
- Las credenciales de DB/Redis son variables de entorno del backend; el front solo conoce rutas relativas same-origin.
- El esquema y las migraciones los posee el backend; este documento no reemplaza el DDL.

## 8. Relación con el modelo Supabase anterior

El modelo inglés (`profiles`, `stores`, `products`, `orders`, `order_items`, `order_status_history`, `driver_positions`, RLS con `auth.uid()`) queda como **histórico** en [legacy/DATA_MODEL-SUPABASE.md](./legacy/DATA_MODEL-SUPABASE.md). No se mantiene, no se migra y no se usa para nuevos desarrollos.

Diferencias clave:

- Supabase: tablas inglesas, `BIGINT` COP, RLS, `auth.users`; Backend: tablas españolas, `NUMERIC(15,2)`, sin RLS, sesiones opacas.
- Supabase: `orders.driver_id` y `driver_positions`; Backend: `envios`/`posiciones_actuales_envio`.
- Supabase: `order_status` de 9 valores; Backend: cuatro dimensiones de estado (`estado_orden`, `estado_pago`, `estado_comercio`, `estado_envio`).

## 9. Siguientes pasos

1. Cerrar el corte de auth usando solo `usuarios`, `sesiones_usuario` y `direcciones_usuario` (vía `ms-users`).
2. Formalizar el mapeo de roles y la conversión monetaria en `src/services/`.
3. Antes del corte de catálogo, mapear `empresas`/`productos` (ES) → `Store`/`Product` (front).
4. Antes del corte de pedidos, acordar el mapeo de estados y el reemplazo de `orderStore` por `ms-orders`.
5. Publicar OpenAPI 3.1 desde el backend; mientras tanto, `Arq-Infra/Repu.postman_collection.json` es la referencia ejecutable.
