# Backend real: mapa operativo y contratos

Backend que vive en `../Backend/` y cómo lo consume el front. Las rutas y reglas de seguridad de este documento se verificaron contra el código el 2026-11-04, incluidos los commits integrados desde `main`.

- **Fuente de verdad:** código de los microservicios, `Arq-Infra/Repo-DB-2.sql` y `Arq-Infra/Repu.postman_collection.json`. No hay OpenAPI publicado; no inventar endpoints ni campos.
- **Por qué esta arquitectura:** [ADR-002](./ADR-002-BACKEND-MICROSERVICES.md).
- **Sesión y cookie:** [AUTHENTICATION.md](./AUTHENTICATION.md).
- **Tablas:** [DATA_MODEL.md](./DATA_MODEL.md).
- **Estado de integración:** [ROADMAP.md](./ROADMAP.md) §1.

## 1. Topología

```text
Navegador ──► Traefik (:80, solo HTTP) ── mismo host ──► front-user (:3000)
                 ├── /ms-auth            → ms-auth
                 ├── /ms-users           → ms-users
                 ├── /ms-companies       → ms-companies
                 ├── /ms-products        → ms-products
                 ├── /ms-categories      → ms-categories
                 ├── /ms-orders          → ms-orders
                 └── /ms-manage-payment  → ms-manage-payment
                          │
                          ├── PostgreSQL 16 + PostGIS (schema `repu`)
                          └── Redis 7 (caché de sesiones)
```

Cada ruta real es `/{APPLICATION_NAME_MS_*}` + la ruta del router. Con los valores esperados, por ejemplo, `/ms-auth/api/auth/login`.

## 2. Validación de sesión por servicio

| Servicio | Cómo valida |
|---|---|
| `ms-auth` | Es la autoridad: Redis y PostgreSQL |
| `ms-users` | Directo contra `sesiones_usuario` en PostgreSQL; no llama a `ms-auth` |
| `ms-companies`, `ms-products`, `ms-categories`, `ms-orders` | Introspección contra `ms-auth` con `X-Auth-Service-Token` |
| `ms-manage-payment` | No se encontró validación de sesión en su código (ver §7) |

## 3. Rutas

Las rutas de `ms-auth` y de sesión se detallan en [AUTHENTICATION.md](./AUTHENTICATION.md) §3.

### `ms-users`

| Método | Ruta | Acceso |
|---|---|---|
| `GET`, `PATCH` | `/api/users/profile` | Sesión |
| `GET`, `POST` | `/api/users/addresses` | Sesión. `POST` exige `name`, `fullAddress`, `city`, `location { latitude, longitude }` |
| `PATCH`, `DELETE` | `/api/users/addresses/{addressId}` | Sesión; `DELETE` es soft delete |
| `POST` | `/api/users/password-recovery`, `/api/users/password-reset` | Público |
| `PATCH` | `/api/users/{userId}/status` | Sesión + `ADMIN` |

### Catálogo

| Servicio | Método | Ruta | Acceso |
|---|---|---|---|
| `ms-companies` | `GET` | `/api/companies?lat&lng&radiusKm` | **Público**. `radiusKm` es entero en km y exige `lat` y `lng` |
| `ms-companies` | `GET` | `/api/companies/{slug}` | **Público**. Consulta la tienda por slug; hoy no filtra `activo` |
| `ms-companies` | `POST` | `/api/companies` | `ADMIN`, `DISTRIBUIDOR` |
| `ms-companies` | `PATCH` | `/api/companies/{companyId}`, `/status` | Sesión; `/status` exige `ADMIN` o `DISTRIBUIDOR` |
| `ms-products` | `GET` | `/api/catalog/products?companyId&categoryId&attributes` | **Público** |
| `ms-products` | `POST`, `PATCH` | `/api/catalog/products`, `/{productId}`, `/{productId}/status` | Por rol (ver §7) |
| `ms-categories` | `GET` | `/api/catalog/categories` | **Público** |
| `ms-categories` | `POST`, `PATCH` | `/api/catalog/categories`, `/{categoryId}`, `/{categoryId}/status` | `ADMIN`, `ANALISTA` |

### `ms-orders`

Todas exigen sesión, salvo el health check. Los prefijos son inconsistentes: copiar las rutas tal como están.

| Método | Ruta |
|---|---|
| `GET` | `/cart` |
| `POST` | `/cart/items` |
| `DELETE` | `/cart/items/{itemId}` |
| `GET` | `/orders/active` |
| `GET` | `/api/orders` |
| `POST` | `/api/orders/checkout` |
| `GET` | `/api/orders/{orderId}` |
| `POST` | `/api/orders/{orderId}/cancel` |
| `GET` | `/api/orders/{orderId}/live-stream` (SSE) |
| `GET` | `/tracking/order/{orderId}` |
| `POST` | `/api/companies/{companyId}/orders/{orderId}/accept` |
| `POST` | `/companies/{companyId}/orders/{orderId}/reject`, `/ready` |

### `ms-manage-payment`

| Método | Ruta |
|---|---|
| `GET` | `/payments/id/{id}`, `/payments/reference/{reference}`, `/payments/status/{status}` |
| `PUT` | `/payments/{id}/status/{status}` |
| `POST` | `/wompi/tokenize`, `/wompi/payments`, `/wompi/checkout/prepare`, `/wompi/webhook` |
| `GET` | `/wompi/payments/{wompiId}` |

## 4. Roles

`COMPRADOR | DISTRIBUIDOR | DOMICILIARIO | ANALISTA | ADMIN`, según el `CHECK` de `usuarios.rol_sistema`. El autorregistro solo admite los tres primeros. El mapeo al front está en [AUTHENTICATION.md](./AUTHENTICATION.md) §5.

## 5. Variables de entorno (Compose)

| Variable | Uso |
|---|---|
| `PUBLIC_HOST` | Host de Traefik |
| `APPLICATION_NAME_MS_*`, `SERVER_PORT_MS_*` | Base path y puerto de cada servicio |
| `POSTGRES_*` | PostgreSQL/PostGIS |
| `REDIS_*` | Caché de sesiones |
| `AUTH_SERVICE_TOKEN` | Secreto de `X-Auth-Service-Token`; nunca llega al navegador |
| `SESSION_COOKIE_NAME`, `SESSION_COOKIE_SECURE`, `SESSION_COOKIE_ALLOW_INSECURE_HTTP` | Cookie de sesión |
| `CORS_ALLOWED_ORIGINS_MS_*` | Orígenes exactos, sin espacios (el `split` no hace `trim`) |
| `MAIL_*` | Recuperación de contraseña |

Las variables del front están en el [README](../README.md).

## 6. Ejecución

Desde la raíz del repositorio:

```bash
docker compose -f docker-compose-infra.yaml up -d --build
docker compose -f docker-compose-apps.yaml up -d --build
docker logs -f repu_ms_auth
```

Más comandos en `Arq-Infra/Comandos_Docker.md`. Con `pnpm dev`, el navegador usa los `rewrites` de Next (hoy solo `/ms-auth` y `/ms-users`).

## 7. Gaps y pedidos al backend

**Bloquean el corte de catálogo**

> Verificado contra `origin/main` el 2026-11-04. Lo marcado como resuelto ya está en el código; lo pendiente sigue bloqueando el corte.

1. **`ms-companies` — tienda por slug: resuelto (2026-11-04).** `GET /api/companies/{slug}` es público (`RouterRest` + `permitAll`). No se pide ruta por id: el checkout usará el slug del carrito. Tampoco por id de producto: `fetchProductById` no tiene consumidores.
   - **Una categoría por tienda:** `id_categoria` admite un solo valor, así que una tienda que vende baterías y llantas solo aparece en un filtro del mapa.
   - **Categorías por tienda: parcial.** `empresas.id_categoria` y `CompanyResponse.categoryId` ya existen, pero solo devuelven un UUID: no hay nombre ni lista. Falta definir el mapeo a `Store.categories` (`battery|tire|spare|shop`) y resolver el nombre contra `ms-categories`.
   - **Filtro `activo`: pendiente.** `findNearest` y `findAll` siguen sin filtrar empresas activas; `findBySlug` tampoco.
1b. **`ms-products` — SKU y marca: resuelto (2026-11-04).** `sku` pasó a `String`, se eliminó el `Integer.valueOf` y `productos.marca` se expone como `brand`.
   - **Filtro `activo`: pendiente.** `searchProducts` sigue sin filtrar productos activos.
1c. **Datos: parcial.** `Repo-DB-2.sql` no trae seed. En el servidor hay 7 empresas de prueba, casi todas de comida, y una de baterías (`baterias-la-42-…`) con productos. Falta un catálogo de autopartes representativo con categorías cuyos nombres incluyan `bateria`, `llanta`, `repuesto` o `taller` ([PLAN-CATALOGO.md](./PLAN-CATALOGO.md) §3).
   - Confirmado en el servidor (2026-11-04): el listado devuelve empresas inactivas.

**Seguridad**
2. **TLS:** Traefik solo expone el entrypoint `web` (HTTP). Bloquea la cookie `Secure` en producción.
3. **`ms-manage-payment`:** no tiene `SecurityWebFilterChain` ni filtro de sesión, y el Compose no le pasa `AUTH_SERVICE_TOKEN`. Hay que revisarlo antes de integrarlo; incluye la ruta `PUT /payments/{id}/status/{status}`.
3a. **`ms-products`, escritura:** `SecurityConfig` permite `COMPRADOR` en `POST /api/catalog/products`, `PATCH /api/catalog/products/{productId}` y `PATCH /api/catalog/products/{productId}/status`. El handler y el caso de uso no verifican que el producto, o el `companyId` del body, pertenezcan a la empresa del usuario: cualquier comprador puede crear productos activos para cualquier tienda, editar los de otra tienda y activar o desactivar productos ajenos. Al pasar de `BUYER` a `COMPRADOR` se conservó el permiso, cuando debía retirarse; `BUYER` no existía en `rol_sistema`, así que antes el permiso estaba muerto.
3b. **`ms-companies`:** la respuesta pública de `GET /api/companies` y `GET /api/companies/{slug}` incluye `taxId` y `ownerUserId`.
3c. **`ms-companies`, edición de datos:** `PATCH /api/companies/{companyId}` solo exige `authenticated()` y `updateCompanyDetails` no recibe ni valida al actor; cualquier usuario autenticado puede editar los datos de cualquier empresa. `PATCH /api/companies/{companyId}/status` sí valida propietario o `ADMIN`, así que ese caso está cubierto.
4. **Parámetros del sistema:** en `ms-auth` basta con tener sesión; no exigen `ADMIN`.
5. **Login:** sin rate limit ni lockout documentados.

**Consistencia**
6. **Roles en `ms-products`: nombres alineados (2026-11-04), pero el permiso de escritura para `COMPRADOR` sigue abierto (ver 3a).** `SecurityConfig` ya usa `DISTRIBUIDOR` y `COMPRADOR`, alineado con `rol_sistema`.
7. **Postman y `ms-orders`:** la colección usa `/ms-orders/api/companies/.../orders/...`, pero `reject` y `ready` están sin `/api` en el router. Verificar antes de usarlas.
8. **Postman y `ms-companies`:** la colección usa `GET /ms-companies/companies?...`; el router define `/api/companies`.
9. **`ms-users` valida en BD y el resto vía `ms-auth`:** vigilar desincronización entre Redis y PostgreSQL.

**Contrato y datos**
9b. `operationalConfig` es un `Object` sin validar y no define costo de envío; `empresas` no tiene ciudad.
10. Publicar OpenAPI.
11. No hay seed de usuarios en `Repo-DB-2.sql`. Se necesitan usuarios de prueba, incluidos un `ANALISTA` y uno inactivo.
12. Distinguir códigos en login: `400` body inválido, `401` credenciales o usuario inactivo (mismo mensaje), `5xx` infraestructura. Hoy todo responde `401`.
13. Omitir `accessToken` del body para clientes web.
14. Limpiar la cookie cuando se rechaza una sesión inválida, también en `logout`.
15. Refresh de sesión, o extender el `Max-Age` de la cookie, y revocar sesiones al cambiar la contraseña.
