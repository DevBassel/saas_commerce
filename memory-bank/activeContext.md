# Active Context — saas_commerce

Current focus and recent changes. Rewritten on each update.

## Current focus

**The Redis cache module cleanup is complete and verified.** Dead store metadata/operations and a
redundant policy field were removed; local invalidation now scans the bounded in-flight map instead
of maintaining a second index that could lose a replacement flight; and health `PING` waits for the
ioredis client to become ready within `CACHE_REDIS_CONNECT_TIMEOUT_MS`. Cache keys, route allowlist,
TTLs, fail-open behavior, public services/decorators, Lua invalidation, and shutdown cleanup are
unchanged. API lint/typecheck, 130 focused tests, and four live-Redis integration cases pass.

The uncommitted storefront product-filter work remains as previously recorded. Live browser layout,
focus, keyboard, and tenant-mode checks are still open.

Earlier filter/refactor plans remain `Approved` with their live/manual checks open:
`plans/tenant-store-product-filters-refactor.md`,
`plans/tenant-store-filter-chips-above-results.md`,
`plans/tenant-store-filter-sidebar-controls.md`, and
`plans/tenant-store-product-filters.md`. Current contracts: `apps/tenant_store/AGENTS.md` → API
client and data fetching.

## Recent changes

- 2026-10-25 — Cache module simplification and reliability fixes (uncommitted):
  - Removed unused `CacheEntry.expiresAt`/`namespace`, `CacheStore.delete`, and policy `name` data.
  - Replaced the duplicate namespace-to-flight index with a scan of the bounded in-flight map,
    preventing an older request's cleanup from untracking a newer replacement request.
  - Redis health checks now wait for `ready` with connection-error and timeout handling before
    issuing `PING`; the live Redis fixture uses the same readiness boundary and always closes.
  - API lint/typecheck and seven focused suites passed (130 tests, including live Redis).
- 2026-10-25 — All-screen floating filter Sheet (uncommitted):
  - `ProductFilters` now renders only the shared left Sheet and a fixed lower-left trigger at every
    breakpoint; the duplicate desktop Card form was removed.
  - `/products` no longer reserves an 18rem desktop sidebar column, so tags and product results use
    the full content width. The category failure alert remains in normal flow without an empty
    trigger row.
  - `pnpm --filter tenant_store lint` and `typecheck` passed. The normal Turbopack build and a 4 GB
    retry failed with the known worker `Zone Allocation` OOM/IPC panic; the webpack fallback build
    compiled, typechecked, and generated all 17 pages successfully.
- 2026-10-25 — ProductFilters refactor (uncommitted):
  - Parent was reduced from 646 to 208 lines. Nine modules under
    `apps/tenant_store/src/components/products/filters/` contain five controlled fields,
    `FilterFields`, `FilterActions`, shared types, and pure utilities.
  - Public props/import and parent state/navigation were retained. Pure-helper, React/Base UI SSR,
    callback, lint, typecheck, and a prior standard production build passed; see `progress.md`.
- 2026-10-25 — Filter tags above results (uncommitted): `ActiveFilterChips.tsx` and
  `filter-navigation.tsx` split tags from controls while preserving pending and tenant navigation.
- 2026-10-25 — Sidebar, dual-handle slider, and stock switch (uncommitted): bounded full-catalog
  price lookup, `createdAt` parser correction, and tenant-aware no-match recovery link. The sidebar
  shell from that change has now been replaced by the all-screen Sheet.
- 2026-10-24 — Full-catalog storefront filtering/public category options (uncommitted): API Jest,
  API typecheck/build, and storefront lint/typecheck/build passed at that stage.
- 2026-10-24 — Product filtering and versioned (`v3:`) cache fingerprints (uncommitted).
- 2026-10-19 — Docker reduced to API-only Compose; embedded `/platform` served by the API.

## Decisions taken

- Keep Redis command behavior fail-open and command-timeout bounded; only the health readiness wait
  uses the longer Redis connect timeout.
- Keep in-flight invalidation simple by scanning the configured `CACHE_MAX_INFLIGHT`-bounded map;
  do not maintain a second mutable namespace index.
- Keep the extracted controlled fields and existing draft/errors/sheet state architecture.
- Use the same left Sheet on every viewport and keep its trigger fixed at the lower-left; do not
  reintroduce a desktop-only filter form or results sidebar column.
- Keep applied tags above results and outside the Sheet. Preserve shared pending and tenant-aware
  navigation behavior.

## Working tree state

Git inspection confirmed accumulated uncommitted API filtering/cache, storefront filtering,
dashboard, and OpenCode planning work. Cache cleanup changed files inside
`apps/api/src/common/cache/` plus cache test doubles in the untracked products controller spec; it
did not revert or commit any pre-existing work. Recheck actual Git state before committing.

## Known tooling issues

- Storefront Turbopack worker OOM has occurred repeatedly. For the all-screen Sheet change, both the
  normal build and a 4 GB heap retry failed in worker processes; `next build --webpack` passed.
- Browser tools and local Playwright/Puppeteer packages were unavailable in the earlier filter work.
  Automated checks do not verify visual placement, hydration, focus, or real transition timing.
- Earlier environment issues: WSL nginx shadows port 80; pnpm can have allocator failures; API
  lint/Jest can OOM; mixed line endings can trip API Prettier. Details in `progress.md`.

## Next steps

- Check the floating trigger and left Sheet in a browser at desktop/mobile widths, including no
  obscured controls, focus/dismissal, real pending timing, Back/Forward, and subdomain/apex tenant
  navigation.
- Complete the earlier plans' slider/keyboard/accessibility, live category ordering/full-catalog
  price-ceiling, and credential-inspection matrix; probes used mocked backend responses.
- Decide whether to commit accumulated uncommitted work.
