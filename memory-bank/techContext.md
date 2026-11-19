# Technical Context

## Workspace and orchestration

- Root runtime floor is Node.js 20+ with pnpm 12.21.0 (`package.json:5-8`).
- Root `dev`, `build`, `start`, `lint`, `typecheck`, and `test` scripts delegate to Turborepo (`package.json:9-16`).
- Turbo caches build/test outputs, does not cache lint/typecheck, and treats dev as persistent (`turbo.json:3-24`).
- Workspace discovery includes `apps/*` and `packages/*`; approved native package builds are declared centrally (`pnpm-workspace.yaml:1-13`).

Root entry points are `pnpm dev`, `pnpm build`, `pnpm start`, `pnpm lint`, `pnpm typecheck`, and `pnpm test`; each delegates to the matching Turbo task (`package.json:9-16`). Use filtered commands from the app `AGENTS.md` links below for one application.

## Application stack and verification commands

| App | Stack evidenced by manifest | Available checks |
| --- | --- | --- |
| API (`saas_store_api`) | NestJS, TypeORM, PostgreSQL driver, Redis client, Stripe SDK, R2/S3 client (`apps/api/package.json:32-61`) | build, typecheck, lint, Jest unit/integration/e2e (`apps/api/package.json:8-30`) |
| Store Owner (`tenant_dash`) | React 19, Refine, Vite, Tailwind 4, Stripe, Vitest (`apps/store_owner_dashboard/package.json:20-46`; `apps/store_owner_dashboard/package.json:48-72`) | build, typecheck, lint, Vitest (`apps/store_owner_dashboard/package.json:66-73`) |
| Super Admin (`super_admin_dash`) | React 19, Refine, Vite, Tailwind 4 (`apps/super_admin_dashboard/package.json:34-69`; `apps/super_admin_dashboard/package.json:71-94`) | build, typecheck, lint; test task **unknown/not exposed** (`apps/super_admin_dashboard/package.json:89-94`) |
| Tenant Store (`tenant_store`) | Next.js 16, React 19, NextAuth 4, Tailwind 4, Stripe (`apps/tenant_store/package.json:12-43`) | build, start, lint, typecheck; test task **unknown/not exposed** (`apps/tenant_store/package.json:5-10`) |

Use app-specific command and pitfall sections instead of copying their rules: [API](../apps/api/AGENTS.md#commands), [Store Owner](../apps/store_owner_dashboard/AGENTS.md#commands), [Super Admin](../apps/super_admin_dashboard/AGENTS.md#commands), [Tenant Store](../apps/tenant_store/AGENTS.md#commands).

## Local ports and packaging

- Store Owner Vite dev/preview uses strict port 5174 (`apps/store_owner_dashboard/vite.config.ts:7-24`).
- Super Admin Vite dev/preview uses strict port 5173; production normally builds into the API static directory (`apps/super_admin_dashboard/vite.config.ts:58-80`).
- Tenant Store has Next.js `dev`, `build`, and `start` scripts; standalone output is conditional for container builds (`apps/tenant_store/package.json:5-10`; `apps/tenant_store/next.config.ts:22-34`).
- API port is configuration-driven rather than hard-coded in bootstrap (`apps/api/src/main.ts:21-23`; `apps/api/src/main.ts:61-64`).

## Data and infrastructure

- TypeORM is configured for PostgreSQL; root/public synchronization comes from validated DB configuration (`apps/api/src/common/config/data-source.factory.ts:20-53`). Tenant synchronization is further disabled in production unless explicitly enabled (`apps/api/src/modules/tenants/services/tenant-manager.service.ts:71-80`).
- A general TypeORM migration framework is **unknown** from inspected scripts. The API currently exposes feature-specific schema/reconciliation commands for durable Stripe webhooks (`apps/api/package.json:24-30`; `apps/api/test/migrate-stripe-webhook-events.ts:5-12`).
- Root `compose.yaml` is absent, so its intended setup is **unknown**. `apps/docker-compose.yml` defines Redis, replicated API containers, and an Nginx proxy, while PostgreSQL is expected on the Docker host (`apps/docker-compose.yml:1-18`; `apps/docker-compose.yml:20-48`).

## Environment files

- API configuration authority is `apps/api/.env.example` plus Joi validation; local execution needs a real `apps/api/.env` and external PostgreSQL/Redis (`apps/api/AGENTS.md:13-15`; `apps/api/AGENTS.md:498-527`).
- Both Refine dashboards document copying their app-local `.env.example` to `.env`; values are build-time inputs (`apps/store_owner_dashboard/AGENTS.md:202-207`; `apps/super_admin_dashboard/AGENTS.md:108-111`).
- Tenant Store documents NextAuth, backend, root-domain, tenant-mode, Stripe, and standalone-build variable names without making their values part of this bank (`apps/tenant_store/AGENTS.md:212-226`).
- A canonical root-level environment file or template is **unknown**.

## Docker and tooling notes

- The available Compose file is app-scoped, not the requested root `compose.yaml`; use of it as the canonical workflow is therefore **unknown** (`apps/docker-compose.yml:1-48`).
- Super Admin normally emits into `apps/api/static`; Tenant Store enables standalone output only for its container-oriented build flag (`apps/super_admin_dashboard/vite.config.ts:58-80`; `apps/tenant_store/next.config.ts:22-34`).
- The dashboards use strict TypeScript and flat ESLint configurations; API lint auto-fixes, while dashboard lint scripts do not pass `--fix` (`apps/api/AGENTS.md:537-546`; `apps/store_owner_dashboard/AGENTS.md:12-17`; `apps/store_owner_dashboard/AGENTS.md:209-216`; `apps/super_admin_dashboard/AGENTS.md:13-20`; `apps/super_admin_dashboard/AGENTS.md:137-150`).
- Super Admin and Tenant Store intentionally expose no test task; Store Owner has Vitest and the API has Jest (`apps/super_admin_dashboard/AGENTS.md:19-20`; `apps/tenant_store/AGENTS.md:18-18`; `apps/store_owner_dashboard/AGENTS.md:17-17`; `apps/api/AGENTS.md:20-22`).

## Configuration and security handling

Configuration is validated at API bootstrap and loaded through typed configuration groups (`apps/api/src/core.module.ts:44-50`; `apps/api/src/common/config/data-source.factory.ts:20-34`). This bank deliberately records no secret, token, credential, or `.env` value. Use [API Environment](../apps/api/AGENTS.md#environment) and each frontend's Environment section for variable names and setup constraints.
