# Repu — front-user

Aplicación web del cliente final de **Repu**, delivery de repuestos automotrices: descubrir tiendas en un mapa, comprar y seguir el pedido. Construida con Next.js (App Router), React, TypeScript, Zustand, Tailwind CSS y Mapbox GL JS. El backend son siete microservicios Spring Boot en `../Backend/`.

## Inicio rápido

Requisitos: Node.js 20.9+, pnpm (versión fijada en `packageManager`; no usar npm ni yarn) y Docker Compose para el backend.

```bash
cp .env.example .env.local   # completar valores; nunca commitear este archivo
pnpm install
pnpm dev                     # http://localhost:3000
```

| Variable | Uso |
|---|---|
| `NEXT_PUBLIC_MAPBOX_TOKEN` | Mapa |
| `AUTH_API_ORIGIN`, `USERS_API_ORIGIN`, `COMPANIES_API_ORIGIN`, `PRODUCTS_API_ORIGIN`, `CATEGORIES_API_ORIGIN` | Destino de los `rewrites` de desarrollo (solo servidor) |
| `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Ya sin uso; se retiran con el paquete de Supabase |

Comandos: `pnpm build`, `pnpm test`, `pnpm type-check`. Para levantar el backend, ver [BACKEND.md](docs/BACKEND.md) §6.

## Documentación

Cada tema tiene un único documento dueño. Si un tema se relaciona con otro, se enlaza en vez de repetirlo.

| Tema | Documento |
|---|---|
| Qué falta y en qué orden (estado del proyecto) | [ROADMAP.md](docs/ROADMAP.md) |
| Flujo del usuario, pantallas y estados del pedido | [APP_FLOW.md](docs/APP_FLOW.md) |
| Arquitectura del front, reglas por módulo y guardrails | [ARCHITECTURE.md](docs/ARCHITECTURE.md) |
| Flujos de datos entre UI, stores y servicios | [DATAFLOW.md](docs/DATAFLOW.md) |
| Ubicación de cada archivo | [FOLDER_STRUCTURE.md](docs/FOLDER_STRUCTURE.md) |
| Backend: topología, rutas, seguridad y gaps | [BACKEND.md](docs/BACKEND.md) |
| Sesión, cookie y autenticación | [AUTHENTICATION.md](docs/AUTHENTICATION.md) |
| Esquema `repu` y mapeo con los tipos del front | [DATA_MODEL.md](docs/DATA_MODEL.md) |
| Plan del corte de catálogo (activo) | [PLAN-CATALOGO.md](docs/PLAN-CATALOGO.md) |
| Pruebas y cobertura | [TESTING.md](docs/TESTING.md) |
| Decisión de backend vigente | [ADR-002](docs/ADR-002-BACKEND-MICROSERVICES.md) |
| Reglas para colaboradores y asistentes de IA | [AI_GUIDELINES.md](docs/AI_GUIDELINES.md) |
| Historial de cambios | [CHANGELOG.md](docs/CHANGELOG.md) |
| Histórico (no vigente) | [ADR-001](docs/ADR-001-BACKEND-SPRING.md), [legacy/](docs/legacy/) |

Fuentes de verdad del contrato: el código de `Backend/`, `Arq-Infra/Repo-DB-2.sql` y `Arq-Infra/Repu.postman_collection.json`.
