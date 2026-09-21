# Snapshot seeded role permissions as direct grants on user create and role change

## Goal

Keep a user's **direct** `user_permissions` grants in sync with the user's role's seeded
permission set (`SEED_ROLE_PERMISSIONS[roleKey]` in `src/modules/rbac/constants/seed-data.ts`):

- `create` — new user gets `SEED_ROLE_PERMISSIONS[roleKey]`.
- `assignRole` — on assigning a **system role**, the user's direct grants are **replaced** with
  that role's seeded set.
- `deassignRole` — role removed → direct grants are **cleared**.
- Custom (non-system) roles — permission sync is **skipped**; only `roleId` changes.

Role (`roleId`) stays assigned as identity; direct grants are the snapshot used by the normalized
user response (`permissions` = direct grants only).

## Locked decisions

- `create` allows **CUSTOMER, STORE_OWNER, ADMIN**; **SUPER_ADMIN is rejected** (403
  `ForbiddenException`); any other role → 400 `Role cannot be assigned`.
- Permission source is the **`SEED_ROLE_PERMISSIONS` constant**, not DB `role.permissions`.
- CUSTOMER receives its 6 seeded grants, so `POST /auth/register` customers are no longer `[]`.
- **`assignRole` = replace**: direct grants become exactly the new system role's seeded set;
  previous role grants and manual grants are dropped.
- **`deassignRole` = clear**: `roleId` → null and `permissions` → `[]`, even for users that had a
  custom role or extra manual grants.
- **Custom roles skip sync**: if `role.key` has no `SEED_ROLE_PERMISSIONS` entry, `assignRole`
  only updates `roleId` and leaves direct grants untouched.
- Missing permission keys in a schema are **skipped with a logged warning**; the operation
  succeeds with the found subset.
- `assignRole`/`deassignRole` responses now include `permissions` (`withPermissions: true`).
- Rank checks (`assertCanAssignToUser`) run **before** any permission mutation; on failure
  nothing is written.
- No DB/schema/migration change; `user_permissions` and the `In` import already exist.

## Current state

- `src/modules/users/users.service.ts:70-105` — `create` already resolves
  `SEED_ROLE_PERMISSIONS[roleKey]` via `permissionRepo.findBy({ key: In(...) })` and attaches it.
- `src/modules/users/users.service.ts:143-172` — `assignRole`/`deassignRole` only update
  `roleId` and return `{ withRole: true }` (no permission handling, no `permissions` in response).
- `Role` still has a `role_permissions` relation, but there is no endpoint to edit it;
  `RbacService.createRole` creates custom roles with no permissions.
- No `src/modules/users/users.service.spec.ts` exists yet.

## Affected code

- `src/modules/users/users.service.ts` — add a shared resolve helper; use it in `create`;
  rework `assignRole` and `deassignRole`.
- `src/modules/users/workflow.md:69-89` — `create` and `assignRole`/`deassignRole` flowcharts.
- New `src/modules/users/users.service.spec.ts`.

## Ordered tasks

1. **Shared helper** — in `UsersService`, add:

   ```ts
   private async resolveSeedRolePermissions(
     roleKey: string,
     permissionRepo: Repository<Permission>,
   ): Promise<Permission[] | null> {
     const permissionKeys = (
       SEED_ROLE_PERMISSIONS as Record<string, PermissionKey[] | undefined>
     )[roleKey];
     if (!permissionKeys) return null; // custom/unknown role → caller skips sync

     const permissions = permissionKeys.length
       ? await permissionRepo.findBy({ key: In(permissionKeys) })
       : [];
     if (permissions.length !== permissionKeys.length) {
       const found = new Set(permissions.map((p) => p.key));
       this.logger.warn(
         `role ${roleKey}: seeded permission(s) missing in schema: ${permissionKeys
           .filter((k) => !found.has(k))
           .join(', ')}`,
       );
     }
     return permissions;
   }
   ```

   Import `PermissionKey` from `src/common/constants/PermissionKey.enum`. `null` means "no seed
   mapping → do not sync".

2. **`create`** — replace the inline resolution (lines 92-95) with
   `const permissions = (await this.resolveSeedRolePermissions(roleKey, permissionRepo)) ?? [];`.
   Keep the existing role guard and save logic unchanged.

3. **`assignRole`** — after the existing `assertCanAssignToUser(actorRoleKey, role.key as RoleKey)`:

   - Resolve `const permissions = await this.resolveSeedRolePermissions(role.key, permissionRepo);`
     (destructure `permissionRepo` from `this.repos(tenant)`).
   - If `permissions === null` (custom role): `await userRepo.update({ id }, { roleId: role.id });`
     (no permission change) and return
     `this.findOne({ id }, { withRole: true, withPermissions: true }, tenant)`.
   - Otherwise load the user with grants and replace in one `save`:

     ```ts
     const loaded = await userRepo.findOne({
       where: { id },
       relations: { permissions: true },
     });
     if (!loaded) throw new NotFoundException('User not found');

     loaded.roleId = role.id;
     loaded.permissions = permissions; // full replace
     await userRepo.save(loaded);

     return this.findOne(
       { id },
       { withRole: true, withPermissions: true },
       tenant,
     );
     ```

     (Assigning a fresh array on the `@JoinTable` relation makes TypeORM diff and rewrite the
     join rows; same mechanism already used by `grantPermissions`/`revokePermissions`.)
   - The existing existence check + role lookup + rank check stay first so an invalid actor or
     missing role writes nothing.

4. **`deassignRole`** — after the existing rank check, load with grants, clear both fields, save,
   and return with permissions:

   ```ts
   const loaded = await userRepo.findOne({
     where: { id },
     relations: { permissions: true },
   });
   if (!loaded) throw new NotFoundException('User not found');

   loaded.roleId = null;
   loaded.permissions = [];
   await userRepo.save(loaded);

   return this.findOne(
     { id },
     { withRole: true, withPermissions: true },
     tenant,
   );
   ```

   Replaces the current `userRepo.update({ id }, { roleId: null })` (line 170).

5. **Doc** — `src/modules/users/workflow.md`:
   - `create` flowchart (lines 69-77): guard node `roleKey in CUSTOMER / STORE_OWNER / ADMIN ?`,
     error `400 Role cannot be assigned`, final node `resolve SEED_ROLE_PERMISSIONS[roleKey] →
     replace direct grants; skip missing keys`.
   - `assignRole`/`deassignRole` flowchart (lines 81-89): after the rank check add a branch —
     system role → `replace user_permissions with SEED_ROLE_PERMISSIONS[role.key]`; custom role →
     `roleId only`; deassign → `roleId = null and permissions = []`.

6. **Unit tests** — `src/modules/users/users.service.spec.ts`, constructing
   `new UsersService(userRepo, roleRepo, permissionRepo, tenantManager)` with jest mocks (no
   tenant context → `repos()` falls back to injected repos; warning is fine). Cover:
   - `create` for CUSTOMER / STORE_OWNER / ADMIN attaches `SEED_ROLE_PERMISSIONS[roleKey]`.
   - `create` with SUPER_ADMIN → 403; unknown role → 400; role not seeded → 400; duplicate
     email → 400.
   - `assignRole` to a system role → `permissionRepo.findBy` called with that role's keys and the
     saved user's `permissions` are exactly that set (old grants gone).
   - `assignRole` to a custom role (`key: 'assistant'`) → `userRepo.save` not called for
     permissions / `permissions` left untouched; `roleId` updated via `update`.
   - `assignRole` rank failure → neither `update` nor `save` called.
   - `deassignRole` → saved user has `roleId: null`, `permissions: []`.
   - `deassignRole` rank failure → no `save`.

## Edge cases

- **Reassign same role** → perms replaced with the identical set (idempotent).
- **System → custom role** → `roleId` changes but the previous system role's direct grants
  remain (sync skipped by design). Documented gotcha.
- **Custom → deassign** → grants cleared.
- **Manual grants** (`grantPermissions`) are overwritten on the next system-role assignment;
  `revokePermissions` still works independently between assignments.
- **Missing seeded keys** (older tenant schema) → warn + assign the subset.
- **SUPER_ADMIN target** is not seeded in tenant schemas (`TENANT_ROLE_KEYS` excludes it), so it
  is not assignable through tenant `assignRole`; the constant entry only matters if a platform
  context ever calls this.
- **Public/no-tenant context** with ADMIN/CUSTOMER key → `role not seeded` (public seeds only
  SUPER_ADMIN).

## Out of scope

- Backfilling direct grants for already-existing users.
- Removing the `role_permissions` mapping or `seedRbac` role-permission writes.
- Adding a `POST /users` create endpoint, a DTO role field, or custom-role permission editing.
- Changing `PermissionGuard` / `JwtGuard` / `RequestWithUser`.

## Validation

- `npx tsc --noEmit`
- `pnpm lint` (pre-existing unrelated error at `src/main.ts:16`)
- `pnpm test` (pre-existing unrelated failure in `src/common/storage/r2.service.spec.ts`)
- Manual (needs `.env` + Postgres via `compose.yaml`, app running):
  - `POST /auth/register` (CUSTOMER) → profile shows 6 perms; `register-store` → 25 perms.
  - `PATCH /users/:id/role` to ADMIN → profile `permissions` equals the ADMIN set (no
    `roles:delete`/`permissions:delete`), old customer grants gone.
  - `PATCH /users/:id/role` to a custom role → `roleId` changes, `permissions` unchanged.
  - `DELETE /users/:id/role` → `role: null`, `permissions: []`.
  - Actor of equal/higher target rank still gets 403 and no permission change.

## Risks

- **Manual grants wiped** by a system-role assignment (intended replace semantics).
- **Stale grants kept** when switching to a custom role (skip-sync by design).
- **Constant/DB drift**: grants come from `SEED_ROLE_PERMISSIONS` while role authorization still
  unions `role_permissions`; if they diverge, response `permissions` and effective access differ.
- **Snapshot drift**: later `SEED_ROLE_PERMISSIONS` changes do not reach existing users until a
  role reassignment.
