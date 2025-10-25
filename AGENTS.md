# Repository Guidelines

## Project Structure & Module Organization
- Root orchestration: `package.json`, `scripts/`, `config/`.
- Frontend (React + Vite + Tailwind): `client/` — source in `client/src`, routes in `client/src/pages`, shared UI in `client/src/components/ui`.
- Backend (Node + Express + TypeScript): `server/` — entry `server/src/index.ts`, routes in `server/src/routes`, business logic in `server/src/services`.
- Database: `server/src/database` — migrations in `server/src/database/migrations`, seed script `server/src/database/seed.ts`.
- Environment examples: `env.example`, `client/env.example`, `server/env.example`.

## Build, Test, and Development Commands
- Install all: `npm run install:all` — installs root, client, server.
- Dev (API): `npm run dev:server` — backend with `tsx` watch.
- Dev (UI): `npm run dev:client` — Vite dev server.
- Build: `npm run build` — client + server builds.
- Run API: `npm run start` — starts compiled backend.
- Preview UI: `npm run start:client` — serves built frontend.
- Database: `npm run db:migrate` and `npm run db:seed` — run from root.
- Ops: `npm run deploy`, `npm run app:*` — see `scripts/` for usage.

## Coding Style & Naming Conventions
- Language: TypeScript for client and server.
- Indentation: 2 spaces; keep imports sorted and unused code removed.
- Linting: `cd client && npm run lint` (ESLint). Fix before committing.
- React components: `PascalCase` in `client/src/components`; hooks named `useX.ts(x)` in `client/src/hooks`.
- Server files: services `camelCase.ts` in `server/src/services`; route files under `server/src/routes`.

## Testing Guidelines
- Backend tests use Jest: `cd server && npm test`.
- Cover services and routes; prefer unit tests for services and lightweight integration tests for routes.
- Name tests `*.test.ts`; colocate near modules or use `__tests__/`.

## Commit & Pull Request Guidelines
- Follow conventional types: `feat:`, `fix:`, `chore:`, `perf:`, `refactor:` (see `git log`).
- Keep subjects concise (~72 chars) and scope per change.
- PRs include summary, linked issues, test steps, and screenshots for UI changes.
- Ensure `npm run build` passes; apply migrations for schema changes.

## Security & Configuration Tips
- Do not commit `.env`; copy from `env.example` files and configure per environment.
- Server includes Helmet and rate limiting; keep middleware intact.
- Validate inputs with `zod`; sanitize user-facing strings in the client.
