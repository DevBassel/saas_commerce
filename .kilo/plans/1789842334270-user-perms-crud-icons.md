# User Edit — CRUD Icons in Permissions Section

Repo: `C:\works\dash\tenant_dash` (Refine v5 + Vite + React 19 + TS strict, shadcn/ui, lucide-react).

## Goal

On the user **edit** page, the "Direct permissions" matrix (`UserPermissionsCard`) lists each
permission as `resource:action`. Add a small icon on **each permission row** indicating the CRUD
action, derived from the permission key suffix. UI-only change; no API/behavior change.

## Decision (confirmed with user)

- One action icon per permission row, placed before the permission name/key text.
- Icon is derived from `permission.key` (the suffix after `:`), not from `permission.name`.
- Mapping: `create` → `Plus`, `read` (also `list`/`view`) → `Eye`, `update` → `Pencil`,
  `delete` → `Trash2`, anything else → `KeyRound`.
- Icon is decorative (`aria-hidden`), muted (`text-muted-foreground`), `h-4 w-4`, `shrink-0`.
- Existing layout, toggles, badges, "From role"/"Direct" hints, and permission ordering are
  unchanged.

## Files

### Changed

- `src/constants/users.ts` — add pure, testable `permissionAction` helper + `PermissionAction` type.
- `src/constants/users.test.ts` — unit tests for the helper.
- `src/components/users/user-permissions-card.tsx` — icon map + render icon in each row.

No other files change.

## Task list (ordered)

1. **Helper** — in `src/constants/users.ts` add:
   ```ts
   export type PermissionAction =
     | "create" | "read" | "update" | "delete" | "other";

   export const permissionAction = (key?: string | null): PermissionAction => {
     const action = (key ?? "").split(":")[1]?.toLowerCase();
     switch (action) {
       case "create":
         return "create";
       case "read":
       case "list":
       case "view":
         return "read";
       case "update":
         return "update";
       case "delete":
         return "delete";
       default:
         return "other";
     }
   };
   ```
2. **Tests** — in `src/constants/users.test.ts` add a `describe("permissionAction")` covering
   `users:create`→`create`, `users:read`→`read`, `products:update`→`update`,
   `users:delete`→`delete`, `cart:list`/`cart:view`→`read`, and unknown/missing
   (`"weird"`, `""`, `null`, `undefined`)→`other`.
3. **Icon map** — in `src/components/users/user-permissions-card.tsx` import
   `Eye, KeyRound, Loader2, Pencil, Plus, Trash2` and `type LucideIcon` from `lucide-react`, and
   `permissionAction, type PermissionAction` from `@/constants/users`. Add:
   ```ts
   const PERMISSION_ICONS: Record<PermissionAction, LucideIcon> = {
     create: Plus,
     read: Eye,
     update: Pencil,
     delete: Trash2,
     other: KeyRound,
   };
   ```
4. **Row render** — in the row body (currently the `flex flex-col` block at
   `user-permissions-card.tsx:223-232`), wrap the icon + existing text column:
   ```tsx
   const ActionIcon =
     PERMISSION_ICONS[permissionAction(permission.key)];
   ...
   <div className={cn("flex", "items-center", "gap-3")}>
     <ActionIcon
       aria-hidden="true"
       className={cn("h-4", "w-4", "shrink-0", "text-muted-foreground")}
     />
     <div className={cn("flex", "flex-col")}>
       <span className="text-sm font-medium">{permission.name}</span>
       <span className={cn("text-xs", "text-muted-foreground")}>
         {permission.key}
       </span>
     </div>
   </div>
   ```
   Keep the outer row, badges, spinner, and `Switch` exactly as-is.

## Risks / notes

- `permission.key` may be missing the `:` split or use a non-CRUD action; `permissionAction`
  returns `"other"` and the `KeyRound` icon renders, so no crash or blank cell.
- `noUnusedLocals` is on: ensure every imported icon is used (they are, via the map).
- Do not reorder permissions to CRUD order — out of scope for this change.

## Validation

- `npx tsc --noEmit` — 0 errors.
- `npx eslint .` — 0 errors.
- `pnpm test` — `permissionAction` tests plus existing suite pass.
- `pnpm build` — passes.
- Manual: open a user edit page → each permission row shows an icon matching its action
  (plus/eye/pencil/trash), and toggling still grants/revokes as before.

## Out of scope

- Reordering permissions into create/read/update/delete.
- Icons in group headers, show page (`show.tsx`) permission badges, or role cards.
- Any backend/API change.
