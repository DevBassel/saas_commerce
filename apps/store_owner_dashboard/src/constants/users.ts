import type { Permission } from "@/types/permission";
import type { UserProfile } from "@/types/user";

export const ROLE_RANK: Record<string, number> = {
  SUPER_ADMIN: 5,
  STORE_OWNER: 4,
  ADMIN: 3,
  CUSTOMER: 0,
};

export const ASSIGN_BYPASS_ROLES = ["SUPER_ADMIN", "STORE_OWNER"];

export const USER_NAME_MIN = 2;
export const USER_NAME_MAX = 100;
export const USER_PASSWORD_MIN = 8;
export const USER_PASSWORD_MAX = 16;

export const rankOf = (key?: string | null): number =>
  key ? (ROLE_RANK[key] ?? 0) : 0;

export const canCreateUsers = (key?: string | null): boolean =>
  rankOf(key) >= (ROLE_RANK.ADMIN ?? 0);

export const isBypassRole = (key?: string | null): boolean =>
  key != null && ASSIGN_BYPASS_ROLES.includes(key);

export const canManageTarget = (
  actorRoleKey?: string | null,
  targetRoleKey?: string | null,
): boolean => {
  const actorRank = rankOf(actorRoleKey);
  const targetRank = rankOf(targetRoleKey);
  return actorRoleKey === "SUPER_ADMIN"
    ? targetRank <= actorRank
    : targetRank < actorRank;
};

export const filterAssignableRoles = <T extends { key: string }>(
  roles: T[],
  actorRoleKey?: string | null,
): T[] => roles.filter((role) => canManageTarget(actorRoleKey, role.key));

export const permissionKeys = (
  permissions?: UserProfile["permissions"] | Permission[] | null,
): string[] =>
  (permissions ?? []).map((permission) =>
    typeof permission === "string" ? permission : permission.key,
  );

export type PermissionAction =
  | "create"
  | "read"
  | "update"
  | "delete"
  | "other";

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
