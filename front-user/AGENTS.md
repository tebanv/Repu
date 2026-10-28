# OpenCode Agent Context & Guidelines

Before analyzing, editing, or generating any code in this repository, you MUST index and follow the specifications inside `./docs/` and the project entry point `./README.md`:

- Backend decision: `./docs/ADR-002-BACKEND-MICROSERVICES.md` — the real backend is 7 Spring Boot microservices; Supabase is legacy.
- Historical decision: `./docs/ADR-001-BACKEND-SPRING.md` — kept for context, superseded in scope by ADR-002.
- Backend contract/topology: `./docs/BACKEND.md` — `ms-auth`, `ms-users`, `ms-orders`, etc.
- Auth migration (first cut): `./docs/AUTHENTICATION.md`, `./docs/PLAN-LOGIN-MS-AUTH.md`.
- Core Rules: `./docs/AI_GUIDELINES.md`.
- Architecture & Flow: `./docs/ARCHITECTURE.md`, `./docs/APP_FLOW.md`, `./docs/DATAFLOW.md`.
- Data & Folder Specs: `./docs/DATA_MODEL.md`, `./docs/FOLDER_STRUCTURE.md`.
- Guidelines & Auth: `./docs/PROJECT_GUIDE.md`, `./docs/AUTHENTICATION.md`.
- Planning & History: `./docs/ROADMAP.md`, `./docs/CHANGELOG.md`, `./docs/TESTING.md`.
- Documentation index: `./README.md`.

## Key invariants

- Use **only `pnpm`** (`pnpm dev`, `pnpm build`, `pnpm test`, `pnpm type-check`); never `npm` or `yarn`.
- Respect **Zero-Coupling**: UI and Zustand stores never import backend SDKs; all network access goes through `src/services/`.
- **`ms-auth` is the only session authority.** Web uses the `HttpOnly` cookie; never read or persist `accessToken` in `localStorage`/`sessionStorage`/URLs/logs.
- **Supabase is legacy.** Do not add new features on Supabase Auth, Realtime, Edge Functions, Storage, or schema changes. Auth already uses `ms-auth`; Supabase remains only for the catalog until its cut.
- Keep one source of truth per domain (cart, auth, stores, orders). Use reactive selectors/hooks, not duplicated local state.
- Backend contract comes from `Backend/` code + `Arq-Infra/Repo-DB-2.sql` + `Arq-Infra/Repu.postman_collection.json`; do not invent endpoints or schemas.
- Preserve the cut order: **auth → catalog → orders → tracking**, with no dual writes.
- Do not change visual design, styles, or colors without explicit approval.
- Update `docs/CHANGELOG.md` and the relevant docs (`AUTHENTICATION`, `BACKEND`, `ARCHITECTURE`, `ROADMAP`, `DATAFLOW`, etc.) for every relevant change.

Always maintain strict alignment with the patterns defined in these documents.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
