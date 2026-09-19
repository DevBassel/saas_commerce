# Snapshot STORE_OWNER permissions as direct grants on register-store

## Goal

When a store owner is created via `POST /auth/register-store`, copy the STORE_OWNER role's
seeded permission set into the new user's **direct** `user_permissions` grants, so the
normalized user response (`permissions` = direct grants only, from the prior change) shows the
owner's capabilities without depending on the role at read time.

The STORE_OWNER role stays assigned (rank checks and the JWT `role` claim depend on it). The
direct grants are a **frozen snapshot** taken at registration and are independent of the role
thereafter.

## Locked decisions

- Snapshot applies **only to `register-store`** (STORE_OWNER). `POST /auth/register`
  (CUSTOMER) is unchanged and keeps `permissions: []`.
- Snapshot set = the permissions currently attached to the STORE_OWNER role in the tenant
  schema (`SEED_ROLE_PERMISSIONS[STORE_OWNER]` = all 25 seeded tenant permissions,
  `src/modules/rbac/constants/seed-data.ts:173-174`), read from the DB at registration — not a
  hardcoded list.
- Snapshot is taken once, at creation. Later edits to the STORE_OWNER role's permissions do
  **not** propagate to already-registered owners, and revoking an owner's direct grant does not
  affect the role.
- The STORE_OWNER role remains assigned (no role removal).
- No change to the `register-store` HTTP response (still only `access_token`/`refresh_token`).
- No change to `JwtGuard`, `PermissionGuard`, `RequestWithUser`, the presenter, or `findAll`.
- No DB/schema/migration change; `user_permissions` already exists.
- No backfill for owners registered before this change (out of scope, see below).

## Affected code

- `src/modules/users/users.service.ts:63-90` — `create(...)`. Add an options argument that
  toggles the snapshot; when enabled, load the role with its permissions and attach them to the
  new user before the single `save`.
- `src/modules/auth/auth.service.ts:49-57` — the STORE_OWNER `create` call passes the snapshot
  option. `register` at line 36 is untouched.
- `src/modules/users/workflow.md` — create diagram note (currently "save user with roleId").
- `src/modules/auth/workflow.md:90` — the `S3["UsersService.create owner ..."]` node.
- New unit spec (see task 4).

## Ordered tasks

1. **`UsersService.create`** — extend the signature with a trailing options object, preserving
   all existing behavior by default:

   ```ts
   async create(
     createUserDto: CreateUserDto,
     roleKey: RoleKey = RoleKey.CUSTOMER,
     tenant?: TenantRef,
     options: { snapshotRolePermissions?: boolean } = {},
   )
   ```

   - When `options.snapshotRolePermissions` is true: load the role via
     `roleRepo.findOne({ where: { key: roleKey }, relations: { permissions: true } })` and set
     `permissions: role.permissions ?? []` on the entity passed to `userRepo.create(...)`.
   - When false/omitted: keep the current `roleRepo.findOneBy({ key: roleKey })` path (no extra
     join).
   - Keep the existing guards/behavior: CUSTOMER/STORE_OWNER-only check, `user already exists`,
     `role not seeded`, bcrypt hash. A role with zero permissions yields `permissions: []`.
   - The 3rd positional `tenant` argument stays, so existing callers
     (`auth.service.ts:36`, `:49`) remain source-compatible.

2. **`AuthService.registerStore`** — pass `{ snapshotRolePermissions: true }` to the
   `this.userService.create(...)` call for the owner. Do not touch `register`.

3. **Docs**
   - `src/modules/users/workflow.md`: in the `create` flowchart, note that STORE_OWNER
     creation snapshots the role's permissions into `user_permissions` (direct grants), while
     CUSTOMER creation does not.
   - `src/modules/auth/workflow.md:90`: update the owner-create node to
     `UsersService.create owner — role = STORE_OWNER, bcrypt hash, snapshot role permissions to user_permissions`.

4. **Unit tests** — add `src/modules/users/users.service.spec.ts` (no existing users service
   spec). Construct `new UsersService(userRepo, roleRepo, permissionRepo, tenantManager)` with
   jest mocks; with no tenant context `repos()` falls back to the injected public repos (a
   warning is logged, which is fine). Cases:
   - `snapshotRolePermissions: true` → saved user carries `role.permissions` (assert the array
     passed to `userRepo.save`/`create`).
   - option omitted → saved user has no `permissions` attached and `roleRepo.findOne` (relation
     form) is not required (mock `findOneBy`).
   - role with empty permissions → saved user gets `permissions: []`.
   - existing error paths unchanged (`role not seeded` when role missing).
   - Optionally spy on `AuthService.registerStore` wiring in `auth.service.spec.ts` to assert
     `create` is called with the snapshot option (mock `tenantService`/`provisioner`).

## Edge cases

- STORE_OWNER role missing in the new schema → existing `400 role not seeded` (seed runs during
  `provision`, before owner create, so this should not occur).
- Role has no permissions → `permissions: []`.
- Duplicate `create` retry for same email → existing `400 user already exists`; no partial
  snapshot.
- Owner later deassigned the STORE_OWNER role → direct grants persist (by design); response
  `role: null`, `permissions` still populated.
- Owner's direct grant revoked while the role still grants it → disappears from the response
  `permissions` but authorization still allows it (same documented gotcha as the prior change).

## Validation

- `npx tsc --noEmit`
- `pnpm lint` (note: `src/main.ts:16` has a pre-existing unused-`origin` error unrelated to this
  work)
- `pnpm test` (note: `src/common/storage/r2.service.spec.ts` has a pre-existing failing
  delete-batching assertion unrelated to this work)
- Manual (needs `.env` + Postgres via `compose.yaml`, app running):
  - `POST /auth/register-store` → then `GET /users/profile` with the returned owner token →
    `permissions` is a 25-item object array sorted by `key`, `role.key = "STORE_OWNER"`,
    `role` has no nested `permissions`.
  - `PATCH /users/:id/role` to `ADMIN` → `permissions` unchanged (direct snapshot persists).
  - `DELETE /users/:id/permissions` (empty body) → `permissions: []` even though role remains.
  - `POST /auth/register` (customer) → profile `permissions: []`.

## Risks

- **Snapshot drift**: direct grants cannot be reduced by editing the STORE_OWNER role, and
  future `SEED_ROLE_PERMISSIONS` changes will not reach already-registered owners. This is the
  intended decoupling; document it.
- **Redundant effective set**: owner now has the same permissions via both role and direct
  grants. Effective authorization (guard union) is unchanged; only the response presentation
  differs.
- **Extra write on register-store**: one role read with permissions + one extra join-table write
  on the owner's `save`. Registration only; acceptable.

## Out of scope / open questions

- Backfilling direct grants for owners created before this change (could be a one-off script or
  a re-seed pass) — not included.
- Including the owner's permissions in the `register-store` HTTP response.
- Granting direct permissions on CUSTOMER `register` or on any new authenticated
  create-user endpoint.
