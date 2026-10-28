# Repu

Plataforma de delivery de repuestos automotrices (baterías, llantas y autopartes): el comprador descubre tiendas cercanas, compra y sigue su pedido; las tiendas y domiciliarios tendrán sus propios frentes.

## Estructura del repositorio

| Ruta | Contenido |
|---|---|
| `front-user/` | Aplicación web del cliente final (Next.js + React + TypeScript + Zustand + Mapbox) |
| `Backend/` | Backend real: 7 microservicios Spring Boot WebFlux |
| `Arq-Infra/` | Infraestructura y contratos: DDL PostgreSQL/PostGIS, Postman, guía de sesiones |
| `docker-compose-infra.yaml` | Traefik + PostgreSQL/PostGIS + Redis |
| `docker-compose-apps.yaml` | Frontend + microservicios |
| `Postman/` | Colección adicional de Postman |

## Backend real

- `ms-auth` — autoridad de sesión (token opaco, cookie `HttpOnly`)
- `ms-users` — perfil, direcciones y recuperación de contraseña
- `ms-companies` / `ms-products` / `ms-categories` — catálogo
- `ms-orders` — carrito, checkout, pedidos, tracking/SSE
- `ms-manage-payment` — pagos

La decisión vigente está en [`front-user/docs/ADR-002-BACKEND-MICROSERVICES.md`](front-user/docs/ADR-002-BACKEND-MICROSERVICES.md) y el mapa operativo en [`front-user/docs/BACKEND.md`](front-user/docs/BACKEND.md). El plan de auth (primer corte) está en [`front-user/docs/PLAN-LOGIN-MS-AUTH.md`](front-user/docs/PLAN-LOGIN-MS-AUTH.md).

## Documentación del frontend

El índice principal es [`front-user/README.md`](front-user/README.md).

Supabase se conserva únicamente como legado transitorio del catálogo hasta su corte; auth ya usa `ms-auth`/`ms-users`. No se añaden funcionalidades nuevas sobre Supabase.
