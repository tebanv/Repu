# OpenCode Agent Context & Guidelines

Before analyzing, editing, or generating any code in this repository, you MUST index and follow the specifications inside `./docs/` and the project entry point `./README.md`:

- Backend decision: `./docs/ADR-001-BACKEND-SPRING.md` — Supabase is a **frozen bridge**; Spring Boot/Docker is the final backend.
- Core Rules: `./docs/AI_GUIDELINES.md`
- Architecture & Flow: `./docs/ARCHITECTURE.md`, `./docs/APP_FLOW.md`, `./docs/DATAFLOW.md`
- Data & Folder Specs: `./docs/DATA_MODEL.md`, `./docs/FOLDER_STRUCTURE.md`
- Guidelines & Auth: `./docs/PROJECT_GUIDE.md`, `./docs/AUTHENTICATION.md`
- Planning & History: `./docs/ROADMAP.md`, `./docs/CHANGELOG.md`, `./docs/TESTING.md`
- Documentation index: `./README.md`

## Key invariants

- Use **only `pnpm`** (`pnpm dev`, `pnpm build`, `pnpm test`, `pnpm type-check`); never `npm` or `yarn`.
- Respect **Zero-Coupling**: UI and Zustand stores never import backend SDKs; all network access goes through `src/services/`.
- **Do not add new features on Supabase** (Auth, Realtime, Edge Functions, Storage) or schema changes that only exist there. See ADR-001.
- Keep one source of truth per domain (cart, auth, stores, orders). Use reactive selectors/hooks, not duplicated local state.
- Do not change visual design, styles, or colors without explicit approval.
- Update `docs/CHANGELOG.md` and the relevant docs (`ARCHITECTURE`, `ROADMAP`, `DATAFLOW`, etc.) for every relevant change.

Always maintain strict alignment with the patterns defined in these documents.
