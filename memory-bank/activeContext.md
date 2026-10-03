# Active Context — saas_commerce

Current focus and recent changes. This file is **rewritten**, not appended, on every update.
Most dynamic file in the bank — keep it short and current.

## Current focus

Memory Bank setup for the repository. Wired into Kilo via the always-on rule in root `AGENTS.md`,
the `memory-bank/` files, and the `/memory-bank-init` and `/memory-bank-update` commands. No
application code was changed.

## Recent changes

- 2026-10-03 — Created `memory-bank/` (six core files), added the Memory Bank rule to root
  `AGENTS.md`, added `.kilo/command/memory-bank-init.md` and `.kilo/command/memory-bank-update.md`,
  added `.kilo/agent/memory-bank.md`, and un-ignored `.kilo/command` + `.kilo/agent` in root
  `.gitignore` so the wiring can be committed.

## Working tree state (check before relying on HEAD)

`git status` shows substantial uncommitted work that predates the Memory Bank change:

- API refactor in progress: tenant helpers consolidated under `apps/api/src/modules/tenants/utils/`
  (untracked) while `tenant-entities.ts`, `tenant-policy.ts`, `tenant-scope.ts`, `tenant.utils.ts`
  and their specs show as deleted; also deleted: `money.ts`, `slug.ts`, `product-image.util.ts`,
  `permission.utils.ts`, `rbac.seed.ts`, `products.serializer.ts`. New untracked: `coupons/` module,
  `common/pagination/`, `common/utils/`, several list-query DTOs.
- Frontend edits across both dashboards and the storefront, plus new coupon UI/pages and
  `apps/store_owner_dashboard/.kilo/`.

The bank describes the intended post-refactor state as documented in the `AGENTS.md` files. When in
doubt, verify against the working tree, not just HEAD.

## Active decisions

- Commands live in `.kilo/`; the durable rule lives in `AGENTS.md` (auto-loaded, no `kilo.json`
  needed).
- The bank summarizes and links to `AGENTS.md` rather than duplicating durable rules, to avoid drift.
- Bank files live at the repo root (`memory-bank/`), which is not gitignored.

## Known tooling issue

Kilo CLI 7.8.3 (`@kilocode/cli`, compiled engine) reports
`Failed to parse frontmatter: No context found for instance` for every `.kilo/command/*.md` and
`.kilo/agent/*.md`. A minimal file and a file with no frontmatter both trigger it, so it is a
CLI-side defect, not a file problem (evidence in `progress.md`). Commands may load without their
description metadata until the CLI is updated.

## Open questions

- Should the bank content be kept in sync automatically at task end, or only on explicit
  `/memory-bank-update`? Currently the rule asks for updates after behavior/state changes.
- Should `activeContext.md` drop the Memory Bank setup note once real feature work resumes?

## Next steps

- Run `/memory-bank-init` after the first substantive feature task to backfill evidence.
- Reconcile the bank with the working tree once the in-progress refactor is committed.
