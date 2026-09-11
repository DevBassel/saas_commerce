# Codebase Cleanup Audit — `saas_store` (NestJS 10 + TypeORM, schema-per-tenant)

**Audit type:** Read-only. No files modified.
**Date:** 2026-09-11
**Scope:** 82 TS files (75 `src/`, 7 `test/`) + all root configs, lockfile, postman collection, docs (~4,100 LOC).
**Verification runs:** `pnpm test` (29 passed / 2 failed), `tsc --noEmit` (clean), `eslint` (clean).

---

## 1. Executive Summary

| Metric | Value |
|---|---|
| Files inspected | 82 TS files + configs, lockfile, postman, docs (~4,100 LOC) |
| Suspected unused files | 2 (`refreshtoken.dto.ts`, `app.e2e-spec.ts` stale) |
| Suspected unused symbols | 9 (`validateToken`, `refresh_user_credentials`*, `findAllStoreOwners`, `findStoreOwnerById`, `deactivate`, `testing` env mode, phantom config groups, `DB_LOGGING`, `jti` read path) |
| Duplicated code groups | 8 significant |
| Redundant dependencies | 10 packages + 1 misplaced + 2 junk + inert tiptap overrides |
| Test suite status | **2 unit tests currently FAILING** (stale AdminJS fixtures) |
| Typecheck / lint | `tsc --noEmit` clean, `eslint` clean (no unused imports) |

**Overall assessment:** Small, deliberately structured codebase with real architectural intent (tenant isolation, RBAC, guards). Main problems:

1. Debris from the removed AdminJS feature now breaking tests.
2. An entire removed-then-replaced platform layer leaving dead service methods.
3. Tenant resolution implemented **twice** (middleware + guard) with two competing definitions of "platform route".
4. ~10 dead dependencies including a whole unused winston logging stack.
5. Phantom required env config (redis/mail/stripe/throttle/files) for features that don't exist, forcing operators to supply ~20 meaningless variables.
6. A half-implemented refresh-token/jti revocation mechanism that writes state it never validates.

\* `refresh_user_credentials` is test-covered but has no HTTP route — feature gap, not simple dead code.

---

## 2. Definitely Unused

| Location | Symbol/File | Type | Evidence | Confidence | Severity |
| -------- | ----------- | ---- | -------- | ---------- | -------- |
| `src/modules/auth/dto/refreshtoken.dto.ts` | `RefreshTokenDto` | DTO class | Zero imports repo-wide (grep). No refresh endpoint in controller, postman collection, or README | HIGH | LOW |
| `src/modules/auth/auth.service.ts:181` | `validateToken` | Service method | Zero callers. `JwtGuard.canActivate` does its own `jwt.verify` (jwt.guard.ts:55) | HIGH | LOW |
| `src/modules/users/users.service.ts:107` | `findAllStoreOwners` | Service method | Zero callers repo-wide (grep) | HIGH | LOW |
| `src/modules/users/users.service.ts:116` | `findStoreOwnerById` | Service method | Zero callers repo-wide (grep) | HIGH | LOW |
| `src/modules/tenants/tenant.service.ts:75` | `deactivate` | Service method | Zero callers; no tenant status transition anywhere (only seed default ACTIVE) | HIGH | LOW |
| `src/common/config/env.mode.ts:88` | `testing` export | Config branch | `envs` map key is `testing` but `env.schema.ts:36` validates NODE_ENV as `development/production/test`. `envs['test']` → `undefined()` crash; `testing` unreachable | HIGH | **HIGH** (latent boot crash in test env) |
| `.env.example:81-83,89` | `SWAGGER_ENABLED`, `SWAGGER_USERNAME`, `SWAGGER_PASSWORD`, `LOG_PRETTY` | Env vars | Not in `env.schema.ts`, not read anywhere in code | HIGH | MEDIUM |
| `src/common/config/env.schema.ts` + `.env` | `REDIS_*`, `CACHE_TTL`, `MAIL_*`, `STRIPE_*`, `THROTTLE_*`, `MAX_FILE_SIZE`, `MAX_FILES` | Required config | All `required()` in schema and consumed only by `env.mode.ts` plumbing into `IREDIS/IMAIl/Istripe/Ithrottle/IFiles` — no redis client, mailer, stripe, throttler, or upload code exists; no corresponding packages installed | HIGH | **HIGH** (boot fails without 20 meaningless vars) |
| `src/common/config/data-source.factory.ts:24,35` | `DB_LOGGING` / `logging` destructure | Env var / variable | `logging` destructured (line 24) then discarded; line 35 hardcodes `logging: 'all'` | HIGH | **HIGH** (unbounded SQL log volume in prod, config knob dead) |
| `src/common/config/env.schema.spec.ts:45-46` | `ADMINJS_COOKIE_PASSWORD`, `ADMINJS_SESSION_SECRET` | Test fixtures | **2 tests currently fail**: `"ADMINJS_COOKIE_PASSWORD" is not allowed` (verified by running `pnpm test`) — leftovers from AdminJS removal (commit `0ca6d30`) | HIGH | **CRITICAL** (red test suite) |
| `test/app.e2e-spec.ts` | whole spec | E2E test | Expects `GET /` → `Hello World!` but no `AppController` exists in `src/` (removed). E2E suite is broken as-is | HIGH | MEDIUM |
| `src/modules/auth/auth.service.ts:45-48` | `console.log('🚀 ~ auth.service.ts:2 ...')` | Debug leftover | Editor-generated debug log in production register-store path | HIGH | LOW |

## 3. Probably Unused

| Location | Symbol/File | Type | Evidence | Confidence | Severity |
| -------- | ----------- | ---- | -------- | ---------- | -------- |
| `src/modules/auth/auth.service.ts:102` | `refresh_user_credentials` | Service method | Only callers are its own spec (auth.service.spec.ts:96,113). No route, no postman entry, no verify script uses it. PLAN.md:71 says flow "verified" — but the endpoint was evidently never (or no longer) wired | HIGH (production-unreachable) | **HIGH** (half-shipped feature: tokens issued, no way to refresh) |
| `src/modules/users/entities/user.entity.ts:50` + `users.service.ts:154` | `jti` column + `updateSession` | DB column + write path | `jti` is written on every login but **never read or compared** anywhere (grep: 9 hits, all writes/declarations). Intended refresh-revocation check absent — stale refresh tokens stay valid forever | HIGH (read path unused) | **CRITICAL** (security mechanism exists in DB but is not enforced) |
| `src/main.ts:10` | `rawBody: true` | App option | No consumer (no webhook signature checks — stripe config is phantom anyway) | MEDIUM | LOW |
| `src/modules/auth/dto/jwt-payload.dto.ts:4` | `JwtPayload.role` | Token claim | Written into every token (auth.service.ts:136) but no guard reads `payload.role` — JwtGuard re-loads user from DB. Dead claim unless kept for external consumers | MEDIUM | LOW |
| `compose.yaml` (api service block) | ~30 commented lines | Dead config | Entire `api` service commented out; only postgres runs. Possibly intentional (host dev mode) | MEDIUM | LOW |
| `pnpm-workspace.yaml:7-21` | `overrides: @tiptap/*` | Workspace config | No tiptap package anywhere in the dependency tree (lockfile shows only the override mirror itself). Leftovers from an unrelated frontend project; inert | HIGH (inert) | LOW |
| `test/verify-register-store-guard.ts` | verification script | Script | Not referenced in README (other 3 verify scripts are), not in package.json scripts. Manually runnable — verify before removing | LOW | LOW |
| `main.ts:48` | `port \|\| 4000` fallback | Dead branch | `APP_PORT` is `joi.number().required()` — fallback unreachable | HIGH | LOW |

## 4. Duplicate Code

| Location A | Location B | Duplication Type | Similarity | Recommended Refactor | Severity |
| ---------- | ---------- | ---------------- | ---------- | -------------------- | -------- |
| `tenant.middleware.ts:37-55` (`resolve`) | `tenant.guard.ts:56-79` (`resolve`) | Near-duplicate tenant resolution: x-tenant-id→findById+try/catch, x-tenant-slug→findBySlug, subdomain→findBySubdomain | ~90% | Extract `TenantResolutionService.resolve(req)` used by both | **HIGH** |
| `tenant.middleware.ts:66-75` (`isApiPath`) | `tenant.guard.ts:81-90` (`isApiPath`) | Exact duplication | 100% | Move to `tenant.utils.ts` | MEDIUM |
| `tenant.middleware.ts:57-64` (`isPlatformPath` — string matching `/platform`, `/auth/register-store`, `/auth/login/platform`) | `isPlatform.decorator.ts` + `IS_PLATFORM` reflector | **Two competing sources of truth** for "is platform route" (URL-string vs decorator metadata) | divergent by design | Single source: middleware should read route metadata or delegate to guard; URL substring matching is fragile | **HIGH** |
| `jwt.guard.ts:118-121` (`tenantFromToken` + local `TenantRef`) | `auth.service.ts:197-200` (`tenantFromToken` + local `TenantIdentity`) | Exact logic + duplicate private interfaces | 100% | Shared helper next to `JwtPayload` | MEDIUM |
| `users.service.ts:36-70` (`resolveTenant`/`warnMissingTenantContext`/`repos`) | `rbac.service.ts:42-68` (same trio) | Near-exact tenant-repo fallback pattern | ~85% | Extract `TenantRepoResolver` service (or base class) taking entity list | **HIGH** |
| `create-tenant.dto.ts:14-19` (slug regex `^[a-z0-9]+(?:-[a-z0-9]+)*$` + `Length(2,50)`) | `register-store.dto.ts:16-20` (storeSlug, identical regex + message) | Exact duplicated validation rule | 100% | Shared `@IsSlug()` validator or exported regex constant | MEDIUM |
| `update-role.dto.ts:5-12` | `create-role.dto.ts:6-10` | `UpdateRoleDto extends PartialType(CreateRoleDto)` then **re-declares `key`** with the identical `@Matches` regex + message that PartialType already inherited (optional) | 100% redundant override | Delete the re-declared property | MEDIUM |
| `platform/rbac/roles.service.ts:17-19`, `platform/rbac/permissions.service.ts:17-19`, `platform/users/users.service.ts:21-23` | each other | Identical `private tenantRef()` boilerplate ×3 | 100% | Fold into `PlatformTenantRefService` call sites or a shared param decorator | LOW |
| `env.mode.ts:83-96` | itself | `development`/`testing`/`production` all call `buildEnv()` 3× each (spread + app re-spread); three wrappers differ only by one string | near-exact | Single `buildEnv()`; drop the mode wrappers entirely | MEDIUM |

## 5. Repeated Business Logic

1. **Tenant resolution** (header/slug/subdomain → tenant lookup) implemented twice per request path — middleware sets `req.tenant` + ALS, guard re-resolves as fallback. Same DB lookups can run twice; logic must be kept in sync manually.
2. **"Platform route" classification** — string-paths in `TenantMiddleware.isPlatformPath` vs `@Platform()` metadata in guards. Adding a new platform route requires remembering to update a hardcoded string list; miss it and middleware wrongly enters tenant ALS context.
3. **Authorization super-admin rules** — `PermissionGuard` (super bypass, roles, permissions) and `UsersService.assertCanAssignToUser` (rank comparison) encode role hierarchy semantics in two places; `ROLE_RANK` used only in the latter.
4. **`@Roles([RoleKey.SUPER_ADMIN])` repeated on all 12 platform controller methods** — `getAllAndOverride` checks class-level metadata; one class-level decorator per controller suffices (as already done with `@Platform()`).
5. **JWT verify-options assembly** — `{ secret, issuer, audience }` from `config.getOrThrow<IJWT>('jwt')` destructured 4× (auth.service ×3, jwt.guard ×1).
6. **Permission merge logic** — the `Map<number, Permission>` merge appears in `rbac.seed.service.ts:83-86` and `users.service.ts:229-232`.
7. **`TenantRef` type** defined 5 times: `jwt.guard.ts:23` (`TenantRef`), `auth.service.ts:23` (`TenantIdentity`), `rbac.service.ts:20`, `users.service.ts:22`, `platform/common/tenant-ref.service.ts:4` (exported), `tenant-manager.service.ts:9` (`Pick<Tenant,'schemaName'>`).

## 6. Redundant Files / Modules

| File | Reason |
|---|---|
| `src/modules/auth/dto/refreshtoken.dto.ts` | Zero references (see §2) |
| `test/app.e2e-spec.ts` | Tests a controller that no longer exists |
| `PLAN.md` | Fully implemented plan doc (per git log all phases shipped); archive to `docs/` |
| `dist/`, `logs/` | Build/runtime output on disk — already gitignored, no action needed (excluded from findings per rules) |

Note: `src/modules/platform/*` is **not** redundant with `src/modules/{users,rbac,tenants}/*` — it's a deliberate SUPER_ADMIN delegation layer over the same services (git status shows it's fresh uncommitted work). Only the boilerplate pattern is a cleanup target, not the files.

## 7. Unused Dependencies

| Package | Why It Appears Unused | Referenced By | Confidence | Recommendation |
| ------- | --------------------- | ------------- | ---------- | -------------- |
| `winston` ^3.19.0 | No import anywhere; logging = nestjs-pino + rotating-file-stream | nothing | HIGH | Remove |
| `nest-winston` ^1.10.2 | Same | nothing | HIGH | Remove |
| `winston-daily-rotate-file` ^5.0.0 | Same (rotation done by `rotating-file-stream`) | nothing | HIGH | Remove |
| `passport-jwt` ^4.0.1 | Guard verifies JWT manually via `JwtService`; no passport strategy registered | nothing | HIGH | Remove |
| `@nestjs/passport` ^10.0.3 | Same | nothing | HIGH | Remove |
| `@types/passport-jwt` (dev) | Same | nothing | HIGH | Remove |
| `uuid` ^14.0.1 | `randomUUID` imported from node `crypto` (auth.service.ts:17) | nothing | HIGH | Remove |
| `pino-pretty` ^13.1.3 | No transport config; pino writes to rfs file stream; `LOG_PRETTY` env never read | nothing | HIGH | Remove |
| `add` ^2.0.9 | Junk package (artifact of `pnpm add add ...` typo) | nothing | HIGH | Remove |
| `pnpm` ^11.20.0 | Package manager installed as runtime dependency; pnpm already global + Dockerfile installs its own | nothing | HIGH | Remove |
| `source-map-support` (dev) | No import; test:debug script doesn't use it | nothing | HIGH | Remove |
| `@types/bcrypt` ^6.0.0 (in **dependencies**) | Types used only at compile time | compiler | HIGH | Move to devDependencies (not unused, misplaced) |
| `ts-loader` (dev) | Only used by `nest build --webpack`; current build is default tsc path | build tooling | LOW | Keep (Nest tooling convention) |

Keep (verified in use): `rxjs` (Nest peer requirement), `reflect-metadata`, `joi`, `bcrypt`, `class-validator`, `class-transformer`, `rotating-file-stream`, `nestjs-pino`, `@nestjs/swagger` (main.ts + nest-cli plugin), `@nestjs/mapped-types` (PartialType), `supertest` (e2e).

## 8. Dead / Commented Code

| Location | Content |
|---|---|
| `compose.yaml:3-30` | Entire `api` service commented out |
| `env.schema.spec.ts:45-46` | `ADMINJS_*` fixtures — **actively breaking 2 tests** |
| `.env` (local, gitignored) | `ADMINJS_ROOT_PATH`, `ADMINJS_COOKIE_NAME`, `ADMINJS_COOKIE_PASSWORD`, `ADMINJS_SESSION_SECRET` dead vars |
| `.env.example:81-89` | `SWAGGER_*`, `LOG_PRETTY` dead vars |
| `auth.service.ts:45-48` | Debug `console.log` with editor artifact text |
| `pnpm-workspace.yaml:7-21` | Inert `@tiptap/*` overrides from an unrelated project |
| `main.ts:48` | `port \|\| 4000` unreachable fallback |

## 9. Refactoring Opportunities

| # | Problem | Affected files | Proposed abstraction | Benefit | Risk | Complexity |
|---|---|---|---|---|---|---|
| 1 | AdminJS debris breaks test suite | `env.schema.spec.ts` | Delete `ADMINJS_*` fixture keys | Green CI | None | **Small** |
| 2 | Tenant resolution duplicated; two "platform route" definitions | `tenant.middleware.ts`, `tenant.guard.ts` | `TenantResolutionService` (shared resolve + isApiPath); single platform-route source (route metadata or guard-only resolution) | One code path, no double lookups, no string-list drift | Behavior change on edge routes — needs verify scripts run | **Medium** |
| 3 | Half-shipped refresh flow: method + DTO exist, no route, jti never validated | `auth.service.ts`, `refreshtoken.dto.ts`, `users.service.ts` | Either (a) add `POST /auth/refresh` + `jti` comparison in `refresh_user_credentials`, or (b) delete method, DTO, and jti column | Closes security gap or removes dead weight | (a) new endpoint + migration; (b) loses planned feature | Small–Medium |
| 4 | Phantom required env config | `env.schema.ts`, `env.mode.ts`, `env.interface.ts`, `.env.example` | Drop REDIS/MAIL/STRIPE/THROTTLE/MAX_FILE/CACHE_TTL blocks until features land | ~20 fewer required vars, honest boot contract | Future features re-add trivially | **Small** |
| 5 | Tenant-repo fallback pattern duplicated | `users.service.ts`, `rbac.service.ts` | Shared `TenantRepoResolver` | Single place for schema-fallback semantics | Low | Medium |
| 6 | `TenantRef` type ×5 + `tenantFromToken` ×2 | see §5.7 | One exported `TenantRef` + helper in tenants module | Type safety, less drift | None | **Small** |
| 7 | `env.mode.ts` triple-wrapper + `test`/`testing` key mismatch | `env.mode.ts`, `config.ts`, `env.schema.ts` | Single `buildEnv()`; fix NODE_ENV key to `test` | Removes latent crash, −30 LOC | None | **Small** |
| 8 | Dead dependencies | `package.json` | Remove 11 packages (§7) | Smaller install, less audit surface | `pnpm install && build && test` to verify | **Small** |
| 9 | Hardcoded `logging: 'all'` | `data-source.factory.ts` | Honor `DB_LOGGING` | Controllable SQL log volume | None | **Small** |
| 10 | Per-method `@Roles([SUPER_ADMIN])` ×12 | platform controllers | Class-level `@Roles` (reflector already checks class) | −12 lines, clearer intent | None — `getAllAndOverride` semantics identical | **Small** |

## 10. Cleanup Priority

**P0 — Remove/Fix immediately**

1. Delete `ADMINJS_*` keys from `env.schema.spec.ts` (red test suite today).
2. Remove `@types/bcrypt` from `dependencies` → devDependencies.
3. Remove junk deps `add`, `pnpm`.
4. Delete debug `console.log` in `auth.service.ts:45`.

**P1 — High-value cleanup**

5. Decide refresh-token story: wire `POST /auth/refresh` with `jti` validation **or** remove `refresh_user_credentials`/`RefreshTokenDto`/`jti` column (security gap either way).
6. Remove unused deps: winston stack, passport stack, `uuid`, `pino-pretty`, `source-map-support`.
7. Consolidate tenant resolution (middleware vs guard) + single platform-route definition.
8. Fix `envs['test']` key mismatch / drop `testing` wrapper.
9. Honor `DB_LOGGING` instead of hardcoded `'all'`.
10. Slim env schema to implemented features.

**P2 — Nice-to-have cleanup**

11. Extract shared `TenantRef` type + `tenantFromToken` + `isApiPath` + slug validator.
12. Class-level `@Roles` on platform controllers.
13. Delete/rewrite stale `app.e2e-spec.ts`; delete redundant `UpdateRoleDto.key` override.
14. Remove dead env vars from `.env.example`; inert tiptap overrides; archive `PLAN.md`; uncomment-or-delete compose `api` service.

## 11. Do Not Touch

| Item | Why it looks unused | Why it's required |
|---|---|---|
| All `*.entity.ts` files | Not all directly imported | `core.module.ts:24` entity glob `__dirname + '/**/*.entity.{js,ts}'` auto-loads them into the public DataSource |
| `tenant-entities.ts` (`TENANT_ENTITIES`) | Plain array, few imports | Explicit entity list for tenant DataSources (tenant-manager.service.ts:77) — `autoLoadEntities` is false there |
| `reflect-metadata`, `rxjs` | No direct import | Hard runtime/peer requirements of NestJS |
| `Public`/`Platform`/`Roles`/`Permissions` decorators | No call-site output | Metadata read via Reflector at runtime by guards |
| `TenantGuard` listed in both `auth.module.ts:11` providers and `app.module.ts` APP_GUARD | Looks redundant | DI registration for app-scoped guard instantiation |
| APP_GUARD order (Tenant→Jwt→Permission) in `app.module.ts` | — | Guard execution order is the security model |
| `RbacSeedService.onApplicationBootstrap` | Never called directly | Nest lifecycle hook auto-invoked at boot |
| `tenantRefFromContext`, `getTenantContext`, `tenantStorage` | Thin wrappers | Core ALS mechanism consumed by services + middleware |
| nest-cli.json `@nestjs/swagger` plugin | Not in code | Compile-time CLI transform for DTO decorators |
| jest `moduleNameMapper "^src/(.*)$"` in package.json | Not a path in tsconfig | Resolves `src/...` imports in spec files |
| ts-node, tsconfig-paths, ts-jest, ts-loader, `@nestjs/cli`/`schematics` | No source imports | Toolchain: verify scripts (`npx ts-node -r tsconfig-paths/register ...` in README), builds, tests |
| `pnpm-workspace.yaml` `allowBuilds` (bcrypt, esbuild, unrs-resolver) | — | pnpm 10 build-script approval for native modules; removing breaks bcrypt install |
| `UsersService`/`RbacService`/`TenantService` module `exports` | Unused in some importers | DI graph — consumed by Auth/Platform modules |
| `supertest`, `@types/supertest`, `@types/express`, `@types/jest`, `@types/node` | — | Test/compile infrastructure |

---

## Final Assessment

**Top 10 cleanup candidates**

1. `ADMINJS_*` spec fixtures (breaking tests)
2. `refresh_user_credentials` + `RefreshTokenDto` + `jti` column (dead security mechanism)
3. `validateToken`, `findAllStoreOwners`, `findStoreOwnerById`, `deactivate` (dead methods)
4. Hardcoded `logging: 'all'` / dead `DB_LOGGING`
5. Phantom env schema blocks (redis/mail/stripe/throttle/files)
6. `envs['testing']` mode mismatch
7. `app.e2e-spec.ts` (stale)
8. `.env.example` dead vars (`SWAGGER_*`, `LOG_PRETTY`)
9. tiptap overrides + compose commented block
10. `console.log` debug leftovers

**Top 10 duplication candidates**

1–2. Tenant `resolve()` ×2, `isApiPath()` ×2 (middleware vs guard)
3. Platform-route definition ×2 (string list vs decorator)
4. `tenantFromToken` ×2
5. `TenantRef` type ×5
6. `resolveTenant`/`warnMissingTenantContext`/`repos` trio ×2
7. Slug regex+Length validation ×2
8. `UpdateRoleDto.key` redundant override
9. `tenantRef()` platform boilerplate ×3
10. `@Roles([SUPER_ADMIN])` ×12 (should be class-level)

**Top 5 dependencies to investigate**

1. `winston` + `nest-winston` + `winston-daily-rotate-file` (whole stack unused)
2. `passport-jwt` + `@nestjs/passport` + `@types/passport-jwt` (never wired)
3. `uuid` (crypto.randomUUID used instead)
4. `pino-pretty` (no transport usage)
5. `add` + `pnpm` (junk) and `@types/bcrypt` (misplaced dep section)

**Estimated removable/refactorable code**

- Safely removable: ~10% of LOC (dead methods, phantom config, dead deps, debris)
- Refactorable via dedup: further ~15–20%

**Biggest architectural problem discovered**

Refresh-token lifecycle is half-implemented end to end: tokens carry `jti`, users table stores it, but nothing validates it and no refresh endpoint exists — combined with the dual tenant-resolution/middleware-guard layering, two features that look implemented are actually inert. Security-critical code paths must be either finished or removed, not left in limbo.

**Recommended cleanup order**

P0 quick wins (same afternoon) → dependency removal + verify with `pnpm install && pnpm build && pnpm test` → refresh/jti decision (needs product call) → tenant-resolution consolidation (run `test/verify-*.ts` scripts after) → env-schema slimming → cosmetic dedup last.
