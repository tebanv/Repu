# Backend real — mapa operativo y contratos

Este documento describe el backend que ya está en el repositorio (`Backend/`) y cómo se relaciona con `front-user`. Es la referencia operativa del [ADR-002](./ADR-002-BACKEND-MICROSERVICES.md); para el detalle de la migración de autenticación, ver [AUTHENTICATION.md](./AUTHENTICATION.md) y [PLAN-LOGIN-MS-AUTH.md](./PLAN-LOGIN-MS-AUTH.md).

> **Regla:** la fuente de verdad es el código de los microservicios + `Arq-Infra/Repo-DB-2.sql` + `Arq-Infra/Repu.postman_collection.json`. No hay OpenAPI publicado todavía; no se deben inventar endpoints ni campos.

## 1. Topología

```text
Navegador
   │  HTTPS (producción pendiente) / HTTP (dev)
   ▼
Traefik (:80)  ── same-origin ──►  front-user (Next.js, :3000)
   │
   ├── /ms-auth            → ms-auth (:8081 por defecto)       Autoridad de sesión
   ├── /ms-users           → ms-users (:8082 por defecto)      Perfil/direcciones
   ├── /ms-companies       → ms-companies                     Empresas/tiendas
   ├── /ms-products        → ms-products                      Catálogo
   ├── /ms-categories      → ms-categories                    Categorías
   ├── /ms-orders          → ms-orders                        Carrito/órdenes/SSE
   └── /ms-manage-payment  → ms-manage-payment                Pagos/webhooks
                                │
                                ├── PostgreSQL 16 + PostGIS (schema `repu`)
                                └── Redis 7 (caché de sesiones)
```

- `docker-compose-infra.yaml`: Traefik, PostgreSQL/PostGIS y Redis. Traefik solo expone HTTP en el puerto 80; **no hay TLS** en el compose actual.
- `docker-compose-apps.yaml`: front + los siete microservicios. Cada servicio se publica por `Host(${PUBLIC_HOST}) && PathPrefix(/<servicio>)`.
- Los puertos internos se configuran con `SERVER_PORT_MS_*`; la colección Postman usa `8081` para auth y `8082` para users como valores de referencia.
- La base de datos usa el esquema `repu` y el DDL de `Arq-Infra/Repo-DB-2.sql`. No es el esquema inglés de Supabase.

## 2. Servicios y responsabilidades

| Servicio | Base path | Responsabilidad | Autenticación |
|---|---|---|---|
| `ms-auth` | `/ms-auth` | Login, registro, logout, logout-all, sesiones, introspección, parámetros del sistema | Público solo login/register; el resto exige cookie/Bearer. `/api/auth/session` exige además `X-Auth-Service-Token` |
| `ms-users` | `/ms-users` | Perfil, direcciones, recuperación/reset de contraseña, activación/desactivación de usuarios | Cookie/Bearer; valida sesión en PostgreSQL |
| `ms-companies` | `/ms-companies` | Empresas/tiendas, cercanía, estado | Cookie/Bearer; introspección contra `ms-auth` |
| `ms-products` | `/ms-products` | Productos y disponibilidad | Cookie/Bearer; introspección contra `ms-auth` |
| `ms-categories` | `/ms-categories` | Categorías | Cookie/Bearer; introspección contra `ms-auth` |
| `ms-orders` | `/ms-orders` | Carrito, checkout, órdenes, tracking, SSE | Cookie/Bearer; introspección contra `ms-auth` |
| `ms-manage-payment` | `/ms-manage-payment` | Pagos, intentos, reembolsos, webhooks | Revisar contrato antes de integrar; no usa `AUTH_SERVICE_TOKEN` en el Compose actual |

## 3. Contrato de autenticación (`ms-auth`)

Base real: `/{APPLICATION_NAME_MS_AUTH}/api/auth/...`; con el valor esperado `ms-auth`, las rutas son `/ms-auth/api/auth/...`.

| Método | Ruta | Auth | Request | Response |
|---|---|---|---|---|
| `POST` | `/api/auth/login` | Pública | `{ email, password }` | `200 { authenticated, userId, role, activeCompanyId, accessToken, expiresInSeconds }` + `Set-Cookie`; cualquier error → `401 { message }` |
| `POST` | `/api/auth/register` | Pública | `{ firstName, lastName, email, password, phone, role, profileAttributes? }` (acepta alias `name`/`numberMobile`) | `201 { id, name, email, role, status, createdAt }`; `400` validación; `500` error interno |
| `POST` | `/api/auth/logout` | Sesión | — | `204` + cookie expirada; sin sesión → `401` y no limpia cookie |
| `POST` | `/api/auth/logout-all` | Sesión | — | `204`; revoca todas las sesiones del usuario |
| `GET` | `/api/auth/session` | Servicio + sesión | Cookie/Bearer + `X-Auth-Service-Token` | `200 { userId, role }`; `401` sesión inválida; `403/503` sin token de servicio |
| `GET` | `/api/auth/sessions` | Sesión | — | Lista de sesiones activas (`sessionId`, `deviceInfo`, `ipAddress`, `lastAccess`, `expiresAt`) |
| `GET` | `/api/system/parameters` | Sesión | — | Parámetros activos |
| `POST` | `/api/system/parameters` | Sesión | `{ key, configValue, description }` | `201` parámetro |
| `GET` | `/api/system/parameters/key/{key}` | Sesión | — | Parámetro o `404` |

Detalles del token:

- Token opaco de 128 caracteres hex; el servidor guarda solo su SHA-256 en `sesiones_usuario.token_sesion_hash` y cachea la referencia en Redis.
- TTL: **8 horas** para `ADMIN`/`ANALISTA`; **7 días** para el resto.
- Renovación deslizante en servidor cuando quedan menos de 30 minutos: extiende la expiración en PostgreSQL/Redis. **No hay endpoint de refresh** y la cookie del navegador no extiende su `Max-Age`.
- `activeCompanyId` existe en el contrato pero el login actual lo emite como `null`; se llenará cuando el usuario seleccione empresa activa.
- El `accessToken` del body es para clientes nativos/Postman. **El navegador no debe leerlo ni persistirlo.**

### 3.1 Cookie de sesión

| Entorno | Nombre | Atributos |
|---|---|---|
| Producción (HTTPS) | `__Host-repu_session` | `HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=<TTL>` |
| Desarrollo local HTTP | `repu_session_dev` | Sin prefijo `__Host-`; requiere `SESSION_COOKIE_SECURE=false` y `SESSION_COOKIE_ALLOW_INSECURE_HTTP=true`, perfil `local`/`dev` |

`SessionCookieSettings` impide arrancar con cookies inseguras fuera de `local`/`dev`, y prohíbe `__Host-` sin `Secure`. En producción, sin TLS, el navegador descarta la cookie `Secure` aunque el login devuelva `200`.

## 4. Contrato de perfil (`ms-users`)

| Método | Ruta | Auth | Response |
|---|---|---|---|
| `GET` | `/api/users/profile` | Cookie/Bearer | `{ id, email, role, firstName, lastName, phone, profileAttributes }`; `401` sin sesión |
| `PATCH` | `/api/users/profile` | Cookie/Bearer | Perfil actualizado; acepta `{ firstName, lastName, phone, profileAttributes }` |
| `GET` | `/api/users/addresses` | Cookie/Bearer | Lista de direcciones |
| `POST` | `/api/users/addresses` | Cookie/Bearer | `201` dirección; exige `name`, `fullAddress`, `city`, `location { latitude, longitude }` |
| `PATCH` | `/api/users/addresses/{addressId}` | Cookie/Bearer | Dirección actualizada |
| `DELETE` | `/api/users/addresses/{addressId}` | Cookie/Bearer | `204` (soft delete) |
| `POST` | `/api/users/password-recovery` | Pública | `202 { message }` genérico |
| `POST` | `/api/users/password-reset` | Pública | `204`; body `{ email, code, newPassword }` |
| `PATCH` | `/api/users/{userId}/status` | Cookie/Bearer + rol `ADMIN` | Usuario activado/desactivado |

`ms-users` valida la cookie/Bearer contra la tabla `sesiones_usuario` en PostgreSQL y aplica autorización por rol (`ADMIN` para cambiar estado). No llama a `ms-auth` para validar la sesión; es una excepción consciente frente a los demás microservicios.

## 5. Roles

El backend usa MAYÚSCULAS y cinco valores, alineados con el `CHECK` de `usuarios.rol_sistema`:

```text
COMPRADOR | DISTRIBUIDOR | DOMICILIARIO | ANALISTA | ADMIN
```

El front actual usa minúsculas y no tiene `analista`. El mapeo objetivo es `role.toLowerCase()` con `analista` añadido; un rol desconocido degrada a `comprador` con `console.warn` en desarrollo. El autorregistro de `ms-auth` solo permite `COMPRADOR`, `DISTRIBUIDOR` y `DOMICILIARIO`; `ADMIN`/`ANALISTA` se crean fuera del flujo público.

## 6. Variables de entorno relevantes

### Backend (Compose)

| Variable | Uso |
|---|---|
| `PUBLIC_HOST` | Host de Traefik (front + micros same-origin) |
| `APPLICATION_NAME_MS_*` | Base path de cada microservicio (`ms-auth`, `ms-users`, …) |
| `SERVER_PORT_MS_*` | Puerto interno de cada microservicio |
| `POSTGRES_URL`, `POSTGRES_PORT`, `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_SCHEMA` | PostgreSQL/PostGIS (`repu`) |
| `REDIS_URL`, `REDIS_PORT`, `REDIS_PASSWORD`, `REDIS_TIMEOUT` | Caché de sesiones (`ms-auth`) |
| `AUTH_SERVICE_TOKEN` | Secreto compartido para `X-Auth-Service-Token` entre micros y `ms-auth` |
| `SESSION_COOKIE_NAME`, `SESSION_COOKIE_SECURE`, `SESSION_COOKIE_ALLOW_INSECURE_HTTP` | Cookie de sesión |
| `CORS_ALLOWED_ORIGINS_MS_*` | Orígenes exactos por servicio (sin espacios; el `split` no hace `trim`) |
| `JWT_SECRET_MS_*` | Secreto de los servicios que aún declaran JWT; la sesión real es opaca |
| `MAIL_*` | Recuperación de contraseña (`ms-users`) |

### Front (propuestas para el corte de auth)

| Variable | Uso |
|---|---|
| `AUTH_API_ORIGIN` | Destino de `rewrites` dev hacia `ms-auth` (solo servidor) |
| `USERS_API_ORIGIN` | Destino de `rewrites` dev hacia `ms-users` (solo servidor) |
| `NEXT_PUBLIC_MAPBOX_TOKEN` | Mapa (se conserva) |
| `NEXT_PUBLIC_SUPABASE_*` | **Legado transitorio** solo para catálogo hasta su corte |

`AUTH_API_ORIGIN`/`USERS_API_ORIGIN` ya están en `.env.example`; en producción se ignoran porque Traefik sirve las rutas same-origin.

## 7. Ejecución con Docker Compose

```bash
# Infraestructura: Traefik, PostgreSQL/PostGIS, Redis
docker compose -f docker-compose-infra.yaml up -d --build

# Aplicaciones: front + microservicios
docker compose -f docker-compose-apps.yaml up -d --build

# Estado
docker ps
docker logs -f repu_ms_auth
```

> **Verificación 2026-10-28:** el stack de auth (`ms-auth` + `ms-users`) se levantó con los servicios de Docker Compose y se validó registro, login OK/KO, perfil, logout y `401` posterior. El smoke en el servidor desplegado sigue pendiente.

Para desarrollo del front con `pnpm dev`, el navegador debe hablar con el mismo host que Traefik o usar los `rewrites` de Next.js; una cookie `__Host-`/`SameSite=Lax` no viaja de `localhost` a una IP distinta.

La colección `Arq-Infra/Repu.postman_collection.json` contiene login, registro, perfil, direcciones, parámetros, empresas, categorías, productos, carrito, órdenes y tracking. Es el smoke test más rápido antes de tocar el front.

## 8. Estado de integración del front

| Dominio | Backend | Front hoy | Estado |
|---|---|---|---|
| Auth | `ms-auth` + `ms-users` | Migrado (`httpClient` + `authService`) | **Verificado en entorno de pruebas; servidor pendiente** |
| Perfil/direcciones | `ms-users` | No implementado | Pendiente |
| Catálogo | `ms-products`/`ms-categories`/`ms-companies` | Supabase (`api.ts`) | Pendiente; lectura anónima temporal |
| Carrito | `ms-orders` | `cartStore` local con `persist` | Pendiente; el carrito local sigue siendo UX |
| Pedidos | `ms-orders` | `orderStore` mock | Pendiente; el contrato de estados difiere |
| Tracking | `ms-orders` (SSE) | Simulación local | Pendiente |
| Pagos | `ms-manage-payment` | Wompi simulado | Pendiente |

## 9. Gaps y riesgos abiertos

1. **TLS en producción:** bloqueante para la cookie `Secure`. El compose de Traefik solo tiene el entrypoint `web` HTTP.
2. **OpenAPI ausente:** el contrato se deduce del código/Postman; hay que publicarlo antes de que otros equipos consuman.
3. **Esquema en español vs tipos del front:** `usuarios`, `sesiones_usuario`, `ordenes`, `detalles_orden`, `direcciones_usuario`. Los adaptadores deben vivir solo en `src/services/`.
4. **Estados de orden divergentes:** el backend usa `estado_orden`, `estado_pago`, `estado_comercio`, `estado_envio`; el front usa un único `OrderStatus`. El mapeo es un requisito del corte de pedidos.
5. **Dinero:** el backend usa `NUMERIC(15,2)`; el front usa enteros COP (`Math.round`). El adaptador debe definir la conversión y el redondeo.
6. **Login 401 genérico:** no distingue credenciales, usuario inactivo ni caída de Redis/DB; el front debe mapear por status.
7. **Sin refresh:** solo renovación deslizante en servidor; el 401 debe limpiar la sesión del cliente.
8. **`accessToken` en el body:** el web debe ignorarlo; pedir al backend que lo omita para clientes web si se quiere reducir superficie.
9. **Rate limit/lockout:** no documentado en login.
10. **`ms-users` valida en DB, no vía `ms-auth`:** vigilar desincronización Redis/DB tras logout.
11. **`ms-manage-payment`:** su autenticación no está cubierta por `AUTH_SERVICE_TOKEN` en el Compose actual; revisar antes de integrar.
12. **Usuarios seed:** no hay seed de usuarios en `Repo-DB-2.sql`; los chips demo del `LoginForm` apuntan a Supabase y deben reemplazarse por usuarios reales de la BD Spring.
13. **Postman con rutas inconsistentes:** la colección usa `GET /ms-companies/companies` en un punto y `POST /ms-companies/api/companies` en otro; validar siempre contra el `RouterRest` del microservicio antes de codificar.
14. **Parámetros del sistema:** `ms-auth` los protege con sesión, pero no con rol `ADMIN`; revisar autorización antes de producción.

## 10. Referencias

- Decisión y alcance: [ADR-002](./ADR-002-BACKEND-MICROSERVICES.md)
- Autenticación y migración: [AUTHENTICATION.md](./AUTHENTICATION.md), [PLAN-LOGIN-MS-AUTH.md](./PLAN-LOGIN-MS-AUTH.md)
- Modelo de datos real: [DATA_MODEL.md](./DATA_MODEL.md)
- DDL: `Arq-Infra/Repo-DB-2.sql`
- Guía de sesiones backend: `Arq-Infra/Guia-Integracion-Sesiones-Ms-Auth.md`
- Postman: `Arq-Infra/Repu.postman_collection.json`
- Comandos Docker: `Arq-Infra/Comandos_Docker.md`
