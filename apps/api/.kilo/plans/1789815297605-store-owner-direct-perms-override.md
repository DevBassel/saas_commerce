# Plan: STORE_OWNER can manage roles and direct permissions of any tenant user

## Goal

A tenant `STORE_OWNER` becomes the top tenant actor for user administration: they can change any
user's role and grant/revoke any user's direct permissions, including peer `STORE_OWNER`s. The only
exception is that no actor may change their **own** role, to prevent self-lockout.

## Decisions (confirmed with user)

- `STORE_OWNER` is treated like `SUPER_ADMIN` in the rank check for all four mutations:
  - `PATCH /users/:id/role` → `assignRole` (HTTP 200)
  - `DELETE /users/:id/role` → `deassignRole` (HTTP 200)
  - `POST /users/:id/permissions` → `grantPermissions` (HTTP 201)
  - `DELETE /users/:id/permissions` → `revokePermissions` (HTTP 200)
- Rank rule becomes: `SUPER_ADMIN` or `STORE_OWNER` actor → `target rank <= actor rank`;
  every other actor → `target rank < actor rank` (unchanged for `ADMIN`/custom roles).
- **New guard:** `PATCH`/`DELETE /users/:id/role` where `:id === actor.id` → 403
  (`You cannot change your own role`). Applies to every actor. Direct permission grant/revoke on
  self remains allowed (harmless; the role still grants the full set).
- Peer-owner targeting is intentional: a STORE_OWNER may demote or deassign another STORE_OWNER.

## Root cause

`UsersService.assertCanAssignToUser` (`src/modules/users/users.service.ts:240-251`) only grants the
equal-rank exception to `SUPER_ADMIN`. No `SUPER_ADMIN` is seeded per tenant (`TENANT_ROLE_KEYS` in
`src/modules/rbac/rbac.seed.ts:14-18` = STORE_OWNER/ADMIN/CUSTOMER), so a STORE_OWNER (rank 4)
always hits `targetRank < actorRank` → 403 for peer owners and self.

For direct permissions specifically, the `users:assign_permissions` guard requirement
(`users.controller.ts:88,103`) already passes for STORE_OWNER (seeded with all permissions,
`seed-data.ts:174`) and the grant ownership bypass (`users.service.ts:179-190`) already exempts
STORE_OWNER, so rank was the only blocker there.

## Tasks

1. **Make STORE_OWNER a top actor** in `assertCanAssignToUser`
   (`src/modules/users/users.service.ts:240-251`). No extra flag is needed because the rule now
   applies uniformly to all four callers.

   ```ts
   const topActor =
     actorRoleKey === RoleKey.SUPER_ADMIN ||
     actorRoleKey === RoleKey.STORE_OWNER;
   const allowed = topActor ? targetRank <= actorRank : targetRank < actorRank;
   ```

2. **Add the self-role-change guard** in `assignRole` and `deassignRole`
   (`users.service.ts:128` and `:147`):
   - Add an `actorId: number` parameter to both methods.
   - Before any write, `if (id === actorId) throw new ForbiddenException('You cannot change your own role');`
   - Do **not** apply this guard to `grantPermissions`/`revokePermissions`.

3. **Pass the actor id from the controller** (`src/modules/users/users.controller.ts:61-85`):
   `request.user.id` is available (`RequestWithUser.interface.ts:8`) — pass it into both service
   calls. No DTO or route change.

4. **Update `src/modules/users/workflow.md`**:
   - Line 56 (`A3`, role assignment): `SUPER_ADMIN` **or** `STORE_OWNER` → `target rank <= actor
     rank`; other actors strict; plus a self-target 403 branch.
   - Lines 69 (`G3`) and 84 (`V2`, permissions): `SUPER_ADMIN` or `STORE_OWNER` → `target rank <=
     actor rank`; other actors strict.

5. **Add unit tests** `src/modules/users/users.service.spec.ts` (none exists today).

No guard, seed, entity, DTO, or migration changes are required. `SUPER_ADMIN` behavior is unchanged;
`ADMIN` and custom-role actors keep the strict rule.

## Test design

Construct the service directly with plain mocks, following `src/modules/rbac/rbac.service.spec.ts`:

```ts
const userRepo = {
  findOne: jest.fn(), update: jest.fn(), save: jest.fn((u) => Promise.resolve(u)),
  delete: jest.fn(), find: jest.fn(), create: jest.fn((v) => v),
};
const roleRepo = { findOneBy: jest.fn() };
const permissionRepo = { findBy: jest.fn() };
const tenantManager = { getRepository: jest.fn(async () => userRepo) };
const svc = new UsersService(
  userRepo as never, roleRepo as never, permissionRepo as never, tenantManager as never,
);
```

Call methods **without** a `tenant` argument: `tenantRefFromContext()` returns `undefined` outside
`AsyncLocalStorage` (`src/modules/auth/tenant-context.ts:14-17`), so `repos()` falls back to the
injected repos and `getRepository` is never hit. `userRepo.findOne` is called with different args in
one flow (`{ where: [{ id }, { email }] }` for the user, then `{ where: { id }, relations }` for the
relation-loaded entity) — use `mockImplementation` keyed on the presence of `relations`.

Cases:

1. STORE_OWNER actor grants a direct permission to a peer STORE_OWNER target → resolves, `save` called.
2. STORE_OWNER actor revokes a direct permission from a peer STORE_OWNER target → resolves.
3. STORE_OWNER actor grants a direct permission to **self** → resolves (no self guard on permissions).
4. STORE_OWNER actor `assignRole` on a peer STORE_OWNER target → resolves, `update` with `roleId`.
5. STORE_OWNER actor `deassignRole` on a peer STORE_OWNER target → resolves, `update` with `roleId: null`.
6. STORE_OWNER actor `assignRole` on self → `ForbiddenException`, `update` not called.
7. STORE_OWNER actor `deassignRole` on self → `ForbiddenException`, `update` not called.
8. ADMIN actor `assignRole` on a STORE_OWNER target → `ForbiddenException`.
9. ADMIN actor grants to a peer ADMIN target → `ForbiddenException`.
10. ADMIN actor grants a permission it does not own → `ForbiddenException` (unchanged ownership rule).

## Acceptance criteria

- STORE_OWNER token: `PATCH /users/{peerOwnerId}/role` → 200; `DELETE /users/{peerOwnerId}/role` → 200.
- STORE_OWNER token: `PATCH|DELETE /users/{ownId}/role` → 403 (`cannot change your own role`).
- STORE_OWNER token: `POST|DELETE /users/{anyId}/permissions` incl. peer owner and self → 201/200.
- ADMIN token: cannot change a peer/higher-rank user's role or direct permissions (403), and cannot
  grant a permission it does not own (403).
- Existing `verify-tenant-lifecycle.ts` assignment (owner → customer, line 181-199) still passes.

## Validation

1. `npx tsc --noEmit`
2. `pnpm lint`
3. `pnpm test`
4. `npx ts-node -r tsconfig-paths/register test/verify-tenant-lifecycle.ts`
5. Manual Postman (`Users` folder, tenant token from a STORE_OWNER login), per acceptance criteria.

## Out of scope

- Any endpoint for editing `role_permissions` (role→permission mappings) — still no route.
- Special protection for the founder account (`Tenant.ownerUserId`) against peer-owner demotion.
- Removing a role-granted permission for one user: direct permissions remain additive-only (effective
  set is a union in `jwt.guard.ts:92-98`).
- Tightening `revokePermissions` so an empty/missing `permissionIds` no longer wipes all direct
  permissions (`users.service.ts:227-230`).
- Changing rank handling for `ADMIN` or custom roles (custom roles resolve to rank 0).
- Stale `MANAGER`/`EMPLOYEE` references in `src/modules/rbac/workflow.md:30`.

## Risks

- Peer-owner demotion is now possible by design; the founder (`Tenant.ownerUserId`) is not
  special-cased, so one owner can strip another owner's access.
- The self-role guard changes the 403 message for any actor attempting a self role change (status is
  unchanged; `ADMIN`/`CUSTOMER` self-changes were already rejected by rank or guards).
- Role and direct-permission reads are computed per request, so a demotion or revoke affects the
  target on their next request; their current access token stays valid until then.
