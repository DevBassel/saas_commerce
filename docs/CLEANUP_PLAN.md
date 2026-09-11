# Cleanup Plan — `saas_store`

Fix plan for findings in `report.md`. Phased, smallest-risk first. Each phase ends with a verification gate — do not proceed on red.

**Working rules**

- One phase = one commit (or a few small commits). Never mix phases.
- Run gates after every phase: `pnpm build && pnpm test && pnpm exec tsc --noEmit && pnpm exec eslint "src/**/*.ts" "test/**/*.ts"`.
- Integration-touching phases (4, 5) additionally run the verify scripts (need running Postgres):
  `npx ts-node -r tsconfig-paths/register test/verify-tenant-provision.ts`
  `npx ts-node -r tsconfig-paths/register test/verify-tenant-guard.ts`
  `npx ts-node -r tsconfig-paths/register test/verify-tenant-lifecycle.ts`
  `npx ts-node -r tsconfig-paths/register test/verify-register-store-guard.ts`

---

## Phase 0 — Baseline (prerequisite)

Current working tree has uncommitted platform/ refactor (`git status`: modified `app.module.ts`, `tenant.service.ts`, `users.module.ts`; deleted `platform-create-user.dto.ts`, `platform.controller.ts`; untracked `src/modules/platform/`).

- [ ] Commit or stash the WIP platform work first. Cleanup commits must not mix with feature WIP.
- [ ] Tag baseline: `git tag pre-cleanup` for easy rollback.

**Gate:** clean `git status`, suite state recorded (expect 2 failing env.schema tests — they get fixed in Phase 1).

---

## Phase 1 — P0 quick wins (zero risk, same session)

| # | Task | File | Action |
|---|---|---|---|
| 1.1 | Fix red tests | `src/common/config/env.schema.spec.ts` | Delete `ADMINJS_COOKIE_PASSWORD` and `ADMINJS_SESSION_SECRET` lines (45–46) from `baseEnv` fixture |
| 1.2 | Remove debug log | `src/modules/auth/auth.service.ts:45-48` | Delete the `console.log('🚀 ...')` block in `registerStore` |
| 1.3 | Move misplaced dep | `package.json` | Move `@types/bcrypt` from `dependencies` → `devDependencies` |
| 1.4 | Remove junk deps | `package.json` | Remove `add`, `pnpm` |
| 1.5 | Dead branch | `src/main.ts:48` | `port || 4000` → `port` (APP_PORT is required + validated) |

**Gate:** `pnpm install && pnpm build && pnpm test` — expect 31/31 green. Commit.

---

## Phase 2 — Dead code removal (no behavior change)

| # | Task | File | Action |
|---|---|---|---|
| 2.1 | Delete unused DTO | `src/modules/auth/dto/refreshtoken.dto.ts` | Delete file (zero imports). **Skip if Phase 3 decision = wire refresh endpoint** |
| 2.2 | Delete dead methods | `src/modules/users/users.service.ts` | Remove `findAllStoreOwners` (107-114), `findStoreOwnerById` (116-126) |
| 2.3 | Delete dead method | `src/modules/tenants/tenant.service.ts` | Remove `deactivate` (75-77). Keep `TenantStatus` enum — used by entity default |
| 2.4 | Delete dead method | `src/modules/auth/auth.service.ts` | Remove `validateToken` (181-189). **Skip if Phase 3 = wire refresh** (reusable there) |
| 2.5 | Remove dead env vars | `.env.example` | Remove `SWAGGER_ENABLED`, `SWAGGER_USERNAME`, `SWAGGER_PASSWORD`, `LOG_PRETTY` |
| 2.6 | Remove dead env vars | `.env` (local) | Remove `ADMINJS_*` vars (4) |
| 2.7 | Remove inert overrides | `pnpm-workspace.yaml` | Delete `overrides:` tiptap block (keep `allowBuilds`) |
| 2.8 | Fix or delete stale e2e | `test/app.e2e-spec.ts` | Replace `GET / → Hello World!` with a real smoke test: `GET /api/v1` non-tenant route expectation (e.g. 404 without tenant headers), or delete file until real e2e exists |

**Gate:** `pnpm build && pnpm test`. Commit.

---

## Phase 3 — Refresh token decision (needs product call — ASK BEFORE STARTING)

Two findings must be resolved together:

- `refresh_user_credentials` (auth.service.ts:102) — implemented + tested, no HTTP route.
- `jti` column — written on every login (`updateSession`), never validated. Revocation not enforced.

**Option A — Ship the feature (recommended):**

- [ ] Add `POST /auth/refresh` route in `auth.controller.ts`, `@Public()` + body `RefreshTokenDto` (file stays).
- [ ] In `refresh_user_credentials`: after user load, compare `verifyToken.jti !== user.jti` → `UnauthorizedException('Token revoked')` (read user via `findOne` with a select that includes `jti`; `@Exclude()` only affects serialization, entity field is selectable).
- [ ] Add spec cases: revoked jti → 401; valid jti → new pair (rotation works because `returnUserCredential` re-stores a fresh jti).
- [ ] Add postman entry + README endpoint line.

**Option B — Remove the feature:**

- [ ] Delete `refresh_user_credentials`, `validateToken`, `RefreshTokenDto` file.
- [ ] Drop `jti` from `returnUserCredential` payload + `updateSession` + `users.service.ts` + `user.entity.ts` (`synchronize: true` will drop column; else write migration).
- [ ] Delete/adjust the two spec cases referencing refresh.
- [ ] Update PLAN.md note.

**Gate:** full gates + manual curl: login → refresh → tamper/rotate → refresh again with old token → 401. Commit.

---

## Phase 4 — Tenant resolution consolidation (behavior-sensitive)

Fixes: duplicated `resolve()`, duplicated `isApiPath()`, dual "platform route" definitions.

- [ ] New `src/modules/tenants/tenant-resolution.service.ts`:
  - `resolveFromRequest(req): Promise<Tenant | undefined>` — header id (try/catch) → slug → subdomain (single copy).
  - `isApiPath(url): boolean` — single copy (uses ConfigService).
- [ ] `TenantMiddleware` injects it; delete private `resolve`/`isApiPath`.
- [ ] `TenantGuard` injects it; delete private `resolve`/`isApiPath`/`resolveSubdomain` wrapper.
- [ ] **Single platform-route source:** remove `TenantMiddleware.isPlatformPath` string matching. Middleware currently skips platform paths to avoid entering tenant ALS. Options:
  1. Middleware attempts resolution; if none found, just `next()` without ALS (already its behavior when tenant unresolved — platform requests simply won't resolve a tenant). Risk: platform requests WITH tenant headers would enter ALS — but `JwtGuard` already rejects platform tokens carrying tenant claims, so acceptable.
  2. Keep a single shared `isPlatformPath` constant next to the resolution service if option 1 proves risky in verify scripts.
  - Prefer option 1; fall back to option 2 only if a verify script fails.
- [ ] Extract `tenantFromToken` helper (used by jwt.guard + auth.service) next to `JwtPayload` in `src/modules/auth/dto/jwt-payload.dto.ts` or a small `tenant-ref.util.ts`.

**Gate:** full gates + all 4 verify scripts. Commit.

---

## Phase 5 — Config slimming + env fix

- [ ] `src/common/config/env.schema.ts` — remove required blocks: `REDIS_*`, `CACHE_TTL`, `MAIL_*`, `STRIPE_*`, `THROTTLE_*`, `MAX_FILE_SIZE`, `MAX_FILES`.
- [ ] `src/common/config/env.mode.ts` — remove matching `redis`/`mail`/`stripe`/`throttle`/`files` sections.
- [ ] `src/common/config/env.interface.ts` — remove `IREDIS`, `IMAIl`, `Istripe`, `Ithrottle`, `IFiles` and their `IENV` fields. Keep `Ilog`, `ICORS`, `IAPP`, `IDB`, `IJWT`.
- [ ] `src/common/config/env.schema.spec.ts` — remove the deleted keys from `baseEnv`.
- [ ] `.env.example` — remove the deleted var blocks + their section headers.
- [ ] `env.mode.ts` mode wrappers: replace `development`/`testing`/`production` exports with single `buildEnv()`; `config.ts` `envs` map → direct call. **Key fix:** NODE_ENV `test` currently hits `envs['test']` → undefined → crash. Either map `test` explicitly or call `buildEnv()` unconditionally.
- [ ] `src/common/config/data-source.factory.ts` — honor config: `logging: logging` (from `DB_LOGGING`) instead of hardcoded `'all'`. Keep shared logger instance. Note: tenant DataSources share this factory — `DB_LOGGING=false` also silences tenant SQL logs (desired).
- [ ] `main.ts` — drop `rawBody: true` if Phase 3 Option B chosen (no webhook consumer); keep if Stripe is planned next.

**Gate:** full gates + boot app against local Postgres (`.env` trimmed) — confirm startup log + register-store smoke via postman. Commit.

---

## Phase 6 — Dependency removal

After Phases 1–5 so imports are guaranteed gone.

- [ ] `package.json` — remove from dependencies: `winston`, `nest-winston`, `winston-daily-rotate-file`, `passport-jwt`, `@nestjs/passport`, `uuid`, `pino-pretty`.
- [ ] Remove from devDependencies: `source-map-support`, `@types/passport-jwt`.
- [ ] `pnpm install` → confirm lockfile shrinks; `pnpm build && pnpm test`.

**Keep** (verified in use): `rxjs`, `reflect-metadata`, `joi`, `bcrypt`, `class-validator`, `class-transformer`, `rotating-file-stream`, `nestjs-pino`, `@nestjs/swagger`, `@nestjs/mapped-types`, `supertest`, `ts-loader`.

**Gate:** full gates + app boot. Commit.

---

## Phase 7 — Cosmetic dedup (optional, batchable)

- [ ] Single `TenantRef` type: export from `src/modules/tenants/tenant-ref.ts` (or `tenant.utils.ts`); replace the 5 local definitions (`jwt.guard.ts:23`, `auth.service.ts:23`, `rbac.service.ts:20`, `users.service.ts:22`, `tenant-manager.service.ts:9` keeps its `Pick<>`).
- [ ] Slug validator: shared `@IsSlug()` custom validator (or exported regex + `Length` constants) for `create-tenant.dto.ts` + `register-store.dto.ts`.
- [ ] `update-role.dto.ts`: delete redundant `key` re-declaration (PartialType already makes it optional with same rules).
- [ ] Platform controllers: move `@Roles([RoleKey.SUPER_ADMIN])` from all 12 methods to class level (reflector `getAllAndOverride` covers class metadata — same semantics as `@Platform()` today).
- [ ] `TenantRepoResolver` shared service for the `repos()` fallback trio in `users.service.ts` / `rbac.service.ts` (bigger; only if touching those files anyway).
- [ ] `rbac.seed.service.ts` + `users.service.ts`: extract `mergePermissions(existing, additions)` helper.
- [ ] JWT options: small `jwtVerifyOptions()` / `jwtSignOptions()` helpers on AuthService or a util to kill the 4× destructuring.
- [ ] Archive `PLAN.md` → `docs/PLAN.md`; delete or restore compose `api` service block.

**Gate:** full gates. Commit.

---

## Phase 8 — Close-out

- [ ] README: update env var list, endpoints (refresh route if Phase 3A), remove stale references.
- [ ] Postman: add refresh entry (if 3A).
- [ ] Remove `pre-cleanup` tag after a week of green runs.
- [ ] Delete `report.md` + this plan, or move both to `docs/` for history.

---

## Task → Finding traceability

| Plan item | report.md finding |
|---|---|
| 1.1 | §2 CRITICAL — failing tests |
| 1.2, 1.5 | §2 LOW — debug log, dead branch |
| 1.3, 1.4 | §7 — misplaced/junk deps |
| 2.1–2.4 | §2 — dead DTO + 4 dead methods |
| 2.5–2.7 | §2/§8 — dead env vars, tiptap overrides |
| 2.8 | §2 — stale e2e |
| 3 | §2/§3 CRITICAL+HIGH — refresh/jti half-shipped |
| 4 | §4 HIGH — resolve()/isApiPath()/platform-route dupes |
| 5 | §2 HIGH — phantom config, DB_LOGGING, envs['test'] crash |
| 6 | §7 — winston/passport/uuid/pino-pretty stack |
| 7 | §4/§5 — TenantRef ×5, slug regex, UpdateRoleDto, @Roles ×12, repo trio, merge logic |

## Effort estimate

| Phase | Size | Risk |
|---|---|---|
| 0 | XS | none |
| 1 | XS | none |
| 2 | S | none (pure deletion, grep-verified) |
| 3 | S–M | security-relevant — needs decision + tests |
| 4 | M | behavior-sensitive — verify scripts mandatory |
| 5 | S–M | boot contract changes — smoke test mandatory |
| 6 | S | low (post-Phase-5 grep guarantee) |
| 7 | M | low, batchable, can defer |
| 8 | XS | none |

Total: ~1.5–2 focused days excluding Phase 7; Phase 7 optional +0.5 day.
