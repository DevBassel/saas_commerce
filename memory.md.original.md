# Project Memory — saas_store API

NestJS 10 + TypeORM + Postgres + JWT RBAC SaaS store API.

## Commands
- build: `pnpm build`
- lint: `pnpm lint` (runs `--fix`)
- typecheck only: `npx tsc --noEmit`
- run prod: `node dist/main.js` (from `dist/`, DB must run)
- boot smoke: start proc, run `node <temp>\smoke*.mjs`, kill proc
- DB check: `node C:\Users\bassel\AppData\Local\Temp\opencode\dbcheck.cjs`
- tests: none exist

## Module map
- `modules/users` — User entity, UsersController, PlatformController, UsersService, dto
- `modules/auth` — JwtGuard + PermissionGuard (global), decorators Roles/Permissions/Public, AuthService/Controller, RequestWithUser
- `modules/rbac` — Role + Permission entities, RbacService (seed), RolesController, PermissionsController, dto, constants
- `common/constants` — RoleKey.enum + ROLE_RANK, PermissionKey.enum (type-only union)
- DB: `synchronize=true`, no migrations, seed on boot idempotent

## Roles (RBAC)
`RoleKey`: SUPER_ADMIN(5) > STORE_OWNER(4) > ADMIN(3) > MANAGER(2) > EMPLOYEE(1) > CUSTOMER(0)

- Seed: SUPER_ADMIN + STORE_OWNER + ADMIN + MANAGER + EMPLOYEE + CUSTOMER. Roles carry NO permissions (label/rank only). Perms live on users.
- Guard bypass: SUPER_ADMIN bypass ALL. STORE_OWNER bypass ALL EXCEPT routes `@Roles([SUPER_ADMIN])`.
- Non-bypass: must own every `@Permissions` key; `@Roles` coarse gate first.
- Registration default role: CUSTOMER.
- Custom roles CRUD via admin endpoints; system roles undeletable.

## Guard order (app.module providers)
1. `JwtGuard` — verify token, load user fresh + `role` + direct `permissions` relations, set `req.user = {id,name,email,role:{id,key}|null,permissions[]}`. Role change live next request (no token role trust).
2. `PermissionGuard` — authz per decorators.

## Permission split
Per-module enums:
- `modules/users/constants/user-permissions.enum.ts` — `UserPermissionKey` users:read/update/delete/assign_role/assign_permissions
- `modules/rbac/constants/rbac-permissions.enum.ts` — `RbacPermissionKey` roles:* permissions:*
- `common/constants/PermissionKey.enum.ts` — type-only union `UserPermissionKey | RbacPermissionKey`
- Seed ALL_PERMISSIONS = spread both enums.
- New module permission → own enum + union update.

## Direct user role/perms assignment
- `PATCH /users/:id/role` (users:assign_role) sets role; `DELETE /users/:id/role` clears it (roleId null).
- `POST /users/:id/permissions` (users:assign_permissions) grants perms (union, deduped, body `{permissionIds:number[]}`); `DELETE /users/:id/permissions` revokes listed perms (body `{permissionIds?:number[]}`), empty/omitted clears all.
- User entity ManyToMany Permission via `user_permissions` join table. `roleId` column nullable (`number | null`).
- Guard uses direct user perms only (role = label). Live next request (fresh load).
- Escalation guard `assertCanAssignToUser`: actor rank > target rank (SUPER_ADMIN: >=). Non-super cannot grant perm they don't own.

## Tenant (partial)
- SUPER_ADMIN = platform. Manages all stores via `GET /api/v1/platform/stores`, `GET /api/v1/platform/stores/:id`.
- Self-serve store signup: `POST /api/v1/auth/register-store` → STORE_OWNER user.
- **No Tenant entity yet. No data isolation.** Store = owner account. Owners bypass = can see all users today. Real multi-tenant isolation pending.

## Endpoints
Auth (public): `POST /auth/register`, `POST /auth/register-store`, `POST /auth/login`
Users: `GET /users/profile` (self), `GET /users/profile/:id` (users:read), `GET /users` (users:read), `PATCH /users/:id` (users:update), `DELETE /users/:id` (users:delete), `PATCH /users/:id/role` (users:assign_role), `DELETE /users/:id/role` (users:assign_role), `POST /users/:id/permissions` (users:assign_permissions), `DELETE /users/:id/permissions` (users:assign_permissions)
Roles: CRUD `/roles` (+/:id) — ROLES_*
Permissions: CRUD `/permissions` (+/:id) — PERMISSIONS_*
Platform: `GET /platform/stores`, `GET /platform/stores/:id` — @Roles([SUPER_ADMIN])

## Key env
- `BOOTSTRAP_SUPER_ADMIN_EMAIL` — promote user → SUPER_ADMIN at boot
- `BOOTSTRAP_STORE_OWNER_EMAIL` — promote user → STORE_OWNER at boot
- JWT access/refresh secrets + expiry; `DB_SYNCHRONIZE=true` dev

## Known quirks / past bugs
- TypeORM `save({...user, roleId})` w/ loaded `role` relation recomputes roleId from stale relation → silent no-op. Use `repo.update({id}, {...})` then refetch. (users.service create)
- Guard ORDER matters: JwtGuard BEFORE PermissionGuard (user must exist first). Old RoleGuard ran first → always 403.
- `user.role` nullable (FK `onDelete SET NULL`, legacy rows). Always `user.role?.x` or ternary — never raw deref (TS18048).
- Role seed overwrites system role name/description each boot (idempotent reset). Roles carry no perms.
- PowerShell curl/array parsing unreliable → use node fetch smoke scripts.

## Postman
`postman/saas_store.postman_collection.json` — 23 requests, auth auto-stores tokens. Folder auth = Bearer {{access_token}}.
