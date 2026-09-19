# Normalize user payload: `role` without permissions, single top-level `permissions`

## Goal

Every user object returned by the Users API exposes permissions in exactly one place:
`role` carries identity only (`{ id, key, name }`, no nested `permissions`), and a single
top-level `permissions` array carries the user's **directly assigned** `user_permissions`
grants as permission objects.

## Locked decisions

- `permissions` = **direct grants only** (`user_permissions`), NOT the effective role ∪ direct
  union. Authorization behavior is unchanged; the guard still unions internally.
- Permission items are objects: `{ id, key, name }` (no description/timestamps).
- `role` = `{ id, key, name }` or `null` when the user has no role. Never embeds `permissions`.
- Applies consistently to **all** user-returning endpoints, including `GET /users/profile`
  (self). Profile re-reads the user and returns the same direct-only shape.
- `GET /users` must now load direct permissions too (currently role only).
- Keep `roleId`, `emailVerified`, `createdAt`, `updatedAt` on the payload for backward
  compatibility; drop nothing else that exists today except `role.permissions`.
- No DB/schema/migration changes. No change to `RequestWithUser` internals
  (`request.user.permissions` stays `PermissionKey[]` = effective union for guards).

## Target shape

```json
{
  "id": 5,
  "name": "Jane",
  "email": "jane@example.com",
  "emailVerified": false,
  "roleId": 3,
  "role": { "id": 3, "key": "ADMIN", "name": "Admin" },
  "permissions": [{ "id": 14, "key": "products:read", "name": "Read products" }],
  "createdAt": "...",
  "updatedAt": "..."
}
```

## Affected code

- `src/modules/users/users.service.ts:92-95` — `findAll` relations: `{ role: true }` → add `permissions: true`.
- `src/modules/users/users.service.ts:97-113` — `findOne` keeps loading `role.permissions`
  (JwtGuard at `src/modules/auth/guards/jwt.guard.ts:94-98` depends on it); do NOT strip it here.
- `src/modules/users/users.service.ts` — `assignRole`/`deassignRole`/`grantPermissions`/`revokePermissions`
  return `findOne(...)`. Leave service return values as entities; present at the controller boundary.
- `src/modules/users/users.controller.ts:26-114` — wrap every returned user through the presenter;
  change `getProfile` to re-read via `usersService.findOne({ id: request.user.id }, { withPermissions: true })`
  then present.
- New `src/modules/users/user.presenter.ts` — presentational types + mapping function.
- `src/modules/users/workflow.md:7-9` — update the response-shape notes for `/users/profile`,
  `/users/profile/:id`, `/users`.

## Ordered tasks

1. Add `src/modules/users/user.presenter.ts`:
   - Types `RoleSummary { id; key; name }`, `PermissionSummary { id; key; name }`,
     `UserResponse` (id, name, email, emailVerified, roleId, role, permissions, createdAt, updatedAt).
   - `presentUser(user: User): UserResponse`:
     - `roleId: user.roleId ?? null`
     - `role: user.role ? { id, key, name } : null` (hand-picked → never leaks `role.permissions`)
     - `permissions: (user.permissions ?? []).map(p => ({ id, key, name })).sort((a,b) => a.key.localeCompare(b.key))`
     - hand-pick remaining scalar fields; never spread the entity.
2. `UsersService.findAll`: load `{ role: true, permissions: true }`.
3. `UsersController`: map results with `presentUser` on
   `getProfile` (after re-read), `findOne`, `findAll`, `update`, `assignRole`, `deassignRole`,
   `grantPermissions`, `revokePermissions`.
4. Update `src/modules/users/workflow.md` to document the normalized response and that
   `GET /users/profile` re-reads the user.
5. (Optional, recommended) Add `src/modules/users/user.presenter.spec.ts` asserting:
   role.permissions is absent, permissions is an object array sorted by key, null role → `role: null`,
   undefined permissions → `[]`.

## Edge cases

- User with `roleId = null` (after deassign) → `role: null`, `roleId: null`.
- User with zero direct grants → `permissions: []`.
- User with a role carrying many permissions → those do NOT appear in `permissions`
  (direct-only contract); they remain effective for guards.
- Revoking a direct permission that the role also grants → it disappears from the response
  `permissions` array even though authorization still allows it. This is expected under the
  direct-only contract; document it in `workflow.md`.
- `jti`/`password` are never emitted (presenter hand-picks fields; `@Exclude` still applies).

## Non-goals / out of scope

- No change to `JwtGuard`, `PermissionGuard`, `RequestWithUser`, or how effective permissions
  are computed/enforced.
- No change to role endpoints (`GET /roles` still returns roles without permissions) or to
  `role_permissions` mutation (there is no such endpoint).
- No `POST /users` create endpoint is being added; the requested "give perms on create" is
  satisfied by the response shape only.
- No DB schema change and no Postman request change required (Postman only reads `users[].id`;
  verified at `postman/saas_store.postman_collection.json:343-346`).

## Validation

- `npx tsc --noEmit`
- `pnpm lint`
- `pnpm test`
- Manual (needs `.env` + Postgres via `compose.yaml`, app running): with a tenant token call
  - `GET /users/profile` → has `role.key`, `role.name`, no `role.permissions`; `permissions` objects.
  - `GET /users/profile/:id` and `GET /users` → same shape; role-granted perms absent.
  - `POST /users/:id/permissions` then `GET /users/profile/:id` → new direct perm appears.
  - `DELETE /users/:id/permissions` → removed from `permissions`.
  - `PATCH /users/:id/role` → `role` updates, `permissions` unchanged (still direct only).

## Risks

- **Behavioral compatibility**: clients that read `role.permissions` break. Mitigation: this is the
  requested change; note it in `workflow.md`. Clients needing role capabilities must read the role
  separately.
- **Profile now costs an extra read** (`getProfile` re-queries instead of returning `request.user`).
  Acceptable for consistency; the query is by primary key.
- **`GET /users` now joins `user_permissions`**, slightly heavier list query.
