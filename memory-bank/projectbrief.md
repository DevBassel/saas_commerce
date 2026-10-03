# Project Brief — saas_commerce

Foundation document for the Memory Bank. Read this first, then the other bank files.
Durable rules live in `AGENTS.md` files; this brief records *what the project is*.

## What it is

A multi-tenant SaaS commerce platform delivered as a single pnpm + Turborepo monorepo: one
NestJS API, two Refine/Vite admin consoles, and one Next.js customer storefront. Each tenant
gets an isolated PostgreSQL schema (`tenant_<slug>`) and can run its own storefront on a
subdomain.

## Applications

| Path | Package | Stack | Dev port | Auth scope |
| --- | --- | --- | --- | --- |
| `apps/api` | `saas_store_api` | NestJS 10, TypeORM 0.3, PostgreSQL 16 | 4000 | tenant + platform |
| `apps/store_owner_dashboard` | `tenant_dash` | Refine v5, Vite 6, React 19 | 5174 | tenant |
| `apps/super_admin_dashboard` | `super_admin_dash` | Refine v5, Vite 6, React 19 | 5173 | platform |
| `apps/tenant_store` | `tenant_store` | Next.js 16 App Router, React 19 | 3000 | tenant (customer) |

## Core features

- Schema-per-tenant isolation with header/subdomain resolution and a pooled per-schema
  DataSource manager (`apps/api/AGENTS.md` → Multi-tenancy).
- Stateless JWT auth with rotating refresh tokens, hierarchical RBAC, and direct user grants.
- Product catalog, categories, cart, orders, addresses, and coupons.
- Stripe payments with destination charges and Connect onboarding.
- Cloudflare R2 storage with per-tenant quotas.
- Super-admin tenant provisioning, lifecycle, payments oversight, and currency requests.

## Scope boundaries

- `packages/*` is a declared workspace glob but intentionally **empty** (only `.gitkeep`).
- No migrations system; tenant schemas are created from entity metadata (`DB_SYNCHRONIZE_TENANTS`).
- `super_admin_dash` and `tenant_store` intentionally have **no** test task — do not add one.
- `apps/api/docs/` does not exist; ignore references to it.

## Source of truth

- Cross-cutting contracts: `AGENTS.md` (root).
- Per-app rules and pitfalls: each app's `AGENTS.md`.
- Full detail: `project-description.md`, `RAILWAY.md`, `README.md`.
