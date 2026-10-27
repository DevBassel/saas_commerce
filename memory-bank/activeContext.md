# Active Context — saas_commerce

Current focus and recent changes. Rewritten on each update.

## Current focus

**Test file reorganization completed.** All API unit test files have been moved from their original locations into `specs/` subdirectories under each module (e.g., `src/common/cache/specs/`, `src/modules/products/specs/`). This is a structural cleanup with no behavioral changes. The API test suite passes (1,357 unit tests + 65 integration tests), typecheck passes, and the build succeeds. A small number of lint errors (14) exist in the reorganized test files — these are pre-existing code style issues, not regressions.

The storefront (`tenant_store`) production build now passes with Turbopack (previously hit worker OOM/IPC failures). All 17 pages generate successfully.

Earlier filter/refactor plans remain `Approved` with their live/manual checks open:
`plans/tenant-store-product-filters-refactor.md`,
`plans/tenant-store-filter-chips-above-results.md`,
`plans/tenant-store-filter-sidebar-controls.md`, and
`plans/tenant-store-product-filters.md`. Current contracts: `apps/tenant_store/AGENTS.md` → API client and data fetching.

## Recent changes

- 2026-10-26 — **API README rewritten and verified** (uncommitted):
  - `apps/api/README.md` completely rewritten with 903 lines covering all required sections: architecture, modules, REST conventions, auth/authorization, multi-tenancy, database, caching, integrations, configuration, local development, testing, security, limitations, and source index.
  - All 22 controller files and routes verified against current source.
  - Environment variables documented from Joi schema with production rules.
  - Docker compose path corrected to `apps/docker-compose.yml`.
  - Manual verification script `pnpm --dir apps/api exec ts-node -r tsconfig-paths/register test/verify-tenant-provision.ts` executed successfully (tenant provisioning pass).
  - All 28 local Markdown links resolve; Prettier formatting passes.

- 2026-10-26 — Test file reorganization (uncommitted):
  - All API spec files moved from co-located `*.spec.ts` next to source into `specs/` directories mirroring the module structure (e.g., `src/common/cache/specs/`, `src/modules/products/specs/`).
  - Integration tests live under `specs/integration/` in each area.
  - Jest config unchanged (`rootDir: src`, `testRegex: .*\\.spec\\.ts$`) — the new paths are still discovered.
  - API unit tests: 104 suites, 1,357 tests pass. Integration tests: 4 suites, 65 tests pass (1 skipped). Typecheck and build pass.
  - Lint reports 14 errors in the moved test files (unused vars, unsafe `any` assignments) — pre-existing, not new.

- 2026-10-25 — Cache module simplification and reliability fixes (committed in 11d9511):
  - Removed unused `CacheEntry.expiresAt`/`namespace`, `CacheStore.delete`, and policy `name` data.
  - Replaced the duplicate namespace-to-flight index with a scan of the bounded in-flight map, preventing an older request's cleanup from untracking a newer replacement request.
  - Redis health checks now wait for `ready` with connection-error and timeout handling before issuing `PING`; the live Redis fixture uses the same readiness boundary and always closes.
  - API lint/typecheck and seven focused suites passed (130 tests, including live Redis).

- 2026-10-25 — All-screen floating filter Sheet (uncommitted):
  - `ProductFilters` now renders only the shared left Sheet and a fixed lower-left trigger at every breakpoint; the duplicate desktop Card form was removed.
  - `/products` no longer reserves an 18rem desktop sidebar column, so tags and product results use the full content width. The category failure alert remains in normal flow without an empty trigger row.
  - `pnpm --filter tenant_store lint` and `typecheck` passed. The normal Turbopack build and a 4 GB retry failed with the known worker `Zone Allocation` OOM/IPC panic; the webpack fallback build compiled, typechecked, and generated all 17 pages successfully.

- 2026-10-25 — ProductFilters refactor (uncommitted):
  - Parent was reduced from 646 to 208 lines. Nine modules under `apps/tenant_store/src/components/products/filters/` contain five controlled fields, `FilterFields`, `FilterActions`, shared types, and pure utilities.
  - Public props/import and parent state/navigation were retained. Pure-helper, React/Base UI SSR, callback, lint, typecheck, and a prior standard production build passed; see `progress.md`.

- 2026-10-25 — Filter tags above results (uncommitted): `ActiveFilterChips.tsx` and `filter-navigation.tsx` split tags from controls while preserving pending and tenant navigation.

- 2026-10-25 — Sidebar, dual-handle slider, and stock switch (uncommitted): bounded full-catalog price lookup, `createdAt` parser correction, and tenant-aware no-match recovery link. The sidebar shell from that change has now been replaced by the all-screen Sheet.

- 2026-10-24 — Full-catalog storefront filtering/public category options (uncommitted): API Jest, API typecheck/build, and storefront lint/typecheck/build passed at that stage.

- 2026-10-24 — Product filtering and versioned (`v3:`) cache fingerprints (uncommitted).

- 2026-10-19 — Docker reduced to API-only Compose; embedded `/platform` served by the API.

## Decisions taken

- Keep Redis command behavior fail-open and command-timeout bounded; only the health readiness wait uses the longer Redis connect timeout.
- Keep in-flight invalidation simple by scanning the configured `CACHE_MAX_INFLIGHT`-bounded map; do not maintain a second mutable namespace index.
- Keep the extracted controlled fields and existing draft/errors/sheet state architecture.
- Use the same left Sheet on every viewport and keep its trigger fixed at the lower-left; do not reintroduce a desktop-only filter form or results sidebar column.
- Keep applied tags above results and outside the Sheet. Preserve shared pending and tenant-aware navigation behavior.
- Test file reorganization into `specs/` directories is the new convention; future tests should follow this pattern.

## Working tree state

Git inspection confirms accumulated uncommitted work:
- API: test file reorganization into `specs/` (deleted old paths, added new `specs/` trees), plus `apps/api/package.json` (no functional change).
- Storefront filtering/UI work (ProductFilters refactor, all-screen Sheet, tags above results, sidebar/slider/switch) — all uncommitted.
- Dashboards and storefront have no other uncommitted changes.
- Recheck actual Git state before committing.

## Known tooling issues

- API lint reports 14 errors in the reorganized test files (unused imports, unsafe `any`). These are pre-existing and did not block typecheck/build/test.
- Storefront Turbopack worker OOM has occurred repeatedly. For the all-screen Sheet change, both the normal build and a 4 GB heap retry failed in worker processes; `next build --webpack` passed. **However, the current Turbopack build now passes** (31s compile, 5.7s TypeScript, 17 pages generated).
- Browser tools and local Playwright/Puppeteer packages were unavailable in the earlier filter work. Automated checks do not verify visual placement, hydration, focus, or real transition timing.
- Earlier environment issues: WSL nginx shadows port 80; pnpm can have allocator failures; API lint/Jest can OOM; mixed line endings can trip API Prettier. Details in `progress.md`.

## Next steps

- Check the floating trigger and left Sheet in a browser at desktop/mobile widths, including no obscured controls, focus/dismissal, real pending timing, Back/Forward, and subdomain/apex tenant navigation.
- Complete the earlier plans' slider/keyboard/accessibility, live category ordering/full-catalog price-ceiling, and credential-inspection matrix; probes used mocked backend responses.
- Decide whether to commit accumulated uncommitted work (test reorganization + storefront filtering/UI).
- Fix the 14 API lint errors in the reorganized test files (or suppress if intentional).