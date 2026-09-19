# Replace a user's direct permissions on assignRole

## Goal

`UsersService.assignRole` (only) must, on every role change, **remove the user's existing direct
`user_permissions` grants and replace them with the target role's seeded permission set**:

- Target role is a system role with a `SEED_ROLE_PERMISSIONS` entry → grants become exactly that
  set (previous role snapshot + any manual `grantPermissions` are dropped).
- Target role is custom/unknown (no seed entry) → grants become `[]`.

Role (`roleId`) stays as identity. Direct grants remain the source of the response
`permissions` array.

Scope is limited to the `assignRole` method. This refines the `assignRole` section of
`.kilo/plans/1789835862016-user-create-role-perms-plan.md`; its `create` part is already
implemented and is left untouched. Its earlier `deassignRole = clear` and the later
fallback-to-CUSTOMER idea are **both out of scope here**.

## Locked decisions

- **Source of truth = `SEED_ROLE_PERMISSIONS`** (`src/modules/rbac/constants/seed-data.ts:177`),
  same as the implemented `create` at `src/modules/users/users.service.ts:92-95` — not the DB
  `role.permissions` join.
- **Always replace** `permissions` in `assignRole`. Manual grants are overwritten by the next
  `assignRole`.
- **Custom/unknown role → `permissions: []`** (no seed entry), not "leave untouched".
- **System role with all/most keys** → `permissionRepo.findBy({ key: In(keys) })`; keys missing
  from an older schema are skipped (the found subset is assigned), matching `create` behavior.
- Rank check (`assertCanAssignToUser`) runs **before** any permission/role mutation; on failure
  nothing is written. It uses the target role's key (custom key → rank 0).
- Response returned via `findOne({ id }, { withRole: true, withPermissions: true }, tenant)` so
  it includes the new `permissions`.
- No DB/schema/migration change. No change to `create`, `deassignRole`, the presenter, the
  controller, `PermissionGuard`, `JwtGuard`, or `role_permissions`.

## Current state

- `src/modules/users/users.service.ts:143-160` — `assignRole` destructures only
  `{ userRepo, roleRepo }`, looks up the user and role, runs the rank check, then
  `userRepo.update({ id }, { roleId: role.id })` and returns `{ withRole: true }`. It never
  touches `permissions`. **This is the entire work.**
- `create` already resolves seed keys via `permissionRepo.findBy({ key: In(...) })`
  (lines 92-95); `In` and `SEED_ROLE_PERMISSIONS` are already imported.
- `deassignRole` (lines 162-172) is unchanged and out of scope.
- `src/modules/users/users.service.spec.ts` currently covers `create` only; its mocks already
  provide `userRepo.findOne/save`, `roleRepo.findOneBy`, `permissionRepo.findBy`.

## Affected code

- `src/modules/users/users.service.ts` — `assignRole` only.
- `src/modules/users/workflow.md:81-89` — role flowchart end node.
- `src/modules/users/users.service.spec.ts` — add `assignRole` cases.

## Ordered tasks

1. **`assignRole`** — destructure `permissionRepo` from `this.repos(tenant)` and, after
   `this.assertCanAssignToUser(actorRoleKey, role.key as RoleKey);`, replace the single
   `userRepo.update(...)` line with:

   ```ts
   const permissionKeys = SEED_ROLE_PERMISSIONS[role.key as RoleKey] ?? [];
   const permissions = permissionKeys.length
     ? await permissionRepo.findBy({ key: In(permissionKeys) })
     : [];

   const loaded = await userRepo.findOne({
     where: { id },
     relations: { permissions: true },
   });
   if (!loaded) throw new NotFoundException('User not found');

   loaded.roleId = role.id;
   loaded.permissions = permissions; // full replace (drops old role + manual grants)
   await userRepo.save(loaded);

   return this.findOne(
     { id },
     { withRole: true, withPermissions: true },
     tenant,
   );
   ```

   Keep the existing user/role existence checks and the rank check before this block so a
   404/403 writes nothing. Assigning a fresh array to the `@JoinTable` relation makes TypeORM
   diff and rewrite the join rows (same mechanism as `grantPermissions`/`revokePermissions`).

2. **Docs** — `src/modules/users/workflow.md:81-89`: change the end node
   `update roleId / set roleId = null` for the assign path to
   `assignRole: roleId = role.id + replace user_permissions with SEED_ROLE_PERMISSIONS[role.key] (custom -> [])`.
   Do not change the deassign path description.

3. **Unit tests** — extend `src/modules/users/users.service.spec.ts` (sequence two
   `userRepo.findOne` calls: the `findOne` existence check, then the grants load; or use
   `mockResolvedValueOnce`). Cover:
   - `assignRole` to a system role → `permissionRepo.findBy` called with that role's seed keys;
     saved user has `roleId = role.id` and `permissions` exactly that set (old grants gone).
   - `assignRole` to a custom role (`key: 'assistant'`) → `permissionRepo.findBy` not called;
     saved user has `permissions: []`.
   - `assignRole` system role with a missing key in schema → saved with the returned subset.
   - `assignRole` rank failure → `userRepo.save` not called.
   - `assignRole` role not found → `NotFoundException`, no save.
   - Reassign same role → identical set (idempotent), save still called.

## Edge cases

- **Manual grants** are overwritten on each `assignRole` by design; `revokePermissions` still
  works independently between role changes.
- **System → custom role** → grants become `[]` (capabilities drop until a system role is
  assigned). Intended under the replace rule.
- **Missing seeded keys** (older schema) → assign the found subset (no warning added here;
  `create` only warns inline if desired — see Out of scope).
- **Public/no-tenant context** → public schema seeds only `SUPER_ADMIN`; assigning another
  role fails earlier at `Role not found`. User routes are tenant-scoped, so a non-issue.
- `deassignRole` still leaves `roleId = null` and grants untouched (unchanged behavior).

## Out of scope

- `deassignRole` changes, including the fallback-to-CUSTOMER idea.
- Refactoring `create` to share a resolver helper.
- Backfilling direct grants for existing users.
- Removing `role_permissions`/`seedRbac` role-permission writes or editing custom-role
  permissions.
- Changing the presenter, controller, `PermissionGuard`, `JwtGuard`, or `findAll`.

## Validation

- `npx tsc --noEmit`
- `pnpm lint` (pre-existing unrelated error at `src/main.ts:16`)
- `pnpm test` (pre-existing unrelated failure in `src/common/storage/r2.service.spec.ts`)
- Manual (needs `.env` + Postgres via `compose.yaml`, app running, tenant token):
  - `PATCH /users/:id/role` from CUSTOMER to ADMIN → `permissions` equals the ADMIN set, old
    CUSTOMER grants gone, `role.key = "ADMIN"`.
  - `PATCH /users/:id/role` to a custom role → `permissions: []`, `role.key` = custom key.
  - Actor of equal/higher target rank still gets 403 and no `permissions` change.

## Risks

- **Manual grants wiped** by `assignRole` (intended replace semantics).
- **Custom-role capabilities drop**: assigning a custom role now zeroes direct grants.
- **Constant/DB drift**: grants come from `SEED_ROLE_PERMISSIONS` while authorization still
  unions `role_permissions`; divergence makes the response `permissions` and effective access
  disagree.
- **Snapshot drift**: later `SEED_ROLE_PERMISSIONS` edits don't reach users until a role change.
- **Extra write**: one user read with `permissions` + one join-table rewrite per call.
